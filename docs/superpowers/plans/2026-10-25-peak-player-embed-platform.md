# Peak Player + Embed Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Peak's custom player reliable, ship a signed partner embed platform with an SDK, replace the placeholder landing page with a Magic UI marketing page, and add extensive Fumadocs documentation.

**Architecture:** Keep the existing Express API and Next.js player. Add a server-side source metadata/ranking/validation layer before emission, harden the media proxy with signed URLs and SSRF protection, add partner sessions and a postMessage bridge for Peak's own embed routes, and build marketing/docs as route-isolated Next apps so player and embed bundles stay lean. No third-party embed app is proxied.

**Tech Stack:** Node.js/Express, Next.js 15, React 19, TypeScript, Tailwind CSS 4, Magic UI components, Fumadocs 15, Node test runner (`tsx --test`), Playwright for screenshots.

**Spec:** `/tmp/opencode/peak-player-agent-handoff.md`, `.kilo/plans/1792833730751-progressive-streaming-sse.md`, `/tmp/opencode/peak-embed-player-reinvestigation-2026-10-25.md`, `/tmp/opencode/peak-embed-player-assessment.md`.

## Global Constraints

- Keep Peak's custom player as the primary experience; never proxy a third-party HTML/JS embed app.
- A direct third-party iframe is optional, off by default, sandboxed, clearly labeled, and never proxied.
- Keep progressive SSE source emission; never buffer all providers before first playback.
- Keep live TV working.
- Never expose upstream source URLs to embed clients; embed sources are signed proxy URLs.
- Do not commit `.env`, `utils/peak.db*`, `node_modules`, `.next`, or secrets.
- Do not add build-duration estimates to plans, docs, comments, or status updates. Technical timings (timeouts, TTLs, failover delays, cache lifetimes) remain accurate.
- Magic UI imports stay on marketing/docs routes, never in the player chrome or embed bundle.
- Use TDD where practical; small conventional commits; evidence before claims.

## Review Focus

- A provider returns an HTML error page as `.m3u8`: validator must reject it before emission, and `/m3u8-proxy` must never serve HTML as HLS.
- A provider returns a `.mkv` or HEVC source: it must be labeled correctly and ranked below browser-safe HLS/MP4.
- A title has two sources: failover must try both, not give up after one.
- A cached title has an expired signed upstream URL: cache replay must revalidate and fall back to a fresh scrape instead of replaying dead URLs.
- An embed token is expired, forged, or used from an origin not on the partner allowlist: reject before rendering the player and never emit a wildcard `frame-ancestors`.

---

## File Structure

### Backend

- `utils/sourceMetadata.js` — container/codec/HDR detection and player source construction.
- `utils/sourceRanking.js` — deterministic source scoring and ranking.
- `utils/sourceValidator.js` — HLS/MP4/MKV probes with timeouts and a short-lived result cache.
- `utils/providerHealth.js` — rolling provider success/failure, latency, and auto-disable window.
- `utils/proxySigner.js` — HMAC signing/verification for proxy URLs.
- `utils/ssrfGuard.js` — public-URL and DNS checks.
- `utils/embedPartners.js` — partner API keys and allowed frame ancestors.
- `utils/embedToken.js` — signed short-lived embed tokens.
- `utils/playbackSession.js` — in-memory playback sessions (primary + fallbacks, TTL).
- `utils/telemetry.js` — in-memory playback/provider telemetry.
- `utils/playerService.js` — integrate validation, ranking, cache replay, health, and telemetry.
- `proxy/proxyServer.js` — signed URLs, SSRF guard, header allowlist, rate limit, CORS allowlist, Range preservation.
- `utils/embed.js` — public player URL defaults and embed URL construction.
- `apiServer.js` — embed session, playback session, telemetry/health routes; proxy mount.

### Player

- `player/.eslintrc.json` and `player/package.json` — player-local lint/typecheck/build scripts; fix Next build.
- `player/src/lib/types.ts` — source metadata, embed/session types.
- `player/src/lib/quality.ts` — metadata-aware `preferredSourceIndex`.
- `player/src/lib/playback.ts` — pure failover/source-selection helpers.
- `player/src/lib/embedBridge.ts` — postMessage event/command bridge.
- `player/src/components/Player.tsx` — failover fix, 1500 ms HLS fallback, 300–500 ms delay, embed bridge.
- `player/src/components/SettingsMenu.tsx` — focus trap, initial focus, `aria-modal`, focus restore.
- `player/src/components/ExternalEmbed.tsx` — optional sandboxed third-party iframe, off by default.
- `player/src/app/embed/{movie,tv,live}/.../page.tsx` — signed embed routes.
- `player/src/middleware.ts` — token verification and `frame-ancestors` CSP.
- `player/src/app/page.tsx`, `player/src/components/marketing/*` — Magic UI landing page.
- `player/src/app/embed/demo/page.tsx`, `player/public/peak-embed.js` — SDK demo and copy-paste SDK.
- `player/src/app/globals.css` — design tokens + marketing styles; no Netflix red fallback.
- `player/tests/*.test.ts` — metadata/ranking/failover/embed-token tests.

### Docs

- `docs/` — separate Fumadocs 15 app (`fumadocs-core@15.8.5`, `fumadocs-ui@15.8.5`, `fumadocs-mdx@11.10.1`).
- `docs/content/docs/**` — task guides, reference, architecture, security, troubleshooting, changelog.
- `docs/public/openapi.json` — embed/session/playback API contract.
- `docs/components/openapi-reference.tsx` — renders the contract as readable endpoint cards.
- `docs/app/(home)/page.tsx` — custom docs landing.
- `docs/app/docs/[[...slug]]/page.tsx`, `docs/app/docs/layout.tsx`, `docs/lib/source.ts` — Fumadocs wiring.

### Root

- `package.json` — `check`, `check:player`, `docs:build`, `docs:dev`, `screenshots` scripts.
- `docker-compose.yml`, `.env.example` — public player/API URLs, proxy/embed secrets, partner config.
- `docs/superpowers/plans/2026-10-25-peak-player-embed-platform.md` — this plan.
- `AGENTS.md` — commands, architecture, conventions.

---

## Task 1: Fix the DX baseline and player build

**Files:**
- Create: `player/.eslintrc.json`
- Modify: `player/package.json`, `player/next.config.mjs`, `package.json`
- Test: `player/tests/config.test.ts`

**Interfaces:**
- Produces: `npm --prefix player run lint`, `typecheck`, `test`, `build`; root `npm run check`.

- [ ] **Step 1: Write a failing config test** that asserts the player has a local ESLint config with a TypeScript parser and that `package.json` exposes `lint`, `typecheck`, and `build`.
- [ ] **Step 2: Run `npm --prefix player test`** and confirm the new test fails.
- [ ] **Step 3: Add `player/.eslintrc.json`** extending `next/core-web-vitals`, set `root: true`, ignore `.next`, and add `eslint`, `eslint-config-next`, and `tsx` devDependencies. Set `outputFileTracingRoot` to the player directory in `next.config.mjs`. Add root scripts: `check` (root lint + player check), `check:player` (`npm --prefix player run lint && npm --prefix player run typecheck && npm --prefix player test && npm --prefix player run build`).
- [ ] **Step 4: Run `npm --prefix player run lint`, `typecheck`, `test`, `build`** and confirm all pass.
- [ ] **Step 5: Commit** `chore: fix player lint and build baseline`.

---

## Task 2: Source metadata, ranking, and provider health

**Files:**
- Create: `utils/sourceMetadata.js`, `utils/sourceRanking.js`, `utils/providerHealth.js`
- Modify: `utils/playerService.js`, `utils/streamFilters.js`
- Test: `tests/sourceMetadata.test.js`, `tests/sourceRanking.test.js`, `tests/providerHealth.test.js`

**Interfaces:**
- Produces:
  - `detectContainer(stream) -> 'hls' | 'mp4' | 'webm' | 'mkv' | 'unknown'`
  - `detectVideoCodec(stream) -> 'h264' | 'hevc' | 'av1' | 'vp9' | 'unknown'`
  - `detectHdr(stream) -> boolean`
  - `buildPlayerSource(stream, { expiresIn }) -> Source` with `{url, quality, codec, container, videoCodec, audioCodec, hdr, provider, adaptive, browserPlayable, expiresIn}`
  - `rankSources(sources) -> Source[]` (stable, highest score first)
  - `recordProviderResult(name, {ok, latencyMs, error})`, `getProviderHealth(name)`, `getAllProviderHealth()`, `isProviderHealthy(name)`
- `playerSource` delegates to `buildPlayerSource`; `sortSourcesHlsFirst` is removed.

- [ ] **Step 1: Write failing tests** for MKV/HEVC detection, HLS detection, MP4 H.264, HDR, ranking order (HLS > MP4 > MKV; H.264 > HEVC; 1080p > 4K; health tiebreak), and health auto-disable after three consecutive failures.
- [ ] **Step 2: Run `node --test tests/sourceMetadata.test.js tests/sourceRanking.test.js tests/providerHealth.test.js`** and confirm failure.
- [ ] **Step 3: Implement the three modules** with the signatures above. `rankSources` must be stable and must not mutate input. Export `parseQuality` from `streamFilters.js` and reuse it.
- [ ] **Step 4: Run the tests** and confirm pass. Run root `npm run lint`.
- [ ] **Step 5: Commit** `feat: add source metadata, ranking, and provider health`.

---

## Task 3: Source validation before emission

**Files:**
- Create: `utils/sourceValidator.js`
- Modify: `utils/playerService.js`
- Test: `tests/sourceValidator.test.js`

**Interfaces:**
- Produces: `validateSource(stream, { timeoutMs = 3500, cache = true, allowPrivate = false }) -> Promise<{ok, status, reason, contentType, container, checkedAt}>`
- Validation cache: 60 s, max 500 entries; `clearValidationCache()` for tests.
- Rejects: 401/403/404/429/5xx, HTML/doctype, Cloudflare/DDoS-Guard challenge text, HLS body without `#EXTM3U`, MP4 body starting with `<`.

- [ ] **Step 1: Write failing tests** using a local HTTP fixture server: valid HLS master/variant/segment; HLS that returns HTML; MP4 `206` with `video/mp4`; MP4 `403`; MP4 HTML; timeout; cached second call.
- [ ] **Step 2: Run `node --test tests/sourceValidator.test.js`** and confirm failure.
- [ ] **Step 3: Implement `validateSource`** with `node-fetch`, `AbortController`, sanitized `referer`/`origin`/`user-agent` headers, relative URL resolution, and a total deadline. HLS probes master, first variant, and first segment when present. MP4/MKV uses `Range: bytes=0-1023`.
- [ ] **Step 4: Run the tests** and confirm pass.
- [ ] **Step 5: Commit** `feat: validate sources before playback`.

---

## Task 4: Integrate validation, ranking, cache replay, and sessions

**Files:**
- Modify: `utils/playerService.js`, `utils/streamFilters.js`
- Create: `utils/playbackSession.js`, `utils/telemetry.js`
- Test: `tests/playerService.test.js`, `tests/playbackSession.test.js`, `tests/telemetry.test.js`

**Interfaces:**
- `prepareStreams(streams, { serverUrl, config, provider, allowPrivate }) -> Promise<Source[]>` validates in parallel, filters rejects, builds sources, ranks.
- `getPlayerStreamEvents` emits only validated sources, per-provider ranked; cache replay validates/ranks and falls back to a scrape if all cached sources fail.
- Cache TTL: `PLAYER_CACHE_TTL_MS` default 900000 (15 min), max 1800000 (30 min).
- `createPlaybackSession({type,id,season,episode,serverUrl,config}) -> {sessionId, sources, subtitles, diagnostics, expiresAt}`; in-memory TTL 10 min; `getPlaybackSession(id)`.
- `recordPlaybackEvent(event)`, `getTelemetrySummary()`.
- Source `expiresIn` is `Math.floor(cacheTtlMs / 1000)`.

- [ ] **Step 1: Write failing tests** with a stubbed validator/provider: no rejected source emitted; per-provider ranking; cache replay HLS-first; all-cached-invalid falls back to scrape; cache TTL cap; session returns at most four sources; telemetry counters.
- [ ] **Step 2: Run `node --test tests/playerService.test.js tests/playbackSession.test.js tests/telemetry.test.js`** and confirm failure.
- [ ] **Step 3: Implement `prepareStreams`, cache changes, session module, and telemetry module.** Keep `Promise.all` only as the cache/done barrier. Keep progressive `source`/`diagnostic`/`subtitle` events inside provider promises. Include `validated: true` and metadata on each source.
- [ ] **Step 4: Run the tests** and confirm pass.
- [ ] **Step 5: Commit** `feat: validate, rank, and cache player sources`.

---

## Task 5: Fix player failover and use ranking

**Files:**
- Modify: `player/src/lib/types.ts`, `player/src/lib/quality.ts`, `player/src/components/Player.tsx`
- Create: `player/src/lib/playback.ts`
- Test: `player/tests/playback.test.ts`, `player/tests/quality.test.ts`

**Interfaces:**
- `sourceKey(source, index) -> string`
- `nextSourceIndex(sources, attempted, currentIndex) -> number` (`-1` when all attempted)
- `FAILOVER_DELAY_MS = 350`, `HLS_MANIFEST_TIMEOUT_MS = 1500`
- `preferredSourceIndex(sources)` prefers adaptive/HLS, then browser-safe MP4/WebM, then MKV; H.264 before HEVC; 1080p before 4K.

- [ ] **Step 1: Write failing tests** for the two-source case (tries both), 13-source case (tries all), unique keys, HLS/MP4/MKV preference, H.264/HEVC, and 1080p/4K.
- [ ] **Step 2: Run `npm --prefix player test`** and confirm failure.
- [ ] **Step 3: Implement the pure helpers and wire `Player.tsx`:** remove `failedCount + 1 + attemptedSourcesRef.size`; use the attempted set only; 350 ms delay; 1500 ms HLS manifest timer; select the best accumulated source on first source and on `done` while still loading; keep manual source selection working.
- [ ] **Step 4: Run player tests, lint, typecheck, and build** and confirm pass.
- [ ] **Step 5: Commit** `fix: try every source and use ranked selection`.

---

## Task 6: Harden the media proxy

**Files:**
- Create: `utils/proxySigner.js`, `utils/ssrfGuard.js`
- Modify: `proxy/proxyServer.js`, `apiServer.js`
- Test: `tests/proxySigner.test.js`, `tests/ssrfGuard.test.js`, `tests/proxyRoutes.test.js`

**Interfaces:**
- `signProxyUrl(path, params) -> string` adds `sig`; `verifyProxyQuery(query) -> boolean`; `getProxySecret()`.
- `assertSafeUrl(url, { allowPrivate = false }) -> Promise<URL>` blocks loopback/private/link-local/metadata and DNS rebinding to private addresses.
- Proxy routes reject missing/invalid `sig` (unless `PROXY_ALLOW_UNSIGNED=1` in development), allow only `referer`, `origin`, `user-agent` headers, rate-limit per IP, and CORS-allow only configured player/partner origins.
- `processStreamsForProxy` signs every URL; `rewriteM3u8` signs nested URLs.
- No `force200` for `.mp4`/`.mkv`; Range passes through.

- [ ] **Step 1: Write failing tests** for sign/verify tampering, expired/omitted signature, private IP rejection, header allowlist, and Range preservation through a local upstream.
- [ ] **Step 2: Run `node --test tests/proxySigner.test.js tests/ssrfGuard.test.js tests/proxyRoutes.test.js`** and confirm failure.
- [ ] **Step 3: Implement signer/SSRF guard and wire the proxy routes.** Keep `/m3u8-proxy` HTML rejection. Preserve `Content-Range` on cached ranges.
- [ ] **Step 4: Run tests and root lint.**
- [ ] **Step 5: Commit** `feat: sign and harden the media proxy`.

---

## Task 7: Public URLs and embed session API

**Files:**
- Create: `utils/embedPartners.js`, `utils/embedToken.js`
- Modify: `utils/embed.js`, `apiServer.js`, `docker-compose.yml`, `.env.example`
- Test: `tests/embedToken.test.js`, `tests/embed.test.js`

**Interfaces:**
- `signEmbedToken(payload, { secret, ttlSeconds }) -> string`
- `verifyEmbedToken(token, { secret }) -> {ok, payload, error}`
- `findPartnerByApiKey(key)`, `getPartner(id)`, `getPartnerOrigins(id)`.
- `POST /api/v1/embed/sessions` with `x-api-key` and `{type,id,season?,episode?,ttlSeconds?}` returns `{token, expiresAt, url, embedUrl, partner, origins}`.
- `GET /api/v1/playback/health` returns provider health + telemetry; `POST /api/v1/playback/telemetry` records events.
- `PLAYER_PUBLIC_URL` required in production; default `http://localhost:3001` only for development. Compose sets `PLAYER_PUBLIC_URL`, `PUBLIC_API_URL`, `EMBED_TOKEN_SECRET`, `PROXY_SIGNING_SECRET`, `EMBED_PARTNERS`, `PLAYER_ALLOWED_ORIGINS`.

- [ ] **Step 1: Write failing tests** for token sign/verify/tamper/expiry, partner lookup, signed URL building, and public URL fallback.
- [ ] **Step 2: Run `node --test tests/embedToken.test.js tests/embed.test.js`** and confirm failure.
- [ ] **Step 3: Implement token/partner modules and routes.** Use HMAC-SHA256, base64url, timing-safe comparison. Reject wildcard origins.
- [ ] **Step 4: Run tests and root lint.**
- [ ] **Step 5: Commit** `feat: add signed embed sessions and public URLs`.

---

## Task 8: Embed routes, CSP middleware, SDK, and demo

**Files:**
- Create: `player/src/middleware.ts`, `player/src/lib/embedToken.ts`, `player/src/lib/embedBridge.ts`, `player/src/app/embed/movie/[id]/page.tsx`, `player/src/app/embed/tv/[id]/[season]/[episode]/page.tsx`, `player/src/app/embed/live/[id]/page.tsx`, `player/src/app/embed/demo/page.tsx`, `player/public/peak-embed.js`, `player/src/components/ExternalEmbed.tsx`
- Modify: `player/src/components/Player.tsx`, `player/src/lib/types.ts`
- Test: `player/tests/embedToken.test.ts`, `player/tests/embedBridge.test.ts`

**Interfaces:**
- Edge token verification uses Web Crypto HMAC-SHA256 and the same payload format as `utils/embedToken.js`.
- Middleware sets `Content-Security-Policy: frame-ancestors 'self' <origins>` and never wildcard; rejects invalid/expired tokens with 401.
- Player `embed` prop posts `ready`, `play`, `pause`, `ended`, `timeupdate`, `sourcechange`, `error` to `window.parent` and handles `play`, `pause`, `seek`, `setVolume`, `setSubtitle`, `setQuality`.
- SDK exposes `window.PeakEmbed.mount(options)` returning `{on, off, play, pause, seek, setVolume, setSubtitle, setQuality, destroy}`.
- `ExternalEmbed` is gated by `NEXT_PUBLIC_ALLOW_THIRD_PARTY_EMBED === '1'`, uses `sandbox="allow-scripts allow-presentation"` (no same-origin), and renders a visible "External provider" label.

- [ ] **Step 1: Write failing tests** for edge token verification, command validation, and event shape.
- [ ] **Step 2: Run `npm --prefix player test`** and confirm failure.
- [ ] **Step 3: Implement middleware, routes, bridge, SDK, and demo.** Demo reads a token from its own server route or accepts a pasted token; never embeds an upstream URL.
- [ ] **Step 4: Run player tests, lint, typecheck, build.**
- [ ] **Step 5: Commit** `feat: add signed embed routes and SDK`.

---

## Task 9: Magic UI landing page

**Files:**
- Create: `player/src/components/marketing/{hero-video-dialog,bento-grid,marquee,number-ticker,border-beam,backlight}.tsx`, `player/src/lib/utils.ts`
- Modify: `player/src/app/page.tsx`, `player/src/app/globals.css`, `player/src/app/layout.tsx`, `player/package.json`
- Test: `player/tests/marketing.test.ts` (static content/route checks)

**Interfaces:**
- Landing page sections: hero with demo dialog, live player mockup, quick-start snippet, bento feature grid, provider marquee, stats, integration steps, partner auth, docs CTA, FAQ, status.
- Design tokens: forest/ink/ivory/peak/amber; display face `Bricolage Grotesque`, UI face `DM Sans`; 8px spacing; radius/motion tokens; no Netflix red.
- Magic UI imports are only under `components/marketing` and the landing route.

- [ ] **Step 1: Write a failing static test** asserting the landing page contains the hero, quick-start, features, docs CTA, and that `globals.css` has Peak tokens and no `#e50914`.
- [ ] **Step 2: Run player tests and confirm failure.**
- [ ] **Step 3: Add dependencies (`motion`, `lucide-react`, `clsx`, `tailwind-merge`) and implement the Magic UI components and page.** Use `next/font/google` for the two faces. Keep the page responsive at 320/768/1440 and respect reduced motion.
- [ ] **Step 4: Run tests, lint, typecheck, build; capture screenshots at 320/768/1440 with the browser tool.**
- [ ] **Step 5: Commit** `feat: add Magic UI embed landing page`.

---

## Task 10: Fumadocs documentation app

**Files:**
- Create: `docs/package.json`, `docs/next.config.mjs`, `docs/source.config.ts`, `docs/postcss.config.mjs`, `docs/tsconfig.json`, `docs/app/layout.tsx`, `docs/app/docs/layout.tsx`, `docs/app/docs/[[...slug]]/page.tsx`, `docs/app/(home)/page.tsx`, `docs/app/api/search/route.ts`, `docs/lib/source.ts`, `docs/mdx-components.tsx`, `docs/app/global.css`, `docs/content/docs/**`, `docs/public/openapi.json`, `docs/components/openapi-reference.tsx`
- Modify: root `package.json`
- Test: `docs/tests/content.test.mjs`

**Interfaces:**
- Fumadocs 15 source loader at `/docs`; search route; docs sidebar/TOC/dark mode.
- Content covers introduction, concepts, quick start, movie/TV/live embeds, auth, URL reference, SDK, postMessage, theming, playback, errors, self-hosting, API reference, architecture, source pipeline, security, troubleshooting, changelog, status, legal, FAQ.
- OpenAPI contract rendered by `OpenApiReference`.

- [ ] **Step 1: Write a failing content test** asserting every required guide exists and the OpenAPI file contains `/api/v1/embed/sessions`.
- [ ] **Step 2: Run `node --test docs/tests/content.test.mjs`** and confirm failure.
- [ ] **Step 3: Implement the docs app and content.** Add root scripts `docs:dev`, `docs:build`, `docs:start`. Use a custom hero and readable Fumadocs pages. Add a link checker script.
- [ ] **Step 4: Run `npm --prefix docs run build` and the content test; capture docs screenshots.**
- [ ] **Step 5: Commit** `docs: add Fumadocs embed platform documentation`.

---

## Task 11: Settings accessibility and player UX polish

**Files:**
- Modify: `player/src/components/SettingsMenu.tsx`, `player/src/app/globals.css`
- Test: `player/tests/settingsMenu.test.tsx` (source-level assertions) or Playwright keyboard test

**Interfaces:**
- Focus trap inside dialog; initial focus on close button; `aria-modal="true"`; Escape closes/back; focus returns to opener; click-outside still works.

- [ ] **Step 1: Write a failing static/accessibility test** for `aria-modal`, focus trap, and focus restore.
- [ ] **Step 2: Run player tests and confirm failure.**
- [ ] **Step 3: Implement focus trap/restore and add `aria-modal`.** Keep existing tabs and styling.
- [ ] **Step 4: Run tests, lint, typecheck, build.**
- [ ] **Step 5: Commit** `fix: make player settings dialog accessible`.

---

## Task 12: Verification, screenshots, and docs sync

**Files:**
- Modify: `.kilo/plans/1792833730751-progressive-streaming-sse.md`, `docs/superpowers/plans/2026-10-25-peak-player-embed-platform.md`, `AGENTS.md`, root `package.json`
- Create: `docs/public/screenshots/*.png`, `player/tests/e2e/*.spec.ts`, `playwright.config.ts`

**Interfaces:**
- `npm run check` runs root lint, player lint/typecheck/test/build, docs content test.
- `npm run screenshots` runs Playwright at 320/768/1440 for landing, player, and docs.
- Final report records commands, pass/fail, first-source/first-playable metrics, and remaining risks.

- [ ] **Step 1: Add Playwright config and screenshot specs** for landing, docs, and player states.
- [ ] **Step 2: Run `npm run check` and fix failures.**
- [ ] **Step 3: Run the screenshot suite and save images under `docs/public/screenshots`.**
- [ ] **Step 4: Update plan/handoff/AGENTS docs with what shipped and what remains.**
- [ ] **Step 5: Commit** `chore: verify player, embed platform, landing, and docs`.

---

## Acceptance Gates

### Playback

- Fixture: first source <100 ms after the first provider response; first playable <300 ms; no unvalidated source emitted.
- Live 20-title matrix: >95% first-play success; p75 TTFF <3 s; record p95 and failures.
- Cached replay uses the same validated/ranked order as live and never starts on a dead MP4/MKV when HLS is available.
- No 2000 ms failover delay; every source tried at most once; two-source case tries both.
- Seeking works through the proxy; MKV is never labeled MP4; live TV still works.

### Embed

- Signed URL required; expired/invalid/forged tokens rejected.
- `frame-ancestors` allowlist works; no wildcard.
- No upstream URL in embed HTML, JS, network responses, or logs.
- SDK events/commands work in a real iframe; demo works from a clean clone.

### Landing and docs

- Responsive at 320/768/1440; keyboard accessible; visible focus; reduced motion respected.
- No layout shift; Magic UI supports the story and is not in the player/embed bundle.
- `docs:build` and link checker pass; quick start works as written; API reference matches code.

### Global

- No third-party embed as primary; no full-app proxy.
- No build-duration estimates in plans, docs, comments, or status updates.
- No secrets or runtime database files committed.
- Evidence before claims: commands, screenshots, metrics, and test output.
