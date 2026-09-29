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

test("candidate queue pages five at a time and resolves the selected candidate", async ({ page }) => {
  const save = createGameSession({ now: 1 }).serialize();
  save.session.notables.retained = [notable("leader-1", "Leader", "INACTIVE")];
  save.session.notables.pending = Array.from({ length: 7 }, (_, index) => notable(`candidate-${index + 1}`, `Candidate ${index + 1}`, "PENDING"));
  const grasslands = save.session.migration.settlements.find((item) => item.id === "grasslands");
  grasslands.economy.notables = save.session.notables;
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [saveKey, JSON.stringify(save)]);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('[data-menu-tab="colony"]').click();
  await page.locator("#notablesButton").click();

  await expect(page.locator("#candidateQueueSummary")).toHaveText("7 waiting");
  await expect(page.locator(".candidate-list-item")).toHaveCount(5);
  await expect(page.locator("#candidatePageStatus")).toHaveText("Page 1 of 2");
  await expect(page.locator("#pendingNotable")).toContainText("Candidate 1");

  await page.locator("#candidateNextPage").click();
  await expect(page.locator(".candidate-list-item")).toHaveCount(2);
  await expect(page.locator("#pendingNotable")).toContainText("Candidate 6");
  await page.getByRole("button", { name: "Candidate 7" }).click();
  await expect(page.locator("#pendingNotable")).toContainText("Candidate 7");
  await page.locator("#pendingNotable").getByRole("button", { name: "Reject" }).click();

  await expect(page.locator("#candidateQueueSummary")).toHaveText("6 waiting");
  await expect(page.locator(".candidate-list-item")).toHaveCount(1);
  await expect(page.locator("#pendingNotable")).toContainText("Candidate 6");
  await expect(page.getByRole("button", { name: "Candidate 7" })).toHaveCount(0);
  await page.locator("#pendingNotable").getByRole("button", { name: "Reject" }).click();
  await expect(page.locator("#candidateQueueSummary")).toHaveText("5 waiting");
  await expect(page.locator(".candidate-list-item")).toHaveCount(5);
  await expect(page.locator("#candidatePagination")).toBeHidden();
});

test("a candidate enters the Notable roster only after Accept", async ({ page }) => {
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
  await expect(page.locator("#candidateQueueSummary")).toHaveText("1 waiting");
  await expect(page.locator("#notablesRoster")).toContainText("No retained Notables");
  await page.locator("#pendingNotable").getByRole("button", { name: "Accept" }).click();
  await expect(page.locator("#candidateQueueSummary")).toHaveText("0 waiting");
  await expect(page.locator("#notablesRoster")).toContainText("Candidate 1");
});
