const { test, expect } = require("@playwright/test");

const saveKey = "snake-forever-save";

function puzzleSave() {
  return {
    saveVersion: 2, savedAt: Date.now(),
    currencies: { seeds: 100, provisions: 0, branches: 0 },
    upgrades: { boardLevel: 0, foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0, minigamesLevel: 6 },
    board: { selectedBoardLevel: 0, selectedDuelGridSize: 30, mastery: {} },
    records: { best: 13, crossingBest: 0, mazeBest: 0, breakoutBest: 0, runnerBest: 0, sokobanBest: 0, battleshipBest: 0, centipedeBest: 0 },
    settings: { snakeColors: { body: null, head: null } },
    nursery: { nestStartedAt: null, eggElapsedMs: null, nestEggs: [], hatchlings: [], colonyCount: 0, resupplyEggHolding: 0, lastUpdatedAt: Date.now(), seedTickAccumulatorMs: 0, movementAccumulatorMs: 0 },
    habitats: { counts: [], upgradeLevels: [], lastUpdatedAt: Date.now() },
    snakebird: { unlockedLevel: 1, clearedLevels: [], bestMoves: [], lastSelectedLevel: 1 }
  };
}

async function openPuzzlePage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = []; const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem("puzzle-mode-fixture")) {
      localStorage.setItem(key, value);
      sessionStorage.setItem("puzzle-mode-fixture", "1");
    }
  }, [saveKey, JSON.stringify(puzzleSave())]);
  await page.goto("/", { waitUntil: "networkidle" });
  return { context, page, pageErrors, consoleErrors };
}

test("Snakebird and Sokoban use session-routed input, lifecycle, records, and persistence", async ({ browser }) => {
  test.setTimeout(30_000);
  const { context, page, pageErrors, consoleErrors } = await openPuzzlePage(browser);
  await expect(page.locator('[data-minigame="5"]')).toBeEnabled();
  await expect(page.locator('[data-minigame="6"]')).toBeEnabled();

  await page.locator('[data-minigame="5"]').click();
  await expect(page.locator("#stateText")).toContainText("Ready");
  const movesBefore = await page.locator("#score").textContent();
  await page.keyboard.press("ArrowRight"); // body-blocked on every shipped ready board
  await expect(page.locator("#score")).toHaveText(movesBefore || "0");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#score")).not.toHaveText(movesBefore || "0");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Paused");
  const pausedMoves = await page.locator("#score").textContent();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#score")).toHaveText(pausedMoves || "0");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#stateText")).toContainText("Ready");

  await page.locator('[data-minigame="6"]').click();
  await expect(page.locator("#stateText")).toContainText("Ready");
  await page.keyboard.press("ArrowLeft"); // body-blocked: Ready is preserved
  await expect(page.locator("#stateText")).toContainText("Ready");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#score")).not.toHaveText("0");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const pausedScore = await page.locator("#score").textContent();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#score")).toHaveText(pausedScore || "0");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#stateText")).toContainText("Ready");

  // First Push: navigate behind the crate, then push it right onto its goal.
  for (const key of ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowUp", "ArrowUp", "ArrowUp", "ArrowUp", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"]) await page.keyboard.press(key);
  await expect(page.locator("#stateText")).toContainText("Clear");
  await expect(page.locator("#best")).not.toHaveText("13");
  await page.waitForTimeout(1600);
  let saved = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), saveKey));
  expect(saved.session.records.sokobanBest).toBeGreaterThan(0);
  await page.locator('[data-minigame="0"]').click();
  await expect(page.locator("#stateText")).toContainText("Ready");
  await page.reload({ waitUntil: "networkidle" });
  saved = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), saveKey));
  expect(saved.session.best).toBe(13);
  expect(saved.session.records.sokobanBest).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
});
