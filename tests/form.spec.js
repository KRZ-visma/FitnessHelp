const { test, expect } = require("@playwright/test");
const {
  addExerciseToProgram,
  clearAndReload,
  createExercise,
  createProgram,
  openManage,
  openProgramForm,
} = require("./helpers");

test.describe("Formulier & beheer", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
  });

  test("toont de pagina met merk en programmaformulier", async ({ page }) => {
    await expect(page).toHaveTitle(/FitnessHelp/i);
    await expect(page.locator(".brand")).toHaveText("FitnessHelp");
    await expect(page.locator("#home")).toBeHidden();
    await expect(page.locator("#manage")).toBeVisible();
    await expect(page.locator("#manage-header")).toBeHidden();
    await expect(page.locator("#manage-tab-programs")).toBeVisible();
    await expect(page.locator("#manage-tab-exercises")).toBeVisible();
    await expect(page.locator("#saved")).toBeVisible();
    await expect(page.locator("#add-program-btn")).toBeVisible();
    await expect(page.locator("#setup")).toBeVisible();
    await expect(page.locator("#program-name")).toBeVisible();
    await expect(page.locator("#program-rest")).toBeVisible();
    await expect(page.locator("#program-switch")).toBeVisible();
    await expect(page.locator("#segments-empty")).toHaveCount(0);
    await expect(page.locator(".segments-hint")).toHaveCount(0);
    await expect(page.locator(".segments-title")).toHaveText("Oefeningen");
    await expect(page.locator(".segment")).toHaveCount(0);
    await expect(page.locator("#save-btn")).toBeVisible();
    await expect(page.locator("#start-btn")).toHaveCount(0);
    await expect(page.locator("#add-segment-btn")).toHaveText("+ Oefening");
  });

  test("toont app-versie klein in de footer", async ({ page }) => {
    const version = page.locator("#app-version");
    await expect(version).toBeVisible();
    await expect(version).toHaveText(/^v\d+\.\d+\.\d+$/);
  });

  test("programma-naam heeft geen suggestielijst", async ({ page }) => {
    const program = page.locator("#program-name");
    await expect(program).toHaveAttribute("autocomplete", "fh-program");
    await expect(program).not.toHaveAttribute("list");
    await expect(page.locator("#program-name-suggestions")).toHaveCount(0);
  });

  test("nummervelden gebruiken iOS cijferpad-attributen", async ({ page }) => {
    for (const selector of ["#program-rest", "#program-switch"]) {
      const input = page.locator(selector);
      await expect(input).toHaveAttribute("type", "text");
      await expect(input).toHaveAttribute("inputmode", "numeric");
      await expect(input).toHaveAttribute("pattern", "[0-9]*");
      await expect(input).toHaveAttribute("autocomplete", /^(fh-rest|fh-switch)$/);
    }
  });

  test("programma-velden blokkeren Safari-autofill", async ({ page }) => {
    const program = page.locator("#program-name");
    await expect(program).toHaveAttribute("name", "fh-program");
    await expect(program).toHaveAttribute("autocomplete", "fh-program");
    await expect(program).toHaveAttribute("autocorrect", "off");
    await expect(program).toHaveAttribute("spellcheck", "false");
    await expect(program).not.toHaveAttribute("readonly");

    await expect(page.locator(".autofill-trap")).toHaveCount(1);
    await expect(page.locator(".autofill-trap [name='name']")).toHaveCount(1);
    await expect(page.locator("#workout-form > .field #program-name")).toHaveAttribute(
      "name",
      "fh-program"
    );
  });

  test("Klaar-knop in beheer is een primaire knop", async ({ page }) => {
    await createProgram(page, {
      programName: "Push",
      exercises: [{ name: "Push-ups", sets: 3, duration: 40 }],
    });

    await openManage(page);
    const done = page.locator("#manage-done-btn");
    await expect(done).toBeVisible();
    await expect(done).toHaveClass(/btn-primary/);
    await expect(done).not.toHaveClass(/btn-ghost/);
  });

  test("kan volgorde van oefeningen wijzigen", async ({ page }) => {
    await createExercise(page, { name: "Squats" });
    await createExercise(page, { name: "Push-ups" });
    await createExercise(page, { name: "Rows" });

    await openProgramForm(page);
    await page.fill("#program-name", "Full body");
    await addExerciseToProgram(page, "Squats");
    await addExerciseToProgram(page, "Push-ups");
    await addExerciseToProgram(page, "Rows");

    await expect(page.locator(".segment")).toHaveCount(3);
    await expect(page.locator(".segment").nth(0).locator(".segment-move-up")).toBeDisabled();
    await expect(page.locator(".segment").nth(2).locator(".segment-move-down")).toBeDisabled();
    await expect(page.locator(".segment").nth(0).locator(".segment-actions")).toBeVisible();

    await page.locator(".segment").nth(0).locator(".segment-move-down").click();
    await expect(page.locator(".segment").nth(0).locator(".segment-name")).toHaveText("Push-ups");
    await expect(page.locator(".segment").nth(1).locator(".segment-name")).toHaveText("Squats");
    await expect(page.locator(".segment").nth(2).locator(".segment-name")).toHaveText("Rows");

    await page.locator(".segment").nth(2).locator(".segment-move-up").click();
    await expect(page.locator(".segment").nth(0).locator(".segment-name")).toHaveText("Push-ups");
    await expect(page.locator(".segment").nth(1).locator(".segment-name")).toHaveText("Rows");
    await expect(page.locator(".segment").nth(2).locator(".segment-name")).toHaveText("Squats");

    await page.click("#save-btn");
    const stored = await page.evaluate(() => ({
      programs: JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1")),
      exercises: JSON.parse(localStorage.getItem("fitnesshelp-exercises-v1")),
    }));
    const names = stored.programs[0].items.map((item) => {
      const ex = stored.exercises.find((e) => e.id === item.exerciseId);
      return ex.name;
    });
    expect(names).toEqual(["Push-ups", "Rows", "Squats"]);
  });

  test("Enter slaat op en gaat terug naar home", async ({ page }) => {
    await page.fill("#program-name", "Enter save");
    await page.locator("#program-name").press("Enter");
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#day-list")).toContainText("Enter save");
  });

  test("nummervelden filteren niet-cijfers", async ({ page }) => {
    await page.fill("#program-rest", "1o0");
    await expect(page.locator("#program-rest")).toHaveValue("10");

    await page.fill("#program-switch", "2x5");
    await expect(page.locator("#program-switch")).toHaveValue("25");
  });

  test("mag programma zonder oefeningen opslaan", async ({ page }) => {
    await page.fill("#program-name", "Leeg schema");
    await page.click("#save-btn");
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#day-list")).toContainText("Leeg schema");
    await expect(page.locator("#day-list .day-exercises li")).toHaveCount(0);
  });
});
