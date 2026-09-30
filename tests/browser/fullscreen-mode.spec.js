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
  expect(Math.abs(menu.width - phone.width)).toBeLessThan(2);
  expect(menu.width).toBeGreaterThan(600);
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
