async function loadDashboard() {

    const response = await fetch(
        "http://127.0.0.1:5000/api/products/admin/dashboard"
    );

    const data = await response.json();

    document.getElementById("total-users").innerText =
        data.users;

    document.getElementById("total-products").innerText =
        data.products;

    document.getElementById("total-orders").innerText =
        data.orders;

    document.getElementById("total-revenue").innerText =
        "Rs." + Number(data.revenue).toLocaleString();

}

loadDashboard();

async function loadProducts(){

    const response=await fetch(

        "http://127.0.0.1:5000/api/products/"

    );

    const products=await response.json();

    let html="";

    products.forEach(product=>{

        html+=`

        <tr>

            <td>${product.id}</td>

            <td>${product.name}</td>

            <td>${product.category}</td>

            <td>Rs.${product.price}</td>

            <td>${product.stock}</td>

            <td>

                <button
                    class="btn btn-warning btn-sm"
                    onclick="window.location.href='edit-product.html?id=${product.id}'">

                    ✏ Edit

                </button>

            </td>

            <td>

                <button

                    class="btn btn-danger btn-sm"

                    onclick="deleteProduct(${product.id})">

                    🗑 Delete

                </button>

            </td>

        </tr>

        `;

    });

    document.getElementById("products-table").innerHTML=html;

}

loadProducts();

async function deleteProduct(id){

    if(!confirm("Delete this product?")){

        return;

    }

    const response=await fetch(

        `http://127.0.0.1:5000/api/products/delete-product/${id}`,

        {

            method:"DELETE"

        }

    );

    const result=await response.json();

    alert(result.message);

    loadProducts();

}