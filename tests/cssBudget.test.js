'use strict';
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
test('css budget passes', () => {
  execFileSync(process.execPath, ['scripts/check-css-size.mjs'], { stdio: 'pipe' });
});
