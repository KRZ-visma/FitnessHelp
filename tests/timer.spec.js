const { test, expect } = require("@playwright/test");
const { clearAndReload, openManage, saveAndStart } = require("./helpers");

test.describe("Timer", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
  });

  test("start met 5 seconden klaarmaken vóór de set", async ({ page }) => {
    await page.fill("#program-name", "Been dag");
    await page.fill("#program-rest", "2");
    await page.fill(".segment-name", "Squats");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "5");
    await saveAndStart(page);

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
    await page.fill("#program-rest", "2");
    await page.fill(".segment-name", "Squats");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "5");
    await saveAndStart(page);
    await page.click("#skip-btn");

    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer-name")).toHaveText("Squats");
    await expect(page.locator("#timer-phase")).toContainText("Set 1");
    await expect(page.locator("body")).toHaveClass(/is-running/);
  });

  test("toont sets & keer zonder aftellen", async ({ page }) => {
    await page.fill("#program-name", "Kracht");
    await page.fill("#program-rest", "0");
    await page.locator(".segment-type").selectOption("reps");
    await page.fill(".segment-name", "Deadlift");
    await page.fill(".segment-sets", "3");
    await page.fill(".segment-reps", "8");
    await saveAndStart(page);

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
    await page.fill("#program-rest", "0");
    await page.fill(".segment-name", "Burpees");
    await page.fill(".segment-sets", "1");
    await page.fill(".segment-duration", "8");
    await saveAndStart(page);

    await expect
      .poll(async () => page.evaluate(() => Boolean(window.__wakeLockRequested)))
      .toBe(true);
  });

  test("stopt de training en toont home weer", async ({ page }) => {
    await page.fill("#program-name", "HIIT");
    await page.fill("#program-rest", "0");
    await page.fill(".segment-name", "Burpees");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "8");
    await saveAndStart(page);
    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "prep");

    await page.click("#stop-btn");
    await expect(page.locator("#timer")).toBeHidden();
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#manage")).toBeHidden();
    await expect(page.locator("body")).not.toHaveClass(/is-running/);
  });

  test("ondersteunt gemengd programma met timer en sets & keer", async ({ page }) => {
    await page.fill("#program-name", "Full body");
    await page.fill("#program-rest", "5");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "20");

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
    expect(stored[0]).toMatchObject({ rest: 5, switch: 15 });
    expect(stored[0].items).toEqual([
      { type: "timer", name: "Plank", sets: 2, duration: 20, rest: 5 },
      { type: "reps", name: "Squats", sets: 3, reps: 12 },
    ]);

    await openManage(page);
    await saveAndStart(page);
    await page.click("#skip-btn");
    await expect(page.locator("#timer-name")).toHaveText("Plank");
    await expect(page.locator("#timer")).toHaveAttribute("data-mode", "timer");
    await expect(page.locator("#done-set-btn")).toBeHidden();
    await expect(page.locator("#pause-btn")).toBeVisible();
  });

  test("wisselt tussen onderdelen met programma-switch", async ({ page }) => {
    await page.fill("#program-name", "Circuit");
    await page.fill("#program-rest", "0");
    await page.fill("#program-switch", "4");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "1");
    await page.fill(".segment-duration", "20");

    await page.click("#add-segment-btn");
    const second = page.locator(".segment").nth(1);
    await second.locator(".segment-name").fill("Squats");
    await second.locator(".segment-sets").fill("1");
    await second.locator(".segment-duration").fill("10");

    await saveAndStart(page);
    await page.click("#skip-btn");
    await expect(page.locator("#timer-name")).toHaveText("Plank");
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "work");

    await page.click("#skip-btn");
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "switch");
    await expect(page.locator("#timer-phase")).toHaveText("Wisselen");
    await expect(page.locator("#timer-name")).toHaveText("Squats");
    await expect(page.locator("#timer-clock")).toHaveText("0:04");
    await expect(page.locator("#timer-meta")).toHaveText("Volgende oefening · daarna starten");

    await page.click("#skip-btn");
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "work");
    await expect(page.locator("#timer-name")).toHaveText("Squats");
    await expect(page.locator("#timer-phase")).toHaveText("Set 1 van 1");
  });

  test("gebruikt algemene rust tussen sets bij sets & keer", async ({ page }) => {
    await page.fill("#program-name", "Kracht");
    await page.fill("#program-rest", "8");
    await page.fill("#program-switch", "0");
    await page.locator(".segment-type").selectOption("reps");
    await page.fill(".segment-name", "Deadlift");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-reps", "5");
    await saveAndStart(page);
    await page.click("#skip-btn");

    await page.click("#done-set-btn");
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "rest");
    await expect(page.locator("#timer-phase")).toHaveText("Rust · na set 1");
    await expect(page.locator("#timer-clock")).toHaveText("0:08");
    await expect(page.locator("#done-set-btn")).toBeHidden();
    await expect(page.locator("#pause-btn")).toBeVisible();

    await page.click("#skip-btn");
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "work");
    await expect(page.locator("#timer-phase")).toContainText("Set 2 van 2");
    await expect(page.locator("#done-set-btn")).toBeVisible();
  });

  test("toont wisseltijd tussen oefeningen", async ({ page }) => {
    await page.fill("#program-name", "Circuit");
    await page.fill("#program-rest", "0");
    await page.fill("#program-switch", "12");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "1");
    await page.fill(".segment-duration", "5");
    await page.click("#add-segment-btn");
    const second = page.locator(".segment").nth(1);
    await second.locator(".segment-type").selectOption("reps");
    await second.locator(".segment-name").fill("Squats");
    await second.locator(".segment-sets").fill("1");
    await second.locator(".segment-reps").fill("10");

    await saveAndStart(page);
    await page.click("#skip-btn");
    await expect(page.locator("#timer-name")).toHaveText("Plank");

    await page.click("#skip-btn");
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "switch");
    await expect(page.locator("#timer-phase")).toHaveText("Wisselen");
    await expect(page.locator("#timer-name")).toHaveText("Squats");
    await expect(page.locator("#timer-clock")).toHaveText("0:12");

    await page.click("#skip-btn");
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "work");
    await expect(page.locator("#timer-name")).toHaveText("Squats");
    await expect(page.locator("#timer-clock")).toHaveText("10×");
  });
});
