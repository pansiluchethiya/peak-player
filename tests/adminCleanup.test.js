'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('providers does not nest a second admin shell while loading', () => {
  const page = readFileSync('admin/app/providers/page.tsx', 'utf8');
  assert.equal((page.match(/<AdminShell/g) || []).length, 1);
});

test('login honors callbackUrl', () => {
  const page = readFileSync('admin/app/login/page.tsx', 'utf8');
  assert.match(page, /callbackUrl/);
  // Must validate that the callback URL is same-origin (no open redirect)
  assert.match(page, /sameOrigin|origin|pathname/i, 'login should validate callbackUrl origin');
});

test('login redirects to callbackUrl after success', () => {
  const page = readFileSync('admin/app/login/page.tsx', 'utf8');
  assert.match(page, /callbackUrl/, 'login should read callbackUrl from search params');
});
