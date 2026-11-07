import { db } from "./db";
import {
  type Block,
  type Data,
  type SessionExercise,
  type SetLog,
  fmt,
  uid,
} from "./model";

// Workout blocks (EMOM, AMRAP, For Time). The user enters the work per round
// for each movement and the result of the block; the sets of the movements
// are derived from both, so volume and history work like for normal sets.

export const formatLabels: Record<Block["format"], string> = {
  emom: "EMOM",
  amrap: "AMRAP",
  for_time: "For Time",
};

export const blockDefaults: Record<
  Block["format"],
  Pick<Block, "minutes" | "intervalSeconds" | "rounds">
> = {
  emom: { minutes: 10, intervalSeconds: 60 },
  amrap: { minutes: 12 },
  for_time: { rounds: 5 },
};

export function intervals(b: Pick<Block, "minutes" | "intervalSeconds">) {
  return b.minutes && b.intervalSeconds
    ? Math.floor((b.minutes * 60) / b.intervalSeconds)
    : 0;
}

type Target = Pick<SessionExercise, "targetReps" | "targetSeconds">;
export type MovementPlan = {
  total: number;
  done: number;
  partialReps?: number;
};

// Full rounds plus extra reps of an unfinished round, spread over the
// movements in order. A hold in the unfinished round is not counted.
function roundsPlusReps(
  movements: Target[],
  rounds: number,
  reps: number,
): MovementPlan[] {
  let left = reps;
  return movements.map((m) => {
    const plan: MovementPlan = { total: rounds, done: rounds };
    if (left > 0 && m.targetReps) {
      const take = Math.min(left, m.targetReps);
      left -= take;
      if (take === m.targetReps) plan.done++;
      else plan.partialReps = take;
      plan.total = plan.done + (plan.partialReps ? 1 : 0);
    }
    return plan;
  });
}

// How many sets each movement gets and how many of them are done.
export function blockPlan(b: Block, movements: Target[]): MovementPlan[] {
  if (b.format === "emom") {
    const n = intervals(b),
      done = Math.min(b.scoreRounds ?? 0, n),
      k = movements.length,
      count = (upTo: number, i: number) =>
        upTo > i ? Math.floor((upTo - i - 1) / k) + 1 : 0;
    return movements.map((_, i) =>
      b.alternate && k > 1
        ? { total: Math.max(1, count(n, i)), done: count(done, i) }
        : { total: Math.max(1, n), done },
    );
  }
  if (b.format === "amrap") {
    if (b.scoreRounds === undefined && b.scoreReps === undefined)
      return movements.map(() => ({ total: 1, done: 0 }));
    return roundsPlusReps(movements, b.scoreRounds ?? 0, b.scoreReps ?? 0).map(
      (p) => ({ ...p, total: Math.max(1, p.total) }),
    );
  }
  const rounds = b.rounds ?? 1;
  if (b.capped && (b.scoreRounds !== undefined || b.scoreReps !== undefined))
    return roundsPlusReps(
      movements,
      Math.min(b.scoreRounds ?? 0, rounds),
      b.scoreReps ?? 0,
    ).map((p) => ({ ...p, total: Math.max(rounds, p.total) }));
  return movements.map(() => ({
    total: rounds,
    done: !b.capped && b.scoreSeconds !== undefined ? rounds : 0,
  }));
}

export function hasResult(b: Block) {
  return b.format === "for_time" && !b.capped
    ? b.scoreSeconds !== undefined
    : b.scoreRounds !== undefined || b.scoreReps !== undefined;
}

export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

export function blockTitle(b: Block) {
  if (b.format === "for_time")
    return `${b.rounds ?? 1} ${b.rounds === 1 ? "Runde" : "Runden"} For Time`;
  return `${formatLabels[b.format]} ${b.minutes ?? "–"}'`;
}

export function blockDetails(b: Block, movementCount: number) {
  const parts: string[] = [];
  if (b.format === "emom") {
    parts.push(`Intervall ${b.intervalSeconds ?? "–"} s`);
    if (b.alternate && movementCount > 1) parts.push("abwechselnd");
  }
  if (b.format === "for_time" && b.minutes) parts.push(`Timecap ${b.minutes}'`);
  parts.push(`${movementCount} ${movementCount === 1 ? "Übung" : "Übungen"}`);
  return parts.join(" · ");
}

const roundsText = (rounds = 0, reps = 0) =>
  `${rounds} ${rounds === 1 ? "Runde" : "Runden"}${reps ? ` + ${reps} Wdh` : ""}`;

export function scoreText(b: Block) {
  if (!hasResult(b)) return "Resultat offen";
  if (b.format === "emom")
    return `${Math.min(b.scoreRounds ?? 0, intervals(b))}/${intervals(b)} Intervalle`;
  if (b.format === "amrap") return roundsText(b.scoreRounds, b.scoreReps);
  return b.capped
    ? `Timecap · ${roundsText(b.scoreRounds, b.scoreReps)}`
    : clock(b.scoreSeconds ?? 0);
}

export function movementText(
  se: SessionExercise,
  type: Data["exercises"][number]["type"],
) {
  const work =
    type === "hold"
      ? `${se.targetSeconds !== undefined ? fmt(se.targetSeconds) : "–"} s`
      : `${se.targetReps ?? "–"} Wdh`;
  return ["weight_reps", "bodyweight_load"].includes(type) &&
    se.targetWeight !== undefined
    ? `${work} × ${type === "bodyweight_load" ? "+" : ""}${fmt(se.targetWeight)} kg`
    : work;
}

// Repeated blocks: blocks of finished sessions that have a result, grouped by
// what makes them the same workout (format, duration or rounds, EMOM interval
// and turns, and the same exercises in any order). Work per round and the
// For Time cap may differ between entries: that is the progress to compare.
export type BlockEntry = {
  block: Block;
  session: Data["sessions"][number];
  movements: SessionExercise[];
};
export type BlockGroup = {
  key: string;
  title: string;
  details: string;
  exerciseIds: string[];
  entries: BlockEntry[];
};

export function blockKey(b: Block, exerciseIds: string[]) {
  const shape =
    b.format === "emom"
      ? [
          b.minutes,
          b.intervalSeconds,
          b.alternate && exerciseIds.length > 1 ? "alt" : "",
        ]
      : b.format === "amrap"
        ? [b.minutes]
        : [b.rounds ?? 1];
  return [b.format, ...shape, ...[...exerciseIds].sort()].join("|");
}

export function repeatedBlocks(d: Data): BlockGroup[] {
  const groups = new Map<string, BlockGroup>();
  for (const b of d.blocks) {
    const session = d.sessions.find((s) => s.id === b.sessionId);
    if (!session?.finishedAt || !hasResult(b)) continue;
    const movements = d.sessionExercises
      .filter((x) => x.blockId === b.id)
      .sort((a, c) => a.order - c.order);
    if (!movements.length) continue;
    const ids = movements.map((m) => m.exerciseId),
      key = blockKey(b, ids),
      entry = { block: b, session, movements };
    const g = groups.get(key);
    if (g) g.entries.push(entry);
    else
      groups.set(key, {
        key,
        title: blockTitle(b),
        details:
          b.format === "emom"
            ? [
                `Intervall ${b.intervalSeconds ?? "–"} s`,
                ...(b.alternate && ids.length > 1 ? ["abwechselnd"] : []),
              ].join(" · ")
            : "",
        exerciseIds: ids,
        entries: [entry],
      });
  }
  const newest = (e: BlockEntry) =>
    e.session.date + (e.session.finishedAt ?? "");
  return [...groups.values()]
    .map((g) => {
      const entries = g.entries.sort((a, c) =>
        newest(c).localeCompare(newest(a)),
      );
      // Exercise order as in the most recent block.
      return {
        ...g,
        exerciseIds: entries[0].movements.map((m) => m.exerciseId),
        entries,
      };
    })
    .sort((a, c) => newest(c.entries[0]).localeCompare(newest(a.entries[0])));
}

// Next position among the standalone exercises and blocks of a session.
export async function nextOrder(sessionId: string) {
  const items = [
    ...(
      await db.sessionExercises.where("sessionId").equals(sessionId).toArray()
    )
      .filter((x) => !x.blockId)
      .map((x) => x.order),
    ...(await db.blocks.where("sessionId").equals(sessionId).toArray()).map(
      (x) => x.order,
    ),
  ];
  return items.length ? Math.max(...items) + 1 : 0;
}

const blockTables = [db.blocks, db.sessions, db.sessionExercises, db.sets];

// Rewrites the sets of all movements of a block from targets and result.
async function syncSets(blockId: string) {
  const b = await db.blocks.get(blockId);
  if (!b) return;
  const session = await db.sessions.get(b.sessionId);
  if (!session) return;
  const movements = (
    await db.sessionExercises.where("sessionId").equals(b.sessionId).toArray()
  )
    .filter((x) => x.blockId === blockId)
    .sort((a, c) => a.order - c.order);
  const plans = blockPlan(b, movements),
    rows: SetLog[] = [];
  movements.forEach((m, i) => {
    const p = plans[i],
      hold = m.targetSeconds !== undefined && m.targetReps === undefined;
    for (let j = 0; j < p.total; j++) {
      const partial = p.partialReps !== undefined && j === p.done;
      rows.push({
        id: uid(),
        sessionExerciseId: m.id,
        exerciseId: m.exerciseId,
        date: session.date,
        order: j,
        isWarmup: false,
        blockId,
        weight: m.targetWeight,
        reps: hold ? undefined : partial ? p.partialReps : m.targetReps,
        seconds: hold ? m.targetSeconds : undefined,
        done: j < p.done || partial,
      });
    }
  });
  const ids = movements.map((m) => m.id);
  await db.sets.where("sessionExerciseId").anyOf(ids).delete();
  await db.sets.bulkAdd(rows);
}

export async function addBlock(
  sessionId: string,
  format: Block["format"],
  params: Partial<Block> = {},
) {
  const id = uid();
  await db.transaction("rw", blockTables, async () => {
    if (!(await db.sessions.get(sessionId)))
      throw Error("Einheit nicht gefunden.");
    await db.blocks.add({
      ...blockDefaults[format],
      ...params,
      id,
      sessionId,
      format,
      order: await nextOrder(sessionId),
    });
  });
  return id;
}

export async function updateBlock(blockId: string, patch: Partial<Block>) {
  await db.transaction("rw", blockTables, async () => {
    await db.blocks.update(blockId, patch);
    await syncSets(blockId);
  });
}

export async function deleteBlock(blockId: string) {
  await db.transaction("rw", blockTables, async () => {
    const b = await db.blocks.get(blockId);
    if (!b) return;
    const ids = (
      await db.sessionExercises.where("sessionId").equals(b.sessionId).toArray()
    )
      .filter((x) => x.blockId === blockId)
      .map((x) => x.id);
    await db.sets.where("sessionExerciseId").anyOf(ids).delete();
    await db.sessionExercises.bulkDelete(ids);
    await db.blocks.delete(blockId);
  });
}

// Prefills the work per round from the last time this exercise was in a block.
export async function addMovement(
  blockId: string,
  exerciseId: string,
  d: Data,
) {
  const e = d.exercises.find((x) => x.id === exerciseId);
  if (!e) throw Error("Übung nicht gefunden.");
  const date = (se: SessionExercise) =>
      d.sessions.find((s) => s.id === se.sessionId)?.date ?? "",
    previous = d.sessionExercises
      .filter((x) => x.exerciseId === exerciseId && x.blockId)
      .sort((a, b) => date(b).localeCompare(date(a)))[0],
    hold = e.type === "hold",
    weight = ["weight_reps", "bodyweight_load"].includes(e.type),
    id = uid();
  await db.transaction("rw", blockTables, async () => {
    const b = await db.blocks.get(blockId);
    if (!b) throw Error("Block nicht gefunden.");
    const siblings = (
      await db.sessionExercises.where("sessionId").equals(b.sessionId).toArray()
    ).filter((x) => x.blockId === blockId);
    await db.sessionExercises.add({
      id,
      sessionId: b.sessionId,
      exerciseId,
      blockId,
      order: siblings.length
        ? Math.max(...siblings.map((x) => x.order)) + 1
        : 0,
      status: "planned",
      targetReps: hold ? undefined : (previous?.targetReps ?? 10),
      targetSeconds: hold ? (previous?.targetSeconds ?? 30) : undefined,
      targetWeight: weight ? previous?.targetWeight : undefined,
    });
    await syncSets(blockId);
  });
  return id;
}

export async function updateMovement(
  sessionExerciseId: string,
  patch: Pick<
    Partial<SessionExercise>,
    "targetWeight" | "targetReps" | "targetSeconds"
  >,
) {
  await db.transaction("rw", blockTables, async () => {
    const se = await db.sessionExercises.get(sessionExerciseId);
    if (!se?.blockId) throw Error("Übung nicht gefunden.");
    await db.sessionExercises.update(sessionExerciseId, patch);
    await syncSets(se.blockId);
  });
}

export async function removeMovement(sessionExerciseId: string) {
  await db.transaction("rw", blockTables, async () => {
    const se = await db.sessionExercises.get(sessionExerciseId);
    if (!se?.blockId) return;
    await db.sets.where("sessionExerciseId").equals(sessionExerciseId).delete();
    await db.sessionExercises.delete(sessionExerciseId);
    await syncSets(se.blockId);
  });
}

// Built-in block timer: a 10 s countdown, then the block. Pure, so the view
// can be computed from the elapsed time after a reload or a pause.
export const countdownSeconds = 10;

export function blockSeconds(b: Block) {
  if (b.format === "emom") return intervals(b) * (b.intervalSeconds ?? 60);
  return b.minutes ? b.minutes * 60 : undefined;
}

export type TimerView =
  | { phase: "countdown"; remaining: number }
  | {
      phase: "work";
      elapsed: number;
      remaining?: number;
      interval?: number;
      intervalRemaining?: number;
    }
  | { phase: "done"; elapsed: number };

export function timerView(b: Block, elapsedSeconds: number): TimerView {
  const t = elapsedSeconds - countdownSeconds;
  if (t < 0) return { phase: "countdown", remaining: -t };
  const total = blockSeconds(b);
  if (total !== undefined && t >= total)
    return { phase: "done", elapsed: total };
  if (b.format === "emom") {
    const length = b.intervalSeconds ?? 60;
    return {
      phase: "work",
      elapsed: t,
      remaining: total! - t,
      interval: Math.floor(t / length) + 1,
      intervalRemaining: length - (t % length),
    };
  }
  return {
    phase: "work",
    elapsed: t,
    remaining: total === undefined ? undefined : total - t,
  };
}

// Whole seconds that get a beep: 3-2-1 before the start and before every
// EMOM interval, a long one when an interval starts or the block ends.
export function beepAt(
  b: Block,
  elapsedSeconds: number,
): "short" | "long" | undefined {
  const v = timerView(b, elapsedSeconds);
  if (v.phase === "countdown") return v.remaining <= 3 ? "short" : undefined;
  if (v.phase === "done") return "long";
  const left = v.intervalRemaining ?? v.remaining;
  if (v.elapsed === 0 || v.intervalRemaining === (b.intervalSeconds ?? 60))
    return "long";
  return left !== undefined && left <= 3 ? "short" : undefined;
}
