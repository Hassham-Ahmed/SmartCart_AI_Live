import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { productsApi } from "../../api/client";

const STATUS_OPTIONS = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

const STATUS_CLASS = {
  Pending: "bg-yellow-100 text-yellow-800",
  Processing: "bg-blue-100 text-blue-800",
  Shipped: "bg-cyan-100 text-cyan-800",
  Delivered: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);

  const loadOrders = useCallback(() => {
    productsApi.adminOrders().then(({ ok, data }) => ok && setOrders(data));
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleStatusChange = async (orderId, status) => {
    setUpdatingId(orderId);
    const { data } = await productsApi.updateOrderStatus(orderId, status);
    setUpdatingId(null);
    Swal.fire({ toast: true, position: "top-end", icon: "success", title: data.message || "Status updated!", showConfirmButton: false, timer: 1500 });
    loadOrders();
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h3 className="text-xl font-bold mb-1">📦 Customer Orders</h3>
          <p className="text-gray-500 text-sm">Track and update delivery statuses for customer purchases.</p>
        </div>
        <button onClick={loadOrders} className="btn-outline-primary text-sm">
          <i className="fa-solid fa-rotate mr-1" /> Refresh Orders
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Order ID</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Payment</th>
                <th className="text-left px-4 py-3">Address</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3">#{order.id}</td>
                  <td className="px-4 py-3 font-medium">{order.full_name}</td>
                  <td className="px-4 py-3">Rs.{Number(order.total_amount).toLocaleString()}</td>
                  <td className="px-4 py-3">{order.payment_method}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{order.shipping_address}</td>
                  <td className="px-4 py-3">
                    <select
                      value={order.status}
                      disabled={updatingId === order.id}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className={`rounded-lg px-2 py-1.5 text-xs font-semibold border-0 ${STATUS_CLASS[order.status] || "bg-gray-100 text-gray-800"}`}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">{new Date(order.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
