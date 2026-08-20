import { useState } from "react";
import Swal from "sweetalert2";
import { authApi } from "../api/client";

export default function Contact() {
  const [form, setForm] = useState({ full_name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSend = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      Swal.fire({ title: "Required Fields", text: "Please fill in all the fields before sending.", icon: "warning" });
      return;
    }

    setSending(true);
    const { ok, data } = await authApi.contact({
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
    });
    setSending(false);

    if (ok) {
      Swal.fire({ title: "Message Sent!", text: data.message || "Thank you for contacting us.", icon: "success", timer: 2000, showConfirmButton: false });
      setForm({ full_name: "", email: "", subject: "", message: "" });
    } else {
      Swal.fire({ title: "Failed!", text: data.message || "Could not send message.", icon: "error" });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
        <p className="text-gray-500">Have a question or feedback? We'd love to hear from you.</p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <div className="card p-6 h-full">
            <h3 className="text-xl font-bold mb-4">Send Us a Message</h3>
            <div className="mb-4">
              <label className="form-label">Full Name</label>
              <input type="text" value={form.full_name} onChange={update("full_name")} className="form-input" placeholder="John Doe" />
            </div>
            <div className="mb-4">
              <label className="form-label">Email Address</label>
              <input type="email" value={form.email} onChange={update("email")} className="form-input" placeholder="name@example.com" />
            </div>
            <div className="mb-4">
              <label className="form-label">Subject</label>
              <input type="text" value={form.subject} onChange={update("subject")} className="form-input" placeholder="Order inquiry / Feedback" />
            </div>
            <div className="mb-5">
              <label className="form-label">Message</label>
              <textarea value={form.message} onChange={update("message")} rows={4} className="form-input" placeholder="Type your message here..." />
            </div>
            <button onClick={handleSend} disabled={sending} className="btn-primary w-full py-3">
              {sending ? "Sending..." : "Send Message"}
            </button>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="card p-6 h-full">
            <h3 className="text-xl font-bold mb-3">Get in Touch</h3>
            <hr className="mb-4" />
            <div className="flex flex-col gap-3 text-sm text-gray-600">
              <div>📧 <strong>Email:</strong> support@smartcartai.com</div>
              <div>📞 <strong>Phone:</strong> +92-300-1234567</div>
              <div>📍 <strong>Location:</strong> Karachi, Pakistan</div>
              <div>🕒 <strong>Working Days:</strong> Mon - Sat (9:00 AM - 6:00 PM)</div>
            </div>
            <hr className="my-5" />
            <h5 className="font-bold mb-3">Follow SmartCart AI</h5>
            <div className="flex gap-4 text-gray-500 text-sm">
              <span>📘 Facebook</span>
              <span>📷 Instagram</span>
              <span>💼 LinkedIn</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
