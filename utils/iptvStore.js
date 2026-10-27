const { getDb } = require('./db');
const { encodeChannelId } = require('./iptvId');

const SEED_PLAYLIST_NAME = 'iptv-org';
const SEED_PLAYLIST_URL = 'seed:iptv-org';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS iptv_playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1,
    channel_count INTEGER NOT NULL DEFAULT 0,
    last_sync_at TEXT,
    last_error TEXT,
    seeded INTEGER NOT NULL DEFAULT 0,
    guide_url TEXT
  );
  CREATE TABLE IF NOT EXISTS iptv_channels (
    id TEXT PRIMARY KEY,
    playlist_id INTEGER NOT NULL REFERENCES iptv_playlists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tvg_id TEXT,
    group_title TEXT,
    logo TEXT,
    url TEXT NOT NULL,
    headers TEXT,
    language TEXT,
    country TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unknown',
    http_status INTEGER,
    latency_ms INTEGER,
    checked_at TEXT,
    fail_count INTEGER NOT NULL DEFAULT 0,
    next_check_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_iptv_channels_group ON iptv_channels(group_title);
  CREATE INDEX IF NOT EXISTS idx_iptv_channels_tvg ON iptv_channels(tvg_id);
`;

const CHANNEL_HEALTH_COLUMNS = {
  status: 'status',
  httpStatus: 'http_status',
  latencyMs: 'latency_ms',
  checkedAt: 'checked_at',
  failCount: 'fail_count',
  nextCheckAt: 'next_check_at',
};

// Tracks the database instance whose schema is already migrated, so the eight
// PRAGMA checks run once per connection rather than on every store call.
let migratedDb = null;

function toEnabledFlag(value) {
  return value === false || value === 0 || value === '0' || value === 'false' ? 0 : 1;
}

function ensureColumn(table, name, ddl) {
  const db = getDb();
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some((column) => column.name === name)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
  return true;
}

function ensureIptvTables() {
  const db = getDb();
  if (migratedDb === db) return;
  db.exec(SCHEMA);
  // In-place migration for databases created before the IPTV health/seed columns existed.
  ensureColumn('iptv_playlists', 'seeded', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('iptv_playlists', 'guide_url', 'TEXT');
  ensureColumn('iptv_channels', 'status', "TEXT NOT NULL DEFAULT 'unknown'");
  ensureColumn('iptv_channels', 'http_status', 'INTEGER');
  ensureColumn('iptv_channels', 'latency_ms', 'INTEGER');
  ensureColumn('iptv_channels', 'checked_at', 'TEXT');
  ensureColumn('iptv_channels', 'fail_count', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('iptv_channels', 'next_check_at', 'TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_iptv_channels_status ON iptv_channels(status)');
  migratedDb = db;
}

function rowToPlaylist(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    enabled: row.enabled === 1,
    channelCount: row.channel_count,
    lastSyncAt: row.last_sync_at ?? null,
    lastError: row.last_error ?? null,
    seeded: row.seeded === 1,
    guideUrl: row.guide_url ?? null,
    // Snake-case alias so guide consumers can read the column name directly.
    guide_url: row.guide_url ?? null,
  };
}

function rowToChannel(row) {
  let headers = {};
  try {
    headers = JSON.parse(row.headers || '{}');
  } catch {
    headers = {};
  }
  return {
    id: row.id,
    playlistId: row.playlist_id,
    name: row.name,
    tvgId: row.tvg_id ?? null,
    groupTitle: row.group_title ?? null,
    logo: row.logo ?? null,
    url: row.url,
    headers,
    language: row.language ?? null,
    country: row.country ?? null,
    position: row.position,
    enabled: row.enabled,
    status: row.status ?? 'unknown',
    httpStatus: row.http_status ?? null,
    latencyMs: row.latency_ms ?? null,
    checkedAt: row.checked_at ?? null,
    failCount: row.fail_count ?? 0,
    nextCheckAt: row.next_check_at ?? null,
  };
}

function listPlaylists() {
  ensureIptvTables();
  const rows = getDb().prepare('SELECT * FROM iptv_playlists ORDER BY id').all();
  return rows.map(rowToPlaylist);
}

function getPlaylist(id) {
  ensureIptvTables();
  const row = getDb().prepare('SELECT * FROM iptv_playlists WHERE id = ?').get(id);
  return row ? rowToPlaylist(row) : null;
}

function addPlaylist(name, url) {
  ensureIptvTables();
  const res = getDb().prepare('INSERT INTO iptv_playlists (name, url) VALUES (?, ?)').run(name, url);
  return getPlaylist(Number(res.lastInsertRowid));
}

function removePlaylist(id) {
  ensureIptvTables();
  const res = getDb().prepare('DELETE FROM iptv_playlists WHERE id = ?').run(id);
  return res.changes > 0;
}

function setPlaylistEnabled(id, enabled) {
  ensureIptvTables();
  getDb().prepare('UPDATE iptv_playlists SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
}

function updatePlaylistSync(id, channelCount, error) {
  ensureIptvTables();
  getDb()
    .prepare('UPDATE iptv_playlists SET channel_count = ?, last_sync_at = ?, last_error = ? WHERE id = ?')
    .run(channelCount, new Date().toISOString(), error, id);
}

function replaceChannels(playlistId, channels) {
  ensureIptvTables();
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM iptv_channels WHERE playlist_id = ?').run(playlistId);
    const stmt = db.prepare(
      `INSERT INTO iptv_channels (id, playlist_id, name, tvg_id, group_title, logo, url, headers, language, country, position, enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    channels.forEach((ch, index) => {
      const id = ch.id || encodeChannelId(ch.name, ch.url);
      stmt.run(
        id,
        playlistId,
        ch.name,
        ch.tvgId ?? null,
        ch.groupTitle ?? null,
        ch.logo ?? null,
        ch.url,
        JSON.stringify(ch.headers ?? {}),
        ch.language ?? null,
        ch.country ?? null,
        ch.position ?? index,
        toEnabledFlag(ch.enabled),
        new Date().toISOString(),
      );
    });
  });
  tx();
}

function ensureSeedPlaylist({ guideUrl = null } = {}) {
  ensureIptvTables();
  const db = getDb();
  const run = db.transaction(() => {
    let row = db.prepare('SELECT * FROM iptv_playlists WHERE url = ?').get(SEED_PLAYLIST_URL);
    if (!row) {
      db.prepare('INSERT INTO iptv_playlists (name, url, seeded) VALUES (?, ?, 1)')
        .run(SEED_PLAYLIST_NAME, SEED_PLAYLIST_URL);
      row = db.prepare('SELECT * FROM iptv_playlists WHERE url = ?').get(SEED_PLAYLIST_URL);
    } else {
      db.prepare('UPDATE iptv_playlists SET seeded = 1 WHERE id = ?').run(row.id);
    }
    // A missing guide must never erase a URL that is already configured.
    if (guideUrl) {
      db.prepare('UPDATE iptv_playlists SET guide_url = ? WHERE id = ?').run(guideUrl, row.id);
    }
    return db.prepare('SELECT * FROM iptv_playlists WHERE id = ?').get(row.id);
  });
  return rowToPlaylist(run());
}

function normalizeChannel(channel, index) {
  const id = channel.id || encodeChannelId(channel.name, channel.url);
  return {
    id,
    name: channel.name,
    tvgId: channel.tvgId ?? channel.tvg_id ?? null,
    groupTitle: channel.groupTitle ?? channel.group ?? null,
    logo: channel.logo ?? null,
    url: channel.url,
    headers: JSON.stringify(channel.headers ?? {}),
    language: channel.language ?? null,
    country: channel.country ?? null,
    position: channel.position ?? index,
    enabled: toEnabledFlag(channel.enabled),
  };
}

function upsertChannels(playlistId, channels, { preserveState = true } = {}) {
  ensureIptvTables();
  const db = getDb();
  // Duplicate ids in the input: the last one wins.
  const byId = new Map();
  (channels || []).forEach((channel, index) => {
    const normalized = normalizeChannel(channel, index);
    byId.set(normalized.id, normalized);
  });
  const entries = Array.from(byId.values());
  const now = new Date().toISOString();
  const conflictSet = [
    'name = excluded.name',
    'tvg_id = excluded.tvg_id',
    'group_title = excluded.group_title',
    'logo = excluded.logo',
    'url = excluded.url',
    'headers = excluded.headers',
    'language = excluded.language',
    'country = excluded.country',
    'position = excluded.position',
    'updated_at = excluded.updated_at',
  ];
  if (!preserveState) {
    conflictSet.push('enabled = excluded.enabled');
    conflictSet.push("status = 'unknown'");
    conflictSet.push('http_status = NULL');
    conflictSet.push('latency_ms = NULL');
    conflictSet.push('checked_at = NULL');
    conflictSet.push('fail_count = 0');
    conflictSet.push('next_check_at = NULL');
  }
  const run = db.transaction(() => {
    const keep = entries.map((entry) => entry.id);
    if (keep.length) {
      const placeholders = keep.map(() => '?').join(', ');
      db.prepare(`DELETE FROM iptv_channels WHERE playlist_id = ? AND id NOT IN (${placeholders})`)
        .run(playlistId, ...keep);
    } else {
      db.prepare('DELETE FROM iptv_channels WHERE playlist_id = ?').run(playlistId);
    }
    const stmt = db.prepare(
      `INSERT INTO iptv_channels (id, playlist_id, name, tvg_id, group_title, logo, url, headers, language, country, position, enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET ${conflictSet.join(', ')}`,
    );
    entries.forEach((entry) => {
      stmt.run(
        entry.id,
        playlistId,
        entry.name,
        entry.tvgId,
        entry.groupTitle,
        entry.logo,
        entry.url,
        entry.headers,
        entry.language,
        entry.country,
        entry.position,
        entry.enabled,
        now,
      );
    });
  });
  run();
  return entries.length;
}

function setChannelHealth(id, health = {}) {
  ensureIptvTables();
  const assignments = [];
  const params = [];
  Object.entries(CHANNEL_HEALTH_COLUMNS).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(health, key) && health[key] !== undefined) {
      assignments.push(`${column} = ?`);
      params.push(health[key]);
    }
  });
  if (!assignments.length) return false;
  const res = getDb()
    .prepare(`UPDATE iptv_channels SET ${assignments.join(', ')} WHERE id = ?`)
    .run(...params, id);
  return res.changes > 0;
}

function listChannels(filter = {}) {
  ensureIptvTables();
  const db = getDb();
  const conditions = [];
  const params = [];
  // Enabled filtering is opt-in: the store's query API exposes the whole catalogue
  // (health tooling needs disabled rows) while public routes pass `enabled: true`.
  if (filter.enabled === true) {
    conditions.push('enabled = 1');
  } else if (filter.enabled === false) {
    conditions.push('enabled = 0');
  }
  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  if (filter.q) {
    conditions.push('LOWER(name) LIKE ?');
    params.push(`%${filter.q.toLowerCase()}%`);
  }
  if (filter.group) {
    if (filter.group === 'ungrouped') {
      conditions.push('group_title IS NULL');
    } else {
      conditions.push('group_title = ?');
      params.push(filter.group);
    }
  }
  if (filter.cursor) {
    const cursor = Number(filter.cursor);
    if (!Number.isNaN(cursor)) {
      conditions.push('position > ?');
      params.push(cursor);
    }
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 1000);
  const rows = db
    .prepare(`SELECT * FROM iptv_channels ${where} ORDER BY position, name LIMIT ?`)
    .all(...params, limit);
  const channels = rows.map(rowToChannel);
  const nextCursor = rows.length === limit && limit > 0
    ? String(channels[channels.length - 1].position)
    : null;
  return { channels, nextCursor };
}

function listChannelsFlat(filter = {}) {
  const result = listChannels(filter);
  return result.channels;
}

function getChannel(id) {
  ensureIptvTables();
  const row = getDb().prepare('SELECT * FROM iptv_channels WHERE id = ?').get(id);
  return row ? rowToChannel(row) : null;
}

function setChannelEnabled(id, enabled) {
  ensureIptvTables();
  getDb().prepare('UPDATE iptv_channels SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
}

function listGroups(filter = {}) {
  ensureIptvTables();
  const conditions = ['enabled = 1'];
  const params = [];
  // Health filtering is opt-in: the player passes `status: 'ok'`, admin omits it.
  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  const rows = getDb()
    .prepare(`SELECT group_title, COUNT(*) AS c FROM iptv_channels WHERE ${conditions.join(' AND ')} GROUP BY group_title ORDER BY group_title`)
    .all(...params);
  return rows.map((row) => ({
    id: row.group_title ?? 'ungrouped',
    title: row.group_title ?? 'Ungrouped',
    count: row.c,
  }));
}

function toIso(value) {
  if (value === undefined || value === null) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

// Channels the validator should probe: enabled rows whose backoff has elapsed
// (or that have never been checked). Disabled rows stay untouched by the probe.
function listDueChannels({ now = Date.now(), limit = 1000 } = {}) {
  ensureIptvTables();
  const at = toIso(now);
  const cappedLimit = Math.min(Math.max(Math.floor(Number(limit) || 1000), 1), 5000);
  const rows = getDb()
    .prepare(
      `SELECT * FROM iptv_channels
       WHERE enabled = 1 AND (next_check_at IS NULL OR next_check_at <= ?)
       ORDER BY COALESCE(next_check_at, '') ASC, position, name
       LIMIT ?`,
    )
    .all(at, cappedLimit);
  return rows.map(rowToChannel);
}

module.exports = {
  ensureIptvTables,
  ensureSeedPlaylist,
  listPlaylists,
  getPlaylist,
  addPlaylist,
  removePlaylist,
  setPlaylistEnabled,
  updatePlaylistSync,
  replaceChannels,
  upsertChannels,
  setChannelHealth,
  listChannels,
  listChannelsFlat,
  listDueChannels,
  getChannel,
  setChannelEnabled,
  listGroups,
  SEED_PLAYLIST_URL,
  SEED_PLAYLIST_NAME,
};
