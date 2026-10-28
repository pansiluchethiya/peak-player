'use strict';

/**
 * Admin config persistence — a single key→JSON table in the SQLite store.
 *
 * Schema (spec §4.2):
 *   CREATE TABLE IF NOT EXISTS peak_config (
 *     key TEXT PRIMARY KEY,
 *     value_json TEXT NOT NULL,
 *     updated_at INTEGER NOT NULL
 *   );
 *
 * Reserved keys:
 *   - feature_toggles  → { "embed_demo": true, ... }
 *   - iptv_categories  → { "sports": true, ... }
 *   - tokens            → array of token definitions
 *   - proxies           → array of proxy definitions
 *
 * @see docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md §4
 */

const { getDb } = require('./db');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS peak_config (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

/** Run the schema once at module load. */
function ensureSchema() {
  const db = getDb();
  db.exec(SCHEMA);
}
ensureSchema();

/** Parse a JSON string from the DB, returning the JS value. */
function parseValue(valueJson) {
  try {
    return JSON.parse(valueJson);
  } catch {
    return null;
  }
}

/** Resolve the config value for `key`, or `null` if missing. */
function getConfig(key) {
  const db = getDb();
  const row = db.prepare('SELECT key, value_json, updated_at FROM peak_config WHERE key = ?').get(key);
  if (!row) return null;
  return { key: row.key, value: parseValue(row.value_json), updatedAt: row.updated_at };
}

/** Get all config rows as an array. */
function getAllConfig() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value_json, updated_at FROM peak_config ORDER BY key').all();
  return rows.map((row) => ({
    key: row.key,
    value: parseValue(row.value_json),
    updatedAt: row.updated_at,
  }));
}

/** Upsert a config value (JSON-serialisable). */
function setConfig(key, value) {
  const db = getDb();
  const valueJson = JSON.stringify(value);
  const now = Date.now();
  db.prepare(
    'INSERT INTO peak_config (key, value_json, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at',
  ).run(key, valueJson, now);
  return { key, value, updatedAt: now };
}

/** Delete a config key. */
function deleteConfig(key) {
  const db = getDb();
  const info = db.prepare('DELETE FROM peak_config WHERE key = ?').run(key);
  return info.changes > 0;
}

/** Default feature toggles (spec §5). */
const DEFAULT_FEATURE_TOGGLES = {
  embed_demo: true,
  token_auth: true,
  dubs: true,
  captions: true,
  color_filters: true,
  scrubber_thumbnails: true,
  audio_boost: true,
  keyboard_shortcuts: true,
  stats_overlay: true,
  chapters: true,
  quality_selection: true,
  playback_speed: true,
  pip: true,
  mux_analytics: false,
  server_switching: true,
};

/** Seed defaults for the feature_toggles key if it does not exist. */
function ensureFeatureToggles() {
  const existing = getConfig('feature_toggles');
  if (!existing) {
    setConfig('feature_toggles', DEFAULT_FEATURE_TOGGLES);
  }
  return getConfig('feature_toggles').value;
}

/** Feature definitions keyed by URL slug (spec §5). */
const FEATURE_DEFS = [
  { slug: 'embed-demo', key: 'embed_demo', label: 'Embed Demo', description: 'Enables the /embed/demo page that mints demo sessions.' },
  { slug: 'token-auth', key: 'token_auth', label: 'Token Auth', description: 'Enables HMAC-SHA256 embed token verification on the player side.' },
  { slug: 'dubs', key: 'dubs', label: 'Dubs', description: 'Enables the DubsMenu for language-specific renditions.' },
  { slug: 'captions', key: 'captions', label: 'Captions', description: 'Enables subtitle track loading and rendering.' },
  { slug: 'color-filters', key: 'color_filters', label: 'Color Filters', description: 'Enables the CSS filter pipeline and WebGL colour pipeline.' },
  { slug: 'scrubber-thumbnails', key: 'scrubber_thumbnails', label: 'Scrubber Thumbnails', description: 'Enables remote VTT sprite previews on hover.' },
  { slug: 'audio-boost', key: 'audio_boost', label: 'Audio Boost', description: 'Enables the VolumeBoost gain node (up to 200%).' },
  { slug: 'keyboard-shortcuts', key: 'keyboard_shortcuts', label: 'Keyboard Shortcuts', description: 'Enables keyboard navigation and hotkeys.' },
  { slug: 'stats-overlay', key: 'stats_overlay', label: 'Stats Overlay', description: 'Enables the StatsOverlay component (bitrate, latency).' },
  { slug: 'chapters', key: 'chapters', label: 'Chapters', description: 'Enables chapter markers and the ChaptersMenu.' },
  { slug: 'quality-selection', key: 'quality_selection', label: 'Quality Selection', description: 'Enables the QualityMenu for manual ABR cap selection.' },
  { slug: 'playback-speed', key: 'playback_speed', label: 'Playback Speed', description: 'Enables the SpeedMenu (0.25x–2x).' },
  { slug: 'pip', key: 'pip', label: 'PiP', description: 'Enables Picture-in-Picture mode.' },
  { slug: 'mux-analytics', key: 'mux_analytics', label: 'Mux Analytics', description: 'Enables Mux data analytics tracking.' },
  { slug: 'server-switching', key: 'server_switching', label: 'Server Switching', description: 'Enables the ServerMenu for manual provider switching.' },
];

/**
 * Token management helpers (spec §7).
 * Tokens stored as a JSON array under the `tokens` config key.
 * Each token: { id, name, partner, expiresAt, allowedOrigins, readOnly, createdAt, lastUsedAt }
 */
const TOKENS_KEY = 'tokens';

function _getTokens() {
  const row = getConfig(TOKENS_KEY);
  return row ? (Array.isArray(row.value) ? row.value : []) : [];
}

function listTokens() {
  return _getTokens();
}

function createToken({ name, partner = 'default', expiresAt, allowedOrigins = [], readOnly = false }) {
  const tokens = _getTokens();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const token = {
    id,
    name: String(name || 'Unnamed token').trim(),
    partner,
    expiresAt: typeof expiresAt === 'string' ? expiresAt : new Date(expiresAt).toISOString(),
    allowedOrigins: Array.isArray(allowedOrigins) ? allowedOrigins : [String(allowedOrigins)],
    readOnly: Boolean(readOnly),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  tokens.push(token);
  setConfig(TOKENS_KEY, tokens);
  return token;
}

function revokeToken(id) {
  const tokens = _getTokens();
  const idx = tokens.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const [revoked] = tokens.splice(idx, 1);
  setConfig(TOKENS_KEY, tokens);
  return revoked;
}

function getToken(id) {
  return _getTokens().find((t) => t.id === id) || null;
}

/**
 * Proxy management helpers (spec §8).
 * Proxies stored as a JSON array under the `proxies` config key.
 * Each proxy: { id, name, upstreamUrl, headers, corsOrigins, createdAt }
 */
const PROXIES_KEY = 'proxies';

function _getProxies() {
  const row = getConfig(PROXIES_KEY);
  return row ? (Array.isArray(row.value) ? row.value : []) : [];
}

function listProxies() {
  return _getProxies();
}

function createProxy({ name, upstreamUrl, headers = {}, corsOrigins = [] }) {
  const proxies = _getProxies();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const proxy = {
    id,
    name: String(name || 'Unnamed proxy').trim(),
    upstreamUrl: String(upstreamUrl || '').trim(),
    headers: typeof headers === 'string' ? parseValue(headers) || {} : headers,
    corsOrigins: Array.isArray(corsOrigins) ? corsOrigins : [String(corsOrigins)],
    createdAt: new Date().toISOString(),
  };
  proxies.push(proxy);
  setConfig(PROXIES_KEY, proxies);
  return proxy;
}

function revokeProxy(id) {
  const proxies = _getProxies();
  const idx = proxies.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const [revoked] = proxies.splice(idx, 1);
  setConfig(PROXIES_KEY, proxies);
  return revoked;
}

function getProxy(id) {
  return _getProxies().find((p) => p.id === id) || null;
}

module.exports = {
  getConfig,
  getAllConfig,
  setConfig,
  deleteConfig,
  ensureFeatureToggles,
  DEFAULT_FEATURE_TOGGLES,
  FEATURE_DEFS,
  SCHEMA,
  // Tokens
  listTokens,
  createToken,
  revokeToken,
  getToken,
  // Proxies
  listProxies,
  createProxy,
  revokeProxy,
  getProxy,
};
