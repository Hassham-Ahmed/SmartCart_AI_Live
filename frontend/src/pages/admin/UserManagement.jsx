import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { authApi } from "../../api/client";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadUsers = useCallback(() => {
    setLoading(true);
    authApi.getUsers().then(({ ok, data }) => {
      if (ok && Array.isArray(data)) {
        setUsers(data);
        setError(false);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleStatus = (id, currentStatus) => {
    const isBlocked = currentStatus === "Blocked";
    const actionText = isBlocked ? "Unblock" : "Block";

    Swal.fire({
      title: `${actionText} User?`,
      text: `Are you sure you want to ${actionText.toLowerCase()} this user?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: isBlocked ? "#198754" : "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: `Yes, ${actionText}!`,
    }).then(async (result) => {
      if (result.isConfirmed) {
        const { ok, data } = await authApi.toggleStatus(id);
        if (ok) {
          Swal.fire({ toast: true, position: "top-end", icon: "success", title: data.message || "User status updated!", showConfirmButton: false, timer: 2000 });
          loadUsers();
        } else {
          Swal.fire("Action Failed", data.message || "Could not update status.", "error");
        }
      }
    });
  };

  const handleDelete = (id) => {
    Swal.fire({
      title: "Delete User Account?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Yes, delete!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        const { ok, data } = await authApi.deleteUser(id);
        if (ok) {
          Swal.fire({ toast: true, position: "top-end", icon: "success", title: data.message || "User deleted.", showConfirmButton: false, timer: 1800 });
          loadUsers();
        } else {
          Swal.fire("Error", data.message || "Could not delete user.", "error");
        }
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h3 className="text-xl font-bold mb-1">👥 User Accounts</h3>
          <p className="text-gray-500 text-sm">Manage registered customer accounts and profiles.</p>
        </div>
        <button onClick={loadUsers} className="btn-outline-primary text-sm">
          <i className="fa-solid fa-rotate mr-1" /> Refresh
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Full Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">City</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading users...</td></tr>
              ) : error ? (
                <tr><td colSpan={6} className="text-center py-8 text-danger-500"><i className="fa-solid fa-circle-exclamation mr-2" />Failed to load users.</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No users found in database.</td></tr>
              ) : (
                users.map((u) => {
                  const isBlocked = u.status === "Blocked";
                  const isAdmin = u.role === "admin";
                  return (
                    <tr key={u.id}>
                      <td className="px-4 py-3">{u.id}</td>
                      <td className="px-4 py-3 font-semibold">
                        {u.full_name || "N/A"}
                        {isAdmin && <span className="badge bg-primary-50 text-primary-600 border border-primary-200 ml-2">Admin</span>}
                      </td>
                      <td className="px-4 py-3">{u.email || "N/A"}</td>
                      <td className="px-4 py-3">{u.phone || "N/A"}</td>
                      <td className="px-4 py-3">{u.city || "N/A"}</td>
                      <td className="px-4 py-3 text-center">
                        {isAdmin ? (
                          <span className="badge bg-gray-100 text-gray-600">
                            <i className="fa-solid fa-user-shield mr-1" /> Administrator
                          </span>
                        ) : (
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => handleToggleStatus(u.id, u.status)}
                              className={`text-xs px-3 py-1.5 rounded-full font-semibold text-white ${isBlocked ? "bg-success-500 hover:bg-success-600" : "bg-danger-500 hover:bg-danger-600"}`}
                            >
                              {isBlocked ? <><i className="fa-solid fa-user-check mr-1" />Unblock</> : <><i className="fa-solid fa-user-slash mr-1" />Block</>}
                            </button>
                            <button onClick={() => handleDelete(u.id)} className="btn-outline-danger text-xs px-3 py-1.5">
                              <i className="fa-solid fa-trash" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
