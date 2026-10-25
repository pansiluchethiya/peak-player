const { readText, UnsafeTargetError } = require('./safeHttp');
const { parseM3u } = require('./iptvParser');
const { getPlaylist, updatePlaylistSync, replaceChannels } = require('./iptvStore');

const SYNC_TIMEOUT_MS = 30000;
const SYNC_INTERVAL_MS_DEFAULT = 6 * 60 * 60 * 1000;

let scheduler = null;

async function syncPlaylist(playlistId) {
  const playlist = getPlaylist(playlistId);
  if (!playlist) return { channelCount: 0, error: 'playlist not found' };
  if (!playlist.enabled) return { channelCount: 0, error: 'playlist disabled' };

  try {
    const res = await readText(playlist.url, { timeoutMs: SYNC_TIMEOUT_MS, maxBytes: 50 * 1024 * 1024 });
    const parsed = parseM3u(res.text, playlist.url);
    replaceChannels(
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
    );
    updatePlaylistSync(playlistId, parsed.channels.length, null);
    return { channelCount: parsed.channels.length, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updatePlaylistSync(playlistId, playlist.channelCount, message);
    return { channelCount: 0, error: message };
  }
}

async function syncAllPlaylists() {
  const { listPlaylists } = require('./iptvStore');
  const playlists = listPlaylists().filter((p) => p.enabled);
  for (const playlist of playlists) {
    try {
      await syncPlaylist(playlist.id);
    } catch (e) {
      console.error(`[iptvSync] playlist ${playlist.id} sync error:`, e.message);
    }
  }
}

function startIptvScheduler() {
  if (scheduler) return;
  const interval = Number(process.env.IPTV_SYNC_INTERVAL_MS) || SYNC_INTERVAL_MS_DEFAULT;
  syncAllPlaylists().catch((e) => console.error('[iptvSync] initial sync error:', e.message));
  scheduler = setInterval(() => {
    syncAllPlaylists().catch((e) => console.error('[iptvSync] scheduled sync error:', e.message));
  }, interval);
  scheduler.unref();
  console.log(`[iptvSync] scheduler started, interval=${interval}ms`);
}

module.exports = { syncPlaylist, syncAllPlaylists, startIptvScheduler, SYNC_TIMEOUT_MS };
