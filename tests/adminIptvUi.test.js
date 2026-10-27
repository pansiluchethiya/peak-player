'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('IPTV admin exposes seed, health, and channel toggles', () => {
  const page = readFileSync('admin/app/iptv/page.tsx', 'utf8');
  assert.match(page, /Seed/);
  assert.match(page, /health/i);
  assert.match(page, /api\/admin\/iptv\/channels/);
  assert.match(page, /PATCH/);
});
test('live page uses the API group field', () => {
  const page = readFileSync('admin/app/live/page.tsx', 'utf8');
  assert.match(page, /c\.group/);
  assert.doesNotMatch(page, /groupTitle/);
});
