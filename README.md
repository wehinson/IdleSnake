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

Button sounds: phone buttons play `assets/audio/phone-double-tap.wav` (generated for this project). Main menu buttons play `assets/audio/menu-click-el-boss.mp3` ("UI Button Click" by el_boss on Freesound, sound 677861, CC0). `scripts/ui-sounds.js` selects the sound.

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

Open `http://127.0.0.1:4173/?snakeTiming=1`, play a few games, then click **Download timing log** at the top right. Send the downloaded JSON with the video. The log records direction actions, frame timing, each clock update, movement state, and Seed events. Classic Snake counts the full elapsed time; other modes keep their 100 ms frame limit. The log stays in the browser until you download it. It does not include the saved game or send data to a server. A long session keeps the latest 20,000 records and reports how many older records were dropped.

## Snake speed

Open the 0 settings menu to select Turtle (75%), Snake (100%, default), or Rabbit (150%). The preset and board size scale the complete speed curve. Each board reaches three times its own starting speed at mastery. The setting applies immediately and is saved with the game. Other minigames and the idle economy keep their existing speed. Headless hosts can dispatch { type: "setSnakeSpeed", snakeSpeed: "turtle" | "snake" | "rabbit" }.

## Engine and UI boundary

The session owns game state and game controls for all 11 modes. The browser sends actions and reads immutable snapshots through engine/state-reader.js. It keeps display preferences, input tracking, and animation history. It does not copy scores, positions, currencies, or phases into mutable game variables.

- launchGame: open a named mode; force: true starts it again.
- openMinigame: use the numbered keypad, including its unlock rules and the Duel-to-Runner shortcut.
- primaryAction: use the Start control, including Battleship placement and fire.
- togglePause: pause, resume, or use the mode-specific Pause control.
- resetRun: restart the current run, or continue a completed puzzle.
- playDirection: use a direction control, including reset after game over.

When paused, each gameplay control resumes the current run. The first input resumes without moving, resetting, or selecting another game. This applies to directions, Start, Pause, Reset, and minigame choices. Settings opens its menu during Game Over. Keyboard play clears focus from game buttons; pause does not leave a button highlighted. Swallowed Seed, crumb, and tail effects freeze during pause and continue from the same point after resume.

Board purchases, food-count purchases, board selection, and settlement selection create their new Snake board inside the session. The engine/queries.js module provides panel costs, production, availability, and migration estimates. The engine/save-projection.js module handles legacy storage projection. The browser still handles storage I/O and visual effects.

Run Snake without a browser:

    npm run play -- --mode snake --seed 42 --steps 200 --direction up

The command prints events, the final HUD, and a save envelope. It does not write a save. Use --actions actions.json for a JSON array of session actions, one per simulation step; use null for a step without input. Use --save save.json to load progress. Use --step-ms 100 to set simulated time per step. The default controller sends one direction and then lets time advance; it is not a solver for every mode.

Lower-level actions such as selectMode and custom setup remain available for tests and simulations. Save envelopes retain the active Classic Snake board, food, phase, queued turns, and movement clock. Reload keeps a ready, running, or paused board. Reload after Game Over creates a fresh Ready board and keeps earned progress. A running Snake continues through elapsed time after reload or loss of focus. An explicit pause stays paused. Other active minigame boards and random-generator state are not saved.

Classic Snake increases passive Seed income by 1% for each segment while running. Length 15 gives a 1.15x multiplier. The Length Bonus upgrade adds 5 percentage points per segment per level: 1%, 6%, 11%, and so on. The first upgrade costs 500 Seeds; each later cost grows by 2.5x. The bonus applies only to the active settlement's passive Seeds. Ready, pause, and Game Over use the base rate. Branches, Provisions, food rewards, and transferred Seeds keep their normal values. The Seed counter shows current passive income per second and shows the multiplier while it applies. Space closes the 0 settings menu.

Food acceleration uses three continuous linear segments, one for each third of the board mastery target. Speed gain per food is constant within each segment. The middle segment gains speed 15% faster than the first; the final segment gains speed 15% faster than the middle. The segments scale from the existing starting speed to exactly 3x at mastery. Intervals retain fractional milliseconds.

Direction input uses its event timestamp. A turn pressed before a movement deadline can correct the latest movement when processed up to 34 ms after that deadline. The correction restores food, rewards, shields, and other effects before applying the turn. Movement speed and the collision grace stay unchanged. Arrow input rechecks the one-second death lock after advancing time, so an input that causes death cannot also reset the run.

Each hatchling consumes one Seed every 900 ms while feeding. It grows a second block at 5 minutes, a third block at 10 minutes, and graduates at 15 minutes after consuming 1,000 Seeds. Growth stops when Seeds run out. The nursery's Pause feeding button stops feeding and growth while keeping Seeds. This setting is saved and applies during offline progress. The nursery heading places the title on the left, the button in the middle, and capacity on the right.

Fullscreen mode is available after the first board upgrade and is saved across reloads. It expands the play field and makes the side menu 25% wider, within the screen width. Its Minigames button sits between Start and Phone Mode and lists game names with their unlock state. The controls sit 10 px higher. Screen scanlines, tint, and bezel shading are 25% weaker in fullscreen. Returning after a background death shows a static Game Over screen. A death animation in progress is also cleared when the tab loses focus.

Fatal classic Snake collisions have a 120 ms grace period, set by snakeConfig.collisionGraceMs. The snake holds on its last safe square; a legal safe turn during this window completes the pending move and starts a full movement interval. Unsafe input does not extend the window. Pause freezes it and reset clears it. Shields keep their existing immediate rescue behavior.

Classic Snake body blocks use one base shade without markings. Their area varies randomly from 85% to 115% of normal. Each block keeps its size through movement, growth, pause, and reload. Blocks stay square and centered in their cells. The head and tail keep their normal size and selected head color. Connectors are 15% brighter than the body color and 25% thinner than the previous appearance. The board checker has about 12.75% brightness difference, 15% less contrast than before, with two-pixel grid lines and an outline aligned to the same cell boundaries. Cell movement, turn timing, and collision rules are unchanged.
