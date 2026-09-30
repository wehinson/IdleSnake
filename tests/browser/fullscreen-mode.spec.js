const { test, expect } = require("@playwright/test");

async function unlock(page, boardLevel = 6) {
  await page.addInitScript(({ boardLevel }) => {
    localStorage.setItem("snake-forever-save", JSON.stringify({
      saveVersion: 2, savedAt: Date.now(), upgrades: { boardLevel },
      board: { selectedBoardLevel: 6 }
    }));
  }, { boardLevel });
  await page.goto("/", { waitUntil: "networkidle" });
}

test("fullscreen unlock follows the purchased board and expands without resetting play", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await unlock(page, 0);
  const button = page.locator("#fullscreenModeButton");
  await expect(button).toBeHidden();
  await page.evaluate(() => {
    dispatchSession({ type: "addSeeds", amount: 1000000 });
    dispatchSession({ type: "buyUpgrade", upgrade: "board" });
    syncPanels();
  });
  await expect(button).toBeVisible();
  const before = await page.evaluate(() => session.snapshot().active);
  const small = await page.locator("#game").boundingBox();
  const normalMenu = await page.locator(".menu-panel").boundingBox();
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#minigameKeypad")).toBeHidden();
  await expect(page.locator("#startButton")).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phone Mode" })).toBeVisible();
  const large = await page.locator("#game").boundingBox();
  expect(large.width).toBeGreaterThan(small.width * 1.4);
  const menu = await page.locator(".menu-panel").boundingBox();
  const phone = await page.locator(".phone-shell").boundingBox();
  expect(Math.abs(menu.width - normalMenu.width)).toBeLessThan(2);
  expect(Math.abs(menu.height - normalMenu.height)).toBeLessThan(2);
  expect(phone.width).toBeGreaterThan(menu.width);
  expect(await page.evaluate(() => session.snapshot().active)).toEqual(before);
  await page.screenshot({ path: test.info().outputPath("fullscreen.png") });
  await page.getByRole("button", { name: "Phone Mode" }).click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#minigameKeypad")).toBeVisible();
});

test("fullscreen icon is beside 0 and Settings follows the 0-key action", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await unlock(page);
  const zero = page.locator('[data-minigame="0"]');
  const fullscreen = page.locator("#fullscreenModeButton");
  await expect(fullscreen).toHaveText("⛶");
  const zeroBox = await zero.boundingBox();
  const fullscreenBox = await fullscreen.boundingBox();
  expect(fullscreenBox.x).toBeGreaterThan(zeroBox.x);
  expect(Math.abs(fullscreenBox.y - zeroBox.y)).toBeLessThan(2);
  await fullscreen.click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator("#personalizationScreen")).toBeVisible();
});

test("fullscreen is available on smaller selected boards and fits a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await unlock(page);
  await page.evaluate(() => { dispatchSession({ type: "selectBoard", level: 0 }); syncPanels(); });
  await page.locator("#fullscreenModeButton").click();
  await expect(page.locator("#fullscreenModeButton")).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator("#game")).toBeVisible();
  await expect(page.locator(".menu-panel")).toBeVisible();
});

test("fullscreen follow-up keeps menu size, restores the mode, and finishes background death", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Use a one-time fixture so reload reads the save written by the UI.
  await page.addInitScript(() => {
    if (sessionStorage.getItem("fullscreen-follow-up")) return;
    sessionStorage.setItem("fullscreen-follow-up", "1");
    localStorage.setItem("snake-forever-save", JSON.stringify({
      saveVersion: 2, savedAt: Date.now(), upgrades: { boardLevel: 1 }, board: { selectedBoardLevel: 1 }
    }));
  });
  await page.goto("/");
  await page.evaluate(() => { setMenuTab("nursery"); syncPanels(); });
  const title = await page.locator(".nursery-yard-card strong").boundingBox();
  const feeding = await page.locator("#pauseFeedingButton").boundingBox();
  const capacity = await page.locator("#nurseryCapacity").boundingBox();
  expect(title.x + title.width).toBeLessThanOrEqual(feeding.x);
  expect(feeding.x + feeding.width).toBeLessThanOrEqual(capacity.x);
  const before = await page.locator(".menu-panel").boundingBox();
  const small = await page.locator("#game").boundingBox();
  expect(await page.evaluate(() => screenEffectStrength())).toBe(1);
  await page.locator("#fullscreenModeButton").click();
  const after = await page.locator(".menu-panel").boundingBox();
  expect(Math.abs(after.width - before.width)).toBeLessThan(2);
  expect(Math.abs(after.height - before.height)).toBeLessThan(2);
  expect((await page.locator("#game").boundingBox()).width).toBeGreaterThan(small.width * 1.4);
  expect(await page.evaluate(() => screenEffectStrength())).toBe(0.75);
  expect(await page.locator(".screen-bezel").evaluate((el) => getComputedStyle(el).boxShadow)).toContain("0.24");
  await page.screenshot({ path: test.info().outputPath("fullscreen-follow-up.png") });
  await page.reload();
  await expect(page.locator("body")).toHaveClass(/is-fullscreen-mode/);
  expect(await page.evaluate(() => session.snapshot().fullscreenMode)).toBe(true);
  await page.evaluate(() => {
    presentGameResult(dispatchSession({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "up",
      snake: [{ x: 10, y: 1 }, { x: 10, y: 2 }, { x: 10, y: 3 }]
    } }));
    presentGameResult(dispatchSession({ type: "begin" })); idleLastWallAt = Date.now();
  });
  const away = await context.newPage();
  // Headless tabs can retain document focus. Send the actual window event so
  // this isolated check exercises the same loss-of-focus display path.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await away.goto("about:blank"); await away.bringToFront();
  await away.waitForTimeout(1500);
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("#overlay")).toHaveClass(/visible/);
  await expect(page.locator("#overlay")).toContainText("Game Over");
  expect(await page.evaluate(() => ({ phase: session.snapshot().phase, animation: deathAnimation, timer: deathOverlayTimer })))
    .toEqual({ phase: "gameover", animation: null, timer: null });
  await page.screenshot({ path: test.info().outputPath("background-game-over.png") });
  await away.close();
});
