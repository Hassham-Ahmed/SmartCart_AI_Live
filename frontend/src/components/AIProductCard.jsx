import { useState } from "react";
import { Link } from "react-router-dom";
import { getImageUrl, PLACEHOLDER_IMAGE } from "../config";

function Stars({ rating = 0, reviewCount = 0 }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-1 text-xs" aria-label={rating > 0 ? `Rated ${rating.toFixed(1)} out of 5` : "No ratings yet"}>
      <span className="text-amber-500 tracking-tight" aria-hidden="true">
        {"★".repeat(rounded)}
        <span className="text-gray-300">{"★".repeat(5 - rounded)}</span>
      </span>
      <span className="text-gray-500">
        {rating > 0 ? rating.toFixed(1) : "No ratings yet"}
        {reviewCount > 0 && ` (${reviewCount})`}
      </span>
    </div>
  );
}

export default function AIProductCard({ product, onAddToCart, onAddToWishlist, onBuyNow, compact = false }) {
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(null); // 'cart' | 'wishlist' | null

  const stock = Number(product.stock ?? 0);
  const inStock = stock > 0;

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
    <article className={`bg-white rounded-xl border border-gray-200 p-3 flex flex-col gap-2 text-sm shrink-0 ${compact ? "w-56" : "w-60 sm:w-64"}`}>
      <Link to={`/products/${product.id}`} className="block w-full h-32 overflow-hidden rounded-lg bg-gray-100" tabIndex={-1} aria-hidden="true">
        <img
          src={getImageUrl(product.image)}
          alt=""
          width="256"
          height="128"
          loading="lazy"
          decoding="async"
          className="w-full h-32 object-cover"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = PLACEHOLDER_IMAGE;
          }}
        />
      </Link>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/products/${product.id}`} className="font-semibold text-gray-800 leading-tight hover:text-primary-600 line-clamp-2">
            {product.name}
          </Link>
          <p className="text-xs text-gray-500 truncate">{product.brand} · {product.category}</p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${inStock ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {inStock ? `${stock} in stock` : "Out of stock"}
        </span>
      </div>

      <Stars rating={Number(product.rating) || 0} reviewCount={product.review_count || 0} />

      {product.specs && <p className="text-xs text-gray-500 line-clamp-2">{product.specs}</p>}

      <p className="font-bold text-primary-600">Rs. {Number(product.price).toLocaleString()}</p>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500" id={`qty-${product.id}`}>Qty</span>
        <div className="flex items-center border rounded-lg overflow-hidden" role="group" aria-labelledby={`qty-${product.id}`}>
          <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-2.5 py-1 text-gray-600 hover:bg-gray-50">−</button>
          <span className="px-2" aria-live="polite">{qty}</span>
          <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(stock || 1, 20, q + 1))} className="px-2.5 py-1 text-gray-600 hover:bg-gray-50">+</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <button type="button" disabled={!inStock || !!busy} onClick={() => handle("cart", onAddToCart)} className="btn-outline-primary text-xs py-1.5">
          {busy === "cart" ? "Adding..." : "🛒 Add to Cart"}
        </button>
        <button type="button" disabled={!!busy} onClick={() => handle("wishlist", onAddToWishlist)} className="btn-outline-primary text-xs py-1.5">
          {busy === "wishlist" ? "Saving..." : "❤️ Wishlist"}
        </button>
        {onBuyNow && (
          <button type="button" disabled={!inStock} onClick={() => onBuyNow(product, qty)} className="btn-primary btn-3d text-xs py-1.5 col-span-2">
            ⚡ Buy Now
          </button>
        )}
      </div>
    </article>
  );
}
