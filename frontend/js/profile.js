console.log("Profile JS Loaded");

const user = JSON.parse(localStorage.getItem("user"));

console.log(user);

if (!user) {

    alert("Please login first!");

    window.location.href = "login.html";

}