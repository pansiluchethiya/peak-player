'use strict';

const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const {
  DISABLE_AFTER_FAILURES,
  getAllProviderHealth,
  getProviderHealth,
  isProviderHealthy,
  recordProviderResult,
  resetProviderHealth,
} = require('../utils/providerHealth');

describe('provider health', () => {
  beforeEach(() => resetProviderHealth());

  it('starts neutral and healthy', () => {
    const health = getProviderHealth('vaplayer');
    assert.equal(health.samples, 0);
    assert.equal(health.disabled, false);
    assert.equal(isProviderHealthy('vaplayer'), true);
  });

  it('disables a provider after consecutive failures', () => {
    for (let index = 0; index < DISABLE_AFTER_FAILURES; index += 1) {
      recordProviderResult('dahmermovies', { ok: false, error: '403' });
    }
    const health = getProviderHealth('dahmermovies');
    assert.equal(health.disabled, true);
    assert.equal(health.consecutiveFailures, DISABLE_AFTER_FAILURES);
    assert.equal(isProviderHealthy('dahmermovies'), false);
  });

  it('re-enables a provider after a success', () => {
    for (let index = 0; index < DISABLE_AFTER_FAILURES; index += 1) {
      recordProviderResult('dahmermovies', { ok: false });
    }
    recordProviderResult('dahmermovies', { ok: true, latencyMs: 100 });
    assert.equal(getProviderHealth('dahmermovies').disabled, false);
    assert.equal(getProviderHealth('dahmermovies').consecutiveFailures, 0);
  });

  it('reports all providers sorted by name', () => {
    recordProviderResult('vixsrc', { ok: true, latencyMs: 200 });
    recordProviderResult('4khdhub', { ok: false });
    assert.deepEqual(
      getAllProviderHealth().map((item) => item.name),
      ['4khdhub', 'vixsrc'],
    );
  });
});
