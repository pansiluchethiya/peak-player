'use strict';

const DEFAULT_CONCURRENCY = 8;
const DEFAULT_TIMEOUT_MS = 6000;
const OK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const BASE_BACKOFF_MS = 15 * 60 * 1000;
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;
const PROBE_RANGE = 'bytes=0-1';
const PROBE_USER_AGENT = 'PeakIPTV/1.0';
const STREAM_CONTENT_TYPES = ['mpegurl', 'video/', 'application/octet-stream'];
const DUE_CHANNEL_LIMIT = 1000;

function toEpochMs(value, fallback = Date.now()) {
  if (value === undefined || value === null) return fallback;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? fallback : time;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

// utils/config.js owns the defaults; fall back to env/defaults if it cannot load
// (for example in a stripped-down script) so probing never depends on config.
function configDefaults() {
  try {
    const { config } = require('./config');
    return {
      concurrency: positiveNumber(config.iptvValidateConcurrency, DEFAULT_CONCURRENCY),
      timeoutMs: positiveNumber(config.iptvValidateTimeoutMs, DEFAULT_TIMEOUT_MS),
    };
  } catch {
    return {
      concurrency: positiveNumber(process.env.IPTV_VALIDATE_CONCURRENCY, DEFAULT_CONCURRENCY),
      timeoutMs: positiveNumber(process.env.IPTV_VALIDATE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    };
  }
}

function headerValue(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') {
    const value = headers.get(name);
    return value === undefined || value === null ? '' : String(value);
  }
  const wanted = name.toLowerCase();
  const key = Object.keys(headers).find((entry) => entry.toLowerCase() === wanted);
  return key ? String(headers[key] ?? '') : '';
}

function isStreamContentType(contentType) {
  return STREAM_CONTENT_TYPES.some((needle) => contentType.includes(needle));
}

// A 4xx/5xx or an HTML error page is definitively dead. A 2xx/3xx that advertises
// a stream (or omits the content type, common for raw MPEG-TS) is ok; any other
// declared type is left unknown rather than being called dead.
function classifyResponse(status, contentType) {
  const type = String(contentType || '').toLowerCase();
  if (status >= 400) return 'dead';
  if (type.includes('text/html')) return 'dead';
  if (status >= 200 && status < 400) {
    return !type || isStreamContentType(type) ? 'ok' : 'unknown';
  }
  return 'unknown';
}

async function discardBody(response) {
  try {
    const body = response && response.body;
    if (!body) return;
    if (typeof body.cancel === 'function') {
      await body.cancel();
      return;
    }
    if (typeof body.getReader === 'function') {
      await body.getReader().cancel();
      return;
    }
    if (typeof body.destroy === 'function') body.destroy();
  } catch {
    // A body that cannot be drained is irrelevant once the verdict is known.
  }
}

function nextCheckAt(status, failCount = 0, now = Date.now()) {
  const base = toEpochMs(now);
  if (status === 'ok') return new Date(base + OK_INTERVAL_MS).toISOString();
  const failures = Math.max(0, Math.floor(Number(failCount) || 0));
  const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * (2 ** failures));
  return new Date(base + delay).toISOString();
}

async function probeChannel(channel, options = {}) {
  const now = toEpochMs(options.now);
  const checkedAt = new Date(now).toISOString();
  const timeoutMs = positiveNumber(options.timeoutMs, configDefaults().timeoutMs);
  const fetchImpl = options.fetch || globalThis.fetch;
  const url = channel && channel.url;
  const startedAt = Date.now();

  if (!url || typeof fetchImpl !== 'function') {
    return { status: 'unknown', httpStatus: null, latencyMs: 0, checkedAt, error: 'missing url or fetch' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'User-Agent': PROBE_USER_AGENT,
        ...(channel.headers || {}),
        Range: PROBE_RANGE,
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    const latencyMs = Math.max(0, Date.now() - startedAt);
    const httpStatus = Number(response.status) || null;
    const contentType = headerValue(response.headers, 'content-type');
    await discardBody(response);
    return { status: classifyResponse(httpStatus, contentType), httpStatus, latencyMs, checkedAt };
  } catch (error) {
    const latencyMs = Math.max(0, Date.now() - startedAt);
    const aborted = controller.signal.aborted
      || (error && (error.name === 'AbortError' || error.name === 'TimeoutError' || error.code === 'ABORT_ERR'));
    // A failed connection is dead; an aborted probe only tells us it was slow.
    const status = aborted ? 'unknown' : error instanceof TypeError ? 'dead' : 'unknown';
    return {
      status,
      httpStatus: null,
      latencyMs,
      checkedAt,
      error: error && error.message ? String(error.message) : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function validateChannels(channels, options = {}) {
  const list = Array.isArray(channels) ? channels.filter(Boolean) : [];
  const concurrency = Math.min(
    Math.max(1, list.length || 1),
    positiveNumber(options.concurrency, configDefaults().concurrency),
  );
  const results = new Array(list.length);
  let cursor = 0;

  async function worker() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      const channel = list[index];
      let result;
      try {
        result = await probeChannel(channel, options);
      } catch (error) {
        // probeChannel already absorbs failures; this is belt and braces so one
        // channel can never reject the whole run.
        result = {
          status: 'unknown',
          httpStatus: null,
          latencyMs: 0,
          checkedAt: new Date(toEpochMs(options.now)).toISOString(),
          error: error && error.message ? String(error.message) : String(error),
        };
      }
      results[index] = result;
      if (typeof options.onResult === 'function') {
        try {
          await options.onResult(result, channel);
        } catch {
          // A consumer (store write, logging) must not stop the remaining probes.
        }
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function validateDueChannels(options = {}) {
  const store = options.store || require('./iptvStore');
  const now = toEpochMs(options.now);
  const due = store.listDueChannels({ now, limit: options.limit ?? DUE_CHANNEL_LIMIT });

  const results = await validateChannels(due, {
    ...options,
    now,
    onResult: (result, channel) => {
      const failCount = result.status === 'ok' ? 0 : (Number(channel.failCount) || 0) + 1;
      const health = {
        status: result.status,
        httpStatus: result.httpStatus,
        latencyMs: result.latencyMs,
        checkedAt: result.checkedAt,
        failCount,
        nextCheckAt: nextCheckAt(result.status, failCount, now),
      };
      store.setChannelHealth(channel.id, health);
      if (typeof options.onResult === 'function') options.onResult(result, channel, health);
    },
  });

  const summary = { checked: due.length, ok: 0, dead: 0, unknown: 0, results };
  results.forEach((result) => {
    if (summary[result.status] !== undefined) summary[result.status] += 1;
  });
  return summary;
}

module.exports = {
  probeChannel,
  validateChannels,
  validateDueChannels,
  nextCheckAt,
  DEFAULT_CONCURRENCY,
  DEFAULT_TIMEOUT_MS,
  OK_INTERVAL_MS,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
};
