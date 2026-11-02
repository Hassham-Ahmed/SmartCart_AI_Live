import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  // Remember where the user was going so Login can send them back.
  return isLoggedIn ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
