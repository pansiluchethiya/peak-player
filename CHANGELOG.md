# Changelog

All notable changes to Peak are documented here.

## [1.0.0] — 2026-10-23

### Added

- Peak identity across the API, admin portal, Docker images, compose service, health response, and documentation.
- A rebuilt admin portal with an overview dashboard, grouped navigation, live KPIs, provider health, readiness checks, quick actions, endpoints, and activity.
- Light and dark themes with system preference detection and persisted selection.
- Responsive admin layouts with a mobile navigation drawer, card-based provider tables, touch-friendly controls, and a fixed save bar.
- Dashboard provider functional checks with configurable TMDB title IDs.
- Endpoint copy controls, live configuration tabs, and JSON copy/download actions.
- Accessible confirmation modals, focus management, reduced-motion support, and keyboard navigation.
- Self-hosted Manrope and JetBrains Mono fonts and a Peak logo/favicon asset set.

### Changed

- Renamed the package, Docker image, compose service, and container to `peak`.
- Updated the health response to `{ "ok": true, "service": "peak" }`.
- Renamed the Showbox cache namespace to `peak-showbox-cache`.
- Reorganized the admin portal under **Monitor**, **Configure**, and **System**.
- Reworked every existing settings panel while preserving the original API routes, field names, and environment variable compatibility.
- Refreshed README, screenshots, Docker metadata, and CI image naming for Peak.

### Fixed

- Prevented hidden panels and alerts from rendering when the `hidden` attribute is present.
- Fixed mobile provider rows so enabled, cookie, and functional badges remain visible.
- Fixed the mobile clear action so it remains usable at narrow widths.
- Fixed a provider filename sanitizer that could produce an invalid path.
- Ensured dashboard health is populated on deep links that do not start on the overview panel.
- Added hash-change navigation so browser back/forward and direct panel links stay in sync.
