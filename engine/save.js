// Persistence adapter — bridges game.js's consolidated versioned save object
// (the "save data" export/import feature) and the engine's world state, and
// preserves the idle offline mechanic through the unified tick.
//
// The host keeps ONE `consolidatedSave` object (schema: currencies/upgrades/
// records/nursery/habitats/... + savedAt + reserved migration/season slots),
// persisted as a single JSON blob and round-tripped by export/import. This
// module maps that object to/from the engine so saving/loading keeps working
// once the engine owns the simulation:
//   - toEngineSave()  : consolidated  -> createWorld() input
//   - hydrate()       : consolidated  -> live world + one offline catch-up tick
//   - writeInto()     : world state   -> consolidated (mutated in place)
//
// It only touches engine-owned fields (currencies.seeds, records.best,
// upgrades, nursery, habitats, migration/season, savedAt). Colors, snakebird,
// other-mode records, and reserved placeholders are preserved untouched, so the
// existing save feature and future systems keep round-tripping.
(function attachSave(root, factory) {
  const req = typeof require === "function" ? require : null;
  const engine = factory(req ? req("./index.js") : root.IdleSnakeWorldEngine);
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeSave = engine;
  else root.IdleSnakeSave = engine;
})(typeof window !== "undefined" ? window : globalThis, (worldEngine) => {
  function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  // Map the consolidated save object to the nested `save` createWorld expects.
  function toEngineSave(consolidated) {
    consolidated = consolidated && typeof consolidated === "object" ? consolidated : {};
    return {
      mode: consolidated.mode || "snake",
      seeds: num(consolidated.currencies && consolidated.currencies.seeds, 0),
      provisions: num(consolidated.currencies && consolidated.currencies.provisions, 0),
      branches: num(consolidated.currencies && consolidated.currencies.branches, 0),
      best: num(consolidated.records && consolidated.records.best, 0),
      upgrades: consolidated.upgrades || {},
      nursery: consolidated.nursery || {},   // createNursery handles legacy nestStartedAt
      habitats: consolidated.habitats || {},
      notables: consolidated.notables || {},
      // Reserved migration/season slots feed the (stubbed) world systems.
      world: {
        migration: consolidated.migration || undefined,
        events: consolidated.season || undefined
      }
    };
  }

  // The offline anchor is the consolidated save's savedAt timestamp.
  function resolveSavedAt(consolidated, now) {
    const explicit = num(consolidated && consolidated.savedAt, null);
    if (explicit !== null && explicit > 0) return explicit;
    // Fall back to legacy per-subsystem timestamps if savedAt is absent.
    const nurseryTs = num(consolidated && consolidated.nursery && consolidated.nursery.lastUpdatedAt, null);
    const habitatTs = num(consolidated && consolidated.habitats && consolidated.habitats.lastUpdatedAt, null);
    const candidates = [nurseryTs, habitatTs].filter((v) => v !== null && v > 0);
    return candidates.length ? Math.max(...candidates) : now;
  }

  // Build a live world from a consolidated save and run ONE offline catch-up
  // tick so eggs, habitat income, growth, and world hooks all advance for the
  // closed duration on the same clock. Nursery conversion is anchored to
  // savedAt, and the single offline tick advances from there to now — the egg's
  // elapsed time is counted exactly once.
  function hydrate(consolidated, opts) {
    opts = opts || {};
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const savedAt = resolveSavedAt(consolidated, now);
    const world = worldEngine.createWorld(toEngineSave(consolidated), { now: savedAt, rng: opts.rng });
    const offlineMs = Math.max(0, now - savedAt);
    if (offlineMs > 0) world.tick(offlineMs, { offline: true });
    return { world, offlineMs, savedAt };
  }

  // Write engine-owned state back into the consolidated save object, mutating it
  // in place and preserving every field the engine doesn't own. Nursery is
  // written in DUAL format (canonical relative eggElapsedMs + legacy absolute
  // nestStartedAt mirror) so an un-ported reader still sees the egg.
  function writeInto(consolidated, stateOrWorld, now) {
    now = Number.isFinite(now) ? now : Date.now();
    consolidated = consolidated && typeof consolidated === "object" ? consolidated : {};
    const state = stateOrWorld && typeof stateOrWorld.getState === "function"
      ? stateOrWorld.getState()
      : stateOrWorld;

    consolidated.currencies = { ...consolidated.currencies, seeds: state.seeds, provisions: state.provisions, branches: state.branches };
    consolidated.records = { ...consolidated.records, best: state.best };
    consolidated.upgrades = { ...consolidated.upgrades, ...state.upgrades };

    const eggElapsedMs = state.nursery.eggElapsedMs;
    consolidated.nursery = {
      nestLevel: state.nursery.nestLevel,
      nurseryLevel: state.nursery.nurseryLevel,
      nestEggs: state.nursery.nestEggs,
      eggElapsedMs,
      eggHatchDurationMs: state.nursery.eggHatchDurationMs,
      eggProgress: state.nursery.eggProgress,
      eggsStarted: state.nursery.eggsStarted,
      nestStartedAt: eggElapsedMs === null || eggElapsedMs === undefined ? null : now - eggElapsedMs,
      hatchlings: state.nursery.hatchlings,
      colonyCount: state.nursery.colonyCount,
      lastUpdatedAt: now,
      seedTickAccumulatorMs: state.nursery.seedTickAccumulatorMs,
      movementAccumulatorMs: state.nursery.movementAccumulatorMs
    };

    consolidated.habitats = { counts: state.habitats.counts, upgradeLevels: state.habitats.upgradeLevels, lastUpdatedAt: now };
    consolidated.notables = JSON.parse(JSON.stringify(state.notables || {}));

    // Round-trip the (stubbed) world systems through their reserved slots so no
    // accrued elapsed time is lost across a save/load.
    if (state.world) {
      consolidated.migration = state.world.migration;
      consolidated.season = state.world.events;
    }

    consolidated.savedAt = now;
    return consolidated;
  }

  return { toEngineSave, resolveSavedAt, hydrate, writeInto };
});
