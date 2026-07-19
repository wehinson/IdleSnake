// Headless centipede minigame — a grid-based Centipede clone. A villain
// centipede winds down through a mushroom field; the player's shooter is
// confined to a band of rows at the bottom and auto-fires a single bullet up
// the screen. Shooting a middle segment splits the chain into two and drops a
// mushroom where the segment died. Pure logic here (grid coordinates only);
// the host renders cells to pixels and tints the villain with the player's
// chosen snake colors. Mirrors the engine/<mode>.js pattern (see breakout.js).
(function attachCentipede(root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeCentipede = engine;
  else root.IdleSnakeCentipede = engine;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const config = {
    cols: 24,
    rows: 28,
    playerRows: 6,          // height of the bottom band the shooter roams in
    startLength: 10,        // segments in the wave-1 centipede
    lengthPerWave: 1,       // +segments each cleared wave
    maxLength: 16,
    lives: 3,
    mushroomHp: 4,          // hits to clear a mushroom (classic)
    mushroomDensity: 0.06,  // fraction of upper-field cells seeded at start
    waveMushrooms: 4,       // extra mushrooms added per wave
    bulletStep: 2,          // rows the bullet climbs per tick
    points: { body: 10, head: 100, mushroom: 1 }
  };

  const key = (x, y) => x + "," + y;
  const mushroomHp = (state, x, y) => state.mushrooms[key(x, y)] || 0;
  const playerTop = (state) => state.rows - state.playerRows;
  const waveLength = (state) =>
    Math.min(config.maxLength, config.startLength + (state.wave - 1) * config.lengthPerWave);

  // Scatter mushrooms across the upper field (rows 1..fieldBottom), leaving row 0
  // clear so the centipede has room to enter.
  function seedMushrooms(state, count, rng) {
    const random = rng || Math.random;
    const fieldBottom = state.rows - state.playerRows - 1;
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 40 + 40) {
      guard += 1;
      const x = Math.floor(random() * state.cols);
      const y = 1 + Math.floor(random() * fieldBottom);
      const k = key(x, y);
      if (!state.mushrooms[k]) {
        state.mushrooms[k] = config.mushroomHp;
        placed += 1;
      }
    }
  }

  function buildMushrooms(state, rng) {
    const fieldBottom = state.rows - state.playerRows - 1;
    const count = Math.floor(state.cols * fieldBottom * config.mushroomDensity);
    seedMushrooms(state, count, rng);
  }

  // A centipede enters at the top row as a horizontal train, head leading right.
  function spawnCentipede(state, length) {
    const segments = [];
    for (let i = 0; i < length; i += 1) {
      segments.push({ x: length - 1 - i, y: 0, dir: 1, vDir: 1, isHead: i === 0 });
    }
    state.segments = segments;
  }

  function createState(setup) {
    const cols = setup && setup.cols != null ? setup.cols : config.cols;
    const rows = setup && setup.rows != null ? setup.rows : config.rows;
    const playerRows = setup && setup.playerRows != null ? setup.playerRows : config.playerRows;
    const rng = (setup && setup.rng) || Math.random;
    const state = {
      cols,
      rows,
      playerRows,
      player: { x: Math.floor(cols / 2), y: rows - 1, inputX: 0, inputY: 0 },
      bullet: null,
      mushrooms: {},
      segments: [],
      score: 0,
      lives: setup && setup.lives != null ? setup.lives : config.lives,
      wave: 1,
      wavesCleared: 0
    };
    buildMushrooms(state, rng);
    spawnCentipede(state, (setup && setup.startLength) || waveLength(state));
    return state;
  }

  function movePlayer(state) {
    const p = state.player;
    if (p.inputX) {
      const nx = p.x + p.inputX;
      if (nx >= 0 && nx < state.cols && !mushroomHp(state, nx, p.y)) p.x = nx;
    }
    if (p.inputY) {
      const ny = p.y + p.inputY;
      if (ny >= playerTop(state) && ny <= state.rows - 1 && !mushroomHp(state, p.x, ny)) p.y = ny;
    }
  }

  // Destroy the segment at index i: score it, drop a mushroom where it died, and
  // promote the segment behind it (now the front of the trailing chain) to a head.
  function destroySegment(state, index, events) {
    const seg = state.segments[index];
    const points = seg.isHead ? config.points.head : config.points.body;
    state.score += points;
    if (!mushroomHp(state, seg.x, seg.y)) state.mushrooms[key(seg.x, seg.y)] = config.mushroomHp;
    state.segments.splice(index, 1);
    if (index < state.segments.length) state.segments[index].isHead = true;
    events.push({ type: "segmentDestroyed", points, head: seg.isHead });
  }

  // Climb the bullet up the field, checking every cell so it never tunnels.
  function stepBullet(state, events) {
    if (!state.bullet) return;
    const b = state.bullet;
    for (let s = 0; s < config.bulletStep; s += 1) {
      b.y -= 1;
      if (b.y < 0) { state.bullet = null; return; }
      const hitIndex = state.segments.findIndex((seg) => seg.x === b.x && seg.y === b.y);
      if (hitIndex >= 0) { destroySegment(state, hitIndex, events); state.bullet = null; return; }
      const hp = mushroomHp(state, b.x, b.y);
      if (hp > 0) {
        if (hp - 1 <= 0) {
          delete state.mushrooms[key(b.x, b.y)];
          state.score += config.points.mushroom;
          events.push({ type: "mushroomDestroyed", points: config.points.mushroom });
        } else {
          state.mushrooms[key(b.x, b.y)] = hp - 1;
        }
        state.bullet = null;
        return;
      }
    }
  }

  // Each segment marches horizontally; blocked by an edge or a mushroom it drops
  // (or climbs) one row and reverses. Segments started in a line hit the same
  // obstacles, so a chain follows one serpentine path until it is split.
  function moveSegments(state) {
    for (const seg of state.segments) {
      const nx = seg.x + seg.dir;
      const blocked = nx < 0 || nx >= state.cols || mushroomHp(state, nx, seg.y) > 0;
      if (blocked) {
        seg.dir = -seg.dir;
        let ny = seg.y + seg.vDir;
        if (ny > state.rows - 1) { seg.vDir = -1; ny = seg.y + seg.vDir; }
        else if (ny < 0) { seg.vDir = 1; ny = seg.y + seg.vDir; }
        seg.y = Math.max(0, Math.min(state.rows - 1, ny));
      } else {
        seg.x = nx;
      }
    }
  }

  function respawnPlayer(state) {
    state.player.x = Math.floor(state.cols / 2);
    state.player.y = state.rows - 1;
    state.player.inputX = 0;
    state.player.inputY = 0;
  }

  function checkPlayerHit(state, events, rng) {
    const hit = state.segments.some((seg) => seg.x === state.player.x && seg.y === state.player.y);
    if (!hit) return null;
    state.lives -= 1;
    events.push({ type: "playerHit", lives: state.lives });
    if (state.lives <= 0) {
      events.push({ type: "gameOver", score: state.score, wavesCleared: state.wavesCleared });
      return "over";
    }
    state.bullet = null;
    respawnPlayer(state);
    spawnCentipede(state, waveLength(state));
    return "reset";
  }

  // One grid tick. ctx: { rng } (optional). Returns { state, events, alive }.
  // Events: segmentDestroyed{points,head}, mushroomDestroyed{points},
  // waveClear{wave}, playerHit{lives}, gameOver{score,wavesCleared}.
  function step(state, ctx) {
    const rng = (ctx && ctx.rng) || Math.random;
    const events = [];

    movePlayer(state);
    stepBullet(state, events);

    if (state.segments.length === 0) {
      state.wave += 1;
      state.wavesCleared += 1;
      seedMushrooms(state, config.waveMushrooms, rng);
      spawnCentipede(state, waveLength(state));
      events.push({ type: "waveClear", wave: state.wave });
    }

    moveSegments(state);

    if (checkPlayerHit(state, events, rng) === "over") return { state, events, alive: false };

    // Auto-fire: while no bullet is in flight, launch a fresh one from the shooter.
    if (!state.bullet) state.bullet = { x: state.player.x, y: state.player.y - 1 };

    return { state, events, alive: true };
  }

  return {
    config,
    key,
    mushroomHp,
    playerTop,
    waveLength,
    buildMushrooms,
    seedMushrooms,
    spawnCentipede,
    createState,
    destroySegment,
    step
  };
});
