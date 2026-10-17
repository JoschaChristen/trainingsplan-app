# Trainingsplan App

Personal training PWA for one user (Joscha, Switzerland). Lifts + 1RM tracking,
variable-length training cycles, bodyweight skills, AI planning via OpenRouter.

## Read first
- `docs/ROADMAP.md` — stages; work on exactly one stage per session.
- `docs/SPEC.md` — features, data model, calculations, AI contracts.
- `docs/design/README.md` — design tokens and how to read the screen files in `docs/design/screens/`.
- `docs/LEGACY-IMPORT.md` — migrating data from the old app.

## State of the repo
Until stage 1 is merged, the repo root is still the **old app** (vanilla JS, live on
GitHub Pages, holds the user's data). Do not modify or delete it unless the current
stage says so, and never before the user has confirmed the stage-0 export.

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
- Keep changes scoped to the current stage. No drive-by refactors.
- The user is not a full-time developer: in PR descriptions, explain in plain language
  what changed and how to test it on the phone (preview URL steps).

## Commands (after stage 1)
- `npm run dev` — dev server
- `npm run build` — production build to `dist`
- `npm test` — Vitest
