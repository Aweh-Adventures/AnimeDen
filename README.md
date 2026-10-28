# Anime Den

A free anime site for friends: a watchlist tracker, WhatsApp episode pings, and a daily character guessing game.
Full plan in [SPEC.md](SPEC.md). Data from [AniList](https://anilist.co).

## Develop

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # typecheck + production build into dist/
```

## Deploy (GitHub Pages)

Every push to `main` builds and deploys via `.github/workflows/deploy.yml`.
One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The build uses a relative base path and hash routing (`/#/tracker`), so it works at
`https://<user>.github.io/<repo>/` with no extra config.

## Build progress

- [x] Phase 1: scaffold, routing, layout, dark/light theme, AniList helper, Pages deploy
- [x] Phase 2: tracker core
- [ ] Phase 3: tracker sharing
- [ ] Phase 4: daily game
- [ ] Phase 5: endless mode + polish
- [ ] Phase 6: WhatsApp notifier
- [ ] Phase 7 (optional): AniList login + sync

## AniList helper (`src/lib/anilist.ts`)

- `anilist(query, variables, { ttl })`: cached in `localStorage` (default 1h), max 30 requests/min,
  retries with backoff on 429 / network / 5xx errors, dedupes identical in-flight requests.
- Throws if a `Media(...)` / `media(...)` query lacks `isAdult: false`. Nested connections
  like `Character.media` can't take that argument; filter them with `dropAdult()`.
- `fetchMediaByIds(ids)` batches 50 ids per request.
