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
  assert.equal(themes.length, 10, "ten redesign themes are registered");
  assert.equal(new Set(themes.map((theme) => theme.id)).size, 10);
  for (const theme of themes) {
    const errors = kit.validateTheme(theme);
    assert.equal(errors.length, 0, `${theme.id}: ${errors.join("; ")}`);
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

test("every theme keeps the game's words and follows the no-slop rules", () => {
  for (const theme of loadThemes()) {
    const wordKeys = Object.keys(theme.phrases || {}).filter((key) => /[A-Za-z]/.test(key));
    assert.deepEqual(wordKeys, [], `${theme.id} must not rename game text`);
    assert.equal(theme.labels, undefined, `${theme.id} must not replace labels`);
    const css = readFileSync(join(themesDir, theme.id, "theme.css"), "utf8");
    assert.doesNotMatch(css, /backdrop-filter/, `${theme.id} must not use backdrop-filter`);
    assert.doesNotMatch(css, /\p{Extended_Pictographic}/u, `${theme.id} must not use emoji`);
  }
});

const RETRO_THEMES = ["brick-navy", "office-charcoal", "signal-red", "pebble", "taxi-yellow"];
const SNAKE_COLORS = [
  "#29391f", "#32204f", "#16465a", "#176052", "#843b2f", "#a55b25", "#702c57", "#252a32",
  "#182413", "#583b83", "#267b91", "#2d8b68", "#b3483d", "#b0802d", "#9b477e", "#596474"
];

function luminance(hex) {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

test("every theme is loaded by index.html", () => {
  const html = readFileSync(join(themesDir, "..", "index.html"), "utf8");
  for (const theme of loadThemes()) {
    assert.ok(html.includes(`href="themes/${theme.id}/theme.css"`), `${theme.id} stylesheet is linked`);
    assert.ok(html.includes(`src="themes/${theme.id}/theme.js"`), `${theme.id} script is loaded`);
  }
});

test("retro handset themes stay matte, readable, and keep the chosen snake colours", () => {
  const themes = loadThemes().filter((theme) => RETRO_THEMES.includes(theme.id));
  assert.equal(themes.length, RETRO_THEMES.length);
  for (const theme of themes) {
    const css = readFileSync(join(themesDir, theme.id, "theme.css"), "utf8");
    const vars = Object.fromEntries([...css.matchAll(/--s-([a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
    for (const [ink, surface] of [
      ["text", "menu"], ["muted", "menu"], ["muted", "raise"], ["button-ink", "button"], ["accent-ink", "accent"],
      ["accent-text", "menu"], ["stop-text", "menu"], ["lcd-ink", "lcd"], ["key-ink", "key-bg"], ["nav-ink", "nav-bg"],
      ["hint", "lens"], ["nursery-ink", "nursery-bg"]
    ]) {
      const ratio = contrast(vars[ink], vars[surface]);
      assert.ok(ratio >= 4.5, `${theme.id}: ${ink} on ${surface} is ${ratio.toFixed(2)}:1`);
    }
    // No gloss or glow: no radial highlights on the phone, no blurred light shadows, no neon overlay.
    assert.doesNotMatch(css, /\.phone-shell \{[^}]*radial-gradient/, `${theme.id} shell must not have a gloss highlight`);
    assert.equal(vars["key-highlight"], "transparent", `${theme.id} keys must not have a highlight`);
    assert.doesNotMatch(String(theme.canvas.overlay), /Gradient/, `${theme.id} LCD must not glow`);
    assert.equal(theme.canvas.scanlines, false);
    // Player colours are drawn as chosen; only the default head is the LCD ink.
    const lcd = theme.canvas.colors["#9cac77"];
    assert.equal(vars.lcd, lcd, `${theme.id} CSS and canvas use one LCD colour`);
    for (const color of SNAKE_COLORS) {
      if (color !== "#182413") assert.equal(theme.canvas.colors[color], undefined, `${theme.id} must not remap ${color}`);
      const ratio = contrast(theme.canvas.colors[color] || color, lcd);
      assert.ok(ratio >= 2.2, `${theme.id}: snake colour ${color} on the LCD is ${ratio.toFixed(2)}:1`);
    }
    assert.match(css, /body\.is-fullscreen-mode \.app-layout\.has-fullscreen-option/, `${theme.id} keeps the fullscreen menu rule`);
    assert.match(css, /\.phone-key:focus-visible \{ outline: none; \}/, `${theme.id} keeps the keypad focus rule`);
  }
});
