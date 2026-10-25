# Vercel (Geist) Theme + CSS Modularization — Design Spec

Date: 2026-10-25
Branch: `feat/player-embed-platform`
Status: pending user review

## 1. Goal

Make the admin portal, the Peak player (chrome + landing + embed), and the docs site all use
one Vercel/Geist visual system (black/white light + dark themes), with both themes fully
styled everywhere, and split the oversized CSS files into modular files that the whole
codebase imports. After this refactor, resume the remaining verification and commit work.

## 2. Non-goals

- Changing application logic, routing, or data flow.
- Replacing Tailwind in the player/docs (they keep Tailwind; tokens feed it).
- Rewriting admin HTML templates (keep class names stable; only swap token values).
- Adding new features beyond theming/CSS modularization.

## 3. Visual system (Vercel "black and white")

- Fonts: Geist Sans (text/UI) + Geist Mono (code) everywhere. Drop Manrope/JetBrains Mono
  and Bricolage Grotesque/DM Sans.
- Canvas: `#000000` dark / `#ffffff` light, full-bleed.
- Surfaces: `surface-1` (slightly off canvas), `surface-2` (elevated).
- Borders: `#e5e5e5` light / `#262626` dark.
- Text: `#000000`/`#ffffff` primary, `#666666`/`#888888` secondary.
- Accent: `#0070f3` (Vercel blue) for links, focus rings, primary buttons.
- Motion: 120–160ms transitions; honor `prefers-reduced-motion`.
- Theme attribute: `data-theme="light" | "dark"` on `<html>`, default from `prefers-color-scheme`,
  persisted in `localStorage` (admin) or `next-themes` (player/docs).

## 4. Decisions (pending confirmation)

- D1: Fonts — add the shared `geist` npm package at repo root and serve its woff2 via a single
  `ui/fonts.css` `@font-face` for the admin too. (Alternative B: keep admin on local woff2 and
  use `next/font/google` for Next apps.)
- D2: Accent — standard Vercel blue `#0070f3`. (Alternative: monochrome `currentColor`.)

## 5. Shared `ui/` layer

Create root `ui/` directory:
- `ui/fonts.css` — `@font-face` for Geist Sans/Mono (woff2 from `public/assets/fonts/geist/`)
  and `--font-sans` / `--font-mono` custom properties.
- `ui/tokens.css` — color, spacing, radius, border variables for both themes, keyed by
  `[data-theme]` and `.dark`.
- `ui/base.css` — reset (`box-sizing`, margins) + html/body base.

## 6. CSS split

### Admin (`public/`)
- Split `public/style.css` (2370 lines) into:
  `public/admin/fonts.css`, `admin/base.css`, `admin/layout.css`, `admin/components.css`,
  `admin/charts.css`, `admin/forms.css`, `admin/tables.css`.
- Templates link `ui/fonts.css`, `ui/tokens.css`, `ui/base.css`, then the admin modules.
- Keep existing class names; only swap token values and fonts.

### Player (`player/src/`)
- Split `player/src/app/globals.css` (4198 lines) into `player/src/styles/`:
  `tokens.css`, `reset.css`, `base.css`, `chrome.css`, `landing.css`, `embed.css`,
  `marketing.css`, `theme.css`, `player.css`.
- `globals.css` becomes a thin importer of these.
- Remove `peak-*` forest/ivory tokens; replace with Vercel tokens.

### Docs (`docs/app/`)
- Split `docs/app/global.css` (541 lines) into `docs/app/styles/`:
  `fonts.css`, `tokens.css`, `base.css`, `content.css`, `layout.css`, `api.css`, `home.css`.
- Re-export via imports in `global.css`.

## 7. Rollout order

1. `ui/` layer + fonts + tokens; verify all apps still build.
2. Admin portal: swap to Geist + Vercel tokens, split `style.css`, verify admin pages.
3. Player: split globals, swap tokens, verify player tests + build.
4. Docs: swap fumadocs neutral preset + Tailwind overrides, split global.css, verify build/test/link check.
5. Capture 320/768/1440 screenshots per app for both themes; verify focus/reduced-motion.
6. Commit in logical chunks, then resume verification + Tasks 11/12.

## 8. Verification

- Player: `npm --prefix player test/typecheck/lint/build`.
- Docs: `npm --prefix docs test/build/check:links`.
- Admin: HTTP 200 on key pages; no console errors.
- Screenshots at 320/768/1440 light + dark; focus ring visible; reduced motion honored.
- `npm run check` passes.

## 9. Risks / notes

- Admin portal is plain HTML served by Express; it needs woff2 available under `public/`.
- `next/font/google` Geist is an alternative if `geist` package adds weight.
- Splitting CSS requires updating every `@import`/`<link>`; missed imports will break styling.
- Docs uses fumadocs neutral preset; override its tokens via CSS variables to Vercel palette.
