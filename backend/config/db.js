// =============================================
//  Connexion MySQL (pool de connexions)
//  → Remplis tes identifiants dans backend/.env
// =============================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');

// Supporte les deux formats : DB_HOST="monhost" + DB_PORT=3306,
// ou tout-en-un DB_HOST="monhost:3306"
const [dbHost, dbPortFromHost] = (process.env.DB_HOST || 'localhost').split(':');

const pool = mysql.createPool({
  host:     dbHost,
  port:     Number(process.env.DB_PORT || dbPortFromHost || 3306),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'techstore',
  waitForConnections: true,
  connectionLimit: 10,
});

// Petit test de connexion au démarrage (non bloquant)
pool.getConnection()
  .then(conn => {
    console.log(`✅ MySQL connecté (base "${process.env.DB_NAME || 'techstore'}")`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL inaccessible :', err.message);
    console.error('   → Vérifie tes identifiants dans backend/.env');
  });

module.exports = pool;
