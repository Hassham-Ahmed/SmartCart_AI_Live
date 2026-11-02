import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { authApi } from "../api/client";
import useDocumentTitle from "../hooks/useDocumentTitle";

export default function Register() {
  useDocumentTitle("Create Account");
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", confirm_password: "", city: "" });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password.length < 6) {
      Swal.fire({ title: "Weak Password", text: "Password must be at least 6 characters.", icon: "warning" });
      return;
    }
    if (form.password !== form.confirm_password) {
      Swal.fire({ title: "Password Mismatch", text: "Passwords do not match!", icon: "error" });
      return;
    }

    setSubmitting(true);
    const { ok, data } = await authApi.register({
      full_name: form.full_name,
      email: form.email,
      password: form.password,
      phone: form.phone,
      city: form.city,
    });
    setSubmitting(false);

    if (ok) {
      Swal.fire({ title: "Registration Successful!", text: data.message, icon: "success", timer: 1800, showConfirmButton: false })
        .then(() => navigate("/login"));
    } else {
      Swal.fire("Registration failed", data.message || "Please check your details and try again.", "error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="card p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-primary-600 mb-1">🚀 Create Your Account</h1>
          <p className="text-gray-400 text-sm">Join SmartCart AI for personalized shopping</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="register-full-name" className="form-label">Full Name</label>
            <input id="register-full-name" type="text" value={form.full_name} onChange={update("full_name")} className="form-input" placeholder="e.g. Hassham Ahmed" required />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="register-email-address" className="form-label">Email Address</label>
              <input id="register-email-address" type="email" value={form.email} onChange={update("email")} className="form-input" placeholder="name@example.com" required />
            </div>
            <div>
              <label htmlFor="register-phone-number" className="form-label">Phone Number</label>
              <input id="register-phone-number" type="text" value={form.phone} onChange={update("phone")} className="form-input" placeholder="0300-1234567" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="register-password" className="form-label">Password</label>
              <input id="register-password" type="password" autoComplete="new-password" minLength={6} value={form.password} onChange={update("password")} className="form-input" placeholder="••••••••" required />
            </div>
            <div>
              <label htmlFor="register-confirm-password" className="form-label">Confirm Password</label>
              <input id="register-confirm-password" type="password" autoComplete="new-password" value={form.confirm_password} onChange={update("confirm_password")} className="form-input" placeholder="••••••••" required />
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="register-city" className="form-label">City</label>
            <input id="register-city" type="text" value={form.city} onChange={update("city")} className="form-input" placeholder="Enter your city" />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
            {submitting ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <hr className="my-5" />

        <p className="text-center text-sm text-gray-500">
          Already have an account? <Link to="/login" className="font-bold text-primary-600 hover:underline">Login here</Link>
        </p>
      </div>
    </div>
  );
}
