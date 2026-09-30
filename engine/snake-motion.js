// Display geometry only. Logical cells and collision rules remain in snake.js.
(function attachSnakeMotion(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeMotion = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const periodMs = 800;
  const wavelength = 6;
  const amplitude = 0.065;

  function bodyPoints(snake, { elapsedMs = 0, phase = "ready", reducedMotion = false } = {}) {
    const active = !reducedMotion && (phase === "running" || phase === "paused");
    const time = Math.max(0, elapsedMs);
    const strength = active ? Math.min(1, time / 250) : 0;
    const wavePhase = (time % periodMs) / periodMs * Math.PI * 2;
    return snake.map((part, index) => {
      // The head marks the exact occupied cell. Each following block sways
      // across the local body direction, including bends and the final tail.
      if (index === 0 || strength === 0) return { x: part.x, y: part.y };
      const ahead = snake[index - 1];
      const behind = snake[index + 1] || part;
      const dx = ahead.x - behind.x;
      const dy = ahead.y - behind.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) return { x: part.x, y: part.y };
      const size = index === snake.length - 1 ? 0.045 : amplitude;
      const offset = Math.sin(wavePhase - index / wavelength * Math.PI * 2) * size * strength;
      return { x: part.x - dy / length * offset, y: part.y + dx / length * offset };
    });
  }

  return { bodyPoints };
});
