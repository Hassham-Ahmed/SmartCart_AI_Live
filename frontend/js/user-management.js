async function loadUsers(){

    const response = await fetch(

        "http://127.0.0.1:5000/api/auth/admin/users"

    );

    const users = await response.json();

    let html = "";

    users.forEach(user=>{

        html += `

        <tr>

            <td>${user.id}</td>

            <td>${user.full_name}</td>

            <td>${user.email}</td>

            <td>${user.phone}</td>

            <td>${user.city}</td>

            <td>

${

user.role=="admin"

?

`<span class="badge bg-success">

👑 Administrator

</span>`

:

`<button

class="btn btn-warning btn-sm"

onclick="toggleStatus(${user.id},'${user.status}')">

${

user.status=="Blocked"

?

"✅ Unblock"

:

"🚫 Block"

}

</button>`

}

</td>

        </tr>

        `;

    });

    document.getElementById("users-table").innerHTML = html;

}

loadUsers();

async function deleteUser(id){

    if(!confirm("Delete this user?")){

        return;

    }

    const response = await fetch(

        `http://127.0.0.1:5000/api/auth/delete-user/${id}`,

        {

            method:"DELETE"

        }

    );

    const result = await response.json();

    console.log(result.message);

    loadUsers();

}

async function toggleStatus(id, currentStatus){

    const response = await fetch(

        `http://127.0.0.1:5000/api/auth/toggle-status/${id}`,

        {
            method:"PUT"
        }

    );

    const result = await response.json();

    alert(result.message);

    loadUsers();

}