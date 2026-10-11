const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createGameSession } = require("../engine/session.js");
const saveGuard = require("../engine/save-guard.js");

test("actual terminal interpreter immediately stores currency and reward ledger in one canonical save", () => {
  const source = fs.readFileSync(require.resolve("../game.js"), "utf8");
  const session = createGameSession({ now: 0, rng: () => .5 });
  session.dispatch({ type: "selectMode", mode: "snakebird", setup: {
    definition: { map: ["....", "HG..", "####"], optimalMoves: 1 }
  } });
  const initial = session.serialize();
  const key = "test-save";
  const storage = new Map([[key, JSON.stringify(initial)]]);
  const timers = new Map();
  const context = vm.createContext({
    session, saveGuard, consolidatedSaveKey: key, console,
    gameView: { gameMode: "snakebird" }, storageWarningShown: false,
    setTimeout(callback, delay) { const token = {}; timers.set(token, { callback, delay }); return token; },
    clearTimeout(token) { timers.delete(token); },
    safeStorage(action, name, value) {
      if (action === "get") return { ok: true, value: storage.get(name) ?? null };
      storage.set(name, value); return { ok: true };
    },
    reportStorageFailure(kind) { throw Error(kind); },
    setScreenHint() {}, formatDecimal: String
  });
  const interpreterStart = source.indexOf("function interpretSessionEvents(events)");
  vm.runInContext(source.slice(source.indexOf("const saveFlushIntervalMs"), source.indexOf("function saveSeeds()"))
    + source.slice(interpreterStart, source.indexOf("\nfunction ", interpreterStart + 1)), context);

  vm.runInContext("persistConsolidatedSave();", context);
  assert.equal([...timers.values()][0].delay, 1500, "ordinary queued persistence retains its existing debounce");
  assert.equal(JSON.parse(storage.get(key)).session.seeds, 0);
  const won = session.dispatch({ type: "direction", direction: "right" });
  const terminal = won.events.find(event => event.type === "runEnded");
  assert.ok(terminal.reward > 0);
  context.terminalEvents = [terminal];
  vm.runInContext("interpretSessionEvents(terminalEvents);", context);

  const stored = JSON.parse(storage.get(key));
  assert.deepEqual(stored, session.serialize(), "all canonical state is written before interpreter returns");
  assert.equal(stored.session.seeds, terminal.reward);
  assert.equal(stored.session.minigameRewards.earnings.snakebird, terminal.reward);
  assert.equal(stored.session.minigameRewards.lastReceipt.runId, terminal.runId);
  assert.equal(stored.session.minigameRewards.lastReceipt.amount, terminal.reward);
  assert.notEqual(stored.session.minigameRewards.rngState, initial.session.minigameRewards.rngState);
  assert.deepEqual(JSON.parse(storage.get(`${key}:backup`)), initial, "existing backup policy is retained");
  assert.equal(timers.size, 0, "terminal path cancels the pending debounce without waiting for it");
  assert.equal(vm.runInContext("pendingSaveProducers.size", context), 0);

  vm.runInContext("interpretSessionEvents(terminalEvents);", context);
  assert.deepEqual(JSON.parse(storage.get(key)), stored, "display-event replay cannot credit again");
  const restored = createGameSession({ now: 0, save: stored, rng: () => .9 });
  restored.advanceOffline(1000);
  assert.equal(restored.snapshot().seeds, terminal.reward);
  assert.deepEqual(restored.snapshot().minigameRewards, stored.session.minigameRewards);
});
