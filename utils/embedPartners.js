'use strict';

const crypto = require('node:crypto');

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    if (url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function normalizePartner(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = String(entry.id || '').trim();
  const apiKey = String(entry.apiKey || entry.api_key || '').trim();
  if (!id || apiKey.length < 8) return null;

  const rawOrigins = Array.isArray(entry.origins)
    ? entry.origins
    : entry.origin
      ? [entry.origin]
      : [];
  const origins = Array.from(
    new Set(rawOrigins.map(normalizeOrigin).filter(Boolean)),
  );
  if (!origins.length) return null;

  return {
    id,
    name: String(entry.name || id).trim() || id,
    origins,
    apiKey,
  };
}

function loadPartners(raw = process.env.EMBED_PARTNERS) {
  if (!raw) return [];
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set();
  return parsed
    .map(normalizePartner)
    .filter((partner) => {
      if (!partner || seen.has(partner.id)) return false;
      seen.add(partner.id);
      return true;
    });
}

function parseEmbedPartners(raw = process.env.EMBED_PARTNERS) {
  return loadPartners(raw).map(publicPartner);
}

function publicPartner(partner) {
  if (!partner) return null;
  return {
    id: partner.id,
    name: partner.name,
    origins: [...partner.origins],
  };
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function findPartnerByApiKey(key) {
  const candidate = String(key || '');
  if (!candidate) return null;
  for (const partner of loadPartners()) {
    if (safeEqual(candidate, partner.apiKey)) {
      return publicPartner(partner);
    }
  }
  return null;
}

function getPartner(id) {
  const wanted = String(id || '');
  if (!wanted) return null;
  return publicPartner(parseEmbedPartners().find((partner) => partner.id === wanted));
}

function getPartnerOrigins(id) {
  return getPartner(id)?.origins || [];
}

module.exports = {
  findPartnerByApiKey,
  getPartner,
  getPartnerOrigins,
  normalizeOrigin,
  parseEmbedPartners,
};
