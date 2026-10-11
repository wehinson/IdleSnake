const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const tongue = require('../engine/tongue.js');

test('cancelled tongue renderer keeps side and rear tips in the current mouth frame', () => {
  const paths = [];
  class Path {
    constructor() { this.points = []; paths.push(this.points); }
    moveTo(x, y) { this.points.push([x, y]); }
    lineTo(x, y) { this.points.push([x, y]); }
    closePath() {}
  }
  const scope = { Path2D: Path };
  vm.runInNewContext(fs.readFileSync(__dirname + '/tongue-draw.js', 'utf8'), scope);
  let translation, angle;
  const ctx = { globalAlpha: 1, save() {}, restore() {},
    translate(x, y) { translation = [x, y]; }, rotate(a) { angle = a; },
    createLinearGradient() { return { addColorStop() {} }; },
    fill() {}, stroke() {}, beginPath() {}, moveTo() {}, lineTo() {},
    quadraticCurveTo() {}, closePath() {}, arc() {}
  };
  const tracker = tongue.createCatchTracker('gooFork');
  const args = { head: { x: 2, y: 2 }, direction: 'right', seeds: [{ x: 4, y: 2 }], tickMs: 200 };
  tracker.update(args);
  tracker.update({ ...args, stepProgress: 0.99, now: 99 });
  for (const [direction, head, now] of [['up', { x: 2, y: 2 }, 100], ['left', { x: 5, y: 2 }, 130], ['down', { x: 5, y: 1 }, 170]]) {
    const frame = tracker.update({ ...args, direction, head, now });
    let localTip;
    scope.IdleSnakeTongueDraw.inMouthFrame(ctx, { cell: 20, x: 7, y: 11 }, frame, tip => { localTip = tip; });
    assert.ok(Math.abs(localTip.x - frame.length * 20) < 1e-9);
    assert.ok(Math.abs(localTip.y) < 1e-9);
    assert.deepEqual(translation, [7 + frame.mouth.x * 20, 11 + frame.mouth.y * 20]);
    assert.ok(Math.abs(angle - Math.atan2(frame.tip.y - frame.mouth.y, frame.tip.x - frame.mouth.x)) < 1e-9);
    scope.IdleSnakeTongueDraw.drawForkTongue(ctx, { cell: 20, x: 7, y: 11 }, frame);
    assert.ok(paths.at(-1).length > 80);
    assert.ok(paths.at(-1).flat().every(Number.isFinite));
    assert.ok(Math.abs(paths.at(-1)[0][0]) < 1e-9, 'silhouette starts at the mouth');
  }
});

test('actual game draw functions keep live food stationary and draw only consumed ghosts', () => {
  const source = fs.readFileSync(__dirname + '/../game.js', 'utf8').replace(/\r\n/g, '\n');
  const functions = ['updateTongueFrame', 'drawTongueCatch', 'drawFood'].map(name => {
    const start = source.indexOf(`function ${name}(`);
    return source.slice(start, source.indexOf('\n}\n', start) + 3);
  }).join('\n');
  const tracker = tongue.createCatchTracker('gooFork');
  let now = 0, reduced = false, calls = [];
  const food = { x: 2, y: 0, kind: 'seed' };
  const scope = {
    tongueTracker: tracker, tongueFrame: null,
    gameView: { gameMode: 'snake', state: 'running', snake: [{ x: 0, y: 0 }], foods: [food], tickMs: 180, stepAccumulatorMs: 0 },
    effectiveReducedMotion: () => reduced, snakeAnimationNow: () => now,
    pendingHeadDirection: () => 'right', currentFoodType: () => ({}),
    boardMetrics: { cellSize: 20, x: 0, y: 0 }, ctx: {}, performance: { now: () => now },
    cellRect: snack => ({ x: snack.x * 20, y: snack.y * 20, size: 12 }),
    drawSnack: (snack, rect) => calls.push({ snack, rect }),
    window: { IdleSnakeTongueDraw: { drawForkTongue() {} } }
  };
  vm.createContext(scope); vm.runInContext(functions, scope);
  scope.drawFood(); scope.gameView.stepAccumulatorMs = 179; now = 179;
  scope.drawFood(); scope.drawTongueCatch();
  assert.equal(calls.length, 2); assert.equal(calls[1].rect.x, 40);
  scope.gameView.state = 'paused'; const frame = scope.tongueFrame;
  now = 999; scope.updateTongueFrame(); assert.equal(scope.tongueFrame, frame);
  scope.gameView.state = 'running'; scope.gameView.foods = []; scope.gameView.snake = [{ x: 2, y: 0 }];
  tracker.consume(food, now, 180, 35); scope.updateTongueFrame(); scope.drawTongueCatch();
  assert.equal(calls.length, 3, 'consumed ghost does not depend on live food');
  reduced = true; scope.updateTongueFrame(); assert.equal(scope.tongueFrame, null);
  reduced = false; scope.updateTongueFrame(); assert.equal(scope.tongueFrame, null, 'reset removes consumed ghost');
});
