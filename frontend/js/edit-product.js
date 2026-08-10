const params = new URLSearchParams(window.location.search);

const productId = params.get("id");

// ---------------- LOAD PRODUCT ----------------

async function loadProduct() {

    const response = await fetch(
        `http://127.0.0.1:5000/api/products/${productId}`
    );

    const product = await response.json();

    document.getElementById("name").value = product.name;
    document.getElementById("brand").value = product.brand;
    document.getElementById("category").value = product.category;
    document.getElementById("price").value = product.price;
    document.getElementById("stock").value = product.stock;
    document.getElementById("image").value = product.image;
    document.getElementById("description").value = product.description;

}

loadProduct();


// ---------------- UPDATE PRODUCT ----------------

async function updateProduct() {

    const product = {

        name: document.getElementById("name").value,

        brand: document.getElementById("brand").value,

        category: document.getElementById("category").value,

        price: document.getElementById("price").value,

        stock: document.getElementById("stock").value,

        image: document.getElementById("image").value,

        description: document.getElementById("description").value

    };

    const response = await fetch(

        `http://127.0.0.1:5000/api/products/update-product/${productId}`,

        {

            method: "PUT",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify(product)

        }

    );

    const result = await response.json();

    alert(result.message);

    window.location.href = "admin.html";

}