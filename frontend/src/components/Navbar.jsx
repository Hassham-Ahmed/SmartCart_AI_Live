import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Products" },
  { to: "/categories", label: "Categories" },
  { to: "/about", label: "About Us" },
  { to: "/contact", label: "Contact Us" },
];

function displayName(user) {
  if (!user) return "Profile";
  const raw = user.full_name || user.name || user.username || "";
  if (!raw || raw.includes("@")) return "Profile";
  return raw.split(" ")[0];
}

export default function Navbar() {
  const { user, isLoggedIn, logout } = useAuth();
  const { cartCount } = useCart();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    Swal.fire({
      title: "Are you sure?",
      text: "You will be logged out of your session!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#0d6efd",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, logout!",
    }).then((result) => {
      if (result.isConfirmed) {
        logout();
        navigate("/login");
      }
    });
  };

  const linkClass = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium rounded-md transition-colors ${
      isActive ? "text-white bg-white/10" : "text-white/85 hover:text-white hover:bg-white/10"
    }`;

  return (
    <nav className="sticky top-0 z-50 bg-primary-900 shadow-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary-400 shrink-0">
            🛒 SmartCart AI
          </Link>

          <div className="hidden xl:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass} end={link.to === "/"}>
                {link.label}
              </NavLink>
            ))}
            <NavLink to="/ai-chat" className={({ isActive }) =>
              `px-3 py-2 text-sm font-bold rounded-md transition-colors ${isActive ? "text-warning-500 bg-white/10" : "text-warning-500 hover:bg-white/10"}`
            }>
              🤖 AI Assistant
            </NavLink>
          </div>

          <div className="hidden xl:flex items-center gap-2">
            <Link to="/wishlist" className="btn-outline-light text-sm">
              ❤️ <span className="ml-1">Wishlist</span>
            </Link>
            <Link to="/cart" className="btn-outline-light text-sm relative">
              🛒 <span className="ml-1">Cart</span>
              <span className="absolute -top-2 -right-2 bg-danger-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            </Link>

            {isLoggedIn ? (
              <>
                <Link to="/profile" className="btn-primary text-sm">
                  👤 {displayName(user)}
                </Link>
                <button onClick={handleLogout} className="btn-danger text-sm">
                  🚪 Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-primary text-sm">Login</Link>
                <Link to="/register" className="btn-outline-light text-sm">Register</Link>
              </>
            )}
          </div>

          <button
            className="xl:hidden text-white text-2xl"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
        </div>

        {open && (
          <div className="xl:hidden pb-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass} end={link.to === "/"} onClick={() => setOpen(false)}>
                {link.label}
              </NavLink>
            ))}
            <NavLink to="/ai-chat" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-bold text-warning-500 rounded-md hover:bg-white/10">
              🤖 AI Assistant
            </NavLink>
            <Link to="/wishlist" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-white/85 hover:bg-white/10 rounded-md">❤️ Wishlist</Link>
            <Link to="/cart" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-white/85 hover:bg-white/10 rounded-md">🛒 Cart ({cartCount})</Link>
            {isLoggedIn ? (
              <>
                <Link to="/profile" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-white/85 hover:bg-white/10 rounded-md">👤 {displayName(user)}</Link>
                <button onClick={() => { setOpen(false); handleLogout(); }} className="px-3 py-2 text-left text-sm text-danger-500 hover:bg-white/10 rounded-md">🚪 Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-white/85 hover:bg-white/10 rounded-md">Login</Link>
                <Link to="/register" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-white/85 hover:bg-white/10 rounded-md">Register</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
