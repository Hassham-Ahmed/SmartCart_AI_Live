import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { productsApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { getImageUrl } from "../config";

export default function Wishlist() {
  const { user } = useAuth();
  const { refreshCartCount } = useCart();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadWishlist = useCallback(() => {
    if (!user) return;
    setLoading(true);
    productsApi.getWishlist(user.id).then(({ ok, data }) => {
      if (ok) setItems(data);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const handleMoveToCart = async (productId) => {
    const { ok, data } = await productsApi.addToCart({ user_id: user.id, product_id: productId, quantity: 1 });
    Swal.fire({ toast: true, position: "top-end", icon: ok ? "success" : "error", title: data.message || (ok ? "Added to Cart!" : "Could not add to cart."), showConfirmButton: false, timer: 1500 });
    if (ok) refreshCartCount();
  };

  const handleRemove = async (id) => {
    const { data } = await productsApi.removeWishlist(id);
    Swal.fire({ toast: true, position: "top-end", icon: "info", title: data.message || "Removed from wishlist", showConfirmButton: false, timer: 1500 });
    loadWishlist();
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-primary-900 text-white py-8 mb-8">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-1">❤️ My Wishlist</h2>
          <p className="text-white/60 text-sm">Saved items you want to buy later.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-16">
        {loading ? (
          <p className="text-center text-gray-400 py-16">Loading wishlist...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-400 py-16">Your wishlist is empty.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {items.map((product) => (
              <div key={product.id} className="card overflow-hidden">
                <img
                  src={getImageUrl(product.image)}
                  alt={product.name}
                  className="w-full h-52 object-cover"
                  onError={(e) => {
                    e.target.src = "https://placehold.co/600x600/e5e7eb/9ca3af?text=No+Image";
                  }}
                />
                <div className="p-4">
                  <h5 className="font-semibold mb-1 line-clamp-2">{product.name}</h5>
                  <p className="text-primary-600 font-bold mb-3">Rs. {Number(product.price).toLocaleString()}</p>
                  <button onClick={() => handleMoveToCart(product.product_id)} className="btn-primary w-full mb-2 text-sm">
                    Move To Cart
                  </button>
                  <button onClick={() => handleRemove(product.id)} className="btn-danger w-full text-sm">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}