// Migration + world-event systems.
//
// INTERFACES NOW, MECHANICS LATER: these hooks are wired into the unified tick
// so the whole game advances on one clock, but the mechanics are deliberate
// no-ops for this milestone. Fill in tickMigration / tickWorldEvents without
// touching the tick wiring in index.js.
(function attachWorld(root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeWorld = engine;
  else root.IdleSnakeWorld = engine;
})(typeof window !== "undefined" ? window : globalThis, () => {
  // Serializable state for the not-yet-built systems. Kept minimal so saves
  // written now stay forward-compatible when mechanics land.
  function createWorldSystems(saved) {
    saved = saved && typeof saved === "object" ? saved : {};
    return {
      migration: {
        elapsedMs: Number(saved.migration && saved.migration.elapsedMs) || 0
      },
      events: {
        elapsedMs: Number(saved.events && saved.events.elapsedMs) || 0,
        active: null
      }
    };
  }

  // STUB: accrue elapsed time so the clock is genuinely unified, emit nothing.
  function tickMigration(state, dtMs) {
    state.world.migration.elapsedMs += dtMs;
    return { events: [] };
  }

  // STUB: accrue elapsed time; no events fire yet.
  function tickWorldEvents(state, dtMs) {
    state.world.events.elapsedMs += dtMs;
    return { events: [] };
  }

  function tickWorld(state, dtMs) {
    if (dtMs <= 0) return { events: [] };
    const events = [];
    events.push(...tickMigration(state, dtMs).events);
    events.push(...tickWorldEvents(state, dtMs).events);
    return { events };
  }

  return { createWorldSystems, tickMigration, tickWorldEvents, tickWorld };
});
