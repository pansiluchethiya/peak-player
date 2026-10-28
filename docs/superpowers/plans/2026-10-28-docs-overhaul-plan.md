# Peak Docs & Platform Overhaul — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md`  
**Plan:** This file  
**Tasks:** `docs/superpowers/tasks/2026-10-28-docs-overhaul-tasks.md`

---

## Overview

This plan breaks the docs/platform overhaul into 13 work streams. Each stream is self-contained but
some depend on others (noted in the Prerequisites column). The plan is designed for **a single new
session** to execute from start to finish.

## Phases

### Phase 1: Foundation (Days 1–2)

Foundation changes that unblock all other work. No new features, just renames + config.

| # | Stream | Description | Est. | Prereqs |
|---|--------|-------------|------|---------|
| 1 | **Codename Change** | Rename provider codenames RIVE→PRIME, RIVE V→STELLAR, RIVE P→NEXUS, RIVE DUB→ORBIT. Update `servers.ts`, `rive.js` PROVIDERS array, tests. | 2h | None |
| 2 | **Env Variable** | Add `PEAK_DOCS_URL` + `NEXT_PUBLIC_DOCS_URL` support. Update config, `.env.example`. | 1h | None |
| 3 | **Admin DB Schema** | Create SQLite table `peak_config` for feature toggles, tokens, proxies. Add CRUD API endpoints. | 3h | None |

### Phase 2: Admin UI Rewrite (Days 3–5)

Full rewrite of the admin UI with new features + styling.

| # | Stream | Description | Est. | Prereqs |
|---|--------|-------------|------|---------|
| 4 | **Admin: Tokens** | TokenManager page + API. Create/list/revoke/analytics. | 3h | 3 |
| 5 | **Admin: Proxies** | ProxyManager page + API. Create/list/revoke/health dashboard. | 3h | 3 |
| 6 | **Admin: Feature Toggles** | 15 feature toggle pages + IPTV category toggles. | 4h | 3 |
| 7 | **Admin: Styling** | shadcn/ui + Fumadocs-ui big-bang rewrite. CodeBlock component. Update Sidebar. | 6h | 4,5,6 |

### Phase 3: Player + Landing (Days 6–8)

| # | Stream | Description | Est. | Prereqs |
|---|--------|-------------|------|---------|
| 8 | **Player SEO** | Full metadata in layout.tsx. Dynamic metadata for movie/tv/live pages. Sitemap + robots. | 2h | None |
| 9 | **Player Landing** | MagicUI components, live demo iframe, TMDB images, code formatting, PEAK_DOCS_URL integration. | 4h | 2 |

### Phase 4: Docs (Days 9–12)

| # | Stream | Description | Est. | Prereqs |
|---|--------|-------------|------|---------|
| 10 | **Admin API** | Admin API endpoints for tokens/proxies/toggles (Express routes in apiServer.js). | 4h | 3 |
| 11 | **Docs Content** | Expand all docs pages + add new pages (providers, thumbnails, subtitles, dubs, colour, audio boost, server switching, admin features). Mirror to AI docs at `docs/content/docs/ai/`. | 8h | 1,2,4,5,6,10 |
| 12 | **Docs SEO** | Metadata, sitemap, robots, JSON-LD for docs app. | 2h | 11 |

### Phase 5: AI Infrastructure (Days 13–14)

| # | Stream | Description | Est. | Prereqs |
|---|--------|-------------|------|---------|
| 13 | **llms.txt + MCP** | `llms.txt`, `docs/llms-full.txt`, MCP server in `mcp/`. | 3h | 11 |

### Phase 6: Final (Day 15)

| # | Stream | Description | Est. | Prereqs |
|---|--------|-------------|------|---------|
| 14 | **Gates + Handoff** | Run full gate suite. Fix any failures. Write session handoff prompt. | 2h | All |

## Execution Order (Dependency Graph)

```
1 (codenames) ──────────────────────► 11 (docs content) ─► 12 (docs SEO)
│                                      │                    │
2 (env var) ──────────────────────► 11                     │
│                                   │                      │
3 (admin DB) ─► 4 (tokens) ─► 7 (admin styling)          │
│              │                   │                       │
│              ├─► 5 (proxies) ───► 7                      │
│              │                   │                       │
│              ├─► 6 (toggles) ───► 7                      │
│              │                                           │
│              └─► 10 (admin API) ─► 11                   │
│                                                    │    │
8 (player SEO) ──────────────────────────────────────┼────┘
9 (landing) ─► 11 ─► 12
13 (llms.txt + MCP) ─► 14 (gates)
```

## Key Decisions Recap

1. **Codenames**: PRIME (Apogee), STELLAR (Vanguard), NEXUS (Pulse), ORBIT (Citadel). Technical keys unchanged.
2. **Env var**: `PEAK_DOCS_URL` (runtime) + `NEXT_PUBLIC_DOCS_URL` (build-time).
3. **Admin DB**: SQLite `peak_config` table with JSON values.
4. **Admin styling**: Fumadocs-ui + shadcn/ui, AMOLED monochrome.
5. **Player landing**: MagicUI cards, live demo iframe, TMDB images, code highlighting.
6. **Docs site**: SEO + sitemap + robots + JSON-LD.
7. **AI docs**: `docs/content/docs/ai/` mirror + `llms.txt` + `docs/llms-full.txt`.
8. **MCP**: `mcp/` dir, stdio only, file-reading + search + docs tools.
9. **Feature toggles**: 15 features as dedicated admin pages.
10. **IPTV toggles**: Master toggle + per-category.
11. **Docker**: 4 services (peak, player, admin, docs) with per-service `.env` files.
12. **Package manager**: Both npm and pnpm supported.
13. **Session handoff**: Full prompt at `docs/superpowers/2026-10-28-session-handoff-prompt.md`.

## File Impact Matrix

### Files to MODIFY

| File | Change |
|------|--------|
| `player/src/lib/servers.ts` | Codename values: RIVE→PRIME, RIVE V→STELLAR, RIVE P→NEXUS, RIVE DUB→ORBIT |
| `providers/rive.js` | PROVIDERS array `provider` field: 'Rive Apogee'→'Peak Prime', etc. |
| `utils/config.js` | Add `PEAK_DOCS_URL` + `NEXT_PUBLIC_DOCS_URL` support |
| `.env.example` | Add `PEAK_DOCS_URL` |
| `player/src/app/layout.tsx` | Full SEO metadata + JSON-LD |
| `player/src/app/page.tsx` | MagicUI components, live demo, TMDB images, code highlighting |
| `player/src/styles/landing.css` | Updated styling |
| `docs/app/layout.tsx` | Full SEO metadata + JSON-LD |
| `docs/app/page.tsx` | Updated cards + SEO |
| `admin/app/layout.tsx` | SEO metadata |
| `admin/app/page.tsx` | Updated dashboard styling |
| `admin/app/admin.css` | Updated styling |
| `admin/app/theme.css` | Updated theme tokens |
| `admin/app/globals.css` | Import shadcn/ui styles |
| `admin/components/Sidebar.tsx` | Add new nav items (Tokens, Proxies, Features) |
| `admin/components/AdminShell.tsx` | Updated shell |
| `apiServer.js` | Add admin API routes for tokens/proxies/toggles |
| `docs/content/docs/self-hosting.mdx` | Rewrite with GitHub URL + Docker |
| `docs/content/docs/meta.json` | Add new docs pages + AI docs |
| `tests/riveProvider.test.js` | Update codename assertions |
| `player/tests/servers.test.ts` | Update codename assertions |
| `docker-compose.yml` | Add admin + docs services + per-service .env |
| `package.json` | Add scripts for MCP, docs generation |

### Files to CREATE

| File | Purpose |
|------|---------|
| `docs/superpowers/tasks/2026-10-28-docs-overhaul-tasks.md` | This plan's tasks |
| `docs/superpowers/2026-10-28-session-handoff-prompt.md` | Handoff prompt |
| `utils/adminConfig.js` | Admin config DB CRUD |
| `routes/adminConfigRoutes.js` | Admin config API routes |
| `admin/app/tokens/page.tsx` | Token management page |
| `admin/app/proxies/page.tsx` | Proxy management page |
| `admin/app/features/page.tsx` | Feature toggles overview |
| `admin/app/features/[slug]/page.tsx` | Individual feature toggle page |
| `admin/components/TokenManager.tsx` | Token management component |
| `admin/components/ProxyManager.tsx` | Proxy management component |
| `admin/components/FeatureToggle.tsx` | Feature toggle component |
| `admin/components/CodeBlock.tsx` | Syntax-highlighted code block |
| `docs/content/docs/ai/*.mdx` | AI-optimized docs (16 files) |
| `docs/llms-full.txt` | Concatenated AI docs |
| `llms.txt` | AI agent index |
| `mcp/package.json` | MCP server package |
| `mcp/src/index.ts` | MCP server implementation |
| `docs/content/docs/providers.mdx` | Provider docs |
| `docs/content/docs/thumbnails.mdx` | Thumbnail docs |
| `docs/content/docs/subtitles.mdx` | Subtitle docs |
| `docs/content/docs/dubs.mdx` | Dubs docs |
| `docs/content/docs/colour.mdx` | Colour filter docs |
| `docs/content/docs/audio-boost.mdx` | Audio boost docs |
| `docs/content/docs/server-switching.mdx` | Server switching docs |
| `docs/content/docs/admin-tokens.mdx` | Admin tokens docs |
| `docs/content/docs/admin-proxies.mdx` | Admin proxies docs |
| `docs/content/docs/admin-features.mdx` | Admin features docs |
| `docs/app/sitemap.ts` | Sitemap generation |
| `docs/app/robots.ts` | Robots.txt generation |
| `mcp/.env.example` | MCP env example |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Codename change breaks embed links | Low | High | Only display names change; technical keys stay the same |
| Admin rewrite breaks existing functionality | Medium | Medium | Big-bang rewrite; test after each page |
| MagicUI adds many dependencies | Low | Medium | Document new deps in package.json; verify builds |
| SEO metadata is verbose | Low | Low | Use helper functions to keep code clean |
| MCP server has dependency conflicts | Low | Medium | Use standalone TS project with minimal deps |
| Docs mirror doubles maintenance | Medium | Low | AI docs are generated from human docs with sed/scripts |
