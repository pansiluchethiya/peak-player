'use strict';

// Thumbnail sprite endpoints. POST resolves the first playable source for a
// title, asks the thumbnail service for a cached sprite, and returns a URL the
// player can use for scrub previews. GET serves the cached JPEG. Both are
// mounted before the API fallthrough so the returned URL is actually servable.

const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_CACHE_DIR } = require('../utils/thumbnailService');

const VALID_TYPES = ['movie', 'tv'];
const NUMERIC_ID_PATTERN = /^\d+$/;
const DEFAULT_SPRITE_DURATION = 600;

function positiveInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value);
  if (!NUMERIC_ID_PATTERN.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function spriteDuration(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_SPRITE_DURATION;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function firstSource(payload) {
  if (!payload || !Array.isArray(payload.sources)) return null;
  return payload.sources.find((source) => source && typeof source.url === 'string' && source.url);
}

function createThumbnailRoutes(app, deps = {}) {
  const { getPlayerStream, getSprite } = deps;
  const cacheDir = deps.cacheDir || DEFAULT_CACHE_DIR;

  app.post('/api/v1/thumbnails/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TYPE',
        message: 'type must be movie or tv',
      });
    }
    if (!NUMERIC_ID_PATTERN.test(String(id))) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ID',
        message: 'id must be a numeric TMDB id',
      });
    }
    const duration = spriteDuration(req.body?.duration);
    if (duration === null) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DURATION',
        message: 'duration must be a positive number of seconds',
      });
    }
    const season = type === 'tv' ? positiveInteger(req.body?.season) ?? 1 : null;
    const episode = type === 'tv' ? positiveInteger(req.body?.episode) ?? 1 : null;

    try {
      const payload = await getPlayerStream({ type, id, season, episode });
      const source = firstSource(payload);
      if (!source) {
        return res.status(502).json({
          success: false,
          error: 'SOURCE_UNAVAILABLE',
          message: 'no playable source is available for this title',
        });
      }
      const sprite = await getSprite({ input: source.url, duration }, { cacheDir });
      return res.json({
        success: true,
        url: `/api/v1/thumbnails/${path.basename(sprite)}`,
      });
    } catch (error) {
      const unavailable = error && error.code === 'FFMPEG_UNAVAILABLE';
      return res.status(unavailable ? 503 : 500).json({
        success: false,
        error: unavailable ? 'FFMPEG_UNAVAILABLE' : 'THUMBNAIL_FAILED',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/api/v1/thumbnails/:file', (req, res) => {
    // `basename` strips any traversal segments before the path join.
    const file = path.basename(String(req.params.file || ''));
    if (!file || file === '.' || file === '..') {
      return res.status(404).json({ success: false, error: 'THUMBNAIL_NOT_FOUND' });
    }
    const target = path.resolve(cacheDir, file);
    try {
      if (!fs.statSync(target).isFile()) {
        return res.status(404).json({ success: false, error: 'THUMBNAIL_NOT_FOUND' });
      }
    } catch {
      return res.status(404).json({ success: false, error: 'THUMBNAIL_NOT_FOUND' });
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(target);
  });
}

module.exports = { createThumbnailRoutes };
