document.getElementById("loginBtn").addEventListener("click", async function (e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        Swal.fire({
            icon: 'warning',
            title: 'Fields Required',
            text: 'Please enter both email and password.',
            confirmColor: '#0d6efd'
        });
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save User Data & Navbar States
            localStorage.setItem("user", JSON.stringify(data.user));
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("userName", data.user?.name || data.user?.username || email.split('@')[0]);

            // SweetAlert Success
            Swal.fire({
                icon: 'success',
                title: 'Login Successful!',
                text: 'Welcome back!',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                window.location.href = "profile.html";
            });

        } else {
            // SweetAlert Error
            Swal.fire({
                icon: 'error',
                title: 'Login Failed',
                text: data.message || 'Invalid Credentials!',
                confirmColor: '#dc3545'
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Server Error',
            text: 'Backend server connect nahi ho pa raha.',
            confirmColor: '#dc3545'
        });
    }
});