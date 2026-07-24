const { test, expect } = require("@playwright/test");
const {
  addExerciseToProgram,
  clearAndReload,
  createExercise,
  openExercisesTab,
  openProgramForm,
} = require("./helpers");

test.describe("Oefeningenbibliotheek", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
  });

  test("toont lege oefeningensectie onder tab", async ({ page }) => {
    await openExercisesTab(page);
    await expect(page.locator("#exercises-section")).toBeVisible();
    await expect(page.locator("#exercises-title")).toHaveText("Oefeningen");
    await expect(page.locator("#add-exercise-btn")).toBeVisible();
    await expect(page.locator("#exercises-empty")).toBeVisible();
    await expect(page.locator(".exercise-item")).toHaveCount(0);
  });

  test("kan nieuwe timer-oefening toevoegen", async ({ page }) => {
    await createExercise(page, {
      name: "Push-ups",
      type: "timer",
      sets: 3,
      duration: 45,
    });

    await openExercisesTab(page);
    await expect(page.locator("#exercises-empty")).toBeHidden();
    await expect(page.locator(".exercise-item")).toHaveCount(1);
    await expect(page.locator(".exercise-name")).toHaveText("Push-ups");
    await expect(page.locator(".exercise-meta")).toContainText("Timer");
    await expect(page.locator(".exercise-meta")).toContainText("3 sets");
    await expect(page.locator(".exercise-meta")).toContainText("45 sec");
  });

  test("kan nieuwe reps-oefening toevoegen", async ({ page }) => {
    await createExercise(page, {
      name: "Sit-ups",
      type: "reps",
      sets: 4,
      reps: 20,
    });

    await openExercisesTab(page);
    await expect(page.locator(".exercise-item")).toHaveCount(1);
    await expect(page.locator(".exercise-name")).toHaveText("Sit-ups");
    await expect(page.locator(".exercise-meta")).toContainText("Sets & keer");
    await expect(page.locator(".exercise-meta")).toContainText("4 sets");
    await expect(page.locator(".exercise-meta")).toContainText("20 keer");
  });

  test("sorteert oefeningen alfabetisch", async ({ page }) => {
    await createExercise(page, { name: "Squats" });
    await createExercise(page, { name: "Burpees" });
    await createExercise(page, { name: "Plank" });

    await openExercisesTab(page);
    const names = await page.locator(".exercise-name").allTextContents();
    expect(names).toEqual(["Burpees", "Plank", "Squats"]);
  });

  test("kan oefening bewerken", async ({ page }) => {
    await createExercise(page, { name: "Squats", sets: 3, duration: 45 });
    await openExercisesTab(page);

    await page.locator(".exercise-item .btn-ghost").first().click();
    await expect(page.locator("#modal-title")).toHaveText("Oefening bewerken");

    const nameInput = page.locator(".modal-content input[type='text']").first();
    await nameInput.fill("Deep Squats");
    const inputs = page.locator(".modal-content .field-row input[type='text']");
    await inputs.nth(0).fill("5");
    await inputs.nth(1).fill("60");

    await page.click(".modal-content .btn-primary");

    await expect(page.locator(".exercise-name")).toHaveText("Deep Squats");
    await expect(page.locator(".exercise-meta")).toContainText("5 sets");
    await expect(page.locator(".exercise-meta")).toContainText("60 sec");
  });

  test("wijziging oefening werkt door in programma", async ({ page }) => {
    await createExercise(page, { name: "Plank", sets: 2, duration: 30 });
    await openProgramForm(page);
    await page.fill("#program-name", "Core");
    await addExerciseToProgram(page, "Plank");
    await page.click("#save-btn");

    await openExercisesTab(page);
    await page.locator(".exercise-item .btn-ghost").first().click();
    await page.locator(".modal-content input[type='text']").first().fill("Side plank");
    await page.click(".modal-content .btn-primary");

    await page.click("#manage-done-btn");
    await expect(page.locator("#day-list")).toContainText("Side plank");
  });

  test("kan oefening verwijderen", async ({ page }) => {
    await createExercise(page, { name: "Lunges" });
    await openExercisesTab(page);
    await expect(page.locator(".exercise-item")).toHaveCount(1);
    await page.locator(".exercise-item .btn-danger").click();

    await expect(page.locator(".exercise-item")).toHaveCount(0);
    await expect(page.locator("#exercises-empty")).toBeVisible();
  });

  test("kan oefening toevoegen aan programma via picker", async ({ page }) => {
    await createExercise(page, {
      name: "Burpees",
      type: "timer",
      sets: 3,
      duration: 30,
    });

    await openProgramForm(page);
    await addExerciseToProgram(page, "Burpees");

    await expect(page.locator(".segment")).toHaveCount(1);
    const segment = page.locator(".segment").first();
    await expect(segment).toHaveClass(/segment-ref/);
    await expect(segment.locator(".segment-name")).toHaveText("Burpees");
    await expect(segment.locator(".segment-actions")).toBeVisible();
    await expect(segment.locator(".segment-meta")).toHaveCount(0);
  });

  test("modal kan worden gesloten met annuleren knop", async ({ page }) => {
    await openExercisesTab(page);
    await page.click("#add-exercise-btn");
    await expect(page.locator(".modal-overlay")).toBeVisible();

    await page.click(".modal-content .btn-ghost");
    await expect(page.locator(".modal-overlay")).toHaveCount(0);
  });

  test("modal sluit bij klikken buiten de modal", async ({ page }) => {
    await openExercisesTab(page);
    await page.click("#add-exercise-btn");
    await expect(page.locator(".modal-overlay")).toBeVisible();

    await page.locator(".modal-overlay").click({ position: { x: 10, y: 10 } });
    await expect(page.locator(".modal-overlay")).toHaveCount(0);
  });

  test("oefeningen blijven bewaard na reload", async ({ page }) => {
    await createExercise(page, { name: "Plank" });
    await page.reload();

    await openExercisesTab(page);
    await expect(page.locator(".exercise-item")).toHaveCount(1);
    await expect(page.locator(".exercise-name")).toHaveText("Plank");
  });

  test("type wisselen tussen timer en reps werkt correct", async ({ page }) => {
    await openExercisesTab(page);
    await page.click("#add-exercise-btn");
    await page.locator(".modal-content input[type='text']").first().fill("Test");

    await page.selectOption(".modal-content select", "timer");
    const inputs1 = await page.locator(".modal-content .field-row input[type='text']").all();
    expect(inputs1.length).toBe(2);
    await expect(inputs1[1]).toHaveAttribute("placeholder", "45");

    await page.selectOption(".modal-content select", "reps");
    const inputs2 = await page.locator(".modal-content .field-row input[type='text']").all();
    expect(inputs2.length).toBe(2);
    await expect(inputs2[1]).toHaveAttribute("placeholder", "10");
  });
});
