const { test, expect } = require("@playwright/test");
const { clearAndReload } = require("./helpers");

test.describe("PWA", () => {
  test.beforeEach(async ({ page }) => {
    await clearAndReload(page);
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
    expect(swSource).toMatch(/fitnesshelp-static-v8/);
    expect(swSource).toMatch(/fetch\(request\)/);
    expect(swSource).toMatch(/caches\.match\(request\)/);
  });

  test("levert PWA-icons", async ({ page }) => {
    for (const path of ["/icons/icon-192.png", "/icons/icon-512.png"]) {
      const res = await page.request.get(path);
      expect(res.ok()).toBeTruthy();
      expect(res.headers()["content-type"] || "").toMatch(/image\/png/i);
    }
  });
});
