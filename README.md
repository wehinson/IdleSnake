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
