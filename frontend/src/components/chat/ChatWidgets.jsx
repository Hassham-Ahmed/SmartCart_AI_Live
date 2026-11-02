import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AIProductCard from "../AIProductCard";
import { getImageUrl, PLACEHOLDER_IMAGE } from "../../config";

export function TypingDots({ label = "SmartCart AI is typing" }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500" role="status" aria-label={label}>
      <span className="typing-dots" aria-hidden="true"><span /><span /><span /></span>
    </div>
  );
}

/** Horizontal, swipeable carousel with arrow buttons on desktop. */
export function ProductCarousel({ products, onAddToCart, onAddToWishlist, onBuyNow, compact }) {
  const rowRef = useRef(null);
  const scroll = (dir) => rowRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });
  if (!products?.length) return null;
  return (
    <div className="relative mt-3 -mx-1">
      <div ref={rowRef} className="snap-row flex gap-3 overflow-x-auto pb-2 px-1" role="list" aria-label="Recommended products">
        {products.map((p) => (
          <div role="listitem" key={p.id}>
            <AIProductCard product={p} compact={compact} onAddToCart={onAddToCart} onAddToWishlist={onAddToWishlist} onBuyNow={onBuyNow} />
          </div>
        ))}
      </div>
      {products.length > 2 && (
        <div className="hidden sm:flex justify-end gap-1 mt-1">
          <button type="button" onClick={() => scroll(-1)} className="w-7 h-7 rounded-full border bg-white text-gray-600 hover:bg-gray-50" aria-label="Scroll products left">‹</button>
          <button type="button" onClick={() => scroll(1)} className="w-7 h-7 rounded-full border bg-white text-gray-600 hover:bg-gray-50" aria-label="Scroll products right">›</button>
        </div>
      )}
    </div>
  );
}

export function ComparisonTable({ products, rows }) {
  if (!products?.length) return null;
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-xs min-w-[420px]">
        <caption className="sr-only">Product comparison</caption>
        <thead>
          <tr className="bg-primary-50">
            <th scope="col" className="text-left p-2 w-28 text-gray-500 font-semibold">Spec</th>
            {products.map((p) => (
              <th key={p.id} scope="col" className="text-left p-2 align-top">
                <img src={getImageUrl(p.image)} alt="" width="48" height="48" loading="lazy" className="w-12 h-12 object-cover rounded-md mb-1" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }} />
                <Link to={`/products/${p.id}`} className="font-semibold text-gray-800 hover:text-primary-600 line-clamp-2">{p.name}</Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-gray-100">
              <th scope="row" className="text-left p-2 text-gray-500 font-medium">{row.label}</th>
              {row.values.map((v, i) => <td key={i} className="p-2 text-gray-800">{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrderTracker({ order }) {
  if (!order) return null;
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 text-xs">
      <div className="flex justify-between items-start gap-2 mb-3">
        <div>
          <p className="font-bold text-gray-800">Order #{order.order_id}</p>
          <p className="text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
        </div>
        <p className="font-bold text-primary-600">Rs. {Number(order.total_amount).toLocaleString()}</p>
      </div>
      {order.cancelled ? (
        <p className="text-danger-600 font-semibold">This order was cancelled.</p>
      ) : (
        <ol className="flex items-center" aria-label="Order progress">
          {order.steps.map((s, i) => (
            <li key={s.label} className="flex-1 flex flex-col items-center relative" aria-current={s.current ? "step" : undefined}>
              {i > 0 && <span className={`absolute top-3 right-1/2 w-full h-0.5 -z-0 ${s.done ? "bg-primary-500" : "bg-gray-200"}`} aria-hidden="true" />}
              <span className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${s.done ? "bg-primary-500 text-white" : "bg-gray-200 text-gray-500"} ${s.current ? "ring-4 ring-primary-100" : ""}`}>
                {s.done ? "✓" : i + 1}
              </span>
              <span className={`mt-1 ${s.current ? "font-bold text-primary-700" : "text-gray-500"}`}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}
      {order.items?.length > 0 && (
        <ul className="mt-3 border-t pt-2 space-y-0.5 text-gray-600">
          {order.items.map((it) => <li key={`${it.product_id}-${it.name}`}>• {it.name} × {it.quantity}</li>)}
        </ul>
      )}
    </div>
  );
}

export function CartSummary({ cart, awaitingConfirmation, onQuickReply }) {
  if (!cart) return null;
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 text-xs">
      {cart.items.length === 0 ? (
        <p className="text-gray-500">Your cart is empty.</p>
      ) : (
        <>
          <ul className="divide-y">
            {cart.items.map((i) => (
              <li key={i.product_id} className="flex justify-between gap-2 py-1.5">
                <span className="truncate">{i.name} × {i.quantity}</span>
                <span className="shrink-0 font-semibold">Rs. {Number(i.subtotal).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <div className="border-t mt-1 pt-2 space-y-0.5">
            <p className="flex justify-between text-gray-500"><span>Delivery</span><span>Rs. {Number(cart.delivery_fee).toLocaleString()}</span></p>
            <p className="flex justify-between font-bold text-primary-700"><span>Total</span><span>Rs. {Number(cart.total).toLocaleString()}</span></p>
          </div>
          {awaitingConfirmation && onQuickReply && (
            <div className="flex gap-2 mt-3">
              <button type="button" className="btn-success btn-3d text-xs py-1.5 flex-1" onClick={() => onQuickReply("Yes, confirm my order")}>✅ Confirm order</button>
              <button type="button" className="btn-outline-danger text-xs py-1.5" onClick={() => onQuickReply("No, don't place the order yet")}>Cancel</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function QuickReplies({ items, onPick, disabled }) {
  if (!items?.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 snap-row" role="group" aria-label="Suggested questions">
      {items.map((q) => (
        <button
          key={q}
          type="button"
          disabled={disabled}
          onClick={() => onPick(q)}
          className="shrink-0 rounded-full border border-primary-200 bg-white px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  );
}

/** Web Speech API voice input (Chrome/Edge/Safari). Hidden where unsupported. */
export function VoiceButton({ onResult, disabled }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  useEffect(() => () => recRef.current?.abort?.(), []);
  if (!SR) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => onResult(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop voice input" : "Speak your question"}
      title={listening ? "Listening… click to stop" : "Voice input"}
      className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center transition ${listening ? "bg-danger-500 text-white border-danger-500 animate-pulse" : "bg-white text-gray-600 hover:bg-gray-50"}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" /></svg>
    </button>
  );
}
