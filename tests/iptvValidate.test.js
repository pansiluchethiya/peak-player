'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { probeChannel, validateChannels, validateDueChannels, nextCheckAt } = require('../utils/iptvValidate');

async function fixture(handler) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('206 HLS is ok, 200 HTML is dead, timeout is unknown', async () => {
  const { server, base } = await fixture((req, res) => {
    if (req.url === '/ok') { res.writeHead(206, { 'content-type': 'application/vnd.apple.mpegurl' }); res.end('#EXTM3U'); }
    else if (req.url === '/html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html>error</html>'); }
    else if (req.url === '/dead') { res.writeHead(404); res.end(); }
  });
  try {
    assert.equal((await probeChannel({ url: `${base}/ok` })).status, 'ok');
    assert.equal((await probeChannel({ url: `${base}/html` })).status, 'dead');
    assert.equal((await probeChannel({ url: `${base}/dead` })).status, 'dead');
    assert.equal((await probeChannel({ url: `${base}/slow` }, { timeoutMs: 20 })).status, 'unknown');
  } finally { server.close(); }
});

test('concurrency is bounded', async () => {
  let active = 0, peak = 0;
  const fetch = async () => { active += 1; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 5)); active -= 1; return { status: 200, headers: new Map([['content-type', 'application/vnd.apple.mpegurl']]), body: null }; };
  await validateChannels([{ url: 'a' }, { url: 'b' }, { url: 'c' }, { url: 'd' }], { concurrency: 2, fetch });
  assert.equal(peak, 2);
});

test('backoff grows to 24 hours', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(Date.parse(nextCheckAt('dead', 0, now)) - now, 15 * 60 * 1000);
  assert.equal(Date.parse(nextCheckAt('dead', 2, now)) - now, 60 * 60 * 1000);
  assert.equal(Date.parse(nextCheckAt('dead', 20, now)) - now, 24 * 60 * 60 * 1000);
  assert.equal(Date.parse(nextCheckAt('ok', 0, now)) - now, 24 * 60 * 60 * 1000);
});

test('validateChannels reports every completion and never rejects a failed probe', async () => {
  const fetch = async (url) => {
    if (url === 'bad') throw new TypeError('fetch failed');
    return { status: 200, headers: new Map([['content-type', 'application/vnd.apple.mpegurl']]), body: null };
  };
  const seen = [];
  const results = await validateChannels(
    [{ id: 'a', url: 'a' }, { id: 'b', url: 'bad' }],
    { concurrency: 1, fetch, onResult: (result, channel) => seen.push([channel.id, result.status]) },
  );
  assert.deepEqual(seen, [['a', 'ok'], ['b', 'dead']]);
  assert.deepEqual(results.map((result) => result.status), ['ok', 'dead']);
});

test('validateDueChannels persists health and schedules the next check', async () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  const writes = [];
  const store = {
    listDueChannels: () => [
      { id: 'a', url: 'https://a/1.m3u8', failCount: 0, headers: {} },
      { id: 'b', url: 'https://b/1.m3u8', failCount: 1, headers: {} },
    ],
    setChannelHealth: (id, health) => writes.push({ id, health }),
  };
  const fetch = async (url) => {
    if (url.includes('/b/')) throw new TypeError('fetch failed');
    return { status: 206, headers: new Map([['content-type', 'application/vnd.apple.mpegurl']]), body: null };
  };
  const summary = await validateDueChannels({ store, now, fetch, concurrency: 1 });
  assert.equal(summary.checked, 2);
  const a = writes.find((write) => write.id === 'a').health;
  const b = writes.find((write) => write.id === 'b').health;
  assert.equal(a.status, 'ok');
  assert.equal(a.httpStatus, 206);
  assert.equal(a.failCount, 0);
  assert.equal(a.checkedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(a.nextCheckAt, '2026-01-02T00:00:00.000Z');
  assert.equal(b.status, 'dead');
  assert.equal(b.failCount, 2);
  assert.equal(b.nextCheckAt, '2026-01-01T01:00:00.000Z');
});
