// Canvas drawing for the forked Sticky Lasso tongues. Shared by the game and
// the Tongue Lab. Geometry and timing come from engine/tongue.js; this file
// only draws. `view` is { cell, x, y }: cell size in pixels and the board
// origin, so cell-unit points from the engine map to canvas pixels.
(function attachTongueDraw(root) {
  // Each renderer works in a frame where the mouth is (0, 0) and the tongue
  // points along +x, so the shapes are the same in every direction.
  function inMouthFrame(ctx, view, catchFrame, draw) {
    const CELL = view.cell;
    const { mouth, direction } = catchFrame;
    const toLocal = (point) => {
      const dx = (point.x - mouth.x) * CELL;
      const dy = (point.y - mouth.y) * CELL;
      return { x: dx * direction.x + dy * direction.y, y: -dx * direction.y + dy * direction.x };
    };
    ctx.save();
    ctx.translate(view.x + mouth.x * CELL, view.y + mouth.y * CELL);
    ctx.rotate(Math.atan2(direction.y, direction.x));
    draw(toLocal(catchFrame.tip), toLocal(catchFrame.seed));
    ctx.restore();
  }

  const seedRadius = (view, catchFrame) => view.cell * 0.32 * catchFrame.seed.scale;

  // Sticky Lasso body with a forked tip. Options change the five variations.
  function drawForkLasso(ctx, view, catchFrame, options) {
    const CELL = view.cell;
    inMouthFrame(ctx, view, catchFrame, (tip, seed) => {
      const pulling = catchFrame.phase === "pull";
      const reach = Math.max(0, tip.x);
      const stretch = Math.min(1, reach / (CELL * 2));
      const thickness = CELL * options.thickness * (1 - stretch * 0.4);
      const radius = seedRadius(view, catchFrame) + CELL * 0.04;
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

      // One continuous silhouette: the body narrows a little toward the tip,
      // then splits into two tines that curve apart and taper to points.
      // Each tine starts on its own half of the body, so the outer edges flow
      // straight on from the body edges and the inner edges meet at the split.
      const bodyHalf = (index) => (thickness / 2) * (1 - 0.15 * (index / (points.length - 1)));
      const endHalf = bodyHalf(points.length - 1);
      const tineLength = CELL * options.prong;
      const tines = [-1, 1].map((side) => {
        const root = { x: end.x, y: end.y + side * endHalf / 2 };
        const line = [];
        const samples = 12;
        if (pulling) {
          // Curl around the Seed from behind.
          const sweep = options.clamp;
          const arcRadius = radius + endHalf * 0.4;
          line.push(root);
          for (let i = 0; i <= samples; i += 1) {
            const angle = Math.PI - side * (0.35 + (sweep - 0.35) * (i / samples));
            line.push({ x: tip.x + Math.cos(angle) * arcRadius, y: tip.y + tremble + Math.sin(angle) * arcRadius });
          }
        } else {
          // Quadratic curve: leaves the body straight, then bends outward.
          const control = { x: root.x + tineLength * 0.45, y: root.y };
          const point = { x: root.x + Math.cos(spread) * tineLength, y: root.y + side * Math.sin(spread) * tineLength };
          for (let i = 0; i <= samples; i += 1) {
            const u = i / samples;
            line.push({
              x: (1 - u) * (1 - u) * root.x + 2 * (1 - u) * u * control.x + u * u * point.x,
              y: (1 - u) * (1 - u) * root.y + 2 * (1 - u) * u * control.y + u * u * point.y
            });
          }
        }
        // Edges: outer continues the body edge; inner faces the other tine.
        const outer = [];
        const inner = [];
        line.forEach((point, index) => {
          const next = line[Math.min(line.length - 1, index + 1)];
          const previous = line[Math.max(0, index - 1)];
          const length = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
          const normal = { x: -(next.y - previous.y) / length, y: (next.x - previous.x) / length };
          const half = (endHalf / 2) * Math.pow(1 - index / (line.length - 1), 0.85);
          outer.push({ x: point.x + side * normal.x * half, y: point.y + side * normal.y * half });
          inner.push({ x: point.x - side * normal.x * half, y: point.y - side * normal.y * half });
        });
        return { outer, inner, endPoint: line[line.length - 1], midPoint: line[Math.floor(line.length / 2)] };
      });
      const bodyEdge = (sign) => points.map((point, index) => {
        const next = points[Math.min(points.length - 1, index + 1)];
        const previous = points[Math.max(0, index - 1)];
        const length = Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
        const normal = { x: -(next.y - previous.y) / length, y: (next.x - previous.x) / length };
        return { x: point.x + sign * normal.x * bodyHalf(index), y: point.y + sign * normal.y * bodyHalf(index) };
      });
      const [upper, lower] = tines;
      const outline = [
        ...bodyEdge(-1),
        ...upper.outer,
        ...upper.inner.slice().reverse(),
        ...lower.inner,
        ...lower.outer.slice().reverse(),
        ...bodyEdge(1).reverse()
      ];
      const silhouette = new Path2D();
      outline.forEach((point, index) => (index === 0 ? silhouette.moveTo(point.x, point.y) : silhouette.lineTo(point.x, point.y)));
      silhouette.closePath();
      const prongs = tines;

      // Soft shading across the width, one outline, and a faint center groove.
      const shade = ctx.createLinearGradient(0, -thickness / 2, 0, thickness / 2);
      shade.addColorStop(0, "#f3a2ae");
      shade.addColorStop(0.5, "#e57f8c");
      shade.addColorStop(1, "#cf6577");
      ctx.fillStyle = shade;
      ctx.fill(silhouette);
      ctx.lineJoin = "miter";
      ctx.miterLimit = 8;
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = "#8f3549";
      ctx.stroke(silhouette);
      ctx.strokeStyle = "rgba(143, 53, 73, 0.4)";
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      ctx.beginPath();
      points.forEach((point, index) => {
        if (point.x < thickness * 0.4 || point.x > end.x - endHalf * 1.2) return;
        if (index === 0 || points[index - 1].x < thickness * 0.4) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
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


  // Shape options for each forked style.
  const forkOptions = {
    lassoFork: { thickness: 0.22, prong: 0.26, spread: 0.5, clamp: 1.5 },
    wideSnap: { thickness: 0.24, prong: 0.32, spread: 0.95, clamp: 1.95 },
    gooFork: { thickness: 0.22, prong: 0.26, spread: 0.6, clamp: 1.45, goo: true },
    whipFork: {
      thickness: 0.15, prong: 0.24, spread: 0.55, clamp: 1.6,
      // Waves while it shoots out, then wobbles with the rubbery pull.
      wave: (frame) => (frame.phase === "pull" ? Math.max(-0.18, Math.min(0.18, (1 - frame.pull) * 0.6)) : 0.22 * (1 - frame.extension))
    },
    doubleSnap: { thickness: 0.22, prong: 0.26, spread: 0.5, clamp: 1.75, tremble: true },
  };

  function drawForkTongue(ctx, view, catchFrame) {
    const options = forkOptions[catchFrame.style];
    if (!options || !catchFrame.showTongue) return;
    drawForkLasso(ctx, view, catchFrame, options);
  }

  root.IdleSnakeTongueDraw = { inMouthFrame, seedRadius, drawForkLasso, drawForkTongue, forkOptions };
})(typeof window !== "undefined" ? window : globalThis);
