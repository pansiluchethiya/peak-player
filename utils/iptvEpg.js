'use strict';

// XMLTV guide handling for the IPTV catalogue. The parser is intentionally
// small: guides only need programme start/stop, title, description, category and
// channel, so a full XML parser (and a new dependency) would be overkill.
// Everything that is not a complete programme is ignored rather than fatal,
// because real-world guides routinely carry malformed entries.

const iptvStore = require('./iptvStore');

const GUIDE_TIMEOUT_MS = 30000;
const EPG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const EPG_PAST_MS = 12 * 60 * 60 * 1000;
const EPG_FUTURE_MS = 7 * 24 * 60 * 60 * 1000;

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

// `YYYYMMDDHHmmss +0000`; the offset is optional and may omit the colon.
const XMLTV_DATE = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2}):?(\d{2}))?$/;

function decodeEntities(value) {
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const hexadecimal = code[1] === 'x' || code[1] === 'X';
      const point = Number.parseInt(code.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      if (!Number.isFinite(point) || point < 0 || point > 0x10ffff) return match;
      try {
        return String.fromCodePoint(point);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[code.toLowerCase()];
    return named === undefined ? match : named;
  });
}

function readAttribute(attributes, name) {
  const pattern = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
  const match = attributes.match(pattern);
  if (!match) return null;
  const raw = match[2] !== undefined ? match[2] : match[3];
  return decodeEntities(raw);
}

function stripCdata(value) {
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function readElement(body, name) {
  const pattern = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i');
  const match = body.match(pattern);
  if (!match) return null;
  const text = decodeEntities(stripCdata(match[1])).trim();
  return text || null;
}

// Calendar fields are re-checked because Date.UTC rolls 20261340 over into the
// next month instead of failing.
function xmltvDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(XMLTV_DATE);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, sign, offsetHour, offsetMinute] = match;
  const fields = [year, month, day, hour, minute, second].map(Number);
  const utc = Date.UTC(fields[0], fields[1] - 1, fields[2], fields[3], fields[4], fields[5]);
  const check = new Date(utc);
  if (
    Number.isNaN(utc) ||
    check.getUTCFullYear() !== fields[0] ||
    check.getUTCMonth() !== fields[1] - 1 ||
    check.getUTCDate() !== fields[2] ||
    check.getUTCHours() !== fields[3] ||
    check.getUTCMinutes() !== fields[4] ||
    check.getUTCSeconds() !== fields[5]
  ) {
    return null;
  }
  let offsetMs = 0;
  if (sign) {
    const minutes = Number(offsetHour) * 60 + Number(offsetMinute);
    offsetMs = minutes * 60000 * (sign === '-' ? -1 : 1);
  }
  return new Date(utc - offsetMs).toISOString();
}

function programmeBlocks(xml) {
  const blocks = [];
  const source = String(xml);
  const lower = source.toLowerCase();
  const openPattern = /<programme\b[^>]*>/gi;
  let match = openPattern.exec(source);
  while (match) {
    const openTag = match[0];
    const startIndex = match.index + openTag.length;
    if (/\/\s*>$/.test(openTag)) {
      // Self-closing programmes have no title and cannot be scheduled.
      match = openPattern.exec(source);
      continue;
    }
    const closeIndex = lower.indexOf('</programme>', startIndex);
    if (closeIndex === -1) break;
    blocks.push({ attributes: openTag, body: source.slice(startIndex, closeIndex) });
    openPattern.lastIndex = closeIndex + '</programme>'.length;
    match = openPattern.exec(source);
  }
  return blocks;
}

function parseXmltv(xml) {
  const programmes = [];
  programmeBlocks(xml).forEach(({ attributes, body }) => {
    const channel = readAttribute(attributes, 'channel');
    const start = xmltvDate(readAttribute(attributes, 'start'));
    const stop = xmltvDate(readAttribute(attributes, 'stop'));
    const title = readElement(body, 'title');
    if (!channel || !start || !stop || !title) return;
    programmes.push({
      channel,
      start,
      stop,
      title,
      description: readElement(body, 'desc'),
      category: readElement(body, 'category'),
    });
  });
  return programmes;
}

function toMillis(value, fallback = Date.now()) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : fallback;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function sortedSchedule(schedule) {
  return (Array.isArray(schedule) ? schedule.slice() : [])
    .map((programme, index) => ({
      programme,
      index,
      start: toMillis(programme && programme.start, Number.POSITIVE_INFINITY),
    }))
    .sort((left, right) => left.start - right.start || left.index - right.index)
    .map((entry) => entry.programme);
}

// `now` is the programme airing at the given instant (start <= now < stop).
// `next` is the first programme starting when the current one ends; with no
// current programme it is the first one that starts in the future.
function getEpg(channelId, { now = Date.now(), schedule } = {}) {
  const nowMs = toMillis(now);
  const source = schedule === undefined
    ? iptvStore.getEpgProgrammes(String(channelId), {
      from: new Date(nowMs - EPG_PAST_MS).toISOString(),
      to: new Date(nowMs + EPG_FUTURE_MS).toISOString(),
    })
    : schedule;
  const programmes = sortedSchedule(source);
  const current = programmes.find(
    (programme) => toMillis(programme && programme.start, Number.POSITIVE_INFINITY) <= nowMs &&
      nowMs < toMillis(programme && programme.stop, Number.NEGATIVE_INFINITY),
  ) || null;
  const next = current
    ? programmes.find(
      (programme) => toMillis(programme && programme.start, Number.POSITIVE_INFINITY) >=
        toMillis(current.stop, Number.POSITIVE_INFINITY),
    ) || null
    : programmes.find(
      (programme) => toMillis(programme && programme.start, Number.POSITIVE_INFINITY) > nowMs,
    ) || null;
  return { now: current, next, schedule: programmes };
}

function ingestGuide(xml, { now = Date.now(), store = iptvStore } = {}) {
  const nowMs = toMillis(now);
  const programmes = parseXmltv(xml);
  const byChannel = new Map();
  programmes.forEach((programme) => {
    const list = byChannel.get(programme.channel) || [];
    list.push(programme);
    byChannel.set(programme.channel, list);
  });
  let stored = 0;
  byChannel.forEach((list, channelId) => {
    store.replaceEpg(channelId, list);
    stored += list.length;
  });
  store.pruneEpg(new Date(nowMs - EPG_RETENTION_MS).toISOString());
  return { channels: byChannel.size, programmes: stored };
}

async function refreshGuides({
  store = iptvStore,
  now = Date.now(),
  readText = require('./safeHttp').readText,
} = {}) {
  const nowMs = toMillis(now);
  const guides = [];
  const failed = [];
  const playlists = store.listPlaylists() || [];
  // Sequential on purpose: guide documents are large and the 3-hour cycle should
  // not hammer every provider at once.
  for (const playlist of playlists) {
    const url = typeof playlist.guide_url === 'string' ? playlist.guide_url.trim() : '';
    if (!url) continue;
    try {
      const response = await readText(url, { timeoutMs: GUIDE_TIMEOUT_MS });
      const body = typeof response === 'string'
        ? response
        : response && typeof response.text === 'string'
          ? response.text
          : null;
      const status = response && typeof response === 'object' ? response.status : undefined;
      if (status !== undefined && (status < 200 || status >= 300)) {
        throw new Error(`guide request failed with status ${status}`);
      }
      if (!body) throw new Error('guide response was empty');
      const result = ingestGuide(body, { now: nowMs, store });
      guides.push({ playlistId: playlist.id, url, channels: result.channels, programmes: result.programmes });
    } catch (error) {
      failed.push({
        playlistId: playlist.id,
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { guides, failed };
}

module.exports = {
  parseXmltv,
  getEpg,
  ingestGuide,
  refreshGuides,
};
