const { getDb } = require('./db');
const { encodeChannelId } = require('./iptvId');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS iptv_playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1,
    channel_count INTEGER NOT NULL DEFAULT 0,
    last_sync_at TEXT,
    last_error TEXT
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
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_iptv_channels_group ON iptv_channels(group_title);
  CREATE INDEX IF NOT EXISTS idx_iptv_channels_tvg ON iptv_channels(tvg_id);
`;

function ensureIptvTables() {
  getDb().exec(SCHEMA);
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
    enabled: row.enabled === 1,
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
        ch.enabled === false ? 0 : 1,
        new Date().toISOString(),
      );
    });
  });
  tx();
}

function listChannels(filter = {}) {
  ensureIptvTables();
  const db = getDb();
  const conditions = [];
  const params = [];
  if (!filter.admin) {
    conditions.push('enabled = 1');
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

function listGroups() {
  ensureIptvTables();
  const rows = getDb()
    .prepare('SELECT group_title, COUNT(*) AS c FROM iptv_channels WHERE enabled = 1 GROUP BY group_title ORDER BY group_title')
    .all();
  return rows.map((row) => ({
    id: row.group_title ?? 'ungrouped',
    title: row.group_title ?? 'Ungrouped',
    count: row.c,
  }));
}

module.exports = {
  ensureIptvTables,
  listPlaylists,
  getPlaylist,
  addPlaylist,
  removePlaylist,
  setPlaylistEnabled,
  updatePlaylistSync,
  replaceChannels,
  listChannels,
  listChannelsFlat,
  getChannel,
  setChannelEnabled,
  listGroups,
};
