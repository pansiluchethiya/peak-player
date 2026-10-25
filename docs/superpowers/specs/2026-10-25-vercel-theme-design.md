# Vercel (Geist) Theme + CSS Modularization + Admin Next.js Migration — Design Spec

Date: 2026-10-25
Branch: `feat/player-embed-platform`
Status: pending user review

## 1. Goal

1. Split every oversized CSS file into modules of **no more than 200 lines each**, verify styling is unchanged, then apply the Vercel/Geist theme.
2. Apply a Vercel/Geist visual system (black/white light + dark themes) with component-specific theming across the streaming app, docs, admin portal, and embed SDK.
3. Migrate the admin portal from Express-served HTML to **Next.js (no exception)**.
4. Add an admin feature to **create and manage API keys**, with extensive docs.
5. Add extensive admin portal documentation.
6. Decide whether to make the repo public, name it, and wire GitHub clone/docs links into the docs.

## 2. Non-goals

- Changing application logic, routing, or data flow beyond the admin migration and API-key feature.
- Introducing secondary/tertiary branding colors (only green=success, red=error status colors).
- Rewriting admin HTML templates' class names (keep stable; swap token values).

## 3. Hard constraints

- **No CSS file may exceed 200 lines.** Split further if needed.
- **Split first, test, then theme.** Phase 1 = split + verify byte-identical styling. Phase 2 = apply Vercel theme on top of the split modules.
- Admin portal moves to Next.js completely; no Express HTML remains.
- Both light and dark themes must be fully styled on every surface.

## 4. Vercel Geist design system (from UX architecture prompt)

Design philosophy: clean Geist-inspired layout, strict monochrome base (black, white, neutral
grays). **AMOLED** dark canvas `#000000`. No blue anywhere — a neutral gray acts as the
surgical interactive accent for monochrome harmony. Stark, flat, crisp typographic hierarchy.
No secondary/tertiary branding colors unless instructed.

### Component themes

1. **Streaming app** — 98% dark monochrome (`#000000` background). UI disappears to emphasize
   video. Neutral gray used only for player progress bars, active sliders, streaming indicators.
2. **Docs & SDK** — hybrid light/dark monochrome, high legibility. Gray for hyperlinks, active
   navigation states, code endpoints, syntax anchors.
3. **Admin portal** — data-dense grid layout using subtle neutral grays for structure. Gray
   strictly for primary CTAs (Save, Edit), selections, interactive links. Add distinct green
   (success) and red (error) for system status.
4. **Embed API / SDK widgets** — strict neutral monochrome (black, white, translucent grays) to
   fit seamlessly on third-party sites. Must accept a customizable `themeColor` parameter to
   override defaults.

### Tailwind / CSS variables

- Background: Light `#ffffff` | Dark `#000000` (AMOLED)
- Foreground: Light `#171717` | Dark `#ededed`
- Muted text / borders: Light `#eaeaea` | Dark `#333333`
- Interactive accent (monochrome gray): Light `#333333` (hover `#171717`) | Dark `#e5e5e5` (hover `#ededed`)
- Status: success `#17c964`, error `#f31260` (admin only).

> **Decision (2026-10-26):** User removed Vercel Blue (`#0070f3`); dark canvas is
> AMOLED `#000000`; entire codebase uses a neutral gray accent for interactivity.

## 5. Shared `ui/` layer

Root `ui/` directory (each file <= 200 lines):
- `ui/fonts.css` — `@font-face` for Geist Sans/Mono (woff2 from `public/assets/fonts/geist/`)
  and `--font-sans` / `--font-mono`.
- `ui/tokens.css` — color/spacing/radius/border variables for both themes.
- `ui/base.css` — reset + html/body base.

## 6. CSS split (<= 200 lines per file)

### Admin (Next.js app under `admin/`)
Split into `admin/src/styles/`: `fonts.css`, `tokens.css`, `base.css`, `layout.css`,
`components.css`, `charts.css`, `forms.css`, `tables.css`, `theme.css`. Each <= 200 lines.

### Player (`player/src/`)
Split `globals.css` into `player/src/styles/`: `tokens.css`, `reset.css`, `base.css`,
`chrome.css`, `landing.css`, `embed.css`, `marketing.css`, `theme.css`, `player.css`.
`globals.css` becomes a thin importer. Each <= 200 lines.

### Docs (`docs/app/`)
Split `global.css` into `docs/app/styles/`: `fonts.css`, `tokens.css`, `base.css`,
`content.css`, `layout.css`, `api.css`, `home.css`. Each <= 200 lines.

## 7. Admin portal migration (HTML → Next.js)

- Create `admin/` Next.js app (port 3003) mirroring player/docs conventions.
- Migrate all admin pages (dashboard, providers, IPTV, config, branding, partners) to
  Next.js routes + React components.
- Remove Express HTML routes and `public/style.css` usage from the API server.
- Admin auth via the existing session mechanism, surfaced in Next.js middleware.
- Add admin docs section to the docs site.

## 8. API key management feature

- Backend: endpoints to create/list/revoke partner API keys (admin-authenticated), stored in
  SQLite or runtime config; keys hashed at rest, shown once on creation.
- Admin UI: create key (name, origins, scopes), list with masked values, revoke.
- Extensive docs: guide + API reference entries + security notes.

## 9. Rollout order

1. CSS split (phase 1): split files, keep styling identical, run builds/tests, verify no visual
   regression via screenshots. Commit `refactor: split oversized CSS files`.
2. Vercel theme (phase 2): apply tokens + component themes on top of split modules, verify
   both light/dark on all surfaces. Commit `style: apply Vercel Geist theme`.
3. Admin Next.js migration: scaffold app, migrate pages, remove Express HTML. Commit
   `feat: migrate admin portal to Next.js`.
4. API key management: backend + admin UI + docs. Commit `feat: add admin API key management`.
5. Admin docs + GitHub/repo public docs updates. Commit `docs: add admin portal and repo docs`.
6. Resume verification + Tasks 11/12, final `npm run check`, screenshots.

## 10. Sub-project decomposition (recommended)

Given size, treat as sub-projects each with its own spec/plan/implementation cycle:
- A. CSS split + verification.
- B. Vercel theme tokens + component theming.
- C. Admin Next.js migration.
- D. API key management + docs.
- E. Repo public / GitHub docs.

We can execute A first (smallest, unblocks everything), then B, then C, D, E.

## 11. Verification

- Player: `npm --prefix player test/typecheck/lint/build`.
- Docs: `npm --prefix docs test/build/check:links`.
- Admin: `npm --prefix admin test/build` (once scaffolded), HTTP 200 on key pages.
- Root: `npm run check` passes.
- Screenshots at 320/768/1440 light + dark for player, docs, admin, embed.
- Focus ring visible; reduced motion honored; no console errors.
- Every CSS file <= 200 lines (enforced by a check script).

## 12. Open questions (resolved 2026-10-25)

- Repo name and public/private decision: **public**, name `peak-player`, GitHub URL
  `https://github.com/pansiluchethiya/peak-player` (repo not yet created; docs use this URL).
- Admin auth: **reuse the existing Express session**, surfaced in Next.js middleware via the
  API's session endpoint. Fastest, most reliable, and best for developers (no new auth
  dependency, no migration, reuses tested code).

## 16. Development tooling (MCPs)

The implementing agent MUST use these MCP servers/libraries during development for easier,
higher-quality work:

- **Magic UI** (`magic-ui` MCP): use `searchRegistryItems`/`getRegistryItem` to find and
  import polished components (marquee, bento grid, border beam, number ticker, hero video
  dialog, etc.) for marketing/landing surfaces. Do not hand-roll what Magic UI already ships.
- **shadcn/ui** (`shadcn-ui` MCP): use `get_project_registries`, `view_items_in_registries`,
  and `get_add_command_for_items` to add accessible Radix-based primitives (button, card,
  dialog, tabs, accordion, etc.) to the admin and player chrome. Do not hand-roll accessible
  primitives.
- **Chrome DevTools** (`chrome-devtools` MCP): use `list_pages`, `screencast_start/stop`,
  and related tools to capture verification screenshots, record interactions, and inspect
  console/network during visual QA.

These are development-time aids; the shipped app must not depend on any MCP at runtime.

## 13. Repo public decision (answer now)

**Recommendation: make it public** as an open-source streaming platform tool, but only after:
- Remove/verify no secrets, `.env`, db files, or provider credentials in git history.
- Add a `LICENSE` (AGPL-3.0), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.
- Add a root `README.md` with clone, install, dev, and test commands.
- Add a `NOTICE` file and a "Credits" section in the README/docs crediting the original creator (Pansilu Chethiya).

**Public GitHub URL (repo not yet created; update docs links to this URL):**
`https://github.com/pansiluchethiya/peak-player`

**Suggested repo name:** `peak-player` (short, memorable) or `peak-player-embed-platform`
(matches current worktree). Recommendation: `peak-player`.

**If public, docs must add:** GitHub clone URL, “Getting started” clone instructions, license
badge, contributing link, issue/PR templates, and a “Star on GitHub” CTA on the docs home.
The docs home Quickstart card meta should also drop the `5 MINUTES` duration estimate.

## 15. Licensing

- **License: AGPL-3.0** (GNU Affero General Public License v3.0).
- **Copyright:** `Copyright (c) 2026 Pansilu Chethiya`.
- Commercial use is permitted, but any derivative or hosted (SaaS) use must be released as open
  source under the same license (AGPL closes the ASP loophole that GPL leaves open).
- Copyright notices and the license text must be preserved in every copy (full credit to the
  original creator).
- Add `LICENSE` (full AGPL-3.0 text), a `NOTICE` file, and a "Credits" section in the README and
  docs crediting Pansilu Chethiya as the original creator.
- Consider a dual-licensing/commercial-license option for paying customers; decide before
  publishing (document in `CONTRIBUTING.md` / `SECURITY.md`).

## 14. Risks

- Admin migration is large; keep Express API as the backend, only move the UI to Next.js.
- CSS split requires updating every `@import`/`<link>`; missed imports break styling.
- Docs uses fumadocs neutral preset; override its tokens via CSS variables to Vercel palette.
- API keys shown once on creation; must be hashed at rest and never logged.
