const { test, expect } = require("@playwright/test");

test("grid caching preserves final pixels across board sizes and drawing states", async ({ page }) => {
  await page.goto("/");
  const failures = await page.evaluate(() => {
    cancelAnimationFrame(animationId);
    const failures = [];
    for (const [columns, rows] of [[5, 7], [9, 13], [11, 15], [15, 21], [21, 21], [20, 20], [40, 40]]) {
      const snapshot = structuredClone(latestFrameSnapshot);
      snapshot.active.grid = { columns, rows };
      latestFrameSnapshot = snapshot;
      boardMetrics = getBoardMetrics();
      for (const lineJoin of ["round", "miter"]) {
        for (const alpha of [1, 0.5]) {
          const capture = (draw) => {
            ctx.globalAlpha = 1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawScreen();
            ctx.lineJoin = lineJoin;
            ctx.globalAlpha = alpha;
            draw();
            return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          };
          const cached = capture(drawGrid);
          const direct = capture(drawGridDirect);
          if (cached.some((value, index) => value !== direct[index])) failures.push({ columns, rows, lineJoin, alpha });
        }
      }
    }
    return failures;
  });
  expect(failures).toEqual([]);
});

test("cached grid pixels match direct drawing and invalidate on resize", async ({ page }) => {
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
  });
  await page.goto("/", { waitUntil: "networkidle" });

  const result = await page.evaluate(() => window.eval(`(() => {
    const expandedSnapshot = structuredClone(latestFrameSnapshot);
    expandedSnapshot.active.grid = { columns: 20, rows: 20 };
    latestFrameSnapshot = expandedSnapshot;
    latestSnapshot = expandedSnapshot;
    render();
    const capture = (draw) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawScreen();
      ctx.lineJoin = "round";
      draw();
      return Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    };
    const cached = capture(() => drawGrid());
    const direct = capture(() => drawGridDirect());
    const firstMatch = cached.length === direct.length && cached.every((value, index) => value === direct[index]);

    document.body.classList.add("is-fullscreen-mode");
    const fullscreenCached = capture(() => drawGrid());
    const fullscreenDirect = capture(() => drawGridDirect());
    const fullscreenMatch = fullscreenCached.every((value, index) => value === fullscreenDirect[index]);
    const fullscreenChanged = fullscreenCached.some((value, index) => value !== cached[index]);
    document.body.classList.remove("is-fullscreen-mode");

    canvas.width += 17;
    canvas.height += 11;
    render();
    boardMetrics = getBoardMetrics();
    const resizedCached = capture(() => drawGrid());
    const resizedDirect = capture(() => drawGridDirect());
    const resizeMatch = resizedCached.length === resizedDirect.length && resizedCached.every((value, index) => value === resizedDirect[index]);
    const resizeDiff = resizedCached.findIndex((value, index) => value !== resizedDirect[index]);
    return { firstMatch, fullscreenMatch, fullscreenChanged, resizeMatch, resizeDiff, resizePixels: resizeDiff < 0 ? null : [resizedCached[resizeDiff], resizedDirect[resizeDiff]], initialSize: [canvas.width - 17, canvas.height - 11], resizedSize: [canvas.width, canvas.height] };
  })()`));

  expect(result.firstMatch).toBe(true);
  expect(result.fullscreenMatch).toBe(true);
  expect(result.fullscreenChanged).toBe(true);
  expect(result.resizeMatch, JSON.stringify(result)).toBe(true);
  expect(result.resizedSize[0]).toBe(result.initialSize[0] + 17);
  expect(result.resizedSize[1]).toBe(result.initialSize[1] + 11);
});
