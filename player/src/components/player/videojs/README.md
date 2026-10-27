# Vendored Video.js React skin

This tree is an editable fork of the `@videojs/video` Shadcn registry item:

```
npx shadcn@latest add @videojs/video --overwrite --yes
```

- Registry: `@videojs` → `https://shadcn.videojs.org/r/react/{name}.json`
- Shadcn config: `player/components.json` (aliases point at `@/components/player`)
- Generated output: `ui/**` (skin primitives), `video/**` (the `skin.tsx` entry,
  behaviours, controls and menus), `styles/**` (controls/themes CSS) and
  `lib/resolve-class-name.ts`.
- Wrapper (our single entry point): `player/src/components/player/VideoSkin.tsx`
  imports `./videojs/video/skin`.

Re-running the registry command overwrites these files. Re-apply the local edits
below afterwards.

## Local edits (keep in sync with upstream)

1. **`lib/resolve-class-name.ts` relocated.** Generated as `player/src/lib/resolve-class-name.ts`
   (the registry uses the configured `lib` alias); moved into the vendored tree so
   the fork is self-contained. All `@/lib/resolve-class-name` imports were rewritten
   to `@/components/player/videojs/lib/resolve-class-name`.

2. **Tailwind theme block extracted from `globals.css`.** The CLI appended the skin's
   `@theme inline` / `@custom-variant` / `@utility` definitions to
   `player/src/app/globals.css`, which blew the repo's 200-line CSS budget. The block
   now lives verbatim in `styles/tailwind.css` and is imported from `globals.css`
   right after `@import "tailwindcss"`. The vendored prefix is exempt from the budget.

3. **`globals.css` scan + token wiring.** `@source "../components/player/videojs";`
   makes Tailwind pick up utility classes used by the vendored TSX, and
   `@import "../styles/skin.css";` (after `tokens.css`) maps the packaged `--media-*`
   variables onto Peak tokens.

4. **Dependencies.** The CLI added `@videojs/core` (imported directly by `ui/*`) and
   `cn` (used by `lib/resolve-class-name.ts`). `@videojs/core` is pinned to the exact
   `10.2.0` family version; the CLI's rewrite of `@videojs/react` to `^10.2.0` was
   reverted to the exact `10.2.0` pin.

5. **Stylesheets.** `video/skin.tsx` already imports `../styles/video/base.css`, which
   transitively imports `./captions.css` and `./theme.css`. No extra `@import`s are
   added to `skin.css` (duplicating them would double-emit the skin CSS).

6. **`chromeInert` on the skin entry.** Task 5 added an optional `chromeInert` prop.
   When true, the chrome layers (`Poster`, indicators, controls, hotkeys,
   gestures, status indicators) are wrapped in a `display: contents` element carrying
   `inert` and `aria-hidden`, while `children` (the media element or external iframe)
   stay interactive. Used for external providers that own their own transport.

7. **Generated `<Title />` removed (Task 6).** `Header` (Peak chrome) owns the
   title so it is rendered exactly once and is localised. Edited
   `video/skin.tsx`:
   - removed `import { Title } from '@/components/player/videojs/ui/title';`
   - removed `<Title />` from the chrome group, between `<ErrorDialog />` and
     `<DefaultVideoControls />`.

   Reason: the generated title duplicated the Peak header and could not be
   translated or laid out with the rest of the chrome. The `ui/title.tsx`
   primitive is left in place for a future upstream re-vendor; only the import
   and render call were removed.

## Not ours to change yet

`<VideoHotkeys />` is still rendered by `video/skin.tsx`. Task 18 replaces the
control bar and hotkey layer; leave them in place when re-vendoring.
