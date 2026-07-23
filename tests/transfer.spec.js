const { test, expect } = require("@playwright/test");
const { clearAndReload, openManage } = require("./helpers");

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

  test("exporteert opgeslagen programma’s als JSON", async ({ page }) => {
    await page.fill("#program-name", "Export dag");
    await page.fill("#program-rest", "10");
    await page.fill(".segment-name", "Lunges");
    await page.fill(".segment-sets", "3");
    await page.fill(".segment-duration", "30");
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
      rest: 10,
      switch: 15,
      items: [{ type: "timer", name: "Lunges", sets: 3, duration: 30, rest: 10 }],
    });
    await expect(page.locator("#transfer-status")).toHaveText("1 programma geëxporteerd.");
  });

  test("importeert programma’s uit JSON en merged op naam", async ({ page }) => {
    await page.fill("#program-name", "Bestaand");
    await page.fill("#program-rest", "5");
    await page.fill(".segment-name", "Plank");
    await page.fill(".segment-sets", "2");
    await page.fill(".segment-duration", "20");
    await page.click("#save-btn");

    await openManage(page);

    const payload = {
      version: 1,
      app: "fitnesshelp",
      programs: [
        {
          id: "import_new",
          name: "Import nieuw",
          rest: 12,
          switch: 8,
          items: [{ type: "reps", name: "Curl", sets: 4, reps: 12 }],
        },
        {
          id: "import_replace",
          name: "Bestaand",
          rest: 15,
          switch: 6,
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
    expect(replaced).toMatchObject({ rest: 15, switch: 6 });
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
