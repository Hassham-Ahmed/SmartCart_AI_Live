import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import { productsApi } from "../api/client";
import useChat from "../hooks/useChat";
import useDocumentTitle from "../hooks/useDocumentTitle";
import ChatThread from "../components/chat/ChatThread";
import { OrderTracker } from "../components/chat/ChatWidgets";
import { Modal } from "../components/chat/QuickCheckout";

const toast = (icon, title) => Swal.fire({ toast: true, position: "top-end", icon, title, showConfirmButton: false, timer: 1600 });

export default function AIChat() {
  useDocumentTitle("AI Shopping Assistant", "Chat with SmartCart AI: semantic product search, comparisons, cart and order tracking.");
  const chat = useChat();
  const { user, sessions, activeSessionId, newChat, switchSession, clearChat, send } = chat;
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <ChatThread chat={chat} heightClass="h-[58vh] sm:h-[62vh]" />
        </div>
      </section>

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
