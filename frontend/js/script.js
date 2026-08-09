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
                        class="btn btn-primary w-100">
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