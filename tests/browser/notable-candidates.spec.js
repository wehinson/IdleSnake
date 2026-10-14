const { test, expect } = require("@playwright/test");
const { createGameSession } = require("../../engine/session.js");

const saveKey = "snake-forever-save";

function notable(id, name, status) {
  return {
    id, name, epithet: "", createdAt: 1, sourceType: "TEST", sourceReference: "Queue",
    powerType: "PRODUCTION_INCREASE", powerMagnitude: 0.15, status,
    assignedHabitatId: null, hasServed: false, habitatsServed: [], retiredAt: null,
    lastAssignedHabitatId: null, totalServiceTime: 0, totalProductionAdded: 0,
    totalConsumptionPrevented: 0, totalCapacityEnabled: 0,
    totalProvisionsForaged: 0, totalShortageOutputPreserved: 0
  };
}

test("candidate decisions advance sequentially without losing the pending queue", async ({ page }) => {
  const save = createGameSession({ now: 1 }).serialize();
  save.session.notables.retained = [notable("leader-1", "Leader", "INACTIVE")];
  save.session.notables.pending = Array.from({ length: 7 }, (_, index) => notable(`candidate-${index + 1}`, `Candidate ${index + 1}`, "PENDING"));
  const grasslands = save.session.migration.settlements.find((item) => item.id === "grasslands");
  grasslands.economy.notables = save.session.notables;
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [saveKey, JSON.stringify(save)]);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('[data-menu-tab="colony"]').click();
  await page.locator("#notablesButton").click();

  await expect(page.locator("#notablesSummary")).toHaveText("(1/1)");
  await expect(page.locator("#pendingNotable .is-pending")).toHaveCount(1);
  await expect(page.locator("#pendingNotable").getByRole("button", { name: "Keep", exact: true })).toBeDisabled();
  for (let index = 1; index <= 7; index += 1) {
    await expect(page.locator("#pendingNotable .is-pending > strong")).toHaveText(`Candidate ${index}`);
    await expect(page.locator("#notablesPendingIndicator")).toHaveText(`${8 - index} Pending`);
    await page.locator("#pendingNotable").getByRole("button", { name: "Reject", exact: true }).click();
  }
  await expect(page.locator("#candidateDecision")).toBeHidden();
  await expect(page.locator("#pendingNotable")).toBeEmpty();
  await expect(page.locator("#notablesPendingIndicator")).toBeHidden();
  await expect(page.locator("#notablesRoster")).toContainText("Leader");
});

test("a candidate enters the Notable roster only after Keep", async ({ page }) => {
  const save = createGameSession({ now: 1 }).serialize();
  save.session.notables.retained = [];
  save.session.notables.pending = [notable("candidate-1", "Candidate 1", "PENDING")];
  const grasslands = save.session.migration.settlements.find((item) => item.id === "grasslands");
  grasslands.economy.notables = save.session.notables;
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [saveKey, JSON.stringify(save)]);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('[data-menu-tab="colony"]').click();
  await expect(page.locator("#notablesButton")).toContainText("0 / 1");
  await page.locator("#notablesButton").click();
  await expect(page.locator("#candidateDecision")).toBeVisible();
  await expect(page.locator("#notablesRoster")).toContainText("No retained Notables");
  await page.locator("#pendingNotable").getByRole("button", { name: "Keep", exact: true }).click();
  await expect(page.locator("#candidateDecision")).toBeHidden();
  await expect(page.locator("#notablesSummary")).toHaveText("(1/1)");
  await expect(page.locator("#notablesRoster")).toContainText("Candidate 1");
});
