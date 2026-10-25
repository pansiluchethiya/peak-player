function attr(line, name) {
  const match = new RegExp(`${name}="([^"]*)"`, 'i').exec(line);
  if (match) return match[1] || null;
  const match2 = new RegExp(`${name}=([^\\s,]+)`, 'i').exec(line);
  return match2 ? match2[1] || null : null;
}

function parseM3u(text, baseUrl) {
  const channels = [];
  const lines = text.split(/\r?\n/);
  let pending = null;
  let headers = {};

  const resolveUrl = (raw) => {
    const url = raw.trim();
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    if (baseUrl) {
      try {
        return new URL(url, baseUrl).href;
      } catch {
        return url;
      }
    }
    return url;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#EXTM3U')) continue;

    if (line.startsWith('#EXTINF')) {
      pending = {
        name: line.split(',').slice(1).join(',').trim() || 'Unknown',
        tvgId: attr(line, 'tvg-id'),
        groupTitle: attr(line, 'group-title'),
        logo: attr(line, 'tvg-logo'),
        language: attr(line, 'tvg-language'),
        country: attr(line, 'tvg-country'),
        headers: { ...headers },
      };
      headers = {};
      continue;
    }

    if (line.startsWith('#EXTVLCOPT:')) {
      const opt = line.slice('#EXTVLCOPT:'.length);
      const eq = opt.indexOf('=');
      if (eq > 0) {
        const key = opt.slice(0, eq).trim().toLowerCase();
        const value = opt.slice(eq + 1).trim();
        if (key === 'http-user-agent') headers['User-Agent'] = value;
        else if (key === 'http-referrer' || key === 'http-referer') headers['Referer'] = value;
        else if (key === 'http-origin') headers['Origin'] = value;
      }
      continue;
    }

    if (line.startsWith('#')) continue;

    if (pending) {
      pending.url = resolveUrl(line);
      pending.headers = { ...headers, ...(pending.headers || {}) };
      channels.push(pending);
      pending = null;
      headers = {};
    } else {
      channels.push({
        name: line.split('/').pop().split('?')[0] || 'Unknown',
        url: resolveUrl(line),
        tvgId: null,
        groupTitle: null,
        logo: null,
        language: null,
        country: null,
        headers: { ...headers },
      });
      headers = {};
    }
  }

  return { channels };
}

module.exports = { parseM3u };
