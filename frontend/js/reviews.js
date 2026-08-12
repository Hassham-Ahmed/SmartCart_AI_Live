const params = new URLSearchParams(window.location.search);
const productId = params.get("id");
const user = JSON.parse(localStorage.getItem("user"));


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

    try {
        const response = await fetch(
            "http://127.0.0.1:5000/api/products/add-review",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    user_id: user.id,
                    product_id: productId,
                    rating: document.getElementById("rating").value,
                    review: document.getElementById("review").value
                })
            }
        );

        const result = await response.json();

        Swal.fire({
            title: "Success!",
            text: result.message || "Review submitted successfully.",
            icon: "success",
            timer: 1800,
            showConfirmButton: false
        });

        document.getElementById("review").value = "";
        document.getElementById("rating").value = 5;

        loadRating();
        loadReviews();

    } catch (error) {
        Swal.fire({
            title: "Error",
            text: "Unable to submit review. Please try again.",
            icon: "error"
        });
        console.error(error);
    }
}


// ---------------- LOAD REVIEWS ----------------

async function loadReviews() {

    try {
        const response = await fetch(
            `http://127.0.0.1:5000/api/products/reviews/${productId}`
        );

        const reviews = await response.json();

        let html = "";

        reviews.forEach(review => {
            html += `
            <div class="card p-3 mb-3">
                <h5>${review.full_name}</h5>
                <p>${"⭐".repeat(review.rating)}</p>
                <p>${review.review}</p>
                <small class="text-muted">
                    ${new Date(review.created_at).toLocaleDateString()}
                </small>
            </div>
            `;
        });

        document.getElementById("reviewsContainer").innerHTML = html;

    } catch (error) {
        console.error("Error loading reviews:", error);
    }
}


// ---------------- AVERAGE RATING ----------------

async function loadRating() {

    try {
        const response = await fetch(
            `http://127.0.0.1:5000/api/products/rating/${productId}`
        );

        const rating = await response.json();

        document.getElementById("average-rating").innerHTML = rating.average_rating;
        document.getElementById("total-reviews").innerHTML = rating.total_reviews;

    } catch (error) {
        console.error("Error loading rating:", error);
    }
}


loadReviews();
loadRating();