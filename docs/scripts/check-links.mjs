import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const contentRoot = path.join(root, 'content', 'docs');
const publicRoot = path.join(root, 'public');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

function pageUrl(file) {
  const relative = path.relative(contentRoot, file).replace(/\\/g, '/');
  const withoutExt = relative.replace(/\.(mdx?|md)$/, '');
  if (withoutExt === 'index') return '/docs';
  if (withoutExt.endsWith('/index')) return `/docs/${withoutExt.slice(0, -'/index'.length)}`;
  return `/docs/${withoutExt}`;
}

function normalizeLink(raw, fromUrl) {
  let value = raw.trim();
  if (!value || value.startsWith('#') || /^(https?:|mailto:|tel:|data:)/i.test(value)) return null;
  if (value.startsWith('<') && value.endsWith('>')) value = value.slice(1, -1);
  const hashIndex = value.indexOf('#');
  if (hashIndex >= 0) value = value.slice(0, hashIndex);
  const queryIndex = value.indexOf('?');
  if (queryIndex >= 0) value = value.slice(0, queryIndex);
  if (!value) return null;
  if (value.startsWith('/')) return value;
  const base = fromUrl.endsWith('/') ? fromUrl : fromUrl.replace(/\/[^/]*$/, '');
  const resolved = path.posix.normalize(`${base}/${value}`);
  return resolved.startsWith('/') ? resolved : `/${resolved}`;
}

async function existsPublic(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const target = path.join(publicRoot, decoded.replace(/^\/+/, ''));
  try {
    const info = await stat(target);
    return info.isFile();
  } catch {
    return false;
  }
}

const files = (await walk(contentRoot)).filter((file) => /\.(mdx?|md)$/.test(file));
const validPages = new Set(files.map(pageUrl));
validPages.add('/docs/');
validPages.add('/');

const errors = [];
let checked = 0;

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const fromUrl = pageUrl(file);
  const links = new Set();

  for (const match of source.matchAll(/(!?)\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
    if (!match[1]) links.add(match[2]);
  }
  for (const match of source.matchAll(/\bhref\s*=\s*["']([^"']+)["']/g)) {
    links.add(match[1]);
  }

  for (const raw of links) {
    const url = normalizeLink(raw, fromUrl);
    if (!url) continue;
    checked += 1;
    if (url === '/' || validPages.has(url)) continue;
    if (url.startsWith('/docs/')) {
      const withoutTrailing = url.replace(/\/$/, '');
      if (validPages.has(withoutTrailing)) continue;
      errors.push(`${path.relative(root, file)} -> ${raw} (missing page ${url})`);
      continue;
    }
    if (await existsPublic(url)) continue;
    errors.push(`${path.relative(root, file)} -> ${raw} (missing asset or page ${url})`);
  }
}

if (errors.length) {
  console.error(`Link check failed with ${errors.length} problem(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Link check passed: ${checked} internal link(s) across ${files.length} page(s).`);
