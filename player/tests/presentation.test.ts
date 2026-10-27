import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { autoplayPolicy, pausedPosterVisible } from '../src/lib/presentation';

describe('autoplay policy', () => {
  it('always starts muted', () => {
    assert.deepEqual(autoplayPolicy({ autoplay: true, muted: false }), { shouldPlay: true, muted: true });
  });
  it('does not autoplay when disabled', () => {
    assert.deepEqual(autoplayPolicy({ autoplay: false, muted: true }), { shouldPlay: false, muted: true });
  });
});

describe('paused poster', () => {
  it('appears at 800 ms only after playback has started', () => {
    assert.equal(pausedPosterVisible(799, true), false);
    assert.equal(pausedPosterVisible(800, true), true);
    assert.equal(pausedPosterVisible(800, false), false);
  });
});
