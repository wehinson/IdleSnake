const { test, expect } = require("@playwright/test");

async function prepareShieldRun(page) {
  await page.goto("/");
  return page.evaluate(() => {
    cancelAnimationFrame(animationId);
    session = window.IdleSnakeSession.createGameSession({ now: 0, rng: () => 0, save: { upgrades: { shieldLevel: 1 } } });
    const ready = session.dispatch({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 7, rows: 7 }, tickMs: 100, direction: "up",
      snake: [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }]
    } }).snapshot;
    latestSnapshot = ready;
    latestFrameSnapshot = ready;
    acceptSnapshot(ready);
    boardMetrics = getBoardMetrics();
    render();
  });
}

test("an unused shield draws a small blue halo ahead of the head", async ({ page }) => {
  await prepareShieldRun(page);
  const bluePixels = await page.evaluate(() => {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 2] > pixels[index] + 45 && pixels[index + 2] > pixels[index + 1] + 20) count += 1;
    }
    return count;
  });
  expect(bluePixels).toBeGreaterThan(5);
  expect(bluePixels).toBeLessThan(1000);
});

test("the halo follows shield purchases and automatic collision consumption immediately", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(() => {
    cancelAnimationFrame(animationId);
    session = window.IdleSnakeSession.createGameSession({ now: 0, rng: () => 0 });
    dispatchSession({ type: "addSeeds", amount: 1000000 });
    dispatchSession({ type: "buyUpgrade", upgrade: "shield" });
    const afterPurchase = gameView.shieldLevel;
    dispatchSession({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 7, rows: 7 }, tickMs: 100, direction: "up",
      snake: [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }]
    } });
    dispatchSession({ type: "begin" });
    const collision = session.tick(100, { snapshot: "frame" });
    acceptSnapshot(collision.snapshot);
    const staleFullBeforeEvent = latestSnapshot.upgrades.shieldLevel;
    interpretSessionEvents(collision.events);
    return { afterPurchase, staleFullBeforeEvent, afterEvent: gameView.shieldLevel, impact: gameView.shieldImpact };
  });
  expect(result.afterPurchase).toBe(1);
  expect(result.staleFullBeforeEvent).toBe(1);
  expect(result.afterEvent).toBe(0);
  expect(result.impact.ticksRemaining).toBe(3);
});

test("shield collision lunges, waits three ticks, then takes the safe turn", async ({ page }) => {
  await prepareShieldRun(page);
  const result = await page.evaluate(() => {
    const start = { ...gameView.snake[0] };
    const collision = dispatchSession({ type: "direction", direction: "up" });
    interpretSessionEvents(collision.events);
    const impactStart = { ...gameView.shieldImpact };
    acceptSnapshot(session.tick(50, { snapshot: "frame" }).snapshot);
    const lunge = shieldImpactPoint(gameView.snake[0]);
    acceptSnapshot(session.tick(50, { snapshot: "frame" }).snapshot);
    acceptSnapshot(session.tick(100, { snapshot: "frame" }).snapshot);
    acceptSnapshot(session.tick(99, { snapshot: "frame" }).snapshot);
    const beforeTurn = { head: { ...gameView.snake[0] }, impact: { ...gameView.shieldImpact } };
    const turn = session.tick(1, { snapshot: "frame" });
    acceptSnapshot(turn.snapshot);
    return {
      start,
      impactStart,
      lunge,
      beforeTurn,
      afterTurn: { head: { ...gameView.snake[0] }, impact: gameView.shieldImpact, direction: gameView.direction },
      redirected: turn.events.some((event) => event.type === "shieldRedirected")
    };
  });
  expect(result.impactStart.ticksRemaining).toBe(3);
  expect(result.lunge.y).toBeLessThan(result.start.y);
  expect(result.beforeTurn.head).toEqual(result.start);
  expect(result.beforeTurn.impact.ticksRemaining).toBe(1);
  expect(result.afterTurn.head).toEqual({ x: 2, y: 0 });
  expect(result.afterTurn.impact).toBeNull();
  expect(result.afterTurn.direction).toBe("left");
  expect(result.redirected).toBe(true);
});
