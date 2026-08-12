// Logout Function
function logoutUser() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userName");
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

// Navbar Generator Function
function loadNavbar() {
    const navbarContainer = document.getElementById("navbar-container");
    if (!navbarContainer) return;

    // Check Login State
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
    let displayName = "Profile";

    if (isLoggedIn) {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                if (parsedUser.name && !parsedUser.name.includes("@")) {
                    displayName = parsedUser.name.split(" ")[0];
                } else if (parsedUser.username && !parsedUser.username.includes("@")) {
                    displayName = parsedUser.username.split(" ")[0];
                } else {
                    displayName = "Profile";
                }
            } catch (e) {
                const storedName = localStorage.getItem("userName");
                if (storedName && !storedName.includes("@")) {
                    displayName = storedName.split(" ")[0];
                } else {
                    displayName = "Profile";
                }
            }
        } else {
            const storedName = localStorage.getItem("userName");
            if (storedName && !storedName.includes("@")) {
                displayName = storedName.split(" ")[0];
            } else {
                displayName = "Profile";
            }
        }
    }

    // Dynamic Auth Buttons HTML
    let authButtonsHtml = "";
    if (isLoggedIn) {
        authButtonsHtml = `
            <a href="profile.html" class="btn btn-primary btn-sm px-2 px-lg-3 fw-medium text-nowrap">👤 ${displayName}</a>
            <button class="btn btn-danger btn-sm px-2 px-lg-3 fw-bold text-nowrap" onclick="logoutUser()">🚪 Logout</button>
        `;
    } else {
        authButtonsHtml = `
            <a href="login.html" class="btn btn-primary btn-sm px-2 px-lg-3 fw-bold text-nowrap">Login</a>
            <a href="register.html" class="btn btn-outline-light btn-sm px-2 px-lg-3 fw-bold text-nowrap">Register</a>
        `;
    }

    navbarContainer.innerHTML = `
    <nav class="navbar navbar-expand-xl navbar-dark bg-dark sticky-top shadow-sm py-2">
        <div class="container-fluid px-4">
            <a class="navbar-brand fw-bold text-primary fs-4 me-3" href="index.html">🛒 SmartCart AI</a>
            
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav me-auto mb-2 mb-lg-0 gap-1">
                    <li class="nav-item"><a class="nav-link text-white fs-6" href="index.html">Home</a></li>
                    <li class="nav-item"><a class="nav-link text-white fs-6" href="products.html">Products</a></li>
                    <li class="nav-item"><a class="nav-link text-white fs-6" href="categories.html">Categories</a></li>
                    <li class="nav-item"><a class="nav-link text-white fs-6" href="about.html">About Us</a></li>
                    <li class="nav-item"><a class="nav-link text-white fs-6" href="contact.html">Contact Us</a></li>
                    <li class="nav-item"><a class="nav-link text-warning fw-bold fs-6" href="ai-chat.html">🤖 AI Assistant</a></li>
                </ul>
                
                <div class="d-flex align-items-center gap-2 flex-nowrap ms-auto mt-2 mt-xl-0">
                    <a href="wishlist.html" class="btn btn-outline-light btn-sm px-2 px-lg-3 text-nowrap" title="Wishlist">
                        ❤️ <span class="ms-1">Wishlist</span>
                    </a>

                    <a href="cart.html" class="btn btn-outline-light btn-sm px-2 px-lg-3 position-relative text-nowrap me-1">
                        🛒 <span class="ms-1">Cart</span>
                        <span id="cartCount" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">0</span>
                    </a>

                    ${authButtonsHtml}
                </div>
            </div>
        </div>
    </nav>
    `;

    // Ensure cart count runs after navbar HTML is inserted into DOM
    setTimeout(() => {
        if (typeof updateCartCount === "function") {
            updateCartCount();
        }
    }, 100);
}

// Footer Generator Function
function loadFooter() {
    const footerContainer = document.getElementById("footer-container");
    if (!footerContainer) return;

    footerContainer.innerHTML = `
    <footer class="bg-dark text-white pt-5 pb-4 mt-5 border-top border-secondary">
        <div class="container text-center text-md-start">
            <div class="row">
                <div class="col-md-3 col-lg-3 col-xl-3 mx-auto mt-3">
                    <h5 class="text-uppercase mb-4 fw-bold text-primary">🛒 SmartCart AI</h5>
                    <p class="text-secondary small">
                        Next-generation AI-powered e-commerce platform offering personalized shopping experiences and real-time assistance.
                    </p>
                </div>
                <div class="col-md-2 col-lg-2 col-xl-2 mx-auto mt-3">
                    <h5 class="text-uppercase mb-4 fw-bold text-white fs-6">Quick Links</h5>
                    <p><a href="index.html" class="text-secondary text-decoration-none">Home</a></p>
                    <p><a href="products.html" class="text-secondary text-decoration-none">Products</a></p>
                    <p><a href="categories.html" class="text-secondary text-decoration-none">Categories</a></p>
                    <p><a href="about.html" class="text-secondary text-decoration-none">About Us</a></p>
                </div>
                <div class="col-md-3 col-lg-2 col-xl-2 mx-auto mt-3">
                    <h5 class="text-uppercase mb-4 fw-bold text-white fs-6">Support</h5>
                    <p><a href="contact.html" class="text-secondary text-decoration-none">Contact Us</a></p>
                    <p><a href="ai-chat.html" class="text-secondary text-decoration-none">AI Assistant</a></p>
                    <p><a href="cart.html" class="text-secondary text-decoration-none">My Cart</a></p>
                </div>
                <div class="col-md-4 col-lg-3 col-xl-3 mx-auto mt-3">
                    <h5 class="text-uppercase mb-4 fw-bold text-white fs-6">Contact</h5>
                    <p class="text-secondary small mb-2">📍 Karachi, Pakistan</p>
                    <p class="text-secondary small mb-2">📧 support@smartcartai.com</p>
                    <p class="text-secondary small">📞 +92-300-1234567</p>
                </div>
            </div>
            <hr class="mb-4 text-secondary">
            <div class="row align-items-center">
                <div class="col-md-7 col-lg-8">
                    <p class="text-secondary mb-0 small">© 2026 <strong>SmartCart AI</strong>. All Rights Reserved.</p>
                </div>
            </div>
        </div>
    </footer>
    `;
}

// Safe Execution On Load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        loadNavbar();
        loadFooter();
    });
} else {
    loadNavbar();
    loadFooter();
}