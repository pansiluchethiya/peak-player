# Peak Docs & Platform Overhaul — Task List

**Spec:** `docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md`  
**Plan:** `docs/superpowers/plans/2026-10-28-docs-overhaul-plan.md`  
**Tasks:** This file

---

## Phase 1: Foundation

### Task 1: Change Provider Codenames

**Files:**
- `player/src/lib/servers.ts`
- `providers/rive.js`
- `tests/riveProvider.test.js`
- `player/tests/servers.test.ts`

**Steps:**
- [x] 1.1 In `player/src/lib/servers.ts`, change `SERVER_CODENAMES` map values:
  - `'rive apogee'` → `'PRIME'`
  - `'rive vanguard'` → `'STELLAR'`
  - `'rive pulse'` → `'NEXUS'`
  - `'rive citadel'` → `'ORBIT'`
- [x] 1.2 In `providers/rive.js`, update `PROVIDERS` array `provider` field:
  - `provider: 'Rive Apogee'` → `provider: 'Peak Prime'`
  - `provider: 'Rive Vanguard'` → `provider: 'Peak Stellar'`
  - `provider: 'Rive Pulse'` → `provider: 'Peak Nexus'`
  - `provider: 'Rive Citadel'` → `provider: 'Peak Orbit'`
- [x] 1.3 Update `tests/riveProvider.test.js` assertions to match new codenames.
- [x] 1.4 Update `player/tests/servers.test.ts` assertions to match new codenames.
- [x] 1.5 Verify: `npm run test:api` + `npm --prefix player test`

---

### Task 2: Add PEAK_DOCS_URL Env Variable

**Files:**
- `utils/config.js`
- `.env.example`
- `player/src/lib/api.ts` (if applicable)

**Steps:**
- [x] 2.1 Add `PEAK_DOCS_URL` to config.js with default `https://docs.peak-player.com`.
- [x] 2.2 Add `NEXT_PUBLIC_DOCS_URL` build-time variable for player client bundle.
- [x] 2.3 Update `.env.example` with both variables documented.
- [x] 2.4 Update player components that link to docs (e.g., SettingsMenu, Help links) to use `PEAK_DOCS_URL`.
- [x] 2.5 Verify config loads correctly.

---

### Task 3: Admin Config DB Schema

**Files to CREATE:**
- `utils/adminConfig.js`
- `routes/adminConfigRoutes.js`

**Files to MODIFY:**
- `apiServer.js` (add route registration)

**Steps:**
- [x] 3.1 Create `utils/adminConfig.js`:
  - Function `getConfig(key)` → returns JSON value from `peak_config` table
  - Function `setConfig(key, value)` → upserts JSON value with timestamp
  - Function `getAllConfig()` → returns all config rows
  - Use existing `utils/db.js` SQLite connection
- [x] 3.2 Create `routes/adminConfigRoutes.js`:
  - `GET /api/admin/config` → list all config keys
  - `GET /api/admin config/:key` → get specific config
  - `POST /api/admin/config/:key` → set config value (behind requireAuth)
- [x] 3.3 Register routes in `apiServer.js`.
- [x] 3.4 Verify: `node --test tests/adminConfig.test.js`

---

## Phase 2: Admin UI Rewrite

### Task 4: Admin Token Management

**Files to CREATE:**
- `admin/app/tokens/page.tsx`
- `admin/components/TokenManager.tsx`

**Steps:**
- [x] 4.1 Create `TokenManager.tsx`:
  - State: tokens array, loading, error
  - Fetch from `/api/admin/config` → `value_json` for key `tokens`
  - Table columns: Name, Partner, Expiry, Status, Last Used
  - Create button → modal with form (name, expiry, origins, read-only)
  - Revoke button per row
  - Analytics subplot: usage over time
- [x] 4.2 Create `admin/app/tokens/page.tsx`:
  - Wraps `TokenManager` in `AdminShell`
  - Title: "Tokens"
- [x] 4.3 Add token management to `utils/adminConfig.js` (CRUD helpers).
- [x] 4.4 Add token management API routes to `routes/adminConfigRoutes.js`.

---

### Task 5: Admin Proxy Management

**Files to CREATE:**
- `admin/app/proxies/page.tsx`
- `admin/components/ProxyManager.tsx`

**Steps:**
- [x] 5.1 Create `ProxyManager.tsx`:
  - State: proxies array, loading, error, health status
  - Fetch from `/api/status` (provider health) + `/api/admin/config` (proxies config)
  - Table columns: Name, Upstream, Status, Latency
  - Create button → modal (name, upstream URL, headers, CORS origins)
  - Health dashboard: live scores with latency bars
- [x] 5.2 Create `admin/app/proxies/page.tsx`.
- [x] 5.3 Add proxy config to `peak_config` table.

---

### Task 6: Admin Feature Toggles

**Files to CREATE:**
- `admin/app/features/page.tsx`
- `admin/app/features/[slug]/page.tsx`
- `admin/components/FeatureToggle.tsx`

**Steps:**
- [x] 6.1 Define 15 features with slugs:
  | Slug | Feature |
  |------|---------|
  | `embed-demo` | Embed Demo |
  | `token-auth` | Token Auth |
  | `dubs` | Dubs |
  | `captions` | Captions |
  | `color-filters` | Color Filters |
  | `scrubber-thumbnails` | Scrubber Thumbnails |
  | `audio-boost` | Audio Boost |
  | `keyboard-shortcuts` | Keyboard Shortcuts |
  | `stats-overlay` | Stats Overlay |
  | `chapters` | Chapters |
  | `quality-selection` | Quality Selection |
  | `playback-speed` | Playback Speed |
  | `pip` | PiP |
  | `mux-analytics` | Mux Analytics |
  | `server-switching` | Server Switching |
- [x] 6.2 Create `FeatureToggle.tsx`:
  - Toggle switch component
  - Saves to `peak_config` table under key `feature_toggles`
- [x] 6.3 Create `admin/app/features/page.tsx`:
  - Grid of all 15 feature cards
  - Master enable/disable all checkbox
- [x] 6.4 Create `admin/app/features/[slug]/page.tsx`:
  - Individual feature detail page with description + toggle
- [x] 6.5 Add IPTV category toggles (master + per-category).

---

### Task 7: Admin Styling Rewrite

**Files to MODIFY:**
- `admin/app/admin.css`
- `admin/app/theme.css`
- `admin/app/globals.css`
- `admin/app/legacy.css`
- `admin/app/legacy-overrides.css`
- `admin/components/Sidebar.tsx`
- `admin/components/AdminShell.tsx`

**Files to CREATE:**
- `admin/components/CodeBlock.tsx`
- `admin/components/ThemeProvider.tsx` (update)

**Steps:**
- [x] 7.1 Install shadcn/ui components: `npx shadcn-ui@latest add button card dialog table form input switch`
- [x] 7.2 Rewrite `admin.css` with AMOLED monochrome + shadcn/ui tokens
- [x] 7.3 Update `theme.css` with CSS variables for dark mode
- [x] 7.4 Rewrite `legacy.css` to use shadcn/ui primitives
- [x] 7.5 Create `CodeBlock.tsx` with Shiki syntax highlighting
- [x] 7.6 Update `Sidebar.tsx` with new nav items (Tokens, Proxies, Features)
- [x] 7.7 Update `AdminShell.tsx` with new layout
- [x] 7.8 Verify: `npm --prefix admin run typecheck`

---

## Phase 3: Player + Landing

### Task 8: Player SEO

**Files to MODIFY:**
- `player/src/app/layout.tsx`
- `player/src/app/movie/[id]/page.tsx`
- `player/src/app/tv/[id]/[season]/[episode]/page.tsx`
- `player/src/app/live/[id]/page.tsx`

**Files to CREATE:**
- `player/src/app/sitemap.ts`
- `player/src/app/robots.ts`

**Steps:**
- [x] 8.1 Update `layout.tsx` with full Metadata:
  - title template: `%s · Peak`
  - description
  - openGraph: type, locale, url, siteName, images
  - twitter: card, title, description, image, creator
  - robots: index/follow
  - alternates: canonical
  - icons: favicon, apple-touch-icon
- [x] 8.2 Add dynamic metadata to movie/tv/live pages using TMDB data
- [x] 8.3 Create `sitemap.ts` using `next-sitemap` or manual generation
- [x] 8.4 Create `robots.ts`
- [x] 8.5 Add JSON-LD structured data to layout
- [x] 8.6 Verify: `npm --prefix player run build`

---

### Task 9: Player Landing Page

**Files to MODIFY:**
- `player/src/app/page.tsx`
- `player/src/styles/landing.css`

**Files to CREATE:**
- `player/src/components/marketing/magicui-card.tsx`
- `player/src/components/marketing/code-block.tsx`
- `player/src/components/MiniPlayerDemo.tsx`

**Steps:**
- [x] 9.1 Install MagicUI: `npx magic-ui@latest add card container text-effect`
- [x] 9.2 Rewrite `page.tsx` with:
  - Hero section with live demo iframe
  - Features section with MagicUI cards
  - Code snippet section with syntax highlighting
  - Provider band (TMDB images via trending API)
  - Use `NEXT_PUBLIC_DOCS_URL` / `PEAK_DOCS_URL` for docs links
- [x] 9.3 Create `MiniPlayerDemo.tsx` — embedded iframe to `/embed/demo`
- [x] 9.4 Create `CodeBlock.tsx` component using Shiki for syntax highlighting
- [x] 9.5 Update `landing.css` with new styles
- [x] 9.6 Add TMDB image fetching for card backgrounds
- [x] 9.7 Verify: Player builds + lint passes

---

## Phase 4: Docs

### Task 10: Admin API Endpoints

**Files to MODIFY:**
- `apiServer.js` (add route registration for admin config)
- `routes/adminConfigRoutes.js` (expand)

**Steps:**
- [x] 10.1 Add `GET /api/admin/tokens` — list all tokens
- [x] 10.2 Add `POST /api/admin/tokens` — create token
- [x] 10.3 Add `DELETE /api/admin/tokens/:id` — revoke token
- [x] 10.4 Add `GET /api/admin/proxies` — list proxies
- [x] 10.5 Add `POST /api/admin/proxies` — create proxy
- [x] 10.6 Add `DELETE /api/admin/proxies/:id` — revoke proxy
- [x] 10.7 Add `GET /api/admin/features` — list feature toggles
- [x] 10.8 Add `POST /api/admin/features` — update feature toggles
- [x] 10.9 Add `PATCH /api/admin/iptv/categories` — update IPTV category toggles
- [x] 10.10 Verify: `node --test tests/adminTokens.test.js tests/adminProxies.test.js`

---

### Task 11: Docs Content Overhaul

**Files to MODIFY:**
- All `docs/content/docs/*.mdx` and `docs/content/docs/guides/*.mdx`

**Files to CREATE:**
- `docs/content/docs/providers.mdx`
- `docs/content/docs/thumbnails.mdx`
- `docs/content/docs/subtitles.mdx`
- `docs/content/docs/dubs.mdx`
- `docs/content/docs/colour.mdx`
- `docs/content/docs/audio-boost.mdx`
- `docs/content/docs/server-switching.mdx`
- `docs/content/docs/admin-tokens.mdx`
- `docs/content/docs/admin-proxies.mdx`
- `docs/content/docs/admin-features.mdx`
- `docs/content/docs/ai/*.mdx` (16 AI-optimized docs)

**Steps:**
- [x] 11.1 Update `docs/content/docs/self-hosting.mdx` with GitHub URL + Docker
- [x] 11.2 Update `docs/content/docs/quickstart.mdx` with latest API examples
- [x] 11.3 Update `docs/content/docs/concepts.mdx` with new provider architecture
- [x] 11.4 Update `docs/content/docs/architecture.mdx` with admin API changes
- [x] 11.5 Update `docs/content/docs/guides/embedding.mdx` with SDK v2
- [x] 11.6 Update `docs/content/docs/guides/auth.mdx` with token management
- [x] 11.7 Update `docs/content/docs/guides/live-tv.mdx` with IPTV toggles
- [x] 11.8 Update `docs/content/docs/guides/player-controls.mdx` with new features
- [x] 11.9 Update `docs/content/docs/guides/preferences.mdx` with preference modes
- [x] 11.10 Update `docs/content/docs/guides/theming.mdx` with new styling
- [x] 11.11 Update `docs/content/docs/guides/playback.mdx` with failover
- [x] 11.12 Update `docs/content/docs/guides/movies.mdx` and `tv.mdx`
- [x] 11.13 Update `docs/content/docs/guides/migrating-to-sdk-v2.mdx`
- [x] 11.14 Update `docs/content/docs/api-reference.mdx` with new endpoints
- [x] 11.15 Update `docs/content/docs/reference/*.mdx` (sdk, urls, postmessage, events, errors)
- [x] 11.16 Update `docs/content/docs/security.mdx`, `troubleshooting.mdx`, etc.
- [x] 11.17 Create new docs pages (providers, thumbnails, subtitles, dubs, colour, audio boost, server switching, admin features)
- [x] 11.18 Create AI docs mirror at `docs/content/docs/ai/`
- [x] 11.19 Update `docs/content/docs/meta.json` with new pages
- [x] 11.20 Verify: `npm --prefix docs test`

---

### Task 12: Docs SEO

**Files to MODIFY:**
- `docs/app/layout.tsx`
- `docs/app/page.tsx`

**Files to CREATE:**
- `docs/app/sitemap.ts`
- `docs/app/robots.ts`

**Steps:**
- [x] 12.1 Add full Metadata to `docs/app/layout.tsx` (OG + Twitter + JSON-LD)
- [x] 12.2 Add dynamic metadata per MDX page from frontmatter
- [x] 12.3 Create `sitemap.ts`
- [x] 12.4 Create `robots.ts`
- [x] 12.5 Add JSON-LD `WebSite` + `Article` structured data
- [x] 12.6 Set `<html lang="en" amp />` for docs
- [x] 12.7 Verify: `npm --prefix docs run build`

---

## Phase 5: AI Infrastructure

### Task 13: llms.txt + MCP Server

**Files to CREATE:**
- `llms.txt` (repo root)
- `docs/llms-full.txt`
- `mcp/package.json`
- `mcp/src/index.ts`
- `mcp/.env.example`
- `mcp/tsconfig.json`

**Steps:**
- [x] 13.1 Create `llms.txt` at repo root:
  - Index of AI docs pages with URLs
  - Link to `docs/llms-full.txt`
  - Key file paths with descriptions
- [x] 13.2 Generate `docs/llms-full.txt` by concatenating all `docs/content/docs/ai/*.mdx` content
- [x] 13.3 Create `mcp/` as standalone TypeScript project:
  - `mcp/package.json` with `mcp` and `@modelcontextprotocol/sdk` deps
  - `mcp/src/index.ts` with stdio transport
  - Tools: `read_file`, `list_files`, `search_code`, `get_docs`, `get_provider_info`
  - Full read-only repository access
- [x] 13.4 Create `mcp/.env.example`
- [x] 13.5 Create `mcp/tsconfig.json`
- [x] 13.6 Verify: MCP server compiles + starts

---

## Phase 6: Final

### Task 14: Gates + Session Handoff

**Files to CREATE:**
- `docs/superpowers/2026-10-28-session-handoff-prompt.md`

**Files to MODIFY:**
- `.gitignore` (if needed for new generated files)

**Steps:**
- [x] 14.1 Run full gate suite:
  - `npm run lint`
  - `npm run check:player` (lint + typecheck + test + build)
  - `npm run check:docs` (tests + link check)
  - `npm run check:admin` (typecheck)
  - `npm run test:api` (179+ tests)
  - `npm run check:css`
- [x] 14.2 Fix any failing gates
- [x] 14.3 Create session handoff prompt at `docs/superpowers/2026-10-28-session-handoff-prompt.md`
- [x] 14.4 Verify all plan/spec/task files are consistent
- [x] 14.5 Final commit + push

---

## Testing Requirements

### Modified tests

| Test file | Changes needed |
|-----------|----------------|
| `tests/riveProvider.test.js` | Update codename assertions (RIVE→PRIME etc.) |
| `player/tests/servers.test.ts` | Update codename assertions |

### New tests

| Test file | Purpose |
|-----------|---------|
| `tests/adminConfig.test.js` | Config DB CRUD |
| `tests/adminTokens.test.js` | Token management API |
| `tests/adminProxies.test.js` | Proxy management API |

### Gate commands

```bash
# Root
node --test tests/*.test.js
node scripts/check-css-size.mjs

# Player
npm --prefix player run typecheck
npm --prefix player test
npm --prefix player run build

# Docs
npm --prefix docs test
npm --prefix docs run check:links

# Admin
npm --prefix admin run typecheck
npm --prefix admin run build

# Full
npm run check
```

## Success Criteria Checklist

- [x] No file references "RIVE" or "Rive" as a display name
- [x] `PEAK_DOCS_URL` env var works in player + admin
- [x] Admin DB schema created + CRUD working
- [x] Admin tokens/proxies/features pages exist + functional
- [x] Admin styling uses shadcn/ui + Fumadocs-ui
- [x] Player landing has MagicUI cards + live demo iframe + code highlighting
- [x] Player SEO metadata complete
- [x] Docs SEO metadata complete
- [x] `llms.txt` + `docs/llms-full.txt` exist
- [x] MCP server compiles and starts in `mcp/`
- [x] AI docs mirror at `docs/content/docs/ai/`
- [x] docs/content/docs/meta.json updated with new pages
- [x] docker-compose.yml has 4 services with per-service .env
- [x] All existing tests pass
- [x] New tests pass
- [x] Full gate suite passes
- [x] Session handoff prompt created
- [x] Changes committed and pushed
