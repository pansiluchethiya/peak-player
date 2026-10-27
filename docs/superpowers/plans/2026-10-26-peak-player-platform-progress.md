# Peak player platform — execution progress

Crash-recovery log. One entry per task. Repo branch: feat/player-embed-platform.
Plan: docs/superpowers/plans/2026-10-26-peak-player-platform.md

| Task | Status | Commit | Files / notes |
|---|---|---|---|
| plan | done | 26568a4 | plan committed |
| 1 | done | e903e7b | check pipeline + test:api, CSS budget exemptions, split player.css into stage/feedback, landing background, readable error/nav text, devIndicators off |
| 2 | done | 873c3ee | routes/streamRoutes.js four handlers, real ?source= selection + second guard, eventsPath query params, apiServer wiring, playerService tests |
| 3 | done | 49bd578 | pinned @videojs/react+hlsjs-video+mux-data 10.2.0, removed video.js direct dep and its CSS import, engineSource/errors adapters + 12 tests |
| 4 | done | 8a13012 | components.json, vendored videojs skin (45 files) + README, VideoSkin wrapper, skin.css token map, tailwind source scan |

## Deviations / rulings

- Tests are the executable contract where prose and test disagree.
- `@videojs/mux-data` real export wins over a plan-named `extensions/mux-data` path.
- Artwork chain exposes six remote candidates, then typographic card, then bundled fallback.
- IPTV channel input accepts `groupTitle` as alias for `group`.
- Task 1: plan-mandated `var(--color-muted)` is a border token, not readable text; used a color-mix mid-tone for error copy and landing secondary text and asserted it. The CSS split also required adding the two new files to `marketing.test.ts` so its reduced-motion assertion still covers them.

| 5 | done | a73bf26 | one module-scope videojs store, PlayerRoot/Provider/useMediaEngine/MediaSurface, prefs schema/defaults, six routes moved, eight legacy files deleted; review fix round restored sidecar tracks, autoplay/ended, media-error failover, inert external chrome, NOT_READY guards |
