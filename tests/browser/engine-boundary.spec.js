const { test, expect } = require("@playwright/test");
const { createGameSession } = require("../../engine/session.js");

test("browser controls and headless controls produce the same engine state in every mode", async ({ page }) => {
  let seed = 42;
  const game = createGameSession({ now: 0, rng: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) });
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    window.setInterval = () => 0;
  });
  await page.goto("/");
  await page.evaluate(() => {
    cancelAnimationFrame(animationId);
    let seed = 42;
    session = window.IdleSnakeSession.createGameSession({ now: 0, rng: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) });
    acceptSnapshot(session.snapshot());
  });
  for (const mode of game.snapshot().supportedModes) {
    const actions = [{ type: "launchGame", mode, force: true }];
    if (mode === "battleship") actions.push({ type: "battleshipShuffle" });
    actions.push({ type: "primaryAction" }, { type: "togglePause" }, { type: "togglePause" }, { type: "resetRun" });
    for (const action of actions) {
      game.dispatch(action);
      // Persistence credits settlement statistics. Compare after both hosts
      // flush a save, rather than letting a browser timer choose the boundary.
      game.serialize();
      const expected = game.snapshot();
      const actual = await page.evaluate((action) => {
        presentGameResult(dispatchSession(action));
        flushPendingSaves();
        const snapshot = session.snapshot();
        return { snapshot, mode: gameView.gameMode, phase: gameView.state, seeds: gameView.seedsTotal };
      }, action);
      expect(actual.snapshot).toEqual(expected);
      expect(actual.mode).toBe(expected.mode);
      expect(actual.phase).toBe(expected.phase);
      expect(actual.seeds).toBe(expected.seeds);
    }
  }
});
