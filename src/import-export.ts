import { z } from "zod";
import {
  dataSchema,
  emptyData,
  uid,
  dateAdd,
  today,
  type Data,
  type Exercise,
} from "./model";
import { db, readData, tableNames, type TrainingDB } from "./db";
const positive = z.number().finite().nonnegative();
const legacyExercise = z.object({
  id: z.string(),
  name: z.string(),
  sets: positive.int().optional(),
  reps: positive.int().optional(),
  weight: positive.optional(),
  unit: z.string().optional(),
  desc: z.string().optional(),
});
export const legacySchema = z.object({
  format: z.literal("trainingsplan-legacy-export"),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  plan: z.object({
    name: z.string(),
    weeks: z
      .array(
        z.object({
          id: z.number().int().positive().max(52),
          isDeload: z.boolean().optional(),
          isTest: z.boolean().optional(),
          exercises: z.array(legacyExercise),
        }),
      )
      .min(1)
      .max(52),
  }),
  setLogs: z.array(
    z.object({
      id: z.string(),
      week: z.number().int().positive(),
      exerciseId: z.string(),
      sets: z.array(
        z.object({
          weight: positive.nullish(),
          reps: positive.int().nullish(),
          done: z.boolean(),
        }),
      ),
      status: z.enum(["planned", "skipped", "substituted"]).default("planned"),
      substituteName: z.string().nullish(),
      note: z.string().nullish(),
      updatedAt: positive.optional(),
    }),
  ),
});
export type Legacy = z.infer<typeof legacySchema>;
export type Mapping = {
  legacyId: string;
  name: string;
  type: Exercise["type"];
  category: Exercise["category"];
};
export const backupSchema = z.object({
  format: z.literal("trainingsplan-backup"),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  data: dataSchema,
});
export function mappingsFor(raw: Legacy): Mapping[] {
  return [
    ...new Map(
      raw.plan.weeks.flatMap((w) => w.exercises).map((e) => [e.id, e]),
    ).values(),
  ].map((e) => {
    let name = e.name.replace(/\s*[–-]?\s*(5RM )?Test$/, "").trim(),
      type: Exercise["type"] =
        e.unit === "kg" && (e.weight ?? 0) > 0 ? "weight_reps" : "reps_only",
      category: Exercise["category"] = "Andere";
    if (/^sq[1-8]$/.test(e.id)) {
      name = "Kniebeuge";
      type = "weight_reps";
      category = "Beine";
    }
    if (/^bp[1-8]$/.test(e.id)) {
      name = "Bankdrücken";
      type = "weight_reps";
      category = "Drücken";
    }
    if (/^sp[1-8]$/.test(e.id)) {
      name = "Strict Press";
      type = "weight_reps";
      category = "Drücken";
    }
    if (["pu1", "pu2", "pu6"].includes(e.id)) {
      name = "Weighted Pull-up";
      type = "bodyweight_load";
      category = "Ziehen";
    }
    if (["pu3", "pu4", "pu5", "pu7b"].includes(e.id)) {
      name = "Explosive Pull-up";
      type = "bodyweight_load";
      category = "Ziehen";
    }
    if (["pu7", "pu8", "mu1", "mu2", "mu3", "mu4", "mu5"].includes(e.id)) {
      name = e.id.startsWith("pu")
        ? "Muscle-up"
        : ["mu1", "mu2"].includes(e.id)
          ? "Ring-MU Negative"
          : ["mu3", "mu4"].includes(e.id)
            ? "Banded MU-Transition"
            : "False-Grip Hold/Transition";
      type = "reps_only";
      category = "Skill";
    }
    return { legacyId: e.id, name, type, category };
  });
}
const zurichDate = (t: number | string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t));
type LegacyRow = Legacy["setLogs"][number];
// A row carries data if it records sets, a note, or a skip/substitution.
const rowHasData = (r: LegacyRow) =>
  r.status !== "planned" ||
  !!r.note?.trim() ||
  r.sets.some((s) => s.weight != null || s.reps != null);
// Plan weeks with at least one setLog with data (LEGACY-IMPORT.md).
const weeksWithData = (raw: Legacy) => [
  ...new Set(raw.setLogs.filter(rowHasData).map((r) => r.week)),
];
export function datesFor(raw: Legacy): Record<number, string> {
  return Object.fromEntries(
    weeksWithData(raw).map((week) => {
      const times = raw.setLogs
        .filter((r) => r.week === week && r.updatedAt)
        .map((r) => r.updatedAt!);
      return [
        week,
        zurichDate(times.length ? Math.min(...times) : raw.exportedAt),
      ];
    }),
  );
}
export function convertLegacy(
  raw: Legacy,
  mappings = mappingsFor(raw),
  dates = datesFor(raw),
): Data {
  const d = emptyData(),
    now = new Date().toISOString(),
    cycleId = uid(),
    dayId = uid();
  const map = new Map<string, Exercise>();
  for (const m of mappings) {
    if (!m.name.trim()) throw Error("Jede Übung benötigt einen Namen.");
    let e = d.exercises.find(
      (x) =>
        x.name.toLowerCase() === m.name.trim().toLowerCase() &&
        x.type === m.type,
    );
    if (!e) {
      e = {
        id: uid(),
        name: m.name.trim(),
        type: m.type,
        category: m.category,
        trackOneRm: m.type === "weight_reps",
        weightStep: 2.5,
        unilateral: false,
        isCustom: true,
        archived: false,
        createdAt: now,
        aliases: [],
      };
      d.exercises.push(e);
    }
    map.set(m.legacyId, e);
  }
  const knownWeeks = new Set(raw.plan.weeks.map((w) => w.id));
  if (knownWeeks.size !== raw.plan.weeks.length)
    throw Error("Doppelte Wochen im alten Plan.");
  d.cycles.push({
    id: cycleId,
    name: raw.plan.name,
    startDate:
      dates[1] ??
      dateAdd(
        dates[
          Object.keys(dates)
            .map(Number)
            .sort((a, b) => a - b)[0]
        ] ?? today(),
        -7 *
          ((Object.keys(dates)
            .map(Number)
            .sort((a, b) => a - b)[0] ?? 1) -
            1),
      ),
    weeks: Math.max(...knownWeeks),
    deloadWeeks: raw.plan.weeks.filter((w) => w.isDeload).map((w) => w.id),
    status: "completed",
    createdBy: "legacy",
    createdAt: now,
  });
  d.days.push({ id: dayId, cycleId, label: "Freitag", order: 0 });
  for (const week of raw.plan.weeks)
    for (const old of week.exercises) {
      const e = map.get(old.id);
      if (!e) throw Error("Übungszuordnung fehlt: " + old.id);
      e.aliases = [...new Set([...(e.aliases ?? []), old.name])];
      let entry = d.entries.find((x) => x.exerciseId === e.id);
      if (!entry) {
        entry = {
          id: uid(),
          dayId,
          cycleId,
          exerciseId: e.id,
          order: d.entries.length,
        };
        d.entries.push(entry);
      }
      if (d.cells.some((c) => c.entryId === entry.id && c.week === week.id))
        throw Error(
          "Zwei Übungen derselben Woche wurden zusammengelegt. Bitte getrennte Namen verwenden.",
        );
      d.cells.push({
        id: uid(),
        entryId: entry.id,
        week: week.id,
        sets: Math.max(1, old.sets ?? 3),
        reps: old.reps || undefined,
        loadMode: "kg",
        kg: old.weight ?? 0,
        note: [old.desc, week.isTest ? "Testwoche" : ""]
          .filter(Boolean)
          .join(" · "),
      });
    }
  for (const week of weeksWithData(raw)) {
    if (!knownWeeks.has(week))
      throw Error("Trainingswoche fehlt im alten Plan: " + week);
    const date = dates[week];
    z.iso.date().parse(date);
    const sessionId = uid();
    d.sessions.push({
      id: sessionId,
      date,
      cycleId,
      week,
      dayId,
      title: `Import · Woche ${week}`,
      dateIsApproximate: true,
      finishedAt: date + "T12:00:00Z",
    });
    for (const old of raw.setLogs.filter((r) => r.week === week)) {
      const original = map.get(old.exerciseId);
      if (!original) throw Error("Unbekannte alte Übung: " + old.exerciseId);
      let e = original;
      if (old.status === "substituted") {
        // The old app stores "" or null until a substitute name is typed.
        // One placeholder per original lift, kept out of 1RM tracking so
        // unknown substitutes never feed another lift's estimates.
        const typed = old.substituteName?.trim(),
          name = typed || "Ersatz für " + original.name;
        e = d.exercises.find(
          (x) => x.name === name && x.type === original.type,
        ) ?? {
          ...original,
          id: uid(),
          name,
          aliases: [],
          ...(typed ? {} : { trackOneRm: false }),
        };
        if (!d.exercises.some((x) => x.id === e.id)) d.exercises.push(e);
      }
      const seId = uid();
      d.sessionExercises.push({
        id: seId,
        sessionId,
        exerciseId: e.id,
        order: d.sessionExercises.filter((x) => x.sessionId === sessionId)
          .length,
        status: old.status,
        note: old.note ?? undefined,
        substitutedFromExerciseId:
          old.status === "substituted" ? original.id : undefined,
      });
      if (old.status !== "skipped")
        old.sets
          .filter((s) => s.weight != null || s.reps != null)
          .forEach((s, i) =>
            d.sets.push({
              id: uid(),
              sessionExerciseId: seId,
              exerciseId: e.id,
              date,
              order: i,
              isWarmup: false,
              weight: s.weight ?? undefined,
              reps: s.reps ?? undefined,
              done: s.done,
            }),
          );
    }
  }
  return dataSchema.parse(d);
}
export function validateRelations(d: Data) {
  for (const k of tableNames) {
    if (new Set(d[k].map((x) => x.id)).size !== d[k].length)
      throw Error("Doppelte IDs: " + k);
  }
  const has = (table: keyof Data, id: string) =>
      d[table].some((x) => x.id === id),
    need = (ok: boolean) => {
      if (!ok) throw Error("Die Datei enthält ungültige Verknüpfungen.");
    };
  d.blocks.forEach((x) => need(has("sessions", x.sessionId)));
  d.sessionExercises.forEach((x) =>
    need(
      has("sessions", x.sessionId) &&
        has("exercises", x.exerciseId) &&
        (!x.blockId ||
          d.blocks.some(
            (b) => b.id === x.blockId && b.sessionId === x.sessionId,
          )),
    ),
  );
  d.sets.forEach((x) => {
    const se = d.sessionExercises.find((s) => s.id === x.sessionExerciseId);
    const sess = d.sessions.find((s) => s.id === se?.sessionId);
    need(
      !!se &&
        se.exerciseId === x.exerciseId &&
        sess?.date === x.date &&
        se.blockId === x.blockId,
    );
  });
  if (
    new Set(d.cells.map((c) => c.entryId + "|" + c.week)).size !==
    d.cells.length
  )
    throw Error("Doppelte Planzellen.");
  d.cycles.forEach((c) => need(c.deloadWeeks.every((w) => w <= c.weeks)));
  d.oneRms.forEach((x) => need(has("exercises", x.exerciseId)));
  d.sessions.forEach((x) => {
    if (x.cycleId) need(has("cycles", x.cycleId));
    if (x.dayId)
      need(
        d.days.some((day) => day.id === x.dayId && day.cycleId === x.cycleId),
      );
  });
  d.days.forEach((x) => need(has("cycles", x.cycleId)));
  d.entries.forEach((x) =>
    need(
      has("exercises", x.exerciseId) &&
        d.days.some((day) => day.id === x.dayId && day.cycleId === x.cycleId),
    ),
  );
  d.cells.forEach((x) => {
    const entry = d.entries.find((e) => e.id === x.entryId),
      cycle = d.cycles.find((c) => c.id === entry?.cycleId);
    need(
      !!cycle &&
        x.week <= cycle.weeks &&
        (x.loadMode !== "pct" || x.pct !== undefined) &&
        (x.loadMode !== "kg" || x.kg !== undefined),
    );
  });
  d.stages.forEach((x) =>
    need(
      has("skills", x.skillId) &&
        (!x.exerciseId || has("exercises", x.exerciseId)),
    ),
  );
  if (d.cycles.filter((c) => c.status === "active").length > 1)
    throw Error("Es darf nur ein Zyklus aktiv sein.");
}
const sameExercise = (a: Exercise, b: Exercise) =>
  a.name.trim().toLowerCase() === b.name.trim().toLowerCase() &&
  a.type === b.type;
// Points every exercise reference in `d` from an old id to a new one.
function remapExerciseRefs(d: Data, remap: Map<string, string>) {
  const mapped = (id: string) => remap.get(id) ?? id;
  for (const entry of d.entries) entry.exerciseId = mapped(entry.exerciseId);
  for (const se of d.sessionExercises) {
    se.exerciseId = mapped(se.exerciseId);
    if (se.substitutedFromExerciseId)
      se.substitutedFromExerciseId = mapped(se.substitutedFromExerciseId);
  }
  for (const set of d.sets) set.exerciseId = mapped(set.exerciseId);
  for (const rm of d.oneRms) rm.exerciseId = mapped(rm.exerciseId);
  for (const stage of d.stages)
    if (stage.exerciseId) stage.exerciseId = mapped(stage.exerciseId);
}
// Merging a backup into another install: every install seeds the default
// exercises with fresh ids, so match unknown ids by name and type instead of
// creating duplicates. The incoming fields win, the existing id is kept.
function reuseExercisesByName(incoming: Data, existing: Exercise[]) {
  const incomingIds = new Set(incoming.exercises.map((e) => e.id)),
    existingIds = new Set(existing.map((e) => e.id)),
    remap = new Map<string, string>();
  for (const exercise of incoming.exercises) {
    if (existingIds.has(exercise.id)) continue;
    const match = existing.find(
      (e) =>
        !incomingIds.has(e.id) &&
        ![...remap.values()].includes(e.id) &&
        sameExercise(e, exercise),
    );
    if (!match) continue;
    remap.set(exercise.id, match.id);
    exercise.aliases = [
      ...new Set([...(match.aliases ?? []), ...(exercise.aliases ?? [])]),
    ];
    exercise.id = match.id;
  }
  remapExerciseRefs(incoming, remap);
}
export async function importData(
  incoming: Data,
  mode: "merge" | "replace",
  database: TrainingDB = db,
) {
  const safe = dataSchema.parse(incoming);
  safe.settings = safe.settings.map(({ openRouterApiKey: _key, ...s }) => s);
  await database.transaction("rw", database.tables, async () => {
    const existing = await readData(database),
      combined = emptyData();
    if (mode === "merge") reuseExercisesByName(safe, existing.exercises);
    for (const k of tableNames)
      (combined[k] as unknown[]) =
        mode === "replace"
          ? safe[k]
          : [
              ...new Map(
                [...existing[k], ...safe[k]].map((x) => [x.id, x]),
              ).values(),
            ];
    if (!combined.settings.length) combined.settings = existing.settings;
    const key = existing.settings[0]?.openRouterApiKey;
    if (key && combined.settings[0])
      combined.settings[0].openRouterApiKey = key;
    validateRelations(combined);
    if (mode === "replace")
      for (const table of database.tables) await table.clear();
    for (const k of tableNames)
      if (combined[k].length) await database.table(k).bulkPut(combined[k]);
  });
}
export async function importLegacyData(data: Data, database = db) {
  await database.transaction("rw", database.tables, async () => {
    if (await database.cycles.filter((c) => c.createdBy === "legacy").count())
      throw Error(
        "Alte Daten wurden bereits importiert. Bitte zuerst ein Backup sichern; ein zweiter Import würde Duplikate erzeugen.",
      );
    const incoming = structuredClone(data),
      existing = await database.exercises.toArray();
    const remap = new Map<string, string>();
    for (const exercise of incoming.exercises) {
      const match = existing.find((e) => sameExercise(e, exercise));
      if (match) {
        remap.set(exercise.id, match.id);
        Object.assign(exercise, {
          ...match,
          aliases: [
            ...new Set([...(match.aliases ?? []), ...(exercise.aliases ?? [])]),
          ],
        });
      }
    }
    remapExerciseRefs(incoming, remap);
    await importData(incoming, "merge", database);
  });
}
export function makeBackup(d: Data) {
  const copy = structuredClone(d);
  copy.settings = copy.settings.map(({ openRouterApiKey: _key, ...s }) => ({
    ...s,
    aiEnabled: false,
  }));
  return {
    format: "trainingsplan-backup" as const,
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    data: copy,
  };
}
// Returns false when the user cancelled the share sheet (nothing was saved).
export async function exportBackup(database: TrainingDB = db) {
  const data = makeBackup(await readData(database));
  const file = new File(
    [JSON.stringify(data, null, 2)],
    `trainingsplan-backup-${today()}.json`,
    { type: "application/json" },
  );
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Trainingsplan Backup" });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return false;
      download(file);
    }
  } else download(file);
  await database.settings.update("settings", {
    lastBackupAt: new Date().toISOString(),
  });
  return true;
}
function download(file: File) {
  const url = URL.createObjectURL(file),
    a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
