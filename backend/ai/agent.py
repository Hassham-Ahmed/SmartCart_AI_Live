"""
Agent orchestration: Retrieve -> Augment -> Generate, with tool calling.

    user msg
      -> context.update_from_message   (intent, entities, tone, step)
      -> retrieve_relevant_products     (hybrid vector+keyword, top-K)
      -> build_system_prompt            (rules + context + retrieved products)
      -> Gemini (streamed) --function_call--> tools.execute --result--> Gemini ... (max 4 hops)
      -> text tokens streamed to the client as they arrive
      -> grounding check on {{p:id}} tags -> product cards
      -> save context + profile, log the turn

run_turn() is a generator of events, consumed either by the SSE endpoint
(token-by-token) or collected into one JSON response (legacy /chat).
"""
import hashlib
import json
import re
import time

from config import get_db
from db_schema import ensure_schema

from . import context as ctxmod
from . import llm
from .kv import kv
from .system_prompt import build_system_prompt
from .tools import DECLARATIONS, ToolContext, execute
from .vector_store import get_index, product_vector, retrieve_relevant_products

MAX_TOOL_HOPS = 4
MAX_INPUT_CHARS = 1000
RETRIEVE_K = 8
RESPONSE_CACHE_TTL = 600
TAG_RE = re.compile(r"\{\{\s*p\s*:\s*(\d+)\s*\}\}")


def _types():
    return llm.types


def _tools_config(system_prompt):
    t = _types()
    return t.GenerateContentConfig(
        system_instruction=system_prompt,
        tools=[t.Tool(function_declarations=[t.FunctionDeclaration(**d) for d in DECLARATIONS])],
        automatic_function_calling=t.AutomaticFunctionCallingConfig(disable=True),
        temperature=0.4,
        max_output_tokens=llm.MAX_OUTPUT_TOKENS,
    )


def _history_contents(ctx, message):
    t = _types()
    contents = []
    for turn in ctx["last_5_turns"]:
        role = "user" if turn["role"] == "user" else "model"
        if turn["text"]:
            contents.append(t.Content(role=role, parts=[t.Part(text=turn["text"])]))
    contents.append(t.Content(role="user", parts=[t.Part(text=message)]))
    return contents


def _stream_once(contents, config):
    """One model call. Yields ('text', str) and ('call', Part); then ('usage', (in, out))."""
    client = llm.get_client()
    usage = (0, 0)
    for chunk in client.models.generate_content_stream(model=llm.CHAT_MODEL, contents=contents, config=config):
        if getattr(chunk, "usage_metadata", None):
            um = chunk.usage_metadata
            usage = (um.prompt_token_count or 0, um.candidates_token_count or 0)
        for cand in chunk.candidates or []:
            if not cand.content or not cand.content.parts:
                continue
            for part in cand.content.parts:
                if getattr(part, "function_call", None):
                    yield "call", part
                elif getattr(part, "text", None) and not getattr(part, "thought", False):
                    yield "text", part
    yield "usage", usage


def _grounded_cards(text, candidates, tool_products, intent):
    """Products referenced by {{p:id}} tags that really exist in this turn's data."""
    by_id = {p["id"]: p for p in candidates}
    ids = [int(x) for x in TAG_RE.findall(text)]
    cited, invented = [], []
    for i in dict.fromkeys(ids):
        (cited if i in by_id else invented).append(i)
    cards = [by_id[i] for i in cited]
    if not cards and tool_products and intent in ("browse", "compare"):
        cards = tool_products[:4]
    return cards, invented


def _fallback_answer(retrieved, reason):
    """No LLM available: still answer, grounded purely in retrieval."""
    if retrieved:
        lines = [f"- **{p['name']}** {{{{p:{p['id']}}}}} - Rs. {p['price']:,.0f}" for p in retrieved[:5]]
        return "Here are the closest matches from our catalog:\n\n" + "\n".join(lines) + \
               ("\n\n_(Our AI assistant is busy right now, so these are search results.)_" if reason else "")
    return "I'm having trouble reaching our AI assistant right now. Please try again in a moment, or browse the **Products** page. 🙏"


def _response_cache_key(message):
    return "rc:" + hashlib.sha1(f"{llm.CHAT_MODEL}:{message.strip().lower()}".encode()).hexdigest()


def _log_turn(row):
    try:
        ensure_schema()
        db = get_db()
        cur = db.cursor()
        cur.execute(
            """INSERT INTO ai_chat_logs (session_id, user_id, query, intent, retrieved_ids, tools_called, response,
               latency_ms, input_tokens, output_tokens, error) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (row["session_id"], row["user_id"], row["query"][:2000], row["intent"], json.dumps(row["retrieved_ids"]),
             json.dumps(row["tools"]), row["response"][:20000], row["latency_ms"], row["in_tok"], row["out_tok"], row.get("error")),
        )
        db.commit()
        cur.close()
        db.close()
    except Exception as e:  # noqa: BLE001
        print("chat log failed:", e)


def run_turn(message, session_id, user=None, user_name=None, log=True):
    """Generator of event dicts: meta | token | tool | products | comparison | cart | order | cart_updated | done | error"""
    t0 = time.time()
    message = (message or "").strip()[:MAX_INPUT_CHARS]
    user_id = user["id"] if user else None

    ctx = ctxmod.load(session_id, user_id)
    is_first_turn = not ctx["last_5_turns"]
    try:
        ctxmod.bootstrap_session(ctx)  # cross-session memory for returning users
    except Exception as e:  # noqa: BLE001 - personalisation is best-effort
        print("profile bootstrap failed:", e)
        ctx["profile_summary"] = ""

    try:
        catalog = get_index().products
    except Exception as e:  # noqa: BLE001
        print("catalog load failed:", e)
        catalog = []
    ctxmod.update_from_message(ctx, message, catalog)
    intent = ctx["current_intent"]
    yield {"type": "meta", "intent": intent, "step": ctx["current_step"], "tone": ctx["tone"], "language": ctx.get("language", "english")}

    # ---- 1. Retrieve
    retrieved = []
    if intent in ("browse", "compare", "buy") and catalog:
        budget = ctx["entities"]["budget"] or {}
        filters = {"min_price": budget.get("min"), "max_price": budget.get("max")}
        try:
            retrieved = retrieve_relevant_products(ctxmod.retrieval_query(ctx, message), k=RETRIEVE_K, filters=filters)
        except Exception as e:  # noqa: BLE001
            print("retrieval failed:", e)

    # ---- cache: identical first-turn browse questions from anonymous users
    cache_key = _response_cache_key(message) if (is_first_turn and not user and intent == "browse") else None
    if cache_key:
        cached = kv.get_json(cache_key)
        if cached:
            yield {"type": "token", "text": cached["text"]}
            if cached.get("products"):
                yield {"type": "products", "products": cached["products"]}
            ctxmod.add_turn(ctx, "user", message)
            ctxmod.add_turn(ctx, "model", cached["text"])
            ctxmod.save(ctx)
            yield {"type": "done", "cached": True, "latency_ms": int((time.time() - t0) * 1000)}
            return

    candidates = {p["id"]: p for p in retrieved}
    tool_products, tools_called = [], []
    full_text, in_tok, out_tok, error = "", 0, 0, None
    tc = ToolContext(user=user, ctx=ctx)

    # ---- 2. Augment + 3. Generate (with tools)
    if llm.available():
        t = _types()
        system_prompt = build_system_prompt(ctx, retrieved, logged_in=bool(user), user_name=user_name)
        config = _tools_config(system_prompt)
        contents = _history_contents(ctx, message)
        for hop in range(MAX_TOOL_HOPS + 1):
            calls, model_parts = [], []
            attempt = 0
            while True:
                emitted = False
                try:
                    for kind, val in _stream_once(contents, config):
                        if kind == "text":
                            emitted = True
                            full_text += val.text
                            model_parts.append(val)  # keep original part (carries thought signature)
                            yield {"type": "token", "text": val.text}
                        elif kind == "call":
                            calls.append(val)
                            model_parts.append(val)
                        elif kind == "usage":
                            in_tok += val[0]
                            out_tok += val[1]
                    break
                except Exception as e:  # noqa: BLE001
                    attempt += 1
                    print(f"LLM call failed (attempt {attempt}):", e)
                    if emitted or attempt >= 2:  # retry once, only if nothing reached the user yet
                        error = str(e)[:500]
                        break
                    time.sleep(0.8)
            if error or not calls:
                break
            if hop == MAX_TOOL_HOPS:
                break

            # execute tools, feed results back
            contents.append(t.Content(role="model", parts=model_parts))
            response_parts = []
            for part in calls:
                fc = part.function_call
                args = dict(fc.args or {})
                yield {"type": "tool", "name": fc.name, "status": "running"}
                result = execute(fc.name, args, tc)
                tools_called.append({"name": fc.name, "args": args, "ok": result.data.get("ok")})
                for p in result.products:
                    candidates[p["id"]] = p
                tool_products.extend(result.products)
                for ev in result.events:
                    yield ev
                response_parts.append(t.Part.from_function_response(name=fc.name, response={"result": result.data}))
            contents.append(t.Content(role="user", parts=response_parts))
    else:
        error = "llm_unavailable"

    if not full_text.strip():
        full_text = _fallback_answer(retrieved, error)
        yield {"type": "token", "text": full_text}

    # ---- grounding check -> product cards
    cards, invented = _grounded_cards(full_text, list(candidates.values()), tool_products, intent)
    if cards:
        yield {"type": "products", "products": cards}
        ctx["last_products"] = [{"id": p["id"], "name": p["name"]} for p in cards]
    if invented:
        print("GROUNDING WARNING: model cited unknown product ids", invented)

    # ---- persist memory
    visible = TAG_RE.sub("", full_text).strip()
    ctxmod.add_turn(ctx, "user", message)
    ctxmod.add_turn(ctx, "model", full_text)
    ctxmod.save(ctx)
    if user:
        taste_ids = ctx["history"]["purchased"][:10] + ctx["history"]["viewed"][:10] + [p["id"] for p in cards[:3]]
        try:
            ctxmod.save_profile(user["id"], ctx, product_vector(taste_ids) if taste_ids else None)
        except Exception as e:  # noqa: BLE001
            print("profile update failed:", e)

    if cache_key and not error and not tools_called:
        kv.set_json(cache_key, {"text": full_text, "products": cards}, RESPONSE_CACHE_TTL)

    latency = int((time.time() - t0) * 1000)
    if log:
        _log_turn({
            "session_id": session_id, "user_id": user_id, "query": message, "intent": intent,
            "retrieved_ids": [p["id"] for p in retrieved], "tools": tools_called, "response": visible,
            "latency_ms": latency, "in_tok": in_tok, "out_tok": out_tok,
            "error": (error or "") + (f" invented_ids={invented}" if invented else "") or None,
        })
    yield {"type": "done", "latency_ms": latency, "tools": [t_["name"] for t_ in tools_called], "invented_ids": invented,
           "fallback": bool(error), "usage": {"input_tokens": in_tok, "output_tokens": out_tok}}


def collect(events):
    """Turn the event stream into the legacy JSON shape {reply, products, ...}."""
    reply, products, extras = "", [], []
    for ev in events:
        if ev["type"] == "token":
            reply += ev["text"]
        elif ev["type"] == "products":
            products = ev["products"]
        elif ev["type"] in ("comparison", "cart", "order", "cart_updated"):
            extras.append(ev)
    return {"reply": reply, "products": products, "events": extras}
