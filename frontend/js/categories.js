async function loadCategories(){

    const response = await fetch(
        "http://127.0.0.1:5000/api/products/categories"
    );

    const categories = await response.json();

    let html = "";

    categories.forEach(category=>{

        html += `

        <div class="col-lg-3 col-md-4 col-sm-6 mb-4">

            <div class="card shadow h-100 text-center">

                <img

                    src="https://picsum.photos/300/200?random=${category.category}"

                    class="card-img-top"

                    style="height:200px; object-fit:cover;">

                <div class="card-body">

                    <h5>

                        ${category.category}

                    </h5>

                    <p class="text-muted">

                        ${category.total} Products

                    </p>

                    <a

                        href="products.html?category=${encodeURIComponent(category.category)}"

                        class="btn btn-primary">

                        View Products

                    </a>

                </div>

            </div>

        </div>

        `;

    });

    document.getElementById("categoriesContainer").innerHTML = html;

}

loadCategories();