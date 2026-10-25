'use strict';

const crypto = require('node:crypto');

const MIN_TTL_SECONDS = 60;
const DEFAULT_TTL_SECONDS = 15 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;

let fallbackSecret = null;
let warned = false;

function getEmbedTokenSecret() {
  const configured = String(process.env.EMBED_TOKEN_SECRET || '').trim();
  if (configured) return configured;

  if (!fallbackSecret) {
    fallbackSecret = crypto.randomBytes(32).toString('hex');
  }
  if (!warned) {
    warned = true;
    console.warn(
      '[embed] EMBED_TOKEN_SECRET is not set; using an ephemeral signing secret. Set it for stable tokens across restarts.',
    );
  }
  return fallbackSecret;
}

function normalizeTtlSeconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_TTL_SECONDS;
  return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(number)));
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function sign(encodedPayload, secret) {
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signEmbedToken(payload = {}, options = {}) {
  const secret = options.secret || getEmbedTokenSecret();
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const ttlSeconds = normalizeTtlSeconds(options.ttlSeconds);
  const issuedAt = Math.floor(now / 1000);
  const body = {
    ...payload,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  };
  const encoded = encodePayload(body);
  return `${encoded}.${sign(encoded, secret)}`;
}

function verifyEmbedToken(token, options = {}) {
  if (!token || typeof token !== 'string') {
    return { ok: false, payload: null, error: 'MISSING_TOKEN' };
  }

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, payload: null, error: 'INVALID_TOKEN' };
  }

  const [encodedPayload, signature] = parts;
  const secret = options.secret || getEmbedTokenSecret();
  if (!safeEqual(signature, sign(encodedPayload, secret))) {
    return { ok: false, payload: null, error: 'INVALID_SIGNATURE' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, payload: null, error: 'INVALID_PAYLOAD' };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, payload: null, error: 'INVALID_PAYLOAD' };
  }

  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp)) {
    return { ok: false, payload, error: 'INVALID_PAYLOAD' };
  }
  if (exp * 1000 <= now) {
    return { ok: false, payload, error: 'EXPIRED' };
  }

  return { ok: true, payload, error: null };
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  MAX_TTL_SECONDS,
  MIN_TTL_SECONDS,
  getEmbedTokenSecret,
  normalizeTtlSeconds,
  signEmbedToken,
  verifyEmbedToken,
};
