import { useEffect, useState } from "react";
import { productsApi } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function OrderHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    productsApi.myOrders(user.id).then(({ ok, data }) => {
      if (ok) setOrders(data);
      setLoading(false);
    });
  }, [user]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-primary-900 text-white py-8 mb-8">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-1">📦 Order History</h2>
          <p className="text-white/60 text-sm">Track and view all your recent purchases.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-white">
                <tr>
                  <th className="text-left px-4 py-3">Order ID</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">Loading orders...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">You have no past orders.</td></tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-medium">#{order.id}</td>
                      <td className="px-4 py-3">{new Date(order.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">Rs. {Number(order.total_amount).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="badge bg-warning-500 text-gray-900">{order.status}</span>
                      </td>
                      <td className="px-4 py-3">{order.payment_method}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
