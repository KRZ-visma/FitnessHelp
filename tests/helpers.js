const { expect } = require("@playwright/test");

async function openManage(page) {
  const manageBtn = page.locator("#manage-btn");
  if (await manageBtn.isVisible()) {
    await manageBtn.click();
  }
  await expect(page.locator("#manage")).toBeVisible();
}

async function clearAndReload(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function openExercisesTab(page) {
  await openManage(page);
  await page.click("#manage-tab-exercises");
  await expect(page.locator("#manage-panel-exercises")).toBeVisible();
}

async function openProgramsTab(page) {
  await openManage(page);
  await page.click("#manage-tab-programs");
  await expect(page.locator("#manage-panel-programs")).toBeVisible();
}

async function openTransferTab(page) {
  await openManage(page);
  await page.click("#manage-tab-transfer");
  await expect(page.locator("#manage-panel-transfer")).toBeVisible();
}

/** Opent het programmaformulier (nieuw). */
async function openProgramForm(page) {
  await openProgramsTab(page);
  const setup = page.locator("#setup");
  if (await setup.isHidden()) {
    await page.click("#add-program-btn");
  }
  await expect(setup).toBeVisible();
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ name: string, type?: 'timer'|'reps', sets?: number, duration?: number, reps?: number }} opts
 */
async function createExercise(page, opts) {
  const { name, type = "timer", sets = 3, duration = 45, reps = 10 } = opts;
  await openExercisesTab(page);
  await page.click("#add-exercise-btn");
  await expect(page.locator(".modal-overlay")).toBeVisible();
  await page.locator(".modal-content input[type='text']").first().fill(name);
  await page.selectOption(".modal-content select", type);
  const inputs = page.locator(".modal-content .field-row input[type='text']");
  await inputs.nth(0).fill(String(sets));
  await inputs.nth(1).fill(String(type === "timer" ? duration : reps));
  await page.click(".modal-content .btn-primary");
  await expect(page.locator(".modal-overlay")).toHaveCount(0);
}

/**
 * Voegt een bibliotheek-oefening toe aan het open programmaformulier.
 * @param {import('@playwright/test').Page} page
 * @param {string} exerciseName
 */
async function addExerciseToProgram(page, exerciseName) {
  await openProgramForm(page);
  await page.click("#add-segment-btn");
  await expect(page.locator(".modal-overlay")).toBeVisible();
  await page
    .locator(".picker-item", { hasText: exerciseName })
    .locator("button", { hasText: "Toevoegen" })
    .click();
  await expect(page.locator(".modal-overlay")).toHaveCount(0);
}

/**
 * Maakt oefening(en), vult programma en slaat op.
 * @param {import('@playwright/test').Page} page
 * @param {{
 *   programName: string,
 *   rest?: number,
 *   switchSec?: number,
 *   times?: number,
 *   exercises: Array<{ name: string, type?: 'timer'|'reps', sets?: number, duration?: number, reps?: number }>
 * }} opts
 */
async function createProgram(page, opts) {
  const { programName, rest = 15, switchSec = 15, times = 1, exercises } = opts;
  for (const exercise of exercises) {
    await createExercise(page, exercise);
  }
  await openProgramForm(page);
  await page.fill("#program-name", programName);
  await page.fill("#program-rest", String(rest));
  await page.fill("#program-switch", String(switchSec));
  await page.fill("#program-times", String(times));
  for (const exercise of exercises) {
    await addExerciseToProgram(page, exercise.name);
  }
  await page.click("#save-btn");
  await expect(page.locator("#manage")).toBeVisible();
  await expect(page.locator("#setup")).toBeHidden();
  await page.click("#manage-done-btn");
  await expect(page.locator("#home")).toBeVisible();
}

/** Start het eerste open programma vanaf home (per-programma Start-knop). */
async function startFromHome(page, programName) {
  const item = programName
    ? page.locator("#day-list .day-item", { hasText: programName })
    : page.locator("#day-list .day-item").filter({ has: page.locator(".day-start") }).first();
  await item.locator(".day-start").click();
}

/** Slaat het formulier op en start het volgende open programma vanaf home. */
async function saveAndStart(page) {
  await page.click("#save-btn");
  await expect(page.locator("#manage")).toBeVisible();
  await page.click("#manage-done-btn");
  await expect(page.locator("#home")).toBeVisible();
  await startFromHome(page);
}

module.exports = {
  openManage,
  clearAndReload,
  openExercisesTab,
  openProgramsTab,
  openTransferTab,
  createExercise,
  addExerciseToProgram,
  createProgram,
  startFromHome,
  saveAndStart,
  openProgramForm,
};
