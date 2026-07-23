const { test, expect } = require("@playwright/test");
const { clearAndReload, openManage } = require("./helpers");

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
    await expect(page.locator("#program-name")).toBeVisible();
    await expect(page.locator("#program-rest")).toBeVisible();
    await expect(page.locator("#program-switch")).toBeVisible();
    await expect(page.locator(".segment")).toHaveCount(1);
    await expect(page.locator(".segment-name")).toBeVisible();
    await expect(page.locator(".segment-sets")).toBeVisible();
    await expect(page.locator(".segment-duration")).toBeVisible();
    await expect(page.locator(".segment-rest")).toHaveCount(0);
    await expect(page.locator("#save-btn")).toBeVisible();
    await expect(page.locator("#start-btn")).toHaveCount(0);
    await expect(page.locator("#add-segment-btn")).toBeVisible();
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
    for (const selector of ["#program-rest", "#program-switch", ".segment-sets", ".segment-duration"]) {
      const input = page.locator(selector);
      await expect(input).toHaveAttribute("type", "text");
      await expect(input).toHaveAttribute("inputmode", "numeric");
      await expect(input).toHaveAttribute("pattern", "[0-9]*");
      await expect(input).toHaveAttribute("autocomplete", /^(fh-rest|fh-switch|fh-segment-sets|fh-segment-duration)$/);
    }
  });

  test("programma- en oefeningvelden blokkeren Safari-autofill", async ({ page }) => {
    const program = page.locator("#program-name");
    await expect(program).toHaveAttribute("name", "fh-program");
    await expect(program).toHaveAttribute("autocomplete", "fh-program");
    await expect(program).toHaveAttribute("autocorrect", "off");
    await expect(program).toHaveAttribute("spellcheck", "false");
    await expect(program).not.toHaveAttribute("readonly");

    const exercise = page.locator(".segment-name");
    await expect(exercise).toHaveAttribute("autocomplete", "fh-exercise");
    await expect(exercise).toHaveAttribute("name", "fh-exercise-0");
    await expect(exercise).toHaveAttribute("autocorrect", "off");
    await expect(exercise).toHaveAttribute("spellcheck", "false");
    await expect(exercise).not.toHaveAttribute("readonly");

    // Lokvelden vangen contact-autofill; echte velden blijven fh-*
    await expect(page.locator(".autofill-trap")).toHaveCount(1);
    await expect(page.locator(".autofill-trap [name='name']")).toHaveCount(1);
    await expect(page.locator("#workout-form > .field #program-name")).toHaveAttribute(
      "name",
      "fh-program"
    );
    await expect(page.locator('.segment-name[name="name"]')).toHaveCount(0);
  });

  test("Klaar-knop in beheer is een primaire knop", async ({ page }) => {
    await page.fill("#program-name", "Push");
    await page.fill(".segment-name", "Push-ups");
    await page.click("#save-btn");

    await openManage(page);
    const done = page.locator("#manage-done-btn");
    await expect(done).toBeVisible();
    await expect(done).toHaveClass(/btn-primary/);
    await expect(done).not.toHaveClass(/btn-ghost/);
  });

  test("kan volgorde van onderdelen wijzigen", async ({ page }) => {
    await page.fill("#program-name", "Full body");
    await page.fill(".segment-name", "Squats");
    await page.click("#add-segment-btn");
    await page.locator(".segment").nth(1).locator(".segment-name").fill("Push-ups");
    await page.click("#add-segment-btn");
    await page.locator(".segment").nth(2).locator(".segment-name").fill("Rows");

    await expect(page.locator(".segment")).toHaveCount(3);
    await expect(page.locator(".segment").nth(0).locator(".segment-move-up")).toBeDisabled();
    await expect(page.locator(".segment").nth(2).locator(".segment-move-down")).toBeDisabled();

    await page.locator(".segment").nth(0).locator(".segment-move-down").click();
    await expect(page.locator(".segment").nth(0).locator(".segment-name")).toHaveValue("Push-ups");
    await expect(page.locator(".segment").nth(1).locator(".segment-name")).toHaveValue("Squats");
    await expect(page.locator(".segment").nth(2).locator(".segment-name")).toHaveValue("Rows");

    await page.locator(".segment").nth(2).locator(".segment-move-up").click();
    await expect(page.locator(".segment").nth(0).locator(".segment-name")).toHaveValue("Push-ups");
    await expect(page.locator(".segment").nth(1).locator(".segment-name")).toHaveValue("Rows");
    await expect(page.locator(".segment").nth(2).locator(".segment-name")).toHaveValue("Squats");

    await page.click("#save-btn");
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1"))
    );
    expect(stored[0].items.map((item) => item.name)).toEqual(["Push-ups", "Rows", "Squats"]);
  });

  test("nummervelden filteren niet-cijfers", async ({ page }) => {
    await page.fill(".segment-sets", "12abc");
    await expect(page.locator(".segment-sets")).toHaveValue("12");

    await page.fill(".segment-duration", "45x");
    await expect(page.locator(".segment-duration")).toHaveValue("45");

    await page.fill("#program-rest", "1o0");
    await expect(page.locator("#program-rest")).toHaveValue("10");

    await page.fill("#program-switch", "2x5");
    await expect(page.locator("#program-switch")).toHaveValue("25");
  });
});
