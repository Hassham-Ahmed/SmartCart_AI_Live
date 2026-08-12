document.getElementById("registerBtn").addEventListener("click", async function () {
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm_password").value;

    if (password !== confirmPassword) {
        Swal.fire({
            title: "Password Mismatch",
            text: "Passwords do not match!",
            icon: "error"
        });
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

        if (response.ok) {
            Swal.fire({
                title: "Registration Successful!",
                text: result.message,
                icon: "success",
                timer: 1800,
                showConfirmButton: false
            }).then(() => {
                window.location.href = "login.html";
            });
        } else {
            Swal.fire("Failed", result.message || "Registration failed.", "error");
        }
    } catch (error) {
        Swal.fire({
            title: "Server Error",
            text: "Unable to connect to server.",
            icon: "error"
        });
        console.error(error);
    }
});