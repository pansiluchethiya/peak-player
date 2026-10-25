# Plan: Progressive Streaming API (SSE) + IPTV Live TV for Peak

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
