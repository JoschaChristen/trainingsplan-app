import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestAi, summarize, validateAi } from "./ai";
import { db, readData, seed } from "./db";
import { defaults, emptyData, type Data } from "./model";

describe("AI proposals are validated before persistence", () => {
  let data: Data;
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await seed();
    data = await readData();
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.delete();
  });
  it("rejects invented exercise IDs, missing weeks and kg for tracked lifts", () => {
    const e = data.exercises.find((e) => e.trackOneRm)!;
    const plan = {
      days: [
        {
          label: "A",
          title: "Strength",
          entries: [
            {
              exerciseId: e.id,
              cells: [
                {
                  week: 1,
                  sets: 3,
                  reps: 5,
                  seconds: null,
                  loadMode: "pct",
                  pct: 70,
                  kg: null,
                  note: "",
                },
              ],
            },
          ],
        },
      ],
      rationale: "Progression",
    };
    expect(() => validateAi("cycle_plan", plan, data, 1)).not.toThrow();
    expect(() => validateAi("cycle_plan", plan, data, 2)).toThrow("Wochen");
    expect(() =>
      validateAi(
        "cycle_plan",
        {
          ...plan,
          days: [
            {
              ...plan.days[0],
              entries: [{ ...plan.days[0].entries[0], exerciseId: "invented" }],
            },
          ],
        },
        data,
        1,
      ),
    ).toThrow("unbekannte");
    plan.days[0].entries[0].cells[0].loadMode = "kg";
    expect(() => validateAi("cycle_plan", plan, data, 1)).toThrow("kg");
  });
  it("rejects unsupported figures and excludes secrets and session notes from summaries", () => {
    data.settings = [{ ...defaults, openRouterApiKey: "test-secret" }];
    data.sessions = [
      { id: "private", date: "2026-11-05", note: "private-note" },
    ];
    expect(JSON.stringify(summarize(data))).not.toContain("test-secret");
    expect(JSON.stringify(summarize(data))).not.toContain("private-note");
    expect(() =>
      validateAi(
        "data_qa",
        {
          answer: "Wrong",
          figuresUsed: [{ label: "invented", value: 999, date: "2026-11" }],
        },
        data,
        1,
      ),
    ).toThrow("Zahl");
  });
  it("retries malformed JSON once, stores only the valid proposal, and never changes training", async () => {
    const output = {
      headline: "Dein Rückblick",
      highlights: [],
      recommendationsForNext: ["Weiter trainieren"],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "invalid" } }] }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(output) } }],
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const before = await readData();
    const result = await requestAi(
      "cycle_review",
      { summary: summarize(data) },
      {
        ...defaults,
        aiEnabled: true,
        openRouterApiKey: "synthetic",
        openRouterModel: "test/model",
      },
      data,
      8,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.output).toEqual(output);
    expect(await db.aiRuns.count()).toBe(1);
    const after = await readData();
    expect({ ...after, aiRuns: [] }).toEqual(before);
  });
  it("does not retry an invalid credential or persist a failed response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      requestAi(
        "data_qa",
        {},
        {
          ...defaults,
          aiEnabled: true,
          openRouterApiKey: "synthetic",
          openRouterModel: "test/model",
        },
        emptyData(),
        1,
      ),
    ).rejects.toThrow("Schlüssel");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await db.aiRuns.count()).toBe(0);
  });
});
