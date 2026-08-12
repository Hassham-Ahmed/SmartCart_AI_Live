async function loadDashboard() {
    try {
        const response = await fetch("http://127.0.0.1:5000/api/products/admin/dashboard");
        const data = await response.json();

        document.getElementById("total-users").innerText = data.users || 0;
        document.getElementById("total-products").innerText = data.products || 0;
        document.getElementById("total-orders").innerText = data.orders || 0;
        document.getElementById("total-revenue").innerText = "Rs." + Number(data.revenue || 0).toLocaleString();
    } catch (error) {
        console.error("Error loading dashboard:", error);
    }
}

loadDashboard();

async function loadProducts() {
    try {
        const response = await fetch("http://127.0.0.1:5000/api/products/");
        const products = await response.json();

        let html = "";
        products.forEach(product => {
            html += `
            <tr>
                <td>${product.id}</td>
                <td>${product.name}</td>
                <td>${product.category}</td>
                <td>Rs.${product.price}</td>
                <td>${product.stock}</td>
                <td>
                    <button class="btn btn-warning btn-sm" onclick="window.location.href='edit-product.html?id=${product.id}'">
                        ✏ Edit
                    </button>
                </td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct(${product.id})">
                        🗑 Delete
                    </button>
                </td>
            </tr>
            `;
        });

        document.getElementById("products-table").innerHTML = html;
    } catch (error) {
        console.error("Error loading products:", error);
    }
}

loadProducts();

async function deleteProduct(id) {
    Swal.fire({
        title: "Are you sure?",
        text: "You won't be able to revert this product deletion!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, delete it!"
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/products/delete-product/${id}`, {
                    method: "DELETE"
                });

                const resData = await response.json();

                Swal.fire({
                    toast: true,
                    position: "top-end",
                    icon: "success",
                    title: resData.message || "Product deleted.",
                    showConfirmButton: false,
                    timer: 1500
                });

                loadProducts();
                loadDashboard();
            } catch (error) {
                Swal.fire("Error", "Could not delete product.", "error");
            }
        }
    });
}