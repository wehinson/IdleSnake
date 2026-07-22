const { test, expect } = require("@playwright/test");

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
