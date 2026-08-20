import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { productsApi } from "../../api/client";

const STAT_CARDS = [
  { key: "users", label: "Total Users", icon: "fa-users", color: "primary" },
  { key: "products", label: "Total Products", icon: "fa-boxes-stacked", color: "success" },
  { key: "orders", label: "Total Orders", icon: "fa-cart-shopping", color: "warning" },
  { key: "revenue", label: "Total Revenue", icon: "fa-wallet", color: "info", isCurrency: true },
];

const colorClasses = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-green-50 text-success-600",
  warning: "bg-yellow-50 text-yellow-600",
  info: "bg-cyan-50 text-cyan-600",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, products: 0, orders: 0, revenue: 0 });
  const [products, setProducts] = useState([]);

  const loadDashboard = useCallback(() => {
    productsApi.adminDashboard().then(({ ok, data }) => ok && setStats(data));
  }, []);

  const loadProducts = useCallback(() => {
    productsApi.getProducts().then(({ ok, data }) => ok && setProducts(data));
  }, []);

  useEffect(() => {
    loadDashboard();
    loadProducts();
  }, [loadDashboard, loadProducts]);

  const handleDelete = (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this product deletion!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#0d6efd",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        const { data } = await productsApi.deleteProduct(id);
        Swal.fire({ toast: true, position: "top-end", icon: "success", title: data.message || "Product deleted.", showConfirmButton: false, timer: 1500 });
        loadProducts();
        loadDashboard();
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h3 className="text-xl font-bold mb-1">Dashboard Overview</h3>
          <p className="text-gray-500 text-sm">Welcome back! Here is what's happening with your store today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/add-product" className="btn-primary"><i className="fa-solid fa-plus mr-2" />Add Product</Link>
          <Link to="/admin/orders" className="btn-outline-primary"><i className="fa-solid fa-box mr-2" />Orders</Link>
          <Link to="/admin/users" className="btn-outline-primary"><i className="fa-solid fa-users mr-2" />Users</Link>
          <Link to="/admin/messages" className="btn-outline-primary"><i className="fa-solid fa-envelope mr-2" />Messages</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map((card) => (
          <div key={card.key} className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase mb-1">{card.label}</p>
              <h2 className="text-2xl font-bold">
                {card.isCurrency ? `Rs.${Number(stats[card.key] || 0).toLocaleString()}` : (stats[card.key] || 0)}
              </h2>
            </div>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl ${colorClasses[card.color]}`}>
              <i className={`fa-solid ${card.icon}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b">
          <h5 className="font-bold">📦 Product Inventory</h5>
          <button onClick={loadProducts} className="btn-outline-primary text-xs">
            <i className="fa-solid fa-rotate mr-1" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Product Name</th>
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3">Price</th>
                <th className="text-left px-4 py-3">Stock</th>
                <th className="text-center px-4 py-3">Edit</th>
                <th className="text-center px-4 py-3">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">{p.id}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{p.category}</td>
                  <td className="px-4 py-3">Rs.{Number(p.price).toLocaleString()}</td>
                  <td className="px-4 py-3">{p.stock}</td>
                  <td className="px-4 py-3 text-center">
                    <Link to={`/admin/edit-product/${p.id}`} className="btn-warning text-xs px-3 py-1.5">✏ Edit</Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDelete(p.id)} className="btn-danger text-xs px-3 py-1.5">🗑 Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
