import { test, expect } from "@playwright/test";
import {
  addExercise,
  dump,
  open,
  sheet,
  startFreeSessionWith,
  watchErrors,
} from "./helpers";

test("a free session survives a reload and is saved to the history", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await startFreeSessionWith(page, "Kniebeuge");
  const kg1 = page.getByLabel("Kniebeuge Satz 1 kg"),
    reps1 = page.getByLabel("Kniebeuge Satz 1 Wiederholungen"),
    kg2 = page.getByLabel("Kniebeuge Satz 2 kg"),
    reps2 = page.getByLabel("Kniebeuge Satz 2 Wiederholungen");
  await kg1.fill("100");
  await reps1.fill("5");
  await kg2.fill("102.5");
  await reps2.fill("3");
  await page.getByRole("button", { name: "Satz 1 abhaken" }).click();
  await expect(
    page.getByRole("button", { name: "Satz 1 wieder öffnen" }),
  ).toBeVisible();

  await page.reload();
  await expect(kg1).toHaveValue("100");
  await expect(reps1).toHaveValue("5");
  await expect(kg2).toHaveValue("102.5");
  await expect(reps2).toHaveValue("3");
  await expect(
    page.getByRole("button", { name: "Satz 1 wieder öffnen" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Satz 2 abhaken" }).click();
  await expect(page.locator(".finish-bar")).toContainText("807.5 kg");
  await page.getByRole("button", { name: /Einheit abschliessen/ }).click();
  await expect(
    sheet(page).getByRole("heading", { name: "Stark gemacht." }),
  ).toBeVisible();
  await sheet(page).getByRole("button", { name: "Training speichern" }).click();
  await page.waitForURL(/#\/history\//);
  await expect(page.getByText("100 kg × 5 Wdh")).toBeVisible();
  await expect(page.getByText("102.5 kg × 3 Wdh")).toBeVisible();
  expect(errors).toEqual([]);
});

test("an exercise can be swapped during a session", async ({ page }) => {
  const errors = watchErrors(page);
  await startFreeSessionWith(page, "Kniebeuge");
  await page.getByRole("button", { name: "Tauschen" }).click();
  await sheet(page).getByLabel("Übungen suchen").fill("Rumänisches");
  await sheet(page)
    .getByRole("button", { name: /^Rumänisches Kreuzheben/ })
    .click();
  await expect(
    page.getByLabel("Rumänisches Kreuzheben Satz 1 kg"),
  ).toBeVisible();
  await expect(page.getByLabel("Kniebeuge Satz 1 kg")).toHaveCount(0);
  await expect(page.locator(".toast")).toHaveCount(0);
  const d = await dump(page);
  expect(d.sessionExercises).toHaveLength(1);
  expect(d.sessionExercises[0]).toMatchObject({ status: "substituted" });
  expect(errors).toEqual([]);
});

test("a planned session starts from the active cycle", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/cycles");
  await page.getByRole("button", { name: "Ersten Zyklus erstellen" }).click();
  await sheet(page).getByLabel("Name").fill("Testblock E2E");
  await sheet(page).getByLabel("Wochen").fill("4");
  await sheet(page).getByRole("button", { name: "Zyklus anlegen" }).click();
  await page.waitForURL(/#\/cycles\/.+/);
  const cycleUrl = page.url();
  await page
    .getByRole("button", { name: "Trainingstag hinzufügen" })
    .first()
    .click();
  await sheet(page).getByRole("button", { name: "Speichern" }).click();
  await expect(sheet(page)).toHaveCount(0);
  await addExercise(page, "Kniebeuge");
  await page
    .getByRole("button", { name: "Kniebeuge Woche 1 bearbeiten" })
    .click();
  await sheet(page).getByLabel("Gewicht (kg)").fill("80");
  const cells = async () =>
    ((await dump(page)).cells as { week: number; kg?: number }[])
      .sort((a, b) => a.week - b.week)
      .map((c) => c.kg);
  const deloadKg = (await cells())[3];
  expect(deloadKg).not.toBe(85);
  await sheet(page)
    .getByLabel("Auf folgende Wochen übertragen (ohne Deload-Wochen)")
    .check();
  await sheet(page).getByLabel("Steigerung pro weiterer Woche (%)").fill("2.5");
  await sheet(page).getByRole("button", { name: "Speichern" }).click();
  await expect(sheet(page)).toHaveCount(0);
  // Week 4 is the deload week and keeps its lighter load.
  expect(await cells()).toEqual([80, 82.5, 85, deloadKg]);

  await page.getByRole("button", { name: "Als aktiven Zyklus setzen" }).click();
  await expect(
    page.getByRole("button", { name: "Zyklus abschliessen" }),
  ).toBeVisible();
  await open(page, "/");
  await page.getByRole("button", { name: "Training starten" }).click();
  await page.waitForURL(/#\/session\//);
  await expect(page.getByLabel("Kniebeuge Satz 1 kg")).toHaveValue("80");
  await expect(page.getByLabel("Kniebeuge Satz 1 Wiederholungen")).toHaveValue(
    "5",
  );
  const running = page.url();

  // Starting the day again while a session runs asks first.
  await page.goto(cycleUrl);
  await page.getByRole("button", { name: /trainieren$/ }).click();
  await expect(sheet(page)).toContainText("ist noch nicht abgeschlossen");
  await sheet(page).getByRole("button", { name: "Weiterführen" }).click();
  await expect(page).toHaveURL(running);
  await page.getByLabel("Kniebeuge Satz 1 kg").fill("90");
  await page.goto(cycleUrl);
  await page.getByRole("button", { name: /trainieren$/ }).click();
  await sheet(page)
    .getByRole("button", { name: /^Verwerfen und .+ starten$/ })
    .click();
  await page.waitForURL(/#\/session\//);
  expect(page.url()).not.toBe(running);
  await expect(page.getByLabel("Kniebeuge Satz 1 kg")).toHaveValue("80");
  expect((await dump(page)).sessions).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("a finished session can be deleted from its detail view", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await startFreeSessionWith(page, "Kniebeuge");
  await page.getByLabel("Kniebeuge Satz 1 kg").fill("100");
  await page.getByRole("button", { name: "Satz 1 abhaken" }).click();
  await page.getByRole("button", { name: /Einheit abschliessen/ }).click();
  await sheet(page).getByRole("button", { name: "Training speichern" }).click();
  await page.waitForURL(/#\/history\//);
  await page.getByRole("button", { name: "Training löschen" }).click();
  await expect(sheet(page)).toContainText("mit 3 Sätzen wird gelöscht");
  await sheet(page).getByRole("button", { name: "Training löschen" }).click();
  await page.waitForURL(/#\/training$/);
  await expect(page.getByText("0 abgeschlossen")).toBeVisible();
  const d = await dump(page);
  expect(d.sessions).toHaveLength(0);
  expect(d.sessionExercises).toHaveLength(0);
  expect(d.sets).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("a running session can be discarded and the back button leads to the list", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await startFreeSessionWith(page, "Kniebeuge");
  await page
    .getByRole("link", { name: "Zurück zur Trainingsübersicht" })
    .click();
  await page.waitForURL(/#\/training$/);
  await page.getByRole("button", { name: "Training fortsetzen" }).click();
  await page.waitForURL(/#\/session\//);
  await page.getByRole("button", { name: "Training verwerfen" }).click();
  await sheet(page).getByRole("button", { name: "Abbrechen" }).click();
  expect((await dump(page)).sessions).toHaveLength(1);
  await page.getByRole("button", { name: "Training verwerfen" }).click();
  await sheet(page).getByRole("button", { name: "Training löschen" }).click();
  await page.waitForURL(/#\/training$/);
  await expect(
    page.getByRole("button", { name: "Freies Training starten" }),
  ).toBeVisible();
  expect((await dump(page)).sessions).toHaveLength(0);
  expect(errors).toEqual([]);
});
