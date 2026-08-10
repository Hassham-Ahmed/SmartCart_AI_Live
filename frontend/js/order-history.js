async function loadOrders() {

    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {

        window.location.href = "login.html";
        return;

    }

    const response = await fetch(
        `http://127.0.0.1:5000/api/products/my-orders/${user.id}`
    );

    const orders = await response.json();

    let html = "";

    orders.forEach(order => {

        html += `

        <tr>

            <td>#${order.id}</td>

            <td>${new Date(order.created_at).toLocaleDateString()}</td>

            <td>Rs.${order.total_amount}</td>

            <td>

                <span class="badge bg-warning">

                    ${order.status}

                </span>

            </td>

            <td>${order.payment_method}</td>

        </tr>

        `;

    });

    document.getElementById("orders-body").innerHTML = html;

}

loadOrders();