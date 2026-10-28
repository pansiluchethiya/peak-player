import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPreferenceStore } from '../src/components/player/prefs/PreferenceStore';
import { DEFAULT_PREFERENCES, migratePreferences, resolvePreferences } from '../src/components/player/prefs/schema';

describe('preference schema', () => {
  it('drops unknown keys and clamps values', () => {
    const prefs = migratePreferences({ v: 1, volume: 9, speed: 5, unknown: true, captions: { size: 'huge' } });
    assert.equal(prefs.volume, 1);
    assert.equal(prefs.speed, 2);
    assert.equal(prefs.captions.size, 'md');
    assert.equal('unknown' in prefs, false);
  });
  it('defaults to the 360p data cap and keeps legacy caps valid', () => {
    assert.equal(DEFAULT_PREFERENCES.quality, '360p');
    assert.equal(migratePreferences({ v: 1 }).quality, '360p');
    assert.equal(migratePreferences({ v: 1, quality: '720p' }).quality, '720p');
    assert.equal(migratePreferences({ v: 1, quality: '4k' }).quality, '360p');
  });
  it('clamps the caption sync offset to ±10s', () => {
    assert.equal(DEFAULT_PREFERENCES.captions.offset, 0);
    assert.equal(migratePreferences({ v: 1, captions: { offset: 3.5 } }).captions.offset, 3.5);
    assert.equal(migratePreferences({ v: 1, captions: { offset: 99 } }).captions.offset, 10);
    assert.equal(migratePreferences({ v: 1, captions: { offset: -99 } }).captions.offset, -10);
  });
  it('applies provider < partner < user, except locked keys', () => {
    const prefs = resolvePreferences({
      defaults: { ...DEFAULT_PREFERENCES, volume: 0.4, muted: false },
      partner: { volume: 0.7, speed: 1.5 },
      user: { volume: 0.2, speed: 1.25 },
      locked: ['volume'],
    });
    assert.equal(prefs.volume, 0.7);
    assert.equal(prefs.speed, 1.25);
    assert.equal(prefs.muted, false);
  });
  it('falls back to memory when storage throws, warning once', () => {
    let warnings = 0;
    const storage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
    const store = createPreferenceStore({ mode: 'browser', storage, onError: () => { warnings += 1; } });
    assert.equal(store.get().volume, DEFAULT_PREFERENCES.volume);
    store.set({ volume: 0.5 });
    store.set({ volume: 0.6 });
    assert.equal(store.get().volume, 0.6);
    assert.equal(warnings, 1);
  });
});
