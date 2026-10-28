'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createPreferenceRoutes } = require('../routes/preferenceRoutes');

test('browser mode refuses server storage', async () => {
  const app = express();
  app.use(express.json());
  createPreferenceRoutes(app, { mode: 'browser', store: {} });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/preferences`);
    assert.equal(res.status, 403);
  } finally { server.close(); }
});
