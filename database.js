const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'tokens.db');
const db = new sqlite3.Database(DB_PATH);

// Crear tablas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS tokens (
    client_id TEXT PRIMARY KEY,
    refresh_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  )`);
});

async function saveClient(id, name, email) {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR REPLACE INTO clients (id, name, email) VALUES (?, ?, ?)',
      [id, name, email], (err) => err ? reject(err) : resolve());
  });
}

async function saveToken(clientId, refreshToken) {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR REPLACE INTO tokens (client_id, refresh_token) VALUES (?, ?)',
      [clientId, refreshToken], (err) => err ? reject(err) : resolve());
  });
}

async function getClients() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT c.*, t.refresh_token as has_token 
            FROM clients c 
            LEFT JOIN tokens t ON c.id = t.client_id 
            ORDER BY c.created_at DESC`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getToken(clientId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT refresh_token FROM tokens WHERE client_id = ?', [clientId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.refresh_token : null);
    });
  });
}

module.exports = { saveClient, saveToken, getClients, getToken };