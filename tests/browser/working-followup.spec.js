const { test, expect } = require("@playwright/test");

test("reload after the death effect opens a fresh Ready board", async ({ page }) => {
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => {
    presentGameResult(dispatchSession({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 5, rows: 8 }, tickMs: 200, direction: "up",
      snake: [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }]
    } }));
    presentGameResult(dispatchSession({ type: "begin" }));
  });
  await expect(page.locator("#stateText")).toHaveText("Game Over");
  await page.waitForTimeout(1800);
  await page.evaluate(() => { persistConsolidatedSave(); flushPendingSaves(); });
  await page.reload();
  await expect(page.locator("#stateText")).toHaveText("Ready");
  await expect(page.locator("#overlay")).toContainText("Ready");
  expect(await page.evaluate(() => session.snapshot().active.snake.length)).toBe(3);
  expect(errors).toEqual([]);
});

test("Space exits settings even when a setting has keyboard focus", async ({ page }) => {
  await page.goto("/");
  const settings = page.locator('[data-minigame="0"]');
  await settings.click();
  await expect(page.locator("#personalizationScreen")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.locator("#personalizationScreen")).toBeHidden();
  await expect(page.locator("#stateText")).toHaveText("Ready");
  await settings.click();
  const speed = await page.evaluate(() => session.snapshot().snakeSpeed);
  await page.locator('[data-snake-speed="rabbit"]').focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#personalizationScreen")).toBeHidden();
  expect(await page.evaluate(() => session.snapshot().snakeSpeed)).toBe(speed);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await settings.click();
  await page.keyboard.press("Space");
  await expect(page.locator("#personalizationScreen")).toBeHidden();
  expect(await page.evaluate(() => session.snapshot().phase)).toBe("running");
});

test("number buttons have no focus outline after click, Tab, or Space", async ({ page }) => {
  await page.goto("/");
  const key = page.locator('[data-minigame="0"]');
  await key.click();
  expect(await key.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
  await page.keyboard.press("Space");
  expect(await key.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
  await page.keyboard.press("Tab");
  await key.focus();
  expect(await key.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
  await page.evaluate(() => {
    dispatchSession({ type: "addSeeds", amount: 1e6 });
    dispatchSession({ type: "buyUpgrade", upgrade: "minigames" }); syncPanels();
  });
  const one = page.locator('[data-minigame="1"]'); await one.click();
  await page.keyboard.press("Space");
  expect(await one.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
  expect(await page.evaluate(() => document.activeElement.matches(".phone-key"))).toBe(false);
});

test("Length Bonus displays beside Seeds, updates on purchase, and hides on pause and death", async ({ page }) => {
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  // Keep the fixture still while exercising real buttons and their display.
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto("/");
  await page.evaluate(() => {
    session = IdleSnakeSession.createGameSession({ now: Date.now(), rng: () => 0.5,
      save: { savedAt: Date.now(), currencies: { seeds: 10000 }, habitats: { counts: [25] } } });
    presentGameResult(dispatchSession({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 20 }, direction: "right", tickMs: 10000,
      snake: Array.from({ length: 15 }, (_, i) => ({ x: 15 - i, y: 10 }))
    } }));
    syncPanels(); syncHud(); idleLastWallAt = Date.now();
  });
  await expect(page.locator("#lengthBonusSummary")).toBeHidden();
  await expect(page.locator("#lengthBonusName")).toHaveText("1% per segment");
  await expect(page.locator("#lengthBonusButton")).toHaveText("Buy 500");
  await expect(page.locator("#seedIncomePerSecond")).toHaveText("+0.1375/s");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator("#lengthBonusMultiplier")).toHaveText("1.15×");
  await expect(page.locator("#lengthBonusSummary")).toBeVisible();
  await expect(page.locator("#seedIncomePerSecond")).toHaveText("+0.1581/s");
  await page.screenshot({ path: "test-results/length-bonus-desktop.png", fullPage: true });
  await page.locator("#lengthBonusButton").click();
  await expect(page.locator("#lengthBonusName")).toHaveText("6% per segment");
  await expect(page.locator("#lengthBonusNext")).toHaveText("Next: 11% per segment");
  await expect(page.locator("#lengthBonusMultiplier")).toHaveText("1.90×");
  await expect(page.locator("#seedIncomePerSecond")).toHaveText("+0.2612/s");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#lengthBonusSummary")).toBeHidden();
  await expect(page.locator("#seedIncomePerSecond")).toHaveText("+0.1375/s");
  await page.keyboard.press("Space");
  await expect(page.locator("#lengthBonusSummary")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/length-bonus-phone.png", fullPage: true });
  const bounds = await page.locator("#lengthBonusSummary").boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.evaluate(() => { const result = session.tick(100000); acceptSnapshot(result.snapshot); presentGameResult(result); });
  await expect(page.locator("#lengthBonusSummary")).toBeHidden();
  expect(errors).toEqual([]);
});
