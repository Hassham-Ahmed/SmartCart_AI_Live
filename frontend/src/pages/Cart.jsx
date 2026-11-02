import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { productsApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import Swal from "sweetalert2";
import { getImageUrl, PLACEHOLDER_IMAGE } from "../config";
import useDocumentTitle from "../hooks/useDocumentTitle";

export default function Cart() {
  useDocumentTitle("Your Cart");
  const { user } = useAuth();
  const { refreshCartCount } = useCart();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCart = useCallback(() => {
    if (!user) return;
    setLoading(true);
    productsApi.getCart(user.id).then(({ ok, data }) => {
      if (ok) setItems(data);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const mutate = async (fn) => {
    const { ok, data } = await fn();
    if (!ok) Swal.fire({ toast: true, position: "top-end", icon: "info", title: data.message || "Could not update cart.", showConfirmButton: false, timer: 1800 });
    loadCart();
    refreshCartCount();
  };

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">🛒 Your Shopping Cart</h1>

      <div className="card overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-left px-4 py-3">Image</th>
                <th className="text-left px-4 py-3">Price</th>
                <th className="text-left px-4 py-3">Quantity</th>
                <th className="text-left px-4 py-3">Total</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-500">Loading cart...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-500">Your cart is empty. <Link to="/products" className="text-primary-600 font-semibold hover:underline">Start shopping →</Link></td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">
                      <img
                        src={getImageUrl(item.image)}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                        width="64"
                        height="64"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = PLACEHOLDER_IMAGE;
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">Rs. {Number(item.price).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => mutate(() => productsApi.decreaseQuantity(item.id))}
                          className="btn-danger px-3 py-1 text-xs"
                          aria-label={`Decrease quantity of ${item.name}`}
                        >−</button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() => mutate(() => productsApi.increaseQuantity(item.id))}
                          className="btn-success px-3 py-1 text-xs"
                          aria-label={`Increase quantity of ${item.name}`}
                        >+</button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold">Rs. {Number(item.price * item.quantity).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => mutate(() => productsApi.removeCartItem(item.id))}
                        className="btn-danger px-3 py-1 text-xs"
                      >Remove</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <span className="text-gray-500">Subtotal:</span>
          <h3 className="text-2xl font-bold text-primary-600">Rs. {total.toLocaleString()}</h3>
        </div>
        {items.length > 0 ? (
          <Link to="/checkout" className="btn-success btn-3d px-6 py-3">Proceed to Checkout →</Link>
        ) : (
          <Link to="/products" className="btn-primary px-6 py-3">Browse Products</Link>
        )}
      </div>
    </div>
  );
}