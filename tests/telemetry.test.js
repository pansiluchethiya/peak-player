'use strict';

const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const {
  getTelemetrySummary,
  recordPlaybackEvent,
  resetTelemetry,
} = require('../utils/telemetry');

beforeEach(() => {
  resetTelemetry();
});

describe('telemetry', () => {
  it('summarizes first-source, first-playable, rebuffer, and provider errors', () => {
    recordPlaybackEvent({ event: 'first_source', provider: 'alpha', value: 420 });
    recordPlaybackEvent({ event: 'first_playable', provider: 'alpha', value: 910 });
    recordPlaybackEvent({ event: 'rebuffer', provider: 'alpha' });
    recordPlaybackEvent({ event: 'error', provider: 'beta' });
    recordPlaybackEvent({ event: 'first_playable', provider: 'beta', value: 1300 });

    const summary = getTelemetrySummary();
    assert.equal(summary.total, 5);
    assert.equal(summary.byEvent.first_source, 1);
    assert.equal(summary.byProvider.alpha, 3);
    assert.equal(summary.byProvider.beta, 2);
    assert.equal(summary.firstSourceMs, 420);
    assert.equal(summary.firstPlayableMs, 1300);
    assert.equal(summary.rebufferCount, 1);
    assert.equal(summary.errorCount, 1);
    assert.ok(summary.lastEventAt);
  });

  it('ignores malformed events and resets cleanly', () => {
    assert.equal(recordPlaybackEvent(null), null);
    assert.equal(recordPlaybackEvent({ provider: 'alpha' }), null);
    recordPlaybackEvent({ event: 'play', provider: 'alpha' });
    resetTelemetry();
    assert.equal(getTelemetrySummary().total, 0);
  });
});
