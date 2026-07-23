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

module.exports = { openManage, clearAndReload };
