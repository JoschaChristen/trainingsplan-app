import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { TrainingDB, db, readData, seed } from "./db";
import {
  addBlock,
  addMovement,
  blockPlan,
  deleteBlock,
  intervals,
  beepAt,
  removeMovement,
  scoreText,
  timerView,
  updateBlock,
  updateMovement,
} from "./blocks";
import { deleteSession, startSession, addExercise } from "./training";
import { personalRecords, series, volume } from "./calculations";
import { importData, makeBackup, validateRelations } from "./import-export";
import { type Block } from "./model";

const block = (b: Partial<Block>): Block => ({
  id: "b",
  sessionId: "s",
  order: 0,
  format: "emom",
  ...b,
});

describe("block plan", () => {
  it("gives every movement one set per interval in a classic EMOM", () => {
    const b = block({ minutes: 12, intervalSeconds: 60, scoreRounds: 11 });
    expect(intervals(b)).toBe(12);
    expect(blockPlan(b, [{ targetReps: 3 }, { targetReps: 5 }])).toEqual([
      { total: 12, done: 11 },
      { total: 12, done: 11 },
    ]);
    expect(scoreText(b)).toBe("11/12 Intervalle");
  });
  it("splits the intervals of an alternating EMOM between the movements", () => {
    const b = block({
      minutes: 10,
      intervalSeconds: 60,
      alternate: true,
      scoreRounds: 9,
    });
    expect(
      blockPlan(b, [{ targetReps: 12 }, { targetReps: 10 }, { targetReps: 8 }]),
    ).toEqual([
      { total: 4, done: 3 },
      { total: 3, done: 3 },
      { total: 3, done: 3 },
    ]);
  });
  it("counts an E2MOM by its intervals and never more done than planned", () => {
    const b = block({ minutes: 20, intervalSeconds: 120, scoreRounds: 99 });
    expect(blockPlan(b, [{ targetReps: 2 }])).toEqual([
      { total: 10, done: 10 },
    ]);
  });
  it("spreads the extra reps of an AMRAP over the movements in order", () => {
    const b = block({ format: "amrap", scoreRounds: 3, scoreReps: 12 });
    expect(
      blockPlan(b, [{ targetReps: 5 }, { targetReps: 10 }, { targetReps: 15 }]),
    ).toEqual([
      { total: 4, done: 4 },
      { total: 4, done: 3, partialReps: 7 },
      { total: 3, done: 3 },
    ]);
    expect(scoreText(b)).toBe("3 Runden + 12 Wdh");
  });
  it("keeps one open set per movement while an AMRAP has no result", () => {
    const b = block({ format: "amrap", minutes: 12 });
    expect(blockPlan(b, [{ targetReps: 5 }, { targetSeconds: 30 }])).toEqual([
      { total: 1, done: 0 },
      { total: 1, done: 0 },
    ]);
    expect(scoreText(b)).toBe("Resultat offen");
  });
  it("marks all rounds of a finished For Time as done", () => {
    const b = block({ format: "for_time", rounds: 5, scoreSeconds: 525 });
    expect(blockPlan(b, [{ targetReps: 10 }])).toEqual([{ total: 5, done: 5 }]);
    expect(scoreText(b)).toBe("8:45");
  });
  it("keeps the open rounds of a For Time that hit the time cap", () => {
    const b = block({
      format: "for_time",
      rounds: 5,
      minutes: 15,
      capped: true,
      scoreRounds: 3,
      scoreReps: 4,
    });
    expect(blockPlan(b, [{ targetReps: 10 }, { targetReps: 10 }])).toEqual([
      { total: 5, done: 3, partialReps: 4 },
      { total: 5, done: 3 },
    ]);
    expect(scoreText(b)).toBe("Timecap · 3 Runden + 4 Wdh");
  });
});

describe("block timer", () => {
  const emom = block({ minutes: 10, intervalSeconds: 60 });
  it("counts down 10 s and then runs the EMOM intervals", () => {
    expect(timerView(emom, 3)).toEqual({ phase: "countdown", remaining: 7 });
    expect(timerView(emom, 10 + 75)).toEqual({
      phase: "work",
      elapsed: 75,
      remaining: 525,
      interval: 2,
      intervalRemaining: 45,
    });
    expect(timerView(emom, 10 + 600)).toEqual({ phase: "done", elapsed: 600 });
  });
  it("beeps 3-2-1 before the start and every interval", () => {
    const beeps = Array.from({ length: 80 }, (_, s) => beepAt(emom, s));
    expect(beeps.slice(0, 11)).toEqual([
      ...Array(7).fill(undefined),
      "short",
      "short",
      "short",
      "long",
    ]);
    expect(beeps.slice(67, 72)).toEqual([
      "short",
      "short",
      "short",
      "long",
      undefined,
    ]);
  });
  it("runs an AMRAP down and a For Time without cap open-ended", () => {
    const amrap = block({ format: "amrap", minutes: 12 });
    expect(timerView(amrap, 10 + 60)).toEqual({
      phase: "work",
      elapsed: 60,
      remaining: 660,
    });
    const forTime = block({ format: "for_time", rounds: 5 });
    expect(timerView(forTime, 10 + 5000)).toEqual({
      phase: "work",
      elapsed: 5000,
      remaining: undefined,
    });
    expect(beepAt(forTime, 10 + 100)).toBeUndefined();
  });
});

describe("blocks in the database", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await seed();
  });
  afterEach(async () => {
    await db.delete();
  });
  async function emomSession() {
    let d = await readData();
    const sessionId = await startSession(d);
    d = await readData();
    const squat = d.exercises.find((e) => e.name === "Kniebeuge")!;
    const blockId = await addBlock(sessionId, "emom", {
      minutes: 10,
      intervalSeconds: 60,
    });
    const seId = await addMovement(blockId, squat.id, await readData());
    await updateMovement(seId, { targetWeight: 100, targetReps: 3 });
    return { sessionId, blockId, seId, squat };
  }
  it("derives the sets of a movement from its targets and the result", async () => {
    const { blockId, seId } = await emomSession();
    let d = await readData();
    expect(d.sets.filter((s) => s.sessionExerciseId === seId)).toHaveLength(10);
    expect(d.sets.some((s) => s.done)).toBe(false);
    await updateBlock(blockId, { scoreRounds: 9 });
    d = await readData();
    const sets = d.sets.filter((s) => s.sessionExerciseId === seId);
    expect(sets.filter((s) => s.done)).toHaveLength(9);
    expect(sets.every((s) => s.blockId === blockId)).toBe(true);
    expect(sets.every((s) => s.weight === 100 && s.reps === 3)).toBe(true);
    expect(volume(d.sets)).toBe(2700);
  });
  it("keeps block sets out of the 1RM series and the records", async () => {
    const { blockId, squat } = await emomSession();
    await updateBlock(blockId, { scoreRounds: 10 });
    const d = await readData();
    expect(series(squat, d)).toEqual([]);
    expect(personalRecords(d.sets, [], squat, "epley")).toEqual([]);
  });
  it("places a block and later exercises in the order they were added", async () => {
    const { sessionId, squat } = await emomSession();
    const seId = await addExercise(sessionId, squat.id, await readData());
    const d = await readData();
    expect(d.blocks[0].order).toBe(0);
    expect(d.sessionExercises.find((x) => x.id === seId)?.order).toBe(1);
    // The prefill of a normal exercise ignores the block sets.
    expect(
      d.sets.filter((s) => s.sessionExerciseId === seId).map((s) => s.weight),
    ).toEqual([undefined, undefined, undefined]);
  });
  it("removes a movement, a block and a session with all their rows", async () => {
    const { sessionId, blockId, seId } = await emomSession();
    const d0 = await readData();
    const second = await addMovement(blockId, d0.exercises[0].id, d0);
    await removeMovement(seId);
    let d = await readData();
    expect(d.sessionExercises.map((x) => x.id)).toEqual([second]);
    expect(d.sets.every((s) => s.sessionExerciseId === second)).toBe(true);
    await deleteBlock(blockId);
    d = await readData();
    expect(d.blocks).toHaveLength(0);
    expect(d.sessionExercises).toHaveLength(0);
    expect(d.sets).toHaveLength(0);
    const other = await addBlock(sessionId, "amrap");
    await addMovement(other, d.exercises[0].id, d);
    await deleteSession(sessionId);
    d = await readData();
    expect([d.sessions, d.blocks, d.sessionExercises, d.sets]).toEqual([
      [],
      [],
      [],
      [],
    ]);
  });
  it("round-trips blocks through a backup and rejects a dangling block", async () => {
    const { blockId } = await emomSession();
    await updateBlock(blockId, { scoreRounds: 10 });
    const backup = makeBackup(await readData());
    await importData(backup.data, "replace");
    const d = await readData();
    expect(d.blocks).toHaveLength(1);
    expect(d.sets.filter((s) => s.blockId === blockId)).toHaveLength(10);
    const broken = structuredClone(d);
    broken.blocks = [];
    expect(() => validateRelations(broken)).toThrow("ungültige Verknüpfungen");
  });
  it("imports a backup made before blocks existed", async () => {
    const { blocks: _blocks, ...old } = makeBackup(await readData()).data;
    await importData(old as never, "replace");
    expect((await readData()).blocks).toEqual([]);
  });
});

describe("schema migration", () => {
  it("opens a version 1 database with its data and an empty blocks table", async () => {
    const name = "MigrationTest";
    const v1 = new Dexie(name);
    v1.version(1).stores({
      exercises: "id,name,category,archived",
      sessions: "id,date,cycleId",
      sessionExercises: "id,sessionId,exerciseId",
      sets: "id,exerciseId,date,sessionExerciseId",
      oneRms: "id,exerciseId,date",
      cycles: "id,status",
      days: "id,cycleId",
      entries: "id,cycleId,dayId",
      cells: "id,entryId,[entryId+week]",
      skills: "id",
      stages: "id,skillId",
      aiRuns: "id,kind,createdAt",
      settings: "id",
    });
    await v1.table("sessions").add({ id: "old", date: "2026-11-01" });
    v1.close();
    const v2 = new TrainingDB(name);
    const d = await readData(v2);
    expect(d.sessions).toEqual([{ id: "old", date: "2026-11-01" }]);
    expect(d.blocks).toEqual([]);
    expect(v2.verno).toBe(2);
    await v2.delete();
  });
});
