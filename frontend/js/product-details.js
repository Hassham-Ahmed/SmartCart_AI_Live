const params = new URLSearchParams(window.location.search);
const productId = params.get("id");
const user = JSON.parse(localStorage.getItem("user"));

// Quantity adjustment
function increaseQty() {
    const qtyInput = document.getElementById("quantity");
    qtyInput.value = parseInt(qtyInput.value) + 1;
}

function decreaseQty() {
    const qtyInput = document.getElementById("quantity");
    if (parseInt(qtyInput.value) > 1) {
        qtyInput.value = parseInt(qtyInput.value) - 1;
    }
}

// ---------------- LOAD PRODUCT DETAILS ----------------

async function loadProductDetails() {
    if (!productId) {
        Swal.fire("Error", "No product selected!", "error");
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/products/${productId}`);
        const product = await response.json();

        if (response.ok && product) {
            document.getElementById("product-name").innerText = product.name || "Product Name";
            document.getElementById("product-price").innerText = `PKR ${product.price || 0}`;
            document.getElementById("product-category").innerText = product.category || "General";
            document.getElementById("product-description").innerText = product.description || "No description available.";
            
            // Image fallback logic for Picsum
            const productImage = document.getElementById("product-image");
            if (product.image) {
                productImage.src = product.image;
            } else {
                productImage.src = `https://picsum.photos/450/450?random=${productId}`;
            }

            const stockElem = document.getElementById("product-stock");
            if (product.stock > 0 || product.stock === undefined) {
                stockElem.innerText = "In Stock";
                stockElem.className = "badge bg-success";
            } else {
                stockElem.innerText = "Out of Stock";
                stockElem.className = "badge bg-danger";
            }
        }
    } catch (error) {
        console.error("Error loading product details:", error);
    }
}

// ---------------- ADD TO CART ----------------

async function addToCartDetails() {
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

    const qty = parseInt(document.getElementById("quantity").value) || 1;

    try {
        const response = await fetch("http://127.0.0.1:5000/api/products/add-to-cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: user.id,
                product_id: parseInt(productId),
                quantity: qty
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
            if (typeof updateCartCount === "function") updateCartCount();
        } else {
            Swal.fire("Failed", data.message || "Could not add to cart.", "error");
        }
    } catch (error) {
        Swal.fire("Error", "Could not connect to server.", "error");
    }
}

// ---------------- BUY NOW ----------------

async function buyNowDetails() {
    if (!user) {
        Swal.fire({
            title: "Login Required",
            text: "Please login first to buy!",
            icon: "warning"
        }).then(() => {
            window.location.href = "login.html";
        });
        return;
    }

    await addToCartDetails();
    window.location.href = "checkout.html";
}

// ---------------- ADD TO WISHLIST ----------------

async function addToWishlistDetails() {
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
                product_id: parseInt(productId)
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

// ---------------- SUBMIT REVIEW ----------------

async function submitReview() {
    if (!user) {
        Swal.fire({
            title: "Login Required",
            text: "Please login first to submit a review.",
            icon: "warning"
        }).then(() => {
            window.location.href = "login.html";
        });
        return;
    }

    const reviewText = document.getElementById("review").value.trim();
    if (!reviewText) {
        Swal.fire("Required", "Please write a review before submitting.", "warning");
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/api/products/add-review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: user.id,
                product_id: parseInt(productId),
                rating: document.getElementById("rating").value,
                review: reviewText
            })
        });

        const result = await response.json();

        Swal.fire({
            title: "Thank You!",
            text: result.message || "Review submitted successfully.",
            icon: "success",
            timer: 1500,
            showConfirmButton: false
        });

        document.getElementById("review").value = "";
        document.getElementById("rating").value = 5;

        loadRating();
        loadReviews();
    } catch (error) {
        Swal.fire("Error", "Could not submit review.", "error");
    }
}

// ---------------- LOAD REVIEWS ----------------

async function loadReviews() {
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/products/reviews/${productId}`);
        const reviews = await response.json();

        let html = "";
        if (reviews.length === 0) {
            html = "<p class='text-muted'>No reviews yet. Be the first to write a review!</p>";
        } else {
            reviews.forEach(review => {
                html += `
                <div class="card p-3 mb-3 shadow-sm">
                    <h5>${review.full_name || 'Anonymous'}</h5>
                    <p class="text-warning mb-1">${"⭐".repeat(review.rating)}</p>
                    <p class="mb-1">${review.review}</p>
                    <small class="text-muted">${new Date(review.created_at).toLocaleDateString()}</small>
                </div>
                `;
            });
        }

        document.getElementById("reviewsContainer").innerHTML = html;
    } catch (error) {
        console.error("Error loading reviews:", error);
    }
}

// ---------------- LOAD RATING ----------------

async function loadRating() {
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/products/rating/${productId}`);
        const rating = await response.json();

        const avg = rating.average_rating || 0;
        const total = rating.total_reviews || 0;

        document.getElementById("average-rating").innerText = avg;
        document.getElementById("reviews-avg-rating").innerText = avg;
        document.getElementById("total-reviews").innerText = total;
    } catch (error) {
        console.error("Error loading rating:", error);
    }
}

// Init calls
loadProductDetails();
loadReviews();
loadRating();