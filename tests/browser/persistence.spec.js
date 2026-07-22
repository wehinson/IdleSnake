const { test, expect } = require("@playwright/test");

const saveKey = "snake-forever-save";

function craftedSave() {
  return {
    saveVersion: 2,
    savedAt: Date.now(),
    currencies: { seeds: 100, provisions: 5, branches: 7 },
    upgrades: { boardLevel: 0, foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0, minigamesLevel: 0 },
    board: { selectedBoardLevel: 0, selectedDuelGridSize: 30, mastery: {} },
    records: { best: 0, crossingBest: 0, mazeBest: 0, breakoutBest: 0, runnerBest: 0, sokobanBest: 0, battleshipBest: 12, centipedeBest: 0 },
    settings: { snakeColors: { body: null, head: null } },
    nursery: { nestStartedAt: null, eggElapsedMs: 0, nestEggs: [], hatchlings: [], colonyCount: 0, resupplyEggHolding: 3, lastUpdatedAt: Date.now(), seedTickAccumulatorMs: 0, movementAccumulatorMs: 0 },
    habitats: { counts: [], upgradeLevels: [], lastUpdatedAt: Date.now() },
    eggBoardCountdown: 77
  };
}

async function openSaveData(page) {
  await page.getByRole("button", { name: "Personalization" }).click();
  await page.getByRole("button", { name: "Save data" }).click();
  await expect(page.getByRole("textbox", { name: "Save data export" })).toBeVisible();
}

test("consolidated persistence retains held eggs, Battleship wins, and the egg-board countdown", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem("idlesnake-persistence-fixture")) {
      localStorage.setItem(key, value);
      sessionStorage.setItem("idlesnake-persistence-fixture", "1");
    }
  }, [saveKey, JSON.stringify(craftedSave())]);
  await page.goto("/", { waitUntil: "networkidle" });
  await openSaveData(page);
  const exported = JSON.parse(await page.getByRole("textbox", { name: "Save data export" }).inputValue());
  expect(exported.saveVersion).toBe(5);
  expect(exported.session.records.battleshipBest).toBe(12);
  expect(exported.session.nursery.resupplyEggHolding).toBe(3);
  expect(exported.session.eggBoardCountdown).toBe(76);

  await page.getByRole("textbox", { name: "Save data import" }).fill(JSON.stringify(exported));
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByText("Import successful.")).toBeVisible();
  const automatic = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), saveKey));
  expect(automatic.saveVersion).toBe(5);
  expect(automatic.session.records.battleshipBest).toBe(12);
  expect(automatic.session.nursery.resupplyEggHolding).toBe(3);
  expect(automatic.session.eggBoardCountdown).toBe(75);

  await page.reload({ waitUntil: "networkidle" });
  await openSaveData(page);
  const reexported = JSON.parse(await page.getByRole("textbox", { name: "Save data export" }).inputValue());
  expect(reexported.saveVersion).toBe(5);
  expect(reexported.session.records.battleshipBest).toBe(12);
  expect(reexported.session.nursery.resupplyEggHolding).toBe(3);
  expect(reexported.session.eggBoardCountdown).toBe(74);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
});

test("oversized histories export only recent details while keeping lifetime totals", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const save = craftedSave();
  save.migration = {
    completedMigrations: Array.from({ length: 60 }, (_, index) => ({ id: `migration-${index + 1}` })),
    failedMigrations: [], returnedMigrations: [], historyTotals: { completed: 75, failed: 4, returned: 2 }
  };
  save.completedResupplyMissions = Array.from({ length: 60 }, (_, index) => ({ id: `resupply-${index + 1}`, notableIds: [], adultCount: 1, eggCount: 0, provisionsConsumed: 2 }));
  save.resupplyTotals = { completedMissions: 80, notablesDelivered: 5, adultsDelivered: 90, eggsDelivered: 3, provisionsConsumed: 250 };
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [saveKey, JSON.stringify(save)]);

  await page.goto("/", { waitUntil: "networkidle" });
  await openSaveData(page);
  const exported = JSON.parse(await page.getByRole("textbox", { name: "Save data export" }).inputValue());
  expect(exported.saveVersion).toBe(5);
  expect(exported.session.migration.completedMigrations).toHaveLength(50);
  expect(exported.session.migration.completedMigrations[0].id).toBe("migration-11");
  expect(exported.session.migration.historyTotals).toEqual({ completed: 75, failed: 4, returned: 2 });
  expect(exported.session.completedResupplyMissions).toHaveLength(50);
  expect(exported.session.completedResupplyMissions[0].id).toBe("resupply-11");
  expect(exported.session.resupplyTotals).toEqual({ completedMissions: 80, notablesDelivered: 5, adultsDelivered: 90, eggsDelivered: 3, provisionsConsumed: 250 });
  await context.close();
});
