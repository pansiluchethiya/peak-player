'use strict';

// Public media metadata endpoint. The resolver itself owns caching, so this
// route stays a thin validation/envelope layer and never caches responses.

const VALID_TYPES = ['movie', 'tv'];
const NUMERIC_ID_PATTERN = /^\d+$/;

function positiveInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value);
  if (!NUMERIC_ID_PATTERN.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function createMediaRoutes(app, deps = {}) {
  const { getMedia } = deps;

  app.get('/api/v1/media/:type/:id', async (req, res) => {
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

    try {
      const result = await getMedia({
        type,
        id,
        season: positiveInteger(req.query.season),
        episode: positiveInteger(req.query.episode),
      });
      res.json({ success: true, media: result.media });
    } catch (error) {
      const code = error && error.code ? error.code : 'INTERNAL_ERROR';
      const status = code === 'INVALID_MEDIA_TYPE' || code === 'INVALID_MEDIA_ID' ? 400 : 500;
      res.status(status).json({
        success: false,
        error: code,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

module.exports = { createMediaRoutes };
