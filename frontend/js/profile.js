const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
    Swal.fire({
        title: "Access Denied",
        text: "Please login first.",
        icon: "warning"
    }).then(() => {
        window.location.href = "login.html";
    });
}

async function loadProfile() {
    if (!user) return;

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/auth/profile/${user.id}`);
        const profile = await response.json();

        document.getElementById("profile-name").innerHTML = profile.full_name;
        document.getElementById("profile-email").innerHTML = profile.email;

        document.getElementById("full-name").value = profile.full_name;
        document.getElementById("email").value = profile.email;
        document.getElementById("phone").value = profile.phone || "";
        document.getElementById("city").value = profile.city || "";
        document.getElementById("address").value = profile.address || "";
    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

loadProfile();

async function updateProfile() {
    try {
        const response = await fetch("http://127.0.0.1:5000/api/auth/update-profile", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: user.id,
                full_name: document.getElementById("full-name").value,
                email: document.getElementById("email").value,
                phone: document.getElementById("phone").value,
                city: document.getElementById("city").value,
                address: document.getElementById("address").value
            })
        });

        const result = await response.json();

        Swal.fire({
            title: "Updated!",
            text: result.message || "Profile updated successfully.",
            icon: "success"
        });

        loadProfile();
    } catch (error) {
        Swal.fire("Error", "Failed to update profile.", "error");
    }
}

async function changePassword() {
    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (newPassword !== confirmPassword) {
        Swal.fire({
            title: "Mismatch!",
            text: "New Password and Confirm Password do not match.",
            icon: "error"
        });
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/api/auth/change-password", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: user.id,
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        const result = await response.json();

        Swal.fire({
            title: response.ok ? "Success!" : "Failed!",
            text: result.message,
            icon: response.ok ? "success" : "error"
        });

        document.getElementById("current-password").value = "";
        document.getElementById("new-password").value = "";
        document.getElementById("confirm-password").value = "";
    } catch (error) {
        Swal.fire("Error", "Could not change password.", "error");
    }
}