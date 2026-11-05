# Trainingsplan

Personal, offline-first training PWA for Joscha. Swiss German UI, React + TypeScript,
Vite, Dexie/IndexedDB. The original app is preserved unchanged in `legacy/` and is
not included in the production build. No personal exports or credentials are stored
in this repository.

Live: <https://trainingsplan-app-9gt.pages.dev/>

## Run locally

Use Node.js 22.12+ (see `.nvmrc`) and npm:

```sh
npm ci
npm run dev
```

Open the address printed by Vite. Development mode does not install the offline
service worker. For the real installable/offline build:

```sh
npm run build
npm run preview
```

## Checks

| Command                | What it checks                                         |
| ---------------------- | ------------------------------------------------------ |
| `npm run typecheck`    | Strict TypeScript for the app and the e2e tests        |
| `npm run lint`         | ESLint (TypeScript and React hooks rules)              |
| `npm run format:check` | Prettier formatting                                    |
| `npm test`             | Vitest unit tests (`src/**/*.test.ts`)                 |
| `npm run test:e2e`     | Playwright against `dist/` (run `npm run build` first) |

GitHub Actions (`.github/workflows/ci.yml`) runs all of them on every pull request
and on pushes to `main`. Locally, Playwright needs a Chromium build
(`npx playwright install chromium`).

## Features

- Editable exercise library: weight/repetitions, bodyweight plus load, holds and reps.
- Free and planned sessions: instant saves, resume after reload, previous values,
  warm-ups, undo removed sets, RPE, notes, rest timer, plate calculator, swap exercise.
- Training cycles: variable weeks/days, linear and wave templates, editable week
  matrix, percentages or kilograms, copy-forward progression and active-cycle view.
- Deterministic Epley/Brzycki estimates, manually entered/tested maxes, charts, PRs,
  six-week current estimates and rule-based plateau detection.
- Skills with editable stages, criteria, linked exercises, weekly bests and explicit
  confirmation before advancing a stage.
- Legacy import preview with exercise mapping and corrected dates; JSON backup,
  atomic merge/replace and duplicate-import protection. Existing matching exercises
  are reused. Imported historical dates remain labelled as approximate.
- Optional OpenRouter planning, weekly check-in, cycle review, plateau suggestions,
  skill stages and questions about training data. Structured responses are validated;
  proposals are applied only after an explicit tap, and cycle proposals become drafts.

## Move existing data

1. Keep the checked export from the old phone app in Files/iCloud.
2. Open the new HTTPS site on the phone; add it to the home screen.
3. Open settings, select the old JSON export, check exercise mapping and dates, then
   confirm the import. A legacy file may only be imported once to avoid duplicates.
4. Verify the history and export a new backup. Keep the original export too.
5. Training data is local to the browser/origin and is not synchronised across
   devices. Changing the hosting URL requires importing a backup on that URL
   ("Daten zusammenführen" reuses exercises with the same name and type).

Backups deliberately omit the OpenRouter key. Import preserves an existing key on
this device, but never imports a key from a file. No automatic reset is provided.
Real export and backup files are git-ignored; never commit them.

## Deployment

**Cloudflare Pages** (project `trainingsplan-app`, connected to this repository):

- Build command `npm run build`, output directory `dist`, `NODE_VERSION=22`
  (also pinned in `.nvmrc`).
- Production branch `main`; every other branch gets a preview URL.
- No secrets or server-side services are needed. Commits whose message starts with
  `[CF-Pages-Skip]` do not trigger a build.
- The app uses relative asset paths and hash routes, so no `_redirects` or
  `404.html` is needed. Cloudflare's default `max-age=0, must-revalidate` for
  `index.html` and `sw.js` makes updates arrive on the next start.
- Keep the hostname stable: device data and the OpenRouter login are bound to it.

**GitHub Pages** still serves the old app at
<https://joschachristen.github.io/trainingsplan-app/> from the `legacy-pages` branch
(commit `d592c5a`). Do not delete that branch or disable Pages until the phone
migration is confirmed.

## Optional AI

Settings supports OpenRouter OAuth PKCE or manual key entry, a model ID, a connection
test and an off switch. Choose a model supporting structured outputs. An explicit
request sends the described aggregated training summary and any typed question to
OpenRouter; this can consume the user's OpenRouter credits. Raw training notes and
keys are not included in the summary. The key remains in local browser storage.

Protocol references: [OpenRouter OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth)
and [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs).
AI statements are suggestions; validated figure references cannot guarantee the
accuracy of all natural-language explanations.

## Verification history

See [`docs/AUDIT-2026-11.md`](docs/AUDIT-2026-11.md) for the technical audit, its
findings and fixes, what is verified and what still needs a check on the phone.
