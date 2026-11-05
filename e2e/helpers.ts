import { expect, type Page } from "@playwright/test";
import path from "node:path";

export const fixture = path.join(
  import.meta.dirname,
  "../docs/legacy/sample-export.json",
);

// Fails the test on any console error, page error or failed request.
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) =>
    errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`),
  );
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`);
  });
  return errors;
}

export async function open(page: Page, route: string) {
  await page.goto("#" + route);
  await expect(page.getByText("Daten werden geladen")).toHaveCount(0);
  await expect(page.locator(".shell")).toBeVisible();
}

export const sheet = (page: Page) => page.locator("dialog.sheet[open]");

export async function importLegacyFixture(page: Page) {
  await open(page, "/settings");
  await page.setInputFiles('input[type="file"]', fixture);
  await sheet(page)
    .getByRole("button", { name: "Geprüfte Daten importieren" })
    .click();
  await expect(page.locator(".toast")).toContainText(
    "Importiert: 3 Einheiten und 25 Sätze",
  );
}

export async function startFreeSessionWith(page: Page, exercise: string) {
  await open(page, "/training");
  await page.getByRole("button", { name: "Freies Training starten" }).click();
  await page.waitForURL(/#\/session\//);
  await addExercise(page, exercise);
}

export async function addExercise(page: Page, exercise: string) {
  await page.getByRole("button", { name: "Übung hinzufügen" }).click();
  await sheet(page).getByLabel("Übungen suchen").fill(exercise);
  await sheet(page)
    .getByRole("button", { name: new RegExp("^" + exercise) })
    .click();
  await expect(sheet(page)).toHaveCount(0);
}

// Reads all object stores of the app database (evidence only).
export function dump(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown[]>>((resolve, reject) => {
        const req = indexedDB.open("TrainingsplanV2");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const idb = req.result,
            names = [...idb.objectStoreNames],
            out: Record<string, unknown[]> = {};
          const tx = idb.transaction(names, "readonly");
          let left = names.length;
          for (const n of names) {
            const r = tx.objectStore(n).getAll();
            r.onsuccess = () => {
              out[n] = r.result;
              if (--left === 0) {
                idb.close();
                resolve(out);
              }
            };
          }
        };
      }),
  );
}
