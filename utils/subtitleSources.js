// Public OpenSubtitles catalogue exposed through Stremio's addon. It needs no
// API key, returns every language in one request, and serves UTF-8 SRT files
// with permissive CORS so the browser can fetch them directly.
const fetch = (...args) => import('node-fetch').then((m) => m.default(...args));

const ADDON_BASE = 'https://opensubtitles-v3.strem.io';
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 200;
const REQUEST_TIMEOUT_MS = 5000;
const cache = new Map();

// ISO 639-2/B and 639-2/T codes returned by OpenSubtitles -> ISO 639-1.
const LANGUAGE_3_TO_2 = {
  eng: 'en', spa: 'es', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de',
  ita: 'it', por: 'pt', pob: 'pt', rus: 'ru', ara: 'ar', hin: 'hi', ben: 'bn',
  jpn: 'ja', kor: 'ko', chi: 'zh', zho: 'zh', tur: 'tr', pol: 'pl',
  dut: 'nl', nld: 'nl', swe: 'sv', nor: 'no', nob: 'no', dan: 'da',
  fin: 'fi', gre: 'el', ell: 'el', heb: 'he', tha: 'th', vie: 'vi',
  ind: 'id', may: 'ms', msa: 'ms', cze: 'cs', ces: 'cs', hun: 'hu',
  rum: 'ro', ron: 'ro', ukr: 'uk', per: 'fa', fas: 'fa', urd: 'ur',
  tam: 'ta', tel: 'te', mal: 'ml', kan: 'kn', mar: 'mr', guj: 'gu',
  pan: 'pa', nep: 'ne', sin: 'si', bul: 'bg', hrv: 'hr', srp: 'sr',
  slo: 'sk', slk: 'sk', slv: 'sl', lit: 'lt', lav: 'lv', est: 'et',
  ice: 'is', isl: 'is', cat: 'ca', baq: 'eu', eus: 'eu', glg: 'gl',
  afr: 'af', swa: 'sw', tgl: 'tl', fil: 'tl', bur: 'my', mya: 'my',
  khm: 'km', lao: 'lo', amh: 'am', kaz: 'kk', aze: 'az', arm: 'hy',
  hye: 'hy', geo: 'ka', kat: 'ka', alb: 'sq', sqi: 'sq', mkd: 'mk',
};

function displayLanguage(code, fallback) {
  if (code) {
    try {
      const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code);
      if (name && name !== code) return name;
    } catch {
      // Older Node builds may lack Intl.DisplayNames; the raw code still works.
    }
  }
  return fallback || 'Subtitles';
}

function normalizeLanguage(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return { lang: 'en', label: 'English' };
  const base = value.split(/[-_]/)[0];
  const code = LANGUAGE_3_TO_2[base] || (base.length === 2 ? base : base);
  // OpenSubtitles tags Brazilian Portuguese as `pob`; keep the distinction so
  // the captions menu can show the right flag.
  const label = base === 'pob' ? 'Portuguese (Brazil)' : displayLanguage(code, raw);
  return { lang: code, label };
}

function cacheKey({ imdbId, type, season, episode }) {
  return `${type}:${imdbId}:${type === 'tv' ? `${season || 1}:${episode || 1}` : ''}`;
}

/**
 * Fetches the public OpenSubtitles catalogue for a title. Failures are silent:
 * provider subtitles remain available and a missing catalogue must never fail
 * playback.
 */
async function fetchExternalSubtitles({ imdbId, type, season, episode }) {
  if (!imdbId) return [];
  const key = cacheKey({ imdbId, type, season, episode });
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.subtitles;

  const path = type === 'tv'
    ? `series/${encodeURIComponent(imdbId)}:${season || 1}:${episode || 1}`
    : `movie/${encodeURIComponent(imdbId)}`;
  const url = `${ADDON_BASE}/subtitles/${path}.json`;

  let payload;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'Peak/1.0' },
    });
    if (!response.ok) return [];
    payload = await response.json();
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }

  const seen = new Set();
  const subtitles = [];
  for (const entry of Array.isArray(payload?.subtitles) ? payload.subtitles : []) {
    if (!entry?.url || seen.has(entry.url)) continue;
    seen.add(entry.url);
    const { lang, label } = normalizeLanguage(entry.lang);
    subtitles.push({
      url: entry.url,
      lang,
      label,
      provider: 'OpenSubtitles',
    });
  }

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), subtitles });
  return subtitles;
}

/** Keeps provider tracks first, then appends catalogue languages by label. */
function mergeSubtitles(primary, extra) {
  const seenUrls = new Set();
  const seenLabels = new Set();
  const merged = [];
  // Providers often label a track with a bare code ("en"). Prefer the
  // catalogue's named entry ("English") when both exist for the same language.
  const namedLangs = new Set(extra.map((subtitle) => String(subtitle?.lang || '')));
  const filteredPrimary = primary.filter((subtitle) => {
    const label = String(subtitle?.label || '').trim();
    return !(label.length <= 3 && namedLangs.has(String(subtitle?.lang || '')));
  });
  for (const subtitle of [...filteredPrimary, ...extra]) {
    if (!subtitle?.url) continue;
    const label = String(subtitle.label || subtitle.lang || 'Subtitles').toLowerCase();
    if (seenUrls.has(subtitle.url) || seenLabels.has(label)) continue;
    seenUrls.add(subtitle.url);
    seenLabels.add(label);
    merged.push(subtitle);
  }
  return merged;
}

module.exports = { fetchExternalSubtitles, mergeSubtitles };
