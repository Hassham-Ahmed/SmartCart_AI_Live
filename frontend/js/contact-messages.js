// ---------------- LOAD CONTACT MESSAGES ----------------

async function loadMessages() {
    try {
        const response = await fetch("http://127.0.0.1:5000/api/auth/contact-messages");
        const messages = await response.json();

        let html = "";
        messages.forEach(message => {
            html += `
            <tr>
                <td>${message.id}</td>
                <td>${message.full_name}</td>
                <td>${message.email}</td>
                <td>${message.subject}</td>
                <td>${message.message}</td>
                <td>${new Date(message.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteMessage(${message.id})">
                        Delete
                    </button>
                </td>
            </tr>
            `;
        });

        document.getElementById("messages-table").innerHTML = html;
    } catch (error) {
        console.error("Error loading messages:", error);
    }
}

loadMessages();

// ---------------- DELETE MESSAGE ----------------

async function deleteMessage(id) {
    Swal.fire({
        title: "Delete Message?",
        text: "Are you sure you want to delete this message?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, delete it!"
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/auth/delete-message/${id}`, {
                    method: "DELETE"
                });

                const resData = await response.json();

                Swal.fire({
                    toast: true,
                    position: "top-end",
                    icon: "success",
                    title: resData.message || "Message deleted.",
                    showConfirmButton: false,
                    timer: 1500
                });

                loadMessages();
            } catch (error) {
                Swal.fire("Error", "Could not delete message.", "error");
            }
        }
    });
}