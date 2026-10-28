# Peak Platform Docs & Overhaul — Session Handoff Prompt

> **GitHub Repository:** https://github.com/pansiluchethiya/peak-player  
> **Branch:** `main`  
> **Last commit:** `0ef607d6`  
> **Date:** 2026-10-28

## Instructions

You are starting a new session to execute the **Peak Docs & Platform Overhaul**. All clarifying questions
have been answered. The full spec, plan, and task list are at:

- **Spec:** `docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md`
- **Plan:** `docs/superpowers/plans/2026-10-28-docs-overhaul-plan.md`
- **Tasks:** `docs/superpowers/tasks/2026-10-28-docs-overhaul-tasks.md`

Read all three files first. Then execute tasks in Phase order (1→2→3→4→5→6). Each task has a checkbox
list — check items off as you complete them. Run the full gate suite at the end (Task 14).

If you encounter ambiguity, the spec takes precedence. All user decisions are recorded in section 5 of
the spec ("Key Decisions Recap") and section 4 (Environment Variables).

---

## Using Subagents for Thorough Code Coverage

**The codebase has many files. Use subagents to explore in parallel before writing code.** Before starting
each Phase, dispatch subagents to read relevant files in parallel:

- **Explorer subagent**: `subagent(agent="explore", description="...", prompt="...")` for quick codebase searches.
  Use thoroughness level "medium" for most phases, "very thorough" when docs coverage is critical.

- **General subagents**: `subagent(agent="general", description="...", prompt="...")` for deeper analysis
  tasks like "read all player UI components and summarize their props and state" or "analyze the admin
  component tree and list all CSS classes used."

### Suggested subagent usage per Phase:

1. **Phase 1 (Foundation)**: One explore subagent to verify all codename references across the repo:
   `grep -r "RIVE" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json"` etc. Also
   search for "Rive" to find display names. One general subagent to read `utils/config.js` +
   `utils/db.js` + `utils/adminConfig.js` (to be created) and confirm the SQLite pattern.

2. **Phase 2 (Admin UI)**: One explore subagent to read all admin components + CSS files + the existing
   admin pages to understand current patterns. One general subagent to analyze what shadcn/ui components
   are already installed (check `admin/components.json` or `admin/package.json`). Use "very thorough"
   mode — every CSS class in `admin.css`, `theme.css`, `legacy.css`, `legacy-overrides.css` matters.

3. **Phase 3 (Player + Landing)**: One explore subagent to read `player/src/styles/*.css` (all 15 landing
   CSS files + controls + tokens + theme) and `player/src/components/marketing/*`. One general subagent
   to analyze the player's component hierarchy and list all CSS variables used.

4. **Phase 4 (Docs)**: One explore subagent to read ALL docs MDX pages + docs CSS + docs components. Use
   "very thorough" — every docs page needs to be updated. One general subagent to analyze the docs
   `source.ts` + `source.config.ts` + `meta.json` for the docs structure.

5. **Phase 5 (AI Infrastructure)**: One general subagent to create the MCP server by reading the
   `@modelcontextprotocol/sdk` usage pattern and generating `mcp/src/index.ts`.

**Key subagent patterns:**

```
# Explore: quick codebase scan
subagent(agent="explore", description="Find all codename refs", prompt=`
Find every file that references "RIVE", "Rive V", "Rive P", or "Rive DUB" in the codebase.
List the file path, line number, and the exact text. Also search for "RIVE" case-insensitively.
Search in: *.ts, *.tsx, *.js, *.json, *.mdx files.
Be very thorough — check tests, docs, and all source files.
Return a table of all matches.
`)

# General: deep analysis
subagent(agent="general", description="Analyze admin component tree", prompt=`
Read all files in admin/components/ and admin/app/*.tsx. For each file, summarize:
1. What it renders (UI tree)
2. What CSS classes it uses
3. What API endpoints it calls
4. Any TODO or FIXME comments

Return a structured JSON object with all findings. Be very thorough — this is for a full rewrite.
`)
```

After each exploration, integrate the findings and proceed with implementation.

---

## Codebase Quick Reference

### Architecture

| Component | Path | Port | Tech |
|-----------|------|------|------|
| API Server | `apiServer.js` | 8787 | Express |
| Admin | `admin/` | 3003 | Next.js + Fumadocs-ui |
| Player | `player/` | 3001 | Next.js + Video.js + Hls.js |
| Docs | `docs/` | 3002 | Fumadocs 15 |
| mini-web | `mini-web/` | — | Next.js (lightweight) |
| Proxy | `proxy/proxyServer.js` | — | Express middleware (mounted in API server) |
| MCP Server | `mcp/` | — | Standalone TypeScript (to be created) |

### Key files for this work

| File/Dir | Purpose |
|----------|---------|
| `player/src/lib/servers.ts` | Provider codenames — CHANGE RIVE→PRIME/STELLAR/NEXUS/ORBIT |
| `providers/rive.js` | Rive provider — update PROVIDERS array display names |
| `utils/config.js` | Config system — add PEAK_DOCS_URL |
| `utils/embedToken.js` | AES-256-GCM token signing (for admin token docs) |
| `utils/playerService.js` | Stream resolution + PREFERRED_ORDER |
| `proxy/proxyServer.js` | Media proxy with /m3u8-proxy /ts-proxy /sub-proxy routes |
| `utils/adminConfig.js` | To be created — Admin config DB CRUD |
| `routes/adminConfigRoutes.js` | To be created — Admin API routes |
| `apiServer.js` | Mount new admin routes here |
| `player/src/app/page.tsx` | Landing page — rewrite with MagicUI |
| `player/src/app/layout.tsx` | Player SEO metadata |
| `docs/app/layout.tsx` | Docs SEO metadata |
| `docs/app/page.tsx` | Docs landing page |
| `admin/app/layout.tsx` | Admin SEO metadata |
| `admin/app/page.tsx` | Admin dashboard — update styling |
| `admin/components/Sidebar.tsx` | Add Tokens/Proxies/Features nav |
| `docs/content/docs/` | All docs MDX pages — expand + create new ones |
| `docker-compose.yml` | Add admin + docs services |
| `.env.example` | Add PEAK_DOCS_URL |

---

## User Decisions (all answered)

1. **Codenames**: PRIME (Apogee), STELLAR (Vanguard), NEXUS (Pulse), ORBIT (Citadel). Technical keys (`rive apogee` etc.) stay internal.
2. **Env var**: `PEAK_DOCS_URL` (runtime) + `NEXT_PUBLIC_DOCS_URL` (build-time). Default: `https://docs.peak-player.com`.
3. **Docs scope**: Everything. All features documented with code snippets.
4. **Landing page**: Full styling overhaul. MagicUI cards. Live demo iframe to `/embed/demo`. TMDB/trending images for card backgrounds. Syntax-highlighted code blocks. No fake SVG markups (use real images/videos).
5. **Admin UI**: Big-bang rewrite. Fumadocs-ui + shadcn/ui. AMOLED monochrome theme. Code formatting/colors. Add Token management, Proxy management, Feature toggles.
6. **SEO**: All three apps (player/docs/admin). OpenGraph + Twitter Cards + JSON-LD. Subdomain structure: `docs.peak-player.com`, `admin.peak-player.com`, `app.peak-player.com`.
7. **llms.txt**: At repo root. Links to AI docs + `docs/llms-full.txt` (concatenated inline).
8. **AI docs**: Mirror human docs at `docs/content/docs/ai/`. AI-optimized: direct, code-heavy, less prose.
9. **MCP server**: `mcp/` dir. Standalone TypeScript. stdio only. Full repo read access + docs search tools.
10. **Token management**: Create + list + revoke + analytics (table + usage charts).
11. **Proxy management**: Create + list + revoke + health dashboard.
12. **Feature toggles**: 15 features as dedicated admin pages. SQLite `peak_config` table with `config_json` column.
13. **IPTV toggles**: Master enable-all toggle + per-category toggles.
14. **Docker**: 4 services (peak, player, admin, docs). Per-service `.env` files. Both npm and pnpm.
15. **Mini-web**: Separate docs section.
16. **Session handoff**: This prompt + plan/spec/tasks files.

---

## Execution Flow

1. **Start at Phase 1** (Foundation): Tasks 1-3 (codenames, env var, admin DB).
2. **Phase 2** (Admin UI): Tasks 4-7 (tokens, proxies, toggles, styling).
3. **Phase 3** (Player + Landing): Tasks 8-9 (SEO, landing page).
4. **Phase 4** (Docs): Tasks 10-12 (admin API, docs content, docs SEO).
5. **Phase 5** (AI Infrastructure): Task 13 (llms.txt + MCP).
6. **Phase 6** (Final): Task 14 (gates + handoff).

**Key constraint**: Never commit `.env`, `.env.local`, `utils/peak.db*`, `utils/auth-users.json`, `node_modules`,
`.next`, `.source`, sprite caches.

**Dependency order matters**: Codenames (Task 1) must be done before docs content (Task 11). Admin DB (Task 3)
must be done before admin features (Tasks 4-6) and admin API (Task 10).

---

## Commands Reference

```bash
# Install all
npm install
npm --prefix player install
npm --prefix admin install
npm --prefix docs install
npm --prefix mini-web install  # if exists

# Run dev servers
npm run dev  # API on :8787
npm --prefix player run dev    # Player on :3001
npm --prefix admin run dev     # Admin on :3003
npm --prefix docs run dev      # Docs on :3002

# Tests
npm run test:api               # Root tests
npm --prefix player test       # Player tests
npm --prefix docs test         # Docs tests

# Typecheck
npm --prefix player run typecheck
npm --prefix admin run typecheck

# Build
npm --prefix player run build
npm --prefix admin run build
npm --prefix docs run build

# CSS budget
node scripts/check-css-size.mjs

# Full gate
npm run check

# Git
git add -A && git commit -m "docs: complete platform overhaul
- Change provider codenames to PRIME/STELLAR/NEXUS/ORBIT
- Add PEAK_DOCS_URL env var
- Rewrite admin UI with token/proxy/toggle management
- Overhaul player landing with MagicUI + SEO
- Full docs overhaul with AI-optimized docs
- Add llms.txt + standalone MCP server
- Add admin API routes for tokens/proxies/features
- Update docker-compose with 4 services

Spec: docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md" && git push
```

---

## Live Test URLs (after implementation)

| URL | Purpose |
|-----|---------|
| `http://localhost:3011` | Player landing page (styling + SEO) |
| `http://localhost:3011/embed/demo` | Live embed demo |
| `http://localhost:3011/movie/550` | Full player (Fight Club) |
| `http://localhost:3011/tv/1399/1/1` | TV show (Game of Thrones S1E1) |
| `http://localhost:3003` | Admin panel (login + dashboard) |
| `http://localhost:3003/tokens` | Token management page |
| `http://localhost:3003/proxies` | Proxy management page |
| `http://localhost:3003/features` | Feature toggles page |
| `http://localhost:3002` | Docs site |
| `http://localhost:3002/ai` | AI-optimized docs landing |
| `http://localhost:3002/docs/providers` | Provider docs |
| `http://localhost:3002/docs/thumbnails` | Thumbnail docs |
| `http://localhost:8787/api/status` | API status |
| `http://localhost:8787/api/v1/playback/health` | Playback health |

---

## Final Note

This is a large, multi-domain task (docs + SEO + admin UI + player UI + MCP + codenames). Work stream by
stream in Phase order. If a task seems blocked, check the dependency graph in the plan. The spec documents
all decisions — if you're unsure about a design choice, check section 5 ("Key Decisions Recap") first.

The goal is to ship **everything** documented in the spec, with all gates passing, committed and pushed,
and this handoff prompt preserved for the next session.
