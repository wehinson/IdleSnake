// Run against npm run serve: node scripts/benchmark-snake-frame.js output.json
// Uses generated saves only. No personal browser data is read.
const fs = require("node:fs");
const { chromium } = require("@playwright/test");
const { createGameSession } = require("../engine/session.js");

const baseUrl = process.env.SNAKE_BENCH_URL || "http://127.0.0.1:4173";
const sampleMs = Number(process.env.SNAKE_BENCH_MS) || 4000;
const runs = Number(process.env.SNAKE_BENCH_RUNS) || 3;

function fixture(kind, now) {
  const save = createGameSession({ now, rng: () => 0.5 }).serialize();
  save.savedAt = now;
  if (kind === "fresh") return save;
  const state = save.session;
  const counts = [45, 55, 80, 140, 260, 480, 850, 1600];
  const upgradeLevels = [1, 1, 1, 1, 1, 1, 1, 1];
  const hatchlings = Array.from({ length: 24 }, (_, index) => ({
    id: `fixture-hatchling-${index}`, x: index % 8, y: index % 10,
    direction: index % 2 ? "left" : "right", progressMs: 1000 + index * 100
  }));
  const retained = Array.from({ length: 8 }, (_, index) => ({
    id: `fixture-notable-${index}`, name: `Fixture ${index}`, status: "ACTIVE",
    assignedHabitatId: index, powerType: ["PRODUCTION_INCREASE", "FORAGER", "RATIONER", "CAPACITY_INCREASE"][index % 4],
    powerMagnitude: 0.1, hasServed: true, habitatsServed: [index]
  }));
  const makeEconomy = () => ({
    seeds: 1000000, branches: 100000, provisions: 100000, best: 500,
    upgrades: { boardLevel: 7, foodTypeLevel: 2, foodCountLevel: 2, shieldLevel: 0, minigamesLevel: 9 },
    selectedBoardLevel: 7,
    nursery: { ...state.nursery, nurseryLevel: 20, colonyCount: 10000, hatchlings: structuredClone(hatchlings) },
    habitats: { counts: [...counts], upgradeLevels: [...upgradeLevels] },
    notables: { ...state.notables, retained: structuredClone(retained), nextId: 9 }
  });
  const activeEconomy = makeEconomy();
  Object.assign(state, structuredClone(activeEconomy));
  state.migration.settlements = Array.from({ length: 4 }, (_, index) => ({
    id: index === 0 ? "grasslands" : `fixture-${index}`,
    name: index === 0 ? "Grasslands" : `Fixture ${index}`,
    region: index === 0 ? "Grasslands" : `Region ${index}`,
    foundedAt: now - 86400000, status: "established", foundingRemainingMs: 0,
    stats: { habitatsUnlocked: 8, maxSnakeScore: 500, nestSlotsReached: 21, nurserySizeReached: 44 },
    economy: makeEconomy()
  }));
  state.migration.activeSettlementId = "grasslands";
  return createGameSession({ now, save, rng: () => 0.5 }).serialize();
}

function metricMap(values) { return Object.fromEntries(values.map(({ name, value }) => [name, value])); }
function percentile(sorted, portion) { return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * portion) - 1)] || 0; }

async function measure(browser, kind, slowdown) {
  const now = Date.now();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.addInitScript((save) => localStorage.setItem("snake-forever-save", JSON.stringify(save)), fixture(kind, now));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: slowdown });
  await page.goto(baseUrl, { waitUntil: "load" });
  await page.evaluate(() => {
    const probe = { gaps: [], fullSnapshots: 0, hudMutations: 0 };
    const originalSnapshot = session.snapshot;
    session.snapshot = (...args) => { probe.fullSnapshots += 1; return originalSnapshot(...args); };
    const hudObserver = new MutationObserver((records) => { probe.hudMutations += records.length; });
    for (const target of [document.querySelector(".status-strip"), document.querySelector("#pauseButton")]) {
      if (target) hudObserver.observe(target, { subtree: true, childList: true, characterData: true, attributes: true });
    }
    window.__snakeBench = probe;
    dispatchSession({ type: "selectMode", mode: "snake", setup: {
      grid: { columns: 20, rows: 25 }, tickMs: 300, direction: "right",
      snake: [{ x: 2, y: 12 }, { x: 1, y: 12 }, { x: 0, y: 12 }]
    } });
    dispatchSession({ type: "direction", direction: "right" });
    probe.fullSnapshots = 0;
    probe.hudMutations = 0;
    let last = null;
    function sample(at) {
      if (last !== null) probe.gaps.push(at - last);
      last = at;
      probe.animationId = requestAnimationFrame(sample);
    }
    probe.animationId = requestAnimationFrame(sample);
  });
  const before = metricMap((await cdp.send("Performance.getMetrics")).metrics);
  await page.waitForTimeout(sampleMs);
  const after = metricMap((await cdp.send("Performance.getMetrics")).metrics);
  const values = await page.evaluate(() => {
    cancelAnimationFrame(window.__snakeBench.animationId);
    return { ...window.__snakeBench, animationId: undefined, phase: gameView.state };
  });
  await context.close();
  const gaps = values.gaps.slice().sort((a, b) => a - b);
  return {
    kind, slowdown, sampleMs, frameCount: gaps.length, phase: values.phase,
    p50Ms: percentile(gaps, 0.5), p95Ms: percentile(gaps, 0.95), p99Ms: percentile(gaps, 0.99),
    over50Ms: gaps.filter((value) => value > 50).length,
    fullSnapshots: values.fullSnapshots, hudMutations: values.hudMutations,
    scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
    layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
    styleMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
    frameGapsMs: values.gaps
  };
}

async function main() {
  const output = process.argv[2];
  if (!output) throw new Error("Give an output JSON path.");
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const slowdown of [1, 6]) for (const kind of ["fresh", "developed"]) for (let run = 1; run <= runs; run += 1) {
      const result = await measure(browser, kind, slowdown);
      results.push({ run, ...result });
      process.stdout.write(`${kind} ${slowdown}x run ${run}: p95=${result.p95Ms.toFixed(1)} ms, full=${result.fullSnapshots}\n`);
    }
  } finally { await browser.close(); }
  const report = {
    at: new Date().toISOString(), browserVersion: browser.version(), nodeVersion: process.version,
    platform: process.platform, baseUrl, sampleMs, runs, fixture: "generated fresh or four established settlements; 24 hatchlings and 8 Notables per settlement",
    results
  };
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
}

module.exports = { fixture };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
