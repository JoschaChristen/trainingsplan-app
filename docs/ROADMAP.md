# Roadmap

Build in stages. **One stage = one Claude Code session = one branch + PR.** Each PR gets
a Cloudflare preview URL; the user tests on the phone and merges. Don't start a stage
before the previous one is merged. At the end of a stage, tick its boxes here in the PR.

Specs: `docs/SPEC.md`, design: `docs/design/`, migration: `docs/LEGACY-IMPORT.md`.

---

## Stage 0 — Secure the old data (done by the user, before stage 1 is merged)

- [x] Export button added to the old app (`index.html`).
- [ ] User exported `trainingsplan-export-….json` on the phone and saved it in Files/iCloud.
- [ ] User confirmed the file opens and contains `setLogs`.

**Gate:** stage 1 replaces the old app files. Do not merge stage 1 until the user has
confirmed stage 0. If unsure, ask.

## Stage 1 — Scaffold, design system, data layer, deployment

- [ ] Move the old app (`index.html`, `data.js`, `sw.js`, `manifest.json`, icons) into
      `legacy/` unchanged (reference only, not built or deployed).
- [ ] Vite + React + TS (strict) app at the repo root; `npm run build` → `dist`.
- [ ] Design tokens as CSS variables, self-hosted Barlow / Barlow Condensed, base
      components (Card, Button primary/outline/ghost, Chip, Segmented, IconButton,
      BottomSheet, Toast, Badge with skew).
- [ ] App shell: 5-tab bottom nav, routes for all screens (placeholders are fine),
      safe-area insets, 360–430 px widths.
- [ ] Dexie schema v1 with all tables from SPEC §2 and a migration test.
- [ ] Settings screen with Daten: backup export (share sheet / download) and backup import.
- [ ] `navigator.storage.persist()` on first launch.
- [ ] PWA: manifest (new name, dark theme color `#0A1628`, new icons in the new style),
      `vite-plugin-pwa`, offline app shell, update toast.
- [ ] Vitest set up; CI-free is fine (Cloudflare builds on push).
- [ ] README (English) with dev/build/deploy instructions.

**Accept:** preview URL installs as an app on iPhone, opens offline, looks like the
design shell, backup export produces a file.

## Stage 2 — Legacy import, exercises, live training

- [ ] Legacy importer with preview + mapping editor + date correction (LEGACY-IMPORT.md),
      tested against `docs/legacy/sample-export.json`.
- [ ] Seed exercise library (German names).
- [ ] Übungen screen: list, search, filter, create/edit (design 07), archive.
- [ ] Live training (design 02): free session and session from a cycle day, set table
      per exercise type, prefill, Vorher column, + Satz, + Aufwärmsatz, delete with undo,
      done toggle, RPE last set, rest timer, plate calculator, add/swap exercise,
      autosave, finish summary with PRs.
- [ ] 1RM / PR calculations with unit tests (SPEC §3).

**Accept:** user imports the real export file on the phone and sees the old sessions;
can log a complete session in the gym.

## Stage 3 — Progress (lifts) and overview

- [ ] Fortschritt Lifts (design 05) without the AI parts: chips, ranges, SVG line chart,
      tested-max markers, per-lift list, lift detail, add tested/manual 1RM.
- [ ] Plateau detection (rule-based) + card (button disabled until stage 6).
- [ ] Übersicht (design 01) with real data (cycle card may show an empty state until stage 4).

## Stage 4 — Cycles

- [ ] Cycle list, create/edit (name, start, weeks, days, exercises, deloads).
- [ ] Week matrix (design 03) with sticky column, % / kg toggle, cell editor sheet,
      copy-forward and +x % helpers, templates.
- [ ] Activate cycle; Übersicht "Heute" and Training prefill from the active cycle.

## Stage 5 — Skills

- [ ] Skills screen (design 06): skills, editable stages with criteria, linked exercises,
      weekly bests chart, automatic "Stufe erreicht?" prompt.
- [ ] Skill card on Übersicht.

## Stage 6 — AI (OpenRouter)

- [ ] Connection: OAuth PKCE + manual key fallback, model setting, test call, off switch.
- [ ] Shared AI client: structured output, zod validation, retry, `AiRun` log, error UI.
- [ ] 6.1 Cycle proposal → draft cycle.
- [ ] 6.2 Weekly check-in (design 04) + home badge.
- [ ] 6.3 Cycle review card.
- [ ] 6.4 Plateau analysis.
- [ ] 6.5 Skill stage proposal.
- [ ] 6.6 Questions about own data (design 05 input + answer card).

## After stage 2 is in use

- [ ] User disables GitHub Pages for this repo (Settings → Pages), once the import
      worked. The old app's data on the phone stays until then.
