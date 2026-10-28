'use strict';

// Authenticated IPTV administration. Every route here is mounted behind
// `requireAuth`, so a missing session always yields 401 before any store
// access happens.

const CHANNEL_FIELDS = [
  'id', 'name', 'tvgId', 'group', 'group_title', 'logo', 'url',
  'language', 'country', 'position', 'enabled',
  'status', 'httpStatus', 'latencyMs', 'checkedAt', 'failCount', 'nextCheckAt',
];

function isChannelEnabled(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return !(value === '0' || value === 'false');
  return Boolean(value);
}

function listChannelsFlatRow(row) {
  return {
    id: row.id,
    name: row.name,
    tvgId: row.tvg_id,
    group: row.group,
    groupTitle: row.group_title,
    logo: row.logo,
    url: row.url,
    language: row.language,
    country: row.country,
    enabled: row.enabled,
    status: row.status,
    httpStatus: row.http_status,
    latencyMs: row.latency_ms,
    checkedAt: row.checked_at,
    failCount: row.fail_count,
    nextCheckAt: row.next_check_at,
  };
}

function createIptvAdminRoutes(app, options = {}) {
  const {
    store,
    seed,
    requireAuth,
    config = {},
    saveConfigPatch,
  } = options;

  const playlists = [];
  // Seed config helpers (optional: tests usually inject a store without these)
  const getSeedConfig = () => ({
    enabled: config && config.iptvSeedEnabled !== undefined ? config.iptvSeedEnabled : true,
    categories: config && config.iptvSeedCategories ? config.iptvSeedCategories : '*',
    countries: config && config.iptvSeedCountries ? config.iptvSeedCountries : '*',
  });

  const router = app.route ? null : null; // express 4 app.use supports Routers, but we register directly below
  // We need an express Router to mount requireAuth in front of all admin routes.
  const express = require('express');
  const r = express.Router();

  // --- Seed: GET status / PATCH settings ---
  r.get('/seed', (_req, res) => {
    try {
      const playlistsList = store.listPlaylists();
      const totalChannels = playlistsList.reduce((sum, p) => {
        // Best-effort channel count for the seed playlist only.
        if (p.url === 'seed:iptv-org') {
          return sum + (p.channelCount ?? 0);
        }
        return sum;
      }, 0);

      let lastSyncAt = null;
      if (Array.isArray(playlistsList) && playlistsList.length) {
        lastSyncAt = playlistsList
          .map((p) => p.lastSyncAt)
          .filter(Boolean)
          .sort()
          .pop() || null;
      }

      res.json({
        success: true,
        seed: {
          enabled: getSeedConfig().enabled,
          categories: getSeedConfig().categories,
          countries: getSeedConfig().countries,
          lastSyncAt,
          channelCount: totalChannels,
        },
      });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  r.patch('/seed', (req, res) => {
    try {
      const patch = {
        iptvSeedEnabled: getSeedConfig().enabled,
        iptvSeedCategories: getSeedConfig().categories,
        iptvSeedCountries: getSeedConfig().countries,
      };

      const body = req.body || {};
      if (Object.prototype.hasOwnProperty.call(body, 'enabled')) {
        patch.iptvSeedEnabled = body.enabled;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'categories')) {
        patch.iptvSeedCategories = body.categories;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'country')) {
        patch.iptvSeedCountries = body.country;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'countries')) {
        patch.iptvSeedCountries = body.countries;
      }

      if (saveConfigPatch) saveConfigPatch(patch);

      res.json({ success: true, seed: { ...getSeedConfig() } });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  // --- Seed a playlist now (manual "Sync now" for the iptv-org seed) ---
  r.post('/seed/sync', async (req, res) => {
    try {
      if (!seed || !seed.runIptvCycle) {
        const sync = require('./iptvSync').syncPlaylist; // eslint-disable-line
        if (!sync) {
          return res.status(501).json({ success: false, error: 'SEED_UNAVAILABLE' });
        }
      }
      if (seed && typeof seed.syncPlaylist === 'function') {
        const result = await seed.syncPlaylist('seed:iptv-org');
        res.json({ success: true, channelCount: result && result.channelCount !== undefined ? result.channelCount : 0 });
      } else {
        res.status(501).json({ success: false, error: 'SEED_UNAVAILABLE' });
      }
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  // --- Playlists ---
  r.get('/playlists', (_req, res) => {
    try {
      res.json({ success: true, playlists: store.listPlaylists() });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  r.post('/playlists', (req, res) => {
    try {
      const { name, url } = req.body || {};
      if (!name || !url) {
        return res.status(400).json({ success: false, error: 'MISSING_FIELDS', message: 'name and url are required' });
      }
      if (!/^https?:\/\//i.test(url)) {
        return res.status(400).json({ success: false, error: 'INVALID_URL', message: 'url must start with http:// or https://' });
      }
      const playlist = store.addPlaylist(name, url);
      res.json({ success: true, playlist });
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ success: false, error: 'DUPLICATE_URL', message: 'A playlist with this URL already exists' });
      }
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  r.delete('/playlists/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      const removed = store.removePlaylist(id);
      if (!removed) return res.status(404).json({ success: false, error: 'PLAYLIST_NOT_FOUND' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  r.post('/playlists/:id/sync', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const playlist = store.getPlaylist(id);
      if (!playlist) return res.status(404).json({ success: false, error: 'PLAYLIST_NOT_FOUND' });
      const result = await seed.syncPlaylist(id);
      res.json({ success: true, channelCount: result.channelCount, error: result.error });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  r.patch('/playlists/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      const { enabled } = req.body || {};
      if (enabled === null || enabled === undefined || typeof enabled === 'string') {
        return res.status(400).json({ success: false, error: 'INVALID_FIELD', message: 'enabled must be boolean or number' });
      }
      store.setPlaylistEnabled(id, isChannelEnabled(enabled));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  // --- Channels ---
  r.get('/channels', (req, res) => {
    try {
      const q = req.query.q ? String(req.query.q) : undefined;
      const group = req.query.group ? String(req.query.group) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 1000;
      // Admin sees all channels: enabled and dead rows included, with health.
      const channels = store.listChannelsFlat({ q, group, limit });
      res.json({ success: true, channels });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  r.patch('/channels/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body || {};
      if (enabled === null || enabled === undefined || typeof enabled === 'string') {
        return res.status(400).json({ success: false, error: 'INVALID_FIELD', message: 'enabled must be boolean or number' });
      }
      store.setChannelEnabled(id, isChannelEnabled(enabled));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  r.get('/groups', (_req, res) => {
    try {
      res.json({ success: true, groups: store.listGroups() });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  r.get('/channels/:id/health', (req, res) => {
    try {
      const channel = store.getChannel(Number(req.params.id));
      if (!channel) return res.status(404).json({ success: false, error: 'CHANNEL_NOT_FOUND' });
      res.json({ success: true, channel: listChannelsFlatRow(channel) });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  // Mount every IPTV admin route behind requireAuth. `requireAuth` may be a
  // function (the common case) or already-resolved; callers always pass the
  // auth helper.
  if (typeof requireAuth !== 'function') {
    throw new Error('createIptvAdminRoutes requires a requireAuth middleware');
  }
  app.use('/api/admin/iptv', requireAuth, r);

  return r;
}

module.exports = { createIptvAdminRoutes, isChannelEnabled, listChannelsFlatRow };
