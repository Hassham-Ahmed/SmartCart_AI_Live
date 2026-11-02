"""
AI assistant HTTP endpoints.

POST /api/ai/chat/stream   SSE token stream (new UI)
POST /api/ai/chat          same agent, single JSON response (backward compatible: {reply, products})
GET  /api/ai/context       current session context (debug / UI)
DELETE /api/ai/context     reset a session ("Clear chat")
POST /api/ai/tools/<name>  run an agent tool directly (same executors the LLM uses)
GET  /api/ai/health        configuration status (no secrets)

The previous keyword/regex router was replaced by the RAG + tool-calling
agent in backend/ai/. Every old capability (search, add to cart/wishlist,
buy now, view cart/wishlist/orders, place order) is now a tool.
"""
import json
import re
import uuid

from flask import Blueprint, Response, jsonify, request, stream_with_context

from ai import context as ctxmod
from ai import llm
from ai.agent import collect, run_turn
from ai.kv import kv, rate_limited
from ai.tools import EXECUTORS, ToolContext, execute
from security import current_user

ai = Blueprint("ai", __name__)

_SESSION_RE = re.compile(r"^[A-Za-z0-9_\-]{8,64}$")


def _session_id(data):
    sid = str(data.get("session_id") or request.headers.get("X-Session-Id") or "")
    return sid if _SESSION_RE.match(sid) else f"s_{uuid.uuid4().hex}"


def _identity():
    user = current_user()
    if user:
        return f"u{user['id']}"
    fwd = request.headers.get("X-Forwarded-For", request.remote_addr or "anon")
    return "ip" + fwd.split(",")[0].strip()


def _first_name(user):
    if not user:
        return None
    try:
        from config import get_db
        db = get_db()
        cur = db.cursor()
        cur.execute("SELECT full_name FROM users WHERE id=%s", (user["id"],))
        row = cur.fetchone()
        cur.close()
        db.close()
        if not row or not row[0]:
            return None
        return row[0].split(" ")[0] or None
    except Exception:  # noqa: BLE001
        return None


def _validate():
    data = request.get_json(silent=True) or {}
    message = str(data.get("message") or "").strip()
    if not message:
        return None, (jsonify({"error": "Message is required"}), 400)
    if len(message) > 1000:
        return None, (jsonify({"error": "Message is too long (max 1000 characters)."}), 413)
    if rate_limited(_identity()):
        return None, (jsonify({"error": "rate_limited", "reply": "You're sending messages very quickly - please wait a few seconds. ⏳"}), 429)
    return {"message": message, "session_id": _session_id(data)}, None


@ai.route("/chat/stream", methods=["POST"])
def chat_stream():
    payload, err = _validate()
    if err:
        return err
    user = current_user()
    name = _first_name(user)

    def generate():
        yield f"event: session\ndata: {json.dumps({'session_id': payload['session_id']})}\n\n"
        try:
            for ev in run_turn(payload["message"], payload["session_id"], user=user, user_name=name):
                yield f"data: {json.dumps(ev, default=str)}\n\n"
        except Exception as e:  # noqa: BLE001
            print("STREAM ERROR:", e)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Something went wrong. Please try again.'})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@ai.route("/chat", methods=["POST"])
def chat():
    payload, err = _validate()
    if err:
        return err
    user = current_user()
    try:
        result = collect(run_turn(payload["message"], payload["session_id"], user=user, user_name=_first_name(user)))
        result["session_id"] = payload["session_id"]
        return jsonify(result)
    except Exception as e:  # noqa: BLE001
        print("AI ROUTE ERROR:", e)
        # never leak internals to the client
        return jsonify({"reply": "⚠️ Sorry, something went wrong on our side. Please try again."}), 500


@ai.route("/context", methods=["GET", "DELETE"])
def session_context():
    sid = request.args.get("session_id", "")
    if not _SESSION_RE.match(sid):
        return jsonify({"error": "invalid session_id"}), 400
    user = current_user()
    if request.method == "DELETE":
        ctx = ctxmod.load(sid, user["id"] if user else None)  # ownership check happens in load()
        ctxmod.reset(ctx["session_id"])
        return jsonify({"ok": True})
    ctx = ctxmod.load(sid, user["id"] if user else None)
    public = {k: v for k, v in ctx.items() if not k.startswith("_") and k != "pending_checkout"}
    return jsonify(public)


@ai.route("/tools/<name>", methods=["POST"])
def run_tool(name):
    if name not in EXECUTORS:
        return jsonify({"error": "unknown tool"}), 404
    if rate_limited(_identity(), limit=60):
        return jsonify({"error": "rate_limited"}), 429
    data = request.get_json(silent=True) or {}
    sid = _session_id(data)
    user = current_user()
    ctx = ctxmod.load(sid, user["id"] if user else None)
    result = execute(name, data.get("args") or {}, ToolContext(user=user, ctx=ctx))
    ctxmod.save(ctx)
    status = 401 if result.data.get("error") == "login_required" else 200
    return jsonify({"result": result.data, "events": result.events, "products": result.products}), status


@ai.route("/health", methods=["GET"])
def health():
    return jsonify({
        "llm_configured": llm.available(),
        "chat_model": llm.CHAT_MODEL,
        "embed_model": llm.EMBED_MODEL,
        "embed_dims": llm.EMBED_DIMS,
        "kv_backend": kv.backend,
        **kv.status(),  # "redis": connected | fallback | misconfigured | error
    })
