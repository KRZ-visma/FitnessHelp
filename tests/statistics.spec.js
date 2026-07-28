import { test, expect } from "@playwright/test";
import { clearAndReload, createProgram, startFromHome } from "./helpers";

test.describe("Statistics", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
    // Ensure home is visible by creating a program first
    await createProgram(page, {
      programName: "Test Program",
      rest: 15,
      exercises: [{ name: "Squats", type: "timer", sets: 3, duration: 30 }],
    });
  });

  test("statistics button appears on home screen", async ({ page }) => {
    await expect(page.locator("#home")).toBeVisible();
    const statisticsBtn = page.locator("#statistics-btn");
    await expect(statisticsBtn).toBeVisible();
    await expect(statisticsBtn).toHaveText(/Statistieken/);
  });

  test("opens statistics view when button clicked", async ({ page }) => {
    await page.click("#statistics-btn");
    
    const statisticsSection = page.locator("#statistics");
    await expect(statisticsSection).toBeVisible();
    
    const title = page.locator(".statistics-title");
    await expect(title).toHaveText("Statistieken");
  });

  test("shows 0 workouts when no history", async ({ page }) => {
    await page.click("#statistics-btn");
    
    const bigNumber = page.locator(".statistics-big-number");
    await expect(bigNumber).toContainText("0");
    await expect(bigNumber).toContainText("trainingen");
  });

  test("closes statistics and returns to home", async ({ page }) => {
    await page.click("#statistics-btn");
    await expect(page.locator("#statistics")).toBeVisible();
    
    await page.click("#statistics-close-btn");
    
    await expect(page.locator("#statistics")).toBeHidden();
    await expect(page.locator("#home")).toBeVisible();
  });

  test("displays week activity grid", async ({ page }) => {
    await page.click("#statistics-btn");
    
    const weekGrid = page.locator(".statistics-week-grid");
    await expect(weekGrid).toBeVisible();
    
    const dayElements = weekGrid.locator(".statistics-week-day");
    await expect(dayElements).toHaveCount(7);
  });

  test("shows completed program in statistics after workout", async ({ page }) => {
    // Create a program with exercises
    await createProgram(page, {
      programName: "Test Workout",
      rest: 10,
      switchSec: 10,
      exercises: [
        { name: "Push-ups", type: "reps", sets: 3, reps: 10 },
      ],
    });
    
    // Start and complete workout
    await startFromHome(page, "Test Workout");
    
    // Skip prep
    await page.click("#skip-btn");
    
    // Complete the reps set
    await page.click("#done-set-btn");
    await page.click("#done-set-btn");
    await page.click("#done-set-btn");
    
    // Wait for completion
    await expect(page.locator(".timer-phase")).toHaveText("Klaar");
    
    // Stop and go to statistics
    await page.click("#stop-btn");
    await page.click("#statistics-btn");
    
    // Check statistics shows 1 workout
    const bigNumber = page.locator(".statistics-big-number");
    await expect(bigNumber).toContainText("1");
    
    // Check program appears in list
    const programName = page.locator(".statistics-program-name");
    await expect(programName).toHaveText("Test Workout");
    
    const programCount = page.locator(".statistics-program-count");
    await expect(programCount).toHaveText("1×");
  });

  test("opens program detail view when clicking program", async ({ page }) => {
    // Setup: create program with history
    await page.evaluate(() => {
      localStorage.setItem(
        "fitnesshelp-workouts-v1",
        JSON.stringify([
          {
            id: "prog-1",
            name: "Morning Routine",
            rest: 15,
            switch: 10,
            times: 1,
            setOrder: "consecutive",
            items: [{ exerciseId: "ex-1" }],
          },
        ])
      );
      localStorage.setItem(
        "fitnesshelp-exercises-v1",
        JSON.stringify([
          {
            id: "ex-1",
            name: "Jumping Jacks",
            type: "timer",
            sets: 3,
            duration: 30,
          },
        ])
      );
      localStorage.setItem(
        "fitnesshelp-history-v1",
        JSON.stringify([
          {
            date: "2026-07-25",
            programIds: ["prog-1"],
          },
        ])
      );
    });
    
    await page.reload();
    await page.click("#statistics-btn");
    
    // Wait for statistics to render and click on program
    const programLink = page.locator(".statistics-program-link");
    await expect(programLink).toBeVisible();
    await programLink.click();
    
    // Check detail view
    const programTitle = page.locator(".statistics-program-title");
    await expect(programTitle).toHaveText("Morning Routine");
    
    const statsItems = page.locator(".statistics-stats-item");
    await expect(statsItems).toHaveCount(3);
    
    // Check activity grid exists
    const activityGrid = page.locator(".statistics-activity-grid");
    await expect(activityGrid).toBeVisible();
    
    // Check exercises list
    const exerciseName = page.locator(".statistics-exercise-name");
    await expect(exerciseName).toHaveText("Jumping Jacks");
    
    const exerciseDetail = page.locator(".statistics-exercise-detail");
    await expect(exerciseDetail).toContainText("3 sets");
    await expect(exerciseDetail).toContainText("30s");
  });

  test("navigates back from program detail to overview", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        "fitnesshelp-workouts-v1",
        JSON.stringify([
          {
            id: "prog-1",
            name: "Test",
            rest: 15,
            switch: 10,
            times: 1,
            setOrder: "consecutive",
            items: [],
          },
        ])
      );
      localStorage.setItem(
        "fitnesshelp-history-v1",
        JSON.stringify([{ date: "2026-07-25", programIds: ["prog-1"] }])
      );
    });
    
    await page.reload();
    await page.click("#statistics-btn");
    
    // Wait for program link and click
    const programLink = page.locator(".statistics-program-link");
    await expect(programLink).toBeVisible();
    await programLink.click();
    
    // Should be in detail view
    await expect(page.locator(".statistics-program-title")).toBeVisible();
    
    // Click back
    await page.click("#statistics-back-btn");
    
    // Should be back in overview
    await expect(page.locator(".statistics-title")).toBeVisible();
    await expect(page.locator(".statistics-section-title").first()).toBeVisible();
  });

  test("displays correct activity pattern in 30-day grid", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        "fitnesshelp-workouts-v1",
        JSON.stringify([
          {
            id: "prog-1",
            name: "Daily",
            rest: 15,
            switch: 10,
            times: 1,
            setOrder: "consecutive",
            items: [],
          },
        ])
      );
      localStorage.setItem(
        "fitnesshelp-history-v1",
        JSON.stringify([
          { date: "2026-07-25", programIds: ["prog-1"] },
          { date: "2026-07-24", programIds: ["prog-1"] },
          { date: "2026-07-22", programIds: ["prog-1"] },
        ])
      );
    });
    
    await page.reload();
    await page.click("#statistics-btn");
    
    // Wait for program link and click
    const programLink = page.locator(".statistics-program-link");
    await expect(programLink).toBeVisible();
    await programLink.click();
    
    const activityDays = page.locator(".statistics-activity-day");
    await expect(activityDays).toHaveCount(30);
    
    const activeDays = page.locator(".statistics-activity-day.is-active");
    await expect(activeDays).toHaveCount(3);
  });

  test("counts multiple same-day completions separately", async ({ page }) => {
    await page.evaluate(() => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const y = yesterday.getFullYear();
      const m = String(yesterday.getMonth() + 1).padStart(2, "0");
      const d = String(yesterday.getDate()).padStart(2, "0");
      const yesterdayKey = `${y}-${m}-${d}`;

      localStorage.setItem(
        "fitnesshelp-workouts-v1",
        JSON.stringify([
          {
            id: "prog-1",
            name: "Triple Set",
            rest: 15,
            switch: 10,
            times: 3,
            setOrder: "consecutive",
            items: [{ exerciseId: "ex-1" }],
          },
        ])
      );
      localStorage.setItem(
        "fitnesshelp-exercises-v1",
        JSON.stringify([
          {
            id: "ex-1",
            name: "Lunges",
            type: "reps",
            sets: 2,
            reps: 10,
          },
        ])
      );
      // 2 afrondingen op dezelfde dag (van de 3 geplande keren)
      localStorage.setItem(
        "fitnesshelp-history-v1",
        JSON.stringify([
          { date: yesterdayKey, programIds: ["prog-1", "prog-1"] },
        ])
      );
    });

    await page.reload();
    await page.click("#statistics-btn");

    const bigNumber = page.locator(".statistics-big-number");
    await expect(bigNumber).toContainText("2");

    const programCount = page.locator(".statistics-program-count");
    await expect(programCount).toHaveText("2×");

    await page.locator(".statistics-program-link").click();
    const completedStat = page.locator(".statistics-stats-item").filter({
      hasText: "keer",
    });
    await expect(completedStat.locator("dd")).toHaveText("2 keer");

    // Activiteitsgrid: één actieve dag (niet twee)
    const activeDays = page.locator(".statistics-activity-day.is-active");
    await expect(activeDays).toHaveCount(1);
  });

  test("records each completion when finishing the same program twice", async ({
    page,
  }) => {
    await createProgram(page, {
      programName: "Dubbel",
      rest: 10,
      switchSec: 10,
      times: 2,
      exercises: [{ name: "Burpees", type: "reps", sets: 1, reps: 5 }],
    });

    for (let i = 0; i < 2; i += 1) {
      await startFromHome(page, "Dubbel");
      await page.click("#skip-btn");
      await page.click("#done-set-btn");
      await expect(page.locator(".timer-phase")).toHaveText("Klaar");
      await page.click("#stop-btn");
      await expect(page.locator("#home")).toBeVisible();
    }

    await page.click("#statistics-btn");
    await expect(page.locator(".statistics-big-number")).toContainText("2");
    await expect(page.locator(".statistics-program-count")).toHaveText("2×");
  });
});
