# Vercel Theme Sub-project B — Theme Application — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Peak forest/ivory/lime theme with the Vercel/Geist black-and-white theme (light + dark) across the admin portal, player, embed, landing, and docs, using the modules created in Sub-project A. No CSS file may exceed 200 lines.

**Architecture:** Introduce a shared `ui/` layer (fonts, tokens, base) consumed by all three apps. Swap token values from Peak (`--peak-*`) to Vercel (`--color-*` / `--geist-*`) neutral palette + blue accent, add light/dark theme switching via `data-theme`, and update every component class to reference the new tokens. Fonts become Geist Sans/Mono everywhere.

**Tech Stack:** CSS variables, Tailwind v4 `@theme`, `next-themes` (docs/player), `geist` font files served from `public/assets/fonts/geist/`, Express static (admin).

**Spec:** `docs/superpowers/specs/2026-10-25-vercel-theme-design.md` (sections 3, 4, 5, 6, 9). Sub-project A (CSS split) complete and tagged `phase1-css-split`.

## Global Constraints

- No CSS file may exceed 200 lines (enforced by `npm run check:css`).
- Split first, test, then theme: this plan applies theme on top of the A modules; do not re-merge files.
- Both light and dark themes must be fully styled on every surface (admin, player, embed, landing, docs). No leftover forest/ivory/lime/purple tokens.
- Fonts: Geist Sans + Geist Mono everywhere. Remove Manrope/JetBrains Mono, Bricolage Grotesque, DM Sans.
- Accent: `#0070f3` (links/focus/active). Status: success `#17c964`, error `#f31260` (admin only).
- Light canvas `#ffffff`, dark canvas `#0a0a0a`; muted text/borders light `#eaeaea`, dark `#333333`; fg light `#171717`, dark `#ededed`.
- Theme switching via `data-theme="light"|"dark"` on `<html>`, defaulting to `prefers-color-scheme`.
- Do not commit `.env`, `utils/peak.db*`, `node_modules`, `.next`, `.source`, `tsconfig.tsbuildinfo`, or secrets.
- Player: `npm --prefix player test/typecheck/lint/build`. Docs: `npm --prefix docs test/build/check:links`. Root: `npm run check`.

## Review Focus

- A token rename that misses one file leaves a half-themed surface; grep for old token names (`--peak-`, `--canvas`, `--brand`) must return zero after each task.
- Light/dark parity: every component must have both variants; check both `prefers-color-scheme` values in screenshots.
- Font loading: Geist must load on admin (plain HTML) via `@font-face`; verify no FOUT fallback to system fonts in screenshots.
- `@import` ordering: Tailwind/neutral/preset imports stay first; theme token imports follow.
- Theme toggle must not flash the wrong theme on load (use `suppressHydrationWarning` + blocking script where needed).

---

## Task 1: Shared `ui/` layer (fonts, tokens, base)

**Files:**
- Create: `ui/fonts.css`, `ui/tokens.css`, `ui/base.css`
- Modify: `package.json`? (no — static files served by Express + imported by Next via relative path `../../ui/...`)

**Interfaces:**
- Produces: `ui/fonts.css` (Geist `@font-face` for sans + mono), `ui/tokens.css` (`:root` light + `.dark`/`[data-theme="dark"]` dark Vercel tokens), `ui/base.css` (reset + html/body base using tokens).

- [ ] **Step 1:** Obtain Geist font files. Add `geist` to root `package.json` dependencies OR download woff2 from the `geist` package into `public/assets/fonts/geist/`. Preferred: `npm install geist` at root, then copy `node_modules/geist/dist/fonts/*.woff2` to `public/assets/fonts/geist/` and reference them.
- [ ] **Step 2:** Create `ui/fonts.css` with `@font-face` for `Geist Sans` (weights 100-900) and `Geist Mono` (weights 100-900), `font-display: swap`, pointing at `/assets/fonts/geist/*.woff2`.
- [ ] **Step 3:** Create `ui/tokens.css` with light `:root` and dark `[data-theme="dark"]`/`.dark` blocks defining `--color-bg`, `--color-fg`, `--color-muted`, `--color-border`, `--color-accent`, `--color-accent-hover`, `--color-success`, `--color-error`, `--font-sans`, `--font-mono`, plus spacing/radius tokens. Values per spec.
- [ ] **Step 4:** Create `ui/base.css` with reset (`* { box-sizing }`), `html/body` base (bg/fg/font), focus-visible outline using accent, scrollbar styling.
- [ ] **Step 5:** Run `npm run check:css` (all ≤200 lines). Commit: `git add ui && git commit -m "feat: add shared Vercel/Geist UI layer"`.

## Task 2: Admin portal — apply Vercel theme

**Files:**
- Modify: `public/admin/base.css` (swap `--canvas/--surface/--ink/--brand/--accent/--sidebar` values for Vercel tokens; keep class names stable).
- Modify: `public/admin/fonts.css` (import `ui/fonts.css` or inline Geist @font-face).
- Modify: admin HTML templates (in `views/` or inline) to add `<link rel="stylesheet" href="/ui/fonts.css">`, `<link rel="stylesheet" href="/ui/tokens.css">`, `<link rel="stylesheet" href="/ui/base.css">` and a `data-theme` attribute + blocking theme script on `<html>`.

**Interfaces:**
- Consumes: `ui/fonts.css`, `ui/tokens.css`, `ui/base.css`.
- Produces: admin pages render in Vercel light/dark with Geist.

- [ ] **Step 1:** Locate admin HTML templates (`grep -rl "style.css" --include=*.html --include=*.ejs --include=*.pug .` excluding node_modules; or read apiServer.js for `res.render`/`sendFile`). Add the three `ui/` links + theme script.
- [ ] **Step 2:** Update `public/admin/base.css` token values to Vercel palette (light default, dark via `[data-theme="dark"]`).
- [ ] **Step 3:** Add `data-theme` toggle (a small script in the admin layout reading `localStorage` + `prefers-color-scheme`).
- [ ] **Step 4:** Verify admin pages return 200 and render Geist (start API `npm start`, hit `/config.html` or admin route). Capture screenshots at 320/768/1440 both themes, no console errors.
- [ ] **Step 5:** Commit: `git add public/admin public/ui views ... && git commit -m "style: apply Vercel theme to admin portal"`.

## Task 3: Player — apply Vercel theme

**Files:**
- Modify: `player/src/styles/tokens.css` (replace `--peak-*` with Vercel tokens; add light/dark blocks).
- Modify: `player/src/styles/*.css` (rename `--peak-*` references to new tokens; update hardcoded `#05060a`/`#f5f6fb`/`#0c4a34` etc.).
- Modify: `player/src/app/layout.tsx` (fonts: replace Bricolage/DM Sans with Geist via `next/font/google` `Geist`/`Geist_Mono`, or import `ui/fonts.css`).
- Modify: `player/src/app/globals.css` (import `../../ui/tokens.css`? or keep player-local tokens; add theme import).

**Interfaces:**
- Consumes: shared token values.
- Produces: player + landing + embed in Vercel light/dark.

- [ ] **Step 1:** Update `player/src/styles/tokens.css` to define Vercel tokens (`--color-bg`, `--color-fg`, `--color-muted`, `--color-border`, `--color-accent`, `--color-accent-hover`, `--font-sans`, `--font-mono`) in both `:root` (light) and `[data-theme="dark"]`/`.dark`.
- [ ] **Step 2:** Sweep all `player/src/styles/*.css` + `player/src/app/page.tsx` inline styles for `--peak-*`, `#05060a`, `#f5f6fb`, `#0c4a34`, `#c9f26d`, `#d69e2e`, `#f2efe6`, `#07130f` and replace with token references or Vercel palette values. Use grep to find leftovers.
- [ ] **Step 3:** Replace fonts in `layout.tsx` with Geist (next/font/google) and update `--font-display`/`--font-ui` variables; or import `ui/fonts.css`. Keep metadata/icons.
- [ ] **Step 4:** Add `data-theme` handling (next-themes already? player has no next-themes dep — add or use a small blocking script). Simpler: add `next-themes` to player deps and wrap root layout in `<ThemeProvider>`.
- [ ] **Step 5:** Update `player/tests/marketing.test.ts` assertions from `--peak-forest` to the new token names (e.g. `--color-accent`).
- [ ] **Step 6:** Run player typecheck/lint/test/build (all pass). Run `npm run check:css`. Commit: `git add player && git commit -m "style: apply Vercel theme to player and landing"`.

## Task 4: Docs — apply Vercel theme

**Files:**
- Modify: `docs/app/styles/tokens.css` (replace `--color-fd-*` forest/ivory overrides with Vercel tokens).
- Modify: `docs/app/global.css` (keep imports; ensure `ui/tokens.css` consumed or inline).
- Modify: `docs/app/layout.tsx` (fonts: Geist via next/font/google; `RootProvider` theme already enabled).

**Interfaces:**
- Consumes: Vercel tokens.
- Produces: docs in Vercel light/dark with Geist.

- [ ] **Step 1:** Update `docs/app/styles/tokens.css` `:root`/`.dark` `--color-fd-*` to Vercel palette (bg `#ffffff`/`#0a0a0a`, fg `#171717`/`#ededed`, border `#eaeaea`/`#333333`, primary/accent `#0070f3`).
- [ ] **Step 2:** Update `docs/app/global.css` `.peak-docs-*` classes to use Vercel tokens (remove forest/ivory/lime references).
- [ ] **Step 3:** Replace fonts in `layout.tsx` with Geist; keep `RootProvider` theme enabled.
- [ ] **Step 4:** Run docs test/build/check:links (all pass). Run `npm run check:css`. Commit: `git add docs && git commit -m "style: apply Vercel theme to docs"`.

## Task 5: Verification (Phase 2)

**Files:** (no new files; verification + screenshots)

- [ ] **Step 1:** Run `npm run check` (exit 0).
- [ ] **Step 2:** Grep for leftover old tokens: `grep -R "--peak-\|--canvas\|--brand\|--accent: #\|Bricolage\|Manrope\|JetBrains" ui/ player/src/ docs/app/ public/` must return nothing (excluding node_modules/.next).
- [ ] **Step 3:** Capture screenshots at 320/768/1440 for admin, player landing, docs home + quickstart, in BOTH light and dark, via Playwright. Verify no console errors, Geist renders, focus rings visible, reduced-motion respected.
- [ ] **Step 4:** Commit screenshots: `git add docs/public/screenshots && git commit -m "chore: capture Vercel theme verification screenshots"` (or `nothing to commit`).
- [ ] **Step 5:** Tag `phase2-vercel-theme`.

## Next (not in this plan)

Sub-project C (admin Next.js migration), D (API key management), E (repo public) follow. Tasks 11 (settings accessibility) and 12 (final verification) from the original 12-task plan resume after Sub-project E.
