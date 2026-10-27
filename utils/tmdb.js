const fetch = (...args) => import('node-fetch').then(m => m.default(...args));
const { getTmdbApiKey } = require('./tmdbKey');

const cache = {
  imdbByTmdb: new Map(),
  details: new Map(),
  episodes: new Map(),
};
const TTL_MS = 6 * 60 * 60 * 1000;
function isFresh(entry) { return entry && (Date.now() - entry.ts) < TTL_MS; }

async function tmdbFetchJson(url) {
  const apiKey = getTmdbApiKey();
  const trimmedKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!trimmedKey) throw new Error('TMDB_API_KEY missing');
  const sep = url.includes('?') ? '&' : '?';
  const full = `${url}${sep}api_key=${trimmedKey}`;
  const res = await fetch(full, { timeout: 15000 });
  if (!res.ok) throw new Error(`TMDB request failed ${res.status}`);
  return res.json();
}
async function getExternalIds(type, tmdbId) {
  const key = `${type}:${tmdbId}`;
  const cached = cache.imdbByTmdb.get(key);
  if (isFresh(cached)) return cached.data;
  const json = await tmdbFetchJson(`https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids`);
  cache.imdbByTmdb.set(key, { data: json, ts: Date.now() });
  return json;
}
async function getDetails(type, tmdbId) {
  const key = `${type}:${tmdbId}:details`;
  const cached = cache.details.get(key);
  if (isFresh(cached)) return cached.data;
  const json = await tmdbFetchJson(`https://api.themoviedb.org/3/${type}/${tmdbId}`);
  cache.details.set(key, { data: json, ts: Date.now() });
  return json;
}
async function resolveImdbId(type, tmdbId) {
  try { const ext = await getExternalIds(type, tmdbId); return ext.imdb_id || null; } catch { return null; }
}
function isRealTmdbKey(key) {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  return Boolean(trimmed) && trimmed.toLowerCase() !== 'your_tmdb_api_key';
}
async function getEpisodeDetails(type, tmdbId, season, episode) {
  if (type !== 'tv') return null;
  const id = String(tmdbId);
  const seasonNumber = String(season);
  const episodeNumber = String(episode);
  if (!/^\d+$/.test(id) || !/^\d+$/.test(seasonNumber) || !/^\d+$/.test(episodeNumber)) return null;
  const key = `${type}:${id}:s${seasonNumber}:e${episodeNumber}`;
  const cached = cache.episodes.get(key);
  if (isFresh(cached)) return cached.data;
  try {
    const json = await tmdbFetchJson(`https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}/episode/${episodeNumber}`);
    cache.episodes.set(key, { data: json, ts: Date.now() });
    return json;
  } catch { return null; }
}
module.exports = { getExternalIds, getDetails, getEpisodeDetails, isRealTmdbKey, resolveImdbId };