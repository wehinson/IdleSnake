// Deterministic, headless game-session boundary.
//
// This is intentionally the only module which owns a live run.  Hosts may
// measure elapsed time and capture input, but they may only call dispatch() or
// tick() and render the returned snapshot.
(function attachSession(root, factory) {
  const req = typeof require === "function" ? require : null;
  const deps = {
    config: req ? req("./config.js") : root.IdleSnakeConfig,
    economy: req ? req("./economy.js") : root.IdleSnakeEconomy,
    snake: req ? req("./snake.js") : root.IdleSnakeSnake,
    duel: req ? req("./duel.js") : root.IdleSnakeDuel,
    crossing: req ? req("./crossing.js") : root.IdleSnakeCrossing,
    breakout: req ? req("./breakout.js") : root.IdleSnakeBreakout,
    broodline: req ? req("./broodline.js") : root.IdleSnakeBroodline,
    maze: req ? req("./maze.js") : root.IdleSnakeMaze,
    sokoban: req ? req("./sokoban.js") : root.IdleSnakeSokoban,
    snakebird: req ? req("../snakebird-engine.js") : root.SnakebirdEngine
  };
  const api = factory(deps);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.IdleSnakeSession = api;
  else root.IdleSnakeSession = api;
})(typeof window !== "undefined" ? window : globalThis, ({ config, economy, snake, duel, crossing, breakout, broodline, maze, sokoban, snakebird }) => {
  const SAVE_VERSION = 2;
  const MAX_LIVE_DT = 100;
  const directions = new Set(["up", "down", "left", "right"]);
  const modeNames = new Set(["snake", "duel", "maze", "breakout", "crossing", "snakebird", "sokoban", "broodline"]);

  // Randomness is injected (default Math.random) so the browser host and the sim
  // share identical behavior. state.rng is a function returning [0, 1); it is a
  // function so JSON serialization drops it and it never lands in a save.
  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }
  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }
  function normalUpgrades(value) {
    const defaults = { boardLevel: 0, foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0, minigamesLevel: 0 };
    return Object.fromEntries(Object.keys(defaults).map((key) => [key, Math.max(0, Math.floor(Number(value && value[key]) || 0))]));
  }
  function migrateLegacy(save, now) {
    save = save && typeof save === "object" ? save : {};
    if (save.saveVersion === SAVE_VERSION && save.session) return clone(save);
    const legacy = save.session || save;
    return {
      saveVersion: SAVE_VERSION,
      savedAt: Number.isFinite(Number(save.savedAt)) ? Number(save.savedAt) : now,
      session: {
        mode: "snake", phase: "ready", elapsedMs: 0, modeAccumulatorMs: 0,
        seeds: Number(legacy.currencies?.seeds ?? legacy.seeds) || 0,
        best: Number(legacy.records?.best ?? legacy.best) || 0,
        upgrades: normalUpgrades(legacy.upgrades),
        selectedBoardLevel: Number(legacy.board?.selectedBoardLevel) || 0,
        cosmetics: clone(legacy.settings?.snakeColors || legacy.cosmetics || { body: null, head: null }),
        snakebirdProgress: clone(legacy.snakebird || legacy.snakebirdProgress || { unlockedLevel: 1, clearedLevels: [], bestMoves: [], lastSelectedLevel: 1 }),
        nursery: clone(legacy.nursery || {}), habitats: clone(legacy.habitats || {}),
        active: null
      }
    };
  }
  function boardFor(state) {
    const levels = config.upgradeConfig.board.levels;
    const index = Math.max(0, Math.min(levels.length - 1, state.selectedBoardLevel));
    return snake.parseGridSize(levels[index]);
  }
  function createState(migrated, now) {
    const raw = migrated.session;
    const state = {
      mode: modeNames.has(raw.mode) ? raw.mode : "snake",
      phase: ["ready", "running", "paused", "gameover"].includes(raw.phase) ? raw.phase : "ready",
      elapsedMs: Math.max(0, Number(raw.elapsedMs) || 0), modeAccumulatorMs: Math.max(0, Number(raw.modeAccumulatorMs) || 0),
      seeds: Math.max(0, Number(raw.seeds) || 0), best: Math.max(0, Number(raw.best) || 0),
      upgrades: normalUpgrades(raw.upgrades), selectedBoardLevel: Math.max(0, Number(raw.selectedBoardLevel) || 0),
      cosmetics: raw.cosmetics && typeof raw.cosmetics === "object" ? clone(raw.cosmetics) : { body: null, head: null },
      snakebirdProgress: raw.snakebirdProgress && typeof raw.snakebirdProgress === "object" ? clone(raw.snakebirdProgress) : { unlockedLevel: 1, clearedLevels: [], bestMoves: [], lastSelectedLevel: 1 },
      nursery: economy.createNursery(raw.nursery, now), habitats: economy.createHabitats(raw.habitats), active: null
    };
    return state;
  }
  function startSnake(state) {
    const active = snake.createSnakeMode(boardFor(state), { rng: () => state.rng(), upgrades: state.upgrades, seeds: state.seeds, best: state.best });
    state.active = active; state.mode = "snake"; state.phase = "ready"; state.modeAccumulatorMs = 0; state.elapsedMs = 0;
  }
  function buildCrossingCars(stage, grid) {
    const cars = []; const carCount = stage >= 5 ? 3 : stage >= 3 ? 2 : 1;
    const speedMultiplier = 1 + Math.min(1.25, (stage - 1) * 0.14);
    for (let row = 1; row < grid.rows - 1; row += 1) {
      const sign = row % 2 === 0 ? -1 : 1; const speed = (0.11 + (row % 3) * 0.018) * speedMultiplier * sign;
      for (let index = 0; index < carCount; index += 1) {
        const width = 1 + ((row + index + stage) % 3 === 0 ? 1 : 0); const start = (row * 2.7 + index * grid.columns / carCount + stage * 1.35) % grid.columns;
        cars.push({ row, x: sign > 0 ? start - width : grid.columns - start, width, speed, direction: sign > 0 ? "right" : "left" });
      }
    }
    return cars;
  }
  function buildMaze(layoutIndex) {
    const open = new Set(); let seed = [0x1f123bb5, 0x72a4d91c, 0xc3e87a61, 0x9b4f20de][layoutIndex % 4];
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
    const key = (x, y) => `${x},${y}`; const origin = (value) => 1 + value * 4;
    const room = (x, y) => { for (let px = origin(x); px < origin(x) + 3; px += 1) for (let py = origin(y); py < origin(y) + 3; py += 1) open.add(key(px, py)); };
    const connect = (from, to) => { if (from.x !== to.x) { const x = Math.max(origin(from.x), origin(to.x)) - 1; for (let y = origin(from.y); y < origin(from.y) + 3; y += 1) open.add(key(x, y)); } else { const y = Math.max(origin(from.y), origin(to.y)) - 1; for (let x = origin(from.x); x < origin(from.x) + 3; x += 1) open.add(key(x, y)); } };
    const visited = new Set([key(0, 0)]); const stack = [{ x: 0, y: 0 }]; room(0, 0);
    while (stack.length) { const current = stack.at(-1); const nexts = [{ x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y }, { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 }].filter((p) => p.x >= 0 && p.x < 5 && p.y >= 0 && p.y < 5 && !visited.has(key(p.x, p.y))); if (!nexts.length) { stack.pop(); continue; } const next = nexts[Math.floor(random() * nexts.length)]; visited.add(key(next.x, next.y)); room(next.x, next.y); connect(current, next); stack.push(next); }
    for (let y = 0; y < 5; y += 1) for (let x = 0; x < 5; x += 1) { if (x < 4 && random() < .2) connect({ x, y }, { x: x + 1, y }); if (y < 4 && random() < .2) connect({ x, y }, { x, y: y + 1 }); }
    [[8, 15], [9, 15], [10, 15], [10, 14]].forEach(([x, y]) => open.add(key(x, y)));
    return open;
  }
  // `setup` is optional host-supplied data (board dims, grid size, level
  // definition, starting level index). Defaults reproduce the original built-in
  // configuration so existing callers/tests are unaffected; the browser host
  // injects the real level content/board metrics for full gameplay parity.
  function startMode(state, mode, setup) {
    setup = setup || {};
    state.mode = mode; state.phase = "ready"; state.modeAccumulatorMs = 0; state.elapsedMs = 0;
    if (mode === "snake") return startSnake(state);
    if (mode === "duel") {
      const grid = setup.grid || { columns: 30, rows: 30 };
      const px = Math.floor(grid.columns / 2) - 1; const ox = Math.floor(grid.columns / 2);
      const active = { grid, player: { body: [{ x: px, y: grid.rows - 3 }, { x: px, y: grid.rows - 2 }, { x: px, y: grid.rows - 1 }], direction: "up" }, opponent: { body: [{ x: ox, y: 2 }, { x: ox, y: 1 }, { x: ox, y: 0 }], direction: "down" }, foods: [], score: 0, direction: "up", nextDirection: "up", directionQueue: [], tickMs: setup.tickMs || 125 };
      active.foods = duel.spawnFoods(active, setup.foodCount || 5, () => state.rng()); state.active = active; return;
    }
    if (mode === "crossing") {
      const grid = setup.grid || { columns: 15, rows: 13 }; const entryColumn = setup.entryColumn ?? Math.floor(grid.columns / 2); const snakeBody = [{ x: entryColumn, y: grid.rows - 1 }, { x: entryColumn, y: grid.rows }, { x: entryColumn, y: grid.rows + 1 }];
      state.active = { grid, snake: snakeBody, cars: buildCrossingCars(1, grid), score: 0, stage: 1, snakeLength: 3, entryColumn, direction: "up", nextDirection: "up", directionQueue: [], tickMs: setup.tickMs || 82 }; return;
    }
    if (mode === "broodline") {
      const grid = setup.grid || { columns: 30, rows: 30 };
      const active = { grid, round: 1, wave: 1, pendingSeeds: 0, kills: 0, hatchlingsCollected: 0, eggsHatched: 0, armor: 0, maxArmor: 0, hp: 16, maxHp: 16, phase: "combat", selected: 0, head: { x: Math.floor(grid.columns / 2), y: Math.floor(grid.rows / 2) }, chain: [], enemies: [], pickups: [], effects: [], direction: "right", queue: [], tickMs: broodline.TICK_MS };
      broodline.spawnRound(active, () => state.rng()); state.active = active; return;
    }
    if (mode === "breakout") {
      const width = setup.width || 720; const height = setup.height || 720; const segmentSize = setup.segmentSize || 45; const gap = setup.gap || 4; const brickWidth = (width - 28 - gap * 9) / 10;
      const active = { board: { width, height }, score: 0, lives: 2, segmentSize, gap, paddle: { x: 0, y: height - segmentSize - 10, length: 3, input: 0 }, balls: [], powerups: [], seedBoosts: [], heartsCollected: 0, bricks: [] };
      active.paddle.x = (width - breakout.paddleWidth(active)) / 2;
      if (Array.isArray(setup.bricks)) active.bricks = setup.bricks.map((brick) => ({ ...brick }));
      else for (let row = 0; row < 5; row += 1) for (let column = 0; column < 10; column += 1) active.bricks.push({ x: 14 + column * (brickWidth + gap), y: 58 + row * 20, width: brickWidth, height: 16, hp: 1 });
      active.balls = [breakout.buildBall(active, width)]; state.active = active; return;
    }
    if (mode === "maze") {
      const grid = setup.grid || { columns: 21, rows: 21 };
      const active = { grid, open: buildMaze(setup.layoutIndex ?? Math.floor(state.rng() * 4)), path: [{ x: 10, y: 15 }, { x: 9, y: 15 }, { x: 8, y: 15 }], food: null, foodsEaten: 0, level: 1, score: 0, tickMs: maze.TICK_MS, direction: "up", directionQueue: [] };
      maze.spawnFood(active, () => state.rng()); state.active = active; return;
    }
    if (mode === "snakebird") {
      const definition = setup.definition || { firstClearReward: 20, replayReward: 5, map: [".........", ".........", "...F.....", ".........", "..###....", "..Hoo.F.G", "#########"] };
      state.active = { ...snakebird.parseLevel(definition.map), levelIndex: setup.levelIndex || 0, definition, tickMs: 1000 }; return;
    }
    if (mode === "sokoban") {
      const definition = setup.definition || { reward: 20, map: ["#####", "#...#", "#...#", "#...#", "#####"], snake: [{ x: 1, y: 2 }, { x: 1, y: 1 }], crates: [{ x: 2, y: 2, kind: "light" }], goals: [{ x: 3, y: 2 }], pellets: [{ x: 1, y: 3 }], plates: [], gates: [] };
      const grid = setup.grid || { columns: 5, rows: 5 }; const levelIndex = setup.levelIndex || 0;
      state.active = sokoban.parseLevel(definition, grid, levelIndex); state.active.definition = definition; state.active.tickMs = 1000;
    }
  }
  function event(type, detail) { return { type, ...(detail || {}) }; }
  function result(state, events) { return { snapshot: makeSnapshot(state), events }; }
  function makeSnapshot(state) {
    let active = state.active ? clone(state.active) : null;
    if (state.active && state.mode === "snakebird") { active.fruits = [...state.active.fruits]; active.solids = [...state.active.solids]; }
    if (state.active && state.mode === "sokoban") active.walls = [...state.active.walls];
    if (state.active && state.mode === "maze") active.open = [...state.active.open];
    const snapshot = {
      saveVersion: SAVE_VERSION, mode: state.mode, phase: state.phase, elapsedMs: state.elapsedMs,
      seeds: state.seeds, best: state.best, upgrades: clone(state.upgrades), selectedBoardLevel: state.selectedBoardLevel,
      cosmetics: clone(state.cosmetics), snakebirdProgress: clone(state.snakebirdProgress), nursery: clone(state.nursery), habitats: clone(state.habitats), active,
      hud: { score: active && Number(active.score) || 0, best: state.best, seeds: state.seeds, elapsedMs: state.elapsedMs },
      availableModes: [...modeNames], supportedModes: ["snake", "duel", "maze", "crossing", "breakout", "snakebird", "sokoban", "broodline"],
      prompt: state.phase === "ready" ? "Ready" : state.phase === "paused" ? "Paused" : state.phase === "gameover" ? "Game Over" : ""
    };
    return freeze(snapshot);
  }
  function upgradeCost(kind, level) {
    const item = config.upgradeConfig[kind];
    return item ? Math.ceil(item.baseCost * item.costRatio ** level) : null;
  }
  function createGameSession(options) {
    options = options || {};
    const now = Number(options.now) || 0;
    const migrated = migrateLegacy(options.save, now);
    let state = createState(migrated, now);
    // Injected randomness (default Math.random). A function, so it is dropped by
    // JSON serialization and never persisted into a save.
    state.rng = typeof options.rng === "function" ? options.rng : Math.random;
    // Anchor the offline clock to when the save was written (not now), so
    // advanceOffline(now) credits the real elapsed idle time.
    let savedAt = Number.isFinite(Number(migrated.savedAt)) ? Number(migrated.savedAt) : now;
    function dispatch(action) {
      action = action && typeof action === "object" ? action : {};
      const events = [];
      const reject = (reason) => { events.push(event("actionRejected", { action: action.type || null, reason })); return result(state, events); };
      switch (action.type) {
        case "start":
        case "restart":
          if (!modeNames.has(state.mode)) return reject("modeNotImplemented");
          startMode(state, state.mode, action.setup); events.push(event("runReady", { mode: state.mode })); break;
        case "pause":
          if (state.phase !== "running") return reject("notRunning");
          state.phase = "paused"; events.push(event("paused")); break;
        case "resume":
          if (state.phase !== "paused") return reject("notPaused");
          state.phase = "running"; events.push(event("resumed")); break;
        case "selectMode":
          if (!modeNames.has(action.mode)) return reject("invalidMode");
          // Build the ready board immediately (matches the host's launchX, which
          // shows a ready board before the first input). First direction runs it.
          startMode(state, action.mode, action.setup);
          events.push(event("modeSelected", { mode: state.mode }), event("runReady", { mode: state.mode })); break;
        case "selectBoard": {
          const level = Math.floor(Number(action.level));
          if (!Number.isInteger(level) || level < 0 || level > state.upgrades.boardLevel) return reject("boardLocked");
          state.selectedBoardLevel = level; startMode(state, state.mode, action.setup); events.push(event("boardSelected", { level }), event("runReady", { mode: state.mode })); break;
        }
        case "direction":
          if (!state.active || (state.phase !== "running" && state.phase !== "ready") || !directions.has(action.direction)) return reject("notRunning");
          if (state.phase === "ready") { state.phase = "running"; events.push(event("runStarted", { mode: state.mode })); }
          if (state.mode === "snake" && !snake.queueDirection(state.active, action.direction)) return reject("invalidDirection");
          if (state.mode === "duel" || state.mode === "crossing" || state.mode === "maze") state.active.directionQueue.push(action.direction);
          if (state.mode === "broodline") state.active.queue.push(action.direction);
          if (state.mode === "breakout") state.active.paddle.input = action.direction === "left" ? -1 : action.direction === "right" ? 1 : 0;
          if (state.mode === "snakebird") {
            const moved = snakebird.applyMove(state.active, action.direction); if (!moved.accepted) return reject("blocked"); state.active = moved.state;
            if (moved.fell) { state.phase = "gameover"; events.push(event("runEnded", { mode: "snakebird", reason: "fell" })); }
            else if (snakebird.isComplete(state.active)) { const completion = snakebird.recordCompletion(state.snakebirdProgress, 0, state.active.moves, 1, state.active.definition.firstClearReward, state.active.definition.replayReward); state.snakebirdProgress = completion.progress; state.seeds += completion.reward; state.phase = "gameover"; events.push(event("runEnded", { mode: "snakebird", reward: completion.reward, won: true })); }
          }
          if (state.mode === "sokoban") {
            const moved = sokoban.applyMove(state.active, action.direction); if (!moved.accepted) return reject("blocked");
            if (moved.won) { state.phase = "gameover"; state.seeds += state.active.definition.reward; state.best = Math.max(state.best, state.active.score); events.push(event("runEnded", { mode: "sokoban", reward: state.active.definition.reward, won: true })); }
          }
          events.push(event("directionQueued", { direction: action.direction })); break;
        case "buyUpgrade": {
          const key = `${action.upgrade}Level`; const item = config.upgradeConfig[action.upgrade];
          if (!item || !(key in state.upgrades)) return reject("invalidUpgrade");
          const level = state.upgrades[key];
          if (item.levels && level >= item.levels.length - 1) return reject("maxed");
          const cost = upgradeCost(action.upgrade, level);
          if (state.seeds < cost) return reject("insufficientSeeds");
          state.seeds -= cost; state.upgrades[key] += 1; events.push(event("upgradePurchased", { upgrade: action.upgrade, cost })); break;
        }
        case "layEgg": {
          const outcome = economy.layEgg(state);
          if (!outcome.accepted) return reject(outcome.reason || "eggUnavailable");
          events.push(...outcome.events); break;
        }
        case "placeHabitat": {
          const index = Math.floor(Number(action.index));
          const habitat = config.habitatConfig.habitats[index];
          if (!habitat || state.nursery.colonyCount < 1 || state.best < habitat.unlockScore) return reject("habitatUnavailable");
          state.nursery.colonyCount -= 1; state.habitats.counts[index] += 1; events.push(event("habitatPlaced", { index })); break;
        }
        case "setCosmetics":
          state.cosmetics = { ...state.cosmetics, ...(action.cosmetics || {}) }; events.push(event("cosmeticsChanged")); break;
        // Host-bridge actions used during the incremental migration (and beyond):
        // syncSeeds reconciles the shared seed balance from a host system that
        // still owns some gameplay; addSeeds applies a delta (rewards, dev grant);
        // setUpgrades pushes host-owned upgrade levels so economy food value is
        // correct before that system is itself migrated.
        case "syncSeeds":
          state.seeds = Math.max(0, Number(action.seeds) || 0); break;
        case "syncBest":
          state.best = Math.max(state.best, Math.max(0, Number(action.best) || 0)); break;
        case "addSeeds":
          state.seeds = Math.max(0, state.seeds + (Number(action.amount) || 0)); events.push(event("seedsChanged")); break;
        case "setUpgrades":
          state.upgrades = normalUpgrades(action.upgrades); break;
        default: return reject("unknownAction");
      }
      return result(state, events);
    }
    function tick(dtMs) {
      // Economy advances by the FULL delta so idle income catches up after the
      // tab is throttled/backgrounded; gameplay uses a clamped delta so a lag
      // spike never teleports the snake through several cells at once.
      const rawDt = Math.max(0, Number(dtMs) || 0);
      const dt = Math.min(MAX_LIVE_DT, rawDt);
      const events = [];
      if (!rawDt) return result(state, events);
      events.push(...economy.tickEconomy(state, rawDt, { rng: () => state.rng() }).events);
      if (state.phase === "running") state.elapsedMs += dt;
      if (state.mode === "snake" && state.phase === "running" && state.active) {
        state.modeAccumulatorMs += dt;
        while (state.modeAccumulatorMs >= state.active.tickMs && state.phase === "running") {
          const stepped = snake.stepSnake(state.active, { rng: () => state.rng() });
          state.seeds = state.active.seeds; state.best = state.active.best;
          state.modeAccumulatorMs -= state.active.tickMs;
          events.push(...stepped.events);
          if (!stepped.alive) { state.phase = "gameover"; events.push(event("runEnded", { mode: "snake" })); }
        }
      }
      if (state.phase === "running" && state.active && state.mode === "duel") {
        state.modeAccumulatorMs += dt;
        while (state.modeAccumulatorMs >= state.active.tickMs && state.phase === "running") {
          const stepped = duel.stepVsSnake(state.active, { rng: () => state.rng() }); state.modeAccumulatorMs -= state.active.tickMs; events.push(...stepped.events);
          if (!stepped.alive) { state.phase = "gameover"; const reward = stepped.winner === "player" ? Math.max(5, state.best * 5) : 0; state.seeds += reward; events.push(event("runEnded", { mode: "duel", winner: stepped.winner, reward })); }
        }
      }
      if (state.phase === "running" && state.active && state.mode === "maze") {
        state.modeAccumulatorMs += dt;
        while (state.modeAccumulatorMs >= state.active.tickMs && state.phase === "running") {
          const stepped = maze.stepMaze(state.active, { rng: () => state.rng() }); state.modeAccumulatorMs -= state.active.tickMs; events.push(...stepped.events);
          const levelUp = stepped.events.find((item) => item.type === "levelUp"); if (levelUp) { state.seeds += levelUp.reward; events.push(event("reward", { amount: levelUp.reward })); }
          if (!stepped.alive) { state.phase = "gameover"; const reward = Math.floor(state.active.score / 4); state.seeds += reward; state.best = Math.max(state.best, state.active.score); events.push(event("runEnded", { mode: "maze", reward })); }
        }
      }
      if (state.phase === "running" && state.active && state.mode === "crossing") {
        state.modeAccumulatorMs += dt;
        while (state.modeAccumulatorMs >= state.active.tickMs && state.phase === "running") {
          const stepped = crossing.stepCrossing(state.active); state.modeAccumulatorMs -= state.active.tickMs; events.push(...stepped.events);
          if (!stepped.alive) { state.phase = "gameover"; state.best = Math.max(state.best, state.active.score); events.push(event("runEnded", { mode: "crossing" })); }
          const cleared = stepped.events.find((item) => item.type === "stageClear");
          if (cleared) { state.seeds += cleared.reward; state.best = Math.max(state.best, state.active.score); state.active.stage += 1; state.active.cars = buildCrossingCars(state.active.stage, state.active.grid); events.push(event("reward", { amount: cleared.reward })); }
        }
      }
      if (state.phase === "running" && state.active && state.mode === "breakout") {
        const stepped = breakout.step(state.active, { deltaMs: dt, boardWidth: state.active.board.width, boardHeight: state.active.board.height, elapsedMs: state.elapsedMs, rng: () => state.rng() }); events.push(...stepped.events);
        if (!stepped.alive || stepped.events.some((item) => item.type === "win")) { state.phase = "gameover"; const won = stepped.events.some((item) => item.type === "win"); const reward = won ? 500 : 0; state.seeds += reward; state.best = Math.max(state.best, state.active.score); events.push(event("runEnded", { mode: "breakout", reward })); }
      }
      if (state.phase === "running" && state.active && state.mode === "broodline") {
        state.modeAccumulatorMs += dt;
        while (state.modeAccumulatorMs >= state.active.tickMs && state.phase === "running") {
          const stepped = broodline.step(state.active, { rng: () => state.rng() }); state.modeAccumulatorMs -= state.active.tickMs; events.push(...stepped.events);
          if (!stepped.alive) { state.phase = "gameover"; state.seeds += state.active.pendingSeeds; events.push(event("runEnded", { mode: "broodline", reward: state.active.pendingSeeds })); }
        }
      }
      return result(state, events);
    }
    function advanceOffline(now) {
      const target = Math.max(savedAt, Number(now) || savedAt);
      const dt = target - savedAt; savedAt = target;
      const events = economy.tickEconomy(state, dt, { rng: () => state.rng() }).events;
      return result(state, events);
    }
    return { snapshot: () => makeSnapshot(state), dispatch, tick, advanceOffline,
      serialize: () => ({ saveVersion: SAVE_VERSION, savedAt, session: clone({ ...state, active: null }) }) };
  }
  return { SAVE_VERSION, MAX_LIVE_DT, migrateLegacy, createGameSession };
});
