const test = require("node:test");
const assert = require("node:assert/strict");
const { createAnimationClock } = require("./animation-clock.js");

test("food display time freezes throughout pause and continues without a jump", () => {
  const clock = createAnimationClock();
  const biteAt = clock.now(100);
  clock.pause(150);
  assert.equal(clock.now(250) - biteAt, 50);
  clock.pause(800); // Repeated pause notifications do not move the frozen Seed.
  assert.equal(clock.now(1_000_000) - biteAt, 50);
  clock.resume(1_000_000);
  assert.equal(clock.now(1_000_020) - biteAt, 70);
  clock.resume(1_000_050);
  assert.equal(clock.now(1_000_060) - biteAt, 110);
  clock.pause(1_000_080);
  clock.resume(1_000_180);
  assert.equal(clock.now(1_000_200) - biteAt, 150);
  clock.reset();
  assert.equal(clock.now(1_000_250), 1_000_250);
});
