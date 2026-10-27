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

| 6 | done | f40273c | Header/Breadcrumb/PosterOverlay, typed English i18n catalogue + t(), muted autoplay policy + tap-to-unmute, optional inert Mux, 20s terminal STREAM_UNAVAILABLE, ErrorState retry/reload; vendored Title removed and documented |

| P1 gate | pass | 3bd0524 | check green; 1440/390 dark+light sweeps of /movie/550 and /embed/demo clean; external-only source expected with placeholder TMDB key; player contrast fix + duplicate diagnostic key |

| 7 | done | 891e8ec | keyless resolver TMDB→Wikidata→Wikipedia→TVMaze→generated, 4s stage budgets, injected deps, no-throw fallback; tmdb getEpisodeDetails/isRealTmdbKey; 10 resolver tests |

| 7 | done | 891e8ec | keyless media resolver (TMDB real key -> Wikidata -> Wikipedia -> TVMaze -> generated), mediaResolver tests, tmdb episode cache/isRealTmdbKey |
| 8 | done | 1543502 | GET /api/v1/media/:type/:id, 6h/15min media cache, stream JSON + SSE media payload, removed literal Peak fallback, player media client/types |

| 9 | done | 84fec9a | artworkResolver six-candidate chain + generated fallback, ArtworkChain/TypographicCard/poster-fallback.svg wired into PlayerRoot, session cache, thumbnail sprite service + POST/GET routes, HLS image-track parser |

| P2 gate | pass | e10aaa25 | npm run check green (116 API, 80 player); 12-shot sweep clean for movie 550, TV 1399, unknown 999999; fixed Next title reassertion and unknown-id artwork |

| 10 | done | 05fb0e58 | in-place IPTV schema migration (seeded/guide + six health columns), idempotent iptv-org seed playlist, transactional upsert preserving enabled/health, iptv-org seeder + config flags, admin numeric-enabled fix, temp-DB test isolation |
