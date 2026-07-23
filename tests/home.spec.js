const { test, expect } = require("@playwright/test");
const { clearAndReload, openManage } = require("./helpers");

test.describe("Home & dagprogramma", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
  });

  test("slaat programma op en toont dagprogramma op home", async ({ page }) => {
    await page.fill("#program-name", "Push");
    await page.fill("#program-rest", "20");
    await page.fill(".segment-name", "Push-ups");
    await page.fill(".segment-sets", "4");
    await page.fill(".segment-duration", "40");
    await page.click("#save-btn");

    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator(".home-label")).toHaveText("Dagprogramma");
    await expect(page.locator("#home-title")).toHaveText("Vandaag");
    await expect(page.locator("#home-meta")).toContainText("1 programma");
    await expect(page.locator("#day-list .day-item")).toHaveCount(1);
    await expect(page.locator("#day-list")).toContainText("Push");
    await expect(page.locator("#day-list")).toContainText("Push-ups");
    await expect(page.locator("#home-start-btn")).toHaveText("Start dag");
    await expect(page.locator("#manage")).toBeHidden();
    await expect(page.locator("#tagline")).toBeHidden();

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]")
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      name: "Push",
      rest: 20,
      switch: 15,
      items: [
        {
          type: "timer",
          name: "Push-ups",
          sets: 4,
          duration: 40,
          rest: 20,
        },
      ],
    });

    const favoriteId = await page.evaluate(() =>
      localStorage.getItem("fitnesshelp-favorite-v1")
    );
    expect(favoriteId).toBe(stored[0].id);

    await openManage(page);
    await expect(page.locator("#saved-list .saved-item")).toHaveCount(1);
    await expect(page.locator("#saved-list")).toContainText("Push");
    await expect(page.locator("#saved-list")).toContainText("Favoriet");
    await expect(
      page.locator("#saved-list .saved-item").locator("button", { hasText: "Favoriet" })
    ).toHaveCount(0);
    await expect(
      page.locator("#saved-list .saved-item").locator("button", { hasText: "Start" })
    ).toHaveCount(0);
    await expect(page.locator(".segment-foot")).toHaveCount(0);
    await expect(page.locator("body")).toHaveClass(/is-managing/);
  });

  test("start programma vanaf home", async ({ page }) => {
    await page.fill("#program-name", "Core");
    await page.fill("#program-rest", "10");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "3");
    await page.fill(".segment-duration", "30");
    await page.click("#save-btn");

    await page.click("#home-start-btn");
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "prep");
    await page.click("#skip-btn");
    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer-name")).toHaveText("Plank");
  });

  test("toont meerdere programma’s en laat ze afvinken", async ({ page }) => {
    await page.fill("#program-name", "Warm-up");
    await page.fill(".segment-name", "Jumping jacks");
    await page.click("#save-btn");

    await openManage(page);
    await page.fill("#program-name", "Kracht");
    await page.fill(".segment-name", "Squats");
    await page.click("#save-btn");

    await openManage(page);
    await page.fill("#program-name", "Core");
    await page.fill(".segment-name", "Plank");
    await page.click("#save-btn");

    await expect(page.locator("#day-list .day-item")).toHaveCount(3);
    await expect(page.locator("#home-meta")).toContainText("3 programma’s");

    const kracht = page.locator("#day-list .day-item", { hasText: "Kracht" });
    await kracht.locator(".day-check").check();
    await expect(kracht).toHaveClass(/is-done/);
    await expect(page.locator("#home-meta")).toContainText("1 van 3 klaar");
    await expect(page.locator("#home-start-btn")).toHaveText("Volgende");

    await kracht.locator(".day-check").uncheck();
    await expect(kracht).not.toHaveClass(/is-done/);
    await expect(page.locator("#home-meta")).toContainText("3 programma’s");
  });

  test("kan favoriet wisselen tussen programma’s", async ({ page }) => {
    await page.fill("#program-name", "Push");
    await page.fill(".segment-name", "Push-ups");
    await page.click("#save-btn");

    await openManage(page);
    await page.fill("#program-name", "Pull");
    await page.fill(".segment-name", "Rows");
    await page.click("#save-btn");

    await expect(page.locator("#day-list .day-item").first()).toContainText("Push");
    await openManage(page);
    await expect(page.locator("#saved-list .saved-item")).toHaveCount(2);

    await page
      .locator("#saved-list .saved-item", { hasText: "Pull" })
      .locator("button", { hasText: "Maak favoriet" })
      .click();

    await page.click("#manage-done-btn");
    await expect(page.locator("#day-list .day-item").first()).toContainText("Pull");
    await expect(page.locator("#day-list")).toContainText("Rows");
  });

  test("migreert legacy workouts naar één programma", async ({ page }) => {
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
    await expect(page.locator("#day-list")).toContainText("2 onderdelen");
    await expect(page.locator("#manage")).toBeHidden();

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]")
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: "w_legacy_1",
      name: "Mijn training",
      rest: 5,
      switch: 15,
      items: [
        { type: "timer", name: "Burpees", sets: 2, duration: 15, rest: 5 },
        { type: "timer", name: "Squats", sets: 3, duration: 40, rest: 20 },
      ],
    });

    await openManage(page);
    await expect(page.locator("#saved-list .saved-item")).toHaveCount(1);
    await expect(page.locator("#saved-list")).toContainText("Mijn training");
    await page.locator("#saved-list button", { hasText: "Laden" }).click();
    await expect(page.locator("#program-name")).toHaveValue("Mijn training");
    await expect(page.locator("#program-rest")).toHaveValue("5");
    await expect(page.locator("#program-switch")).toHaveValue("15");
    await expect(page.locator(".segment")).toHaveCount(2);
    await expect(page.locator(".segment").nth(0).locator(".segment-name")).toHaveValue("Burpees");
    await expect(page.locator(".segment").nth(1).locator(".segment-name")).toHaveValue("Squats");
  });

  test("na stop terug naar home", async ({ page }) => {
    await page.fill("#program-name", "Core");
    await page.fill("#program-rest", "5");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "10");
    await page.click("#save-btn");
    await page.click("#home-start-btn");
    await page.click("#stop-btn");

    await expect(page.locator("#timer")).toBeHidden();
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#manage")).toBeHidden();
    await expect(page.locator("body")).not.toHaveClass(/is-running/);
  });

  test("vinkt programma automatisch af na afronden", async ({ page }) => {
    await page.fill("#program-name", "Kort");
    await page.fill("#program-rest", "0");
    await page.fill("#program-switch", "0");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "1");
    await page.fill(".segment-duration", "5");
    await page.click("#save-btn");
    await page.click("#home-start-btn");
    await page.click("#skip-btn");
    await page.click("#skip-btn");

    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "done");
    await page.click("#stop-btn");

    const item = page.locator("#day-list .day-item", { hasText: "Kort" });
    await expect(item).toHaveClass(/is-done/);
    await expect(item.locator(".day-check")).toBeChecked();
    await expect(page.locator("#home-meta")).toHaveText("Alles afgevinkt");
    await expect(page.locator("#home-start-btn")).toBeHidden();
  });
});
