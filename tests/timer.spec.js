const { test, expect } = require("@playwright/test");
const { clearAndReload, openManage } = require("./helpers");

test.describe("Timer", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
  });

  test("start met 5 seconden klaarmaken vóór de set", async ({ page }) => {
    await page.fill("#program-name", "Been dag");
    await page.fill(".segment-name", "Squats");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "5");
    await page.fill(".segment-rest", "2");
    await page.click("#start-btn");

    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "prep");
    await expect(page.locator("#timer-phase")).toHaveText("Klaar maken");
    await expect(page.locator("#timer-name")).toHaveText("Squats");
    await expect(page.locator("#timer-clock")).toHaveText("0:05");
    await expect(page.locator("body")).toHaveClass(/is-running/);

    await page.click("#skip-btn");
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "work");
    await expect(page.locator("#timer-phase")).toContainText("Set 1");
  });

  test("start de timer met sets en duur", async ({ page }) => {
    await page.fill("#program-name", "Been dag");
    await page.fill(".segment-name", "Squats");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "5");
    await page.fill(".segment-rest", "2");
    await page.click("#start-btn");
    await page.click("#skip-btn");

    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer-name")).toHaveText("Squats");
    await expect(page.locator("#timer-phase")).toContainText("Set 1");
    await expect(page.locator("body")).toHaveClass(/is-running/);
  });

  test("toont sets & keer zonder aftellen", async ({ page }) => {
    await page.fill("#program-name", "Kracht");
    await page.locator(".segment-type").selectOption("reps");
    await page.fill(".segment-name", "Deadlift");
    await page.fill(".segment-sets", "3");
    await page.fill(".segment-reps", "8");
    await page.click("#start-btn");

    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "prep");
    await page.click("#skip-btn");

    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer")).toHaveAttribute("data-mode", "reps");
    await expect(page.locator("#timer-name")).toHaveText("Deadlift");
    await expect(page.locator("#timer-clock")).toHaveText("8×");
    await expect(page.locator("#timer-phase")).toContainText("Set 1 van 3");
    await expect(page.locator("#done-set-btn")).toBeVisible();
    await expect(page.locator("#pause-btn")).toBeHidden();

    await page.click("#done-set-btn");
    await expect(page.locator("#timer-phase")).toContainText("Set 2 van 3");

    await page.click("#done-set-btn");
    await expect(page.locator("#timer-phase")).toContainText("Set 3 van 3");

    await page.click("#done-set-btn");
    await expect(page.locator("#timer-phase")).toHaveText("Klaar");
  });

  test("vraagt screen wake lock tijdens training", async ({ page }) => {
    await page.addInitScript(() => {
      window.__wakeLockRequested = false;
      const sentinel = {
        released: false,
        release: async function release() {
          this.released = true;
          return undefined;
        },
        addEventListener: () => {},
      };
      const fakeWakeLock = {
        request: async () => {
          window.__wakeLockRequested = true;
          return sentinel;
        },
      };
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        enumerable: true,
        get: () => fakeWakeLock,
      });
    });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.fill("#program-name", "HIIT");
    await page.fill(".segment-name", "Burpees");
    await page.fill(".segment-sets", "1");
    await page.fill(".segment-duration", "8");
    await page.fill(".segment-rest", "0");
    await page.click("#start-btn");

    await expect
      .poll(async () => page.evaluate(() => Boolean(window.__wakeLockRequested)))
      .toBe(true);
  });

  test("stopt de training en toont setup weer", async ({ page }) => {
    await page.fill("#program-name", "HIIT");
    await page.fill(".segment-name", "Burpees");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "8");
    await page.fill(".segment-rest", "0");
    await page.click("#start-btn");
    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "prep");

    await page.click("#stop-btn");
    await expect(page.locator("#timer")).toBeHidden();
    await expect(page.locator("#setup")).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/is-running/);
  });

  test("ondersteunt gemengd programma met timer en sets & keer", async ({ page }) => {
    await page.fill("#program-name", "Full body");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "20");
    await page.fill(".segment-rest", "5");

    await page.click("#add-segment-btn");
    await expect(page.locator(".segment")).toHaveCount(2);

    const second = page.locator(".segment").nth(1);
    await second.locator(".segment-type").selectOption("reps");
    await second.locator(".segment-name").fill("Squats");
    await second.locator(".segment-sets").fill("3");
    await second.locator(".segment-reps").fill("12");

    await page.click("#save-btn");

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]")
    );
    expect(stored[0].items).toEqual([
      { type: "timer", name: "Plank", sets: 2, duration: 20, rest: 5 },
      { type: "reps", name: "Squats", sets: 3, reps: 12 },
    ]);

    await openManage(page);
    await page.click("#start-btn");
    await page.click("#skip-btn");
    await expect(page.locator("#timer-name")).toHaveText("Plank");
    await expect(page.locator("#timer")).toHaveAttribute("data-mode", "timer");
    await expect(page.locator("#done-set-btn")).toBeHidden();
    await expect(page.locator("#pause-btn")).toBeVisible();
  });
});
