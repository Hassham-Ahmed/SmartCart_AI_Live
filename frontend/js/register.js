document.getElementById("registerBtn").addEventListener("click", async function () {

    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm_password").value;

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    const user = {
        full_name: document.getElementById("full_name").value,
        email: document.getElementById("email").value,
        password: password,
        phone: document.getElementById("phone").value,
        city: document.getElementById("city").value
    };

    try {

        const response = await fetch("http://127.0.0.1:5000/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(user)
        });

        const result = await response.json();

        alert(result.message);

        if (response.ok) {
            window.location.href = "login.html";
        }

    } catch (error) {
        alert("Unable to connect to server.");
        console.error(error);
    }

});