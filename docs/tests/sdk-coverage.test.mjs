import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const contentRoot = join(root, 'content', 'docs');

const contractPath = join(root, '..', 'player', 'sdk-contract.json');

async function loadContract() {
  const raw = await readFile(contractPath, 'utf8');
  return JSON.parse(raw);
}

function allText(...files) {
  return files.join('\n');
}

test('sdk.mdx documents every v2 method', async () => {
  const contract = await loadContract();
  const sdk = await readFile(join(contentRoot, 'reference', 'sdk.mdx'), 'utf8');
  for (const method of contract.methods) {
    assert.match(sdk, new RegExp(method, 'i'), `sdk.mdx missing method: ${method}`);
  }
});

test('events.mdx documents every SDK event', async () => {
  const contract = await loadContract();
  const events = await readFile(join(contentRoot, 'reference', 'events.mdx'), 'utf8');
  for (const event of contract.events) {
    assert.match(events, new RegExp(event, 'i'), `events.mdx missing event: ${event}`);
  }
});

test('errors.mdx documents every SDK error code', async () => {
  const contract = await loadContract();
  const errors = await readFile(join(contentRoot, 'reference', 'errors.mdx'), 'utf8');
  for (const code of contract.errors) {
    assert.match(errors, new RegExp(code, 'i'), `errors.mdx missing error code: ${code}`);
  }
});

test('postmessage.mdx documents the v2 request envelope', async () => {
  const postmessage = await readFile(join(contentRoot, 'reference', 'postmessage.mdx'), 'utf8');
  assert.match(postmessage, /type.*request/, 'postmessage.mdx missing request envelope');
  assert.match(postmessage, /type.*response/, 'postmessage.mdx missing response envelope');
});

test('six new docs files exist with frontmatter', async () => {
  const files = [
    'reference/events.mdx',
    'reference/errors.mdx',
    'guides/embedding.mdx',
    'guides/migrating-to-sdk-v2.mdx',
    'guides/player-controls.mdx',
    'guides/preferences.mdx',
  ];
  for (const file of files) {
    const path = join(contentRoot, file);
    const text = await readFile(path, 'utf8');
    assert.match(text, /^---\ntitle:/m, `${file} missing frontmatter title`);
  }
});
