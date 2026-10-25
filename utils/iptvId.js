const crypto = require('crypto');

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'channel';
}

function encodeChannelId(name, url) {
  const slug = slugify(name);
  const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 6);
  return `channel_${slug}_${hash}`;
}

module.exports = { encodeChannelId, slugify };
