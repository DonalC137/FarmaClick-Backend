import re
with open('frontend/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

bad_func = re.compile(r'async function cargarUsuariosAdmin\(\) \{.*?\n\s*\}', re.DOTALL)

good_func = '''async function cargarUsuariosAdmin() {
            try {
                const res = await fetch(\/api/admin/usuarios);
                const data = await res.json();
                if (data.exito) {
                    const tbody = document.getElementById("adminUsersTable");
                    tbody.innerHTML = "";
                    const rolesMap = { 1: {n:"ADMIN", c:"admin"}, 2: {n:"CLIENTE", c:"cliente"}, 3: {n:"FARMACIA", c:"farmacia"}, 4: {n:"REPARTIDOR", c:"repartidor"} };
                    data.usuarios.forEach(u => {
                        const rolInfo = rolesMap[u.ID_ROL] || {n:"OTRO", c:"admin"};
                        const tr = document.createElement("tr");
                        tr.innerHTML = <td>#\</td><td><strong>\ \</strong></td><td>\</td><td><span class="role-tag \">\</span></td><td><span style="color:var(--success);font-weight:600;">● ACTIVO</span></td>;
                        tbody.appendChild(tr);
                    });
                }
            } catch (e) {
                console.error("Error al cargar usuarios:", e);
            }
        }'''

html = bad_func.sub(good_func, html)

# also fix alert: alert(¡USUARIO REGISTRADO EXITOSAMENTE! (ID: )); cargarUsuariosAdmin();
html = re.sub(r'alert\(¡USUARIO REGISTRADO EXITOSAMENTE! \(ID: \)\);', 'alert(¡USUARIO REGISTRADO EXITOSAMENTE! (ID: ));', html)

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
