import { useCallback, useEffect, useRef, useState } from "react";
import { aiApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export const GREETING = {
  role: "ai",
  reply: "👋 Hi! I'm your SmartCart AI shopping assistant. Tell me what you need - e.g. *\"a light laptop for university under 1.5 lakh\"* - and I'll find the best matches, compare them, and even add them to your cart.",
};

export const TOOL_LABELS = {
  search_products: "Searching the catalog…",
  get_product_details: "Checking product details…",
  compare_products: "Building a comparison…",
  add_to_cart: "Adding to your cart…",
  remove_from_cart: "Updating your cart…",
  view_cart: "Opening your cart…",
  add_to_wishlist: "Saving to your wishlist…",
  checkout: "Preparing your order…",
  track_order: "Looking up your order…",
  get_user_history: "Reading your history…",
  get_recommendations: "Personalising picks…",
};

const START_CHIPS = ["Best gaming laptop", "Phones under Rs. 50,000", "Wireless earbuds", "Recommend something for me", "Track my order"];

const scopeKey = (user) => (user ? user.id : "guest");
const sessionsKey = (user) => `smartcart_sessions_${scopeKey(user)}`;
const messagesKey = (user, id) => `smartcart_chat_${scopeKey(user)}_${id}`;
const newSessionId = () =>
  (globalThis.crypto?.randomUUID && crypto.randomUUID()) || `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded / private mode: chat still works, just isn't persisted */
  }
}

/** Contextual quick-reply chips based on what the assistant just showed. */
export function suggestionsFor(messages) {
  const last = [...messages].reverse().find((m) => m.role === "ai");
  if (!last || messages.length <= 1) return START_CHIPS;
  if (last.cart?.items?.length && !last.awaitingConfirmation) return ["Checkout with Cash on Delivery", "Show my cart", "Keep shopping"];
  if (last.order) return ["Show my order history", "Recommend something for me"];
  if (last.comparison) return ["Which one should I buy?", "Add the cheaper one to my cart"];
  if (last.products?.length >= 2) return ["Compare the top two", "Show cheaper options", "Add the first one to my cart"];
  if (last.products?.length === 1) return ["Tell me more about it", "Add it to my cart", "Show similar products"];
  return START_CHIPS.slice(0, 3);
}

export default function useChat() {
  const { user } = useAuth();
  const { refreshCartCount } = useCart();

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([GREETING]);
  const [sending, setSending] = useState(false);
  const [toolStatus, setToolStatus] = useState(null);
  const abortRef = useRef(null);
  const lastPromptRef = useRef("");

  // (Re)load sessions whenever the logged-in user changes
  useEffect(() => {
    let list = loadJSON(sessionsKey(user), []);
    if (!list.length) {
      const id = newSessionId();
      list = [{ id, title: "New Chat", updatedAt: Date.now() }];
      saveJSON(sessionsKey(user), list);
    }
    setSessions(list);
    setActiveSessionId(list[0].id);
    setMessages(loadJSON(messagesKey(user, list[0].id), [GREETING]));
    return () => abortRef.current?.abort();
  }, [user]);

  const persist = useCallback((id, msgs) => saveJSON(messagesKey(user, id), msgs.slice(-60)), [user]);

  const touchSession = useCallback(
    (id, titleHint) => {
      setSessions((prev) => {
        const updated = prev
          .map((s) => (s.id === id ? { ...s, updatedAt: Date.now(), title: s.title === "New Chat" && titleHint ? titleHint.slice(0, 40) : s.title } : s))
          .sort((a, b) => b.updatedAt - a.updatedAt);
        saveJSON(sessionsKey(user), updated);
        return updated;
      });
    },
    [user]
  );

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    const id = newSessionId();
    setSessions((prev) => {
      const list = [{ id, title: "New Chat", updatedAt: Date.now() }, ...prev].slice(0, 30);
      saveJSON(sessionsKey(user), list);
      return list;
    });
    setActiveSessionId(id);
    setMessages([GREETING]);
  }, [user]);

  const switchSession = useCallback(
    (id) => {
      abortRef.current?.abort();
      setActiveSessionId(id);
      setMessages(loadJSON(messagesKey(user, id), [GREETING]));
    },
    [user]
  );

  const clearChat = useCallback(() => {
    if (!activeSessionId) return;
    abortRef.current?.abort();
    aiApi.resetContext(activeSessionId); // forget server-side context too
    setMessages([GREETING]);
    persist(activeSessionId, [GREETING]);
  }, [activeSessionId, persist]);

  const appendMessage = useCallback(
    (msg) =>
      setMessages((m) => {
        const next = [...m, msg];
        if (activeSessionId) persist(activeSessionId, next);
        return next;
      }),
    [activeSessionId, persist]
  );

  const send = useCallback(
    async (text, historyOverride) => {
      const trimmed = (text || "").trim().slice(0, 1000);
      if (!trimmed || sending || !activeSessionId) return;
      lastPromptRef.current = trimmed;
      const sessionId = activeSessionId;

      const base = [...(historyOverride || messages), { role: "user", message: trimmed }];
      let ai = { role: "ai", reply: "", streaming: true };
      setMessages([...base, ai]);
      setSending(true);
      setToolStatus(null);
      touchSession(sessionId, trimmed);

      // Coalesce token updates into one render per animation frame
      let frame = 0;
      const flush = () => {
        frame = 0;
        setMessages([...base, { ...ai }]);
      };
      const update = (patch) => {
        ai = { ...ai, ...patch };
        if (!frame) frame = requestAnimationFrame(flush);
      };

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await aiApi.streamChat({
          message: trimmed,
          sessionId,
          signal: controller.signal,
          onEvent: (ev) => {
            switch (ev.type) {
              case "token":
                setToolStatus(null);
                update({ reply: ai.reply + ev.text });
                break;
              case "tool":
                setToolStatus(TOOL_LABELS[ev.name] || "Working on it…");
                break;
              case "products":
                update({ products: ev.products });
                break;
              case "comparison":
                update({ comparison: { products: ev.products, rows: ev.rows } });
                break;
              case "cart":
                update({ cart: ev.cart, awaitingConfirmation: !!ev.awaiting_confirmation });
                break;
              case "order":
                update({ order: ev.order });
                break;
              case "cart_updated":
                refreshCartCount();
                break;
              case "error":
                update({ reply: ai.reply || `⚠️ ${ev.message}`, error: true });
                break;
              default:
            }
          },
        });
      } catch (err) {
        if (err?.name === "AbortError") return;
        const msg =
          err?.status === 429
            ? err.data?.reply || "You're sending messages quickly - please wait a moment. ⏳"
            : "⚠️ I couldn't reach the server. Check your connection and try again.";
        ai = { ...ai, reply: ai.reply || msg, error: true };
      } finally {
        cancelAnimationFrame(frame);
        if (abortRef.current === controller) abortRef.current = null;
        setSending(false);
        setToolStatus(null);
        if (!controller.signal.aborted) {
          const final = [...base, { ...ai, streaming: false }];
          setMessages(final);
          persist(sessionId, final);
        }
      }
    },
    [activeSessionId, messages, persist, refreshCartCount, sending, touchSession]
  );

  const retry = useCallback(() => {
    if (!lastPromptRef.current || sending) return;
    // drop the failed exchange (user msg + error reply), then resend
    const history = messages.length >= 2 && messages[messages.length - 1].error ? messages.slice(0, -2) : messages;
    send(lastPromptRef.current, history);
  }, [messages, send, sending]);

  return {
    user, sessions, activeSessionId, messages, sending, toolStatus,
    send, retry, newChat, switchSession, clearChat, appendMessage,
  };
}
