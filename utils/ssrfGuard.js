'use strict';

const dns = require('node:dns').promises;
const net = require('node:net');
const fetch = require('node-fetch');

function privateError(message, code = 'PRIVATE_HOST') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 224 || a >= 240) return true;
  return false;
}

function isPrivateIPv6(ip) {
  const value = ip.toLowerCase().split('%')[0];
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('::ffff:')) {
    return isPrivateIPv4(value.slice('::ffff:'.length));
  }
  if (/^f[cd][0-9a-f]{2}:/.test(value)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(value)) return true;
  if (/^ff[0-9a-f]{2}:/.test(value)) return true;
  if (value.startsWith('2001:db8:')) return true;
  if (value.startsWith('64:ff9b:')) return true;
  return false;
}

function isPrivateAddress(ip) {
  const version = net.isIP(String(ip || ''));
  if (version === 4) return isPrivateIPv4(String(ip));
  if (version === 6) return isPrivateIPv6(String(ip));
  return true;
}

function isPrivateHostname(hostname) {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) return true;
  if (net.isIP(host)) return isPrivateAddress(host);
  return false;
}

async function assertSafeUrl(url, options = {}) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    throw privateError('Invalid URL', 'INVALID_URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw privateError('Only HTTP and HTTPS URLs are allowed', 'INVALID_PROTOCOL');
  }
  if (parsed.username || parsed.password) {
    throw privateError('Credentials in URLs are not allowed', 'INVALID_URL');
  }
  if (isPrivateHostname(parsed.hostname)) {
    if (options.allowPrivate === true) return parsed;
    throw privateError('Private hosts are not allowed', 'PRIVATE_HOST');
  }
  if (options.allowPrivate === true) return parsed;
  if (net.isIP(parsed.hostname)) return parsed;

  const lookup = options.lookup || dns.lookup;
  let addresses;
  try {
    addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
  } catch (error) {
    throw privateError(`DNS lookup failed: ${error.message}`, 'DNS_LOOKUP_FAILED');
  }
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw privateError('DNS lookup returned no addresses', 'DNS_LOOKUP_FAILED');
  }
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw privateError('Host resolves to a private address', 'PRIVATE_HOST');
  }
  return parsed;
}

async function safeFetch(url, fetchOptions = {}, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const maxRedirects = Number.isFinite(options.maxRedirects) ? options.maxRedirects : 5;
  let current = String(url);

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    await assertSafeUrl(current, options);
    const response = await fetchImpl(current, {
      ...fetchOptions,
      redirect: 'manual',
    });
    const status = Number(response.status);
    const location = response.headers?.get?.('location');
    if (!location || ![301, 302, 303, 307, 308].includes(status)) {
      return response;
    }
    if (redirect === maxRedirects) {
      throw privateError('Too many redirects', 'TOO_MANY_REDIRECTS');
    }
    current = new URL(location, current).toString();
  }

  throw privateError('Too many redirects', 'TOO_MANY_REDIRECTS');
}

module.exports = {
  assertSafeUrl,
  isPrivateAddress,
  isPrivateHostname,
  safeFetch,
};
