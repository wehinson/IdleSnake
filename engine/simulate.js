// Headless driver for a game session. Pure: it only calls the session's public
// boundary (dispatch/tick/snapshot/advanceOffline), so it runs anywhere the
// session runs (Node, worker, browser) with no DOM. Covers the four use cases:
// fast-forward/balance sims, automated tests, bot/AI play, and save inspection.
(function attachSimulate(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.IdleSnakeSimulate = api;
  else root.IdleSnakeSimulate = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  // Drive a live run headlessly. Before each tick it optionally consults a
  // controller(snapshot, stepIndex) -> action|null (bot/AI play), dispatches the
  // action, then advances the clock by stepMs. Stops early on runEnded unless
  // stopOnEnd is false. Returns the final snapshot, every event, and step count.
  function runHeadless(session, options) {
    options = options || {};
    const stepMs = Number(options.stepMs) > 0 ? Number(options.stepMs) : 100;
    const maxSteps = Number.isFinite(options.steps) ? Math.max(0, Math.floor(options.steps)) : 1000;
    const controller = typeof options.controller === "function" ? options.controller : null;
    const stopOnEnd = options.stopOnEnd !== false;
    const events = [];
    let snapshot = session.snapshot();
    let steps = 0;
    let ended = false;
    for (let i = 0; i < maxSteps; i += 1) {
      if (controller) {
        const action = controller(snapshot, i);
        if (action) {
          const dispatched = session.dispatch(action);
          snapshot = dispatched.snapshot;
          events.push(...dispatched.events);
        }
      }
      const ticked = session.tick(stepMs);
      snapshot = ticked.snapshot;
      events.push(...ticked.events);
      steps += 1;
      if (stopOnEnd && ticked.events.some((item) => item.type === "runEnded")) { ended = true; break; }
    }
    return { snapshot, events, steps, ended };
  }

  // Fast-forward only the idle economy by advancing the offline clock to `now`
  // (absolute ms). Use this to simulate hours of idle time in one call instead
  // of thousands of clamped live ticks.
  function fastForwardOffline(session, now) {
    return session.advanceOffline(now);
  }

  return { runHeadless, fastForwardOffline };
});
