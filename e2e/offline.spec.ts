import { test, expect } from "@playwright/test";
import { open, startFreeSessionWith } from "./helpers";

test("the installed app opens and saves offline", async ({ page, context }) => {
  await open(page, "/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".bottom-nav a")).toHaveCount(5);
  await startFreeSessionWith(page, "Bankdrücken");
  await page.getByLabel("Bankdrücken Satz 1 kg").fill("60");
  await page.getByLabel("Bankdrücken Satz 1 Wiederholungen").fill("8");
  await page.getByRole("button", { name: "Satz 1 abhaken" }).click();
  await page.reload();
  await expect(page.getByLabel("Bankdrücken Satz 1 kg")).toHaveValue("60");
  await expect(
    page.getByRole("button", { name: "Satz 1 wieder öffnen" }),
  ).toBeVisible();
});
