// SmartCart AI JavaScript

let cart = JSON.parse(localStorage.getItem("cart")) || [];

function updateCartCount() {

    let cartCount = document.getElementById("cart-count");

    if (cartCount) {
        cartCount.innerText = cart.length;
    }

}

updateCartCount();
// ================= PRODUCTS =================

async function loadProducts() {

    const response = await fetch("http://127.0.0.1:5000/api/products/");

    const products = await response.json();

    let html = "";

    products.forEach(product => {

        html += `

        <div class="col-lg-3 col-md-6 mb-4">

            <div class="card shadow-sm h-100">

                <img src="${product.image}"
                     class="card-img-top"
                     style="height:250px; object-fit:cover;">

                <div class="card-body">

                    <h5 class="card-title">
                        ${product.name}
                    </h5>

                    <p class="text-primary fw-bold">
                        PKR ${product.price}
                    </p>

                    <button
                        class="btn btn-primary w-100"
                        onclick="addToCart(${product.id})">
                        Add to Cart
                    </button>

                </div>

            </div>

        </div>

        `;

    });

    document.getElementById("productsContainer").innerHTML = html;

}

loadProducts();
updateCartCount();
async function addToCart(productId) {

    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
        alert("Please login first!");
        window.location.href = "login.html";
        return;
    }

    const response = await fetch("http://127.0.0.1:5000/api/products/add-to-cart", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({

            user_id: user.id,
            product_id: productId,
            quantity: 1

        })

    });

    const data = await response.json();

    alert(data.message);
    updateCartCount();

}
async function updateCartCount() {

    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {

        document.getElementById("cart-count").innerText = 0;
        return;

    }

    const response = await fetch(
        `http://127.0.0.1:5000/api/products/cart-count/${user.id}`
    );

    const data = await response.json();

    document.getElementById("cart-count").innerText = data.count;

}