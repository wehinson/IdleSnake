const assert = require("node:assert/strict");
const { readFileSync, readdirSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const themesDir = __dirname;
const kit = require("./theme-kit.js");

function loadThemes() {
  const registered = [];
  const ThemeKit = { register: (theme) => registered.push(theme) };
  for (const id of readdirSync(themesDir)) {
    const file = join(themesDir, id, "theme.js");
    if (existsSync(file)) vm.runInNewContext(readFileSync(file, "utf8"), { ThemeKit, window: { ThemeKit } });
  }
  return registered;
}

// Split a selector list at top-level commas only (not inside :is(), :not(), and similar).
function splitSelectors(list) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of list) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  return [...parts, current];
}

test("translate keeps word boundaries and letter case", () => {
  const compiled = kit.compilePhrases({ Seeds: "Coins", seed: "coin" });
  assert.equal(kit.translate("Seeds: 4", compiled), "Coins: 4");
  assert.equal(kit.translate("SEEDS", compiled), "COINS");
  assert.equal(kit.translate("Seed a seed", compiled), "Coin a coin");
  assert.equal(kit.translate("Seedling", compiled), "Seedling");
});

test("mapColor keeps alpha and ignores unknown colours", () => {
  const compiled = kit.compileColors({ "#182413": "#102030" });
  assert.equal(kit.mapColor("#182413", compiled), "#102030");
  assert.equal(kit.mapColor("rgba(24, 36, 19, 0.25)", compiled), "rgba(16, 32, 48, 0.25)");
  assert.equal(kit.mapColor("#abcdef", compiled), "#abcdef");
});

test("every theme is valid, unique, and scoped", () => {
  const themes = loadThemes();
  assert.equal(themes.length, 5, "five redesign themes are registered");
  assert.equal(new Set(themes.map((theme) => theme.id)).size, 5);
  for (const theme of themes) {
    assert.deepEqual(kit.validateTheme(theme), [], theme.id);
    const css = readFileSync(join(themesDir, theme.id, "theme.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = css
      .replace(/@(?:import|font-face)[^;{]*;/g, "")
      .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "")
      .replace(/@media[^{]+\{/g, "")
      .split("}")
      .map((block) => block.split("{")[0].trim())
      .filter(Boolean);
    for (const selector of selectors) {
      for (const part of splitSelectors(selector)) {
        assert.ok(part.trim().startsWith(`html[data-theme="${theme.id}"]`), `${theme.id}: unscoped selector "${part.trim()}"`);
      }
    }
  }
});

test("every theme renames the core game vocabulary and repaints the screen", () => {
  const core = ["Snake Forever", "SNAKE FOREVER", "Seeds", "Branches", "Provisions", "Nursery", "Colony", "Settle", "Upgrades", "Hatchling", "Notables", "Elders", "Convoy", "Menu"];
  for (const theme of loadThemes()) {
    for (const term of core) assert.ok(term in theme.phrases, `${theme.id} is missing a phrase for "${term}"`);
    const colors = Object.keys(theme.canvas?.colors || {}).map((c) => c.toLowerCase());
    for (const literal of ["#9cac77", "#182413", "#29391f"]) assert.ok(colors.includes(literal), `${theme.id} must remap canvas colour ${literal}`);
  }
});
