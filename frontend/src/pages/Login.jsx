import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { authApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import useDocumentTitle from "../hooks/useDocumentTitle";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useDocumentTitle("Login");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      Swal.fire({ icon: "warning", title: "Fields Required", text: "Please enter both email and password." });
      return;
    }

    setSubmitting(true);
    // Passwords are sent exactly as typed (trimming would silently change them).
    const { ok, data } = await authApi.login({ email: email.trim(), password });
    setSubmitting(false);

    if (ok && data.token) {
      login(data.user, data.token);
      const back = location.state?.from;
      Swal.fire({ icon: "success", title: "Login Successful!", text: "Welcome back!", timer: 1200, showConfirmButton: false })
        .then(() => navigate(data.user.role === "admin" ? "/admin" : back || "/profile", { replace: true }));
    } else {
      Swal.fire({ icon: "error", title: "Login Failed", text: data.message || "Invalid Credentials!" });
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card p-6 sm:p-8">
        <h1 className="text-center text-2xl font-bold text-primary-600 mb-6">🔐 Login</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="login-email" className="form-label">Email Address</label>
            <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" placeholder="Enter your email" required />
          </div>

          <div className="mb-6">
            <label htmlFor="login-password" className="form-label">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" placeholder="Enter password" required />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary btn-3d w-full py-3">
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>

        <hr className="my-5 border-gray-200" />

        <p className="text-center text-sm text-gray-600">
          Don't have an account? <Link to="/register" className="font-bold text-primary-600 hover:underline">Register</Link>
        </p>
        <p className="text-center text-xs text-gray-500 mt-2">
          Forgot your password? <Link to="/contact" className="text-primary-600 hover:underline">Contact support</Link>
        </p>
      </div>
    </div>
  );
}
