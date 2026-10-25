const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const MAX_REDIRECTS = 5;
const MAX_BYTES_DEFAULT = 50 * 1024 * 1024;
const ALLOWED_PORTS = new Set(['', '80', '443']);

class UnsafeTargetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsafeTargetError';
  }
}

function isPrivateIPv4(ip) {
  const octets = ip.split('.').map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isBlockedAddress(address) {
  const value = address.replace(/^\[|\]$/g, '').replace(/%.*$/, '').toLowerCase();
  const ipVer = net.isIP(value);
  if (ipVer === 4) return isPrivateIPv4(value);
  if (ipVer !== 6) return true;
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('::ffff:') || value.startsWith('::ffff:0:')) return true;
  if (/^f[cd]/.test(value)) return true;
  if (/^fe[89ab]/.test(value)) return true;
  if (/^ff/.test(value)) return true;
  if (value.startsWith('2001:db8')) return true;
  return false;
}

function isBlockedHostname(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  );
}

function assertSafeTarget(target) {
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new UnsafeTargetError('unsupported target protocol');
  }
  if (!ALLOWED_PORTS.has(target.port)) {
    throw new UnsafeTargetError('target port is not allowed');
  }
  if (target.username || target.password) {
    throw new UnsafeTargetError('credentials in target url are not allowed');
  }
  const hostname = target.hostname.replace(/^\[|\]$/g, '');
  if (isBlockedHostname(hostname)) throw new UnsafeTargetError('target host is not allowed');
  if (net.isIP(hostname) && isBlockedAddress(hostname)) {
    throw new UnsafeTargetError('target host is not allowed');
  }
}

const safeLookup = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) {
      callback(error);
      return;
    }
    if (!addresses || addresses.length === 0) {
      callback(new UnsafeTargetError('target host could not be resolved'), null, 0);
      return;
    }
    if (addresses.some((entry) => isBlockedAddress(entry.address))) {
      callback(new UnsafeTargetError('target host resolves to a private address'), null, 0);
      return;
    }
    const first = addresses.find((entry) => entry.family === 4) || addresses[0];
    if (options.all) {
      callback(null, addresses);
      return;
    }
    callback(null, first.address, first.family);
  });
};

function requestOnce(target, options) {
  return new Promise((resolve, reject) => {
    const isHttps = target.protocol === 'https:';
    const transport = isHttps ? https : http;

    assertSafeTarget(target);

    const request = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname.replace(/^\[|\]$/g, ''),
        port: target.port || (isHttps ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: options.method || 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Encoding': 'identity',
          ...(options.body ? { 'Content-Length': Buffer.byteLength(options.body) } : {}),
          ...options.headers,
        },
        lookup: safeLookup,
        timeout: options.timeoutMs || 15000,
      },
      (response) => resolve({ status: response.statusCode || 0, headers: response.headers, body: response }),
    );

    request.on('timeout', () => {
      request.destroy(new Error('upstream request timed out'));
    });
    request.on('error', reject);

    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

function readStreamToBuffer(stream, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    stream.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        stream.destroy();
        reject(new Error('upstream response is too large'));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

async function openSafe(input, options = {}) {
  let target = typeof input === 'string' ? new URL(input) : input;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertSafeTarget(target);
    const response = await requestOnce(target, options);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.location;
      response.body.resume();
      if (!location) throw new Error('upstream redirect had no location');
      target = new URL(Array.isArray(location) ? location[0] : location, target);
      continue;
    }
    return { status: response.status, headers: response.headers, body: response.body, url: target };
  }

  throw new Error('too many upstream redirects');
}

async function readText(input, options = {}) {
  const response = await openSafe(input, options);
  const buffer = await readStreamToBuffer(response.body, options.maxBytes || MAX_BYTES_DEFAULT);
  return { text: buffer.toString('utf8'), status: response.status, headers: response.headers, url: response.url };
}

module.exports = { safeHttp: { openSafe, readText }, openSafe, readText, UnsafeTargetError, assertSafeTarget };
