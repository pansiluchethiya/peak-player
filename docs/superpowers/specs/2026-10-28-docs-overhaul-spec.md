# Peak Docs & Platform Overhaul — Specification

**Date:** 2026-10-28  
**Author:** Peak platform  
**Status:** Approved (user decisions captured)  
**Session:** Start a new session with the handoff prompt at `docs/superpowers/2026-10-28-session-handoff-prompt.md`

---

## 1. Problem Statement

The Peak player platform has evolved rapidly. The Rive Stream provider integration is complete and committed
(commit `0ef607d6` on `main`), but the **documentation, landing page, admin UI, SEO, and codename scheme** are now
out of sync with the code. This spec defines a coordinated overhaul so that:

1. Every feature in the codebase is documented with concrete code snippets.
2. Self-hosting is trivial with a GitHub URL + Docker reference.
3. The landing page (player:3011) and admin UI have production-quality styling.
4. Full SEO coverage (social meta tags, JSON-LD) exists for docs, player, and admin.
5. AI agents can navigate the codebase via `llms.txt`, `docs/llms-full.txt`, and a standalone MCP server.
6. The admin UI gains token management, proxy management, and feature toggles.
7. Rive provider codenames are renamed to avoid referencing "Rive."

## 2. Scope

### In Scope

| Domain | Details |
|--------|---------|
| **Codenames** | Change provider codenames from `RIVE/RIVE V/RIVE P/RIVE DUB` to `PRIME/STELLAR/NEXUS/ORBIT`. Update `player/src/lib/servers.ts`, `providers/rive.js`, and all tests. |
| **Docs overhaul** | Expand all docs pages to cover new features (Rive providers, scrubber thumbnails, HLS subtitles, dubs, colour filters, IPTV, admin features). Add detailed code snippets. |
| **Self-hosting guide** | Rewrite `docs/content/docs/self-hosting.mdx` with GitHub URL `https://github.com/pansiluchethiya/peak-player`, Docker instructions, per-service `.env` files, both npm and pnpm. |
| **Landing page** | Overhaul `player/src/app/page.tsx` styling. MagicUI cards, marketing layout, live demo iframe, TMDB/trending images. Full code formatting + color theme. |
| **Admin UI** | Big-bang rewrite with Fumadocs-ui + shadcn/ui. Full styling overhaul. Add token management, proxy management, feature toggles. |
| **Env variable** | `PEAK_DOCS_URL` — tells the UI where to find docs (for link redirection). |
| **SEO** | Full metadata for docs, player, admin pages. OpenGraph + Twitter Cards + JSON-LD. Subdomain structure: `docs.peak-player.com`, `admin.peak-player.com`, `app.peak-player.com`. |
| **llms.txt** | `llms.txt` at repo root + `docs/llms-full.txt` (concatenated AI docs). |
| **MCP server** | Standalone TypeScript project in `mcp/`. File-reading + docs search tools. stdio transport only. Full repository read access. |
| **AI docs** | Mirror human docs at `docs/content/docs/ai/`. AI-optimized: direct, code-heavy, less prose. |
| **Admin features** | Token management (create/list/revoke/analytics), proxy management (create/list/revoke/health), feature toggles (15 features), IPTV toggles. |
| **Session handoff** | Full prompt at `docs/superpowers/2026-10-28-session-handoff-prompt.md` referencing this spec + plan + tasks. |
| **Tests** | Update existing tests for codename changes. Add new tests for admin feature-toggle DB, token management API, proxy management API. |
| **Gates** | Run full gate suite after implementation. |

### Out of Scope

- Changes to the core streaming/proxy logic (already complete and tested).
- New provider integration beyond the 4 Rive sub-providers.
- Changes to the embed token format or proxy URL signing scheme (already designed and tested).
- The `ui/` directory (shared ui layer) — styling only, no structural changes unless needed for admin rewrite.
- Production deployment of subdomains (DNS/TLS is environment-specific).

## 3. Codename Mapping

The codenames visible to partners and viewers must NOT reference "Rive" or "RIVE."

| Provider (technical key) | Current display name | New display name | Color hint |
|---|---|---|---|
| `rive apogee` | `RIVE` | `PRIME` | primary accent |
| `rive vanguard` | `RIVE V` | `STELLAR` | 4K badge |
| `rive pulse` | `RIVE P` | `NEXUS` | fallback badge |
| `rive citadel` | `RIVE DUB` | `ORBIT` | dub badge |

### Implementation locations

- `player/src/lib/servers.ts` — `SERVER_CODENAMES` map values
- `providers/rive.js` — `PROVIDERS` array `provider` field (e.g., `provider: 'Peak Prime'`)
- `tests/servers.test.ts` — codename assertions
- `tests/riveProvider.test.js` — provider mapping assertions

The **technical keys** (`rive apogee`, etc.) remain internal identifiers used in `PREFERRED_ORDER` and API
query parameters. Only the **display codenames** change.

## 4. Environment Variables

### Existing (unchanged)

All existing env vars from `.env.example` remain unchanged.

### New

| Variable | Required | Default | Description |
|---|---|---|---|
| `PEAK_DOCS_URL` | No | `https://docs.peak-player.com` | Documentation URL for redirecting "Learn more" links in the player and admin UI. |
| `NEXT_PUBLIC_DOCS_URL` | No | from `PEAK_DOCS_URL` | Build-time version of `PEAK_DOCS_URL` for the player client bundle. |

> `NEXT_PUBLIC_DOCS_URL` must be set at build time (it's compiled into the JS bundle). If only `PEAK_DOCS_URL` is set, the player defaults to a runtime fetch of `/api/docs-url`.

### Admin feature-toggle DB schema

A new SQLite database (or table in `utils/peak.db`) stores feature toggles and admin settings.

```sql
CREATE TABLE IF NOT EXISTS peak_config (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

Keys:
- `feature_toggles` → `{ "embed_demo": true, "token_auth": true, ... }`
- `iptv_categories` → `{ "sports": true, "news": true, ... }`
- `tokens` → array of token definitions (see §7)
- `proxies` → array of proxy definitions (see §8)

API endpoint: `GET/POST /api/admin/config` (behind admin auth).

## 5. Admin UI Feature List

The admin UI gets a **big-bang rewrite** using Fumadocs-ui + shadcn/ui with an AMOLED monochrome theme.

### 15 Feature Toggles

Each toggle has a dedicated admin page under `/admin/features/<slug>`:

1. **Embed Demo** — Enables the `/embed/demo` page that mints demo sessions.
2. **Token Auth** — Enables HMAC-SHA256 embed token verification on the player side.
3. **Dubs** — Enables the DubsMenu for language-specific renditions (Citadel/Hindi, etc.).
4. **Captions** — Enables subtitle track loading and rendering.
5. **Color Filters** — Enables the CSS filter pipeline and WebGL colour pipeline.
6. **Scrubber Thumbnails** — Enables remote VTT sprite previews on hover.
7. **Audio Boost** — Enables the VolumeBoost gain node (up to 200%).
8. **Keyboard Shortcuts** — Enables keyboard navigation and hotkeys.
9. **Stats Overlay** — Enables the `StatsOverlay` component (bitrate, latency).
10. **Chapters** — Enables chapter markers and the ChaptersMenu.
11. **Quality Selection** — Enables the QualityMenu for manual ABR cap selection.
12. **Playback Speed** — Enables the SpeedMenu (0.25x–2x).
13. **PiP** — Enables Picture-in-Picture mode.
14. **Mux Analytics** — Enables Mux data analytics tracking.
15. **Server Switching** — Enables the ServerMenu for manual provider switching.

### Token Management

- **Create**: Form with fields: Name, Expiry (60s–24h), Allowed Origins (multi-select exact origins), Read-only flag.
- **List**: Table showing token name, partner, expiry, status (active/expired), last used.
- **Revoke**: Delete button on each row.
- **Analytics**: Bar chart of token usage over time (sessions minted, requests served).

### Proxy Management

- **Create**: Form for defining a new proxy endpoint (name, upstream URL, headers, CORS origins).
- **List**: Table showing proxy name, upstream, health status, latency.
- **Revoke**: Delete button.
- **Health Dashboard**: Live provider health scores with latency and error count.

### IPTV Toggles

- Master toggle: "Enable all IPTV categories" (boolean).
- Per-category toggles derived from seeded groups (Sports, News, Movies, Kids, etc.).
- Each toggle maps to a row in `peak_config` with key `iptv_category_<slug>`.

## 6. SEO & Metadata

### Player (`player/`)

- `player/src/app/layout.tsx` — Add full `Metadata` (title, description, openGraph, twitter, alternates, robots).
- Dynamic metadata for `/movie/:id`, `/tv/:id/:season/:episode`, `/live/:id` pages using TMDB metadata.
- `player/src/app/embed/[...]/page.tsx` — minimal metadata (noindexing embed frames).

### Docs (`docs/`)

- `docs/app/layout.tsx` — Add full `Metadata` with title template, description, openGraph, twitter, alternates, icons.
- Dynamic metadata per MDX page from frontmatter.
- `docs/app/sitemap.ts` — Generate `sitemap.xml`.
- `docs/app/robots.ts` — Generate `robots.txt`.

### Admin (`admin/`)

- `admin/app/layout.tsx` — Add metadata (title template, description, openGraph preview images).
- Admin pages marked `noindex`.

### Subdomain structure

| Subdomain | App | Purpose |
|---|---|---|
| `app.peak-player.com` | player | Main player + landing page |
| `docs.peak-player.com` | docs | Documentation |
| `admin.peak-player.com` | admin | Admin control panel |
| `api.peak-player.com` | API server | Backend API |

### JSON-LD

Each app includes structured JSON-LD:
- Player: `SoftwareApplication` + `WebApplication` for the player SDK.
- Docs: `WebSite` + `Article` per page.
- Admin: `WebApplication` for the admin portal.

## 7. llms.txt + AI Docs Structure

### Files

| Path | Purpose |
|------|---------|
| `llms.txt` | Root file. Lists AI docs index + links to `docs/llms-full.txt`. |
| `docs/llms-full.txt` | Concatenated content of all `docs/content/docs/ai/*.mdx` files. |
| `docs/content/docs/ai/` | AI-optimized versions of human docs pages (direct, code-heavy). |
| `mcp/` | Standalone MCP server (TypeScript + `mcp.ts`). |

### llms.txt format

```
# Peak Player Platform — AI Agent Index

> Version 2026-10-28 · GitHub: https://github.com/pansiluchethiya/peak-player

## Quick Start
- Docs: https://docs.peak-player.com
- API: https://api.peak-player.com
- GitHub: https://github.com/pansiluchethiya/peak-player

## Full Documentation (AI-Optimized)
The complete AI docs are available at docs/llms-full.txt

## Key Files
- providers/rive.js — Provider integration
- utils/embedToken.js — Token signing/verification
- utils/playerService.js — Stream resolution
- proxy/proxyServer.js — Media proxy
...
```

### MCP server

- **Location**: `mcp/` (standalone TS project)
- **Transport**: stdio only (not SSE)
- **Tools**:
  - `read_file(path)` — Read any file in the repo
  - `list_files(path, recursive)` — List directory contents
  - `search_code(query)` — Grep across the codebase
  - `get_docs(page)` — Return AI docs for a specific page
  - `get_provider_info(provider)` — Return provider metadata
- **Capabilities**: Full repository read access. No write tools.

### AI docs pages (`docs/content/docs/ai/`)

Mirror of human docs at `docs/content/docs/`, but AI-optimized:
- Short sentences, direct tone
- Code snippets inline (no fold/expand needed)
- Less marketing prose, more technical detail
- File paths and line references included

Files:
- `ai/quickstart.mdx`
- `ai/concepts.mdx`
- `ai/guides/embedding.mdx`
- `ai/guides/auth.mdx`
- `ai/guides/live-tv.mdx`
- `ai/guides/player-controls.mdx`
- `ai/guides/preferences.mdx`
- `ai/guides/theming.mdx`
- `ai/guides/playback.mdx`
- `ai/reference/sdk.mdx`
- `ai/reference/urls.mdx`
- `ai/reference/postmessage.mdx`
- `ai/api-reference.mdx`
- `ai/self-hosting.mdx`
- `ai/architecture.mdx`
- `ai/security.mdx`

## 8. Docker / Self-Hosting

### docker-compose.yml

4 services:
1. **peak** (API server, port 8787)
2. **player** (Next.js player, port 3001)
3. **admin** (Next.js admin, port 3003)
4. **docs** (Next.js docs, port 3002)

Each service has its own `.env` file:
- `.env.peak.local`
- `.env.player.local`
- `.env.admin.local`
- `.env.docs.local`

### Self-hosting guide (`docs/content/docs/self-hosting.mdx`)

- Prerequisites (Node 20+, Docker, TMDB API key, SQLite)
- GitHub URL: https://github.com/pansiluchethiya/peak-player
- Docker: `docker compose up --build`
- Manual: `npm install && npm run dev` with per-app instructions
- pnpm alternative: `pnpm install && pnpm --filter peak dev`
- Reverse proxy config (Nginx + Caddy examples)
- TLS setup
- Health checks
- Backups
- Upgrades
- Production checklist

## 9. Landing Page Styling

### Current state

`player/src/app/page.tsx` uses hand-rolled CSS in `player/src/styles/landing.css` with custom components in
`player/src/components/marketing/`. It has a hero, provider band, quick start, features bento grid, stats,
integration section, auth section, docs section, FAQ, and status.

### New design

- Use **MagicUI** components (`npx magic-ui@latest add ...`).
- MagicUI cards for feature highlights.
- Live demo iframe pointing to `/embed/demo`.
- TMDB placeholder + trending API for card images.
- Full code formatting with syntax highlighting (Shiki/Monaco).
- Subtle animations (no fake SVG markups — use real images/videos).
- `PEAK_DOCS_URL` / `NEXT_PUBLIC_DOCS_URL` controls docs links.

### Styling approach

- Keep `landing.css` as the base (dark AMOLED theme).
- Add MagicUI component wrappers in `player/src/components/marketing/`.
- Add a `CodeBlock` component with Shiki for syntax-highlighted code snippets.
- Ensure responsive design (mobile-first).

## 10. Admin UI Styling

### Current state

Admin uses Fumadocs-ui with AMOLED monochrome theme. CSS in `admin/app/admin.css`, `admin/app/theme.css`,
`admin/app/legacy.css`, `admin/app/legacy-overrides.css`. Components in `admin/components/`.

### New design

- **Big-bang rewrite**: Replace legacy CSS with shadcn/ui components + Fumadocs-ui.
- AMOLED dark-first theme (`#000000` canvas, grey accent `#e5e5e5`).
- Code blocks with syntax highlighting (same Shiki config as player).
- Full sidebar navigation including new pages: Tokens, Proxies, Feature Toggles, IPTV.
- Consistent spacing, typography, and color tokens.

### New components needed

- `admin/components/TokenManager.tsx` — token CRUD + analytics
- `admin/components/ProxyManager.tsx` — proxy CRUD + health dashboard
- `admin/components/FeatureToggle.tsx` — feature toggle switches
- `admin/components/IPTVCategories.tsx` — IPTV category toggles
- `admin/components/CodeBlock.tsx` — syntax-highlighted code

### New pages needed

| Page | Path | Purpose |
|------|------|---------|
| Overview | `/` | Current dashboard with updated styling |
| Tokens | `/tokens` | Token management |
| Proxies | `/proxies` | Proxy management |
| Feature Toggles | `/features` | All 15 feature toggles |
| Provider Toggles | `/providers` | Provider enable/disable |
| Quality | `/quality` | Quality & filter settings |
| IPTV | `/iptv` | IPTV seed + category toggles |
| API Keys | `/keys` | Partner API key management |
| FebBox | `/febbox` | FebBox cookie management |
| Live Config | `/live` | Live configuration editing |
| Advanced | `/advanced` | Advanced settings + restart |
| Login | `/login` | Auth login |

## 11. Docs Overhaul

### Existing docs pages to expand

All existing pages at `docs/content/docs/*.mdx` and `docs/content/docs/guides/*.mdx` must be updated with:

1. **New features**: Rive providers (PRIME/STELLAR/NEXUS/ORBIT), scrubber thumbnails, HLS subtitles, dubs menu,
   colour filters, audio boost, server switching, quality selection, playback speed.
2. **Code snippets**: Concrete, copy-pasteable examples for every feature.
3. **IPTV**: Complete documentation of IPTV Live TV features including private playlists.
4. **Self-hosting**: Updated with GitHub URL + Docker.
5. **Admin**: Documentation of all new admin features.

### New docs pages

| Page | Purpose |
|------|---------|
| `docs/content/docs/providers.mdx` | Provider system + Rive sub-providers |
| `docs/content/docs/thumbnails.mdx` | Scrubber thumbnail sprites (local + remote VTT) |
| `docs/content/docs/subtitles.mdx` | Subtitle loading (OpenSubtitles + provider captions) |
| `docs/content/docs/dubs.mdx` | Dubs menu and language renditions |
| `docs/content/docs/colour.mdx` | Colour filters and WebGL pipeline |
| `docs/content/docs/audio-boost.mdx` | Audio boost feature |
| `docs/content/docs/server-switching.mdx` | Server switching API + SDK command |
| `docs/content/docs/admin-tokens.mdx` | Token management via admin UI |
| `docs/content/docs/admin-proxies.mdx` | Proxy management via admin UI |
| `docs/content/docs/admin-features.mdx` | Feature toggles via admin UI |

## 12. Testing

### Codename test updates

- `tests/riveProvider.test.js` — Update provider mapping assertions from `RIVE*` to `PRIME/STELLAR/NEXUS/ORBIT`.
- `player/tests/servers.test.ts` — Update codename assertions.

### New tests

- `tests/adminConfig.test.js` — Feature toggle DB schema + CRUD.
- `tests/adminTokens.test.js` — Token management API.
- `tests/adminProxies.test.js` — Proxy management API.

### Gate suite

All gates must pass:
- Root API tests: `node --test tests/*.test.js`
- Player typecheck: `npm --prefix player run typecheck`
- Player tests: `npm --prefix player test`
- CSS size: `node scripts/check-css-size.mjs`
- Docs tests: `npm --prefix docs test`
- Admin typecheck: `npm --prefix admin run typecheck`
- Player build: `npm --prefix player run build`
- Mini-web build: (if mini-web has tests) `npm --prefix mini-web run build`

## 13. Live Test URLs

After implementation, the following URLs should be available for manual testing:

| URL | Purpose |
|-----|---------|
| `http://localhost:3011` | Player landing page (styling + SEO) |
| `http://localhost:3011/embed/demo` | Live embed demo |
| `http://localhost:3011/movie/550` | Full player (Fight Club) |
| `http://localhost:3011/tv/1399/1/1` | TV show (Game of Thrones S1E1) |
| `http://localhost:3003` | Admin panel (login + dashboard) |
| `http://localhost:3002` | Docs site |
| `http://localhost:3002/ai` | AI-optimized docs landing |
| `http://localhost:3002/docs/providers` | New providers docs page |
| `http://localhost:3002/docs/thumbnails` | Thumbnails docs |
| `http://localhost:3002/docs/subtitles` | Subtitles docs |
| `http://localhost:8787/api/status` | API status endpoint |
| `http://localhost:8787/api/v1/playback/health` | Playback health |

## 14. Acceptance Criteria

1. **Codenames**: No file, variable, or string in the repo references "RIVE" or "Rive" as a display name.
   Technical keys (`rive apogee` etc.) are allowed (internal identifiers).
2. **Docs**: Every feature in the codebase has a corresponding docs page with code snippets.
3. **Self-hosting**: Guide includes GitHub URL, Docker commands, per-service .env, both npm and pnpm.
4. **Landing**: Styled with MagicUI, live demo iframe, syntax-highlighted code, TMDB images.
5. **Admin**: Styled with shadcn/ui + Fumadocs-ui, all new features present.
6. **SEO**: All three apps have full metadata with OG + Twitter + JSON-LD.
7. **llms.txt + AI docs**: Present at repo root and docs directory.
8. **MCP**: Standalone server at `mcp/` with file-reading + search + docs tools.
9. **Admin features**: Token management, proxy management, 15 feature toggles, IPTV toggles all functional.
10. **Tests**: All existing tests pass with updated codenames. New tests pass.
11. **Gates**: Full gate suite passes.
12. **Session handoff**: Complete prompt at `docs/superpowers/2026-10-28-session-handoff-prompt.md`.
