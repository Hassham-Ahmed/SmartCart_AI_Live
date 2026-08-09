// SmartCart AI JavaScript

// SmartCart AI

let cart = JSON.parse(localStorage.getItem("cart")) || [];

function updateCartCount() {

    let cartCount = document.getElementById("cart-count");

    if(cartCount){

        cartCount.innerText = cart.length;

    }

}

updateCartCount();