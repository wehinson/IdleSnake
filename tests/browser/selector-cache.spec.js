const { test, expect } = require("@playwright/test");

test("panel refreshes keep board options until unlocks or mastery change", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(() => {
    cancelAnimationFrame(animationId);
    syncBoardSizeSelect();
    const first = boardSizeSelect.firstElementChild;
    for (let index = 0; index < 4; index += 1) {
      refreshPanelSnapshot(Date.now(), session.snapshot());
      syncBoardSizeSelect();
    }
    const retained = first === boardSizeSelect.firstElementChild;
    const snapshot = JSON.parse(JSON.stringify(session.snapshot()));
    snapshot.notables.masteryRewardsClaimed["snake-board-5x8"] = true;
    refreshPanelSnapshot(Date.now(), snapshot);
    syncBoardSizeSelect();
    const marked = boardSizeSelect.firstElementChild.textContent;
    snapshot.upgrades.boardLevel = 1;
    snapshot.selectedBoardLevel = 1;
    refreshPanelSnapshot(Date.now(), snapshot);
    syncBoardSizeSelect();
    return { retained, marked, count: boardSizeSelect.options.length, selected: boardSizeSelect.value };
  });
  expect(result).toEqual({ retained: true, marked: "♛ 5x8", count: 2, selected: "1" });
});
