import { useCallback, useEffect, useMemo, useState } from "react";
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
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

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

  // Dynamically extract unique categories from products list
  const categories = useMemo(() => {
    const list = products.map((p) => p.category).filter(Boolean);
    return ["All", ...Array.from(new Set(list))];
  }, [products]);

  // Filter products by Category and Search Query
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
      const matchesSearch =
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id?.toString().includes(searchQuery) ||
        p.brand?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

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
        {/* Header & Search Bar */}
        <div className="p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h5 className="font-bold text-lg">📦 Product Inventory</h5>
            <p className="text-xs text-gray-500">Showing {filteredProducts.length} of {products.length} products</p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Live Search Input */}
            <div className="relative flex-1 md:w-72">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search product name or ID..."
                className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <i className="fa-solid fa-xmark text-xs" />
                </button>
              )}
            </div>

            <button onClick={loadProducts} className="btn-outline-primary text-xs py-2">
              <i className="fa-solid fa-rotate mr-1" /> Refresh
            </button>
          </div>
        </div>

        {/* Category Tabs / Filter Pills */}
        <div className="bg-gray-50/50 px-5 py-3 border-b overflow-x-auto flex items-center gap-2">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-white text-gray-600 hover:bg-gray-200 border border-gray-200"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Products Table */}
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
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    <i className="fa-solid fa-box-open text-3xl mb-2 block text-gray-300" />
                    No products found matching your search or filter.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3 text-gray-500">#{p.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-medium border border-blue-100">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700">Rs.{Number(p.price).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${p.stock > 0 ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"}`}>
                        {p.stock} in stock
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link to={`/admin/edit-product/${p.id}`} className="btn-warning text-xs px-3 py-1.5">✏ Edit</Link>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleDelete(p.id)} className="btn-danger text-xs px-3 py-1.5">🗑 Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}