const { test, expect } = require("@playwright/test");

test("all segments snap to their cells with alternating body shades and a head-colored tail", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    window.setInterval = () => 0;
  });
  await page.goto("/", { waitUntil: "networkidle" });
  const result = await page.evaluate(() => {
    const vectors = { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
    const originalBlock = drawRoundedRect;
    const originalTail = drawTail;
    let rects;
    drawRoundedRect = (x, y, width, height) => { rects.push({ x, y, size: width, color: ctx.fillStyle }); originalBlock(x, y, width, height); };
    drawTail = (rect, ...args) => { rects.push({ ...rect, color: ctx.fillStyle }); originalTail(rect, ...args); };
    const accept = (result) => { acceptSnapshot(result.snapshot); return result.snapshot; };
    const capture = () => {
      boardMetrics = getBoardMetrics();
      rects = [];
      drawScreen(); drawGrid(); drawSnake();
      return { rects, pixels: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data) };
    };
    const differentPixels = (a, b) => a.filter((value, index) => value !== b[index]).length;
    const exact = (rect, part, index) => {
      const inset = Math.max(3, boardMetrics.cellSize * (index === 0 ? 0.105 : 0.135));
      return rect.x === boardMetrics.x + part.x * boardMetrics.cellSize + inset
        && rect.y === boardMetrics.y + part.y * boardMetrics.cellSize + inset;
    };
    const checks = [];
    for (const [direction, vector] of Object.entries(vectors)) {
      session = window.IdleSnakeSession.createGameSession({ now: 0, rng: () => 0.5 });
      const ready = session.dispatch({ type: "selectMode", mode: "snake", setup: {
        grid: { columns: 20, rows: 20 }, tickMs: 200, direction,
        snake: Array.from({ length: 5 }, (_, index) => ({ x: 10 - vector.x * index, y: 10 - vector.y * index }))
      } }).snapshot;
      acceptSnapshot(ready);
      accept(session.dispatch({ type: "begin" }));
      const beforeStep = capture();
      const moved = accept(session.tick(200));
      const initial = capture();
      const partial = accept(session.tick(15));
      const middle = capture();
      accept(session.dispatch({ type: "pause" }));
      accept(session.tick(500));
      const paused = capture();
      accept(session.dispatch({ type: "resume" }));
      const ended = accept(session.tick(45));
      const final = capture();
      checks.push({
        direction,
        colors: initial.rects.map((rect) => rect.color),
        expectedColors: [snakeColors.head, snakeColors.body, lightenColor(snakeColors.body, 0.15), snakeColors.body, snakeColors.head],
        cellsExact: initial.rects.every((rect, index) => exact(rect, moved.active.snake[index], index))
          && middle.rects.every((rect, index) => exact(rect, partial.active.snake[index], index)),
        moving: initial.rects.map((rect, index) => rect.x !== middle.rects[index].x || rect.y !== middle.rects[index].y),
        sideways: initial.rects.some((rect, index) => vector.x
          ? rect.y !== final.rects[index].y : rect.x !== final.rects[index].x),
        initialOffset: initial.rects.slice(1).map((rect, index) => Math.hypot(rect.x - final.rects[index + 1].x, rect.y - final.rects[index + 1].y) / boardMetrics.cellSize),
        pausedPixels: differentPixels(middle.pixels, paused.pixels),
        stepChangedPixels: differentPixels(beforeStep.pixels, initial.pixels),
        changedPixels: differentPixels(initial.pixels, middle.pixels),
        finishedExact: final.rects.every((rect, index) => exact(rect, ended.active.snake[index], index))
      });
    }
    // Two more steps put a bend through the body, with exact cell positions.
    accept(session.dispatch({ type: "direction", direction: "right" }));
    accept(session.tick(140));
    const bent = accept(session.tick(200));
    const bentPoints = bent.active.snake;
    const maxGap = Math.max(...bentPoints.slice(1).map((point, index) => Math.hypot(point.x - bentPoints[index].x, point.y - bentPoints[index].y)));
    const reduced = accept(session.dispatch({ type: "setReducedMotion", reducedMotion: true }));
    const reducedFrame = capture();
    const reducedExact = reducedFrame.rects.every((rect, index) => exact(rect, reduced.active.snake[index], index));
    const reducedColors = reducedFrame.rects.map((rect) => rect.color);
    accept(session.dispatch({ type: "setReducedMotion", reducedMotion: false }));
    const originalBodyColor = snakeColors.body;
    const paletteChecks = snakeColorChoices.body.map((choice) => {
      snakeColors = { ...snakeColors, body: choice.value };
      const colors = capture().rects.map((rect) => rect.color);
      return colors.every((color, index) => color === (index === 0 || index === colors.length - 1 ? snakeColors.head
        : index % 2 === 1 ? choice.value : lightenColor(choice.value, 0.15)));
    });
    snakeColors = { ...snakeColors, body: originalBodyColor };
    const originalHeadColor = snakeColors.head;
    const headPaletteChecks = snakeColorChoices.head.map((choice) => {
      snakeColors = { ...snakeColors, head: choice.value };
      const colors = capture().rects.map((rect) => rect.color);
      return colors[0] === choice.value && colors.at(-1) === choice.value;
    });
    snakeColors = { ...snakeColors, head: originalHeadColor };
    startDeathAnimation();
    rects = [];
    drawDeathAnimation(deathAnimation.startedAt);
    const deathColors = rects.filter((rect) => rect.color.startsWith("#")).map((rect) => rect.color);
    deathAnimation = null;
    drawRoundedRect = originalBlock;
    drawTail = originalTail;
    accept(session.dispatch({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 11, rows: 9 }, tickMs: 200, direction: "right",
      snake: [{ x: 8, y: 3 }, { x: 7, y: 3 }, { x: 6, y: 3 }, { x: 5, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 3 },
        { x: 3, y: 4 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }]
    } }));
    accept(session.dispatch({ type: "begin" }));
    accept(session.tick(215));
    hideOverlay(); syncHud(); render();
    return { checks, maxGap, reducedExact, reducedColors, paletteChecks, headPaletteChecks, deathColors };
  });
  for (const check of result.checks) {
    expect(check.cellsExact, check.direction).toBe(true);
    expect(check.colors).toEqual(check.expectedColors);
    expect(check.moving, check.direction).toEqual([false, false, false, false, false]);
    expect(check.sideways, check.direction).toBe(false);
    check.initialOffset.forEach((offset) => expect(offset).toBe(0));
    expect(check.pausedPixels, check.direction).toBe(0);
    expect(check.stepChangedPixels, check.direction).toBeGreaterThan(0);
    expect(check.changedPixels, check.direction).toBe(0);
    expect(check.finishedExact, check.direction).toBe(true);
  }
  expect(result.maxGap).toBe(1);
  expect(result.reducedExact).toBe(true);
  expect(result.reducedColors).toEqual(result.checks[0].expectedColors);
  expect(result.paletteChecks.every(Boolean)).toBe(true);
  expect(result.headPaletteChecks.every(Boolean)).toBe(true);
  expect(result.deathColors).toEqual(result.checks[0].expectedColors);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => effectiveReducedMotion())).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => page.evaluate(() => effectiveReducedMotion())).toBe(false);
  await page.screenshot({ path: "test-results/body-snaps.png", fullPage: true });
  expect(errors).toEqual([]);
});
