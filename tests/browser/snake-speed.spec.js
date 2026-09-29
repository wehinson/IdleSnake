const { test, expect } = require("@playwright/test");

test("0 menu speed presets apply and persist with keyboard and pointer controls", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const base = await page.evaluate(() => session.snapshot().active.tickMs);
  await page.locator('[data-minigame="0"]').click();
  await expect(page.getByRole("button", { name: "Turtle speed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Snake speed, default" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rabbit speed" })).toBeVisible();
  await expect(page.locator(".snake-speed-icon")).toHaveCount(3);
  expect(await page.locator(".snake-speed-icon").evaluateAll(images =>
    images.every(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0))).toBe(true);
  await expect(page.locator(".snake-speed-options")).not.toContainText(/Turtle|Snake|Rabbit|75%|100%|150%/);
  await expect(page.locator('[data-snake-speed="snake"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-snake-speed="turtle"]').click();
  expect(await page.evaluate(() => session.snapshot().active.tickMs)).toBeCloseTo(base / 0.75);
  await page.locator('[data-snake-speed="rabbit"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-snake-speed="rabbit"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-snake-speed="turtle"]')).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => session.snapshot().active.tickMs)).toBeCloseTo(base / 1.5);
  await page.reload({ waitUntil: "networkidle" });
  expect(await page.evaluate(() => session.snapshot().snakeSpeed)).toBe("rabbit");
  await page.locator('[data-minigame="0"]').click();
  await expect(page.locator('[data-snake-speed="rabbit"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-snake-speed="snake"]').click();
  expect(await page.evaluate(() => session.snapshot().active.tickMs)).toBeCloseTo(base);
  expect(errors).toEqual([]);
});

test("speed controls fit the phone settings panel", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await page.locator('[data-minigame="0"]').click();
  await page.locator('[data-snake-speed="rabbit"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-snake-speed="rabbit"]')).toBeVisible();
  expect(await page.locator(".snake-speed-options").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
