"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const tongue = require("./tongue.js");

const head = { x: 2, y: 1 };

test("offers two sets of five distinct tongue styles with ordered timelines", () => {
  assert.equal(tongue.groups.length, 2);
  tongue.groups.forEach((group) => assert.equal(tongue.stylesInGroup(group.id).length, 5, group.id));
  assert.equal(new Set(tongue.styles.map((style) => style.id)).size, 10);
  tongue.styles.forEach((style) => {
    assert.ok(style.name && style.summary);
    assert.ok(style.flickUntil < style.grabAt && style.grabAt < style.pullUntil && style.pullUntil < 1, style.id);
  });
});

test("only Seeds straight ahead within reach start a catch", () => {
  assert.equal(tongue.stepsUntilSeed(head, "right", { x: 4, y: 1 }, 0), 2);
  assert.equal(tongue.stepsUntilSeed(head, "right", { x: 3, y: 1 }, 0.25), 0.75);
  assert.equal(tongue.stepsUntilSeed(head, "right", { x: 5, y: 1 }, 0), null, "too far");
  assert.equal(tongue.stepsUntilSeed(head, "right", { x: 1, y: 1 }, 0), null, "behind");
  assert.equal(tongue.stepsUntilSeed(head, "right", { x: 3, y: 2 }, 0), null, "off the row");
  assert.equal(tongue.stepsUntilSeed(head, "up", { x: 2, y: 0 }, 0), 1);
  assert.equal(tongue.stepsUntilSeed(head, "down", { x: 2, y: 0 }, 0), null);
});

test("every style reaches the Seed, pulls it to the mouth, and swallows it", () => {
  const seed = { x: 4, y: 1 };
  tongue.styles.forEach((style) => {
    const start = tongue.catchFrame(style.id, 0, head, "right", seed);
    assert.ok(start.length < 0.01, `${style.id} starts in the mouth`);
    assert.deepEqual([start.seed.x, start.seed.y], [4.5, 1.5]);

    const grab = tongue.catchFrame(style.id, style.grabAt, head, "right", seed);
    assert.equal(grab.phase, "pull");
    assert.ok(Math.abs(grab.tip.x - 4.5) < 0.01, `${style.id} tip touches the Seed`);

    const held = tongue.catchFrame(style.id, style.pullUntil, head, "right", seed);
    assert.equal(held.phase, "hold");
    assert.ok(Math.abs(held.seed.x - held.mouth.x) < 1e-9 && Math.abs(held.seed.y - held.mouth.y) < 1e-9);
    assert.equal(held.showTongue, false);

    const end = tongue.catchFrame(style.id, 1, head, "right", seed);
    assert.ok(Math.abs(end.seed.scale - tongue.SWALLOW_SCALE) < 1e-9);
  });
});

test("the Seed moves toward the mouth during the pull for every direction", () => {
  const cases = [
    ["right", { x: 4, y: 1 }], ["left", { x: 0, y: 1 }],
    ["down", { x: 2, y: 3 }], ["up", { x: 2, y: -1 }]
  ];
  tongue.styles.forEach((style) => {
    cases.forEach(([direction, seed]) => {
      const before = tongue.catchFrame(style.id, style.grabAt, head, direction, seed);
      const after = tongue.catchFrame(style.id, (style.grabAt + style.pullUntil) / 2 + 0.08, head, direction, seed);
      const gap = (frame) => Math.hypot(frame.seed.x - frame.mouth.x, frame.seed.y - frame.mouth.y);
      assert.ok(gap(after) < gap(before), `${style.id} ${direction}`);
    });
  });
});

test("the tracker plays the whole timeline even when the Seed starts one step away", () => {
  const tracker = tongue.createCatchTracker("fork");
  const seeds = [{ x: 3, y: 1 }];
  const first = tracker.update({ head, direction: "right", seeds, stepProgress: 0.4 });
  assert.equal(first.t, 0);
  const middle = tracker.update({ head, direction: "right", seeds, stepProgress: 0.7 });
  assert.ok(Math.abs(middle.t - 0.5) < 1e-9);
  const late = tracker.update({ head, direction: "right", seeds, stepProgress: 1 });
  assert.equal(late.t, 1);
});

test("the tracker spans two steps for a Seed two cells ahead and stops on a turn", () => {
  const tracker = tongue.createCatchTracker("frog");
  const seeds = [{ x: 4, y: 1 }];
  assert.equal(tracker.update({ head, direction: "right", seeds, stepProgress: 0 }).t, 0);
  const nextHead = { x: 3, y: 1 };
  assert.ok(Math.abs(tracker.update({ head: nextHead, direction: "right", seeds, stepProgress: 0 }).t - 0.5) < 1e-9);
  assert.equal(tracker.update({ head: nextHead, direction: "up", seeds, stepProgress: 0.1 }), null);
});

test("a paused tracker keeps the same frame", () => {
  const tracker = tongue.createCatchTracker("curl");
  const seeds = [{ x: 4, y: 1 }];
  const frame = tracker.update({ head, direction: "right", seeds, stepProgress: 0.6 });
  assert.equal(tracker.update({ head, direction: "right", seeds, stepProgress: 0.9, running: false }), frame);
});
