const { test, expect } = require("@playwright/test");

const viewports = [
  { width: 360, height: 740, single: true }, { width: 390, height: 844, single: true },
  { width: 430, height: 800, single: true }, { width: 500, height: 800, single: true },
  { width: 600, height: 800, single: true }, { width: 640, height: 800, single: true },
  { width: 641, height: 800, single: false }, { width: 1024, height: 600, single: false }, { width: 1280, height: 720, single: false }
];

for (const viewport of viewports) test(`layout fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
  await page.setViewportSize(viewport);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".phone-shell")).toBeVisible(); await expect(page.locator(".menu-panel")).toBeVisible();
  await expect(page.locator("#game")).toBeVisible(); await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const order = await page.locator(".app-layout").evaluate((layout) => {
    const phone = layout.querySelector(".phone-shell").getBoundingClientRect(); const menu = layout.querySelector(".menu-panel").getBoundingClientRect();
    return { phone, menu };
  });
  if (viewport.single) expect(order.phone.top).toBeLessThan(order.menu.top); else expect(Math.abs(order.phone.left - order.menu.left)).toBeGreaterThan(50);
  if (viewport.width === 1024) expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);
  expect(errors).toEqual([]);
});
