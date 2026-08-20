import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { authApi } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", city: "", address: "" });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const loadProfile = useCallback(() => {
    if (!user) return;
    authApi.getProfile(user.id).then(({ ok, data }) => {
      if (ok) {
        setProfile(data);
        setForm({
          full_name: data.full_name || "",
          email: data.email || "",
          phone: data.phone || "",
          city: data.city || "",
          address: data.address || "",
        });
      }
    });
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const updatePassword = (field) => (e) => setPasswordForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSaveProfile = async () => {
    setSaving(true);
    const { data } = await authApi.updateProfile({ id: user.id, ...form });
    setSaving(false);
    Swal.fire({ title: "Updated!", text: data.message || "Profile updated successfully.", icon: "success" });
    loadProfile();
  };

  const handleChangePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      Swal.fire({ title: "Mismatch!", text: "New Password and Confirm Password do not match.", icon: "error" });
      return;
    }

    setChangingPassword(true);
    const { ok, data } = await authApi.changePassword({
      id: user.id,
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
    });
    setChangingPassword(false);

    Swal.fire({ title: ok ? "Success!" : "Failed!", text: data.message, icon: ok ? "success" : "error" });
    setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <div className="card p-6 text-center">
            <img
              src="https://via.placeholder.com/150"
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border-2 border-primary-500 mx-auto mb-4"
            />
            <h4 className="font-bold text-lg mb-1">{profile?.full_name || "Loading..."}</h4>
            <p className="text-gray-400 text-sm mb-4">{profile?.email || "loading@example.com"}</p>

            <div className="flex flex-col gap-2">
              <Link to="/wishlist" className="btn-outline-primary">❤️ Wishlist</Link>
              <Link to="/order-history" className="btn-outline-success">📦 My Orders</Link>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="card p-6">
            <h4 className="text-lg font-bold text-primary-600 mb-1">Personal Information</h4>
            <hr className="mb-4" />
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Full Name</label>
                <input type="text" value={form.full_name} onChange={update("full_name")} className="form-input" />
              </div>
              <div>
                <label className="form-label">Email Address</label>
                <input type="email" value={form.email} onChange={update("email")} className="form-input" />
              </div>
              <div>
                <label className="form-label">Phone Number</label>
                <input type="text" value={form.phone} onChange={update("phone")} className="form-input" />
              </div>
              <div>
                <label className="form-label">City</label>
                <input type="text" value={form.city} onChange={update("city")} className="form-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Shipping Address</label>
                <textarea value={form.address} onChange={update("address")} rows={3} className="form-input" />
              </div>
            </div>
            <div className="text-right mt-4">
              <button onClick={handleSaveProfile} disabled={saving} className="btn-success px-5">
                💾 {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          <div className="card p-6">
            <h5 className="text-lg font-bold text-danger-500 mb-1">Change Password</h5>
            <hr className="mb-4" />
            <div className="grid gap-4">
              <div>
                <label className="form-label">Current Password</label>
                <input type="password" value={passwordForm.current_password} onChange={updatePassword("current_password")} className="form-input" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">New Password</label>
                  <input type="password" value={passwordForm.new_password} onChange={updatePassword("new_password")} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Confirm New Password</label>
                  <input type="password" value={passwordForm.confirm_password} onChange={updatePassword("confirm_password")} className="form-input" />
                </div>
              </div>
            </div>
            <div className="text-right mt-4">
              <button onClick={handleChangePassword} disabled={changingPassword} className="btn-danger px-5">
                🔑 {changingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
