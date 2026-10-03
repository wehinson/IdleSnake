const { test, expect } = require("@playwright/test");

for (const theme of ["original", "clear-cover-2", "amber-graphite", "night-green", "oxblood", "carbon"]) {
  test(`merged release preserves Snake display and controls in ${theme}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0;
      window.setInterval = () => 0;
    });
    await page.goto(`/?theme=${theme}`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const normalMenu = await page.locator(".menu-panel").boundingBox();
    await page.evaluate(() => {
      session = IdleSnakeSession.createGameSession({ now: Date.now(), rng: () => 0.5,
        save: { savedAt: Date.now(), currencies: { seeds: 10000 }, upgrades: { boardLevel: 1 } } });
      presentGameResult(dispatchSession({ type: "selectMode", mode: "snake", setup: {
        grid: { columns: 10, rows: 10 }, direction: "right", tickMs: 10000,
        snake: [{ x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }]
      } }));
      const saved = session.serialize();
      saved.session.active.foods = [{ x: 6, y: 5, kind: "seed" }];
      session = IdleSnakeSession.createGameSession({ save: saved, now: saved.savedAt });
      acceptSnapshot(session.snapshot());
      presentGameResult(dispatchSession({ type: "begin", initialDelayMs: 0 }));
      render();
      acceptSnapshot(session.tick(65).snapshot);
      presentGameResult(dispatchSession({ type: "pause" }));
      syncPanels(); syncHud(); render();
    });
    const before = await page.evaluate(() => ({ tongue: tongueFrame, save: session.serialize() }));
    expect(before.tongue).not.toBeNull();
    await page.locator(".themekit-picker select").selectOption("original");
    await page.locator(".themekit-picker select").selectOption(theme);
    expect(await page.evaluate(() => ({ tongue: tongueFrame, save: session.serialize() }))).toEqual(before);
    await page.locator('[data-minigame="0"]').focus();
    expect(await page.locator('[data-minigame="0"]').evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
    await page.evaluate(() => { setFullscreenMode(true); render(); });
    const expandedMenu = await page.locator(".menu-panel").boundingBox();
    expect(expandedMenu.width / normalMenu.width).toBeCloseTo(1.25, 2);
    const colors = await page.evaluate(() => {
      const stroke = ctx.stroke;
      const strokes = [];
      ctx.stroke = function () { strokes.push(this.strokeStyle); stroke.call(this); };
      drawSnake(); ctx.stroke = stroke;
      const body = ThemeKit.color(snakeColors.body);
      return { connector: strokes[0], expected: IdleSnakeAppearance.connectorColor(body) };
    });
    expect(colors.connector).toBe(colors.expected);
    await page.screenshot({ path: test.info().outputPath(`${theme}-fullscreen.png`) });
    await page.locator("#phoneModeButton").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("#game")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`${theme}-phone.png`) });
    expect(errors).toEqual([]);
  });
}
