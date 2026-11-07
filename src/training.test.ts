import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, readData, seed } from "./db";
import { addExercise, deleteSession, startSession } from "./training";

describe("deleting a session", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await seed();
  });
  afterEach(async () => {
    await db.delete();
  });
  it("removes the session with its exercises and sets and keeps others", async () => {
    let d = await readData();
    const keep = await startSession(d);
    d = await readData();
    await addExercise(keep, d.exercises[0].id, d);
    await db.sessions.update(keep, { finishedAt: new Date().toISOString() });
    d = await readData();
    const gone = await startSession(d);
    d = await readData();
    await addExercise(gone, d.exercises[0].id, d);
    await addExercise(gone, d.exercises[1].id, await readData());
    await db.oneRms.add({
      id: "rm",
      exerciseId: d.exercises[0].id,
      date: "2026-11-01",
      value: 100,
      source: "tested",
    });

    await deleteSession(gone);

    const after = await readData();
    expect(after.sessions.map((s) => s.id)).toEqual([keep]);
    expect(after.sessionExercises.map((e) => e.sessionId)).toEqual([keep]);
    expect(after.sets).toHaveLength(3);
    expect(
      after.sets.every(
        (s) => s.sessionExerciseId === after.sessionExercises[0].id,
      ),
    ).toBe(true);
    expect(after.oneRms).toHaveLength(1);
    expect(after.exercises).toHaveLength(d.exercises.length);
  });
});
