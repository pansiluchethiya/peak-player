# Plan: Progressive Streaming API (SSE) + IPTV Live TV for Peak

## Status and next work (2026-10-25)

> **Committed:** `83fb394` — `feat: add custom player, IPTV, and embed pipeline`.
> **Working tree:** clean.
> **Core correction:** the committed code already emits `source` events per provider as each scrape resolves. The `Promise.all` at `utils/playerService.js:438` is a completion barrier for caching and the `done` event; it is **not** a source-emission barrier. The remaining playback problem is source validation/ranking and slow failover, not SSE buffering.

### Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| SSE endpoint | Done | `GET /api/v1/stream/events/:type/:id` in `apiServer.js`; flushes headers and handles client disconnect. |
| Concurrent provider scraping | Done | `scrapePromises` in `utils/playerService.js`. |
| Progressive source emission | Done | `source`, `subtitle`, and `diagnostic` are emitted inside each provider promise (`utils/playerService.js:395-427`). |
| First-source latency | Partial | The first provider to resolve wins, but it may be an unplayable MP4/MKV. |
| Source validation | Missing | No HLS master/segment probe and no MP4 `Range` probe. |
| Source ranking | Missing | `sortSourcesHlsFirst` is defined at `utils/playerService.js:47` but unused. `preferredSourceIndex` is imported by `player/src/components/Player.tsx` but never called. |
| MKV/HEVC labeling | Bug | `playerSource` labels every non-HLS source `codec: 'mp4'`; MKV/HEVC files are mislabeled. |
| Fast failover | Missing | `Player.tsx:643` still waits 2000 ms per failed source. |
| HLS 1500 ms fallback | Missing | Not implemented. |
| Event cache | Done, but hardcoded | 1 hour TTL and `expiresIn: 3600`; cache replay emits MP4 first, then HLS. |
| IPTV storage/parser/sync | Done | `utils/db.js`, `utils/iptvStore.js`, `utils/iptvParser.js`, `utils/iptvSync.js`, `utils/iptvId.js`. |
| IPTV admin/public APIs | Done | See `apiServer.js`. |
| Live TV player route | Done | `player/src/app/live/[id]/page.tsx`; `utils/embed.js` supports `live_tv`. |
| Player EventSource | Done | `player/src/lib/api.ts` and `player/src/components/Player.tsx`. |
| Deployment config | Partial | `player/src/app/api/[...path]/route.ts` still defaults `API_URL` to `http://localhost:3000`; compose still sets `PUBLIC_API_URL=http://localhost:8787` and does not set `PLAYER_PUBLIC_URL`. |
| Tests | Partial | Only `player/tests/quality.test.ts` and `time.test.ts`; no SSE, validation, ranking, or failover tests. |

### Current evidence (2026-10-25, reinvestigated)

Live scrape (cacheHit false, TMDB 550):

- `meta` at 1.22 s; first `source` (VaPlayer HLS) at 2.17 s; `done` at 5.11 s.
- 13 providers, 13 sources, 0 subtitles; 5 providers timed out at 4 s (`netmirror`, `zxcstreams`, `4khdhub`, `castletv`, `showbox`).
- Source order: VaPlayer HLS x3, StreamFlix `.mkv` mislabeled `mp4`, Vixsrc HLS, DahmerMovies `.mkv`/MP4 x5, Vidlink MP4 x3.
- Probes of the first five: VaPlayer HLS 200; StreamFlix `.mkv` 500; Vixsrc HLS 200. Earlier probes also saw Dahmer 403 Cloudflare and Vidlink 429.
- Cached replay (`cacheHit:true`) emits all 13 sources in 0.5 ms in the **opposite** order: DahmerMovies MP4/MKV x5, Vidlink MP4 x3, StreamFlix `.mkv`, then VaPlayer/Vixsrc HLS. The first cached source is a 2160p HEVC/HDR MKV labeled `codec:"mp4"`.
- `Player.tsx` failover has a double-counting bug (`failedCount + 1 + attemptedSourcesRef.size`) and gives up after about N/2 failures: with 13 sources it tries only ~7, never reaching HLS at #10-13. It also waits 2000 ms per failure.
- The proxy is an unauthenticated open URL fetcher: arbitrary `url` and `headers`, no host allowlist/SSRF guard, `Access-Control-Allow-Origin: *`; it cannot proxy an HTML/JS app and returns HTML through `/m3u8-proxy` as `application/vnd.apple.mpegurl`.
- `/api/embed` returns Peak's own player, but defaults to `http://127.0.0.1:3001`; compose sets `PUBLIC_API_URL=http://localhost:8787`, so an external embed is not practical until public URLs are configured.
- Full read-only report: `/tmp/opencode/peak-embed-player-reinvestigation-2026-10-25.md`.

### Corrections to the original plan

- The player lives at `player/`, not `stream-backend/player`.
- "First source plays immediately" is true only in the sense that the first provider response is emitted immediately; it is not guaranteed to be playable. Validation and ranking must be added.
- The original plan did not make validation, ranking, or fast failover explicit. They are now P0 requirements.
- The original validation step should measure first-source and first-playable separately; `done` latency is not time-to-first-frame.
- The live path is progressive, but the cached path is a synchronous burst and is deliberately MP4-first (`utils/playerService.js:349-357`). Fixing cache replay order is P0.
- The player's failover bookkeeping is wrong (`Player.tsx:609-627`); it can give up after roughly half the sources. Fixing the counter is P0.
- MKV/HEVC must be represented as container/codec metadata, not relabeled `mp4` (`utils/playerService.js:78-87`).
- The proxy is a security surface, not just a playback detail: unauthenticated arbitrary URL fetch, encoded headers, no SSRF/host allowlist, and `Access-Control-Allow-Origin: *`.
- `.gitignore` now excludes `utils/peak.db-shm`, `utils/peak.db-wal`, and `player/tsconfig.tsbuildinfo`.

### Practicality verdict (2026-10-25)

**Do not replace Peak's player with a third-party embed, and do not proxy a third-party embed app through Peak's proxy.** The player UI is already competent; the failures are in source validation/ranking, codec labeling, cache order, failover bookkeeping, and proxy/deployment. Proxying a full app would require a general reverse proxy (HTML/JS/CSS rewriting, cookies, CORS/CSP, WebSockets, anti-bot) and would put untrusted third-party JS at or near Peak's origin. Direct iframes are technically possible for Videasy/VidLink today but are not a stable contract, expose users to ads/trackers, and are already blocked by Mapple's `frame-ancestors`.

Practical order:

1. **P0 fixes (days):** codec labels, failover counter/delay, cache order, public URLs.
2. **Source quality (1–2 weeks):** validation, ranking, playback-session API, proxy hardening.
3. **UI (2–4 weeks):** tokens, Radix/Vidstack, resume/episode/source picker, accessibility.
4. **Peak embed platform (3–6 weeks):** separate origin, signed partner tokens, `frame-ancestors`, SDK/postMessage, analytics.

A direct third-party iframe fallback is optional, off by default, never proxied, and only after checking headers/terms.

### Next work (ordered)

**P0 — make the first emitted source playable**

- [ ] Preserve codec/container metadata in `playerSource` (`utils/playerService.js:78-87`): keep `stream.codec`, `stream.codecs`, extension, HDR/HEVC; add `container`/`videoCodec`; never label `.mkv`/HEVC as `mp4`.
- [ ] Add a source-validation module (new `utils/sourceValidator.js`) with:
  - HLS: fetch master, resolve variants, probe first segment.
  - MP4: `Range: bytes=0-1023`; accept 200/206; reject HTML, Cloudflare challenges, 401/403/404/429/5xx.
  - Return `{ ok, reason, contentType, status }`; cache results briefly.
- [ ] Add `utils/sourceRanking.js` (or implement in `playerService.js`):
  - HLS/adaptive first; H.264/AAC before HEVC; 1080p before 4K; provider health as tiebreaker.
  - Detect `.mkv`/HEVC and never label them `mp4`.
  - Use `sortSourcesHlsFirst` or remove it.
- [ ] Fix cached replay ordering: remove the `mp4First`/`hlsFirst` split (`utils/playerService.js:349-357`); cache the validated/ranked list and replay it in the same order as the live path.
- [ ] Fix `Player.tsx` failover bookkeeping (`Player.tsx:609-627`): replace `failedCount + 1 + attemptedSourcesRef.size` with one attempted set/count so every source is tried at most once.
- [ ] Update `Player.tsx` selection/failover:
  - Use `preferredSourceIndex` or the new ranking.
  - Reduce failover delay from 2000 ms to 300–500 ms.
  - Add the 1500 ms HLS fallback; replace the 8 s manifest timer with a shorter first-playable deadline.
- [ ] Emit only validated sources; keep diagnostics for rejected ones.
- [ ] Cache validated/ranked results; use actual URL expiry instead of a blind 3600 s; refresh/revalidate stale signed URLs on cache hit.
- [ ] Add a playback-session API: one primary + 2–3 fallbacks, subtitles, audio, `expiresAt`, `sessionId`; signed proxy URLs; no raw upstream URLs to the client.
- [ ] Harden the proxy: signed tokens/allowlist/rate limits, SSRF/private-IP protection, stop accepting arbitrary `headers` JSON, restrict CORS to player/partner origins, and do not strip `Range` for MP4/MKV.
- [ ] Fix deployment config:
  - `player/src/app/api/[...path]/route.ts` default `API_URL` to `http://localhost:8787`.
  - Set `PLAYER_PUBLIC_URL` in compose; document remote `PUBLIC_API_URL`.
- [ ] Tests: progressive ordering, validation, ranking, failover bookkeeping, cache replay, proxy range/seek.

**P1 — UI/UX**

- [ ] Design tokens; replace Netflix red with Peak green; one display + one UI typeface.
- [ ] Add Radix/shadcn primitives, `lucide-react`, and Vidstack (or Media Chrome).
- [ ] Add resume/progress, episode selector, source picker, quality/audio menus.
- [ ] Split `Player.tsx` into hooks; target <300 lines.
- [ ] Accessibility: focus trap, `aria-modal`, keyboard, reduced motion.
- [ ] Playwright screenshots at 320/768/1440/fullscreen.

**P2 — Peak embed platform**

- [ ] Separate player origin.
- [ ] Partner session API with short-lived signed token.
- [ ] `frame-ancestors` allowlist; deny unknown origins.
- [ ] JS SDK + `postMessage`; no upstream URLs.
- [ ] Per-partner analytics and rate limits.
- [ ] No third-party embed proxying; optional direct iframe fallback only, off by default.

### Acceptance gates

- Fixture suite: first source event <100 ms after the first provider; first playable <300 ms; no unvalidated source emitted.
- Live 20-title matrix: >95% first-play success; p75 TTFF <3 s; first-playable p75 <3.5 s; record p95 and failures.
- Cached replay: same validated/ranked order as live; first source is never a dead MP4/MKV when an HLS source is available.
- No 2000 ms failover delay; every source tried at most once; seeking works through the proxy; MKV is never labeled MP4.
- Proxy: unauthenticated arbitrary URL fetches are rejected; private/link-local IPs blocked; CORS restricted; range requests preserved.
- UI and embed gates: see `/tmp/opencode/peak-player-agent-handoff.md` sections 6 and Phase 3/4.

### Next-agent prompt

The copy-paste kickoff prompt is in `/tmp/opencode/peak-player-agent-handoff.md` §11 and `/tmp/opencode/peak-next-agent-prompt.md`. It tells the next agent to read this plan, create a worktree, implement P0/P1, and verify the gates.

---

## Goal

Two connected pieces of work in peak-backend:

1. **Progressive streaming API** — scrape all providers concurrently and push stream URLs to the embed/player as each provider responds (SSE), so playback starts on the first responder and falls back to later providers on failure. Subtitles delivered through the same concurrent flow. Keep existing `/api/v1/stream/:type/:id` for backward compat.

2. **IPTV live TV** — full M3U playlist ingestion, channel catalog, admin management (playlists, channels, groups, sync), and live channel streaming through the embed/player. Reuses peak-backend's proxy for HLS channels; embed/iframe channels render in the player.

## Scope

- `peak-backend` (this repo): new SSE endpoint + progressive scraping; SQLite-backed IPTV storage, M3U parser, sync service, admin + public APIs, embed/live_tv support.
- `stream-backend/player`: switch to EventSource consumption for movies/TV; add `/live/[id]` route for live TV channels.

## Part 1 — Progressive streaming API (SSE)

### New endpoint

`GET /api/v1/stream/events/:type/:id` (Server-Sent Events)

- Params: `type` = movie|tv|series|live_tv; `id` = numeric TMDB id (or `channel_<slug>_<hash6>` for live_tv).
- Query: `season`, `episode`, `source`/`provider` (optional), plus fingerprint params (`fpHash`, `ua`, `res`, `tz`, `lang`).
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
- SSE events:
  - `meta`: `{ title, year }`
  - `source`: `{ url, quality, codec, provider, adaptive, expiresIn }`
  - `subtitle`: `{ url, lang, label, provider }`
  - `diagnostic`: `{ provider, ok, latencyMs, error? }`
  - `done`: `{ meta: { providers, sources, subtitles, latencyMs, cacheHit }, diagnostics: [...] }`
  - `error`: `{ error, message }` (terminal)

### Backend changes (peak-backend)

1. **`utils/playerService.js`** — add `getPlayerStreamEvents({ type, id, season, episode, serverUrl, config, onEvent })`:
   - Run TMDB `getDetails`/`resolveImdbId` in parallel; emit `meta` when title/year resolve. For live_tv, resolve channel from IPTV store and emit `meta` from channel name/group.
   - Scrape providers concurrently; emit per-provider as each resolves (per-promise `.then`, not await-all-then-emit).
   - For each resolved provider: apply `applyFilters`, `processStreamsForProxy`, map to `playerSource`, emit `source` per stream; emit `subtitle` per unique subtitle via `collectSubtitles`; emit `diagnostic`.
   - Adaptive/HLS first within a provider's output; overall emission order by provider resolution time (fastest first).
   - Cache: if cached `AggregatedResult` exists, replay as burst then `done` (cacheHit true); otherwise cache final result 3600s.
   - Client disconnect (`req.on('close')`): set cancelled flag; skip writes. In-flight fetches continue.
2. **`apiServer.js`** — add route `GET /api/v1/stream/events/:type/:id` (SSE setup, validation, `res.flushHeaders()`, error → `error` event).
3. Keep `/api/v1/stream/:type/:id` unchanged (backward compat).

### Player changes (stream-backend/player)

1. **`src/lib/api.ts`** — add `fetchStreamEvents(...)` using native `EventSource`; wire callbacks; return cleanup.
2. **`src/components/Player.tsx`** — replace single `fetchStream` with `fetchStreamEvents`: accumulate sources/subtitles; first source plays immediately; 1500ms HLS fallback (if MP4 starts and HLS arrives within 1500ms, switch); fallback on playback failure; `meta` sets title; `done` finalizes or errors if none; cleanup on unmount.
3. **`src/lib/types.ts`** — no change (shapes compatible).
4. **Proxy passthrough** — `app/api/[...path]/route.ts`: forward `text/event-stream` + `X-Accel-Buffering`; flag Next.js buffering risk.

### Auto quality

- Backend tags adaptive/HLS sources (`adaptive: true`). Player uses existing ABR for HLS; MP4 ordered highest-quality-first then adaptive. Player defaults to auto mode.

## Part 2 — IPTV live TV

### Storage (SQLite via better-sqlite3)

Add dependency `better-sqlite3`. New module `utils/iptvStore.js` (mirror stream-backend's `services/iptv/store.ts`):

- `ensureIptvTables()` creates `iptv_playlists` and `iptv_channels` (schema per stream-backend).
- CRUD: `listPlaylists`, `getPlaylist`, `addPlaylist`, `removePlaylist`, `setPlaylistEnabled`, `updatePlaylistSync`, `replaceChannels`, `listChannels(filter)`, `getChannel(id)`, `setChannelEnabled`, `listGroups`.
- Channel id: `channel_<slug(name)>_<hash6(url)>` (stable, collision-safe). Reuse stream-backend's `encodeChannelId` logic or implement `utils/iptvId.js`.

DB file location: `utils/peak.db` (or `PEAK_DB_PATH` env). Add to `.gitignore`/`.dockerignore`.

### M3U parser

New module `utils/iptvParser.js` (mirror stream-backend `services/iptv/parser.ts`):

- Parse standard M3U/M3U8: `#EXTINF` lines with `tvg-id`, `tvg-name`, `tvg-logo`, `group-title`, `tvg-language`, `tvg-country`.
- Capture per-channel headers from `#EXTVLCOPT`/`#EXTHTTP` directives.
- Return array of `{ name, tvgId, groupTitle, logo, url, headers, language, country }`.
- Handle relative URLs (resolve against playlist base URL).

### Sync service

New module `utils/iptvSync.js`:

- `syncPlaylist(id)`: fetch playlist via safe HTTP (SSRF-guarded, timeout), parse, upsert channels via `replaceChannels`, update sync status/error.
- `startIptvScheduler()`: sync all enabled playlists on startup + every 6h (configurable via `IPTV_SYNC_INTERVAL_MS`).
- Manual trigger via admin API.

### Public API (peak-backend)

- `GET /api/v1/live/tv/channels?q=&group=&limit=&cursor=` → `{ channels: [{ id, name, group, logo, language, country }], nextCursor? }`.
- `GET /api/v1/live/tv/groups` → `{ groups: [{ id, title, count }] }`.

### Admin API (peak-backend, auth required via existing `requireAuth`)

- `GET /api/admin/iptv/playlists` → list playlists.
- `POST /api/admin/iptv/playlists` → `{ name, url }` add playlist.
- `DELETE /api/admin/iptv/playlists/:id` → remove.
- `POST /api/admin/iptv/playlists/:id/sync` → trigger sync.
- `PATCH /api/admin/iptv/playlists/:id` → `{ enabled }`.
- `GET /api/admin/iptv/channels?q=&group=&limit=` → list channels.
- `PATCH /api/admin/iptv/channels/:id` → `{ enabled }`.
- `GET /api/admin/iptv/groups` → list groups.

Mount admin routes behind `requireAuth` (reuse existing auth middleware).

### Embed + stream integration

1. **`utils/embed.js`** — extend `getEmbed` to accept `type: 'live_tv'` (or `live`), with `id` = channel id (string, not numeric). Return player URL `.../live/<channelId>`.
2. **`utils/playerService.js`** — for `type === 'live_tv'`, resolve channel from IPTV store:
   - If channel not found/disabled → error.
   - `isEmbed = !/\.m3u8/i.test(channel.url)`.
   - Source: `{ url: channel.url (or proxied if HLS), quality: 'auto', codec: isEmbed ? 'html5' : 'hls', adaptive: !isEmbed, provider: 'iptv', expiresIn: 3600 }`.
   - Subtitles: `[]`.
   - Diagnostics: `[{ provider: 'iptv', ok: true, latencyMs: 0 }]`.
   - Title: channel name; group as `group`.
   - For SSE endpoint: emit single `source` + `meta` + `done` (no progressive scraping needed for a single channel).
3. **`/api/v1/stream/:type/:id`** and **`/api/v1/stream/events/:type/:id`** — accept `live_tv` type with channel id.

### Admin portal UI (public/config.html + public/index.js)

Add an "IPTV" section to the admin portal:
- Playlist list with add (name+url), remove, enable toggle, manual sync button, last sync/error status.
- Channel list with search/group filter, enable toggle, logo/name/group.
- Group list with counts.
- Use existing card/secret-list patterns; reuse `request` helpers and toast system.

### Player changes (stream-backend/player)

1. **`src/lib/types.ts`** — add `'live_tv'` to `MediaType`; add optional `group`, `logo` to `Media`/`StreamResponse`.
2. **`src/lib/api.ts`** — `streamPath` handles `live_tv`: `/api/v1/stream/live_tv/${id}` (or events variant).
3. **New route** `src/app/live/[id]/page.tsx` → renders `<Player apiBase={...} media={{ type: 'live_tv', id }} />`.
4. **`src/components/Player.tsx`** — handle live_tv: no source fallback needed (single source), no subtitle menu; show channel name/logo in header. Reuse existing HLS/HTML5 playback paths.

### Auto quality / fallback for IPTV

- HLS channels: player uses auto ABR (existing).
- Embed channels: rendered in iframe (existing html5 path).
- No multi-provider fallback for a single channel (only one source). If it fails, show error + retry.

## Failure modes & edge cases

- Playlist fetch failure: store error on playlist, skip channel replacement, keep previous channels.
- Empty playlist: replaceChannels with empty array (removes old channels for that playlist).
- Duplicate channel ids across playlists: `replaceChannels` deletes per-playlist, so same channel id from two playlists → last sync wins (acceptable; matches stream-backend).
- SSRF: sync fetch must use safe HTTP (validate URL scheme/host, timeout).
- Client disconnect on SSE: cancelled flag.
- SQLite concurrency: better-sqlite3 is synchronous; fine for this scale.
- Large playlists: `listChannels` paginated via limit/cursor.

## Validation

- `npm run lint` in peak-backend.
- Manual SSE: curl `/api/v1/stream/events/movie/550`, confirm progressive events.
- IPTV: add a public M3U playlist via admin API, sync, list channels, play a channel via `/api/embed/live_tv/<id>` → player loads.
- Player: live_tv page renders and plays HLS channel; embed channel renders in iframe.

## Out of scope

- Removing legacy `/api/v1/stream`.
- Music streams.
- Auth on public stream endpoints (matches current open `/api/v1/stream`).
- Advanced M3U features (catchup, timeshift, EPG XMLTV).
- Multi-tenant / per-user playlists.
