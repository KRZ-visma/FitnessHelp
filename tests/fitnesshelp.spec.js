const { test, expect } = require("@playwright/test");

async function openManage(page) {
  const manageBtn = page.locator("#manage-btn");
  if (await manageBtn.isVisible()) {
    await manageBtn.click();
  }
  await expect(page.locator("#manage")).toBeVisible();
}

test.describe("FitnessHelp", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("toont de pagina met merk en programmaformulier", async ({ page }) => {
    await expect(page).toHaveTitle(/FitnessHelp/i);
    await expect(page.locator(".brand")).toHaveText("FitnessHelp");
    await expect(page.locator("#home")).toBeHidden();
    await expect(page.locator("#manage")).toBeVisible();
    await expect(page.locator("#manage-header")).toBeHidden();
    await expect(page.locator("#program-name")).toBeVisible();
    await expect(page.locator(".segment")).toHaveCount(1);
    await expect(page.locator(".segment-name")).toBeVisible();
    await expect(page.locator(".segment-sets")).toBeVisible();
    await expect(page.locator(".segment-duration")).toBeVisible();
    await expect(page.locator(".segment-rest")).toBeVisible();
    await expect(page.locator("#start-btn")).toBeVisible();
    await expect(page.locator("#add-segment-btn")).toBeVisible();
  });

  test("start met 5 seconden klaarmaken vóór de set", async ({ page }) => {
    await page.fill("#program-name", "Been dag");
    await page.fill(".segment-name", "Squats");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "5");
    await page.fill(".segment-rest", "2");
    await page.click("#start-btn");

    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "prep");
    await expect(page.locator("#timer-phase")).toHaveText("Klaar maken");
    await expect(page.locator("#timer-name")).toHaveText("Squats");
    await expect(page.locator("#timer-clock")).toHaveText("0:05");
    await expect(page.locator("body")).toHaveClass(/is-running/);

    await page.click("#skip-btn");
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "work");
    await expect(page.locator("#timer-phase")).toContainText("Set 1");
  });

  test("start de timer met sets en duur", async ({ page }) => {
    await page.fill("#program-name", "Been dag");
    await page.fill(".segment-name", "Squats");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "5");
    await page.fill(".segment-rest", "2");
    await page.click("#start-btn");
    await page.click("#skip-btn");

    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer-name")).toHaveText("Squats");
    await expect(page.locator("#timer-phase")).toContainText("Set 1");
    await expect(page.locator("body")).toHaveClass(/is-running/);
  });

  test("slaat programma op als favoriet en toont home", async ({ page }) => {
    await page.fill("#program-name", "Push dag");
    await page.fill(".segment-name", "Push-ups");
    await page.fill(".segment-sets", "4");
    await page.fill(".segment-duration", "40");
    await page.fill(".segment-rest", "20");
    await page.click("#save-btn");

    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#home-title")).toHaveText("Push dag");
    await expect(page.locator("#home-meta")).toContainText("Push-ups");
    await expect(page.locator("#manage")).toBeHidden();
    await expect(page.locator("#tagline")).toContainText("favoriet");

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

    const favoriteId = await page.evaluate(() =>
      localStorage.getItem("fitnesshelp-favorite-v1")
    );
    expect(favoriteId).toBe(stored[0].id);

    await openManage(page);
    await expect(page.locator("#saved-list .saved-item")).toHaveCount(1);
    await expect(page.locator("#saved-list")).toContainText("Push dag");
    await expect(page.locator("#saved-list")).toContainText("Favoriet");
    await expect(
      page.locator("#saved-list .saved-item").locator("button", { hasText: "Favoriet" })
    ).toHaveCount(0);
    await expect(page.locator(".segment-foot")).toHaveCount(0);
    await expect(page.locator("body")).toHaveClass(/is-managing/);
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

    await openManage(page);
    await page.click("#start-btn");
    await page.click("#skip-btn");
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

    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "prep");
    await page.click("#skip-btn");

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

  test("start favoriet vanaf home", async ({ page }) => {
    await page.fill("#program-name", "Core");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "3");
    await page.fill(".segment-duration", "30");
    await page.fill(".segment-rest", "10");
    await page.click("#save-btn");

    await page.click("#home-start-btn");
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "prep");
    await page.click("#skip-btn");
    await expect(page.locator("#timer")).toBeVisible();
    await expect(page.locator("#timer-name")).toHaveText("Plank");
  });

  test("kan favoriet wisselen tussen programma’s", async ({ page }) => {
    await page.fill("#program-name", "Push");
    await page.fill(".segment-name", "Push-ups");
    await page.click("#save-btn");

    await openManage(page);
    await page.fill("#program-name", "Pull");
    await page.fill(".segment-name", "Rows");
    await page.click("#save-btn");

    await expect(page.locator("#home-title")).toHaveText("Push");
    await openManage(page);
    await expect(page.locator("#saved-list .saved-item")).toHaveCount(2);

    await page
      .locator("#saved-list .saved-item", { hasText: "Pull" })
      .locator("button", { hasText: "Maak favoriet" })
      .click();

    await page.click("#manage-done-btn");
    await expect(page.locator("#home-title")).toHaveText("Pull");
    await expect(page.locator("#home-meta")).toContainText("Rows");
  });

  test("programma-naam toont autocomplete van opgeslagen namen", async ({ page }) => {
    await page.fill("#program-name", "Push dag");
    await page.fill(".segment-name", "Push-ups");
    await page.click("#save-btn");

    await openManage(page);
    const program = page.locator("#program-name");
    await expect(program).toHaveAttribute("list", "program-name-suggestions");
    await expect(page.locator("#program-name-suggestions option")).toHaveCount(1);
    await expect(page.locator("#program-name-suggestions option")).toHaveAttribute(
      "value",
      "Push dag"
    );
  });

  test("vraagt screen wake lock tijdens training", async ({ page }) => {
    await page.addInitScript(() => {
      window.__wakeLockRequested = false;
      const sentinel = {
        released: false,
        release: async function release() {
          this.released = true;
          return undefined;
        },
        addEventListener: () => {},
      };
      const fakeWakeLock = {
        request: async () => {
          window.__wakeLockRequested = true;
          return sentinel;
        },
      };
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        enumerable: true,
        get: () => fakeWakeLock,
      });
    });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.fill("#program-name", "HIIT");
    await page.fill(".segment-name", "Burpees");
    await page.fill(".segment-sets", "1");
    await page.fill(".segment-duration", "8");
    await page.fill(".segment-rest", "0");
    await page.click("#start-btn");

    await expect
      .poll(async () => page.evaluate(() => Boolean(window.__wakeLockRequested)))
      .toBe(true);
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
    await expect(page.locator("#home-title")).toHaveText("Mijn training");
    await expect(page.locator("#home-meta")).toContainText("2 onderdelen");
    await expect(page.locator("#manage")).toBeHidden();

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

    await openManage(page);
    await expect(page.locator("#saved-list .saved-item")).toHaveCount(1);
    await expect(page.locator("#saved-list")).toContainText("Mijn training");
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
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "prep");

    await page.click("#stop-btn");
    await expect(page.locator("#timer")).toBeHidden();
    await expect(page.locator("#setup")).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/is-running/);
  });

  test("na stop met favoriet terug naar home", async ({ page }) => {
    await page.fill("#program-name", "Core");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "10");
    await page.fill(".segment-rest", "5");
    await page.click("#save-btn");
    await page.click("#home-start-btn");
    await page.click("#stop-btn");

    await expect(page.locator("#timer")).toBeHidden();
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#manage")).toBeHidden();
    await expect(page.locator("body")).not.toHaveClass(/is-running/);
  });

  test("speelt start- en stopgeluid bij onderdelen", async ({ page }) => {
    await page.fill("#program-name", "Geluid");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "1");
    await page.fill(".segment-duration", "5");
    await page.fill(".segment-rest", "0");
    await page.click("#add-segment-btn");
    const second = page.locator(".segment").nth(1);
    await second.locator(".segment-type").selectOption("reps");
    await second.locator(".segment-name").fill("Squats");
    await second.locator(".segment-sets").fill("1");
    await second.locator(".segment-reps").fill("5");

    await page.click("#start-btn");
    await page.evaluate(() => {
      window.__fitnessHelpBeeps.length = 0;
    });
    await page.click("#skip-btn");

    await expect.poll(() => page.evaluate(() => window.__fitnessHelpBeeps)).toEqual(["start"]);
    await expect(page.locator("#timer-name")).toHaveText("Plank");

    await page.click("#skip-btn");
    await expect.poll(() => page.evaluate(() => window.__fitnessHelpBeeps)).toEqual([
      "start",
      "stop",
    ]);
    await expect(page.locator("#timer")).toHaveAttribute("data-phase", "prep");
    await expect(page.locator("#timer-name")).toHaveText("Squats");

    await page.click("#skip-btn");
    await expect.poll(() => page.evaluate(() => window.__fitnessHelpBeeps)).toEqual([
      "start",
      "stop",
      "start",
    ]);

    await page.click("#stop-btn");
    await expect.poll(() => page.evaluate(() => window.__fitnessHelpBeeps)).toEqual([
      "start",
      "stop",
      "start",
      "stop",
    ]);
  });

  test("zet iOS audiosessie op playback bij start (stil-schakelaar)", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "audioSession", {
        configurable: true,
        value: { type: "auto" },
      });
    });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.fill("#program-name", "Stil");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "1");
    await page.fill(".segment-duration", "5");
    await page.fill(".segment-rest", "0");
    await page.click("#start-btn");

    await expect
      .poll(() => page.evaluate(() => window.__fitnessHelpAudioSessionType))
      .toBe("playback");

    await page.click("#skip-btn");
    await expect
      .poll(() => page.evaluate(() => window.__fitnessHelpAudioSessionType))
      .toBe("playback");
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
    await expect(program).toHaveAttribute("name", "fh-program");
    await expect(program).toHaveAttribute("autocomplete", "fh-program");
    await expect(program).toHaveAttribute("autocorrect", "off");
    await expect(program).toHaveAttribute("spellcheck", "false");
    await expect(program).toHaveAttribute("list", "program-name-suggestions");

    const exercise = page.locator(".segment-name");
    await expect(exercise).toHaveAttribute("autocomplete", "fh-exercise");
    await expect(exercise).toHaveAttribute("name", "fh-exercise-0");
    await expect(exercise).toHaveAttribute("autocorrect", "off");
    await expect(exercise).toHaveAttribute("spellcheck", "false");
    await expect(page.locator("#name")).toHaveCount(0);
    await expect(page.locator('[name="name"]')).toHaveCount(0);
    await expect(page.locator('[name="program"]')).toHaveCount(0);
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

  test("service worker gebruikt network-first cache-versie", async ({ page }) => {
    const swSource = await page.evaluate(async () => {
      const res = await fetch("./sw.js", { cache: "no-store" });
      return res.text();
    });
    expect(swSource).toMatch(/fitnesshelp-static-v2/);
    expect(swSource).toMatch(/fetch\(request\)/);
    expect(swSource).toMatch(/caches\.match\(request\)/);
  });

  test("toont export- en importknoppen bij Opgeslagen", async ({ page }) => {
    await expect(page.locator("#export-btn")).toBeVisible();
    await expect(page.locator("#export-btn")).toHaveText("Exporteren");
    await expect(page.locator("#import-btn")).toBeVisible();
    await expect(page.locator("#import-btn")).toHaveText("Importeren");
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

    await openManage(page);
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

    await openManage(page);

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
