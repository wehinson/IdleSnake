const { test, expect } = require("@playwright/test");

test("unchanged HUD and minigame keys do not mutate on refresh", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const mutations = await page.evaluate(() => {
    syncHud();
    syncMinigameKeys();
    const hud = new MutationObserver(() => {});
    const keys = new MutationObserver(() => {});
    hud.observe(document.querySelector(".status-strip"), { attributes: true, childList: true, characterData: true, subtree: true });
    hud.observe(document.querySelector("#pauseButton"), { attributes: true, childList: true, characterData: true, subtree: true });
    document.querySelectorAll(".minigame-key").forEach((key) =>
      keys.observe(key, { attributes: true, childList: true, characterData: true, subtree: true }));
    for (let index = 0; index < 20; index += 1) {
      syncHud();
      syncMinigameKeys();
    }
    return { hud: hud.takeRecords().length, keys: keys.takeRecords().length };
  });
  expect(mutations).toEqual({ hud: 0, keys: 0 });
});
