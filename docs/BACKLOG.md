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

## Behaviour decisions

| Item | Status | Notes |
| ---- | ------ | ----- |
| "Tag X trainieren" while another session runs | decide | Currently opens the running session without notice |
| Copy-forward overwrites deload weeks | decide | Possibly intended |
| One %-cell without current 1RM blocks the whole session | decide | After 6 weeks without an e1RM the planned day cannot start |
| Legacy re-import "ersetzen" option | decide | `LEGACY-IMPORT.md` mentions it; code only refuses (safe default) |

## Code and tests

| Item | Status | Notes |
| ---- | ------ | ----- |
| Error toast wiring in `useAction` | open | `errorText` is unit-tested, its use in `useAction` is not |
| Unaccepted AI cycle plans after merging a backup into another install | open | Exercise ids in stored AI output are not remapped; workaround: request the plan again |

Known and intended, no action: backup restore switches AI off (the key is kept).

## GitHub and hosting housekeeping

| Item | Status | Notes |
| ---- | ------ | ----- |
| Delete merged/obsolete branches | needs owner | List with restore SHAs in `AUDIT-2026-11.md` |
| Branch protection for `main` and `legacy-pages` (block deletion and force pushes) | needs owner | Deleting `legacy-pages` takes the old app offline |
| Require the CI check before merging into `main` | needs owner | Optional |
| Disable GitHub Pages once the import worked on the phone | needs owner | Old app data on the phone stays until then; never delete `legacy-pages` |

## Done

_Nothing yet._
