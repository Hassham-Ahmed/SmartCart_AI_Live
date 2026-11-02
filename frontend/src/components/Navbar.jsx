import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
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
  const { user, isLoggedIn, isAdmin, logout } = useAuth();
  const { cartCount } = useCart();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Depth + blur once the page scrolls (passive listener, state flips only at the threshold)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const handleLogout = () => {
    Swal.fire({
      title: "Log out?",
      text: "You will be signed out of your account.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#0d6efd",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, log out",
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

  const cartLabel = `Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`;

  return (
    <nav className={`nav-depth sticky top-0 z-50 bg-primary-900 ${scrolled ? "is-scrolled" : ""}`} aria-label="Main">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary-300 shrink-0">
            <span aria-hidden="true">🛒</span> SmartCart AI
          </Link>

          <div className="hidden xl:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass} end={link.to === "/"}>
                {link.label}
              </NavLink>
            ))}
            <NavLink
              to="/ai-chat"
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-bold rounded-md transition-colors text-warning-500 ${isActive ? "bg-white/10" : "hover:bg-white/10"}`
              }
            >
              🤖 AI Assistant
            </NavLink>
          </div>

          <div className="hidden xl:flex items-center gap-2">
            {isAdmin && <Link to="/admin" className="btn-outline-light text-sm">🛡 Admin</Link>}
            <Link to="/wishlist" className="btn-outline-light text-sm">
              <span aria-hidden="true">❤️</span> <span className="ml-1">Wishlist</span>
            </Link>
            <Link to="/cart" className="btn-outline-light text-sm relative" aria-label={cartLabel}>
              <span aria-hidden="true">🛒</span> <span className="ml-1">Cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-danger-500 text-white text-xs rounded-full min-w-5 h-5 px-1 flex items-center justify-center" aria-hidden="true">
                  {cartCount}
                </span>
              )}
            </Link>

            {isLoggedIn ? (
              <>
                <Link to="/profile" className="btn-primary text-sm">👤 {displayName(user)}</Link>
                <button type="button" onClick={handleLogout} className="btn-danger text-sm">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-primary btn-3d text-sm">Login</Link>
                <Link to="/register" className="btn-outline-light text-sm">Register</Link>
              </>
            )}
          </div>

          <div className="xl:hidden flex items-center gap-1">
            <Link to="/cart" className="relative text-white p-2" aria-label={cartLabel}>
              <span aria-hidden="true" className="text-xl">🛒</span>
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-danger-500 text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center" aria-hidden="true">{cartCount}</span>
              )}
            </Link>
            <button
              type="button"
              className="text-white text-2xl w-11 h-11 flex items-center justify-center rounded-md hover:bg-white/10"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              <span aria-hidden="true">{open ? "×" : "☰"}</span>
            </button>
          </div>
        </div>

        {open && (
          <div id="mobile-menu" className="xl:hidden pb-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} className={linkClass} end={link.to === "/"}>
                {link.label}
              </NavLink>
            ))}
            <NavLink to="/ai-chat" className="px-3 py-2 text-sm font-bold text-warning-500 rounded-md hover:bg-white/10">
              🤖 AI Assistant
            </NavLink>
            {isAdmin && <Link to="/admin" className="px-3 py-2 text-sm text-white/85 hover:bg-white/10 rounded-md">🛡 Admin</Link>}
            <Link to="/wishlist" className="px-3 py-2 text-sm text-white/85 hover:bg-white/10 rounded-md">❤️ Wishlist</Link>
            <Link to="/cart" className="px-3 py-2 text-sm text-white/85 hover:bg-white/10 rounded-md">🛒 Cart ({cartCount})</Link>
            {isLoggedIn ? (
              <>
                <Link to="/profile" className="px-3 py-2 text-sm text-white/85 hover:bg-white/10 rounded-md">👤 {displayName(user)}</Link>
                <button type="button" onClick={handleLogout} className="px-3 py-2 text-left text-sm text-red-300 hover:bg-white/10 rounded-md">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="px-3 py-2 text-sm text-white/85 hover:bg-white/10 rounded-md">Login</Link>
                <Link to="/register" className="px-3 py-2 text-sm text-white/85 hover:bg-white/10 rounded-md">Register</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
