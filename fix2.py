import re
with open('FarmaClick-Backend/index.js', 'r', encoding='utf-8') as f:
    js = f.read()

pattern = re.compile(r'conn = await getDbConnection\(\);\s*try \{.*?catch \(e\) \{ return res\.status\(500\).*?\}\s*const result = await conn\.execute\(\s*INSERT INTO PRODUCTOS \([\s\S]*?VALUES \([\s\S]*?:idFarmacia,', re.MULTILINE)

new_code = '''conn = await getDbConnection();
        let finalIdFarmacia = idFarmacia;
        if (idFarmacia != 1) {
            try {
                const check = await conn.execute(SELECT ID_FARMACIA FROM FARMACIAS WHERE NIT = :idStr, { idStr: idFarmacia.toString() });
                if (check.rows && check.rows.length > 0) {
                    finalIdFarmacia = check.rows[0][0] || check.rows[0].ID_FARMACIA || finalIdFarmacia;
                } else {
                    const insertRes = await conn.execute(
                        INSERT INTO FARMACIAS (NOMBRE, NIT, TELEFONO, DIRECCION, HORARIO, ESTADO) VALUES ('Farmacia ' || :idStr, :idStr, '00000000', 'N/A', '08:00-20:00', 'ACTIVA') RETURNING ID_FARMACIA INTO :newId,
                        { idStr: idFarmacia.toString(), newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
                        { autoCommit: true }
                    );
                    finalIdFarmacia = insertRes.outBinds.newId[0];
                }
            } catch (e) {
                console.error("Error linking farmacia:", e);
            }
        }

        const result = await conn.execute(
            INSERT INTO PRODUCTOS (
                ID_FARMACIA,
                NOMBRE,
                DESCRIPCION,
                PRECIO,
                STOCK,
                CATEGORIA,
                ESTADO
             )
             VALUES (
                :finalIdFarmacia,'''

js2 = pattern.sub(new_code, js)

with open('FarmaClick-Backend/index.js', 'w', encoding='utf-8') as f:
    f.write(js2)
