# Trainingsplan App

Personal training PWA for one user (Joscha, Switzerland). Lifts + 1RM tracking,
variable-length training cycles, bodyweight skills, AI planning via OpenRouter.

## Read first
- `docs/ROADMAP.md` — stages (all implemented; follow-up work: one topic per branch + PR).
- `docs/BACKLOG.md` — open follow-up work and its status; update it in the PR that
  changes an item.
- `docs/SPEC.md` — features, data model, calculations, AI contracts.
- `docs/design/README.md` — design tokens and how to read the screen files in `docs/design/screens/`.
- `docs/LEGACY-IMPORT.md` — migrating data from the old app.

## State of the repo
All stages are implemented and live on Cloudflare Pages from `main`. The old app is
kept unchanged in `legacy/` and is still served by GitHub Pages from the
`legacy-pages` branch (it may still hold data on the phone): never modify `legacy/`,
never delete or rewrite `legacy-pages`.

## Rules
- UI text in Swiss Standard German: «ss» instead of «ß», dates `17.10.2026`,
  decimals with a dot (`102.5 kg`), thousands with an apostrophe (`12'500`).
- Code, comments, commit messages, docs: English.
- The app calculates, the AI suggests: 1RM, % → kg, rounding, PRs and plateau
  detection are deterministic code with unit tests. AI output is validated (zod) and
  every change needs an explicit user tap.
- Never commit secrets or personal data. The OpenRouter key lives only on the device.
  The repo is public: no real export files in the repo (use `docs/legacy/sample-export.json`).
- Data safety: Dexie schema changes are additive with tested migrations; backup export
  must always work.
- Mobile first: 360–430 px, touch targets ≥ 44 px, safe-area insets, works offline.
- Keep changes scoped to the task at hand. No drive-by refactors.
- The user is not a full-time developer: in PR descriptions, explain in plain language
  what changed and how to test it on the phone (preview URL steps).

## Commands
- `npm run dev` — dev server
- `npm run build` — production build to `dist`
- `npm test` — Vitest unit tests
- `npm run test:e2e` — Playwright against `dist` (build first)
- `npm run typecheck`, `npm run lint`, `npm run format:check`

GitHub Actions CI runs all checks on every PR; keep them green. A bug fix comes
with a regression test.
