const { test, expect } = require("@playwright/test");
const {
  addExerciseToProgram,
  clearAndReload,
  createExercise,
  createProgram,
  openManage,
  openProgramForm,
  startFromHome,
} = require("./helpers");

test.describe("Timer", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
  });

  test("start met 5 seconden klaarmaken vóór de set", async ({ page }) => {
    await createProgram(page, {
      programName: "Been dag",
      rest: 2,
      exercises: [{ name: "Squats", sets: 2, duration: 5 }],
    });
    await startFromHome(page);

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
    await createProgram(page, {
      programName: "Been dag",
      rest: 2,
      exercises: [{ name: "Squats", sets: 2, duration: 5 }],
    });
    await startFromHome(page);
    await page.click("#skip-btn");

    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer-name")).toHaveText("Squats");
    await expect(page.locator("#timer-phase")).toContainText("Set 1");
    await expect(page.locator("body")).toHaveClass(/is-running/);
  });

  test("toont sets & keer zonder aftellen", async ({ page }) => {
    await createProgram(page, {
      programName: "Kracht",
      rest: 0,
      exercises: [{ name: "Deadlift", type: "reps", sets: 3, reps: 8 }],
    });
    await startFromHome(page);

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

    await createProgram(page, {
      programName: "HIIT",
      rest: 0,
      exercises: [{ name: "Burpees", sets: 1, duration: 8 }],
    });
    await startFromHome(page);

    await expect
      .poll(async () => page.evaluate(() => Boolean(window.__wakeLockRequested)))
      .toBe(true);
  });

  test("stopt de training en toont home weer", async ({ page }) => {
    await createProgram(page, {
      programName: "HIIT",
      rest: 0,
      exercises: [{ name: "Burpees", sets: 2, duration: 8 }],
    });
    await startFromHome(page);
    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "prep");

    await page.click("#stop-btn");
    await expect(page.locator("#timer")).toBeHidden();
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#manage")).toBeHidden();
    await expect(page.locator("body")).not.toHaveClass(/is-running/);
  });

  test("ondersteunt gemengd programma met timer en sets & keer", async ({ page }) => {
    await createExercise(page, { name: "Plank", sets: 2, duration: 20 });
    await createExercise(page, { name: "Squats", type: "reps", sets: 3, reps: 12 });

    await openProgramForm(page);
    await page.fill("#program-name", "Full body");
    await page.fill("#program-rest", "5");
    await addExerciseToProgram(page, "Plank");
    await addExerciseToProgram(page, "Squats");
    await page.click("#save-btn");

    const stored = await page.evaluate(() => ({
      programs: JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]"),
      exercises: JSON.parse(localStorage.getItem("fitnesshelp-exercises-v1") || "[]"),
    }));
    expect(stored.programs[0]).toMatchObject({ rest: 5, switch: 15 });
    expect(stored.programs[0].items).toHaveLength(2);
    expect(stored.programs[0].items.every((item) => item.exerciseId)).toBe(true);
    const names = stored.programs[0].items.map(
      (item) => stored.exercises.find((ex) => ex.id === item.exerciseId).name
    );
    expect(names).toEqual(["Plank", "Squats"]);

    await page.click("#manage-done-btn");
    await startFromHome(page);
    await page.click("#skip-btn");
    await expect(page.locator("#timer-name")).toHaveText("Plank");
    await expect(page.locator("#timer")).toHaveAttribute("data-mode", "timer");
    await expect(page.locator("#done-set-btn")).toBeHidden();
    await expect(page.locator("#pause-btn")).toBeVisible();
  });

  test("wisselt tussen onderdelen met programma-switch", async ({ page }) => {
    await createProgram(page, {
      programName: "Circuit",
      rest: 0,
      switchSec: 4,
      exercises: [
        { name: "Plank", sets: 1, duration: 20 },
        { name: "Squats", sets: 1, duration: 10 },
      ],
    });
    await startFromHome(page);
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
    await createProgram(page, {
      programName: "Kracht",
      rest: 8,
      switchSec: 0,
      exercises: [{ name: "Deadlift", type: "reps", sets: 2, reps: 5 }],
    });
    await startFromHome(page);
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
    await createProgram(page, {
      programName: "Circuit",
      rest: 0,
      switchSec: 12,
      exercises: [
        { name: "Plank", sets: 1, duration: 5 },
        { name: "Squats", type: "reps", sets: 1, reps: 10 },
      ],
    });
    await startFromHome(page);
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
