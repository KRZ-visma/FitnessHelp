const { test, expect } = require("@playwright/test");

test.describe("FitnessHelp", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("toont de pagina met merk en programmaformulier", async ({ page }) => {
    await expect(page).toHaveTitle(/FitnessHelp/i);
    await expect(page.locator(".brand")).toHaveText("FitnessHelp");
    await expect(page.locator("#program-name")).toBeVisible();
    await expect(page.locator(".segment")).toHaveCount(1);
    await expect(page.locator(".segment-name")).toBeVisible();
    await expect(page.locator(".segment-sets")).toBeVisible();
    await expect(page.locator(".segment-duration")).toBeVisible();
    await expect(page.locator(".segment-rest")).toBeVisible();
    await expect(page.locator("#start-btn")).toBeVisible();
    await expect(page.locator("#add-segment-btn")).toBeVisible();
  });

  test("start de timer met sets en duur", async ({ page }) => {
    await page.fill("#program-name", "Been dag");
    await page.fill(".segment-name", "Squats");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "5");
    await page.fill(".segment-rest", "2");
    await page.click("#start-btn");

    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer-name")).toHaveText("Squats");
    await expect(page.locator("#timer-phase")).toContainText("Set 1");
    await expect(page.locator("body")).toHaveClass(/is-running/);
  });

  test("slaat programma op in localStorage", async ({ page }) => {
    await page.fill("#program-name", "Push dag");
    await page.fill(".segment-name", "Push-ups");
    await page.fill(".segment-sets", "4");
    await page.fill(".segment-duration", "40");
    await page.fill(".segment-rest", "20");
    await page.click("#save-btn");

    await expect(page.locator("#saved-list .saved-item")).toHaveCount(1);
    await expect(page.locator("#saved-list")).toContainText("Push dag");
    await expect(page.locator("#saved-list")).toContainText("Push-ups");

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]")
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      name: "Push dag",
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
  });

  test("ondersteunt gemengd programma met timer en sets & keer", async ({ page }) => {
    await page.fill("#program-name", "Full body");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "20");
    await page.fill(".segment-rest", "5");

    await page.click("#add-segment-btn");
    await expect(page.locator(".segment")).toHaveCount(2);

    const second = page.locator(".segment").nth(1);
    await second.locator(".segment-type").selectOption("reps");
    await second.locator(".segment-name").fill("Squats");
    await second.locator(".segment-sets").fill("3");
    await second.locator(".segment-reps").fill("12");

    await page.click("#save-btn");

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]")
    );
    expect(stored[0].items).toEqual([
      { type: "timer", name: "Plank", sets: 2, duration: 20, rest: 5 },
      { type: "reps", name: "Squats", sets: 3, reps: 12 },
    ]);

    await page.click("#start-btn");
    await expect(page.locator("#timer-name")).toHaveText("Plank");
    await expect(page.locator("#timer")).toHaveAttribute("data-mode", "timer");
    await expect(page.locator("#done-set-btn")).toBeHidden();
    await expect(page.locator("#pause-btn")).toBeVisible();
  });

  test("toont sets & keer zonder aftellen", async ({ page }) => {
    await page.fill("#program-name", "Kracht");
    await page.locator(".segment-type").selectOption("reps");
    await page.fill(".segment-name", "Deadlift");
    await page.fill(".segment-sets", "3");
    await page.fill(".segment-reps", "8");
    await page.click("#start-btn");

    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer")).toHaveAttribute("data-mode", "reps");
    await expect(page.locator("#timer-name")).toHaveText("Deadlift");
    await expect(page.locator("#timer-clock")).toHaveText("8×");
    await expect(page.locator("#timer-phase")).toContainText("Set 1 van 3");
    await expect(page.locator("#done-set-btn")).toBeVisible();
    await expect(page.locator("#pause-btn")).toBeHidden();

    await page.click("#done-set-btn");
    await expect(page.locator("#timer-phase")).toContainText("Set 2 van 3");

    await page.click("#done-set-btn");
    await expect(page.locator("#timer-phase")).toContainText("Set 3 van 3");

    await page.click("#done-set-btn");
    await expect(page.locator("#timer-phase")).toHaveText("Klaar");
  });

  test("laadt opgeslagen programma en start opnieuw", async ({ page }) => {
    await page.fill("#program-name", "Core");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "3");
    await page.fill(".segment-duration", "30");
    await page.fill(".segment-rest", "10");
    await page.click("#save-btn");

    await page.locator("#saved-list button", { hasText: "Start" }).click();
    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer-name")).toHaveText("Plank");
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

    await expect(page.locator("#saved-list .saved-item")).toHaveCount(1);
    await expect(page.locator("#saved-list")).toContainText("Mijn training");
    await expect(page.locator("#saved-list")).toContainText("2 onderdelen");
    await expect(page.locator("#saved-list")).toContainText("Burpees");
    await expect(page.locator("#saved-list")).toContainText("Squats");

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]")
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: "w_legacy_1",
      name: "Mijn training",
      items: [
        { type: "timer", name: "Burpees", sets: 2, duration: 15, rest: 5 },
        { type: "timer", name: "Squats", sets: 3, duration: 40, rest: 20 },
      ],
    });

    await page.locator("#saved-list button", { hasText: "Laden" }).click();
    await expect(page.locator("#program-name")).toHaveValue("Mijn training");
    await expect(page.locator(".segment")).toHaveCount(2);
    await expect(page.locator(".segment").nth(0).locator(".segment-name")).toHaveValue("Burpees");
    await expect(page.locator(".segment").nth(1).locator(".segment-name")).toHaveValue("Squats");
  });

  test("stopt de training en toont setup weer", async ({ page }) => {
    await page.fill("#program-name", "HIIT");
    await page.fill(".segment-name", "Burpees");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "8");
    await page.fill(".segment-rest", "0");
    await page.click("#start-btn");
    await expect(page.locator("#timer")).toBeVisible();

    await page.click("#stop-btn");
    await expect(page.locator("#timer")).toBeHidden();
    await expect(page.locator("#setup")).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/is-running/);
  });

  test("nummervelden gebruiken iOS cijferpad-attributen", async ({ page }) => {
    for (const selector of [".segment-sets", ".segment-duration", ".segment-rest"]) {
      const input = page.locator(selector);
      await expect(input).toHaveAttribute("type", "text");
      await expect(input).toHaveAttribute("inputmode", "numeric");
      await expect(input).toHaveAttribute("pattern", "[0-9]*");
      await expect(input).toHaveAttribute("autocomplete", "off");
    }
  });

  test("programma- en oefeningvelden zijn geen contact-autofill", async ({ page }) => {
    const program = page.locator("#program-name");
    await expect(program).toHaveAttribute("name", "program");
    await expect(program).toHaveAttribute("autocomplete", "off");
    await expect(program).toHaveAttribute("autocorrect", "off");
    await expect(program).toHaveAttribute("spellcheck", "false");

    const exercise = page.locator(".segment-name");
    await expect(exercise).toHaveAttribute("autocomplete", "off");
    await expect(exercise).toHaveAttribute("autocorrect", "off");
    await expect(exercise).toHaveAttribute("spellcheck", "false");
    await expect(page.locator("#name")).toHaveCount(0);
    await expect(page.locator('[name="name"]')).toHaveCount(0);
  });

  test("nummervelden filteren niet-cijfers", async ({ page }) => {
    await page.fill(".segment-sets", "12abc");
    await expect(page.locator(".segment-sets")).toHaveValue("12");

    await page.fill(".segment-duration", "45x");
    await expect(page.locator(".segment-duration")).toHaveValue("45");

    await page.fill(".segment-rest", "1o0");
    await expect(page.locator(".segment-rest")).toHaveValue("10");
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

  test("exporteert opgeslagen programma’s als JSON", async ({ page }) => {
    await page.fill("#program-name", "Export dag");
    await page.fill(".segment-name", "Lunges");
    await page.fill(".segment-sets", "3");
    await page.fill(".segment-duration", "30");
    await page.fill(".segment-rest", "10");
    await page.click("#save-btn");

    const downloadPromise = page.waitForEvent("download");
    await page.click("#export-btn");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/fitnesshelp-programmas-.*\.json/);

    const path = await download.path();
    expect(path).toBeTruthy();
    const fs = require("fs");
    const payload = JSON.parse(fs.readFileSync(path, "utf8"));
    expect(payload).toMatchObject({
      version: 1,
      app: "fitnesshelp",
    });
    expect(payload.programs).toHaveLength(1);
    expect(payload.programs[0]).toMatchObject({
      name: "Export dag",
      items: [{ type: "timer", name: "Lunges", sets: 3, duration: 30, rest: 10 }],
    });
    await expect(page.locator("#transfer-status")).toHaveText("1 programma geëxporteerd.");
  });

  test("importeert programma’s uit JSON en merged op naam", async ({ page }) => {
    await page.fill("#program-name", "Bestaand");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "20");
    await page.fill(".segment-rest", "5");
    await page.click("#save-btn");

    const payload = {
      version: 1,
      app: "fitnesshelp",
      programs: [
        {
          id: "import_new",
          name: "Import nieuw",
          items: [{ type: "reps", name: "Curl", sets: 4, reps: 12 }],
        },
        {
          id: "import_replace",
          name: "Bestaand",
          items: [{ type: "timer", name: "Burpees", sets: 5, duration: 40, rest: 15 }],
        },
      ],
    };

    await page.setInputFiles("#import-file", {
      name: "import.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(payload)),
    });

    await expect(page.locator("#transfer-status")).toHaveText("2 programma’s geïmporteerd.");
    await expect(page.locator("#saved-list .saved-item")).toHaveCount(2);
    await expect(page.locator("#saved-list")).toContainText("Import nieuw");
    await expect(page.locator("#saved-list")).toContainText("Curl");
    await expect(page.locator("#saved-list")).toContainText("Bestaand");
    await expect(page.locator("#saved-list")).toContainText("Burpees");
    await expect(page.locator("#saved-list")).not.toContainText("Plank");

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]")
    );
    expect(stored).toHaveLength(2);
    const replaced = stored.find((p) => p.name === "Bestaand");
    expect(replaced.items[0]).toMatchObject({
      type: "timer",
      name: "Burpees",
      sets: 5,
      duration: 40,
      rest: 15,
    });
  });

  test("toont fout bij ongeldige import", async ({ page }) => {
    await page.setInputFiles("#import-file", {
      name: "kapot.json",
      mimeType: "application/json",
      buffer: Buffer.from("{ niet-json"),
    });
    await expect(page.locator("#transfer-status")).toHaveText("Ongeldig JSON-bestand.");
    await expect(page.locator("#transfer-status")).toHaveAttribute("data-tone", "error");
  });
});
