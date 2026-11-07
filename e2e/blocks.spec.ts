import { test, expect } from "@playwright/test";
import { dump, open, sheet, watchErrors } from "./helpers";

async function startWithBlock(
  page: import("@playwright/test").Page,
  format: "EMOM" | "AMRAP" | "For Time",
) {
  await open(page, "/training");
  await page.getByRole("button", { name: "Freies Training starten" }).click();
  await page.waitForURL(/#\/session\//);
  await page.getByRole("button", { name: /Block hinzufügen/ }).click();
  await sheet(page).getByRole("button", { name: format, exact: true }).click();
  await sheet(page).getByRole("button", { name: "Block anlegen" }).click();
  await sheet(page).getByLabel("Übungen suchen").fill("Kniebeuge");
  await sheet(page)
    .getByRole("button", { name: /^Kniebeuge/ })
    .click();
  await expect(sheet(page)).toHaveCount(0);
}

test("an EMOM is logged with its result and kept out of the records", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await startWithBlock(page, "EMOM");
  await page.getByLabel("Kniebeuge kg pro Runde").fill("80");
  await page.getByLabel("Kniebeuge Wiederholungen pro Runde").fill("3");
  await page.getByRole("button", { name: "Alle geschafft" }).click();
  await expect(page.locator(".finish-bar")).toContainText("2'400 kg");
  await page.reload();
  await expect(page.getByLabel("Geschaffte Intervalle")).toHaveValue("10");
  await page.getByLabel("Geschaffte Intervalle").fill("9");
  await expect(page.locator(".finish-bar")).toContainText("2'160 kg");
  await page.getByRole("button", { name: /Einheit abschliessen/ }).click();
  await expect(sheet(page).getByText("Neue Bestwerte")).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Training speichern" }).click();
  await page.waitForURL(/#\/history\//);
  await expect(page.getByText("9/10 Intervalle")).toBeVisible();
  await expect(page.getByText("3 Wdh × 80 kg")).toBeVisible();
  const d = await dump(page);
  expect(d.blocks).toHaveLength(1);
  expect(
    (d.sets as { done: boolean; blockId?: string }[]).filter(
      (s) => s.done && s.blockId,
    ),
  ).toHaveLength(9);
  expect(errors).toEqual([]);
});

test("the AMRAP timer counts rounds and hands the result to the block", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.clock.install();
  await startWithBlock(page, "AMRAP");
  await page.getByRole("button", { name: "Timer starten" }).click();
  const timer = page.getByRole("dialog", { name: /Timer AMRAP 12'/ });
  await expect(timer.getByText("Los in")).toBeVisible();
  await page.clock.runFor(11_000);
  await expect(timer.getByText("Restzeit")).toBeVisible();
  for (let i = 0; i < 4; i++)
    await timer.getByRole("button", { name: "Runde fertig" }).click();
  await timer.getByRole("button", { name: "Runde abziehen" }).click();
  await page.clock.runFor(12 * 60_000);
  await timer.getByRole("button", { name: "Übernehmen: 3 Runden" }).click();
  await expect(timer).toHaveCount(0);
  await expect(page.getByLabel("Geschaffte Runden")).toHaveValue("3");
  await page.getByLabel("Zusätzliche Wiederholungen").fill("4");
  await expect(page.getByText("3 Runden + 4 Wdh")).toBeVisible();
  expect(errors).toEqual([]);
});
