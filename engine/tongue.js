// Tongue catch display model. Pure timing and geometry for the snake's tongue
// reaching out, grabbing a Seed that lies straight ahead, and pulling it into
// the mouth before the head arrives on the Seed cell. Display only: the run
// still eats the Seed when the head enters its cell, and nothing here changes
// movement, collision, scoring, or save data.
//
// All positions are in cell units, measured to cell centers (cell x=3 has its
// center at x=3.5). The UI multiplies by its cell size and draws the shapes.
(function attachTongue(root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeTongue = engine;
  else root.IdleSnakeTongue = engine;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const vectors = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  // The tongue starts this many steps before the head reaches the Seed.
  const REACH_STEPS = 2;
  // Mouth position in front of the head center, in cells.
  const MOUTH_OFFSET = 0.42;
  // Seed size when the head arrives; it shrinks while held in the mouth.
  const SWALLOW_SCALE = 0.3;

  // Each style is a timeline over catch progress t (0 = tongue starts,
  // 1 = head enters the Seed cell). The UI draws the shape for each `id`.
  //   flickUntil: a short warning flick before the reach (0 = none)
  //   emergeUntil / emergeCells: the tongue slides out of the mouth to this
  //               length (cells) and holds there, showing its shape, before
  //               the reach (0 = none)
  //   grabAt:     the tip touches the Seed
  //   pullUntil:  the Seed arrives at the mouth
  //   reachEase / pullEase: easing names from `easings`
  const styles = [
    {
      id: "fork", group: "first",
      name: "Forked Flick",
      summary: "Thin red forked tongue. One quick warning flick, then the fork closes on the Seed and drags it in.",
      flickUntil: 0.16, grabAt: 0.36, pullUntil: 0.64,
      reachEase: "outCubic", pullEase: "inOutSine", wobble: 0
    },
    {
      id: "frog", group: "first",
      name: "Sticky Lasso",
      summary: "Thick pink tongue shoots out fast. The Seed sticks to the round tip and snaps back with a springy overshoot.",
      flickUntil: 0, grabAt: 0.18, pullUntil: 0.56,
      reachEase: "outQuint", pullEase: "outBack", wobble: 0
    },
    {
      id: "pixel", group: "first",
      name: "Pixel Ribbon",
      summary: "Retro LCD tongue built from screen-ink blocks. It extends and retracts in quarter-cell steps, like the board.",
      flickUntil: 0, grabAt: 0.4, pullUntil: 0.72,
      reachEase: "steps4", pullEase: "steps4", wobble: 0
    },
    {
      id: "curl", group: "first",
      name: "Curl Hook",
      summary: "The tongue arcs out, curls around the Seed, and reels it back along a wavy path.",
      flickUntil: 0, grabAt: 0.38, pullUntil: 0.7,
      reachEase: "inOutSine", pullEase: "inOutSine", wobble: 0.22
    },
    {
      id: "slurp", group: "first",
      name: "Noodle Slurp",
      summary: "A short tongue latches on, then suction rings stretch the Seed like a noodle and slurp it in fast.",
      flickUntil: 0, grabAt: 0.3, pullUntil: 0.6,
      reachEase: "outCubic", pullEase: "inExpo", wobble: 0
    },
    // Second set: Sticky Lasso speed and spring, with a forked tip.
    {
      id: "lassoFork", group: "lassoFork",
      name: "Fork Lasso",
      summary: "Sticky Lasso with a forked tip. Shoots out fast, the two prongs pinch the Seed, and it snaps back with a small spring.",
      flickUntil: 0, emergeUntil: 0.24, emergeCells: 0.5, grabAt: 0.4, pullUntil: 0.76,
      reachEase: "outCubic", pullEase: "outBack", wobble: 0
    },
    {
      id: "wideSnap", group: "lassoFork",
      name: "Wide Fork Snap",
      summary: "Faster shot with wide prongs that clamp shut on the Seed. A strong spring throws the Seed past the mouth before it settles.",
      flickUntil: 0, emergeUntil: 0.22, emergeCells: 0.55, grabAt: 0.36, pullUntil: 0.72,
      reachEase: "outQuint", pullEase: "outBackStrong", wobble: 0
    },
    {
      id: "gooFork", group: "lassoFork",
      name: "Sticky Goo Fork",
      summary: "Each prong ends in a sticky drop. A strand of goo stretches between the tongue and the Seed while it is pulled in.",
      flickUntil: 0, emergeUntil: 0.26, emergeCells: 0.5, grabAt: 0.44, pullUntil: 0.8,
      reachEase: "outCubic", pullEase: "outBack", wobble: 0
    },
    {
      id: "whipFork", group: "lassoFork",
      name: "Whip Fork",
      summary: "A thinner tongue whips out in a wave that straightens at the Seed, then the fork wraps it and the tongue wobbles back like rubber.",
      flickUntil: 0, emergeUntil: 0.24, emergeCells: 0.45, grabAt: 0.46, pullUntil: 0.84,
      reachEase: "outCubic", pullEase: "outElastic", wobble: 0
    },
    {
      id: "doubleSnap", group: "lassoFork",
      name: "Double Snap",
      summary: "The fork grabs, yanks the Seed halfway, stops for a moment, then snaps it the rest of the way in.",
      flickUntil: 0, emergeUntil: 0.22, emergeCells: 0.5, grabAt: 0.38, pullUntil: 0.84,
      reachEase: "outCubic", pullEase: "twoSnap", wobble: 0
    }
  ];
  const groups = [
    { id: "lassoFork", name: "Sticky Lasso with a fork" },
    { id: "first", name: "First five ideas" }
  ];
  const styleById = new Map(styles.map((style) => [style.id, style]));

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const easings = {
    linear: (t) => t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
    // Overshoots past 1 (the Seed passes the mouth slightly), then settles.
    outBack: (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    steps4: (t) => (t >= 1 ? 1 : Math.floor(t * 4) / 4),
    outBackStrong: (t) => {
      const c1 = 3.2;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    // Rubbery settle: overshoots and wobbles a few times around 1.
    outElastic: (t) => {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3.2)) + 1;
    },
    // Fast yank to half, a short hold, then a fast yank to the mouth.
    twoSnap: (t) => {
      const snap = (local) => 1 - Math.pow(1 - local, 4);
      if (t < 0.35) return 0.5 * snap(t / 0.35);
      if (t < 0.55) return 0.5;
      return 0.5 + 0.5 * snap((t - 0.55) / 0.45);
    }
  };

  function ease(name, t) {
    return (easings[name] || easings.linear)(clamp01(t));
  }

  function getStyle(id) {
    return styleById.get(id) || styles[0];
  }

  // Number of steps until the head enters `seed`, or null when the Seed is not
  // straight ahead within reach. `stepProgress` is 0..1 through the current
  // step, so the result decreases smoothly to 0 at arrival.
  function stepsUntilSeed(head, direction, seed, stepProgress = 0) {
    const vector = vectors[direction];
    if (!vector || !head || !seed) return null;
    const dx = seed.x - head.x;
    const dy = seed.y - head.y;
    // Same row or column, in front of the head.
    const ahead = dx * vector.x + dy * vector.y;
    const side = dx * vector.y - dy * vector.x;
    if (side !== 0 || ahead < 1 || ahead > REACH_STEPS) return null;
    return ahead - clamp01(stepProgress);
  }

  // Geometry and phase for one frame of a catch.
  //   style:  style id
  //   t:      catch progress 0..1
  //   head:   head cell; direction: facing; seed: Seed cell
  function catchFrame(styleId, t, head, direction, seed) {
    const style = getStyle(styleId);
    const vector = vectors[direction] || vectors.right;
    const progress = clamp01(t);
    const mouth = {
      x: head.x + 0.5 + vector.x * MOUTH_OFFSET,
      y: head.y + 0.5 + vector.y * MOUTH_OFFSET
    };
    const seedHome = { x: seed.x + 0.5, y: seed.y + 0.5 };

    const gap = Math.max(0.001, Math.hypot(seedHome.x - mouth.x, seedHome.y - mouth.y));
    const emergeUntil = style.emergeUntil || 0;
    const emerged = emergeUntil ? Math.min(0.9, (style.emergeCells || 0) / gap) : 0;
    const reachFrom = Math.max(style.flickUntil, emergeUntil);

    let phase;
    let extension = 0; // tip position from mouth (0) to Seed home (1)
    let pull = 0;      // Seed position from home (0) to mouth (1); may overshoot
    if (progress < style.flickUntil) {
      phase = "flick";
      // Out and back to a short length, so the reach reads as a decision.
      extension = Math.sin((progress / style.flickUntil) * Math.PI) * 0.28;
    } else if (progress < emergeUntil) {
      phase = "emerge";
      // Slide out in the first half, then hold the shape in view.
      extension = emerged * ease("outCubic", progress / emergeUntil / 0.55);
    } else if (progress < style.grabAt) {
      phase = "reach";
      const local = (progress - reachFrom) / Math.max(0.001, style.grabAt - reachFrom);
      extension = emerged + (1 - emerged) * ease(style.reachEase, local);
    } else if (progress < style.pullUntil) {
      phase = "pull";
      const local = (progress - style.grabAt) / Math.max(0.001, style.pullUntil - style.grabAt);
      pull = ease(style.pullEase, local);
      extension = 1 - pull;
    } else {
      phase = "hold";
      pull = 1;
    }

    const lerp = (from, to, amount) => ({
      x: from.x + (to.x - from.x) * amount,
      y: from.y + (to.y - from.y) * amount
    });
    const seedPoint = lerp(seedHome, mouth, pull);
    // Side-to-side wave while the Seed travels (Curl Hook), zero at both ends.
    const wave = style.wobble * Math.sin(pull * Math.PI * 2) * Math.sin(pull * Math.PI);
    seedPoint.x += vector.y * wave;
    seedPoint.y += -vector.x * wave;
    const tip = phase === "pull" ? { ...seedPoint } : lerp(mouth, seedHome, extension);

    const holdProgress = phase === "hold" ? (progress - style.pullUntil) / Math.max(0.001, 1 - style.pullUntil) : 0;
    const scale = 1 - (1 - SWALLOW_SCALE) * ease("inOutSine", holdProgress);
    // Noodle stretch along the travel direction, strongest mid-pull.
    const stretch = style.id === "slurp" && phase === "pull" ? 1 + Math.sin(clamp01(pull) * Math.PI) * 0.9 : 1;

    return {
      style: style.id,
      t: progress,
      phase,
      extension,
      pull,
      mouth,
      tip,
      seed: { x: seedPoint.x, y: seedPoint.y, scale, stretch },
      // Tongue length in cells (mouth to tip), for shape drawing.
      length: Math.hypot(tip.x - mouth.x, tip.y - mouth.y),
      direction: vector,
      showTongue: phase !== "hold"
    };
  }

  // Catch moments for still frames that compare the shapes.
  function previewMoments(styleId) {
    const style = getStyle(styleId);
    const reachFrom = Math.max(style.flickUntil, style.emergeUntil || 0);
    const reachAt = (share) => reachFrom + (style.grabAt - reachFrom) * share;
    // Without an emerge or flick phase, the first frames come from the reach.
    const emergeAt = style.emergeUntil ? style.emergeUntil * 0.75 : style.flickUntil ? style.flickUntil / 2 : reachAt(0.3);
    const halfAt = style.emergeUntil || style.flickUntil ? reachAt(0.35) : reachAt(0.6);
    return [
      { label: "Emerging", t: emergeAt },
      { label: "Half out", t: halfAt },
      { label: "Full reach", t: style.grabAt - 0.002 },
      { label: "Grab", t: style.grabAt + (style.pullUntil - style.grabAt) * 0.1 }
    ];
  }

  // Tracks one catch across frames. The only memory is how far away the Seed
  // was when the catch began, so a Seed that appears next to the head (or a
  // turn into one) still plays the whole timeline, only faster.
  function createCatchTracker(styleId = styles[0].id) {
    let current = null; // { key, startSteps }
    let style = getStyle(styleId).id;

    function update({ head, direction, seeds, stepProgress = 0, running = true }) {
      if (!running || !head) {
        if (!running) return current?.frame || null;
        current = null;
        return null;
      }
      let best = null;
      (seeds || []).forEach((seed) => {
        const steps = stepsUntilSeed(head, direction, seed, stepProgress);
        if (steps !== null && (!best || steps < best.steps)) best = { seed, steps };
      });
      if (!best) {
        current = null;
        return null;
      }
      const key = `${best.seed.x},${best.seed.y}`;
      if (!current || current.key !== key || best.steps > current.startSteps) {
        current = { key, startSteps: Math.max(0.001, best.steps), frame: null };
      }
      const t = 1 - best.steps / current.startSteps;
      current.frame = { ...catchFrame(style, t, head, direction, best.seed), seedCell: best.seed };
      return current.frame;
    }

    return {
      update,
      setStyle(id) { style = getStyle(id).id; current = null; },
      get style() { return style; },
      reset() { current = null; }
    };
  }

  return {
    REACH_STEPS,
    MOUTH_OFFSET,
    SWALLOW_SCALE,
    styles,
    groups,
    stylesInGroup: (groupId) => styles.filter((style) => style.group === groupId),
    getStyle,
    ease,
    stepsUntilSeed,
    catchFrame,
    previewMoments,
    createCatchTracker
  };
});
