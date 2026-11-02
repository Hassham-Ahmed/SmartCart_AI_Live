import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { productsApi } from "../api/client";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import useRequireLogin from "../hooks/useRequireLogin";
import useDocumentTitle from "../hooks/useDocumentTitle";
import usePointer3D from "../hooks/usePointer3D";
import { getImageUrl, PLACEHOLDER_IMAGE } from "../config";

const toast = (icon, title) => Swal.fire({ toast: true, position: "top-end", icon, title, showConfirmButton: false, timer: 1500 });

function parseSpecs(specs) {
  return (specs || "")
    .split(";")
    .map((s) => s.split(":"))
    .filter((kv) => kv.length >= 2 && kv[1].trim())
    .map(([k, ...v]) => [k.trim(), v.join(":").trim()]);
}

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState({ average_rating: 0, total_reviews: 0 });
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);
  const imgRef = usePointer3D({ mode: "tilt", max: 5 });

  const { refreshCartCount } = useCart();
  const requireLogin = useRequireLogin();
  useDocumentTitle(product?.name, product ? `${product.name} by ${product.brand || "SmartCart"} - PKR ${Number(product.price).toLocaleString()}` : undefined);

  const loadReviews = useCallback(() => {
    productsApi.getReviews(id).then(({ ok, data }) => ok && Array.isArray(data) && setReviews(data));
  }, [id]);

  const loadRating = useCallback(() => {
    productsApi.getRating(id).then(({ ok, data }) => ok && setRating(data));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    // BUGFIX/PERF: previously downloaded the ENTIRE catalog to find one product.
    productsApi.getProduct(id).then(({ ok, data }) => {
      setProduct(ok ? data : null);
      setLoading(false);
    });
    productsApi.recordView(id); // feeds the AI's "recently viewed" personalisation
    loadReviews();
    loadRating();
    setQuantity(1);
  }, [id, loadReviews, loadRating]);

  // Product structured data (rich results in Google)
  useEffect(() => {
    if (!product) return undefined;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: getImageUrl(product.image),
      brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
      category: product.category,
      description: product.description && !product.description.startsWith("No description") ? product.description : product.specs || product.name,
      offers: {
        "@type": "Offer",
        priceCurrency: "PKR",
        price: Number(product.price),
        availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
      ...(rating.total_reviews > 0 && {
        aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average_rating, reviewCount: rating.total_reviews },
      }),
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, [product, rating]);

  const maxQty = Math.max(1, Math.min(Number(product?.stock ?? 1), 50));

  const handleAddToCart = (redirectToCheckout = false) => {
    requireLogin(async () => {
      const { ok, data } = await productsApi.addToCart({ product_id: Number(id), quantity });
      if (ok) {
        toast("success", data?.message || "Added to Cart!");
        refreshCartCount();
        if (redirectToCheckout) navigate("/checkout");
      } else {
        Swal.fire("Couldn't add to cart", data?.message || "Please try again.", "error");
      }
    });
  };

  const handleAddToWishlist = () => {
    requireLogin(async () => {
      const { ok, data } = await productsApi.addToWishlist({ product_id: Number(id) });
      toast(ok ? "success" : "error", data?.message || (ok ? "Added to Wishlist!" : "Could not update wishlist."));
    });
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      Swal.fire({ title: "Login Required", text: "Please log in to write a review.", icon: "warning" }).then(() => navigate("/login", { state: { from: `/products/${id}` } }));
      return;
    }
    if (!reviewText.trim()) {
      Swal.fire("Required", "Please write a review before submitting.", "warning");
      return;
    }

    setSubmittingReview(true);
    const { ok, data } = await productsApi.addReview({ product_id: Number(id), rating: reviewRating, review: reviewText.trim() });
    setSubmittingReview(false);
    if (ok) {
      Swal.fire({ title: "Thank You!", text: data?.message || "Review submitted successfully.", icon: "success", timer: 1500, showConfirmButton: false });
      setReviewText("");
      setReviewRating(5);
      loadReviews();
      loadRating();
    } else {
      Swal.fire("Notice", data?.message || "Your review could not be submitted.", "info");
    }
  };

  if (loading) {
    return <p className="text-center text-gray-500 py-24" role="status">Loading product details...</p>;
  }

  if (!product) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 text-center">
        <h1 className="text-gray-700 mb-4 text-xl">This product could not be found.</h1>
        <Link to="/products" className="btn-primary px-6 py-2 rounded-lg">← Back to products</Link>
      </div>
    );
  }

  const inStock = Number(product.stock) > 0;
  const specs = parseSpecs(product.specs);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-gray-500 mb-4">
        <Link to="/products" className="hover:underline">Products</Link> /{" "}
        <Link to={`/products?category=${encodeURIComponent(product.category)}`} className="hover:underline">{product.category}</Link>
      </nav>
      <div className="card p-5 md:p-10">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 text-center">
            <div ref={imgRef} className="tilt-3d rounded-2xl">
              <img
                src={getImageUrl(product.image)}
                alt={product.name}
                width="600"
                height="420"
                fetchPriority="high"
                className="rounded-2xl shadow-sm border w-full object-cover max-h-[420px]"
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = PLACEHOLDER_IMAGE; }}
              />
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`badge ${inStock ? "bg-success-500" : "bg-danger-500"} text-white`}>
                {inStock ? `In Stock (${product.stock})` : "Out of Stock"}
              </span>
              <span className="badge bg-gray-100 text-gray-700 border">⭐ {rating.average_rating || 0} ({rating.total_reviews || 0})</span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
            <p className="text-gray-600 text-sm mb-3">
              {product.brand && <>Brand: <strong className="text-gray-800">{product.brand}</strong> · </>}
              Category: <strong className="text-gray-800">{product.category || "--"}</strong>
            </p>

            <p className="text-3xl font-bold text-primary-600 mb-4">PKR {Number(product.price || 0).toLocaleString()}</p>

            <hr className="border-gray-100 mb-4" />

            {specs.length > 0 && (
              <>
                <h2 className="font-bold text-gray-600 text-sm mb-2">Specifications</h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-4">
                  {specs.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-gray-500">{k}</dt>
                      <dd className="text-gray-800 font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}

            {product.description && !product.description.startsWith("No description") && (
              <>
                <h2 className="font-bold text-gray-600 text-sm mb-1">Description</h2>
                <p className="text-gray-700 mb-6">{product.description}</p>
              </>
            )}

            <div className="mb-6">
              <label htmlFor="qty" className="form-label">Quantity</label>
              <div className="flex items-center border rounded-lg w-40 overflow-hidden">
                <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-10 h-10 font-bold text-gray-600 hover:bg-gray-100">−</button>
                <input
                  id="qty"
                  type="number"
                  min="1"
                  max={maxQty}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(maxQty, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="w-full h-10 text-center font-bold bg-gray-50 border-x"
                />
                <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} className="w-10 h-10 font-bold text-gray-600 hover:bg-gray-100">+</button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!inStock} onClick={() => handleAddToCart(false)} className="btn-primary btn-3d px-5">🛒 Add to Cart</button>
              <button type="button" disabled={!inStock} onClick={() => handleAddToCart(true)} className="btn-success btn-3d px-5">⚡ Buy Now</button>
              <button type="button" onClick={handleAddToWishlist} className="btn-outline-danger px-4">❤️ Wishlist</button>
              <Link to={`/ai-chat?q=${encodeURIComponent(`Show me products similar to ${product.name}`)}`} className="btn-outline-primary px-4">🤖 Find similar</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section className="card p-5 md:p-10 mt-8" aria-labelledby="reviews-title">
        <div className="flex flex-wrap gap-2 items-center justify-between mb-6 pb-3 border-b">
          <h2 id="reviews-title" className="text-xl font-bold">⭐ Product Reviews</h2>
          <span className="font-bold text-gray-600">
            {rating.average_rating || 0} ⭐ ({rating.total_reviews || 0} Reviews)
          </span>
        </div>

        <form onSubmit={handleSubmitReview} className="bg-gray-50 rounded-2xl p-5 mb-6">
          <h3 className="font-bold mb-3">✍️ Write a Review</h3>
          <div className="mb-3">
            <label htmlFor="review-rating" className="form-label">Your Rating</label>
            <select id="review-rating" value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} className="form-input">
              <option value={5}>⭐⭐⭐⭐⭐ (5 - Excellent)</option>
              <option value={4}>⭐⭐⭐⭐ (4 - Very Good)</option>
              <option value={3}>⭐⭐⭐ (3 - Average)</option>
              <option value={2}>⭐⭐ (2 - Poor)</option>
              <option value={1}>⭐ (1 - Terrible)</option>
            </select>
          </div>
          <div className="mb-3">
            <label htmlFor="review-text" className="form-label">Review Comments</label>
            <textarea id="review-text" value={reviewText} maxLength={2000} onChange={(e) => setReviewText(e.target.value)} rows={3} placeholder="Share your experience with this product..." className="form-input" />
          </div>
          <div className="text-right">
            <button type="submit" disabled={submittingReview} className="btn-primary px-5">
              {submittingReview ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-3">
          {reviews.length === 0 ? (
            <p className="text-gray-500">No reviews yet. Be the first to write a review!</p>
          ) : (
            reviews.map((review) => (
              <article key={review.id} className="card p-4">
                <h3 className="font-bold">{review.full_name || "Anonymous"}</h3>
                <p className="text-yellow-400 mb-1" aria-label={`${review.rating} out of 5 stars`}>{"⭐".repeat(review.rating)}</p>
                <p className="text-gray-700 mb-1">{review.review}</p>
                <time className="text-xs text-gray-500" dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString()}</time>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
