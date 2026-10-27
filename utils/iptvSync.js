'use strict';

const { readText } = require('./safeHttp');
const { parseM3u } = require('./iptvParser');
const iptvStore = require('./iptvStore');
const { SEED_PLAYLIST_URL } = iptvStore;

const SYNC_TIMEOUT_MS = 30000;
// The full seed/sync/validate/guide cycle runs every three hours. Health probes
// also have their own backoff, so this is only the outer cadence.
const SYNC_INTERVAL_MS_DEFAULT = 10800000;

let scheduler = null;

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function syncPlaylist(playlistId, { readText: readTextImpl = readText, store = iptvStore } = {}) {
  const playlist = store.getPlaylist(playlistId);
  if (!playlist) return { channelCount: 0, error: 'playlist not found' };
  if (!playlist.enabled) return { channelCount: 0, error: 'playlist disabled' };

  try {
    const res = await readTextImpl(playlist.url, { timeoutMs: SYNC_TIMEOUT_MS, maxBytes: 50 * 1024 * 1024 });
    const parsed = parseM3u(res.text, playlist.url);
    // preserveState keeps operator enable/disable choices and the health history
    // across every sync; replaceChannels would delete and recreate every row.
    store.upsertChannels(
      playlistId,
      parsed.channels.map((ch, index) => ({
        name: ch.name,
        tvgId: ch.tvgId,
        groupTitle: ch.groupTitle,
        logo: ch.logo,
        url: ch.url,
        headers: ch.headers,
        language: ch.language,
        country: ch.country,
        position: index,
      })),
      { preserveState: true },
    );
    store.updatePlaylistSync(playlistId, parsed.channels.length, null);
    return { channelCount: parsed.channels.length, error: null };
  } catch (error) {
    const message = errorMessage(error);
    store.updatePlaylistSync(playlistId, playlist.channelCount, message);
    return { channelCount: 0, error: message };
  }
}

function isEnabledPlaylist(playlist) {
  // Rows from the store carry a boolean; callers/tests may omit the field, which
  // means enabled because a playlist is enabled by default.
  return playlist.enabled !== false && playlist.enabled !== 0;
}

function isSeededPlaylist(playlist) {
  // The iptv-org catalogue is refreshed by seedIptv, never fetched as M3U from
  // the synthetic `seed:iptv-org` URL.
  return playlist.seeded === true || playlist.seeded === 1 || playlist.url === SEED_PLAYLIST_URL;
}

function schedulablePlaylists(playlists) {
  return (playlists || []).filter(
    (playlist) => playlist && isEnabledPlaylist(playlist) && !isSeededPlaylist(playlist),
  );
}

async function syncPlaylists({ listPlaylists, syncPlaylist: syncOne }) {
  const playlists = schedulablePlaylists(listPlaylists());
  const synced = [];
  const failed = [];
  for (const playlist of playlists) {
    try {
      const result = await syncOne(playlist.id);
      if (result && result.error) {
        failed.push({ id: playlist.id, error: result.error });
      } else {
        synced.push({
          id: playlist.id,
          channelCount: result && result.channelCount !== undefined ? result.channelCount : null,
        });
      }
    } catch (error) {
      // One broken provider must never stop the rest of the cycle.
      failed.push({ id: playlist.id, error: errorMessage(error) });
    }
  }
  return { playlists: synced, failed };
}

// Production defaults are resolved lazily so a test can inject every dependency
// without loading the network/DB-backed modules.
function resolveDeps(deps = {}) {
  return {
    seedIptv: deps.seedIptv || (() => require('./iptvSeed').seedIptv({ config: require('./config').config })),
    listPlaylists: deps.listPlaylists || (() => iptvStore.listPlaylists()),
    syncPlaylist: deps.syncPlaylist || syncPlaylist,
    validateDueChannels: deps.validateDueChannels
      || ((options) => require('./iptvValidate').validateDueChannels(options)),
    refreshGuides: deps.refreshGuides
      || ((options) => require('./iptvEpg').refreshGuides(options)),
  };
}

async function runIptvCycle({ now = Date.now(), deps = {} } = {}) {
  const resolved = resolveDeps(deps);

  if (process.env.IPTV_SEED_ENABLED !== 'false') {
    try {
      await resolved.seedIptv();
    } catch (error) {
      // A seed outage must not prevent validation of already-known channels or
      // guide refreshes for operator playlists.
      console.error('[iptvSync] seed error:', errorMessage(error));
    }
  }

  const { playlists, failed } = await syncPlaylists(resolved);
  const validated = await resolved.validateDueChannels({ now });
  const guides = await resolved.refreshGuides({ now });
  return { playlists, failed, validated, guides };
}

async function syncAllPlaylists() {
  const { playlists, failed } = await syncPlaylists({
    listPlaylists: () => iptvStore.listPlaylists(),
    syncPlaylist,
  });
  failed.forEach(({ id, error }) => {
    console.error(`[iptvSync] playlist ${id} sync error:`, error);
  });
  return { playlists, failed };
}

function startIptvScheduler() {
  if (scheduler) return;
  const interval = Number(process.env.IPTV_SYNC_INTERVAL_MS) || SYNC_INTERVAL_MS_DEFAULT;
  // Validate at boot rather than waiting up to three hours: freshly synced
  // channels start as `unknown` and the player only lists `ok` channels.
  runIptvCycle().catch((e) => console.error('[iptvSync] initial cycle error:', errorMessage(e)));
  scheduler = setInterval(() => {
    runIptvCycle().catch((e) => console.error('[iptvSync] scheduled cycle error:', errorMessage(e)));
  }, interval);
  scheduler.unref();
  console.log(`[iptvSync] scheduler started, interval=${interval}ms`);
}

module.exports = {
  runIptvCycle,
  syncPlaylist,
  syncAllPlaylists,
  startIptvScheduler,
  SYNC_TIMEOUT_MS,
  SYNC_INTERVAL_MS_DEFAULT,
};
