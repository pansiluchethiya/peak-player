'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSpriteArgs, getSprite } = require('../utils/thumbnailService');

test('builds the exact ffmpeg sprite arguments', () => {
  assert.deepEqual(buildSpriteArgs({ input: 'https://cdn/a.m3u8', duration: 600, output: '/tmp/s.jpg' }), [
    '-ss', '0', '-i', 'https://cdn/a.m3u8', '-t', '600',
    '-vf', 'fps=1/10,scale=160:-1,tile=10x10', '-frames:v', '1', '/tmp/s.jpg',
  ]);
});

test('reuses a cached sprite and reports a missing ffmpeg', async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'peak-sprite-'));
  let spawns = 0;
  const spawnImpl = () => { spawns += 1; return { on: (event, fn) => { if (event === 'close') fn(0); } }; };
  const first = await getSprite({ input: 'in.m3u8', duration: 60 }, { cacheDir, ffmpegPath: 'ffmpeg', spawnImpl });
  const second = await getSprite({ input: 'in.m3u8', duration: 60 }, { cacheDir, ffmpegPath: 'ffmpeg', spawnImpl });
  assert.equal(first, second);
  assert.equal(spawns, 1);
  await assert.rejects(
    () => getSprite({ input: 'in.m3u8', duration: 60 }, { cacheDir, ffmpegPath: null }),
    (error) => error.code === 'FFMPEG_UNAVAILABLE',
  );
});
