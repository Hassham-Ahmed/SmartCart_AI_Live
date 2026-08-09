let cart = JSON.parse(localStorage.getItem("cart")) || [];

let cartItems = document.getElementById("cart-items");
let total = 0;

cart.forEach((product) => {

    total += product.price;

    cartItems.innerHTML += `
        <div class="card mb-3 p-3">
            <h4>${product.name}</h4>
            <p>Price: Rs. ${product.price}</p>
        </div>
    `;

});

document.getElementById("cart-total").innerText = total;