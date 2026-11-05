import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fixture from "../docs/legacy/sample-export.json";
import { TrainingDB, readData, db, seed } from "./db";
import {
  estimate,
  currentRm,
  loadKg,
  plateau,
  platesFor,
  personalRecords,
} from "./calculations";
import {
  legacySchema,
  convertLegacy,
  datesFor,
  mappingsFor,
  importData,
  importLegacyData,
  makeBackup,
  validateRelations,
} from "./import-export";
import {
  emptyData,
  defaults,
  type Exercise,
  type SetLog,
  uid,
  dateAdd,
} from "./model";
import { startSession, addExercise, appendSet } from "./training";
const e: Exercise = {
  id: "squat",
  name: "Kniebeuge",
  type: "weight_reps",
  category: "Beine",
  trackOneRm: true,
  unilateral: false,
  weightStep: 2.5,
  isCustom: false,
  archived: false,
  createdAt: "2026-01-01",
};
const set: SetLog = {
  id: "set",
  sessionExerciseId: "se",
  exerciseId: e.id,
  date: "2026-11-01",
  order: 0,
  isWarmup: false,
  weight: 100,
  reps: 5,
  done: true,
};
describe("deterministic training calculations", () => {
  it("estimates Epley and Brzycki, honors single reps and excludes invalid sets", () => {
    expect(estimate(set)).toBe(116.5);
    expect(estimate(set, "brzycki")).toBe(112.5);
    expect(estimate({ ...set, reps: 1 })).toBe(100);
    for (const patch of [
      { done: false },
      { isWarmup: true },
      { reps: 11 },
      { reps: 0 },
      { weight: undefined },
    ])
      expect(estimate({ ...set, ...patch })).toBeUndefined();
  });
  it("selects the most recent tested vs six-week best, not the highest lifetime value", () => {
    const d = emptyData();
    d.exercises = [e];
    d.settings = [defaults];
    d.sessions = [{ id: "session", date: set.date }];
    d.sessionExercises = [
      {
        id: "se",
        sessionId: "session",
        exerciseId: e.id,
        order: 0,
        status: "done",
      },
    ];
    d.sets = [set];
    d.oneRms = [
      {
        id: "rm",
        exerciseId: e.id,
        date: "2026-11-02",
        value: 110,
        source: "tested",
      },
    ];
    expect(currentRm(e, d, "2026-11-04")?.value).toBe(110);
    d.oneRms[0].date = "2026-10-01";
    expect(currentRm(e, d, "2026-11-04")?.value).toBe(116.5);
    expect(
      loadKg(
        {
          id: "cell",
          entryId: "entry",
          week: 1,
          sets: 3,
          loadMode: "pct",
          pct: 80,
        },
        e,
        d,
      ),
    ).toBeDefined();
    expect(currentRm(e, { ...d, oneRms: [] }, "2027-01-01")).toBeUndefined();
  });
  it("separates tested values from estimates and detects plateau across six sessions", () => {
    const d = emptyData();
    d.exercises = [e];
    d.settings = [defaults];
    for (let i = 0; i < 6; i++) {
      const date = dateAdd("2026-11-04", -10 - i * 11),
        id = "s" + i;
      d.sessions.push({ id, date });
      d.sessionExercises.push({
        id: "e" + i,
        sessionId: id,
        exerciseId: e.id,
        order: 0,
        status: "done",
      });
      d.sets.push({ ...set, id: "set" + i, sessionExerciseId: "e" + i, date });
    }
    expect(plateau(e, d, "2026-11-04")).toBe(true);
    d.sets[0].weight = 110;
    expect(plateau(e, d, "2026-11-04")).toBe(false);
  });
  it("reports un-loadable plate remainders and per-side plates", () => {
    expect(platesFor(102.5, 20, [25, 20, 15, 10, 5, 2.5, 1.25])).toEqual({
      plates: [25, 15, 1.25],
      remainder: 0,
    });
    expect(platesFor(101, 20, [20, 10, 5, 2.5])).toEqual({
      plates: [20, 20],
      remainder: 1,
    });
    expect(platesFor(15, 20, [20])).toEqual({ plates: [], remainder: -5 });
  });
  it("counts new hold and rep PRs without treating unfinished sets as records", () => {
    expect(
      personalRecords(
        [{ ...set, seconds: 30 }],
        [{ ...set, seconds: 20 }],
        { ...e, type: "hold" },
        "epley",
      ),
    ).toEqual(["Kniebeuge: 30 s"]);
    expect(personalRecords([{ ...set, done: false }], [], e, "epley")).toEqual(
      [],
    );
  });
});
describe("legacy importer and atomic backup round trip", () => {
  let testDb: TrainingDB;
  beforeEach(() => {
    testDb = new TrainingDB("test-" + uid());
  });
  afterEach(async () => {
    await testDb.delete();
  });
  it("imports fixture without manufacturing max records or skipping substitutions", async () => {
    const legacy = legacySchema.parse(fixture),
      d = convertLegacy(legacy);
    validateRelations(d);
    expect(d.sessions).toHaveLength(3);
    expect(d.sets).toHaveLength(25);
    expect(d.oneRms).toHaveLength(0);
    expect(d.sessions.every((s) => s.dateIsApproximate)).toBe(true);
    expect(d.exercises.find((e) => e.name === "KH-Bankdrücken")).toBeDefined();
    const skipped = d.sessionExercises.find((e) => e.status === "skipped")!;
    expect(d.sets.some((s) => s.sessionExerciseId === skipped.id)).toBe(false);
    expect(d.cycles[0].weeks).toBe(8);
    expect(d.cycles[0].status).toBe("completed");
    await importLegacyData(d, testDb);
    expect((await readData(testDb)).sets).toHaveLength(25);
    await expect(
      importLegacyData(convertLegacy(legacy), testDb),
    ).rejects.toThrow("bereits");
    expect(await testDb.sets.count()).toBe(25);
  });
  it("reuses an existing exercise when importing and preserves all references", async () => {
    await testDb.exercises.add(e);
    const d = convertLegacy(legacySchema.parse(fixture));
    await importLegacyData(d, testDb);
    const actual = await readData(testDb);
    expect(actual.exercises.filter((x) => x.name === "Kniebeuge")).toHaveLength(
      1,
    );
    expect(actual.sets.filter((x) => x.exerciseId === "squat")).toHaveLength(
      10,
    );
    validateRelations(actual);
  });
  it("uses Zurich dates, editable mappings and corrected dates", () => {
    const legacy = legacySchema.parse(fixture);
    legacy.setLogs[0].updatedAt = Date.parse("2026-10-24T23:30:00Z");
    const dates = datesFor(legacy);
    const d = convertLegacy(
      legacy,
      mappingsFor(legacy).map((m) =>
        m.legacyId.startsWith("sq") ? { ...m, name: "Meine Kniebeuge" } : m,
      ),
      { ...dates, 1: "2026-08-01" },
    );
    expect(d.sessions.find((s) => s.week === 1)?.date).toBe("2026-08-01");
    expect(
      d.sets
        .filter(
          (s) =>
            d.sessionExercises.find((se) => se.id === s.sessionExerciseId)
              ?.sessionId === d.sessions[0].id,
        )
        .every((s) => s.date === "2026-08-01"),
    ).toBe(true);
    expect(
      d.exercises.filter((e) => e.name === "Meine Kniebeuge"),
    ).toHaveLength(1);
  });
  it("excludes secrets from backup and preserves the local key during import", async () => {
    const d = convertLegacy(legacySchema.parse(fixture));
    d.settings = [
      {
        ...defaults,
        openRouterApiKey: "synthetic-key-for-test-only",
        aiEnabled: true,
      },
    ];
    await importData(d, "replace", testDb);
    await testDb.settings.update("settings", {
      openRouterApiKey: "local-test-key",
    });
    const exported = makeBackup(await readData(testDb));
    expect(JSON.stringify(exported)).not.toContain("local-test-key");
    expect(exported.data.settings[0].aiEnabled).toBe(false);
    await importData(exported.data, "replace", testDb);
    expect((await testDb.settings.get("settings"))?.openRouterApiKey).toBe(
      "local-test-key",
    );
    expect(await testDb.sessions.count()).toBe(3);
  });
  it("rejects broken references and rolls back replacement completely", async () => {
    const d = convertLegacy(legacySchema.parse(fixture));
    await importData(d, "replace", testDb);
    const before = await readData(testDb);
    const invalid = structuredClone(d);
    invalid.sets[0].sessionExerciseId = "missing";
    await expect(importData(invalid, "replace", testDb)).rejects.toThrow(
      "Verknüpfungen",
    );
    expect(await readData(testDb)).toEqual(before);
  });
  it("rejects duplicate IDs and mismatched set dates", () => {
    const d = convertLegacy(legacySchema.parse(fixture));
    d.sets.push(d.sets[0]);
    expect(() => validateRelations(d)).toThrow("Doppelte");
    d.sets.pop();
    d.sets[0].date = "2020-01-01";
    expect(() => validateRelations(d)).toThrow("Verknüpfungen");
  });
  it("persists v1 database records after reopening without reseeding", async () => {
    const d = convertLegacy(legacySchema.parse(fixture));
    await importData(d, "replace", testDb);
    testDb.close();
    await testDb.open();
    expect(
      (await readData(testDb)).sessions.sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    ).toEqual(d.sessions.sort((a, b) => a.date.localeCompare(b.date)));
  });
});
describe("training persistence", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await seed();
  });
  afterEach(async () => {
    await db.delete();
  });
  it("resumes unfinished sessions and keeps a changed set across reopen", async () => {
    let d = await readData(),
      id = await startSession(d);
    d = await readData();
    const se = await addExercise(id, d.exercises[0].id, d);
    await appendSet(se, true);
    const sets = await db.sets.where("sessionExerciseId").equals(se).toArray();
    expect(sets).toHaveLength(4);
    const work = sets.find((s) => !s.isWarmup)!;
    await db.sets.update(work.id, { weight: 77.5, reps: 5, done: true });
    db.close();
    await db.open();
    expect((await db.sets.get(work.id))?.weight).toBe(77.5);
    expect(await startSession(await readData())).toBe(id);
  });
  it("does not create a partial session when percent planning lacks a max", async () => {
    const d = await readData(),
      e = d.exercises.find((e) => e.type === "weight_reps")!;
    await db.cycles.add({
      id: "c",
      name: "Cycle",
      startDate: "2026-11-01",
      weeks: 1,
      deloadWeeks: [],
      status: "active",
      createdBy: "user",
      createdAt: "2026-11-01",
    });
    await db.days.add({ id: "day", cycleId: "c", label: "A", order: 0 });
    await db.entries.add({
      id: "entry",
      cycleId: "c",
      dayId: "day",
      exerciseId: e.id,
      order: 0,
    });
    await db.cells.add({
      id: "cell",
      entryId: "entry",
      week: 1,
      sets: 3,
      reps: 5,
      loadMode: "pct",
      pct: 80,
    });
    await expect(startSession(await readData(), "day", 1)).rejects.toThrow(
      "1RM",
    );
    expect(await db.sessions.count()).toBe(0);
  });
});
