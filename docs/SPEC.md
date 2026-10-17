# Trainingsplan App — Product & Technical Spec

Personal training app for one user (Joscha). Tracks strength lifts (weight × reps,
estimated 1RM over time) and bodyweight skills (e.g. handstand hold times), plans
training cycles of variable length, and uses an LLM via OpenRouter to help plan and
review. Installable PWA, offline-first, all data on the device.

UI language: **Swiss Standard German** (no «ß», use «ss»). Code, comments, commits: English.

---

## 1. Principles

1. **Logging must be fast.** In the gym the user logs between sets with one hand.
   Values are prefilled (from the plan or the last session); confirming a set is one tap.
2. **Free input everywhere.** Weight, reps and number of sets are always editable.
   Sets can be added and deleted. Custom exercises are first-class.
3. **The app calculates, the AI suggests.** All numbers that matter (1RM, kg from %,
   rounding, PR detection, volume, plateau detection) are deterministic code. The LLM
   only proposes plans/changes and explains; its output is validated and the user
   accepts or rejects every change.
4. **Local-first, no backend.** Data lives in IndexedDB. Backup = JSON export/import.
5. **Never lose data.** Schema migrations are additive and tested; export is always
   reachable in Settings.

---

## 2. Data model (Dexie / IndexedDB)

IDs are string UUIDs (`crypto.randomUUID()`). Dates are ISO strings (`YYYY-MM-DD` for
days, full ISO for timestamps). Weights in kg (number, may be fractional).

```ts
type ExerciseType =
  | 'weight_reps'      // barbell, dumbbell, machine: kg × reps
  | 'bodyweight_load'  // pull-up/dip with added load: +kg × reps (0 = bodyweight)
  | 'hold'             // handstand, L-sit, plank: seconds
  | 'reps_only';       // push-ups, pistols: reps

interface Exercise {
  id: string;
  name: string;                 // as the user writes it, e.g. "Kniebeuge"
  type: ExerciseType;
  category: 'Beine' | 'Drücken' | 'Ziehen' | 'Rumpf' | 'Skill' | 'Conditioning' | 'Andere';
  trackOneRm: boolean;          // default true for weight_reps, false otherwise
  unilateral: boolean;          // values are per side
  weightStep: number;           // 1 | 1.25 | 2.5 (default 2.5) — used for rounding
  isCustom: boolean;
  archived: boolean;
  aliases?: string[];           // e.g. legacy names merged into this exercise
  createdAt: string;
}

interface Session {             // one training day
  id: string;
  date: string;                 // YYYY-MM-DD
  startedAt?: string;
  finishedAt?: string;
  cycleId?: string;             // set when started from a cycle
  week?: number;                // 1-based cycle week
  dayId?: string;               // CycleDay.id
  title?: string;               // e.g. "Unterkörper"
  note?: string;
  dateIsApproximate?: boolean;  // true for legacy imports (see LEGACY-IMPORT.md)
}

interface SessionExercise {     // an exercise within a session, ordered
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  status: 'planned' | 'done' | 'skipped' | 'substituted';
  substitutedFromExerciseId?: string;
  plannedEntryId?: string;      // CycleEntry this came from
  rpeLastSet?: number;          // 6–10, optional (only the last work set is rated)
  note?: string;
}

interface SetLog {
  id: string;
  sessionExerciseId: string;
  exerciseId: string;           // denormalised for fast queries
  date: string;                 // denormalised from Session
  order: number;
  isWarmup: boolean;
  weight?: number;              // kg; for bodyweight_load = added kg
  reps?: number;
  seconds?: number;             // for hold
  done: boolean;
}

interface OneRmRecord {         // only for TESTED maxes; estimates are derived
  id: string;
  exerciseId: string;
  date: string;
  value: number;                // kg
  source: 'tested' | 'manual';  // manual = user typed a known 1RM
  note?: string;
}

interface Cycle {
  id: string;
  name: string;
  startDate: string;
  weeks: number;                // 1–52, free
  deloadWeeks: number[];        // e.g. [8]
  status: 'draft' | 'active' | 'completed' | 'archived';
  goal?: string;
  createdBy: 'user' | 'ai' | 'template' | 'legacy';
  createdAt: string;
}

interface CycleDay { id: string; cycleId: string; label: string; order: number; title?: string; }

interface CycleEntry {          // one exercise on one cycle day
  id: string;
  cycleId: string;
  dayId: string;
  exerciseId: string;
  order: number;
}

interface CycleCell {           // what to do in a given week
  id: string;
  entryId: string;
  week: number;
  sets: number;
  reps?: number;                // or repsText for ranges like "8-10"
  seconds?: number;             // hold exercises
  loadMode: 'pct' | 'kg' | 'none';
  pct?: number;                 // % of current 1RM, e.g. 80
  kg?: number;
  note?: string;
}

interface Skill {
  id: string;
  name: string;                 // "Handstand"
  currentStage: number;         // index into stages
  createdAt: string;
}

interface SkillStage {
  id: string;
  skillId: string;
  order: number;
  name: string;                 // "Freistehend halten"
  exerciseId?: string;          // exercise whose logs measure this stage
  criterion: { kind: 'hold_seconds' | 'reps' | 'custom'; target?: number; text?: string };
  achievedAt?: string;
}

interface AiRun {               // audit log of every AI call and its result
  id: string;
  kind: 'cycle_plan' | 'weekly_checkin' | 'cycle_review' | 'plateau' | 'skill_stages' | 'data_qa';
  createdAt: string;
  model: string;
  inputSummary: string;         // what was sent (no secrets)
  output: unknown;              // validated JSON
  decisions?: Record<string, 'accepted' | 'rejected'>;
}

interface Settings {            // single row, id = 'settings'
  oneRmFormula: 'epley' | 'brzycki';   // default 'epley'
  barWeight: number;                   // 20
  plates: number[];                    // available plates per side, default [25,20,15,10,5,2.5,1.25]
  defaultRestSeconds: number;          // 120
  openRouterApiKey?: string;           // device only, never exported by default
  openRouterModel?: string;
  lastBackupAt?: string;
}
```

Indexes to add at minimum: `SetLog: exerciseId, date, sessionExerciseId`,
`SessionExercise: sessionId, exerciseId`, `Session: date, cycleId`,
`CycleCell: entryId`, `CycleEntry: cycleId, dayId`, `OneRmRecord: exerciseId, date`.

---

## 3. Calculations (deterministic, unit-tested)

**Estimated 1RM per set** (only `weight_reps`, and `bodyweight_load` if `trackOneRm`):
- Ignore warm-up sets, sets not `done`, and sets with reps > 10 (formulas get unreliable).
- reps = 1 → e1RM = weight.
- Epley: `weight × (1 + reps / 30)`. Brzycki: `weight × 36 / (37 − reps)`.
- Display rounded to 0.5 kg.

**1RM curve for charts:** per session, the best e1RM of that session. Tested/manual
maxes (`OneRmRecord`) are drawn as separate markers (diamond), not mixed into the line.

**Current 1RM** (used for % → kg): the most recent of (a) latest tested/manual record,
(b) best e1RM within the last 6 weeks. Show which source is used.

**% → kg:** `round(pct/100 × current1RM / weightStep) × weightStep`.

**PR detection:** new best e1RM for an exercise, new best weight at a given rep count,
new best hold time, new best reps (reps_only).

**Plateau detection (rule-based):** for each 1RM-tracked exercise with ≥ 6 sessions in
the last 12 weeks: if the best e1RM of the last 6 weeks is not higher than the best of
the 6 weeks before, flag "Plateau". Only flagged lifts get the "KI-Analyse" button.

**Plate calculator:** greedy per side from `settings.plates`, after subtracting
`barWeight`; show remainder if not exactly loadable.

**Week volume:** sum of weight × reps of done work sets, per exercise and per category.

---

## 4. Screens

Visual reference: `docs/design/` (read its README first).

### 4.1 Übersicht (home)
- Greeting + date. AI badge (count of pending AI suggestions) → check-in screen.
- Active cycle card: name, `WOCHE n/N` badge, segmented progress bar, next deload and end date.
- Today card (baby-blue): next planned day of the active cycle, its exercises with
  planned sets × reps · kg (computed), "Training starten". Without an active cycle:
  "Freies Training starten" + "Zyklus erstellen".
- 1RM tiles for the 4 most-trained 1RM exercises: current value, sparkline (8 points),
  delta since cycle start or 3 months; plateau shown in muted color.
- Skill card for the most recently trained skill: stage n of N, progress to target, best value.

### 4.2 Training (live session)
- Header: back, `Woche n · Tag X`, title, rest timer pill (starts automatically when a
  set is checked; default from settings; tap to adjust/skip; vibrate at 0 if supported).
- One card per exercise; the active one expanded, others collapsed with `done/total`.
- Set table columns depend on exercise type:
  - weight_reps: Satz | Vorher | kg | Wdh | ✓ | delete
  - bodyweight_load: Satz | Vorher | + kg | Wdh | ✓ | delete
  - hold: Satz | Vorher | Sek. | ✓ | delete (optional built-in stopwatch)
  - reps_only: Satz | Vorher | Wdh | ✓ | delete
- "Vorher" = same set index from the last session of this exercise.
- Prefill: from the cycle cell (kg computed from %), else from the last session.
- Buttons: "+ Satz" (copies last work set), "+ Aufwärmsatz" (inserted before work sets,
  label `W`, ~60 % of work weight), delete per set (with undo toast).
- Optional RPE for the last work set (buttons 6–10 with short German hints).
- Plate calculator button on barbell exercises.
- "Übung hinzufügen oder tauschen" (search library, or create new inline).
- Sticky bottom: "Einheit abschliessen" → summary (PRs, volume) → save.
- **Autosave** every change immediately (a crash or reload must not lose sets).

### 4.3 Zyklen
- List: active cycle on top, drafts, completed (with AI review card if available).
- Create/edit cycle: name, start date, weeks (free number), days (add/rename/reorder),
  exercises per day, deload weeks.
- **Week matrix** per day: rows = exercises, columns = weeks; horizontal scroll with a
  sticky first column; current week highlighted (baby), past weeks dimmed, deload dashed.
  Cell shows `sets×reps` and `% / kg / s`. Toggle `%` ↔ `kg` view.
- Tap a cell → bottom sheet editor (sets, reps or seconds, load mode, value, note) with
  "auf folgende Wochen übertragen" and "+x % pro Woche" helpers.
- Templates: linear progression, wave (3 up / 1 down), "deload last week".
- Buttons: "KI-Vorschlag" (see 6.1) and "Aus Vorlage".
- Only one cycle can be active.

### 4.4 Fortschritt — Lifts
- Segmented "Lifts | Skills".
- Data question field ("Frag deine Daten …") → AI answer card (6.6).
- Lift chips (toggle series), line chart of e1RM over time (range 3M / 6M / 1J / Alle),
  tested maxes as diamonds, plateau series dashed.
- List per lift: current value, delta, last tested max.
- Plateau card for flagged lifts with "KI-Analyse und Vorschläge" (6.4).
- Tapping a lift → detail: full history table, best sets per rep count, edit/delete
  tested maxes, add a tested/manual 1RM.

### 4.5 Fortschritt — Skills
- Skill chips + "+ Neuer Skill".
- Hero card: current stage, best value, target, progress bar.
- Bar chart of best value per week (last 10 weeks).
- Stage ladder: done (✓), current (lime border), locked (dashed). Stages are fully
  user-editable; "KI-Stufen vorschlagen" (6.5).
- A stage is achieved automatically when a logged set of its linked exercise meets the
  criterion; the app then asks to advance (never silently).

### 4.6 Übungen
- Library list with search and category filter; custom badge; archive instead of delete
  when the exercise has logs.
- New/edit exercise: name, type ("Wie wird erfasst?"), category, toggles (1RM berechnen
  for weight types; Einseitig), weight step 1 / 1.25 / 2.5, live preview of the set row.
- Seed library: a small set of common lifts and skills **in German**, plus everything
  that came from the legacy import.

### 4.7 Einstellungen (from a gear icon on Übersicht)
- 1RM formula, bar weight, plates, default rest time.
- KI: connect OpenRouter (6.0), model choice, "KI-Funktionen aus" switch.
- Daten: Export (JSON), Import (JSON backup or legacy export), last backup date,
  reminder if last backup > 14 days.

---

## 5. Backup / import

- **Export:** one JSON file `{ format: 'trainingsplan-backup', version, exportedAt, data: {table: rows[]} }`.
  Exclude `openRouterApiKey` by default. Use Web Share API with a File where available
  (iOS share sheet → Files), fallback to download.
- **Import backup:** validate (zod), preview counts, then replace-all or merge-by-id.
- **Import legacy:** see `docs/LEGACY-IMPORT.md`.
- Ask the browser for persistent storage (`navigator.storage.persist()`) on first launch.

---

## 6. AI features (OpenRouter)

### 6.0 Connection
- Endpoint: `https://openrouter.ai/api/v1/chat/completions` (OpenAI-compatible), called
  directly from the browser.
- Getting a key: preferred **OAuth PKCE** flow (`https://openrouter.ai/auth?callback_url=…&code_challenge=…&code_challenge_method=S256`,
  then POST the `code` + `code_verifier` to `https://openrouter.ai/api/v1/auth/keys`).
  Fallback: paste a key manually. Verify both against current OpenRouter docs during
  implementation, including that CORS allows browser calls.
- Key stored only on the device (Settings row). Never in the repo, never in exports,
  never logged.
- Model is a setting (free text + a short suggested list); don't hard-code a model ID.
- Every call: system prompt in English, user data as compact JSON, **structured output**
  (JSON schema / `response_format`), validated with zod. Invalid → one retry, then show
  an error. All runs stored in `AiRun`.
- The AI never returns kg directly for 1RM-tracked exercises; it returns `pct` (or
  `kg` only for non-1RM exercises), and the app computes and rounds.
- Every suggestion is shown as a diff ("102.5 kg → 105 kg") with Übernehmen / Plan
  behalten per item. Nothing changes without the user's tap.
- AI features are optional: the app is fully usable without a key.

### 6.1 Cycle proposal
Input: goal (free text), weeks, days per week, chosen exercises per day (or "let AI
choose from my library"), deload preference, current 1RM per exercise, last 2 cycles'
plan vs actual summary, recent RPE averages.
Output: `{ days: [{label, title, entries: [{exerciseId, cells: [{week, sets, reps|seconds, loadMode, pct|kg, note?}]}]}], rationale }`.
Shown as a draft cycle in the matrix; the user edits and activates.

### 6.2 Weekly check-in
Trigger: when the last planned session of a cycle week is finished (badge on home).
Input: that week's plan vs actual per exercise (sets/reps hit, kg, RPE last set),
next week's planned cells.
Output: `{ summary, adjustments: [{entryId, week, field, from, to, reason}], unchanged: [entryId] }`.
Screen: stats row (sessions, sets hit, Ø RPE), one card per adjustment, CTA "n Anpassungen übernehmen".

### 6.3 Cycle review
Trigger: cycle completed. Input: full plan vs actual, 1RM start vs end, adherence.
Output: `{ headline, highlights: [{kind: 'up'|'flat'|'info', text}], recommendationsForNext: string[] }`.
Shown on the cycles screen and passed as context to the next 6.1 call.

### 6.4 Plateau analysis
Trigger: user taps on a flagged lift. Input: last 12 weeks of that lift (sessions,
best sets, RPE), its cycle cells, related accessory work.
Output: `{ diagnosis, options: [{title, description, cycleChanges?}] }` — options can be
applied to the next cycle draft.

### 6.5 Skill stages
Input: skill name, user's description of current level, optional existing stages.
Output: `{ stages: [{name, criterion, suggestedExerciseName, notes}], accessoryExercises: [...] }`.
User edits before saving; unknown exercises are created as custom exercises on accept.

### 6.6 Questions about own data
Input: the question + a compact, pre-aggregated data summary built by the app
(per exercise: monthly best e1RM, tested maxes, session counts; per skill: weekly bests;
cycles list). Do not send raw logs wholesale.
Output: `{ answer, figuresUsed: [{label, value, date}] }` — the answer must only use
figures present in the summary; show `figuresUsed` under the answer.

---

## 7. Tech stack

- Vite + React + TypeScript (strict).
- Dexie (IndexedDB) + `dexie-react-hooks` (`useLiveQuery`).
- `vite-plugin-pwa` (Workbox): precache app shell, offline, auto-update with a
  "Neue Version verfügbar" toast.
- React Router.
- zod for all external/AI/import data.
- Charts: hand-written SVG components (the designs are simple; no heavy chart lib).
- Icons: lucide-react. Fonts: @fontsource (self-hosted).
- Tests: Vitest for calculations, migrations and the legacy import.
- Styling: CSS variables for the tokens in `docs/design/README.md` + CSS modules (or
  vanilla-extract). No Tailwind needed, but acceptable if preferred.

## 8. Hosting

Cloudflare Pages connected to this GitHub repo: build `npm run build`, output `dist`,
production branch `main`; every PR gets a preview URL for testing on the phone.
SPA routing: Pages serves `index.html` for unknown paths when no `404.html` exists.
If Cloudflare only offers Workers for new projects, use Workers static assets with
`not_found_handling = "single-page-application"` in `wrangler.toml`.

## 9. Out of scope (for now)

Multi-user, cloud sync, Apple Health / Google Fit, Apple Watch, light theme,
video form check, social features.
