'use strict';

const crypto = require('node:crypto');

const MIN_TTL_SECONDS = 60;
const DEFAULT_TTL_SECONDS = 15 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;
const TOKEN_VERSION = 'v1';
const IV_BYTES = 12;

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

function keyFor(secret) {
  return crypto.createHash('sha256').update(String(secret), 'utf8').digest();
}

/**
 * The token is an opaque AES-GCM envelope: `v1.iv.ciphertext.tag`. Nothing in
 * the URL decodes to partner ids, origins, or preferences, so a copied link
 * cannot be mistaken for (or leak) a provider/session cookie.
 */
function encryptPayload(payload, secret) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    TOKEN_VERSION,
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

function decryptPayload(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 4) return { ok: false, error: 'INVALID_TOKEN' };
  const [version, ivPart, cipherPart, tagPart] = parts;
  if (version !== TOKEN_VERSION || !ivPart || !cipherPart || !tagPart) {
    return { ok: false, error: 'INVALID_TOKEN' };
  }

  let iv;
  let ciphertext;
  let tag;
  try {
    iv = Buffer.from(ivPart, 'base64url');
    ciphertext = Buffer.from(cipherPart, 'base64url');
    tag = Buffer.from(tagPart, 'base64url');
  } catch {
    return { ok: false, error: 'INVALID_TOKEN' };
  }
  if (iv.length !== IV_BYTES || tag.length !== 16) {
    return { ok: false, error: 'INVALID_TOKEN' };
  }

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyFor(secret), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const payload = JSON.parse(plaintext);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, error: 'INVALID_PAYLOAD' };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, error: 'INVALID_SIGNATURE' };
  }
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
  return encryptPayload(body, secret);
}

function verifyEmbedToken(token, options = {}) {
  if (!token || typeof token !== 'string') {
    return { ok: false, payload: null, error: 'MISSING_TOKEN' };
  }

  const secret = options.secret || getEmbedTokenSecret();
  if (!secret) {
    return { ok: false, payload: null, error: 'SECRET_MISSING' };
  }

  const decrypted = decryptPayload(token, secret);
  if (!decrypted.ok) {
    return { ok: false, payload: null, error: decrypted.error };
  }

  const payload = decrypted.payload;
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
