# Backlog

Open follow-up work after all roadmap stages were implemented. This file is the
state that carries over between sessions: read it at the start, update it in the
same PR that changes an item. Keep entries short; details stay in the linked docs.

Status values: `open`, `needs owner` (only the owner can do it, e.g. on the phone
or in GitHub settings), `decide` (behaviour decision by the owner), `in progress`
(name the branch), `done` (move to the bottom with the PR link, then delete after
a while).

Sources: [`AUDIT-2026-11.md`](AUDIT-2026-11.md) ("Open points", "GitHub
housekeeping"), [`ROADMAP.md`](ROADMAP.md) ("After stage 2 is in use").

## Checks on the phone (Pixel, Android Chrome)

| Item | Status | Notes |
| ---- | ------ | ----- |
| Live site check of the Cloudflare preview / production URL | needs owner | Blocked from cloud sessions |
| Installation as home-screen app, share sheet, import of the real export | needs owner | Comma input (`102,5`) already confirmed on 05.11.2026 |
| OAuth from the installed home-screen app | needs owner | Android may open the callback in a Chrome tab; check the key arrives in the app |
| Real AI request | needs owner | Needs OpenRouter credits; some providers may reject strict JSON-schema keywords (`minLength`) |

## Code and tests

| Item | Status | Notes |
| ---- | ------ | ----- |
| Plan workout blocks in cycles, include them in AI inputs | open | AI summaries still see block sets only as plain sets (volume, best reps) |

Known and intended, no action: backup restore switches AI off (the key is kept).

## GitHub and hosting housekeeping

| Item | Status | Notes |
| ---- | ------ | ----- |
| Require the CI check before merging into `main` | needs owner | Optional; not visible from a session, confirm in Settings → Branches |
| Disable GitHub Pages once the import worked on the phone | needs owner | Old app data on the phone stays until then; never delete `legacy-pages` |

## Done

| Item | Done | Notes |
| ---- | ---- | ----- |
| Behaviour decisions (owner chose variant A for all) | 07.11.2026 | Branch `claude/behaviour-decisions`: "Tag X trainieren" asks when a session runs; copy-forward skips deload weeks; a %-cell without 1RM no longer blocks the session; no legacy "ersetzen" (doc fixed) |
| `useAction` error notice tested; AI cycle plans remapped when merging a backup | 07.11.2026 | Branch `claude/behaviour-decisions` |
| Compare repeated blocks: tab «Blöcke» on Fortschritt | 07.11.2026 | Branch `ccr-492a7b85-yrxhrt` |
| Workout blocks (EMOM, AMRAP, For Time) in a session: logging, result, built-in timer | 07.11.2026 | PR #6 |
| Delete sessions, remove filler subtitles, icon back button, simpler "Zyklus planen" card | 07.11.2026 | Branch `claude/app-features-expansion-ll2qf2` |
| Delete merged/obsolete branches | 06.11.2026 | Only `main`, `legacy-pages` and open PR branches remain |
| Branch protection for `main` and `legacy-pages` | 06.11.2026 | GitHub reports both branches as protected |
