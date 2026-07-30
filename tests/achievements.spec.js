import { test, expect } from "@playwright/test";
import { clearAndReload, createProgram, startFromHome } from "./helpers";

test.describe("Achievements", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
  });

  test("displays achievements section in statistics", async ({ page }) => {
    await createProgram(page, {
      programName: "Test Program",
      rest: 15,
      exercises: [{ name: "Squats", type: "timer", sets: 3, duration: 30 }],
    });

    await page.click("#statistics-btn");

    const achievementsSection = page.locator(".achievements-section");
    await expect(achievementsSection).toBeVisible();

    const achievementsTitle = achievementsSection.locator(".statistics-section-title");
    await expect(achievementsTitle).toHaveText("Badges");

    const achievementsProgress = page.locator(".achievements-progress");
    await expect(achievementsProgress).toBeVisible();
  });

  test("shows all badges initially locked", async ({ page }) => {
    await createProgram(page, {
      programName: "Test",
      rest: 15,
      exercises: [{ name: "Test", type: "timer", sets: 1, duration: 10 }],
    });

    await page.click("#statistics-btn");

    const lockedBadges = page.locator(".achievement-badge.is-locked");
    const unlockedBadges = page.locator(".achievement-badge.is-unlocked");

    await expect(lockedBadges).toHaveCount(10);
    await expect(unlockedBadges).toHaveCount(0);

    const progress = page.locator(".achievements-progress");
    await expect(progress).toContainText("0 van 10");
    await expect(progress).toContainText("0%");
  });

  test("unlocks 'Eerste stap' badge after first workout", async ({ page }) => {
    await createProgram(page, {
      programName: "First Workout",
      rest: 10,
      exercises: [{ name: "Push-ups", type: "reps", sets: 1, reps: 10 }],
    });

    await startFromHome(page, "First Workout");
    await page.click("#skip-btn");
    await page.click("#done-set-btn");
    await expect(page.locator(".timer-phase")).toHaveText("Klaar");

    const toast = page.locator(".achievement-toast");
    await expect(toast).toBeVisible();
    await expect(toast.locator(".achievement-toast-title")).toHaveText("Badge ontgrendeld!");
    await expect(toast.locator(".achievement-toast-subtitle")).toHaveText("Eerste stap");

    await page.click("#stop-btn");
    await page.click("#statistics-btn");

    const unlockedBadges = page.locator(".achievement-badge.is-unlocked");
    await expect(unlockedBadges).toHaveCount(1);

    const firstBadge = page.locator(".achievement-badge.is-unlocked").first();
    await expect(firstBadge.locator(".achievement-title")).toHaveText("Eerste stap");
    await expect(firstBadge.locator(".achievement-description")).toHaveText(
      "Eerste training voltooid"
    );

    const progress = page.locator(".achievements-progress");
    await expect(progress).toContainText("1 van 10");
  });

  test("displays badges in categories", async ({ page }) => {
    await createProgram(page, {
      programName: "Test",
      rest: 15,
      exercises: [{ name: "Test", type: "timer", sets: 1, duration: 10 }],
    });

    await page.click("#statistics-btn");

    const categories = page.locator(".achievements-category");
    await expect(categories).toHaveCount(4);

    const categoryTitles = page.locator(".achievements-category-title");
    await expect(categoryTitles).toHaveCount(4);
    await expect(categoryTitles.nth(0)).toHaveText("Mijlpalen");
    await expect(categoryTitles.nth(1)).toHaveText("Streaks");
    await expect(categoryTitles.nth(2)).toHaveText("Toewijding");
    await expect(categoryTitles.nth(3)).toHaveText("Kampioenen");
  });

  test("unlocks multiple milestone badges progressively", async ({ page }) => {
    await page.evaluate(() => {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      const todayKey = `${y}-${m}-${d}`;

      localStorage.setItem(
        "fitnesshelp-workouts-v1",
        JSON.stringify([
          {
            id: "prog-1",
            name: "Workout",
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
            name: "Test",
            type: "timer",
            sets: 1,
            duration: 10,
          },
        ])
      );

      const programIds = Array(10).fill("prog-1");
      localStorage.setItem(
        "fitnesshelp-history-v1",
        JSON.stringify([{ date: todayKey, programIds }])
      );
    });

    await page.reload();
    await page.click("#statistics-btn");

    const unlockedBadges = page.locator(".achievement-badge.is-unlocked");
    await expect(unlockedBadges).toHaveCount(3);

    const titles = await unlockedBadges.locator(".achievement-title").allTextContents();
    expect(titles).toContain("Eerste stap");
    expect(titles).toContain("Vaste gast");
    expect(titles).toContain("Doorzetter");

    const progress = page.locator(".achievements-progress");
    await expect(progress).toContainText("3 van 10");
  });

  test("unlocks 3-day streak badge", async ({ page }) => {
    await page.evaluate(() => {
      const today = new Date();
      const history = [];
      for (let i = 0; i < 3; i += 1) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        const dateKey = `${y}-${m}-${d}`;
        history.push({ date: dateKey, programIds: ["prog-1"] });
      }

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

      localStorage.setItem("fitnesshelp-history-v1", JSON.stringify(history));
    });

    await page.reload();
    await page.click("#statistics-btn");

    const streakBadge = page.locator(".achievement-badge.is-unlocked").filter({
      hasText: "Op dreef",
    });
    await expect(streakBadge).toBeVisible();
    await expect(streakBadge.locator(".achievement-description")).toHaveText(
      "3 dagen achter elkaar getraind"
    );
  });

  test("achievement notification disappears after timeout", async ({ page }) => {
    await createProgram(page, {
      programName: "Quick",
      rest: 10,
      exercises: [{ name: "Test", type: "reps", sets: 1, reps: 5 }],
    });

    await startFromHome(page, "Quick");
    await page.click("#skip-btn");
    await page.click("#done-set-btn");
    await expect(page.locator(".timer-phase")).toHaveText("Klaar");

    const toast = page.locator(".achievement-toast");
    await expect(toast).toBeVisible();

    await page.waitForTimeout(5000);
    await expect(toast).toBeHidden();
  });

  test("locked badges have visual indicators", async ({ page }) => {
    await createProgram(page, {
      programName: "Test",
      rest: 15,
      exercises: [{ name: "Test", type: "timer", sets: 1, duration: 10 }],
    });

    await page.click("#statistics-btn");

    const lockedBadge = page.locator(".achievement-badge.is-locked").first();
    await expect(lockedBadge).toHaveCSS("opacity", "0.45");

    const icon = lockedBadge.locator(".achievement-icon");
    await expect(icon).toBeVisible();
  });

  test("unlocked badges have highlighting", async ({ page }) => {
    await page.evaluate(() => {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      const todayKey = `${y}-${m}-${d}`;

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
        JSON.stringify([{ date: todayKey, programIds: ["prog-1"] }])
      );
    });

    await page.reload();
    await page.click("#statistics-btn");

    const unlockedBadge = page.locator(".achievement-badge.is-unlocked").first();
    await expect(unlockedBadge).toBeVisible();

    const borderColor = await unlockedBadge.evaluate((el) => {
      return window.getComputedStyle(el).borderColor;
    });
    expect(borderColor).not.toBe("rgba(0, 0, 0, 0)");
  });
});
