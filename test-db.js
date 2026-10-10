const oracledb = require('oracledb');
require('dotenv').config();

async function testInsert() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECTION_STRING
    });
    console.log('Connected.');
    
    // Test the insert
    await conn.execute(
        INSERT INTO FARMACIAS (ID_FARMACIA, NOMBRE, NIT, TELEFONO, DIRECCION, HORARIO, ESTADO) VALUES (:id, :nom, 'CF', :tel, :dir, '08:00-20:00', 'ACTIVA'),
        { id: 41, nom: 'Test Farmacia', tel: '123', dir: 'Test' },
        { autoCommit: true }
    );
    console.log('Insert succeeded!');
  } catch(e) {
    console.error('Insert failed:', e.message);
  } finally {
    if (conn) await conn.close();
  }
}
testInsert();
