const { test, expect } = require("@playwright/test");

test("loads and supports the basic game controls without browser errors", async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("complementary", { name: "Menu" })).toBeVisible();
  await expect(page.locator("#game")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Ready");
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("builds upgrade, board, nursery, and habitat UI from shared configuration", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const shared = await page.evaluate(() => ({
    boardLevels: window.IdleSnakeConfig.upgradeConfig.board.levels,
    boardCost: window.IdleSnakeConfig.upgradeConfig.board.baseCost,
    habitatCount: window.IdleSnakeConfig.habitatConfig.habitats.length,
    nurseryCells: window.IdleSnakeConfig.nurseryConfig.columns * window.IdleSnakeConfig.nurseryConfig.rows
  }));
  await expect(page.locator("#boardSizeSelect option")).toHaveCount(1);
  await expect(page.locator("#boardSizeSelect option")).toHaveText(shared.boardLevels[0]);
  await expect(page.locator("#boardUpgradeButton")).toContainText(String(shared.boardCost));
  await expect(page.locator(".nursery-cell")).toHaveCount(shared.nurseryCells);
  await expect(page.locator(".habitat-card")).toHaveCount(shared.habitatCount);
});
