// Headless breakout minigame — paddle/ball/brick physics with falling powerups
// (seed = grow paddle, heart = extra life, multiball). Real-time, float physics;
// pure here. Port of game.js stepBreakout + its paddle/ball/powerup helpers.
// Game dimensions are fixed here; hosts scale these coordinates for display.
// Win/loss/ball-lost side-effects are lifted into events.
(function attachBreakout(root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeBreakout = engine;
  else root.IdleSnakeBreakout = engine;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const config = {
    basePaddleLength: 3,
    paddleSpeed: 231 * 1.5,
    ballSpeed: 180.6 * 1.5,
    powerupDropChance: 0.18,
    powerupFallSpeed: 64.4 * 1.5
  };
  const MAX_HEARTS_PER_LEVEL = 2;
  const SEED_BOOST_MS = 30000;
  const BOARD_WIDTH = 720;
  const BOARD_HEIGHT = 720;
  const SEGMENT_SIZE = 45;
  const GAP = 4;
  const PHYSICS_MS = 1000 / 240;
  const BRICK_COLORS = { 1: "#4e9c45", 2: "#3979c6", 3: "#14171c" };

  function createState(options = {}) {
    const brickWidth = (BOARD_WIDTH - 28 - GAP * 9) / 10;
    const state = {
      board: { width: BOARD_WIDTH, height: BOARD_HEIGHT },
      score: 0,
      lives: 2,
      segmentSize: SEGMENT_SIZE,
      gap: GAP,
      paddle: { x: 0, y: BOARD_HEIGHT - SEGMENT_SIZE - 10, length: config.basePaddleLength, input: 0 },
      balls: [],
      powerups: [],
      seedBoosts: [],
      heartsCollected: 0,
      bricks: [], physicsAccumulatorMs: 0
    };
    if (Array.isArray(options.bricks)) state.bricks = options.bricks.map((brick) => ({ ...brick }));
    else for (let row = 0; row < 4; row += 1) for (let column = 0; column < 10; column += 1) {
      const hp = [3, 2, 1, 1][row];
      state.bricks.push({ x: 14 + column * (brickWidth + GAP), y: 28 + row * 36, width: brickWidth, height: 32, hp, maxHp: hp, color: BRICK_COLORS[hp] });
    }
    state.paddle.x = (BOARD_WIDTH - paddleWidth(state)) / 2;
    state.balls = [buildBall(state, BOARD_WIDTH)];
    return state;
  }

  function paddleWidth(state) {
    if (!state) return 0;
    return state.paddle.length * state.segmentSize + (state.paddle.length - 1) * state.gap;
  }

  function setPaddleLength(state, length, boardWidth) {
    const center = state.paddle.x + paddleWidth(state) / 2;
    state.paddle.length = length;
    state.paddle.x = Math.max(0, Math.min(boardWidth - paddleWidth(state), center - paddleWidth(state) / 2));
  }

  function buildBall(state, boardWidth, index = 0) {
    const sign = index % 2 === 0 ? 1 : -1;
    return {
      x: boardWidth / 2 + (index ? sign * 14 : 0),
      y: state.paddle.y - state.segmentSize - 34,
      radius: Math.max(5, Math.floor(state.segmentSize * 0.23)),
      vx: config.ballSpeed * 0.62 * sign,
      vy: -config.ballSpeed * 0.78
    };
  }

  function createPowerup(state, type, x, y) {
    return { type, x, y, radius: Math.max(4, Math.floor(state.segmentSize * 0.23) * 0.8) };
  }

  // The head is at the right; index zero is the last extended tail end.
  // Reduced motion keeps a steady warning instead of flickering.
  function tailWarning(state, elapsedMs, reducedMotion = false) {
    if (state.paddle.length <= config.basePaddleLength || !state.seedBoosts.length) return null;
    const remainingMs = Math.min(...state.seedBoosts) - elapsedMs;
    if (remainingMs <= 0 || remainingMs > 5000) return null;
    const urgent = remainingMs <= 2000;
    const periodMs = urgent ? 400 : 1000;
    return { index: 0, remainingMs, phase: urgent ? "urgent" : "warning", periodMs,
      dim: reducedMotion || remainingMs % periodMs < periodMs / 2 };
  }

  // Fixed simulation slices preserve time at 30/60/144 Hz. Collision slices
  // additionally limit displacement, including externally supplied fast balls.
  function step(state, ctx) {
    const deltaMs = Math.max(0, Number(ctx.deltaMs) || 0);
    state.physicsAccumulatorMs = (state.physicsAccumulatorMs || 0) + deltaMs;
    const events = [];
    while (state.physicsAccumulatorMs + 1e-8 >= PHYSICS_MS) {
      state.physicsAccumulatorMs = Math.max(0, state.physicsAccumulatorMs - PHYSICS_MS);
      const elapsedMs = ctx.elapsedMs - state.physicsAccumulatorMs;
      const maxSpeed = Math.max(config.ballSpeed, ...state.balls.map((ball) => Math.hypot(ball.vx, ball.vy)));
      const radius = Math.max(0.5, Math.min(10, ...state.balls.map((ball) => ball.radius)));
      const count = Math.max(1, Math.ceil(maxSpeed * PHYSICS_MS / 1000 / (radius / 2)));
      for (let index = 0; index < count; index += 1) {
        const result = stepSlice(state, { ...ctx, deltaMs: PHYSICS_MS / count, elapsedMs: elapsedMs - PHYSICS_MS + (index + 1) * PHYSICS_MS / count });
        events.push(...result.events);
        if (!result.alive || result.events.some((item) => item.type === "ballLost")) {
          const unconsumedMs = state.physicsAccumulatorMs + PHYSICS_MS * (count - index - 1) / count;
          state.physicsAccumulatorMs = 0;
          return { state, events, alive: result.alive, unconsumedMs };
        }
      }
    }
    return { state, events, alive: true };
  }

  function randomPowerupType(heartsAllowed, rng) {
    const roll = (rng || Math.random)();
    if (roll < 0.55) return "seed";
    if (heartsAllowed && roll < 0.65) return "heart";
    return "multiball";
  }

  // One physics tick. State is the game.js `breakout` object. ctx: { deltaMs,
  // boardWidth, boardHeight, elapsedMs, rng }. Returns { state, events, alive }.
  // Events: win, gameOver, ballLost{lives}.
  function stepSlice(state, ctx) {
    const rng = (ctx && ctx.rng) || Math.random;
    const boardWidth = ctx.boardWidth;
    const boardHeight = ctx.boardHeight;
    const elapsedMs = ctx.elapsedMs;
    const dt = ctx.deltaMs / 1000;
    const events = [];
    const paddle = state.paddle;
    let pWidth = paddleWidth(state);

    const previousPaddleX = paddle.x;
    paddle.x = Math.max(0, Math.min(boardWidth - pWidth, paddle.x + paddle.input * config.paddleSpeed * dt));
    if (paddle.x !== previousPaddleX) events.push({ type: "controlledMove" });

    const remainingPowerups = [];
    const pendingMultiballs = [];
    state.powerups.forEach((powerup) => {
      powerup.y += config.powerupFallSpeed * dt;
      const caught = powerup.y + powerup.radius >= paddle.y &&
        powerup.y - powerup.radius <= paddle.y + state.segmentSize &&
        powerup.x >= paddle.x - powerup.radius &&
        powerup.x <= paddle.x + pWidth + powerup.radius;
      if (caught) {
        if (powerup.type === "seed") {
          if (paddle.length < 10) { setPaddleLength(state, paddle.length + 1, boardWidth); state.seedBoosts.push(elapsedMs + SEED_BOOST_MS); }
        } else if (powerup.type === "heart") {
          state.lives += 1; state.heartsCollected += 1;
        } else if (powerup.type === "multiball") {
          pendingMultiballs.push(powerup);
        }
      } else if (powerup.y - powerup.radius <= boardHeight) {
        remainingPowerups.push(powerup);
      }
    });
    state.powerups = remainingPowerups;

    if (state.seedBoosts.length > 0) {
      const stillActive = [];
      let expiredCount = 0;
      state.seedBoosts.forEach((expiresAt) => { if (elapsedMs >= expiresAt) expiredCount += 1; else stillActive.push(expiresAt); });
      if (expiredCount > 0) setPaddleLength(state, Math.max(config.basePaddleLength, paddle.length - expiredCount), boardWidth);
      state.seedBoosts = stillActive;
    }
    pWidth = paddleWidth(state);

    const remainingBalls = [];
    for (const ball of state.balls) {
      const previousX = ball.x;
      const previousY = ball.y;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x - ball.radius <= 0) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); }
      else if (ball.x + ball.radius >= boardWidth) { ball.x = boardWidth - ball.radius; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - ball.radius <= 0) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); }

      const paddleTop = paddle.y;
      const hitPaddle = ball.vy > 0 &&
        previousY + ball.radius <= paddleTop + Math.max(2, state.segmentSize * 0.25) &&
        ball.y + ball.radius >= paddleTop &&
        ball.x + ball.radius >= paddle.x &&
        ball.x - ball.radius <= paddle.x + pWidth;
      if (hitPaddle) {
        ball.y = paddleTop - ball.radius;
        const hit = Math.max(-1, Math.min(1, (ball.x - (paddle.x + pWidth / 2)) / (pWidth / 2)));
        const speed = Math.max(config.ballSpeed, Math.hypot(ball.vx, ball.vy));
        const horizontal = Math.max(-0.86, Math.min(0.86, hit * 0.92 || (ball.vx < 0 ? -0.16 : 0.16)));
        ball.vx = speed * horizontal;
        ball.vy = -Math.sqrt(Math.max(1, speed * speed - ball.vx * ball.vx));
      }

      if (ball.y - ball.radius > boardHeight) continue;

      const brickIndex = state.bricks.findIndex((brick) =>
        ball.x + ball.radius >= brick.x && ball.x - ball.radius <= brick.x + brick.width &&
        ball.y + ball.radius >= brick.y && ball.y - ball.radius <= brick.y + brick.height);
      if (brickIndex >= 0) {
        const brick = state.bricks[brickIndex];
        brick.maxHp = brick.maxHp || brick.hp || 1;
        brick.hp = (brick.hp || 1) - 1;
        const destroyed = brick.hp === 0;
        if (!destroyed) brick.color = BRICK_COLORS[brick.hp] || brick.color;
        if (destroyed) { state.bricks.splice(brickIndex, 1); state.score += 10; }
        const cameFromAbove = previousY + ball.radius <= brick.y;
        const cameFromBelow = previousY - ball.radius >= brick.y + brick.height;
        if (cameFromAbove || cameFromBelow) {
          ball.y = cameFromAbove ? brick.y - ball.radius - 0.001 : brick.y + brick.height + ball.radius + 0.001;
          ball.vy *= -1;
        } else {
          const fromLeft = previousX <= brick.x + brick.width / 2;
          ball.x = fromLeft ? brick.x - ball.radius - 0.001 : brick.x + brick.width + ball.radius + 0.001;
          ball.vx = fromLeft ? -Math.abs(ball.vx) : Math.abs(ball.vx);
        }
        events.push({ type: "brickHit", hp: brick.hp, destroyed });
        if (destroyed && rng() < config.powerupDropChance) {
          const heartsAllowed = state.heartsCollected < MAX_HEARTS_PER_LEVEL;
          state.powerups.push(createPowerup(state, randomPowerupType(heartsAllowed, rng), brick.x + brick.width / 2, brick.y + brick.height / 2));
        }
        if (state.bricks.length === 0) { events.push({ type: "win" }); return { state, events, alive: false }; }
      }

      remainingBalls.push(ball);
    }

    pendingMultiballs.forEach((_powerup, index) => {
      const ball = buildBall(state, boardWidth, remainingBalls.length + index);
      ball.x = paddle.x + pWidth / 2;
      ball.y = paddle.y - ball.radius - 4;
      remainingBalls.push(ball);
    });

    if (remainingBalls.length === 0) {
      state.lives -= 1;
      if (state.lives <= 0) { events.push({ type: "gameOver" }); return { state, events, alive: false }; }
      state.balls = [buildBall(state, boardWidth, 0)];
      state.paddle.input = 0;
      events.push({ type: "ballLost", lives: state.lives });
    } else {
      state.balls = remainingBalls;
    }

    return { state, events, alive: true };
  }

  return { config, BOARD_WIDTH, BOARD_HEIGHT, SEGMENT_SIZE, GAP, BRICK_COLORS, MAX_HEARTS_PER_LEVEL, SEED_BOOST_MS, createState, paddleWidth, setPaddleLength, buildBall, createPowerup, randomPowerupType, tailWarning, step };
});
