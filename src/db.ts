import Dexie, { type Table } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { type Data, type Settings, defaults, emptyData, uid } from "./model";
export class TrainingDB extends Dexie {
  exercises!: Table<Data["exercises"][number], string>;
  sessions!: Table<Data["sessions"][number], string>;
  sessionExercises!: Table<Data["sessionExercises"][number], string>;
  sets!: Table<Data["sets"][number], string>;
  oneRms!: Table<Data["oneRms"][number], string>;
  cycles!: Table<Data["cycles"][number], string>;
  days!: Table<Data["days"][number], string>;
  entries!: Table<Data["entries"][number], string>;
  cells!: Table<Data["cells"][number], string>;
  skills!: Table<Data["skills"][number], string>;
  stages!: Table<Data["stages"][number], string>;
  aiRuns!: Table<Data["aiRuns"][number], string>;
  settings!: Table<Settings, string>;
  blocks!: Table<Data["blocks"][number], string>;
  constructor(name = "TrainingsplanV2") {
    super(name);
    this.version(1).stores({
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
    // Additive: workout blocks (EMOM, AMRAP, For Time).
    this.version(2).stores({ blocks: "id,sessionId" });
  }
}
export const db = new TrainingDB();
export const tableNames = Object.keys(emptyData()) as (keyof Data)[];
export async function readData(database = db): Promise<Data> {
  return database.transaction(
    "r",
    database.tables,
    async () =>
      Object.fromEntries(
        await Promise.all(
          tableNames.map(async (k) => [k, await database.table(k).toArray()]),
        ),
      ) as Data,
  );
}
export function useData() {
  return useLiveQuery(() => readData(), []);
}
export async function seed() {
  await db.transaction("rw", db.exercises, db.settings, async () => {
    if (!(await db.settings.get("settings"))) await db.settings.put(defaults);
    if (await db.exercises.count()) return;
    const seeds: [
      string,
      Data["exercises"][number]["type"],
      Data["exercises"][number]["category"],
    ][] = [
      ["Kniebeuge", "weight_reps", "Beine"],
      ["Bankdrücken", "weight_reps", "Drücken"],
      ["Kreuzheben", "weight_reps", "Beine"],
      ["Strict Press", "weight_reps", "Drücken"],
      ["Rumänisches Kreuzheben", "weight_reps", "Beine"],
      ["Klimmzug mit Zusatzgewicht", "bodyweight_load", "Ziehen"],
      ["Rudern", "weight_reps", "Ziehen"],
      ["Handstand an der Wand", "hold", "Skill"],
      ["Freier Handstand", "hold", "Skill"],
      ["L-Sit", "hold", "Skill"],
      ["Muscle-up", "reps_only", "Skill"],
      ["Liegestütz", "reps_only", "Drücken"],
    ];
    await db.exercises.bulkPut(
      seeds.map(([name, type, category]) => ({
        id: uid(),
        name,
        type,
        category,
        trackOneRm: type === "weight_reps",
        unilateral: false,
        weightStep: 2.5,
        isCustom: false,
        archived: false,
        createdAt: new Date().toISOString(),
      })),
    );
  });
}
