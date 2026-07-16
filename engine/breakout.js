// Headless breakout minigame — paddle/ball/brick physics with falling powerups
// (seed = grow paddle, heart = extra life, multiball). Real-time, float physics;
// pure here. Port of game.js stepBreakout + its paddle/ball/powerup helpers.
// Board pixel dimensions are passed in (the host derives them from the canvas);
// win/loss/ball-lost side-effects are lifted into events.
(function attachBreakout(root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeBreakout = engine;
  else root.IdleSnakeBreakout = engine;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const config = {
    basePaddleLength: 3,
    paddleSpeed: 330,
    ballSpeed: 258,
    powerupDropChance: 0.18,
    powerupFallSpeed: 92
  };
  const MAX_HEARTS_PER_LEVEL = 2;
  const SEED_BOOST_MS = 30000;

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
    return { type, x, y, radius: Math.max(6, Math.floor(state.segmentSize * 0.2)) };
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
  function step(state, ctx) {
    const rng = (ctx && ctx.rng) || Math.random;
    const boardWidth = ctx.boardWidth;
    const boardHeight = ctx.boardHeight;
    const elapsedMs = ctx.elapsedMs;
    const dt = Math.min(40, ctx.deltaMs) / 1000;
    const events = [];
    const paddle = state.paddle;
    const pWidth = paddleWidth(state);

    paddle.x = Math.max(0, Math.min(boardWidth - pWidth, paddle.x + paddle.input * config.paddleSpeed * dt));

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

    const remainingBalls = [];
    for (const ball of state.balls) {
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
        state.bricks.splice(brickIndex, 1);
        state.score += 10;
        const cameFromAbove = previousY + ball.radius <= brick.y;
        const cameFromBelow = previousY - ball.radius >= brick.y + brick.height;
        if (cameFromAbove || cameFromBelow) ball.vy *= -1; else ball.vx *= -1;
        if (rng() < config.powerupDropChance) {
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

  return { config, MAX_HEARTS_PER_LEVEL, SEED_BOOST_MS, paddleWidth, setPaddleLength, buildBall, createPowerup, randomPowerupType, step };
});
