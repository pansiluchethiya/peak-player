# Peak Player Platform — Design Spec

- **Date:** 2026-10-26
- **Status:** Approved for planning
- **Branch:** `feat/player-embed-platform`
- **Supersedes:** the Video.js 8 + hand-written hls.js player in `player/src/components/VideoJsPlayer.tsx`

---

## 1. Context

The embed player currently ships a hand-written Hls.js player wrapped in ~1,050 lines of bespoke React, with Video.js 8 bolted on as a second engine. It has four structural problems:

1. **The video never renders.** React owns a `<video>` element that Video.js takes ownership of and removes from the DOM on `dispose()`. Every source change (and the React StrictMode double-mount in dev) orphans the element, producing `VIDEOJS: WARN: The element supplied is not included in the DOM` and a permanently blank player.
2. **Two engines, two UIs.** Video.js 8 and the hand-written Hls.js path drift apart by construction. Video.js's VHS engine also cannot decode our proxied HLS (`readyState 0`, `duration` parsed, no frames), so the fallback is the only path that plays.
3. **No metadata.** `TMDB_API_KEY` is the placeholder `your_tmdb_api_key`, so TMDB returns 401. `utils/playerService.js` then falls back to the literal string `'Peak'` for every title — the player header reads "Peak", the tab reads `Peak — Peak`, and the stream payload carries no poster, overview, runtime or genres at all.
4. **No live catalogue.** `utils/iptvSync.js` and the SQLite channel tables exist, but zero playlists are configured, so `/api/v1/live/tv/channels` returns an empty list.

The goal is a player that is a superset of Video.js's own UI, driven by one engine, with real artwork and metadata for every title, a working IPTV catalogue, and a fully scriptable SDK.

## 2. Goals

- One media engine, one UI. No drift.
- A control surface that is a strict superset of the default Video.js skin.
- Real artwork and metadata for every movie, episode and live channel, with a fallback chain that cannot fail.
- A live TV catalogue that is populated, validated, EPG-backed and refreshed every 3 hours.
- Every control scriptable through the embed SDK, documented exhaustively.
- No regressions in the existing AMOLED monochrome theme (`#000000` canvas, `#333333`/`#e5e5e5` accent, Geist Sans + Mono).

## 3. Non-goals

- Building the standalone frontend site. It is referenced only as a future consumer of the same preference model.
- Server-side rendering of video.
- DRM (Widevine/PlayReady/FairPlay).
- Multi-tenant billing or partner self-service signup.

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Replace `video.js@8` and the hand-written hls.js path with **`@videojs/react` v10.2.0** + its `hls` adapter | One engine. Identical UI by construction. Removes the DOM-ownership bug class. |
| D2 | Vendor the **editable Shadcn skin source** into `player/src/components/player/` | The packaged skin cannot be extended with the controls we need, and a custom mica caption renderer requires owning the DOM. |
| D3 | **Mux Data** via `NEXT_PUBLIC_MUX_DATA_ENV_KEY` / `MUX_DATA_ENV_KEY`, silently inert when unset | Analytics must never produce console noise or failed requests on self-hosted installs. |
| D4 | **Thumbnails** from `#EXT-X-IMAGE-STREAM-INF` / `#EXT-X-TILES`, falling back to cached server-side ffmpeg sprites | Use what the manifest already gives us; generate only when it doesn't. |
| D5 | **Custom WebVTT caption renderer** with mica material; native cue rendering disabled | Full control of typography, position, per-partner theming. |
| D6 | **Full control superset** (see §6) | Explicit user requirement. |
| D7 | **Colour correction** via CSS filters by default, optional WebGL pipeline off by default | CSS filters are free and break nothing; WebGL breaks native PiP and costs GPU. |
| D8 | **Server switcher** uses codenames only, with a real `?source=` re-resolution | Never leak the provider list to partners or viewers. |
| D9 | **Volume boost** 0–300 %, with 500 % behind an unlock, amber above 300 %, headphone warning | 500 % is +14 dB. The limiter prevents clipping, not hearing damage. |
| D10 | **Metadata** resolves TMDB → Wikidata + Wikipedia → TVMaze → generated | TMDB needs a key we do not have; the keyless chain is verified working. |
| D11 | **Artwork** always resolves, ending in a pure-DOM typographic card | "It must always get the art, no matter what." |
| D12 | **IPTV** auto-seeds from the iptv-org public API, operators may add or disable | Zero-setup live TV with full metadata. |
| D13 | **3-hour sync** (down from 6) for streams, playlists and guides | Discover new URLs promptly. |
| D14 | **Dead channels hidden** from the player, visible with health in admin | "Every working channel" implies validation. |
| D15 | **Full EPG**: now/next plus a schedule panel | "Every metadata from it." |
| D16 | **Preferences** have three modes — `browser`, `server`, `user` — chosen by the partner/deployer | The deployer picks, or delegates the choice to the viewer. |
| D17 | **Autoplay** muted + tap-to-unmute, toggleable by provider (admin) and viewer (player settings) | Browsers block audible autoplay; muted autoplay guarantees the player starts. |
| D18 | **i18n**: English only, but every string in one typed catalogue, RTL-safe layout | Adding a locale later is a data change, not a refactor. |
| D19 | **SDK v2**: full parity, versioned, documented exhaustively | Existing v1 integrations keep working. |

## 5. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ player (Next.js, :3011)                                         │
│                                                                 │
│  app/embed/{movie,tv,live}/…   app/{movie,tv,live}/…            │
│         └──────────────┬──────────────┘                         │
│                 <PlayerRoot preset="video|live-video|bg">       │
│                        │                                        │
│   ┌────────────────────┴─────────────────────┐                  │
│   │ components/player/  (vendored skin)      │                  │
│   │  PlayerProvider  ·  VideoSkin            │                  │
│   │  ControlBar  ·  Menus  ·  Captions       │                  │
│   │  PosterOverlay  ·  Breadcrumb  ·  Stats  │                  │
│   └────────────────────┬─────────────────────┘                  │
│                        │                                        │
│   @videojs/react  ── hls adapter ── <video>                     │
│                        │                                        │
│   audio/  VolumeBoost (WebAudio)                                │
│   color/  CssFilters | WebGlPipeline                            │
│   prefs/  PreferenceStore (browser|server|user)                 │
└────────────────────────┬────────────────────────────────────────┘
                         │ fetch /api/v1/*
┌────────────────────────┴────────────────────────────────────────┐
│ api (:8787)                                                     │
│  /api/v1/media/:type/:id      metadata + artwork candidates     │
│  /api/v1/stream/:type/:id     streams (existing, + media)       │
│  /api/v1/live/tv/channels     validated channels (existing)     │
│  /api/v1/live/tv/epg/:id      now/next + schedule               │
│  /api/v1/branding             (existing)                        │
│                                                                 │
│  utils/mediaResolver.js       TMDB→Wikidata→Wikipedia→TVMaze    │
│  utils/artworkResolver.js     8-step fallback chain             │
│  utils/iptvSeed.js            iptv-org catalogue seeding        │
│  utils/iptvSync.js            (exists) 3-hour sync              │
│  utils/iptvValidate.js        stream health probes              │
│  utils/iptvEpg.js             XMLTV ingest + now/next           │
└─────────────────────────────────────────────────────────────────┘
```

### 5.1 Package changes

Remove: `video.js@^8.24.2`, and the `@import "video.js/dist/video-js.css"` in `player/src/app/globals.css`.

Add: `@videojs/react@10.2.0`.

Keep: `hls.js` only if `@videojs/react`'s `hls` adapter requires it as a peer (verify at install; if it is bundled, drop it).

### 5.2 File layout

```
player/src/
  components/
    player/
      index.ts
      PlayerRoot.tsx           preset switch, layout shell
      PlayerProvider.tsx       state, context, event bus
      VideoSkin.tsx            vendored skin layout
      controls/
        ControlBar.tsx
        PlayButton.tsx  SeekButton.tsx  Scrubber.tsx  VolumeControl.tsx
        TimeDisplay.tsx  SettingsMenu.tsx  FullscreenButton.tsx  PipButton.tsx
        CastButton.tsx  LiveButton.tsx  EpisodeNav.tsx  Breadcrumb.tsx
      menus/
        MenuRoot.tsx  QualityMenu.tsx  SpeedMenu.tsx  CaptionsMenu.tsx
        AudioMenu.tsx  ServerMenu.tsx  ColourMenu.tsx  ChaptersMenu.tsx
        AspectMenu.tsx  ShortcutsMenu.tsx
      overlays/
        PosterOverlay.tsx  CaptionsOverlay.tsx  StatsOverlay.tsx
        SchedulePanel.tsx  ShortcutsHelp.tsx  UpNextOverlay.tsx
      media/
        useMediaEngine.ts        @videojs/react binding
        useThumbnails.ts
      audio/
        VolumeBoost.ts           WebAudio graph
      colour/
        presets.ts  CssFilterPipeline.ts  WebGlPipeline.ts
      prefs/
        PreferenceStore.ts  schema.ts  modes.ts
      i18n/
        messages.en.ts  index.ts
      artwork/
        ArtworkChain.tsx  TypographicCard.tsx
  lib/
    media.ts        typed client for /api/v1/media
    live.ts         typed client for live channels + EPG
    embedBridge.ts  postMessage SDK v2
```

`player/src/components/VideoJsPlayer.tsx` is deleted.

## 6. Player UI

### 6.1 Layers

1. **Ambient background** — blurred artwork, black stage, accent-aware.
2. **Breadcrumb** (top-right) — `Home › Movies › Fight Club`. Clickable in the standalone player; plain text inside the embed.
3. **Header** — title, year, runtime, quality chip.
4. **Poster overlay** — one component, two roles:
   - **Pre-play poster:** shown before the first play.
   - **Paused poster:** shown 800 ms after pause, translucent so the video stays visible behind it, with poster + short description.
5. **Video surface.**
6. **Mica captions overlay.**
7. **Control bar** and menus.
8. **Overlays:** stats, shortcuts help, schedule.

### 6.2 Controls

| Group | Controls |
|---|---|
| Transport | play/pause, seek −10 s / +10 s, scrubber with thumbnail preview, volume, mute, boost |
| Menus | quality (Auto + levels with resolution and bitrate), audio track, speed 0.25–2×, captions (language, size, opacity, edge style, mica on/off), chapters, server switcher, colour preset, aspect (fit/fill/zoom), theatre |
| Episode | previous, next, up-next countdown, autoplay-next toggle |
| Live | LIVE badge with latency, go-to-live, DVR-window scrubber, behind-live indicator, schedule panel |
| Utilities | PiP, fullscreen, cast, share timestamp, copy embed link, snapshot PNG, stats-for-nerds, keyboard-shortcuts help |
| Navigation | breadcrumb |

Every control is keyboard reachable, has an accessible name, and appears in the shortcuts overlay.

### 6.3 Mica captions

- Parse WebVTT ourselves; render cue text into a DOM overlay.
- Visual: `backdrop-filter: blur(18px) saturate(140%)`, layered translucent background (`rgb(0 0 0 / 55%)` over `rgb(255 255 255 / 6%)`), 1 px inner highlight, 12 px radius.
- Native cue rendering disabled so the browser never double-renders.
- Settings persist per §9: size, opacity, edge style, mica on/off.

### 6.4 Colour correction

- **CSS mode (default):** `filter: brightness() contrast() saturate() hue-rotate()`. Presets Cinema, Vivid, Warm, Cool, Night, plus reset. Persisted.
- **WebGL mode (opt-in):** gamma, white balance, sharpening, LUTs. Menu label states that it disables native PiP and increases GPU load. Never enabled automatically.

### 6.5 Volume boost

```
MediaElementSource → GainNode(boost) → DynamicsCompressor(threshold -3dB,
  knee 6, ratio 12, attack 3ms, release 250ms) → destination
```

- Range 0–300 % by default.
- **Unlock 500 %** toggle extends to 500 %, shows a headphone warning, and colours the value amber above 300 %.
- The compressor is a safety limiter, not a loudness normaliser.
- Boost state is a preference and is scriptable via SDK v2.

### 6.6 Server switcher

Codenames only:

| Provider | Codename |
|---|---|
| netmirror | NOVA |
| vixsrc | VESPER |
| vidlink | ORION |
| videasy | LYRA |
| zxcstreams | KESTREL |
| vaplayer | HALCYON |
| showbox | MERIDIAN |
| 4khdhub | ATLAS |
| castletv | CITADEL |
| dahmermovies | DUNE |
| hdghartv | HELIOS |
| onetouchtv | ONYX |
| streamflix | NOCTIS |

Selecting one re-resolves via the existing `?source=<provider>` parameter on `/api/v1/stream/:type/:id`. Each row shows a subtle status line (latency · quality). Provider names never appear in the UI or in events.

## 7. Metadata and artwork service

### 7.1 Why

`TMDB_API_KEY` is the placeholder `your_tmdb_api_key`; TMDB returns 401. `utils/playerService.js` lines 303–306 fall back to the literal `'Peak'`, so every title is "Peak" and the payload has no artwork.

### 7.2 Endpoint

`GET /api/v1/media/:type/:id?season=&episode=`

```json
{
  "success": true,
  "media": {
    "id": "550",
    "type": "movie",
    "title": "Fight Club",
    "year": 1999,
    "overview": "A ticking-time-bomb insomniac and a slippery soap salesman…",
    "tagline": null,
    "runtime": 139,
    "genres": ["Drama", "Thriller"],
    "rating": 8.4,
    "poster": { "candidates": ["…", "…"] },
    "backdrop": "…",
    "stills": ["…"],
    "source": "wikipedia"
  }
}
```

- In-memory cache, 6 h TTL, keyed `type:id:season:episode`.
- Negative results cached 15 min.
- All upstream calls are server-side; no keys or CORS in the browser.

### 7.3 Resolver order

1. **TMDB** — only if `getTmdbApiKey()` returns a real key. Uses `utils/tmdb.js` unchanged.
2. **Wikidata SPARQL** — no key, no auth, requires a `User-Agent` header.
   - Movie TMDB id → property **P4947**.
   - TV TMDB id → property **P4983**.
   - Returns item label, **P345** (IMDb id), **P18** (image), and the enwiki article via `schema:about` + `schema:isPartOf <https://en.wikipedia.org/>`.
3. **Wikipedia REST summary** — `https://en.wikipedia.org/api/rest_v1/page/summary/<Article>` with a `User-Agent`.
   - Returns `title`, `description` (carries year and type), `extract`, `thumbnail.source`, `originalimage.source`.
   - Verified: movies return the actual theatrical poster (`Fight_Club_poster.jpg`); TV series return a logo.
4. **TVMaze** (TV only) — `https://api.tvmaze.com/lookup/shows?imdb=<tt-id>` → show id → `/shows/:id/episodesbynumber?season=&number=` → `image.original` episode still + `summary`.
5. **Generated** — typographic card.

Year is parsed from the Wikipedia `description` ("1999 American film by David Fincher") when no structured date exists.

### 7.4 Artwork fallback chain

First candidate that loads wins; 404, decode error or a 4 s timeout advances to the next.

1. Partner override (embed token / query).
2. TMDB `poster_path`.
3. TMDB `backdrop_path`.
4. TMDB episode `still_path` (TV).
5. Series poster (TV).
6. Provider artwork (if a scraper payload carries one).
7. **Generated typographic card** — title + year + type on a hash-derived gradient, pure DOM, zero network, cannot fail.
8. Bundled `/poster-fallback.svg`.

Resolved URLs cached in `sessionStorage` per title. `<img onError>` walks the chain.

### 7.5 Stream payload change

`utils/playerService.js` stops inventing `'Peak'`:

- Resolve media via §7.2 before composing the payload.
- `title` becomes `media.title`; `year` becomes `media.year`.
- The payload gains `media: { title, year, overview, tagline, runtime, genres, rating, poster, backdrop }`.
- The 15-minute aggregate cache stores the media object alongside streams so failover does not re-resolve metadata.

## 8. IPTV and EPG

### 8.1 Existing foundation

- `utils/iptvStore.js` — SQLite tables for playlists and channels; `replaceChannels`, `listChannels`, `listGroups`, `getChannel`, `setChannelEnabled`.
- `utils/iptvSync.js` — fetches and parses M3U, replaces channels, scheduler with `IPTV_SYNC_INTERVAL_MS`.
- `utils/iptvParser.js` — parses `tvg-id`, `group-title`, `tvg-logo`, language, country, headers.
- `utils/iptvId.js` — stable channel ids.
- `utils/safeHttp.js` — `readText` with SSRF guard and size limits.

### 8.2 Seeding

On first boot, if the seed is enabled and no seed playlist exists:

- Fetch the iptv-org public API: `streams.json`, `channels.json`, `categories.json`, `countries.json`, `languages.json`, `guides.json`, `logos.json`.
- Build channels with name, logo, category (group), country, language, network, `tvg-id`, and stream URL.
- Sports channels are always included; all other categories are included by default.

Config:

| Env | Default | Meaning |
|---|---|---|
| `IPTV_SEED_ENABLED` | `true` | Seed from iptv-org on first boot |
| `IPTV_SEED_CATEGORIES` | `*` | Comma list, e.g. `sports,news,movies` |
| `IPTV_SEED_COUNTRIES` | `*` | Comma list of ISO codes |
| `IPTV_SYNC_INTERVAL_MS` | `10800000` (3 h) | Sync cadence |
| `IPTV_VALIDATE_CONCURRENCY` | `8` | Probe parallelism |
| `IPTV_VALIDATE_TIMEOUT_MS` | `6000` | Per-stream probe timeout |

Operators can add their own playlists in the admin portal; seed playlists are marked `seeded` and can be disabled or removed.

### 8.3 Sync

Every **3 hours**:

1. Re-fetch every enabled playlist and the seed catalogue.
2. Parse and upsert channels, preserving per-channel enabled state and health history.
3. Fetch XMLTV guides for channels that declare a guide URL.
4. Re-validate streams whose status is `unknown` or whose last check is older than 24 h.
5. Record `lastSyncAt`, `channelCount`, `error` per playlist.

Sync is idempotent and resumable; a failed playlist never blocks the others.

### 8.4 Validation

- Probe with a bounded concurrency pool (`IPTV_VALIDATE_CONCURRENCY`), short timeout, `Range: bytes=0-1` where supported.
- Persist `status` (`ok` | `dead` | `unknown`), `httpStatus`, `latencyMs`, `checkedAt`.
- **Player lists only `status = 'ok'`.**
- **Admin shows all channels** with a health column, latency, and last-checked time.
- Failures retry with exponential backoff up to 24 h.

### 8.5 EPG

- Ingest XMLTV, store programmes in SQLite (`channelId`, `start`, `stop`, `title`, `description`, `category`).
- `GET /api/v1/live/tv/epg/:id` returns `{ now, next, schedule[] }`.
- Player: now/next in the LIVE area, full schedule in a scrollable panel.
- Guides refresh on the same 3-hour cadence, with a 7-day retention window.

### 8.6 Admin

`/iptv` gains:

- Seed status (enabled, categories, countries, last sync).
- Playlist table: name, URL, enabled, channel count, last sync, error.
- Add / remove / enable / disable playlist.
- **Sync now** button.
- Channel table with group, country, language, health, latency, last checked, enable toggle.
- Seed toggles and category/country filters.

## 9. Preferences

### 9.1 Modes

| Mode | Behaviour |
|---|---|
| `browser` (default) | localStorage per browser. No server state. |
| `server` | Synced across sites for that deployment. Requires a viewer identity and a storage endpoint. |
| `user` | The viewer chooses in the player's settings panel; implies consent by the switch. |

The partner/deployer selects the mode:

- Globally via `PLAYER_PREFERENCE_MODE`.
- Per integration via the embed token field `prefsMode`.
- `user` exposes a **"Sync my settings across sites"** switch.

Nothing is stored server-side unless `server` is configured or the viewer opts in under `user`.

### 9.2 Schema

```ts
interface PlayerPreferences {
  volume: number;            // 0..1
  muted: boolean;
  boost: number;             // 0..5 (0..3 normal, up to 5 unlocked)
  boostUnlocked: boolean;
  speed: number;             // 0.25..2
  quality: 'auto' | string;  // level id
  audioTrack: string | null;
  captions: {
    enabled: boolean;
    language: string | null;
    size: 'sm' | 'md' | 'lg' | 'xl';
    opacity: number;         // 0..1
    edge: 'none' | 'shadow' | 'outline' | 'background';
    mica: boolean;
  };
  colourPreset: string;
  aspect: 'fit' | 'fill' | 'zoom';
  autoplayNext: boolean;
  autoplay: boolean;
  locale: string;
}
```

Versioned (`v: 1`) with a migration function; unknown keys are dropped, missing keys take defaults.

### 9.3 Precedence

`provider default (admin) < partner token override < user preference`

The provider default is always a default, never a lock, unless the partner token sets `locked: true` for a key.

## 10. Autoplay

- Default: **muted autoplay**, with a small **"Tap to unmute"** affordance; unmute on the first interaction.
- Provider toggle in the admin portal (`autoplay`, `autoplayMuted`).
- Viewer toggle in the player settings, persisted per §9.
- The future frontend site reuses the same preference model and admin defaults.

## 11. Internationalization

- English only in this build.
- Every user-facing string lives in `player/src/components/player/i18n/messages.en.ts` as a typed catalogue.
- No literal strings in components.
- Dates, numbers, relative times and durations use `Intl.*` with the active locale.
- Layout is RTL-safe: logical CSS properties (`margin-inline-start`, `inset-inline`), no hard-coded `left`/`right`.
- Adding a locale = adding `messages.<locale>.ts` and a menu entry.

## 12. Embed SDK v2

### 12.1 Versioning

- `PeakEmbed.v2` namespace; v1 methods keep their existing semantics at `PeakEmbed.*` for backward compatibility.
- v2 adds full parity; v1 continues to expose transport controls only.
- `peak-embed.js` advertises `PeakEmbed.version = 2`.

### 12.2 Surface

```ts
interface PeakEmbedV2 extends PeakEmbedInstance {
  // transport
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  seekBy(delta: number): Promise<void>;
  setVolume(value: number): Promise<void>;      // 0..1
  setMuted(muted: boolean): Promise<void>;
  setBoost(value: number): Promise<void>;       // 0..5
  unlockBoost(unlocked: boolean): Promise<void>;
  setSpeed(value: number): Promise<void>;

  // presentation
  setQuality(level: 'auto' | string): Promise<void>;
  setAudioTrack(id: string): Promise<void>;
  setCaptions(options: Partial<CaptionOptions>): Promise<void>;
  setColourPreset(preset: string): Promise<void>;
  setAspect(mode: 'fit' | 'fill' | 'zoom'): Promise<void>;

  // navigation
  switchServer(codename: string): Promise<void>;
  nextEpisode(): Promise<void>;
  previousEpisode(): Promise<void>;
  goToLive(): Promise<void>;

  // utility
  requestFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
  requestPictureInPicture(): Promise<void>;
  snapshot(): Promise<string>;                  // data URL
  getShareLink(): Promise<string>;
  copyEmbedLink(): Promise<void>;

  // state
  getState(): Promise<PlayerState>;
  getPreferences(): Promise<PlayerPreferences>;
  setPreferences(patch: Partial<PlayerPreferences>): Promise<PlayerPreferences>;
}
```

### 12.3 Events

`ready`, `play`, `pause`, `ended`, `timeupdate`, `durationchange`, `volumechange`, `ratechange`, `qualitychange`, `audiotrackchange`, `captionchange`, `serverchange`, `episodechange`, `livechange`, `fullscreenchange`, `pipchange`, `preferencechange`, `error`.

Every event carries `{ type, version: 2, timestamp, ...payload }`.

### 12.4 Error codes

`NOT_READY`, `UNSUPPORTED`, `INVALID_ARGUMENT`, `STREAM_UNAVAILABLE`, `TOKEN_EXPIRED`, `ORIGIN_NOT_ALLOWED`, `PERMISSION_DENIED`, `UNKNOWN`.

### 12.5 Docs — exhaustive, no omissions

Required in `docs/content/docs/` (existing files are extended, not replaced):

| File | Status | Content |
|---|---|---|
| `reference/sdk.mdx` | extend | every method, signature, parameter, return, rejection, example |
| `reference/postmessage.mdx` | extend | every message name, direction, payload shape, example |
| `reference/events.mdx` | new | every event and payload |
| `reference/errors.mdx` | new | every error code, cause, remedy |
| `guides/embedding.mdx` | new | end-to-end integration walkthrough |
| `guides/migrating-to-sdk-v2.mdx` | new | v1 → v2 mapping table |
| `guides/player-controls.mdx` | new | every UI control and its SDK equivalent |
| `guides/live-tv.mdx` | extend | channel catalogue, EPG, live controls |
| `guides/preferences.mdx` | new | the three modes, precedence, consent |

`docs/content/docs/reference/meta.json` and `docs/content/docs/guides/meta.json` gain the new pages in the correct nav position.

A docs test asserts every exported SDK method and every event name appears in the reference pages, so the docs cannot silently drift.

## 13. Bug fixes folded into this work

| Bug | Fix |
|---|---|
| Video never renders (React-owned `<video>` disposed by Video.js) | §5 — engine owns its element |
| Every title is `Peak`; tab reads `Peak — Peak` | §7 — real metadata; title template de-duplicated |
| `/movie/999999` never leaves "Preparing stream…" | explicit terminal error state after source exhaustion |
| Player home "Your frame." invisible in light mode | token-driven heading colour |
| `/tv/...` SSE 404 on `/api/v1/stream/events/tv/...` | register the tv events route |
| `.error-card p` at 7 % opacity | raise to a readable muted foreground |
| Legacy static admin at `:8787/` light-mode contrast | scope the dark-panel accent override |
| Next.js dev badge on player pages | `devIndicators: false` |
| Admin `/login` cold-compile hydration warning | align server/client theme bootstrap |

## 14. Error handling

- **No sources** → `STREAM_UNAVAILABLE` card with retry and server switcher.
- **All servers exhausted** → terminal error state, never an infinite spinner.
- **Metadata failure** → typographic card; playback unaffected.
- **EPG failure** → schedule panel shows "Guide unavailable"; live playback unaffected.
- **Preference storage failure** (quota, privacy mode) → fall back to in-memory, log once, never throw.
- **Mux unset** → adapter is not constructed; zero console output.
- **Thumbnails unavailable** → scrubber shows time only.

## 15. Testing

### 15.1 Unit
- Media resolver: TMDB hit, Wikidata→Wikipedia hit, TVMaze hit, total failure.
- Artwork chain: each fallback step, 4 s timeout, decode error.
- IPTV parser: tvg-id, logo, group, language, country, headers, malformed lines.
- Validator: ok/dead/timeout, concurrency bound, backoff.
- EPG parser: now/next boundary, schedule ordering.
- Preferences: schema validation, migration, precedence, all three modes.
- Captions: WebVTT parse, cue timing, overlap.
- Volume boost: gain math, limiter clamp, 300/500 boundary.

### 15.2 Integration
- `/api/v1/media/:type/:id` for a movie, a TV episode, and an unknown id.
- `/api/v1/live/tv/channels` returns only `status='ok'`.
- Sync is idempotent across two runs.
- SDK v2 round-trip for every method and event.

### 15.3 Visual (Playwright)
- Every route in both themes, 1440 px and 390 px.
- Embed demo end-to-end: session minted, iframe mounts, video plays, events observed.
- Live preset against a **synthetic HLS live playlist** generated locally.
- Poster overlay, mica captions, stats overlay, shortcuts overlay, schedule panel.

### 15.4 Docs
- Link check.
- SDK coverage test from §12.5.

### 15.5 RAM guard
The user's machine hit 99 % RAM and 100 % swap. Therefore:
- Never run more than two dev servers concurrently.
- No concurrent builds.
- Playwright runs serially, one browser, one context at a time.
- Servers start detached: `setsid nohup <cmd> > /tmp/opencode/<name>.log 2>&1 < /dev/null &`.

## 16. Phases

| Phase | Deliverable | Exit criteria |
|---|---|---|
| **P1 — Engine + skin** | `@videojs/react` replaces Video.js 8 and the hand-written hls.js path; vendored skin; video renders | `/embed/movie/550` plays; zero console warnings; UI identical across movies, TV and live |
| **P2 — Metadata + artwork** | Media resolver, artwork chain, payload change | Header and tab show the real title; poster renders for movie, episode and unknown id |
| **P3 — IPTV + EPG** | Seed, 3 h sync, validator, guides, admin | Live list populated with working channels; now/next and schedule render |
| **P4 — Controls, prefs, SDK, docs** | Full control superset, boost, colour, prefs modes, SDK v2, exhaustive docs | Every control works and is scriptable; docs coverage test passes |

Each phase ends with `npm run check` green and a visual sweep of every route.

## 17. Removals

- `player/src/components/VideoJsPlayer.tsx` — deleted.
- `video.js` dependency and `video.js/dist/video-js.css` import — removed.
- Hand-written hls.js player path — removed.
- `player/src/components/ProgressBar.tsx`, `ThumbnailPreview.tsx` — superseded by the vendored skin's scrubber (verify nothing else imports them first).
- Literal `'Peak'` title fallback in `utils/playerService.js` — removed.
- Hard-coded green `PLAYER_ACCENT` — already replaced with `#e5e5e5`.

## 18. Risks

| Risk | Mitigation |
|---|---|
| `@videojs/react` v10 API churn | Pin `10.2.0`; vendored skin isolates us from skin changes |
| iptv-org rate limits or downtime | Cache aggressively; seed is optional; operator playlists still work |
| Validating thousands of streams is slow and network-heavy | Bounded concurrency, 24 h re-check window, resumable batches |
| WebGL pipeline breaks PiP | Off by default, explicitly labelled |
| Server-side preferences add privacy surface | Opt-in only; nothing stored unless chosen |
| Vendored skin becomes a fork | Keep a documented diff list and re-vendor on upgrades |

## 19. Open questions

None. All decisions are recorded in §4.
