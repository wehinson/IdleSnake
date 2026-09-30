const { test, expect } = require("@playwright/test");

test("body motion reaches every drawn segment and respects pause and reduced motion", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto("/", { waitUntil: "networkidle" });
  const result = await page.evaluate(() => {
    const snake = [
      { x: 7, y: 3 }, { x: 6, y: 3 }, { x: 5, y: 3 }, { x: 4, y: 3 },
      { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 3, y: 5 }, { x: 4, y: 5 },
      { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }
    ];
    acceptSnapshot(session.dispatch({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 11, rows: 9 }, snake, direction: "right", foods: []
    } }).snapshot);
    const snapshot = structuredClone(latestFrameSnapshot);
    snapshot.phase = "running";
    snapshot.elapsedMs = 300;
    latestFrameSnapshot = snapshot;
    boardMetrics = getBoardMetrics();
    digestionAnimations = [];
    const originalBlock = drawRoundedRect;
    const originalTail = drawTail;
    let rects;
    drawRoundedRect = (x, y, width, height) => { rects.push({ x, y, size: width }); originalBlock(x, y, width, height); };
    drawTail = (rect, ...args) => { rects.push(rect); originalTail(rect, ...args); };
    const capture = () => {
      rects = [];
      drawScreen(); drawGrid(); drawSnake();
      return { rects, pixels: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data) };
    };
    const first = capture();
    snapshot.elapsedMs = 325;
    const second = capture();
    snapshot.phase = "paused";
    const paused = capture();
    const pausedAgain = capture();
    snapshot.reducedMotion = true;
    const reduced = capture();
    snapshot.elapsedMs = 500;
    const reducedAgain = capture();
    drawRoundedRect = originalBlock;
    drawTail = originalTail;
    snapshot.reducedMotion = false;
    snapshot.phase = "running";
    hideOverlay();
    syncHud();
    render();
    const changed = (a, b) => a.filter((value, index) => value !== b[index]).length;
    return {
      count: first.rects.length,
      moving: first.rects.map((rect, index) => rect.x !== second.rects[index].x || rect.y !== second.rects[index].y),
      changedPixels: changed(first.pixels, second.pixels),
      pausedPixels: changed(second.pixels, paused.pixels) + changed(paused.pixels, pausedAgain.pixels),
      reducedPixels: changed(reduced.pixels, reducedAgain.pixels),
      reducedCells: reduced.rects.every((rect, index) => {
        const inset = Math.max(3, boardMetrics.cellSize * (index === 0 ? 0.105 : 0.135));
        return rect.x === boardMetrics.x + snake[index].x * boardMetrics.cellSize + inset
          && rect.y === boardMetrics.y + snake[index].y * boardMetrics.cellSize + inset;
      })
    };
  });
  expect(result.count).toBe(11);
  expect(result.moving).toEqual([false, ...Array(10).fill(true)]);
  expect(result.changedPixels).toBeGreaterThan(20);
  expect(result.pausedPixels).toBe(0);
  expect(result.reducedPixels).toBe(0);
  expect(result.reducedCells).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => effectiveReducedMotion())).toBe(true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => page.evaluate(() => effectiveReducedMotion())).toBe(false);
  await page.screenshot({ path: "test-results/body-motion.png", fullPage: true });
  expect(errors).toEqual([]);
});
