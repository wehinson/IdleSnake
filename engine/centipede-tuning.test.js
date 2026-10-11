const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("./centipede.js");
function blank(overrides = {}) {
  return { cols: 100, rows: 100, playerRows: 6, player: { x: 50, y: 99, inputX: 0, inputY: 0 },
    bullet: null, mushrooms: {}, segments: [{ x: 10, y: 0, dir: 1, vDir: 1, isHead: true }],
    score: 0, lives: 3, wave: 1, wavesCleared: 0, ...overrides };
}
test("ten 70ms ticks move enemies eight cells and an existing bullet 24 rows, leaving input cadence intact", () => {
  const s = blank({ bullet: { x: 80, y: 90 }, player: { x: 50, y: 99, inputX: 1, inputY: 0 } });
  for (let i = 0; i < 10; i++) C.step(s);
  assert.equal(s.segments[0].x, 18); assert.equal(s.bullet.y, 66); assert.equal(s.player.x, 60);
  assert.equal(C.config.segmentStepMs, 87.5); assert.equal(C.config.tickMs, 70);
});
test("single-projectile re-fire cadence increases while retaining exactly one projectile", () => {
  const s = blank({ rows: 28, player: { x: 50, y: 27, inputX: 0, inputY: 0 } });
  const launches = [];
  for (let tick = 0; tick < 60; tick++) {
    const previous = s.bullet; C.step(s);
    if (previous !== s.bullet) launches.push(tick);
    assert.ok(s.bullet && !Array.isArray(s.bullet));
  }
  assert.deepEqual(launches.slice(0, 5), [0, 12, 24, 36, 48]); // old 2-row shots: 14 ticks
});
test("new shots check the adjacent obstacle and every traversed cell including a three-row tick", () => {
  const s = blank({ mushrooms: { "50,98": 4 } }); C.step(s); C.step(s);
  assert.equal(s.mushrooms["50,98"], 3, "the adjacent cell cannot be skipped");
  for (const y of [8, 7, 6]) {
    const field = blank({ bullet: { x: 50, y: 9 }, bulletTravelRows: .8, mushrooms: { [`50,${y}`]: 4 } });
    C.step(field); assert.equal(field.mushrooms[`50,${y}`], 3, `row ${y} hit without tunnelling`);
  }
});
test("slower movement still checks same-cell collision on a stationary enemy tick, with unchanged outcome metadata", () => {
  const s = blank({ lives: 1, score: 130, wavesCleared: 2, segmentAccumulatorMs: 0,
    segments: [{ x: 50, y: 99, dir: 1, vDir: 1, isHead: true }] });
  const result = C.step(s);
  assert.equal(result.alive, false); assert.equal(s.lives, 0);
  assert.deepEqual(result.events, [{ type: "playerHit", lives: 0 }, { type: "gameOver", score: 130, wavesCleared: 2 }]);
});
test("shooter bounds, obstacle collision, wave growth and point units remain unchanged", () => {
  const s = blank({ player: { x: 0, y: 94, inputX: -1, inputY: -1 } }); C.step(s);
  assert.deepEqual(s.player, { x: 0, y: 94, inputX: -1, inputY: -1 });
  s.player.inputX = 1; s.player.inputY = 0; s.mushrooms["1,94"] = 1; C.step(s); assert.equal(s.player.x, 0);
  s.segments = []; const result = C.step(s);
  assert.equal(s.wavesCleared, 1); assert.equal(s.segments.length, 11);
  assert.deepEqual(result.events.find((e) => e.type === "waveClear"), { type: "waveClear", wave: 2 });
  assert.deepEqual(C.config.points, { body: 10, head: 100, mushroom: 1 });
});
