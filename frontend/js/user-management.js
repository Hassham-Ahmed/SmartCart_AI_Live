// ---------------- 1. LOAD USERS ----------------
async function loadUsers() {
    try {
        const response = await fetch("http://127.0.0.1:5000/api/auth/admin/users");
        
        if (!response.ok) {
            throw new Error(`HTTP status ${response.status}`);
        }

        const users = await response.json();

        if (!Array.isArray(users) || users.length === 0) {
            document.getElementById("users-table").innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        No users found in database.
                    </td>
                </tr>`;
            return;
        }

        let html = "";
        users.forEach(user => {
            const isBlocked = user.status === "Blocked";
            const isAdmin = user.role === "admin";
            
            html += `
            <tr>
                <td>${user.id}</td>
                <td class="fw-semibold">
                    ${user.full_name || 'N/A'}
                    ${isAdmin ? '<span class="badge bg-primary-subtle text-primary border border-primary-subtle ms-2">Admin</span>' : ''}
                </td>
                <td>${user.email || 'N/A'}</td>
                <td>${user.phone || 'N/A'}</td>
                <td>${user.city || 'N/A'}</td>
                <td class="text-center">
                    ${isAdmin ? `
                        <span class="badge bg-secondary py-2 px-3 fw-semibold fs-6">
                            <i class="fa-solid fa-user-shield me-1"></i> Administrator
                        </span>
                    ` : `
                        <button class="btn ${isBlocked ? 'btn-success' : 'btn-danger'} btn-sm px-3 fw-semibold" 
                                onclick="toggleUserStatus(${user.id}, '${user.status}')">
                            ${isBlocked ? '<i class="fa-solid fa-user-check me-1"></i> Unblock' : '<i class="fa-solid fa-user-slash me-1"></i> Block'}
                        </button>
                        <button class="btn btn-outline-danger btn-sm ms-1" onclick="deleteUser(${user.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    `}
                </td>
            </tr>
            `;
        });

        document.getElementById("users-table").innerHTML = html;
    } catch (error) {
        console.error("Error loading users:", error);
        document.getElementById("users-table").innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger py-4">
                    <i class="fa-solid fa-circle-exclamation me-2"></i> Failed to load users.
                </td>
            </tr>`;
    }
}

loadUsers();

// ---------------- 2. TOGGLE BLOCK / UNBLOCK ----------------
async function toggleUserStatus(id, currentStatus) {
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
        cancelButtonText: "Cancel"
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/auth/toggle-status/${id}`, {
                    method: "PUT"
                });

                const resData = await response.json();

                if (response.ok) {
                    Swal.fire({
                        toast: true,
                        position: "top-end",
                        icon: "success",
                        title: resData.message || "User status updated!",
                        showConfirmButton: false,
                        timer: 2000
                    });
                    loadUsers();
                } else {
                    Swal.fire("Action Failed", resData.message || "Could not update status.", "error");
                }
            } catch (error) {
                Swal.fire("Error", "Server error occurred.", "error");
            }
        }
    });
}

// ---------------- 3. DELETE USER ----------------
async function deleteUser(id) {
    Swal.fire({
        title: "Delete User Account?",
        text: "This action cannot be undone!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Yes, delete!",
        cancelButtonText: "Cancel"
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/auth/delete-user/${id}`, {
                    method: "DELETE"
                });

                const resData = await response.json();

                if (response.ok) {
                    Swal.fire({
                        toast: true,
                        position: "top-end",
                        icon: "success",
                        title: resData.message || "User deleted.",
                        showConfirmButton: false,
                        timer: 1800
                    });
                    loadUsers();
                } else {
                    Swal.fire("Error", resData.message || "Could not delete user.", "error");
                }
            } catch (error) {
                Swal.fire("Error", "Server error while deleting user.", "error");
            }
        }
    });
}