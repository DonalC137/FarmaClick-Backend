
        const BACKEND_URL = "https://farmaclick-backend.onrender.com";

        let currentUser = null;
        let productosData = [];
        let cart = [];
        let categoriaActual = "TODOS";
        let farmaciaActual = null; // null = todas
        let farmaciasDisponibles = {};
        let gpsPollingInterval = null;
        let riderGpsWatchId = null;

        function quickFill(email, pass) {
            document.getElementById("loginCorreo").value = email;
            document.getElementById("loginPassword").value = pass;
        }

        async function handleLogin(e) {
            e.preventDefault();
            const correo = document.getElementById("loginCorreo").value.trim();
            const password = document.getElementById("loginPassword").value.trim();
            const btn = document.getElementById("btnLoginSubmit");
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verificando...`;
            try {
                const response = await fetch(`${BACKEND_URL}/api/login`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ correo, password })
                });
                const data = await response.json();
                if (response.ok && data.exito && data.usuario) {
                    currentUser = data.usuario;
                    localStorage.setItem("fc_user", JSON.stringify(currentUser));
                    aplicarExperienciaPorRol(currentUser);
                } else {
                    alert(`❌ Acceso denegado: ${data.error || 'Credenciales inválidas'}`);
                }
            } catch (err) {
                alert(`⚠️ Error al conectar: ${err.message}`);
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión`;
            }
        }

        function aplicarExperienciaPorRol(user) {
            document.getElementById("loginScreen").style.display = "none";
            document.getElementById("appContainer").style.display = "block";
            document.getElementById("userNameDisplay").innerText = `${user.NOMBRE} ${user.APELLIDO}`;
            const roleBadge = document.getElementById("userRoleBadge");
            const heroBanner = document.getElementById("heroBanner");
            ["moduloAdmin","moduloCliente","moduloFarmacia","moduloRepartidor"].forEach(id => document.getElementById(id).style.display = "none");
            document.getElementById("clientCartBtn").style.display = "none";
            const rol = (user.NOMBRE_ROL || "").toUpperCase();

            if (rol === "ADMINISTRADOR") {
                roleBadge.className = "role-tag admin";
                roleBadge.innerHTML = `<i class="fa-solid fa-shield"></i> Admin`;
                heroBanner.className = "banner admin-bg";
                document.getElementById("heroTitle").innerText = "Panel Central del Administrador 👑";
                document.getElementById("heroSubtitle").innerText = "Genera usuarios y credenciales para Clientes, Farmacias y Repartidores.";
                document.getElementById("heroIcon").className = "fa-solid fa-users-gear";
                document.getElementById("moduloAdmin").style.display = "block";
                cargarUsuariosAdmin();
            } else if (rol === "CLIENTE") {
                roleBadge.className = "role-tag cliente";
                roleBadge.innerHTML = `<i class="fa-solid fa-user"></i> Cliente`;
                heroBanner.className = "banner cliente-bg";
                document.getElementById("heroTitle").innerText = `¡Hola, ${user.NOMBRE}! ⚡`;
                document.getElementById("heroSubtitle").innerText = "Elige tu farmacia, ordena medicamentos y rastrea en vivo a tu repartidor.";
                document.getElementById("heroIcon").className = "fa-solid fa-basket-shopping";
                document.getElementById("moduloCliente").style.display = "block";
                document.getElementById("clientCartBtn").style.display = "inline-flex";
                cargarDatosCliente();
            } else if (rol === "FARMACIA") {
                roleBadge.className = "role-tag farmacia";
                roleBadge.innerHTML = `<i class="fa-solid fa-shop"></i> Farmacia`;
                heroBanner.className = "banner farmacia-bg";
                document.getElementById("heroTitle").innerText = "Panel de " + user.NOMBRE + " 🏪";
                const fId = (user.CORREO === "farmacia@farmaclick.com") ? 1 : user.ID_USUARIO;
                document.getElementById("farmaciaNombreDisplay").innerText = user.NOMBRE;
                document.getElementById("farmaciaIdDisplay").innerText = "ID Sucursal: " + fId;
                document.getElementById("heroSubtitle").innerText = "Control de existencias y alta de productos.";
                document.getElementById("heroIcon").className = "fa-solid fa-hospital-user";
                document.getElementById("moduloFarmacia").style.display = "block";
                cargarDatosFarmacia();
            } else if (rol === "REPARTIDOR") {
                roleBadge.className = "role-tag repartidor";
                roleBadge.innerHTML = `<i class="fa-solid fa-motorcycle"></i> Repartidor`;
                heroBanner.className = "banner repartidor-bg";
                document.getElementById("heroTitle").innerText = `Radar de Entregas FarmaClick 🛵`;
                document.getElementById("heroSubtitle").innerText = "Acepta pedidos, transmite tu GPS y confirma entregas en tiempo real.";
                document.getElementById("heroIcon").className = "fa-solid fa-route";
                document.getElementById("moduloRepartidor").style.display = "block";
                cargarDatosRepartidor();
            }
        }

        function cerrarSesion() {
            currentUser = null;
            localStorage.removeItem("fc_user");
            if (gpsPollingInterval) clearInterval(gpsPollingInterval);
            document.getElementById("appContainer").style.display = "none";
            document.getElementById("loginScreen").style.display = "flex";
        }

        /* ─── ADMIN ─── */
        function selectRoleAdmin(idRol, el) {
            document.querySelectorAll(".role-radio-card").forEach(c => c.classList.remove("selected"));
            el.classList.add("selected");
            document.getElementById("adminNewUserRole").value = idRol;
        }

        async function crearUsuarioAdmin(e) {
            e.preventDefault();
            const idRol = parseInt(document.getElementById("adminNewUserRole").value);
            const nombre = document.getElementById("adminNewNombre").value.trim();
            const apellido = document.getElementById("adminNewApellido").value.trim();
            const correo = document.getElementById("adminNewCorreo").value.trim();
            const password = document.getElementById("adminNewPass").value.trim();
            const telefono = document.getElementById("adminNewTel").value.trim();
            const direccion = document.getElementById("adminNewDir").value.trim();
            try {
                const res = await fetch(`${BACKEND_URL}/api/registro`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ idRol, nombre, apellido, correo, password, telefono, direccion })
                });
                const data = await res.json();
                if (res.ok && data.exito) {
                    alert(`✅ Usuario registrado!\nID: #${data.idUsuario}\n${nombre} ${apellido} (${correo})`);
                    const roleNames = {1:"ADMINISTRADOR",2:"CLIENTE",3:"FARMACIA",4:"REPARTIDOR"};
                    const roleClasses = {1:"admin",2:"cliente",3:"farmacia",4:"repartidor"};
                    const tr = document.createElement("tr");
                    tr.innerHTML = `<td>#${data.idUsuario}</td><td><strong>${nombre} ${apellido}</strong></td><td>${correo}</td><td><span class="role-tag ${roleClasses[idRol]}">${roleNames[idRol]}</span></td><td><span style="color:var(--success);font-weight:600;">● ACTIVO</span></td>`;
                    document.getElementById("adminUsersTable").appendChild(tr);
                    ["adminNewNombre","adminNewApellido","adminNewCorreo","adminNewPass"].forEach(id => document.getElementById(id).value = "");
                    cargarUsuariosAdmin();
                } else { alert(`❌ Error: ${data.error}`); }
            } catch (err) { alert(`⚠️ ${err.message}`); }
        }

        async function cargarUsuariosAdmin() {
            try {
                const res = await fetch(`${BACKEND_URL}/api/admin/usuarios`);
                const data = await res.json();
                if (data.exito && data.usuarios) {
                    const tbody = document.getElementById("adminUsersTable");
                    tbody.innerHTML = "";
                    const roleNames = {1:"ADMINISTRADOR",2:"CLIENTE",3:"FARMACIA",4:"REPARTIDOR"};
                    const roleClasses = {1:"admin",2:"cliente",3:"farmacia",4:"repartidor"};
                    data.usuarios.forEach(u => {
                        const tr = document.createElement("tr");
                        const rolClass = roleClasses[u.ID_ROL] || "cliente";
                        const rolNombre = roleNames[u.ID_ROL] || "USUARIO";
tr.innerHTML = `<td>#${u.ID_USUARIO}</td><td><strong>${u.NOMBRE} ${u.APELLIDO || ''}</strong></td><td>${u.CORREO}</td><td><span class="role-tag ${rolClass}">${rolNombre}</span></td><td>
    <button onclick="editarUsuario(${u.ID_USUARIO}, '${u.NOMBRE}', '${u.APELLIDO}', '${u.CORREO}', '${u.TELEFONO}', '${u.DIRECCION}')" style="background:var(--blue);color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;margin-right:5px;"><i class="fa-solid fa-pen"></i></button>
    <button onclick="eliminarUsuario(${u.ID_USUARIO})" style="background:var(--accent);color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
</td>`;
                        tbody.appendChild(tr);
                    });
                }
            } catch (e) {
                console.error("Error al cargar usuarios de admin:", e);
            }
        }

        /* ─── CLIENTE ─── */
        async function cargarDatosCliente() {
            await fetchProductosCliente();
            await fetchBilleteraCliente();
            await verificarPedidoActivoCliente();
        }

        async function fetchProductosCliente() {
            const grid = document.getElementById("clientProductsGrid");
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;color:var(--primary);"></i></div>`;
            try {
                const res = await fetch(`${BACKEND_URL}/api/cliente/productos`);
                const data = await res.json();
                if (data.exito && data.productos) {
                    productosData = data.productos.map(p => ({
                        id: p.ID_PRODUCTO, idFarmacia: p.ID_FARMACIA,
                        nombreFarmacia: p.FARMACIA || `Farmacia #${p.ID_FARMACIA}`,
                        nombre: p.PRODUCTO, desc: p.DESCRIPCION || "Medicamento certificado",
                        precio: parseFloat(p.PRECIO), categoria: p.CATEGORIA || "ANALGESICOS",
                        stock: p.STOCK,
                        icon: p.CATEGORIA === 'VITAMINAS' ? 'fa-tablets' : (p.CATEGORIA === 'HIGIENE' ? 'fa-pump-soap' : 'fa-pills')
                    }));
                    // Build pharmacy list
                    farmaciasDisponibles = {};
                    productosData.forEach(p => { farmaciasDisponibles[p.idFarmacia] = p.nombreFarmacia; });
                    renderFarmaciaButtons();
                    renderProductosCliente();
                }
            } catch (e) { console.error(e); }
        }

        function renderFarmaciaButtons() {
            const list = document.getElementById("farmaciaButtonsList");
            list.innerHTML = "";
            document.getElementById("allFarmaciaCount").innerText = productosData.length;
            Object.entries(farmaciasDisponibles).forEach(([id, nombre]) => {
                const count = productosData.filter(p => p.idFarmacia == id).length;
                const btn = document.createElement("button");
                btn.className = "pharmacy-select-btn";
                btn.dataset.idFarmacia = id;
                btn.innerHTML = `<i class="fa-solid fa-store"></i> ${nombre} <span class="badge">${count}</span>`;
                btn.onclick = () => filtrarPorFarmacia(parseInt(id), btn);
                list.appendChild(btn);
            });
        }

        function filtrarPorFarmacia(idFarmacia, el) {
            farmaciaActual = idFarmacia;
            document.querySelectorAll(".pharmacy-select-btn").forEach(b => b.classList.remove("active"));
            el.classList.add("active");
            const titulo = idFarmacia === null ? "Todas las Farmacias" : farmaciasDisponibles[idFarmacia];
            document.getElementById("clientMainTitle").innerText = `Medicamentos — ${titulo}`;
            renderProductosCliente();
        }

        function renderProductosCliente() {
            const grid = document.getElementById("clientProductsGrid");
            grid.innerHTML = "";
            let filtrados = farmaciaActual !== null
                ? productosData.filter(p => p.idFarmacia == farmaciaActual)
                : productosData;
            if (categoriaActual !== "TODOS") filtrados = filtrados.filter(p => p.categoria === categoriaActual);
            document.getElementById("clientProductCount").innerText = `${filtrados.length} disponibles`;
            if (filtrados.length === 0) {
                grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">
                    <i class="fa-solid fa-box-open" style="font-size:2.5rem;opacity:0.3;display:block;margin-bottom:12px;"></i>
                    Sin productos en esta categoría</div>`;
                return;
            }
            filtrados.forEach(prod => {
                const card = document.createElement("div");
                card.className = "product-card";
                card.innerHTML = `
                    <span class="product-badge">Stock: ${prod.stock}</span>
                    <span class="product-farmacia-badge"><i class="fa-solid fa-store" style="font-size:.65rem;"></i> ${prod.nombreFarmacia}</span>
                    <div class="product-img"><i class="fa-solid ${prod.icon}"></i></div>
                    <h4>${prod.nombre}</h4>
                    <p>${prod.desc}</p>
                    <div class="product-footer">
                        <span class="product-price">Q ${prod.precio.toFixed(2)}</span>
                        <button class="btn-add" onclick="addToCart(${prod.id})"><i class="fa-solid fa-plus"></i></button>
                    </div>`;
                grid.appendChild(card);
            });
        }

        function filterCategory(cat, event) {
            categoriaActual = cat;
            document.querySelectorAll(".filter-item").forEach(el => el.classList.remove("active"));
            if (event) event.currentTarget.classList.add("active");
            renderProductosCliente();
        }

        // Cart — supports multiple pharmacies (key = productId)
        function addToCart(productId) {
            const prod = productosData.find(p => p.id === productId);
            if (!prod) return;
            const inCart = cart.find(i => i.id === productId && i.idFarmacia === prod.idFarmacia);
            if (inCart) {
                if (inCart.cantidad >= prod.stock) { alert(`Stock máximo: ${prod.stock}`); return; }
                inCart.cantidad++;
            } else {
                cart.push({ ...prod, cantidad: 1 });
            }
            updateCartUI();
        }

        function changeQty(productId, idFarmacia, delta) {
            const item = cart.find(i => i.id === productId && i.idFarmacia == idFarmacia);
            if (!item) return;
            item.cantidad += delta;
            if (item.cantidad <= 0) cart = cart.filter(i => !(i.id === productId && i.idFarmacia == idFarmacia));
            updateCartUI();
        }

        function updateCartUI() {
            const list = document.getElementById("cartItemsList");
            const badge = document.getElementById("cartCount");
            const totalEl = document.getElementById("cartTotal");
            list.innerHTML = "";
            let total = 0, qty = 0;
            if (cart.length === 0) {
                list.innerHTML = `<div style="text-align:center;padding:50px 20px;color:var(--text-dim);"><i class="fa-solid fa-bag-shopping" style="font-size:2.5rem;opacity:0.3;display:block;margin-bottom:12px;"></i>Tu carrito está vacío</div>`;
            } else {
                // Group by farmacia for clarity
                const byFarmacia = {};
                cart.forEach(item => {
                    if (!byFarmacia[item.idFarmacia]) byFarmacia[item.idFarmacia] = { nombre: item.nombreFarmacia, items: [] };
                    byFarmacia[item.idFarmacia].items.push(item);
                });
                Object.values(byFarmacia).forEach(group => {
                    const header = document.createElement("div");
                    header.innerHTML = `<div style="font-size:0.73rem;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.5px;padding:10px 0 6px;display:flex;align-items:center;gap:6px;"><i class="fa-solid fa-store"></i> ${group.nombre}</div>`;
                    list.appendChild(header);
                    group.items.forEach(item => {
                        const sub = item.precio * item.cantidad;
                        total += sub; qty += item.cantidad;
                        const div = document.createElement("div");
                        div.className = "cart-item";
                        div.innerHTML = `
                            <div>
                                <h5>${item.nombre}</h5>
                                <span class="price">Q ${item.precio.toFixed(2)} × ${item.cantidad} = Q ${sub.toFixed(2)}</span>
                            </div>
                            <div class="cart-qty">
                                <button class="qty-btn" onclick="changeQty(${item.id},${item.idFarmacia},-1)">−</button>
                                <span style="font-weight:700;color:var(--text);min-width:20px;text-align:center;">${item.cantidad}</span>
                                <button class="qty-btn" onclick="changeQty(${item.id},${item.idFarmacia},1)">+</button>
                            </div>`;
                        list.appendChild(div);
                    });
                });
            }
            badge.innerText = qty;
            totalEl.innerText = `Q ${total.toFixed(2)}`;
        }

        function toggleCart() {
            document.getElementById("cartDrawer").classList.toggle("open");
            document.getElementById("overlay").classList.toggle("active");
        }

        async function confirmarPedidoCliente() {
            if (cart.length === 0) { alert("Agrega productos al carrito"); return; }
            const direccion = document.getElementById("direccionInput").value;
            const metodoPago = document.getElementById("metodoPagoSelect").value;
            const idFarmacia = cart[0].idFarmacia || 1;
            let latCliente = 14.7001, lngCliente = -91.8601;
            if ("geolocation" in navigator) {
                try {
                    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 7000 }));
                    latCliente = pos.coords.latitude; lngCliente = pos.coords.longitude;
                } catch (e) {}
            }
            const payload = {
                idCliente: currentUser.ID_USUARIO, idFarmacia, direccionEntrega: direccion,
                metodoPago, latitudEntrega: latCliente, longitudEntrega: lngCliente,
                items: cart.map(i => ({ idProducto: i.id, cantidad: i.cantidad }))
            };
            try {
                const res = await fetch(`${BACKEND_URL}/api/cliente/pedido`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok && data.exito) {
                    const idPed = data.pedido ? data.pedido.ID_PEDIDO : data.idPedido;
                    localStorage.setItem("fc_active_order_id", idPed);
                    alert(`✅ ¡Pedido #${idPed} creado!\nTotal: Q ${data.pedido ? data.pedido.TOTAL : '0.00'}`);
                    cart = []; updateCartUI(); toggleCart();
                    document.getElementById("clientTrackingBox").style.display = "block";
                    actualizarStepperPedidosYa("PENDIENTE", idPed);
                    iniciarMonitoreoGpsRepartidor(1);
                } else { alert(`❌ Error: ${data.error}`); }
            } catch (err) { alert(`⚠️ ${err.message}`); }
        }

        async function verificarPedidoActivoCliente() {
            const trackingBox = document.getElementById("clientTrackingBox");
            const trackedId = localStorage.getItem("fc_active_order_id");
            if (trackedId) {
                try {
                    const res = await fetch(`${BACKEND_URL}/api/cliente/pedido/${trackedId}`);
                    const data = await res.json();
                    if (data.exito && data.pedido) {
                        const estado = (data.pedido.ESTADO || "").toUpperCase();
                        if (estado === 'ENTREGADO' || estado === 'CANCELADO') {
                            trackingBox.style.display = "none"; localStorage.removeItem("fc_active_order_id");
                            if (gpsPollingInterval) clearInterval(gpsPollingInterval);
                        } else {
                            trackingBox.style.display = "block";
                            actualizarStepperPedidosYa(estado, trackedId);
                            iniciarMonitoreoGpsRepartidor(1);
                        }
                    } else { trackingBox.style.display = "none"; }
                } catch (e) { trackingBox.style.display = "none"; }
            } else { trackingBox.style.display = "none"; }
        }

        function actualizarStepperPedidosYa(estado, idPed) {
            const steps = ["step1","step2","step3","step4"].map(id => document.getElementById(id));
            const fill = document.getElementById("orderStepProgressFill");
            const badge = document.getElementById("clientTrackedStatus");
            const estTime = document.getElementById("orderEstimatedTime");
            steps.forEach(s => s.className = "order-step");
            const configs = {
                "PENDIENTE":  { active:0, width:"0%",   text:`● #${idPed}: RECIBIDO`,   bg:"rgba(255,179,71,0.12)", color:"var(--warning)", time:"El repartidor está revisando tu orden. Estimado: <strong>20-30 min</strong>" },
                "PREPARANDO": { active:1, width:"33%",  text:`● #${idPed}: PREPARANDO`, bg:"rgba(167,139,250,0.1)", color:"var(--purple)",  time:"Preparando tus medicamentos. Estimado: <strong>15-20 min</strong>" },
                "ACEPTADO":   { active:1, width:"33%",  text:`● #${idPed}: PREPARANDO`, bg:"rgba(167,139,250,0.1)", color:"var(--purple)",  time:"Preparando tus medicamentos. Estimado: <strong>15-20 min</strong>" },
                "EN_CAMINO":  { active:2, width:"66%",  text:`● #${idPed}: EN CAMINO`,  bg:"rgba(0,212,170,0.1)",  color:"var(--primary)", time:"🛵 ¡El repartidor va hacia tu ubicación! Estimado: <strong>5-10 min</strong>" },
                "EN CAMINO":  { active:2, width:"66%",  text:`● #${idPed}: EN CAMINO`,  bg:"rgba(0,212,170,0.1)",  color:"var(--primary)", time:"🛵 ¡El repartidor va hacia tu ubicación! Estimado: <strong>5-10 min</strong>" },
                "ENTREGADO":  { active:3, width:"100%", text:`● #${idPed}: ENTREGADO`,  bg:"rgba(0,230,118,0.1)",  color:"var(--success)", time:"¡Tu pedido fue entregado exitosamente! Gracias por usar FarmaClick." },
            };
            const cfg = configs[estado] || configs["PENDIENTE"];
            for (let i = 0; i <= cfg.active; i++) steps[i].className = i < cfg.active ? "order-step completed" : "order-step active";
            fill.style.width = cfg.width;
            badge.innerText = cfg.text;
            badge.style.background = cfg.bg; badge.style.color = cfg.color;
            badge.style.border = `1px solid ${cfg.color.replace(')',',0.2)').replace('var(','rgba(').replace('--primary','0,212,170').replace('--primary','0,212,170').replace('--warning','255,179,71').replace('--purple','167,139,250').replace('--success','0,230,118')}`;
            estTime.innerHTML = cfg.time;
        }

                function iniciarMonitoreoGpsRepartidor(idRepartidor, esManual = false) {
            if (gpsPollingInterval && !esManual) clearInterval(gpsPollingInterval);
            const statusEl = document.getElementById("liveGpsCoords");
            const mapContainer = document.getElementById("mapLinkContainer");
            const btn = document.getElementById("btnActualizarGpsClient");
            if (esManual && btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Consultando...`;
                                    const checkGps = async () => {
                try {
                    const res = await fetch(`${BACKEND_URL}/api/repartidor/ubicacion/${idRepartidor}`);
                    const data = await res.json();
                    if (data.exito && data.ubicacion) {
                        const lat = data.ubicacion.LATITUD_ACTUAL, lng = data.ubicacion.LONGITUD_ACTUAL;
                        const hora = new Date(data.ubicacion.FECHA_UBICACION).toLocaleTimeString();
                        const badge = document.getElementById("clientTrackedStatus");
                        if (lat === 0 && lng === 0) {
                            statusEl.innerHTML = `<span style="color:var(--accent);">🔴 GPS Apagado</span>`;
                            if (mapContainer) mapContainer.innerHTML = "";
                        } else {
                            statusEl.innerHTML = `${lat.toFixed(5)}, ${lng.toFixed(5)} <span style="font-size:0.75rem;color:var(--text-dim);">(${hora})</span>`;
                            if (mapContainer) mapContainer.innerHTML = `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="color:var(--blue);text-decoration:none;font-size:0.8rem;font-weight:600;"><i class="fa-solid fa-map-location-dot"></i> Ver en Google Maps ↗</a>`;
                        }
                    }
                } catch (e) { 
                    if(statusEl) statusEl.innerText = "Esperando señal..."; 
                } finally { 
                    if (esManual && btn) { 
                        btn.innerHTML = `<i class="fa-solid fa-check" style="color:var(--success);"></i> Actualizado!`; 
                        setTimeout(()=>{ btn.innerHTML = `<i class="fa-solid fa-rotate"></i> Actualizar GPS`; },1200); 
                    } 
                }

                // Call check outside try/catch/finally
                const activePed = localStorage.getItem("fc_active_order_id");
                if (activePed) {
                    try {
                        const callRes = await fetch(`${BACKEND_URL}/api/agora/estado/${activePed}`);
                        const callData = await callRes.json();
                        const banner = document.getElementById("incomingCallBannerClient");
                        if (callData.llamando) {
                            if (banner && banner.style.display === "none") {
                                banner.style.setProperty("display", "flex", "important");
                                // We store the call status to avoid reconnecting
                                localStorage.setItem("fc_agora_incoming", "true");
                            }
                        } else {
                            if (banner && banner.style.display !== "none") {
                                banner.style.setProperty("display", "none", "important");
                                localStorage.removeItem("fc_agora_incoming");
                            }
                        }
                    } catch(e) {}
                }
            };
            checkGps();
            if (!esManual) gpsPollingInterval = setInterval(checkGps, 5000);
        }

        async function fetchBilleteraCliente() {
            try {
                const res = await fetch(`${BACKEND_URL}/api/billetera/${currentUser.ID_USUARIO}`);
                const data = await res.json();
                if (data.exito) document.getElementById("clientWalletBalance").innerText = parseFloat(data.saldo||0).toFixed(2);
            } catch(e) {}
        }

        async function recargarBilleteraPrompt() {
            const monto = prompt("¿Cuánto deseas recargar? (Quetzales):","50.00");
            if (!monto || isNaN(monto) || parseFloat(monto)<=0) return;
            try {
                const res = await fetch(`${BACKEND_URL}/api/billetera/recargar`, {
                    method:"POST", headers:{"Content-Type":"application/json"},
                    body: JSON.stringify({ idUsuario: currentUser.ID_USUARIO, monto: parseFloat(monto), descripcion:"Recarga web" })
                });
                const data = await res.json();
                if (res.ok && data.exito) { alert(`✅ Saldo recargado: Q ${data.saldoNuevo.toFixed(2)}`); fetchBilleteraCliente(); }
            } catch(e) { alert(e.message); }
        }

        async function responderLlamadaCliente() {
            const idPed = localStorage.getItem("fc_active_order_id") || 41;
            try {
                const res = await fetch(`${BACKEND_URL}/api/agora/token`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ idPedido: idPed, idUsuario: currentUser.ID_USUARIO, role:"publisher" }) });
                const data = await res.json();
                alert(`📞 ¡Conectado con el Repartidor!\nCanal: ${data.channelName || `pedido_${idPed}`}`);
            } catch(e) { alert(`📞 Conectado en canal de voz del Pedido #${idPed}.`); }
            finally { const banner = document.getElementById("incomingCallBannerClient"); if(banner) banner.style.setProperty("display","none","important"); }
        }

        function rechazarLlamadaCliente() {
            const banner = document.getElementById("incomingCallBannerClient");
            if(banner) banner.style.setProperty("display","none","important");
        }

        async function verMisPedidosCliente() {
            const activeId = localStorage.getItem("fc_active_order_id");
            if (!activeId) { alert("📦 No tienes ningún pedido en curso."); return; }
            try {
                const res = await fetch(`${BACKEND_URL}/api/cliente/pedido/${activeId}`);
                const data = await res.json();
                if (data.exito && data.pedido) {
                    const p = data.pedido;
                    if (p.ESTADO === 'ENTREGADO' || p.ESTADO === 'CANCELADO') {
                        alert(`📦 Pedido #${p.ID_PEDIDO}\nEstado: ${p.ESTADO}\nTotal: Q ${parseFloat(p.TOTAL).toFixed(2)}`);
                        localStorage.removeItem("fc_active_order_id");
                        document.getElementById("clientTrackingBox").style.display = "none";
                    } else {
                        const msg = `📦 Pedido #${p.ID_PEDIDO}\nEstado: ${p.ESTADO}\nTotal: Q ${parseFloat(p.TOTAL).toFixed(2)}\nDirección: ${p.DIRECCION_ENTREGA}\n\n¿Cerrar el seguimiento en pantalla?`;
                        if (confirm(msg)) { localStorage.removeItem("fc_active_order_id"); document.getElementById("clientTrackingBox").style.display = "none"; }
                    }
                } else {
                    localStorage.removeItem("fc_active_order_id");
                    document.getElementById("clientTrackingBox").style.display = "none";
                    alert(`Pedido #${activeId} no encontrado. Se limpió el seguimiento.`);
                }
            } catch(e) { alert(`Pedido activo: #${activeId}`); }
        }

        /* ─── FARMACIA ─── */
        async function cargarDatosFarmacia() {
            try {
                const res = await fetch(`${BACKEND_URL}/api/cliente/productos`);
                const data = await res.json();
                if (data.exito && data.productos) {
                    const esCentral = (currentUser.CORREO === "farmacia@farmaclick.com");
                    const misProductos = data.productos.filter(p => {
                        if (esCentral) {
                            return p.ID_FARMACIA === 1 || !p.FARMACIA_NIT;
                        } else {
                            return p.FARMACIA_NIT === ("USR" + currentUser.ID_USUARIO);
                        }
                    });
                    document.getElementById("farmaciaStatTotal").innerText = misProductos.length;
                    document.getElementById("farmaciaStatStock").innerText = misProductos.reduce((a,c)=>a+(c.STOCK||0),0);
                    const tbody = document.getElementById("farmaciaInventoryTable");
                    tbody.innerHTML = "";
                    misProductos.forEach(p => {
                        const tr = document.createElement("tr");
                        tr.innerHTML = `<td>#${p.ID_PRODUCTO}</td><td><strong>${p.PRODUCTO}</strong><br><small style="color:var(--text-dim);">${p.DESCRIPCION||''}</small></td>
                            <td><span style="background:var(--bg-3);color:var(--text-muted);padding:3px 8px;border-radius:6px;font-size:0.78rem;border:1px solid var(--border);">${p.CATEGORIA}</span></td>
                            <td><strong style="color:var(--text);">Q ${parseFloat(p.PRECIO).toFixed(2)}</strong></td>
                            <td><span style="font-weight:700;color:${p.STOCK>5?'var(--success)':'var(--accent)'};">${p.STOCK} unid.</span></td>
                            <td>
    <button onclick="editarProducto(${p.ID_PRODUCTO}, '', '', ${p.PRECIO}, ${p.STOCK})" style="background:var(--blue);color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;margin-right:5px;" title="Editar"><i class="fa-solid fa-pen"></i></button>
    <button onclick="eliminarProducto(${p.ID_PRODUCTO})" style="background:var(--accent);color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
</td>`;
                        tbody.appendChild(tr);
                    });
                }
            } catch(e) {}
        }

        function toggleModalProducto(show) { document.getElementById("modalNuevoProducto").style.display = show ? "flex" : "none"; }

        async function guardarProductoFarmacia() {
            const nombre = document.getElementById("prodNombre").value.trim();
            const descripcion = document.getElementById("prodDesc").value.trim();
            const precio = parseFloat(document.getElementById("prodPrecio").value);
            const stock = parseInt(document.getElementById("prodStock").value) || 10;
            const categoria = document.getElementById("prodCategoria").value;
            if (!nombre || !precio) { alert("Completa nombre y precio"); return; }
            const fId = (currentUser.CORREO === "farmacia@farmaclick.com") ? 1 : currentUser.ID_USUARIO;
            try {
                const res = await fetch(`${BACKEND_URL}/api/farmacia/producto`, {
                    method:"POST", headers:{"Content-Type":"application/json"},
                    body: JSON.stringify({ idFarmacia: (currentUser.CORREO === "farmacia@farmaclick.com" ? 1 : currentUser.ID_USUARIO), idUsuario: currentUser.ID_USUARIO, nombre, descripcion, precio, stock, categoria })
                });
                const data = await res.json();
                if (res.ok && data.exito) { alert(`✅ Producto guardado (#${data.idProducto})`); toggleModalProducto(false); cargarDatosFarmacia(); }
                else { alert(`Error: ${data.error}`); }
            } catch(e) { alert(e.message); }
        }

        /* ─── REPARTIDOR ─── */
        async function cargarDatosRepartidor() {
            await verificarPedidoActivoRepartidor();
            const grid = document.getElementById("repartidorOrdersGrid");
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;color:var(--warning);"></i></div>`;
            try {
                const res = await fetch(`${BACKEND_URL}/api/repartidor/pedidos-disponibles`);
                const data = await res.json();
                if (data.exito && data.pedidos && data.pedidos.length > 0) {
                    grid.innerHTML = "";
                    [...data.pedidos].sort((a,b)=>b.ID_PEDIDO-a.ID_PEDIDO).forEach(p => {
                        const card = document.createElement("div");
                        card.className = "order-card";
                        card.innerHTML = `
                            <div>
                                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                                    <h4 style="font-size:1rem;font-weight:700;color:var(--text);">Pedido #${p.ID_PEDIDO}</h4>
                                    <span style="background:rgba(255,179,71,0.12);color:var(--warning);border:1px solid rgba(255,179,71,0.2);padding:4px 10px;border-radius:12px;font-weight:700;font-size:0.73rem;">${p.ESTADO}</span>
                                </div>
                                <div style="display:flex;flex-direction:column;gap:6px;font-size:0.84rem;color:var(--text-muted);">
                                    <span><i class="fa-solid fa-user" style="color:var(--primary);width:14px;"></i> ${p.CLIENTE}</span>
                                    <span><i class="fa-solid fa-location-dot" style="color:var(--accent);width:14px;"></i> ${p.DIRECCION_ENTREGA}</span>
                                    <span><i class="fa-solid fa-money-bill-wave" style="color:var(--success);width:14px;"></i> Q ${parseFloat(p.TOTAL).toFixed(2)} (${p.METODO_PAGO})</span>
                                </div>
                            </div>
                            <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px;">
                                <button class="btn-action btn-accept" onclick="aceptarPedidoRepartidor(${p.ID_PEDIDO})">
                                    <i class="fa-solid fa-hand-holding-hand"></i> Aceptar Pedido
                                </button>
                            </div>`;
                        grid.appendChild(card);
                    });
                } else {
                    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:50px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);">
                        <i class="fa-solid fa-circle-check" style="font-size:2.5rem;color:var(--success);opacity:0.6;"></i>
                        <h3 style="margin-top:12px;color:var(--text-muted);font-weight:600;">Sin pedidos pendientes en radar</h3></div>`;
                }
            } catch(e) { console.error(e); }
        }

        async function verificarPedidoActivoRepartidor() {
            const container = document.getElementById("repartidorActiveOrderContainer");
            let pActivo = null;
            try {
                const res = await fetch(`${BACKEND_URL}/api/repartidor/pedidos-activos/1`);
                const data = await res.json();
                if (data.exito && data.pedidos && data.pedidos.length > 0) {
                    pActivo = data.pedidos[0];
                    localStorage.setItem("fc_rider_active_order_id", pActivo.ID_PEDIDO);
                }
            } catch(err) {}
            if (!pActivo) {
                const activeId = localStorage.getItem("fc_rider_active_order_id") || localStorage.getItem("fc_active_order_id");
                if (activeId) {
                    try {
                        const res = await fetch(`${BACKEND_URL}/api/cliente/pedido/${activeId}`);
                        const data = await res.json();
                        if (data.exito && data.pedido) {
                            const p = data.pedido;
                            if (p.ESTADO !== 'ENTREGADO' && p.ESTADO !== 'CANCELADO') {
                                pActivo = p; localStorage.setItem("fc_rider_active_order_id", p.ID_PEDIDO);
                            }
                        }
                    } catch(e) {}
                }
            }
            if (pActivo) { renderTarjetaEntregaActiva(pActivo); iniciarGpsRealRepartidor(); }
            else { container.style.display = "none"; localStorage.removeItem("fc_rider_active_order_id"); detenerGpsRepartidor(); }
        }

        function renderTarjetaEntregaActiva(p) {
            const container = document.getElementById("repartidorActiveOrderContainer");
            container.style.display = "block";
            document.getElementById("riderActiveOrderTitle").innerText = `Pedido #${p.ID_PEDIDO} — ${p.ESTADO}`;
            document.getElementById("riderActiveBadge").innerText = `● ${p.ESTADO}`;
            document.getElementById("riderActiveOrderDetails").innerHTML = `
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <span><i class="fa-solid fa-user" style="color:var(--primary);width:16px;"></i> <strong>Cliente:</strong> ${p.CLIENTE||'Cliente'}</span>
                    <span><i class="fa-solid fa-location-dot" style="color:var(--accent);width:16px;"></i> <strong>Destino:</strong> ${p.DIRECCION_ENTREGA}</span>
                      ${p.LATITUD_ENTREGA && p.LONGITUD_ENTREGA ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${p.LATITUD_ENTREGA},${p.LONGITUD_ENTREGA}" target="_blank" style="color:var(--primary);text-decoration:none;font-weight:bold;margin-top:4px;display:inline-block;"><i class="fa-solid fa-map-location-dot"></i> Abrir en Google Maps (Ubicación del Cliente)</a>` : ''}
                    <span><i class="fa-solid fa-money-bill-wave" style="color:var(--success);width:16px;"></i> <strong>Total a Cobrar:</strong> Q ${parseFloat(p.TOTAL).toFixed(2)} (${p.METODO_PAGO})</span>
                </div>`;
            document.getElementById("riderActiveActions").innerHTML = `
                <button class="btn-action btn-dispatch" onclick="cambiarEstadoRider('${BACKEND_URL}/api/repartidor/despachar',${p.ID_PEDIDO},'EN CAMINO')">
                    <i class="fa-solid fa-motorcycle"></i> Despachar (En Camino)
                </button>
                <button class="btn-action btn-delivered" onclick="cambiarEstadoRider('${BACKEND_URL}/api/repartidor/entregar-pedido',${p.ID_PEDIDO},'ENTREGADO')">
                    <i class="fa-solid fa-circle-check"></i> Marcar Entregado
                </button>`;
        }

        async function aceptarPedidoRepartidor(idPed) {
            try {
                const res = await fetch(`${BACKEND_URL}/api/repartidor/aceptar-pedido`, {
                    method:"POST", headers:{"Content-Type":"application/json"},
                    body: JSON.stringify({ idPedido: idPed, idRepartidor: 1 })
                });
                const data = await res.json();
                if (res.ok && data.exito) {
                    localStorage.setItem("fc_rider_active_order_id", idPed);
                    alert(`🛵 ¡Pedido #${idPed} aceptado! GPS activado.`);
                    await verificarPedidoActivoRepartidor();
                    await cargarDatosRepartidor();
                } else { alert(`Error: ${data.error||'No se pudo aceptar'}`); }
            } catch(e) { alert(e.message); }
        }

        async function cambiarEstadoRider(url, idPed, nombreEstado) {
            try {
                const res = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ idPedido: idPed, idRepartidor: 1 }) });
                const data = await res.json();
                if (res.ok && data.exito) {
                    if (nombreEstado === 'ENTREGADO') {
                        localStorage.removeItem("fc_rider_active_order_id");
                        detenerGpsRepartidor(); await limpiarUbicacionGps(true);
                        alert(`🎉 ¡Entrega completada!\nPedido #${idPed} entregado. GPS apagado.`);
                        document.getElementById("repartidorActiveOrderContainer").style.display = "none";
                        cargarDatosRepartidor();
                    } else {
                        alert(`📍 Pedido #${idPed} → ${nombreEstado}`);
                        await transmitirUbicacionGpsReal();
                        await verificarPedidoActivoRepartidor();
                    }
                }
            } catch(e) { alert(e.message); }
        }

        function iniciarGpsRealRepartidor() {
            if ("geolocation" in navigator) {
                transmitirUbicacionGpsReal();
                if (!riderGpsWatchId) riderGpsWatchId = setInterval(transmitirUbicacionGpsReal, 6000);
            } else { document.getElementById("riderGpsStatusText").innerText = "Geolocalización no soportada."; }
        }

        function detenerGpsRepartidor() { if (riderGpsWatchId) { clearInterval(riderGpsWatchId); riderGpsWatchId = null; } }

        async function transmitirUbicacionGpsReal() {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(async (position) => {
                const lat = position.coords.latitude, lng = position.coords.longitude;
                document.getElementById("riderGpsStatusText").innerText = "● Transmitiendo en vivo";
                document.getElementById("riderGpsCoordsDisplay").innerText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                try { await fetch(`${BACKEND_URL}/api/repartidor/ubicacion`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ idRepartidor:1, latitud:lat, longitud:lng }) }); }
                catch(e) { console.error(e); }
            }, () => { document.getElementById("riderGpsStatusText").innerText = "⚠️ Activa el GPS y concede permiso."; }, { enableHighAccuracy:true, timeout:10000, maximumAge:0 });
        }

        async function limpiarUbicacionGps() {
            try { await fetch(`${BACKEND_URL}/api/repartidor/ubicacion`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ idRepartidor:1, latitud:0, longitud:0 }) }); }
            catch(e) {}
        }

        async function iniciarLlamadaAgoraRider() {
            const activeId = localStorage.getItem("fc_rider_active_order_id") || 41;
            try {
                const res = await fetch(`${BACKEND_URL}/api/agora/token`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ idPedido: activeId, idUsuario: 1, role:"publisher" }) });
                const data = await res.json();
                alert(`📞 Canal Agora activo: ${data.channelName||`pedido_${activeId}`}\n🎙️ Conectando con el Cliente...`);
            } catch(e) { alert(`📞 Conectando con el Cliente del Pedido #${activeId}...`); }
        }

        // AUTO-LOGIN
        window.onload = () => {
            const saved = localStorage.getItem("fc_user");
            if (saved) { try { currentUser = JSON.parse(saved); aplicarExperienciaPorRol(currentUser); } catch(e) {} }
        };
            async function eliminarUsuario(id) {
            if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
            try {
                const res = await fetch(`${BACKEND_URL}/api/admin/usuario/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.exito) { alert('Usuario eliminado'); cargarUsuariosAdmin(); }
                else { alert('Error: ' + data.error); }
            } catch(e) { alert(e.message); }
        }
        
        async function eliminarProducto(id) {
            if (!confirm('¿Estás seguro de eliminar este producto?')) return;
            try {
                const res = await fetch(`${BACKEND_URL}/api/farmacia/producto/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.exito) { alert('Producto eliminado'); cargarDatosFarmacia(); }
                else { alert('Error: ' + data.error); }
            } catch(e) { alert(e.message); }
        }
        }
        }
    
        /* === DYNAMIC MODAL ARCHITECTURE === */
        function openDynamicModal(title, fields, onSubmit) {
            document.getElementById("dModalTitle").innerText = title;
            const body = document.getElementById("dModalBody");
            body.innerHTML = "";
            const inputs = {};
            fields.forEach(f => {
                const wrapper = document.createElement("div");
                wrapper.innerHTML = `<label style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;display:block;">${f.label}</label>`;
                const input = document.createElement("input");
                input.type = f.type || "text";
                input.value = f.value || "";
                input.style.cssText = "width:100%;padding:10px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;";
                wrapper.appendChild(input);
                body.appendChild(wrapper);
                inputs[f.key] = input;
            });
            document.getElementById("dModalSubmit").onclick = () => {
                const result = {};
                for (let k in inputs) result[k] = inputs[k].value;
                onSubmit(result);
            };
            document.getElementById("dynamicModal").style.display = "flex";
        }
        function closeDynamicModal() { document.getElementById("dynamicModal").style.display = "none"; }

        /* === REWRITE EDIT FUNCTIONS === */
        async function editarUsuario(id, n, a, c, t, d) {
            openDynamicModal(`Editar Usuario #${id}`, [
                { key: 'nombre', label: 'Nombre', value: n },
                { key: 'apellido', label: 'Apellido', value: a },
                { key: 'correo', label: 'Correo (Login)', value: c },
                { key: 'telefono', label: 'Teléfono', value: t },
                { key: 'direccion', label: 'Dirección', value: d }
            ], async (data) => {
                const btn = document.getElementById("dModalSubmit");
                btn.innerText = "Guardando..."; btn.disabled = true;
                try {
                    const res = await fetch(`${BACKEND_URL}/api/admin/usuario/${id}`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    const result = await res.json();
                    if (result.exito) { closeDynamicModal(); alert('Usuario actualizado exitosamente'); cargarUsuariosAdmin(); }
                    else { alert('Error: ' + result.error); }
                } catch(e) { alert(e.message); }
                btn.innerText = "Guardar"; btn.disabled = false;
            });
        }

        async function editarProducto(id, pr, desc, pre, st) {
            openDynamicModal(`Editar Producto #${id}`, [
                { key: 'nombre', label: 'Nombre Producto', value: pr },
                { key: 'descripcion', label: 'Descripción', value: desc },
                { key: 'precio', label: 'Precio (Q)', type: 'number', value: pre },
                { key: 'stock', label: 'Stock (Unidades)', type: 'number', value: st }
            ], async (data) => {
                const btn = document.getElementById("dModalSubmit");
                btn.innerText = "Guardando..."; btn.disabled = true;
                try {
                    const res = await fetch(`${BACKEND_URL}/api/farmacia/producto/${id}`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    const result = await res.json();
                    if (result.exito) { closeDynamicModal(); alert('Producto actualizado exitosamente'); cargarDatosFarmacia(); }
                    else { alert('Error: ' + result.error); }
                } catch(e) { alert(e.message); }
                btn.innerText = "Guardar"; btn.disabled = false;
            });
        }

        /* === AGORA WEBRTC LOGIC === */
        let agoraClient = null;
        let localAudioTrack = null;
        let isAgoraMuted = false;

        async function initAgoraClient() {
            if (!agoraClient) {
                agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
                agoraClient.on("user-published", async (user, mediaType) => {
                    await agoraClient.subscribe(user, mediaType);
                    if (mediaType === "audio") {
                        user.audioTrack.play();
                        document.getElementById("agoraCallStatus").innerText = "Llamada conectada en curso";
                    }
                });
                agoraClient.on("user-left", () => {
                    document.getElementById("agoraCallStatus").innerText = "El usuario abandonó la llamada.";
                    setTimeout(leaveAgoraCall, 2000);
                });
            }
        }

        async function joinAgoraCall(appId, channel, token, uid) {
            try {
                await initAgoraClient();
                document.getElementById("agoraCallUI").style.display = "block";
                document.getElementById("agoraCallStatus").innerText = "Conectando al canal...";
                await agoraClient.join(appId, channel, token, uid);
                localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                await agoraClient.publish([localAudioTrack]);
                document.getElementById("agoraCallStatus").innerText = "Esperando al otro usuario...";
            } catch (error) {
                console.error("Agora join failed:", error);
                alert("No se pudo establecer la llamada de audio. Verifica permisos de micrófono.");
                leaveAgoraCall();
            }
        }

        async function leaveAgoraCall() {
            if (localAudioTrack) { localAudioTrack.stop(); localAudioTrack.close(); localAudioTrack = null; }
            if (agoraClient) { await agoraClient.leave(); }
            document.getElementById("agoraCallUI").style.display = "none";
        }

        function toggleAgoraMute() {
            if (localAudioTrack) {
                isAgoraMuted = !isAgoraMuted;
                localAudioTrack.setMuted(isAgoraMuted);
                const btn = document.getElementById("btnAgoraMute");
                if (isAgoraMuted) { btn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>'; btn.style.background = "var(--accent)"; btn.style.color = "white"; }
                else { btn.innerHTML = '<i class="fa-solid fa-microphone"></i>'; btn.style.background = "var(--bg-3)"; btn.style.color = "var(--text)"; }
            }
        }
    
