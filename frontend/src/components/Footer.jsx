import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-primary-900 text-white pt-12 pb-6 mt-16 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center sm:text-left">
          <div>
            <h5 className="uppercase font-bold text-primary-400 mb-4">🛒 SmartCart AI</h5>
            <p className="text-white/60 text-sm">
              Next-generation AI-powered e-commerce platform offering personalized shopping experiences and real-time assistance.
            </p>
          </div>
          <div>
            <h5 className="uppercase font-bold text-sm mb-4">Quick Links</h5>
            <div className="flex flex-col gap-2 text-sm text-white/60">
              <Link to="/" className="hover:text-white">Home</Link>
              <Link to="/products" className="hover:text-white">Products</Link>
              <Link to="/categories" className="hover:text-white">Categories</Link>
              <Link to="/about" className="hover:text-white">About Us</Link>
            </div>
          </div>
          <div>
            <h5 className="uppercase font-bold text-sm mb-4">Support</h5>
            <div className="flex flex-col gap-2 text-sm text-white/60">
              <Link to="/contact" className="hover:text-white">Contact Us</Link>
              <Link to="/ai-chat" className="hover:text-white">AI Assistant</Link>
              <Link to="/cart" className="hover:text-white">My Cart</Link>
            </div>
          </div>
          <div>
            <h5 className="uppercase font-bold text-sm mb-4">Contact</h5>
            <div className="flex flex-col gap-2 text-sm text-white/60">
              <p>📍 Karachi, Pakistan</p>
              <p>📧 support@smartcartai.com</p>
              <p>📞 +92-300-1234567</p>
            </div>
          </div>
        </div>
        <hr className="my-6 border-white/10" />
        <p className="text-center text-white/50 text-sm">© 2026 <strong>SmartCart AI</strong>. All Rights Reserved.</p>
      </div>
    </footer>
  );
}
