const { test, expect } = require("@playwright/test");

const saveKey = "snake-forever-save";

function battleshipSave() {
  return {
    saveVersion: 2, savedAt: Date.now(),
    currencies: { seeds: 100, provisions: 0, branches: 0 },
    upgrades: { boardLevel: 0, foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0, minigamesLevel: 9 },
    board: { selectedBoardLevel: 0, selectedDuelGridSize: 30, mastery: {} },
    records: { best: 11, crossingBest: 0, mazeBest: 0, breakoutBest: 0, runnerBest: 0, sokobanBest: 0, battleshipBest: 4, centipedeBest: 0 },
    settings: { snakeColors: { body: null, head: null } },
    nursery: { nestStartedAt: null, eggElapsedMs: null, nestEggs: [], hatchlings: [], colonyCount: 0, resupplyEggHolding: 0, lastUpdatedAt: Date.now(), seedTickAccumulatorMs: 0, movementAccumulatorMs: 0 },
    habitats: { counts: [], upgradeLevels: [], lastUpdatedAt: Date.now() }
  };
}

async function clickBattleshipCell(page, board, x, y) {
  const canvas = page.locator("#game");
  const box = await canvas.boundingBox();
  const { width, height, layout } = await canvas.evaluate((element) => ({
    width: element.width, height: element.height,
    layout: window.IdleSnakeMinigameFeedback.strikeLayout(element.width, element.height)
  }));
  const px = layout[`${board}X`] + (x + 0.5) * layout.size;
  const py = layout[`${board}Y`] + (y + 0.5) * layout.size;
  await canvas.click({ position: { x: px * box.width / width, y: py * box.height / height } });
}

test("Battleship pointer placement, lifecycle, delayed AI, and reset are session-owned", async ({ browser }) => {
  test.setTimeout(30_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = []; const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.addInitScript(([key, save]) => localStorage.setItem(key, save), [saveKey, JSON.stringify(battleshipSave())]);
  await page.goto("/", { waitUntil: "networkidle" });

  await page.locator('[data-minigame="8"]').click();
  await expect(page.locator("#screenHint")).toContainText("Place the Titanoboa");
  await expect(page.locator("#best")).toHaveText("004");

  // During placement Pause is the session-routed rotate command. Keep the
  // fleet vertical and place each ship in a separate column through the canvas.
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  for (let x = 0; x < 5; x += 1) await clickBattleshipCell(page, "player", x, 0);
  await expect(page.locator("#screenHint")).toContainText("Fleet ready");

  await clickBattleshipCell(page, "enemy", 5, 5);
  await expect(page.locator("#gameStatus")).toContainText("Running");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator("#stateText")).toHaveText("Paused");
  const pausedTimer = await page.locator("#timer").textContent();
  await page.waitForTimeout(900);
  await expect(page.locator("#timer")).toHaveText(pausedTimer || "00:00");
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  await clickBattleshipCell(page, "enemy", 9, 9);
  await expect(page.locator("#screenHint")).toHaveText(/^Your strike J10: (?:HIT|MISS|SUNK .+)$/);
  await expect(page.locator("#battleshipFeedback")).toContainText(/^Your strike J10: (?:HIT|MISS|SUNK[^\n]+)(?:\n|$)/);
  await page.waitForTimeout(750);
  await expect(page.locator("#screenHint")).toHaveText(/^Enemy strike [A-J](?:10|[1-9]): (?:HIT|MISS|SUNK .+)$/);
  // The delayed enemy response changes the hint, while the status retains both shots.
  await expect(page.locator("#battleshipFeedback")).toHaveText(/^Your strike J10: (?:HIT|MISS|SUNK[^\n]+)\nEnemy strike [A-J](?:10|[1-9]): (?:HIT|MISS|SUNK[^\n]+)$/);

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#screenHint")).toContainText("Place the Titanoboa");
  await expect(page.locator("#battleshipFeedback")).toHaveText("");
  await expect(page.locator("#score")).toHaveText("000");
  await expect(page.locator("#best")).toHaveText("004");
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
});
