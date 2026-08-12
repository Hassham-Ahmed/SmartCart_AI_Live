async function placeOrder() {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
        Swal.fire({
            title: "Login Required",
            text: "Please login first to place an order.",
            icon: "warning"
        }).then(() => {
            window.location.href = "login.html";
        });
        return;
    }

    const shipping_address = document.getElementById("address").value;
    const payment_method = "Cash on Delivery";

    if (shipping_address.trim() === "") {
        Swal.fire({
            title: "Address Required",
            text: "Please enter your shipping address.",
            icon: "warning"
        });
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/api/products/place-order", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_id: user.id,
                shipping_address,
                payment_method
            })
        });

        const result = await response.json();

        Swal.fire({
            title: "Order Placed!",
            text: result.message || "Your order has been placed successfully.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false
        }).then(() => {
            window.location.href = "order-success.html";
        });
    } catch (error) {
        Swal.fire("Error", "Something went wrong while placing order.", "error");
    }
}