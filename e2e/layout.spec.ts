import { test, expect, type Page } from "@playwright/test";
import {
  addExercise,
  dump,
  importLegacyFixture,
  open,
  startFreeSessionWith,
  watchErrors,
} from "./helpers";

const routes = [
  "/",
  "/training",
  "/cycles",
  "/progress",
  "/skills",
  "/exercises",
  "/exercises/new",
  "/settings",
  "/ai",
  "/does-not-exist",
];

// Visible interactive elements smaller than 44 x 44 CSS px (CLAUDE.md rule).
// Checkboxes and radios are measured through their wrapping label.
function smallTargets() {
  const selector = [
    "button",
    "a[href]",
    "select",
    "textarea",
    "input:not([type=checkbox]):not([type=radio]):not([type=file])",
    "label:has(> input[type=checkbox])",
    "label:has(> input[type=radio])",
  ].join(",");
  const out: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect(),
      style = getComputedStyle(el);
    if (!r.width || !r.height || style.visibility === "hidden") continue;
    if (el.closest("dialog:not([open])")) continue;
    if (r.width < 44 || r.height < 44)
      out.push(
        `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
      );
  }
  return out;
}

for (const width of [360, 390, 430]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });
    test("every route renders without errors, overflow or small targets", async ({
      page,
    }) => {
      const errors = watchErrors(page);
      await importLegacyFixture(page);
      for (const route of routes) {
        await open(page, route);
        await expect(page.locator("h1").first()).toBeVisible();
        const overflow = await page.evaluate(
          () => document.scrollingElement!.scrollWidth - window.innerWidth,
        );
        expect(overflow, `horizontal scroll on ${route}`).toBeLessThanOrEqual(
          0,
        );
        expect(
          await page.evaluate(smallTargets),
          `targets on ${route}`,
        ).toEqual([]);
        await expect(
          page.getByText("Ansicht konnte nicht geladen"),
        ).toHaveCount(0);
      }
      // Dynamic pages: an imported session and a live session with weight,
      // hold and bodyweight-plus-load exercises (widest set-row grids).
      const sessionId = (await dump(page)).sessions[0] as { id: string };
      const dynamic = ["/history/" + sessionId.id];
      for (const route of dynamic) await expectClean(page, route);
      await startFreeSessionWith(page, "Kniebeuge");
      await addExercise(page, "L-Sit");
      await addExercise(page, "Klimmzug mit Zusatzgewicht");
      await expectClean(page, null);
      expect(errors).toEqual([]);
    });
  });
}

async function expectClean(page: Page, route: string | null) {
  if (route) await open(page, route);
  const where = route ?? page.url();
  const overflow = await page.evaluate(
    () => document.scrollingElement!.scrollWidth - window.innerWidth,
  );
  expect(overflow, `horizontal scroll on ${where}`).toBeLessThanOrEqual(0);
  expect(await page.evaluate(smallTargets), `targets on ${where}`).toEqual([]);
}

test("the offline-ready banner does not keep covering the header", async ({
  page,
}) => {
  await open(page, "/");
  const banner = page.getByText("Bereit für dein Training, auch offline.");
  await expect(banner).toBeVisible({ timeout: 15000 });
  await expect(banner).toBeHidden({ timeout: 10000 });
  await page.getByRole("link", { name: "Einstellungen", exact: true }).click();
  await expect(page).toHaveURL(/#\/settings/);
});

test("rendered text follows Swiss conventions", async ({ page }) => {
  await importLegacyFixture(page);
  for (const route of ["/", "/training", "/progress", "/cycles"]) {
    await open(page, route);
    const text = await page.locator("body").innerText();
    expect(text, route).not.toMatch(/ß/);
    expect(text, route).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
    expect(text, route).not.toMatch(/\b\d+,\d+\s?(kg|%|s)\b/);
  }
});
