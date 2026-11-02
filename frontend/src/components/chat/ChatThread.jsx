import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { productsApi } from "../../api/client";
import { useCart } from "../../context/CartContext";
import { suggestionsFor } from "../../hooks/useChat";
import Markdown from "./Markdown";
import QuickCheckout from "./QuickCheckout";
import {
  CartSummary, ComparisonTable, OrderTracker, ProductCarousel, QuickReplies, TypingDots, VoiceButton,
} from "./ChatWidgets";

const toast = (icon, title) =>
  Swal.fire({ toast: true, position: "top-end", icon, title, showConfirmButton: false, timer: 1600 });

export default function ChatThread({ chat, compact = false, heightClass = "h-[60vh]" }) {
  const { user, messages, sending, toolStatus, send, retry, appendMessage } = chat;
  const [buyTarget, setBuyTarget] = useState(null); // { product, qty } for the Quick Checkout modal
  const { refreshCartCount } = useCart();
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // keep the newest content in view without janky smooth-scroll on every token
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, toolStatus]);

  const handleAddToCart = async (product, qty) => {
    if (!user?.id) return toast("warning", "Please log in first.");
    const { ok, data } = await productsApi.addToCart({ product_id: product.id, quantity: qty });
    toast(ok ? "success" : "error", data.message || (ok ? "Added to cart!" : "Could not add."));
    if (ok) refreshCartCount();
  };

  const handleAddToWishlist = async (product) => {
    if (!user?.id) return toast("warning", "Please log in first.");
    const { ok, data } = await productsApi.addToWishlist({ product_id: product.id });
    toast(ok ? "success" : "error", data.message || (ok ? "Saved to wishlist!" : "Could not update."));
  };

  // Buy Now: direct single-product order via the Quick Checkout modal (same flow as before the upgrade)
  const handleBuyNow = (product, qty) => {
    if (!user?.id) return toast("warning", "Please log in first.");
    setBuyTarget({ product, qty });
  };

  const handleOrderPlaced = ({ product, qty, paymentMethod, orderId, total }) => {
    setBuyTarget(null);
    refreshCartCount();
    appendMessage({
      role: "ai",
      reply: `🎉 **Order placed!**\n\n- **Product:** ${product.name} × ${qty}\n- **Order ID:** #${orderId}\n- **Total:** Rs. ${Number(total).toLocaleString()}\n- **Payment:** ${paymentMethod}\n\nAsk me *"track my order"* any time.`,
    });
  };

  const submit = (text) => {
    if (!text.trim() || sending) return;
    send(text);
    setInput("");
    inputRef.current?.focus();
  };

  const last = messages[messages.length - 1];

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div
        ref={scrollRef}
        className={`p-3 sm:p-4 flex flex-col gap-4 overflow-y-auto overscroll-contain ${heightClass}`}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-busy={sending}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`rounded-2xl min-w-0 ${msg.role === "user"
                ? "bg-primary-500 text-white px-3.5 py-2.5 max-w-[85%]"
                : "bg-gray-50 border border-gray-100 text-gray-800 px-3.5 py-3 max-w-[96%] sm:max-w-[90%]"}`}
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-line text-sm break-words">{msg.message}</p>
              ) : (
                <>
                  <p className="font-bold text-primary-600 mb-1 text-xs" aria-hidden="true">SmartCart AI</p>
                  {msg.reply ? <Markdown text={msg.reply} /> : msg.streaming && <TypingDots />}
                  {msg.comparison && <ComparisonTable {...msg.comparison} />}
                  {msg.products?.length > 0 && (
                    <ProductCarousel
                      products={msg.products}
                      compact={compact}
                      onAddToCart={handleAddToCart}
                      onAddToWishlist={handleAddToWishlist}
                      onBuyNow={handleBuyNow}
                    />
                  )}
                  {msg.cart && (
                    <CartSummary cart={msg.cart} awaitingConfirmation={msg.awaitingConfirmation && i === messages.length - 1} onQuickReply={submit} />
                  )}
                  {msg.order && <OrderTracker order={msg.order} />}
                  {msg.error && i === messages.length - 1 && (
                    <button type="button" onClick={retry} className="mt-2 text-xs font-semibold text-primary-600 hover:underline">↻ Try again</button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {sending && toolStatus && (
          <p className="text-xs text-gray-500 flex items-center gap-2" role="status">
            <TypingDots label={toolStatus} /> {toolStatus}
          </p>
        )}
      </div>

      <div className="border-t border-gray-100 p-2.5 sm:p-3 space-y-2 bg-white">
        {!sending && !last?.streaming && <QuickReplies items={suggestionsFor(messages)} onPick={submit} disabled={sending} />}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex gap-2 items-center"
        >
          <label htmlFor={compact ? "chat-input-widget" : "chat-input"} className="sr-only">Ask SmartCart AI</label>
          <input
            id={compact ? "chat-input-widget" : "chat-input"}
            ref={inputRef}
            type="text"
            value={input}
            maxLength={1000}
            autoComplete="off"
            enterKeyHint="send"
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about products, your cart or orders…"
            className="form-input flex-1 rounded-full"
          />
          <VoiceButton disabled={sending} onResult={(t) => setInput((v) => (v ? `${v} ${t}` : t))} />
          <button type="submit" disabled={sending || !input.trim()} className="btn-primary btn-3d px-5 h-10" aria-label="Send message">
            {sending ? "…" : "Send"}
          </button>
        </form>
      </div>
      {buyTarget && (
        <QuickCheckout product={buyTarget.product} qty={buyTarget.qty} onClose={() => setBuyTarget(null)} onPlaced={handleOrderPlaced} />
      )}
    </div>
  );
}
