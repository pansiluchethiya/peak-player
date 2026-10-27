import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { artworkGradient, resolveArtwork } from '../src/components/player/artwork/ArtworkChain';

describe('artwork chain', () => {
  it('walks past 404s and decode errors', async () => {
    const seen: string[] = [];
    const load = async (url: string) => { seen.push(url); if (url !== 'b') throw new Error('decode'); return url; };
    assert.equal(await resolveArtwork(['a', 'b', 'c'], { load }), 'b');
    assert.deepEqual(seen, ['a', 'b']);
  });
  it('advances after the 4 second timeout', async () => {
    assert.equal(await resolveArtwork(['slow'], { load: () => new Promise(() => {}), timeoutMs: 5 }), null);
  });
  it('has a deterministic gradient', () => {
    assert.equal(artworkGradient('Fight Club'), artworkGradient('Fight Club'));
    assert.notEqual(artworkGradient('Fight Club'), artworkGradient('Heat'));
  });
});
