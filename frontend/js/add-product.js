async function addProduct() {
    const product = {
        name: document.getElementById("name").value.trim(),
        brand: document.getElementById("brand").value.trim(),
        category: document.getElementById("category").value.trim(),
        price: document.getElementById("price").value,
        stock: document.getElementById("stock").value,
        image: document.getElementById("image").value.trim(),
        description: document.getElementById("description").value.trim()
    };

    if (!product.name || !product.price) {
        Swal.fire({
            title: "Missing Fields",
            text: "Please enter product name and price.",
            icon: "warning"
        });
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/api/products/add-product", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(product)
        });

        const result = await response.json();

        if (response.ok) {
            Swal.fire({
                title: "Added!",
                text: result.message || "Product added successfully.",
                icon: "success",
                timer: 1800,
                showConfirmButton: false
            }).then(() => {
                window.location.href = "admin.html";
            });
        } else {
            Swal.fire("Failed", result.message || "Could not add product.", "error");
        }
    } catch (error) {
        Swal.fire("Error", "Server error while adding product.", "error");
        console.error(error);
    }
}