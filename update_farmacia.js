const fs = require('fs');

try {
    let content = fs.readFileSync('frontend/index.html', 'utf8');

    // 1. Replace HTML stat card
    content = content.replace(
        `<div><h3 style="font-size:1rem;font-weight:700;color:var(--text);margin:0 0 2px;">Farmacia Central</h3><p style="font-size:0.8rem;color:var(--text-muted);">ID Sucursal: 1</p></div>`,
        `<div><h3 id="farmaciaNombreDisplay" style="font-size:1rem;font-weight:700;color:var(--text);margin:0 0 2px;">Farmacia Central</h3><p id="farmaciaIdDisplay" style="font-size:0.8rem;color:var(--text-muted);">ID Sucursal: 1</p></div>`
    );

    // 2. Replace aplicarExperienciaPorRol section
    content = content.replace(
        `document.getElementById("heroTitle").innerText = "Panel de Farmacia Central 🏪";`,
        `document.getElementById("heroTitle").innerText = \`Panel de \${user.NOMBRE} 🏪\`;\n                const fId = (user.CORREO === 'farmacia@farmaclick.com') ? 1 : user.ID_USUARIO;\n                document.getElementById("farmaciaNombreDisplay").innerText = user.NOMBRE;\n                document.getElementById("farmaciaIdDisplay").innerText = "ID Sucursal: " + fId;`
    );

    // 3. Replace cargarDatosFarmacia
    const oldCargar = `async function cargarDatosFarmacia() {
            try {
                const res = await fetch(\`\${BACKEND_URL}/api/cliente/productos\`);
                const data = await res.json();
                if (data.exito && data.productos) {
                    document.getElementById("farmaciaStatTotal").innerText = data.productos.length;
                    document.getElementById("farmaciaStatStock").innerText = data.productos.reduce((a,c)=>a+(c.STOCK||0),0);
                    const tbody = document.getElementById("farmaciaInventoryTable");
                    tbody.innerHTML = "";
                    data.productos.forEach(p => {
                        const tr = document.createElement("tr");
                        tr.innerHTML = \`<td>#\${p.ID_PRODUCTO}</td><td><strong>\${p.PRODUCTO}</strong><br><small style="color:var(--text-dim);">\${p.DESCRIPCION||''}</small></td>
                            <td><span style="background:var(--bg-3);color:var(--text-muted);padding:3px 8px;border-radius:6px;font-size:0.78rem;border:1px solid var(--border);">\${p.CATEGORIA}</span></td>
                            <td><strong style="color:var(--text);">Q \${parseFloat(p.PRECIO).toFixed(2)}</strong></td>
                            <td><span style="font-weight:700;color:\${p.STOCK>5?'var(--success)':'var(--accent)'};">\${p.STOCK} unid.</span></td>
                            <td><span style="color:var(--success);font-weight:600;font-size:0.8rem;">● DISPONIBLE</span></td>\`;
                        tbody.appendChild(tr);
                    });
                }
            } catch(e) {}
        }`;

    const newCargar = `async function cargarDatosFarmacia() {
            try {
                const res = await fetch(\`\${BACKEND_URL}/api/cliente/productos\`);
                const data = await res.json();
                if (data.exito && data.productos) {
                    const fId = (currentUser.CORREO === 'farmacia@farmaclick.com') ? 1 : currentUser.ID_USUARIO;
                    const misProductos = data.productos.filter(p => p.ID_FARMACIA === fId);
                    
                    document.getElementById("farmaciaStatTotal").innerText = misProductos.length;
                    document.getElementById("farmaciaStatStock").innerText = misProductos.reduce((a,c)=>a+(c.STOCK||0),0);
                    const tbody = document.getElementById("farmaciaInventoryTable");
                    tbody.innerHTML = "";
                    if (misProductos.length === 0) {
                        tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:30px;">Aún no tienes medicamentos registrados.</td></tr>\`;
                    } else {
                        misProductos.forEach(p => {
                            const tr = document.createElement("tr");
                            tr.innerHTML = \`<td>#\${p.ID_PRODUCTO}</td><td><strong>\${p.PRODUCTO}</strong><br><small style="color:var(--text-dim);">\${p.DESCRIPCION||''}</small></td>
                                <td><span style="background:var(--bg-3);color:var(--text-muted);padding:3px 8px;border-radius:6px;font-size:0.78rem;border:1px solid var(--border);">\${p.CATEGORIA}</span></td>
                                <td><strong style="color:var(--text);">Q \${parseFloat(p.PRECIO).toFixed(2)}</strong></td>
                                <td><span style="font-weight:700;color:\${p.STOCK>5?'var(--success)':'var(--accent)'};">\${p.STOCK} unid.</span></td>
                                <td><span style="color:var(--success);font-weight:600;font-size:0.8rem;">● DISPONIBLE</span></td>\`;
                            tbody.appendChild(tr);
                        });
                    }
                }
            } catch(e) {}
        }`;

    content = content.replace(oldCargar, newCargar);

    // 4. Replace guardarProductoFarmacia
    const oldGuardar = `async function guardarProductoFarmacia() {
            const nombre = document.getElementById("prodNombre").value.trim();
            const descripcion = document.getElementById("prodDesc").value.trim();
            const precio = parseFloat(document.getElementById("prodPrecio").value);
            const stock = parseInt(document.getElementById("prodStock").value) || 10;
            const categoria = document.getElementById("prodCategoria").value;
            if (!nombre || !precio) { alert("Completa nombre y precio"); return; }
            try {
                const res = await fetch(\`\${BACKEND_URL}/api/farmacia/producto\`, {
                    method:"POST", headers:{"Content-Type":"application/json"},
                    body: JSON.stringify({ idFarmacia:1, nombre, descripcion, precio, stock, categoria })
                });
                const data = await res.json();
                if (res.ok && data.exito) { alert(\`✅ Producto guardado (#\${data.idProducto})\`); toggleModalProducto(false); cargarDatosFarmacia(); }
                else { alert(\`Error: \${data.error}\`); }
            } catch(e) { alert(e.message); }
        }`;

    const newGuardar = `async function guardarProductoFarmacia() {
            const nombre = document.getElementById("prodNombre").value.trim();
            const descripcion = document.getElementById("prodDesc").value.trim();
            const precio = parseFloat(document.getElementById("prodPrecio").value);
            const stock = parseInt(document.getElementById("prodStock").value) || 10;
            const categoria = document.getElementById("prodCategoria").value;
            if (!nombre || !precio) { alert("Completa nombre y precio"); return; }
            const fId = (currentUser.CORREO === 'farmacia@farmaclick.com') ? 1 : currentUser.ID_USUARIO;
            try {
                const res = await fetch(\`\${BACKEND_URL}/api/farmacia/producto\`, {
                    method:"POST", headers:{"Content-Type":"application/json"},
                    body: JSON.stringify({ idFarmacia: fId, nombre, descripcion, precio, stock, categoria })
                });
                const data = await res.json();
                if (res.ok && data.exito) { alert(\`✅ Producto guardado (#\${data.idProducto})\`); toggleModalProducto(false); cargarDatosFarmacia(); }
                else { alert(\`Error: \${data.error}\`); }
            } catch(e) { alert(e.message); }
        }`;

    content = content.replace(oldGuardar, newGuardar);

    fs.writeFileSync('frontend/index.html', content, 'utf8');
    console.log("Exito!");
} catch (e) {
    console.error("Error:", e);
}
