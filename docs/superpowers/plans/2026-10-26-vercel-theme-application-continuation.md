# OVERNIGHT CONTINUATION PROMPT — Vercel Theme + Admin Fix + Video.js Player

## Branch / State

- **Branch:** `feat/player-embed-platform` @ HEAD `d9f7ef6`
- **Working dir:** `/home/pansilu/.local/share/opencode/worktree/950f13/peak-player-embed-platform`
- **Task status:** Sub-project B Task 6 (admin scaffold) committed. **Task 3 (player theme) subagent IS RUNNING IN BACKGROUND** — `ses_e8c17390cffeCeXq6TJ539Y8kG` — DO NOT touch `player/` files until it finishes or is cancelled.
- Phase 1 (Sub-project A CSS split) complete + tagged `phase1-css-split` (before this work).

---

## PALETTE (FINAL — USER @187@ DIRECTIVE)

**AMOLED monochrome. No blue (#0070f3 removed entirely).**

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--color-bg` / `--canvas` | `#ffffff` | `#000000` | AMOLED pure black dark bg |
| `--color-fg` / `--ink` | `#0a0a0a` (very dark) | `#ededed` | |
| `--color-muted` | `#eaeaea` | `#333333` | |
| `--color-border` | `#eaeaea` | `#333333` | |
| `--color-accent` | `#333333` | `#e5e5e5` | gray, NO blue |
| `--color-accent-hover` | `#171717` | `#ededed` | |
| `--color-success` | `#17c964` | `#17c964` | KEEP (functional status) |
| `--color-error` | `#f31260` | `#f31260` | KEEP (functional status, admin only) |
| Focus ring | `rgba(51,51,51,0.25)` | `rgba(229,229,229,0.25)` | gray, no blue |

**Fonts:** Geist Sans + Geist Mono everywhere. NO Bricolage Grotesque, DM Sans, Manrope, JetBrains Mono.
**Geist woff2 files:** Already at `public/assets/fonts/geist/{geist-sans.woff2,geist-mono.woff2}` (tracked). `ui/fonts.css` @font-face points to `/assets/fonts/geist/*.woff2`.

---

## SHARED LAYER (already complete — don't modify unless broken)

- `ui/fonts.css` — Geist Sans + Mono @font-face (weights 100 900, font-display swap).
- `ui/tokens.css` — `--color-bg/fg/muted/border/accent/accent-hover`, `--font-sans`, `--font-mono`, `--space-*`, `--radius-*`. Dark under `[data-theme="dark"]`.
- `ui/base.css` — reset + html/body base via tokens, focus-visible outline via `--color-accent`.
- `public/theme.js` — data-theme toggle, meta-color `#000000`/`#ffffff`, localStorage + prefers-color-scheme fallback.

---

## WHAT WAS DONE (DO NOT REPEAT)

### Phase 1 (Sub-project A) — COMPLETE, tagged
- Split `player/src/app/globals.css` (4198→29 modules), `docs/app/global.css` (541→8 modules), `public/style.css` (2370→18 modules + thin importer). All ≤200 lines. `check:css` passes.
- `player/tests/marketing.test.ts` updated to read styles dir.

### Palette Redirect — COMPLETE
- Spec `docs/superpowers/specs/2026-10-25-vercel-theme-design.md` section 4 updated: AMOLED dark `#000000`, blue removed, gray accent.
- `ui/tokens.css` updated: dark `#000000`, gray accent, fg `#0a0a0a` light / `#ededed` dark.
- `public/theme.js` meta-color dark `#000000`.

### Sub-project B Task 1 — COMPLETE (commit 3f23767)
- Created `ui/fonts.css`, `ui/tokens.css`, `ui/base.css`.

### Sub-project B Task 2 — COMPLETE (commit daed1f1 + d083875 + 48d5cf9)
- Full rewrite of `public/admin/tokens.css` — all blue→gray, dark canvas→#000000.
- `public/admin/base.css` radial gradients blue→gray.
- `public/admin/layout-5.css` gradients + fills → AMOLED/gray.
- `public/admin/{components,layout,tables}.css` — sed bulk replace rgba blue→gray.
- Deleted manrope + jetbrains woff2.
- Verified check:css pass, server 200s.

### Sub-project B Task 6 (admin Next.js scaffold) — COMPLETE (commit d9f7ef6)
- `admin/` new Next.js 15 app with fumadocs UI + AMOLED theme.
- Files: `admin/package.json` (next 15.5.28, fumadocs-ui 15.8.5, lucide-react, clsx), `admin/next.config.mjs` (standalone), `admin/tsconfig.json`, `admin/postcss.config.mjs`, `admin/app/layout.tsx` (AMOLED dark, blocking theme script, ThemeProvider, suppressHydrationWarning), `admin/app/globals.css` (thin importer: tailwindcss→fumadocs neutral/preset→../../ui/fonts+tokens+base→./theme.css→./admin.css), `admin/app/theme.css` (AMOLED monochrome overrides), `admin/app/admin.css` (91 lines), `admin/app/page.tsx` (dashboard), `admin/app/login/page.tsx` (session check, password toggle, lockout), `admin/components/{Header,Sidebar,ThemeToggle,ThemeProvider}.tsx`.
- `admin/public/assets/fonts/geist/` has geist-sans.woff2 + geist-mono.woff2.
- `apiServer.js` +32 lines: `/admin/*` → proxy to 3003.
- `package.json` +3: `concurrently` dev script (ports: player=3011, admin=3003, api=8787).
- `scripts/check-css-size.mjs` updated: `admin/` added to roots.
- Admin build: `npm --prefix admin run build` → ✓ 5 static pages, no errors.
- Screenshots: `docs/public/screenshots/admin-login-dark-1440.png`, `admin-login-light-1440.png`.

### Task 3 (player theme) — **STOP THE SUBAGENT** (ses_e8c17390cffeCeXq6TJ539Y8kG)

**URGENT — USER IS LEAVING:** The Task 3 subagent was dispatched before the user's overnight break. It has NOT completed (no `task-3-report.md`, no commit since `d9f7ef6`). **STOP/CANCEL IT immediately.** Re-dispatch fresh after completing Task 1' (admin proxy fix) and Task 2' (Video.js player), per the new priority order below. Do NOT touch `player/` files until the subagent is confirmed stopped.
- Subagent `ses_e8c17390cffeCeXq6TJ539Y8kG` working on: tokens.css rewrite, CSS sweep, layout.tsx Geist fonts, border-beam.tsx hex→vars, marketing.test.ts assertions, theme switching.
- Do NOT touch `player/` until subagent completes or is cancelled.

### Task 3 subagent (ses_e8c17390cffeCeXq6TJ539Y8kG) — status check
- **AS OF THIS WRITING:** Subagent still running in background. No task-3-report.md yet. Check `task-3-report.md` for status. If the subagent is still active, either let it finish or cancel and dispatch fresh.
- **When complete:** Player theme applied (tokens.css AMOLED monochrome, layout.tsx Geist, border-beam.tsx vars, tests updated). Commit `c202a8f style: apply Vercel AMOLED monochrome theme to player and landing`. Reviewer dispatched.
- Player running on port 3011 (started before subagent). Need to verify screenshots at 3011.
- **IF subagent finished:** Task 4 (docs theme) and Task 5 (verification) are NEXT.
- **IF subagent still running / cancel:** Re-dispatch Task 3 with the task-3-brief.md (palette is already updated).

---

## PRIORITY ORDER (USER @175@/187@ DIRECTIVE)

1. **STOP Task 3 subagent** (`ses_e8c17390`) — stale, blocks player files. Then **FIX admin auth/proxy** — admin pages fail because `/auth/*` requests to port 3003 have no proxy. Add `rewrites` to `admin/next.config.mjs`.
2. **Fix admin UI + theme** — complete the admin Next.js migration (routes, styling), AMOLED cards + modals.
3. **Video.js embed player** — use Video.js as primary, hls.js as fallback. Install + test extensively.
4. **Continue Vercel theme** — Tasks 3 (player, in progress) → Task 4 (docs) → Task 5 (verification).
5. **Bug sweep + final verification** — `npm run check` exit 0, screenshots, fix everything.
6. **Refine repo + merge with main** — clean up, ensure `.gitignore` correct, merge branches.

---

## TASKS TO COMPLETE

### Task: Fix admin auth/proxy (HIGHEST PRIORITY — user said "doesn't work at all")

**Problem:** `admin/app/login/page.tsx` fetches `/auth/session` and `/auth/login` (relative URLs). When the admin Next.js app runs on port 3003 (standalone), these requests hit `localhost:3003/auth/*` which doesn't exist. The API server with auth routes runs on port 8787.

**Fix:** Add Next.js `rewrites` to `admin/next.config.mjs`:

```js
async rewrites() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8787';
  return [
    { source: '/auth/:path*', destination: `${API_URL}/auth/:path*` },
    { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
    { source: '/config.html', destination: `${API_URL}/config.html` },
  ];
}
```

**Then:** rebuild admin (`npm --prefix admin run build`), restart on 3003, verify `/auth/session` returns 401 (or 200 with session cookie), login page works, dashboard loads.

**Note:** When accessed through the API server's `/admin/*` proxy, `/auth/*` requests go to the API server directly (correct origin). But the user is likely testing `localhost:3003` directly, so rewrites are needed.

### Task: Migrate ALL admin HTML pages to Next.js routes

**Context:** The original Express admin had only `public/config.html` and `public/index.html`. But the apiServer.js likely has many more routes/endpoints (providers, IPTV, branding, partners, config). The user wants ALL admin pages migrated.

**Check:** grep apiServer.js + utils/config.js for admin routes, res.render/sendFile calls, and API endpoints that the admin consumed. The original HTML pages made fetch calls to these endpoints.

**Files that exist:**
- `public/index.html` — original login/branding page (old)
- `public/config.html` — original config page (old)
- `public/admin/*.css` — old Express-served CSS (kept for legacy but new app uses admin/app/*.css)

**Action:**
1. Identify all API endpoints in apiServer.js that the admin needs (GET/POST /auth/*, /api/*, /config/*, providers, IPTV sources, branding, etc.).
2. Migrate the old HTML pages' functionality into Next.js routes in `admin/app/`:
   - `/` — dashboard (done)
   - `/login` — login page (done)
   - `/providers` — provider management
   - `/iptv` — IPTV sources
   - `/config` — configuration
   - `/branding` — branding settings
   - `/partners` — API partners/keys
   - `/api-keys` — API key management (from original spec)
3. Reuse `admin/components/` patterns (Header, Sidebar with nav links).
4. Each new page must use fumadocs UI components, Geist fonts, AMOLED theme.

**Important:** The old `public/style.css` is now a thin importer (split in Phase 1). The old HTML pages (`public/*.html`) are still served by Express for backward compat. The user wants to fully migrate to Next.js — the old HTML files can be removed or kept as fallback.

### Task: Video.js embed player

**Problem:** No Video.js installed. User wants Video.js as primary player, hls.js as fallback.

**Files involved:**
- `player/src/components/Player.tsx` — current player (uses hls.js)
- `player/src/app/embed/[id]/page.tsx` — embed player route
- `player/src/components/border-beam.tsx` — border-beam effect
- `player/src/app/embed-demo/page.tsx` or similar embed demo

**Action:**
1. Install `video.js` + `@videojs-player/react` in `player/` (or video.js + videojs-contrib-hls if needed for older browsers — modern browsers use native HLS or VHS).
2. Create a `VideoJSEmbedPlayer` component that:
   - Uses Video.js with `@videojs-player/react`.
   - Attempts native HLS first; falls back to hls.js; Video.js as base.
3. Update the embed route to use the new component.
4. Test extensively across browsers (Chrome, Safari, Firefox).
5. Keep the AMOLED monochrome styling + border-beam effect working on the Video.js player.
6. Update any tests.

### Task: Player theme verification (Task 3 follow-up + Task 5)

**After Task 3 subagent completes:**
1. Verify player running on port 3011 (AMOLED dark bg #000000, gray accent, Geist fonts).
2. Capture screenshots at 320/768/1440 — light + dark.
3. Run `npm --prefix player test` — should be 42/42.
4. Update SDD ledger.

### Task 4: Docs theme

**Files:**
- `docs/app/styles/tokens.css` — replace Vercel blue `#0070f3` references with AMOLED gray. Dark bg → `#000000`.
- `docs/app/styles/{base,content,layout,home,api}.css` — remove blue, use AMOLED palette.
- `docs/app/global.css` — keep imports.
- `docs/app/layout.tsx` — Geist fonts via next/font/google, fumadocs RootProvider theme.

**Verify:** `npm --prefix docs test` (3/3), `npm --prefix docs run build`, `npm run check:links`.

### Task 5: Verification

1. `npm run check` exit 0 (lint + player + docs + css + links).
2. Grep for leftovers: `grep -R -- "--peak-\|--canvas.*#|0070f3\|#1b5c42\|Bricolage\|Manrope\|JetBrains" ui/ player/src/ docs/app/ public/admin/ admin/` → must be empty.
3. Screenshots (via playwright browser_take_screenshot since chrome-devtools MCP has issues):
   - Admin: `/`, `/login`, `/providers`, `/config` — light + dark × 1440/768/320.
   - Player: `/` landing, embed player — light + dark × 1440/768/320.
   - Docs: `/` (home), `/docs/quickstart` — light + dark × 1440/768/320.
4. `npm run check` green.
5. Commit screenshots.
6. Tag `phase2-vercel-theme`.

### Final: Merge + repo refinement

- Merge `feat/player-embed-platform` into `main`.
- Ensure `.gitignore` excludes `.env`, `utils/peak.db*`, `node_modules`, `.next`, `.source`, `tsconfig.tsbuildinfo`.
- Ensure no secrets in git history.
- User said "refine repo + merge branch with main" — do this LAST after all verification passes.

---

## PORTS

- Player: 3011 (`npm --prefix player run dev`)
- Admin: 3003 (`npm --prefix admin run dev` or `npm start` after build)
- Docs: 3002 (`npm --prefix docs run dev`)
- API: 8787 (`npm start` from root)
- Root dev script uses `concurrently` to run all (check package.json for exact `dev:all` script name)

## LOGS

- Player: `/tmp/opencode/player-3011.log`
- Admin: `/tmp/opencode/admin-3003.log`
- Docs: `/tmp/opencode/docs-3002.log`

## CHECKS COMMANDS

```bash
# From repo root
npm run check:css
npm run check  # runs lint + check:player + check:docs + check:css

# Sub-apps
npm --prefix player run typecheck && npm --prefix player run lint && npm --prefix player test && npm --prefix player run build
npm --prefix admin run build
npm --prefix docs test && npm --prefix docs run build && npm --prefix docs run check:links
```

## SD D WORKSPACE

- Ledger: `.superpowers/sdd/2026-10-26-vercel-theme-application/progress.md`
- Task briefs: `task-N-brief.md`
- Task reports: `task-N-report.md`
- Reviewer diffs: `review-*.diff`
