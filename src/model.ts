import { z } from "zod";
const id = z.string().min(1).max(200),
  text = z.string().max(10000),
  n = z.number().finite().nonnegative(),
  integer = n.int(),
  date = z.iso.date();
export const categories = [
  "Beine",
  "Drücken",
  "Ziehen",
  "Rumpf",
  "Skill",
  "Conditioning",
  "Andere",
] as const;
export const exerciseTypes = [
  "weight_reps",
  "bodyweight_load",
  "hold",
  "reps_only",
] as const;
export const exerciseSchema = z.object({
  id,
  name: text.min(1),
  type: z.enum(exerciseTypes),
  category: z.enum(categories),
  trackOneRm: z.boolean(),
  unilateral: z.boolean(),
  weightStep: z.number().positive().max(100),
  isCustom: z.boolean(),
  archived: z.boolean(),
  aliases: z.array(text).optional(),
  createdAt: text,
});
export const sessionSchema = z.object({
  id,
  date,
  startedAt: text.optional(),
  finishedAt: text.optional(),
  cycleId: id.optional(),
  week: integer.min(1).max(52).optional(),
  dayId: id.optional(),
  title: text.optional(),
  note: text.optional(),
  dateIsApproximate: z.boolean().optional(),
});
export const sessionExerciseSchema = z.object({
  id,
  sessionId: id,
  exerciseId: id,
  order: integer,
  status: z.enum(["planned", "done", "skipped", "substituted"]),
  substitutedFromExerciseId: id.optional(),
  plannedEntryId: id.optional(),
  rpeLastSet: z.number().min(6).max(10).optional(),
  note: text.optional(),
  // Movement of a workout block: the work per round. Its sets are derived
  // from these targets and the block result (see blocks.ts).
  blockId: id.optional(),
  targetWeight: n.max(2000).optional(),
  targetReps: integer.max(10000).optional(),
  targetSeconds: n.max(86400).optional(),
});
export const setSchema = z.object({
  id,
  sessionExerciseId: id,
  exerciseId: id,
  date,
  order: integer,
  isWarmup: z.boolean(),
  weight: n.max(2000).optional(),
  reps: integer.max(10000).optional(),
  seconds: n.max(86400).optional(),
  done: z.boolean(),
  // Set derived from a workout block; excluded from 1RM, records and skills.
  blockId: id.optional(),
});
export const blockFormats = ["emom", "amrap", "for_time"] as const;
export const blockSchema = z.object({
  id,
  sessionId: id,
  order: integer,
  format: z.enum(blockFormats),
  // EMOM and AMRAP: duration; For Time: optional time cap.
  minutes: integer.min(1).max(600).optional(),
  intervalSeconds: integer.min(10).max(3600).optional(),
  // EMOM: movements take turns, one per interval.
  alternate: z.boolean().optional(),
  rounds: integer.min(1).max(1000).optional(),
  // EMOM: intervals done; AMRAP and capped For Time: full rounds and extra reps.
  scoreRounds: integer.max(10000).optional(),
  scoreReps: integer.max(100000).optional(),
  scoreSeconds: n.max(86400).optional(),
  capped: z.boolean().optional(),
  note: text.optional(),
});
export const rmSchema = z.object({
  id,
  exerciseId: id,
  date,
  value: z.number().positive().max(2000),
  source: z.enum(["tested", "manual"]),
  note: text.optional(),
});
export const cycleSchema = z.object({
  id,
  name: text.min(1),
  startDate: date,
  weeks: integer.min(1).max(52),
  deloadWeeks: z.array(integer.min(1).max(52)),
  status: z.enum(["draft", "active", "completed", "archived"]),
  goal: text.optional(),
  createdBy: z.enum(["user", "ai", "template", "legacy"]),
  createdAt: text,
});
export const daySchema = z.object({
  id,
  cycleId: id,
  label: text.min(1),
  order: integer,
  title: text.optional(),
});
export const entrySchema = z.object({
  id,
  cycleId: id,
  dayId: id,
  exerciseId: id,
  order: integer,
});
export const cellSchema = z.object({
  id,
  entryId: id,
  week: integer.min(1).max(52),
  sets: integer.min(1).max(30),
  reps: integer.min(1).max(1000).optional(),
  seconds: n.max(86400).optional(),
  loadMode: z.enum(["pct", "kg", "none"]),
  pct: n.max(200).optional(),
  kg: n.max(2000).optional(),
  note: text.optional(),
});
export const criterionSchema = z.object({
  kind: z.enum(["hold_seconds", "reps", "custom"]),
  target: n.optional(),
  text: text.optional(),
});
export const skillSchema = z.object({
  id,
  name: text.min(1),
  currentStage: integer,
  createdAt: text,
});
export const stageSchema = z.object({
  id,
  skillId: id,
  order: integer,
  name: text.min(1),
  exerciseId: id.optional(),
  criterion: criterionSchema,
  achievedAt: text.optional(),
});
export const aiKinds = [
  "cycle_plan",
  "weekly_checkin",
  "cycle_review",
  "plateau",
  "skill_stages",
  "data_qa",
] as const;
export const aiRunSchema = z.object({
  id,
  kind: z.enum(aiKinds),
  createdAt: text,
  model: text,
  inputSummary: text,
  output: z.unknown(),
  decisions: z.record(z.string(), z.enum(["accepted", "rejected"])).optional(),
});
export const settingsSchema = z.object({
  id: z.literal("settings"),
  oneRmFormula: z.enum(["epley", "brzycki"]),
  barWeight: n.max(100),
  plates: z.array(z.number().positive().max(100)).min(1),
  defaultRestSeconds: integer.min(0).max(3600),
  openRouterApiKey: text.optional(),
  openRouterModel: text.optional(),
  aiEnabled: z.boolean().default(false),
  lastBackupAt: text.optional(),
});
export type Exercise = z.infer<typeof exerciseSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionExercise = z.infer<typeof sessionExerciseSchema>;
export type SetLog = z.infer<typeof setSchema>;
export type OneRmRecord = z.infer<typeof rmSchema>;
export type Cycle = z.infer<typeof cycleSchema>;
export type CycleDay = z.infer<typeof daySchema>;
export type CycleEntry = z.infer<typeof entrySchema>;
export type CycleCell = z.infer<typeof cellSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type SkillStage = z.infer<typeof stageSchema>;
export type AiRun = z.infer<typeof aiRunSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Block = z.infer<typeof blockSchema>;
export const dataSchema = z.object({
  exercises: z.array(exerciseSchema),
  sessions: z.array(sessionSchema),
  sessionExercises: z.array(sessionExerciseSchema),
  sets: z.array(setSchema),
  oneRms: z.array(rmSchema),
  cycles: z.array(cycleSchema),
  days: z.array(daySchema),
  entries: z.array(entrySchema),
  cells: z.array(cellSchema),
  skills: z.array(skillSchema),
  stages: z.array(stageSchema),
  aiRuns: z.array(aiRunSchema),
  settings: z.array(settingsSchema).max(1),
  // Added after the first release: older backups have no blocks.
  blocks: z.array(blockSchema).default([]),
});
export type Data = z.infer<typeof dataSchema>;
export const defaults: Settings = {
  id: "settings",
  oneRmFormula: "epley",
  barWeight: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  defaultRestSeconds: 120,
  aiEnabled: false,
};
export const uid = () => crypto.randomUUID();
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const emptyData = (): Data => ({
  exercises: [],
  sessions: [],
  sessionExercises: [],
  sets: [],
  oneRms: [],
  cycles: [],
  days: [],
  entries: [],
  cells: [],
  skills: [],
  stages: [],
  aiRuns: [],
  settings: [],
  blocks: [],
});
export const dateAdd = (d: string, days: number) =>
  new Date(Date.parse(d + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
export const formatDate = (d: string) =>
  new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(d + "T12:00:00"));
export const fmt = (n: number) =>
  new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 }).format(n);
