import { useEffect, useState } from "react";
import { productsApi } from "../api/client";

export default function ReviewsCarousel() {
  const [reviews, setReviews] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    productsApi.getTopReviews().then(({ ok, data }) => {
      if (ok && Array.isArray(data)) setReviews(data);
    });
  }, []);

  useEffect(() => {
    if (reviews.length < 2) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % reviews.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [reviews.length]);

  if (reviews.length === 0) {
    return <p className="text-center text-gray-400 py-10">No 5-star reviews yet.</p>;
  }

  const review = reviews[index];

  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="card p-8 text-center">
        <div className="text-yellow-400 text-xl mb-3">{"⭐".repeat(5)}</div>
        <p className="text-gray-600 italic text-lg mb-4">"{review.review}"</p>
        <h5 className="font-bold text-gray-900">{review.full_name || "Verified Customer"}</h5>
        <small className="text-success-600 font-semibold">✔ Verified Buyer</small>
      </div>

      {reviews.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {reviews.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${i === index ? "bg-primary-500" : "bg-gray-300"}`}
              aria-label={`Go to review ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
