"""
Vector store + hybrid retrieval for the product catalog.

Storage decision
----------------
The catalog is ~700-800 products. At 768 float32 dims that is ~2.4 MB of
vectors. A brute-force cosine search over that with numpy takes < 1 ms, so a
dedicated vector database (Pinecone/Qdrant/Weaviate) would add a vendor, a
network hop (~50-150 ms) and a bill while giving zero quality benefit.

So vectors live in the existing MySQL database (`product_embeddings`, one
BLOB per product) and are loaded into memory once per warm serverless
instance (cached for AI_INDEX_TTL seconds). If the catalog ever grows past
~50k products, swap `ProductIndex.search` for pgvector/Qdrant - the
`retrieve_relevant_products()` contract stays the same.

Retrieval = hybrid:
    score = 0.7 * cosine(query, product) + 0.3 * keyword_bm25(query, product)
Keyword scoring keeps exact model numbers ("X6c", "M185") and brand names
precise, which pure embeddings sometimes blur. If embeddings are missing or
the embedding API is down, retrieval silently degrades to keyword-only.
"""
import hashlib
import math
import os
import re
import threading
import time
from collections import defaultdict

import numpy as np

from config import get_db
from db_schema import ensure_schema
from . import llm
from .kv import _MemoryKV

INDEX_TTL = int(os.getenv("AI_INDEX_TTL", "600"))
SEM_WEIGHT = 0.7
KW_WEIGHT = 0.3
MIN_SEMANTIC = float(os.getenv("AI_MIN_SIMILARITY", "0.45"))

_STOP = set(
    "a an and are best buy can cheap do find for from get give good have i in is it looking me my need of "
    "on or please recommend show some something suggest the to under over above below want with you rs pkr "
    "price budget any".split()
)

# Category name in the DB (from the Excel import) -> extra words people use.
CATEGORY_SYNONYMS = {
    "mobile": "mobile phone smartphone cell phone android iphone handset",
    "laptop": "laptop notebook computer pc ultrabook",
    "electronics": "electronics accessories gadget",
    "fashion(men)": "men clothing apparel menswear male",
    "women": "women clothing apparel womenswear ladies female",
    "shoes": "shoes footwear sneakers",
    "home": "home kitchen household cookware",
    "beauty": "beauty personal care cosmetics skincare grooming",
    "toys": "toys kids children games play",
    "books": "books stationery school office supplies",
    "sports": "sports fitness gym exercise workout outdoor",
    "automotive": "automotive car vehicle motor accessories",
    "pet": "pet supplies dog cat animal",
    "gardening": "gardening garden plants outdoor tools",
    "grocery": "grocery food pantry kitchen staples",
}

_lock = threading.Lock()
_index = None
_query_cache = _MemoryKV(max_items=2000)


def tokenize(text):
    return [t for t in re.findall(r"[a-z0-9]+(?:\.[0-9]+)?", (text or "").lower()) if t not in _STOP]


def category_synonyms(category):
    c = (category or "").lower()
    return " ".join(v for k, v in CATEGORY_SYNONYMS.items() if k in c)


def _price_bands(products):
    """Per-category tertiles -> 'budget' / 'mid-range' / 'premium' tag."""
    by_cat = defaultdict(list)
    for p in products:
        by_cat[p["category"]].append(float(p["price"] or 0))
    cuts = {}
    for cat, prices in by_cat.items():
        prices.sort()
        n = len(prices)
        cuts[cat] = (prices[n // 3], prices[(2 * n) // 3]) if n >= 3 else (0, float("inf"))
    bands = {}
    for p in products:
        lo, hi = cuts[p["category"]]
        price = float(p["price"] or 0)
        bands[p["id"]] = "budget affordable" if price <= lo else ("premium high-end" if price > hi else "mid-range")
    return bands


def build_product_document(p, band=""):
    """The text that gets embedded for a product (name+brand+category+specs+description+tags)."""
    desc = (p.get("description") or "").strip()
    if desc.lower().startswith("no description"):
        desc = ""
    parts = [
        f"{p.get('name', '')}",
        f"Brand: {p.get('brand') or 'Generic'}",
        f"Category: {p.get('category', '')}",
    ]
    if p.get("specs"):
        parts.append(f"Specs: {p['specs']}")
    if desc:
        parts.append(f"Description: {desc}")
    tags = " ".join(x for x in [category_synonyms(p.get("category")), band] if x)
    if tags:
        parts.append(f"Tags: {tags}")
    parts.append(f"Price: Rs. {float(p.get('price') or 0):,.0f}")
    return "\n".join(parts)


def content_hash(doc):
    return hashlib.sha1(f"{llm.EMBED_MODEL}:{llm.EMBED_DIMS}:{doc}".encode()).hexdigest()


def fetch_catalog():
    db = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute("SELECT * FROM products")
        rows = cur.fetchall()
    finally:
        cur.close()
        db.close()
    for r in rows:
        r["price"] = float(r["price"] or 0)
        r["stock"] = int(r["stock"] or 0)
    return rows


def fetch_ratings():
    db = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute("SELECT product_id, ROUND(AVG(rating),1) AS rating, COUNT(*) AS n FROM reviews GROUP BY product_id")
        return {r["product_id"]: (float(r["rating"] or 0), int(r["n"])) for r in cur.fetchall()}
    except Exception:  # noqa: BLE001
        return {}
    finally:
        cur.close()
        db.close()


def load_embeddings():
    ensure_schema()
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            "SELECT product_id, content_hash, embedding FROM product_embeddings WHERE model=%s AND dims=%s",
            (llm.EMBED_MODEL, llm.EMBED_DIMS),
        )
        return {
            int(pid): (h, np.frombuffer(bytes(blob), dtype="<f4"))
            for pid, h, blob in cur.fetchall()
        }
    finally:
        cur.close()
        db.close()


def save_embeddings(rows):
    """rows: list of (product_id, content_hash, np.ndarray)."""
    if not rows:
        return
    ensure_schema()
    db = get_db()
    cur = db.cursor()
    try:
        cur.executemany(
            """
            INSERT INTO product_embeddings (product_id, model, dims, content_hash, embedding)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE model=VALUES(model), dims=VALUES(dims),
                content_hash=VALUES(content_hash), embedding=VALUES(embedding)
            """,
            [
                (pid, llm.EMBED_MODEL, llm.EMBED_DIMS, h, np.asarray(v, dtype="<f4").tobytes())
                for pid, h, v in rows
            ],
        )
        db.commit()
    finally:
        cur.close()
        db.close()


class ProductIndex:
    def __init__(self, products, embeddings, ratings):
        self.products = products
        self.by_id = {p["id"]: p for p in products}
        bands = _price_bands(products) if products else {}
        self.docs = [build_product_document(p, bands.get(p["id"], "")) for p in products]
        for p in products:
            r = ratings.get(p["id"])
            p["rating"], p["review_count"] = (r if r else (0.0, 0))

        # Dense vectors (rows of zeros for products without an up-to-date embedding)
        dims = llm.EMBED_DIMS
        self.matrix = np.zeros((len(products), dims), dtype=np.float32)
        self.has_vec = np.zeros(len(products), dtype=bool)
        self.stale = []
        for i, (p, doc) in enumerate(zip(products, self.docs)):
            e = embeddings.get(p["id"])
            if e is not None and e[1].shape[0] == dims:
                self.matrix[i] = e[1]
                self.has_vec[i] = True
                if e[0] != content_hash(doc):
                    self.stale.append(p["id"])
            else:
                self.stale.append(p["id"])

        # Sparse keyword index (BM25-lite)
        self.postings = defaultdict(set)
        for i, doc in enumerate(self.docs):
            for t in set(tokenize(doc)):
                self.postings[t].add(i)
        n = max(1, len(products))
        self.idf = {t: math.log(1 + n / (1 + len(ix))) for t, ix in self.postings.items()}
        self.built_at = time.time()

    @property
    def semantic_ready(self):
        return bool(self.has_vec.any())

    # ------------------------------------------------------------- scoring
    def keyword_scores(self, query):
        q = tokenize(query)
        scores = np.zeros(len(self.products), dtype=np.float32)
        if not q:
            return scores
        total = sum(self.idf.get(t, 1.0) for t in q) or 1.0
        for t in q:
            for i in self.postings.get(t, ()):
                scores[i] += self.idf.get(t, 1.0)
        return scores / total

    def filter_mask(self, filters):
        f = filters or {}
        mask = np.ones(len(self.products), dtype=bool)
        cat = (f.get("category") or "").lower().strip()
        brand = (f.get("brand") or "").lower().strip()
        lo, hi = f.get("min_price"), f.get("max_price")
        exclude = set(f.get("exclude_ids") or [])
        for i, p in enumerate(self.products):
            if cat and cat not in (p["category"] or "").lower() and cat not in category_synonyms(p["category"]):
                mask[i] = False
            elif brand and brand not in (p["brand"] or "").lower():
                mask[i] = False
            elif lo is not None and p["price"] < float(lo):
                mask[i] = False
            elif hi is not None and p["price"] > float(hi):
                mask[i] = False
            elif f.get("in_stock_only") and p["stock"] <= 0:
                mask[i] = False
            elif p["id"] in exclude:
                mask[i] = False
        return mask

    def search(self, query, k=8, filters=None, query_vec=None):
        if not self.products:
            return []
        mask = self.filter_mask(filters)
        kw = self.keyword_scores(query) if query else np.zeros(len(self.products), dtype=np.float32)

        if query_vec is not None and self.semantic_ready:
            sem = self.matrix @ np.asarray(query_vec, dtype=np.float32)
            score = SEM_WEIGHT * sem + KW_WEIGHT * kw
            # relevance floor: semantically weak AND no keyword hit -> drop (prevents junk results)
            relevant = (sem >= MIN_SEMANTIC) | (kw > 0.34)
        else:
            sem = None
            score = kw.copy()
            relevant = kw > 0 if query else np.ones(len(self.products), dtype=bool)

        # small tie-breakers: in stock, rating
        stock = np.array([p["stock"] > 0 for p in self.products], dtype=np.float32)
        rating = np.array([p.get("rating", 0) for p in self.products], dtype=np.float32)
        score = score + 0.02 * stock + 0.005 * rating

        valid = mask & relevant
        idx = np.where(valid)[0]
        if idx.size == 0:
            return []
        top = idx[np.argsort(-score[idx])][:k]
        out = []
        for i in top:
            p = dict(self.products[i])
            p["score"] = round(float(score[i]), 4)
            if sem is not None:
                p["similarity"] = round(float(sem[i]), 4)
            out.append(p)
        return out


def get_index(force=False):
    global _index
    if not force and _index is not None and time.time() - _index.built_at < INDEX_TTL:
        return _index
    with _lock:
        if not force and _index is not None and time.time() - _index.built_at < INDEX_TTL:
            return _index
        products = fetch_catalog()
        try:
            embeddings = load_embeddings()
        except Exception as e:  # noqa: BLE001
            print("Could not load embeddings, keyword-only retrieval:", e)
            embeddings = {}
        idx = ProductIndex(products, embeddings, fetch_ratings())
        _self_heal(idx)
        _index = idx
        return _index


def _self_heal(idx, max_items=25):
    """Embed a handful of new/edited products on the fly (admin added a product)."""
    if not idx.stale or len(idx.stale) > max_items or not llm.available():
        return
    try:
        pos = {p["id"]: i for i, p in enumerate(idx.products)}
        docs = [idx.docs[pos[pid]] for pid in idx.stale]
        vecs = llm.embed_texts(docs)
        save_embeddings([(pid, content_hash(d), v) for pid, d, v in zip(idx.stale, docs, vecs)])
        for pid, v in zip(idx.stale, vecs):
            idx.matrix[pos[pid]] = v
            idx.has_vec[pos[pid]] = True
        idx.stale = []
    except Exception as e:  # noqa: BLE001
        print("self-heal embedding failed:", e)


def invalidate():
    global _index
    _index = None


def embed_query_cached(query):
    key = hashlib.sha1(f"{llm.EMBED_MODEL}:{llm.EMBED_DIMS}:{query.strip().lower()}".encode()).hexdigest()
    hit = _query_cache.get(key)
    if hit is not None:
        return hit
    vec = llm.embed_query(query)
    _query_cache.set(key, vec, ttl=3600)
    return vec


def public_product(p):
    """Fields safe/useful for the UI and the LLM prompt."""
    return {
        "id": p["id"],
        "name": p["name"],
        "brand": p.get("brand"),
        "category": p.get("category"),
        "price": float(p.get("price") or 0),
        "stock": int(p.get("stock") or 0),
        "image": p.get("image"),
        "rating": p.get("rating", 0),
        "review_count": p.get("review_count", 0),
        "specs": p.get("specs") or None,
        "description": None if (p.get("description") or "").lower().startswith("no description") else p.get("description"),
    }


def retrieve_relevant_products(query, k=8, filters=None):
    """
    Public retrieval function used by the RAG pipeline.

    query   - natural language user request ("light laptop for coding under 2 lakh")
    k       - number of products to return (5-10 recommended)
    filters - optional {category, brand, min_price, max_price, in_stock_only, exclude_ids}
    """
    idx = get_index()
    qvec = None
    if query and idx.semantic_ready and llm.available():
        try:
            qvec = embed_query_cached(query)
        except Exception as e:  # noqa: BLE001
            print("query embedding failed, keyword fallback:", e)
    return [public_product(p) | {"score": p["score"]} for p in idx.search(query, k=k, filters=filters, query_vec=qvec)]


def recommend_by_vector(vec, k=8, filters=None):
    idx = get_index()
    if vec is None or not idx.semantic_ready:
        return []
    return [public_product(p) for p in idx.search("", k=k, filters=filters, query_vec=vec)]


def product_vector(product_ids):
    """Mean embedding of some products (used for the user taste profile)."""
    idx = get_index()
    pos = {p["id"]: i for i, p in enumerate(idx.products)}
    rows = [idx.matrix[pos[i]] for i in product_ids if i in pos and idx.has_vec[pos[i]]]
    if not rows:
        return None
    v = np.mean(rows, axis=0)
    n = np.linalg.norm(v)
    return v / n if n else None
