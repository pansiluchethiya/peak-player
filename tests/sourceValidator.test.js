'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, describe, it } = require('node:test');
const { clearValidationCache, validateSource } = require('../utils/sourceValidator');

const MASTER = [
  '#EXTM3U',
  '#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1920x1080,CODECS="avc1.4d401f,mp4a.40.2"',
  '/variant.m3u8',
  '',
].join('\n');

const VARIANT = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-TARGETDURATION:6',
  '#EXTINF:6.0,',
  '/segment.ts',
  '#EXT-X-ENDLIST',
  '',
].join('\n');

let server;
let base;

function listen(serverToStart) {
  return new Promise((resolve, reject) => {
    serverToStart.once('error', reject);
    serverToStart.listen(0, '127.0.0.1', () => {
      serverToStart.off('error', reject);
      resolve();
    });
  });
}

function close(serverToClose) {
  return new Promise((resolve, reject) => {
    serverToClose.close((error) => (error ? reject(error) : resolve()));
  });
}

before(async () => {
  server = http.createServer((req, res) => {
    const path = new URL(req.url, 'http://fixture.local').pathname;
    const send = (status, contentType, body, extraHeaders = {}) => {
      res.writeHead(status, { 'content-type': contentType, ...extraHeaders });
      res.end(body);
    };

    if (path === '/master.m3u8') return send(200, 'application/vnd.apple.mpegurl', MASTER);
    if (path === '/relative.m3u8') {
      return send(
        200,
        'application/vnd.apple.mpegurl',
        '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nvariant.m3u8\n'
      );
    }
    if (path === '/variant.m3u8') {
      if (req.headers['range']) {
        return send(206, 'video/mp2t', Buffer.from([0x47, 0x40, 0x11, 0x10]), {
          'content-range': 'bytes 0-3/188',
        });
      }
      return send(200, 'application/vnd.apple.mpegurl', VARIANT);
    }
    if (path === '/segment.ts') {
      return send(206, 'video/mp2t', Buffer.from([0x47, 0x40, 0x11, 0x10]), {
        'content-range': 'bytes 0-3/188',
      });
    }
    if (path === '/html.m3u8') {
      return send(200, 'text/html', '<!doctype html><html><body>not a playlist</body></html>');
    }
    if (path === '/cloudflare.m3u8') {
      return send(
        200,
        'text/html',
        '<html><head><title>Attention Required! | Cloudflare</title></head></html>'
      );
    }
    if (path === '/not-hls.m3u8') {
      return send(200, 'application/vnd.apple.mpegurl', 'this is not a playlist');
    }
    if (path === '/empty.m3u8') {
      return send(200, 'application/vnd.apple.mpegurl', '#EXTM3U\n#EXT-X-ENDLIST\n');
    }
    if (path === '/movie.mp4') {
      return send(206, 'video/mp4', Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), {
        'content-range': 'bytes 0-7/1024',
      });
    }
    if (path === '/movie.mkv') {
      return send(206, 'video/x-matroska', Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), {
        'content-range': 'bytes 0-3/1024',
      });
    }
    if (path === '/forbidden.mp4') return send(403, 'text/plain', 'forbidden');
    if (path === '/html.mp4') {
      return send(200, 'text/html', '<!doctype html><html><body>error</body></html>');
    }
    if (path === '/slow.mp4') {
      setTimeout(() => send(200, 'video/mp4', Buffer.alloc(8)), 250);
      return;
    }
    return send(404, 'text/plain', 'not found');
  });

  await listen(server);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await close(server);
});

describe('source validator', () => {
  it('accepts a valid HLS master, variant, and segment', async () => {
    const result = await validateSource(
      { url: `${base}/master.m3u8`, codec: 'hls' },
      { allowPrivate: true }
    );
    assert.equal(result.ok, true);
    assert.equal(result.container, 'hls');
    assert.match(result.contentType, /mpegurl/);
  });

  it('resolves relative variant and segment URLs', async () => {
    const result = await validateSource(
      { url: `${base}/relative.m3u8` },
      { allowPrivate: true }
    );
    assert.equal(result.ok, true);
  });

  it('rejects HTML served as HLS', async () => {
    const result = await validateSource(
      { url: `${base}/html.m3u8`, codec: 'hls' },
      { allowPrivate: true }
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /html/);
  });

  it('rejects Cloudflare challenge pages', async () => {
    const result = await validateSource(
      { url: `${base}/cloudflare.m3u8`, codec: 'hls' },
      { allowPrivate: true }
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /challenge|html/);
  });

  it('rejects a body without the HLS header', async () => {
    const result = await validateSource(
      { url: `${base}/not-hls.m3u8`, codec: 'hls' },
      { allowPrivate: true }
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /not_hls/);
  });

  it('rejects a playlist with no playable segment', async () => {
    const result = await validateSource(
      { url: `${base}/empty.m3u8`, codec: 'hls' },
      { allowPrivate: true }
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /segment/);
  });

  it('accepts an MP4 range response', async () => {
    const result = await validateSource(
      { url: `${base}/movie.mp4` },
      { allowPrivate: true }
    );
    assert.equal(result.ok, true);
    assert.equal(result.container, 'mp4');
    assert.equal(result.status, 206);
  });

  it('accepts a reachable MKV but keeps its container', async () => {
    const result = await validateSource(
      { url: `${base}/movie.mkv` },
      { allowPrivate: true }
    );
    assert.equal(result.ok, true);
    assert.equal(result.container, 'mkv');
  });

  it('rejects forbidden and HTML MP4 responses', async () => {
    const forbidden = await validateSource(
      { url: `${base}/forbidden.mp4` },
      { allowPrivate: true }
    );
    assert.equal(forbidden.ok, false);
    assert.match(forbidden.reason, /403/);

    const html = await validateSource(
      { url: `${base}/html.mp4` },
      { allowPrivate: true }
    );
    assert.equal(html.ok, false);
    assert.match(html.reason, /html/);
  });

  it('times out a slow source', async () => {
    const result = await validateSource(
      { url: `${base}/slow.mp4` },
      { allowPrivate: true, timeoutMs: 60 }
    );
    assert.equal(result.ok, false);
    assert.match(result.reason, /timeout/);
  });

  it('caches a result briefly', async () => {
    clearValidationCache();
    const stream = { url: `${base}/master.m3u8`, codec: 'hls' };
    const first = await validateSource(stream, { allowPrivate: true });
    const second = await validateSource(stream, { allowPrivate: true });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.cached, true);
  });

  it('rejects private hosts unless explicitly allowed', async () => {
    const result = await validateSource({ url: `${base}/movie.mp4` });
    assert.equal(result.ok, false);
    assert.match(result.reason, /private/);
  });
});
