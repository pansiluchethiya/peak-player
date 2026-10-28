# mini-web

A deliberately small Next.js app that always behaves as a Peak player: it mints a signed
embed session from the Peak API and mounts the player in an iframe. There is no player
logic here — the iframe is the same Peak player used everywhere else.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in EMBED_PARTNER_API_KEY
npm run dev                  # http://localhost:3021
```

The API (default `http://localhost:8787`) and the player (default `http://localhost:3011`)
must already be running.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Peak API origin used for server-side session minting. |
| `NEXT_PUBLIC_PLAYER_URL` | Player origin; the SDK is loaded from `/peak-embed.js`. |
| `EMBED_PARTNER_API_KEY` | Partner key. Server-only: the browser never receives it. |
| `NEXT_PUBLIC_DEFAULT_MEDIA_TYPE` | `movie` (default) or `tv`. |
| `NEXT_PUBLIC_DEFAULT_MEDIA_ID` | TMDB id (default `550`). |

## Two things the API must allow

1. `EMBED_PARTNERS` must contain the partner whose `apiKey` matches
   `EMBED_PARTNER_API_KEY`.
2. That partner's `origins` must include this app's origin (`http://localhost:3021`
   locally). The player writes a `frame-ancestors` CSP from the signed token, so an
   unlisted origin cannot frame the player.

Example:

```bash
EMBED_PARTNERS=[{"id":"demo","name":"Demo Partner","apiKey":"replace-with-a-long-api-key","origins":["http://localhost:3011","http://localhost:3021"]}]
```

## How it works

1. `components/MiniPlayer.tsx` calls `POST /api/embed/session`.
2. `app/api/embed/session/route.ts` proxies to `POST /api/v1/embed/sessions` with the
   partner key and returns the signed `embedUrl`.
3. The browser loads `peak-embed.js` and calls `PeakEmbed.v2.mount({ target, url })`.
4. If the API or SDK is temporarily unavailable, the component retries once and shows a
   retry button. A failed session never leaves a blank frame.
