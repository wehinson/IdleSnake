const { test, expect } = require("@playwright/test");

test("development shortcuts require explicit loopback opt-in", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const before = await page.locator("#seedsTotal").textContent();
  await page.keyboard.press("Shift+G");
  await expect(page.locator("#seedsTotal")).toHaveText(before);
  await page.goto("/?dev=1", { waitUntil: "networkidle" });
  await page.keyboard.press("Shift+G");
  await expect(page.locator("#seedsTotal")).not.toHaveText("0.00");
});

test("development shortcuts add eggs and hatchlings only while space is available", async ({ page }) => {
  await page.goto("/?dev=1", { waitUntil: "networkidle" });

  await page.keyboard.press("Shift+J");
  // Hidden panels refresh when opened; the shortcut still changes engine state.
  await page.locator('[data-menu-tab="nursery"]').click();
  await expect(page.locator("#nestTimer")).not.toHaveText("Ready for an egg");
  await page.keyboard.press("Shift+J");
  await expect(page.locator("#screenHint")).toHaveText("No nest space available");

  await page.keyboard.press("Shift+K");
  await page.keyboard.press("Shift+K");
  await expect(page.locator("#nurseryCapacity")).toHaveText("2 / 2");
  await page.keyboard.press("Shift+K");
  await expect(page.locator("#screenHint")).toHaveText("No nursery space available");
});
