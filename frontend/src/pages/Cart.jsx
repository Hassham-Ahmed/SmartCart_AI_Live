import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { productsApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { getImageUrl } from "../config";

export default function Cart() {
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
    await fn();
    loadCart();
    refreshCartCount();
  };

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h2 className="text-2xl font-bold mb-6">🛒 Your Shopping Cart</h2>

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
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading cart...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Your cart is empty.</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">
                      <img
                        src={getImageUrl(item.image)}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                        onError={(e) => {
                          e.target.src = "https://placehold.co/300x300/png?text=No+Image";
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">Rs. {Number(item.price).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => mutate(() => productsApi.decreaseQuantity(item.id))}
                          className="btn-danger px-3 py-1 text-xs"
                        >-</button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() => mutate(() => productsApi.increaseQuantity(item.id))}
                          className="btn-success px-3 py-1 text-xs"
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
        <Link to="/checkout" className="btn-success px-6 py-3">Proceed to Checkout →</Link>
      </div>
    </div>
  );
}