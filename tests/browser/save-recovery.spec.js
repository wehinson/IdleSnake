const { test, expect } = require("@playwright/test");

const saveKey = "snake-forever-save";
const backupKey = `${saveKey}:backup`;
function save(seeds = 25) {
  return { saveVersion: 2, savedAt: Date.now(), currencies: { seeds, provisions: 0, branches: 0 }, upgrades: {}, board: {}, records: { best: 0 }, settings: {}, nursery: { hatchlings: [], resupplyEggHolding: 3 }, habitats: { counts: [], upgradeLevels: [] }, notables: {}, snakebird: {}, eggBoardCountdown: 7 };
}
function savedSeeds(candidate) {
  return candidate.saveVersion === 5 ? candidate.session.seeds : candidate.currencies.seeds;
}
async function openSaveData(page) {
  await page.getByRole("button", { name: "Personalization" }).click();
  await page.getByRole("button", { name: "Save data" }).click();
}

test("rejects future and malformed imports without changing the primary save", async ({ browser }) => {
  const context = await browser.newContext(); const page = await context.newPage(); const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [saveKey, JSON.stringify(save(81))]);
  await page.goto("/", { waitUntil: "networkidle" }); await openSaveData(page);
  for (const candidate of [{ ...save(900), saveVersion: 3 }, { ...save(900), nursery: [] }]) {
    await page.getByRole("textbox", { name: "Save data import" }).fill(JSON.stringify(candidate));
    await page.getByRole("button", { name: "Import", exact: true }).click();
  }
  await expect(page.getByText("Invalid save structure.")).toBeVisible();
  expect(savedSeeds(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), saveKey)))).toBe(81);
  expect(errors).toEqual([]); await context.close();
});

test("recovers a valid backup when primary data is invalid", async ({ browser }) => {
  const context = await browser.newContext(); const page = await context.newPage(); const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(([primary, backup, value]) => { localStorage.setItem(primary, "{bad"); localStorage.setItem(backup, value); }, [saveKey, backupKey, JSON.stringify(save(64))]);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByText("Backup save recovered.")).toBeVisible();
  await openSaveData(page);
  const exported = JSON.parse(await page.getByRole("textbox", { name: "Save data export" }).inputValue());
  expect(exported.saveVersion).toBe(5);
  expect(savedSeeds(exported)).toBe(64);
  expect(savedSeeds(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), saveKey)))).toBe(64);
  expect(errors).toEqual([]); await context.close();
});

test("rolls back an import when isolated storage writes fail", async ({ browser }) => {
  const context = await browser.newContext(); const page = await context.newPage(); const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [saveKey, JSON.stringify(save(44))]);
  await page.goto("/", { waitUntil: "networkidle" }); await openSaveData(page);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(name, value) {
      if (name === key) throw new DOMException("quota", "QuotaExceededError");
      return original.call(this, name, value);
    };
  }, saveKey);
  await page.getByRole("textbox", { name: "Save data import" }).fill(JSON.stringify(save(900)));
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByText("Storage quota exceeded; progress could not be saved.")).toBeVisible();
  expect(savedSeeds(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), saveKey)))).toBe(44);
  expect(errors).toEqual([]); await context.close();
});

test("falls back safely when both primary and backup are unusable", async ({ browser }) => {
  const context = await browser.newContext(); const page = await context.newPage(); const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(([primary, backup]) => { localStorage.setItem(primary, "[]"); localStorage.setItem(backup, "null"); }, [saveKey, backupKey]);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByText("Stored progress could not be recovered.")).toBeVisible();
  expect(errors).toEqual([]); await context.close();
});
