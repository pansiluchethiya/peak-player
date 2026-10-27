import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { messages, t } from '../src/components/player/i18n';

describe('i18n catalogue', () => {
  it('is a typed English catalogue with no empty values', () => {
    assert.equal(messages.play, 'Play');
    assert.equal(messages['guide-unavailable'], 'Guide unavailable');
    for (const value of Object.values(messages)) assert.ok(value.length > 0);
  });
  it('interpolates named params and leaves unknown keys visible', () => {
    assert.equal(t('seconds-behind', { seconds: 30 }), '30s behind');
    assert.equal(t('seconds-behind', { other: 1 }), '{seconds}s behind');
    assert.equal(t('play'), 'Play');
  });
});
