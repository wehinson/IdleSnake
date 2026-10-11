// Bounded breadth-first search over the actual shipped Snakebird engine.
// Tooling only: no alternative movement/gravity implementation.
const engine = require("../snakebird-engine.js");
const directions = { U: "up", D: "down", L: "left", R: "right" };

function stateKey(state) {
  return state.body.map(engine.key).join(";") + "|" + [...state.fruits].sort().join(";");
}

function replay(map, witness) {
  let state = engine.parseLevel(map);
  const trace = [];
  for (const [index, symbol] of [...witness].entries()) {
    if (engine.isComplete(state)) throw new Error(`Witness continues after completion at ${index}`);
    const before = state;
    const result = engine.applyMove(state, directions[symbol]);
    if (!result.accepted || result.fell) throw new Error(`Illegal witness move ${index + 1}: ${symbol}`);
    state = result.state;
    const vectorY = symbol === "U" ? -1 : symbol === "D" ? 1 : 0;
    trace.push({ move: index + 1, symbol, ateFruit: Boolean(result.ateFruit),
      fruit: result.ateFruit ? `${state.body[0].x},${before.body[0].y + vectorY}` : null,
      drop: state.body[0].y - before.body[0].y - vectorY,
      length: state.body.length, complete: engine.isComplete(state) });
  }
  return { state, trace, complete: engine.isComplete(state) };
}

function solve(map, { maxStates = 200000, maxDepth = 100, firstFruit = null, initialState = null } = {}) {
  const start = initialState || engine.parseLevel(map);
  const nodes = [{ state: start, parent: -1, symbol: "", depth: 0 }];
  const seen = new Set([stateKey(start)]);
  let falls = 0;
  let depthLimited = false;
  for (let cursor = 0; cursor < nodes.length; cursor += 1) {
    const node = nodes[cursor];
    if (engine.isComplete(node.state)) {
      let witness = "";
      for (let i = cursor; nodes[i].parent >= 0; i = nodes[i].parent) witness = nodes[i].symbol + witness;
      return { status: "solved", witness, moves: witness.length, explored: cursor + 1, discovered: nodes.length, falls };
    }
    for (const [symbol, direction] of Object.entries(directions)) {
      const result = engine.applyMove(node.state, direction);
      if (!result.accepted) continue;
      if (result.fell) { falls += 1; continue; }
      if (firstFruit && node.state.fruits.size === start.fruits.size && result.ateFruit && node.state.fruits.has(firstFruit) && result.state.fruits.has(firstFruit)) continue;
      const key = stateKey(result.state);
      if (seen.has(key)) continue;
      if (node.depth >= maxDepth) { depthLimited = true; continue; }
      if (nodes.length >= maxStates) return { status: "limit", discovered: nodes.length, falls };
      seen.add(key);
      nodes.push({ state: result.state, parent: cursor, symbol, depth: node.depth + 1 });
    }
  }
  return { status: depthLimited ? "depth-limit" : "unsolved", discovered: nodes.length, falls };
}

module.exports = { solve, replay, directions };
if (require.main === module) {
  const levels = require("../engine/puzzle-levels.js").snakebird;
  for (const [index, level] of levels.entries()) {
    const result = solve(level.map);
    console.log(JSON.stringify({ level: index + 1, name: level.name, ...result }));
    if (result.status !== "solved" || !replay(level.map, result.witness).complete) process.exitCode = 1;
  }
}
