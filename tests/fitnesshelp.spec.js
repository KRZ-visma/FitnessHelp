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
    await expect(page.locator("#exercise")).toBeVisible();
    await expect(page.locator("#sets")).toBeVisible();
    await expect(page.locator("#duration")).toBeVisible();
    await expect(page.locator("#rest")).toBeVisible();
    await expect(page.locator("#start-btn")).toBeVisible();
  });

  test("start de timer met sets en duur", async ({ page }) => {
    await page.fill("#exercise", "Squats");
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
    await page.fill("#exercise", "Push-ups");
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
    await page.fill("#exercise", "Plank");
    await page.fill("#sets", "3");
    await page.fill("#duration", "30");
    await page.fill("#rest", "10");
    await page.click("#save-btn");

    await page.locator("#saved-list button", { hasText: "Start" }).click();
    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer-name")).toHaveText("Plank");
  });

  test("stopt de timer en toont setup weer", async ({ page }) => {
    await page.fill("#exercise", "Burpees");
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

  test("nummervelden gebruiken iOS cijferpad-attributen", async ({ page }) => {
    for (const id of ["#sets", "#duration", "#rest"]) {
      const input = page.locator(id);
      await expect(input).toHaveAttribute("type", "text");
      await expect(input).toHaveAttribute("inputmode", "numeric");
      await expect(input).toHaveAttribute("pattern", "[0-9]*");
      await expect(input).toHaveAttribute("autocomplete", "off");
    }
  });

  test("oefeningveld is geen contact-autofill veld", async ({ page }) => {
    const exercise = page.locator("#exercise");
    await expect(exercise).toHaveAttribute("name", "exercise");
    await expect(exercise).toHaveAttribute("autocomplete", "off");
    await expect(exercise).toHaveAttribute("autocorrect", "off");
    await expect(exercise).toHaveAttribute("spellcheck", "false");
    await expect(page.locator("#name")).toHaveCount(0);
    await expect(page.locator('[name="name"]')).toHaveCount(0);
  });

  test("nummervelden filteren niet-cijfers", async ({ page }) => {
    await page.fill("#sets", "12abc");
    await expect(page.locator("#sets")).toHaveValue("12");

    await page.fill("#duration", "45x");
    await expect(page.locator("#duration")).toHaveValue("45");

    await page.fill("#rest", "1o0");
    await expect(page.locator("#rest")).toHaveValue("10");
  });

  test("heeft PWA-manifest met standalone display", async ({ page }) => {
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute("href", /manifest\.webmanifest$/);

    const href = await manifestLink.getAttribute("href");
    const manifest = await page.evaluate(async (manifestHref) => {
      const res = await fetch(manifestHref);
      if (!res.ok) throw new Error(`manifest ${res.status}`);
      return res.json();
    }, href);

    expect(manifest.name).toMatch(/FitnessHelp/i);
    expect(manifest.short_name).toMatch(/FitnessHelp/i);
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBeTruthy();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    const iconSizes = manifest.icons.map((icon) => icon.sizes);
    expect(iconSizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });

  test("registreert een service worker", async ({ page }) => {
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const regs = await navigator.serviceWorker.getRegistrations();
          return regs.some((reg) => Boolean(reg.active || reg.installing || reg.waiting));
        })
      )
      .toBe(true);
  });

  test("levert PWA-icons", async ({ page }) => {
    for (const path of ["/icons/icon-192.png", "/icons/icon-512.png"]) {
      const res = await page.request.get(path);
      expect(res.ok()).toBeTruthy();
      expect(res.headers()["content-type"] || "").toMatch(/image\/png/i);
    }
  });
});
