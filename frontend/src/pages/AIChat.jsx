import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import { productsApi } from "../api/client";
import { useCart } from "../context/CartContext";
import useChat from "../hooks/useChat";
import useDocumentTitle from "../hooks/useDocumentTitle";
import ChatThread from "../components/chat/ChatThread";
import { OrderTracker } from "../components/chat/ChatWidgets";

const DELIVERY_FEE = 200;
const PAYMENT_METHODS = ["Cash on Delivery", "Credit / Debit Card", "Easypaisa / JazzCash"];
const toast = (icon, title) => Swal.fire({ toast: true, position: "top-end", icon, title, showConfirmButton: false, timer: 1600 });

function Modal({ title, onClose, children, wide }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white w-full ${wide ? "sm:max-w-lg" : "sm:max-w-md"} rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto chat-panel-3d`}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold">×</button>
        <h2 className="text-lg font-bold text-gray-800 mb-3 pr-6">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function AIChat() {
  useDocumentTitle("AI Shopping Assistant", "Chat with SmartCart AI: semantic product search, comparisons, cart and order tracking.");
  const chat = useChat();
  const { user, sessions, activeSessionId, newChat, switchSession, clearChat, send, appendMessage } = chat;
  const { refreshCartCount } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Buy-now modal
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [buyQty, setBuyQty] = useState(1);
  const [shippingAddress, setShippingAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [paymentDetail, setPaymentDetail] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);

  // Orders modal
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [tracked, setTracked] = useState(null);

  // Deep link from the home page hero: /ai-chat?q=...
  const q = searchParams.get("q");
  const handledQ = useRef(null);
  useEffect(() => {
    if (q && activeSessionId && handledQ.current !== q) {
      handledQ.current = q;
      send(q);
      setSearchParams({}, { replace: true });
    }
  }, [q, activeSessionId, send, setSearchParams]);

  const handleBuyNow = (product, qty) => {
    if (!user?.id) return toast("warning", "Please log in first.");
    setSelectedProduct(product);
    setBuyQty(qty);
    setPaymentDetail("");
  };

  const handleConfirmDirectOrder = async () => {
    if (shippingAddress.trim().length < 8) return toast("warning", "Please enter your complete shipping address.");
    const digits = paymentDetail.replace(/\D/g, "");
    if (paymentMethod !== "Cash on Delivery" && digits.length < 4) return toast("warning", "Please enter your card / wallet number.");

    setPlacingOrder(true);
    const { ok, data } = await productsApi.placeOrder({
      product_id: selectedProduct.id,
      quantity: buyQty,
      shipping_address: shippingAddress.trim(),
      payment_method: paymentMethod,
      // Security: only the last 4 digits ever leave the browser (server stores "ending 1234").
      payment_details: paymentMethod === "Cash on Delivery" ? "" : digits.slice(-4),
    });
    setPlacingOrder(false);

    if (!ok) return toast("error", data.message || data.error || "Could not place order.");
    const product = selectedProduct;
    setSelectedProduct(null);
    refreshCartCount();
    appendMessage({
      role: "ai",
      reply: `🎉 **Order placed!**\n\n- **Product:** ${product.name} × ${buyQty}\n- **Order ID:** #${data.order_id}\n- **Total:** Rs. ${Number(data.total_amount).toLocaleString()}\n- **Payment:** ${paymentMethod}\n\nAsk me *"track my order"* any time.`,
    });
  };

  const openOrders = async () => {
    if (!user?.id) return toast("warning", "Please log in first.");
    setOrdersOpen(true);
    setTracked(null);
    setLoadingOrders(true);
    const { ok, data } = await productsApi.myOrders(user.id);
    setLoadingOrders(false);
    if (ok && Array.isArray(data)) setOrders(data);
  };

  const trackOrder = async (id) => {
    const { ok, data } = await productsApi.orderDetails(id);
    if (ok) setTracked(data);
    else toast("error", data.message || "Could not load order.");
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-10 flex gap-4">
      {/* Sidebar: chat history */}
      <aside className={`w-60 shrink-0 md:block ${sidebarOpen ? "block fixed inset-y-0 left-0 z-50 bg-white p-4 shadow-2xl pt-20" : "hidden"} md:static md:p-0 md:shadow-none md:bg-transparent`} aria-label="Chat history">
        <button type="button" onClick={() => { newChat(); setSidebarOpen(false); }} className="btn-primary btn-3d w-full mb-3 text-sm">＋ New Chat</button>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">History</p>
        <nav className="flex flex-col gap-1 max-h-[65vh] overflow-y-auto">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { switchSession(s.id); setSidebarOpen(false); }}
              aria-current={s.id === activeSessionId ? "true" : undefined}
              className={`text-left text-sm px-3 py-2 rounded-lg truncate transition ${s.id === activeSessionId ? "bg-primary-50 text-primary-700 font-semibold" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {s.title}
            </button>
          ))}
        </nav>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      <section className="flex-1 min-w-0">
        <header className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between gap-2 mb-2">
            <button type="button" onClick={() => setSidebarOpen(true)} className="md:hidden text-xs text-gray-600 border rounded-lg px-2.5 py-1.5" aria-expanded={sidebarOpen}>☰ History</button>
            <div className="flex gap-3 text-xs ml-auto">
              <button type="button" onClick={openOrders} className="text-primary-600 font-semibold hover:underline">📦 My Orders</button>
              <button type="button" onClick={clearChat} className="text-gray-500 hover:text-danger-500">🗑 Clear Chat</button>
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-xl sm:text-2xl font-bold mb-1">🤖 SmartCart AI Assistant</h1>
            <p className="text-gray-600 text-sm">Understands what you mean - finds, compares, adds to cart and tracks orders.</p>
            {!user && (
              <p className="text-xs text-gray-500 mt-1">
                <Link to="/login" className="text-primary-600 font-semibold hover:underline">Log in</Link> for cart, checkout, order tracking and personalised picks.
              </p>
            )}
          </div>
        </header>

        <div className="card overflow-hidden">
          <ChatThread chat={chat} onBuyNow={handleBuyNow} heightClass="h-[58vh] sm:h-[62vh]" />
        </div>
      </section>

      {selectedProduct && (
        <Modal title="⚡ Quick Checkout" onClose={() => setSelectedProduct(null)}>
          <p className="text-xs text-gray-600 mb-3">{selectedProduct.name} (Qty: {buyQty})</p>
          <div className="bg-gray-50 p-3 rounded-lg mb-4 text-xs space-y-1">
            <p className="flex justify-between"><span>Items</span><span>Rs. {(selectedProduct.price * buyQty).toLocaleString()}</span></p>
            <p className="flex justify-between"><span>Delivery</span><span>Rs. {DELIVERY_FEE}</span></p>
            <p className="flex justify-between font-bold text-primary-700"><span>Total</span><span>Rs. {(selectedProduct.price * buyQty + DELIVERY_FEE).toLocaleString()}</span></p>
          </div>
          <label htmlFor="qc-address" className="text-xs font-semibold text-gray-700 block mb-1">Delivery Address *</label>
          <textarea id="qc-address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="House #, Street, Area, City" rows={2} maxLength={255} className="form-input text-sm mb-3" />
          <fieldset className="space-y-1.5 text-sm">
            <legend className="text-xs font-semibold text-gray-700 mb-1">Payment Method</legend>
            {PAYMENT_METHODS.map((method) => (
              <div key={method} className="border p-2 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="chatPayment" checked={paymentMethod === method} onChange={() => { setPaymentMethod(method); setPaymentDetail(""); }} />
                  {method}
                </label>
                {paymentMethod === method && method !== "Cash on Delivery" && (
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete={method.startsWith("Credit") ? "cc-number" : "tel"}
                    aria-label={method.startsWith("Credit") ? "Card number" : "Wallet mobile number"}
                    placeholder={method.startsWith("Credit") ? "Card number (only last 4 digits are saved)" : "03xxxxxxxxx"}
                    value={paymentDetail}
                    maxLength={19}
                    onChange={(e) => setPaymentDetail(e.target.value.replace(/[^\d ]/g, ""))}
                    className="form-input text-sm mt-2"
                  />
                )}
              </div>
            ))}
          </fieldset>
          <button type="button" onClick={handleConfirmDirectOrder} disabled={placingOrder} className="btn-success btn-3d w-full text-sm py-2.5 mt-4">
            {placingOrder ? "Placing Order..." : "Confirm & Place Order"}
          </button>
        </Modal>
      )}

      {ordersOpen && (
        <Modal title="📦 Your Orders" onClose={() => setOrdersOpen(false)} wide>
          {tracked ? (
            <>
              <button type="button" onClick={() => setTracked(null)} className="text-xs text-primary-600 hover:underline">← All orders</button>
              <OrderTracker order={tracked} />
            </>
          ) : loadingOrders ? (
            <p className="text-center text-gray-500 text-sm py-6">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-6">No orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {orders.map((order) => (
                <li key={order.id} className="border rounded-xl p-3 text-xs bg-gray-50 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800">Order #{order.id}</p>
                    <p className="text-gray-600 truncate">{order.payment_method}</p>
                    <p className="text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">{order.status}</span>
                    <p className="font-bold text-primary-600 mt-1">Rs. {Number(order.total_amount || 0).toLocaleString()}</p>
                    <button type="button" onClick={() => trackOrder(order.id)} className="text-primary-600 hover:underline mt-1">Track →</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
