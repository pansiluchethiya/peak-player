'use strict';

const {
  getDetails: getTmdbDetails,
  getEpisodeDetails: getTmdbEpisodeDetails,
  isRealTmdbKey,
} = require('./tmdb');
const { getTmdbApiKey: readTmdbApiKey } = require('./tmdbKey');

const STAGE_TIMEOUT_MS = 4000;
const TMDB_STILL_TIMEOUT_MS = 1000;
const MEDIA_TTL_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 15 * 60 * 1000;
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w780';
const USER_AGENT = 'PeakMediaResolver/1.0';
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const WIKIPEDIA_SUMMARY_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const TVMAZE_BASE = 'https://api.tvmaze.com';

const mediaCache = new Map();

const defaultFetch = (...args) => import('node-fetch').then((module) => module.default(...args));

class MediaResolverError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'MediaResolverError';
    this.code = code;
  }
}

function asText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /^(null|undefined)$/i.test(trimmed)) return null;
  return trimmed;
}

function asUrl(value) {
  const text = asText(value);
  return text && /^https?:\/\//i.test(text) ? text : null;
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function asYear(value) {
  const number = asNumber(value);
  if (number === null) return null;
  const year = Math.trunc(number);
  return year >= 1000 && year <= 9999 ? year : null;
}

function parseYear(value) {
  const text = asText(value);
  if (!text) return null;
  const match = text.match(/\b(1[89]\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = asText(value);
    if (text && !seen.has(text)) {
      seen.add(text);
      result.push(text);
    }
  }
  return result;
}

function uniqueUrls(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const url = asUrl(value);
    if (url && !seen.has(url)) {
      seen.add(url);
      result.push(url);
    }
  }
  return result;
}

function addCandidate(list, value) {
  const url = asUrl(value);
  if (!url || list.includes(url)) return;
  list.push(url);
}

function decodeEntities(value) {
  const decodeCodePoint = (code) => {
    try {
      return String.fromCodePoint(code);
    } catch {
      return '';
    }
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => decodeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => decodeCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function stripHtml(value) {
  const text = asText(value);
  if (!text) return null;
  const stripped = decodeEntities(text.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  return stripped || null;
}

function positiveInteger(value) {
  const text = String(value);
  if (!/^\d+$/.test(text)) return null;
  const number = Number.parseInt(text, 10);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function emptyRecord(type, id) {
  return {
    id,
    type,
    title: null,
    year: null,
    overview: null,
    tagline: null,
    runtime: null,
    genres: [],
    rating: null,
    poster: { candidates: [] },
    backdrop: null,
    stills: [],
    seriesPoster: null,
    source: 'generated',
  };
}

function finalize(record) {
  return {
    id: record.id,
    type: record.type,
    title: asText(record.title) || 'Untitled',
    year: asYear(record.year),
    overview: asText(record.overview),
    tagline: asText(record.tagline),
    runtime: asNumber(record.runtime),
    genres: uniqueStrings(record.genres),
    rating: asNumber(record.rating),
    poster: { candidates: uniqueUrls(record.poster && record.poster.candidates) },
    backdrop: asText(record.backdrop),
    stills: uniqueUrls(record.stills),
    seriesPoster: asText(record.seriesPoster),
    source: record.source,
  };
}

function validateRequest(input) {
  const request = input && typeof input === 'object' ? input : {};
  if (request.type !== 'movie' && request.type !== 'tv') {
    throw new MediaResolverError('INVALID_MEDIA_TYPE', 'Media type must be "movie" or "tv"');
  }
  const id = request.id === null || request.id === undefined ? '' : String(request.id).trim();
  if (!/^\d+$/.test(id)) {
    throw new MediaResolverError('INVALID_MEDIA_ID', 'Media id must be a numeric TMDB id');
  }
  return {
    type: request.type,
    id,
    season: positiveInteger(request.season) || 1,
    episode: positiveInteger(request.episode) || 1,
  };
}

function normalizeDependencies(dependencies) {
  const deps = dependencies && typeof dependencies === 'object' ? dependencies : {};
  return {
    getTmdbApiKey: typeof deps.getTmdbApiKey === 'function' ? deps.getTmdbApiKey : readTmdbApiKey,
    getDetails: typeof deps.getDetails === 'function' ? deps.getDetails : getTmdbDetails,
    getEpisodeDetails: typeof deps.getEpisodeDetails === 'function' ? deps.getEpisodeDetails : getTmdbEpisodeDetails,
    fetch: typeof deps.fetch === 'function' ? deps.fetch : defaultFetch,
    now: typeof deps.now === 'function' ? deps.now : Date.now,
  };
}

function createStageBudget(deps, timeoutMs = STAGE_TIMEOUT_MS) {
  const deadline = deps.now() + timeoutMs;
  const remaining = () => Math.max(0, deadline - deps.now());
  const arm = (onTimeout) => setTimeout(onTimeout, remaining());

  return {
    async run(task) {
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = arm(() => reject(new Error('media resolver stage timed out')));
      });
      try {
        return await Promise.race([Promise.resolve().then(task), timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
    async json(url, headers) {
      const controller = new AbortController();
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = arm(() => {
          controller.abort();
          reject(new Error('media resolver request timed out'));
        });
      });
      try {
        const response = await Promise.race([
          Promise.resolve().then(() => deps.fetch(url, { headers, signal: controller.signal })),
          timeout,
        ]);
        if (!response) throw new Error('media resolver empty response');
        if (response.ok === false) throw new Error(`media resolver http ${response.status}`);
        return await Promise.race([Promise.resolve().then(() => response.json()), timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function tmdbImage(path) {
  const text = asText(path);
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  return `${TMDB_IMAGE_BASE}${text.startsWith('/') ? '' : '/'}${text}`;
}

function mapTmdbRecord(request, details) {
  const record = emptyRecord(request.type, request.id);
  record.title = asText(details.title) || asText(details.name);
  record.year = parseYear(details.release_date || details.first_air_date);
  record.overview = asText(details.overview);
  record.tagline = asText(details.tagline);
  let runtime = asNumber(details.runtime);
  if (runtime === null && request.type === 'tv' && Array.isArray(details.episode_run_time)) {
    runtime = asNumber(details.episode_run_time[0]);
  }
  record.runtime = runtime;
  record.genres = Array.isArray(details.genres)
    ? details.genres.map((genre) => asText(genre && genre.name)).filter(Boolean)
    : [];
  record.rating = asNumber(details.vote_average);
  const poster = tmdbImage(details.poster_path);
  if (poster) addCandidate(record.poster.candidates, poster);
  record.backdrop = tmdbImage(details.backdrop_path);
  if (request.type === 'tv') record.seriesPoster = poster;
  record.source = 'tmdb';
  return record;
}

async function resolveTmdb(request, deps) {
  const budget = createStageBudget(deps);
  const details = await budget.run(() => deps.getDetails(request.type, request.id));
  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;
  const title = asText(details.title) || asText(details.name);
  if (!title) return null;

  // Map the details hit before the optional episode lookup so a hung still
  // request can never discard otherwise-valid series metadata.
  const record = mapTmdbRecord(request, details);

  if (request.type === 'tv' && typeof deps.getEpisodeDetails === 'function') {
    try {
      const stillBudget = createStageBudget(deps, TMDB_STILL_TIMEOUT_MS);
      const episode = await stillBudget.run(
        () => deps.getEpisodeDetails(request.type, request.id, request.season, request.episode),
      );
      const still = episode && tmdbImage(episode.still_path);
      if (still) addCandidate(record.stills, still);
    } catch {
      // A missing or slow still must not lose the TMDB details hit.
    }
  }
  return record;
}

function bindingValue(binding, names) {
  for (const name of names) {
    const value = binding && binding[name] && binding[name].value;
    const text = asText(value);
    if (text) return text;
  }
  return null;
}

function commonsImageUrl(value) {
  const text = asText(value);
  if (!text) return null;
  let file = text;
  const filePathMarker = '/Special:FilePath/';
  const filePathIndex = file.indexOf(filePathMarker);
  if (filePathIndex >= 0) {
    file = file.slice(filePathIndex + filePathMarker.length);
  } else if (/^https?:\/\//i.test(file)) {
    const fileMarker = '/wiki/File:';
    const fileIndex = file.indexOf(fileMarker);
    if (fileIndex < 0) return null;
    file = file.slice(fileIndex + fileMarker.length);
  }
  file = file.split('?')[0].split('#')[0];
  try {
    file = decodeURIComponent(file);
  } catch {
    // Keep the raw value when it is not valid percent-encoding.
  }
  file = file.replace(/^File:/i, '').trim().replace(/ /g, '_');
  if (!file) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`;
}

function extractArticleTitle(value) {
  const text = asText(value);
  if (!text) return null;
  let article = text;
  const match = text.match(/\/wiki\/([^?#]+)/);
  if (match) {
    article = match[1];
  } else if (/^https?:\/\//i.test(article)) {
    return null;
  }
  article = article.split('#')[0].split('?')[0];
  try {
    article = decodeURIComponent(article);
  } catch {
    // Keep the raw value when it is not valid percent-encoding.
  }
  article = article.replace(/ /g, '_');
  return article || null;
}

async function resolveWikidata(request, deps) {
  const budget = createStageBudget(deps);
  const property = request.type === 'tv' ? 'P4983' : 'P4947';
  const query = [
    'PREFIX wdt: <http://www.wikidata.org/prop/direct/>',
    'PREFIX wikibase: <http://wikiba.se/ontology#>',
    'PREFIX bd: <http://www.bigdata.com/rdf#>',
    'PREFIX schema: <http://schema.org/>',
    'SELECT ?item ?itemLabel ?article ?P345 ?P18 WHERE {',
    `  ?item wdt:${property} "${request.id}".`,
    '  OPTIONAL { ?item wdt:P345 ?P345. }',
    '  OPTIONAL { ?item wdt:P18 ?P18. }',
    '  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/>. }',
    '  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }',
    '}',
    'LIMIT 1',
  ].join('\n');
  const url = `${WIKIDATA_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const body = await budget.json(url, {
    'User-Agent': USER_AGENT,
    Accept: 'application/sparql-results+json',
  });
  const bindings = body && body.results && Array.isArray(body.results.bindings) ? body.results.bindings : [];
  const binding = bindings.find((item) => item && typeof item === 'object');
  if (!binding) return null;

  const data = {
    label: bindingValue(binding, ['itemLabel', 'label']),
    imdbId: bindingValue(binding, ['P345', 'imdb', 'imdbId']),
    image: commonsImageUrl(bindingValue(binding, ['P18', 'image'])),
    article: extractArticleTitle(bindingValue(binding, ['article', 'articleUrl'])),
  };
  if (!data.label && !data.imdbId && !data.image && !data.article) return null;
  return data;
}

function applyWikidata(record, data) {
  if (data.label && !asText(record.title)) record.title = data.label;
  if (data.image) addCandidate(record.poster.candidates, data.image);
  if (record.source === 'generated' && (data.label || data.image)) record.source = 'wikidata';
}

async function resolveWikipedia(articleTitle, deps) {
  const budget = createStageBudget(deps);
  const url = `${WIKIPEDIA_SUMMARY_BASE}/${encodeURIComponent(articleTitle)}`;
  const summary = await budget.json(url, {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  });
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return null;
  return summary;
}

function applyWikipedia(record, summary) {
  const title = asText(summary.title);
  const extract = asText(summary.extract);
  const original = asText(summary.originalimage && summary.originalimage.source);
  const thumbnail = asText(summary.thumbnail && summary.thumbnail.source);
  if (!title && !extract && !original && !thumbnail) return;

  if (title) record.title = title;
  const year = parseYear(asText(summary.description));
  if (year) record.year = year;
  if (extract) record.overview = extract;
  const images = [original, thumbnail].filter(Boolean);
  if (images.length) {
    record.poster.candidates = uniqueUrls([...images, ...record.poster.candidates]);
  }
  record.source = 'wikipedia';
}

async function resolveTvmaze(request, imdbId, deps) {
  if (request.type !== 'tv') return null;
  const budget = createStageBudget(deps);
  const headers = { 'User-Agent': USER_AGENT, Accept: 'application/json' };

  const showUrl = imdbId
    ? `${TVMAZE_BASE}/lookup/shows?imdb=${encodeURIComponent(imdbId)}`
    : `${TVMAZE_BASE}/lookup/shows?imdb=`;

  const show = await budget.json(showUrl, headers);
  if (!show || typeof show !== 'object' || Array.isArray(show) || show.id === null || show.id === undefined) return null;

  let episode = null;
  try {
    // TVMaze's documented route is singular (`episodebynumber`); the plural
    // form used by the brief returns 404 against the live API.
    const episodeUrl = `${TVMAZE_BASE}/shows/${encodeURIComponent(String(show.id))}/episodebynumber?season=${request.season}&number=${request.episode}`;
    const episodeBody = await budget.json(episodeUrl, headers);
    if (Array.isArray(episodeBody)) episode = episodeBody[0] || null;
    else if (episodeBody && typeof episodeBody === 'object') episode = episodeBody;
  } catch {
    episode = null;
  }
  return { show, episode };
}

function applyTvmaze(record, data) {
  const { show, episode } = data;
  const name = asText(show.name);
  if (name) record.title = name;

  const year = parseYear(show.premiered);
  if (year) record.year = year;

  if (Array.isArray(show.genres)) {
    const genres = uniqueStrings(show.genres);
    if (genres.length) record.genres = genres;
  }

  const rating = asNumber(show.rating && show.rating.average);
  if (rating !== null) record.rating = rating;

  const showImage = asUrl(show.image && show.image.original) || asUrl(show.image && show.image.medium);
  if (showImage) {
    record.seriesPoster = showImage;
    addCandidate(record.poster.candidates, showImage);
  }

  if (episode) {
    const overview = stripHtml(episode.summary);
    if (overview) record.overview = overview;
    const runtime = asNumber(episode.runtime);
    if (runtime !== null) record.runtime = runtime;
    const still = asUrl(episode.image && episode.image.original)
      || asUrl(episode.image && episode.image.medium);
    if (still) addCandidate(record.stills, still);
  }
  record.source = 'tvmaze';
}

async function resolveMedia(input, dependencies) {
  const request = validateRequest(input);
  const deps = normalizeDependencies(dependencies);
  const record = emptyRecord(request.type, request.id);

  let tmdbKey = null;
  try {
    tmdbKey = deps.getTmdbApiKey();
  } catch {
    tmdbKey = null;
  }

  if (isRealTmdbKey(tmdbKey)) {
    try {
      const tmdbRecord = await resolveTmdb(request, deps);
      if (tmdbRecord) return finalize(tmdbRecord);
    } catch {
      // A TMDB miss or timeout falls through to the keyless chain.
    }
  }

  let imdbId = null;
  let articleTitle = null;
  try {
    const wikidata = await resolveWikidata(request, deps);
    if (wikidata) {
      imdbId = wikidata.imdbId || null;
      articleTitle = wikidata.article || null;
      applyWikidata(record, wikidata);
    }
  } catch {
    // Wikidata is optional; continue to the next stage.
  }

  if (articleTitle) {
    try {
      const summary = await resolveWikipedia(articleTitle, deps);
      if (summary) applyWikipedia(record, summary);
    } catch {
      // Wikipedia is optional; keep whatever Wikidata supplied.
    }
  }

  try {
    const tvmaze = await resolveTvmaze(request, imdbId, deps);
    if (tvmaze) applyTvmaze(record, tvmaze);
  } catch {
    // TVMaze is optional; keep the best record gathered so far.
  }

  return finalize(record);
}

function cloneMedia(media) {
  return media && typeof media === 'object' ? JSON.parse(JSON.stringify(media)) : media;
}

function mediaCacheKey(request) {
  return `${request.type}:${request.id}:${request.season}:${request.episode}`;
}

// Resolved records are cached per type/id/season/episode. Positive records live
// for six hours; generated fallbacks only fifteen minutes so a transient
// provider outage does not pin an empty record for the rest of the day.
async function getMedia(input, dependencies) {
  const request = validateRequest(input);
  const deps = dependencies && typeof dependencies === 'object' ? dependencies : {};
  const now = typeof deps.now === 'function' ? deps.now : Date.now;
  const resolve = typeof deps.resolveMedia === 'function' ? deps.resolveMedia : resolveMedia;
  const key = mediaCacheKey(request);
  const cached = mediaCache.get(key);

  if (cached) {
    if (cached.expiresAt > now()) {
      return { media: cloneMedia(cached.media), cacheHit: true };
    }
    mediaCache.delete(key);
  }

  const media = await resolve(request, deps);
  const ttl = media && media.source === 'generated' ? NEGATIVE_TTL_MS : MEDIA_TTL_MS;
  const record = cloneMedia(media);
  mediaCache.set(key, { media: record, expiresAt: now() + ttl });
  return { media: cloneMedia(record), cacheHit: false };
}

function clearMediaCache() {
  mediaCache.clear();
}

module.exports = {
  MEDIA_TTL_MS,
  NEGATIVE_TTL_MS,
  MediaResolverError,
  clearMediaCache,
  getMedia,
  isRealTmdbKey,
  resolveMedia,
};
