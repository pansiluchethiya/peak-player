import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatLatency, isBehindLive, liveLatency } from '../src/lib/live';

describe('live helpers', () => {
  it('detects a viewer behind the live edge', () => {
    assert.equal(isBehindLive(100, 130), true);
    assert.equal(isBehindLive(125, 130), false);
    assert.equal(isBehindLive(0, null), false);
  });
  it('reports latency', () => {
    assert.equal(liveLatency(100, 130), 30);
    assert.equal(formatLatency(30, 'en'), '30s behind');
  });
});
