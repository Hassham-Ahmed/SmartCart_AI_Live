import { Link, Outlet, useLocation } from "react-router-dom";

export default function AdminLayout() {
  const location = useLocation();
  const isDashboard = location.pathname === "/admin";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-primary-900 shadow-md sticky top-0 z-40">
        <div className="max-w-full px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2 text-white font-bold text-lg">
            <i className="fa-solid fa-shield-halved text-primary-400" />
            SmartCart AI
            <span className="badge bg-primary-500 text-white font-normal">Admin</span>
          </Link>
          <div className="flex items-center gap-2">
            {!isDashboard && (
              <Link to="/admin" className="btn-outline-light text-sm">
                <i className="fa-solid fa-arrow-left mr-1" /> Dashboard
              </Link>
            )}
            <Link to="/" className="btn-outline-light text-sm">
              <i className="fa-solid fa-store mr-1" /> View Store
            </Link>
          </div>
        </div>
      </nav>
      <div className="p-4 sm:p-6">
        <Outlet />
      </div>
    </div>
  );
}
