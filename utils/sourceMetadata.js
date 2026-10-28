'use strict';

const path = require('node:path');

const HLS_CODECS = new Set(['hls', 'm3u8', 'application/vnd.apple.mpegurl']);
const HEVC_MARKERS = ['hevc', 'h265', 'h.265', 'x265'];
const H264_MARKERS = ['h264', 'h.264', 'avc', 'x264'];
const HDR_MARKERS = ['hdr', 'hdr10', 'hdr10+', 'dolbyvision', 'dolby vision', 'dv'];

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item));
  return String(value)
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function originalUrl(stream) {
  const raw = String(stream?.url || '');
  if (!raw) return '';
  try {
    const parsed = new URL(raw, 'http://peak.local');
    const nested = parsed.searchParams.get('url');
    return nested ? decodeURIComponent(nested) : raw;
  } catch {
    return raw;
  }
}

function extensionOf(url) {
  try {
    const parsed = new URL(url, 'http://peak.local');
    return path.extname(parsed.pathname).toLowerCase().replace(/^\./, '');
  } catch {
    return '';
  }
}

function isHlsStream(stream) {
  const raw = String(stream?.url || '');
  const url = originalUrl(stream);
  const codec = String(stream?.codec || '').toLowerCase();
  return (
    HLS_CODECS.has(codec) ||
    stream?.adaptive === true ||
    /\.m3u8($|\?)/i.test(url) ||
    // Peak's playlist proxy is authoritative even when the nested upstream path
    // has no `.m3u8` extension (e.g. vixsrc `/playlist/123?type=video`).
    /\/m3u8-proxy\?/i.test(raw) ||
    /\/m3u8-proxy\?/i.test(url)
  );
}

function detectContainer(stream) {
  if (isHlsStream(stream)) return 'hls';
  const explicit = String(stream?.container || '').toLowerCase();
  if (['mp4', 'm4v', 'mov', 'webm', 'mkv', 'ogv'].includes(explicit)) {
    return explicit === 'm4v' || explicit === 'mov' ? 'mp4' : explicit;
  }
  const codec = String(stream?.codec || '').toLowerCase();
  if (['mp4', 'webm', 'mkv', 'ogv'].includes(codec)) return codec;
  const ext = extensionOf(originalUrl(stream));
  if (ext === 'm3u8') return 'hls';
  if (ext === 'mp4' || ext === 'm4v' || ext === 'mov') return 'mp4';
  if (ext === 'webm') return 'webm';
  if (ext === 'mkv') return 'mkv';
  if (ext === 'ogv' || ext === 'ogg') return 'ogv';
  return 'unknown';
}

function detectVideoCodec(stream) {
  const explicit = String(stream?.videoCodec || '').toLowerCase();
  if (explicit) {
    if (HEVC_MARKERS.some((marker) => explicit.includes(marker))) return 'hevc';
    if (H264_MARKERS.some((marker) => explicit.includes(marker))) return 'h264';
    if (explicit.includes('av1')) return 'av1';
    if (explicit.includes('vp9')) return 'vp9';
  }
  const tokens = asArray(stream?.codecs).map((item) => item.toLowerCase());
  const codec = String(stream?.codec || '').toLowerCase();
  const haystack = [...tokens, codec, originalUrl(stream).toLowerCase()].join(' ');
  if (HEVC_MARKERS.some((marker) => haystack.includes(marker))) return 'hevc';
  if (H264_MARKERS.some((marker) => haystack.includes(marker))) return 'h264';
  if (haystack.includes('av1')) return 'av1';
  if (haystack.includes('vp9')) return 'vp9';
  return 'unknown';
}

function detectAudioCodec(stream) {
  const explicit = String(stream?.audioCodec || '')
    .toLowerCase()
    .replace(/[^a-z0-9+]/g, '');
  const haystack = asArray(stream?.codecs)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9+]/g, '');
  const value = explicit || haystack;
  if (!value) return 'unknown';
  if (value.includes('atmos')) return 'atmos';
  if (value.includes('eac3') || value.includes('ec3') || value.includes('ddp')) return 'eac3';
  if (value.includes('ac3')) return 'ac3';
  if (value.includes('dts')) return 'dts';
  if (value.includes('opus')) return 'opus';
  if (value.includes('aac')) return 'aac';
  return 'unknown';
}

function detectHdr(stream) {
  if (stream?.hdr === true) return true;
  const haystack = [
    ...asArray(stream?.codecs),
    stream?.videoCodec || '',
    stream?.hdrFormat || '',
    originalUrl(stream),
  ]
    .join(' ')
    .toLowerCase();
  return HDR_MARKERS.some((marker) => haystack.includes(marker));
}

function isBrowserPlayable(container, videoCodec) {
  if (container === 'hls') return true;
  if (container === 'mkv' || container === 'unknown') return false;
  if (videoCodec === 'hevc') return false;
  return container === 'mp4' || container === 'webm' || container === 'ogv';
}

function buildPlayerSource(stream, options = {}) {
  const container = detectContainer(stream);
  const videoCodec = detectVideoCodec(stream);
  const audioCodec = detectAudioCodec(stream);
  const hdr = detectHdr(stream);
  const adaptive = container === 'hls';
  const expiresIn = Number.isFinite(options.expiresIn) ? Math.max(0, Math.floor(options.expiresIn)) : 900;
  const codec = adaptive ? 'hls' : container === 'unknown' ? 'mp4' : container;

  return {
    url: stream.url,
    quality: stream.quality || stream.title || 'auto',
    codec,
    container,
    videoCodec,
    audioCodec,
    hdr,
    provider: stream.provider || 'Peak',
    adaptive,
    browserPlayable: isBrowserPlayable(container, videoCodec),
    expiresIn,
  };
}

module.exports = {
  asArray,
  buildPlayerSource,
  detectAudioCodec,
  detectContainer,
  detectHdr,
  detectVideoCodec,
  isBrowserPlayable,
  isHlsStream,
  originalUrl,
};
