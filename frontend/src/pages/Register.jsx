import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { authApi } from "../api/client";

export default function Register() {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", confirm_password: "", city: "" });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

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
      Swal.fire("Failed", data.message || "Registration failed.", "error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="card p-8">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-primary-600 mb-1">🚀 Create Your Account</h3>
          <p className="text-gray-400 text-sm">Join SmartCart AI for personalized shopping</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="form-label">Full Name</label>
            <input type="text" value={form.full_name} onChange={update("full_name")} className="form-input" placeholder="e.g. Hassham Ahmed" required />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label">Email Address</label>
              <input type="email" value={form.email} onChange={update("email")} className="form-input" placeholder="name@example.com" required />
            </div>
            <div>
              <label className="form-label">Phone Number</label>
              <input type="text" value={form.phone} onChange={update("phone")} className="form-input" placeholder="0300-1234567" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label">Password</label>
              <input type="password" value={form.password} onChange={update("password")} className="form-input" placeholder="••••••••" required />
            </div>
            <div>
              <label className="form-label">Confirm Password</label>
              <input type="password" value={form.confirm_password} onChange={update("confirm_password")} className="form-input" placeholder="••••••••" required />
            </div>
          </div>

          <div className="mb-6">
            <label className="form-label">City</label>
            <input type="text" value={form.city} onChange={update("city")} className="form-input" placeholder="Enter your city" />
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
