const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function dbPath() {
  if (process.env.PEAK_DB_PATH) return process.env.PEAK_DB_PATH;
  return path.join(process.cwd(), 'utils', 'peak.db');
}

function getDb() {
  if (db) return db;
  const file = dbPath();
  if (file !== ':memory:') {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  db = new Database(file);
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  return db;
}

function resetDbForTests() {
  if (db) db.close();
  db = null;
}

module.exports = { getDb, resetDbForTests, dbPath };
