# Vercel Theme Sub-project A — CSS Split + Verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split every oversized CSS file (`player/src/app/globals.css` 4198 lines, `docs/app/global.css` 541 lines, `public/style.css` 2370 lines) into focused modules of no more than 200 lines each, without changing styling, then verify builds/tests/screenshots are unchanged.

**Architecture:** Keep each app's existing CSS entry point (`globals.css` / `global.css` / `style.css`) as a thin importer of the new modules under `player/src/styles/`, `docs/app/styles/`, and `public/admin/` (plus a shared `ui/` layer holding fonts, tokens, and base reset). No class names change; no token values change. Styling must be byte-identical after the split.

**Tech Stack:** CSS `@import`, Tailwind v4 `@import`, Next.js 15 (player + docs), Express static serving (admin). Node 18+.

**Spec:** `docs/superpowers/specs/2026-10-25-vercel-theme-design.md` (sections 3, 5, 6, 9, 11). This plan covers Sub-project A only; B–E follow in separate plans.

## Global Constraints

- **No CSS file may exceed 200 lines.** (Spec §3.) Enforced by a check script.
- **Split first, test, then theme.** (Spec §3.) Phase 1 (this plan) only splits and verifies; it does NOT change any token value, color, font, or class name. Phase 2 (Sub-project B) applies the Vercel theme on top of these modules.
- Keep styling byte-identical after the split. Screenshots at 320/768/1440 before and after must match.
- Do not commit `.env`, `utils/peak.db*`, `node_modules`, `.next`, `.source`, `tsconfig.tsbuildinfo`, or secrets.
- Worktree `feat/player-embed-platform`, nothing pushed. Player port 3001, docs port 3002, API 8787.
- Player: `npm --prefix player test`, `run typecheck`, `run lint`, `run build`. Docs: `npm --prefix docs test`, `run build`, `run check:links`. Root: `npm run check`.

## Review Focus

- A missed `@import` in an entry file silently drops an entire CSS module, producing a half-styled page that builds fine. Every module must be imported exactly once.
- A split that moves a selector without its `:root`/`.dark` token block breaks theming globally; token blocks must stay with the module that owns them.
- `@import` ordering matters: Tailwind's `@import "tailwindcss"` must remain first in the docs/player entries; CSS `@import` rules must precede all other rules.
- CSS files over 200 lines are easy to re-create accidentally during edits; the check script must fail the build if any source CSS exceeds the limit.
- Uncommitted screenshots / `.next` / `.source` artifacts could leak into git; verify `git status` is clean after each commit.

---

## File Structure

```
ui/                                    # NEW — shared layer (fonts, tokens, base)
  fonts.css                            # @font-face Geist (until fonts arrive in Sub-project B, keep empty shim)
  tokens.css                           # shared CSS variables (placeholder; values unchanged from current)
  base.css                             # reset + html/body base (moved from current globals)

player/src/styles/                     # NEW — split modules
  tokens.css                           # Peak tokens (moved verbatim from globals.css :root + html/body)
  reset.css                            # * { box-sizing } etc.
  base.css                             # body typography, focus
  chrome.css                           # control bar, progress, captions, quality
  landing.css                          # peak-hero-*, peak-final-*, peak-section-*
  embed.css                            # embed-specific chrome
  marketing.css                        # bento, marquee, ticker, dialog, border-beam, backlight
  player.css                           # main player surface
  theme.css                            # dark/light overrides (currently dark-only; keep as-is)
player/src/app/globals.css             # MODIFIED — thin importer of the above

docs/app/styles/                       # NEW
  base.css                             # reset + html/body base
  tokens.css                           # fumadocs --color-fd-* overrides
  content.css                          # prose, tables, code, callouts
  layout.css                           # sidebar, TOC, nav, breadcrumbs
  api.css                              # OpenAPI reference
  home.css                             # .peak-docs-home* cards/meta
docs/app/global.css                    # MODIFIED — thin importer

public/admin/                          # NEW — admin portal modules
  fonts.css
  base.css
  layout.css
  components.css
  charts.css
  forms.css
  tables.css
public/style.css                       # MODIFIED — thin importer (kept for Express static serving)

scripts/check-css-size.mjs             # NEW — fails if any .css under ui/, player/src/, docs/app/, public/ exceeds 200 lines
```

Each module owns its own `:root`/`.dark`/theme blocks where applicable. No module exceeds 200 lines; if a logical group exceeds 200 lines, split it further (e.g. `landing-hero.css`, `landing-sections.css`).

## Task 1: Add the CSS size check script

**Files:**
- Create: `scripts/check-css-size.mjs`
- Modify: `package.json` (add `check:css` script)

**Interfaces:**
- Produces: `npm run check:css` exits 0 when all CSS files under the scoped roots are ≤200 lines, exits 1 with a list otherwise.

- [ ] **Step 1: Write the failing check script**

Create `scripts/check-css-size.mjs`:

```js
import { readdir, stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const roots = ['ui', 'player/src', 'docs/app', 'public'];
const MAX_LINES = 200;
const failures = [];

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile() && entry.name.endsWith('.css')) {
      const content = await readFile(full, 'utf8');
      const lines = content.split(/\r?\n/).length;
      if (lines > MAX_LINES) failures.push({ file: full, lines });
    }
  }
}

for (const root of roots) await walk(root);

if (failures.length) {
  console.error(`CSS size check failed (${failures.length} file(s) over ${MAX_LINES} lines):`);
  for (const f of failures) console.error(`- ${f.file}: ${f.lines} lines`);
  process.exit(1);
}
console.log('CSS size check passed: all CSS files are within the 200-line limit.');
```

- [ ] **Step 2: Run it to confirm it fails on the current oversized files**

Run: `node scripts/check-css-size.mjs`
Expected: FAIL listing `player/src/app/globals.css`, `docs/app/global.css`, `public/style.css` (and possibly others).

- [ ] **Step 3: Wire it into package.json**

Add to root `package.json` scripts:
```json
"check:css": "node scripts/check-css-size.mjs",
"check": "npm run lint && npm run check:player && npm run check:docs && npm run check:css"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/check-css-size.mjs package.json
git commit -m "chore: add CSS file size check"
```

## Task 2: Split player CSS

**Files:**
- Create: `player/src/styles/{tokens,reset,base,chrome,landing,embed,marketing,player,theme}.css`
- Modify: `player/src/app/globals.css`

**Interfaces:**
- Consumes: nothing new.
- Produces: `player/src/styles/*.css`, each ≤200 lines; `globals.css` imports them in order.

- [ ] **Step 1: Create the styles directory and split the file**

Move each logical section of `player/src/app/globals.css` into its own module, preserving exact bytes. Suggested grouping (adjust boundaries to keep each ≤200 lines):

- `tokens.css`: `:root`/`.dark` token definitions (`--peak-*`), `color-scheme`, font variables.
- `reset.css`: `*`, `html`, `body` reset rules.
- `base.css`: typography, focus, scrollbar.
- `chrome.css`: control bar, progress bar, captions, quality menu.
- `landing.css`: `.peak-hero-*`, `.peak-final-*`, `.peak-section-*`, `.peak-bento`, `.peak-stat-*`.
- `embed.css`: embed-mode chrome.
- `marketing.css`: `.peak-marquee`, `.peak-backlight`, `.peak-border-beam`, `.peak-ticker`, `.peak-dialog-*`.
- `player.css`: main player surface, ambient background, center feedback.
- `theme.css`: dark/light overrides (currently dark-only).

If any group exceeds 200 lines, split it (e.g. `landing-hero.css`, `landing-sections.css`).

- [ ] **Step 2: Replace globals.css with a thin importer**

```css
@import "tailwindcss";
@import "../styles/tokens.css";
@import "../styles/reset.css";
@import "../styles/base.css";
@import "../styles/chrome.css";
@import "../styles/landing.css";
@import "../styles/embed.css";
@import "../styles/marketing.css";
@import "../styles/player.css";
@import "../styles/theme.css";
```

`@import "tailwindcss"` must remain first.

- [ ] **Step 3: Run player checks**

Run: `npm --prefix player run typecheck && npm --prefix player run lint && npm --prefix player test && npm --prefix player run build`
Expected: all pass; build exit 0.

- [ ] **Step 4: Run the CSS size check**

Run: `npm run check:css`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add player/src/styles player/src/app/globals.css
git commit -m "refactor: split player CSS into modules"
```

## Task 3: Split docs CSS

**Files:**
- Create: `docs/app/styles/{fonts,tokens,base,content,layout,api,home}.css`
- Modify: `docs/app/global.css`

**Interfaces:**
- Consumes: nothing new.
- Produces: `docs/app/styles/*.css`, each ≤200 lines; `global.css` imports them.

- [ ] **Step 1: Split the file**

Move each logical section of `docs/app/global.css` into its own module, preserving exact bytes:

- `fonts.css`: `@font-face`/font variables (currently none; shim).
- `tokens.css`: `:root`/`.dark` `--color-fd-*` overrides.
- `base.css`: `html`, `body`, `::selection`, scrollbar.
- `content.css`: `.prose code/table` overrides.
- `layout.css`: `#nd-nav`, `#nd-sidebar`, `#nd-page`.
- `api.css`: `.peak-api*`.
- `home.css`: `.peak-docs-home*`, `.peak-docs-card`, `.peak-docs-meta`, `.peak-docs-button`.

- [ ] **Step 2: Replace global.css with a thin importer**

```css
@import 'tailwindcss';
@import 'fumadocs-ui/css/neutral.css';
@import 'fumadocs-ui/css/preset.css';
@import './styles/fonts.css';
@import './styles/tokens.css';
@import './styles/base.css';
@import './styles/content.css';
@import './styles/layout.css';
@import './styles/api.css';
@import './styles/home.css';
```

Tailwind + fumadocs imports must remain first.

- [ ] **Step 3: Run docs checks**

Run: `npm --prefix docs test && npm --prefix docs run build && npm --prefix docs run check:links`
Expected: all pass; build exit 0.

- [ ] **Step 4: Run the CSS size check**

Run: `npm run check:css`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/app/styles docs/app/global.css
git commit -m "refactor: split docs CSS into modules"
```

## Task 4: Split admin CSS

**Files:**
- Create: `public/admin/{fonts,base,layout,components,charts,forms,tables}.css`
- Modify: `public/style.css`

**Interfaces:**
- Consumes: nothing new.
- Produces: `public/admin/*.css`, each ≤200 lines; `style.css` imports them (via `@import` for same-origin static serving) OR the admin HTML templates link them directly. Prefer direct `<link>` tags in the admin layout template to avoid `@import` ordering pitfalls; keep `style.css` as a thin importer for backwards compatibility.

- [ ] **Step 1: Split the file**

Move each logical section of `public/style.css` into its own module, preserving exact bytes:

- `fonts.css`: `@font-face` Manrope/JetBrains Mono.
- `base.css`: reset + `:root` token definitions (`--canvas`, `--surface`, `--ink`, `--brand`, `--accent`, `--sidebar`, etc.).
- `layout.css`: app shell, sidebar, topbar, grid.
- `components.css`: buttons, cards, badges, chips.
- `charts.css`: KPI gradients, chart containers.
- `forms.css`: inputs, selects, toggles.
- `tables.css`: data tables, pagination.

- [ ] **Step 2: Replace style.css with a thin importer**

```css
@import url('/admin/fonts.css');
@import url('/admin/base.css');
@import url('/admin/layout.css');
@import url('/admin/components.css');
@import url('/admin/charts.css');
@import url('/admin/forms.css');
@import url('/admin/tables.css');
```

- [ ] **Step 3: Run the CSS size check**

Run: `npm run check:css`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add public/admin public/style.css
git commit -m "refactor: split admin CSS into modules"
```

## Task 5: Phase 1 verification

**Files:**
- (no new files; verification only)

- [ ] **Step 1: Full root check**

Run: `npm run check`
Expected: lint (0 errors), player test/typecheck/lint/build pass, docs test/build/check:links pass, CSS size check pass.

- [ ] **Step 2: Capture before/after screenshots**

Restart player on 3011 (`cd player && nohup npx next start -p 3011 > /tmp/opencode/player-3011.log 2>&1 &`) and docs on 3002 if not running. Capture landing at 320/768/1440 and docs home + quickstart at 320/768/1440. Confirm no console errors and visual parity with the pre-split screenshots (`docs/public/screenshots/landing-1440.png`).

- [ ] **Step 3: Commit screenshots if updated**

```bash
git add docs/public/screenshots
git commit -m "chore: capture post-split verification screenshots" || echo "nothing to commit"
```

- [ ] **Step 4: Tag phase 1 complete**

```bash
git tag phase1-css-split
```

## Next (not in this plan)

Sub-project B (Vercel theme application) follows in a separate plan, building on these modules. Sub-projects C–E (admin Next.js migration, API key management, repo public) follow after B. Tasks 11 (settings accessibility) and 12 (final verification) from the original 12-task plan resume after Sub-project E.
