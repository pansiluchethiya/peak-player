'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { artworkCandidates, fallbackArtwork } = require('../utils/artworkResolver');

test('candidates follow the eight-step order without duplicates', () => {
  const media = { poster: { candidates: ['tmdb-poster'] }, backdrop: 'tmdb-backdrop', stills: ['episode-still'], seriesPoster: 'series-poster', type: 'tv', title: 'Show', year: 2020 };
  assert.deepEqual(
    artworkCandidates(media, { partnerPoster: 'partner', providerArtwork: 'provider' }),
    ['partner', 'tmdb-poster', 'tmdb-backdrop', 'episode-still', 'series-poster', 'provider'],
  );
  assert.equal(fallbackArtwork(media).kind, 'generated');
});
