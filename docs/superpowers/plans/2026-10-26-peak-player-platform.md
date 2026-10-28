# Peak Player Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two divergent players with one `@videojs/react` engine, a vendored AMOLED skin, real metadata and artwork, a seeded and validated IPTV/EPG catalogue, persistent preferences, the full control superset, and a documented SDK v2 — without breaking SDK v1.

**Architecture:** A single `PlayerRoot` + `PlayerProvider` owns discovery, source selection, preferences, and the control surface. `@videojs/react` owns the `<video>` element through its `HlsJsVideo` adapter; the vendored Shadcn skin provides the DOM the custom controls extend. Express gains focused route modules and resolver/sync services, while the player keeps one typed client per backend surface.

**Tech Stack:** Next.js 15.5.28, React 19.3.1, TypeScript 5.7, Tailwind CSS 4.3.3, `@videojs/react@10.2.0`, `@videojs/hlsjs-video@10.2.0`, `@videojs/mux-data@10.2.0`, hls.js 1.7.x, Express 4, better-sqlite3, Node 24 test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-26-peak-player-platform-design.md`

## Global Constraints

- Dark canvas is `#000000`; light surface is `#ffffff`. Accent is `#333333` in light mode and `#e5e5e5` in dark mode. Geist Sans + Geist Mono only. No green UI accent.
- `@videojs/react` is pinned to exactly `10.2.0`; its HLS and Mux peers are pinned to `10.2.0`. `video.js` is removed. `hls.js` stays only as the adapter peer.
- The vendored skin source lives under `player/src/components/player/videojs/` and is installed by `npx shadcn@latest add @videojs/video --overwrite --yes`. It is an editable fork: local changes are allowed but every modified generated file must be listed with its diff in `player/src/components/player/videojs/README.md` so a future registry update can be re-applied. Our wrapper is `player/src/components/player/VideoSkin.tsx`.
- Ports: API `8787`, player `3011`, admin `3003`, docs `3002`.
- Mica caption material is exactly `background: rgb(0 0 0 / 55%)` with a `rgb(255 255 255 / 6%)` overlay, `backdrop-filter: blur(18px) saturate(140%)`, `border-radius: 12px`, and `box-shadow: inset 0 1px 0 rgb(255 255 255 / 12%)`.
- Volume boost is `MediaElementSource → GainNode → DynamicsCompressor(threshold -3 dB, knee 6, ratio 12, attack 3 ms, release 250 ms) → destination`. Normal range is 0–300%; 500% requires `boostUnlocked` and shows a headphone warning. Values above 300% are amber.
- Preferences modes are `browser` (default), `server`, and `user`; precedence is provider default < partner token override < user preference; a partner may set `locked: true` per key.
- Autoplay is muted with a tap-to-unmute affordance. Provider defaults live in admin config; viewer preference is persisted.
- English-only UI, but every user-facing string lives in `player/src/components/player/i18n/messages.en.ts`; `Intl.*` for dates/numbers; logical CSS properties only.
- IPTV seed defaults: `IPTV_SEED_ENABLED=true`, `IPTV_SEED_CATEGORIES=*`, `IPTV_SEED_COUNTRIES=*`, `IPTV_SYNC_INTERVAL_MS=10800000`, `IPTV_VALIDATE_CONCURRENCY=8`, `IPTV_VALIDATE_TIMEOUT_MS=6000`.
- SDK v1 is preserved at `PeakEmbed.*`; SDK v2 lives at `PeakEmbed.v2`; `PeakEmbed.version = 2`. Every row in the capability checklist must be reachable from both the UI and SDK v2.
- CSS files are capped at 200 lines. Generated `admin/app/legacy.css` and vendored `player/src/components/player/videojs/**` are exempt. Never raise the cap.
- Never commit `.env`, `player/.env.local`, `utils/peak.db*`, `utils/auth-users.json`, `node_modules`, `.next`, `.source`, or generated sprite caches.
- RAM guard: at most two dev servers at once; no concurrent builds; Playwright serial, one browser and one context. Start servers detached: `cd <repo> && setsid nohup <cmd> > /tmp/opencode/<name>.log 2>&1 < /dev/null &`.
- Each phase ends with `npm run check` green and a visual sweep of every route in both themes at 1440 px and 390 px.

## Review Focus

These are the input classes the spec implies but no happy-path task covers. Each is pinned to a test in the owning task.

1. **A stream returns HTTP 200 with an HTML error page or an empty body.** A reasonable person expects it hidden as dead, not offered as `ok`; the validator must classify it `dead` and the player must never show a spinner. Pinned in Task 11.
2. **The metadata chain fails entirely for an unknown id.** A reasonable person expects playback to continue with a typographic card and a title that is not `"Peak"`; the resolver must return a generated record, not throw. Pinned in Tasks 7 and 8.
3. **A client calls an SDK method before `ready`, after `destroy`, or from a disallowed origin.** A reasonable person expects a rejected promise with a typed code and no unhandled rejection or event leakage. Pinned in Task 19.
4. **A re-seed or re-sync encounters duplicate channel ids and previously disabled/healthy channels.** A reasonable person expects no duplicates and no reset of operator enable state or health history. Pinned in Task 10.
5. **Preference storage is unavailable (quota, privacy mode, server 503).** A reasonable person expects the player to keep working with in-memory preferences, log once, and never throw. Pinned in Task 16.

---

## Phase P1 — Engine and Skin

### Task 1: Baseline checks, CSS budget, and folded visual bugs

**Files:**
- Create: `tests/cssBudget.test.js`
- Create: `player/tests/bugs.test.ts`
- Create: `player/src/styles/player-stage.css`
- Create: `player/src/styles/player-feedback.css`
- Modify: `package.json`
- Modify: `scripts/check-css-size.mjs`
- Modify: `player/src/styles/player.css`
- Modify: `player/src/styles/landing.css`
- Modify: `player/src/styles/player-2.css`
- Modify: `player/src/app/globals.css`
- Modify: `player/next.config.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run test:api`, a `check` script that includes root tests, CSS exemption rules, and the split stylesheets `player-stage.css` / `player-feedback.css`.

- [ ] **Step 1: Write the failing checks**

Create `tests/cssBudget.test.js`:
```js
'use strict';
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
test('css budget passes', () => {
  execFileSync(process.execPath, ['scripts/check-css-size.mjs'], { stdio: 'pipe' });
});
```

Create `player/tests/bugs.test.ts`:
```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (p: string) => readFileSync(p, 'utf8');

describe('folded visual bugs', () => {
  it('landing canvas follows the theme background token', () => {
    const css = read('src/styles/landing.css');
    assert.match(css, /\.peak-site\s*\{[^}]*background:[^;]*var\(--color-bg\)/s);
  });
  it('error copy is readable', () => {
    assert.doesNotMatch(read('src/styles/player-2.css'), /var\(--color-fg\) 7%/);
  });
  it('the Next dev badge is disabled', () => {
    assert.match(read('next.config.mjs'), /devIndicators:\s*false/);
  });
});
```

- [ ] **Step 2: Run the checks to verify they fail**

Run: `node --test tests/cssBudget.test.js` and `cd player && npx tsx --test tests/bugs.test.ts`
Expected: the CSS check exits 1 naming `player/src/styles/player.css` and `admin/app/legacy.css`; the bug test fails on the landing background, the 7% opacity, and the missing `devIndicators`.

- [ ] **Step 3: Implement the baseline fixes**

In `package.json`, add:
```json
"test:api": "node --test tests/*.test.js"
```
and make `check`:
```json
"check": "npm run lint && npm run check:player && npm run check:docs && npm run test:api && npm run check:css"
```

In `scripts/check-css-size.mjs`, add an explicit allowlist before the line check:
```js
const EXEMPT_PREFIXES = ['player/src/components/player/videojs/'];
const EXEMPT_FILES = ['admin/app/legacy.css'];
```
Skip a file when its normalized path is in `EXEMPT_FILES`, starts with an exempt prefix, or its first 200 characters contain `GENERATED`. Do not change `MAX_LINES`.

Split `player/src/styles/player.css` at the existing section comments: keep the root, video host/fill and `::cue` rules (through the `::cue` block) in `player.css`; move the ambient background and vignette sections to `player-stage.css`; move the gesture layer, center feedback and skip feedback sections to `player-feedback.css`. Import both new files immediately after `player.css` in `player/src/app/globals.css`. Every file must stay under 200 lines.

In `player/src/styles/landing.css`, change the `.peak-site` background fallback from `var(--color-fg)` to `var(--color-bg)` so light mode is white-on-black text inverted correctly.

In `player/src/styles/player-2.css`, replace the 7% `color-mix` with `color: var(--color-muted)`.

In `player/next.config.mjs`, add `devIndicators: false`.

- [ ] **Step 4: Run the checks to verify they pass**

Run: `node --test tests/cssBudget.test.js` and `cd player && npx tsx --test tests/bugs.test.ts`
Expected: both PASS. Also run `npm run check:css` and expect `CSS size check passed`.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/check-css-size.mjs tests/cssBudget.test.js player/tests/bugs.test.ts player/src/styles/player.css player/src/styles/player-stage.css player/src/styles/player-feedback.css player/src/styles/landing.css player/src/styles/player-2.css player/src/app/globals.css player/next.config.mjs
git commit -m "chore(player): restore the check pipeline and split the CSS budget"
```

### Task 2: Stream route contract and real `?source=` selection

**Files:**
- Create: `routes/streamRoutes.js`
- Create: `tests/streamRoutes.test.js`
- Create: `player/tests/api.test.ts`
- Modify: `apiServer.js:388-503`
- Modify: `utils/playerService.js` (`getPlayerStream`, `getPlayerStreamEvents`, `aggregateCacheKey`)
- Modify: `player/src/lib/api.ts`
- Modify: `tests/playerService.test.js`

**Interfaces:**
- Consumes: existing `getPlayerStream`, `getPlayerStreamEvents`, `providerOrder`, and `requestBaseUrl`.
- Produces: `createStreamRoutes(app, { getPlayerStream, getPlayerStreamEvents, serverUrl, validSource, config, onRequest, onSources })`; both `/api/v1/stream/:type/:id` and `/api/v1/stream/:type/:id/:season/:episode`; the same pair under `/events`; `source?: string` accepted as a query parameter; `eventsPath(media, options?)` exported from `player/src/lib/api.ts`.

- [ ] **Step 1: Write the failing tests**

Create `tests/streamRoutes.test.js` with a real Express app and an ephemeral listener:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createStreamRoutes } = require('../routes/streamRoutes');

async function withApp(deps, fn) {
  const app = express();
  createStreamRoutes(app, deps);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { server.close(); }
}

test('four-segment TV stream route maps season and episode', async () => {
  const calls = [];
  await withApp({
    getPlayerStream: async (args) => { calls.push(args); return { id: args.id, type: args.type, title: 'T', sources: [], subtitles: [], diagnostics: [] }; },
    getPlayerStreamEvents: () => {},
    serverUrl: () => 'http://api.test',
    validSource: () => true,
    config: { marker: true },
  }, async (base) => {
    const res = await fetch(`${base}/api/v1/stream/tv/1399/2/3`);
    assert.equal(res.status, 200);
    assert.deepEqual(calls[0], { type: 'tv', id: '1399', season: 2, episode: 3, source: undefined, serverUrl: 'http://api.test', config: { marker: true } });
  });
});

test('source is forwarded and invalid source is a 400', async () => {
  const calls = [];
  await withApp({
    getPlayerStream: async (args) => { calls.push(args); return { success: true }; },
    getPlayerStreamEvents: () => {},
    serverUrl: () => 'http://api.test',
    validSource: (name) => name === 'vixsrc',
  }, async (base) => {
    assert.equal((await fetch(`${base}/api/v1/stream/movie/550?source=vixsrc`)).status, 200);
    assert.equal(calls[0].source, 'vixsrc');
    const bad = await fetch(`${base}/api/v1/stream/movie/550?source=evil`);
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error, 'INVALID_SOURCE');
  });
});
```

Create `player/tests/api.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { eventsPath } from '../src/lib/api';

describe('stream paths', () => {
  it('uses query params for TV season and episode', () => {
    assert.equal(
      eventsPath({ type: 'tv', id: '1399', season: 2, episode: 3 }),
      '/api/v1/stream/events/tv/1399?season=2&episode=3',
    );
  });
  it('adds the source selector', () => {
    assert.equal(
      eventsPath({ type: 'movie', id: '550' }, { source: 'vixsrc' }),
      '/api/v1/stream/events/movie/550?source=vixsrc',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/streamRoutes.test.js` and `cd player && npx tsx --test tests/api.test.ts`
Expected: FAIL with `Cannot find module '../routes/streamRoutes'` and `eventsPath is not a function` / wrong path.

- [ ] **Step 3: Implement the route module and source selection**

`routes/streamRoutes.js` exports `createStreamRoutes`. It mounts four GET handlers and reuses one handler per family:
- `GET /api/v1/stream/:type/:id` and `/api/v1/stream/:type/:id/:season/:episode`.
- `GET /api/v1/stream/events/:type/:id` and `/api/v1/stream/events/:type/:id/:season/:episode`.
- Season/episode come from `req.params` first, then `req.query`; positive integers only, default `null` for movies.
- Type allowlist is `movie`, `tv`, `series`, `live_tv`; live ids must match `/^channel_[a-z0-9-]+_[a-f0-9]+$/`; other ids must match `/^\d+$/`.
- `source` is accepted only when `validSource(source)` returns true; otherwise respond `400 { success: false, error: 'INVALID_SOURCE' }` before SSE headers.
- Pass `serverUrl: deps.serverUrl(req)`, `source`, and `config: deps.config` into both service functions. Call `deps.onRequest?.()` and `deps.onSources?.(payload.sources.length)` after a successful JSON response.

In `apiServer.js`, replace the inline stream handlers with `createStreamRoutes(app, { ... })`. Keep the existing metric increments by passing `onRequest: () => { metrics.streamRequests += 1; }` and `onSources: (n) => { metrics.streamsReturned += n; }`. Keep the SSE `cancelled` flag on `req.on('close')`.

In `utils/playerService.js`, add `source` to `getPlayerStream` and `getPlayerStreamEvents`. When present, the provider order is exactly `[source]`; when absent, keep the existing order. `aggregateCacheKey` gains a final `source = ''` argument. `prepareStreams` and stream ranking are unchanged. Treat `source` not in `providerOrder()` as `INVALID_SOURCE` in the service as a second guard.

In `player/src/lib/api.ts`, export `eventsPath(media, options: { source?: string } = {})` and `streamPath(media, options)`. Build TV URLs as `/api/v1/stream/events/tv/<id>?season=<s>&episode=<e>` and append `source` with `URLSearchParams`. Pass `options.source` through `fetchStreamEvents` and `fetchStream`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/streamRoutes.test.js`, `cd player && npx tsx --test tests/api.test.ts`, and `node --test tests/playerService.test.js`
Expected: all PASS; the player service test now also proves a selected provider is the only one queried.

- [ ] **Step 5: Commit**

```bash
git add routes/streamRoutes.js tests/streamRoutes.test.js player/tests/api.test.ts apiServer.js utils/playerService.js player/src/lib/api.ts tests/playerService.test.js
git commit -m "fix(api): restore TV stream routes and honor source selection"
```

### Task 3: Engine dependencies and pure adapters

**Files:**
- Create: `player/src/components/player/media/source.ts`
- Create: `player/src/components/player/errors.ts`
- Create: `player/tests/engineSource.test.ts`
- Modify: `player/package.json`
- Modify: `player/src/app/globals.css`

**Interfaces:**
- Consumes: `Source`, `Media` from `player/src/lib/types.ts`.
- Produces: `engineSource(source: Source, media: Media): EngineSource`; `PeakPlayerError` and `toPlayerError`; installed `@videojs/react`, `@videojs/hlsjs-video`, and `@videojs/mux-data` at exactly `10.2.0`.

- [ ] **Step 1: Write the failing test**

Create `player/tests/engineSource.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { engineSource } from '../src/components/player/media/source';
import { PeakPlayerError, toPlayerError } from '../src/components/player/errors';

const base = { quality: 'auto', provider: 'p', expiresIn: 900, browserPlayable: true };
const movie = { type: 'movie' as const, id: '550' };

describe('engine source mapping', () => {
  it('routes adaptive sources to HLS', () => {
    assert.deepEqual(
      engineSource({ ...base, url: 'https://x/a.m3u8', codec: 'hls', adaptive: true }, movie),
      { kind: 'hls', src: 'https://x/a.m3u8', type: 'application/vnd.apple.mpegurl', streamType: 'on-demand' },
    );
  });
  it('routes progressive files to the native video element', () => {
    assert.equal(engineSource({ ...base, url: 'https://x/a.mp4', codec: 'mp4' }, movie).kind, 'native');
  });
  it('routes external pages to the embed surface', () => {
    assert.equal(engineSource({ ...base, url: 'https://x/e', codec: 'html5' }, movie).kind, 'external');
  });
});

describe('player errors', () => {
  it('keeps typed codes and maps unknown failures', () => {
    assert.equal(new PeakPlayerError('NOT_READY', 'x').code, 'NOT_READY');
    assert.equal(toPlayerError(new Error('x')).code, 'UNKNOWN');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd player && npx tsx --test tests/engineSource.test.ts`
Expected: FAIL with `Cannot find module .../media/source`.

- [ ] **Step 3: Install pinned packages and implement the adapters**

```bash
cd player
npm install --save-exact @videojs/react@10.2.0 @videojs/hlsjs-video@10.2.0 @videojs/mux-data@10.2.0
npm uninstall video.js
```
Keep `hls.js`; `@videojs/hlsjs-video` uses it as a peer. Remove `@import "video.js/dist/video-js.css";` from `player/src/app/globals.css`.

`source.ts`:
```ts
export type EngineKind = 'hls' | 'native' | 'external';
export interface EngineSource { kind: EngineKind; src: string; type?: string; streamType: 'on-demand' | 'live' | 'unknown' }
export function engineSource(source: Source, media: Media): EngineSource
```
Rules: `codec === 'html5'` or `browserPlayable === false` → `external`; `adaptive === true`, container `hls`, or path ends `.m3u8` → `hls` with `application/vnd.apple.mpegurl`; `mp4`/`webm` or a non-HLS URL with `browserPlayable !== false` → `native`; otherwise `external`. `streamType` is `live` only for `media.type === 'live_tv'`, else `on-demand`.

`errors.ts`:
```ts
export type PlayerErrorCode = 'NOT_READY' | 'UNSUPPORTED' | 'INVALID_ARGUMENT' | 'STREAM_UNAVAILABLE' | 'TOKEN_EXPIRED' | 'ORIGIN_NOT_ALLOWED' | 'PERMISSION_DENIED' | 'UNKNOWN';
export class PeakPlayerError extends Error { readonly code: PlayerErrorCode; constructor(code: PlayerErrorCode, message: string) }
export function toPlayerError(error: unknown): PeakPlayerError
```
`toPlayerError` preserves an existing `PeakPlayerError`; every other value maps to `UNKNOWN` with `error instanceof Error ? error.message : String(error)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd player && npx tsx --test tests/engineSource.test.ts && npm run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add player/package.json player/package-lock.json player/src/app/globals.css player/src/components/player/media/source.ts player/src/components/player/errors.ts player/tests/engineSource.test.ts
git commit -m "feat(player): add the videojs engine adapters"
```

### Task 4: Vendor the Shadcn video skin

**Files:**
- Create: `player/components.json`
- Create: `player/src/components/player/VideoSkin.tsx`
- Create: `player/src/styles/skin.css`
- Create: `player/tests/skin.test.ts`
- Vendor: `player/src/components/player/videojs/**` (editable fork; local changes documented in `videojs/README.md`)
- Modify: `player/package.json`, `player/src/app/globals.css`

**Interfaces:**
- Consumes: the `@videojs/react` skin primitives used by the generated Shadcn source (`Container`, `usePlayer`, UI parts). The vendored skin does not import our `EnginePlayer` or `PlayerProvider`; it binds to whichever player context wraps it at runtime.
- Produces: `VideoSkin({ children, className }: PeakVideoSkinProps)` wrapping the generated entry at `./videojs/video/skin`; `skin.css` maps the packaged `--media-*` variables onto Peak tokens.

- [ ] **Step 1: Write the failing test**

Create `player/tests/skin.test.ts`:
```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('vendored skin', () => {
  it('wraps the generated entry', () => {
    assert.match(readFileSync('src/components/player/VideoSkin.tsx', 'utf8'), /videojs\/video\/skin/);
  });
  it('binds AMOLED tokens', () => {
    const css = readFileSync('src/styles/skin.css', 'utf8');
    assert.match(css, /--media-accent-color:\s*var\(--color-accent\)/);
    assert.match(css, /--media-border-color:\s*var\(--color-border\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd player && npx tsx --test tests/skin.test.ts`
Expected: FAIL with missing `VideoSkin.tsx`.

- [ ] **Step 3: Install the skin and adapt tokens**

```bash
cd player
npm install --save-exact tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3
```
Create `player/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/app/globals.css", "baseColor": "neutral", "cssVariables": true, "prefix": "" },
  "iconLibrary": "lucide",
  "aliases": { "components": "@/components/player", "utils": "@/lib/utils", "ui": "@/components/player/ui", "lib": "@/lib", "hooks": "@/hooks" },
  "registries": { "@videojs": "https://shadcn.videojs.org/r/react/{name}.json" }
}
```
Run `npx shadcn@latest add @videojs/video --overwrite --yes`. The generated tree must land under `player/src/components/player/videojs/`; the entry is the emitted `videojs/video/skin.tsx`. If the registry emits a different leaf path, keep the tree and change only the import in the wrapper. The add also installs `videojs/styles/video/{base,captions,theme}.css` plus the `ui/` parts. Inspect the generated `skin.tsx` for CSS imports; if it does not import its own stylesheets, add `@import "../components/player/videojs/styles/video/base.css";`, `@import "../components/player/videojs/styles/video/captions.css";`, and `@import "../components/player/videojs/styles/video/theme.css";` at the top of `player/src/styles/skin.css` so the generated controls are never unstyled.

Create `VideoSkin.tsx`:
```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { VideoSkin as VendoredVideoSkin } from './videojs/video/skin';

export interface PeakVideoSkinProps { children: ReactNode; className?: string }

export function VideoSkin({ children, className }: PeakVideoSkinProps) {
  return <VendoredVideoSkin className={cn('peak-video-skin', className)}>{children}</VendoredVideoSkin>;
}
```
The generated source imports only `@videojs/react` primitives and its own alias-rewritten `@/components/player/videojs/ui/*` copies. It must not import a preset player; do not add or replace a `usePlayer` import here. The wrapper keeps our single source of truth for the skin entry path.

Create `player/src/styles/skin.css`:
```css
.peak-video-skin {
  --media-accent-color: var(--color-accent);
  --media-accent-text-color: var(--color-bg);
  --media-border-color: var(--color-border);
  --media-border-radius: var(--radius-md);
  --media-font-family: var(--font-sans);
  --media-object-fit: contain;
}
```
Import it after `tokens.css` in `globals.css`. Add `@source "../components/player/videojs";` after the Tailwind import so generated utility classes are scanned.

- [ ] **Step 4: Run test and build to verify they pass**

Run: `cd player && npx tsx --test tests/skin.test.ts && npm run typecheck && npm run build`
Expected: PASS and a successful production build. The CSS budget still passes because the vendored path is exempt.

- [ ] **Step 5: Commit**

```bash
git add player/components.json player/package.json player/package-lock.json player/src/components/player/VideoSkin.tsx player/src/components/player/videojs player/src/styles/skin.css player/src/app/globals.css player/tests/skin.test.ts
git commit -m "feat(player): vendor the videojs skin"
```

### Task 5: One PlayerRoot, one PlayerProvider, one engine

**Files:**
- Create: `player/src/components/player/PlayerProvider.tsx`
- Create: `player/src/components/player/PlayerRoot.tsx`
- Create: `player/src/components/player/index.ts`
- Create: `player/src/components/player/media/useMediaEngine.ts`
- Create: `player/src/components/player/media/MediaSurface.tsx`
- Create: `player/src/components/player/prefs/schema.ts`
- Create: `player/tests/playerRoot.test.ts`
- Modify: `player/src/app/movie/[id]/page.tsx`, `tv/[id]/[season]/[episode]/page.tsx`, `live/[id]/page.tsx`
- Modify: `player/src/app/embed/movie/[id]/page.tsx`, `embed/tv/[id]/[season]/[episode]/page.tsx`, `embed/live/[id]/page.tsx`
- Delete: `player/src/components/VideoJsPlayer.tsx`, `Player.tsx`, `ControlBar.tsx`, `SettingsMenu.tsx`, `MobilePlayerControls.tsx`, `PlayerHeader.tsx`, `ProgressBar.tsx`, `ThumbnailPreview.tsx`
- Modify: `player/tests/marketing.test.ts`

**Interfaces:**
- Consumes: `engineSource`, `PeakPlayerError`, `VideoSkin`, `HlsJsVideo`, `Video`, `createPlayer`, `videoFeatures`, `liveFeature`.
- Produces: `PlayerRoot`, `PlayerProvider`, `usePlayerApi`, `usePlayerContext`; `EngineHandle`; `PlayerApi`; `PlayerState`; `PlayerPreferences` schema/defaults.

- [ ] **Step 1: Write the failing test**

Create `player/tests/playerRoot.test.ts`:
```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (p: string) => readFileSync(p, 'utf8');

describe('single player root', () => {
  it('deletes both legacy players and their orphaned chrome', () => {
    for (const p of ['VideoJsPlayer.tsx', 'Player.tsx', 'ControlBar.tsx', 'SettingsMenu.tsx', 'MobilePlayerControls.tsx', 'PlayerHeader.tsx', 'ProgressBar.tsx', 'ThumbnailPreview.tsx']) {
      assert.equal(existsSync(`src/components/${p}`), false, p);
    }
  });
  it('routes every surface through PlayerRoot', () => {
    for (const p of ['src/app/movie/[id]/page.tsx', 'src/app/tv/[id]/[season]/[episode]/page.tsx', 'src/app/live/[id]/page.tsx']) {
      assert.match(read(p), /PlayerRoot/);
      assert.doesNotMatch(read(p), /VideoJsPlayer|from '@\/components\/Player'/);
    }
  });
  it('exposes presets', () => {
    assert.match(read('src/components/player/PlayerRoot.tsx'), /'video' \| 'live-video' \| 'bg'/);
  });
  it('makes the background preset chrome-free, muted, looping, and autoplaying', () => {
    const root = read('src/components/player/PlayerRoot.tsx');
    assert.match(root, /autoPlay/);
    assert.match(root, /loop/);
    assert.match(root, /controls=\{false\}/);
    assert.match(root, /muted/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd player && npx tsx --test tests/playerRoot.test.ts`
Expected: FAIL because `PlayerRoot` and the new files do not exist and both legacy players still exist.

- [ ] **Step 3: Implement the provider, root, and media surface**

`prefs/schema.ts` defines the exact `PlayerPreferences` from spec §9.2, `DEFAULT_PREFERENCES` (`volume: 1`, `muted: true`, `boost: 1`, `boostUnlocked: false`, `speed: 1`, `quality: 'auto'`, `audioTrack: null`, captions disabled/md/opacity 1/mica true, `colourPreset: 'cinema'`, `aspect: 'fit'`, `autoplayNext: true`, `autoplay: true`, `locale: 'en'`), and `CaptionPreferences` / `AspectMode` aliases.

`PlayerProvider.tsx`:
- Create the store at module scope with the exact import path:
```ts
import { createPlayer, liveFeature, useMedia, videoFeatures } from '@videojs/react';

const { Player: EnginePlayer, usePlayer: useEnginePlayer } = createPlayer({
  features: [...videoFeatures, liveFeature],
});
```
`videoFeatures` does not include live state, so the extra `liveFeature` is required for live presets and the DVR controls. Do not use `liveVideoFeatures` as a replacement; it drops quality, audio-track, and speed state needed by the live control surface.
Export `EnginePlayer`, `useEnginePlayer`, `usePlayerApi`, `usePlayerContext`.
- State: `status`, `error`, `payload`, `mediaMetadata`, `branding`, `currentSourceIndex`, `sources`, `subtitles`, `diagnostics`, `preferences`, `engineHandle` ref.
- SSE discovery uses `fetchStreamEvents` with `media`, `fingerprint`, `source` from context; accumulate exactly as the legacy players did; set `document.title` to `${media.title}${year ? ` (${year})` : ''} — ${branding.name}` and never append the brand when it equals the title.
- `EngineHandle` is registered by `useMediaEngine`; `PlayerApi` methods await it and reject `new PeakPlayerError('NOT_READY', ...)` when absent. This is the only place engine actions are called.
- `PlayerApi` signatures:
```ts
interface PlayerApi {
  play(): Promise<void>; pause(): Promise<void>; seek(seconds: number): Promise<void>; seekBy(delta: number): Promise<void>;
  setVolume(value: number): Promise<void>; setMuted(muted: boolean): Promise<void>; setBoost(value: number): Promise<void>; unlockBoost(unlocked: boolean): Promise<void>; setSpeed(value: number): Promise<void>;
  setQuality(level: 'auto' | string): Promise<void>; setAudioTrack(id: string): Promise<void>; setCaptions(options: Partial<CaptionPreferences>): Promise<void>; setColourPreset(preset: string): Promise<void>; setAspect(mode: AspectMode): Promise<void>;
  switchServer(codename: string): Promise<void>; nextEpisode(): Promise<void>; previousEpisode(): Promise<void>; goToLive(): Promise<void>;
  requestFullscreen(): Promise<void>; exitFullscreen(): Promise<void>; requestPictureInPicture(): Promise<void>; snapshot(): Promise<string>; getShareLink(): string; copyEmbedLink(): Promise<void>;
  getState(): PlayerState; getPreferences(): PlayerPreferences; setPreferences(patch: Partial<PlayerPreferences>): PlayerPreferences;
}
```
- `PlayerState` includes `status`, `playing`, `currentTime`, `duration`, `volume`, `muted`, `boost`, `speed`, `quality`, `audioTrack`, `captionsEnabled`, `fullscreen`, `pip`, `live`, `liveEdgeStart`, `targetLiveWindow`, `server`, `season`, `episode`.

`useMediaEngine.ts`:
```ts
export interface EngineHandle { play(): Promise<void>; pause(): void; seek(t: number): Promise<void>; setVolume(v: number): void; setMuted(m: boolean): void; setSpeed(v: number): void; setBoost(value: number, unlocked: boolean): void; setQuality(level: 'auto' | string): void; setAudioTrack(id: string): void; setCaptions(options: Partial<CaptionPreferences>): void; seekToLive(edge: number): Promise<void>; requestFullscreen(): Promise<void>; exitFullscreen(): Promise<void>; requestPictureInPicture(): Promise<void>; snapshot(): Promise<string> }
export function useMediaEngine(register: (handle: EngineHandle | null) => void): void
```
It calls `useEnginePlayer()` and `useMedia()`, builds the handle from the store actions, registers it in an effect, and unregisters on cleanup. `snapshot()` draws the current video frame to a canvas and rejects `PERMISSION_DENIED` if the canvas is tainted.

`MediaSurface.tsx` chooses the engine from `engineSource`:
- `hls` → `<HlsJsVideo ref={videoRef} source={{ src, type: 'application/vnd.apple.mpegurl' }} streamType={...} mediaRef={mediaRef} />`.
- `native` → `<Video ref={videoRef} src={src} playsInline crossOrigin="anonymous" />`.
- `external` → `<ExternalEmbed url={src} />` and the rest of the chrome remains visible but transport controls are disabled.

`PlayerRoot.tsx`:
```tsx
export type PlayerPreset = 'video' | 'live-video' | 'bg';
export interface PlayerRootProps { apiBase: string; media: Media; embed?: EmbedConfig; preset?: PlayerPreset; poster?: string }
export function PlayerRoot(props: PlayerRootProps)
```
It renders `<PlayerProvider>` → `<EnginePlayer title poster>` → `useMediaEngine` bridge, `<MediaSurface>`, `<VideoSkin>`, and the existing `ExternalEmbed`/`ErrorState` shells. `bg` renders only the media surface and ambient layer with no chrome; it forces `autoPlay`, `muted`, `loop`, `controls={false}`, and `playsInline` on the media element inside `MediaSurface` (not on the context-only `EnginePlayer`), ignores stored autoplay preferences, and sets `aria-hidden` on the decorative surface. `live-video` selects the live preset once Task 15 adds it; until then it is an alias of `video` with live state enabled.

Replace both players in all six route pages with `<PlayerRoot apiBase={...} media={...} embed={...} preset={media.type === 'live_tv' ? 'live-video' : 'video'} />`. Delete the eight legacy player/chrome files listed above after `grep -R "VideoJsPlayer\|ProgressBar\|ThumbnailPreview\|MobilePlayerControls\|PlayerHeader\|from './ControlBar'\|from './SettingsMenu'" player/src` returns no imports; the old chrome imports `ProgressBar`, which imports `ThumbnailPreview`, so all three must be removed together to keep typecheck green. The new control bar and settings menu arrive in Task 18 at `player/src/components/player/controls/`, so there is no path collision. Update `player/tests/marketing.test.ts` to read `src/components/player/PlayerRoot.tsx` instead of `src/components/Player.tsx`.

- [ ] **Step 4: Run test, typecheck, and build to verify they pass**

Run: `cd player && npx tsx --test tests/playerRoot.test.ts tests/engineSource.test.ts && npm run typecheck && npm run build`
Expected: PASS. No route imports the old players. `npm run check:css` still passes.

- [ ] **Step 5: Commit**

```bash
git add player/src/components/player player/src/app player/tests/playerRoot.test.ts player/tests/marketing.test.ts
git add -u player/src/components
git commit -m "feat(player): replace both players with one videojs root"
```

### Task 6: Chrome, poster overlays, muted autoplay, Mux, terminal errors

**Files:**
- Create: `player/src/components/player/Header.tsx`
- Create: `player/src/components/player/controls/Breadcrumb.tsx`
- Create: `player/src/components/player/overlays/PosterOverlay.tsx`
- Create: `player/src/components/player/media/MuxAnalytics.tsx`
- Create: `player/src/components/player/i18n/messages.en.ts`
- Create: `player/src/components/player/i18n/index.ts`
- Create: `player/src/lib/presentation.ts`
- Create: `player/tests/presentation.test.ts`
- Create: `player/tests/i18n.test.ts`
- Modify: `player/src/components/player/PlayerProvider.tsx`
- Modify: `player/src/components/player/PlayerRoot.tsx`
- Modify: `player/src/components/player/videojs/video/skin.tsx` (remove the generated `<Title />`; `Header` owns the title)
- Create: `player/src/components/player/videojs/README.md` (record every vendored-skin edit)
- Modify: `player/src/styles/skin.css` or create `player/src/styles/chrome-5.css`

**Interfaces:**
- Consumes: `PlayerApi`, `PlayerState`, `PlayerPreferences`, `ArtworkChain` (Task 9; until then a plain `<img>` with the first poster candidate).
- Produces: `autoplayPolicy(preferences)`, `pausedPosterVisible(pausedForMs, hasPlayed)`; `messages`, `MessageKey`, `t(key, params?)`; `Header`, `Breadcrumb`, `PosterOverlay`, `MuxAnalytics`.

- [ ] **Step 1: Write the failing tests**

Create `player/tests/presentation.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { autoplayPolicy, pausedPosterVisible } from '../src/lib/presentation';

describe('autoplay policy', () => {
  it('always starts muted', () => {
    assert.deepEqual(autoplayPolicy({ autoplay: true, muted: false }), { shouldPlay: true, muted: true });
  });
  it('does not autoplay when disabled', () => {
    assert.deepEqual(autoplayPolicy({ autoplay: false, muted: true }), { shouldPlay: false, muted: true });
  });
});

describe('paused poster', () => {
  it('appears at 800 ms only after playback has started', () => {
    assert.equal(pausedPosterVisible(799, true), false);
    assert.equal(pausedPosterVisible(800, true), true);
    assert.equal(pausedPosterVisible(800, false), false);
  });
});
```

Create `player/tests/i18n.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { messages, t } from '../src/components/player/i18n';

describe('i18n catalogue', () => {
  it('is a typed English catalogue with no empty values', () => {
    assert.equal(messages.play, 'Play');
    assert.equal(messages['guide-unavailable'], 'Guide unavailable');
    for (const value of Object.values(messages)) assert.ok(value.length > 0);
  });
  it('interpolates named params and leaves unknown keys visible', () => {
    assert.equal(t('seconds-behind', { seconds: 30 }), '30s behind');
    assert.equal(t('play'), 'Play');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd player && npx tsx --test tests/presentation.test.ts tests/i18n.test.ts`
Expected: FAIL with `Cannot find module '../src/lib/presentation'` and `../src/components/player/i18n`.

- [ ] **Step 3: Implement chrome, autoplay, poster, Mux, and terminal errors**

`presentation.ts`:
```ts
export function autoplayPolicy(prefs: Pick<PlayerPreferences, 'autoplay' | 'muted'>): { shouldPlay: boolean; muted: boolean }
export function pausedPosterVisible(pausedForMs: number, hasPlayed: boolean): boolean
```
`autoplayPolicy` returns `{ shouldPlay: prefs.autoplay, muted: true }`; `pausedPosterVisible` returns `hasPlayed && pausedForMs >= 800`.

`i18n/messages.en.ts` is a flat `as const` object with kebab-case keys. It starts with the keys this task and the later control work need, including `play`, `pause`, `mute`, `unmute`, `seek-back`, `seek-forward`, `volume`, `fullscreen`, `exit-fullscreen`, `picture-in-picture`, `captions`, `quality`, `speed`, `audio`, `settings`, `go-live`, `live`, `behind-live`, `seconds-behind` (`'{seconds}s behind'`), `guide-unavailable`, `schedule`, `up-next`, `shortcuts`, `stats`, `server`, `colour`, `aspect`, `chapters`, `share`, `copy-link`, `snapshot`, `retry`, `reload`, `try-another`, `stream-unavailable`, `preparing-stream`, `loading-channel`, `fetching-sources`, `autoplay-blocked`, `tap-to-unmute`, `boost-warning`, `theatre`, `fit`, `fill`, `zoom`, `reset`, and the eight error-code labels. Add keys as later tasks need them; never add a second catalogue.

`i18n/index.ts`:
```ts
import { messages } from './messages.en';
export { messages };
export type MessageKey = keyof typeof messages;
export function t(key: MessageKey, params?: Record<string, string | number>): string
```
`t` replaces `{name}` placeholders with `String(params[name])`, leaves an unknown placeholder untouched, and returns `messages[key]` unchanged when no params are given. It never throws for a valid `MessageKey`.

Every new user-facing string in this task and every later player task comes from `t(...)`; do not introduce literal copy in `Header`, `Breadcrumb`, `PosterOverlay`, `ErrorState`, controls, menus, or overlays. Static marketing pages are out of scope. Use `Intl.DateTimeFormat`/`Intl.NumberFormat` with `preferences.locale` for dates and numbers.

`Header.tsx` renders the title, year, runtime, and quality chip. Edit the vendored `player/src/components/player/videojs/video/skin.tsx` to remove the generated `<Title />` and its import so the title is rendered exactly once by `Header`; record the original lines, the replacement, and the reason in `player/src/components/player/videojs/README.md`. Keep the other generated wrappers (`Poster`, `BufferingIndicator`, `ErrorDialog`, `VideoHotkeys`, `VideoGestures`, `VideoStatusIndicators`) for now; Task 18 replaces the control bar and the hotkey layer. `Breadcrumb.tsx` renders `Home › Movies|TV|Live › <Title>`; anchors are real links outside embeds, plain text inside embeds. Keep it top-right with logical `inset-inline-end`.

`PosterOverlay.tsx` uses the first poster candidate (or `ArtworkChain` after Task 9), shows a full pre-play card, and a translucent paused card 800 ms after pause with the short description. It calls `api.play()` on click; the tap-to-unmute chip calls `api.setMuted(false)`.

`PlayerProvider` starts playback once the engine handle is ready: `const policy = autoplayPolicy(preferences); if (policy.shouldPlay) { await api.setMuted(true); await api.play(); }`. If `play()` rejects with `NotAllowedError`, set `needsInteraction` and render the tap-to-unmute chip. Unmute on the first pointer/key interaction once. Add a 20 s discovery timer; when it fires without a ready source, set a terminal `STREAM_UNAVAILABLE` error and stop the spinner. Source exhaustion after retries also sets the terminal error. `ErrorState` receives `onTryAnother` and `onReload`; both are wired.

`MuxAnalytics.tsx` dynamically imports `MuxData` only when `process.env.NEXT_PUBLIC_MUX_DATA_ENV_KEY` is non-empty:
```tsx
const key = process.env.NEXT_PUBLIC_MUX_DATA_ENV_KEY;
export function MuxAnalytics() {
  if (!key) return null;
  const MuxData = dynamic(() => import('@videojs/react/extensions/mux-data').then((m) => m.MuxData), { ssr: false });
  return <MuxData envKey={key} metadata={{ player_name: 'Peak' }} />;
}
```
Render it inside `EnginePlayer` only when the key exists, so no adapter is constructed and no console output appears on self-hosted installs.

- [ ] **Step 4: Run test, typecheck, and build to verify they pass**

Run: `cd player && npx tsx --test tests/presentation.test.ts tests/i18n.test.ts && npm run typecheck && npm run build`
Expected: PASS; the build has no Mux warnings when the env key is unset.

- [ ] **Step 5: Commit**

```bash
git add player/src/components/player player/src/lib/presentation.ts player/src/styles player/tests/presentation.test.ts player/tests/i18n.test.ts
git commit -m "feat(player): add chrome, muted autoplay, and terminal errors"
```

### Phase P1 exit gate

- [ ] Run `npm run check` from the repo root. P1 is not complete until it is green.
- [ ] Start only the API and player detached, then check `/embed/movie/550` and `/movie/550` at 1440 px and 390 px in both themes. Confirm the engine plays, the vendored controls render, muted autoplay and the tap-to-unmute chip work, and the console has no errors or warnings. Stop both servers before starting the next phase.

## Phase P2 — Metadata and Artwork

### Task 7: Keyless media resolver

**Files:**
- Create: `utils/mediaResolver.js`
- Create: `tests/mediaResolver.test.js`
- Modify: `utils/tmdb.js` (add `getEpisodeDetails`, export `isRealTmdbKey`)

**Interfaces:**
- Consumes: `getTmdbApiKey`, `getDetails`, `getEpisodeDetails`, `fetch` (injected for tests), `now`.
- Produces: `resolveMedia({ type, id, season?, episode? }, deps?): Promise<MediaMetadata>`; `MediaMetadata` with `{ id, type, title, year, overview, tagline, runtime, genres, rating, poster: { candidates: string[] }, backdrop, stills, seriesPoster, source }`; `MediaResolverError` with `INVALID_MEDIA_TYPE | INVALID_MEDIA_ID`.

- [ ] **Step 1: Write the failing tests**

Create `tests/mediaResolver.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveMedia } = require('../utils/mediaResolver');

const json = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });

test('TMDB hit wins when a real key exists', async () => {
  const media = await resolveMedia({ type: 'movie', id: '550' }, {
    getTmdbApiKey: () => 'real-key',
    getDetails: async () => ({ title: 'Fight Club', release_date: '1999-10-15', overview: 'A', tagline: 'T', runtime: 139, genres: [{ name: 'Drama' }], vote_average: 8.4, poster_path: '/p.jpg', backdrop_path: '/b.jpg' }),
    fetch: async () => { throw new Error('must not call keyless stages'); },
  });
  assert.equal(media.source, 'tmdb');
  assert.equal(media.title, 'Fight Club');
  assert.equal(media.year, 1999);
  assert.equal(media.poster.candidates[0], 'https://image.tmdb.org/t/p/w780/p.jpg');
});

test('Wikidata finds the article and Wikipedia supplies the poster', async () => {
  const fetch = async (url) => url.includes('query.wikidata.org')
    ? json({ results: { bindings: [{ itemLabel: { value: 'Fight Club' }, article: { value: 'https://en.wikipedia.org/wiki/Fight_Club' } }] } })
    : json({ title: 'Fight Club', description: '1999 American film by David Fincher', extract: 'An insomniac…', originalimage: { source: 'https://upload.wikimedia.org/fight-club.jpg' } });
  const media = await resolveMedia({ type: 'movie', id: '550' }, { getTmdbApiKey: () => null, fetch });
  assert.equal(media.source, 'wikipedia');
  assert.equal(media.year, 1999);
  assert.equal(media.poster.candidates[0], 'https://upload.wikimedia.org/fight-club.jpg');
});

test('TVMaze supplies a TV episode still', async () => {
  const fetch = async (url) => url.includes('lookup/shows')
    ? json({ id: 82, name: 'Game of Thrones', premiered: '2011-04-17', genres: ['Drama'], rating: { average: 9.1 } })
    : json([{ name: 'Winter Is Coming', summary: '<p>Ned Stark…</p>', runtime: 62, image: { original: 'https://static.tvmaze.com/still.jpg' } }]);
  const media = await resolveMedia({ type: 'tv', id: '1399', season: 1, episode: 1 }, { getTmdbApiKey: () => null, fetch });
  assert.equal(media.source, 'tvmaze');
  assert.equal(media.title, 'Game of Thrones');
  assert.equal(media.overview, 'Ned Stark…');
  assert.deepEqual(media.stills, ['https://static.tvmaze.com/still.jpg']);
});

test('total failure returns a generated record and never throws', async () => {
  const media = await resolveMedia({ type: 'movie', id: '999999' }, { getTmdbApiKey: () => null, fetch: async () => { throw new Error('offline'); } });
  assert.equal(media.source, 'generated');
  assert.equal(media.title, 'Untitled');
  assert.deepEqual(media.poster.candidates, []);
});

test('invalid ids are rejected before any network call', async () => {
  let called = false;
  await assert.rejects(
    () => resolveMedia({ type: 'movie', id: '../../etc/passwd' }, { getTmdbApiKey: () => 'real', getDetails: async () => { called = true; }, fetch: async () => { called = true; } }),
    (error) => error.code === 'INVALID_MEDIA_ID',
  );
  assert.equal(called, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/mediaResolver.test.js`
Expected: FAIL with `Cannot find module '../utils/mediaResolver'`.

- [ ] **Step 3: Implement the resolver chain**

`utils/mediaResolver.js`:
- Validate `type` (`movie` | `tv`) and numeric id (`/^\d+$/`), positive season/episode defaults 1; otherwise throw `MediaResolverError`.
- `isRealTmdbKey(key)` rejects `null`, empty, and `your_tmdb_api_key`.
- TMDB stage only when a real key exists. Use `getDetails(type, id)`, and for TV use `getEpisodeDetails(type, id, season, episode)` when available for `stills`; map `title || name`, `release_date || first_air_date`, `overview`, `tagline`, `runtime`, `genres[].name`, `vote_average`, `poster_path`, `backdrop_path`. Build image URLs with `https://image.tmdb.org/t/p/w780`.
- Wikidata stage: query `https://query.wikidata.org/sparql?format=json&query=<encoded>` with `User-Agent: PeakMediaResolver/1.0`. Use `P4947` for movies and `P4983` for TV. Read `itemLabel`, `P345` (IMDb), `P18` (Commons image via `https://commons.wikimedia.org/wiki/Special:FilePath/<file>`), and the enwiki article from `schema:about` + `schema:isPartOf <https://en.wikipedia.org/>`.
- Wikipedia stage: `https://en.wikipedia.org/api/rest_v1/page/summary/<Article>` with the same User-Agent. Use `title`, `description`, `extract`, `originalimage.source`, `thumbnail.source`. Parse the first four-digit year from `description` with `/\b(1[89]\d{2}|20\d{2})\b/`.
- TVMaze stage (TV only, when an IMDb id exists): `https://api.tvmaze.com/lookup/shows?imdb=<tt>` then `/shows/:id/episodesbynumber?season=&number=`. Use show `name`, `premiered`, `genres`, `rating.average`; episode `summary` stripped of tags, `runtime`, `image.original` as a still.
- Each stage gets a 4 s timeout and a `try/catch`; stage failure advances. Total failure returns `{ title: 'Untitled', year: null, overview: null, tagline: null, runtime: null, genres: [], rating: null, poster: { candidates: [] }, backdrop: null, stills: [], seriesPoster: null, source: 'generated' }`.
- Deduplicate candidates and never return `null` strings.

Extend `utils/tmdb.js` with:
```js
async function getEpisodeDetails(type, tmdbId, season, episode)
function isRealTmdbKey(key)
```
The episode call is `/tv/:id/season/:season/episode/:episode`; it returns raw TMDB JSON or `null` on failure.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/mediaResolver.test.js`
Expected: all five PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/mediaResolver.js utils/tmdb.js tests/mediaResolver.test.js
git commit -m "feat(api): add the keyless media resolver"
```

### Task 8: Media endpoint and stream payload integration

**Files:**
- Create: `routes/mediaRoutes.js`
- Create: `player/src/lib/media.ts`
- Create: `tests/mediaRoutes.test.js`
- Create: `player/tests/media.test.ts`
- Modify: `utils/mediaResolver.js` (add `getMedia`, `clearMediaCache`)
- Modify: `apiServer.js`
- Modify: `utils/playerService.js`
- Modify: `player/src/lib/types.ts`
- Modify: `tests/playerService.test.js`

**Interfaces:**
- Consumes: `resolveMedia`.
- Produces: `getMedia({ type, id, season, episode }, deps?)` with 6 h positive / 15 min negative caching; `GET /api/v1/media/:type/:id`; `MediaMetadata` in the player types; `StreamResponse.media?: MediaMetadata`; `fetchMedia(apiBase, media, signal?)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/mediaRoutes.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createMediaRoutes } = require('../routes/mediaRoutes');

async function withApp(getMedia, fn) {
  const app = express();
  createMediaRoutes(app, { getMedia });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}

test('movie returns the success envelope', async () => {
  await withApp(async ({ type, id }) => ({ media: { id, type, title: 'Fight Club', source: 'wikipedia' }, cacheHit: false }), async (base) => {
    const body = await (await fetch(`${base}/api/v1/media/movie/550`)).json();
    assert.equal(body.success, true);
    assert.equal(body.media.title, 'Fight Club');
  });
});

test('invalid types are 400 and unknown ids still return a generated record', async () => {
  await withApp(async () => ({ media: { title: 'Untitled', source: 'generated' }, cacheHit: false }), async (base) => {
    assert.equal((await fetch(`${base}/api/v1/media/book/550`)).status, 400);
    const unknown = await (await fetch(`${base}/api/v1/media/movie/999999`)).json();
    assert.equal(unknown.media.source, 'generated');
  });
});
```

Create `player/tests/media.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mediaPath } from '../src/lib/media';

describe('media client', () => {
  it('builds a TV episode query', () => {
    assert.equal(mediaPath({ type: 'tv', id: '1399', season: 2, episode: 3 }), '/api/v1/media/tv/1399?season=2&episode=3');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/mediaRoutes.test.js` and `cd player && npx tsx --test tests/media.test.ts`
Expected: FAIL with missing route module and `mediaPath`.

- [ ] **Step 3: Implement the cache, route, and payload**

In `utils/mediaResolver.js`:
```js
const MEDIA_TTL_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 15 * 60 * 1000;
const mediaCache = new Map();
async function getMedia(input, deps = {}) // returns { media, cacheHit }
function clearMediaCache()
```
The cache key is `type:id:season:episode`. Positive entries live 6 h; entries with `source === 'generated'` live 15 min. A cache hit returns a cloned media object.

`routes/mediaRoutes.js` exports `createMediaRoutes(app, { getMedia })`. Register `GET /api/v1/media/:type/:id`; parse `season`/`episode`; validate type and id; return `{ success: true, media }` or `{ success: false, error }` with 400. Do not cache at the HTTP layer.

`apiServer.js` registers `createMediaRoutes(app, { getMedia })` next to the stream routes.

`utils/playerService.js`:
- Import `getMedia`.
- `getPlayerStream` and `getPlayerStreamEvents` resolve media before composing the payload. `title = media.title`; `year = media.year`; remove the literal `'Peak'` fallback.
- Add `media` (without `seriesPoster`) to the payload and to the SSE `meta` event.
- Store `media` in the aggregate cache value so failover and cache hits do not re-resolve it.
- If media resolution itself fails, still play: use `{ title: 'Untitled', source: 'generated' }` and keep the stream.

Add to `player/src/lib/types.ts`:
```ts
export interface MediaMetadata {
  id: string; type: MediaType; title: string; year: number | null;
  overview: string | null; tagline: string | null; runtime: number | null;
  genres: string[]; rating: number | null;
  poster: { candidates: string[] }; backdrop: string | null;
  stills: string[]; seriesPoster: string | null;
  source: 'tmdb' | 'wikidata' | 'wikipedia' | 'tvmaze' | 'generated';
}
```
Add `media?: MediaMetadata` to `StreamResponse` and to the `onMeta` handler.

`player/src/lib/media.ts` exports `mediaPath(media)` and `fetchMedia(apiBase, media, signal?)` returning `MediaMetadata`; `mediaPath` uses `season`/`episode` query params for TV.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/mediaRoutes.test.js tests/playerService.test.js` and `cd player && npx tsx --test tests/media.test.ts && npm run typecheck`
Expected: PASS. The player service test asserts the payload title is the media title and `media.source` is present, never `'Peak'`.

- [ ] **Step 5: Commit**

```bash
git add routes/mediaRoutes.js utils/mediaResolver.js utils/playerService.js apiServer.js player/src/lib/media.ts player/src/lib/types.ts tests/mediaRoutes.test.js tests/playerService.test.js player/tests/media.test.ts
git commit -m "feat(api): expose media metadata and use it in stream payloads"
```

### Task 9: Artwork chain, typographic card, and thumbnail sprite fallback

**Files:**
- Create: `utils/artworkResolver.js`
- Create: `utils/thumbnailService.js`
- Create: `routes/thumbnailRoutes.js`
- Create: `player/src/components/player/artwork/ArtworkChain.tsx`
- Create: `player/src/components/player/artwork/TypographicCard.tsx`
- Create: `player/src/lib/thumbnails.ts`
- Create: `player/src/styles/artwork.css`
- Create: `player/public/poster-fallback.svg`
- Create: `tests/artworkResolver.test.js`
- Create: `tests/thumbnailService.test.js`
- Create: `player/tests/artwork.test.ts`
- Create: `player/tests/thumbnails.test.ts`
- Modify: `apiServer.js`

**Interfaces:**
- Consumes: `MediaMetadata`, `getPlayerStream`.
- Produces: `artworkCandidates(media, { partnerPoster, providerArtwork })`; `fallbackArtwork(media)`; `resolveArtwork(candidates, { load, timeoutMs })`; `artworkGradient(title)`; `parseImageTracks(manifest, baseUrl)`; `buildSpriteArgs({ input, duration, output })`; `createThumbnailRoutes(app, { getPlayerStream, getSprite, cacheDir })`.

- [ ] **Step 1: Write the failing tests**

Create `tests/artworkResolver.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { artworkCandidates, fallbackArtwork } = require('../utils/artworkResolver');

test('candidates follow the eight-step order without duplicates', () => {
  const media = { poster: { candidates: ['tmdb-poster'] }, backdrop: 'tmdb-backdrop', stills: ['episode-still'], seriesPoster: 'series-poster', type: 'tv', title: 'Show', year: 2020 };
  assert.deepEqual(
    artworkCandidates(media, { partnerPoster: 'partner', providerArtwork: 'provider' }),
    ['partner', 'tmdb-poster', 'tmdb-backdrop', 'episode-still', 'series-poster', 'provider'],
  );
  assert.equal(fallbackArtwork(media).kind, 'generated');
});
```
The function returns the six remote candidates. Steps seven and eight of the spec chain (`TypographicCard`, `/poster-fallback.svg`) are the client fallback when this list is exhausted, not URL candidates.

Create `tests/thumbnailService.test.js`:
```js
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
```
The cache-hit assertion requires `getSprite` to create a placeholder file at the cache path even when the injected `spawnImpl` does not write one; have `getSprite` `fs.writeFileSync(output, '')` before resolving when the file is absent. That keeps the test hermetic without a real ffmpeg binary.

Create `player/tests/artwork.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { artworkGradient, resolveArtwork } from '../src/components/player/artwork/ArtworkChain';

describe('artwork chain', () => {
  it('walks past 404s and decode errors', async () => {
    const seen: string[] = [];
    const load = async (url: string) => { seen.push(url); if (url !== 'b') throw new Error('decode'); return url; };
    assert.equal(await resolveArtwork(['a', 'b', 'c'], { load }), 'b');
    assert.deepEqual(seen, ['a', 'b']);
  });
  it('advances after the 4 second timeout', async () => {
    assert.equal(await resolveArtwork(['slow'], { load: () => new Promise(() => {}), timeoutMs: 5 }), null);
  });
  it('has a deterministic gradient', () => {
    assert.equal(artworkGradient('Fight Club'), artworkGradient('Fight Club'));
    assert.notEqual(artworkGradient('Fight Club'), artworkGradient('Heat'));
  });
});
```

Create `player/tests/thumbnails.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseImageTracks } from '../src/lib/thumbnails';

describe('HLS image tracks', () => {
  it('parses EXT-X-IMAGE-STREAM-INF and EXT-X-TILES', () => {
    const manifest = '#EXTM3U\n#EXT-X-IMAGE-STREAM-INF:BANDWIDTH=1000,RESOLUTION=320x180,CODECS="jpeg",URI="thumbs.jpg"\n#EXT-X-TILES:RESOLUTION=320x180,LAYOUT=10x10,DURATION=10';
    assert.deepEqual(parseImageTracks(manifest, 'https://cdn.example/master.m3u8'), { url: 'https://cdn.example/thumbs.jpg', tileWidth: 320, tileHeight: 180, columns: 10, rows: 10, duration: 10 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/artworkResolver.test.js tests/thumbnailService.test.js` and `cd player && npx tsx --test tests/artwork.test.ts tests/thumbnails.test.ts`
Expected: FAIL with missing modules for every test file.

- [ ] **Step 3: Implement the chains and fallback**

`utils/artworkResolver.js`:
- `artworkCandidates(media, options)` returns, in this order and deduped: partner override, TMDB `poster.candidates`, `backdrop`, `stills`, `seriesPoster`, provider artwork.
- `fallbackArtwork(media)` returns `{ kind: 'generated', title: media.title, year: media.year, type: media.type }`.
- Never returns an empty string or `null`.

`ArtworkChain.tsx`:
- `resolveArtwork(candidates, { load = loadImage, timeoutMs = 4000 })` walks sequentially; a reject, decode error or timeout advances; resolves the first URL or `null`.
- `loadImage(url)` creates an `Image`, sets `src`, resolves on `onload`, rejects on `onerror`; the timeout rejects after 4 s.
- `ArtworkChain` reads `sessionStorage['peak:artwork:<type>:<id>']` first, then walks candidates; on success stores the URL; on failure renders `TypographicCard`.
- `artworkGradient(title)` hashes the title to two hue stops; deterministic.
- `TypographicCard` is pure DOM: title, year, type, gradient, no network.
- The eight-step chain is therefore: partner override → TMDB poster → TMDB backdrop → episode still → series poster → provider artwork → `TypographicCard` (pure DOM) → bundled `/poster-fallback.svg`. The last two are render fallbacks, not entries in `artworkCandidates`.

`player/public/poster-fallback.svg` is a monochrome 2:3 card with the Peak mark.

`utils/thumbnailService.js`:
```js
function buildSpriteArgs({ input, duration, output })
async function getSprite({ input, duration }, { cacheDir, ffmpegPath, spawnImpl, now } = {})
```
`buildSpriteArgs` returns `['-ss','0','-i',input,'-t',String(duration),'-vf','fps=1/10,scale=160:-1,tile=10x10','-frames:v','1',output]`. `getSprite` caches by a hash of input + duration; if `ffmpeg` is missing, reject `FFMPEG_UNAVAILABLE`; never throw into the player.

`routes/thumbnailRoutes.js` exports `createThumbnailRoutes(app, { getPlayerStream, getSprite, cacheDir })`. It registers:
- `POST /api/v1/thumbnails/:type/:id` accepting `{ season, episode, duration }`, resolving the first source, generating a sprite, and returning `{ success: true, url: '/api/v1/thumbnails/<key>.jpg' }`. Only movie/tv numeric ids.
- `GET /api/v1/thumbnails/:file` sending `path.join(cacheDir, path.basename(file))` with `Content-Type: image/jpeg` and `Cache-Control: public, max-age=86400`; a missing file is a 404 JSON error. `path.basename` prevents traversal.

`apiServer.js` calls `createThumbnailRoutes(app, { getPlayerStream, getSprite, cacheDir })` next to the stream and media routes, before the 404 handler. This makes the URL returned by POST actually servable.

`player/src/lib/thumbnails.ts` exports `parseImageTracks(manifest, baseUrl)` and `fetchSprite(apiBase, media, duration)`; `parseImageTracks` resolves the URI relative to the manifest, parses `RESOLUTION`, `LAYOUT`, and `DURATION`, and returns `null` when either tag is absent.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/artworkResolver.test.js tests/thumbnailService.test.js` and `cd player && npx tsx --test tests/artwork.test.ts tests/thumbnails.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/artworkResolver.js utils/thumbnailService.js routes/thumbnailRoutes.js player/src/components/player/artwork player/src/lib/thumbnails.ts player/src/styles/artwork.css player/public/poster-fallback.svg tests/artworkResolver.test.js tests/thumbnailService.test.js player/tests/artwork.test.ts player/tests/thumbnails.test.ts apiServer.js
git commit -m "feat(media): add artwork fallbacks and thumbnail sprites"
```

### Phase P2 exit gate

- [ ] Run `npm run check` from the repo root.
- [ ] Start only the API and player detached. Check `/movie/550`, `/tv/1399/1/1`, and `/movie/999999` at 1440 px and 390 px in both themes. Confirm a real title in the header and tab, a poster for every case, a typographic card for the unknown id, and no infinite spinner. On `/tv/1399/1/1`, confirm the SSE connection stays open (the old 404 is gone). Stop both servers.

## Phase P3 — IPTV and EPG

### Task 10: IPTV schema migration and iptv-org seeding

**Files:**
- Create: `utils/iptvSeed.js`
- Create: `tests/iptvStore.test.js`
- Create: `tests/iptvSeed.test.js`
- Modify: `utils/iptvStore.js`
- Modify: `utils/config.js` (seed env defaults)

**Interfaces:**
- Consumes: `getDb`, `addPlaylist`, `replaceChannels`, existing parser/id helpers.
- Produces: `upsertChannels(playlistId, channels, { preserveState })`, `setChannelHealth(id, health)`, `ensureSeedPlaylist()`, `listChannels({ status })`; `seedIptv({ config, readJson, store, now })`.

- [ ] **Step 1: Write the failing tests**

Create `tests/iptvStore.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.PEAK_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'peak-iptv-')), 'test.db');
const store = require('../utils/iptvStore');

test('re-seeding preserves enabled state and health history', () => {
  store.ensureIptvTables();
  const playlist = store.ensureSeedPlaylist();
  store.upsertChannels(playlist.id, [{ id: 'c1', name: 'A', url: 'https://a/1.m3u8', groupTitle: 'News' }]);
  store.setChannelEnabled('c1', false);
  store.setChannelHealth('c1', { status: 'ok', httpStatus: 206, latencyMs: 12, checkedAt: '2026-01-01T00:00:00.000Z', failCount: 0, nextCheckAt: null });
  store.upsertChannels(playlist.id, [{ id: 'c1', name: 'A2', url: 'https://a/2.m3u8', groupTitle: 'News' }]);
  const channel = store.getChannel('c1');
  assert.equal(channel.name, 'A2');
  assert.equal(channel.enabled, 0);
  assert.equal(channel.status, 'ok');
  assert.equal(store.listChannels({}).channels.length, 1);
  assert.equal(store.listChannels({ status: 'ok' }).channels[0].id, 'c1');
  assert.equal(store.listChannels({ status: 'dead' }).channels.length, 0);
});
```

Create `tests/iptvSeed.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { seedIptv } = require('../utils/iptvSeed');

test('sports are always seeded; category and country filters apply to the rest', async () => {
  const fixtures = {
    'channels.json': [
      { id: 'espn.us', name: 'ESPN', country: 'US', categories: ['sports'], logo: 'espn.png' },
      { id: 'cnn.us', name: 'CNN', country: 'US', categories: ['news'] },
      { id: 'bbc.uk', name: 'BBC News', country: 'GB', categories: ['news'] },
    ],
    'streams.json': [
      { channel: 'espn.us', url: 'https://a/espn.m3u8' },
      { channel: 'cnn.us', url: 'https://a/cnn.m3u8' },
      { channel: 'bbc.uk', url: 'https://a/bbc.m3u8' },
    ],
    'categories.json': [{ id: 'sports', name: 'Sports' }, { id: 'news', name: 'News' }],
    'countries.json': [{ code: 'US', name: 'United States' }, { code: 'GB', name: 'United Kingdom' }],
    'languages.json': [{ code: 'en', name: 'English' }],
    'guides.json': [],
    'logos.json': [],
  };
  const readJson = async (url) => fixtures[url.split('/').pop()];
  const result = await seedIptv({ config: { enabled: true, categories: ['news'], countries: ['US'] }, readJson });
  assert.deepEqual(result.channels.map((c) => c.name).sort(), ['CNN', 'ESPN']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/iptvStore.test.js tests/iptvSeed.test.js`
Expected: FAIL with missing `ensureSeedPlaylist`, `upsertChannels`, health columns, and `seedIptv`.

- [ ] **Step 3: Implement the migration and seed**

In `utils/iptvStore.js`, extend `iptv_playlists` with `seeded INTEGER NOT NULL DEFAULT 0` and `guide_url TEXT`; extend `iptv_channels` with `status TEXT NOT NULL DEFAULT 'unknown'`, `http_status INTEGER`, `latency_ms INTEGER`, `checked_at TEXT`, `fail_count INTEGER NOT NULL DEFAULT 0`, `next_check_at TEXT`. Add an `ensureColumn(table, name, ddl)` helper that reads `PRAGMA table_info` and runs `ALTER TABLE ... ADD COLUMN` only when missing; call it from `ensureIptvTables` so existing databases migrate in place.

Add:
```js
function ensureSeedPlaylist({ guideUrl = null } = {}) // inserts name 'iptv-org', url 'seed:iptv-org', seeded 1; updates guide_url when provided; returns the row
function upsertChannels(playlistId, channels, { preserveState = true } = {})
function setChannelHealth(id, { status, httpStatus, latencyMs, checkedAt, failCount, nextCheckAt })
```
`upsertChannels` uses `INSERT ... ON CONFLICT(id) DO UPDATE SET name, tvg_id, group_title, logo, url, headers, language, country, position, updated_at`; it deletes channels of that playlist whose ids are absent from the input, all inside one transaction. It never writes `enabled`, status, or health when `preserveState` is true. Duplicate ids in the input: last one wins.

`listChannels` accepts `status` and applies `AND status = ?` when provided.

`utils/iptvSeed.js`:
```js
async function seedIptv({ config = {}, readJson = defaultReadJson, store = require('./iptvStore'), now = new Date() } = {})
```
Fetch `streams.json`, `channels.json`, `categories.json`, `countries.json`, `languages.json`, `guides.json`, `logos.json` from `https://iptv-org.github.io/api/`. Build maps, choose the first stream per channel, group by the first category name, and mark the playlist seeded. Choose the first `guides.json` entry whose `channel` belongs to the included set and pass its XMLTV `url` to `ensureSeedPlaylist({ guideUrl })`; leave `guide_url` null when no guide matches, and never overwrite an existing non-null guide URL with null. Include a channel when `categoryIds.includes('sports')` OR both the category and country filters pass. `IPTV_SEED_CATEGORIES`/`COUNTRIES` default `*`. Return `{ playlist, channels, skipped }`. Idempotent: `ensureSeedPlaylist` plus `upsertChannels`.

In `utils/config.js`, add `iptvSeedEnabled` (default true), `iptvSeedCategories` (default `*`), `iptvSeedCountries` (default `*`), reading `IPTV_SEED_ENABLED`, `IPTV_SEED_CATEGORIES`, `IPTV_SEED_COUNTRIES`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/iptvStore.test.js tests/iptvSeed.test.js`
Expected: PASS, including the duplicate-id preservation test.

- [ ] **Step 5: Commit**

```bash
git add utils/iptvStore.js utils/iptvSeed.js utils/config.js tests/iptvStore.test.js tests/iptvSeed.test.js
git commit -m "feat(iptv): migrate the catalogue and seed from iptv-org"
```

### Task 11: Stream validation and health

**Files:**
- Create: `utils/iptvValidate.js`
- Create: `tests/iptvValidate.test.js`
- Modify: `utils/iptvStore.js` (due-channel query, health update)
- Modify: `apiServer.js:684-712` (player routes filter `status='ok'`)

**Interfaces:**
- Consumes: `fetch`, store health methods.
- Produces: `probeChannel(channel, { fetch, timeoutMs, now })`; `validateChannels(channels, { concurrency, timeoutMs, fetch, now, onResult })`; `validateDueChannels({ store, now, ... })`; `nextCheckAt(status, failCount, now)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/iptvValidate.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { probeChannel, validateChannels, nextCheckAt } = require('../utils/iptvValidate');

async function fixture(handler) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('206 HLS is ok, 200 HTML is dead, timeout is unknown', async () => {
  const { server, base } = await fixture((req, res) => {
    if (req.url === '/ok') { res.writeHead(206, { 'content-type': 'application/vnd.apple.mpegurl' }); res.end('#EXTM3U'); }
    else if (req.url === '/html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html>error</html>'); }
    else if (req.url === '/dead') { res.writeHead(404); res.end(); }
  });
  try {
    assert.equal((await probeChannel({ url: `${base}/ok` })).status, 'ok');
    assert.equal((await probeChannel({ url: `${base}/html` })).status, 'dead');
    assert.equal((await probeChannel({ url: `${base}/dead` })).status, 'dead');
    assert.equal((await probeChannel({ url: `${base}/slow` }, { timeoutMs: 20 })).status, 'unknown');
  } finally { server.close(); }
});

test('concurrency is bounded', async () => {
  let active = 0, peak = 0;
  const fetch = async () => { active += 1; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 5)); active -= 1; return { status: 200, headers: new Map([['content-type', 'application/vnd.apple.mpegurl']]), body: null }; };
  await validateChannels([{ url: 'a' }, { url: 'b' }, { url: 'c' }, { url: 'd' }], { concurrency: 2, fetch });
  assert.equal(peak, 2);
});

test('backoff grows to 24 hours', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assert.equal(Date.parse(nextCheckAt('dead', 0, now)) - now, 15 * 60 * 1000);
  assert.equal(Date.parse(nextCheckAt('dead', 2, now)) - now, 60 * 60 * 1000);
  assert.equal(Date.parse(nextCheckAt('dead', 20, now)) - now, 24 * 60 * 60 * 1000);
  assert.equal(Date.parse(nextCheckAt('ok', 0, now)) - now, 24 * 60 * 60 * 1000);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/iptvValidate.test.js`
Expected: FAIL with missing `../utils/iptvValidate`.

- [ ] **Step 3: Implement probes and the player filter**

`probeChannel` issues `GET` with `Range: bytes=0-1`, `User-Agent: PeakIPTV/1.0`, `redirect: 'follow'`, and an `AbortController` timeout. Cancel/drain the body. Classify:
- `status 200–399` and a content type containing `mpegurl`, `video/`, or `application/octet-stream` → `ok`.
- Any `text/html` response, a 4xx/5xx, or a TypeError → `dead`.
- Abort/timeout → `unknown`.
Record `httpStatus`, `latencyMs`, and `checkedAt` ISO.

`validateChannels` uses a worker pool with the given concurrency (default `IPTV_VALIDATE_CONCURRENCY || 8`), calls `onResult` as each completes, and never rejects because one probe failed.

`nextCheckAt(status, failCount, now)` returns ISO: `ok` → now + 24 h; `dead`/`unknown` → now + min(24 h, 15 min × 2^failCount).

In `apiServer.js`, player channel list and groups pass `status: 'ok'`. Admin routes keep `admin: true` and no status filter, so dead channels remain visible with health.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/iptvValidate.test.js tests/iptvStore.test.js`
Expected: PASS. The HTML-page case is `dead`, not `ok`.

- [ ] **Step 5: Commit**

```bash
git add utils/iptvValidate.js utils/iptvStore.js apiServer.js tests/iptvValidate.test.js
git commit -m "feat(iptv): validate streams and hide dead channels"
```

### Task 12: XMLTV EPG ingest and endpoint

**Files:**
- Create: `utils/iptvEpg.js`
- Create: `routes/liveRoutes.js`
- Create: `tests/iptvEpg.test.js`
- Create: `tests/epgRoutes.test.js`
- Modify: `utils/iptvStore.js` (EPG table and methods)
- Modify: `apiServer.js`

**Interfaces:**
- Consumes: store, `safeHttp.readText`.
- Produces: `parseXmltv(xml)`; `replaceEpg(channelId, programmes)`; `getEpg(channelId, { now, schedule? })` → `{ now, next, schedule }`; `pruneEpg(before)`; `ingestGuide(xml, { now, store })`; `refreshGuides({ store, now, readText })`; `GET /api/v1/live/tv/epg/:id`.

- [ ] **Step 1: Write the failing tests**

Create `tests/iptvEpg.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseXmltv, getEpg, refreshGuides } = require('../utils/iptvEpg');

const xml = `<tv><programme start="20261026120000 +0000" stop="20261026130000 +0000" channel="cnn.us"><title>News Hour</title><desc>Top stories</desc><category>News</category></programme><programme start="20261026130000 +0000" stop="20261026140000 +0000" channel="cnn.us"><title>World</title></programme></tv>`;

test('parses XMLTV into ISO programmes', () => {
  const programmes = parseXmltv(xml);
  assert.equal(programmes.length, 2);
  assert.equal(programmes[0].title, 'News Hour');
  assert.equal(programmes[0].start, '2026-10-26T12:00:00.000Z');
  assert.equal(programmes[0].stop, '2026-10-26T13:00:00.000Z');
  assert.equal(programmes[0].category, 'News');
});

test('now and next respect start and stop boundaries', () => {
  const schedule = parseXmltv(xml);
  assert.equal(getEpg('cnn.us', { now: Date.parse('2026-10-26T12:00:00Z'), schedule }).now.title, 'News Hour');
  assert.equal(getEpg('cnn.us', { now: Date.parse('2026-10-26T13:00:00Z'), schedule }).now.title, 'World');
  assert.equal(getEpg('cnn.us', { now: Date.parse('2026-10-26T13:00:00Z'), schedule }).next, null);
});

test('refreshGuides reads each guide once and prunes seven-day retention', async () => {
  const reads = [];
  const writes = [];
  await refreshGuides({
    now: Date.parse('2026-10-26T12:00:00Z'),
    readText: async (url) => { reads.push(url); return xml; },
    store: {
      listPlaylists: () => [{ id: 1, guide_url: 'https://g/one.xml' }, { id: 2, guide_url: null }],
      replaceEpg: (channelId, programmes) => writes.push({ channelId, count: programmes.length }),
      pruneEpg: (before) => writes.push({ before }),
    },
  });
  assert.deepEqual(reads, ['https://g/one.xml']);
  assert.deepEqual(writes[0], { channelId: 'cnn.us', count: 2 });
  assert.equal(writes.at(-1).before, '2026-10-19T12:00:00.000Z');
});
```
Create `tests/epgRoutes.test.js` using an Express app and a fake `getEpg`, asserting `200` and `{ success: true, epg: { now, next, schedule } }`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/iptvEpg.test.js tests/epgRoutes.test.js`
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement ingest, lookup, and route**

In `utils/iptvStore.js`, add:
```sql
CREATE TABLE IF NOT EXISTS iptv_epg (
  channel_id TEXT NOT NULL,
  start TEXT NOT NULL,
  stop TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  PRIMARY KEY (channel_id, start, stop)
);
```
and methods `replaceEpg(channelId, programmes)`, `getEpgProgrammes(channelId, { from, to })`, `pruneEpg(before)`.

`iptvEpg.js`:
- `parseXmltv` reads `<programme start stop channel>`, `<title>`, `<desc>`, `<category>`, decodes XML entities, converts `YYYYMMDDHHmmss +0000` to ISO, and ignores malformed entries.
- `getEpg(channelId, { now, schedule })` sorts by start. `now` is the programme with `start <= now < stop`; `next` is the first programme with `start >= now.stop` when `now` exists, otherwise the first with `start > now`. Return `{ now: null, next: null, schedule: [] }` when empty.
- `ingestGuide(xml, { now, store })` parses the XML, groups programmes by `channel`, calls `store.replaceEpg(channelId, programmes)` for each, and calls `store.pruneEpg(new Date(now - 7 * 86400000).toISOString())`.
- `refreshGuides({ store, now = Date.now(), readText = require('./safeHttp').readText })` lists playlists, reads every non-empty `guide_url` once with a 30 s timeout, ignores a failing guide while continuing the rest, ingests each, and returns `{ guides, failed }`.

`routes/liveRoutes.js` exports `createLiveRoutes(app, { getEpg })` and registers:
```text
GET /api/v1/live/tv/epg/:id -> { success: true, epg: { now, next, schedule } }
```
Unknown ids return an empty schedule with 200. `apiServer.js` registers it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/iptvEpg.test.js tests/epgRoutes.test.js`
Expected: PASS, including the exact start/stop boundary cases.

- [ ] **Step 5: Commit**

```bash
git add utils/iptvEpg.js utils/iptvStore.js routes/liveRoutes.js apiServer.js tests/iptvEpg.test.js tests/epgRoutes.test.js
git commit -m "feat(iptv): ingest XMLTV and expose now/next"
```

### Task 13: Three-hour IPTV cycle

**Files:**
- Create: `tests/iptvSync.test.js`
- Modify: `utils/iptvSync.js`
- Modify: `utils/config.js`
- Modify: `apiServer.js` (boot call)

**Interfaces:**
- Consumes: `seedIptv`, `validateDueChannels`, `refreshGuides`, `syncPlaylist`, `listPlaylists`.
- Produces: `runIptvCycle({ now, deps })`; `SYNC_INTERVAL_MS_DEFAULT = 10800000`; `startIptvScheduler()` unchanged in name.

- [ ] **Step 1: Write the failing test**

Create `tests/iptvSync.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runIptvCycle, SYNC_INTERVAL_MS_DEFAULT } = require('../utils/iptvSync');

test('one failing playlist never blocks the rest and the interval is three hours', async () => {
  const calls = [];
  const result = await runIptvCycle({ now: 1000, deps: {
    seedIptv: async () => { calls.push('seed'); },
    listPlaylists: () => [{ id: 1 }, { id: 2 }, { id: 3 }],
    syncPlaylist: async (id) => { if (id === 2) throw new Error('bad playlist'); calls.push(`sync:${id}`); },
    validateDueChannels: async () => { calls.push('validate'); },
    refreshGuides: async () => { calls.push('guides'); },
  } });
  assert.deepEqual(calls, ['seed', 'sync:1', 'sync:3', 'validate', 'guides']);
  assert.equal(result.failed.length, 1);
  assert.equal(SYNC_INTERVAL_MS_DEFAULT, 10800000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/iptvSync.test.js`
Expected: FAIL with `runIptvCycle` not exported and the six-hour constant.

- [ ] **Step 3: Implement the cycle**

In `utils/iptvSync.js`:
- Change `SYNC_INTERVAL_MS_DEFAULT` to `10800000`.
- `runIptvCycle({ now = Date.now(), deps = {} } = {})`:
  1. `seedIptv` when `IPTV_SEED_ENABLED` is not false.
  2. Iterate enabled playlists sequentially; `try/catch` each, record `{ id, error }`; a seeded playlist is refreshed by `seedIptv`, not by fetching `seed:iptv-org` as M3U.
  3. `validateDueChannels` for channels whose status is `unknown` or whose `checkedAt` is older than 24 h.
  4. `refreshGuides` for playlist `guide_url` values; 7-day retention.
  5. Return `{ playlists, failed, validated, guides }`.
- `startIptvScheduler` calls `runIptvCycle()` once (not awaited, detached) and then on `setInterval` with `IPTV_SYNC_INTERVAL_MS || 10800000`; `unref()`. It must be idempotent across repeated calls.
- `syncPlaylist` uses `upsertChannels` with `preserveState: true`; it never resets `enabled` or health.

In `utils/config.js`, ensure `IPTV_VALIDATE_CONCURRENCY` (8) and `IPTV_VALIDATE_TIMEOUT_MS` (6000) are exposed with their defaults.

- [ ] **Step 4: Run tests and boot smoke check**

Run: `node --test tests/iptvSync.test.js tests/iptvStore.test.js` and `node -e "require('./utils/iptvSync').startIptvScheduler(); setTimeout(() => process.exit(0), 50)"`
Expected: PASS; the smoke check exits cleanly and logs no unhandled rejection.

- [ ] **Step 5: Commit**

```bash
git add utils/iptvSync.js utils/config.js apiServer.js tests/iptvSync.test.js
git commit -m "feat(iptv): run a three-hour seed, sync, validate, and guide cycle"
```

### Task 14: Admin IPTV health console and live-page fix

**Files:**
- Create: `routes/iptvAdminRoutes.js`
- Create: `tests/iptvAdminRoutes.test.js`
- Create: `tests/adminIptvUi.test.js`
- Modify: `apiServer.js:714-814`
- Modify: `admin/app/iptv/page.tsx`
- Modify: `admin/app/live/page.tsx`
- Modify: `admin/app/admin.css` or `admin/app/legacy.css` via generator
- Modify: `package.json` (add `check:admin`)

**Interfaces:**
- Consumes: `listPlaylists`, `listChannels`, `getChannel`, `setChannelEnabled`, `listGroups`, seed config.
- Produces: `createIptvAdminRoutes(app, { store, seed, requireAuth, config })`; `GET/PATCH /api/admin/iptv/seed`; health columns in the channel list; `/live` consumes `channel.group`.

- [ ] **Step 1: Write the failing tests**

Create `tests/iptvAdminRoutes.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createIptvAdminRoutes } = require('../routes/iptvAdminRoutes');

test('admin IPTV routes require a session', async () => {
  const app = express();
  createIptvAdminRoutes(app, { store: { listPlaylists: () => [] }, requireAuth: (req, res) => res.status(401).json({ success: false }) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/iptv/playlists`);
    assert.equal(res.status, 401);
  } finally { server.close(); }
});
```

Create `tests/adminIptvUi.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('IPTV admin exposes seed, health, and channel toggles', () => {
  const page = readFileSync('admin/app/iptv/page.tsx', 'utf8');
  assert.match(page, /Seed/);
  assert.match(page, /health/i);
  assert.match(page, /api\/admin\/iptv\/channels/);
  assert.match(page, /PATCH/);
});
test('live page uses the API group field', () => {
  const page = readFileSync('admin/app/live/page.tsx', 'utf8');
  assert.match(page, /c\.group/);
  assert.doesNotMatch(page, /groupTitle/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/iptvAdminRoutes.test.js tests/adminIptvUi.test.js`
Expected: FAIL with missing module and missing seed/health fields.

- [ ] **Step 3: Implement the authenticated admin routes and page**

`routes/iptvAdminRoutes.js` mounts every current `/api/admin/iptv/*` route behind `requireAuth` and adds:
```text
GET  /api/admin/iptv/seed
PATCH /api/admin/iptv/seed  { enabled?, categories?, countries? }
```
The GET returns `{ success, seed: { enabled, categories, countries, lastSyncAt, channelCount } }`. The PATCH writes `iptvSeedEnabled`, `iptvSeedCategories`, `iptvSeedCountries` through `saveConfigPatch`, then returns the new seed status. `apiServer.js` delegates to this module; no IPTV admin route remains open.

In `admin/app/iptv/page.tsx`, add a seed card with enable toggle and comma-separated category/country inputs. Add a channel table sourced from `GET /api/admin/iptv/channels?limit=1000&admin=1` with Name, Group, Country, Language, Health, Latency, Last checked, and an enable toggle wired to `PATCH /api/admin/iptv/channels/:id`. Keep the existing playlist table, add/remove/enable/sync actions. Add a `Sync now` action that posts to the seed sync or playlist sync and reloads.

In `admin/app/live/page.tsx`, replace every `groupTitle` with `group` in the type, the filter, and the table cell.

Add `"check:admin": "npm --prefix admin run typecheck"` and append it to `check` before `test:api`. Fix any type errors the admin typecheck surfaces (the build previously ignored them).

- [ ] **Step 4: Run tests and admin typecheck**

Run: `node --test tests/iptvAdminRoutes.test.js tests/adminIptvUi.test.js` and `npm run check:admin`
Expected: PASS; every admin IPTV route is 401 without a session.

- [ ] **Step 5: Commit**

```bash
git add routes/iptvAdminRoutes.js apiServer.js admin/app/iptv/page.tsx admin/app/live/page.tsx admin/app/admin.css package.json tests/iptvAdminRoutes.test.js tests/adminIptvUi.test.js
git commit -m "feat(admin): expose IPTV seed and channel health"
```

### Phase P3 exit gate

- [ ] Run `npm run check` from the repo root.
- [ ] Start only the API and player detached. Confirm `/api/v1/live/tv/channels` returns seeded channels, a dead channel is absent while the admin still lists it, the live player shows now/next and a schedule, and `/api/v1/live/tv/epg/:id` returns `{ now, next, schedule }` at 1440 px and 390 px in both themes. Stop the player, start admin + API, and verify the `/iptv` health table and `/live` group filter. Stop both.

## Phase P4 — Controls, Preferences, SDK, and Docs

### Task 15: Live preset, DVR scrubber, and schedule panel

**Files:**
- Create: `player/src/lib/live.ts`
- Create: `player/src/components/player/controls/LiveButton.tsx`
- Create: `player/src/components/player/overlays/SchedulePanel.tsx`
- Create: `player/src/components/player/controls/Scrubber.tsx`
- Create: `player/tests/live.test.ts`
- Modify: `player/src/components/player/PlayerProvider.tsx`
- Modify: `player/src/components/player/PlayerRoot.tsx`
- Modify: `player/src/components/player/media/useMediaEngine.ts`
- Modify: `player/src/components/player/media/MediaSurface.tsx`

**Interfaces:**
- Consumes: `PlayerApi`, `PlayerState`, `fetchEpg`.
- Produces: `fetchEpg(apiBase, channelId, signal?)`; `isBehindLive(currentTime, liveEdgeStart, threshold?)`; `liveLatency(currentTime, liveEdgeStart)`; `formatLatency(seconds, locale)`; `LiveButton`, `SchedulePanel`, `Scrubber`.

- [ ] **Step 1: Write the failing test**

Create `player/tests/live.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatLatency, isBehindLive, liveLatency } from '../src/lib/live';

describe('live helpers', () => {
  it('detects a viewer behind the live edge', () => {
    assert.equal(isBehindLive(100, 130), true);
    assert.equal(isBehindLive(125, 130), false);
    assert.equal(isBehindLive(0, null), false);
  });
  it('reports latency', () => {
    assert.equal(liveLatency(100, 130), 30);
    assert.equal(formatLatency(30, 'en'), '30s behind');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd player && npx tsx --test tests/live.test.ts`
Expected: FAIL with missing `../src/lib/live`.

- [ ] **Step 3: Implement live state and UI**

`lib/live.ts`:
```ts
export interface EpgProgramme { channelId: string; start: string; stop: string; title: string; description: string | null; category: string | null }
export interface LiveEpg { now: EpgProgramme | null; next: EpgProgramme | null; schedule: EpgProgramme[] }
export async function fetchEpg(apiBase: string, channelId: string, signal?: AbortSignal): Promise<LiveEpg>
export function isBehindLive(currentTime: number, liveEdgeStart: number | null, threshold = 10): boolean
export function liveLatency(currentTime: number, liveEdgeStart: number | null): number | null
export function formatLatency(seconds: number, locale: string): string
```

`useMediaEngine` exposes `liveEdgeStart` and `targetLiveWindow` from `usePlayer(selectLive)` / the media adapter and registers `seekToLive(edge)`. `PlayerProvider` exposes them in `PlayerState` and sets `live: media.type === 'live_tv'`.

`LiveButton` shows `LIVE`, the latency badge, and a `Go live` action. It calls `api.goToLive()`. `Scrubber` renders a DVR range from `liveEdgeStart - targetLiveWindow` to `duration` (or `duration` when the window is null), shows a behind-live indicator, and seeks normally. When the manifest has no DVR window, it renders a non-seekable live rail.

`SchedulePanel` fetches `fetchEpg(apiBase, media.id)` when opened, renders now/next and a scrollable schedule, and on any failure renders the localized string `Guide unavailable` without affecting playback.

`PlayerRoot` with `preset="live-video"` renders the live controls instead of the on-demand transport; `MediaSurface` passes `streamType="live"` to `HlsJsVideo`.

- [ ] **Step 4: Run test and typecheck**

Run: `cd player && npx tsx --test tests/live.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add player/src/lib/live.ts player/src/components/player/controls/LiveButton.tsx player/src/components/player/controls/Scrubber.tsx player/src/components/player/overlays/SchedulePanel.tsx player/src/components/player/PlayerProvider.tsx player/src/components/player/PlayerRoot.tsx player/src/components/player/media player/tests/live.test.ts
git commit -m "feat(player): add the live preset, DVR controls, and EPG panel"
```

### Task 16: Preference schema, three modes, and server sync

**Files:**
- Create: `player/src/components/player/prefs/PreferenceStore.ts`
- Create: `player/src/components/player/prefs/modes.ts`
- Create: `player/tests/preferences.test.ts`
- Create: `utils/preferenceStore.js`
- Create: `routes/preferenceRoutes.js`
- Create: `tests/preferences.test.js`
- Modify: `player/src/components/player/prefs/schema.ts`
- Modify: `player/src/components/player/PlayerProvider.tsx`
- Modify: `player/src/lib/embedPage.ts`
- Modify: `player/src/lib/types.ts`
- Modify: `player/src/middleware.ts`
- Modify: `utils/embed.js`
- Modify: `utils/embedToken.js` tests and `tests/embed.test.js`
- Modify: `utils/playerService.js` (`getBranding` defaults)
- Modify: `utils/config.js`
- Modify: `admin/app/advanced/page.tsx`
- Create: `tests/adminPlayerSettings.test.js`
- Modify: `apiServer.js`

**Interfaces:**
- Consumes: `PlayerPreferences`, `EmbedTokenPayload`.
- Produces: `migratePreferences(raw)`, `resolvePreferences({ defaults, partner, user, locked })`, `createPreferenceStore(...)`, `resolvePreferenceMode(...)`; `GET/PUT /api/v1/preferences`; `prefsMode`, `preferences`, `prefsLocked` in the embed token and `x-peak-embed-prefs` request header; `Branding.preferences` and `Branding.preferenceMode` in the player types.

- [ ] **Step 1: Write the failing tests**

Create `player/tests/preferences.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_PREFERENCES, migratePreferences, resolvePreferences } from '../src/components/player/prefs/schema';
import { createPreferenceStore } from '../src/components/player/prefs/PreferenceStore';

describe('preference schema', () => {
  it('drops unknown keys and clamps values', () => {
    const prefs = migratePreferences({ v: 1, volume: 9, speed: 5, unknown: true, captions: { size: 'huge' } });
    assert.equal(prefs.volume, 1);
    assert.equal(prefs.speed, 2);
    assert.equal(prefs.captions.size, 'md');
    assert.equal('unknown' in prefs, false);
  });
  it('applies provider < partner < user, except locked keys', () => {
    const prefs = resolvePreferences({
      defaults: { ...DEFAULT_PREFERENCES, volume: 0.4, muted: false },
      partner: { volume: 0.7, speed: 1.5 },
      user: { volume: 0.2, speed: 1.25 },
      locked: ['volume'],
    });
    assert.equal(prefs.volume, 0.7);
    assert.equal(prefs.speed, 1.25);
    assert.equal(prefs.muted, false);
  });
  it('falls back to memory when storage throws, warning once', () => {
    let warnings = 0;
    const storage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
    const store = createPreferenceStore({ mode: 'browser', storage, onError: () => { warnings += 1; } });
    assert.equal(store.get().volume, DEFAULT_PREFERENCES.volume);
    store.set({ volume: 0.5 });
    store.set({ volume: 0.6 });
    assert.equal(store.get().volume, 0.6);
    assert.equal(warnings, 1);
  });
});
```

Create `tests/preferences.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createPreferenceRoutes } = require('../routes/preferenceRoutes');

test('browser mode refuses server storage', async () => {
  const app = express();
  app.use(express.json());
  createPreferenceRoutes(app, { mode: 'browser', store: {} });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/preferences`);
    assert.equal(res.status, 403);
  } finally { server.close(); }
});
```

Create `tests/adminPlayerSettings.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('advanced settings expose provider autoplay defaults', () => {
  const page = readFileSync('admin/app/advanced/page.tsx', 'utf8');
  assert.match(page, /autoplayMuted/);
  assert.match(page, /autoplay/);
  assert.match(page, /\/api\/config/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd player && npx tsx --test tests/preferences.test.ts` and `node --test tests/preferences.test.js tests/adminPlayerSettings.test.js`
Expected: FAIL with missing `migratePreferences`, `resolvePreferences`, `createPreferenceStore`, the route module, and autoplay controls.

- [ ] **Step 3: Implement schema, precedence, modes, and server storage**

`prefs/schema.ts`:
```ts
export const PREFERENCES_VERSION = 1;
export const DEFAULT_PREFERENCES: PlayerPreferences;
export function migratePreferences(raw: unknown): PlayerPreferences;
export function mergePreferences(base: PlayerPreferences, patch: unknown): PlayerPreferences;
export function resolvePreferences(input: { defaults: PlayerPreferences; partner?: Partial<PlayerPreferences>; user?: Partial<PlayerPreferences>; locked?: string[] }): PlayerPreferences;
```
`migratePreferences` accepts `{ v?: number, ... }`, drops unknown keys, fills missing keys, clamps volume 0–1, boost 0–5, speed 0.25–2, caption opacity 0–1, and validates enums (`size`, `edge`, `aspect`). `resolvePreferences` starts from defaults, overlays partner, overlays user except keys in `locked`; locked keys keep the partner value when present, otherwise the default.

`prefs/modes.ts`:
```ts
export type PreferenceMode = 'browser' | 'server' | 'user';
export function resolvePreferenceMode(globalMode?: string, tokenMode?: string, viewerMode?: PreferenceMode | null): PreferenceMode
```
Token mode wins over global; viewer choice wins only in `user` mode.

`PreferenceStore.ts`:
```ts
export interface PreferenceStore {
  get(): PlayerPreferences;
  set(patch: Partial<PlayerPreferences>): PlayerPreferences;
  subscribe(listener: (prefs: PlayerPreferences) => void): () => void;
  readonly mode: PreferenceMode;
  readonly syncEnabled: boolean;
  setSyncEnabled(value: boolean): Promise<void>;
}
export function createPreferenceStore(options: {
  mode: PreferenceMode; namespace?: string; storage?: Storage;
  fetch?: typeof fetch; endpoint?: string; onError?: (error: unknown) => void;
}): PreferenceStore
```
`browser` reads/writes `peak:prefs:v1:<namespace>`; `server` GETs the endpoint and PUTs a debounced patch; `user` behaves as browser until `setSyncEnabled(true)`, then switches to server. Any storage/network failure keeps the in-memory value, calls `onError` at most once per store, and never throws.

`utils/preferenceStore.js` uses SQLite:
```sql
CREATE TABLE IF NOT EXISTS player_preferences (
  viewer_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```
`readPreferences(viewerId)`, `writePreferences(viewerId, prefs)`. `routes/preferenceRoutes.js` exports `createPreferenceRoutes(app, { mode, store })`, where `mode` is either a `PreferenceMode` or `(req) => PreferenceMode`. The effective mode is the token mode from `x-peak-embed-prefs-mode` when present and valid, otherwise the supplied global mode; this lets one embed use `server` while the global default stays `browser`. It issues a `peak_vid` cookie (`HttpOnly; SameSite=Lax; Max-Age=31536000; Path=/`) when absent. When the effective mode is `browser`, both GET and PUT return `403 { success: false, error: 'PREFERENCES_DISABLED' }`. In `server`/`user`, GET returns `{ success: true, preferences }`; PUT validates through the shared shape, stores, and returns `{ success: true, preferences }`.

`utils/embed.js` `createEmbedSession` accepts `prefsMode`, `preferences`, `prefsLocked`, validates `prefsMode` against the three modes, and includes them in the signed token. `embedToken` preserves unknown payload keys; add tests for the round-trip. `player/src/middleware.ts` forwards `x-peak-embed-prefs-mode` and `x-peak-embed-prefs` (base64 JSON of `{ preferences, locked }`) from the verified token. `embedPage.ts` parses them into `EmbedConfig`.

`getBranding` adds:
```js
preferences: { autoplay: config.autoplay !== false, autoplayMuted: config.autoplayMuted !== false },
preferenceMode: config.playerPreferenceMode || process.env.PLAYER_PREFERENCE_MODE || 'browser',
```
`player/src/lib/types.ts` extends `Branding` with optional `preferences?: { autoplay: boolean; autoplayMuted: boolean }` and `preferenceMode?: PreferenceMode` so the provider can consume the branding response without casts; existing `DEFAULT_BRANDING` remains valid.
`utils/config.js` adds `autoplay` and `autoplayMuted` to the config schema with defaults `true`, so `POST /api/config` accepts and persists them. `admin/app/advanced/page.tsx` renders two labelled toggles (`Autoplay`, `Start muted`) bound to those keys and saves through the existing `POST /api/config` path; the muted toggle is disabled and shown as on whenever autoplay is on, matching the forced-muted policy. This is the only writer of the provider defaults.
`PlayerProvider` resolves `provider defaults < token override < user store` and exposes `preferences`, `setPreferences`; locked keys are disabled in settings. The sync switch is shown only in `user` mode.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd player && npx tsx --test tests/preferences.test.ts && node --test tests/preferences.test.js tests/adminPlayerSettings.test.js tests/embed.test.js tests/embedToken.test.js`
Expected: PASS. The storage-throw case keeps working, warns once, and never throws.

- [ ] **Step 5: Commit**

```bash
git add player/src/components/player/prefs player/src/components/player/PlayerProvider.tsx player/src/lib/embedPage.ts player/src/lib/types.ts player/src/middleware.ts utils/preferenceStore.js routes/preferenceRoutes.js utils/embed.js utils/embedToken.js utils/playerService.js utils/config.js admin/app/advanced/page.tsx apiServer.js player/tests/preferences.test.ts tests/preferences.test.js tests/adminPlayerSettings.test.js tests/embed.test.js tests/embedToken.test.js
git commit -m "feat(player): add versioned preferences and the three storage modes"
```

### Task 17: Mica captions and volume boost

**Files:**
- Create: `player/src/lib/webvtt.ts`
- Create: `player/src/components/player/overlays/CaptionsOverlay.tsx`
- Create: `player/src/components/player/audio/VolumeBoost.ts`
- Create: `player/src/components/player/controls/VolumeControl.tsx`
- Create: `player/src/styles/captions.css`
- Create: `player/tests/captions.test.ts`
- Create: `player/tests/boost.test.ts`
- Modify: `player/src/components/player/PlayerProvider.tsx`
- Modify: `player/src/components/player/media/useMediaEngine.ts`

**Interfaces:**
- Consumes: `PlayerPreferences['captions']`, `PlayerApi`.
- Produces: `parseWebVtt(input)`, `activeCues(cues, time)`, `boostParams(boost, unlocked)`, `VolumeBoost`; `CaptionsOverlay({ cues, time, settings })`.

- [ ] **Step 1: Write the failing tests**

Create `player/tests/captions.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activeCues, parseWebVtt } from '../src/lib/webvtt';

const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello

00:00:02.500 --> 00:00:04.000
World`;

describe('WebVTT', () => {
  it('parses cues', () => {
    assert.deepEqual(parseWebVtt(vtt).map((c) => c.text), ['Hello', 'World']);
  });
  it('returns overlapping cues', () => {
    assert.deepEqual(activeCues(parseWebVtt(vtt), 2.7).map((c) => c.text), ['Hello', 'World']);
    assert.deepEqual(activeCues(parseWebVtt(vtt), 4.1), []);
  });
});
```

Create `player/tests/boost.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { boostParams } from '../src/components/player/audio/VolumeBoost';

describe('volume boost', () => {
  it('uses linear gain and the safety limiter', () => {
    assert.deepEqual(boostParams(3, false), { gain: 3, limiter: { threshold: -3, knee: 6, ratio: 12, attack: 0.003, release: 0.25 } });
  });
  it('clamps at 300% until unlocked', () => {
    assert.equal(boostParams(5, false).gain, 3);
    assert.equal(boostParams(5, true).gain, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd player && npx tsx --test tests/captions.test.ts tests/boost.test.ts`
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement captions and the boost graph**

`lib/webvtt.ts`:
```ts
export interface VttCue { id: string; start: number; end: number; text: string }
export function parseWebVtt(input: string): VttCue[]
export function activeCues(cues: VttCue[], time: number): VttCue[]
```
Parse `HH:MM:SS.mmm --> HH:MM:SS.mmm`, optional cue id, and multiline text; strip HTML tags; skip malformed blocks. `activeCues` returns cues where `start <= time && time < end`, preserving source order.

`CaptionsOverlay` renders `activeCues` at the current time. Disable native cue rendering by setting every `video.textTracks[i].mode = 'disabled'` in an effect. The `.captions-mica` class uses the exact material in Global Constraints; size classes `sm/md/lg/xl`, opacity via CSS variable, edge styles `none/shadow/outline/background`, and a `mica` toggle that removes `backdrop-filter` and the white overlay but keeps the dark background. Logical positioning only.

`VolumeBoost.ts`:
```ts
export interface BoostParams { gain: number; limiter: { threshold: number; knee: number; ratio: number; attack: number; release: number } }
export function boostParams(boost: number, unlocked: boolean): BoostParams
export class VolumeBoost {
  constructor(context: AudioContext, media: HTMLMediaElement)
  connect(): void
  setBoost(boost: number, unlocked: boolean): void
  disconnect(): void
}
```
`boostParams` clamps to 3 unless unlocked, then 5; gain is the clamped percentage / 100. `VolumeBoost` creates `createMediaElementSource`, `createGain`, and `createDynamicsCompressor`; sets `gain.value`, `threshold.value = -3`, `knee.value = 6`, `ratio.value = 12`, `attack.value = 0.003`, `release.value = 0.25`; connects source → gain → compressor → destination once. It is constructed lazily on the first play/unmute gesture. `setBoost` updates the gain only. `VolumeControl` shows 0–300% normally, unlocks to 500% via a toggle with a headphone warning, and applies the amber state above 300%.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd player && npx tsx --test tests/captions.test.ts tests/boost.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add player/src/lib/webvtt.ts player/src/components/player/overlays/CaptionsOverlay.tsx player/src/components/player/audio/VolumeBoost.ts player/src/components/player/controls/VolumeControl.tsx player/src/styles/captions.css player/src/components/player/PlayerProvider.tsx player/src/components/player/media/useMediaEngine.ts player/tests/captions.test.ts player/tests/boost.test.ts
git commit -m "feat(player): add mica captions and the volume booster"
```

### Task 18: Keyboard, server codenames, and the full control superset

**Files:**
- Create: `player/src/lib/keymap.ts`
- Create: `player/src/lib/servers.ts`
- Create: `player/src/lib/share.ts`
- Create: `player/src/components/player/controls/ControlBar.tsx`
- Create: `player/src/components/player/controls/PlayButton.tsx`, `SeekButton.tsx`, `TimeDisplay.tsx`, `SettingsMenu.tsx`, `FullscreenButton.tsx`, `PipButton.tsx`, `CastButton.tsx`, `EpisodeNav.tsx`
- Modify: `player/src/components/player/videojs/README.md` (append the control-bar and hotkey edits; the file is created in Task 6)
- Modify: `player/src/components/player/videojs/video/skin.tsx` (replace the generated control layout with `ControlBar`; documented in the README)
- Create: `player/src/components/player/menus/MenuRoot.tsx`, `QualityMenu.tsx`, `SpeedMenu.tsx`, `CaptionsMenu.tsx`, `AudioMenu.tsx`, `ServerMenu.tsx`, `ColourMenu.tsx`, `ChaptersMenu.tsx`, `AspectMenu.tsx`, `ShortcutsMenu.tsx`
- Create: `player/src/components/player/overlays/StatsOverlay.tsx`, `ShortcutsHelp.tsx`, `UpNextOverlay.tsx`
- Create: `player/src/components/player/colour/presets.ts`, `CssFilterPipeline.ts`, `WebGlPipeline.ts`
- Create: `player/src/components/player/media/useThumbnails.ts`
- Create: `player/tests/keymap.test.ts`, `player/tests/servers.test.ts`, `player/tests/share.test.ts`
- Modify: `player/src/components/player/PlayerRoot.tsx`
- Modify: `player/src/components/player/PlayerProvider.tsx`

**Interfaces:**
- Consumes: `PlayerApi`, `PlayerState`, `PlayerPreferences`, `parseImageTracks`, `fetchSprite`.
- Produces: `DEFAULT_KEYMAP`, `commandForKey`, `mergeKeymap`; `providerForCodename`, `codenameForProvider`, `SERVER_CODENAMES`; `buildShareLink`, `copyText`; every control/menu/overlay named in spec §6.2.

- [ ] **Step 1: Write the failing tests**

Create `player/tests/servers.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { codenameForProvider, providerForCodename, SERVER_CODENAMES } from '../src/lib/servers';

describe('server codenames', () => {
  it('maps all thirteen providers without leaking names', () => {
    assert.equal(Object.keys(SERVER_CODENAMES).length, 13);
    assert.equal(codenameForProvider('netmirror'), 'NOVA');
    assert.equal(providerForCodename('NOVA'), 'netmirror');
    assert.equal(providerForCodename('nope'), null);
  });
});
```

Create `player/tests/keymap.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { commandForKey, DEFAULT_KEYMAP } from '../src/lib/keymap';

describe('keymap', () => {
  it('maps space and k to togglePlay', () => {
    assert.equal(commandForKey({ key: ' ', target: null } as KeyboardEvent), 'togglePlay');
    assert.equal(commandForKey({ key: 'k', target: null } as KeyboardEvent), 'togglePlay');
  });
  it('ignores inputs', () => {
    assert.equal(commandForKey({ key: ' ', target: { tagName: 'INPUT' } } as unknown as KeyboardEvent), null);
  });
  it('exposes the default map', () => {
    assert.equal(DEFAULT_KEYMAP['f'], 'fullscreen');
  });
});
```

Create `player/tests/share.test.ts`:
```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildShareLink } from '../src/lib/share';

describe('share', () => {
  it('adds a timestamp without dropping existing params', () => {
    assert.equal(buildShareLink('https://player.example/embed/movie/550?token=x', 90), 'https://player.example/embed/movie/550?token=x&t=90');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd player && npx tsx --test tests/servers.test.ts tests/keymap.test.ts tests/share.test.ts`
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement the control superset**

`servers.ts` contains the exact 13 mappings from spec §6.6 and no provider strings in UI labels. `ServerMenu` shows codename, latency, and quality only; it calls `api.switchServer(codename)`, which maps to the provider and re-runs discovery with `?source=`. SDK/event payloads carry the codename, never the provider.

`keymap.ts`:
```ts
export type PlayerCommand = 'togglePlay' | 'seekBack' | 'seekForward' | 'volumeUp' | 'volumeDown' | 'mute' | 'fullscreen' | 'pip' | 'captions' | 'speedUp' | 'speedDown' | 'stats' | 'shortcuts' | 'nextEpisode' | 'previousEpisode';
export const DEFAULT_KEYMAP: Record<string, PlayerCommand>;
export function commandForKey(event: KeyboardEvent): PlayerCommand | null;
export function mergeKeymap(overrides: Record<string, PlayerCommand>): Record<string, PlayerCommand>;
```
Map Space/k, ArrowLeft/j, ArrowRight/l, ArrowUp/Down, m, f, p, c, s, `?`, n, b. Ignore `INPUT`, `TEXTAREA`, `SELECT`, and `contentEditable`. `ShortcutsMenu` edits the map and stores it at `peak:keymap:v1`; `ShortcutsHelp` renders the current map.

`share.ts` exports `buildShareLink(url, seconds)` (sets `t`) and `copyText(text)` (Clipboard API, rejects `PERMISSION_DENIED`).

`PlayerProvider` adds:
- `switchServer(codename)` → `source` state and `reload` discovery.
- `nextEpisode`/`previousEpisode` router navigation with clamped season/episode.
- `snapshot()` from the engine handle.
- `getShareLink()` and `copyEmbedLink()`.
- Colour presets through `CssFilterPipeline`: `cinema`, `vivid`, `warm`, `cool`, `night`, `reset` apply `filter: brightness() contrast() saturate() hue-rotate()` on the video surface and persist `colourPreset`. `WebGlPipeline` is opt-in only and its menu entry states that it disables native PiP and increases GPU load; never enable it automatically.
- Aspect `fit`/`fill`/`zoom` via CSS `object-fit`/`scale`; theatre mode toggles a class.
- Stats overlay with resolution, bitrate, buffer, dropped frames, latency, current source codename. Thumbnails use `useThumbnails` (`#EXT-X-IMAGE-STREAM-INF`/`#EXT-X-TILES`); when absent it calls `fetchSprite`; when that fails it shows time only.
- Up-next countdown and autoplay-next toggle.
- Cast button uses `video.remote.prompt()` when `remote.state` is available, otherwise it is hidden.

`ControlBar` composes transport, scrubber, time, volume/boost, captions, quality, settings, PiP, fullscreen, cast, stats, share/snapshot, and shortcuts. Every button has an `aria-label` and a keyboard path. `MenuRoot` unifies the menus into tabs: Quality, Speed, Captions, Audio, Server, Colour, Chapters, Aspect, Shortcuts.

Wire the custom bar into the vendored skin: in `player/src/components/player/videojs/video/skin.tsx`, import `{ ControlBar }` from `../../controls/ControlBar`, delete the `DefaultVideoControls` import, and replace `<DefaultVideoControls renderThumbnail={renderThumbnail} />` with `<ControlBar renderThumbnail={renderThumbnail} />`. Keep the generated `Poster`, `BufferingIndicator`, `ErrorDialog`, `VideoGestures`, and `VideoStatusIndicators` wrappers so behavior stays consistent. Delete the generated `<Title />` (already removed in Task 6 because `Header` owns the title), and delete `<VideoHotkeys />` together with its import: `lib/keymap.ts` owns keyboard handling, and leaving the generated hotkeys mounted would double-fire every shortcut. Record this edit, plus the earlier `<Title />` removal, in `player/src/components/player/videojs/README.md` with the original lines, the replacements, and the reasons (custom mica controls, single keyboard owner, SDK parity); the README is the re-application guide for future registry updates. Do not leave two control bars or two hotkey layers mounted.

- [ ] **Step 4: Run tests, typecheck, and build**

Run: `cd player && npx tsx --test tests/servers.test.ts tests/keymap.test.ts tests/share.test.ts && npm run typecheck && npm run build`
Expected: PASS. Every file named in spec §5.2 exists.

- [ ] **Step 5: Commit**

```bash
git add player/src/lib player/src/components/player player/tests/servers.test.ts player/tests/keymap.test.ts player/tests/share.test.ts
git commit -m "feat(player): complete the control superset and server switcher"
```

### Task 19: SDK v2 runtime and v1 compatibility

**Files:**
- Create: `player/sdk-contract.json`
- Create: `tests/sdkV2.test.js`
- Modify: `player/public/peak-embed.js`
- Modify: `player/src/lib/embedBridge.ts`
- Modify: `player/src/components/player/PlayerProvider.tsx`
- Modify: `player/src/app/embed/demo/DemoClient.tsx`
- Modify: `player/tests/embedBridge.test.ts`

**Interfaces:**
- Consumes: `PlayerApi`, `PlayerState`, `PlayerPreferences`.
- Produces: `PeakEmbed.version = 2`; `PeakEmbed.v2.mount(options)` returning a v2 instance; v1 `PeakEmbed.mount` unchanged; request/response postMessage envelope; all 18 events and 8 error codes.

- [ ] **Step 1: Write the failing test**

Create `tests/sdkV2.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');

function loadSdk() {
  const dom = new JSDOM('<!doctype html><div id="target"></div>', { url: 'https://host.example/page' });
  const code = fs.readFileSync(path.join(__dirname, '../player/public/peak-embed.js'), 'utf8');
  dom.window.eval(code);
  return dom;
}

test('v2 mounts a promise API and advertises version 2', async () => {
  const dom = loadSdk();
  const api = dom.window.PeakEmbed.v2.mount({ target: '#target', url: 'https://player.example/embed/movie/550?token=x' });
  assert.equal(dom.window.PeakEmbed.version, 2);
  const iframe = dom.window.document.querySelector('iframe');
  const sent = [];
  iframe.contentWindow.postMessage = (message) => sent.push(message);
  const promise = api.pause();
  assert.equal(typeof promise.then, 'function');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(sent[0].type, 'request');
  dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
    source: iframe.contentWindow,
    origin: 'https://player.example',
    data: { channel: 'peak-player', type: 'response', id: sent[0].id, ok: false, error: { code: 'NOT_READY', message: 'not ready' } },
  }));
  await assert.rejects(promise, (error) => error.code === 'NOT_READY');
});

test('v1 methods stay synchronous', () => {
  const dom = loadSdk();
  const api = dom.window.PeakEmbed.mount({ target: '#target', url: 'https://player.example/embed/movie/550?token=x' });
  assert.equal(api.play(), true);
  assert.equal(dom.window.PeakEmbed.version, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sdkV2.test.js`
Expected: FAIL because `PeakEmbed.v2` is undefined and v1 `play()` has no v2 contract.

- [ ] **Step 3: Implement the v2 transport and bridge**

`player/sdk-contract.json`:
```json
{
  "version": 2,
  "methods": ["play", "pause", "seek", "seekBy", "setVolume", "setMuted", "setBoost", "unlockBoost", "setSpeed", "setQuality", "setAudioTrack", "setCaptions", "setColourPreset", "setAspect", "switchServer", "nextEpisode", "previousEpisode", "goToLive", "requestFullscreen", "exitFullscreen", "requestPictureInPicture", "snapshot", "getShareLink", "copyEmbedLink", "getState", "getPreferences", "setPreferences"],
  "events": ["ready", "play", "pause", "ended", "timeupdate", "durationchange", "volumechange", "ratechange", "qualitychange", "audiotrackchange", "captionchange", "serverchange", "episodechange", "livechange", "fullscreenchange", "pipchange", "preferencechange", "error"],
  "errors": ["NOT_READY", "UNSUPPORTED", "INVALID_ARGUMENT", "STREAM_UNAVAILABLE", "TOKEN_EXPIRED", "ORIGIN_NOT_ALLOWED", "PERMISSION_DENIED", "UNKNOWN"]
}
```

`peak-embed.js` keeps the v1 factory (`mount` returns an instance whose methods return booleans/void and whose `play` sends a `command` message) and adds `createInstance(options, 2)`:
- v2 methods send `{ channel: 'peak-player', type: 'request', id, command, value }` and return a Promise resolved by `{ channel: 'peak-player', type: 'response', id, ok: true, result }` or rejected with a `PeakEmbedError` carrying `code`.
- The request timeout is 10 s → `NOT_READY`; `snapshot` returns the result string; `getShareLink` returns the result URL.
- `PeakEmbed = { version: 2, mount: v1Mount, v2: { version: 2, mount: v2Mount } }`. `v2Mount` accepts the same options and iframe setup as v1. Exact-origin validation and `event.source` checks are unchanged.
- `destroy()` rejects pending requests with `NOT_READY`, removes the iframe, and clears handlers; calling a method after destroy rejects `NOT_READY`.

`player/src/lib/embedBridge.ts` adds:
```ts
export interface EmbedRequest { channel: 'peak-player'; type: 'request'; id: string; command: EmbedCommandName; value?: unknown }
export interface EmbedResponse { channel: 'peak-player'; type: 'response'; id: string; ok: boolean; result?: unknown; error?: { code: PlayerErrorCode; message: string } }
export function createEmbedEventV2(event: EmbedEventName, payload?: Record<string, unknown>): EmbedEventMessage
```
`PlayerProvider` listens for requests from the allowed origin, maps each command to `PlayerApi`, responds with `ok`/`result` or a typed error, and emits every v2 event with `{ type, version: 2, timestamp }` merged into the payload. `snapshot` returns the data URL; `getState`/`getPreferences` return plain objects; `setPreferences` returns the merged preferences.

`DemoClient.tsx` uses `PeakEmbed.v2.mount`, awaits each command, displays the new events, and keeps a v1 fallback link.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/sdkV2.test.js` and `cd player && npx tsx --test tests/embedBridge.test.ts && npm run typecheck`
Expected: PASS. A rejected request produces a typed error and no unhandled rejection.

- [ ] **Step 5: Commit**

```bash
git add player/sdk-contract.json player/public/peak-embed.js player/src/lib/embedBridge.ts player/src/components/player/PlayerProvider.tsx player/src/app/embed/demo/DemoClient.tsx player/tests/embedBridge.test.ts tests/sdkV2.test.js
git commit -m "feat(sdk): ship SDK v2 with full method, event, and error parity"
```

### Task 20: Exhaustive SDK, control, and preferences documentation

**Files:**
- Create: `docs/content/docs/reference/events.mdx`
- Create: `docs/content/docs/reference/errors.mdx`
- Create: `docs/content/docs/guides/embedding.mdx`
- Create: `docs/content/docs/guides/migrating-to-sdk-v2.mdx`
- Create: `docs/content/docs/guides/player-controls.mdx`
- Create: `docs/content/docs/guides/preferences.mdx`
- Create: `docs/tests/sdk-coverage.test.mjs`
- Modify: `docs/content/docs/reference/sdk.mdx`, `reference/postmessage.mdx`
- Modify: `docs/content/docs/guides/live-tv.mdx`
- Modify: `docs/content/docs/reference/meta.json`, `guides/meta.json`
- Modify: `docs/content/docs/meta.json` if a page moves between sections
- Modify: `docs/tests/content.test.mjs`
- Modify: `docs/public/openapi.json`

**Interfaces:**
- Consumes: `player/sdk-contract.json`.
- Produces: documentation for every SDK method, event, error, control, and preference mode, with a coverage test that fails on drift.

- [ ] **Step 1: Write the failing coverage test**

Create `docs/tests/sdk-coverage.test.mjs`:
```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const contract = JSON.parse(readFileSync(new URL('../../player/sdk-contract.json', import.meta.url), 'utf8'));
const files = ['reference/sdk.mdx', 'reference/postmessage.mdx', 'reference/events.mdx', 'reference/errors.mdx', 'guides/player-controls.mdx', 'guides/preferences.mdx'];
const docs = files.map((f) => readFileSync(new URL(`../content/docs/${f}`, import.meta.url), 'utf8')).join('\n');

test('every SDK method, event, and error is documented', () => {
  for (const method of contract.methods) assert.match(docs, new RegExp(`\\b${method}\\b`), `method ${method}`);
  for (const event of contract.events) assert.match(docs, new RegExp(`\\b${event}\\b`), `event ${event}`);
  for (const error of contract.errors) assert.match(docs, new RegExp(`\\b${error}\\b`), `error ${error}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd docs && node --test tests/sdk-coverage.test.mjs`
Expected: FAIL with missing `events.mdx` (and later missing methods).

- [ ] **Step 3: Write the documentation and update navigation**

`reference/sdk.mdx`: retain v1 sections; add a v2 section with every method signature, parameter, return, rejection, and example. Include `PeakEmbed.v2.mount`, `PeakEmbed.version = 2`, and the v1 compatibility note. Replace every `PeakEmbed.version = "1.0.0"` claim with `2`; keep a dedicated “SDK v1 compatibility” subsection that explains v1 methods remain at `PeakEmbed.*` with their original synchronous semantics.
`reference/postmessage.mdx`: add the request/response envelope, every command name, every event name, payload shape, origin rules, timeouts, and examples. Keep v1 messages documented.
`reference/events.mdx`: one section per event with `{ type, version, timestamp, ...payload }`.
`reference/errors.mdx`: one section per error code with cause and remedy.
`guides/embedding.mdx`: end-to-end session mint → iframe → events → cleanup.
`guides/migrating-to-sdk-v2.mdx`: a v1 → v2 mapping table, including return-type changes and the `PeakEmbed.v2` namespace.
`guides/player-controls.mdx`: every control in spec §6.2 and its SDK equivalent.
`guides/preferences.mdx`: the three modes, precedence, locking, consent, and storage failure behavior.
`guides/live-tv.mdx`: add channel catalogue, EPG now/next, schedule panel, DVR, go-to-live, and latency.
Update `reference/meta.json` to `["urls","sdk","postmessage","events","errors"]` and `guides/meta.json` to include `embedding`, `migrating-to-sdk-v2`, `player-controls`, `preferences` in a sensible order. Update `docs/tests/content.test.mjs`'s required-file list to include the six new files.

Extend `docs/public/openapi.json` with `/api/v1/media/{type}/{id}`, `/api/v1/live/tv/epg/{id}`, and `/api/v1/preferences` (GET/PUT). Keep the OpenAPI 3.1.0 contract and `partnerApiKey` scheme valid.

- [ ] **Step 4: Run docs tests and link check**

Run: `cd docs && node --test tests/*.test.mjs && npm run check:links`
Expected: all PASS; every internal link resolves; coverage finds every method, event, and error.

- [ ] **Step 5: Commit**

```bash
git add docs/content/docs docs/tests docs/public/openapi.json
git commit -m "docs: document SDK v2, events, errors, controls, and preferences"
```

### Task 21: Final integration, admin cleanup, and visual sweep

**Files:**
- Create: `tests/adminCleanup.test.js`
- Modify: `admin/app/providers/page.tsx`
- Modify: `admin/app/login/page.tsx`
- Modify: `admin/app/globals.css` or `admin/app/legacy-overrides.css`
- Modify: `admin/app/layout.tsx` (only if hydration alignment is still needed)
- Modify: `package.json` only if the final check order needs adjustment

**Interfaces:**
- Consumes: every prior task.
- Produces: a green `npm run check`, a clean admin shell, and a recorded visual sweep of every route.

- [ ] **Step 1: Write the failing admin cleanup test**

Create `tests/adminCleanup.test.js`:
```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('providers does not nest a second admin shell while loading', () => {
  const page = readFileSync('admin/app/providers/page.tsx', 'utf8');
  assert.equal((page.match(/<AdminShell/g) || []).length, 1);
});
test('login honors callbackUrl', () => {
  assert.match(readFileSync('admin/app/login/page.tsx', 'utf8'), /callbackUrl/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/adminCleanup.test.js`
Expected: FAIL: `providers/page.tsx` renders `AdminShell` twice during loading and login never reads `callbackUrl`.

- [ ] **Step 3: Implement the final cleanup**

- `admin/app/providers/page.tsx`: remove the extra `<div className="admin-app" data-has-sidebar="true">` branch; render the loading and error states inside the single `AdminShell`.
- `admin/app/login/page.tsx`: read `callbackUrl` from `useSearchParams`, validate it is a same-origin path, and redirect there after login; default to `/`. Keep the lockout messages and default-credential hint.
- Admin light-mode contrast: scope `.brand-on-dark`/`.auth-story` overrides to their own containers; ensure the legacy static admin at `:8787/` uses `--canvas`/`--ink` rather than `#333` on black. Regenerate `admin/app/legacy.css` with `python3 scripts/extract-admin-legacy-css.py` only if a source class changed; never hand-edit it.
- Admin `/login` hydration: make the blocking theme bootstrap and `ThemeProvider` read/write the same `peak_theme` key and set the same `data-theme`/`.dark`/`colorScheme` values before paint. If a mismatch remains, suppress only the specific dynamic node, not the whole app.
- Player light-mode hero and `.error-card p` are already fixed in Task 1; re-check them in the sweep.

- [ ] **Step 4: Run the full check**

Run: `npm run check`
Expected: root ESLint, player lint/typecheck/tests/build, docs tests/link check, root API tests including `sdkV2` and `adminIptvUi`, admin typecheck, and the CSS budget all pass. No concurrent builds.

- [ ] **Step 5: Run the serial visual sweep**

Start the API and player detached (two processes maximum):
```bash
cd /home/pansilu/.local/share/opencode/worktree/950f13/peak-player-embed-platform
setsid nohup npm start > /tmp/opencode/peak-api.log 2>&1 < /dev/null &
setsid nohup npm --prefix player run dev > /tmp/opencode/peak-player.log 2>&1 < /dev/null &
```
Sweep serially at 1440 px and 390 px, in light and dark themes:
- `/`, `/movie/27205`, `/movie/999999`, `/tv/1399/1/1`, `/live/<seeded-channel>`, `/embed/demo`.
- `/embed/movie/550?token=<minted>`, `/embed/tv/1399/1/1?token=<minted>`, `/embed/live/<seeded-channel>?token=<minted>`.
- Poster overlay, mica captions, stats, shortcuts, schedule, server switcher, quality, captions sizes, boost amber above 300%, PiP, fullscreen, theatre, snapshot, share link.

Then stop the player and start admin + API:
```bash
setsid nohup npm --prefix admin run dev > /tmp/opencode/peak-admin.log 2>&1 < /dev/null &
```
Sweep `/`, `/login`, `/providers`, `/quality`, `/keys`, `/febbox`, `/advanced`, `/live`, `/iptv` in both themes and both widths. Check `/login` has no hydration warning, `/iptv` shows seed and health, and `/live` group filtering works. Stop admin, start docs + API, and sweep `/docs`, `/docs/quickstart`, `/docs/reference/sdk`, `/docs/reference/events`, `/docs/guides/live-tv`, `/docs/guides/preferences`.

Record the results in the commit body. Any failure blocks the commit.

- [ ] **Step 6: Commit**

```bash
git add admin/app/providers/page.tsx admin/app/login/page.tsx admin/app/globals.css admin/app/legacy-overrides.css admin/app/layout.tsx tests/adminCleanup.test.js
git commit -m "fix(admin): finish the shell cleanup and verify every route"
```

---

## Self-Review Checklist (run before handing off)

- [x] **Spec coverage:** §4 D1–D19 map to Tasks 1–20; §6 checklist maps to Tasks 6, 15, 17, 18; §7 to Tasks 7–9; §8 to Tasks 10–14; §9–11 to Tasks 15–18; §12 to Tasks 19–20; §13 to Tasks 1, 2, 5, 6, 8, 21; §14 to Tasks 6, 9, 15, 16; §15 to the test steps throughout; §16 phases are the section headings; §17 removals are Task 5 plus Task 3.
- [x] **Step scan:** every step names a file, a signature, a test assertion, a command, or an exact value. No step says “handle edge cases” or “add validation” without naming the rule.
- [x] **Type consistency:** `PlayerApi`, `PlayerState`, `PlayerPreferences`, `MediaMetadata`, `EngineHandle`, `ServerCodename`, and `resolvePreferences` are introduced once and consumed by name in later tasks.
- [x] **Review Focus:** each of the five lines has a test in its owning task (11, 7/8, 19, 10, 16).
- [x] **Proportion:** this plan is a decision record, not a transcript; component bodies that the spec and tests determine are left to the implementer.

## Execution Handoff

The user has already supplied the execution method: subagents are allowed, and the recommended method is **subagent-driven development**. After approval, use `superpowers:subagent-driven-development` task by task, with a fresh reviewer between tasks and a whole-branch review at the end. Do not run more than two dev servers or any concurrent build during execution.


