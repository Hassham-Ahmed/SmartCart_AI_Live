import { useEffect, useState } from "react";
import { productsApi } from "../api/client";

export default function ReviewsCarousel() {
  const [reviews, setReviews] = useState([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    productsApi.getTopReviews().then(({ ok, data }) => {
      if (ok && Array.isArray(data)) setReviews(data);
    });
  }, []);

  useEffect(() => {
    // pause on hover/focus and for reduced-motion users (WCAG 2.2.2)
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reviews.length < 2 || paused || reduced) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % reviews.length), 5000);
    return () => clearInterval(timer);
  }, [reviews.length, paused]);

  if (reviews.length === 0) {
    return <p className="text-center text-gray-500 py-10">No 5-star reviews yet - be the first to review a product!</p>;
  }

  const review = reviews[index];

  return (
    <div
      className="relative max-w-2xl mx-auto review-stage"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Customer reviews"
    >
      <figure key={index} className="card review-card-3d p-6 sm:p-8 text-center" aria-live="polite">
        <div className="text-yellow-400 text-xl mb-3" aria-label="5 out of 5 stars">{"⭐".repeat(5)}</div>
        <blockquote className="text-gray-700 italic text-base sm:text-lg mb-4">"{review.review}"</blockquote>
        <figcaption>
          <p className="font-bold text-gray-900">{review.full_name || "Verified Customer"}</p>
          {review.product_name && <p className="text-xs text-gray-500">on {review.product_name}</p>}
        </figcaption>
      </figure>

      {reviews.length > 1 && (
        <div className="flex justify-center gap-1 mt-4">
          {reviews.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className="w-6 h-6 flex items-center justify-center"
              aria-label={`Show review ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
            >
              <span className={`w-2.5 h-2.5 rounded-full transition-colors ${i === index ? "bg-primary-500" : "bg-gray-300"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
