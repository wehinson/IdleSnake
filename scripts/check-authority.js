const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const gamePath = path.join(root, "game.js");
const source = fs.readFileSync(gamePath, "utf8");

const expectedModes = [
  "snake", "duel", "maze", "crossing", "breakout", "runner",
  "snakebird", "sokoban", "centipede", "broodline", "battleship"
];

const setMatch = source.match(/const sessionOwnedModes = new Set\(\[([^\]]+)\]\)/);
if (!setMatch) throw new Error("game.js must declare sessionOwnedModes.");
const ownedModes = new Set([...setMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]));
const missing = expectedModes.filter((mode) => !ownedModes.has(mode));
if (missing.length) throw new Error(`Browser modes missing session ownership: ${missing.join(", ")}`);

const directSimulation = /window\.IdleSnake(?:Snake|Duel|Maze|Crossing|Breakout|Runner|Centipede|Broodline|Battleship)\.(?:createState|step\w*|randomFleet|placeShip|fireAt|aiFire|spawnRound)\s*\(/g;
const matches = [...source.matchAll(directSimulation)].map((match) => match[0]);
if (matches.length) throw new Error(`Direct browser simulation calls remain: ${matches.join(", ")}`);

const legacySteppers = [
  "step", "stepVsSnake", "stepMaze", "stepCrossing", "stepBreakout",
  "stepRunner", "stepCentipede", "broodlineStep", "stepBattleship"
];
const declaredSteppers = legacySteppers.filter((name) => new RegExp(`function\\s+${name}\\s*\\(`).test(source));
if (declaredSteppers.length) throw new Error(`Legacy browser steppers remain: ${declaredSteppers.join(", ")}`);

const canonicalSaveProducer = /function\s+gatherSaveState\s*\(\s*\)\s*{\s*return\s+session\.serialize\(\)\s*;?\s*}/;
if (!canonicalSaveProducer.test(source)) {
  throw new Error("Browser persistence must use session.serialize() as its canonical producer.");
}

const forbiddenReverseSyncActions = ["syncSeeds", "syncBest", "setUpgrades"];
const restoredReverseSyncActions = forbiddenReverseSyncActions.filter((type) =>
  new RegExp(`type\\s*:\\s*["']${type}["']`).test(source)
);
if (restoredReverseSyncActions.length) {
  throw new Error(`Reverse browser-to-session save synchronization returned: ${restoredReverseSyncActions.join(", ")}`);
}

console.log(`Authority check passed: ${expectedModes.length} modes and canonical persistence are session-owned.`);
