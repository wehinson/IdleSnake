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
  await expect(page.locator(".habitat-card").filter({ hasText: "Lake" }).locator(".habitat-output-types"))
    .toHaveText("Effect: -1 sec incubation per active snake");
  await expect(page.locator(".habitat-card").filter({ hasText: "Forest" }).locator(".habitat-output-types"))
    .toHaveText("Produces: Seeds + Branches");
  await expect(page.locator(".habitat-card").filter({ hasText: "River" }).locator(".habitat-output-types"))
    .toHaveText("Produces: Seeds + Provisions");
  await expect(page.locator("#nurseryEggProgressText")).toHaveText("0 / 500");
  await expect(page.locator("#nurserySeedStatus")).toHaveText("500 provisions to next egg");
});

test("grown nursery snakes use a pointed final tail segment", async ({ page }) => {
  const save = {
    saveVersion: 2,
    savedAt: Date.now(),
    nursery: { hatchlings: [
      { id: "one", x: 2, y: 2, direction: "right", progressMs: 0, temporary: false },
      { id: "two", x: 6, y: 5, direction: "right", progressMs: 2 * 60 * 1000, tailWiggle: true, temporary: false },
      { id: "three", x: 9, y: 10, direction: "down", progressMs: 7 * 60 * 1000, temporary: true }
    ] }
  };
  await page.addInitScript((fixture) => localStorage.setItem("snake-forever-save", JSON.stringify(fixture)), save);
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto("/", { waitUntil: "networkidle" });
  const parts = await page.evaluate(() => {
    cancelAnimationFrame(animationId);
    renderNurseryGrid();
    const cell = (x, y) => document.querySelector(`.nursery-cell[data-x="${x}"][data-y="${y}"]`);
    return {
      oneHead: cell(2, 2).className,
      twoHead: cell(6, 5).className,
      twoTail: cell(5, 5).className,
      twoTailShape: getComputedStyle(cell(5, 5), "::after").clipPath,
      threeHead: cell(9, 10).className,
      threeBody: cell(9, 9).className,
      threeTail: cell(9, 8).className,
      threeTailShape: getComputedStyle(cell(9, 8), "::after").clipPath
    };
  });

  expect(parts.oneHead).toContain("is-head");
  expect(parts.twoHead).toContain("is-head");
  expect(parts.twoTail).toContain("is-tail tail-left");
  expect(parts.twoTail).toContain("is-wiggling");
  expect(parts.twoTailShape).not.toBe("none");
  expect(parts.threeHead).toContain("is-head");
  expect(parts.threeBody).toContain("is-body");
  expect(parts.threeTail).toContain("is-tail tail-up");
  expect(parts.threeTailShape).not.toBe("none");
});
