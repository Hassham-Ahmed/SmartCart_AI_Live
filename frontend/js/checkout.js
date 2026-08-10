
async function placeOrder() {

    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {

        alert("Please Login First");

        window.location.href = "login.html";

        return;
    }

    const shipping_address =
        document.getElementById("address").value;

    const payment_method = "Cash on Delivery";

    if (shipping_address.trim() === "") {

        alert("Please Enter Shipping Address");

        return;
    }

    const response = await fetch(

        "http://127.0.0.1:5000/api/products/place-order",

        {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                user_id: user.id,

                shipping_address,

                payment_method

            })

        }

    );

    const result = await response.json();

    alert(result.message);

    window.location.href = "order-success.html";

}