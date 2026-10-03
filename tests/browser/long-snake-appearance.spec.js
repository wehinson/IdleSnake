const { test, expect } = require("@playwright/test");

test("long snake uses uniform body blocks, thinner connectors, and an aligned gridded board", async ({ page }) => {
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
    accept(session.dispatch({ type: "begin" }));
    accept(session.tick(100)); // No movement deadline: all appearance stays fixed.
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
    const originalBlock = drawRoundedRect;
    const sizes = [];
    drawRoundedRect = (x, y, width, height) => { sizes.push(width); originalBlock(x, y, width, height); };
    drawSnake(); drawRoundedRect = originalBlock;
    const normalSize = cell - Math.max(3, cell * 0.135) * 2;
    const areas = sizes.slice(1).map((size) => (size / normalSize) ** 2);
    const gridLines = [];
    const originalMoveTo = ctx.moveTo; const originalLineTo = ctx.lineTo;
    ctx.moveTo = (x, y) => { gridLines.push({ x, y }); originalMoveTo.call(ctx, x, y); };
    ctx.lineTo = (x, y) => { gridLines.push({ x, y }); originalLineTo.call(ctx, x, y); };
    drawGridDirect(); ctx.moveTo = originalMoveTo; ctx.lineTo = originalLineTo;
    const gridWidth = ctx.lineWidth;
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
    return { length: snake.length, areas, gridLines, gridWidth,
      changedPixels, dark, light, grid,
      connector: strokes[0], expectedConnectorColor: window.IdleSnakeAppearance.connectorColor(snakeColors.body), cell,
      pauseFrozen, phase: session.snapshot().phase, cells: session.snapshot().active.snake };
  });
  expect(result.length).toBe(224);
  expect(result.areas.length).toBe(222);
  result.areas.forEach((area) => expect(area).toBeCloseTo(1, 10));
  expect(result.changedPixels).toBe(0);
  expect(result.gridWidth).toBe(2);
  expect(result.gridLines.every((point) => Number.isInteger(point.x) && Number.isInteger(point.y))).toBe(true);
  result.dark.forEach((channel, index) => expect(Math.abs(channel / result.light[index] - 0.8725)).toBeLessThan(0.015));
  expect(result.grid[0]).toBeLessThan(result.dark[0]);
  expect(result.connector.color).toBe(result.expectedConnectorColor);
  expect(result.connector.width).toBeCloseTo(Math.max(2.25, result.cell * 0.46 * 1.5 * 0.75), 5);
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
