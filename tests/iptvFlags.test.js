'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isEnabled } = require('../public/iptvFlags');

test('enabled flags treat numeric zero and boolean false as disabled', () => {
  assert.equal(isEnabled(0), false);
  assert.equal(isEnabled('0'), false);
  assert.equal(isEnabled(false), false);
  assert.equal(isEnabled('false'), false);
  assert.equal(isEnabled(1), true);
  assert.equal(isEnabled('1'), true);
  assert.equal(isEnabled(true), true);
  assert.equal(isEnabled(undefined), true);
  assert.equal(isEnabled(null), true);
});
