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
