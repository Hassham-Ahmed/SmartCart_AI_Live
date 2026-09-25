import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { productsApi, authApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import useRequireLogin from "../hooks/useRequireLogin";
import ProductCard from "../components/ProductCard";
import ReviewsCarousel from "../components/ReviewsCarousel";
import { categoryIcon } from "../utils/categoryIcons";

const features = [
  { icon: "🤖", title: "AI Recommendations", text: "Get personalized product suggestions powered by AI algorithms." },
  { icon: "🚚", title: "Fast Delivery", text: "Quick, reliable, and trackable delivery right at your doorstep." },
  { icon: "💳", title: "Secure Payments", text: "Multiple trusted and encrypted payment gateways for safe shopping." },
  { icon: "📞", title: "24/7 Support", text: "Dedicated support team and instant AI assistance available always." },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const { user } = useAuth();
  const { refreshCartCount } = useCart();
  const requireLogin = useRequireLogin();

  useEffect(() => {
    productsApi.getProducts().then(({ ok, data }) => {
      if (ok) setProducts(data.slice(0, 8));
    });
    productsApi.getCategories().then(({ ok, data }) => {
      if (ok) setCategories(data.slice(0, 6));
    });
  }, []);

  const handleAddToCart = (productId) => {
    requireLogin(async (currentUser) => {
      const { ok, data } = await productsApi.addToCart({
        user_id: currentUser.id,
        product_id: productId,
        quantity: 1,
      });
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: ok ? "success" : "error",
        title: data.message || (ok ? "Added to Cart!" : "Could not add to cart."),
        showConfirmButton: false,
        timer: 1500,
      });
      if (ok) refreshCartCount();
    });
  };

  const handleAddToWishlist = async (productId) => {
    if (!user) {
      Swal.fire({
        icon: "warning",
        title: "Login Required",
        text: "Wishlist mein add karne ke liye pehle login karein!",
      });
      return;
    }

    try {
      const { ok, data } = await productsApi.addToWishlist({
        user_id: user.id,
        product_id: Number(productId),
      });

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: ok ? "success" : "info",
        title: data?.message || "Wishlist update ho gayi!",
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (error) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: "Wishlist add karne mein masla hua.",
        showConfirmButton: false,
        timer: 2000,
      });
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    navigate(searchTerm.trim() ? `/products?search=${encodeURIComponent(searchTerm.trim())}` : "/products");
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    const { ok, data } = await authApi.subscribe(email);
    Swal.fire({
      icon: ok ? "success" : "error",
      title: ok ? "Subscribed!" : "Failed",
      text: data.message,
      timer: ok ? 2000 : undefined,
      showConfirmButton: !ok,
    });
    if (ok) setEmail("");
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 to-primary-500 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <div className="text-center lg:text-left">
            <span className="badge bg-white text-primary-600 mb-4">✨ AI-Powered Shopping Experience</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-4">
              Smart Recommendations • Real-Time Search • Fast Checkout
            </h1>
            <p className="text-lg text-white/85 mb-6">
              Discover products tailored to your preferences with our intelligent AI shopping assistant.
            </p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-3 mb-6">
              <a href="#products-section" className="btn bg-white text-primary-600 hover:bg-gray-100 shadow-lg">
                Shop Now →
              </a>
              <Link to="/products" className="btn-outline-light">Explore Catalog</Link>
            </div>
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 bg-white/15 backdrop-blur border border-white/25 rounded-full p-1.5 shadow-lg max-w-xl mx-auto lg:mx-0">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Describe what you are looking for (e.g. 'Best wireless earbuds')..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/70 px-4 py-2 text-sm"
              />
              <button type="submit" className="btn-primary shrink-0">🤖 Ask AI</button>
            </form>
          </div>
          <div className="text-center">
            <img
              src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80"
              className="rounded-2xl shadow-2xl border-2 border-white/25 w-full max-w-lg mx-auto"
              alt="Smart Shopping"
            />
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-10">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.category}
                to={`/products?category=${encodeURIComponent(cat.category)}`}
                className="card card-hover text-center p-4"
              >
                <div className="text-3xl mb-2">{categoryIcon(cat.category)}</div>
                <h6 className="font-bold text-sm text-gray-900">{cat.category}</h6>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Trending Products */}
      <section id="products-section" className="bg-white py-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h6 className="text-primary-600 font-bold uppercase text-sm">Featured Items</h6>
              <h2 className="text-3xl font-bold">Trending Products</h2>
            </div>
            <Link to="/products" className="btn-outline-primary">View All</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onAddToWishlist={handleAddToWishlist} />
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <h6 className="text-primary-600 font-bold uppercase text-sm">Our Value</h6>
            <h2 className="text-3xl font-bold">Why Choose SmartCart AI?</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {features.map((f) => (
              <div key={f.title} className="card card-hover p-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-2xl mb-4">
                  {f.icon}
                </div>
                <h5 className="font-bold mb-2">{f.title}</h5>
                <p className="text-gray-500 text-sm">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deals Banner */}
      <section className="max-w-7xl mx-auto px-4 my-10">
        <div className="bg-gradient-to-br from-primary-500 to-primary-800 rounded-3xl text-white text-center p-10 lg:p-16 shadow-xl">
          <span className="badge bg-warning-500 text-gray-900 mb-3">🔥 Limited Time Offer</span>
          <h2 className="text-3xl lg:text-4xl font-bold mb-3">Today's Best Deals</h2>
          <p className="text-lg text-white/90 mb-6 max-w-xl mx-auto">
            Save up to <strong>50% OFF</strong> on selected Laptops, Phones, and Accessories.
          </p>
          <Link to="/products" className="btn bg-white text-primary-600 hover:bg-gray-100 shadow-lg px-6">
            Shop Deals Now
          </Link>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-gray-50 py-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <span className="text-primary-600 font-bold uppercase text-sm">Reviews</span>
            <h2 className="text-3xl font-bold">What Our Customers Say</h2>
          </div>
          <ReviewsCarousel />
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-gray-50 pb-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="card p-10 text-center">
            <h2 className="text-2xl font-bold text-primary-600 mb-2">Subscribe to Our Newsletter</h2>
            <p className="text-gray-500 mb-6">Get instant updates on new arrivals, AI feature rollouts, and exclusive discounts.</p>
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2 max-w-lg mx-auto">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address..."
                className="form-input flex-1"
              />
              <button type="submit" className="btn-primary px-6">Subscribe</button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}