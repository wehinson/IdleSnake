const test = require("node:test");
const assert = require("node:assert/strict");
const centipede = require("./centipede.js");

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

// A clean, mushroom-free field so tests control exactly what the tick sees.
function blank(overrides = {}) {
  return {
    cols: 20, rows: 14, playerRows: 4,
    player: { x: 10, y: 13, inputX: 0, inputY: 0 },
    bullet: null, mushrooms: {}, segments: [],
    score: 0, lives: 3, wave: 1, wavesCleared: 0,
    ...overrides
  };
}

const rng = seededRng(1);

test("createState seeds a top-row centipede and a mushroom field", () => {
  const s = centipede.createState({ rng: seededRng(7) });
  assert.equal(s.segments.length, centipede.config.startLength);
  assert.ok(s.segments[0].isHead, "the lead segment is a head");
  assert.ok(s.segments.every((seg) => seg.y === 0), "the train enters along the top row");
  assert.ok(Object.keys(s.mushrooms).length > 0, "mushrooms are scattered");
  assert.equal(s.lives, centipede.config.lives);
});

test("waveLength grows each wave and caps at maxLength", () => {
  assert.equal(centipede.waveLength({ wave: 1 }), centipede.config.startLength);
  assert.equal(centipede.waveLength({ wave: 3 }), centipede.config.startLength + 2);
  assert.equal(centipede.waveLength({ wave: 100 }), centipede.config.maxLength);
});

test("a bullet destroys a mid-chain segment, splits it, and drops a mushroom", () => {
  const s = blank({
    player: { x: 0, y: 13, inputX: 0, inputY: 0 },
    bullet: { x: 2, y: 7 },
    segments: [
      { x: 3, y: 5, dir: 1, vDir: 1, isHead: true },
      { x: 2, y: 5, dir: 1, vDir: 1, isHead: false },
      { x: 1, y: 5, dir: 1, vDir: 1, isHead: false }
    ]
  });
  const { events } = centipede.step(s, { rng });
  assert.equal(s.segments.length, 2, "the shot segment is gone");
  assert.equal(s.score, centipede.config.points.body);
  assert.equal(s.mushrooms["2,5"], centipede.config.mushroomHp, "a mushroom appears where it died");
  assert.equal(s.segments.filter((seg) => seg.isHead).length, 2, "the trailing piece gained a head");
  assert.ok(events.some((e) => e.type === "segmentDestroyed"));
});

test("a mushroom takes four hits to clear, then scores", () => {
  const s = blank({
    player: { x: 0, y: 13, inputX: 0, inputY: 0 },
    segments: [{ x: 0, y: 1, dir: 1, vDir: 1, isHead: true }],
    mushrooms: { "3,3": centipede.config.mushroomHp }
  });
  for (let i = 0; i < 3; i += 1) {
    s.bullet = { x: 3, y: 5 };
    centipede.step(s, { rng });
    assert.equal(s.mushrooms["3,3"], centipede.config.mushroomHp - (i + 1));
  }
  s.bullet = { x: 3, y: 5 };
  centipede.step(s, { rng });
  assert.equal(s.mushrooms["3,3"], undefined, "the mushroom is finally cleared");
  assert.equal(s.score, centipede.config.points.mushroom);
});

test("a segment reversing at the right edge drops down a row", () => {
  const s = blank({
    player: { x: 0, y: 13, inputX: 0, inputY: 0 },
    segments: [{ x: 19, y: 3, dir: 1, vDir: 1, isHead: true }]
  });
  centipede.step(s, { rng });
  assert.equal(s.segments[0].dir, -1, "it turned around");
  assert.equal(s.segments[0].y, 4, "it descended one row");
  assert.equal(s.segments[0].x, 19, "it stays in the edge column for one tick");
});

test("touching the player costs a life and resets the wave", () => {
  const s = blank({
    lives: 3,
    player: { x: 5, y: 13, inputX: 0, inputY: 0 },
    segments: [{ x: 4, y: 13, dir: 1, vDir: 1, isHead: true }]
  });
  const { events, alive } = centipede.step(s, { rng });
  assert.ok(alive, "still alive with lives remaining");
  assert.equal(s.lives, 2);
  assert.ok(events.some((e) => e.type === "playerHit"));
  assert.equal(s.segments.length, centipede.waveLength(s), "a fresh centipede respawns");
  assert.ok(s.segments.every((seg) => seg.y === 0));
});

test("running out of lives ends the run", () => {
  const s = blank({
    lives: 1,
    player: { x: 5, y: 13, inputX: 0, inputY: 0 },
    segments: [{ x: 4, y: 13, dir: 1, vDir: 1, isHead: true }]
  });
  const { events, alive } = centipede.step(s, { rng });
  assert.equal(alive, false);
  assert.ok(events.some((e) => e.type === "gameOver"));
});

test("clearing every segment advances to the next wave", () => {
  const s = blank({ player: { x: 0, y: 13, inputX: 0, inputY: 0 }, segments: [] });
  const { events } = centipede.step(s, { rng });
  assert.equal(s.wave, 2);
  assert.ok(s.segments.length > 0, "a new, longer centipede spawns");
  assert.ok(events.some((e) => e.type === "waveClear"));
});

test("the shooter auto-fires a single bullet from its position", () => {
  const s = blank({
    bullet: null,
    segments: [{ x: 0, y: 1, dir: 1, vDir: 1, isHead: true }],
    player: { x: 7, y: 13, inputX: 0, inputY: 0 }
  });
  centipede.step(s, { rng });
  assert.ok(s.bullet, "a bullet was launched");
  assert.equal(s.bullet.x, 7);
  assert.equal(s.bullet.y, 12);
});

test("the shooter cannot move into a mushroom or below the top of its band", () => {
  const blocked = blank({
    player: { x: 5, y: 13, inputX: 0, inputY: -1 },
    segments: [{ x: 0, y: 0, dir: 1, vDir: 1, isHead: true }],
    mushrooms: { "5,12": centipede.config.mushroomHp }
  });
  centipede.step(blocked, { rng });
  assert.equal(blocked.player.y, 13, "a mushroom blocks the move");

  const bandTop = blank({
    player: { x: 5, y: 10, inputX: 0, inputY: -1 },
    segments: [{ x: 0, y: 0, dir: 1, vDir: 1, isHead: true }]
  });
  // band top row = rows - playerRows = 10; it cannot climb above it.
  centipede.step(bandTop, { rng });
  assert.equal(bandTop.player.y, 10, "the top of the band holds the shooter in");
});
