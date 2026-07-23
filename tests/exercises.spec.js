const { test, expect } = require("@playwright/test");
const { clearAndReload } = require("./helpers");

test.describe("Oefeningenbibliotheek", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
  });

  test("toont lege oefeningenbibliotheek sectie", async ({ page }) => {
    await expect(page.locator("#exercises-section")).toBeVisible();
    await expect(page.locator("#exercises-title")).toHaveText("Oefeningenbibliotheek");
    await expect(page.locator("#add-exercise-btn")).toBeVisible();
    await expect(page.locator("#exercises-empty")).toBeVisible();
    await expect(page.locator(".exercise-item")).toHaveCount(0);
  });

  test("kan nieuwe timer-oefening toevoegen", async ({ page }) => {
    await page.click("#add-exercise-btn");
    await expect(page.locator(".modal-overlay")).toBeVisible();
    await expect(page.locator("#modal-title")).toHaveText("Nieuwe oefening");

    await page.fill(".modal-content input[type='text']", "Push-ups");
    await page.selectOption(".modal-content select", "timer");
    const inputs = await page.locator(".modal-content .field input[type='text']").all();
    await inputs[1].fill("3");
    await inputs[2].fill("45");

    await page.click(".modal-content .btn-primary");
    await expect(page.locator(".modal-overlay")).toHaveCount(0);

    await expect(page.locator("#exercises-empty")).toBeHidden();
    await expect(page.locator(".exercise-item")).toHaveCount(1);
    await expect(page.locator(".exercise-name")).toHaveText("Push-ups");
    await expect(page.locator(".exercise-meta")).toContainText("Timer");
    await expect(page.locator(".exercise-meta")).toContainText("3 sets");
    await expect(page.locator(".exercise-meta")).toContainText("45 sec");
  });

  test("kan nieuwe reps-oefening toevoegen", async ({ page }) => {
    await page.click("#add-exercise-btn");
    await page.fill(".modal-content input[type='text']", "Sit-ups");
    await page.selectOption(".modal-content select", "reps");
    const inputs = await page.locator(".modal-content .field input[type='text']").all();
    await inputs[1].fill("4");
    await inputs[2].fill("20");

    await page.click(".modal-content .btn-primary");

    await expect(page.locator(".exercise-item")).toHaveCount(1);
    await expect(page.locator(".exercise-name")).toHaveText("Sit-ups");
    await expect(page.locator(".exercise-meta")).toContainText("Sets & keer");
    await expect(page.locator(".exercise-meta")).toContainText("4 sets");
    await expect(page.locator(".exercise-meta")).toContainText("20 keer");
  });

  test("kan oefening bewerken", async ({ page }) => {
    await page.click("#add-exercise-btn");
    await page.fill(".modal-content input[type='text']", "Squats");
    await page.click(".modal-content .btn-primary");

    await page.locator(".exercise-item .btn-ghost").first().click();
    await expect(page.locator("#modal-title")).toHaveText("Oefening bewerken");

    const nameInput = page.locator(".modal-content input[type='text']").first();
    await nameInput.fill("Deep Squats");
    const inputs = await page.locator(".modal-content .field input[type='text']").all();
    await inputs[1].fill("5");
    await inputs[2].fill("60");

    await page.click(".modal-content .btn-primary");

    await expect(page.locator(".exercise-name")).toHaveText("Deep Squats");
    await expect(page.locator(".exercise-meta")).toContainText("5 sets");
    await expect(page.locator(".exercise-meta")).toContainText("60 sec");
  });

  test("kan oefening verwijderen", async ({ page }) => {
    await page.click("#add-exercise-btn");
    await page.fill(".modal-content input[type='text']", "Lunges");
    await page.click(".modal-content .btn-primary");

    await expect(page.locator(".exercise-item")).toHaveCount(1);
    await page.locator(".exercise-item .btn-danger").click();

    await expect(page.locator(".exercise-item")).toHaveCount(0);
    await expect(page.locator("#exercises-empty")).toBeVisible();
  });

  test("kan oefening gebruiken in programma", async ({ page }) => {
    await page.click("#add-exercise-btn");
    await page.fill(".modal-content input[type='text']", "Burpees");
    await page.selectOption(".modal-content select", "timer");
    const inputs = await page.locator(".modal-content .field input[type='text']").all();
    await inputs[1].fill("3");
    await inputs[2].fill("30");
    await page.click(".modal-content .btn-primary");

    await page.locator(".exercise-item .btn-primary").click();

    await expect(page.locator(".segment")).toHaveCount(2);
    const lastSegment = page.locator(".segment").last();
    await expect(lastSegment).toHaveClass(/segment-ref/);
    await expect(lastSegment.locator(".segment-name")).toHaveValue("Burpees");
    await expect(lastSegment.locator(".segment-name")).toHaveAttribute("readonly", "");
    await expect(lastSegment.locator(".segment-sets")).toHaveValue("3");
    await expect(lastSegment.locator(".segment-sets")).toHaveAttribute("readonly", "");
    await expect(lastSegment.locator(".segment-duration")).toHaveValue("30");
    await expect(lastSegment.locator(".segment-duration")).toHaveAttribute("readonly", "");
  });

  test("modal kan worden gesloten met annuleren knop", async ({ page }) => {
    await page.click("#add-exercise-btn");
    await expect(page.locator(".modal-overlay")).toBeVisible();

    await page.click(".modal-content .btn-ghost");
    await expect(page.locator(".modal-overlay")).toHaveCount(0);
  });

  test("modal sluit bij klikken buiten de modal", async ({ page }) => {
    await page.click("#add-exercise-btn");
    await expect(page.locator(".modal-overlay")).toBeVisible();

    await page.locator(".modal-overlay").click({ position: { x: 10, y: 10 } });
    await expect(page.locator(".modal-overlay")).toHaveCount(0);
  });

  test("oefeningen blijven bewaard na reload", async ({ page }) => {
    await page.click("#add-exercise-btn");
    await page.fill(".modal-content input[type='text']", "Plank");
    await page.click(".modal-content .btn-primary");

    await page.reload();

    await expect(page.locator(".exercise-item")).toHaveCount(1);
    await expect(page.locator(".exercise-name")).toHaveText("Plank");
  });

  test("type wisselen tussen timer en reps werkt correct", async ({ page }) => {
    await page.click("#add-exercise-btn");
    await page.fill(".modal-content input[type='text']", "Test");
    
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
