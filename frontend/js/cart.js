const user = JSON.parse(localStorage.getItem("user"));

if (!user) {
    alert("Please login first!");
    window.location.href = "login.html";
}

async function loadCart() {

    const response = await fetch(
        `http://127.0.0.1:5000/api/products/cart/${user.id}`
    );

    const cart = await response.json();

    let html = "";
    let total = 0;

    cart.forEach(item => {

        total += item.price * item.quantity;

        html += `
        <tr>

            <td>${item.name}</td>

            <td>
                <img src="${item.image}"
                     width="80"
                     class="rounded">
            </td>

            <td>Rs. ${item.price}</td>

            <td>

                <button
                    class="btn btn-sm btn-danger"
                    onclick="decreaseQuantity(${item.id})">

                    -

                </button>

                <span class="mx-2">
                    ${item.quantity}
                </span>

                <button
                    class="btn btn-sm btn-success"
                    onclick="increaseQuantity(${item.id})">

                    +

                </button>

            </td>

            <td>Rs. ${item.price * item.quantity}</td>

            <td>
                <button
                    class="btn btn-danger"
                    onclick="removeItem(${item.id})">

                    Remove

                </button>
            </td>

        </tr>
        `;

    });

    document.getElementById("cartItems").innerHTML = html;
    document.getElementById("cartTotal").innerText = total;

}

loadCart();

// ---------------- INCREASE QUANTITY ----------------

async function increaseQuantity(cartId) {

    await fetch(
        `http://127.0.0.1:5000/api/products/increase/${cartId}`,
        {
            method: "PUT"
        }
    );

    loadCart();
}


// ---------------- DECREASE QUANTITY ----------------

async function decreaseQuantity(cartId) {

    await fetch(
        `http://127.0.0.1:5000/api/products/decrease/${cartId}`,
        {
            method: "PUT"
        }
    );

    loadCart();
}


// ---------------- REMOVE ITEM ----------------

async function removeItem(cartId) {

    await fetch(
        `http://127.0.0.1:5000/api/products/remove/${cartId}`,
        {
            method: "DELETE"
        }
    );

    loadCart();
}