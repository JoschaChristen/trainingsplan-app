# Legacy import (old app → new app)

The old app (vanilla JS, `index.html` + `data.js` at the repo root, deployed on GitHub
Pages) stored data in IndexedDB on the **GitHub Pages origin**. The new app runs on a
different origin (Cloudflare) and cannot read that database. Migration therefore goes
through a file:

1. The old app got an export button (round download icon above the reset button).
   It writes `trainingsplan-export-YYYY-MM-DD.json`.
2. The user saves that file on the phone (Files / iCloud).
3. The new app imports it under Einstellungen → Daten → «Alte App importieren».

**The export file contains personal training data. Never commit it to this repo (the
repo is public).** Tests use the synthetic fixture `docs/legacy/sample-export.json`.

## Export format (version 1)

```jsonc
{
  "format": "trainingsplan-legacy-export",
  "version": 1,
  "exportedAt": "2026-10-17T09:30:00.000Z",
  "source": { "app": "trainingsplan-app (GitHub Pages)", "dbName": "TrainingsPlan", "dbVersion": 3 },
  "currentWeek": 3,                 // from localStorage tp_current_week
  "plan": { ... },                  // the full PLAN object from data.js (see below)
  "setLogs": [ ... ]                // all rows of the IndexedDB store "setLogs"
}
```

### `plan` (copy of `data.js`)

```jsonc
{
  "name": "8-Wochen Kraftzyklus – Freitag Open Gym",
  "startDate": null,
  "weeks": [
    {
      "id": 1, "label": "Woche 1",            // optional: "isDeload": true, "isTest": true
      "exercises": [
        { "id": "sq1", "name": "Kniebeuge", "sets": 5, "reps": 5, "weight": 68, "unit": "kg",
          "rest": "3 Min", "desc": "…", "isTopSet": true }   // all fields except id/name optional
      ]
    }
  ]
}
```

Exercise ids are **per week** (`sq1` … `sq8`), and names vary between weeks
(e.g. "Kniebeuge" vs "Kniebeuge – 5RM Test").

### `setLogs` rows

One row per (week, exercise):

```jsonc
{
  "id": "3_sq3",                   // `${week}_${exerciseId}`
  "week": 3,
  "exerciseId": "sq3",
  "sets": [ { "weight": 73, "reps": 4, "done": true }, … ],   // weight/reps may be null
  "status": "planned" | "skipped" | "substituted",            // may be missing → "planned"
  "substituteName": "KH-Bankdrücken" | null,
  "note": "…" | null,
  "updatedAt": 1792221658358       // ms epoch of the last edit — the ONLY time information
}
```

## Mapping rules

### Exercises
Group the per-week plan exercises into real exercises. Default mapping (show it in an
import preview where the user can rename, merge, split or change the type before
committing):

| New exercise | Type | Category | 1RM | Legacy ids |
|---|---|---|---|---|
| Kniebeuge | weight_reps | Beine | yes | sq1–sq8 |
| Bankdrücken | weight_reps | Drücken | yes | bp1–bp8 |
| Strict Press | weight_reps | Drücken | yes | sp1–sp8 |
| Weighted Pull-up | bodyweight_load | Ziehen | no | pu1, pu2, pu6 |
| Explosive Pull-up | bodyweight_load | Ziehen | no | pu3, pu4, pu5, pu7b |
| Muscle-up | reps_only | Skill | no | pu7, pu8 |
| Ring-MU Negative | reps_only | Skill | no | mu1, mu2 |
| Banded MU-Transition | reps_only | Skill | no | mu3, mu4 |
| False-Grip Hold/Transition | reps_only | Skill | no | mu5 |

Implement this as a mapping table in code, plus a generic fallback for ids not in the
table: strip suffixes like " – 5RM Test" / " Test", group by normalised name, type =
`weight_reps` if the plan has `unit: "kg"` and weight > 0, else `reps_only`. Store the
original legacy names in `Exercise.aliases`.

### Cycle
Create one `Cycle` with `createdBy: 'legacy'`, name = `plan.name`, weeks = number of
plan weeks, one `CycleDay` "Freitag", `deloadWeeks` from `isDeload`. Each plan exercise
becomes a `CycleCell` with `loadMode: 'kg'` (`kg = weight`, `sets`, `reps`; `desc` →
`note`; weeks with `isTest` get note "Testwoche"). Status `completed` (the user can
reactivate it in the cycles screen). `startDate` = the date of the week-1 session
(see dates below).

### Sessions and sets
- One `Session` per plan week that has at least one setLog with data.
- `Session.date` = the local date (Europe/Zurich) of the **earliest** `updatedAt` among
  that week's rows; `dateIsApproximate: true`. In the preview show these dates per week
  and let the user correct them (offer "wöchentlich ab Datum X" as a quick fill).
- Each setLog row → `SessionExercise` (status mapped 1:1, `note` copied).
  - `skipped` → no sets imported.
  - `substituted` → create (or reuse by name) a custom exercise `substituteName`
    with the same type as the original; the SessionExercise points to it and keeps
    `substitutedFromExerciseId`.
- Each set with `weight != null || reps != null` → `SetLog`
  (`isWarmup: false`, `done` copied; for `bodyweight_load` the weight is the added load).
- Week-8 "5RM Test" sets are normal sets (they feed the e1RM estimate). Do **not**
  create `OneRmRecord`s from the legacy data.

### Safety
- Import is all-or-nothing in one Dexie transaction.
- If a cycle with `createdBy: 'legacy'` already exists, warn and offer "ersetzen"
  (delete previous legacy import) or "abbrechen".
- After import, show a summary (exercises, sessions, sets) and offer a backup export.
- Unit-test the importer with `docs/legacy/sample-export.json`.
