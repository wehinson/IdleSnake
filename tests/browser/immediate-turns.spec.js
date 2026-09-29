const { test, expect } = require("@playwright/test");

async function prepare(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-09-09T12:00:00Z") });
  await page.goto("/");
  await page.clock.pauseAt(new Date("2026-09-09T12:00:10Z"));
  await page.evaluate(() => {
    const ready = session.dispatch({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "right",
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]
    } }).snapshot;
    latestSnapshot = ready;
    latestFrameSnapshot = ready;
    acceptSnapshot(ready);
    idleLastWallAt = Date.now();
    syncHud();
  });
  return errors;
}

test("keyboard turns queue without adding movement before the next tick", async ({ page }) => {
  const errors = await prepare(page);
  const result = await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp" }));
    const first = { ...gameView.snake[0] };
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft" }));
    const second = { ...gameView.snake[0] };
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp", repeat: true }));
    return { first, second, held: { ...gameView.snake[0] }, direction: gameView.direction, phase: gameView.state, engine: session.snapshot().active.snake[0] };
  });
  expect(result).toEqual({ first: { x: 10, y: 9 }, second: { x: 10, y: 9 }, held: { x: 10, y: 9 }, direction: "up", phase: "running", engine: { x: 10, y: 9 } });
  expect(errors).toEqual([]);
});

test("the first D-pad turn is immediate and starts a new interval", async ({ page }) => {
  const errors = await prepare(page);
  await page.locator('[data-direction="right"]').first().dispatchEvent("pointerdown", { pointerId: 1 });
  await page.clock.runFor(190);
  await page.locator('[data-direction="up"]').first().dispatchEvent("pointerdown", { pointerId: 2 });
  const turn = await page.evaluate(() => ({ head: { ...gameView.snake[0] }, elapsed: session.snapshot().elapsedMs }));
  expect(turn).toEqual({ head: { x: 11, y: 9 }, elapsed: 190 });
  await page.clock.runFor(199);
  expect(await page.evaluate(() => session.snapshot().active.snake[0])).toEqual(turn.head);
  // Flush time to the exact boundary through the same host clock operation.
  await page.clock.runFor(1);
  await page.evaluate(() => tickIdleWorld());
  expect(await page.evaluate(() => session.snapshot().active.snake[0])).toEqual({ x: 11, y: 8 });
  expect(errors).toEqual([]);
});

test("a collision waits for grace before displaying game over", async ({ page }) => {
  const errors = await prepare(page);
  await page.evaluate(() => {
    const ready = session.dispatch({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 20 }, direction: "right",
      snake: [{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]
    } }).snapshot;
    latestSnapshot = ready;
    latestFrameSnapshot = ready;
    acceptSnapshot(ready);
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp" }));
  });
  expect(await page.evaluate(() => session.snapshot().phase)).toBe("running");
  await page.clock.runFor(120);
  await page.evaluate(() => { interpretSessionEvents(tickIdleWorld()); });
  await expect(page.locator("#stateText")).toContainText("Game Over");
  expect(await page.evaluate(() => session.snapshot().phase)).toBe("gameover");
  expect(errors).toEqual([]);
});

test("eating a Seed wiggles a stationary tail without changing engine movement", async ({ page }) => {
  const errors = await prepare(page);
  const result = await page.evaluate(() => {
    session = window.IdleSnakeSession.createGameSession({ now: 0, rng: () => 0 });
    const ready = session.dispatch({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "up",
      snake: [{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }]
    } }).snapshot;
    latestSnapshot = ready;
    latestFrameSnapshot = ready;
    acceptSnapshot(ready);
    const tailBefore = { ...gameView.snake.at(-1) };
    const moved = dispatchSession({ type: "direction", direction: "up" });
    interpretSessionEvents(moved.events);
    const startedAt = tailWiggleStartedAt;
    return {
      ate: moved.events.some((event) => event.type === "eat"),
      length: gameView.snake.length,
      tailBefore,
      tailAfter: { ...gameView.snake.at(-1) },
      started: startedAt !== null,
      movingOffset: tailWiggleAmount(startedAt + 50),
      finishedOffset: tailWiggleAmount(startedAt + TAIL_WIGGLE_DURATION_MS + 1)
    };
  });
  expect(result.ate).toBe(true);
  expect(result.length).toBe(4);
  expect(result.tailAfter).toEqual(result.tailBefore);
  expect(result.started).toBe(true);
  expect(Math.abs(result.movingOffset)).toBeGreaterThan(0.01);
  expect(result.finishedOffset).toBe(0);
  expect(errors).toEqual([]);
});

test("a late keyboard turn rescues the pending collision in the browser", async ({ page }) => {
  const errors = await prepare(page);
  await page.evaluate(() => {
    acceptSnapshot(session.dispatch({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "right",
      snake: [{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]
    } }).snapshot);
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp" }));
  });
  await page.clock.runFor(90);
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight" })));
  expect(await page.evaluate(() => session.snapshot().active.snake[0])).toEqual({ x: 3, y: 0 });
  expect(await page.evaluate(() => session.snapshot().phase)).toBe("running");
  expect(errors).toEqual([]);
});

for (const [second, duration, head] of [
  ["ArrowLeft", 100, { x: 9, y: 9 }],
  ["ArrowRight", 200, { x: 11, y: 9 }]
]) test("relative turn timing for " + second, async ({ page }) => {
  await prepare(page);
  await page.evaluate(second => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: second }));
  }, second);
  await page.clock.runFor(duration - 1);
  await page.evaluate(() => tickIdleWorld());
  expect(await page.evaluate(() => session.snapshot().active.snake[0])).toEqual({ x: 10, y: 9 });
  await page.clock.runFor(1);
  await page.evaluate(() => tickIdleWorld());
  expect(await page.evaluate(() => session.snapshot().active.snake[0])).toEqual(head);
});
