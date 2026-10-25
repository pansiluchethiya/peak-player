'use strict';

const crypto = require('node:crypto');

const DEFAULT_TTL_SECONDS = 6 * 60 * 60;
let fallbackSecret = null;
let warned = false;

function getProxySecret() {
  const configured = String(process.env.PROXY_SIGNING_SECRET || '').trim();
  if (configured) return configured;

  if (!fallbackSecret) {
    fallbackSecret = crypto.randomBytes(32).toString('hex');
  }
  if (!warned) {
    warned = true;
    console.warn(
      '[proxy] PROXY_SIGNING_SECRET is not set; using an ephemeral signing secret. Set it for stable URLs across restarts.',
    );
  }
  return fallbackSecret;
}

function normalizePath(path) {
  const value = String(path || '/').split('?')[0];
  return value.startsWith('/') ? value : `/${value}`;
}

function canonicalQuery(params) {
  const entries = [];
  const source = params && typeof params === 'object' ? params : {};
  for (const key of Object.keys(source).sort()) {
    if (key === 'sig') continue;
    const value = source[key];
    if (value === undefined || value === null) continue;
    const values = Array.isArray(value) ? value.map(String).sort() : [String(value)];
    for (const item of values) {
      entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
    }
  }
  return entries.join('&');
}

function signatureFor(path, params, secret) {
  const canonical = `${normalizePath(path)}?${canonicalQuery(params)}`;
  return crypto.createHmac('sha256', secret).update(canonical).digest('base64url');
}

function signProxyParams(path, params = {}, options = {}) {
  const secret = options.secret || getProxySecret();
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const ttlSeconds = Number.isFinite(options.ttlSeconds)
    ? Math.max(1, Math.floor(options.ttlSeconds))
    : DEFAULT_TTL_SECONDS;
  const exp = Number.isFinite(Number(params.exp))
    ? Math.floor(Number(params.exp))
    : Math.floor(now / 1000) + ttlSeconds;
  const signed = { ...params, exp: String(exp) };
  delete signed.sig;
  return { ...signed, sig: signatureFor(path, signed, secret) };
}

function buildQuery(params) {
  const entries = [];
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === undefined || value === null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
    }
  }
  return entries.join('&');
}

function signProxyUrl(path, params = {}, options = {}) {
  const signed = signProxyParams(path, params, options);
  const query = buildQuery(signed);
  return `${normalizePath(path)}${query ? `?${query}` : ''}`;
}

function verifyProxyRequest(path, query = {}, options = {}) {
  const secret = options.secret || getProxySecret();
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const signature = query?.sig;

  if (!signature || typeof signature !== 'string') {
    return { ok: false, reason: 'missing_signature' };
  }

  const exp = Number(query?.exp);
  if (!Number.isFinite(exp) || exp * 1000 <= now) {
    return { ok: false, reason: 'expired' };
  }

  const expected = signatureFor(path, query, secret);
  const actualBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (actualBuffer.length !== expectedBuffer.length) {
    return { ok: false, reason: 'invalid_signature' };
  }
  if (!crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return { ok: false, reason: 'invalid_signature' };
  }
  return { ok: true, reason: 'ok' };
}

function verifyProxyQuery(path, query = {}, options = {}) {
  return verifyProxyRequest(path, query, options).ok;
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  canonicalQuery,
  getProxySecret,
  signProxyParams,
  signProxyUrl,
  verifyProxyQuery,
  verifyProxyRequest,
};
