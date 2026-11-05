import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dump, importLegacyFixture, open, sheet, watchErrors } from "./helpers";

test("legacy import shows the old sessions and refuses a second import", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await importLegacyFixture(page);
  const d = await dump(page);
  expect(d.sessions).toHaveLength(3);
  expect(d.sets).toHaveLength(25);
  await open(page, "/training");
  await expect(page.getByText("3 abgeschlossen")).toBeVisible();

  await open(page, "/settings");
  await page.setInputFiles(
    'input[type="file"]',
    "docs/legacy/sample-export.json",
  );
  await sheet(page)
    .getByRole("button", { name: "Geprüfte Daten importieren" })
    .click();
  await expect(page.locator(".toast")).toContainText("bereits importiert");
  expect((await dump(page)).sets).toHaveLength(25);
  expect(errors).toEqual([]);
});

test("backup export omits the key and restores into a fresh install", async ({
  page,
  browser,
}) => {
  await importLegacyFixture(page);
  await open(page, "/settings");
  const key = "e2e-synthetic-key";
  await page.getByLabel("Oder API-Schlüssel auf diesem Gerät").fill(key);
  await page.getByRole("button", { name: "Einstellungen speichern" }).click();
  await expect(page.locator(".toast")).toContainText("gespeichert");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Backup exportieren" }).click(),
  ]);
  const file = await download.path();
  const text = await readFile(file, "utf8");
  expect(text).not.toContain(key);
  const backup = JSON.parse(text);
  expect(backup.format).toBe("trainingsplan-backup");
  const before = await dump(page);
  for (const table of Object.keys(backup.data))
    expect(backup.data[table], table).toHaveLength(before[table].length);
  await expect(page.locator(".toast")).toContainText("Backup bereit");

  // A fresh install on another device: merge must not duplicate exercises.
  const other = await browser.newPage();
  await open(other, "/settings");
  await other.setInputFiles('input[type="file"]', file);
  await sheet(other)
    .getByRole("button", { name: "Daten zusammenführen" })
    .click();
  await expect(other.locator(".toast")).toBeVisible();
  const merged = await dump(other);
  const names = (merged.exercises as { name: string; type: string }[]).map(
    (e) => e.name + "|" + e.type,
  );
  expect(new Set(names).size).toBe(names.length);
  expect(merged.sessions).toHaveLength(before.sessions.length);
  expect(merged.sets).toHaveLength(before.sets.length);
  expect(JSON.stringify(merged.settings)).not.toContain(key);
  await other.close();
});

test("a stored AI result that no longer validates does not crash the app", async ({
  page,
}) => {
  const errors = watchErrors(page);
  // Results are only shown with AI enabled; no request is sent here.
  await open(page, "/settings");
  await page
    .getByLabel("Oder API-Schlüssel auf diesem Gerät")
    .fill("e2e-synthetic-key");
  await page.getByLabel("Modell-ID").fill("e2e/synthetic-model");
  await page.getByLabel("KI-Funktionen aktivieren").check();
  await page.getByRole("button", { name: "Einstellungen speichern" }).click();
  await expect(page.locator(".toast")).toContainText("gespeichert");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("TrainingsplanV2");
        req.onsuccess = () => {
          const tx = req.result.transaction("aiRuns", "readwrite");
          tx.objectStore("aiRuns").put({
            id: "broken-run",
            kind: "weekly_checkin",
            createdAt: new Date().toISOString(),
            model: "test",
            inputSummary: "{}",
            output: { unexpected: true },
          });
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  // Raw IndexedDB writes bypass Dexie's live queries: reload to read them.
  await open(page, "/ai");
  await page.reload();
  await expect(page.getByText("KI-Ergebnis nicht lesbar")).toBeVisible();
  await expect(page.getByText("Ansicht konnte nicht geladen")).toHaveCount(0);
  expect(errors).toEqual([]);
});
