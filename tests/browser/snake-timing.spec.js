const { test, expect } = require("@playwright/test");

test("opt-in timing log records input, counted time, movement state, and frames", async ({ page }) => {
  await page.goto("/?snakeTiming=1");
  await page.evaluate(() => {
    dispatchSession({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "up",
      snake: [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]
    } });
    dispatchSession({ type: "direction", direction: "right" });
    idleLastWallAt = Date.now() - 250;
    tickIdleWorld("test");
    idleLastWallAt = Date.now() - 100;
    tickIdleWorld("test-move");
  });
  await page.waitForFunction(() => IdleSnakeTiming.exportData().entries.some((item) => item.type === "frame"));
  const data = await page.evaluate(() => IdleSnakeTiming.exportData());
  const action = data.entries.find((item) => item.type === "action" && item.action === "direction");
  const tick = data.entries.find((item) => item.type === "tick" && item.source === "test");
  const move = data.entries.find((item) => item.type === "tick" && item.source === "test-move");
  const frame = data.entries.find((item) => item.type === "frame");
  expect(data.turnTimingEnabled).toBe(false);
  expect(action.direction).toBe("right");
  expect(action.after.head).toEqual({ x: 11, y: 10 });
  expect(tick.rawDtMs).toBeGreaterThanOrEqual(250);
  expect(tick.countedDtMs).toBe(100);
  expect(tick.discardedDtMs).toBe(tick.rawDtMs - 100);
  expect(tick.after.tickMs).toBe(200);
  expect(move.after.head).toEqual({ x: 12, y: 10 });
  expect(frame.animationTimeMs).toEqual(expect.any(Number));
  expect(frame.workMs).toEqual(expect.any(Number));
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download timing log" }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/^snake-timing-.*\.json$/);
});
