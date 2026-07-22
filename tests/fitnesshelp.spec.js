const { test, expect } = require("@playwright/test");

test.describe("FitnessHelp", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("toont de pagina met merk en formulier", async ({ page }) => {
    await expect(page).toHaveTitle(/FitnessHelp/i);
    await expect(page.locator(".brand")).toHaveText("FitnessHelp");
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#sets")).toBeVisible();
    await expect(page.locator("#duration")).toBeVisible();
    await expect(page.locator("#rest")).toBeVisible();
    await expect(page.locator("#start-btn")).toBeVisible();
  });

  test("start de timer met sets en duur", async ({ page }) => {
    await page.fill("#name", "Squats");
    await page.fill("#sets", "2");
    await page.fill("#duration", "5");
    await page.fill("#rest", "2");
    await page.click("#start-btn");

    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer-name")).toHaveText("Squats");
    await expect(page.locator("#timer-phase")).toContainText("Set 1");
    await expect(page.locator("body")).toHaveClass(/is-running/);
  });

  test("slaat oefening op in localStorage", async ({ page }) => {
    await page.fill("#name", "Push-ups");
    await page.fill("#sets", "4");
    await page.fill("#duration", "40");
    await page.fill("#rest", "20");
    await page.click("#save-btn");

    await expect(page.locator("#saved-list .saved-item")).toHaveCount(1);
    await expect(page.locator("#saved-list")).toContainText("Push-ups");
    await expect(page.locator("#saved-list")).toContainText("4 sets");
    await expect(page.locator("#saved-list")).toContainText("40s");

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]")
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      name: "Push-ups",
      sets: 4,
      duration: 40,
      rest: 20,
    });
  });

  test("laadt opgeslagen oefening en start opnieuw", async ({ page }) => {
    await page.fill("#name", "Plank");
    await page.fill("#sets", "3");
    await page.fill("#duration", "30");
    await page.fill("#rest", "10");
    await page.click("#save-btn");

    await page.locator("#saved-list button", { hasText: "Start" }).click();
    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer-name")).toHaveText("Plank");
  });

  test("stopt de timer en toont setup weer", async ({ page }) => {
    await page.fill("#name", "Burpees");
    await page.fill("#sets", "2");
    await page.fill("#duration", "8");
    await page.fill("#rest", "0");
    await page.click("#start-btn");
    await expect(page.locator("#timer")).toBeVisible();

    await page.click("#stop-btn");
    await expect(page.locator("#timer")).toBeHidden();
    await expect(page.locator("#setup")).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/is-running/);
  });
});
