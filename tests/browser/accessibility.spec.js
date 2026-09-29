const { test, expect } = require("@playwright/test");

test("phone controls do not show the browser's white focus ring", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const settingsKey = page.locator('[data-minigame="0"]');
  await settingsKey.click();
  await page.keyboard.press("ArrowUp");
  await expect(settingsKey).toBeFocused();
  await expect(settingsKey).toHaveCSS("outline-style", "none");
});

test("reduced motion persists and game canvas exposes concise state", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('[data-minigame="0"]').click();
  const toggle = page.getByRole("button", { name: /Reduced motion/ });
  await toggle.focus(); await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "true");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-minigame="0"]').click(); await expect(page.getByRole("button", { name: /Reduced motion: On/ })).toBeVisible();
  await expect(page.locator("#game")).toHaveAttribute("role", "img");
  await expect(page.locator("#game")).toHaveAttribute("aria-describedby", "gameStatus");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator("#gameStatus")).not.toHaveText("");
});

test("reduced motion stops the swallowed seed and clears effects already playing", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('[data-minigame="0"]').click();
  await page.evaluate(() => {
    startDigestionAnimation();
    crumbAnimations.push({ startedAt: performance.now() });
    tailWiggleStartedAt = performance.now();
  });
  expect(await page.evaluate(() => digestionAnimations.length)).toBe(1);

  await page.getByRole("button", { name: "Reduced motion: Off" }).click();
  expect(await page.evaluate(() => {
    startDigestionAnimation();
    return { digestion: digestionAnimations.length, crumbs: crumbAnimations.length, tail: tailWiggleStartedAt, pulse: digestionPulseForSegment(1, performance.now()) };
  })).toEqual({ digestion: 0, crumbs: 0, tail: null, pulse: 0 });

  await page.getByRole("button", { name: "Reduced motion: On" }).click();
  expect(await page.evaluate(() => {
    startDigestionAnimation();
    return digestionAnimations.length;
  })).toBe(1);
});

test("system reduced motion stops canvas effects and button movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "true");
  await page.locator('[data-minigame="0"]').click();
  await expect(page.getByRole("button", { name: "Reduced motion: Off (device On)" })).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => {
    startDigestionAnimation();
    return digestionAnimations.length;
  })).toBe(0);
  const upButton = page.locator('.nav-up');
  await upButton.evaluate((button) => button.classList.add("is-pressed"));
  await expect(upButton).toHaveCSS("transform", "none");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "false");
  await expect(page.getByRole("button", { name: "Reduced motion: Off", exact: true })).toBeVisible();
});

test("large D-Pad personalize control becomes a back-to-game button", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('[data-minigame="0"]').click();
  await page.getByRole("button", { name: /Bigger D-Pad/ }).click();
  await page.locator("#personalizationBackButton").click();

  const personalizeButton = page.locator("#largeDpadPersonalizeButton");
  await expect(personalizeButton).toBeVisible();
  await expect(personalizeButton).toHaveText("Personalize");

  await personalizeButton.click();
  await expect(page.locator("#personalizationScreen")).toBeVisible();
  await expect(personalizeButton).toHaveText("Back");
  await expect(personalizeButton).toHaveAttribute("aria-label", "Back to game");

  await personalizeButton.click();
  await expect(page.locator("#personalizationScreen")).toBeHidden();
  await expect(personalizeButton).toHaveText("Personalize");
});

test("large D-Pad middle control follows the game lifecycle", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator('[data-minigame="0"]').click();
  await page.getByRole("button", { name: /Bigger D-Pad/ }).click();
  await page.locator("#personalizationBackButton").click();

  const primaryAction = page.locator("#pauseButton");
  await expect(primaryAction).toHaveText("Start");
  await primaryAction.click();
  await expect(primaryAction).toHaveText("Pause");

  await page.keyboard.press("ArrowUp");
  await expect(primaryAction).toHaveText("Reset", { timeout: 5_000 });
  await primaryAction.click();
  await expect(primaryAction).toHaveText("Start");
});
