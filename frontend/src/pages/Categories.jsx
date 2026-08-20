import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { productsApi } from "../api/client";
import { categoryIcon } from "../utils/categoryIcons";

export default function Categories() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    productsApi.getCategories().then(({ ok, data }) => ok && setCategories(data));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold mb-2">🛍 Shop by Categories</h2>
        <p className="text-gray-500">Browse products by category</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {categories.map((cat) => (
          <div key={cat.category} className="card card-hover overflow-hidden text-center">
            <img
              src={`https://picsum.photos/300/200?random=${encodeURIComponent(cat.category)}`}
              alt={cat.category}
              className="w-full h-40 object-cover"
            />
            <div className="p-5">
              <div className="text-3xl mb-2">{categoryIcon(cat.category)}</div>
              <h5 className="font-bold mb-1">{cat.category}</h5>
              <p className="text-gray-400 text-sm mb-4">{cat.total} Products</p>
              <Link to={`/products?category=${encodeURIComponent(cat.category)}`} className="btn-primary w-full">
                View Products
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
