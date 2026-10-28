'use strict';

/**
 * Admin config + management API routes (spec §4, §7, §8, §10).
 *
 * All routes are mounted behind `/api/admin/*` and require auth.
 *
 * Config:
 *   GET  /api/admin/config         — list all config rows
 *   GET  /api/admin/config/:key    — get a specific config value
 *   POST /api/admin/config/:key    — upsert a config value
 *   DELETE /api/admin/config/:key  — remove a config key
 *
 * Feature toggles:
 *   GET  /api/admin/features       — list all 15 feature toggles with defs
 *   POST /api/admin/features       — update one or more toggles
 *
 * Tokens:
 *   GET  /api/admin/tokens         — list all tokens
 *   POST /api/admin/tokens         — create a token
 *   DELETE /api/admin/tokens/:id   — revoke a token
 *
 * Proxies:
 *   GET  /api/admin/proxies        — list all proxies
 *   POST /api/admin/proxies        — create a proxy
 *   DELETE /api/admin/proxies/:id  — revoke a proxy
 *
 * IPTV categories:
 *   GET  /api/admin/iptv/categories — list category toggles
 *   PATCH /api/admin/iptv/categories — update category toggles
 */

const {
  getConfig,
  getAllConfig,
  setConfig,
  deleteConfig,
  ensureFeatureToggles,
  DEFAULT_FEATURE_TOGGLES,
  FEATURE_DEFS,
  listTokens,
  createToken,
  revokeToken,
  getToken,
  listProxies,
  createProxy,
  revokeProxy,
  getProxy,
} = require('../utils/adminConfig');

function createAdminConfigRoutes(app, options = {}) {
  const { requireAuth } = options;

  if (typeof requireAuth !== 'function') {
    throw new Error('createAdminConfigRoutes requires a requireAuth middleware');
  }

  // Seed defaults on first load
  ensureFeatureToggles();

  // --- Config CRUD ---

  app.get('/api/admin/config', requireAuth, (_req, res) => {
    try {
      res.json({ success: true, config: getAllConfig() });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  app.get('/api/admin/config/:key', requireAuth, (req, res) => {
    try {
      const row = getConfig(req.params.key);
      if (!row) {
        return res.status(404).json({ success: false, error: 'CONFIG_NOT_FOUND', message: `No config for key: ${req.params.key}` });
      }
      res.json({ success: true, ...row });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  app.post('/api/admin/config/:key', requireAuth, (req, res) => {
    try {
      const { key } = req.params;
      if (req.body === undefined || req.body === null) {
        return res.status(400).json({ success: false, error: 'INVALID_VALUE', message: 'body must not be null' });
      }
      const result = setConfig(key, req.body);
      res.json({ success: true, ...result });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  app.delete('/api/admin/config/:key', requireAuth, (req, res) => {
    try {
      const deleted = deleteConfig(req.params.key);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'CONFIG_NOT_FOUND' });
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  // --- Feature toggles ---

  app.get('/api/admin/features', requireAuth, (_req, res) => {
    try {
      const toggles = getConfig('feature_toggles');
      const all = toggles ? toggles.value : { ...DEFAULT_FEATURE_TOGGLES };
      res.json({
        success: true,
        features: FEATURE_DEFS.map((f) => ({
          slug: f.slug,
          key: f.key,
          label: f.label,
          description: f.description,
          enabled: all[f.key] !== undefined ? all[f.key] : f.key in DEFAULT_FEATURE_TOGGLES ? DEFAULT_FEATURE_TOGGLES[f.key] : false,
        })),
      });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  app.post('/api/admin/features', requireAuth, (req, res) => {
    try {
      const patch = req.body || {};
      const existing = getConfig('feature_toggles');
      const current = existing ? existing.value : { ...DEFAULT_FEATURE_TOGGLES };
      const merged = { ...current, ...patch };
      setConfig('feature_toggles', merged);
      res.json({ success: true, features: merged });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  // --- Tokens ---

  app.get('/api/admin/tokens', requireAuth, (_req, res) => {
    try {
      res.json({ success: true, tokens: listTokens() });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  app.post('/api/admin/tokens', requireAuth, (req, res) => {
    try {
      const body = req.body || {};
      if (!body.name) {
        return res.status(400).json({ success: false, error: 'MISSING_FIELDS', message: 'name is required' });
      }
      const token = createToken({
        name: body.name,
        partner: body.partner || 'default',
        expiresAt: body.expiresAt,
        allowedOrigins: body.allowedOrigins || [],
        readOnly: body.readOnly || false,
      });
      res.status(201).json({ success: true, token });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  app.delete('/api/admin/tokens/:id', requireAuth, (req, res) => {
    try {
      const revoked = revokeToken(req.params.id);
      if (!revoked) {
        return res.status(404).json({ success: false, error: 'TOKEN_NOT_FOUND' });
      }
      res.json({ success: true, token: revoked });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  // --- Proxies ---

  app.get('/api/admin/proxies', requireAuth, (_req, res) => {
    try {
      res.json({ success: true, proxies: listProxies() });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  app.post('/api/admin/proxies', requireAuth, (req, res) => {
    try {
      const body = req.body || {};
      if (!body.name || !body.upstreamUrl) {
        return res.status(400).json({ success: false, error: 'MISSING_FIELDS', message: 'name and upstreamUrl are required' });
      }
      const proxy = createProxy({
        name: body.name,
        upstreamUrl: body.upstreamUrl,
        headers: body.headers || {},
        corsOrigins: body.corsOrigins || [],
      });
      res.status(201).json({ success: true, proxy });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  app.delete('/api/admin/proxies/:id', requireAuth, (req, res) => {
    try {
      const revoked = revokeProxy(req.params.id);
      if (!revoked) {
        return res.status(404).json({ success: false, error: 'PROXY_NOT_FOUND' });
      }
      res.json({ success: true, proxy: revoked });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  // --- IPTV categories ---

  app.get('/api/admin/iptv/categories', requireAuth, (_req, res) => {
    try {
      const row = getConfig('iptv_categories');
      const categories = row ? row.value : {};
      res.json({ success: true, categories });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  app.patch('/api/admin/iptv/categories', requireAuth, (req, res) => {
    try {
      const body = req.body || {};
      const existing = getConfig('iptv_categories');
      const current = existing ? existing.value : {};
      const merged = { ...current, ...body };
      setConfig('iptv_categories', merged);
      res.json({ success: true, categories: merged });
    } catch (e) {
      res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: e.message });
    }
  });

  return app;
}

module.exports = {
  createAdminConfigRoutes,
  getConfig,
  getAllConfig,
  setConfig,
  deleteConfig,
  ensureFeatureToggles,
  DEFAULT_FEATURE_TOGGLES,
  FEATURE_DEFS,
  listTokens,
  createToken,
  revokeToken,
  getToken,
  listProxies,
  createProxy,
  revokeProxy,
  getProxy,
};
