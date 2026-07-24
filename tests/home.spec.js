const { test, expect } = require("@playwright/test");
const {
  addExerciseToProgram,
  clearAndReload,
  createExercise,
  createProgram,
  openManage,
  openProgramsTab,
  startFromHome,
} = require("./helpers");

test.describe("Home & dagprogramma", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
  });

  test("slaat programma op en toont dagprogramma op home", async ({ page }) => {
    await createProgram(page, {
      programName: "Push",
      rest: 20,
      exercises: [{ name: "Push-ups", sets: 4, duration: 40 }],
    });

    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#manage-btn")).toBeVisible();
    await expect(page.locator(".home-toolbar #manage-btn")).toBeVisible();
    await expect(page.locator(".home-label")).toHaveText("Dagprogramma");
    await expect(page.locator("#home-title")).toHaveText("Vandaag");
    await expect(page.locator("#home-meta")).toContainText("1 programma");
    await expect(page.locator("#day-list .day-item")).toHaveCount(1);
    await expect(page.locator("#day-list")).toContainText("Push");
    await expect(page.locator("#day-list .day-exercises li")).toHaveText(["Push-ups"]);
    await expect(page.locator("#home-start-btn")).toHaveCount(0);
    await expect(page.locator("#day-list .day-start")).toHaveText("Start");
    await expect(page.locator("#manage")).toBeHidden();
    await expect(page.locator("#tagline")).toBeHidden();

    const stored = await page.evaluate(() => ({
      programs: JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]"),
      exercises: JSON.parse(localStorage.getItem("fitnesshelp-exercises-v1") || "[]"),
      dayOrder: JSON.parse(localStorage.getItem("fitnesshelp-day-order-v1") || "[]"),
      favorite: localStorage.getItem("fitnesshelp-favorite-v1"),
    }));
    expect(stored.programs).toHaveLength(1);
    expect(stored.programs[0]).toMatchObject({
      name: "Push",
      rest: 20,
      switch: 15,
    });
    expect(stored.programs[0].items).toHaveLength(1);
    expect(stored.programs[0].items[0]).toHaveProperty("exerciseId");
    expect(stored.exercises[0]).toMatchObject({
      name: "Push-ups",
      type: "timer",
      sets: 4,
      duration: 40,
    });
    expect(stored.dayOrder).toEqual([stored.programs[0].id]);
    expect(stored.favorite).toBeNull();

    await openManage(page);
    await expect(page.locator("#saved-list .saved-item")).toHaveCount(1);
    await expect(page.locator("#saved-list")).toContainText("Push");
    await expect(page.locator("#saved-list")).not.toContainText("Favoriet");
    await expect(
      page.locator("#saved-list .saved-item").locator("button", { hasText: "Favoriet" })
    ).toHaveCount(0);
    await expect(page.locator("body")).toHaveClass(/is-managing/);
  });

  test("start programma vanaf home", async ({ page }) => {
    await createProgram(page, {
      programName: "Core",
      rest: 10,
      exercises: [{ name: "Plank", sets: 3, duration: 30 }],
    });

    await startFromHome(page, "Core");
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "prep");
    await page.click("#skip-btn");
    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer-name")).toHaveText("Plank");
  });

  test("toont meerdere programma’s en laat ze afvinken", async ({ page }) => {
    await createExercise(page, { name: "Jumping jacks" });
    await createExercise(page, { name: "Squats" });
    await createExercise(page, { name: "Plank" });

    await openProgramsTab(page);
    await page.fill("#program-name", "Warm-up");
    await addExerciseToProgram(page, "Jumping jacks");
    await page.click("#save-btn");

    await openManage(page);
    await page.fill("#program-name", "Kracht");
    await addExerciseToProgram(page, "Squats");
    await page.click("#save-btn");

    await openManage(page);
    await page.fill("#program-name", "Core");
    await addExerciseToProgram(page, "Plank");
    await page.click("#save-btn");

    await expect(page.locator("#day-list .day-item")).toHaveCount(3);
    await expect(page.locator("#home-meta")).toContainText("3 programma’s");
    await expect(
      page.locator("#day-list .day-item", { hasText: "Warm-up" }).locator(".day-exercises li")
    ).toHaveText(["Jumping jacks"]);
    await expect(
      page.locator("#day-list .day-item", { hasText: "Kracht" }).locator(".day-exercises li")
    ).toHaveText(["Squats"]);
    await expect(
      page.locator("#day-list .day-item", { hasText: "Core" }).locator(".day-exercises li")
    ).toHaveText(["Plank"]);

    const kracht = page.locator("#day-list .day-item", { hasText: "Kracht" });
    await kracht.locator(".day-check").check();
    await expect(kracht).toHaveClass(/is-done/);
    await expect(page.locator("#home-meta")).toContainText("1 van 3 klaar");
    await expect(kracht.locator(".day-start")).toHaveCount(0);
    await expect(page.locator("#day-list .day-start")).toHaveCount(2);

    await kracht.locator(".day-check").uncheck();
    await expect(kracht).not.toHaveClass(/is-done/);
    await expect(page.locator("#home-meta")).toContainText("3 programma’s");
  });

  test("opent opgeslagen programma via klik op de lijst", async ({ page }) => {
    await createProgram(page, {
      programName: "Push",
      rest: 20,
      exercises: [{ name: "Push-ups", sets: 4, duration: 40 }],
    });

    await openManage(page);
    await page.fill("#program-name", "Nieuw");
    await page.locator("#saved-list .saved-open", { hasText: "Push" }).click();
    await expect(page.locator("#program-name")).toHaveValue("Push");
    await expect(page.locator("#program-rest")).toHaveValue("20");
    await expect(page.locator("#program-times")).toHaveValue("1");
    await expect(page.locator(".segment-name")).toHaveText("Push-ups");
  });

  test("houdt acties op één regel met pijlsymbolen", async ({ page }) => {
    await createExercise(page, { name: "Push-ups" });
    await createExercise(page, { name: "Rows" });

    await openProgramsTab(page);
    await page.fill("#program-name", "Push");
    await addExerciseToProgram(page, "Push-ups");
    await page.click("#save-btn");

    await openManage(page);
    await page.fill("#program-name", "Pull");
    await addExerciseToProgram(page, "Rows");
    await page.click("#save-btn");

    await openManage(page);
    const item = page.locator("#saved-list .saved-item").first();
    const actions = item.locator(".saved-actions");
    await expect(actions.locator(".saved-move-up")).toHaveText("↑");
    await expect(actions.locator(".saved-move-down")).toHaveText("↓");
    await expect(actions.locator("button", { hasText: "Laden" })).toHaveCount(0);

    const box = await actions.boundingBox();
    expect(box).toBeTruthy();
    const buttons = actions.locator("button");
    await expect(buttons).toHaveCount(3);
    const first = await buttons.nth(0).boundingBox();
    const last = await buttons.nth(2).boundingBox();
    expect(first && last && box).toBeTruthy();
    // Alle acties op dezelfde horizontale regel
    expect(Math.abs(first.y - last.y)).toBeLessThan(8);
    expect(last.x + last.width).toBeLessThanOrEqual(box.x + box.width + 1);
  });

  test("kan volgorde van programma’s wijzigen", async ({ page }) => {
    await createExercise(page, { name: "Push-ups" });
    await createExercise(page, { name: "Rows" });

    await openProgramsTab(page);
    await page.fill("#program-name", "Push");
    await addExerciseToProgram(page, "Push-ups");
    await page.click("#save-btn");

    await openManage(page);
    await page.fill("#program-name", "Pull");
    await addExerciseToProgram(page, "Rows");
    await page.click("#save-btn");

    await expect(page.locator("#day-list .day-item").first()).toContainText("Push");
    await openManage(page);
    await expect(page.locator("#saved-list .saved-item")).toHaveCount(2);

    await page
      .locator("#saved-list .saved-item", { hasText: "Pull" })
      .locator(".saved-move-up")
      .click();

    await page.click("#manage-done-btn");
    await expect(page.locator("#day-list .day-item").first()).toContainText("Pull");
    await expect(page.locator("#day-list .day-exercises li")).toHaveText(["Rows", "Push-ups"]);
  });

  test("migreert legacy workouts naar programma met bibliotheek-refs", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        "fitnesshelp-workouts-v1",
        JSON.stringify([
          {
            id: "w_legacy_1",
            name: "Burpees",
            sets: 2,
            duration: 15,
            rest: 5,
          },
          {
            id: "w_legacy_2",
            name: "Squats",
            sets: 3,
            duration: 40,
            rest: 20,
          },
        ])
      );
    });
    await page.reload();

    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#home-title")).toHaveText("Vandaag");
    await expect(page.locator("#day-list")).toContainText("Mijn training");
    await expect(page.locator("#day-list .day-exercises li")).toHaveText(["Burpees", "Squats"]);
    await expect(page.locator("#manage")).toBeHidden();

    const stored = await page.evaluate(() => ({
      programs: JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]"),
      exercises: JSON.parse(localStorage.getItem("fitnesshelp-exercises-v1") || "[]"),
    }));
    expect(stored.programs).toHaveLength(1);
    expect(stored.programs[0]).toMatchObject({
      id: "w_legacy_1",
      name: "Mijn training",
      rest: 5,
      switch: 15,
      times: 1,
    });
    expect(stored.programs[0].items).toHaveLength(2);
    expect(stored.programs[0].items.every((item) => item.exerciseId)).toBe(true);
    expect(stored.exercises.map((ex) => ex.name).sort()).toEqual(["Burpees", "Squats"]);

    await openManage(page);
    await expect(page.locator("#saved-list .saved-item")).toHaveCount(1);
    await expect(page.locator("#saved-list")).toContainText("Mijn training");
    await page.locator("#saved-list .saved-open", { hasText: "Mijn training" }).click();
    await expect(page.locator("#program-name")).toHaveValue("Mijn training");
    await expect(page.locator("#program-rest")).toHaveValue("5");
    await expect(page.locator("#program-switch")).toHaveValue("15");
    await expect(page.locator("#program-times")).toHaveValue("1");
    await expect(page.locator(".segment")).toHaveCount(2);
    await expect(page.locator(".segment").nth(0).locator(".segment-name")).toHaveText("Burpees");
    await expect(page.locator(".segment").nth(1).locator(".segment-name")).toHaveText("Squats");
  });

  test("na stop terug naar home", async ({ page }) => {
    await createProgram(page, {
      programName: "Core",
      rest: 5,
      exercises: [{ name: "Plank", sets: 2, duration: 10 }],
    });
    await startFromHome(page, "Core");
    await page.click("#stop-btn");

    await expect(page.locator("#timer")).toBeHidden();
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#manage")).toBeHidden();
    await expect(page.locator("body")).not.toHaveClass(/is-running/);
  });

  test("vinkt programma automatisch af na afronden", async ({ page }) => {
    await createProgram(page, {
      programName: "Kort",
      rest: 0,
      switchSec: 0,
      exercises: [{ name: "Plank", sets: 1, duration: 5 }],
    });
    await startFromHome(page, "Kort");
    await page.click("#skip-btn");
    await page.click("#skip-btn");

    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "done");
    await page.click("#stop-btn");

    const item = page.locator("#day-list .day-item", { hasText: "Kort" });
    await expect(item).toHaveClass(/is-done/);
    await expect(item.locator(".day-check")).toBeChecked();
    await expect(page.locator("#home-meta")).toHaveText("Alles afgevinkt");
    await expect(page.locator("#day-list .day-start")).toHaveCount(0);
  });
});
