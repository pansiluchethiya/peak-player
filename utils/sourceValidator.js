'use strict';

const fetch = require('node-fetch');
const { detectContainer, originalUrl } = require('./sourceMetadata');

const DEFAULT_TIMEOUT_MS = 3500;
const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX = 500;
const MAX_TEXT_BYTES = 1024 * 1024;
const ALLOWED_HEADERS = new Set(['referer', 'origin', 'user-agent']);
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const validationCache = new Map();

function now() {
  return Date.now();
}

function isPrivateHostname(hostname) {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host) || /^0\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^(fc|fd|fe80)/.test(host)) return true;
  return false;
}

function isPrivateUrl(url) {
  try {
    return isPrivateHostname(new URL(url).hostname);
  } catch {
    return true;
  }
}

function sanitizeHeaders(raw) {
  const headers = {};
  if (!raw || typeof raw !== 'object') return headers;
  for (const [key, value] of Object.entries(raw)) {
    const name = String(key).toLowerCase();
    if (!ALLOWED_HEADERS.has(name) || value == null) continue;
    headers[name] = String(value);
  }
  if (!headers['user-agent']) headers['user-agent'] = DEFAULT_UA;
  return headers;
}

function fail(status, reason, extra = {}) {
  return {
    ok: false,
    status: Number.isFinite(status) ? status : null,
    reason,
    contentType: extra.contentType || '',
    container: extra.container || '',
    checkedAt: now(),
    cached: false,
  };
}

function ok(status, contentType, container) {
  return {
    ok: true,
    status,
    reason: 'ok',
    contentType: contentType || '',
    container: container || '',
    checkedAt: now(),
    cached: false,
  };
}

function isHtml(body) {
  const value = String(body || '').trimStart().toLowerCase();
  return (
    value.startsWith('<!doctype') ||
    value.startsWith('<html') ||
    value.startsWith('<head') ||
    value.startsWith('<body') ||
    value.startsWith('<!--')
  );
}

function isChallenge(body) {
  const value = String(body || '').toLowerCase();
  return (
    value.includes('attention required') ||
    value.includes('just a moment') ||
    value.includes('enable javascript and cookies') ||
    value.includes('ddos-guard') ||
    value.includes('cf-challenge') ||
    value.includes('cloudflare')
  );
}

function timeoutError() {
  const error = new Error('timeout');
  error.code = 'TIMEOUT';
  return error;
}

async function fetchOnce(url, { headers, deadline, range }) {
  const remaining = deadline - now();
  if (remaining <= 0) throw timeoutError();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    return await fetch(url, {
      method: 'GET',
      headers: range ? { ...headers, range } : headers,
      redirect: 'follow',
      signal: controller.signal,
      size: MAX_TEXT_BYTES,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readText(response) {
  return response.text();
}

async function readPrefix(response, maxBytes = 128) {
  if (!response.body) return '';
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    chunks.push(Buffer.from(chunk));
    total += chunk.length;
    if (total >= maxBytes) break;
  }
  try {
    response.body.destroy();
  } catch {
    // The stream may already be closed.
  }
  return Buffer.concat(chunks).subarray(0, maxBytes).toString('utf8');
}

function playlistLines(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isMasterPlaylist(text) {
  return playlistLines(text).some((line) => line.startsWith('#EXT-X-STREAM-INF'));
}

function firstVariantUri(text) {
  const lines = playlistLines(text);
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith('#EXT-X-STREAM-INF')) continue;
    for (let next = index + 1; next < lines.length; next += 1) {
      if (!lines[next].startsWith('#')) return lines[next];
    }
  }
  return '';
}

function firstMediaUri(text) {
  for (const line of playlistLines(text)) {
    if (line.startsWith('#EXT-X-MAP')) {
      const match = line.match(/URI="([^"]+)"/i);
      if (match) return match[1];
    }
    if (!line.startsWith('#')) return line;
  }
  return '';
}

function resolveUrl(uri, baseUrl) {
  try {
    return new URL(uri, baseUrl).toString();
  } catch {
    return '';
  }
}

function statusReason(status) {
  return `http_${status}`;
}

async function probeBinary(url, { headers, deadline, container, contentType, allowPrivate }) {
  let response;
  try {
    response = await fetchOnce(url, { headers, deadline, range: 'bytes=0-1023' });
  } catch (error) {
    if (error.code === 'TIMEOUT' || error.name === 'AbortError') {
      return fail(null, 'timeout', { container, contentType });
    }
    return fail(null, `network_${error.code || 'error'}`, { container, contentType });
  }

  if (!allowPrivate && isPrivateUrl(response.url)) {
    return fail(null, 'private_host', { container, contentType });
  }
  if (!response.ok) {
    return fail(response.status, statusReason(response.status), {
      container,
      contentType: response.headers.get('content-type') || contentType,
    });
  }
  if (![200, 206].includes(response.status)) {
    return fail(response.status, `unexpected_status_${response.status}`, {
      container,
      contentType: response.headers.get('content-type') || contentType,
    });
  }

  const actualType = response.headers.get('content-type') || contentType || '';
  let prefix;
  try {
    prefix = await readPrefix(response);
  } catch (error) {
    if (error.code === 'TIMEOUT' || error.name === 'AbortError') {
      return fail(null, 'timeout', { container, contentType: actualType });
    }
    return fail(null, `network_${error.code || 'error'}`, { container, contentType: actualType });
  }

  if (isHtml(prefix)) return fail(response.status, 'html_response', { container, contentType: actualType });
  if (isChallenge(prefix)) return fail(response.status, 'challenge', { container, contentType: actualType });
  if (/^text\/html/i.test(actualType)) {
    return fail(response.status, 'html_response', { container, contentType: actualType });
  }

  return ok(response.status, actualType, container);
}

async function validateHls(url, { headers, deadline, allowPrivate }) {
  let currentUrl = url;
  let text;
  let contentType = '';
  let status = null;

  try {
    const response = await fetchOnce(currentUrl, { headers, deadline });
    if (!allowPrivate && isPrivateUrl(response.url)) {
      return fail(null, 'private_host', { container: 'hls' });
    }
    if (!response.ok) {
      return fail(response.status, statusReason(response.status), {
        container: 'hls',
        contentType: response.headers.get('content-type') || '',
      });
    }
    status = response.status;
    contentType = response.headers.get('content-type') || '';
    text = await readText(response);
  } catch (error) {
    if (error.code === 'TIMEOUT' || error.name === 'AbortError') {
      return fail(null, 'timeout', { container: 'hls' });
    }
    return fail(null, `network_${error.code || 'error'}`, { container: 'hls' });
  }

  if (isHtml(text)) return fail(status, 'html_response', { container: 'hls', contentType });
  if (isChallenge(text)) return fail(status, 'challenge', { container: 'hls', contentType });
  if (!playlistLines(text).some((line) => line === '#EXTM3U')) {
    return fail(status, 'not_hls', { container: 'hls', contentType });
  }

  let depth = 0;
  while (isMasterPlaylist(text) && depth < 2) {
    const variant = firstVariantUri(text);
    if (!variant) return fail(status, 'no_variant', { container: 'hls', contentType });
    currentUrl = resolveUrl(variant, currentUrl);
    if (!currentUrl) return fail(status, 'invalid_variant_url', { container: 'hls', contentType });

    try {
      const response = await fetchOnce(currentUrl, { headers, deadline });
      if (!allowPrivate && isPrivateUrl(response.url)) {
        return fail(null, 'private_host', { container: 'hls', contentType });
      }
      if (!response.ok) {
        return fail(response.status, `variant_${statusReason(response.status)}`, {
          container: 'hls',
          contentType,
        });
      }
      contentType = response.headers.get('content-type') || contentType;
      text = await readText(response);
    } catch (error) {
      if (error.code === 'TIMEOUT' || error.name === 'AbortError') {
        return fail(null, 'timeout', { container: 'hls', contentType });
      }
      return fail(null, `network_${error.code || 'error'}`, { container: 'hls', contentType });
    }

    if (isHtml(text)) return fail(status, 'html_response', { container: 'hls', contentType });
    if (isChallenge(text)) return fail(status, 'challenge', { container: 'hls', contentType });
    if (!playlistLines(text).some((line) => line === '#EXTM3U')) {
      return fail(status, 'not_hls', { container: 'hls', contentType });
    }
    depth += 1;
  }

  if (isMasterPlaylist(text)) return fail(status, 'nested_master', { container: 'hls', contentType });

  const segment = firstMediaUri(text);
  if (!segment) return fail(status, 'no_segment', { container: 'hls', contentType });
  const segmentUrl = resolveUrl(segment, currentUrl);
  if (!segmentUrl) return fail(status, 'invalid_segment_url', { container: 'hls', contentType });

  const probe = await probeBinary(segmentUrl, {
    headers,
    deadline,
    container: 'hls',
    contentType,
    allowPrivate,
  });
  if (!probe.ok) {
    return {
      ...probe,
      reason: probe.reason === 'ok' ? 'ok' : `segment_${probe.reason}`,
      contentType: contentType || probe.contentType,
      container: 'hls',
    };
  }

  return ok(status, contentType, 'hls');
}

function cacheKey(stream, url) {
  return `${detectContainer(stream)}:${url}`;
}

function readCache(key) {
  const entry = validationCache.get(key);
  if (!entry) return null;
  if (now() - entry.checkedAt > CACHE_TTL_MS) {
    validationCache.delete(key);
    return null;
  }
  return { ...entry, cached: true };
}

function writeCache(key, result) {
  if (validationCache.size >= CACHE_MAX) {
    const oldest = validationCache.keys().next().value;
    if (oldest) validationCache.delete(oldest);
  }
  validationCache.set(key, { ...result, cached: false });
}

async function validateSource(stream, options = {}) {
  const url = originalUrl(stream);
  const container = detectContainer(stream);
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.max(50, Math.min(15000, options.timeoutMs))
    : DEFAULT_TIMEOUT_MS;
  const useCache = options.cache !== false;
  const allowPrivate = options.allowPrivate === true;

  if (!url || !/^https?:\/\//i.test(url)) {
    return fail(null, 'invalid_url', { container });
  }
  if (!allowPrivate && isPrivateUrl(url)) {
    return fail(null, 'private_host', { container });
  }

  const key = cacheKey(stream, url);
  if (useCache) {
    const cached = readCache(key);
    if (cached) return cached;
  }

  const headers = sanitizeHeaders(stream?.headers);
  const deadline = now() + timeoutMs;
  let result;

  if (container === 'hls') {
    result = await validateHls(url, { headers, deadline, allowPrivate });
  } else {
    result = await probeBinary(url, {
      headers,
      deadline,
      container,
      contentType: '',
      allowPrivate,
    });
  }

  if (useCache) writeCache(key, result);
  return result;
}

function clearValidationCache() {
  validationCache.clear();
}

module.exports = {
  CACHE_MAX,
  CACHE_TTL_MS,
  clearValidationCache,
  isPrivateHostname,
  isPrivateUrl,
  sanitizeHeaders,
  validateSource,
};
