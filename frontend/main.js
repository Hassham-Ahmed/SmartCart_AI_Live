function updateNavbar() {

    const user = localStorage.getItem("user");

    const authButtons = document.getElementById("auth-buttons");
    const userButtons = document.getElementById("user-buttons");

    if (user) {

        if (authButtons) {
            authButtons.style.display = "none";
        }

        if (userButtons) {
            userButtons.style.display = "inline-block";
        }

    } else {

        if (authButtons) {
            authButtons.style.display = "inline-block";
        }

        if (userButtons) {
            userButtons.style.display = "none";
        }
    }
}


function logoutUser() {

    localStorage.removeItem("user");

    alert("You have been logged out.");

    window.location.href = "index.html";
}


document.addEventListener("DOMContentLoaded", function () {

    updateNavbar();

});