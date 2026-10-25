'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  assertSafeUrl,
  isPrivateAddress,
  isPrivateHostname,
  safeFetch,
} = require('../utils/ssrfGuard');

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const privateLookup = async () => [{ address: '10.0.0.7', family: 4 }];

function response(status, headers = {}) {
  return {
    status,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] || null;
      },
    },
  };
}

describe('ssrf guard', () => {
  it('classifies private and public addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '::1',
      'fc00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
    ]) {
      assert.equal(isPrivateAddress(ip), true, ip);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111']) {
      assert.equal(isPrivateAddress(ip), false, ip);
    }
  });

  it('classifies internal hostnames', () => {
    for (const host of ['localhost', 'player.localhost', 'printer.local', 'api.internal', 'router.home.arpa']) {
      assert.equal(isPrivateHostname(host), true, host);
    }
    assert.equal(isPrivateHostname('cdn.example.com'), false);
  });

  it('accepts a public URL after DNS resolution', async () => {
    const url = await assertSafeUrl('https://cdn.example.com/movie.m3u8', { lookup: publicLookup });
    assert.equal(url.hostname, 'cdn.example.com');
  });

  it('rejects private literals, credentials, and non-HTTP protocols', async () => {
    await assert.rejects(
      assertSafeUrl('http://127.0.0.1/secret'),
      (error) => error.code === 'PRIVATE_HOST',
    );
    await assert.rejects(
      assertSafeUrl('http://169.254.169.254/latest/meta-data'),
      (error) => error.code === 'PRIVATE_HOST',
    );
    await assert.rejects(
      assertSafeUrl('https://user:pass@cdn.example.com/file'),
      (error) => error.code === 'INVALID_URL',
    );
    await assert.rejects(
      assertSafeUrl('file:///etc/passwd'),
      (error) => error.code === 'INVALID_PROTOCOL',
    );
    await assert.rejects(
      assertSafeUrl('not a url'),
      (error) => error.code === 'INVALID_URL',
    );
  });

  it('rejects hostnames that resolve to private addresses', async () => {
    await assert.rejects(
      assertSafeUrl('https://rebind.example.com/file', { lookup: privateLookup }),
      (error) => error.code === 'PRIVATE_HOST',
    );
  });

  it('allows private hosts only when explicitly requested', async () => {
    const url = await assertSafeUrl('http://127.0.0.1:8787/file', { allowPrivate: true });
    assert.equal(url.port, '8787');
  });

  it('follows public redirects and blocks a redirect to a private host', async () => {
    const seen = [];
    const fetchImpl = async (url) => {
      seen.push(url);
      if (url === 'https://cdn.example.com/start') {
        return response(302, { location: 'http://127.0.0.1/secret' });
      }
      return response(200);
    };

    await assert.rejects(
      safeFetch('https://cdn.example.com/start', {}, { lookup: publicLookup, fetchImpl }),
      (error) => error.code === 'PRIVATE_HOST',
    );
    assert.deepEqual(seen, ['https://cdn.example.com/start']);
  });

  it('follows a safe redirect and stops after the redirect limit', async () => {
    const fetchImpl = async (url) => {
      if (url === 'https://cdn.example.com/start') {
        return response(302, { location: 'https://cdn.example.com/final' });
      }
      if (url === 'https://cdn.example.com/final') return response(200);
      return response(302, { location: 'https://cdn.example.com/loop' });
    };

    const final = await safeFetch('https://cdn.example.com/start', {}, {
      lookup: publicLookup,
      fetchImpl,
    });
    assert.equal(final.status, 200);

    await assert.rejects(
      safeFetch('https://cdn.example.com/loop', {}, {
        lookup: publicLookup,
        fetchImpl,
        maxRedirects: 1,
      }),
      (error) => error.code === 'TOO_MANY_REDIRECTS',
    );
  });
});
