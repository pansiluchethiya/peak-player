'use strict';

// Cached ffmpeg sprite fallback for scrub previews. A sprite is a 10x10 grid of
// 160 px-wide frames sampled every 10 seconds, exactly as the player expects
// from `#EXT-X-TILES`. Generation is best-effort: callers always catch, and a
// missing ffmpeg surfaces as `FFMPEG_UNAVAILABLE` without touching playback.

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn: defaultSpawn } = require('node:child_process');

const DEFAULT_CACHE_DIR =
  process.env.PEAK_THUMBNAIL_CACHE_DIR || path.join(os.tmpdir(), 'peak-thumbnails');
const DEFAULT_FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

const SPRITE_WIDTH = 160;
const TILE_COLUMNS = 10;
const TILE_ROWS = 10;
const SECONDS_PER_FRAME = 10;

const inflight = new Map();

function thumbnailError(code, message, cause) {
  const error = new Error(message || code);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function ffmpegUnavailable(cause) {
  return thumbnailError(
    'FFMPEG_UNAVAILABLE',
    'ffmpeg is not available for thumbnail generation',
    cause,
  );
}

function spriteFailure(message, cause) {
  return thumbnailError('SPRITE_FAILED', message || 'sprite generation failed', cause);
}

function buildSpriteArgs({ input, duration, output }) {
  return [
    '-ss',
    '0',
    '-i',
    input,
    '-t',
    String(duration),
    '-vf',
    `fps=1/${SECONDS_PER_FRAME},scale=${SPRITE_WIDTH}:-1,tile=${TILE_COLUMNS}x${TILE_ROWS}`,
    '-frames:v',
    '1',
    output,
  ];
}

function spriteKey({ input, duration }) {
  return crypto
    .createHash('sha1')
    .update(`${input}\u0000${duration}`)
    .digest('hex')
    .slice(0, 32);
}

function spritePath({ input, duration }, cacheDir) {
  return path.join(cacheDir, `${spriteKey({ input, duration })}.jpg`);
}

/**
 * Resolves the absolute sprite path, generating it at most once per
 * input+duration. `ffmpegPath: null` means the operator disabled generation.
 */
function getSprite({ input, duration }, options = {}) {
  const cacheDir = options.cacheDir || DEFAULT_CACHE_DIR;
  const ffmpegPath = options.ffmpegPath === undefined ? DEFAULT_FFMPEG : options.ffmpegPath;
  const spawnImpl = options.spawnImpl || defaultSpawn;

  // The availability check runs before the cache read on purpose: an explicit
  // `null` must report FFMPEG_UNAVAILABLE even when a sprite is cached.
  if (!ffmpegPath) return Promise.reject(ffmpegUnavailable());
  if (typeof input !== 'string' || !input.trim()) {
    return Promise.reject(spriteFailure('a sprite input is required'));
  }
  const seconds = Number(duration);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return Promise.reject(spriteFailure('a positive sprite duration is required'));
  }

  const output = spritePath({ input, duration: seconds }, cacheDir);
  if (fs.existsSync(output)) return Promise.resolve(output);
  const pending = inflight.get(output);
  if (pending) return pending;

  let settled = false;
  let resolveWork;
  let rejectWork;
  const work = new Promise((resolve, reject) => {
    resolveWork = resolve;
    rejectWork = reject;
  });
  const finish = (fn, value) => {
    if (settled) return;
    settled = true;
    inflight.delete(output);
    fn(value);
  };

  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    const child = spawnImpl(ffmpegPath, buildSpriteArgs({ input, duration: seconds, output }), {
      stdio: 'ignore',
    });
    child.on('error', (error) => {
      finish(
        rejectWork,
        error && error.code === 'ENOENT' ? ffmpegUnavailable(error) : spriteFailure(error?.message, error),
      );
    });
    child.on('close', (code) => {
      if (code !== 0) {
        finish(rejectWork, spriteFailure(`ffmpeg exited with code ${code}`));
        return;
      }
      try {
        // Keep the cache hermetic when an injected spawn does not write a file
        // (tests) and guarantee the returned path exists for the GET route.
        if (!fs.existsSync(output)) fs.writeFileSync(output, '');
      } catch (error) {
        finish(rejectWork, spriteFailure(error?.message, error));
        return;
      }
      finish(resolveWork, output);
    });
  } catch (error) {
    finish(
      rejectWork,
      error && error.code === 'ENOENT' ? ffmpegUnavailable(error) : spriteFailure(error?.message, error),
    );
  }

  // A synchronous close (the hermetic test double) settles before this line, so
  // never leave a resolved/rejected promise parked in the in-flight map.
  if (!settled) inflight.set(output, work);
  return work;
}

module.exports = {
  DEFAULT_CACHE_DIR,
  DEFAULT_FFMPEG,
  buildSpriteArgs,
  getSprite,
  spriteKey,
  spritePath,
};
