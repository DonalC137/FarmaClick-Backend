const path = require('path');

// 1. Asignar TNS_ADMIN al inicio para la carpeta wallet de Oracle Cloud
const walletPath = path.resolve(__dirname, 'wallet');
process.env.TNS_ADMIN = walletPath;

// 2. Cargar variables de entorno y módulos
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const oracledb = require('oracledb');

// Configuración global de la librería oracledb (Modo Thin)
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const app = express();

// Habilitar CORS para permitir peticiones desde aplicaciones Web / Móvil
app.use(cors());
app.use(express.json());

// Helper para obtener conexión con Oracle Autonomous Database
async function getDbConnection() {
    return await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT
    });
}

// ============================================================
// 1. AUTENTICACIÓN Y REGISTRO
// ============================================================

// Iniciar sesión
app.post('/api/admin/query', async (req, res) => {
    let conn;
    try {
        conn = await getDbConnection();
        const result = await conn.execute(req.body.sql, req.body.binds || {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        res.json({ exito: true, data: result.rows });
    } catch (e) {
        res.status(500).json({ exito: false, error: e.message });
    } finally {
        if (conn) await conn.close();
    }
});

app.post('/api/login', async (req, res) => {
    let conn;
    try {
        const { correo, password } = req.body;

        if (!correo || !password) {
            return res.status(400).json({
                exito: false,
                error: 'Correo y password son obligatorios'
            });
        }

        conn = await getDbConnection();

        const result = await conn.execute(
            `SELECT
                u.ID_USUARIO,
                u.ID_ROL,
                r.NOMBRE_ROL,
                u.NOMBRE,
                u.APELLIDO,
                u.CORREO,
                u.TELEFONO,
                u.DIRECCION,
                u.SALDO_BILLETERA,
                u.ESTADO
             FROM USUARIOS u
             JOIN ROLES r
               ON u.ID_ROL = r.ID_ROL
             WHERE u.CORREO = :correo
               AND u.PASSWORD = :password`,
            [correo, password]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                exito: false,
                error: 'Credenciales inválidas'
            });
        }

        const usuario = result.rows[0];

        if (usuario.ESTADO !== 'ACTIVO') {
            return res.status(403).json({
                exito: false,
                error: 'Usuario inactivo o bloqueado'
            });
        }

        return res.json({
            exito: true,
            usuario
        });

    } catch (err) {
        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// Registrar nuevo usuario
app.post('/api/registro', async (req, res) => {
    let conn;
    try {
        const {
            idRol,
            nombre,
            apellido,
            correo,
            password,
            telefono,
            direccion
        } = req.body;

        if (
            !idRol ||
            !nombre ||
            !apellido ||
            !correo ||
            !password
        ) {
            return res.status(400).json({
                exito: false,
                error: 'Faltan campos obligatorios'
            });
        }

        conn = await getDbConnection();

        const result = await conn.execute(
            `INSERT INTO USUARIOS (
                ID_ROL,
                NOMBRE,
                APELLIDO,
                CORREO,
                PASSWORD,
                TELEFONO,
                DIRECCION
             )
             VALUES (
                :idRol,
                :nombre,
                :apellido,
                :correo,
                :password,
                :telefono,
                :direccion
             )
             RETURNING ID_USUARIO INTO :id`,
            {
                idRol,
                nombre,
                apellido,
                correo,
                password,
                telefono: telefono || null,
                direccion: direccion || null,
                id: {
                    type: oracledb.NUMBER,
                    dir: oracledb.BIND_OUT
                }
            },
            {
                autoCommit: true
            }
        );

        const nuevoId = result.outBinds.id[0];

        return res.json({
            exito: true,
            mensaje: 'Usuario registrado exitosamente',
            idUsuario: nuevoId
        });

    } catch (err) {
        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// ============================================================
// 2. MÓDULO CLIENTE: FARMACIAS, PRODUCTOS Y PEDIDOS
// ============================================================

// Listar farmacias activas
app.get('/api/cliente/farmacias', async (req, res) => {
    let conn;
    try {
        conn = await getDbConnection();

        const result = await conn.execute(
            `SELECT
                ID_FARMACIA,
                NOMBRE,
                NIT,
                TELEFONO,
                DIRECCION,
                HORARIO,
                ESTADO
             FROM FARMACIAS
             WHERE ESTADO = 'ACTIVA'`
        );

        return res.json({
            exito: true,
            farmacias: result.rows
        });

    } catch (err) {
        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// Ver todos los productos o productos de una farmacia
app.get(
    [
        '/api/cliente/productos',
        '/api/cliente/productos/:idFarmacia'
    ],
    async (req, res) => {
        let conn;
        try {
            conn = await getDbConnection();

            const idFarmacia =
                req.params.idFarmacia ||
                req.query.idFarmacia;

            let sql =
                `SELECT *
                 FROM VW_PRODUCTOS_FARMACIAS
                 WHERE ESTADO_PRODUCTO = 'DISPONIBLE'`;

            const binds = [];

            if (idFarmacia) {
                sql += ` AND ID_FARMACIA = :idFarmacia`;
                binds.push(idFarmacia);
            }

            const result = await conn.execute(sql, binds);

            return res.json({
                exito: true,
                productos: result.rows
            });

        } catch (err) {
            return res.status(500).json({
                exito: false,
                error: err.message
            });
        } finally {
            if (conn) {
                try {
                    await conn.close();
                } catch (e) {}
            }
        }
    }
);

// Guardar nuevo producto
app.post('/api/farmacia/producto', async (req, res) => {
    let conn;
    try {
        const {
            idFarmacia,
            nombre,
            descripcion,
            precio,
            stock,
            categoria
        } = req.body;

        if (!idFarmacia || !nombre || !precio) {
            return res.status(400).json({
                exito: false,
                error: 'idFarmacia, nombre y precio son obligatorios'
            });
        }

        conn = await getDbConnection();
        try {
            const check = await conn.execute(`SELECT ID_FARMACIA FROM FARMACIAS WHERE ID_FARMACIA = :id`, { id: idFarmacia });
            if (!check.rows || check.rows.length === 0) {
                const userQ = await conn.execute(`SELECT NOMBRE, TELEFONO, DIRECCION FROM USUARIOS WHERE ID_USUARIO = :id`, { id: idFarmacia });
                let fname = "Farmacia " + idFarmacia;
                let ftel = "";
                let fdir = "";
                if (userQ.rows && userQ.rows.length > 0) {
                    const r = userQ.rows[0];
                    fname = r.NOMBRE || r[0] || fname;
                    ftel = r.TELEFONO || r[1] || "";
                    fdir = r.DIRECCION || r[2] || "";
                }
                await conn.execute(
                    `INSERT INTO FARMACIAS (ID_FARMACIA, NOMBRE, NIT, TELEFONO, DIRECCION, HORARIO, ESTADO) VALUES (:id, :nom, 'CF', :tel, :dir, '08:00-20:00', 'ACTIVA')`,
                    { id: idFarmacia, nom: fname, tel: ftel, dir: fdir },
                    { autoCommit: true }
                );
            }
        } catch (e) { return res.status(500).json({ exito: false, error: "Error auto-creando farmacia: " + e.message }); }

        const result = await conn.execute(
            `INSERT INTO PRODUCTOS (
                ID_FARMACIA,
                NOMBRE,
                DESCRIPCION,
                PRECIO,
                STOCK,
                CATEGORIA,
                ESTADO
             )
             VALUES (
                :idFarmacia,
                :nombre,
                :descripcion,
                :precio,
                :stock,
                :categoria,
                'DISPONIBLE'
             )
             RETURNING ID_PRODUCTO INTO :id`,
            {
                idFarmacia,
                nombre,
                descripcion: descripcion || '',
                precio: parseFloat(precio),
                stock: parseInt(stock) || 10,
                categoria: categoria || 'ANALGESICOS',
                id: {
                    type: oracledb.NUMBER,
                    dir: oracledb.BIND_OUT
                }
            },
            {
                autoCommit: true
            }
        );

        const nuevoId = result.outBinds.id[0];

        return res.json({
            exito: true,
            mensaje: 'Producto guardado exitosamente en Oracle Cloud',
            idProducto: nuevoId
        });

    } catch (err) {
        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// ============================================================
// CREAR PEDIDO CON UBICACIÓN DEL CLIENTE
// ============================================================
app.post('/api/cliente/pedido', async (req, res) => {
    let conn;
    try {
        const {
            idCliente,
            idFarmacia,
            direccionEntrega,
            metodoPago,
            latitudEntrega,
            longitudEntrega,
            items
        } = req.body;

        if (
            !idCliente ||
            !idFarmacia ||
            !direccionEntrega ||
            !metodoPago ||
            !items ||
            !items.length
        ) {
            return res.status(400).json({
                exito: false,
                error: 'Faltan datos obligatorios para crear el pedido'
            });
        }

        let lat = null;
        let lng = null;

        // Validar GPS solamente si fue enviado
        if (
            latitudEntrega !== undefined &&
            latitudEntrega !== null &&
            longitudEntrega !== undefined &&
            longitudEntrega !== null
        ) {
            lat = Number(latitudEntrega);
            lng = Number(longitudEntrega);

            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng) ||
                lat < -90 ||
                lat > 90 ||
                lng < -180 ||
                lng > 180
            ) {
                return res.status(400).json({
                    exito: false,
                    error: 'Las coordenadas de entrega no son válidas'
                });
            }
        }

        conn = await getDbConnection();

        // Crear cabecera
        const pedResult = await conn.execute(
            `INSERT INTO PEDIDOS (
                ID_CLIENTE,
                ID_FARMACIA,
                DIRECCION_ENTREGA,
                METODO_PAGO,
                ESTADO,
                TOTAL,
                LATITUD_ENTREGA,
                LONGITUD_ENTREGA
             )
             VALUES (
                :idCliente,
                :idFarmacia,
                :direccionEntrega,
                :metodoPago,
                'PENDIENTE',
                0,
                :latitudEntrega,
                :longitudEntrega
             )
             RETURNING ID_PEDIDO INTO :id`,
            {
                idCliente,
                idFarmacia,
                direccionEntrega,
                metodoPago,
                latitudEntrega: lat,
                longitudEntrega: lng,
                id: {
                    type: oracledb.NUMBER,
                    dir: oracledb.BIND_OUT
                }
            },
            {
                autoCommit: false
            }
        );

        const idPedido = pedResult.outBinds.id[0];

        // Insertar productos
        for (const item of items) {
            if (
                !item.idProducto ||
                !item.cantidad ||
                Number(item.cantidad) <= 0
            ) {
                throw new Error('Producto o cantidad inválida');
            }

            await conn.execute(
                `INSERT INTO DETALLE_PEDIDOS (
                    ID_PEDIDO,
                    ID_PRODUCTO,
                    CANTIDAD,
                    PRECIO_UNITARIO,
                    SUBTOTAL
                 )
                 VALUES (
                    :idPedido,
                    :idProducto,
                    :cantidad,
                    0,
                    0
                 )`,
                [
                    idPedido,
                    item.idProducto,
                    item.cantidad
                ]
            );
        }

        // Mantener billetera existente
        if (metodoPago === 'BILLETERA') {
            await conn.execute(
                `BEGIN
                    PAGAR_CON_BILLETERA(
                        :idCliente,
                        :idPedido
                    );
                 END;`,
                [
                    idCliente,
                    idPedido
                ]
            );
        }

        await conn.commit();

        // Consultar pedido creado
        const finalPedido = await conn.execute(
            `SELECT *
             FROM VW_PEDIDOS_COMPLETOS
             WHERE ID_PEDIDO = :id`,
            [idPedido]
        );

        return res.json({
            exito: true,
            mensaje: 'Pedido creado exitosamente',
            pedido: finalPedido.rows[0]
        });

    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (e) {}
        }

        console.error('Error creando pedido:', err);

        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// ============================================================
// SEGUIMIENTO Y DETALLE DEL PEDIDO
// ============================================================
app.get('/api/cliente/pedido/:idPedido', async (req, res) => {
    let conn;
    try {
        const idPedido = req.params.idPedido;

        conn = await getDbConnection();

        const pedResult = await conn.execute(
            `SELECT *
             FROM VW_PEDIDOS_COMPLETOS
             WHERE ID_PEDIDO = :id`,
            [idPedido]
        );

        if (pedResult.rows.length === 0) {
            return res.status(404).json({
                exito: false,
                error: 'Pedido no encontrado'
            });
        }

        const detalleResult = await conn.execute(
            `SELECT *
             FROM VW_DETALLE_PEDIDOS
             WHERE ID_PEDIDO = :id`,
            [idPedido]
        );

        return res.json({
            exito: true,
            pedido: pedResult.rows[0],
            detalle: detalleResult.rows
        });

    } catch (err) {
        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// Cancelar pedido
app.post('/api/cliente/pedido/cancelar', async (req, res) => {
    let conn;
    try {
        const { idPedido } = req.body;

        if (!idPedido) {
            return res.status(400).json({
                exito: false,
                error: 'idPedido es obligatorio'
            });
        }

        conn = await getDbConnection();

        await conn.execute(
            `BEGIN
                CANCELAR_PEDIDO(:idPedido);
             END;`,
            [idPedido]
        );

        return res.json({
            exito: true,
            mensaje: 'Pedido cancelado y stock/saldo devuelto correctamente'
        });

    } catch (err) {
        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// ============================================================
// 3. MÓDULO BILLETERA
// ============================================================

// Consultar saldo y movimientos
app.get('/api/billetera/:idUsuario', async (req, res) => {
    let conn;
    try {
        const idUsuario = req.params.idUsuario;

        conn = await getDbConnection();

        const userResult = await conn.execute(
            `SELECT SALDO_BILLETERA
             FROM USUARIOS
             WHERE ID_USUARIO = :idUsuario`,
            [idUsuario]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                exito: false,
                error: 'Usuario no encontrado'
            });
        }

        const transResult = await conn.execute(
            `SELECT
                ID_TRANSACCION,
                ID_PEDIDO,
                TIPO_TRANSACCION,
                MONTO,
                SALDO_ANTERIOR,
                SALDO_NUEVO,
                TO_CHAR(
                    FECHA_TRANSACCION,
                    'YYYY-MM-DD HH24:MI:SS'
                ) AS FECHA,
                DESCRIPCION
             FROM TRANSACCIONES_BILLETERA
             WHERE ID_USUARIO = :idUsuario
             ORDER BY ID_TRANSACCION DESC`,
            [idUsuario]
        );

        return res.json({
            exito: true,
            saldo: userResult.rows[0].SALDO_BILLETERA,
            transacciones: transResult.rows
        });

    } catch (err) {
        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// Recargar billetera
app.post('/api/billetera/recargar', async (req, res) => {
    let conn;
    try {
        const {
            idUsuario,
            monto,
            descripcion
        } = req.body;

        if (
            !idUsuario ||
            !monto ||
            Number(monto) <= 0
        ) {
            return res.status(400).json({
                exito: false,
                error: 'Monto y usuario válidos son obligatorios'
            });
        }

        conn = await getDbConnection();

        const userRes = await conn.execute(
            `SELECT SALDO_BILLETERA
             FROM USUARIOS
             WHERE ID_USUARIO = :idUsuario
             FOR UPDATE`,
            [idUsuario]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({
                exito: false,
                error: 'Usuario no encontrado'
            });
        }

        const saldoAnterior = userRes.rows[0].SALDO_BILLETERA;
        const saldoNuevo = saldoAnterior + parseFloat(monto);

        await conn.execute(
            `UPDATE USUARIOS
             SET SALDO_BILLETERA = :saldoNuevo
             WHERE ID_USUARIO = :idUsuario`,
            [
                saldoNuevo,
                idUsuario
            ]
        );

        await conn.execute(
            `INSERT INTO TRANSACCIONES_BILLETERA (
                ID_USUARIO,
                ID_PEDIDO,
                TIPO_TRANSACCION,
                MONTO,
                SALDO_ANTERIOR,
                SALDO_NUEVO,
                DESCRIPCION
             )
             VALUES (
                :idUsuario,
                NULL,
                'RECARGA',
                :monto,
                :saldoAnterior,
                :saldoNuevo,
                :descripcion
             )`,
            [
                idUsuario,
                monto,
                saldoAnterior,
                saldoNuevo,
                descripcion || 'Recarga de saldo en billetera'
            ]
        );

        await conn.commit();

        return res.json({
            exito: true,
            mensaje: 'Recarga realizada con éxito',
            saldoNuevo
        });

    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (e) {}
        }

        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// ============================================================
// 4. MÓDULO REPARTIDORES
// ============================================================

// Pedidos disponibles
app.get('/api/repartidor/pedidos-disponibles', async (req, res) => {
    let conn;
    try {
        conn = await getDbConnection();

        const result = await conn.execute(
            `SELECT *
             FROM VW_PEDIDOS_COMPLETOS
             WHERE ESTADO IN (
                'PENDIENTE',
                'CONFIRMADO',
                'PREPARANDO'
             )
             AND ID_REPARTIDOR IS NULL`
        );

        return res.json({
            exito: true,
            pedidos: result.rows
        });

    } catch (err) {
        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// Pedidos activos del repartidor (en preparación o en camino)
app.get('/api/repartidor/pedidos-activos/:idRepartidor', async (req, res) => {
    let conn;
    try {
        const idRepartidor = req.params.idRepartidor;
        conn = await getDbConnection();


        const result = await conn.execute(
            `SELECT *
             FROM VW_PEDIDOS_COMPLETOS
             WHERE ESTADO IN ('PREPARANDO', 'EN_CAMINO', 'ACEPTADO', 'DESPACHADO')
               AND ID_REPARTIDOR = :idRepartidor
             ORDER BY ID_PEDIDO DESC`,
            [idRepartidor]
        );

        return res.json({
            exito: true,
            pedidos: result.rows
        });
    } catch (err) {
        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});


// Aceptar pedido
app.post('/api/repartidor/aceptar-pedido', async (req, res) => {
    let conn;
    try {
        const {
            idPedido,
            idRepartidor
        } = req.body;

        if (!idPedido || !idRepartidor) {
            return res.status(400).json({
                exito: false,
                error: 'idPedido e idRepartidor son obligatorios'
            });
        }

        conn = await getDbConnection();

        const result = await conn.execute(
            `UPDATE PEDIDOS
             SET
                ID_REPARTIDOR = :idRepartidor,
                ESTADO = 'PREPARANDO'
             WHERE ID_PEDIDO = :idPedido
               AND ID_REPARTIDOR IS NULL`,
            [
                idRepartidor,
                idPedido
            ],
            {
                autoCommit: true
            }
        );

        if (result.rowsAffected === 0) {
            return res.status(409).json({
                exito: false,
                error: 'El pedido no existe o ya fue asignado'
            });
        }

        return res.json({
            exito: true,
            mensaje: 'Pedido aceptado por el repartidor'
        });

    } catch (err) {
        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// Cambiar estado a EN_CAMINO
app.post('/api/repartidor/despachar', async (req, res) => {
    let conn;
    try {
        const {
            idPedido,
            idRepartidor
        } = req.body;

        if (!idPedido || !idRepartidor) {
            return res.status(400).json({
                exito: false,
                error: 'idPedido e idRepartidor son obligatorios'
            });
        }

        conn = await getDbConnection();

        const result = await conn.execute(
            `UPDATE PEDIDOS
             SET ESTADO = 'EN_CAMINO'
             WHERE ID_PEDIDO = :idPedido
               AND ID_REPARTIDOR = :idRepartidor`,
            [
                idPedido,
                idRepartidor
            ],
            {
                autoCommit: true
            }
        );

        if (result.rowsAffected === 0) {
            return res.status(404).json({
                exito: false,
                error: 'Pedido no encontrado para este repartidor'
            });
        }

        return res.json({
            exito: true,
            mensaje: 'Pedido en camino hacia el cliente'
        });

    } catch (err) {
        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// Entregar pedido
app.post('/api/repartidor/entregar-pedido', async (req, res) => {
    let conn;
    try {
        const {
            idPedido,
            idRepartidor
        } = req.body;

        if (!idPedido || !idRepartidor) {
            return res.status(400).json({
                exito: false,
                error: 'idPedido e idRepartidor son obligatorios'
            });
        }

        conn = await getDbConnection();

        const result = await conn.execute(
            `UPDATE PEDIDOS
             SET ESTADO = 'ENTREGADO'
             WHERE ID_PEDIDO = :idPedido
               AND ID_REPARTIDOR = :idRepartidor`,
            [
                idPedido,
                idRepartidor
            ],
            {
                autoCommit: true
            }
        );

        if (result.rowsAffected === 0) {
            return res.status(404).json({
                exito: false,
                error: 'Pedido no encontrado para este repartidor'
            });
        }

        return res.json({
            exito: true,
            mensaje: 'Pedido entregado exitosamente'
        });

    } catch (err) {
        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// ============================================================
// GEOLOCALIZACIÓN DEL REPARTIDOR (GPS)
// ============================================================

// Guardar/actualizar GPS del repartidor
app.post('/api/repartidor/ubicacion', async (req, res) => {
    let conn;
    try {
        const {
            idRepartidor,
            latitud,
            longitud
        } = req.body;

        if (
            !idRepartidor ||
            latitud === undefined ||
            latitud === null ||
            longitud === undefined ||
            longitud === null
        ) {
            return res.status(400).json({
                exito: false,
                error: 'idRepartidor, latitud y longitud son obligatorios'
            });
        }

        const lat = Number(latitud);
        const lng = Number(longitud);

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng) ||
            lat < -90 ||
            lat > 90 ||
            lng < -180 ||
            lng > 180
        ) {
            return res.status(400).json({
                exito: false,
                error: 'Coordenadas inválidas'
            });
        }

        conn = await getDbConnection();

        const result = await conn.execute(
            `UPDATE REPARTIDORES
             SET
                LATITUD_ACTUAL = :latitud,
                LONGITUD_ACTUAL = :longitud,
                FECHA_UBICACION = SYSTIMESTAMP
             WHERE ID_REPARTIDOR = :idRepartidor`,
            {
                latitud: lat,
                longitud: lng,
                idRepartidor
            },
            {
                autoCommit: true
            }
        );

        if (result.rowsAffected === 0) {
            return res.status(404).json({
                exito: false,
                error: 'Repartidor no encontrado'
            });
        }

        return res.json({
            exito: true,
            mensaje: 'Ubicación actualizada correctamente',
            ubicacion: {
                latitud: lat,
                longitud: lng
            }
        });

    } catch (err) {
        console.error('Error actualizando ubicación del repartidor:', err);
        return res.status(500).json({
            exito: false,
            error: err.message
        });
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch (e) {}
        }
    }
});

// Consultar GPS del repartidor
app.get(
    '/api/repartidor/ubicacion/:idRepartidor',
    async (req, res) => {
        let conn;
        try {
            const idRepartidor = req.params.idRepartidor;

            conn = await getDbConnection();

            const result = await conn.execute(
                `SELECT
                    ID_REPARTIDOR,
                    LATITUD_ACTUAL,
                    LONGITUD_ACTUAL,
                    FECHA_UBICACION
                 FROM REPARTIDORES
                 WHERE ID_REPARTIDOR = :idRepartidor`,
                {
                    idRepartidor
                }
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    exito: false,
                    error: 'Repartidor no encontrado'
                });
            }

            return res.json({
                exito: true,
                ubicacion: result.rows[0]
            });

        } catch (err) {
            console.error('Error consultando ubicación del repartidor:', err);
            return res.status(500).json({
                exito: false,
                error: err.message
            });
        } finally {
            if (conn) {
                try {
                    await conn.close();
                } catch (e) {}
            }
        }
    }
);

// ============================================================
// 5. LLAMADAS CON AGORA
// ============================================================

app.post('/api/agora/llamar', async (req, res) => {
    let connection;
    try {
        const {
            idPedido,
            idUsuarioRepartidor
        } = req.body;

        if (
            !idPedido ||
            !idUsuarioRepartidor
        ) {
            return res.status(400).json({
                error: 'Faltan datos obligatorios: idPedido o idUsuarioRepartidor'
            });
        }

        connection = await getDbConnection();

        const result = await connection.execute(
            `SELECT
                ID_PEDIDO,
                ID_CLIENTE,
                CLIENTE,
                REPARTIDOR
             FROM VW_PEDIDOS_COMPLETOS
             WHERE ID_PEDIDO = :id`,
            [idPedido]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'El pedido no existe en la base de datos'
            });
        }

        const pedido = result.rows[0];
        const channelName = `pedido_${idPedido}`;
        const privilegeExpiredTs = Math.floor(Date.now() / 1000) + 3600;

        const token = RtcTokenBuilder.buildTokenWithUid(
            process.env.AGORA_APP_ID,
            process.env.AGORA_APP_CERTIFICATE,
            channelName,
            idUsuarioRepartidor,
            RtcRole.PUBLISHER,
            privilegeExpiredTs
        );

        return res.json({
            exito: true,
            mensaje: 'Llamada iniciada correctamente',
            datos: {
                idPedido: pedido.ID_PEDIDO,
                cliente: pedido.CLIENTE,
                repartidor: pedido.REPARTIDOR,
                channelName,
                token,
                uidRepartidor: idUsuarioRepartidor
            }
        });

    } catch (err) {
        console.error('Error al iniciar llamada:', err);
        return res.status(500).json({
            error: 'Error al procesar la llamada'
        });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (e) {
                console.error(e);
            }
        }
    }
});

app.post('/api/agora/token', async (req, res) => {
    let connection;
    try {
        const {
            idPedido,
            idUsuario,
            role
        } = req.body;

        if (
            !idPedido ||
            !idUsuario ||
            !role
        ) {
            return res.status(400).json({
                error: 'Faltan datos obligatorios: idPedido, idUsuario o role'
            });
        }

        connection = await getDbConnection();

        const result = await connection.execute(
            `SELECT *
             FROM PEDIDOS
             WHERE ID_PEDIDO = :id`,
            [idPedido]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'El pedido no existe'
            });
        }

        const appId = process.env.AGORA_APP_ID;
        const appCertificate = process.env.AGORA_APP_CERTIFICATE;
        const channelName = `pedido_${idPedido}`;
        const privilegeExpiredTs = Math.floor(Date.now() / 1000) + 3600;

        const agoraRole =
            role === 'publisher'
                ? RtcRole.PUBLISHER
                : RtcRole.SUBSCRIBER;

        const token = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            channelName,
            idUsuario,
            agoraRole,
            privilegeExpiredTs
        );

        return res.json({
            token,
            channelName
        });

    } catch (err) {
        console.error('Error al generar token:', err);
        return res.status(500).json({
            error: 'Error al generar el token de Agora'
        });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (e) {}
        }
    }
});

// ============================================================
// 6. PRUEBA DE CONEXIÓN ORACLE CLOUD
// ============================================================

app.get('/api/test-db', async (req, res) => {
    let connection;
    try {
        connection = await getDbConnection();

        const result = await connection.execute(
            `SELECT
                SYSDATE AS FECHA_ACTUAL,
                USER AS USUARIO_CONECTADO
             FROM DUAL`
        );

        return res.json({
            Estado: 'Conexión Exitosa 🚀',
            BaseDeDatos: 'Oracle Autonomous Database Cloud',
            Datos: result.rows[0]
        });

    } catch (err) {
        return res.status(500).json({
            Estado: 'Error de Conexión ❌',
            error: err.message
        });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (e) {}
        }
    }
});

// ============================================================
// INICIALIZAR SERVIDOR
// ============================================================

const PORT = process.env.PORT || 3000;

app.listen(
    PORT,
    '0.0.0.0',
    () => {
        console.log(`Servidor FarmaClick ejecutándose correctamente en el puerto ${PORT}`);
    }
);





