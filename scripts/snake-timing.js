// Optional browser timing trace. Add ?snakeTiming=1, then call
// IdleSnakeTiming.download() in the console after playing.
(function attachSnakeTiming(root) {
  const enabled = new URLSearchParams(root.location.search).get("snakeTiming") === "1";
  const entries = [];
  const maxEntries = 20000;
  let droppedEntries = 0;

  function record(type, values) {
    if (!enabled) return;
    if (entries.length >= maxEntries) {
      entries.splice(0, 1000);
      droppedEntries += 1000;
    }
    entries.push({ type, atMs: root.performance.now(), ...values });
  }

  function exportData() {
    return {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      timeOriginMs: root.performance.timeOrigin,
      turnTimingEnabled: root.IdleSnakeConfig.snakeConfig.turnTimingEnabled,
      droppedEntries,
      entries: entries.slice()
    };
  }

  function download() {
    if (!enabled) return false;
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `snake-timing-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();
    root.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  root.IdleSnakeTiming = { enabled, record, exportData, download };
  if (enabled) root.addEventListener("DOMContentLoaded", () => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "snake-timing-download";
    button.textContent = "Download timing log";
    button.addEventListener("click", download);
    document.body.append(button);
  });
})(window);
