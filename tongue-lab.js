// Tongue Lab: draws the five tongue styles from engine/tongue.js side by side.
// The engine owns the catch timing and geometry; this file only builds the
// demo board and draws shapes.
(function tongueLab() {
  const Tongue = window.IdleSnakeTongue;
  const COLUMNS = 9;
  const ROWS = 3;
  const CELL = 48;
  const GAME_TICK_MS = 190;
  // Head walks x = 0..8, waits two steps, then the loop restarts.
  const MOVE_STEPS = COLUMNS - 1;
  const LOOP_STEPS = MOVE_STEPS + 2;
  const SEED = { x: 6, y: 1 };
  const START_LENGTH = 4;
  const DIGESTION_SEGMENT_STEPS = 70 / 190;
  // Still frames: a 2 x 2 grid of close-ups, each showing cells x 0.55..4.05.
  const STILL_CELLS = { x: 0.55, y: -0.15, width: 3.5, height: 1.3 };
  const STILLS_WIDTH = COLUMNS * CELL;
  const STILL_LABEL = 16;
  const STILL_SCALE = STILLS_WIDTH / 2 / (STILL_CELLS.width * CELL);
  const STILL_PANEL_HEIGHT = STILL_LABEL + STILL_CELLS.height * CELL * STILL_SCALE;
  const STILLS_HEIGHT = STILL_PANEL_HEIGHT * 2;
  const STILL_SCENE = { snake: [{ x: 1, y: 0 }, { x: 0, y: 0 }], seeds: [{ x: 3, y: 0 }], digestionSteps: null };

  const colors = {
    screen: "#9cac77",
    checker: "#93a36f",
    ink: "#182413",
    body: "#29391f",
    head: "#182413"
  };

  const state = { steps: 0, playing: true, speed: 0.5, last: performance.now() };
  const groupSelect = document.getElementById("group");
  Tongue.groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    groupSelect.appendChild(option);
  });
  let cards = [];
  function showGroup(groupId) {
    document.getElementById("cards").innerHTML = "";
    cards = Tongue.stylesInGroup(groupId).map((style, index) => buildCard(style, index));
  }
  showGroup(Tongue.groups[0].id);
  groupSelect.addEventListener("change", () => showGroup(groupSelect.value));

  // ---------- page wiring ----------
  const playButton = document.getElementById("play");
  const scrub = document.getElementById("scrub");
  playButton.addEventListener("click", () => {
    state.playing = !state.playing;
    playButton.textContent = state.playing ? "Pause" : "Play";
    playButton.setAttribute("aria-pressed", String(state.playing));
  });
  document.getElementById("speed").addEventListener("change", (event) => {
    state.speed = Number(event.target.value);
  });
  document.getElementById("head").addEventListener("change", (event) => {
    colors.head = event.target.value;
  });
  scrub.addEventListener("input", () => {
    state.steps = (Number(scrub.value) / 1000) * LOOP_STEPS;
  });

  function buildCard(style, index) {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<h2><span class="num">${index + 1}</span>${style.name}</h2>
      <canvas width="${COLUMNS * CELL}" height="${ROWS * CELL}" aria-label="${style.name} animation"></canvas>
      <div class="phase"></div>
      <canvas class="stills" aria-label="${style.name} still frames"></canvas>
      <p>${style.summary}</p>`;
    document.getElementById("cards").appendChild(card);
    const canvas = card.querySelector("canvas");
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = COLUMNS * CELL * ratio;
    canvas.height = ROWS * CELL * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    const stills = card.querySelector(".stills");
    stills.width = STILLS_WIDTH * ratio;
    stills.height = STILLS_HEIGHT * ratio;
    const stillsCtx = stills.getContext("2d");
    stillsCtx.scale(ratio, ratio);
    return {
      style, ctx, stillsCtx,
      moments: Tongue.previewMoments(style.id),
      phase: card.querySelector(".phase"),
      tracker: Tongue.createCatchTracker(style.id)
    };
  }

  // ---------- demo board ----------
  function scenario(steps) {
    const moving = Math.min(steps, MOVE_STEPS);
    const headX = Math.floor(moving);
    const stepProgress = steps >= MOVE_STEPS ? 0 : moving - headX;
    const eaten = headX >= SEED.x;
    const length = START_LENGTH + (eaten ? 1 : 0);
    const snake = Array.from({ length }, (_, index) => ({ x: headX - index, y: 1 }));
    const digestionSteps = eaten ? steps - SEED.x : null;
    return { snake, stepProgress, seeds: eaten ? [] : [SEED], digestionSteps };
  }

  function frame(now) {
    const elapsed = Math.min(100, now - state.last);
    state.last = now;
    if (state.playing) {
      state.steps = (state.steps + (elapsed * state.speed) / GAME_TICK_MS) % LOOP_STEPS;
      scrub.value = String(Math.round((state.steps / LOOP_STEPS) * 1000));
    }
    const scene = scenario(state.steps);
    cards.forEach((card) => drawCard(card, scene));
    requestAnimationFrame(frame);
  }

  function drawCard(card, scene) {
    const { ctx } = card;
    const head = scene.snake[0];
    const catchFrame = card.tracker.update({
      head,
      direction: "right",
      seeds: scene.seeds,
      stepProgress: scene.stepProgress
    });
    card.phase.textContent = catchFrame
      ? `${catchFrame.phase.toUpperCase()}  t=${catchFrame.t.toFixed(2)}`
      : scene.seeds.length ? "waiting for the Seed to come within reach" : "eaten";

    drawScene(ctx, card.style.id, scene, catchFrame);
    drawStills(card);
  }

  function drawScene(ctx, styleId, scene, catchFrame) {
    drawBoard(ctx);
    drawBody(ctx, scene);
    if (catchFrame && catchFrame.showTongue) drawTongue[styleId](ctx, catchFrame);
    if (catchFrame) drawSeedAt(ctx, catchFrame.seed.x * CELL, catchFrame.seed.y * CELL, catchFrame.seed.scale, catchFrame.seed.stretch);
    else scene.seeds.forEach((seed) => drawSeedAt(ctx, (seed.x + 0.5) * CELL, (seed.y + 0.5) * CELL, 1, 1));
    if (catchFrame && styleId === "slurp") drawSlurpEffects(ctx, catchFrame);
    drawHead(ctx, scene.snake[0], catchFrame);
  }

  // Close-ups of the tongue at fixed moments, so the shapes can be compared.
  function drawStills(card) {
    const ctx = card.stillsCtx;
    ctx.fillStyle = "#1a1c3a";
    ctx.fillRect(0, 0, STILLS_WIDTH, STILLS_HEIGHT);
    const head = STILL_SCENE.snake[0];
    card.moments.forEach((moment, index) => {
      const left = (index % 2) * (STILLS_WIDTH / 2);
      const top = Math.floor(index / 2) * STILL_PANEL_HEIGHT;
      const frame = Tongue.catchFrame(card.style.id, moment.t, head, "right", STILL_SCENE.seeds[0]);
      ctx.fillStyle = "#b9b6d8";
      ctx.font = "12px 'Courier New', monospace";
      ctx.textBaseline = "middle";
      ctx.fillText(moment.label, left + 6, top + STILL_LABEL / 2 + 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(left + 2, top + STILL_LABEL, STILLS_WIDTH / 2 - 4, STILL_PANEL_HEIGHT - STILL_LABEL - 3);
      ctx.clip();
      ctx.translate(left, top + STILL_LABEL);
      ctx.scale(STILL_SCALE, STILL_SCALE);
      ctx.translate(-STILL_CELLS.x * CELL, -STILL_CELLS.y * CELL);
      ctx.fillStyle = colors.screen;
      ctx.fillRect(STILL_CELLS.x * CELL, STILL_CELLS.y * CELL, STILL_CELLS.width * CELL, STILL_CELLS.height * CELL);
      drawScene(ctx, card.style.id, STILL_SCENE, frame);
      ctx.restore();
    });
  }

  function drawBoard(ctx) {
    ctx.fillStyle = colors.screen;
    ctx.fillRect(0, 0, COLUMNS * CELL, ROWS * CELL);
    ctx.fillStyle = colors.checker;
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLUMNS; x += 1) if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  function drawBody(ctx, scene) {
    const parts = scene.snake;
    ctx.strokeStyle = lighten(colors.body, 0.25);
    ctx.lineWidth = CELL * 0.46;
    ctx.lineCap = "butt";
    ctx.beginPath();
    parts.forEach((part, index) => {
      const x = (part.x + 0.5) * CELL;
      const y = (part.y + 0.5) * CELL;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    parts.forEach((part, index) => {
      if (index === 0) return;
      const isTail = index === parts.length - 1;
      const inset = CELL * (isTail ? 0.24 : 0.135) - CELL * 0.1 * digestionPulse(index, scene.digestionSteps);
      ctx.fillStyle = isTail ? colors.head : colors.body;
      roundedRect(ctx, part.x * CELL + inset, part.y * CELL + inset, CELL - inset * 2, CELL - inset * 2, CELL * 0.12);
    });
  }

  function digestionPulse(index, digestionSteps) {
    if (digestionSteps === null || digestionSteps < 0) return 0;
    const active = 1 + Math.floor(digestionSteps / DIGESTION_SEGMENT_STEPS);
    if (active !== index) return 0;
    return Math.sin(((digestionSteps % DIGESTION_SEGMENT_STEPS) / DIGESTION_SEGMENT_STEPS) * Math.PI);
  }

  function drawHead(ctx, head, catchFrame) {
    const inset = CELL * 0.105;
    // Gulp: the head swells a little while it holds the Seed.
    const gulp = catchFrame && catchFrame.phase === "hold" ? Math.sin(catchFrame.seed.scale * Math.PI) * CELL * 0.04 : 0;
    const x = head.x * CELL + inset - gulp;
    const y = head.y * CELL + inset - gulp;
    const size = CELL - inset * 2 + gulp * 2;
    ctx.fillStyle = "rgba(24, 36, 19, 0.34)";
    ctx.fillRect(x + CELL * 0.08, y + CELL * 0.08, size, size);
    ctx.fillStyle = colors.head;
    roundedRect(ctx, x, y, size, size, CELL * 0.12);
    const eye = Math.max(2, Math.floor(size * 0.12));
    const cx = x + size / 2 + size * 0.16;
    const cy = y + size / 2;
    ctx.fillStyle = eyeColor(colors.head);
    ctx.fillRect(cx - eye / 2, cy - size * 0.22 - eye / 2, eye, eye);
    ctx.fillRect(cx - eye / 2, cy + size * 0.22 - eye / 2, eye, eye);
  }

  // The game's default Seed: a dark square ring.
  function drawSeedAt(ctx, cx, cy, scale, stretch) {
    const size = CELL * 0.64 * scale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(stretch, 1 / Math.sqrt(stretch));
    ctx.fillStyle = colors.ink;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    const hole = size * 0.36;
    ctx.fillStyle = colors.screen;
    ctx.fillRect(-hole / 2, -hole / 2, hole, hole);
    ctx.restore();
  }

  // ---------- tongue styles ----------
  // Each renderer works in a frame where the mouth is (0, 0) and the tongue
  // points along +x, so the shapes are the same in every direction.
  function inMouthFrame(ctx, catchFrame, draw) {
    const { mouth, direction } = catchFrame;
    const toLocal = (point) => {
      const dx = (point.x - mouth.x) * CELL;
      const dy = (point.y - mouth.y) * CELL;
      return { x: dx * direction.x + dy * direction.y, y: -dx * direction.y + dy * direction.x };
    };
    ctx.save();
    ctx.translate(mouth.x * CELL, mouth.y * CELL);
    ctx.rotate(Math.atan2(direction.y, direction.x));
    draw(toLocal(catchFrame.tip), toLocal(catchFrame.seed));
    ctx.restore();
  }

  const seedRadius = (catchFrame) => CELL * 0.32 * catchFrame.seed.scale;

  // Closed outline around a centerline whose width shrinks from `width` at
  // the first point to zero at the last point.
  function taperedPath(line, width) {
    const left = [];
    const right = [];
    line.forEach((point, index) => {
      const next = line[Math.min(line.length - 1, index + 1)];
      const previous = line[Math.max(0, index - 1)];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const length = Math.hypot(dx, dy) || 1;
      const half = (width / 2) * (1 - index / (line.length - 1));
      left.push({ x: point.x - (dy / length) * half, y: point.y + (dx / length) * half });
      right.push({ x: point.x + (dy / length) * half, y: point.y - (dx / length) * half });
    });
    const path = new Path2D();
    left.forEach((point, index) => (index === 0 ? path.moveTo(point.x, point.y) : path.lineTo(point.x, point.y)));
    right.reverse().forEach((point) => path.lineTo(point.x, point.y));
    path.closePath();
    return path;
  }

  // Sticky Lasso body with a forked tip. Options change the five variations.
  function drawForkLasso(ctx, catchFrame, options) {
    inMouthFrame(ctx, catchFrame, (tip, seed) => {
      const pulling = catchFrame.phase === "pull";
      const reach = Math.max(0, tip.x);
      const stretch = Math.min(1, reach / (CELL * 2));
      const thickness = CELL * options.thickness * (1 - stretch * 0.4);
      const radius = seedRadius(catchFrame) + CELL * 0.04;
      // Prongs open as they leave the mouth and waggle while emerging.
      const waggle = catchFrame.phase === "emerge" ? 1 + 0.25 * Math.sin(catchFrame.t * 90) : 1;
      const spread = options.spread * Math.min(1, reach / (CELL * 0.6)) * waggle;
      // While reaching, stop the fork at the near edge of the Seed so the
      // prongs stay in view instead of hiding under it.
      const prongReach = Math.cos(spread) * CELL * options.prong;
      const forkX = pulling ? Math.max(0, reach - radius) : Math.max(0, Math.min(reach, seed.x - radius - prongReach));
      const tremble = options.tremble && pulling && Math.abs(catchFrame.pull - 0.5) < 0.001
        ? Math.sin(catchFrame.t * 400) * CELL * 0.025 : 0;

      // Tongue body as a centerline, so whip waves can bend it.
      const points = [];
      const segments = 18;
      for (let i = 0; i <= segments; i += 1) {
        const along = i / segments;
        const wave = options.wave ? options.wave(catchFrame) * Math.min(1, forkX / CELL) * Math.sin(along * Math.PI * 3) * Math.sin(along * Math.PI) : 0;
        points.push({ x: forkX * along, y: wave * CELL + tremble * along });
      }
      const end = points[points.length - 1];
      const strokePath = (width, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = "butt";
        ctx.lineJoin = "round";
        ctx.beginPath();
        points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
        ctx.stroke();
      };

      // Prongs are tapered wedges that end in sharp points, so the tip reads
      // as a clean V. Each prong is a centerline that narrows to zero width.
      const prongBase = Math.max(3, thickness * 0.46);
      // Start slightly inside the body so the two wedges join without a gap.
      const root = { x: end.x - prongBase * 0.6, y: end.y };
      const prongs = [-1, 1].map((side) => {
        const line = [];
        const samples = 10;
        if (pulling) {
          // Pinch around the Seed from behind.
          const sweep = options.clamp;
          const arcRadius = radius + prongBase * 0.3;
          line.push(root);
          for (let i = 0; i <= samples; i += 1) {
            const angle = Math.PI - side * sweep * (i / samples);
            line.push({ x: tip.x + Math.cos(angle) * arcRadius, y: tip.y + tremble + Math.sin(angle) * arcRadius });
          }
        } else {
          const length = CELL * options.prong;
          for (let i = 0; i <= samples; i += 1) {
            const along = i / samples;
            line.push({
              x: root.x + Math.cos(spread) * (length + prongBase * 0.6) * along,
              y: root.y + side * Math.sin(spread) * (length + prongBase * 0.6) * along
            });
          }
        }
        return { path: taperedPath(line, prongBase), endPoint: line[line.length - 1], midPoint: line[Math.floor(line.length / 2)] };
      });

      // Outline, then fill color, for the body; then the prong wedges.
      strokePath(thickness + 3, "#9c3f52");
      strokePath(thickness, "#e57f8c");
      ctx.lineJoin = "miter";
      ctx.miterLimit = 10;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#9c3f52";
      ctx.fillStyle = "#f095a1";
      prongs.forEach((prong) => {
        ctx.fill(prong.path);
        ctx.stroke(prong.path);
      });

      // Shine line along the top of the tongue.
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = Math.max(1, thickness * 0.18);
      ctx.beginPath();
      ctx.moveTo(thickness * 0.4, points[1].y - thickness * 0.22);
      ctx.lineTo(Math.max(thickness * 0.4, end.x - thickness * 0.4), end.y - thickness * 0.22);
      ctx.stroke();

      if (options.goo) {
        // Sticky drops hang from the middle of each prong, and a web joins the
        // prongs. The points stay sharp.
        ctx.fillStyle = "rgba(240, 149, 161, 0.85)";
        prongs.forEach(({ midPoint }) => {
          ctx.beginPath();
          ctx.arc(midPoint.x, midPoint.y + CELL * 0.03, CELL * 0.045, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = "rgba(240, 149, 161, 0.4)";
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.quadraticCurveTo(
          (prongs[0].endPoint.x + prongs[1].endPoint.x) / 2 - CELL * 0.06, end.y,
          prongs[0].endPoint.x, prongs[0].endPoint.y);
        ctx.lineTo(prongs[1].endPoint.x, prongs[1].endPoint.y);
        ctx.closePath();
        ctx.fill();
        // A drip that hangs below the tongue and grows while it pulls.
        const drip = CELL * (0.06 + (pulling ? 0.1 * Math.min(1, catchFrame.pull) : 0.03));
        const dripX = end.x * 0.55;
        ctx.strokeStyle = "rgba(240, 149, 161, 0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dripX, points[10].y + thickness / 2);
        ctx.lineTo(dripX, points[10].y + thickness / 2 + drip);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(dripX, points[10].y + thickness / 2 + drip, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  const drawTongue = {
    lassoFork: (ctx, f) => drawForkLasso(ctx, f, { thickness: 0.22, prong: 0.26, spread: 0.5, clamp: 1.5 }),
    wideSnap: (ctx, f) => drawForkLasso(ctx, f, { thickness: 0.24, prong: 0.32, spread: 0.95, clamp: 1.95 }),
    gooFork: (ctx, f) => drawForkLasso(ctx, f, { thickness: 0.22, prong: 0.26, spread: 0.6, clamp: 1.45, goo: true }),
    whipFork: (ctx, f) => drawForkLasso(ctx, f, {
      thickness: 0.15, prong: 0.24, spread: 0.55, clamp: 1.6,
      // Waves while it shoots out, then wobbles with the rubbery pull.
      wave: (frame) => (frame.phase === "pull" ? Math.max(-0.18, Math.min(0.18, (1 - frame.pull) * 0.6)) : 0.22 * (1 - frame.extension))
    }),
    doubleSnap: (ctx, f) => drawForkLasso(ctx, f, { thickness: 0.22, prong: 0.26, spread: 0.5, clamp: 1.75, tremble: true }),

    fork(ctx, catchFrame) {
      inMouthFrame(ctx, catchFrame, (tip) => {
        const pulling = catchFrame.phase === "pull";
        const radius = seedRadius(catchFrame) + CELL * 0.05;
        const stemEnd = pulling ? tip.x - radius : tip.x;
        ctx.strokeStyle = "#c8443f";
        ctx.lineCap = "round";
        ctx.lineWidth = CELL * 0.08;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.max(0, stemEnd), tip.y);
        ctx.stroke();
        ctx.lineWidth = CELL * 0.06;
        ctx.beginPath();
        if (pulling) {
          // The two prongs close around the Seed like pincers.
          ctx.arc(tip.x, tip.y, radius, Math.PI, Math.PI - 1.9, true);
          ctx.moveTo(stemEnd, tip.y);
          ctx.arc(tip.x, tip.y, radius, Math.PI, Math.PI + 1.9, false);
        } else {
          const prong = CELL * 0.17;
          const spread = catchFrame.phase === "flick" ? 0.35 : 0.55;
          ctx.moveTo(tip.x, tip.y);
          ctx.lineTo(tip.x + Math.cos(spread) * prong, tip.y - Math.sin(spread) * prong);
          ctx.moveTo(tip.x, tip.y);
          ctx.lineTo(tip.x + Math.cos(spread) * prong, tip.y + Math.sin(spread) * prong);
        }
        ctx.stroke();
      });
    },

    frog(ctx, catchFrame) {
      inMouthFrame(ctx, catchFrame, (tip) => {
        const stretch = Math.min(1, Math.abs(tip.x) / (CELL * 2));
        const thickness = CELL * 0.22 * (1 - stretch * 0.4);
        ctx.fillStyle = "#e57f8c";
        ctx.strokeStyle = "#9c3f52";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(0, -thickness / 2, Math.max(0, tip.x), thickness, thickness / 2);
        ctx.fill();
        ctx.stroke();
        const blob = CELL * 0.2;
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, blob, 0, Math.PI * 2);
        ctx.fillStyle = "#f095a1";
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
        ctx.beginPath();
        ctx.arc(tip.x - blob * 0.35, tip.y - blob * 0.4, blob * 0.25, 0, Math.PI * 2);
        ctx.fill();
      });
    },

    pixel(ctx, catchFrame) {
      inMouthFrame(ctx, catchFrame, (tip) => {
        const block = CELL * 0.15;
        const pitch = CELL * 0.2;
        ctx.fillStyle = "#7c2620";
        const end = Math.max(0, tip.x - (catchFrame.phase === "pull" ? seedRadius(catchFrame) : 0));
        for (let x = 0; x <= end; x += pitch) {
          ctx.fillRect(Math.round(x - block / 2), Math.round(-block / 2), Math.round(block), Math.round(block));
        }
        if (catchFrame.phase !== "pull" && tip.x > pitch) {
          // Two-pixel fork at the tip.
          ctx.fillRect(Math.round(end + pitch * 0.6), Math.round(-block * 1.2), Math.round(block), Math.round(block));
          ctx.fillRect(Math.round(end + pitch * 0.6), Math.round(block * 0.2), Math.round(block), Math.round(block));
        }
      });
    },

    curl(ctx, catchFrame) {
      inMouthFrame(ctx, catchFrame, (tip) => {
        const pulling = catchFrame.phase === "pull";
        const reach = Math.abs(tip.x);
        // Arc up on the way out; during the pull the tip follows the wavy Seed.
        const bow = pulling ? -tip.y * 0.8 : -CELL * 0.45 * Math.min(1, reach / CELL) * (1 - catchFrame.extension * 0.6);
        ctx.strokeStyle = "#d4625c";
        ctx.lineCap = "round";
        ctx.lineWidth = CELL * 0.085;
        const radius = seedRadius(catchFrame) + CELL * 0.07;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        if (pulling) {
          // Wrap around the Seed: approach from below and hook over the top.
          ctx.quadraticCurveTo(tip.x / 2, bow, tip.x, tip.y + radius);
          ctx.arc(tip.x, tip.y, radius, Math.PI / 2, -Math.PI * 0.9, true);
        } else {
          ctx.quadraticCurveTo(tip.x / 2, bow, tip.x, tip.y);
          // A small hook that opens as the tip nears the Seed.
          const hook = CELL * 0.12;
          ctx.arc(tip.x - hook, tip.y, hook, 0, -Math.PI * (0.6 + catchFrame.extension * 0.7), true);
        }
        ctx.stroke();
      });
    },

    slurp(ctx, catchFrame) {
      inMouthFrame(ctx, catchFrame, (tip) => {
        const end = catchFrame.phase === "pull" ? tip.x - seedRadius(catchFrame) * catchFrame.seed.stretch * 0.8 : tip.x;
        const base = CELL * 0.24;
        const point = CELL * 0.13;
        ctx.fillStyle = "#d9566b";
        ctx.beginPath();
        ctx.moveTo(0, -base / 2);
        ctx.lineTo(Math.max(0, end), tip.y - point / 2);
        ctx.arc(Math.max(0, end), tip.y, point / 2, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(0, base / 2);
        ctx.closePath();
        ctx.fill();
      });
    }
  };

  function drawSlurpEffects(ctx, catchFrame) {
    inMouthFrame(ctx, catchFrame, (tip, seed) => {
      if (catchFrame.phase === "pull") {
        // Suction rings travel from the Seed toward the mouth.
        ctx.strokeStyle = "rgba(244, 239, 216, 0.75)";
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i += 1) {
          const along = (catchFrame.t * 9 + i / 3) % 1;
          const x = seed.x * (1 - along);
          const r = CELL * (0.34 - along * 0.14);
          ctx.globalAlpha = 1 - along * 0.6;
          ctx.beginPath();
          ctx.ellipse(x, seed.y, r * 0.35, r, 0, -Math.PI / 2, Math.PI / 2, true);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // Speed lines behind the Seed.
        ctx.strokeStyle = "rgba(24, 36, 19, 0.6)";
        const back = seed.x + seedRadius(catchFrame) * catchFrame.seed.stretch + CELL * 0.08;
        [-0.16, 0, 0.16].forEach((offset, i) => {
          ctx.beginPath();
          ctx.moveTo(back + i * 2, seed.y + offset * CELL);
          ctx.lineTo(back + CELL * 0.22 + i * 2, seed.y + offset * CELL);
          ctx.stroke();
        });
      } else if (catchFrame.phase === "hold") {
        // Little puff marks at the mouth.
        const fade = catchFrame.seed.scale;
        ctx.fillStyle = `rgba(244, 239, 216, ${0.8 * fade})`;
        [[0.2, -0.3], [0.32, 0], [0.2, 0.3]].forEach(([x, y]) => {
          ctx.fillRect(x * CELL * (2 - fade), y * CELL * (2 - fade), 3, 3);
        });
      }
    });
  }

  function lighten(color, amount) {
    const hex = color.replace("#", "");
    const channel = (start) => {
      const value = parseInt(hex.slice(start, start + 2), 16);
      return Math.round(value + (255 - value) * amount).toString(16).padStart(2, "0");
    };
    return `#${channel(0)}${channel(2)}${channel(4)}`;
  }

  function eyeColor(color) {
    const hex = color.replace("#", "");
    const lum = (parseInt(hex.slice(0, 2), 16) * 299 + parseInt(hex.slice(2, 4), 16) * 587 + parseInt(hex.slice(4, 6), 16) * 114) / 1000;
    return lum > 145 ? "#101713" : "#e7e1c5";
  }

  requestAnimationFrame(frame);
})();
