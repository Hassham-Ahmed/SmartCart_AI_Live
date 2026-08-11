async function loadWishlist(){

    const user = JSON.parse(localStorage.getItem("user"));

    if(!user){

        window.location.href="login.html";

        return;

    }

    const response = await fetch(

        `http://127.0.0.1:5000/api/products/wishlist/${user.id}`

    );

    const wishlist = await response.json();

    let html = "";

    wishlist.forEach(product=>{

        html += `

        <div class="col-md-3 mb-4">

            <div class="card shadow-sm h-100">

                <img src="${product.image}"

                class="card-img-top"

                style="height:220px;object-fit:cover;">

                <div class="card-body">

                    <h5>${product.name}</h5>

                    <p class="text-primary fw-bold">

                        Rs.${product.price}

                    </p>

                    <button

                        class="btn btn-primary w-100 mb-2"

                        onclick="addToCart(${product.product_id})">

                        Move To Cart

                    </button>

                    <button

                        class="btn btn-danger w-100"

                        onclick="removeWishlist(${product.id})">

                        Remove

                    </button>

                </div>

            </div>

        </div>

        `;

    });

    document.getElementById("wishlistContainer").innerHTML = html;

}

loadWishlist();

async function removeWishlist(id){

    const response = await fetch(

        `http://127.0.0.1:5000/api/products/remove-wishlist/${id}`,

        {
            method:"DELETE"
        }

    );

    const result = await response.json();

    alert(result.message);

    loadWishlist();

}