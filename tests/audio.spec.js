const { test, expect } = require("@playwright/test");
const { clearAndReload } = require("./helpers");

test.describe("Audio", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
  });

  test("speelt start- en stopgeluid bij onderdelen", async ({ page }) => {
    await page.fill("#program-name", "Geluid");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "1");
    await page.fill(".segment-duration", "5");
    await page.fill(".segment-rest", "0");
    await page.click("#add-segment-btn");
    const second = page.locator(".segment").nth(1);
    await second.locator(".segment-type").selectOption("reps");
    await second.locator(".segment-name").fill("Squats");
    await second.locator(".segment-sets").fill("1");
    await second.locator(".segment-reps").fill("5");

    await page.click("#start-btn");
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

    await page.fill("#program-name", "Stil");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "1");
    await page.fill(".segment-duration", "5");
    await page.fill(".segment-rest", "0");
    await page.click("#start-btn");

    await expect
      .poll(() => page.evaluate(() => window.__fitnessHelpAudioSessionType))
      .toBe("playback");

    await page.click("#skip-btn");
    await expect
      .poll(() => page.evaluate(() => window.__fitnessHelpAudioSessionType))
      .toBe("playback");
  });
});
