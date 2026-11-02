"""
Logic tests for the AI layer. No network, no database: the catalog is the
real Copy-of-fyp-products.xlsx, and the LLM is a scripted fake.

    cd backend && python -m pytest -q tests
"""
import copy
import os
import re
from types import SimpleNamespace

import numpy as np
import pytest

from ai import agent, context as ctxmod, llm, tools, vector_store as vs

XLSX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Copy-of-fyp-products.xlsx")


# ------------------------------------------------------------------ fixtures
def load_real_catalog():
    import openpyxl

    wb = openpyxl.load_workbook(XLSX, read_only=True)
    products, pid = [], 1
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        head = [str(h or "").strip().upper() for h in rows[0]]
        name_i = head.index("PRODUCT NAME") if "PRODUCT NAME" in head else head.index("MODEL")
        price_i = next(i for i, h in enumerate(head) if h.startswith("PRICE"))
        spec_cols = [i for i, h in enumerate(head) if h not in
                     {"PRODUCT ID", "PRODUCT NAME", "MODEL", "BRAND", "CATEGORY", "PRICE(PKR)", "STOCK", "RATING", "IMAGE PATH", "DESCRIPTION"}]
        for r in rows[1:]:
            if not r[name_i]:
                continue
            digits = re.sub(r"[^\d]", "", str(r[price_i]).split("to")[0])
            products.append({
                "id": pid, "name": str(r[name_i]).strip(), "brand": str(r[head.index("BRAND")] or "Generic"),
                "category": str(r[head.index("CATEGORY")]), "price": float(digits or 0),
                "stock": int(r[head.index("STOCK")] or 0), "image": None, "description": "No description available.",
                "specs": "; ".join(f"{rows[0][i].strip().title()}: {r[i]}" for i in spec_cols if r[i]),
            })
            pid += 1
    return products


@pytest.fixture(scope="module")
def catalog():
    return load_real_catalog()


@pytest.fixture
def index(catalog, monkeypatch):
    idx = vs.ProductIndex(copy.deepcopy(catalog), {}, {})
    monkeypatch.setattr(vs, "_index", idx)
    monkeypatch.setattr(vs, "get_index", lambda force=False: idx)
    monkeypatch.setattr(tools, "get_index", lambda force=False: idx)
    monkeypatch.setattr(agent, "get_index", lambda force=False: idx)
    return idx


@pytest.fixture
def no_persistence(monkeypatch):
    store = {}
    monkeypatch.setattr(ctxmod, "load", lambda sid, uid: store.get(sid) or {**copy.deepcopy(ctxmod.EMPTY_CONTEXT), "session_id": sid, "user_id": uid})
    monkeypatch.setattr(ctxmod, "save", lambda ctx: store.__setitem__(ctx["session_id"], ctx))
    monkeypatch.setattr(ctxmod, "save_profile", lambda *a, **k: None)
    monkeypatch.setattr(ctxmod, "bootstrap_session", lambda ctx: ctx)
    monkeypatch.setattr(agent, "_log_turn", lambda row: None)
    return store


# ------------------------------------------------------------ context tests
@pytest.mark.parametrize("text,expected", [
    ("phones under 50k", {"max": 50000}),
    ("laptop under 1.5 lakh", {"max": 150000}),
    ("budget of Rs. 80,000", {"max": 80000}),
    ("between 30k and 60k", {"min": 30000, "max": 60000}),
    ("above 2 lac", {"min": 200000}),
    ("around 100k", {"min": 80000, "max": 120000}),
    ("show me shoes", None),
])
def test_extract_budget(text, expected):
    assert ctxmod.extract_budget(text) == expected


@pytest.mark.parametrize("text,intent", [
    ("compare iphone 16 vs galaxy s25", "compare"),
    ("where is my order #42", "track"),
    ("add the second one to my cart", "buy"),
    ("I want a refund", "support"),
    ("best gaming laptop", "browse"),
    ("checkout please", "buy"),
])
def test_detect_intent(text, intent):
    assert ctxmod.detect_intent(text) == intent


def test_tone_and_step():
    assert ctxmod.detect_tone("yo bro any cheap phones?") == "casual"
    assert ctxmod.detect_tone("Could you please recommend a laptop for office work?") == "formal"
    assert ctxmod.step_for("buy", "place my order") == "checkout"
    assert ctxmod.step_for("track", "where is it") == "tracking"


def test_update_from_message_extracts_entities(catalog):
    ctx = copy.deepcopy(ctxmod.EMPTY_CONTEXT)
    ctxmod.update_from_message(ctx, "Need a Samsung phone with 5G under 60k, 2 pcs", catalog)
    assert ctx["entities"]["budget"] == {"max": 60000}
    assert ctx["entities"]["quantity"] == 2
    assert "Samsung" in ctx["preferences"]["brands"]
    assert "Mobile" in ctx["preferences"]["categories"]
    assert "5g" in ctx["preferences"]["features"]


def test_followup_query_is_expanded():
    ctx = copy.deepcopy(ctxmod.EMPTY_CONTEXT)
    ctx["history"]["searches"] = ["gaming laptop with rtx"]
    assert ctxmod.retrieval_query(ctx, "any cheaper?") == "gaming laptop with rtx any cheaper?"
    assert ctxmod.retrieval_query(ctx, "show me wireless keyboards for office use please") == "show me wireless keyboards for office use please"


def test_turn_window_is_capped():
    ctx = copy.deepcopy(ctxmod.EMPTY_CONTEXT)
    for i in range(30):
        ctxmod.add_turn(ctx, "user", f"m{i}")
    assert len(ctx["last_5_turns"]) == 10 and ctx["last_5_turns"][-1]["text"] == "m29"


# ---------------------------------------------------------- retrieval tests
def test_document_contains_specs_and_tags(catalog):
    laptop = next(p for p in catalog if p["category"] == "Laptop")
    doc = vs.build_product_document(laptop, "premium high-end")
    assert "Specs:" in doc and "Processor" in doc and "notebook" in doc and "premium" in doc
    assert "No description" not in doc


def test_keyword_retrieval_respects_filters(index):
    res = vs.retrieve_relevant_products("samsung phone", k=5, filters={"max_price": 100000})
    assert res, "expected results"
    assert all(p["price"] <= 100000 for p in res)
    assert res[0]["brand"].lower() == "samsung"


def test_keyword_retrieval_category_relevance(index):
    res = vs.retrieve_relevant_products("gaming laptop rtx", k=5)
    assert all(p["category"] == "Laptop" for p in res)
    assert any("rtx" in (p["specs"] or "").lower() for p in res)


def test_semantic_scores_blend_with_keywords(index):
    # fake 'embeddings': make product #k the closest vector to the query
    target = next(i for i, p in enumerate(index.products) if p["category"] == "Pet Supplies")
    rng = np.random.default_rng(0)
    m = rng.normal(size=(len(index.products), llm.EMBED_DIMS)).astype(np.float32)
    m /= np.linalg.norm(m, axis=1, keepdims=True)
    index.matrix, index.has_vec = m, np.ones(len(index.products), dtype=bool)
    hits = index.search("something for my furry friend", k=3, query_vec=m[target])
    assert hits[0]["id"] == index.products[target]["id"]
    assert hits[0]["similarity"] == pytest.approx(1.0, abs=1e-4)


def test_no_results_for_nonsense(index):
    assert vs.retrieve_relevant_products("xqzv flurbo", k=5) == []


# --------------------------------------------------------------- tool tests
def test_cart_tools_require_login(index):
    tc = tools.ToolContext(user=None, ctx=copy.deepcopy(ctxmod.EMPTY_CONTEXT))
    for name, args in [("add_to_cart", {"product_id": 1}), ("view_cart", {}), ("checkout", {"address": "x", "confirm": True}),
                       ("track_order", {}), ("remove_from_cart", {"product_id": 1})]:
        assert tools.execute(name, args, tc).data["error"] == "login_required"


def test_checkout_is_two_phase_and_cod_only(monkeypatch):
    cart = {"items": [{"product_id": 7, "name": "X", "price": 100.0, "quantity": 1, "subtotal": 100.0}],
            "subtotal": 100.0, "delivery_fee": 200.0, "total": 300.0, "item_count": 1}
    monkeypatch.setattr(tools, "_cart_payload", lambda uid: cart)
    placed = []
    monkeypatch.setattr(tools, "place_order", lambda *a, **k: placed.append(a) or {"success": True, "order_id": 9, "total_amount": 300.0, "items": cart["items"]})
    monkeypatch.setattr(tools, "get_order", lambda *a, **k: {"order": {"order_id": 9}})
    ctx = copy.deepcopy(ctxmod.EMPTY_CONTEXT)
    tc = tools.ToolContext(user={"id": 3, "role": "user"}, ctx=ctx)

    assert tools.execute("checkout", {"address": "House 1, Street 2, Karachi", "confirm": False, "payment_method": "Credit / Debit Card"}, tc).data["error"] == "unsupported_payment_in_chat"
    # confirm=true without a prior summary must NOT place an order
    r = tools.execute("checkout", {"address": "House 1, Street 2, Karachi", "confirm": True}, tc)
    assert r.data["status"] == "awaiting_confirmation" and not placed
    # address changed between summary and confirm -> re-confirm
    r = tools.execute("checkout", {"address": "Somewhere else entirely, Lahore", "confirm": True}, tc)
    assert r.data["status"] == "awaiting_confirmation" and not placed
    r = tools.execute("checkout", {"address": "Somewhere else entirely, Lahore", "confirm": True}, tc)
    assert r.data["ok"] and r.data["order_id"] == 9 and len(placed) == 1
    assert placed[0][2] == "Cash on Delivery"


def test_execute_drops_unknown_args(index):
    tc = tools.ToolContext(user=None, ctx=copy.deepcopy(ctxmod.EMPTY_CONTEXT))
    r = tools.execute("search_products", {"query": "running shoes", "user_id": 999, "limit": 3}, tc)
    assert r.data["ok"] and r.data["count"] <= 3


def test_compare_builds_table(index):
    ids = [p["id"] for p in index.products if p["category"] == "Laptop"][:2]
    tc = tools.ToolContext(user=None, ctx=copy.deepcopy(ctxmod.EMPTY_CONTEXT))
    r = tools.execute("compare_products", {"product_ids": ids}, tc)
    labels = [row["label"] for row in r.events[0]["rows"]]
    assert {"Price", "Brand", "Processor", "Ram"} <= set(labels)


def test_sanitize_payment_never_stores_full_card():
    from services.orders import sanitize_payment
    assert sanitize_payment("Credit / Debit Card", "4111 1111 1111 1234") == "Credit / Debit Card (ending 1234)"
    assert sanitize_payment("<script>", "x") == "Cash on Delivery"


# -------------------------------------------------------------- agent tests
class FakeTypes:
    """Minimal stand-in for google.genai.types."""
    class _Obj(SimpleNamespace):
        pass

    GenerateContentConfig = _Obj
    Tool = _Obj
    FunctionDeclaration = _Obj
    AutomaticFunctionCallingConfig = _Obj

    class Content(SimpleNamespace):
        pass

    class Part(SimpleNamespace):
        @staticmethod
        def from_function_response(name, response):
            return SimpleNamespace(function_response=SimpleNamespace(name=name, response=response))


def part_text(t):
    return SimpleNamespace(text=t, function_call=None, thought=False)


def part_call(name, args):
    return SimpleNamespace(text=None, function_call=SimpleNamespace(name=name, args=args))


def chunk(*parts):
    return SimpleNamespace(usage_metadata=SimpleNamespace(prompt_token_count=100, candidates_token_count=20),
                           candidates=[SimpleNamespace(content=SimpleNamespace(parts=list(parts)))])


class ScriptedClient:
    def __init__(self, script):
        self.script = list(script)
        self.calls = []
        self.models = self

    def generate_content_stream(self, model, contents, config):
        self.calls.append({"contents": list(contents), "system": config.system_instruction})
        step = self.script.pop(0)
        if isinstance(step, Exception):
            raise step
        return iter(step)


def use_fake_llm(monkeypatch, script):
    client = ScriptedClient(script)
    monkeypatch.setattr(llm, "types", FakeTypes)
    monkeypatch.setattr(llm, "get_client", lambda: client)
    monkeypatch.setattr(llm, "available", lambda: True)
    return client


def test_agent_rag_streams_and_grounds_cards(index, no_persistence, monkeypatch):
    phone = next(p for p in index.products if p["brand"] == "Samsung")
    client = use_fake_llm(monkeypatch, [[chunk(part_text("Try the **" + phone["name"] + "** {{p:" + str(phone["id"]) + "}}")),
                                         chunk(part_text(" and **Fake Phone** {{p:999999}}."))]])
    events = list(agent.run_turn("samsung phone under 6 lakh", "sess_test_0001"))
    tokens = [e for e in events if e["type"] == "token"]
    assert len(tokens) == 2  # streamed in pieces
    cards = next(e for e in events if e["type"] == "products")["products"]
    assert [c["id"] for c in cards] == [phone["id"]]  # invented id 999999 is NOT shown
    done = events[-1]
    assert done["invented_ids"] == [999999]
    # retrieved products were injected into the system prompt
    assert "RETRIEVED PRODUCTS" in client.calls[0]["system"] and phone["name"] in client.calls[0]["system"]


def test_agent_tool_loop(index, no_persistence, monkeypatch):
    ids = [p["id"] for p in index.products if p["category"] == "Laptop"][:2]
    client = use_fake_llm(monkeypatch, [
        [chunk(part_call("compare_products", {"product_ids": ids}))],
        [chunk(part_text("The first one is cheaper {{p:%d}}." % ids[0]))],
    ])
    events = list(agent.run_turn("compare these two laptops", "sess_test_0002"))
    types_ = [e["type"] for e in events]
    assert "tool" in types_ and "comparison" in types_
    assert events[-1]["tools"] == ["compare_products"]
    # second model call received the function response
    last = client.calls[1]["contents"][-1]
    assert last.parts[0].function_response.name == "compare_products"


def test_agent_retries_once_then_falls_back(index, no_persistence, monkeypatch):
    use_fake_llm(monkeypatch, [RuntimeError("503"), RuntimeError("503")])
    events = list(agent.run_turn("running shoes", "sess_test_0003"))
    text = "".join(e["text"] for e in events if e["type"] == "token")
    assert "closest matches" in text
    assert events[-1]["fallback"] is True
    assert any(e["type"] == "products" for e in events)  # still grounded cards


def test_agent_retry_succeeds(index, no_persistence, monkeypatch):
    use_fake_llm(monkeypatch, [RuntimeError("timeout"), [chunk(part_text("Hello! What are you shopping for today?"))]])
    events = list(agent.run_turn("hi", "sess_test_0004"))
    assert events[-1]["fallback"] is False


def test_context_persists_across_turns(index, no_persistence, monkeypatch):
    use_fake_llm(monkeypatch, [[chunk(part_text("Sure."))], [chunk(part_text("Here you go."))]])
    list(agent.run_turn("gaming laptop", "sess_test_0005"))
    list(agent.run_turn("any cheaper?", "sess_test_0005"))
    ctx = no_persistence["sess_test_0005"]
    assert [t["role"] for t in ctx["last_5_turns"]] == ["user", "model", "user", "model"]
    assert "gaming laptop" in ctx["history"]["searches"]


# ----------------------------------------------------------------- KV / Redis
def _fresh_kv(monkeypatch, **env):
    import importlib
    from ai import kv as kvmod
    for n in ("UPSTASH_REDIS_URL", "UPSTASH_REDIS_REST_URL", "KV_REST_API_URL",
              "UPSTASH_REDIS_TOKEN", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN"):
        monkeypatch.delenv(n, raising=False)
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    return importlib.reload(kvmod)


def test_kv_status_fallback_when_unconfigured(monkeypatch):
    m = _fresh_kv(monkeypatch)
    assert m.kv.status() == {"redis": "fallback"} and m.kv.backend == "memory"
    m.kv.set("a", "1", 10)
    assert m.kv.get("a") == "1"


def test_kv_accepts_user_env_names_and_reports_connected(monkeypatch):
    m = _fresh_kv(monkeypatch, UPSTASH_REDIS_URL="https://x.upstash.io", UPSTASH_REDIS_TOKEN="t")
    assert m.kv.backend == "upstash-redis"
    store = {}

    def fake_cmd(*args):
        if args[0] == "PING":
            return "PONG"
        if args[0] == "SET":
            store[args[1]] = args[2]
            return "OK"
        if args[0] == "GET":
            return store.get(args[1])
        return None

    monkeypatch.setattr(m.kv.remote, "_cmd", fake_cmd)
    assert m.kv.status()["redis"] == "connected"
    m.kv.set_json("ctx:1", {"a": 1}, 60)
    assert store["ctx:1"] == '{"a": 1}' and m.kv.get_json("ctx:1") == {"a": 1}


def test_kv_redis_down_falls_back_to_memory(monkeypatch):
    m = _fresh_kv(monkeypatch, UPSTASH_REDIS_REST_URL="https://x.upstash.io", UPSTASH_REDIS_REST_TOKEN="t")

    def boom(*args):
        raise OSError("connection refused")

    monkeypatch.setattr(m.kv.remote, "_cmd", boom)
    assert m.kv.status()["redis"] == "error"
    m.kv.set("k", "v", 30)          # must not raise
    assert m.kv.get("k") == "v"     # served by the in-memory TTL store


def test_kv_rejects_tcp_connection_string(monkeypatch):
    m = _fresh_kv(monkeypatch, UPSTASH_REDIS_URL="rediss://default:pw@x.upstash.io:6379", UPSTASH_REDIS_TOKEN="t")
    st = m.kv.status()
    assert st["redis"] == "misconfigured" and "https" in st["detail"] and m.kv.backend == "memory"


# ---------------------------------------------------------------- Roman Urdu
@pytest.mark.parametrize("text,expected", [
    ("50 hazar se kam wala phone", {"max": 50000}),
    ("1 lakh tak ka laptop", {"max": 100000}),
    ("60k ke andar koi acha phone", {"max": 60000}),
    ("2 lakh se zyada", {"min": 200000}),
    ("30 se 50 hazar ke beech", {"min": 30000, "max": 50000}),
    ("budget 80k hai", {"max": 80000}),
])
def test_roman_urdu_budget(text, expected):
    assert ctxmod.extract_budget(text) == expected


@pytest.mark.parametrize("text,intent", [
    ("mera order kahan hai", "track"),
    ("second wala cart mein daal do", "buy"),
    ("compare karo dono ko", "compare"),
    ("dono mein kya farq hai", "compare"),
    ("mujhe paise wapas chahiye", "support"),
    ("mujhe sasta laptop chahiye", "browse"),
])
def test_roman_urdu_intent(text, intent):
    assert ctxmod.detect_intent(text) == intent


@pytest.mark.parametrize("text,lang", [
    ("mujhe sasta laptop chahiye", "roman_urdu"),
    ("mera order kahan hai", "roman_urdu"),
    ("second wala cart mein daal do", "roman_urdu"),
    ("Show me a gaming laptop under 2 lakh", "english"),
    ("best wireless earbuds", "english"),
    ("Can you compare these two phones?", "english"),
])
def test_detect_language(text, lang):
    assert ctxmod.detect_language(text) == lang


def test_roman_urdu_query_expansion():
    assert vs.query_tokens("mujhe sasta laptop chahiye") == ["budget", "affordable", "laptop"]
    assert "shoes" in vs.query_tokens("running ke liye joote")


def test_roman_urdu_language_reaches_prompt(index, no_persistence, monkeypatch):
    client = use_fake_llm(monkeypatch, [[chunk(part_text("Ji bilkul!"))]])
    events = list(agent.run_turn("mujhe sasta laptop chahiye", "sess_test_ru01"))
    assert events[0]["language"] == "roman_urdu"
    assert "LANGUAGE: roman_urdu" in client.calls[0]["system"]
    # retrieval still found laptops for the Roman Urdu query
    assert "Laptop" in client.calls[0]["system"].split("RETRIEVED PRODUCTS")[1]
