// A display-only projection. It never changes the session's occupied cells.
(function attachSnakeBodyMotion(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeBodyMotion = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const distance = 0.13;
  const tailDistance = 0.06;
  const maxDurationMs = 60;

  function create(initialSnapshot = null) {
    let previous = initialSnapshot;
    let movement = null;

    function reset(snapshot = null) {
      previous = snapshot;
      movement = null;
    }

    function observe(snapshot) {
      const before = previous;
      previous = snapshot;
      if (snapshot.mode !== "snake" || !["running", "paused"].includes(snapshot.phase)
        || snapshot.reducedMotion || before?.mode !== "snake"
        || snapshot.elapsedMs < before.elapsedMs
        || snapshot.active?.grid.columns !== before.active?.grid.columns
        || snapshot.active?.grid.rows !== before.active?.grid.rows) {
        movement = null;
        return;
      }
      const snake = snapshot.active?.snake;
      const old = before.active?.snake;
      if (!snake?.length || !old?.length) { movement = null; return; }
      const dx = snake[0].x - old[0].x;
      const dy = snake[0].y - old[0].y;
      if (dx === 0 && dy === 0 && snake.length === old.length) return;
      // Ignore resets, imports, and multi-cell catch-up. A normal step has
      // one-cell travel; a newly grown tail can stay on its existing cell.
      if (Math.abs(dx) + Math.abs(dy) !== 1 || before.phase === "gameover") {
        movement = null;
        return;
      }
      movement = {
        startedAt: snapshot.elapsedMs - Math.max(0, snapshot.modeAccumulatorMs || 0),
        durationMs: Math.min(maxDurationMs, Math.max(1, snapshot.active.tickMs * 0.3)),
        directions: snake.map((part, index) => {
          const from = old[index] || old.at(-1);
          const x = part.x - from.x;
          const y = part.y - from.y;
          return index !== 0 && Math.abs(x) + Math.abs(y) === 1 ? { x, y } : null;
        })
      };
    }

    function points(snapshot, { reducedMotion = false } = {}) {
      const snake = snapshot.active?.snake || [];
      if (reducedMotion || snapshot.reducedMotion) movement = null;
      const active = snapshot.mode === "snake" && ["running", "paused"].includes(snapshot.phase);
      const progress = movement && active
        ? Math.max(0, Math.min(1, (snapshot.elapsedMs - movement.startedAt) / movement.durationMs)) : 1;
      // Ease into the center without overshoot or sideways movement.
      const remaining = (1 - progress) ** 2;
      return snake.map((part, index) => {
        const direction = movement?.directions[index];
        // The pointed tail extends past its block, so give it less travel to
        // keep its tip inside the destination cell too.
        const offset = (index === snake.length - 1 ? tailDistance : distance) * remaining;
        return direction && remaining > 0
          ? { x: part.x - direction.x * offset, y: part.y - direction.y * offset }
          : { x: part.x, y: part.y };
      });
    }

    return { observe, points, reset };
  }

  return { create };
});
