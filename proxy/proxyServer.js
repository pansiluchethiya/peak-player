// Lightweight proxy/m3u8/segment/subtitle rewriting layer. thanks to https://github.com/cinepro-org/ for the original code.
// Adapted from external project (user supplied) to fit CommonJS style and existing config system.
// Provides conditional route registration via enableProxy flag.

const { signProxyUrl, verifyProxyRequest } = require('../utils/proxySigner');
const { safeFetch } = require('../utils/ssrfGuard');
const { sanitizeHeaders } = require('../utils/sourceValidator');

const FETCH_TIMEOUT_MS = 15000;
const MAX_PLAYLIST_BYTES = 5 * 1024 * 1024;

function proxyAllowPrivate() {
    return process.env.PROXY_ALLOW_PRIVATE === '1';
}

function fetchWithTimeout(url, options = {}) {
    return safeFetch(
        url,
        { ...options, timeout: FETCH_TIMEOUT_MS },
        { allowPrivate: proxyAllowPrivate() },
    );
}

function parseHeaders(raw) {
    try {
        return JSON.parse(raw || '{}');
    } catch {
        return {};
    }
}

function proxyHeaders(raw) {
    return sanitizeHeaders(parseHeaders(raw));
}

function proxyUrlFor(path, baseProxyUrl, targetUrl, headers) {
    const signed = signProxyUrl(path, {
        url: targetUrl,
        headers: JSON.stringify(headers || {}),
    });
    return `${baseProxyUrl}${signed}`;
}

function publicBaseUrl(req) {
    const configured = String(process.env.PUBLIC_API_URL || '').trim().replace(/\/$/, '');
    if (configured) return configured;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    return `${protocol}://${req.get('host')}`;
}

function allowedOrigins() {
    const origins = new Set(['http://localhost:3001', 'http://127.0.0.1:3001']);
    const configured = String(process.env.PLAYER_ALLOWED_ORIGINS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    for (const origin of configured) origins.add(origin);
    const publicUrl = String(process.env.PLAYER_PUBLIC_URL || '').trim();
    if (publicUrl) {
        try {
            origins.add(new URL(publicUrl).origin);
        } catch {
            // Ignore malformed configuration.
        }
    }
    return origins;
}

function applyCors(req, res) {
    const origin = req.headers.origin;
    if (!origin) return true;
    if (!allowedOrigins().has(origin)) return false;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    return true;
}

function corsGuard(req, res) {
    if (applyCors(req, res)) return true;
    res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
    return false;
}

function createRateLimiter({ windowMs = 60 * 1000, max = 120 } = {}) {
    const hits = new Map();
    const limit = (key) => {
        const now = Date.now();
        let entry = hits.get(key);
        if (!entry || now - entry.start >= windowMs) {
            entry = { start: now, count: 0 };
            hits.set(key, entry);
        }
        entry.count += 1;
        if (entry.count > max) {
            return {
                ok: false,
                retryAfter: Math.max(1, Math.ceil((entry.start + windowMs - now) / 1000)),
            };
        }
        return { ok: true };
    };
    limit.reset = () => hits.clear();
    return limit;
}

const playlistLimiter = createRateLimiter({
    max: Number(process.env.PROXY_RATE_LIMIT_PLAYLISTS || 120),
});
const segmentLimiter = createRateLimiter({
    max: Number(process.env.PROXY_RATE_LIMIT_SEGMENTS || 2400),
});

function enforceRate(req, res, limiter, bucket) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const result = limiter(`${ip}:${bucket}`);
    if (result.ok) return true;
    res.setHeader('Retry-After', String(result.retryAfter));
    res.status(429).json({ error: 'RATE_LIMITED' });
    return false;
}

function resetProxyRateLimits() {
    playlistLimiter.reset();
    segmentLimiter.reset();
}

function requireSignature(req, res) {
    if (process.env.PROXY_ALLOW_UNSIGNED === '1') return true;
    const result = verifyProxyRequest(req.path, req.query);
    if (result.ok) return true;
    res.status(403).json({ error: 'INVALID_SIGNATURE', reason: result.reason });
    return false;
}

function handleProxyError(res, error, debug) {
    if (debug) console.log('[proxy] request failed', error.code || error.message);
    if (['PRIVATE_HOST', 'INVALID_URL', 'INVALID_PROTOCOL'].includes(error.code)) {
        return res.status(400).json({ error: 'UNSAFE_URL' });
    }
    if (error.code === 'TOO_MANY_REDIRECTS') {
        return res.status(502).json({ error: 'TOO_MANY_REDIRECTS' });
    }
    return res.status(502).json({ error: 'PROXY_ERROR' });
}

function isHtmlBody(text) {
    const value = String(text || '').trimStart().toLowerCase();
    return (
        value.startsWith('<!doctype') ||
        value.startsWith('<html') ||
        value.startsWith('<head') ||
        value.startsWith('<body') ||
        value.startsWith('<!--')
    );
}

function isChallengeBody(text) {
    const value = String(text || '').toLowerCase();
    return (
        value.includes('attention required') ||
        value.includes('just a moment') ||
        value.includes('enable javascript and cookies') ||
        value.includes('ddos-guard') ||
        value.includes('cf-challenge') ||
        value.includes('cloudflare')
    );
}

function parseByteRange(rangeHeader, size) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(String(rangeHeader || '').trim());
    if (!match || (!match[1] && !match[2]) || !Number.isFinite(size) || size <= 0) return null;
    let start;
    let end;
    if (!match[1]) {
        const suffix = Number.parseInt(match[2], 10);
        if (!Number.isFinite(suffix) || suffix <= 0) return null;
        start = Math.max(0, size - suffix);
        end = size - 1;
    } else {
        start = Number.parseInt(match[1], 10);
        end = match[2] ? Number.parseInt(match[2], 10) : size - 1;
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
    return { start, end: Math.min(end, size - 1) };
}

const CACHE_MAX_SIZE = 2000;
const CACHE_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours
const segmentCache = new Map();
// Track first open-ended (bytes=0-) range per target to clamp only once per TTL window
const openRangeClampMap = new Map();
const OPEN_RANGE_CLAMP_TTL_MS = 5 * 60 * 1000; // 5 minutes
// Progressive open-ended growth tracking: keeps expanding bytes=0- served window.
const progressiveOpenMap = new Map(); // url -> { lastEnd }
// Tail prefetch cache: stores last N KB for quick tail range responses
const tailPrefetchMap = new Map(); // url -> { data: Buffer, start: number, end: number, size: number, ts: number }
const TAIL_PREFETCH_TTL_MS = 10 * 60 * 1000; // 10 minutes

function isCacheDisabled() {
    return process.env.DISABLE_CACHE === 'true';
}

function cleanupCache() {
    const now = Date.now();
    for (const [url, entry] of segmentCache.entries()) {
        if (now - entry.timestamp > CACHE_EXPIRY_MS) segmentCache.delete(url);
    }
    if (segmentCache.size > CACHE_MAX_SIZE) {
        const entries = Array.from(segmentCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, segmentCache.size - CACHE_MAX_SIZE);
        toRemove.forEach(([u]) => segmentCache.delete(u));
    }
    return segmentCache.size;
}
setInterval(cleanupCache, 30 * 60 * 1000).unref();

function cleanupClampMap() {
    const now = Date.now();
    for (const [url, ts] of openRangeClampMap.entries()) {
        if (now - ts > OPEN_RANGE_CLAMP_TTL_MS) openRangeClampMap.delete(url);
    }
}
setInterval(cleanupClampMap, 10 * 60 * 1000).unref();

function cleanupTailPrefetch() {
    const now = Date.now();
    for (const [url, entry] of tailPrefetchMap.entries()) {
        if (now - entry.ts > TAIL_PREFETCH_TTL_MS) tailPrefetchMap.delete(url);
    }
}
setInterval(cleanupTailPrefetch, 15 * 60 * 1000).unref();

function getCachedSegment(url) {
    if (isCacheDisabled()) return null;
    const e = segmentCache.get(url);
    if (!e) return null;
    if (Date.now() - e.timestamp > CACHE_EXPIRY_MS) { segmentCache.delete(url); return null; }
    return e;
}

async function prefetchSegment(url, headers) {
    if (isCacheDisabled() || segmentCache.size >= CACHE_MAX_SIZE) return;
    const existing = segmentCache.get(url);
    if (existing && Date.now() - existing.timestamp <= CACHE_EXPIRY_MS) return;
    try {
        const resp = await fetchWithTimeout(url, { headers: sanitizeHeaders(headers) });
        if (!resp.ok) return;
        const data = new Uint8Array(await resp.arrayBuffer());
        const responseHeaders = {};
        resp.headers.forEach((v, k) => responseHeaders[k] = v);
        segmentCache.set(url, { data, headers: responseHeaders, timestamp: Date.now() });
    } catch (_e) { /* ignore */ }
}

function inferContentType(upstreamCT, targetUrl) {
    if (/\.m3u8(\?|$)/i.test(targetUrl)) return 'application/vnd.apple.mpegurl';
    if (/\.ts(\?|$)/i.test(targetUrl)) return 'video/mp2t';
    if (/\.html?(\?|$)/i.test(targetUrl)) {
        return upstreamCT && /text\/html/i.test(upstreamCT) ? 'text/html' : 'video/mp2t';
    }
    if (/\.mp4(\?|$)/i.test(targetUrl)) return 'video/mp4';
    if (/\.mkv(\?|$)/i.test(targetUrl)) return 'video/x-matroska';
    const bad = !upstreamCT || /application\/octet-stream/i.test(upstreamCT) || /application\/(x-)?zip/i.test(upstreamCT);
    if (!bad) return upstreamCT;
    return 'application/octet-stream';
}

function extractOriginalUrl(proxyUrl) {
    try {
        const url = new URL(proxyUrl);
        if (url.pathname.includes('/proxy/')) {
            const m = url.pathname.match(/\/proxy\/(.+)$/);
            if (m) {
                let decoded = decodeURIComponent(m[1]);
                while (decoded.includes('%2F')) {
                    try { decoded = decodeURIComponent(decoded); } catch { break; }
                }
                if (decoded.startsWith('http://') || decoded.startsWith('https://')) return decoded;
                // If it's just a path (like Vidlink /proxy/wiwii/...), keep the full original URL
                return proxyUrl;
            }
        }
        if (url.searchParams.has('url')) return url.searchParams.get('url');
        const patterns = [
            /\/api\/[^/]+\/proxy\?url=(.+)$/,
            /\/proxy\?.*url=([^&]+)/,
            /\/stream\/proxy\/(.+)$/,
            /\/p\/(.+)$/
        ];
        for (const p of patterns) {
            const m = proxyUrl.match(p); if (m) return decodeURIComponent(m[1]);
        }
        return proxyUrl;
    } catch { return proxyUrl; }
}

function rewriteM3u8(content, targetUrl, baseProxyUrl, headers) {
    const lines = content.split('\n');
    const out = []; const segmentUrls = [];
    // A URI line immediately following #EXT-X-STREAM-INF is a variant playlist,
    // even when the provider omits a .m3u8 extension (e.g. /playlist/123?type=video).
    let expectVariantPlaylist = false;
    for (const line of lines) {
        if (line.startsWith('#')) {
            expectVariantPlaylist = line.startsWith('#EXT-X-STREAM-INF');
            if (line.startsWith('#EXT-X-KEY:')) {
                // Key URIs may be absolute or relative to the playlist URL.
                const uriMatch = line.match(/URI="([^"]+)"/);
                if (uriMatch) {
                    try {
                        const keyUrl = new URL(uriMatch[1], targetUrl).href;
                        const proxyUrl = proxyUrlFor('/ts-proxy', baseProxyUrl, keyUrl, headers);
                        out.push(line.replace(uriMatch[1], () => proxyUrl));
                        if (!isCacheDisabled()) prefetchSegment(keyUrl, headers);
                    } catch { out.push(line); }
                } else out.push(line);
            } else if (line.startsWith('#EXT-X-MEDIA:') || line.startsWith('#EXT-X-I-FRAME-STREAM-INF:')) {
                const uriMatch = line.match(/URI="([^"]+)"/);
                if (uriMatch) {
                    try {
                        const mediaUrl = new URL(uriMatch[1], targetUrl).href;
                        const proxyUrl = proxyUrlFor('/m3u8-proxy', baseProxyUrl, mediaUrl, headers);
                        out.push(line.replace(uriMatch[1], () => proxyUrl));
                    } catch { out.push(line); }
                } else out.push(line);
            } else out.push(line);
        } else if (line.trim()) {
            try {
                const abs = new URL(line, targetUrl).href;
                if (expectVariantPlaylist || /\.m3u8(\?|$)/i.test(abs)) {
                    out.push(proxyUrlFor('/m3u8-proxy', baseProxyUrl, abs, headers));
                } else if (/\.ts(\?|$)/i.test(abs)) {
                    segmentUrls.push(abs);
                    out.push(proxyUrlFor('/ts-proxy', baseProxyUrl, abs, headers));
                } else if (/\.html?(\?|$)/i.test(abs)) {
                    segmentUrls.push(abs);
                    out.push(proxyUrlFor('/ts-proxy', baseProxyUrl, abs, headers));
                } else if (/\.m4s(\?|$)/i.test(abs) || /\.aac(\?|$)/i.test(abs) || /\.mp4(\?|$)/i.test(abs)) {
                    segmentUrls.push(abs);
                    out.push(proxyUrlFor('/ts-proxy', baseProxyUrl, abs, headers));
                } else if (/[?&](token|expires|sig|signature)=/i.test(abs)) {
                    // Extension-less media paths still need proxying for CORS and
                    // signed-header forwarding.
                    segmentUrls.push(abs);
                    out.push(proxyUrlFor('/ts-proxy', baseProxyUrl, abs, headers));
                } else out.push(abs);
            } catch { out.push(line); }
            expectVariantPlaylist = false;
        } else out.push(line);
    }
    if (segmentUrls.length && !isCacheDisabled()) {
        Promise.all(segmentUrls.map(u => prefetchSegment(u, headers))).catch(() => undefined);
    }
    return out.join('\n');
}

function createProxyRoutes(app) {
    app.options(['/m3u8-proxy', '/ts-proxy', '/sub-proxy'], (req, res) => {
        if (!corsGuard(req, res)) return;
        res.status(204).end();
    });

    // m3u8 playlist proxy
    app.get('/m3u8-proxy', async (req, res) => {
        if (!corsGuard(req, res)) return;
        if (!requireSignature(req, res)) return;
        if (!enforceRate(req, res, playlistLimiter, 'playlist')) return;
        const targetUrl = String(req.query.url || '');
        if (!targetUrl) return res.status(400).json({ error: 'URL parameter required' });
        const headers = proxyHeaders(req.query.headers);
        try {
            const response = await fetchWithTimeout(targetUrl, { headers });
            if (!response.ok) return res.status(response.status).json({ error: `M3U8 fetch failed: ${response.status}` });
            const length = Number(response.headers.get('content-length'));
            if (Number.isFinite(length) && length > MAX_PLAYLIST_BYTES) {
                return res.status(413).json({ error: 'PLAYLIST_TOO_LARGE' });
            }
            const text = await response.text();
            if (text.length > MAX_PLAYLIST_BYTES) {
                return res.status(413).json({ error: 'PLAYLIST_TOO_LARGE' });
            }
            if (isHtmlBody(text) || isChallengeBody(text)) {
                return res.status(502).json({ error: 'INVALID_PLAYLIST', reason: 'html_response' });
            }
            if (!text.replace(/^\uFEFF/, '').trimStart().startsWith('#EXTM3U')) {
                return res.status(502).json({ error: 'INVALID_PLAYLIST', reason: 'not_hls' });
            }
            const baseProxyUrl = publicBaseUrl(req);
            const rewritten = rewriteM3u8(text, targetUrl, baseProxyUrl, headers);
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.send(rewritten);
        } catch (e) {
            handleProxyError(res, e, req.query.debug === '1');
        }
    });

    // ts / key segment proxy
    app.get('/ts-proxy', async (req, res) => {
        if (!corsGuard(req, res)) return;
        if (!requireSignature(req, res)) return;
        if (!enforceRate(req, res, segmentLimiter, 'segment')) return;
        const targetUrl = String(req.query.url || '');
        if (!targetUrl) return res.status(400).json({ error: 'URL parameter required' });
        const debug = req.query.debug === '1';
        const noSynth = req.query.noSynth === '1';
        const isDirectFile = /\.(mp4|mkv)(\?|$)/i.test(targetUrl);
        const force200 = req.query.force200 === '1' && !isDirectFile;
        const clampOpen = req.query.clampOpen !== '0';
        const progressiveOpen = req.query.progressiveOpen !== '0';
        const tailPrefetchEnabled = req.query.tailPrefetch !== '0';
        let tailPrefetchKB = parseInt(req.query.tailPrefetchKB || '256', 10);
        if (isNaN(tailPrefetchKB) || tailPrefetchKB < 64) tailPrefetchKB = 256;
        if (tailPrefetchKB > 2048) tailPrefetchKB = 2048; // max 2MB tail window
        let openChunkKB = parseInt(req.query.openChunkKB || '4096', 10);
        if (isNaN(openChunkKB) || openChunkKB < 64) openChunkKB = 4096;
        if (openChunkKB > 16384) openChunkKB = 16384; // cap at 16MB
        let initChunkKB = parseInt(req.query.initChunkKB || '512', 10);
        if (isNaN(initChunkKB) || initChunkKB < 64) initChunkKB = 512;
        if (initChunkKB > 2048) initChunkKB = 2048; // hard cap 2MB
        const headers = proxyHeaders(req.query.headers);
        // Pass through Range header for progressive playback / seeking
        const range = req.headers['range'];
        let appliedClamp = false;
        let effectiveRange = range;
        if (range) headers.Range = range;
        // Clamp first open-ended bytes=0- request to a bounded span (once per TTL) to avoid gigantic initial 206
        if (range && /^bytes=0-\s*$/i.test(range) && !force200) {
            const now = Date.now();
            // Progressive growth supersedes single-shot clamp if enabled
            if (progressiveOpen) {
                const prog = progressiveOpenMap.get(targetUrl) || { lastEnd: -1 };
                const prevEnd = prog.lastEnd;
                let nextEnd;
                if (prog.lastEnd < 0) {
                    nextEnd = openChunkKB * 1024 - 1;
                } else {
                    const increment = openChunkKB * 1024;
                    nextEnd = prog.lastEnd + increment;
                    const maxCap = 256 * 1024 * 1024 - 1; // 256MB
                    if (nextEnd > maxCap) nextEnd = maxCap;
                }
                const newRange = `bytes=0-${nextEnd}`;
                headers.Range = newRange;
                effectiveRange = newRange;
                prog.lastEnd = nextEnd;
                progressiveOpenMap.set(targetUrl, prog);
                appliedClamp = true; // reuse flag for logging
                if (debug) console.log('[ts-proxy] progressiveOpen expand', { prevEnd, nextEnd, increment: openChunkKB * 1024 });
            } else if (clampOpen) {
                const lastTs = openRangeClampMap.get(targetUrl);
                if (!lastTs || (now - lastTs) > OPEN_RANGE_CLAMP_TTL_MS) {
                    const clampBytes = openChunkKB * 1024;
                    const newRange = `bytes=0-${clampBytes - 1}`;
                    headers.Range = newRange;
                    effectiveRange = newRange;
                    openRangeClampMap.set(targetUrl, now);
                    appliedClamp = true;
                }
            }
        }
        if (debug) console.log('[ts-proxy] incoming', { url: targetUrl, range, effectiveRange, appliedClamp, clampOpen, progressiveOpen, openChunkKB, noSynth, initChunkKB, force200, tailPrefetchEnabled, tailPrefetchKB });
        if (!isCacheDisabled()) {
            const cached = getCachedSegment(targetUrl);
            if (cached) {
                const body = Buffer.from(cached.data);
                const ct = inferContentType(cached.headers['content-type'], targetUrl);
                res.setHeader('Content-Type', ct);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.setHeader('Accept-Ranges', 'bytes');
                const cachedRange = parseByteRange(range, body.length);
                if (cachedRange) {
                    const slice = body.subarray(cachedRange.start, cachedRange.end + 1);
                    res.status(206);
                    res.setHeader('Content-Range', `bytes ${cachedRange.start}-${cachedRange.end}/${body.length}`);
                    res.setHeader('Content-Length', String(slice.length));
                    if (debug) console.log('[ts-proxy] cache hit (range)', cachedRange);
                    return res.end(slice);
                }
                res.setHeader('Content-Length', String(body.length));
                if (debug) console.log('[ts-proxy] cache hit');
                return res.end(body);
            }
        }
        try {
            // If we have a tail prefetch entry and the client requests a tail range fully inside it, serve from memory early.
            if (effectiveRange && /^bytes=\d+-$/i.test(effectiveRange)) {
                const tailEntry = tailPrefetchMap.get(targetUrl);
                if (tailEntry) {
                    const m = effectiveRange.match(/bytes=(\d+)-/i);
                    if (m) {
                        const startReq = parseInt(m[1], 10);
                        if (!isNaN(startReq) && startReq >= tailEntry.start && startReq <= tailEntry.end) {
                            const offset = startReq - tailEntry.start;
                            const slice = tailEntry.data.subarray(offset);
                            const endByte = tailEntry.end;
                            res.status(206);
                            const ct = inferContentType(null, targetUrl);
                            res.setHeader('Content-Type', ct);
                            res.setHeader('Accept-Ranges', 'bytes');
                            res.setHeader('Content-Length', slice.length.toString());
                            res.setHeader('Content-Range', `bytes ${startReq}-${endByte}/${tailEntry.size}`);
                            res.setHeader('Cache-Control', 'public, max-age=3600');
                            if (debug) console.log('[ts-proxy] tail serve hit', { startReq, cachedStart: tailEntry.start, cachedEnd: tailEntry.end, size: tailEntry.size });
                            return res.end(slice);
                        }
                    }
                }
            }

            // HEAD preflight (only when no explicit Range requested) to get size for synthesized partial response
            let contentLength = null;
            let upstreamAcceptRanges = null;
            if (!effectiveRange) {
                try {
                    const headResp = await fetchWithTimeout(targetUrl, { method: 'HEAD', headers: { ...headers } });
                    if (headResp.ok) {
                        contentLength = headResp.headers.get('content-length');
                        upstreamAcceptRanges = headResp.headers.get('accept-ranges');
                        if (debug) console.log('[ts-proxy] HEAD ok', { contentLength, upstreamAcceptRanges });
                    } else if (debug) {
                        console.log('[ts-proxy] HEAD status', headResp.status);
                    }
                } catch (_e) { if (debug) console.log('[ts-proxy] HEAD failed'); }
            }

            // Fallback probe: if still no size, attempt a 0-0 range request to derive total size from Content-Range
            if (!effectiveRange && !contentLength) {
                try {
                    const probeRange = 'bytes=0-0';
                    if (debug) console.log('[ts-proxy] probe range');
                    const probeResp = await fetchWithTimeout(targetUrl, { headers: { ...headers, 'Range': probeRange } });
                    if (probeResp.status === 206) {
                        const cr = probeResp.headers.get('content-range');
                        if (cr) {
                            const m = cr.match(/\/(\d+)$/); if (m) contentLength = m[1];
                        }
                        try { await probeResp.arrayBuffer(); } catch (readErr) {
                            if (debug) console.log('[ts-proxy] probe body read failed', readErr.message);
                        }
                        if (debug) console.log('[ts-proxy] probe success', { contentLength });
                    } else if (debug) {
                        console.log('[ts-proxy] probe status', probeResp.status);
                    }
                } catch (_e) { if (debug) console.log('[ts-proxy] probe failed'); }
            }
            if (debug && contentLength) console.log('[ts-proxy] size determined', contentLength);

            // Initiate tail prefetch asynchronously (once) when size known and feature enabled
            if (tailPrefetchEnabled && contentLength && !tailPrefetchMap.has(targetUrl)) {
                const total = parseInt(contentLength, 10);
                if (!isNaN(total) && total > 0) {
                    const tailBytes = Math.min(tailPrefetchKB * 1024, total);
                    const start = Math.max(0, total - tailBytes);
                    const tailRange = `bytes=${start}-`;
                    (async () => {
                        try {
                            if (debug) console.log('[ts-proxy] tail prefetch start', { tailRange });
                            const tr = await fetchWithTimeout(targetUrl, { headers: { ...headers, Range: tailRange } });
                            if (tr.status === 206) {
                                const buf = Buffer.from(await tr.arrayBuffer());
                                const cr = tr.headers.get('content-range');
                                if (cr) {
                                    const mm = cr.match(/bytes\s+(\d+)-(\d+)\/(\d+)/i);
                                    if (mm) {
                                        const s = parseInt(mm[1], 10); const e = parseInt(mm[2], 10); const sz = parseInt(mm[3], 10);
                                        if (!isNaN(s) && !isNaN(e) && !isNaN(sz)) {
                                            tailPrefetchMap.set(targetUrl, { data: buf, start: s, end: e, size: sz, ts: Date.now() });
                                            if (debug) console.log('[ts-proxy] tail prefetch success', { start: s, end: e, bytes: buf.length });
                                        }
                                    }
                                }
                            } else if (debug) {
                                console.log('[ts-proxy] tail prefetch status', tr.status);
                            }
                        } catch (e) { if (debug) console.log('[ts-proxy] tail prefetch error', e.message); }
                    })();
                }
            }

            // If no range requested but we now know size (HEAD or probe), synthesize an initial small range fetch to accelerate playback.
            if (!force200 && !effectiveRange && contentLength && !noSynth && req.query.progressiveOpen === '0') {
                const total = parseInt(contentLength, 10);
                const desired = initChunkKB * 1024;
                const chunkSize = Math.min(desired, Math.max(0, total - 1));
                const syntheticRange = `bytes=0-${chunkSize}`;
                const resp = await fetchWithTimeout(targetUrl, { headers: { ...headers, 'Range': syntheticRange } });
                if (resp.status === 206) {
                    if (debug) console.log('[ts-proxy] synthetic 206', syntheticRange);
                    const upstreamCT = inferContentType(resp.headers.get('content-type'), targetUrl);
                    res.status(206);
                    res.setHeader('Content-Type', upstreamCT);
                    res.setHeader('Accept-Ranges', upstreamAcceptRanges || 'bytes');
                    const contentRange = resp.headers.get('content-range');
                    if (contentRange) res.setHeader('Content-Range', contentRange);
                    const cl = resp.headers.get('content-length'); if (cl) res.setHeader('Content-Length', cl);
                    res.setHeader('Cache-Control', 'public, max-age=3600');
                    // Pipe first chunk then leave connection open? Simpler: end after chunk; player will request next range.
                    return resp.body.pipe(res);
                }
                // If server ignored range (e.g., returned 200), fall through to normal logic below.
            }

            // If client supplied a suffix range like bytes=0- we pass it; force200 strips Range
            if (force200 && headers.Range) delete headers.Range;
            const upstreamOptions = { headers: { ...headers } };
            const resp = await fetchWithTimeout(targetUrl, upstreamOptions);
            if (!resp.ok && resp.status !== 206) {
                if (debug) console.log('[ts-proxy] upstream error', resp.status);
                return res.status(resp.status).json({ error: `TS fetch failed: ${resp.status}` });
            }
            // Forward partial content status when range used
            if (effectiveRange && resp.status === 206 && !force200) { res.status(206); if (debug) console.log('[ts-proxy] forwarding 206', { appliedClamp }); }
            if (force200 && resp.status === 206) {
                // Some origins still return 206 even without Range; normalize to 200 for players expecting full stream
                if (debug) console.log('[ts-proxy] normalizing 206 -> 200 due to force200');
            }
            // Copy key streaming headers
            const upstreamCT = inferContentType(resp.headers.get('content-type'), targetUrl);
            res.setHeader('Content-Type', upstreamCT);
            let cl = resp.headers.get('content-length');
            const crHeader = resp.headers.get('content-range');
            if (!cl && crHeader) {
                // Try to derive length from range span
                const m = crHeader.match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/i);
                if (m) {
                    const start = parseInt(m[1], 10); const end = parseInt(m[2], 10);
                    if (!isNaN(start) && !isNaN(end)) cl = (end - start + 1).toString();
                }
            }
            if (cl) res.setHeader('Content-Length', cl);
            const acceptRanges = resp.headers.get('accept-ranges');
            if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges); else res.setHeader('Accept-Ranges', 'bytes');
            const contentRange = resp.headers.get('content-range'); if (contentRange && !force200) res.setHeader('Content-Range', contentRange);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            if (debug) console.log('[ts-proxy] streaming body', { status: resp.status, ct: upstreamCT, cl, contentRange: force200 ? undefined : contentRange });
            resp.body.pipe(res);
        } catch (e) {
            handleProxyError(res, e, debug);
        }
    });

    // subtitle proxy
    app.get('/sub-proxy', async (req, res) => {
        if (!corsGuard(req, res)) return;
        if (!requireSignature(req, res)) return;
        if (!enforceRate(req, res, playlistLimiter, 'subtitle')) return;
        const targetUrl = String(req.query.url || '');
        if (!targetUrl) return res.status(400).json({ error: 'url parameter required' });
        const headers = proxyHeaders(req.query.headers);
        try {
            const resp = await fetchWithTimeout(targetUrl, { headers });
            if (!resp.ok) return res.status(resp.status).json({ error: `subtitle fetch failed: ${resp.status}` });
            const length = Number(resp.headers.get('content-length'));
            if (Number.isFinite(length) && length > MAX_PLAYLIST_BYTES) {
                return res.status(413).json({ error: 'SUBTITLE_TOO_LARGE' });
            }
            const text = await resp.text();
            if (text.length > MAX_PLAYLIST_BYTES) {
                return res.status(413).json({ error: 'SUBTITLE_TOO_LARGE' });
            }
            if (isHtmlBody(text)) {
                return res.status(502).json({ error: 'INVALID_SUBTITLE', reason: 'html_response' });
            }
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('Content-Type', resp.headers.get('content-type') || 'text/vtt');
            res.send(text);
        } catch (e) {
            handleProxyError(res, e, req.query.debug === '1');
        }
    });
}

function processStreamsForProxy(streams, serverUrl) {
    if (!Array.isArray(streams)) return streams;
    const base = String(serverUrl || '').trim().replace(/\/$/, '');
    if (!base) return streams;
    return streams.map(s => {
        if (!s || !s.url || typeof s.url !== 'string') return s;
        const original = extractOriginalUrl(s.url);
        const headers = sanitizeHeaders(s.headers || {});
        const query = { url: original, headers: JSON.stringify(headers) };
        let host = '';
        try {
            host = new URL(original).hostname.toLowerCase();
        } catch {
            // Ignore errors
        }
        // Some direct-file hosts ignore Range or return unusable partial responses.
        if (host.includes('pixeldrain.') || host === 'video-downloads.googleusercontent.com') {
            return { ...s, url: `${base}${signProxyUrl('/ts-proxy', { ...query, force200: '1', clampOpen: '0' })}` };
        }
        if (/\.(mp4|mkv)(\?|$)/i.test(original)) {
            return {
                ...s,
                url: `${base}${signProxyUrl('/ts-proxy', { ...query, clampOpen: '0', progressiveOpen: '0' })}`,
            };
        }
        return { ...s, url: `${base}${signProxyUrl('/m3u8-proxy', query)}` };
    });
}

module.exports = { createProxyRoutes, processStreamsForProxy, resetProxyRateLimits };
