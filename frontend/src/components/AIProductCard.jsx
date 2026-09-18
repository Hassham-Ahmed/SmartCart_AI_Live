import { useState } from "react";
import { getImageUrl } from "../config";

function Stars({ rating = 0, reviewCount = 0 }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-amber-500 tracking-tight">
        {"★".repeat(rounded)}
        <span className="text-gray-300">{"★".repeat(5 - rounded)}</span>
      </span>
      <span className="text-gray-400">
        {rating > 0 ? rating.toFixed(1) : "No ratings yet"}
        {reviewCount > 0 && ` (${reviewCount})`}
      </span>
    </div>
  );
}

export default function AIProductCard({ product, onAddToCart, onAddToWishlist, onBuyNow }) {
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(null); // 'cart' | 'wishlist' | null

  const inStock = (product.stock ?? 0) > 0;

  const handle = async (action, fn) => {
    if (busy) return;
    setBusy(action);
    try {
      await fn(product, qty);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border p-3 flex flex-col gap-2 text-sm w-full sm:w-64">
      {/* Top Image Section */}
      <div className="w-full h-32 overflow-hidden rounded-lg bg-gray-100 mb-1">
        <img
          src={getImageUrl(product.image)}
          alt={product.name}
          className="w-full h-32 object-cover rounded-lg mb-2"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "https://placehold.co/600x600/e5e7eb/9ca3af?text=No+Image";
          }}
        />
      </div>

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-800 leading-tight">{product.name}</p>
          <p className="text-xs text-gray-400">{product.brand} · {product.category}</p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${inStock ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
          {inStock ? `${product.stock} in stock` : "Out of stock"}
        </span>
      </div>

      <Stars rating={product.rating || 0} reviewCount={product.review_count || 0} />

      {product.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{product.description}</p>
      )}

      <p className="font-bold text-primary-600">Rs. {Number(product.price).toLocaleString()}</p>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400">Qty</span>
        <div className="flex items-center border rounded-lg overflow-hidden">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-2 py-1 text-gray-500 hover:bg-gray-50">−</button>
          <span className="px-2">{qty}</span>
          <button type="button" onClick={() => setQty((q) => Math.min(product.stock || 99, q + 1))} className="px-2 py-1 text-gray-500 hover:bg-gray-50">+</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <button
          type="button"
          disabled={!inStock || busy}
          onClick={() => handle("cart", onAddToCart)}
          className="btn-outline-primary text-xs py-1.5 disabled:opacity-50"
        >
          {busy === "cart" ? "Adding..." : "🛒 Add to Cart"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handle("wishlist", onAddToWishlist)}
          className="btn-outline-primary text-xs py-1.5 disabled:opacity-50"
        >
          {busy === "wishlist" ? "Saving..." : "❤️ Wishlist"}
        </button>
        <button
          type="button"
          disabled={!inStock}
          onClick={() => onBuyNow(product, qty)}
          className="btn-primary text-xs py-1.5 col-span-2 disabled:opacity-50"
        >
          ⚡ Buy Now
        </button>
      </div>
    </div>
  );
}