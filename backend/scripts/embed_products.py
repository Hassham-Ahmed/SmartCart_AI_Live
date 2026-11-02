"""
Generate / refresh product embeddings.

    cd backend
    python -m scripts.embed_products            # embed new + changed products only
    python -m scripts.embed_products --all      # re-embed everything
    python -m scripts.embed_products --dry-run  # show what would be embedded + cost

Incremental: each product's document text is hashed (sha1 of model + dims +
text). Unchanged products are skipped, so re-running after an admin edits a
few products costs fractions of a cent.

Needs: GEMINI_API_KEY + DB_* variables in backend/.env
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from ai import llm  # noqa: E402
from ai.vector_store import (  # noqa: E402
    _price_bands, build_product_document, content_hash, fetch_catalog, load_embeddings, save_embeddings,
)

PRICE_PER_M_TOKENS = 0.15  # USD, gemini-embedding-001 standard tier


def approx_tokens(text):
    return max(1, len(text) // 4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="re-embed every product")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--batch", type=int, default=100)
    args = ap.parse_args()

    products = fetch_catalog()
    bands = _price_bands(products)
    existing = {} if args.all else load_embeddings()

    todo = []
    for p in products:
        doc = build_product_document(p, bands.get(p["id"], ""))
        h = content_hash(doc)
        if args.all or existing.get(p["id"], (None,))[0] != h:
            todo.append((p["id"], h, doc))

    tokens = sum(approx_tokens(d) for _, _, d in todo)
    print(f"Catalog: {len(products)} products | to embed: {len(todo)} | model={llm.EMBED_MODEL} dims={llm.EMBED_DIMS}")
    print(f"~{tokens:,} tokens -> est. cost ${tokens / 1e6 * PRICE_PER_M_TOKENS:.4f}")
    if todo:
        print("\nSample document:\n" + "-" * 40 + f"\n{todo[0][2]}\n" + "-" * 40)
    if args.dry_run or not todo:
        return

    t0 = time.time()
    done = 0
    for start in range(0, len(todo), args.batch):
        chunk = todo[start:start + args.batch]
        vecs = llm.embed_texts([d for _, _, d in chunk], task_type="RETRIEVAL_DOCUMENT", batch_size=args.batch)
        save_embeddings([(pid, h, v) for (pid, h, _), v in zip(chunk, vecs)])
        done += len(chunk)
        print(f"  embedded {done}/{len(todo)}")
    print(f"Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
