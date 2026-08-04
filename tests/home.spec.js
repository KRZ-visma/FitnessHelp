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
    await expect(page.locator(".home-header #manage-btn")).toBeVisible();
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
      active: true,
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
    await expect(page.locator("#saved-title")).toHaveText("Programma’s beheren");
    await expect(page.locator("#saved-active-hint")).toBeVisible();
    await expect(page.locator("#saved-active-hint")).toContainText("actieve");
    await expect(page.locator("#saved-list .saved-item")).toHaveCount(1);
    await expect(page.locator("#saved-list")).toContainText("Push");
    await expect(page.locator("#saved-list .saved-active-toggle")).toHaveText("Aan");
    await expect(page.locator("#saved-list .saved-active-toggle")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.locator("#saved-list")).not.toContainText("Favoriet");
    await expect(
      page.locator("#saved-list .saved-item").locator("button", { hasText: "Favoriet" })
    ).toHaveCount(0);
    await expect(page.locator("body")).toHaveClass(/is-managing/);
  });

  test("kan programma’s activeren en deactiveren voor Vandaag", async ({ page }) => {
    await createExercise(page, { name: "Jumping jacks" });
    await createExercise(page, { name: "Squats" });

    await openProgramForm(page);
    await page.fill("#program-name", "Warm-up");
    await addExerciseToProgram(page, "Jumping jacks");
    await page.click("#save-btn");

    await openProgramForm(page);
    await page.fill("#program-name", "Kracht");
    await addExerciseToProgram(page, "Squats");
    await page.click("#save-btn");

    await page.click("#manage-done-btn");
    await expect(page.locator("#day-list .day-item")).toHaveCount(2);

    await openManage(page);
    const kracht = page.locator("#saved-list .saved-item", { hasText: "Kracht" });
    await expect(kracht.locator(".saved-active-toggle")).toHaveText("Aan");
    await kracht.locator(".saved-active-toggle").click();
    await expect(kracht).toHaveClass(/is-inactive/);
    await expect(kracht.locator(".saved-active-toggle")).toHaveText("Uit");
    await expect(kracht.locator(".saved-active-toggle")).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]")
    );
    expect(stored.find((p) => p.name === "Kracht").active).toBe(false);
    expect(stored.find((p) => p.name === "Warm-up").active).toBe(true);

    await page.click("#manage-done-btn");
    await expect(page.locator("#day-list .day-item")).toHaveCount(1);
    await expect(page.locator("#day-list")).toContainText("Warm-up");
    await expect(page.locator("#day-list")).not.toContainText("Kracht");
    await expect(page.locator("#home-meta")).toContainText("1 programma");

    await openManage(page);
    await page
      .locator("#saved-list .saved-item", { hasText: "Warm-up" })
      .locator(".saved-active-toggle")
      .click();
    await page
      .locator("#saved-list .saved-item", { hasText: "Kracht" })
      .locator(".saved-active-toggle")
      .click();
    await page.click("#manage-done-btn");

    await expect(page.locator("#day-list .day-item")).toHaveCount(1);
    await expect(page.locator("#day-list")).toContainText("Kracht");
    await expect(page.locator("#day-list")).not.toContainText("Warm-up");

    await openManage(page);
    await page
      .locator("#saved-list .saved-item", { hasText: "Kracht" })
      .locator(".saved-active-toggle")
      .click();
    await page.click("#manage-done-btn");

    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#home-meta")).toHaveText("Geen actieve programma’s");
    await expect(page.locator("#day-list .day-empty")).toContainText("Beheer");
    await expect(page.locator("#day-list .day-item")).toHaveCount(0);
    await expect(page.locator("#manage-btn")).toBeVisible();
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

  test("toont meerdere programma’s zonder handmatig afvinken", async ({ page }) => {
    await createExercise(page, { name: "Jumping jacks" });
    await createExercise(page, { name: "Squats" });
    await createExercise(page, { name: "Plank" });

    await openProgramForm(page);
    await page.fill("#program-name", "Warm-up");
    await addExerciseToProgram(page, "Jumping jacks");
    await page.click("#save-btn");

    await openProgramForm(page);
    await page.fill("#program-name", "Kracht");
    await addExerciseToProgram(page, "Squats");
    await page.click("#save-btn");

    await openProgramForm(page);
    await page.fill("#program-name", "Core");
    await addExerciseToProgram(page, "Plank");
    await page.click("#save-btn");

    await page.click("#manage-done-btn");
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
    await expect(kracht.locator(".day-check")).toBeDisabled();
    await expect(kracht).not.toHaveClass(/is-done/);
    await expect(page.locator("#day-list .day-start")).toHaveCount(3);
  });

  test("opent opgeslagen programma via klik op de lijst", async ({ page }) => {
    await createProgram(page, {
      programName: "Push",
      rest: 20,
      exercises: [{ name: "Push-ups", sets: 4, duration: 40 }],
    });

    await openManage(page);
    await expect(page.locator("#setup")).toBeHidden();
    await page.locator("#saved-list .saved-open", { hasText: "Push" }).click();
    await expect(page.locator("#setup")).toBeVisible();
    await expect(page.locator("#program-name")).toHaveValue("Push");
    await expect(page.locator("#program-rest")).toHaveValue("20");
    await expect(page.locator("#program-times")).toHaveValue("1");
    await expect(page.locator(".segment-name")).toHaveText("Push-ups");
    await expect(page.locator("#saved-list .saved-exercises")).toContainText("Push-ups");
  });

  test("hernoemen van programma behoudt oefeningen", async ({ page }) => {
    await createProgram(page, {
      programName: "Push",
      rest: 20,
      exercises: [
        { name: "Push-ups", sets: 4, duration: 40 },
        { name: "Dips", sets: 3, duration: 30 },
      ],
    });

    await openManage(page);
    await page.locator("#saved-list .saved-open", { hasText: "Push" }).click();
    await expect(page.locator("#setup")).toBeVisible();
    await expect(page.locator("#program-name")).toHaveValue("Push");
    await expect(page.locator(".segment")).toHaveCount(2);
    await expect(page.locator(".segment").nth(0).locator(".segment-name")).toHaveText(
      "Push-ups"
    );
    await expect(page.locator(".segment").nth(1).locator(".segment-name")).toHaveText("Dips");

    await page.fill("#program-name", "Push day");
    await page.click("#save-btn");

    await expect(page.locator("#manage")).toBeVisible();
    await expect(page.locator("#setup")).toBeHidden();

    const renamed = page.locator("#saved-list .saved-item", { hasText: "Push day" });
    await expect(renamed).toBeVisible();
    await expect(renamed.locator(".saved-exercises li")).toHaveText(["Push-ups", "Dips"]);

    const stored = await page.evaluate(() => ({
      programs: JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]"),
      exercises: JSON.parse(localStorage.getItem("fitnesshelp-exercises-v1") || "[]"),
    }));
    const pushDay = stored.programs.find((p) => p.name === "Push day");
    expect(pushDay).toBeTruthy();
    expect(pushDay.items).toHaveLength(2);
    const names = pushDay.items.map((item) => {
      const ex = stored.exercises.find((e) => e.id === item.exerciseId);
      return ex?.name;
    });
    expect(names).toEqual(["Push-ups", "Dips"]);

    await page.locator("#saved-list .saved-open", { hasText: "Push day" }).click();
    await expect(page.locator("#program-name")).toHaveValue("Push day");
    await expect(page.locator(".segment")).toHaveCount(2);
    await expect(page.locator(".segment").nth(0).locator(".segment-name")).toHaveText(
      "Push-ups"
    );
    await expect(page.locator(".segment").nth(1).locator(".segment-name")).toHaveText("Dips");
  });

  test("houdt acties op één regel met pijlsymbolen", async ({ page }) => {
    await createExercise(page, { name: "Push-ups" });
    await createExercise(page, { name: "Rows" });

    await openProgramForm(page);
    await page.fill("#program-name", "Push");
    await addExerciseToProgram(page, "Push-ups");
    await page.click("#save-btn");

    await openProgramForm(page);
    await page.fill("#program-name", "Pull");
    await addExerciseToProgram(page, "Rows");
    await page.click("#save-btn");

    await openManage(page);
    const item = page.locator("#saved-list .saved-item").first();
    const actions = item.locator(".saved-actions");
    await expect(actions.locator(".saved-move-up")).toHaveText("↑");
    await expect(actions.locator(".saved-move-down")).toHaveText("↓");
    await expect(actions.locator(".btn-danger")).toHaveAttribute(
      "aria-label",
      "Push verwijderen"
    );
    await expect(actions.locator(".btn-danger svg")).toBeVisible();
    await expect(actions.locator("button", { hasText: "Laden" })).toHaveCount(0);
    await expect(item.locator(".saved-exercises li")).toHaveCount(1);

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

    await openProgramForm(page);
    await page.fill("#program-name", "Push");
    await addExerciseToProgram(page, "Push-ups");
    await page.click("#save-btn");

    await openProgramForm(page);
    await page.fill("#program-name", "Pull");
    await addExerciseToProgram(page, "Rows");
    await page.click("#save-btn");

    await page.click("#manage-done-btn");
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
      active: true,
    });
    expect(stored.programs[0].items).toHaveLength(2);
    expect(stored.programs[0].items.every((item) => item.exerciseId)).toBe(true);
    expect(stored.exercises.map((ex) => ex.name).sort()).toEqual(["Burpees", "Squats"]);

    await openManage(page);
    await expect(page.locator("#saved-list .saved-item")).toHaveCount(1);
    await expect(page.locator("#saved-list")).toContainText("Mijn training");
    await expect(page.locator("#saved-list .saved-exercises")).toContainText("Burpees");
    await expect(page.locator("#saved-list .saved-exercises")).toContainText("Squats");
    await page.locator("#saved-list .saved-open", { hasText: "Mijn training" }).click();
    await expect(page.locator("#setup")).toBeVisible();
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

    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "done");
    await page.click("#stop-btn");

    const item = page.locator("#day-list .day-item", { hasText: "Kort" });
    await expect(item).toHaveClass(/is-done/);
    await expect(item.locator(".day-check")).toBeDisabled();
    await expect(item.locator(".day-check")).toBeChecked();
    await expect(page.locator("#home-meta")).toHaveText("Alles afgevinkt");
    await expect(item.locator(".day-start")).toHaveText("Nog een keer");
  });

  test("kan afgevinkt programma opnieuw starten", async ({ page }) => {
    await createProgram(page, {
      programName: "Extra",
      rest: 0,
      switchSec: 0,
      exercises: [{ name: "Plank", sets: 1, duration: 5 }],
    });
    await startFromHome(page, "Extra");
    await page.click("#skip-btn");
    await page.click("#stop-btn");

    const item = page.locator("#day-list .day-item", { hasText: "Extra" });
    await expect(item).toHaveClass(/is-done/);
    await expect(item.locator(".day-start")).toHaveText("Nog een keer");

    await startFromHome(page, "Extra");
    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer-name")).toHaveText("Plank");
    await page.click("#skip-btn");
    await page.click("#stop-btn");

    await expect(item).toHaveClass(/is-done/);
    await expect(item.locator(".day-check")).toBeChecked();
    await expect(item.locator(".day-start")).toHaveText("Nog een keer");
    await expect(page.locator("#home-meta")).toHaveText("Alles afgevinkt");
  });
});
