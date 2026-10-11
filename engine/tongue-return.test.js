const test = require("node:test");
const assert = require("node:assert/strict");
const tongue = require("./tongue.js");
const { createGameSession } = require("./session.js");
const { createAnimationClock } = require("../scripts/animation-clock.js");
const options = { outwardDurationScale: 0.5, returnOnCancel: true };
const head = { x: 2, y: 2 };
const seeds = [{ x: 4, y: 2, kind: "seed" }];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function pulling(tickMs = 200) {
  const tracker = tongue.createCatchTracker("gooFork", options);
  const input = { head, direction: "right", seeds, tickMs, nowMs: 0 };
  tracker.update(input);
  const frame = tracker.update({ ...input, stepProgress: 0.6, nowMs: 60 });
  assert.equal(frame.phase, "pull");
  assert.ok(distance(frame.seed, { x: 4.5, y: 2.5 }) > 0.1);
  return { tracker, input, frame };
}

test("experiment halves outward time without changing range or the original pull curve", () => {
  const style = tongue.getStyle("gooFork");
  for (const t of [0, 0.13, 0.26, 0.44, 0.5, 0.65, 0.79]) {
    const original = tongue.catchFrame("gooFork", t, head, "right", seeds[0]);
    const quick = tongue.catchFrame("gooFork", t / 2, head, "right", seeds[0], 0.5);
    assert.equal(quick.phase, original.phase);
    assert.equal(quick.pull, original.pull);
    assert.equal(quick.length, original.length);
    assert.deepEqual(quick.seed, original.seed);
  }
  assert.equal(tongue.catchFrame("gooFork", style.pullUntil / 2, head, "right", seeds[0], 0.5).showTongue, false);
  assert.equal(tongue.REACH_STEPS, 2);
});

test("cancelled pull returns from the visible position to the copied original cell through repeated turns", () => {
  const { tracker, input, frame } = pulling();
  const before = JSON.stringify(seeds);
  const start = tracker.update({ ...input, direction: "up", nowMs: 60 });
  assert.equal(start.phase, "return");
  assert.deepEqual(start.seed, { ...frame.seed, stretch: 1 });
  const middle = tracker.update({ ...input, head: { x: 2, y: 1 }, direction: "left", nowMs: 105 });
  assert.ok(distance(middle.seed, { x: 4.5, y: 2.5 }) < distance(start.seed, { x: 4.5, y: 2.5 }));
  assert.deepEqual(middle.mouth, { x: 2.08, y: 1.5 });
  assert.ok(Math.abs(distance(middle.mouth, middle.tip) - middle.length) < 1e-9);
  const reapproach = tracker.update({ ...input, direction: "right", nowMs: 120 });
  assert.equal(reapproach.phase, "return", "new catches wait until placement finishes");
  const placed = tracker.update({ ...input, direction: "up", nowMs: 155 });
  assert.equal(placed.phase, "retract");
  assert.deepEqual(placed.seed, { x: 4.5, y: 2.5, scale: 1, stretch: 1 });
  assert.equal(tracker.update({ ...input, direction: "up", nowMs: 180 }).showTongue, false);
  assert.equal(tracker.update({ ...input, direction: "up", nowMs: 181 }), null);
  assert.equal(tracker.update({ ...input, nowMs: 182 }).t, 0);
  assert.equal(JSON.stringify(seeds), before);
});

test("return timing is bounded at slow and fast speeds and consumption always removes it", () => {
  for (const tickMs of [20, 80, 200, 1000]) {
    const { tracker, input } = pulling(tickMs);
    tracker.update({ ...input, direction: "up", nowMs: 60 });
    const duration = Math.max(80, Math.min(240, tickMs * 0.6));
    assert.ok(tracker.update({ ...input, direction: "down", nowMs: 60 + duration - 0.001 }).showTongue);
    assert.equal(tracker.update({ ...input, seeds: [], nowMs: 60 + duration }), null);
    assert.equal(tracker.update({ ...input, seeds: [], direction: "up", nowMs: 10000 }), null);
  }
});

test("pause freezes return; reduced motion finishes existing placement and prevents fresh pulls", () => {
  const { tracker, input } = pulling();
  const clock = createAnimationClock();
  const start = tracker.update({ ...input, reducedMotion: true, nowMs: clock.now(60) });
  clock.pause(60);
  assert.equal(tracker.update({ ...input, running: false, nowMs: clock.now(5000) }), start);
  clock.resume(5000);
  const middle = tracker.update({ ...input, reducedMotion: true, nowMs: clock.now(5045) });
  assert.equal(middle.phase, "return");
  tracker.update({ ...input, reducedMotion: true, nowMs: clock.now(5120) });
  assert.equal(tracker.update({ ...input, reducedMotion: true, nowMs: clock.now(5121) }), null);
});

test("turn before grab does not move a Seed and hold-phase cancellation restores its full size", () => {
  const tracker = tongue.createCatchTracker("gooFork", options);
  tracker.update({ head, direction: "right", seeds });
  assert.equal(tracker.update({ head, direction: "up", seeds }), null);
  tracker.update({ head, direction: "right", seeds });
  const held = tracker.update({ head, direction: "right", seeds, stepProgress: 0.99 });
  assert.equal(held.phase, "hold");
  assert.ok(held.seed.scale < 1);
  assert.deepEqual(tracker.update({ head, direction: "up", seeds, nowMs: 50 }).seed, held.seed);
  assert.equal(tracker.update({ head, direction: "up", seeds, nowMs: 250 }).seed.scale, 1);
});

test("actual session turn cancellation keeps food/rewards unchanged; real consumption is never restored", () => {
  for (const tickMs of [40, 200, 800]) {
    const initial = createGameSession({ now: 1000, rng: () => 0.5 });
    initial.dispatch({ type: "selectMode", mode: "snake", setup: { tickMs, direction: "right",
      grid: { columns: 20, rows: 20 }, snake: [head, { x: 1, y: 2 }, { x: 0, y: 2 }] } });
    const save = initial.serialize();
    save.session.active.foods = seeds.map(seed => ({ ...seed }));
    for (const cancel of [true, false]) {
      const session = createGameSession({ save, now: 1000, rng: () => 0.5 });
      session.dispatch({ type: "begin" });
      const tracker = tongue.createCatchTracker("gooFork", options);
      const update = nowMs => {
        const s = session.snapshot();
        return tracker.update({ head: s.active.snake[0], direction: s.active.directionQueue[0] || s.active.direction,
          seeds: s.active.foods, stepProgress: s.modeAccumulatorMs / s.active.tickMs, tickMs: s.active.tickMs, nowMs });
      };
      update(0); session.tick(tickMs * 0.6);
      const visible = update(tickMs * 0.6);
      assert.equal(visible.phase, "pull");
      const before = session.serialize();
      update(tickMs * 0.6);
      assert.deepEqual(session.serialize(), before, "drawing cannot mutate authority");
      if (cancel) {
        session.dispatch({ type: "direction", direction: "up" });
        assert.equal(update(tickMs * 0.6).phase, "return");
        session.tick(tickMs * 1.4);
        update(tickMs * 2);
        assert.deepEqual(session.snapshot().active.foods, seeds);
        assert.equal(session.snapshot().active.score, 0);
        assert.equal(session.snapshot().seeds, 0);
      } else {
        session.tick(tickMs * 1.4);
        assert.equal(session.snapshot().active.score, 1);
        assert.ok(session.snapshot().seeds > 0);
        const frame = update(tickMs * 2);
        assert.ok(!frame || frame.seedCell.x !== 4 || frame.seedCell.y !== 2);
        session.dispatch({ type: "direction", direction: "up" });
        const turned = update(tickMs * 2 + 1);
        assert.ok(!turned || turned.seedCell.x !== 4 || turned.seedCell.y !== 2);
      }
    }
  }
});
