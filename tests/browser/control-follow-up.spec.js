const { test, expect } = require("@playwright/test");

test("control follow-up covers settings, focus, paused effects, and fullscreen controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("snake-forever-save", JSON.stringify({
    saveVersion: 2, savedAt: Date.now(), upgrades: { boardLevel: 1, minigamesLevel: 1 }
  })));
  await page.goto("/");
  const normalMenu = await page.locator(".menu-panel").boundingBox();
  await page.locator("#fullscreenModeButton").click();
  const expandedMenu = await page.locator(".menu-panel").boundingBox();
  expect(Math.abs(expandedMenu.width / normalMenu.width - 1.25)).toBeLessThan(0.02);
  const start = await page.locator("#startButton").boundingBox();
  const games = await page.locator("#fullscreenMinigamesButton").boundingBox();
  const phone = await page.locator("#phoneModeButton").boundingBox();
  expect(start.x + start.width).toBeLessThan(games.x);
  expect(games.x + games.width).toBeLessThan(phone.x);
  expect(Math.abs(start.y - games.y)).toBeLessThan(1);
  expect(Math.abs(phone.y - games.y)).toBeLessThan(1);
  expect(await page.locator(".controls").evaluate((el) => getComputedStyle(el).transform)).toBe("matrix(1, 0, 0, 1, 0, -10)");
  await page.locator("#fullscreenMinigamesButton").click();
  const choices = page.locator("#fullscreenMinigameMenu button");
  await expect(choices).toHaveText(["Vs Snake", "Snake Forever", "Brick Breakout", "Snakeger", "Snakebird", "Sokoban", "Broodline", "Venom Strike", "Centipede"]);
  await expect(choices.first()).toBeEnabled();
  await expect(choices.nth(1)).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath("named-minigames.png") });
  await choices.first().click();
  expect(await page.evaluate(() => session.snapshot().mode)).toBe("duel");
  await expect(page.locator("#fullscreenMinigameMenu")).toBeHidden();

  await page.evaluate(() => {
    presentGameResult(dispatchSession({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 20 }, tickMs: 200,
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }], direction: "right"
    } }));
  });
  await page.locator("#startButton").click();
  await page.keyboard.press("Space");
  expect(await page.evaluate(() => session.snapshot().phase)).toBe("paused");
  await expect(page.locator("#startButton")).not.toBeFocused();
  await expect(page.locator("#pauseButton")).not.toHaveClass(/is-active/);
  const frozen = await page.evaluate(() => {
    digestionAnimations = [{ startedAt: snakeAnimationNow() - digestionSegmentDelay() * 0.4, snakeLength: gameView.snake.length }];
    tailWiggleStartedAt = snakeAnimationNow() - 35;
    return { pulse: digestionPulseForSegment(1, snakeAnimationNow()), wiggle: tailWiggleAmount(), snake: session.snapshot().active.snake };
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => ({ pulse: digestionPulseForSegment(1, snakeAnimationNow()), wiggle: tailWiggleAmount(), snake: session.snapshot().active.snake }))).toEqual(frozen);
  await page.screenshot({ path: test.info().outputPath("paused-effects.png") });
  await page.keyboard.press("ArrowUp");
  expect(await page.evaluate(() => session.snapshot().phase)).toBe("running");
  await expect(page.locator("#overlay")).not.toHaveClass(/visible/);
  await page.evaluate(() => {
    presentGameResult(dispatchSession({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "up",
      snake: [{ x: 10, y: 0 }, { x: 10, y: 1 }, { x: 10, y: 2 }]
    } }));
    presentGameResult(dispatchSession({ type: "begin" }));
    const result = session.tick(400); acceptSnapshot(result.snapshot); interpretSessionEvents(result.events); finishDeathPresentation();
  });
  await expect(page.locator("#overlay")).toContainText("Game Over");
  await page.locator("#fullscreenSettingsButton").click();
  await expect(page.locator("#personalizationScreen")).toBeVisible();
  expect(await page.evaluate(() => session.snapshot().phase)).toBe("gameover");
  await page.screenshot({ path: test.info().outputPath("game-over-settings.png") });
});
