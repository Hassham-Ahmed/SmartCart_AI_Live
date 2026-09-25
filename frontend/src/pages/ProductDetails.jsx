import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { productsApi } from "../api/client";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import useRequireLogin from "../hooks/useRequireLogin";
import { getImageUrl } from "../config";

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

  const { refreshCartCount } = useCart();
  const requireLogin = useRequireLogin();

  const loadReviews = useCallback(() => {
    productsApi.getReviews(id).then(({ ok, data }) => ok && setReviews(data));
  }, [id]);

  const loadRating = useCallback(() => {
    productsApi.getRating(id).then(({ ok, data }) => ok && setRating(data));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    productsApi.getProducts()
      .then(({ ok, data }) => {
        if (ok && Array.isArray(data)) {
          const found = data.find((p) => String(p.id) === String(id));
          setProduct(found || null);
        } else {
          setProduct(null);
        }
      })
      .catch((err) => {
        console.error("Product fetch error:", err);
        setProduct(null);
      })
      .finally(() => {
        setLoading(false);
      });

    loadReviews();
    loadRating();
    setQuantity(1);
  }, [id, loadReviews, loadRating]);

  const handleAddToCart = (redirectToCheckout = false) => {
    requireLogin(async (currentUser) => {
      const { ok, data } = await productsApi.addToCart({
        user_id: currentUser.id,
        product_id: Number(id),
        quantity
      });
      if (ok) {
        Swal.fire({ toast: true, position: "top-end", icon: "success", title: data?.message || "Added to Cart!", showConfirmButton: false, timer: 1500 });
        refreshCartCount();
        if (redirectToCheckout) navigate("/checkout");
      } else {
        Swal.fire("Failed", data?.message || "Could not add to cart.", "error");
      }
    });
  };

  const handleAddToWishlist = () => {
    requireLogin(async (currentUser) => {
      const { data } = await productsApi.addToWishlist({
        user_id: currentUser.id,
        product_id: Number(id)
      });
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: data?.message || "Added to Wishlist!", showConfirmButton: false, timer: 1500 });
    });
  };

  // ✅ FIXED: Proper error handling
  const handleSubmitReview = async (e) => {
    e.preventDefault();

    if (!user) {
      Swal.fire({
        title: "Login Required",
        text: "Review submit karne ke liye pehle login karein.",
        icon: "warning",
      }).then(() => navigate("/login"));
      return;
    }

    if (!reviewText.trim()) {
      Swal.fire("Required", "Please write a review before submitting.", "warning");
      return;
    }

    setSubmittingReview(true);

    try {
      const { ok, data } = await productsApi.addReview({
        user_id: user.id,
        product_id: Number(id),
        rating: reviewRating,
        review: reviewText.trim()
      });

      console.log("Review response:", ok, data);

      // ✅ FIX: Dono success aur duplicate case handle karo
      if (ok) {
        Swal.fire({
          title: "Thank You!",
          text: data?.message || "Review submitted successfully.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false
        });
        setReviewText("");
        setReviewRating(5);
        loadReviews();
        loadRating();
      } else {
        Swal.fire("Notice", data?.message || "Review submit nahi ho saka.", "info");
      }
    } catch (err) {
      console.error("Submit review error:", err);
      Swal.fire("Error", "Server error, dubara koshish karein.", "error");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return <p className="text-center text-gray-400 py-24">Loading product details...</p>;
  }

  if (!product) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-500 mb-4 text-xl">Product details load nahi ho sakiin ya yeh item mojood nahi hai.</p>
        <button onClick={() => navigate(-1)} className="btn-primary px-6 py-2 rounded-lg">
          ← Go Back
        </button>
      </div>
    );
  }

  const inStock = product.stock === undefined || product.stock > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="card p-6 md:p-10">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 text-center">
            <img
              src={getImageUrl(product.image)}
              alt={product.name}
              className="rounded-2xl shadow-sm border w-full object-cover max-h-[420px]"
              onError={(e) => {
                e.target.src = "https://placehold.co/600x600/e5e7eb/9ca3af?text=No+Image";
              }}
            />
          </div>

          <div className="lg:col-span-7">
            <div className="flex items-center gap-2 mb-3">
              <span className={`badge ${inStock ? "bg-success-500" : "bg-danger-500"} text-white`}>
                {inStock ? "In Stock" : "Out of Stock"}
              </span>
              <span className="badge bg-gray-100 text-gray-700 border">⭐ {rating.average_rating || 0} Rating</span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
            <p className="text-gray-500 text-sm mb-3">
              🏷️ Category: <strong className="text-gray-800">{product.category || "--"}</strong>
            </p>

            <h3 className="text-3xl font-bold text-primary-600 mb-4">PKR {Number(product.price || 0).toLocaleString()}</h3>

            <hr className="text-gray-100 mb-4" />

            <h6 className="font-bold text-gray-500 text-sm mb-1">Description</h6>
            <p className="text-gray-600 mb-6">{product.description || "No description available."}</p>

            <div className="mb-6">
              <label className="form-label">Select Quantity</label>
              <div className="flex items-center border rounded-lg w-40 overflow-hidden">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-10 h-10 font-bold text-gray-600 hover:bg-gray-100">-</button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full h-10 text-center font-bold bg-gray-50 border-x"
                />
                <button onClick={() => setQuantity((q) => q + 1)} className="w-10 h-10 font-bold text-gray-600 hover:bg-gray-100">+</button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleAddToCart(false)} className="btn-primary px-5">🛒 Add to Cart</button>
              <button onClick={() => handleAddToCart(true)} className="btn-success px-5">⚡ Buy Now</button>
              <button onClick={handleAddToWishlist} className="btn-outline-danger px-4">❤️ Wishlist</button>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="card p-6 md:p-10 mt-8">
        <div className="flex items-center justify-between mb-6 pb-3 border-b">
          <h3 className="text-xl font-bold flex items-center gap-2">⭐ Product Reviews</h3>
          <span className="font-bold text-gray-500">
            {rating.average_rating || 0} ⭐ ({rating.total_reviews || 0} Reviews)
          </span>
        </div>

        <form onSubmit={handleSubmitReview} className="bg-gray-50 rounded-2xl p-5 mb-6">
          <h5 className="font-bold mb-3">✍️ Write a Review</h5>
          <div className="mb-3">
            <label className="form-label">Your Rating</label>
            <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} className="form-input">
              <option value={5}>⭐⭐⭐⭐⭐ (5 - Excellent)</option>
              <option value={4}>⭐⭐⭐⭐ (4 - Very Good)</option>
              <option value={3}>⭐⭐⭐ (3 - Average)</option>
              <option value={2}>⭐⭐ (2 - Poor)</option>
              <option value={1}>⭐ (1 - Terrible)</option>
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label">Review Comments</label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={3}
              placeholder="Share your experience with this product..."
              className="form-input"
            />
          </div>
          <div className="text-right">
            <button
              type="submit"
              disabled={submittingReview}
              className="btn-primary px-5 disabled:opacity-50"
            >
              {submittingReview ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-3">
          {reviews.length === 0 ? (
            <p className="text-gray-400">No reviews yet. Be the first to write a review!</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="card p-4">
                <h5 className="font-bold">{review.full_name || "Anonymous"}</h5>
                <p className="text-yellow-400 mb-1">{"⭐".repeat(review.rating)}</p>
                <p className="text-gray-700 mb-1">{review.review}</p>
                <small className="text-gray-400">{new Date(review.created_at).toLocaleDateString()}</small>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}