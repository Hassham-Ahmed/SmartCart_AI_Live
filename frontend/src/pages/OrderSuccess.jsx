import { Link } from "react-router-dom";

export default function OrderSuccess() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="card p-10">
        <div className="text-success-500 text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-success-600 mb-2">Order Placed Successfully!</h2>
        <p className="text-gray-500 mb-6">
          Thank you for shopping with SmartCart AI. Your order has been received and is currently being processed.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-gray-400 text-sm mb-1">Order Identifier</p>
          <h4 className="text-xl font-bold text-primary-600 mb-2">#SC{Math.floor(100000 + Math.random() * 900000)}</h4>
          <hr className="my-2" />
          <p className="text-gray-600 text-sm">
            🚚 Estimated Delivery: <strong>2 - 4 Business Days</strong>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link to="/products" className="btn-primary px-5">🛍️ Continue Shopping</Link>
          <Link to="/order-history" className="btn-outline-success px-5">📦 My Orders</Link>
        </div>
      </div>
    </div>
  );
}
