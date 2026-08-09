const buttons = document.querySelectorAll(".add-cart");

buttons.forEach((button)=>{

    button.addEventListener("click",function(){

        const product={

            name:"Gaming Laptop",

            price:185000

        };

        let cart=JSON.parse(localStorage.getItem("cart")) || [];

        cart.push(product);

        localStorage.setItem("cart",JSON.stringify(cart));

        alert("Product Added Successfully!");

        location.reload();

    });

});