import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { eventsPath } from '../src/lib/api';

describe('stream paths', () => {
  it('uses query params for TV season and episode', () => {
    assert.equal(
      eventsPath({ type: 'tv', id: '1399', season: 2, episode: 3 }),
      '/api/v1/stream/events/tv/1399?season=2&episode=3',
    );
  });
  it('adds the source selector', () => {
    assert.equal(
      eventsPath({ type: 'movie', id: '550' }, { source: 'vixsrc' }),
      '/api/v1/stream/events/movie/550?source=vixsrc',
    );
  });
});
