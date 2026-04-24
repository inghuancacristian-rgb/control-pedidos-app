import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST || 'localhost',
  user: 'root',
  password: process.env.MYSQL_ROOT_PASSWORD || 'root',
  database: 'control_pedidos_app'
});

const [rows] = await connection.execute('SELECT id, username, name, role, loginMethod FROM users WHERE username = ?', ['admin']);
console.log('Admin user:', rows);

const [allUsers] = await connection.execute('SELECT id, username, name, role, loginMethod FROM users');
console.log('All users:', allUsers);

await connection.end();
