'use strict';

const { parseQuality } = require('./streamFilters');
const { getProviderHealth } = require('./providerHealth');

function qualityScore(quality) {
  const height = parseQuality(quality);
  if (!height) return 0;
  if (height >= 2160) return -20;
  if (height >= 1440) return -5;
  if (height >= 1080) return 30;
  if (height >= 720) return 20;
  if (height >= 480) return 5;
  return -5;
}

function sourceScore(source) {
  let score = 0;
  const container = source.container || (source.adaptive ? 'hls' : 'unknown');
  const videoCodec = source.videoCodec || 'unknown';

  if (container === 'hls') score += 500;
  else if (container === 'mp4') score += 380;
  else if (container === 'webm') score += 320;
  else if (container === 'mkv') score += 40;
  else score += 120;

  if (videoCodec === 'h264') score += 120;
  else if (videoCodec === 'vp9') score += 60;
  else if (videoCodec === 'av1') score += 40;
  else if (videoCodec === 'hevc') score -= 120;
  else score += 60;

  if (source.browserPlayable === false) score -= 80;
  if (source.hdr) score -= 15;
  score += qualityScore(source.quality);

  const health = getProviderHealth(source.provider);
  score += Math.round((health?.score ?? 50) / 10);

  const order = Number.isFinite(source._order) ? source._order : 99;
  score -= Math.min(order, 20) * 0.1;
  return score;
}

function rankSources(sources) {
  return sources
    .map((source, index) => ({ source, index, score: sourceScore(source) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.source);
}

module.exports = { qualityScore, rankSources, sourceScore };
