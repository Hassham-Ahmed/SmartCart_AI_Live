import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { aiApi, productsApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import AIProductCard from "../components/AIProductCard";

const QUICK_PROMPTS = [
  "Best Gaming Laptop",
  "Phones under Rs.50,000",
  "Best Smart Watch",
  "Wireless Headphones",
];

const PROVINCES = ["Sindh", "Punjab", "KPK", "Balochistan", "Islamabad"];
const DELIVERY_FEE = 200;
const GREETING = { role: "ai", reply: "👋 Hello! How can I assist your shopping experience today?" };

function scopeKey(user) { return user ? user.id : "guest"; }
function sessionsKey(user) { return `smartcart_sessions_${scopeKey(user)}`; }
function messagesKey(user, sessionId) { return `smartcart_chat_${scopeKey(user)}_${sessionId}`; }
function newSessionId() { return (crypto?.randomUUID && crypto.randomUUID()) || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function toast(icon, title) { Swal.fire({ toast: true, position: "top-end", icon, title, showConfirmButton: false, timer: 1500 }); }

export default function AIChat() {
  const { user } = useAuth();
  const { refreshCartCount } = useCart();

  const [sessions, setSessions] = useState(() => loadJSON(sessionsKey(user), []));
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0]?.id || null);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);

  // In-Chat Modals State
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [buyQty, setBuyQty] = useState(1);
  const [shippingAddress, setShippingAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash on Delivery");
  const [paymentDetail, setPaymentDetail] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);

  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [myOrdersList, setMyOrdersList] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    const key = sessionsKey(user);
    let list = loadJSON(key, []);
    if (list.length === 0) {
      const id = newSessionId();
      list = [{ id, title: "New Chat", updatedAt: Date.now() }];
      saveJSON(key, list);
      saveJSON(messagesKey(user, id), [GREETING]);
    }
    setSessions(list);
    const active = list[0].id;
    setActiveSessionId(active);
    setMessages(loadJSON(messagesKey(user, active), [GREETING]));
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const persistMessages = (sessionId, msgs) => saveJSON(messagesKey(user, sessionId), msgs);

  const touchSession = (sessionId, titleHint) => {
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === sessionId ? { ...s, updatedAt: Date.now(), title: s.title === "New Chat" && titleHint ? titleHint.slice(0, 40) : s.title } : s
      );
      updated.sort((a, b) => b.updatedAt - a.updatedAt);
      saveJSON(sessionsKey(user), updated);
      return updated;
    });
  };

  const handleNewChat = () => {
    const id = newSessionId();
    const list = [{ id, title: "New Chat", updatedAt: Date.now() }, ...sessions];
    setSessions(list);
    saveJSON(sessionsKey(user), list);
    saveJSON(messagesKey(user, id), [GREETING]);
    setActiveSessionId(id);
    setMessages([GREETING]);
    setSidebarOpen(false);
  };

  const handleSwitchSession = (id) => {
    setActiveSessionId(id);
    setMessages(loadJSON(messagesKey(user, id), [GREETING]));
    setSidebarOpen(false);
  };

  const appendMessage = (msg) => {
    setMessages((m) => {
      const next = [...m, msg];
      if (activeSessionId) persistMessages(activeSessionId, next);
      return next;
    });
  };

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMessage = { role: "user", message: trimmed };
    const history = [...messages, userMessage];
    setMessages(history);
    persistMessages(activeSessionId, history);
    setInput("");
    setSending(true);
    touchSession(activeSessionId, trimmed);

    try {
      const { ok, data } = await aiApi.chat({ message: trimmed, conversation: history, user_id: user?.id });
      appendMessage({
        role: "ai",
        reply: (ok && data.reply) || "⚠️ Something went wrong.",
        products: data.products,
      });
    } catch {
      appendMessage({ role: "ai", reply: "⚠️ Connection error." });
    }
    setSending(false);
    refreshCartCount();
  };

  const handleAddToCart = async (product, qty) => {
    if (!user?.id) return toast("warning", "Please log in first.");
    const { ok, data } = await productsApi.addToCart({ user_id: user.id, product_id: product.id, quantity: qty });
    toast(ok ? "success" : "error", data.message || (ok ? "Added to cart!" : "Could not add."));
    if (ok) refreshCartCount();
  };

  const handleAddToWishlist = async (product) => {
    if (!user?.id) return toast("warning", "Please log in first.");
    const { ok, data } = await productsApi.addToWishlist({ user_id: user.id, product_id: product.id });
    toast(ok ? "success" : "error", data.message || (ok ? "Updated wishlist!" : "Could not update."));
  };

  // Direct In-Chat Buy Now Modal Trigger
  const handleBuyNow = (product, qty) => {
    if (!user?.id) return toast("warning", "Please log in first.");
    setSelectedProduct(product);
    setBuyQty(qty);
    setPaymentDetail("");
    setBuyModalOpen(true);
  };

  const handleConfirmDirectOrder = async () => {
    if (!shippingAddress.trim()) {
      return toast("warning", "Please enter complete shipping address.");
    }

    let finalPaymentString = paymentMethod;
    if (paymentMethod !== "Cash on Delivery" && paymentDetail.trim()) {
      finalPaymentString = `${paymentMethod} (${paymentDetail.trim()})`;
    }

    setPlacingOrder(true);

    try {
      const { ok, data } = await productsApi.placeOrder({
        user_id: user.id,
        product_id: selectedProduct.id,
        quantity: buyQty,
        shipping_address: shippingAddress.trim(),
        payment_method: finalPaymentString,
      });

      setPlacingOrder(false);
      setBuyModalOpen(false);

      if (ok) {
        refreshCartCount();
        appendMessage({
          role: "ai",
          reply: `🎉 **Order Placed Successfully!**\n\n• **Product:** ${selectedProduct.name} (x${buyQty})\n• **Order ID:** #${data.order_id || 'N/A'}\n• **Total:** Rs. ${(selectedProduct.price * buyQty + DELIVERY_FEE).toLocaleString()}\n• **Payment Method:** ${finalPaymentString}\n• **Address:** ${shippingAddress}`,
        });
        Swal.fire("Order Placed!", data.message || "Your order has been recorded.", "success");
      } else {
        toast("error", data.message || "Could not place order.");
      }
    } catch (err) {
      setPlacingOrder(false);
      toast("error", "Failed to process order.");
    }
  };

  // Direct In-Chat Order History Modal
  const handleOpenMyOrders = async () => {
    if (!user?.id) return toast("warning", "Please log in first.");
    setOrdersModalOpen(true);
    setLoadingOrders(true);
    const { ok, data } = await productsApi.myOrders(user.id);
    setLoadingOrders(false);
    if (ok) setMyOrdersList(data);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 flex gap-4">
      {/* Sidebar */}
      <aside className={`w-64 shrink-0 md:block ${sidebarOpen ? "block" : "hidden"}`}>
        <button onClick={handleNewChat} className="btn-primary w-full mb-3 text-sm">＋ New Chat</button>
        <p className="text-xs font-semibold text-gray-400 uppercase mb-2 px-1">History</p>
        <div className="flex flex-col gap-1 max-h-[65vh] overflow-y-auto">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSwitchSession(s.id)}
              className={`text-left text-sm px-3 py-2 rounded-lg truncate transition ${s.id === activeSessionId ? "bg-primary-50 text-primary-700 font-semibold" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 min-w-0">
        <div className="text-center mb-6 relative">
          <button onClick={() => setSidebarOpen((o) => !o)} className="md:hidden absolute left-0 top-0 text-xs text-gray-500 border rounded-lg px-2 py-1">☰ History</button>
          <h1 className="text-2xl font-bold mb-1">🤖 SmartCart AI Assistant</h1>
          <p className="text-gray-500">Instant AI help for product queries, direct checkout, and order status.</p>
          <div className="absolute right-0 top-0 flex gap-3 text-xs">
            <button onClick={handleOpenMyOrders} className="text-primary-600 font-semibold hover:underline">📦 My Orders</button>
            <button onClick={() => setMessages([GREETING])} className="text-gray-400 hover:text-danger-500">🗑 Clear Chat</button>
          </div>
        </div>

        <div className="card overflow-hidden flex flex-col">
          <div className="p-4 flex flex-col gap-4 max-h-[65vh] overflow-y-auto">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`p-3 rounded-2xl max-w-[85%] ${msg.role === "user" ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-800"}`}>
                  {msg.role === "ai" && <p className="font-bold text-primary-600 mb-1 text-sm">SmartCart Bot</p>}
                  <p className="whitespace-pre-line text-sm">{msg.role === "user" ? msg.message : msg.reply}</p>
                  {msg.products?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {msg.products.map((p) => (
                        <AIProductCard key={p.id} product={p} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} onBuyNow={handleBuyNow} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && <div className="text-gray-400 text-sm">SmartCart Bot is typing...</div>}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t p-3 flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask SmartCart AI..." className="form-input flex-1" />
            <button type="submit" disabled={sending} className="btn-primary px-5">Send</button>
          </form>
        </div>
      </div>

      {/* 💳 IN-CHAT CHECKOUT MODAL */}
      {buyModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setBuyModalOpen(false)} className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            <h3 className="text-lg font-bold text-gray-800 mb-1">⚡ Quick Checkout</h3>
            <p className="text-xs text-gray-500 mb-4">{selectedProduct.name} (Qty: {buyQty})</p>

            <div className="bg-gray-50 p-3 rounded-lg mb-4 text-xs flex justify-between">
              <span>Item Total: Rs. {(selectedProduct.price * buyQty).toLocaleString()}</span>
              <span>Delivery: Rs. {DELIVERY_FEE}</span>
              <strong className="text-primary-600">Total: Rs. {(selectedProduct.price * buyQty + DELIVERY_FEE).toLocaleString()}</strong>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Delivery Address *</label>
                <textarea
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="House #, Street, Area, City..."
                  rows={2}
                  className="form-input text-xs w-full"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Payment Method</label>
                <div className="space-y-1 text-xs">
                  {["Cash on Delivery", "Credit / Debit Card", "Easypaisa / JazzCash"].map((method) => (
                    <div key={method} className="border p-2 rounded-lg hover:bg-gray-50">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="chatPayment"
                          checked={paymentMethod === method}
                          onChange={() => {
                            setPaymentMethod(method);
                            setPaymentDetail("");
                          }}
                        />
                        {method}
                      </label>

                      {paymentMethod === "Credit / Debit Card" && method === "Credit / Debit Card" && (
                        <input
                          type="text"
                          placeholder="Card Number (Last 4 digits or Full)"
                          value={paymentDetail}
                          onChange={(e) => setPaymentDetail(e.target.value)}
                          className="form-input text-xs w-full mt-2"
                        />
                      )}

                      {paymentMethod === "Easypaisa / JazzCash" && method === "Easypaisa / JazzCash" && (
                        <input
                          type="text"
                          placeholder="Account / Mobile Number"
                          value={paymentDetail}
                          onChange={(e) => setPaymentDetail(e.target.value)}
                          className="form-input text-xs w-full mt-2"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleConfirmDirectOrder}
                disabled={placingOrder}
                className="btn-success w-full text-sm py-2 mt-2"
              >
                {placingOrder ? "Placing Order..." : "Confirm & Place Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📦 IN-CHAT ORDER HISTORY MODAL */}
      {ordersModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[80vh] flex flex-col">
            <button onClick={() => setOrdersModalOpen(false)} className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            <h3 className="text-lg font-bold text-gray-800 mb-4">📦 Your Order History</h3>

            <div className="overflow-y-auto flex-1 space-y-3">
              {loadingOrders ? (
                <p className="text-center text-gray-400 text-sm">Loading orders...</p>
              ) : myOrdersList.length === 0 ? (
                <p className="text-center text-gray-400 text-sm">No orders found.</p>
              ) : (
                myOrdersList.map((order) => (
                  <div key={order.id} className="border rounded-xl p-3 text-xs bg-gray-50 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-800">Order #{order.id}</p>
                      <p className="text-gray-500">Payment: {order.payment_method}</p>
                      <p className="text-gray-500">Address: {order.shipping_address}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">{order.status || "Processing"}</span>
                      <p className="font-bold text-primary-600 mt-1">Rs. {Number(order.total_amount || 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}