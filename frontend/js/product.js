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

    // Safe User ID extraction
    const userId = user.id || user._id || user.user_id;

    try {
        const response = await fetch("http://127.0.0.1:5000/api/products/add-to-cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: userId,
                product_id: productId,
                quantity: 1
            })
        });

        const data = await response.json();

        if (response.ok) {
            Swal.fire({
                toast: true,
                position: "top-end",
                icon: "success",
                title: data.message || "Added to Cart!",
                showConfirmButton: false,
                timer: 1500
            });

            // Cart Count ko await ke saath refresh karein
            if (typeof updateCartCount === "function") {
                await updateCartCount();
            }
        } else {
            Swal.fire("Error", data.message || "Could not add to cart.", "error");
        }
    } catch (error) {
        console.error("Add to cart error:", error);
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

    const userId = user.id || user._id || user.user_id;

    try {
        const response = await fetch("http://127.0.0.1:5000/api/products/add-to-wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: userId,
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