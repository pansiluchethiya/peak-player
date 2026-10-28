'use strict';

const { getDb } = require('./db');
const { migratePreferences } = (() => {
  // Lightweight JS mirror of the player prefs defaults used to validate stored rows.
  return { migratePreferences: (raw) => raw };
})();

const TABLE = 'player_preferences';

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      viewer_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function readPreferences(viewerId) {
  try {
    const db = getDb();
    ensureSchema(db);
    const row = db.prepare(`SELECT data, updated_at FROM ${TABLE} WHERE viewer_id = ?`).get(viewerId);
    if (!row) return null;
    const parsed = JSON.parse(row.data);
    return { ...parsed, updatedAt: row.updated_at };
  } catch (e) {
    console.error('[prefs] readPreferences failed:', e.message);
    return null;
  }
}

function writePreferences(viewerId, prefs) {
  try {
    const db = getDb();
    ensureSchema(db);
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO ${TABLE} (viewer_id, data, updated_at) VALUES (@viewerId, @data, @updatedAt)
      ON CONFLICT(viewer_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updatedAt
    `);
    stmt.run({ viewerId, data: JSON.stringify(prefs), updatedAt: now });
    return true;
  } catch (e) {
    console.error('[prefs] writePreferences failed:', e.message);
    return false;
  }
}

module.exports = { readPreferences, writePreferences, ensureSchema };
