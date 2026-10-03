const { test, expect } = require("@playwright/test");

test("panel refresh skips hidden content and refreshes each opened panel", async ({ page }) => {
  await page.goto("/");
  const counts = await page.evaluate(() => {
    cancelAnimationFrame(animationId);
    const calls = { nursery: 0, upgrades: 0, habitats: 0, migration: 0 };
    for (const [name, key] of Object.entries({ syncNurseryPanel: "nursery", syncUpgradeMenu: "upgrades", renderHabitats: "habitats", syncMigrationPanel: "migration" })) {
      const original = window[name];
      window[name] = (...args) => { calls[key]++; return original(...args); };
    }
    setMenuTab("upgrades");
    for (const key in calls) calls[key] = 0;
    syncPanels();
    const upgrades = { ...calls };
    for (const key in calls) calls[key] = 0;
    setMenuTab("nursery");
    const nursery = { ...calls };
    for (const key in calls) calls[key] = 0;
    setMenuTab("colony");
    const colony = { ...calls };
    const snapshot = JSON.parse(JSON.stringify(session.snapshot()));
    snapshot.upgrades.minigamesLevel = 1;
    snapshot.upgrades.boardLevel = 6;
    refreshPanelSnapshot(Date.now(), snapshot);
    syncPanels();
    return { upgrades, nursery, colony,
      minigameEnabled: !document.querySelector('[data-minigame="1"]').disabled,
      fullscreenVisible: !document.querySelector('#fullscreenModeButton').hidden };
  });
  expect(counts.upgrades).toEqual({ nursery: 0, upgrades: 1, habitats: 0, migration: 0 });
  expect(counts.nursery).toEqual({ nursery: 1, upgrades: 0, habitats: 0, migration: 0 });
  expect(counts.colony.habitats).toBeGreaterThan(0);
  expect(counts.colony.nursery + counts.colony.upgrades + counts.colony.migration).toBe(0);
  expect(counts.minigameEnabled).toBe(true);
  expect(counts.fullscreenVisible).toBe(true);
});
