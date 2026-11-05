import { db } from "./db";
import { type Data, type SetLog, uid, today } from "./model";
import { loadKg } from "./calculations";
export async function addExercise(
  sessionId: string,
  exerciseId: string,
  d: Data,
  entryId?: string,
) {
  const session = await db.sessions.get(sessionId);
  if (!session) throw Error("Einheit nicht gefunden.");
  const e = d.exercises.find((e) => e.id === exerciseId);
  if (!e) throw Error("Übung nicht gefunden.");
  const cell = entryId
    ? d.cells.find((c) => c.entryId === entryId && c.week === session.week)
    : undefined;
  if (cell?.loadMode === "pct" && loadKg(cell, e, d) === undefined)
    throw Error(
      `Für ${e.name} fehlt ein aktueller 1RM. Trage ihn unter Fortschritt ein oder plane kg.`,
    );
  const previousSe = d.sessionExercises
    .filter((x) => x.exerciseId === e.id && x.sessionId !== sessionId)
    .sort((a, b) =>
      (d.sessions.find((s) => s.id === b.sessionId)?.date ?? "").localeCompare(
        d.sessions.find((s) => s.id === a.sessionId)?.date ?? "",
      ),
    )[0];
  const previous = d.sets
    .filter((s) => s.sessionExerciseId === previousSe?.id && !s.isWarmup)
    .sort((a, b) => a.order - b.order);
  const count = cell?.sets ?? (previous.length || 3),
    seId = uid();
  await db.transaction("rw", db.sessionExercises, db.sets, async () => {
    const order = await db.sessionExercises
      .where("sessionId")
      .equals(sessionId)
      .count();
    await db.sessionExercises.add({
      id: seId,
      sessionId,
      exerciseId,
      order,
      status: "planned",
      plannedEntryId: entryId,
    });
    const rows: SetLog[] = Array.from({ length: count }, (_, i) => ({
      id: uid(),
      sessionExerciseId: seId,
      exerciseId,
      date: session.date,
      order: i,
      isWarmup: false,
      done: false,
      weight: ["weight_reps", "bodyweight_load"].includes(e.type)
        ? cell
          ? loadKg(cell, e, d)
          : previous[i]?.weight
        : undefined,
      reps:
        e.type !== "hold" ? (cell?.reps ?? previous[i]?.reps ?? 5) : undefined,
      seconds:
        e.type === "hold"
          ? (cell?.seconds ?? previous[i]?.seconds ?? 30)
          : undefined,
    }));
    await db.sets.bulkAdd(rows);
  });
  return seId;
}
export async function swapExercise(
  sessionExerciseId: string,
  exerciseId: string,
  d: Data,
) {
  return db.transaction(
    "rw",
    db.sessions,
    db.sessionExercises,
    db.sets,
    async () => {
      const se = await db.sessionExercises.get(sessionExerciseId);
      if (!se) throw Error("Übung nicht gefunden.");
      const sets = await db.sets
        .where("sessionExerciseId")
        .equals(sessionExerciseId)
        .toArray();
      if (sets.some((s) => s.done))
        throw Error(
          "Eine Übung mit abgehakten Sätzen bleibt erhalten. Füge die Ersatzübung zusätzlich hinzu.",
        );
      await db.sets.bulkDelete(sets.map((s) => s.id));
      await db.sessionExercises.delete(sessionExerciseId);
      const newId = await addExercise(se.sessionId, exerciseId, d);
      await db.sessionExercises.update(newId, {
        order: se.order,
        status: "substituted",
        substitutedFromExerciseId: se.exerciseId,
      });
      return newId;
    },
  );
}
export async function startSession(d: Data, dayId?: string, week?: number) {
  const existing = d.sessions.find((s) => s.startedAt && !s.finishedAt);
  if (existing) return existing.id;
  const day = d.days.find((x) => x.id === dayId),
    id = uid();
  await db.transaction(
    "rw",
    db.sessions,
    db.sessionExercises,
    db.sets,
    async () => {
      await db.sessions.add({
        id,
        date: today(),
        startedAt: new Date().toISOString(),
        title: day?.title || day?.label || "Freies Training",
        cycleId: day?.cycleId,
        dayId: day?.id,
        week: day ? week : undefined,
      });
      if (day)
        for (const entry of d.entries
          .filter((e) => e.dayId === day.id)
          .sort((a, b) => a.order - b.order))
          if (d.cells.some((c) => c.entryId === entry.id && c.week === week))
            await addExercise(id, entry.exerciseId, d, entry.id);
    },
  );
  return id;
}
export async function appendSet(seId: string, warmup = false) {
  await db.transaction(
    "rw",
    db.sets,
    db.sessionExercises,
    db.sessions,
    async () => {
      const se = await db.sessionExercises.get(seId);
      if (!se) return;
      const session = await db.sessions.get(se.sessionId);
      if (!session) return;
      const rows = (
          await db.sets.where("sessionExerciseId").equals(seId).toArray()
        ).sort((a, b) => a.order - b.order),
        last = rows.filter((s) => !s.isWarmup).at(-1);
      if (warmup)
        for (const row of rows)
          await db.sets.update(row.id, { order: row.order + 1 });
      await db.sets.add({
        id: uid(),
        sessionExerciseId: seId,
        exerciseId: se.exerciseId,
        date: session.date,
        order: warmup ? 0 : (rows.at(-1)?.order ?? -1) + 1,
        isWarmup: warmup,
        done: false,
        weight:
          last?.weight === undefined
            ? undefined
            : warmup
              ? Math.round(last.weight * 0.6 * 2) / 2
              : last.weight,
        reps: last?.reps,
        seconds: last?.seconds,
      });
    },
  );
}
