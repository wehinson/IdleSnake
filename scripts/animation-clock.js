// Display time excludes pauses. Callers supply time so this also runs in Node.
(function attachAnimationClock(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeAnimationClock = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  function createAnimationClock() {
    let pausedAt = null;
    let pausedDuration = 0;
    return {
      now(time) { return (pausedAt ?? time) - pausedDuration; },
      pause(time) { if (pausedAt === null) pausedAt = time; },
      resume(time) {
        if (pausedAt !== null) pausedDuration += time - pausedAt;
        pausedAt = null;
      },
      reset() { pausedAt = null; pausedDuration = 0; }
    };
  }
  return { createAnimationClock };
});
