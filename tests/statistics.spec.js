import { test, expect } from "@playwright/test";

test.describe("Statistics", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:8080");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("statistics button appears on home screen", async ({ page }) => {
    const statisticsBtn = page.locator("#statistics-btn");
    await expect(statisticsBtn).toBeVisible();
    await expect(statisticsBtn).toHaveText("Statistieken");
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
    // Create a program
    await page.click("#manage-btn");
    await page.click("#add-program-btn");
    await page.fill("#program-name", "Test Workout");
    await page.fill("#program-rest", "10");
    await page.fill("#program-switch", "10");
    
    // Add an exercise via picker
    await page.click("#add-segment-btn");
    await page.click(".exercise-picker-add");
    await page.fill(".modal input[placeholder*=\"Squats\"]", "Push-ups");
    await page.click(".modal .segment-type");
    await page.selectOption(".modal .segment-type", "reps");
    await page.fill(".modal input[inputmode=\"numeric\"]", "3");
    const repsInput = page.locator(".modal .segment-reps");
    await repsInput.fill("10");
    await page.click(".modal .btn-primary");
    
    // Save program
    await page.click("#save-btn");
    await page.click("#manage-done-btn");
    
    // Start and complete workout
    const startBtn = page.locator(".day-start").first();
    await startBtn.click();
    
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
    
    // Click on program
    await page.click(".statistics-program-link");
    
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
    await page.click(".statistics-program-link");
    
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
    await page.click(".statistics-program-link");
    
    const activityDays = page.locator(".statistics-activity-day");
    await expect(activityDays).toHaveCount(30);
    
    const activeDays = page.locator(".statistics-activity-day.is-active");
    await expect(activeDays).toHaveCount(3);
  });
});
