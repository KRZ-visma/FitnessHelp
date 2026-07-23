const { test, expect } = require("@playwright/test");
const { clearAndReload, createProgram, openManage } = require("./helpers");

test.describe("Import / export", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
  });

  test("toont export- en importknoppen bij Opgeslagen", async ({ page }) => {
    await expect(page.locator("#export-btn")).toBeVisible();
    await expect(page.locator("#export-btn")).toHaveText("Exporteren");
    await expect(page.locator("#import-btn")).toBeVisible();
    await expect(page.locator("#import-btn")).toHaveText("Importeren");
  });

  test("exporteert programma’s, oefeningen en dagvolgorde als JSON", async ({ page }) => {
    await createProgram(page, {
      programName: "Export dag",
      rest: 10,
      exercises: [{ name: "Lunges", sets: 3, duration: 30 }],
    });

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
      version: 2,
      app: "fitnesshelp",
    });
    expect(payload.programs).toHaveLength(1);
    expect(payload.exercises).toHaveLength(1);
    expect(payload.programIds).toEqual([payload.programs[0].id]);
    expect(payload.programs[0]).toMatchObject({
      name: "Export dag",
      rest: 10,
      switch: 15,
    });
    expect(payload.programs[0].items[0]).toHaveProperty("exerciseId");
    expect(payload.exercises[0]).toMatchObject({
      name: "Lunges",
      type: "timer",
      sets: 3,
      duration: 30,
    });
    await expect(page.locator("#transfer-status")).toHaveText("1 programma geëxporteerd.");
  });

  test("importeert programma’s uit JSON en merged op naam", async ({ page }) => {
    await createProgram(page, {
      programName: "Bestaand",
      rest: 5,
      exercises: [{ name: "Plank", sets: 2, duration: 20 }],
    });

    await openManage(page);

    const payload = {
      version: 2,
      app: "fitnesshelp",
      exercises: [
        {
          id: "ex_curl",
          name: "Curl",
          type: "reps",
          sets: 4,
          reps: 12,
        },
        {
          id: "ex_burpees",
          name: "Burpees",
          type: "timer",
          sets: 5,
          duration: 40,
        },
      ],
      programs: [
        {
          id: "import_new",
          name: "Import nieuw",
          rest: 12,
          switch: 8,
          items: [{ exerciseId: "ex_curl" }],
        },
        {
          id: "import_replace",
          name: "Bestaand",
          rest: 15,
          switch: 6,
          items: [{ exerciseId: "ex_burpees" }],
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

    const stored = await page.evaluate(() => ({
      programs: JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]"),
      exercises: JSON.parse(localStorage.getItem("fitnesshelp-exercises-v1") || "[]"),
    }));
    expect(stored.programs).toHaveLength(2);
    const replaced = stored.programs.find((p) => p.name === "Bestaand");
    expect(replaced.items[0]).toMatchObject({ exerciseId: "ex_burpees" });
    expect(replaced).toMatchObject({ rest: 15, switch: 6 });
    expect(stored.exercises.some((ex) => ex.name === "Burpees")).toBe(true);
  });

  test("importeert legacy inline items naar bibliotheek-refs", async ({ page }) => {
    await openManage(page);
    const payload = {
      version: 1,
      app: "fitnesshelp",
      programs: [
        {
          id: "legacy_import",
          name: "Oud import",
          rest: 10,
          switch: 5,
          items: [{ type: "timer", name: "Burpees", sets: 3, duration: 40, rest: 10 }],
        },
      ],
    };

    await page.setInputFiles("#import-file", {
      name: "legacy.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(payload)),
    });

    await expect(page.locator("#transfer-status")).toHaveText("1 programma geïmporteerd.");
    await expect(page.locator("#saved-list")).toContainText("Burpees");

    const stored = await page.evaluate(() => ({
      programs: JSON.parse(localStorage.getItem("fitnesshelp-workouts-v1") || "[]"),
      exercises: JSON.parse(localStorage.getItem("fitnesshelp-exercises-v1") || "[]"),
    }));
    expect(stored.programs[0].items[0]).toHaveProperty("exerciseId");
    expect(stored.exercises[0]).toMatchObject({
      name: "Burpees",
      type: "timer",
      sets: 3,
      duration: 40,
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

  test("vult ontbrekende rust/wissel bij oude programma’s", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        "fitnesshelp-workouts-v1",
        JSON.stringify([
          {
            id: "old_prog",
            name: "Oud schema",
            items: [{ type: "timer", name: "Plank", sets: 2, duration: 30, rest: 22 }],
          },
        ])
      );
    });
    await page.reload();

    await openManage(page);
    await page.locator("#saved-list button", { hasText: "Laden" }).click();
    await expect(page.locator("#program-rest")).toHaveValue("22");
    await expect(page.locator("#program-switch")).toHaveValue("15");
    await expect(page.locator(".segment-name")).toHaveText("Plank");
  });
});
