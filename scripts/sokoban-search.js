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
function search(definition, { maxStates = 200000, pellets = definition.pellets } = {}) {
  const grid = { columns: definition.map[0].length, rows: definition.map.length };
  const start = sokoban.parseLevel({ ...definition, pellets }, grid, 0);
  const queue = [{ state: start, parent: -1, move: "" }];
  const seen = new Set([stateKey(start)]);
  for (let index = 0; index < queue.length; index++) {
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
      seen.add(key); queue.push({ state: next, parent: index, move });
    }
  }
  return { solution: null, visited: seen.size, exhausted: true };
}

if (require.main === module) {
  const levels = require("../engine/puzzle-levels.js").sokoban;
  const indices = process.argv.slice(2).map(Number);
  for (const index of indices.length ? indices : levels.map((_, i) => i)) {
    console.log(JSON.stringify({ stage: index + 1, name: levels[index].name, ...search(levels[index]) }));
  }
}
module.exports = { directions, copyState, search };
