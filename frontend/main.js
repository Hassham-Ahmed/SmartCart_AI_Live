function updateNavbar() {
    console.log("updateNavbar called");
    const user = localStorage.getItem("user");

    const authButtons = document.getElementById("auth-buttons");
    const userButtons = document.getElementById("user-buttons");

    if (user) {
        if (authButtons) {
            authButtons.classList.remove("d-flex");
            authButtons.classList.add("d-none");
        }
        if (userButtons) {
            userButtons.classList.remove("d-none");
            userButtons.classList.add("d-flex");
        }
    } else {
        if (authButtons) {
            authButtons.classList.remove("d-none");
            authButtons.classList.add("d-flex");
        }
        if (userButtons) {
            userButtons.classList.remove("d-flex");
            userButtons.classList.add("d-none");
        }
    }
}

function logoutUser() {
    Swal.fire({
        title: "Are you sure?",
        text: "You will be logged out of your session!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, logout!"
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear();
            window.location.href = "login.html";
        }
    });
}

async function updateCartCount() {
    // Both ID checks
    const badge = document.getElementById("cartCount") || document.getElementById("cart-count");

    if (!badge) return;

    const rawUser = localStorage.getItem("user");

    if (!rawUser) {
        badge.innerText = "0";
        return;
    }

    let user;
    try {
        user = JSON.parse(rawUser);
    } catch (e) {
        console.error("User parsing error:", e);
        badge.innerText = "0";
        return;
    }

    // Safe ID extraction
    const userId = user ? (user.id || user._id || user.user_id) : null;

    if (!userId) {
        badge.innerText = "0";
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/products/cart-count/${userId}`);
        
        if (!response.ok) {
            badge.innerText = "0";
            return;
        }

        const data = await response.json();
        badge.innerText = data.count !== undefined ? data.count : 0;
    } catch (error) {
        console.error("Error updating cart count:", error);
        badge.innerText = "0";
    }
}

// Automatically trigger cart count on page load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateCartCount);
} else {
    updateCartCount();
}