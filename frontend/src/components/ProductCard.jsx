import { Link } from "react-router-dom";

export default function ProductCard({ product, onAddToCart, onAddToWishlist }) {
  return (
    <div className="card card-hover overflow-hidden flex flex-col h-full">
      <Link to={`/products/${product.id}`}>
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-56 object-cover"
          loading="lazy"
        />
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 line-clamp-2 mb-1">{product.name}</h3>
        <p className="text-primary-600 font-bold mb-3">PKR {Number(product.price).toLocaleString()}</p>

        <Link to={`/products/${product.id}`} className="btn-outline-dark w-full text-sm mb-2">
          View Details
        </Link>

        <div className="flex gap-2 mt-auto">
          <button onClick={() => onAddToCart(product.id)} className="btn-primary flex-1 text-sm">
            Add to Cart
          </button>
          <button
            onClick={() => onAddToWishlist(product.id)}
            className="btn-outline-danger px-3 text-sm"
            aria-label="Add to wishlist"
          >
            ❤️
          </button>
        </div>
      </div>
    </div>
  );
}
