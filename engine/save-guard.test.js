const test = require("node:test");
const assert = require("node:assert/strict");
const guard = require("./save-guard.js");
const { createGameSession, SAVE_VERSION } = require("./session.js");

function valid(overrides = {}) {
  return { saveVersion: 2, currencies: { seeds: 2, provisions: 0, branches: 0 }, records: { best: 0 }, upgrades: {}, board: {}, settings: {}, nursery: { resupplyEggHolding: 3 }, habitats: { counts: [] }, notables: {}, snakebird: {}, eggBoardCountdown: 7, battleshipBest: 1, unknownFutureField: { kept: true }, ...overrides };
}

test("accepts current V2 saves, omitted optional fields, and harmless unknown fields", () => {
  const result = guard.validateSaveCandidate(valid());
  assert.equal(result.ok, true);
  assert.equal(result.value.unknownFutureField.kept, true);
  assert.equal(guard.validateSaveCandidate({ saveVersion: 2 }).ok, true);
  assert.equal(guard.validateSaveCandidate(valid({ migration: { historyTotals: { completed: 70, failed: 2, returned: 1 } }, resupplyTotals: { completedMissions: 80 } })).ok, true);
});

test("rejects unsupported, missing, and nonsensical versions", () => {
  for (const saveVersion of [3, 4, 0, -1, 1.5, NaN, undefined, "2"]) assert.equal(guard.validateSaveCandidate(valid({ saveVersion })).ok, false);
  assert.equal(guard.validateSaveCandidate(valid({ saveVersion: SAVE_VERSION + 1 })).code, "future-version");
});

test("accepts the canonical V5 session envelope without mutating it", () => {
  const save = createGameSession({ now: 123 }).serialize();
  const before = JSON.stringify(save);
  const result = guard.validateSaveCandidate(save);
  assert.equal(result.ok, true);
  assert.equal(result.value, save);
  assert.equal(JSON.stringify(save), before);
  assert.equal(guard.validateImportText(before).ok, true);
});

test("rejects malformed V5 envelopes, preferences, records, and economy collections", () => {
  const canonical = () => createGameSession({ now: 123 }).serialize();
  for (const candidate of [
    { saveVersion: SAVE_VERSION, savedAt: 123 },
    { saveVersion: SAVE_VERSION, savedAt: Infinity, session: {} },
    { saveVersion: SAVE_VERSION, savedAt: 123, session: [] }
  ]) assert.equal(guard.validateSaveCandidate(candidate).ok, false);

  const cases = [
    (save) => { save.session.records = []; },
    (save) => { save.session.records.runnerBest = -1; },
    (save) => { save.session.cosmetics = []; },
    (save) => { save.session.reducedMotion = "false"; },
    (save) => { save.session.selectedDuelGridSize = Infinity; },
    (save) => { save.session.tradeRoutes = {}; },
    (save) => { save.session.nursery.hatchlings = {}; },
    (save) => { save.session.migration.settlements = {}; },
    (save) => { save.session.migration.settlements[0].economy.seeds = -1; },
    (save) => { save.session.migration.settlements[0].economy.habitats.counts = {}; },
    (save) => { save.session.resupplyTotals.completedMissions = -1; },
    (save) => { save.session.notables.pending.push({ trait: { value: NaN } }); }
  ];
  for (const corrupt of cases) {
    const save = canonical();
    corrupt(save);
    assert.equal(guard.validateSaveCandidate(save).ok, false);
  }
});

test("rejects non-object saves, unsafe numbers, and wrong nested types", () => {
  for (const candidate of [null, [], 4, "save"]) assert.equal(guard.validateSaveCandidate(candidate).ok, false);
  assert.equal(guard.validateSaveCandidate(valid({ currencies: { seeds: -1 } })).ok, false);
  assert.equal(guard.validateSaveCandidate(valid({ currencies: { seeds: Infinity } })).ok, false);
  assert.equal(guard.validateSaveCandidate(valid({ nursery: [] })).ok, false);
  assert.equal(guard.validateSaveCandidate(valid({ tradeRoutes: {} })).ok, false);
  assert.equal(guard.validateSaveCandidate(valid({ migration: { historyTotals: [] } })).ok, false);
  assert.equal(guard.validateSaveCandidate(valid({ migration: { completedMigrations: {} } })).ok, false);
  assert.equal(guard.validateSaveCandidate(valid({ resupplyTotals: { completedMissions: -1 } })).ok, false);
});

test("rejects oversized text and excessive collections without truncation", () => {
  assert.equal(guard.validateImportText("x".repeat(guard.MAX_IMPORT_BYTES + 1)).code, "size");
  const result = guard.validateSaveCandidate(valid({ tradeRoutes: Array.from({ length: guard.MAX_COLLECTION_ENTRIES + 1 }, () => ({})) }));
  assert.equal(result.code, "collection-limit");
  const sessionSave = createGameSession({ now: 0 }).serialize();
  sessionSave.session.tradeRoutes = Array.from({ length: guard.MAX_COLLECTION_ENTRIES + 1 }, () => ({}));
  assert.equal(guard.validateSaveCandidate(sessionSave).code, "collection-limit");
});
