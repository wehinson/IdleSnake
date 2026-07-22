const { test, expect } = require("@playwright/test");

const saveKey = "snake-forever-save";

function foundingSave() {
  const nursery = { nestStartedAt: null, eggElapsedMs: null, nestEggs: [], hatchlings: [], colonyCount: 5, resupplyEggHolding: 0, lastUpdatedAt: Date.now(), seedTickAccumulatorMs: 0, movementAccumulatorMs: 0 };
  const habitats = { counts: Array(8).fill(0), upgradeLevels: Array(8).fill(0), lastUpdatedAt: Date.now() };
  const notables = { retained: [], elders: [], pending: [], dismissedCount: 0, directRecruitmentsCompleted: 0, masteryRewardsClaimed: {}, nextId: 1 };
  const economy = { seeds: 1e8, branches: 1e8, provisions: 0, best: 0, upgrades: { boardLevel: 0, foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0, minigamesLevel: 0 }, selectedBoardLevel: 0, nursery, habitats, notables };
  return {
    saveVersion: 2, savedAt: Date.now(), currencies: { seeds: 1e8, provisions: 0, branches: 1e8 }, upgrades: economy.upgrades,
    board: { selectedBoardLevel: 0, selectedDuelGridSize: 30, mastery: {} }, records: { best: 0 }, settings: { snakeColors: { body: null, head: null } }, nursery, habitats, notables,
    migration: { activeSettlementId: "wetlands", settlements: [
      { id: "grasslands", name: "Grasslands", status: "established", economy },
      { id: "wetlands", name: "Wetlands", status: "founding", foundingRemainingMs: 600000, economy }
    ] }
  };
}

test("founding disables unavailable features but leaves permitted upgrades available", async ({ browser }) => {
  const context = await browser.newContext(); const page = await context.newPage(); const pageErrors = []; const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [saveKey, JSON.stringify(foundingSave())]);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator('[data-menu-tab="nursery"]')).toBeDisabled();
  await expect(page.locator('[data-menu-tab="colony"]')).toBeDisabled();
  await expect(page.locator("#minigamesButton")).toBeDisabled();
  await expect(page.locator("#minigamesButton")).toHaveText("Unavailable while founding");
  await expect(page.locator("#boardUpgradeButton")).toBeEnabled();
  expect(pageErrors).toEqual([]); expect(consoleErrors).toEqual([]);
  await context.close();
});
