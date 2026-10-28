import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { absoluteArtwork } from '../src/lib/artworkUrl';

describe('absoluteArtwork', () => {
  it('expands TMDB poster paths to an absolute image URL', () => {
    assert.equal(
      absoluteArtwork('/jSziioSwPVrOy9Yow3XhWIBDjq1.jpg'),
      'https://image.tmdb.org/t/p/w500/jSziioSwPVrOy9Yow3XhWIBDjq1.jpg',
    );
  });

  it('leaves absolute URLs untouched', () => {
    assert.equal(
      absoluteArtwork('https://cdn.example/poster.jpg'),
      'https://cdn.example/poster.jpg',
    );
  });

  it('drops empty and non-string values', () => {
    assert.equal(absoluteArtwork(''), undefined);
    assert.equal(absoluteArtwork('   '), undefined);
    assert.equal(absoluteArtwork(null), undefined);
    assert.equal(absoluteArtwork(undefined), undefined);
  });
});
