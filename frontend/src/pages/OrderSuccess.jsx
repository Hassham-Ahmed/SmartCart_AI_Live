import { Link, useLocation } from "react-router-dom";
import useDocumentTitle from "../hooks/useDocumentTitle";

export default function OrderSuccess() {
  useDocumentTitle("Order placed");
  const { state } = useLocation();
  const orderId = state?.orderId;
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="card p-10">
        <div className="text-success-500 text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-success-600 mb-2">Order Placed Successfully!</h2>
        <p className="text-gray-500 mb-6">
          Thank you for shopping with SmartCart AI. Your order has been received and is currently being processed.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-gray-500 text-sm mb-1">Order ID</p>
          {/* BUGFIX: this used to show a random number unrelated to the real order */}
          <p className="text-xl font-bold text-primary-600 mb-2">{orderId ? `#${orderId}` : "See My Orders"}</p>
          {state?.total ? <p className="text-sm text-gray-600 mb-2">Total: Rs. {Number(state.total).toLocaleString()}</p> : null}
          <hr className="my-2" />
          <p className="text-gray-600 text-sm">
            🚚 Estimated Delivery: <strong>2 - 4 Business Days</strong>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link to="/products" className="btn-primary px-5">🛍️ Continue Shopping</Link>
          <Link to="/order-history" className="btn-outline-success px-5">📦 My Orders</Link>
          <Link to={`/ai-chat?q=${encodeURIComponent(orderId ? `Track order #${orderId}` : "Track my latest order")}`} className="btn-outline-primary px-5">🤖 Track with AI</Link>
        </div>
      </div>
    </div>
  );
}
