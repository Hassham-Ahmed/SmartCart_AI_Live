import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import { productsApi } from "../api/client";
import { useCart } from "../context/CartContext";
import useRequireLogin from "../hooks/useRequireLogin";
import ProductCard from "../components/ProductCard";

const PRICE_RANGES = [
  { value: "", label: "Price Range" },
  { value: "0-50000", label: "Under Rs. 50,000" },
  { value: "50000-100000", label: "Rs. 50,000 - 100,000" },
  { value: "100000-200000", label: "Rs. 100,000 - 200,000" },
  { value: "200000-above", label: "Above Rs. 200,000" },
];

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [brand, setBrand] = useState("");
  const [priceRange, setPriceRange] = useState("");

  const category = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";

  const { refreshCartCount } = useCart();
  const requireLogin = useRequireLogin();

  useEffect(() => {
    setLoading(true);
    productsApi.getProducts({ category, search }).then(({ ok, data }) => {
      if (ok) setAllProducts(data);
      setLoading(false);
    });
  }, [category, search]);

  const brands = useMemo(
    () => [...new Set(allProducts.map((p) => p.brand).filter(Boolean))].sort(),
    [allProducts]
  );

  const products = useMemo(() => {
    return allProducts.filter((p) => {
      if (brand && p.brand !== brand) return false;
      if (priceRange) {
        const price = Number(p.price);
        if (priceRange === "200000-above") {
          if (price < 200000) return false;
        } else {
          const [min, max] = priceRange.split("-").map(Number);
          if (price < min || price > max) return false;
        }
      }
      return true;
    });
  }, [allProducts, brand, priceRange]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchInput.trim()) next.set("search", searchInput.trim());
    else next.delete("search");
    setSearchParams(next);
  };

  const handleCategoryChange = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("category", value);
    else next.delete("category");
    setSearchParams(next);
  };

  const handleAddToCart = (productId) => {
    requireLogin(async (user) => {
      const { ok, data } = await productsApi.addToCart({ user_id: user.id, product_id: productId, quantity: 1 });
      Swal.fire({ toast: true, position: "top-end", icon: ok ? "success" : "error", title: data.message || (ok ? "Added to Cart!" : "Could not add to cart."), showConfirmButton: false, timer: 1500 });
      if (ok) refreshCartCount();
    });
  };

  const handleAddToWishlist = (productId) => {
    requireLogin(async (user) => {
      const { data } = await productsApi.addToWishlist({ user_id: user.id, product_id: productId });
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: data.message || "Added to Wishlist!", showConfirmButton: false, timer: 1500 });
    });
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-primary-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-1">🛍️ Explore Our Products</h2>
          <p className="text-white/60 text-sm">Discover high-quality items with AI-powered recommendations.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-4">
        <div className="card p-5 mb-8">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-2 mb-4">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products, brands or items..."
              className="form-input flex-1"
            />
            <button type="submit" className="btn-primary px-6">🔍 Search</button>
          </form>

          <hr className="text-gray-200 my-4" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Category</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="form-input"
              >
                <option value="">All Categories</option>
                {[...new Set(allProducts.map((p) => p.category))].sort().map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Brand</label>
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className="form-input">
                <option value="">All Brands</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Price Range</label>
              <select value={priceRange} onChange={(e) => setPriceRange(e.target.value)} className="form-input">
                {PRICE_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-16">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="text-center text-gray-400 py-16">No products found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-16">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
