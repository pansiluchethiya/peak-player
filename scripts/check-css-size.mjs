import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const roots = ['ui', 'player/src', 'docs/app', 'public', 'admin/app'];
const MAX_LINES = 200;
const failures = [];

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile() && entry.name.endsWith('.css')) {
      const content = await readFile(full, 'utf8');
      const lines = content.split(/\r?\n/).length;
      if (lines > MAX_LINES) failures.push({ file: full, lines });
    }
  }
}

for (const root of roots) await walk(root);

if (failures.length) {
  console.error(`CSS size check failed (${failures.length} file(s) over ${MAX_LINES} lines):`);
  for (const f of failures) console.error(`- ${f.file}: ${f.lines} lines`);
  process.exit(1);
}
console.log('CSS size check passed: all CSS files are within the 200-line limit.');
