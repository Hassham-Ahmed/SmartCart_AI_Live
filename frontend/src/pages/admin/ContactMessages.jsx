import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { authApi } from "../../api/client";

export default function ContactMessages() {
  const [messages, setMessages] = useState([]);

  const loadMessages = useCallback(() => {
    authApi.getContactMessages().then(({ ok, data }) => ok && setMessages(data));
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleDelete = (id) => {
    Swal.fire({
      title: "Delete Message?",
      text: "Are you sure you want to delete this message?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#0d6efd",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        const { data } = await authApi.deleteMessage(id);
        Swal.fire({ toast: true, position: "top-end", icon: "success", title: data.message || "Message deleted.", showConfirmButton: false, timer: 1500 });
        loadMessages();
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h3 className="text-xl font-bold mb-1">📬 Inquiry Messages</h3>
          <p className="text-gray-500 text-sm">Read and review customer messages submitted through Contact Us.</p>
        </div>
        <button onClick={loadMessages} className="btn-outline-primary text-sm">
          <i className="fa-solid fa-rotate mr-1" /> Refresh
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Sender</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">Message</th>
                <th className="text-left px-4 py-3">Received</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {messages.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No messages yet.</td></tr>
              ) : (
                messages.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">{m.id}</td>
                    <td className="px-4 py-3 font-medium">{m.full_name}</td>
                    <td className="px-4 py-3">{m.email}</td>
                    <td className="px-4 py-3">{m.subject}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{m.message}</td>
                    <td className="px-4 py-3">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleDelete(m.id)} className="btn-danger text-xs px-3 py-1.5">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
