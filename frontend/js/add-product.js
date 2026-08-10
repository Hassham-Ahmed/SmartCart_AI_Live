async function addProduct(){

    const product={

        name:document.getElementById("name").value,

        brand:document.getElementById("brand").value,

        category:document.getElementById("category").value,

        price:document.getElementById("price").value,

        stock:document.getElementById("stock").value,

        image:document.getElementById("image").value,

        description:document.getElementById("description").value

    };

    const response=await fetch(
        "http://127.0.0.1:5000/api/products/add-product",
        {

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify(product)

        }
    );

    const result=await response.json();

    alert(result.message);

    window.location.href="admin.html";

}