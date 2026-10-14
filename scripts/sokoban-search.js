// Bounded, headless design verifier. Every edge uses the shipped engine.
const sokoban = require("../engine/sokoban.js");

const directions = { U: "up", R: "right", D: "down", L: "left" };
function copyState(state) {
  return { ...state, snake: state.snake.map(p => ({ ...p })),
    crates: state.crates.map(p => ({ ...p })), pellets: state.pellets.map(p => ({ ...p })) };
}
function stateKey(state) {
  return [state.snake, state.crates, state.pellets]
    .map(points => points.map(p => `${p.x},${p.y}`).join(";")).join("|");
}
function search(definition, { maxStates = 30000, pellets = definition.pellets, guided = false, growthTarget = definition.snake.length } = {}) {
  const grid = { columns: definition.map[0].length, rows: definition.map.length };
  const start = sokoban.parseLevel({ ...definition, pellets }, grid, 0);
  const queue = [{ state: start, parent: -1, move: "" }];
  const seen = new Set([stateKey(start)]);
  // Optional weighted queue finds witnesses on larger boards. It does not
  // promise shortest paths; an exhausted search still visits every state.
  const pending = [];
  function enqueue(index) {
    const state = queue[index].state;
    const distance = state.crates.reduce((sum, crate) => sum + Math.min(...state.goals.map(goal =>
      Math.abs(crate.x - goal.x) + Math.abs(crate.y - goal.y))), 0);
    const priority = state.moves + (guided ? distance * 12 + Math.max(0, growthTarget - state.snake.length) * 10 : 0);
    const item = { index, priority };
    pending.push(item);
    let cursor = pending.length - 1;
    while (cursor > 0) {
      const parent = (cursor - 1) >> 1;
      if (pending[parent].priority <= priority) break;
      pending[cursor] = pending[parent]; cursor = parent;
    }
    pending[cursor] = item;
  }
  function dequeue() {
    const first = pending[0];
    const last = pending.pop();
    if (pending.length) {
      let cursor = 0;
      while (cursor * 2 + 1 < pending.length) {
        let child = cursor * 2 + 1;
        if (child + 1 < pending.length && pending[child + 1].priority < pending[child].priority) child++;
        if (pending[child].priority >= last.priority) break;
        pending[cursor] = pending[child]; cursor = child;
      }
      pending[cursor] = last;
    }
    return first.index;
  }
  enqueue(0);
  while (pending.length) {
    const index = dequeue();
    const node = queue[index];
    for (const [move, direction] of Object.entries(directions)) {
      const next = copyState(node.state);
      const result = sokoban.applyMove(next, direction);
      if (!result.accepted) continue;
      if (result.won) {
        let solution = move;
        for (let cursor = index; cursor >= 0; cursor = queue[cursor].parent) solution = queue[cursor].move + solution;
        return { solution, visited: seen.size, exhausted: false };
      }
      const key = stateKey(next);
      if (seen.has(key)) continue;
      if (seen.size >= maxStates) return { solution: null, visited: seen.size, exhausted: false };
      seen.add(key); queue.push({ state: next, parent: index, move }); enqueue(queue.length - 1);
    }
  }
  return { solution: null, visited: seen.size, exhausted: true };
}

if (require.main === module) {
  const levels = require("../engine/puzzle-levels.js").sokoban;
  const indices = process.argv.slice(2).map(Number);
  if (indices.some(index => !Number.isInteger(index) || index < 0 || index >= levels.length)) {
    throw new Error(`Provide zero-based stage indices from 0 to ${levels.length - 1}.`);
  }
  for (const index of indices.length ? indices : levels.map((_, i) => i)) {
    console.log(JSON.stringify({ stage: index + 1, name: levels[index].name, ...search(levels[index], { guided: true }) }));
  }
}
module.exports = { directions, copyState, search };
