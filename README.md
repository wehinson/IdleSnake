# IdleSnake

IdleSnake is a browser game that combines classic Snake boards with an idle colony and nursery. Save data is currently stored in the browser's `localStorage`.

## Prerequisites

Use a supported Node.js LTS release (Node 22 is used in CI) and npm.

## Run locally

Install dependencies, then start the static server:

```sh
npm ci
npm run serve
```

Open `http://127.0.0.1:4173` in a browser.

## Checks and tests

```sh
npm run check:syntax
npm test
npm run test:coverage
npm run test:browser
npm run check
```

`npm test` runs the Node unit tests colocated with the engine modules. `npm run test:browser` runs a fast Chromium smoke test against the complete page and its basic Start, Pause, and Reset controls. `npm run check` is the required normal local verification: syntax checking plus unit tests.

Before handing off a change, run `npm run check` and `npm run test:browser`.

## Project map

- `index.html`, `styles.css`, and `game.js`: the browser game interface.
- `engine/`: game, economy, save, and minigame logic, with colocated Node tests.
- `tests/browser/`: Playwright browser smoke tests.
- `scripts/`: small cross-platform development helpers.
- `.github/workflows/ci.yml`: continuous integration checks.


## Headless puzzles

The session loads the shipped Snakebird and Sokoban levels in Node without a browser:

```js
const { createGameSession } = require("./engine/session.js");
const { runHeadless } = require("./engine/simulate.js");

const game = createGameSession({ now: 0, rng: () => 0.5 });
game.dispatch({ type: "selectPuzzleLevel", mode: "sokoban", levelIndex: 0 });
const moves = ["right", "right", "right", "up", "up", "up", "up", "right", "right", "right", "right"];
const result = runHeadless(game, {
  steps: moves.length,
  controller: (_, step) => ({ type: "direction", direction: moves[step] })
});
console.log(result.ended, result.snapshot.seeds);
```

- `launchPuzzle` with `mode` selects a random Snakebird level without an immediate repeat, or the last selected Sokoban level in this session.
- `selectPuzzleLevel` with `mode` and zero-based `levelIndex` selects a shipped level. Invalid indices are rejected.
- `restart` resets the current level.
- `continuePuzzle` resets an unfinished level. After a win, it selects another Snakebird level or the next Sokoban level, with wraparound.
- `serialize()` preserves rewards, records, and Snakebird progress. Active puzzle boards and the session's level selection history are not saved.

Level data is in `engine/puzzle-levels.js`. Custom puzzle definitions remain available through `selectMode.setup` for tests and simulations.

## Classic Snake turns

Turns are stored in a queue of up to three directions. During a run, turns and straight moves use the same movement interval. The earlier immediate-turn and half-interval rules remain in the code but are disabled by `snakeConfig.turnTimingEnabled`. Reversals are checked against the last queued direction, and a full queue rejects additional turns without dropping earlier input. Keyboard repeat events are ignored for classic Snake.

The first valid direction from Ready moves immediately. The Start button keeps its existing opening delay. Pause preserves the queue; reset and game over clear it. Turns use the same engine operation as automatic movement, including food, eggs, shields, rewards, and collisions.

## Snake timing log

Open `http://127.0.0.1:4173/?snakeTiming=1`, play a few games, then click **Download timing log** at the top right. Send the downloaded JSON with the video. The log records direction actions, frame timing, each clock update, the time discarded by the 100 ms gameplay limit, movement state, and Seed events. It stays in the browser until you download it; it does not include the saved game or send data to a server. A long session keeps the latest 20,000 records and reports how many older records were dropped.

## Snake speed

Open the 0 settings menu to select Turtle (75%), Snake (100%, default), or Rabbit (150%). The preset and board size scale the complete speed curve. Each board approaches four times its own starting speed. The setting applies immediately and is saved with the game. Other minigames and the idle economy keep their existing speed. Headless hosts can dispatch { type: "setSnakeSpeed", snakeSpeed: "turtle" | "snake" | "rabbit" }.

## Engine and UI boundary

The session owns game state and game controls for all 11 modes. The browser sends actions and reads immutable snapshots through engine/state-reader.js. It keeps display preferences, input tracking, and animation history. It does not copy scores, positions, currencies, or phases into mutable game variables.

- launchGame: open a named mode; force: true starts it again.
- openMinigame: use the numbered keypad, including its unlock rules and the Duel-to-Runner shortcut.
- primaryAction: use the Start control, including Battleship placement and fire.
- togglePause: pause, resume, or use the mode-specific Pause control.
- resetRun: restart the current run, or continue a completed puzzle.
- playDirection: use a direction control, including reset after game over.

Board purchases, food-count purchases, board selection, and settlement selection create their new Snake board inside the session. The engine/queries.js module provides panel costs, production, availability, and migration estimates. The engine/save-projection.js module handles legacy storage projection. The browser still handles storage I/O and visual effects.

Run Snake without a browser:

    npm run play -- --mode snake --seed 42 --steps 200 --direction up

The command prints events, the final HUD, and a save envelope. It does not write a save. Use --actions actions.json for a JSON array of session actions, one per simulation step; use null for a step without input. Use --save save.json to load progress. Use --step-ms 100 to set simulated time per step. The default controller sends one direction and then lets time advance; it is not a solver for every mode.

Lower-level actions such as selectMode and custom setup remain available for tests and simulations. Save envelopes retain progress, not an in-progress board or random-generator state.

Food acceleration uses a logistic curve based on the board mastery target. The curve reaches its first knee at 30% mastery and starts approaching its asymptote at 75% mastery. Speed is starting speed + (maximum speed - starting speed) * curve progress. Intervals retain fractional milliseconds.

Fatal classic Snake collisions have a 120 ms grace period, set by snakeConfig.collisionGraceMs. The snake holds on its last safe square; a legal safe turn during this window completes the pending move and starts a full movement interval. Unsafe input does not extend the window. Pause freezes it and reset clears it. Shields keep their existing immediate rescue behavior.
