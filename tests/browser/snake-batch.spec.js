const { test, expect } = require("@playwright/test");

test("reload keeps the Ready and paused Classic board, food and run countdown", async ({ page }) => {
  await page.goto("/");
  const before = await page.evaluate(() => {
    persistConsolidatedSave(); flushPendingSaves();
    const s = session.snapshot();
    return { body: s.active.snake, foods: s.active.foods, countdown: s.eggBoardCountdown };
  });
  await page.reload();
  expect(await page.evaluate(() => {
    const s = session.snapshot();
    return { body: s.active.snake, foods: s.active.foods, countdown: s.eggBoardCountdown };
  })).toEqual(before);
  const paused = await page.evaluate(() => {
    dispatchSession({ type: "direction", direction: "right" });
    dispatchSession({ type: "pause" });
    persistConsolidatedSave(); flushPendingSaves();
    return session.snapshot().active;
  });
  await page.reload();
  await expect(page.locator("#stateText")).toHaveText("Paused");
  expect(await page.evaluate(() => session.snapshot().active)).toEqual(paused);
});

test("leaving focus and the tab lets Classic Snake die", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => {
    presentGameResult(dispatchSession({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "up",
      snake: [{ x: 10, y: 1 }, { x: 10, y: 2 }, { x: 10, y: 3 }]
    } }));
    presentGameResult(dispatchSession({ type: "begin" }));
    idleLastWallAt = Date.now();
  });
  const away = await context.newPage();
  await away.goto("about:blank"); await away.bringToFront();
  // Covers frame suspension and timer throttling in a real background tab.
  await away.waitForTimeout(1500);
  await page.bringToFront();
  await expect(page.locator("#stateText")).toHaveText("Game Over");
  expect(await page.evaluate(() => session.snapshot().phase)).toBe("gameover");
  await away.close();
});

test("an arrow that advances time through death cannot reset the run; the lock lasts one second", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(() => {
    dispatchSession({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "up",
      snake: [{ x: 10, y: 0 }, { x: 10, y: 1 }, { x: 10, y: 2 }]
    } });
    dispatchSession({ type: "direction", direction: "up" });
    directionInputLockedUntil = 0;
    idleLastWallAt = Date.now() - 150;
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight", bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight", bubbles: true }));
    return { phase: session.snapshot().phase, lockRemaining: directionInputLockedUntil - Date.now() };
  });
  expect(result.phase).toBe("gameover");
  expect(result.lockRemaining).toBeGreaterThan(950);
  await expect(page.locator("#overlay")).toContainText("Game Over");
  await page.keyboard.press("ArrowLeft");
  expect(await page.evaluate(() => session.snapshot().phase)).toBe("gameover");
  await page.waitForTimeout(1100);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#stateText")).toHaveText("Ready");
});

test("the keyboard forwards input timestamps and corrects a turn processed after its deadline", async ({ page }) => {
  await page.goto("/");
  const state = await page.evaluate(() => {
    cancelAnimationFrame(animationId);
    const base = Date.now() - 210;
    session = IdleSnakeSession.createGameSession({ now: base, rng: () => 0.5 });
    dispatchSession({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 20 }, tickMs: 200, direction: "up",
      snake: [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }]
    } });
    dispatchSession({ type: "begin" });
    idleLastWallAt = base;
    const event = new KeyboardEvent("keydown", { code: "ArrowRight", bubbles: true });
    Object.defineProperty(event, "timeStamp", { value: performance.now() - (Date.now() - base - 199) });
    document.dispatchEvent(event);
    return session.snapshot();
  });
  expect(state.active.snake[0]).toEqual({ x: 11, y: 10 });
  expect(state.active.directionQueue).toEqual([]);
  expect(state.active.tickMs).toBe(200);
  expect(state.modeAccumulatorMs).toBeGreaterThanOrEqual(10);
  expect(state.modeAccumulatorMs).toBeLessThanOrEqual(34);
});

test("nursery feeding button is between the counter and title, saves its pause, and resumes growth", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    dispatchSession({ type: "addDevelopmentHatchling" });
    dispatchSession({ type: "addSeeds", amount: 1000 });
    setMenuTab("nursery"); syncPanels();
  });
  const button = page.locator("#pauseFeedingButton");
  await expect(button).toHaveText("Pause feeding");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  const counterBox = await page.locator("#nurseryCapacity").boundingBox();
  const buttonBox = await button.boundingBox();
  const titleBox = await page.locator(".nursery-yard-card strong").boundingBox();
  expect(counterBox.x + counterBox.width).toBeLessThanOrEqual(buttonBox.x);
  expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(titleBox.x);
  const paused = await page.evaluate(() => {
    const before = session.snapshot();
    acceptSnapshot(session.tick(600000).snapshot); syncPanels();
    persistConsolidatedSave(); flushPendingSaves();
    const after = session.snapshot();
    return { before: { seeds: before.seeds, growth: before.nursery.hatchlings[0].progressMs },
      after: { seeds: after.seeds, growth: after.nursery.hatchlings[0].progressMs } };
  });
  expect(paused.after).toEqual(paused.before);
  await page.screenshot({ path: test.info().outputPath("nursery-pause.png") });
  await page.reload();
  await page.evaluate(() => setMenuTab("nursery"));
  const resume = page.getByRole("button", { name: "Resume feeding", exact: true });
  await expect(resume).toHaveAttribute("aria-pressed", "true");
  await resume.click();
  const resumed = await page.evaluate(() => {
    const before = session.snapshot();
    const after = session.tick(900).snapshot;
    return { spent: before.seeds - after.seeds, count: before.nursery.hatchlings.length,
      grown: after.nursery.hatchlings[0].progressMs - before.nursery.hatchlings[0].progressMs };
  });
  expect(resumed.spent).toBe(resumed.count); expect(resumed.grown).toBe(900);
});
