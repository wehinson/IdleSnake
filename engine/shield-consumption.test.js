const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameSession } = require("./session.js");

test("a collision consumes one durable shield after economy updates replace upgrade state", () => {
  const game = createGameSession({
    now: 0,
    rng: () => 0.5,
    save: {
      currencies: { seeds: 0 },
      upgrades: { shieldLevel: 2 }
    }
  });

  game.dispatch({
    type: "selectMode",
    mode: "snake",
    setup: {
      grid: { columns: 7, rows: 7 },
      snake: [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }],
      direction: "up",
      tickMs: 100
    }
  });
  game.dispatch({ type: "begin" });

  // tick() advances the settlement economy first. That update used to replace
  // the session upgrades and leave the active run with a stale shield count.
  const collision = game.tick(100);

  assert.equal(collision.snapshot.phase, "running");
  assert.ok(collision.events.some((event) => event.type === "shield"));
  assert.equal(collision.snapshot.upgrades.shieldLevel, 1);
  assert.equal(collision.snapshot.active.upgrades.shieldLevel, 1);

  const saved = game.serialize();
  assert.equal(saved.session.upgrades.shieldLevel, 1);
  assert.equal(createGameSession({ now: 100, save: saved }).snapshot().upgrades.shieldLevel, 1);
});

test("each collision consumes exactly one shield", () => {
  const game = createGameSession({
    now: 0,
    rng: () => 0.5,
    save: { upgrades: { shieldLevel: 2 } }
  });

  game.dispatch({
    type: "selectMode",
    mode: "snake",
    setup: {
      grid: { columns: 7, rows: 7 },
      snake: [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }],
      direction: "up",
      tickMs: 100
    }
  });
  game.dispatch({ type: "begin" });

  const first = game.tick(100);
  assert.equal(first.snapshot.upgrades.shieldLevel, 1);

  // Place the redirected head against another wall without buying a shield.
  const direction = first.snapshot.active.direction;
  const towardWall = direction === "left" ? "left" : "right";
  for (let index = 0; index < 10 && game.snapshot().upgrades.shieldLevel === 1; index += 1) {
    game.dispatch({ type: "direction", direction: towardWall });
    game.tick(100);
  }

  assert.equal(game.snapshot().upgrades.shieldLevel, 0);
});
