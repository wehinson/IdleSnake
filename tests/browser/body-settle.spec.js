const { test, expect } = require("@playwright/test");

test("head snaps and the connected body settles forward within each new cell", async ({ page }) => {
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
    drawRoundedRect = (x, y, width, height) => { rects.push({ x, y, size: width }); originalBlock(x, y, width, height); };
    drawTail = (rect, ...args) => { rects.push(rect); originalTail(rect, ...args); };
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
      snakeBodyMotion.reset(ready);
      acceptSnapshot(ready);
      accept(session.dispatch({ type: "begin" }));
      const moved = accept(session.tick(200));
      const initial = capture();
      const partial = accept(session.tick(15));
      const middle = capture();
      accept(session.dispatch({ type: "pause" }));
      accept(session.tick(500));
      const paused = capture();
      accept(session.dispatch({ type: "resume" }));
      const ended = accept(session.tick(30));
      const final = capture();
      checks.push({
        direction,
        headExact: exact(initial.rects[0], moved.active.snake[0], 0) && exact(middle.rects[0], partial.active.snake[0], 0),
        moving: initial.rects.map((rect, index) => rect.x !== middle.rects[index].x || rect.y !== middle.rects[index].y),
        sideways: initial.rects.some((rect, index) => vector.x
          ? rect.y !== final.rects[index].y : rect.x !== final.rects[index].x),
        initialOffset: initial.rects.slice(1).map((rect, index) => Math.hypot(rect.x - final.rects[index + 1].x, rect.y - final.rects[index + 1].y) / boardMetrics.cellSize),
        pausedPixels: differentPixels(middle.pixels, paused.pixels),
        changedPixels: differentPixels(initial.pixels, middle.pixels),
        finishedExact: final.rects.every((rect, index) => exact(rect, ended.active.snake[index], index))
      });
    }
    // Two more steps put a bend through the body, without a sideways wave.
    accept(session.dispatch({ type: "direction", direction: "right" }));
    accept(session.tick(155));
    const bent = accept(session.tick(200));
    const bentPoints = snakeBodyMotion.points(bent);
    const maxGap = Math.max(...bentPoints.slice(1).map((point, index) => Math.hypot(point.x - bentPoints[index].x, point.y - bentPoints[index].y)));
    const reduced = accept(session.dispatch({ type: "setReducedMotion", reducedMotion: true }));
    const reducedFrame = capture();
    const reducedExact = reducedFrame.rects.every((rect, index) => exact(rect, reduced.active.snake[index], index));
    accept(session.dispatch({ type: "setReducedMotion", reducedMotion: false }));
    drawRoundedRect = originalBlock;
    drawTail = originalTail;
    hideOverlay(); syncHud(); render();
    return { checks, maxGap, reducedExact };
  });
  for (const check of result.checks) {
    expect(check.headExact, check.direction).toBe(true);
    expect(check.moving, check.direction).toEqual([false, true, true, true, true]);
    expect(check.sideways, check.direction).toBe(false);
    check.initialOffset.forEach((offset, index) => expect(offset).toBeCloseTo(index === 3 ? 0.06 : 0.1, 6));
    expect(check.pausedPixels, check.direction).toBe(0);
    expect(check.changedPixels, check.direction).toBeGreaterThan(0);
    expect(check.finishedExact, check.direction).toBe(true);
  }
  expect(result.maxGap).toBeLessThanOrEqual(1.100001);
  expect(result.reducedExact).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => effectiveReducedMotion())).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => page.evaluate(() => effectiveReducedMotion())).toBe(false);
  await page.screenshot({ path: "test-results/body-settle.png", fullPage: true });
  expect(errors).toEqual([]);
});
