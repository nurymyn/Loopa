# AGENTS.md

Read this first. Then read `docs/HANDOFF.md` for the current state, known issues and the next tasks.

## What this is

Loopa is a short vertical video app (TikTok-style feed) built from the beginner guide
"Свой TikTok за 8 шагов". An Expo app talks to a Fastify API; PostgreSQL is the only datastore.
User-facing docs (README, docs/) are in Russian because the owner reads Russian. Code, comments and this
file are in English. Repo: https://github.com/nurymyn/Loopa (public).

## Repo map

| Path | What |
|---|---|
| `mobile/` | Expo SDK 58 app (React Native 0.88, expo-router). Must keep running in Expo Go: only modules bundled with Expo Go (expo-video, expo-camera, expo-image-picker, expo-secure-store, expo-haptics, expo-clipboard, react-native-svg, ...). No custom dev build. |
| `mobile/src/app/` | Screens; file = route. `(tabs)/` is the bottom bar. |
| `mobile/src/components/` | Feed, video item, sheets, grid, profile view, skeletons. |
| `mobile/src/lib/` | `api.ts` (all HTTP calls), `session.tsx` (auth, mute, unread badge), `types.ts`, hooks. |
| `mobile/src/theme.ts` | Colours, spacing, font sizes. Use it; no ad-hoc colours. |
| `server/src/` | Fastify app: `app.ts`, `routes/*.ts`, `lib/*.ts` (recommendation, notifications, passwords). |
| `server/migrations/` | Numbered SQL migrations, applied by `server/scripts/migrate.ts`. |
| `server/scripts/` | `migrate.ts`, `seed.ts` + `seed-data.ts` (demo data), `fetch-media.ts`. |
| `server/test/api.test.ts` | API tests (node:test) against a real PostgreSQL. |
| `media/` | `manifest.json` and `CREDITS.md`. The clips themselves are not in git (licence); `npm run media` downloads them. |
| `docs/` | Russian docs: ARCHITECTURE, DATABASE, HANDOFF, GUIDE-MAPPING, screenshots. |

## Commands

All from the repo root unless noted.

```bash
npm run setup                     # npm install in server/ and mobile/
docker compose up -d              # PostgreSQL 16 on :5432, user/pass/db = loopa/loopa/loopa
npm run media                     # download the 10 sample clips (needs ffmpeg)
npm run migrate                   # apply pending migrations
npm run seed                      # WIPES the database and loads demo data
npm run dev                       # API on :4000 (tsx watch)
cd mobile && npx expo start       # app; scan the QR code with Expo Go
npm test                          # API tests; needs a migrated + freshly seeded DB
npm run typecheck                 # tsc --noEmit for server and mobile
npm run check                     # typecheck + test
```

Without Docker, point `DATABASE_URL` (in `server/.env`) at any PostgreSQL 16. In CI the seed runs with
`SEED_ALLOW_MISSING_MEDIA=true` because the clips are not downloaded there.

Dev credentials (public, dev only): every seeded account has password `loopa-demo`; `@demo` also has the
bearer token `demo-token`. `POST /api/auth/dev-login` works only while `DEV_AUTH=true`.

## Conventions

- **Migrations:** add `server/migrations/NNN_short_name.sql` with the next number. Never edit a migration
  after it is merged to `main`. Counters on `videos`/`comments` are maintained by triggers; keep it that way.
- **PostgreSQL only.** No SQLite, no in-memory fallbacks in the main code path.
- **API shape:** JSON in camelCase; lists return `{ items, nextCursor }`; errors return `{ error }` via
  `HttpError`. Videos go through `queryVideos()`/`videosByIds()`, people through `PERSON_SELECT`/`toPerson()`.
- **UI strings:** currently inline Russian in the screens. Moving them into one place (`mobile/src/i18n/`)
  is task 2 in `docs/HANDOFF.md`; once that exists, every new string goes there and nowhere else.
- **Styling:** colours, spacing and sizes from `mobile/src/theme.ts`; respect safe areas
  (`useSafeAreaInsets`); loading states use `components/Skeleton.tsx`; failures use `ErrorState`, never crash.
- **No TikTok assets:** no TikTok logos, icons, sounds, names or scraped content. Own palette (lime `#B8F227`
  on black), own app icon, Ionicons for UI icons.
- **Media:** original or properly licensed only. Every file used for demo data is listed in
  `media/CREDITS.md` with source URL, author and licence. Do not commit the clips.
- **Secrets:** none in the repo. `.env` files are git-ignored; only `.env.example` with placeholders.
- **TypeScript strict** in both packages. No `any` in app code (tests may use it).

## Definition of done

A change is done when:

1. `npm run typecheck` passes for both packages.
2. `npm test` passes against a migrated and freshly seeded PostgreSQL; new endpoints have tests.
3. Docs are updated: API table in `README.md`, `docs/ARCHITECTURE.md` / `docs/DATABASE.md` if behaviour or
   schema changed, `docs/GUIDE-MAPPING.md` if a guide step changes status, and `docs/HANDOFF.md`
   (state, known issues, next tasks).
4. You state what you could not verify (for example, behaviour on a real phone).

## Current state and next tasks

See `docs/HANDOFF.md`.
