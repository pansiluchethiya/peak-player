'use strict';

const assert = require('node:assert/strict');
const { describe, it, beforeEach, afterEach } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolate the DB in a temp file for each test run
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'peak-admin-config-'));
process.env.PEAK_DB_PATH = path.join(tmpDir, 'test.db');

// Clear the cached module so db.js picks up PEAK_DB_PATH
delete require.cache[require.resolve('../utils/db')];
delete require.cache[require.resolve('../utils/adminConfig')];

const { getConfig, getAllConfig, setConfig, deleteConfig, ensureFeatureToggles, DEFAULT_FEATURE_TOGGLES } = require('../utils/adminConfig');

describe('admin config DB', () => {
  it('stores and retrieves JSON values by key', () => {
    const result = setConfig('test_key', { hello: 'world' });
    assert.equal(result.key, 'test_key');
    assert.deepEqual(result.value, { hello: 'world' });

    const row = getConfig('test_key');
    assert.equal(row.key, 'test_key');
    assert.deepEqual(row.value, { hello: 'world' });
    assert.equal(typeof row.updatedAt, 'number');
  });

  it('upserts on repeated setConfig', () => {
    setConfig('upsert_key', { v: 1 });
    const r2 = setConfig('upsert_key', { v: 2 });
    assert.deepEqual(r2.value, { v: 2 });
    const row = getConfig('upsert_key');
    assert.deepEqual(row.value, { v: 2 });
  });

  it('returns null for missing keys', () => {
    assert.equal(getConfig('does_not_exist'), null);
  });

  it('getAllConfig returns all rows', () => {
    setConfig('alpha', [1, 2, 3]);
    setConfig('beta', { flag: true });
    const all = getAllConfig();
    assert.ok(Array.isArray(all));
    const keys = all.map((r) => r.key).sort();
    assert.ok(keys.includes('alpha'));
    assert.ok(keys.includes('beta'));

    const alpha = all.find((r) => r.key === 'alpha');
    assert.deepEqual(alpha.value, [1, 2, 3]);
  });

  it('deletes keys', () => {
    setConfig('doomed', { x: 1 });
    assert.ok(getConfig('doomed'));
    const ok = deleteConfig('doomed');
    assert.equal(ok, true);
    assert.equal(getConfig('doomed'), null);
  });

  it('seeds default feature toggles when absent', () => {
    const toggles = ensureFeatureToggles();
    assert.ok(toggles);
    assert.equal(toggles.embed_demo, true);
    assert.equal(toggles.mux_analytics, false);
    assert.equal(toggles.server_switching, true);
  });

  it('does not overwrite existing feature toggles on re-ensure', () => {
    setConfig('feature_toggles', { embed_demo: false, token_auth: true });
    const toggles = ensureFeatureToggles();
    assert.equal(toggles.embed_demo, false); // not overwritten
  });

  it('DEFAULT_FEATURE_TOGGLES has all 15 features', () => {
    assert.equal(Object.keys(DEFAULT_FEATURE_TOGGLES).length, 15);
    assert.ok(DEFAULT_FEATURE_TOGGLES.embed_demo !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.token_auth !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.dubs !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.captions !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.color_filters !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.scrubber_thumbnails !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.audio_boost !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.keyboard_shortcuts !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.stats_overlay !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.chapters !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.quality_selection !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.playback_speed !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.pip !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.mux_analytics !== undefined);
    assert.ok(DEFAULT_FEATURE_TOGGLES.server_switching !== undefined);
  });
});
