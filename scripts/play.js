// Headless command-line host. Prints results; does not change browser saves.
const fs = require("node:fs");
const { createGameSession } = require("../engine/session.js");
const { runHeadless } = require("../engine/simulate.js");

function main(argv) {
  const options = { mode: "snake", seed: "42", steps: "200", "step-ms": "100", direction: "up" };
  const allowed = new Set([...Object.keys(options), "actions", "save"]);
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index].replace(/^--/, "");
    if (!allowed.has(name) || argv[index + 1] === undefined) throw new Error("Use --mode, --seed, --steps, --step-ms, --direction, --actions, or --save with a value.");
    options[name] = argv[index + 1];
  }
  const steps = Number(options.steps); const stepMs = Number(options["step-ms"]);
  if (!Number.isSafeInteger(steps) || steps < 0 || !Number.isFinite(stepMs) || stepMs <= 0 || !Number.isSafeInteger(Number(options.seed))) throw new Error("Seed and steps must be integers; steps must be nonnegative and step-ms must be positive.");
  if (!["up", "down", "left", "right"].includes(options.direction)) throw new Error("Direction must be up, down, left, or right.");
  let seed = Number(options.seed) >>> 0;
  const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const save = options.save ? JSON.parse(fs.readFileSync(options.save, "utf8")) : undefined;
  const actions = options.actions ? JSON.parse(fs.readFileSync(options.actions, "utf8")) : null;
  if (actions !== null && (!Array.isArray(actions) || actions.some((action) => action !== null && (typeof action !== "object" || typeof action.type !== "string")))) throw new Error("Actions must be a JSON array of action objects or null entries, one per simulation step.");
  const game = createGameSession({ now: save?.savedAt ?? 0, save, rng });
  if (!game.snapshot().supportedModes.includes(options.mode)) throw new Error("Unknown game mode: " + options.mode);
  game.dispatch({ type: "launchGame", mode: options.mode });
  const result = runHeadless(game, {
    steps, stepMs,
    controller: (_, step) => actions ? actions[step] || null : step === 0 ? { type: "playDirection", direction: options.direction } : null
  });
  console.log(JSON.stringify({ mode: result.snapshot.mode, phase: result.snapshot.phase, steps: result.steps, ended: result.ended, hud: result.snapshot.hud, events: result.events, save: game.serialize() }, null, 2));
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { main };
