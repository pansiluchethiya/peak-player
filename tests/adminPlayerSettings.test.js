'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('advanced settings expose provider autoplay defaults', () => {
  const page = readFileSync('admin/app/advanced/page.tsx', 'utf8');
  assert.match(page, /autoplayMuted/);
  assert.match(page, /autoplay/);
  assert.match(page, /\/api\/config/);
});
