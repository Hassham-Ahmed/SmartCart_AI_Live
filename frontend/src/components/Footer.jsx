import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer-depth overflow-hidden bg-primary-900 text-white pt-12 pb-6 mt-16 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center sm:text-left">
          <div>
            <h2 className="uppercase font-bold text-primary-300 mb-4">🛒 SmartCart AI</h2>
            <p className="text-white/70 text-sm">
              AI-powered e-commerce platform offering personalized shopping experiences and real-time assistance.
            </p>
          </div>
          <nav aria-label="Quick links">
            <h2 className="uppercase font-bold text-sm mb-4">Quick Links</h2>
            <ul className="flex flex-col gap-2 text-sm text-white/70">
              <li><Link to="/" className="hover:text-white">Home</Link></li>
              <li><Link to="/products" className="hover:text-white">Products</Link></li>
              <li><Link to="/categories" className="hover:text-white">Categories</Link></li>
              <li><Link to="/about" className="hover:text-white">About Us</Link></li>
            </ul>
          </nav>
          <nav aria-label="Support">
            <h2 className="uppercase font-bold text-sm mb-4">Support</h2>
            <ul className="flex flex-col gap-2 text-sm text-white/70">
              <li><Link to="/contact" className="hover:text-white">Contact Us</Link></li>
              <li><Link to="/ai-chat" className="hover:text-white">AI Assistant</Link></li>
              <li><Link to="/cart" className="hover:text-white">My Cart</Link></li>
              <li><Link to="/order-history" className="hover:text-white">Track Orders</Link></li>
            </ul>
          </nav>
          <div>
            <h2 className="uppercase font-bold text-sm mb-4">Contact</h2>
            <address className="not-italic flex flex-col gap-2 text-sm text-white/70">
              <p>📍 Karachi, Pakistan</p>
              <p>📧 <a href="mailto:support@smartcartai.com" className="hover:text-white">support@smartcartai.com</a></p>
              <p>📞 <a href="tel:+923001234567" className="hover:text-white">+92-300-1234567</a></p>
            </address>
          </div>
        </div>
        <hr className="my-6 border-white/10" />
        <p className="text-center text-white/60 text-sm">© {new Date().getFullYear()} <strong>SmartCart AI</strong>. All Rights Reserved.</p>
      </div>
    </footer>
  );
}
