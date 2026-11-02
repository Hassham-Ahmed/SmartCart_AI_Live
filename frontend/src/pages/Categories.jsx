import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { productsApi } from "../api/client";
import { categoryIcon } from "../utils/categoryIcons";
import { getImageUrl, PLACEHOLDER_IMAGE } from "../config";
import useDocumentTitle from "../hooks/useDocumentTitle";

export default function Categories() {
  useDocumentTitle("Categories", "Browse SmartCart AI products by category.");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productsApi.getCategories().then(({ ok, data }) => {
      if (ok && Array.isArray(data)) setCategories(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">🛍 Shop by Categories</h1>
        <p className="text-gray-600">Browse products by category</p>
      </div>

      {loading && <p className="text-center text-gray-500" role="status">Loading categories…</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {categories.map((cat) => (
          <Link key={cat.category} to={`/products?category=${encodeURIComponent(cat.category)}`} className="card tilt-3d shine overflow-hidden text-center block">
            {/* Real product photo from this category (was a random picsum.photos image) */}
            <img
              src={getImageUrl(cat.sample_image)}
              alt=""
              width="300"
              height="160"
              loading="lazy"
              decoding="async"
              className="w-full h-40 object-cover rounded-t-2xl"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = PLACEHOLDER_IMAGE; }}
            />
            <div className="p-5">
              <div className="text-3xl mb-2" aria-hidden="true">{categoryIcon(cat.category)}</div>
              <h2 className="font-bold mb-1">{cat.category}</h2>
              <p className="text-gray-600 text-sm mb-4">{cat.total} Products</p>
              <span className="btn-primary w-full">View Products</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
