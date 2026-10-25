'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, describe, it } = require('node:test');
const express = require('express');
const fetch = require('node-fetch');
const { createProxyRoutes, processStreamsForProxy, resetProxyRateLimits } = require('../proxy/proxyServer');
const { signProxyParams, signProxyUrl } = require('../utils/proxySigner');

const SECRET = 'proxy-route-test-secret';
process.env.PROXY_SIGNING_SECRET = SECRET;
process.env.PROXY_ALLOW_PRIVATE = '1';
delete process.env.PROXY_ALLOW_UNSIGNED;
delete process.env.DISABLE_CACHE;

const SEGMENT_BYTES = Buffer.alloc(1024, 0x47);
const VIDEO_BYTES = Buffer.from(Array.from({ length: 4096 }, (_, index) => index % 251));
const hits = Object.create(null);

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function rangeResponse(req, res, body, contentType) {
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': String(body.length),
      'Accept-Ranges': 'bytes',
    });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range);
  if (!match) {
    res.writeHead(416, { 'Content-Range': `bytes */${body.length}` });
    return res.end();
  }
  let start = match[1] ? Number.parseInt(match[1], 10) : 0;
  let end = match[2] ? Number.parseInt(match[2], 10) : body.length - 1;
  start = Math.max(0, Math.min(start, body.length - 1));
  end = Math.max(start, Math.min(end, body.length - 1));
  const slice = body.subarray(start, end + 1);
  res.writeHead(206, {
    'Content-Type': contentType,
    'Content-Length': String(slice.length),
    'Content-Range': `bytes ${start}-${end}/${body.length}`,
    'Accept-Ranges': 'bytes',
  });
  return res.end(req.method === 'HEAD' ? undefined : slice);
}

function createFixture() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    hits[url.pathname] = (hits[url.pathname] || 0) + 1;

    if (url.pathname === '/master.m3u8') {
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
      return res.end('#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:4,\nseg.ts\n#EXT-X-ENDLIST\n');
    }
    if (url.pathname === '/cache-master.m3u8') {
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
      return res.end('#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:4,\ncached-seg.ts\n#EXT-X-ENDLIST\n');
    }
    if (url.pathname === '/html.m3u8') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<!doctype html><html><body>Cloudflare challenge</body></html>');
    }
    if (url.pathname === '/seg.ts') {
      res.writeHead(200, { 'Content-Type': 'video/mp2t', 'Content-Length': String(SEGMENT_BYTES.length) });
      return res.end(req.method === 'HEAD' ? undefined : SEGMENT_BYTES);
    }
    if (url.pathname === '/cached-seg.ts') {
      res.writeHead(200, { 'Content-Type': 'video/mp2t', 'Content-Length': String(SEGMENT_BYTES.length) });
      return res.end(req.method === 'HEAD' ? undefined : SEGMENT_BYTES);
    }
    if (url.pathname === '/video.mp4') {
      return rangeResponse(req, res, VIDEO_BYTES, 'video/mp4');
    }
    if (url.pathname === '/sub.vtt') {
      const body = 'WEBVTT\n\n00:00.000 --> 00:02.000\nHello\n';
      res.writeHead(200, { 'Content-Type': 'text/vtt', 'Content-Length': String(Buffer.byteLength(body)) });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    if (url.pathname === '/html-sub.vtt') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<!doctype html><html><body>Not a subtitle</body></html>');
    }
    if (url.pathname === '/echo') {
      const body = JSON.stringify({ headers: req.headers });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(body)),
      });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('not found');
  });
}

describe('media proxy routes', () => {
  let fixtureServer;
  let fixtureUrl;
  let proxyServer;
  let proxyUrl;

  function signed(path, params, options = {}) {
    return `${proxyUrl}${signProxyUrl(path, params, { secret: SECRET, ...options })}`;
  }

  async function waitFor(predicate, timeoutMs = 2000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Timed out waiting for fixture request');
  }

  before(async () => {
    resetProxyRateLimits();
    fixtureServer = createFixture();
    const fixturePort = await listen(fixtureServer);
    fixtureUrl = `http://127.0.0.1:${fixturePort}`;

    const app = express();
    createProxyRoutes(app);
    proxyServer = http.createServer(app);
    const proxyPort = await listen(proxyServer);
    proxyUrl = `http://127.0.0.1:${proxyPort}`;
  });

  after(async () => {
    await close(proxyServer);
    await close(fixtureServer);
  });

  it('rejects requests without a signature', async () => {
    const response = await fetch(`${proxyUrl}/m3u8-proxy?url=${encodeURIComponent(`${fixtureUrl}/master.m3u8`)}`);
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error, 'INVALID_SIGNATURE');
    assert.equal(body.reason, 'missing_signature');
  });

  it('rejects tampered and expired signatures', async () => {
    const signedParams = signProxyParams(
      '/ts-proxy',
      { url: `${fixtureUrl}/seg.ts` },
      { secret: SECRET },
    );
    const tampered = new URL(`${proxyUrl}/ts-proxy`);
    for (const [key, value] of Object.entries({ ...signedParams, url: `${fixtureUrl}/video.mp4` })) {
      tampered.searchParams.set(key, value);
    }
    const tamperedResponse = await fetch(tampered);
    assert.equal(tamperedResponse.status, 403);
    assert.equal((await tamperedResponse.json()).reason, 'invalid_signature');

    const expired = signed('/ts-proxy', { url: `${fixtureUrl}/seg.ts` }, {
      now: Date.now() - 10_000,
      ttlSeconds: 1,
    });
    const expiredResponse = await fetch(expired);
    assert.equal(expiredResponse.status, 403);
    assert.equal((await expiredResponse.json()).reason, 'expired');
  });

  it('rejects private upstreams unless explicitly allowed', async () => {
    delete process.env.PROXY_ALLOW_PRIVATE;
    try {
      const response = await fetch(signed('/ts-proxy', { url: `${fixtureUrl}/seg.ts` }));
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, 'UNSAFE_URL');
    } finally {
      process.env.PROXY_ALLOW_PRIVATE = '1';
    }
  });

  it('applies an origin allowlist instead of wildcard CORS', async () => {
    const url = signed('/m3u8-proxy', { url: `${fixtureUrl}/master.m3u8` });

    const noOrigin = await fetch(url);
    assert.equal(noOrigin.status, 200);
    assert.equal(noOrigin.headers.get('access-control-allow-origin'), null);

    const allowed = await fetch(url, { headers: { Origin: 'http://localhost:3001' } });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:3001');
    assert.match(allowed.headers.get('vary') || '', /Origin/i);

    const blocked = await fetch(url, { headers: { Origin: 'https://evil.example' } });
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).error, 'ORIGIN_NOT_ALLOWED');
  });

  it('rewrites playlists with signed nested URLs and rejects HTML as HLS', async () => {
    const response = await fetch(signed('/m3u8-proxy', { url: `${fixtureUrl}/master.m3u8` }));
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /^#EXTM3U/);
    assert.match(body, /\/ts-proxy\?/);
    assert.match(body, /sig=/);
    assert.match(body, /exp=/);
    assert.doesNotMatch(body, new RegExp(fixtureUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    const html = await fetch(signed('/m3u8-proxy', { url: `${fixtureUrl}/html.m3u8` }));
    assert.equal(html.status, 502);
    const error = await html.json();
    assert.equal(error.error, 'INVALID_PLAYLIST');
    assert.equal(error.reason, 'html_response');
  });

  it('preserves Range requests for direct files and serves cached ranges', async () => {
    const url = signed('/ts-proxy', {
      url: `${fixtureUrl}/video.mp4`,
      clampOpen: '0',
      progressiveOpen: '0',
    });
    const response = await fetch(url, { headers: { Range: 'bytes=10-19' } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), 'bytes 10-19/4096');
    assert.equal(response.headers.get('content-length'), '10');
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    const body = await response.buffer();
    assert.equal(body.length, 10);
    assert.deepEqual(body, VIDEO_BYTES.subarray(10, 20));

    const cacheUrl = signed('/m3u8-proxy', { url: `${fixtureUrl}/cache-master.m3u8` });
    const playlist = await fetch(cacheUrl);
    assert.equal(playlist.status, 200);
    await waitFor(() => (hits['/cached-seg.ts'] || 0) > 0);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const cached = await fetch(
      signed('/ts-proxy', {
        url: `${fixtureUrl}/cached-seg.ts`,
        clampOpen: '0',
        progressiveOpen: '0',
      }),
      { headers: { Range: 'bytes=2-5' } },
    );
    assert.equal(cached.status, 206);
    assert.equal(cached.headers.get('content-range'), 'bytes 2-5/1024');
    assert.equal((await cached.buffer()).length, 4);
  });

  it('forwards only allowlisted upstream headers', async () => {
    const url = signed('/ts-proxy', {
      url: `${fixtureUrl}/echo`,
      noSynth: '1',
      headers: JSON.stringify({
        Referer: 'https://partner.example/watch',
        Origin: 'https://partner.example',
        Cookie: 'session=secret',
        Authorization: 'Bearer secret',
      }),
    });
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.headers.referer, 'https://partner.example/watch');
    assert.equal(payload.headers.origin, 'https://partner.example');
    assert.equal(payload.headers.cookie, undefined);
    assert.equal(payload.headers.authorization, undefined);
    assert.match(payload.headers['user-agent'], /Chrome/);
  });

  it('proxies subtitles with the same guards', async () => {
    const unsigned = await fetch(`${proxyUrl}/sub-proxy?url=${encodeURIComponent(`${fixtureUrl}/sub.vtt`)}`);
    assert.equal(unsigned.status, 403);

    const response = await fetch(signed('/sub-proxy', { url: `${fixtureUrl}/sub.vtt` }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/vtt/);
    assert.match(await response.text(), /^WEBVTT/);

    const html = await fetch(signed('/sub-proxy', { url: `${fixtureUrl}/html-sub.vtt` }));
    assert.equal(html.status, 502);
    assert.equal((await html.json()).error, 'INVALID_SUBTITLE');
  });

  it('builds signed proxy URLs and leaves streams alone without a server URL', () => {
    const streams = [
      {
        url: 'https://cdn.example/movie/master.m3u8',
        headers: { Referer: 'https://partner.example/', Cookie: 'secret=1' },
      },
      { url: 'https://cdn.example/movie/file.mp4' },
    ];
    assert.equal(processStreamsForProxy(streams, ''), streams);
    assert.equal(processStreamsForProxy(streams, null), streams);

    const proxied = processStreamsForProxy(streams, 'https://api.peak.example/');
    assert.match(proxied[0].url, /^https:\/\/api\.peak\.example\/m3u8-proxy\?/);
    assert.match(proxied[0].url, /sig=/);
    assert.match(proxied[0].url, /exp=/);
    assert.match(proxied[1].url, /^https:\/\/api\.peak\.example\/ts-proxy\?/);
    assert.doesNotMatch(proxied[1].url, /force200=1/);

    const headers = JSON.parse(new URL(proxied[0].url).searchParams.get('headers'));
    assert.equal(headers.referer, 'https://partner.example/');
    assert.equal(headers.cookie, undefined);
    assert.ok(headers['user-agent']);
  });
});
