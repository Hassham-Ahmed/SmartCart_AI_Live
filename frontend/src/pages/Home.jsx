import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { productsApi, authApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import useRequireLogin from "../hooks/useRequireLogin";
import useDocumentTitle from "../hooks/useDocumentTitle";
import usePointer3D from "../hooks/usePointer3D";
import ProductCard from "../components/ProductCard";
import ReviewsCarousel from "../components/ReviewsCarousel";
import { categoryIcon } from "../utils/categoryIcons";
import { getImageUrl, PLACEHOLDER_IMAGE } from "../config";

const features = [
  { icon: "🤖", title: "AI Recommendations", text: "Our assistant understands what you mean, not just keywords, and picks products from our live catalog that fit your needs and budget." },
  { icon: "🚚", title: "Fast Delivery", text: "Flat Rs. 200 delivery and order tracking right inside the AI chat - just ask \"where is my order?\"." },
  { icon: "💳", title: "Secure Payments", text: "Cash on Delivery, cards and mobile wallets. We never store full card numbers." },
  { icon: "📞", title: "24/7 Support", text: "The AI assistant is always on, and our team answers every message from the Contact page." },
];

const toast = (icon, title) => Swal.fire({ toast: true, position: "top-end", icon, title, showConfirmButton: false, timer: 1600 });

function FlipCard({ icon, title, text }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      className={`flip-card ${flipped ? "is-flipped" : ""}`}
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setFlipped((f) => !f))}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={`${title}: ${text}`}
    >
      <div className="flip-card-inner">
        <div className="flip-face card">
          <div className="w-16 h-16 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-2xl mb-4" aria-hidden="true">{icon}</div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-xs text-gray-500 mt-2 sm:hidden">Tap to learn more</p>
        </div>
        <div className="flip-face flip-back bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-lg">
          <h3 className="font-bold mb-2">{title}</h3>
          <p className="text-sm text-white/90">{text}</p>
        </div>
      </div>
    </div>
  );
}

function HeroStack({ products }) {
  const shots = products.filter((p) => p.image).slice(0, 3);
  const tiles = [
    { cls: "w-[58%] aspect-square left-[4%] top-[14%] float-y", depth: "18px", z: 2 },
    { cls: "w-[44%] aspect-square right-[2%] top-[2%] float-y-delayed", depth: "34px", z: 3 },
    { cls: "w-[40%] aspect-square right-[10%] bottom-[2%] float-y", depth: "26px", z: 1 },
  ];
  return (
    <div className="relative w-full max-w-md mx-auto aspect-square hero-stack" aria-hidden="true">
      <div className="hero-glow w-56 h-56 bg-primary-300 left-8 top-10 parallax-layer" style={{ "--depth": "-14px" }} />
      <div className="hero-glow w-40 h-40 bg-warning-500 right-6 bottom-10 parallax-layer" style={{ "--depth": "-8px" }} />
      {tiles.map((t, i) => {
        const p = shots[i];
        return (
          <div key={i} className={`hero-tile parallax-layer ${t.cls}`} style={{ "--depth": t.depth, zIndex: t.z }}>
            {p ? (
              <img
                src={getImageUrl(p.image)}
                alt=""
                width="320"
                height="320"
                fetchPriority={i === 0 ? "high" : "auto"}
                decoding="async"
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
              />
            ) : (
              <div className="w-full h-full bg-white/20 animate-pulse" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  useDocumentTitle(null, "Shop smarter with SmartCart AI: semantic AI product search, personalised recommendations, comparisons and fast checkout.");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const heroRef = usePointer3D({ mode: "parallax" });

  const { user } = useAuth();
  const { refreshCartCount } = useCart();
  const requireLogin = useRequireLogin();

  useEffect(() => {
    productsApi.getProducts({ limit: 8 }).then(({ ok, data }) => {
      if (ok && Array.isArray(data)) setProducts(data.slice(0, 8));
    });
    productsApi.getCategories().then(({ ok, data }) => {
      if (ok && Array.isArray(data)) setCategories(data.slice(0, 6));
    });
  }, []);

  const handleAddToCart = (productId) => {
    requireLogin(async () => {
      const { ok, data } = await productsApi.addToCart({ product_id: productId, quantity: 1 });
      toast(ok ? "success" : "error", data.message || (ok ? "Added to Cart!" : "Could not add to cart."));
      if (ok) refreshCartCount();
    });
  };

  const handleAddToWishlist = async (productId) => {
    if (!user) {
      Swal.fire({ icon: "warning", title: "Login Required", text: "Please log in to save items to your wishlist." });
      return;
    }
    const { ok, data } = await productsApi.addToWishlist({ product_id: Number(productId) });
    toast(ok ? "success" : "error", data?.message || (ok ? "Wishlist updated!" : "Could not update wishlist."));
  };

  // "Ask AI" now actually asks the AI (it used to run a plain LIKE search).
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = searchTerm.trim();
    navigate(q ? `/ai-chat?q=${encodeURIComponent(q)}` : "/ai-chat");
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    const { ok, data } = await authApi.subscribe(email);
    Swal.fire({ icon: ok ? "success" : "error", title: ok ? "Subscribed!" : "Failed", text: data.message, timer: ok ? 2000 : undefined, showConfirmButton: !ok });
    if (ok) setEmail("");
  };

  return (
    <>
      {/* Hero */}
      <section ref={heroRef} className="hero-3d relative overflow-hidden bg-gradient-to-br from-primary-900 to-primary-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-14 lg:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div className="text-center lg:text-left parallax-layer" style={{ "--depth": "-6px" }}>
            <span className="badge bg-white text-primary-700 mb-4">✨ AI-Powered Shopping Experience</span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-4">
              Describe it. <span className="text-primary-200">We'll find it.</span>
            </h1>
            <p className="text-base sm:text-lg text-white/90 mb-6">
              Our AI assistant understands what you mean - "a quiet mouse for office", "phone with a great camera under 60k" - and finds the best matches from our catalog.
            </p>
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 bg-white/15 backdrop-blur border border-white/25 rounded-full p-1.5 shadow-lg max-w-xl mx-auto lg:mx-0 mb-6">
              <label htmlFor="hero-ask" className="sr-only">Describe what you are looking for</label>
              <input
                id="hero-ask"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g. best wireless earbuds under 10k"
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-white placeholder-white/75 px-3 sm:px-4 py-2 text-sm"
              />
              <button type="submit" className="btn-primary btn-3d shrink-0">🤖 Ask AI</button>
            </form>
            <div className="flex flex-wrap justify-center lg:justify-start gap-3">
              <a href="#products-section" className="btn btn-3d bg-white text-primary-700 hover:bg-gray-100">Shop Now →</a>
              <Link to="/products" className="btn-outline-light">Explore Catalog</Link>
            </div>
          </div>
          <HeroStack products={products} />
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-10" aria-labelledby="cat-heading">
        <h2 id="cat-heading" className="sr-only">Shop by category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 min-h-[7rem]">
          {categories.map((cat) => (
            <Link key={cat.category} to={`/products?category=${encodeURIComponent(cat.category)}`} className="card tilt-3d text-center p-4">
              <div className="text-3xl mb-2" aria-hidden="true">{categoryIcon(cat.category)}</div>
              <h3 className="font-bold text-sm text-gray-900">{cat.category}</h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending Products */}
      <section id="products-section" className="bg-white py-14" aria-labelledby="trending-heading">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap gap-3 justify-between items-end mb-8">
            <div>
              <p className="text-primary-600 font-bold uppercase text-sm">Featured Items</p>
              <h2 id="trending-heading" className="text-2xl sm:text-3xl font-bold">Trending Products</h2>
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

      {/* Why Choose Us: 3D flip cards */}
      <section className="py-14" aria-labelledby="value-heading">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-primary-600 font-bold uppercase text-sm">Our Value</p>
            <h2 id="value-heading" className="text-2xl sm:text-3xl font-bold">Why Choose SmartCart AI?</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => <FlipCard key={f.title} {...f} />)}
          </div>
        </div>
      </section>

      {/* AI CTA banner (replaces an unverifiable "up to 50% OFF" claim) */}
      <section className="max-w-7xl mx-auto px-4 my-10">
        <div className="bg-gradient-to-br from-primary-500 to-primary-800 rounded-3xl text-white text-center p-8 sm:p-10 lg:p-16 shadow-xl">
          <span className="badge bg-warning-500 text-gray-900 mb-3">🤖 New: Smarter AI assistant</span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3">Find the best value in your budget</h2>
          <p className="text-base sm:text-lg text-white/90 mb-6 max-w-xl mx-auto">
            Tell the assistant your budget and what matters to you. It compares real products from our catalog and explains the trade-offs.
          </p>
          <Link to="/ai-chat" className="btn btn-3d bg-white text-primary-700 hover:bg-gray-100 px-6">Ask the AI Assistant</Link>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-gray-50 py-14" aria-labelledby="reviews-heading">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-primary-600 font-bold uppercase text-sm">Reviews</p>
            <h2 id="reviews-heading" className="text-2xl sm:text-3xl font-bold">What Our Customers Say</h2>
          </div>
          <ReviewsCarousel />
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-gray-50 pb-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="card p-6 sm:p-10 text-center">
            <h2 className="text-2xl font-bold text-primary-600 mb-2">Subscribe to Our Newsletter</h2>
            <p className="text-gray-600 mb-6">Get updates on new arrivals, AI features and exclusive offers.</p>
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2 max-w-lg mx-auto">
              <label htmlFor="newsletter-email" className="sr-only">Email address</label>
              <input id="newsletter-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address..." className="form-input flex-1" />
              <button type="submit" className="btn-primary btn-3d px-6">Subscribe</button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
