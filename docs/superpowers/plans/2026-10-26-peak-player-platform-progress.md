# Peak player platform — execution progress

Crash-recovery log. One entry per task. Repo branch: feat/player-embed-platform.
Plan: docs/superpowers/plans/2026-10-26-peak-player-platform.md

| Task | Status | Commit | Files / notes |
|---|---|---|---|
| plan | done | 26568a4 | plan committed |
| 1 | done | e903e7b | check pipeline + test:api, CSS budget exemptions, split player.css into stage/feedback, landing background, readable error/nav text, devIndicators off |

## Deviations / rulings

- Tests are the executable contract where prose and test disagree.
- `@videojs/mux-data` real export wins over a plan-named `extensions/mux-data` path.
- Artwork chain exposes six remote candidates, then typographic card, then bundled fallback.
- IPTV channel input accepts `groupTitle` as alias for `group`.
- Task 1: plan-mandated `var(--color-muted)` is a border token, not readable text; used a color-mix mid-tone for error copy and landing secondary text and asserted it. The CSS split also required adding the two new files to `marketing.test.ts` so its reduced-motion assertion still covers them.
