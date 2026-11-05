# Trainingsplan

Personal, offline-first training PWA for Joscha. Swiss German UI, React + TypeScript,
Vite, Dexie/IndexedDB. The original app is preserved unchanged in `legacy/` and is
not included in the production build. No personal exports or credentials are stored
in this repository.

## Run locally

Use Node.js 22.12+ (or Node.js 20.19+) and npm:

```sh
npm ci
npm run dev
```

Open the address printed by Vite. For the real installable/offline build:

```sh
npm test
npm run build
npm run preview
```

The production output is `dist/`. Development mode does not install the offline
service worker. All fonts and icons are bundled locally; basic training requires
no account and makes no external network requests.

## Features

- Editable exercise library: weight/repetitions, bodyweight plus load, holds and reps.
- Free and planned sessions: instant saves, resume after reload, previous values,
  warm-ups, undo removed sets, RPE, notes, rest timer and plate calculator.
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
5. Training data is local to the browser/origin and is not automatically synchronised
   across devices. Changing the hosting URL requires importing a backup on that URL.

Backups deliberately omit the OpenRouter key. Import preserves an existing key on
this device, but never imports a key from a file. No automatic reset is provided.

## Deployment

The intended host in the handover is Cloudflare Pages, using only this repository:

- Repository: `JoschaChristen/trainingsplan-app`
- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`; feature branches can use preview deployments.
- Use a supported Node version (22.12+). No secrets or server-side services are needed.

The app uses relative asset paths and hash routes, so it also works beneath a URL
subdirectory. Upload only the contents of `dist/`, never the repository root or
`legacy/`. Keep the final hostname stable so the phone retains access to its data.

At implementation time GitHub Pages still uses **Deploy from a branch**, **main**,
**/(root)**, at <https://joschachristen.github.io/trainingsplan-app/>. That configuration
serves the old static app and does not build Vite. Do not merge the Vite source into
that production setup without an agreed hosting cutover. No repository settings
were changed and the implementation branch has not been pushed.

PR #1 was merged at `d592c5a3e0ca445eb4463d6a30a506bfa91239db`. Its Pages build passed,
but the deployment timed out (`Timeout reached, aborting!`) while awaiting Pages:
<https://github.com/JoschaChristen/trainingsplan-app/actions/runs/41867685783>.
This is evidence of a deployment timeout, not proof of its underlying cause.

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

## Verification and limits

Verified on 2026-11-05:

- Strict TypeScript and production build pass; 18 automated tests pass.
- Tests cover calculations, fixture migration, duplicate protection, atomic rollback,
  backup secret exclusion, persistence, session resume, incomplete-plan rollback and
  AI schema/reference checks with mocked network responses.
- Chrome UI: imported the synthetic fixture (3 sessions, 25 sets), edited and finished
  a free session, created/activated a cycle, edited percentage load, added a skill stage.
- Production build: stopped the server, reloaded successfully, started a planned
  session offline and retained all three checked sets across another reload.
- Browser backup download verified: valid JSON with 5 synthetic sessions and 30 sets,
  no API key.
- Mobile layouts inspected at 360 px and 390 px. Phone installation, iOS share sheet,
  the user's real export and a real OpenRouter OAuth/model request still need device
  acceptance. No credentials were entered or real training data transmitted.
- `npm audit --omit=dev`: no known production dependency vulnerabilities. The full
  audit reports six low/moderate transitive development-tool findings; no high or
  critical findings remain. Recheck when updating the PWA toolchain.

The local browser test data is synthetic and is not bundled in `dist/`.
