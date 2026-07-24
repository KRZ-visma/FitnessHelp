const { test, expect } = require("@playwright/test");
const { clearAndReload, createProgram, startFromHome } = require("./helpers");

test.describe("Audio", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
  });

  test("speelt start- en stopgeluid bij onderdelen", async ({ page }) => {
    await createProgram(page, {
      programName: "Geluid",
      rest: 0,
      switchSec: 0,
      exercises: [
        { name: "Plank", sets: 1, duration: 5 },
        { name: "Squats", type: "reps", sets: 1, reps: 5 },
      ],
    });
    await startFromHome(page);
    await page.evaluate(() => {
      window.__fitnessHelpBeeps.length = 0;
    });
    await page.click("#skip-btn");

    await expect.poll(() => page.evaluate(() => window.__fitnessHelpBeeps)).toEqual(["start"]);
    await expect(page.locator("#timer-name")).toHaveText("Plank");

    await page.click("#skip-btn");
    await expect.poll(() => page.evaluate(() => window.__fitnessHelpBeeps)).toEqual([
      "start",
      "stop",
    ]);
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "prep");
    await expect(page.locator("#timer-name")).toHaveText("Squats");

    await page.click("#skip-btn");
    await expect.poll(() => page.evaluate(() => window.__fitnessHelpBeeps)).toEqual([
      "start",
      "stop",
      "start",
    ]);

    await page.click("#stop-btn");
    await expect.poll(() => page.evaluate(() => window.__fitnessHelpBeeps)).toEqual([
      "start",
      "stop",
      "start",
      "stop",
    ]);
  });

  test("zet iOS audiosessie op playback bij start (stil-schakelaar)", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "audioSession", {
        configurable: true,
        value: { type: "auto" },
      });
    });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await createProgram(page, {
      programName: "Stil",
      rest: 0,
      exercises: [{ name: "Plank", sets: 1, duration: 5 }],
    });
    await startFromHome(page);

    await expect
      .poll(() => page.evaluate(() => window.__fitnessHelpAudioSessionType))
      .toBe("playback");

    await page.click("#skip-btn");
    await expect
      .poll(() => page.evaluate(() => window.__fitnessHelpAudioSessionType))
      .toBe("playback");
  });
});
