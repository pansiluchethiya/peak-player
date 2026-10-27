import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const requiredGuides = [
  'index.mdx',
  'concepts.mdx',
  'quickstart.mdx',
  'guides/movies.mdx',
  'guides/tv.mdx',
  'guides/live-tv.mdx',
  'guides/auth.mdx',
  'guides/theming.mdx',
  'guides/playback.mdx',
  'guides/errors.mdx',
  'guides/embedding.mdx',
  'guides/migrating-to-sdk-v2.mdx',
  'guides/player-controls.mdx',
  'guides/preferences.mdx',
  'reference/urls.mdx',
  'reference/sdk.mdx',
  'reference/events.mdx',
  'reference/errors.mdx',
  'reference/postmessage.mdx',
  'api-reference.mdx',
  'self-hosting.mdx',
  'architecture.mdx',
  'source-pipeline.mdx',
  'security.mdx',
  'troubleshooting.mdx',
  'changelog.mdx',
  'status.mdx',
  'legal.mdx',
  'faq.mdx',
];

test('every required guide exists with frontmatter', async () => {
  for (const guide of requiredGuides) {
    const path = join(root, 'content', 'docs', guide);
    await stat(path);
    const source = await readFile(path, 'utf8');
    assert.match(source, /^---\n/, `${guide} must start with frontmatter`);
    assert.match(source, /\ntitle:\s*\S+/, `${guide} must declare a title`);
    assert.match(source, /\ndescription:\s*\S+/, `${guide} must declare a description`);
  }
});

test('OpenAPI contract documents embed sessions and playback health', async () => {
  const raw = await readFile(join(root, 'public', 'openapi.json'), 'utf8');
  const spec = JSON.parse(raw);
  assert.equal(spec.openapi, '3.1.0');
  assert.ok(spec.paths['/api/v1/embed/sessions'], 'embed sessions path is missing');
  assert.ok(spec.paths['/api/v1/playback/health'], 'playback health path is missing');
  assert.ok(
    spec.components.securitySchemes.partnerApiKey,
    'partner API key security scheme is missing',
  );
});

test('docs navigation metadata is present', async () => {
  const meta = JSON.parse(await readFile(join(root, 'content', 'docs', 'meta.json'), 'utf8'));
  assert.ok(Array.isArray(meta.pages));
  assert.ok(meta.pages.includes('quickstart'));
  assert.ok(meta.pages.includes('api-reference'));
});
