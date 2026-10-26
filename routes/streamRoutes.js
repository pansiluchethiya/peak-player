'use strict';

// Routes for the custom player stream API. Both the JSON and the SSE families
// share one handler each, so the two-segment and four-segment URL shapes stay
// in sync. TV season/episode is accepted from the path (legacy) or the query.

const VALID_TYPES = ['movie', 'tv', 'series', 'live_tv'];
const LIVE_ID_PATTERN = /^channel_[a-z0-9-]+_[a-f0-9]+$/;
const NUMERIC_ID_PATTERN = /^\d+$/;

function positiveInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value);
  if (!NUMERIC_ID_PATTERN.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function readSeasonEpisode(req) {
  const rawSeason = req.params.season !== undefined ? req.params.season : req.query.season;
  const rawEpisode = req.params.episode !== undefined ? req.params.episode : req.query.episode;
  return {
    season: positiveInteger(rawSeason),
    episode: positiveInteger(rawEpisode),
  };
}

function readSource(req) {
  const raw = req.query.source;
  if (raw === undefined || raw === null) return undefined;
  return typeof raw === 'string' ? raw : String(raw);
}

function validateTarget(type, id) {
  if (!VALID_TYPES.includes(type)) {
    return { error: 'INVALID_TYPE', message: 'type must be movie, tv, series, or live_tv' };
  }
  if (type === 'live_tv') {
    if (!LIVE_ID_PATTERN.test(String(id))) {
      return { error: 'INVALID_ID', message: 'id must be a channel id (channel_<slug>_<hash>)' };
    }
    return null;
  }
  if (!NUMERIC_ID_PATTERN.test(String(id))) {
    return { error: 'INVALID_ID', message: 'id must be a numeric TMDB id' };
  }
  return null;
}

function sendInvalidSource(res) {
  return res.status(400).json({ success: false, error: 'INVALID_SOURCE' });
}

function sendSseError(res, error, message) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();
  res.write(`event: error\ndata: ${JSON.stringify({ error, message })}\n\n`);
  return res.end();
}

function createStreamRoutes(app, deps = {}) {
  const {
    getPlayerStream,
    getPlayerStreamEvents,
    serverUrl,
    validSource = () => false,
    config,
    onRequest,
    onSources,
    onError,
  } = deps;

  const handleJson = async (req, res) => {
    const { type, id } = req.params;
    const source = readSource(req);
    if (source !== undefined && !validSource(source)) {
      return sendInvalidSource(res);
    }
    const targetError = validateTarget(type, id);
    if (targetError) {
      return res.status(400).json({ error: targetError.error, message: targetError.message });
    }
    const { season, episode } = readSeasonEpisode(req);
    try {
      const payload = await getPlayerStream({
        type,
        id,
        season,
        episode,
        source,
        serverUrl: serverUrl(req),
        config,
      });
      onRequest?.();
      onSources?.(Array.isArray(payload?.sources) ? payload.sources.length : 0);
      res.json(payload);
    } catch (error) {
      if (error?.code === 'INVALID_SOURCE') {
        return sendInvalidSource(res);
      }
      onError?.(error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleEvents = (req, res) => {
    const { type, id } = req.params;
    const source = readSource(req);
    // An invalid source must fail as JSON before any SSE headers are written.
    if (source !== undefined && !validSource(source)) {
      return sendInvalidSource(res);
    }
    const targetError = validateTarget(type, id);
    if (targetError) {
      return sendSseError(res, targetError.error, targetError.message);
    }
    const { season, episode } = readSeasonEpisode(req);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const cancelled = { value: false };
    req.on('close', () => {
      cancelled.value = true;
    });
    req.on('aborted', () => {
      cancelled.value = true;
    });

    const onEvent = (event, data) => {
      if (cancelled.value) return;
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    getPlayerStreamEvents({
      type,
      id,
      season,
      episode,
      source,
      serverUrl: serverUrl(req),
      config,
      onEvent,
      cancelled,
      invalidate: req.query.invalidate === '1' || req.query.invalidate === 'true',
      embed: req.query.embed === '1',
    })
      .then(() => {
        if (!cancelled.value) res.end();
      })
      .catch((error) => {
        if (cancelled.value) return;
        onError?.(error);
        const errorCode = error?.code === 'INVALID_SOURCE' ? 'INVALID_SOURCE' : 'INTERNAL_ERROR';
        const safeMessage = error instanceof Error ? error.message : String(error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: errorCode, message: safeMessage })}\n\n`);
        res.end();
      });
  };

  app.get('/api/v1/stream/events/:type/:id/:season/:episode', handleEvents);
  app.get('/api/v1/stream/events/:type/:id', handleEvents);
  app.get('/api/v1/stream/:type/:id/:season/:episode', handleJson);
  app.get('/api/v1/stream/:type/:id', handleJson);
}

module.exports = { createStreamRoutes };
