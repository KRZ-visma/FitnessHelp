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

/** Slaat het formulier op en start het volgende open programma vanaf home. */
async function saveAndStart(page) {
  await page.click("#save-btn");
  await expect(page.locator("#home")).toBeVisible();
  await page.click("#home-start-btn");
}

module.exports = { openManage, clearAndReload, saveAndStart };
