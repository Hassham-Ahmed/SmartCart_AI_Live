import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { authApi } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      Swal.fire({ icon: "warning", title: "Fields Required", text: "Please enter both email and password." });
      return;
    }

    setSubmitting(true);
    const { ok, data } = await authApi.login({ email: email.trim(), password: password.trim() });
    setSubmitting(false);

    if (ok) {
      login(data.user);
      Swal.fire({ icon: "success", title: "Login Successful!", text: "Welcome back!", timer: 1500, showConfirmButton: false })
        .then(() => navigate("/profile"));
    } else {
      Swal.fire({ icon: "error", title: "Login Failed", text: data.message || "Invalid Credentials!" });
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card p-8">
        <h2 className="text-center text-2xl font-bold text-primary-600 mb-6">🔐 Login</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="form-label">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" placeholder="Enter your email" required />
          </div>

          <div className="mb-4">
            <label className="form-label">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" placeholder="Enter password" required />
          </div>

          <div className="flex items-center justify-between mb-4 text-sm">
            <label className="flex items-center gap-2 text-gray-600">
              <input type="checkbox" /> Remember Me
            </label>
            <a href="#" className="text-primary-600 hover:underline">Forgot Password?</a>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>

        <hr className="my-5" />

        <p className="text-center text-sm text-gray-500">
          Don't have an account? <Link to="/register" className="font-bold text-primary-600 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
