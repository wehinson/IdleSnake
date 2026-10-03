const { test, expect } = require("@playwright/test");

test("long snake uses sparse sliding markings, wider colored connectors, and a quiet gridded board", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    window.setInterval = () => 0;
  });
  await page.goto("/");
  const result = await page.evaluate(() => {
    session = window.IdleSnakeSession.createGameSession({ now: 0, rng: () => 0.4, save: {
      upgrades: { boardLevel: 7 }, settings: { fullscreenMode: true }
    } });
    const snake = [];
    for (let y = 4; y <= 17; y++) {
      const row = Array.from({ length: 16 }, (_, i) => ({ x: y % 2 === 0 ? 17 - i : 2 + i, y }));
      snake.push(...row);
    }
    const accept = (result) => { acceptSnapshot(result.snapshot); return result.snapshot; };
    accept(session.dispatch({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 25 }, snake, direction: "up", tickMs: 200, foods: [{ x: 18, y: 2 }]
    } }));
    accept(session.dispatch({ type: "setFullscreenMode", fullscreenMode: true }));
    syncPanels(); syncHud(); hideOverlay();
    boardMetrics = getBoardMetrics();
    const capture = () => {
      drawScreen(); drawGrid(); drawSnake();
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const first = capture();
    const marks = window.IdleSnakeAppearance.bodyMarkings(snake);
    accept(session.dispatch({ type: "begin" }));
    accept(session.tick(100)); // Markings slide; every body cell stays fixed.
    const second = capture();
    let changedPixels = 0;
    for (let i = 0; i < first.length; i += 4) {
      if (first[i] !== second[i] || first[i + 1] !== second[i + 1] || first[i + 2] !== second[i + 2]) changedPixels++;
    }
    const readPixel = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3);
    const cell = boardMetrics.cellSize;
    const dark = readPixel(boardMetrics.x + Math.floor(cell / 2), boardMetrics.y + Math.floor(cell / 2));
    const light = readPixel(boardMetrics.x + cell + Math.floor(cell / 2), boardMetrics.y + Math.floor(cell / 2));
    const grid = readPixel(boardMetrics.x + cell, boardMetrics.y + Math.floor(cell / 2));
    const originalStroke = ctx.stroke;
    const strokes = [];
    ctx.stroke = function () { strokes.push({ color: this.strokeStyle, width: this.lineWidth }); originalStroke.call(this); };
    drawSnake(); ctx.stroke = originalStroke;
    accept(session.dispatch({ type: "pause" }));
    const paused = capture();
    accept(session.tick(2000));
    const later = capture();
    const pauseFrozen = paused.every((value, i) => value === later[i]);
    accept(session.dispatch({ type: "resume" }));
    accept(session.tick(500));
    accept(session.dispatch({ type: "playDirection", direction: "left" }));
    accept(session.tick(400));
    hideOverlay(); syncHud(); render();
    return { length: snake.length, count: marks.length, variants: [...new Set(marks.map((mark) => mark.variant))],
      changedPixels, boardPixels: boardMetrics.width * boardMetrics.height, dark, light, grid,
      connector: strokes[0], expectedConnectorColor: window.IdleSnakeAppearance.connectorColor(snakeColors.body), cell,
      pauseFrozen, phase: session.snapshot().phase, cells: session.snapshot().active.snake };
  });
  expect(result.length).toBe(224);
  expect(result.count).toBeLessThan(result.length / 4);
  expect(result.variants.sort()).toEqual([0, 1, 2]);
  expect(result.changedPixels).toBeGreaterThan(0);
  expect(result.changedPixels / result.boardPixels).toBeLessThan(0.02);
  result.dark.forEach((channel, index) => expect(Math.abs(channel / result.light[index] - 0.85)).toBeLessThan(0.015));
  expect(result.grid[0]).toBeLessThan(result.dark[0]);
  expect(result.connector.color).toBe(result.expectedConnectorColor);
  expect(result.connector.width).toBeCloseTo(Math.max(3, result.cell * 0.46 * 1.5), 5);
  expect(result.pauseFrozen).toBe(true);
  expect(result.phase).toBe("running");
  await expect(page.locator("#overlay")).toHaveCSS("opacity", "0");
  await page.screenshot({ path: test.info().outputPath("long-snake-fullscreen.png") });
  await page.locator("#game").screenshot({ path: test.info().outputPath("long-snake-field.png") });
  await page.evaluate(() => {
    const result = session.tick(600); acceptSnapshot(result.snapshot); render();
  });
  await page.locator("#game").screenshot({ path: test.info().outputPath("long-snake-next-frame.png") });
  await page.locator("#phoneModeButton").click();
  await page.screenshot({ path: test.info().outputPath("long-snake-phone.png") });
  expect(errors).toEqual([]);
});
