import {
  type SetLog,
  type Exercise,
  type Data,
  type CycleCell,
  type Settings,
  dateAdd,
  today,
} from "./model";
export function estimate(
  s: Pick<SetLog, "weight" | "reps" | "done" | "isWarmup">,
  formula: Settings["oneRmFormula"] = "epley",
): number | undefined {
  if (
    !s.done ||
    s.isWarmup ||
    !s.weight ||
    !s.reps ||
    s.reps < 1 ||
    s.reps > 10
  )
    return;
  const v =
    s.reps === 1
      ? s.weight
      : formula === "epley"
        ? s.weight * (1 + s.reps / 30)
        : (s.weight * 36) / (37 - s.reps);
  return Math.round(v * 2) / 2;
}
export function series(exercise: Exercise, d: Data) {
  if (
    !exercise.trackOneRm ||
    !["weight_reps", "bodyweight_load"].includes(exercise.type)
  )
    return [];
  // Sets from workout blocks are done under fatigue: no 1RM estimate.
  const result = d.sessionExercises
    .filter((x) => x.exerciseId === exercise.id && !x.blockId)
    .flatMap((se) => {
      const session = d.sessions.find((s) => s.id === se.sessionId);
      if (!session) return [];
      const vals = d.sets
        .filter((s) => s.sessionExerciseId === se.id)
        .flatMap((s) => estimate(s, d.settings[0]?.oneRmFormula) ?? []);
      return vals.length
        ? [
            {
              date: session.date,
              value: Math.max(...vals),
              sessionId: session.id,
            },
          ]
        : [];
    });
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
export function currentRm(e: Exercise, d: Data, asOf = today()) {
  const points = series(e, d).filter(
    (p) => p.date > dateAdd(asOf, -42) && p.date <= asOf,
  );
  const best = points.sort(
    (a, b) => b.value - a.value || b.date.localeCompare(a.date),
  )[0];
  const record = d.oneRms
    .filter((r) => r.exerciseId === e.id && r.date <= asOf)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return record && (!best || record.date >= best.date)
    ? {
        value: record.value,
        date: record.date,
        source: record.source === "tested" ? "Getestet" : "Manuell",
      }
    : best
      ? { ...best, source: "Geschätzt" }
      : undefined;
}
export function loadKg(c: CycleCell, e: Exercise, d: Data) {
  if (c.loadMode === "none") return undefined;
  if (c.loadMode === "kg") return c.kg;
  const rm = currentRm(e, d);
  return rm && c.pct !== undefined
    ? Math.round(((c.pct / 100) * rm.value) / e.weightStep) * e.weightStep
    : undefined;
}
// Linear weekly progression used by "Auf folgende Wochen übertragen".
// kg rounds to the weight step; percentages round to 2 decimals so that
// floating-point noise (70 * 1.08 = 75.60000000000001) is never stored.
export function progressed(
  value: number,
  incrementPct: number,
  weeksAhead: number,
  step?: number,
) {
  const raw = value * (1 + (incrementPct / 100) * weeksAhead);
  return step ? Math.round(raw / step) * step : Math.round(raw * 100) / 100;
}
export function plateau(e: Exercise, d: Data, asOf = today()) {
  const points = series(e, d).filter(
    (p) => p.date > dateAdd(asOf, -84) && p.date <= asOf,
  );
  if (new Set(points.map((p) => p.sessionId)).size < 6) return false;
  // Two windows of exactly 42 days each: (asOf-42, asOf] and (asOf-84, asOf-42].
  const recent = points.filter((p) => p.date > dateAdd(asOf, -42)),
    before = points.filter((p) => p.date <= dateAdd(asOf, -42));
  return (
    !!recent.length &&
    !!before.length &&
    Math.max(...recent.map((p) => p.value)) <=
      Math.max(...before.map((p) => p.value))
  );
}
export const volume = (sets: SetLog[]) =>
  sets.reduce(
    (t, s) => t + (s.done && !s.isWarmup ? (s.weight ?? 0) * (s.reps ?? 0) : 0),
    0,
  );
export function platesFor(weight: number, bar: number, plates: number[]) {
  if (weight < bar) return { plates: [], remainder: weight - bar };
  let left = (weight - bar) / 2;
  const result: number[] = [];
  for (const p of [...plates].sort((a, b) => b - a))
    while (left + 1e-8 >= p) {
      result.push(p);
      left = Math.round((left - p) * 1000) / 1000;
    }
  return { plates: result, remainder: left * 2 };
}
export function personalRecords(
  current: SetLog[],
  previous: SetLog[],
  e: Exercise,
  formula: Settings["oneRmFormula"],
) {
  const done = current.filter((s) => s.done && !s.isWarmup && !s.blockId),
    old = previous.filter((s) => s.done && !s.isWarmup && !s.blockId),
    out: string[] = [];
  if (!done.length) return out;
  const best = (ss: SetLog[], field: "seconds" | "reps") =>
    Math.max(0, ...ss.map((s) => s[field] ?? 0));
  if (e.type === "hold" && best(done, "seconds") > best(old, "seconds"))
    out.push(`${e.name}: ${best(done, "seconds")} s`);
  else if (e.type === "reps_only" && best(done, "reps") > best(old, "reps"))
    out.push(`${e.name}: ${best(done, "reps")} Wdh`);
  else {
    if (e.trackOneRm) {
      const now = Math.max(0, ...done.map((s) => estimate(s, formula) ?? 0)),
        prev = Math.max(0, ...old.map((s) => estimate(s, formula) ?? 0));
      if (now > prev) out.push(`${e.name}: ${now} kg e1RM`);
    }
    for (const reps of new Set(done.map((s) => s.reps))) {
      if (!reps) continue;
      const now = Math.max(
          0,
          ...done.filter((s) => s.reps === reps).map((s) => s.weight ?? 0),
        ),
        prev = Math.max(
          0,
          ...old.filter((s) => s.reps === reps).map((s) => s.weight ?? 0),
        );
      if (now > prev) out.push(`${e.name}: ${now} kg × ${reps}`);
    }
  }
  return out;
}
