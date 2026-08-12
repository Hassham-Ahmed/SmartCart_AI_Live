async function sendMessage() {
    const fullName = document.getElementById("full-name").value.trim();
    const email = document.getElementById("email").value.trim();
    const subject = document.getElementById("subject").value.trim();
    const message = document.getElementById("message").value.trim();

    // Basic Input Validation
    if (!fullName || !email || !subject || !message) {
        Swal.fire({
            title: "Required Fields",
            text: "Please fill in all the fields before sending.",
            icon: "warning"
        });
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/api/auth/contact", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                full_name: fullName,
                email: email,
                subject: subject,
                message: message
            })
        });

        const result = await response.json();

        if (response.ok) {
            Swal.fire({
                title: "Message Sent!",
                text: result.message || "Thank you for contacting us.",
                icon: "success",
                timer: 2000,
                showConfirmButton: false
            });

            // Form Reset
            document.getElementById("full-name").value = "";
            document.getElementById("email").value = "";
            document.getElementById("subject").value = "";
            document.getElementById("message").value = "";
        } else {
            Swal.fire({
                title: "Failed!",
                text: result.message || "Could not send message.",
                icon: "error"
            });
        }
    } catch (error) {
        Swal.fire({
            title: "Error",
            text: "Something went wrong. Please check your connection.",
            icon: "error"
        });
        console.error("Error sending message:", error);
    }
}