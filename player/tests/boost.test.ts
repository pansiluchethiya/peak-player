import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { boostParams } from '../src/components/player/audio/VolumeBoost';

describe('volume boost', () => {
  it('uses linear gain and the safety limiter', () => {
    assert.deepEqual(boostParams(3, false), { gain: 3, limiter: { threshold: -3, knee: 6, ratio: 12, attack: 0.003, release: 0.25 } });
  });
  it('clamps at 300% until unlocked', () => {
    assert.equal(boostParams(5, false).gain, 3);
    assert.equal(boostParams(5, true).gain, 5);
  });
});
