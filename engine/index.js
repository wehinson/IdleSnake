// Unified-clock world engine — the composition root.
//
// Replaces game.js's TWO clocks (the rAF gameLoop for gameplay + the separate
// setInterval(runNurseryClock, 250) for the economy) with ONE `tick(dtMs)`.
// Every subsystem — idle economy (seeds/eggs/habitats), the active real-time
// mode (snake), and the migration/world-event hooks — advances from the same
// dt, so egg timers and snake movement finally run on the same clock. Offline
// catch-up is just one big-dt tick at load.
//
// State is a single flat object (snake and economy already share seeds/upgrades)
// so it serializes as one tree and every module mutates it in place.
(function attachWorldEngine(root, factory) {
  const req = typeof require === "function" ? require : null;
  const deps = {
    config: req ? req("./config.js") : (root.IdleSnakeConfig || {}),
    economy: req ? req("./economy.js") : root.IdleSnakeEconomy,
    snake: req ? req("./snake.js") : root.IdleSnakeSnake,
    world: req ? req("./world.js") : root.IdleSnakeWorld
  };
  const engine = factory(deps);
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeWorldEngine = engine;
  else root.IdleSnakeWorldEngine = engine;
})(typeof window !== "undefined" ? window : globalThis, ({ config, economy, snake, world }) => {
  // Live frames are clamped so a stutter/tab-away can't fast-forward gameplay.
  // Offline catch-up passes { offline: true } to bypass the clamp for one big dt.
  const MAX_LIVE_DT = 100;

  function createInitialState(save, now) {
    save = save && typeof save === "object" ? save : {};
    return {
      phase: "ready",       // ready | running | paused | gameover
      mode: save.mode || "snake",
      seeds: Number(save.seeds) || 0,
      best: Number(save.best) || 0,
      upgrades: save.upgrades || { foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0, boardLevel: 0, minigamesLevel: 0 },
      nursery: economy.createNursery(save.nursery, now),
      habitats: economy.createHabitats(save.habitats),
      world: world.createWorldSystems(save.world),
      modeAccumulatorMs: 0,
      // Active real-time mode fields (populated by startSnake).
      grid: null,
      snake: null,
      foods: null,
      direction: null,
      nextDirection: null,
      directionQueue: [],
      score: 0,
      tickMs: config.snakeConfig.startTickMs
    };
  }

  function createWorld(save, opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    const now = opts.now;
    const state = createInitialState(save, now);

    // Attach a classic snake mode without starting it (phase stays "ready").
    function startSnake(grid) {
      const board = grid || snake.parseGridSize(config.upgradeConfig.board.levels[state.upgrades.boardLevel || 0]);
      const built = snake.createSnakeMode(board, {
        rng,
        upgrades: state.upgrades,
        seeds: state.seeds,
        best: state.best
      });
      // Fold the snake fields onto the shared state (keep shared seeds/best/upgrades).
      state.grid = built.grid;
      state.snake = built.snake;
      state.foods = built.foods;
      state.direction = built.direction;
      state.nextDirection = built.nextDirection;
      state.directionQueue = built.directionQueue;
      state.score = built.score;
      state.tickMs = built.tickMs;
      state.mode = "snake";
      state.modeAccumulatorMs = 0;
      state.phase = "running";
    }

    function queueDirection(dir) {
      if (state.phase !== "running" && state.phase !== "ready") return;
      if (state.mode === "snake" && state.snake) snake.queueDirection(state, dir);
    }

    function layEgg() {
      return economy.layEgg(state);
    }

    // Advance the whole world by dtMs. Returns the accumulated events array.
    function tick(dtMs, opts2) {
      opts2 = opts2 || {};
      let dt = Number(dtMs) || 0;
      if (dt <= 0) return [];
      if (!opts2.offline) dt = Math.min(MAX_LIVE_DT, dt);

      const events = [];

      // 1) Idle economy — always ticking, whatever the active mode/phase.
      events.push(...economy.tickEconomy(state, dt, { rng }).events);

      // 2) Migration + world-event hooks (stubs) — same dt.
      events.push(...world.tickWorld(state, dt).events);

      // 3) Active real-time mode — fixed-step accumulator off the SAME dt.
      if (state.phase === "running" && state.mode === "snake" && state.snake) {
        state.modeAccumulatorMs += dt;
        // tickMs can shrink mid-loop as the snake eats; re-read each iteration.
        let guard = 0;
        while (state.modeAccumulatorMs >= state.tickMs && state.phase === "running" && guard < 10000) {
          const result = snake.stepSnake(state, { rng });
          events.push(...result.events);
          state.modeAccumulatorMs -= state.tickMs;
          guard += 1;
          if (!result.alive) { state.phase = "gameover"; break; }
        }
      }

      return events;
    }

    function serialize() {
      return {
        mode: state.mode,
        seeds: state.seeds,
        best: state.best,
        upgrades: state.upgrades,
        nursery: state.nursery,
        habitats: state.habitats,
        world: state.world
      };
    }

    return {
      state,
      getState: () => state,
      tick,
      startSnake,
      queueDirection,
      layEgg,
      serialize
    };
  }

  return { createInitialState, createWorld, MAX_LIVE_DT };
});
