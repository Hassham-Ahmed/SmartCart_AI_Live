import { useEffect, useRef, useState } from "react";
import { aiApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const QUICK_PROMPTS = [
  "Best Gaming Laptop",
  "Phones under Rs.50,000",
  "Best Smart Watch",
  "Wireless Headphones",
];

const GREETING = { role: "ai", reply: "👋 Hello! How can I assist your shopping experience today?" };

function storageKeyFor(user) {
  return `smartcart_chat_${user ? user.id : "guest"}`;
}

function loadHistory(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // ignore corrupted history
  }
  return [GREETING];
}

export default function AIChat() {
  const { user } = useAuth();
  const { refreshCartCount } = useCart();
  const storageKey = storageKeyFor(user);
  const [messages, setMessages] = useState(() => loadHistory(storageKey));
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    setMessages(loadHistory(storageKey));
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleClearChat = () => {
    setMessages([GREETING]);
  };

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMessage = { role: "user", message: trimmed };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setSending(true);

    const { data } = await aiApi.chat({
      message: trimmed,
      conversation: history,
      user_id: user?.id,
    });

    setMessages((m) => [...m, { role: "ai", reply: data.reply || "Sorry, something went wrong.", products: data.products }]);
    setSending(false);
    refreshCartCount();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-6 relative">
        <h1 className="text-2xl font-bold mb-1">🤖 SmartCart AI Assistant</h1>
        <p className="text-gray-500">Instant AI help for product queries, budget filtering, and recommendations.</p>
        {messages.length > 1 && (
          <button
            onClick={handleClearChat}
            className="absolute right-0 top-0 text-xs text-gray-400 hover:text-danger-500"
          >
            🗑 Clear Chat
          </button>
        )}
      </div>

      <div className="card overflow-hidden flex flex-col">
        <div className="p-4 flex flex-col gap-3 max-h-[55vh] overflow-y-auto">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`p-3 rounded-2xl max-w-[85%] ${msg.role === "user" ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-800"}`}>
                {msg.role === "ai" && <p className="font-bold text-primary-600 mb-1 text-sm">SmartCart Bot</p>}
                <p className="whitespace-pre-line text-sm">{msg.role === "user" ? msg.message : msg.reply}</p>

                {msg.products?.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {msg.products.map((p) => (
                      <div key={p.id} className="text-xs bg-white rounded-lg p-2 border">
                        <strong>{p.name}</strong> — PKR {Number(p.price).toLocaleString()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="p-3 rounded-2xl bg-gray-100 text-gray-400 text-sm">SmartCart Bot is typing...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask SmartCart AI (e.g. Best budget phones...)"
            className="form-input flex-1"
          />
          <button type="submit" disabled={sending} className="btn-primary px-5">Send</button>
        </form>
      </div>

      <div className="mt-6 text-center">
        <span className="text-gray-500 font-medium mr-2">💡 Quick Suggestions:</span>
        <div className="inline-flex flex-wrap gap-2 mt-2 justify-center">
          {QUICK_PROMPTS.map((p) => (
            <button key={p} onClick={() => send(p)} className="btn-outline-primary text-xs">
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
