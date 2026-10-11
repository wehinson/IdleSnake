const test = require("node:test");
const assert = require("node:assert/strict");
const sokoban = require("./sokoban.js");
const levels = require("./puzzle-levels.js").sokoban;
const solutions = require("../tests/fixtures/sokoban-solutions.json");
const { directions, copyState, search } = require("../scripts/sokoban-search.js");
const { createGameSession } = require("./session.js");

const parse = (definition, index = 0) => sokoban.parseLevel(definition, { columns: 15, rows: 15 }, index);
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
function assertLegal(state) {
  assert.equal(new Set(state.snake.map(sokoban.key)).size, state.snake.length, "unique body cells");
  assert.equal(new Set(state.crates.map(sokoban.key)).size, state.crates.length, "unique crate cells");
  for (const point of [...state.snake, ...state.crates]) assert.equal(sokoban.isWall(state, point), false, "no solid overlap");
  for (const crate of state.crates) assert.equal(sokoban.snakeContains(state, crate), false, "no crate/body overlap");
  state.snake.slice(1).forEach((point, i) => assert.equal(distance(point, state.snake[i]), 1, "body remains connected"));
}

test("fifteen distinct shipped Sokoban definitions have legal starts and real growth-dependent loads", () => {
  assert.equal(levels.length, 15);
  assert.equal(solutions.length, 15);
  assert.equal(new Set(levels.map(level => level.name)).size, 15);
  assert.equal(new Set(levels.map(level => JSON.stringify([level.map, level.crates, level.goals, level.plates]))).size, 15);
  for (const [index, definition] of levels.entries()) {
    assert.equal(Object.isFrozen(definition), true);
    assert.equal(definition.map.length, 15);
    assert.ok(definition.map.every(row => row.length === 15 && /^[#.]+$/.test(row)));
    assert.equal(definition.snake.length, 3);
    assert.ok(definition.pellets.length >= 2);
    assert.equal(definition.crates.length, definition.goals.length);
    assert.ok(definition.crates.some(crate => crate.kind === "heavy"));
    const state = parse(definition, index);
    assertLegal(state);
    assert.ok(state.crates.every(crate => !sokoban.isGoal(state, crate)));
    for (const point of [...state.goals, ...state.pellets, ...state.plates, ...state.gates]) assert.equal(sokoban.isWall(state, point), false);
    assert.equal(new Set([...state.snake, ...state.crates, ...state.pellets].map(sokoban.key)).size,
      state.snake.length + state.crates.length + state.pellets.length, "no initial occupant/pellet overlap");
    for (const gate of state.gates) assert.ok(state.plates.some(plate => plate.id === gate.id));
  }
});

for (const [index, definition] of levels.entries()) {
  test(`Sokoban ${index + 1}: ${definition.name} replay is legal and each heavy push needs growth and its actual wall`, () => {
    const state = parse(definition, index);
    let heavyPushes = 0;
    for (const [step, move] of [...solutions[index]].entries()) {
      assert.equal(state.result, null, "witness stops at first win");
      const direction = directions[move];
      const vector = sokoban.vectors[direction];
      const next = { x: state.snake[0].x + vector.x, y: state.snake[0].y + vector.y };
      const crate = sokoban.crateAt(state, next);
      if (crate?.kind === "heavy") {
        heavyPushes++;
        assert.ok(state.snake.length >= 5);
        assert.ok(state.totalPellets - state.pellets.length >= 2, "growth happened before the push");
        assert.equal(sokoban.isBraced(state, direction), true);
        const tail = state.snake.at(-1);
        const support = { x: tail.x - vector.x, y: tail.y - vector.y };
        assert.ok(state.walls.has(sokoban.key(support)), "explicit room wall provides support");
        const unbraced = copyState(state);
        unbraced.walls = new Set(state.walls);
        unbraced.walls.delete(sokoban.key(support));
        const before = structuredClone(unbraced);
        assert.equal(sokoban.applyMove(unbraced, direction).accepted, false, "same push without its support fails");
        assert.deepEqual(unbraced, before);
        const short = copyState(state);
        short.snake = short.snake.slice(0, 4);
        const shortBefore = structuredClone(short);
        assert.equal(sokoban.applyMove(short, direction).accepted, false, "length four cannot move the load");
        assert.deepEqual(short, shortBefore);
      }
      const result = sokoban.applyMove(state, direction);
      assert.equal(result.accepted, true, `move ${step + 1} ${move}`);
      assertLegal(state);
      assert.equal(result.won, step === solutions[index].length - 1);
    }
    assert.ok(heavyPushes > 0);
    assert.equal(state.result, "won");
    assert.equal(state.moves, solutions[index].length);
    assert.equal(state.score, state.crates.length * 100 + (state.totalPellets - state.pellets.length) * 10);
    assert.equal(state.pellets.length, 0, "witness collects all authored growth");
  });
}

test("exhaustive engine searches find no solution on any stage with fewer than two growth pellets", () => {
  for (const definition of levels) {
    for (const pellets of [[], ...definition.pellets.map(pellet => [pellet])]) {
      const result = search(definition, { pellets, maxStates: 50000 });
      assert.equal(result.exhausted, true, `${definition.name}: search cap is not proof`);
      assert.equal(result.solution, null, definition.name);
    }
  }
});

for (const index of [11, 13]) {
  test(`${levels[index].name} requires every extra pellet, not just the length-five threshold`, () => {
    const definition = levels[index];
    for (let omitted = 0; omitted < definition.pellets.length; omitted++) {
      const result = search(definition, { pellets: definition.pellets.filter((_, i) => i !== omitted), maxStates: 50000 });
      assert.equal(result.exhausted, true, `omitted pellet ${omitted}: cap is inconclusive`);
      assert.equal(result.solution, null);
    }
  });
}

test("every gate guards a goal with no side entry, and disabling plates rejects witnessed entry unchanged", () => {
  for (const [index, definition] of levels.entries()) {
    if (!definition.gates.length) continue;
    const state = parse(definition);
    for (const gate of state.gates) {
      const goal = { x: gate.x + 1, y: gate.y };
      assert.equal(sokoban.isGoal(state, goal), true);
      assert.ok(state.walls.has(sokoban.key({ x: goal.x, y: goal.y - 1 })));
      assert.ok(state.walls.has(sokoban.key({ x: goal.x, y: goal.y + 1 })));
      assert.ok(state.walls.has(sokoban.key({ x: goal.x + 1, y: goal.y })));
      // A crate can reach this unsolved goal only through the gate on its
      // left. A permanently closed gate therefore makes winning impossible.
      assert.equal(sokoban.isOpen({ ...state, plates: [] }, gate), false);
    }
    const checked = new Set();
    for (const move of solutions[index]) {
      const direction = directions[move], vector = sokoban.vectors[direction], head = state.snake[0];
      const next = { x: head.x + vector.x, y: head.y + vector.y };
      const crate = sokoban.crateAt(state, next);
      const destination = crate ? { x: crate.x + vector.x, y: crate.y + vector.y } : next;
      const gate = sokoban.gateAt(state, destination);
      if (gate) {
        checked.add(gate.id);
        const disabled = copyState(state);
        disabled.plates = [];
        const before = structuredClone(disabled);
        assert.equal(sokoban.applyMove(disabled, direction).accepted, false);
        assert.deepEqual(disabled, before);
      }
      assert.equal(sokoban.applyMove(state, direction).accepted, true);
    }
    assert.equal(checked.size, state.gates.length);
  }
});

test("Rebrace spends the first wall anchor and requires repositioning before another right push", () => {
  const index = levels.findIndex(level => level.name === "Rebrace");
  const state = parse(levels[index]);
  for (const move of solutions[index]) {
    const vector = sokoban.vectors[directions[move]];
    const head = state.snake[0];
    const pushed = Boolean(sokoban.crateAt(state, { x: head.x + vector.x, y: head.y + vector.y }));
    assert.equal(sokoban.applyMove(state, directions[move]).accepted, true);
    if (!pushed) continue;
    assert.equal(move, "R");
    assert.equal(sokoban.isBraced(state, "right"), false);
    const before = structuredClone(state);
    assert.equal(sokoban.applyMove(state, "right").accepted, false);
    assert.deepEqual(state, before);
    return;
  }
  assert.fail("witness never pushed");
});

test("Anchorworks must leave its left goal empty for the gated heavy load's final wall brace", () => {
  const state = parse(levels[14]);
  const gate = state.gates[0];
  const leftGoal = state.goals.find(goal => goal.x === Math.min(...state.goals.map(point => point.x)));
  const to = { x: gate.x + 1, y: gate.y };
  // The goal has walls above/below/right. Only a right push can finish it.
  assert.ok(state.walls.has(sokoban.key({ x: to.x, y: to.y - 1 })));
  assert.ok(state.walls.has(sokoban.key({ x: to.x, y: to.y + 1 })));
  assert.ok(state.walls.has(sokoban.key({ x: to.x + 1, y: to.y })));
  let parkedThenCleared = false;
  let wasParked = false;
  for (const move of solutions[14]) {
    const vector = sokoban.vectors[directions[move]], head = state.snake[0];
    const crate = sokoban.crateAt(state, { x: head.x + vector.x, y: head.y + vector.y });
    if (crate?.x === gate.x && crate.y === gate.y && move === "R") {
      assert.deepEqual(state.snake.at(-1), leftGoal, "tail needs the goal cell for the only final right brace");
      assert.equal(sokoban.crateAt(state, leftGoal), undefined);
      assert.equal(parkedThenCleared, true);
    }
    assert.equal(sokoban.applyMove(state, directions[move]).accepted, true);
    const parked = Boolean(sokoban.crateAt(state, leftGoal));
    if (wasParked && !parked) parkedThenCleared = true;
    wasParked ||= parked;
  }
  assert.equal(parkedThenCleared, true);
  assert.equal(state.result, "won");
});

test("all fifteen session replays preserve restart, reward receipts, records, save and sequential wraparound", () => {
  const game = createGameSession({ now: 0, rng: () => 0.5 });
  game.dispatch({ type: "launchPuzzle", mode: "sokoban" });
  for (const [index, definition] of levels.entries()) {
    const initial = game.snapshot();
    assert.equal(initial.active.stageIndex, index);
    const initialSeeds = initial.seeds;
    game.dispatch({ type: "direction", direction: directions[solutions[index][0]] });
    const restarted = game.dispatch({ type: "restart" }).snapshot;
    assert.equal(restarted.seeds, initialSeeds, "unfinished play/restart pays nothing");
    assert.deepEqual(restarted.active.snake, initial.active.snake);
    assert.deepEqual(restarted.active.crates, initial.active.crates);
    assert.deepEqual(restarted.active.pellets, initial.active.pellets);
    assert.equal(restarted.active.moves, 0);
    const events = [];
    for (const move of solutions[index]) {
      const result = game.dispatch({ type: "direction", direction: directions[move] });
      assert.equal(result.events.some(event => event.type === "actionRejected"), false);
      events.push(...result.events);
    }
    const won = game.snapshot();
    const endings = events.filter(event => event.type === "runEnded");
    assert.equal(endings.length, 1);
    assert.equal(endings[0].won, true);
    assert.equal(endings[0].stageIndex, index);
    assert.equal(endings[0].score, won.active.score);
    assert.equal(won.phase, "gameover");
    assert.equal(require("./economy.js").roundSeeds(won.seeds - initialSeeds), endings[0].reward, "exactly one engine-authorized payout at currency precision");
    assert.ok(won.records.sokobanBest >= won.active.score);
    assert.equal(game.dispatch({ type: "direction", direction: "right" }).snapshot.seeds, won.seeds, "won board cannot pay twice");
    const restored = createGameSession({ now: 0, save: game.serialize() }).snapshot();
    assert.equal(restored.seeds, won.seeds);
    assert.equal(restored.records.sokobanBest, won.records.sokobanBest);
    const next = game.dispatch({ type: "continuePuzzle" }).snapshot;
    assert.equal(next.active.stageIndex, (index + 1) % levels.length);
    assert.equal(next.phase, "ready");
  }
});

test("expanded stage selection rejects invalid indices without changing progress", () => {
  const game = createGameSession({ now: 0 });
  const before = game.dispatch({ type: "selectPuzzleLevel", mode: "sokoban", levelIndex: 14 }).snapshot;
  for (const levelIndex of [-1, 15, 1.5, NaN]) {
    const result = game.dispatch({ type: "selectPuzzleLevel", mode: "sokoban", levelIndex });
    assert.ok(result.events.some(event => event.type === "actionRejected"));
    assert.deepEqual(result.snapshot, before);
  }
});

test("old Sokoban rewards and high records survive the expanded catalog without a save migration", () => {
  const game = createGameSession({ now: 0, save: { saveVersion: 5, currencies: { seeds: 123 }, records: { sokobanBest: 900 } } });
  const before = game.snapshot();
  assert.equal(before.seeds, 123);
  assert.equal(before.records.sokobanBest, 900);
  game.dispatch({ type: "selectPuzzleLevel", mode: "sokoban", levelIndex: 14 });
  game.dispatch({ type: "restart" });
  const restored = createGameSession({ now: 0, save: game.serialize() }).snapshot();
  assert.equal(restored.seeds, 123);
  assert.equal(restored.records.sokobanBest, 900);
});
