// Regression tests for the defects found in the November 2026 audit
// (docs/AUDIT-2026-11.md). Each test fails on the code before its fix.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError, z } from "zod";
import fixture from "../docs/legacy/sample-export.json";
import { db, readData, seed } from "./db";
import { currentRm, forwardWeeks, plateau, progressed } from "./calculations";
import {
  convertLegacy,
  datesFor,
  exportBackup,
  importData,
  importLegacyData,
  legacySchema,
  makeBackup,
  validateRelations,
} from "./import-export";
import {
  dateAdd,
  defaults,
  emptyData,
  fmt,
  type Data,
  type Exercise,
} from "./model";
import { addExercise, startSession, swapExercise } from "./training";
import { finishOAuth, saveDecision } from "./ai";
import { attempt, errorText } from "./ui";

const squat: Exercise = {
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
// One weekly session per entry of `weights`, newest first, `offset` days apart.
function weekly(weights: number[], asOf: string, firstOffset: number): Data {
  const d = emptyData();
  d.exercises = [squat];
  d.settings = [defaults];
  weights.forEach((weight, i) => {
    const date = dateAdd(asOf, -(firstOffset + i * 7)),
      id = "s" + i;
    d.sessions.push({ id, date });
    d.sessionExercises.push({
      id: "se" + i,
      sessionId: id,
      exerciseId: squat.id,
      order: 0,
      status: "done",
    });
    d.sets.push({
      id: "set" + i,
      sessionExerciseId: "se" + i,
      exerciseId: squat.id,
      date,
      order: 0,
      isWarmup: false,
      weight,
      reps: 5,
      done: true,
    });
  });
  return d;
}

describe("calculations and display", () => {
  it("uses windows of exactly 42 days for the current 1RM", () => {
    // A session exactly 42 days ago is outside "the last 6 weeks".
    const d = weekly([100], "2026-11-04", 42);
    expect(currentRm(squat, d, "2026-11-04")).toBeUndefined();
    expect(
      currentRm(squat, weekly([100], "2026-11-04", 41), "2026-11-04"),
    ).toBeDefined();
  });
  it("flags a plateau when the 6-week windows hold 6 weekly sessions each", () => {
    // Weekly on the same weekday: 105 kg reached exactly 6 weeks ago, then
    // stalled. Recent window (6 sessions) is not better than the one before.
    const d = weekly(
      [100, 100, 100, 100, 100, 100, 105, 100, 100, 100, 100, 100],
      "2026-11-06",
      0,
    );
    expect(plateau(squat, d, "2026-11-06")).toBe(true);
  });
  it("ignores a session exactly 12 weeks ago for plateau detection", () => {
    // Recent 6 weeks 105 kg, the 6 weeks before 100 kg: progress, no plateau.
    // A 120 kg session exactly 84 days ago lies outside both windows.
    const d = weekly(
      [105, 105, 105, 105, 105, 105, 100, 100, 100, 100, 100, 100, 120],
      "2026-11-06",
      0,
    );
    expect(plateau(squat, d, "2026-11-06")).toBe(false);
  });
  it("shows 1.25 kg steps with two decimals", () => {
    expect(fmt(41.25)).toBe("41.25");
    expect(fmt(102.5)).toBe("102.5");
    expect(fmt(12500)).toBe("12'500");
  });
  it("stores weekly percentage progressions without floating-point noise", () => {
    expect(progressed(70, 2, 4)).toBe(75.6);
    expect(progressed(65, 1, 4)).toBe(67.6);
    expect(progressed(80, 2.5, 2, 2.5)).toBe(85);
    expect(progressed(41.25, 0, 3, 1.25)).toBe(41.25);
  });
  it("copies a cell forward without overwriting deload weeks", () => {
    expect(forwardWeeks(2, 8, [4, 8])).toEqual([2, 3, 5, 6, 7]);
    // An edited deload week itself is still written.
    expect(forwardWeeks(4, 6, [4])).toEqual([4, 5, 6]);
    expect(forwardWeeks(6, 6, [])).toEqual([6]);
  });
  it("shows German text for validation and parser errors", () => {
    let zodError: unknown;
    try {
      z.number().parse("x");
    } catch (e) {
      zodError = e;
    }
    expect(zodError).toBeInstanceOf(ZodError);
    expect(errorText(zodError)).toMatch(/^Ungültige Werte/);
    expect(errorText(new SyntaxError("Unexpected token"))).toMatch(
      /ungültiges Format/,
    );
    expect(errorText(Error("Übung nicht gefunden."))).toBe(
      "Übung nicht gefunden.",
    );
  });
  it("turns a failed action into a German notice (useAction)", async () => {
    const notify = vi.fn();
    await attempt(() => z.number().parse("x"), notify);
    await attempt(async () => {
      throw Error("Übung nicht gefunden.");
    }, notify);
    await attempt(async () => {}, notify);
    expect(notify.mock.calls).toEqual([
      [expect.stringMatching(/^Ungültige Werte/)],
      ["Übung nicht gefunden."],
    ]);
  });
});

describe("legacy import edge cases", () => {
  it("imports a substitution whose name was never typed in the old app", () => {
    for (const name of ["", null]) {
      const legacy = legacySchema.parse(structuredClone(fixture));
      legacy.setLogs.find((r) => r.status === "substituted")!.substituteName =
        name;
      const d = convertLegacy(legacy);
      validateRelations(d);
      const substitute = d.exercises.find(
        (e) => e.name === "Ersatz für Bankdrücken",
      );
      expect(substitute).toMatchObject({ trackOneRm: false });
      expect(d.sets).toHaveLength(25);
      expect(
        d.sessionExercises.find((se) => se.exerciseId === substitute!.id)
          ?.substitutedFromExerciseId,
      ).toBeDefined();
    }
  });
  it("keeps unnamed substitutions of different lifts apart", () => {
    const legacy = legacySchema.parse(structuredClone(fixture));
    for (const r of legacy.setLogs.filter((r) => r.week === 2 && r.sets.length))
      Object.assign(r, { status: "substituted", substituteName: "" });
    const d = convertLegacy(legacy);
    validateRelations(d);
    const placeholders = d.exercises.filter((e) =>
      e.name.startsWith("Ersatz für "),
    );
    expect(placeholders.length).toBeGreaterThan(1);
    expect(new Set(placeholders.map((e) => e.name)).size).toBe(
      placeholders.length,
    );
    expect(placeholders.every((e) => !e.trackOneRm)).toBe(true);
  });
  it("creates no session for a week whose setLogs carry no data", () => {
    const legacy = legacySchema.parse(structuredClone(fixture));
    legacy.setLogs.push({
      id: "empty-week-4",
      week: 4,
      exerciseId: legacy.plan.weeks[3].exercises[0].id,
      sets: [{ weight: null, reps: null, done: false }],
      status: "planned",
      substituteName: null,
      note: null,
      updatedAt: Date.parse("2026-10-09T10:00:00Z"),
    });
    expect(Object.keys(datesFor(legacy))).toEqual(["1", "2", "3"]);
    const d = convertLegacy(legacy);
    expect(d.sessions.map((s) => s.week).sort()).toEqual([1, 2, 3]);
    validateRelations(d);
  });
  it("falls back to the Zurich date of the export, not the UTC date", () => {
    const legacy = legacySchema.parse(structuredClone(fixture));
    legacy.exportedAt = "2026-10-17T22:30:00.000Z";
    for (const r of legacy.setLogs) delete r.updatedAt;
    expect(datesFor(legacy)[1]).toBe("2026-10-18");
  });
});

describe("live training and data safety", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await seed();
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.delete();
  });
  it("swaps an exercise in a running session", async () => {
    let d = await readData();
    const sessionId = await startSession(d);
    d = await readData();
    const [first, second] = d.exercises;
    const seId = await addExercise(sessionId, first.id, d);
    const newId = await swapExercise(seId, second.id, await readData());
    const after = await readData();
    expect(after.sessionExercises.find((x) => x.id === seId)).toBeUndefined();
    expect(after.sets.some((s) => s.sessionExerciseId === seId)).toBe(false);
    expect(after.sessionExercises.find((x) => x.id === newId)).toMatchObject({
      sessionId,
      exerciseId: second.id,
      status: "substituted",
      substitutedFromExerciseId: first.id,
      order: 0,
    });
    expect(after.sets.filter((s) => s.sessionExerciseId === newId).length).toBe(
      3,
    );
  });
  it("keeps an exercise with ticked sets when swapping", async () => {
    let d = await readData();
    const sessionId = await startSession(d);
    d = await readData();
    const seId = await addExercise(sessionId, d.exercises[0].id, d);
    const set = await db.sets.where("sessionExerciseId").equals(seId).first();
    await db.sets.update(set!.id, { done: true });
    await expect(
      swapExercise(seId, d.exercises[1].id, await readData()),
    ).rejects.toThrow("abgehakten");
    expect(await db.sessionExercises.get(seId)).toBeDefined();
    expect(await db.sets.where("sessionExerciseId").equals(seId).count()).toBe(
      3,
    );
  });
  it("merges a backup into a fresh install without duplicating exercises", async () => {
    // Device A: imported legacy data plus its own seeded library.
    await importLegacyData(convertLegacy(legacySchema.parse(fixture)));
    const backup = await readData();
    const tracked = backup.exercises.find((e) => e.name === "Kniebeuge")!;
    backup.oneRms.push({
      id: "rm-a",
      exerciseId: tracked.id,
      date: "2026-10-01",
      value: 120,
      source: "tested",
    });
    // An AI cycle plan that was not accepted yet names the exercise by id.
    backup.aiRuns.push({
      id: "plan-a",
      kind: "cycle_plan",
      createdAt: "2026-10-01T10:00:00Z",
      model: "test",
      inputSummary: "",
      output: {
        days: [
          {
            label: "A",
            title: "Kraft",
            entries: [{ exerciseId: tracked.id, cells: [] }],
          },
        ],
        rationale: "",
      },
    });
    const exported = makeBackup(backup).data;
    // Device B: a fresh install seeds the same names with new ids.
    await db.delete();
    await db.open();
    await seed();
    await importData(exported, "merge");
    const merged = await readData();
    const names = merged.exercises.map((e) => e.name + "|" + e.type);
    expect(new Set(names).size).toBe(names.length);
    validateRelations(merged);
    expect(merged.sets).toHaveLength(exported.sets.length);
    const squatB = merged.exercises.filter((e) => e.name === "Kniebeuge");
    expect(squatB).toHaveLength(1);
    expect(merged.oneRms.find((r) => r.id === "rm-a")?.exerciseId).toBe(
      squatB[0].id,
    );
    const plan = merged.aiRuns.find((r) => r.id === "plan-a")!.output as {
      days: { entries: { exerciseId: string }[] }[];
    };
    expect(plan.days[0].entries[0].exerciseId).toBe(squatB[0].id);
    // Merging the same backup again changes nothing.
    await importData(exported, "merge");
    expect((await readData()).exercises).toHaveLength(merged.exercises.length);
  });
  it("reports a cancelled share sheet instead of a saved backup", async () => {
    vi.stubGlobal("navigator", {
      canShare: () => true,
      share: () => Promise.reject(new DOMException("cancel", "AbortError")),
    });
    expect(await exportBackup()).toBe(false);
    expect((await db.settings.get("settings"))?.lastBackupAt).toBeUndefined();
    vi.stubGlobal("navigator", {
      canShare: () => true,
      share: () => Promise.resolve(),
    });
    expect(await exportBackup()).toBe(true);
    expect((await db.settings.get("settings"))?.lastBackupAt).toBeDefined();
  });
  it("keeps both decisions when two check-in items are decided at once", async () => {
    await db.aiRuns.add({
      id: "run",
      kind: "weekly_checkin",
      createdAt: "2026-11-05T10:00:00Z",
      model: "test",
      inputSummary: "{}",
      output: {},
    });
    await Promise.all([
      saveDecision("run", "0", "accepted"),
      saveDecision("run", "1", "rejected"),
    ]);
    expect((await db.aiRuns.get("run"))?.decisions).toEqual({
      0: "accepted",
      1: "rejected",
    });
  });
  it("removes failed OAuth callback parameters so a reload does not repeat the error", async () => {
    const replaceState = vi.fn(),
      storage = new Map<string, string>();
    vi.stubGlobal("location", {
      href: "https://example.test/app/?state=n1&code=c1#/",
      reload: vi.fn(),
    });
    vi.stubGlobal("history", { replaceState });
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    });
    await expect(finishOAuth()).rejects.toThrow("erneut starten");
    expect(replaceState).toHaveBeenCalledTimes(1);
    const cleaned = String(replaceState.mock.calls[0][2]);
    expect(cleaned).not.toContain("code=");
    expect(cleaned).not.toContain("state=");
    expect(cleaned).toBe("https://example.test/app/#/settings");
  });
});
