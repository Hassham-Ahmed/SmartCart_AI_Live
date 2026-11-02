import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { authApi, getToken } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config";
import useDocumentTitle from "../hooks/useDocumentTitle";

const AVATAR_FALLBACK =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#d6e6ff"/><circle cx="64" cy="50" r="22" fill="#4a8bff"/><path d="M24 112c6-22 22-32 40-32s34 10 40 32" fill="#4a8bff"/></svg>');

export default function Profile() {
  useDocumentTitle("My Profile");
  const { user, login } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", city: "", address: "" });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Profile Picture States
  const [imagePreview, setImagePreview] = useState(AVATAR_FALLBACK);
  const [selectedFile, setSelectedFile] = useState(null);

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
        // BUGFIX: the API returns `profile_image` (not `image`), and the old code hard-coded localhost:5000
        if (data.profile_image) {
          setImagePreview(data.profile_image.startsWith("http") ? data.profile_image : `${API_BASE_URL}/${data.profile_image}`);
        }
      }
    });
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const updatePassword = (field) => (e) => setPasswordForm((f) => ({ ...f, [field]: e.target.value }));

  // Image Selection Handler
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    // BUGFIX: a FormData object was being JSON.stringify'd ("{}") whenever a photo was picked,
    // so profile edits were silently lost. Fields now go as JSON; the photo uploads separately.
    const { ok, data } = await authApi.updateProfile(form);
    let photoMsg = "";
    if (ok && selectedFile) {
      const up = await authApi.uploadProfileImage(selectedFile);
      photoMsg = up.ok ? "" : ` (photo: ${up.data.message || "upload failed"})`;
      setSelectedFile(null);
    }
    setSaving(false);
    if (ok) {
      login({ ...user, full_name: form.full_name, email: form.email }, getToken());
    }
    Swal.fire({
      title: ok ? "Updated!" : "Failed",
      text: (data.message || (ok ? "Profile updated successfully." : "Could not update profile.")) + photoMsg,
      icon: ok ? "success" : "error",
    });
    loadProfile();
  };

  const handleChangePassword = async () => {
    if (passwordForm.new_password.length < 6) {
      Swal.fire({ title: "Too short", text: "New password must be at least 6 characters.", icon: "warning" });
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      Swal.fire({ title: "Mismatch!", text: "New Password and Confirm Password do not match.", icon: "error" });
      return;
    }

    setChangingPassword(true);
    const { ok, data } = await authApi.changePassword({
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
            
            {/* Profile Avatar & Upload Button Wrapper */}
            <div className="relative w-32 h-32 mx-auto mb-4 group">
              <img
                src={imagePreview}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover border-4 border-primary-500 shadow-md"
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = AVATAR_FALLBACK; }}
              />
              <label
                htmlFor="profile-upload"
                aria-label="Change profile photo"
                className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity cursor-pointer"
              >
                <span className="text-xl mb-1" aria-hidden="true">📷</span>
                <span className="text-xs font-semibold">Change</span>
              </label>
              <input 
                id="profile-upload" 
                type="file" 
                accept="image/*" 
                onChange={handleImageChange} 
                className="sr-only" 
              />
            </div>

            <h4 className="font-bold text-lg mb-1">{profile?.full_name || "Loading..."}</h4>
            <p className="text-gray-400 text-sm mb-4">{profile?.email || ""}</p>

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
                <label htmlFor="profile-full-name" className="form-label">Full Name</label>
                <input id="profile-full-name" type="text" value={form.full_name} onChange={update("full_name")} className="form-input" />
              </div>
              <div>
                <label htmlFor="profile-email-address" className="form-label">Email Address</label>
                <input id="profile-email-address" type="email" value={form.email} onChange={update("email")} className="form-input" />
              </div>
              <div>
                <label htmlFor="profile-phone-number" className="form-label">Phone Number</label>
                <input id="profile-phone-number" type="text" value={form.phone} onChange={update("phone")} className="form-input" />
              </div>
              <div>
                <label htmlFor="profile-city" className="form-label">City</label>
                <input id="profile-city" type="text" value={form.city} onChange={update("city")} className="form-input" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="profile-shipping-address" className="form-label">Shipping Address</label>
                <textarea id="profile-shipping-address" value={form.address} onChange={update("address")} rows={3} className="form-input" />
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
                <label htmlFor="profile-current-password" className="form-label">Current Password</label>
                <input id="profile-current-password" type="password" value={passwordForm.current_password} onChange={updatePassword("current_password")} className="form-input" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="profile-new-password" className="form-label">New Password</label>
                  <input id="profile-new-password" type="password" value={passwordForm.new_password} onChange={updatePassword("new_password")} className="form-input" />
                </div>
                <div>
                  <label htmlFor="profile-confirm-new-password" className="form-label">Confirm New Password</label>
                  <input id="profile-confirm-new-password" type="password" value={passwordForm.confirm_password} onChange={updatePassword("confirm_password")} className="form-input" />
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