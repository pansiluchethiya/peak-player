'use strict';

// Server-side artwork candidate chain (spec §7.4, steps 1-6). Steps 7 and 8 —
// the generated typographic card and the bundled `/poster-fallback.svg` — are
// client render fallbacks, so they are deliberately not URL candidates here.

function asUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function addCandidate(candidates, value) {
  const url = asUrl(value);
  if (!url || candidates.includes(url)) return;
  candidates.push(url);
}

function artworkCandidates(media, options = {}) {
  const record = media && typeof media === 'object' ? media : {};
  const { partnerPoster, providerArtwork } = options;
  const candidates = [];

  // 1. Partner override.
  addCandidate(candidates, partnerPoster);
  // 2. TMDB poster candidates.
  const posters =
    record.poster && Array.isArray(record.poster.candidates) ? record.poster.candidates : [];
  for (const poster of posters) addCandidate(candidates, poster);
  // 3. Backdrop.
  addCandidate(candidates, record.backdrop);
  // 4. Episode stills.
  if (Array.isArray(record.stills)) {
    for (const still of record.stills) addCandidate(candidates, still);
  }
  // 5. Series poster.
  addCandidate(candidates, record.seriesPoster);
  // 6. Provider artwork (a scraper payload may carry one or a list).
  if (Array.isArray(providerArtwork)) {
    for (const artwork of providerArtwork) addCandidate(candidates, artwork);
  } else {
    addCandidate(candidates, providerArtwork);
  }

  return candidates;
}

function fallbackArtwork(media) {
  const record = media && typeof media === 'object' ? media : {};
  const title = asUrl(record.title) || 'Untitled';
  const rawYear = record.year;
  const year =
    rawYear === undefined || rawYear === null || rawYear === '' ? null : Number(rawYear);
  return {
    kind: 'generated',
    title,
    year: Number.isFinite(year) ? year : null,
    type: asUrl(record.type) || 'movie',
  };
}

module.exports = { artworkCandidates, fallbackArtwork };
