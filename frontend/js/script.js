let cart = JSON.parse(localStorage.getItem("cart")) || [];

async function loadProducts() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");
    const search = params.get("search");

    let url = "http://127.0.0.1:5000/api/products/?";
    if (category) url += `category=${encodeURIComponent(category)}&`;
    if (search) url += `search=${encodeURIComponent(search)}`;

    try {
        const response = await fetch(url);
        const products = await response.json();

        let html = "";
        products.forEach(product => {
            html += `
            <div class="col-lg-3 col-md-6 mb-4">
                <div class="card shadow-sm h-100">
                    <img src="${product.image}" class="card-img-top" style="height:250px; object-fit:cover;">
                    <div class="card-body">
                        <h5 class="card-title">${product.name}</h5>
                        <p class="text-primary fw-bold">PKR ${product.price}</p>
                        <a href="product-details.html?id=${product.id}" class="btn btn-outline-dark w-100 mb-2">View Details</a>
                        <div class="d-flex gap-2">
                            <button class="btn btn-primary flex-fill" onclick="addToCart(${product.id})">Add to Cart</button>
                            <button class="btn btn-outline-danger" onclick="addToWishlist(${product.id})">❤️</button>
                        </div>
                    </div>
                </div>
            </div>
            `;
        });

        document.getElementById("productsContainer").innerHTML = html;
    } catch (error) {
        console.error("Error loading products:", error);
    }
}

loadProducts();

async function addToCart(productId) {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
        Swal.fire({
            title: "Login Required",
            text: "Please login first to add items to cart!",
            icon: "warning"
        }).then(() => {
            window.location.href = "login.html";
        });
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/api/products/add-to-cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: user.id,
                product_id: productId,
                quantity: 1
            })
        });

        const data = await response.json();

        Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",
            title: data.message || "Added to Cart!",
            showConfirmButton: false,
            timer: 1500
        });

        if (typeof updateCartCount === "function") updateCartCount();
    } catch (error) {
        Swal.fire("Error", "Could not add to cart.", "error");
    }
}

async function addToWishlist(productId) {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
        Swal.fire({
            title: "Login Required",
            text: "Please login first.",
            icon: "warning"
        }).then(() => {
            window.location.href = "login.html";
        });
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/api/products/add-to-wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: user.id,
                product_id: productId
            })
        });

        const result = await response.json();

        Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",
            title: result.message || "Added to Wishlist!",
            showConfirmButton: false,
            timer: 1500
        });
    } catch (error) {
        Swal.fire("Error", "Could not add to wishlist.", "error");
    }
}

function searchProducts() {
    const keyword = document.getElementById("searchInput").value.trim();
    if (keyword === "") {
        window.location.href = "products.html";
        return;
    }
    window.location.href = `products.html?search=${encodeURIComponent(keyword)}`;
}

function handleSearch(event) {
    if (event.key === "Enter") {
        searchProducts();
    }
}

async function loadTopReviews() {
    const container = document.getElementById("reviews-container");
    if (!container) return;

    try {
        const response = await fetch("http://127.0.0.1:5000/api/products/reviews/top");
        
        if (!response.ok) {
            throw new Error(`HTTP status ${response.status}`);
        }

        const reviews = await response.json();

        if (!Array.isArray(reviews) || reviews.length === 0) {
            container.innerHTML = `
                <div class="carousel-item active text-center text-muted py-5">
                    <p class="fs-5">Database mein koi 5-star review nahi mila.</p>
                </div>`;
            return;
        }

        let html = "";
        reviews.forEach((item, index) => {
            // Stars HTML Generation
            const starsHtml = `
                <i class="fa-solid fa-star text-warning"></i>
                <i class="fa-solid fa-star text-warning"></i>
                <i class="fa-solid fa-star text-warning"></i>
                <i class="fa-solid fa-star text-warning"></i>
                <i class="fa-solid fa-star text-warning"></i>
            `;

            html += `
            <div class="carousel-item ${index === 0 ? 'active' : ''}">
                <div class="d-flex justify-content-center py-3">
                    <div class="card border-0 shadow-lg p-4 p-md-5 rounded-4 text-center" style="max-width: 650px; width: 100%; background: #ffffff;">
                        <div class="mb-3 fs-4">
                            ${starsHtml}
                        </div>
                        <p class="text-secondary fs-5 fst-italic mb-4">
                            "${item.review}"
                        </p>
                        <h5 class="fw-bold text-dark mb-1">
                            ${item.full_name || 'Verified Customer'}
                        </h5>
                        <small class="text-success fw-semibold">
                            <i class="fa-solid fa-circle-check me-1"></i> Verified Buyer
                        </small>
                    </div>
                </div>
            </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("Error loading reviews slider:", error);
    }
}

document.addEventListener("DOMContentLoaded", loadTopReviews);

// ---------------- NEWSLETTER SUBSCRIPTION ----------------
const newsletterForm = document.getElementById("newsletter-form");

if (newsletterForm) {
    newsletterForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById("newsletter-email");
        const email = emailInput.value.trim();

        try {
            const response = await fetch("http://127.0.0.1:5000/api/auth/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });

            const resData = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: "success",
                    title: "Subscribed!",
                    text: resData.message,
                    timer: 2000,
                    showConfirmButton: false
                });
                emailInput.value = "";
            } else {
                Swal.fire("Attention", resData.message, "warning");
            }
        } catch (error) {
            console.error("Subscription Error:", error);
            Swal.fire("Error", "Server error. Please try again later.", "error");
        }
    });
}