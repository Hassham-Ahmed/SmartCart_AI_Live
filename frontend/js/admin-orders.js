function getStatusClass(status) {
    switch (status) {
        case "Pending":
            return "bg-warning text-dark";
        case "Processing":
            return "bg-primary";
        case "Shipped":
            return "bg-info text-dark";
        case "Delivered":
            return "bg-success";
        case "Cancelled":
            return "bg-danger";
        default:
            return "bg-secondary";
    }
}

async function loadOrders() {
    try {
        const response = await fetch("http://127.0.0.1:5000/api/products/admin/orders");
        const orders = await response.json();

        let html = "";
        orders.forEach(order => {
            html += `
            <tr>
                <td>#${order.id}</td>
                <td>${order.full_name}</td>
                <td>Rs.${order.total_amount}</td>
                <td>${order.payment_method}</td>
                <td>${order.shipping_address}</td>
                <td>
                    <select id="status-${order.id}" class="form-select ${getStatusClass(order.status)}" onchange="updateStatus(${order.id})">
                        <option ${order.status == "Pending" ? "selected" : ""}>Pending</option>
                        <option ${order.status == "Processing" ? "selected" : ""}>Processing</option>
                        <option ${order.status == "Shipped" ? "selected" : ""}>Shipped</option>
                        <option ${order.status == "Delivered" ? "selected" : ""}>Delivered</option>
                        <option ${order.status == "Cancelled" ? "selected" : ""}>Cancelled</option>
                    </select>
                </td>
                <td>${new Date(order.created_at).toLocaleDateString()}</td>
            </tr>
            `;
        });

        document.getElementById("orders-table").innerHTML = html;
    } catch (error) {
        console.error("Error loading orders:", error);
    }
}

loadOrders();

async function updateStatus(orderId) {
    const status = document.getElementById(`status-${orderId}`).value;

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/products/update-order-status/${orderId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status: status })
        });

        const result = await response.json();

        Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",
            title: result.message || "Status updated!",
            showConfirmButton: false,
            timer: 1500
        });

        loadOrders();
    } catch (error) {
        Swal.fire("Error", "Failed to update order status.", "error");
    }
}