// Headless endless-runner minigame. Rendering stays in game.js; this module
// owns deterministic movement, obstacle spawning, scoring, and collision.
(function attachRunner(root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeRunner = engine;
  else root.IdleSnakeRunner = engine;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const config = { gravity: 1450, jumpVelocity: 515, startSpeed: 155, speedPerSecond: 5.5, maxSpeed: 330, scoreDistance: 12, segmentDelayMs: 55, segmentCount: 6 };

  function createState(boardWidth, boardHeight) {
    const size = Math.max(22, Math.floor(boardHeight * 0.075));
    const groundY = boardHeight - Math.max(38, Math.floor(boardHeight * 0.13));
    return { boardWidth, boardHeight, groundY, elapsedMs: 0, distance: 0, score: 0, speed: config.startSpeed, nextObstacleAt: boardWidth * 0.9, player: { x: Math.floor(boardWidth * 0.18), y: groundY - size, size, vy: 0, grounded: true }, obstacles: [], jumpStartedAt: null };
  }

  function jump(state) {
    if (!state || !state.player.grounded) return false;
    state.player.vy = -config.jumpVelocity;
    state.player.grounded = false;
    state.jumpStartedAt = state.elapsedMs;
    return true;
  }

  function spawnObstacle(state, rng) {
    const tall = rng() < 0.35;
    const width = tall ? state.player.size * 0.72 : state.player.size * 1.05;
    const height = tall ? state.player.size * 1.65 : state.player.size * 0.9;
    state.obstacles.push({ x: state.boardWidth + 8, width, height, kind: tall ? "cactus" : "rock" });
    state.nextObstacleAt = state.distance + state.boardWidth * (0.68 + rng() * 0.48);
  }

  function overlaps(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

  function step(state, ctx) {
    const dt = Math.min(50, Math.max(0, Number(ctx?.deltaMs) || 0)) / 1000;
    const rng = ctx?.rng || Math.random;
    if (dt === 0) return { state, alive: true, events: [] };
    state.elapsedMs += dt * 1000;
    state.speed = Math.min(config.maxSpeed, config.startSpeed + state.elapsedMs / 1000 * config.speedPerSecond);
    state.distance += state.speed * dt;
    state.score = Math.floor(state.distance / config.scoreDistance);
    const player = state.player;
    player.vy += config.gravity * dt;
    player.y += player.vy * dt;
    const floorY = state.groundY - player.size;
    if (player.y >= floorY) { player.y = floorY; player.vy = 0; player.grounded = true; }
    if (state.distance >= state.nextObstacleAt) spawnObstacle(state, rng);
    state.obstacles.forEach((obstacle) => { obstacle.x -= state.speed * dt; });
    state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width >= -4);
    const hitbox = { x: player.x + player.size * 0.16, y: player.y + player.size * 0.14, width: player.size * 0.68, height: player.size * 0.78 };
    const hit = state.obstacles.some((obstacle) => overlaps(hitbox, { x: obstacle.x + obstacle.width * 0.12, y: state.groundY - obstacle.height + obstacle.height * 0.08, width: obstacle.width * 0.76, height: obstacle.height * 0.92 }));
    return { state, alive: !hit, events: hit ? [{ type: "gameOver", score: state.score, reward: state.score }] : [] };
  }

  // Cosmetic delayed hop pose: gameplay collision always uses player.y.
  function segmentYOffset(state, index) {
    if (!state || state.jumpStartedAt === null) return 0;
    const age = state.elapsedMs - state.jumpStartedAt - index * config.segmentDelayMs;
    if (age <= 0) return 0;
    const t = age / 1000;
    return Math.max(0, config.jumpVelocity * t - config.gravity * t * t / 2);
  }

  return { config, createState, jump, step, segmentYOffset };
});
