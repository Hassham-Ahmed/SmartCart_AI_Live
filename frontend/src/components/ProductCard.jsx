import { memo } from "react";
import { Link } from "react-router-dom";
import { getImageUrl, PLACEHOLDER_IMAGE } from "../config";
import usePointer3D from "../hooks/usePointer3D";

function ProductCard({ product, onAddToCart, onAddToWishlist, priority = false }) {
  const tiltRef = usePointer3D({ mode: "tilt", max: 6 });
  const outOfStock = product.stock !== undefined && Number(product.stock) <= 0;

  return (
    <article ref={tiltRef} className="card tilt-3d shine flex flex-col h-full">
      <Link to={`/products/${product.id}`} className="block rounded-t-2xl overflow-hidden bg-gray-50" tabIndex={-1} aria-hidden="true">
        <img
          src={getImageUrl(product.image)}
          alt=""
          width="400"
          height="300"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="w-full h-48 object-cover"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = PLACEHOLDER_IMAGE;
          }}
        />
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1 depth-1">
          <Link to={`/products/${product.id}`} className="hover:text-primary-600">{product.name}</Link>
        </h3>
        {product.brand && <p className="text-xs text-gray-500 mb-1">{product.brand}</p>}
        <p className="text-primary-600 font-bold mb-3">PKR {Number(product.price).toLocaleString()}</p>

        <div className="flex gap-2 mt-auto">
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => onAddToCart(product.id)}
            className="btn-primary btn-3d flex-1 text-sm"
          >
            {outOfStock ? "Out of stock" : "Add to Cart"}
          </button>
          <button
            type="button"
            onClick={() => onAddToWishlist(product.id)}
            className="btn-outline-danger px-3 text-sm"
            aria-label={`Add ${product.name} to wishlist`}
          >
            <span aria-hidden="true">❤️</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export default memo(ProductCard);
