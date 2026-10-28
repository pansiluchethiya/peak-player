'use strict';

const BASE_URL = 'https://iptv-org.github.io/api/';
const FILES = ['streams', 'channels', 'categories', 'countries', 'languages', 'guides', 'logos'];
const DEFAULT_FILTER = ['*'];

async function defaultReadJson(url) {
  const fetchImpl = globalThis.fetch || require('node-fetch');
  const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`iptv-org request failed (${res.status}) for ${url}`);
  }
  return res.json();
}

function normalizeList(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_FILTER;
  const items = (Array.isArray(value) ? value : String(value).split(/[,;\s]+/))
    .map((item) => String(item).trim())
    .filter(Boolean);
  return items.length ? items : DEFAULT_FILTER;
}

function readSettings(config) {
  const enabled = config.enabled ?? config.iptvSeedEnabled;
  return {
    enabled: enabled !== false && enabled !== 'false',
    categories: normalizeList(config.categories ?? config.iptvSeedCategories),
    countries: normalizeList(config.countries ?? config.iptvSeedCountries),
  };
}

function buildMaps({ categories, countries, languages, logos, streams }) {
  const categoryNames = new Map((categories || []).map((entry) => [entry.id, entry.name]));
  const countryNames = new Map((countries || []).map((entry) => [entry.code, entry.name]));
  const languageNames = new Map((languages || []).map((entry) => [entry.code, entry.name]));
  const logoByChannel = new Map();
  (logos || []).forEach((entry) => {
    if (entry.channel && entry.url && !logoByChannel.has(entry.channel)) {
      logoByChannel.set(entry.channel, entry.url);
    }
  });
  const streamByChannel = new Map();
  (streams || []).forEach((entry) => {
    if (entry.channel && entry.url && !streamByChannel.has(entry.channel)) {
      streamByChannel.set(entry.channel, entry);
    }
  });
  return { categoryNames, countryNames, languageNames, logoByChannel, streamByChannel };
}

function matchesFilters(channel, settings) {
  const categoryIds = Array.isArray(channel.categories) ? channel.categories : [];
  if (categoryIds.includes('sports')) return true;
  const categoryOk = settings.categories.includes('*')
    || categoryIds.some((id) => settings.categories.includes(id));
  const countryOk = settings.countries.includes('*') || settings.countries.includes(channel.country);
  return categoryOk && countryOk;
}

function toSeedChannel({ channel, stream, categoryIds }, index, maps) {
  const { categoryNames, countryNames, languageNames, logoByChannel } = maps;
  const languageCode = Array.isArray(channel.languages) ? channel.languages[0] : null;
  const headers = {};
  if (stream.user_agent) headers['User-Agent'] = stream.user_agent;
  if (stream.referrer) headers.Referer = stream.referrer;
  return {
    id: channel.id,
    name: channel.name,
    tvgId: channel.id,
    group: categoryIds.length ? (categoryNames.get(categoryIds[0]) ?? categoryIds[0]) : null,
    logo: logoByChannel.get(channel.id) ?? channel.logo ?? null,
    url: stream.url,
    headers,
    language: languageCode ? (languageNames.get(languageCode) ?? languageCode) : null,
    country: channel.country ? (countryNames.get(channel.country) ?? channel.country) : null,
    position: index,
  };
}

async function seedIptv({ config = {}, readJson = defaultReadJson, store = require('./iptvStore'), now = new Date() } = {}) {
  const settings = readSettings(config);
  if (!settings.enabled) {
    return { playlist: null, channels: [], skipped: 0 };
  }

  const payloads = await Promise.all(FILES.map((file) => readJson(`${BASE_URL}${file}.json`)));
  const [streams, channels, categories, countries, languages, guides, logos] = payloads;
  const maps = buildMaps({ categories, countries, languages, logos, streams });

  const included = [];
  let skipped = 0;
  (channels || []).forEach((channel) => {
    const stream = maps.streamByChannel.get(channel.id);
    if (!stream || !matchesFilters(channel, settings)) {
      skipped += 1;
      return;
    }
    const categoryIds = Array.isArray(channel.categories) ? channel.categories : [];
    included.push({ channel, stream, categoryIds });
  });

  const records = included.map((entry, index) => toSeedChannel(entry, index, maps));
  const includedIds = new Set(records.map((record) => record.id));
  const guide = (guides || []).find(
    (entry) => entry && entry.url && entry.channel && includedIds.has(entry.channel),
  );

  const playlist = store.ensureSeedPlaylist(guide ? { guideUrl: guide.url } : {});
  store.upsertChannels(playlist.id, records);

  return { playlist, channels: records, skipped };
}

module.exports = { seedIptv, defaultReadJson, BASE_URL };
