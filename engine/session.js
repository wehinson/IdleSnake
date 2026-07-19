// Deterministic, headless game-session boundary.
//
// This is intentionally the only module which owns a live run.  Hosts may
// measure elapsed time and capture input, but they may only call dispatch() or
// tick() and render the returned snapshot.
(function attachSession(root, factory) {
  const req = typeof require === "function" ? require : null;
  const deps = {
    config: req ? req("./config.js") : root.IdleSnakeConfig,
    notables: req ? req("./notables.js") : root.IdleSnakeNotables,
    economy: req ? req("./economy.js") : root.IdleSnakeEconomy,
    migration: req ? req("./migration.js") : root.IdleSnakeMigration,
    tradeRoutes: req ? req("./trade-routes.js") : root.IdleSnakeTradeRoutes,
    resupply: req ? req("./resupply.js") : root.IdleSnakeResupply,
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
})(typeof window !== "undefined" ? window : globalThis, ({ config, notables, economy, migration, tradeRoutes, resupply, snake, duel, crossing, breakout, broodline, maze, sokoban, snakebird }) => {
  const SAVE_VERSION = 5;
  const MAX_LIVE_DT = 100;
  const GAMEPLAY_SPEED = 1;
  const slowedTick = (milliseconds) => Math.round(milliseconds / GAMEPLAY_SPEED);
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
    const masteryRewardsClaimed = { ...(legacy.notables?.masteryRewardsClaimed || {}) };
    config.boardMasteryConfig.forEach((entry) => {
      if (legacy.board?.mastery?.[entry.boardSize]) masteryRewardsClaimed[entry.masteryId] = true;
    });
    return {
      saveVersion: SAVE_VERSION,
      savedAt: Number.isFinite(Number(save.savedAt)) ? Number(save.savedAt) : now,
      session: {
        mode: "snake", phase: "ready", elapsedMs: 0, modeAccumulatorMs: 0,
        seeds: Number(legacy.currencies?.seeds ?? legacy.seeds) || 0,
        provisions: Number(legacy.currencies?.provisions ?? legacy.provisions) || 0,
        branches: Number(legacy.currencies?.branches ?? legacy.branches) || 0,
        best: Number(legacy.records?.best ?? legacy.best) || 0,
        upgrades: normalUpgrades(legacy.upgrades),
        selectedBoardLevel: Number(legacy.board?.selectedBoardLevel) || 0,
        cosmetics: clone(legacy.settings?.snakeColors || legacy.cosmetics || { body: null, head: null }),
        snakebirdProgress: clone(legacy.snakebird || legacy.snakebirdProgress || { unlockedLevel: 1, clearedLevels: [], bestMoves: [], lastSelectedLevel: 1 }),
        nursery: clone(legacy.nursery || {}), habitats: clone(legacy.habitats || {}),
        notables: clone({ ...(legacy.notables || save.notables || {}), masteryRewardsClaimed }),
        migration: clone(legacy.migration || save.migration || {}),
        tradeRoutes: clone(legacy.tradeRoutes || legacy.routes || save.tradeRoutes || save.routes || []),
        activeResupplyMissions: clone(legacy.activeResupplyMissions || save.activeResupplyMissions || []),
        completedResupplyMissions: clone(legacy.completedResupplyMissions || save.completedResupplyMissions || []),
        nextResupplyMissionId: Number(legacy.nextResupplyMissionId || save.nextResupplyMissionId) || 1,
        eggBoardCountdown: Number.isFinite(Number(legacy.eggBoardCountdown)) ? Number(legacy.eggBoardCountdown) : null,
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
      seeds: Math.max(0, Number(raw.seeds) || 0), provisions: Math.max(0, Number(raw.provisions) || 0), branches: Math.max(0, Number(raw.branches) || 0), best: Math.max(0, Number(raw.best) || 0),
      upgrades: normalUpgrades(raw.upgrades), selectedBoardLevel: Math.max(0, Number(raw.selectedBoardLevel) || 0),
      cosmetics: raw.cosmetics && typeof raw.cosmetics === "object" ? clone(raw.cosmetics) : { body: null, head: null },
      snakebirdProgress: raw.snakebirdProgress && typeof raw.snakebirdProgress === "object" ? clone(raw.snakebirdProgress) : { unlockedLevel: 1, clearedLevels: [], bestMoves: [], lastSelectedLevel: 1 },
      nursery: economy.createNursery(raw.nursery, now), habitats: economy.createHabitats(raw.habitats),
      notables: notables.createState(raw.notables),
      eggBoardCountdown: Number.isFinite(Number(raw.eggBoardCountdown)) && Number(raw.eggBoardCountdown) > 0 ? Math.floor(Number(raw.eggBoardCountdown)) : null,
      active: null
    };
    state.migration = migration.createState(raw.migration, now);
    // v4 and older saves kept upgrades at the session root. Move that state
    // into the active settlement once, while every other existing settlement
    // starts with its own clean upgrade track.
    for (const settlement of state.migration.settlements) {
      if (!settlement.economy) continue;
      if (settlement.economy.upgrades === undefined) {
        settlement.economy.upgrades = settlement.id === state.migration.activeSettlementId
          ? clone(state.upgrades)
          : normalUpgrades({});
      }
      if (settlement.economy.selectedBoardLevel === undefined) {
        settlement.economy.selectedBoardLevel = settlement.id === state.migration.activeSettlementId
          ? state.selectedBoardLevel
          : 0;
      }
    }
    const activeSettlement = state.migration.settlements.find((item) => item.id === state.migration.activeSettlementId);
    if (!activeSettlement?.economy) migration.storeActiveSettlement(state);
    else migration.loadActiveSettlement(state);
    const routeState = tradeRoutes.createState(raw.tradeRoutes || raw.routes);
    state.tradeRoutes = routeState.tradeRoutes; state.nextTradeRouteId = Math.max(routeState.nextTradeRouteId, Math.floor(Number(raw.nextTradeRouteId)) || 1);
    const resupplyState = resupply.createState(raw, state);
    state.activeResupplyMissions = resupplyState.activeResupplyMissions; state.completedResupplyMissions = resupplyState.completedResupplyMissions; state.nextResupplyMissionId = resupplyState.nextResupplyMissionId;
    const activeSettlementForStats = state.migration.settlements.find((item) => item.id === state.migration.activeSettlementId);
    if (activeSettlementForStats) activeSettlementForStats.stats.maxSnakeScore = Math.max(Number(activeSettlementForStats.stats.maxSnakeScore) || 0, state.best);
    state.migrationChallenge = null;
    return state;
  }

  function normalizeLocalState(state, now) {
    state.nursery = economy.createNursery(state.nursery, now);
    state.habitats = economy.createHabitats(state.habitats);
    state.notables = notables.createState(state.notables);
  }
  function rollEggBoardCountdown(rng) {
    const { eggBoardMinRuns, eggBoardMaxRuns } = config.snakeConfig;
    return eggBoardMinRuns + Math.floor(rng() * (eggBoardMaxRuns - eggBoardMinRuns + 1));
  }
  function startSnake(state, setup) {
    setup = setup || {};
    const grid = setup.grid || boardFor(state);
    if (state.eggBoardCountdown === null) state.eggBoardCountdown = rollEggBoardCountdown(state.rng);
    state.eggBoardCountdown -= 1;
    const eggBoard = state.eggBoardCountdown <= 0;
    if (eggBoard) state.eggBoardCountdown = rollEggBoardCountdown(state.rng);
    const active = snake.createSnakeMode(grid, { rng: () => state.rng(), upgrades: state.upgrades, seeds: state.seeds, best: state.best, snake: setup.snake, direction: setup.direction, tickMs: setup.tickMs, eggBoard });
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
    if (mode === "snake") return startSnake(state, setup);
    if (mode === "duel") {
      const grid = setup.grid || { columns: 30, rows: 30 };
      const px = Math.floor(grid.columns / 2) - 1; const ox = Math.floor(grid.columns / 2);
      const active = { grid, player: { body: [{ x: px, y: grid.rows - 3 }, { x: px, y: grid.rows - 2 }, { x: px, y: grid.rows - 1 }], direction: "up" }, opponent: { body: [{ x: ox, y: 2 }, { x: ox, y: 1 }, { x: ox, y: 0 }], direction: "down" }, foods: [], score: 0, direction: "up", nextDirection: "up", directionQueue: [], tickMs: setup.tickMs || slowedTick(125) };
      active.foods = duel.spawnFoods(active, setup.foodCount || 5, () => state.rng()); state.active = active; return;
    }
    if (mode === "crossing") {
      const grid = setup.grid || { columns: 15, rows: 13 }; const entryColumn = setup.entryColumn ?? Math.floor(grid.columns / 2); const snakeBody = [{ x: entryColumn, y: grid.rows - 1 }, { x: entryColumn, y: grid.rows }, { x: entryColumn, y: grid.rows + 1 }];
      state.active = { grid, snake: snakeBody, cars: buildCrossingCars(1, grid), score: 0, stage: 1, snakeLength: 3, entryColumn, direction: "up", nextDirection: "up", directionQueue: [], tickMs: setup.tickMs || slowedTick(82) }; return;
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
    const habitatHardCapacities = config.habitatConfig.habitats.map((habitat, index) =>
      economy.habitatMaxCapacity(habitat, state.habitats.upgradeLevels[index], notables.assignedTo(state.notables, index)));
    const snapshot = {
      saveVersion: SAVE_VERSION, mode: state.mode, phase: state.phase, elapsedMs: state.elapsedMs, modeAccumulatorMs: state.modeAccumulatorMs,
      seeds: state.seeds, provisions: state.provisions, branches: state.branches, best: state.best, upgrades: clone(state.upgrades), selectedBoardLevel: state.selectedBoardLevel,
      cosmetics: clone(state.cosmetics), snakebirdProgress: clone(state.snakebirdProgress), nursery: clone(state.nursery), habitats: clone(state.habitats), notables: clone(state.notables), eggBoardCountdown: state.eggBoardCountdown, active,
      migration: clone(state.migration), migrationChallenge: clone(state.migrationChallenge), tradeRoutes: clone(state.tradeRoutes),
      activeResupplyMissions: clone(state.activeResupplyMissions), completedResupplyMissions: clone(state.completedResupplyMissions),
      nextResupplyMissionId: state.nextResupplyMissionId,
      notableCapacity: notables.capacity(state.notables, state.habitats.counts), notableRosterOverCapacity: notables.rosterOverCapacity(state.notables, state.habitats.counts),
      habitatHardCapacities, habitatOverCapacity: state.habitats.counts.map((count, index) => count > habitatHardCapacities[index]),
      hud: { score: active && Number(active.score) || 0, best: state.best, seeds: state.seeds, provisions: state.provisions, branches: state.branches, elapsedMs: state.elapsedMs },
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
    let simulationNow = savedAt;
    function syncActiveSettlementFromCanonical() {
      migration.loadActiveSettlement(state); normalizeLocalState(state, simulationNow);
    }
    function finishCrossSettlementMutation() {
      syncActiveSettlementFromCanonical(); migration.creditActiveSettlement(state); migration.storeActiveSettlement(state);
    }
    function normalizeSettlementEconomy(settlement) {
      if (!settlement?.economy) return;
      const local = settlement.economy;
      settlement.economy = {
        ...local,
        seeds: Math.max(0, Number(local.seeds) || 0), branches: Math.max(0, Number(local.branches) || 0), provisions: Math.max(0, Number(local.provisions) || 0),
        upgrades: normalUpgrades(local.upgrades), selectedBoardLevel: Math.min(normalUpgrades(local.upgrades).boardLevel, Math.max(0, Math.floor(Number(local.selectedBoardLevel) || 0))),
        nursery: economy.createNursery(local.nursery, simulationNow), habitats: economy.createHabitats(local.habitats), notables: notables.createState(local.notables)
      };
    }
    function advanceSettlementWorld(dtMs) {
      const total = Math.max(0, Number(dtMs) || 0); const events = [];
      if (!total) return events;
      migration.creditActiveSettlement(state); migration.storeActiveSettlement(state);
      state.migration.settlements.forEach(normalizeSettlementEconomy);
      const end = simulationNow + total; let cursor = simulationNow;
      while (cursor < end) {
        const routeBoundary = tradeRoutes.nextShipmentTime(state, cursor, end);
        const resupplyBoundary = resupply.nextArrivalTime(state, cursor, end);
        const foundingRemaining = state.migration.settlements
          .filter((item) => item.status === "founding" && item.foundingRemainingMs > 0)
          .reduce((minimum, item) => Math.min(minimum, item.foundingRemainingMs), Infinity);
        const foundingBoundary = Number.isFinite(foundingRemaining) ? cursor + foundingRemaining : Infinity;
        const boundary = Math.min(end, routeBoundary ?? Infinity, resupplyBoundary ?? Infinity, foundingBoundary);
        const segment = Math.max(0, boundary - cursor);
        if (segment > 0) {
          for (const settlement of state.migration.settlements) {
            if (settlement.status !== "established" || !settlement.economy) continue;
            const ticked = economy.tickEconomy(settlement.economy, segment, { rng: () => state.rng(), foodValue: economy.foodValueFromUpgrades(settlement.economy.upgrades) });
            events.push(...ticked.events.map((item) => ({ ...item, settlementId: settlement.id })));
          }
          events.push(...migration.tick(state, segment, boundary, () => state.rng(), { deferEconomySync: true }).events);
          cursor = boundary;
        }
        const arrived = resupply.resolveDue(state, cursor); events.push(...arrived.events);
        const resolved = tradeRoutes.resolveDue(state, cursor); events.push(...resolved.events);
        if (segment === 0 && arrived.events.length === 0 && resolved.events.length === 0) cursor = end;
      }
      simulationNow = end; syncActiveSettlementFromCanonical();
      const awarded = migration.creditActiveSettlement(state); if (awarded) events.push(event("migrationPointsEarned", { amount: awarded }));
      migration.storeActiveSettlement(state); return events;
    }
    function dispatch(action) {
      action = action && typeof action === "object" ? action : {};
      const events = [];
      const seedsBefore = state.seeds;
      const reject = (reason) => { events.push(event("actionRejected", { action: action.type || null, reason })); return result(state, events); };
      switch (action.type) {
        case "start":
        case "restart":
          if (!modeNames.has(state.mode)) return reject("modeNotImplemented");
          startMode(state, state.mode, action.setup); events.push(event("runReady", { mode: state.mode })); break;
        case "begin":
          // Start a ready run without a turn (the host's Start button); the
          // snake keeps its current heading.
          if (!state.active || state.phase !== "ready") return reject("notReady");
          state.phase = "running"; events.push(event("runStarted", { mode: state.mode })); break;
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
          state.selectedBoardLevel = level; migration.storeActiveSettlement(state); startMode(state, state.mode, action.setup); events.push(event("boardSelected", { level }), event("runReady", { mode: state.mode })); break;
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
          state.seeds -= cost; state.upgrades[key] += 1;
          if (action.upgrade === "board") state.selectedBoardLevel = state.upgrades.boardLevel;
          migration.storeActiveSettlement(state);
          events.push(event("upgradePurchased", { upgrade: action.upgrade, cost })); break;
        }
        case "layEgg": return reject("automatic");
        case "placeHabitat": {
          const index = Math.floor(Number(action.index));
          const habitat = config.habitatConfig.habitats[index];
          const count = Math.max(1, Math.floor(Number(action.count) || 1));
          if (!habitat || state.nursery.colonyCount < count || state.best < habitat.unlockScore) return reject("habitatUnavailable");
          const leader = notables.assignedTo(state.notables, index);
          if (state.habitats.counts[index] + count > economy.habitatMaxCapacity(habitat, state.habitats.upgradeLevels[index], leader)) return reject("habitatOverCapacity");
          state.nursery.colonyCount -= count; state.habitats.counts[index] += count; events.push(event("habitatPlaced", { index, count }));
          // A colony-store snake receives exactly one lifetime placement roll;
          // batches can therefore produce several ordered pending candidates.
          for (let placed = 0; placed < count; placed += 1) {
            if (state.rng() < config.notableConfig.habitatAssignmentChance) {
              const generated = notables.generate(state.notables, { type: "HABITAT_ASSIGNMENT", reference: habitat.name }, () => state.rng(), Number(action.now) || savedAt, state.habitats.counts);
              events.push(...generated.events);
            }
          }
          break;
        }
        case "upgradeHabitat": {
          const index = Math.floor(Number(action.index));
          const habitat = config.habitatConfig.habitats[index];
          if (!habitat || state.best < habitat.unlockScore) return reject("habitatUnavailable");
          const level = state.habitats.upgradeLevels[index];
          const cost = economy.habitatUpgradeCost(habitat, level);
          if (state.branches < cost) return reject("insufficientBranches");
          state.branches -= cost;
          state.habitats.upgradeLevels[index] += 1;
          events.push(event("habitatUpgraded", { index, level: level + 1, cost }));
          break;
        }
        case "upgradeNest": {
          const level = state.nursery.nestLevel;
          if (economy.nestCapacity(state.nursery) >= config.nurseryConfig.upgrades.nest.maxSlots) return reject("maxed");
          const cost = economy.nestUpgradeCost(level);
          if (state.branches < cost) return reject("insufficientBranches");
          state.branches -= cost;
          state.nursery.nestLevel += 1;
          events.push(event("nestUpgraded", { level: level + 1, branchCost: cost }));
          break;
        }
        case "upgradeNursery": {
          const level = state.nursery.nurseryLevel;
          const cost = economy.nurseryUpgradeCost(level);
          if (state.branches < cost) return reject("insufficientBranches");
          if (state.seeds < cost.seeds) return reject("insufficientSeeds");
          state.branches -= cost.branches;
          state.seeds -= cost.seeds;
          state.nursery.nurseryLevel += 1;
          events.push(event("nurseryUpgraded", { level: level + 1, branchCost: cost.branches, seedCost: cost.seeds }));
          break;
        }
        case "generateNotable": {
          const generated = notables.generate(state.notables, { type: action.sourceType || "DEBUG", reference: action.sourceReference || "" }, () => state.rng(), Number(action.now) || savedAt, state.habitats.counts);
          events.push(...generated.events); break;
        }
        case "claimBoardMastery": {
          const mastery = config.boardMasteryConfig.find((item) => item.masteryId === action.masteryId);
          if (!mastery) return reject("invalidMastery");
          if (state.notables.masteryRewardsClaimed[mastery.masteryId]) return reject("masteryAlreadyClaimed");
          const currentSize = state.active?.grid ? `${state.active.grid.columns}x${state.active.grid.rows}` : "";
          if (state.mode !== "snake" || currentSize !== mastery.boardSize || Number(state.active?.score) < mastery.masteryScore) return reject("masteryNotAchieved");
          state.notables.masteryRewardsClaimed[mastery.masteryId] = true;
          const generated = notables.generate(state.notables, { type: "BOARD_MASTERY", reference: mastery.boardSize }, () => state.rng(), Number(action.now) || savedAt, state.habitats.counts);
          events.push(event("BOARD_MASTERY_REWARD_CLAIMED", { masteryId: mastery.masteryId }), ...generated.events); break;
        }
        case "recruitNotable": {
          const cost = config.notableConfig.directRecruitmentCost;
          if (notables.rosterOverCapacity(state.notables, state.habitats.counts)) return reject("notableCapacityFull");
          if (state.nursery.colonyCount < cost) return reject("insufficientColonySnakes");
          state.nursery.colonyCount -= cost; state.notables.directRecruitmentsCompleted += 1;
          const generated = notables.generate(state.notables, { type: "DIRECT_RECRUITMENT", reference: `${cost} colony snakes` }, () => state.rng(), Number(action.now) || savedAt, state.habitats.counts);
          events.push(event("NOTABLE_RECRUITMENT_COMPLETED", { cost }), ...generated.events); break;
        }
        case "assignNotable": {
          const assigned = notables.assign(state.notables, action.notableId, Math.floor(Number(action.habitatId)), config.habitatConfig.habitats, state.habitats.counts);
          if (!assigned.accepted) return reject(assigned.reason); events.push(...assigned.events); break;
        }
        case "unassignNotable": {
          const unassigned = notables.unassign(state.notables, action.notableId);
          if (!unassigned.accepted) return reject(unassigned.reason); events.push(...unassigned.events); break;
        }
        case "dismissNotable":
        case "retireNotable": {
          const removed = notables.removeRetained(state.notables, action.notableId, Number(action.now) || savedAt);
          if (!removed) return reject("notableMissing");
          events.push(event(removed.hasServed ? "NOTABLE_RETIRED" : "NOTABLE_DISMISSED", { notableId: removed.id }));
          const promoted = notables.promotePendingIfSpace(state.notables, state.habitats.counts);
          if (promoted) events.push(event("NOTABLE_RETAINED", { notableId: promoted.id, fromPending: true }));
          break;
        }
        case "resolvePendingNotable": {
          const resolved = notables.resolvePending(state.notables, action.decision, action.replaceNotableId, Number(action.now) || savedAt, state.habitats.counts);
          if (!resolved.accepted) return reject(resolved.reason); events.push(...resolved.events); break;
        }
        case "startMigration": {
          const started = migration.startExpedition(state, action, Number(action.now) || savedAt, () => state.rng());
          if (!started.accepted) return reject(started.reason);
          normalizeLocalState(state, Number(action.now) || savedAt); events.push(event("migrationDeparted", { expeditionId: started.expedition.id, cost: started.cost })); break;
        }
        case "resolveMigrationStop": {
          const resolved = migration.resolveStop(state, action.expeditionId, action.optionId, Number(action.now) || savedAt);
          if (!resolved.accepted) return reject(resolved.reason); events.push(event("migrationStopResolved", { expeditionId: action.expeditionId })); break;
        }
        case "beginMigrationChallenge": {
          const expedition = state.migration.activeExpeditions.find((item) => item.id === action.expeditionId);
          if (!expedition || expedition.state !== "waitingChallenge") return reject("challengeUnavailable");
          const challenge = config.migrationConfig.challenge; const cx = Math.floor(challenge.columns / 2); const cy = Math.floor(challenge.rows / 2);
          startSnake(state, { grid: { columns: challenge.columns, rows: challenge.rows }, snake: Array.from({ length: challenge.startingLength }, (_, index) => ({ x: cx - index, y: cy })), direction: "right", tickMs: challenge.tickMs });
          state.phase = "running"; state.migrationChallenge = { expeditionId: expedition.id, requiredSeeds: challenge.requiredSeeds, collectedSeeds: 0, startingBest: state.best };
          events.push(event("migrationChallengeStarted", { expeditionId: expedition.id })); break;
        }
        case "skipMigrationChallenge": {
          const skipped = migration.skipChallenge(state, action.expeditionId, Number(action.now) || savedAt);
          if (!skipped.accepted) return reject(skipped.reason); events.push(event("migrationChallengeSkipped", { expeditionId: action.expeditionId })); break;
        }
        case "returnMigration": {
          const returned = migration.returnExpedition(state, action.expeditionId, Number(action.now) || savedAt);
          if (!returned.accepted) return reject(returned.reason);
          normalizeLocalState(state, Number(action.now) || savedAt); events.push(event("migrationReturned", { expeditionId: action.expeditionId, refund: returned.refund })); break;
        }
        case "selectSettlement": {
          const selected = migration.selectSettlement(state, action.settlementId);
          if (!selected.accepted) return reject(selected.reason);
          normalizeLocalState(state, Number(action.now) || savedAt); state.active = null; state.phase = "ready"; events.push(event("settlementSelected", { settlementId: action.settlementId })); break;
        }
        case "createTradeRoute":
        case "configureTradeDirection":
        case "setTradeDirectionPaused":
        case "setTradeRoutePaused":
        case "setTradeWorkers":
        case "purchaseTradeUpgrade":
        case "dismantleTradeRoute": {
          migration.storeActiveSettlement(state);
          const routeAction = action.type === "createTradeRoute" ? tradeRoutes.createRoute(state, action, Number(action.now) || simulationNow)
            : action.type === "configureTradeDirection" ? tradeRoutes.configureDirection(state, action, Number(action.now) || simulationNow)
            : action.type === "setTradeDirectionPaused" ? tradeRoutes.setDirectionPaused(state, action, Number(action.now) || simulationNow)
            : action.type === "setTradeRoutePaused" ? tradeRoutes.setRoutePaused(state, action, Number(action.now) || simulationNow)
            : action.type === "setTradeWorkers" ? tradeRoutes.setWorkers(state, action, Number(action.now) || simulationNow)
            : action.type === "purchaseTradeUpgrade" ? tradeRoutes.purchaseUpgrade(state, action)
            : tradeRoutes.dismantleRoute(state, action);
          if (!routeAction.accepted) return reject(routeAction.reason);
          events.push(...routeAction.events); finishCrossSettlementMutation(); break;
        }
        case "dispatchResupply": {
          migration.storeActiveSettlement(state);
          const dispatched = resupply.dispatch(state, action, Number(action.now) || simulationNow);
          if (!dispatched.accepted) return reject(dispatched.reason);
          events.push(...dispatched.events); finishCrossSettlementMutation(); break;
        }
        case "setCosmetics":
          state.cosmetics = { ...state.cosmetics, ...(action.cosmetics || {}) }; events.push(event("cosmeticsChanged")); break;
        // Host-bridge actions used during the incremental migration (and beyond):
        // syncSeeds reconciles the shared seed balance from a host system that
        // still owns some gameplay; addSeeds/addColonySnakes apply dev grants;
        // setUpgrades pushes host-owned upgrade levels so economy food value is
        // correct before that system is itself migrated.
        case "syncSeeds":
          state.seeds = Math.max(0, Number(action.seeds) || 0); break;
        case "syncBest":
          state.best = Math.max(state.best, Math.max(0, Number(action.best) || 0)); break;
        case "addSeeds":
          state.seeds = Math.max(0, state.seeds + (Number(action.amount) || 0)); events.push(event("seedsChanged")); break;
        case "addColonySnakes":
          state.nursery.colonyCount = Math.max(0, state.nursery.colonyCount + (Math.floor(Number(action.amount)) || 0));
          events.push(event("colonyChanged")); break;
        case "setUpgrades":
          state.upgrades = normalUpgrades(action.upgrades);
          state.selectedBoardLevel = Math.min(state.selectedBoardLevel, state.upgrades.boardLevel);
          migration.storeActiveSettlement(state); break;
        default: return reject("unknownAction");
      }
      events.push(...economy.reconcileEggProgress(state, seedsBefore));
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
      events.push(...advanceSettlementWorld(rawDt));
      const seedsAfterEconomy = state.seeds;
      if (state.mode === "snake" && state.active) { state.active.seeds = state.seeds; state.active.best = state.best; }
      if (state.phase === "running") state.elapsedMs += dt;
      if (state.mode === "snake" && state.phase === "running" && state.active) {
        state.modeAccumulatorMs += dt;
        while (state.modeAccumulatorMs >= state.active.tickMs && state.phase === "running") {
          const stepped = snake.stepSnake(state.active, { rng: () => state.rng() });
          state.seeds = state.active.seeds; state.best = state.active.best;
          state.modeAccumulatorMs -= state.active.tickMs;
          events.push(...stepped.events);
          stepped.events.filter((item) => item.type === "eggCollected").forEach(() => {
            events.push(economy.addEggBoardHatchling(state, () => state.rng()));
          });
          if (state.migrationChallenge) {
            state.migrationChallenge.collectedSeeds = state.active.score;
            state.seeds = seedsAfterEconomy;
            state.active.seeds = seedsAfterEconomy;
            state.best = state.migrationChallenge.startingBest;
            state.active.best = state.migrationChallenge.startingBest;
            if (state.migrationChallenge.collectedSeeds >= state.migrationChallenge.requiredSeeds) {
              const expeditionId = state.migrationChallenge.expeditionId;
              migration.resolveChallenge(state, expeditionId, true, savedAt + state.migration.elapsedMs);
              state.migrationChallenge = null; state.phase = "gameover"; events.push(event("migrationChallengeCompleted", { expeditionId }));
            } else if (!stepped.alive) {
              const expeditionId = state.migrationChallenge.expeditionId;
              migration.resolveChallenge(state, expeditionId, false, savedAt + state.migration.elapsedMs);
              state.migrationChallenge = null; state.phase = "gameover"; events.push(event("migrationChallengeFailed", { expeditionId }));
            }
          } else if (!stepped.alive) { state.phase = "gameover"; events.push(event("runEnded", { mode: "snake" })); }
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
      events.push(...economy.reconcileEggProgress(state, seedsAfterEconomy));
      events.push(...economy.tryStartEgg(state));
      if (!state.migrationChallenge) migration.recordSnakeSeeds(state, Math.max(0, state.seeds - seedsAfterEconomy));
      migration.creditActiveSettlement(state); migration.storeActiveSettlement(state);
      return result(state, events);
    }
    function advanceOffline(now) {
      const target = Math.max(savedAt, Number(now) || savedAt);
      // Offline catch-up is anchored to the last persisted wall-clock time.
      // In normal host usage this runs once at hydration; retaining that anchor
      // also preserves deterministic callers that live-tick before catch-up.
      const dt = target - savedAt; const events = advanceSettlementWorld(dt); savedAt = target;
      return result(state, events);
    }
    return { snapshot: () => makeSnapshot(state), dispatch, tick, advanceOffline,
      serialize: () => { migration.creditActiveSettlement(state); migration.storeActiveSettlement(state); return { saveVersion: SAVE_VERSION, savedAt: simulationNow, session: clone({ ...state, active: null, migrationChallenge: null }) }; } };
  }
  return { SAVE_VERSION, MAX_LIVE_DT, migrateLegacy, createGameSession };
});
