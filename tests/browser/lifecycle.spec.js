const { test, expect } = require("@playwright/test");

const saveKey = "snake-forever-save";

function craftedSave(minigamesLevel = 0) {
  return {
    saveVersion: 2,
    savedAt: Date.now(),
    currencies: { seeds: 1e12, provisions: 0, branches: 0 },
    upgrades: { boardLevel: 7, foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0, minigamesLevel },
    board: { selectedBoardLevel: 7, selectedDuelGridSize: 30, mastery: {} },
    records: { best: 0, crossingBest: 0, mazeBest: 0, breakoutBest: 0, runnerBest: 0, sokobanBest: 0, battleshipBest: 0, centipedeBest: 17 },
    settings: { snakeColors: { body: null, head: null } },
    nursery: { nestStartedAt: null, eggElapsedMs: null, nestEggs: [], hatchlings: [], colonyCount: 0, resupplyEggHolding: 0, lastUpdatedAt: Date.now(), seedTickAccumulatorMs: 0, movementAccumulatorMs: 0 },
    habitats: { counts: [10], upgradeLevels: [], lastUpdatedAt: Date.now() }
  };
}

async function openWithSave(browser, save) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [saveKey, JSON.stringify(save)]);
  await page.goto("/", { waitUntil: "networkidle" });
  return { context, page, pageErrors, consoleErrors };
}

test("core Snake pause stays paused and Reset returns to Ready", async ({ browser }) => {
  test.setTimeout(30_000);
  const { context, page, pageErrors, consoleErrors } = await openWithSave(browser, craftedSave());
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Paused");
  const pausedTimer = await page.locator("#timer").textContent();
  // This intentional delay exceeds the visible one-second timer boundary.
  await page.waitForTimeout(1200);
  await expect(page.locator("#timer")).toHaveText(pausedTimer);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#stateText")).not.toHaveText("Paused");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Ready");
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
});

test("keypad has nine paid unlocks and key zero stays free", async ({ browser }) => {
  const locked = await openWithSave(browser, craftedSave(0));
  for (let key = 1; key <= 9; key += 1) await expect(locked.page.locator(`[data-minigame="${key}"]`)).toBeDisabled();
  await expect(locked.page.locator('[data-minigame="0"]')).toBeEnabled();
  await expect(locked.page.locator("#minigamesCurrent")).toHaveText("Unlock phone game 1");
  expect(locked.pageErrors).toEqual([]);
  expect(locked.consoleErrors).toEqual([]);
  await locked.context.close();

  const maxed = await openWithSave(browser, craftedSave(9));
  for (let key = 1; key <= 9; key += 1) await expect(maxed.page.locator(`[data-minigame="${key}"]`)).toBeEnabled();
  await expect(maxed.page.locator("#minigamesCurrent")).toHaveText("9 phone games unlocked");
  await expect(maxed.page.locator("#minigamesButton")).toBeDisabled();
  await expect(maxed.page.locator("#minigamesNext")).toHaveText("Next: Maximum games");
  expect(maxed.pageErrors).toEqual([]);
  expect(maxed.consoleErrors).toEqual([]);
  await maxed.context.close();
});

test("Centipede Reset remains in Centipede and Duel key nine opens Runner", async ({ browser }) => {
  const { context, page, pageErrors, consoleErrors } = await openWithSave(browser, craftedSave(9));
  await page.locator('[data-minigame="9"]').click();
  await expect(page.locator("#stateText")).toHaveText("Centipede · Ready");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Centipede · Ready");
  await page.locator('[data-minigame="1"]').click();
  expect(pageErrors).toEqual([]);
  await expect(page.locator("#stateText")).toHaveText("Vs Snake · Ready");
  await page.locator('[data-minigame="9"]').click();
  await expect(page.locator("#stateText")).toHaveText("Snake Runner · Ready");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Paused");
  const pausedRunnerTimer = await page.locator("#timer").textContent();
  await page.waitForTimeout(1100);
  await expect(page.locator("#timer")).toHaveText(pausedRunnerTimer);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Snake Runner · Ready");
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
});

test("Maze launch, pause, resume, and reset stay session-owned", async ({ browser }) => {
  const { context, page, pageErrors, consoleErrors } = await openWithSave(browser, craftedSave(9));
  await page.locator('[data-minigame="2"]').click();
  await expect(page.locator("#stateText")).toHaveText("Snake Forever · Ready");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Paused");
  const pausedTimer = await page.locator("#timer").textContent();
  await page.waitForTimeout(1100);
  await expect(page.locator("#timer")).toHaveText(pausedTimer);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#stateText")).not.toHaveText("Paused");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Snake Forever · Ready");
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
});

test("Crossing launch, pause, resume, and reset stay session-owned", async ({ browser }) => {
  const { context, page, pageErrors, consoleErrors } = await openWithSave(browser, craftedSave(9));
  await page.locator('[data-minigame="4"]').click();
  await expect(page.locator("#stateText")).toHaveText("Snakeger · Ready");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Paused");
  const pausedTimer = await page.locator("#timer").textContent();
  await page.waitForTimeout(1100);
  await expect(page.locator("#timer")).toHaveText(pausedTimer);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#overlay")).not.toHaveClass(/visible/);
  await expect(page.locator("#gameStatus")).toContainText("Running");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Snakeger · Ready");
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
});

test("Breakout launch, held input release, pause, and reset stay session-owned", async ({ browser }) => {
  const { context, page, pageErrors, consoleErrors } = await openWithSave(browser, craftedSave(9));
  await page.locator('[data-minigame="3"]').click();
  await expect(page.locator("#stateText")).toHaveText("Brick Breakout · Ready");
  await expect(page.locator("#gridLabel")).toHaveText("LIVES 2");

  await page.keyboard.down("ArrowRight");
  await expect(page.locator("#gameStatus")).toContainText("Running");
  await page.waitForTimeout(120);
  await page.keyboard.up("ArrowRight");

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Paused");
  const pausedTimer = await page.locator("#timer").textContent();
  await page.waitForTimeout(1100);
  await expect(page.locator("#timer")).toHaveText(pausedTimer);
  await expect(page.locator("#gridLabel")).toHaveText(/LIVES [12]/);

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#gameStatus")).toContainText("Running");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Brick Breakout · Ready");
  await expect(page.locator("#gridLabel")).toHaveText("LIVES 2");
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
});

test("Broodline launch, direction, pause, resume, and reset stay session-owned", async ({ browser }) => {
  const { context, page, pageErrors, consoleErrors } = await openWithSave(browser, craftedSave(9));
  await page.locator('[data-minigame="7"]').click();
  await expect(page.locator("#stateText")).toHaveText("Broodline · Round 1");
  await expect(page.locator("#gridLabel")).toHaveText("R1");

  await page.keyboard.press("ArrowUp");
  await expect(page.locator("#gameStatus")).toContainText("Running");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Paused");
  const pausedTimer = await page.locator("#timer").textContent();
  await page.waitForTimeout(1100);
  await expect(page.locator("#timer")).toHaveText(pausedTimer);

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#gameStatus")).toContainText("Running");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Broodline · Round 1");
  await expect(page.locator("#gridLabel")).toHaveText("R1");
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
});
