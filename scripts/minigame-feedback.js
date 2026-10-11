// Presentation geometry and labels shared by the canvas host and direct tests.
(function attach(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeMinigameFeedback = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  function strikeLayout(width, height) {
    const cols = 10, rows = 10, pad = 8, labelH = 18, gap = 12;
    const wide = width > height;
    const size = Math.min(wide ? (width - pad * 2 - gap) / 20 : (width - pad * 2) / 10,
      wide ? (height - pad * 2 - labelH) / 10 : (height - pad * 2 - labelH * 2 - gap) / 20);
    const boardW = size * cols, boardH = size * rows;
    const enemyX = (width - (wide ? boardW * 2 + gap : boardW)) / 2;
    const enemyY = (height - (wide ? boardH + labelH : boardH * 2 + labelH * 2 + gap)) / 2 + labelH;
    return { cols, rows, size, boardW, boardH, labelH, wide, enemyX, enemyY,
      playerX: wide ? enemyX + boardW + gap : enemyX,
      playerY: wide ? enemyY : enemyY + boardH + labelH + gap };
  }
  function strikeCell(event, rect, width, height, layout = strikeLayout(width, height)) {
    if (!(rect.width > 0 && rect.height > 0)) return null;
    const px = (event.clientX - rect.left) * width / rect.width;
    const py = (event.clientY - rect.top) * height / rect.height;
    for (const board of ["enemy", "player"]) {
      const x = px - layout[`${board}X`], y = py - layout[`${board}Y`];
      if (x >= 0 && y >= 0 && x < layout.boardW && y < layout.boardH)
        return { board, x: Math.floor(x / layout.size), y: Math.floor(y / layout.size) };
    }
    return null;
  }
  function shotLabel(shot) {
    const actor = shot.actor === "player" ? "Your strike" : "Enemy strike";
    const cell = `${String.fromCharCode(65 + shot.x)}${shot.y + 1}`;
    const result = shot.result === "sunk" ? `SUNK ${shot.ship || "snake"}` : shot.result === "hit" ? "HIT" : "MISS";
    return `${actor} ${cell}: ${result}`;
  }
  function shotEmphasis(age, reduced) {
    if (reduced || age < 0 || age >= 900) return null;
    return { progress: age / 900, alpha: 1 - age / 900 };
  }
  function mushroomOpacity(hp, maxHp = 4) {
    return hp <= 0 ? 0 : Math.max(0, 1 - .15 * (maxHp - Math.min(maxHp, hp)));
  }
  const species = {
    body: "Absorbs a hit", garden: "Nearby bite", cave: "Adds armor capacity",
    electric: "Stuns nearby enemies", lava: "Burns nearby enemies", rattle: "Poisons nearby enemies"
  };
  function segmentDescription(part) {
    return part.kind === "egg" ? `Hatches in ${Math.ceil(part.hatchAt / 1000)}s` : species[part.kind] || "Companion";
  }
  function broodlineGoal(state, phase) {
    if (phase === "gameover") return `Round ${state.round} · ${state.kills} kills · Start to try again`;
    if (state.phase === "formation") return `Round ${state.round} clear · Arrange companions, then continue or collect Seeds`;
    if (phase === "ready") return "Clear 5 waves · Steer; attacks are automatic · Avoid walls; crossing your chain cuts it";
    const eggs = state.chain.filter((part) => part.kind === "egg");
    const hatch = eggs.length ? ` · Egg ${Math.ceil(Math.min(...eggs.map((part) => part.hatchAt)) / 1000)}s` : "";
    return `R${state.round} · Wave ${state.wave}/5 · ${state.enemies.length} enemies · Armor ${state.armor}/${state.maxArmor}${hatch}`;
  }
  return { strikeLayout, strikeCell, shotLabel, shotEmphasis, mushroomOpacity, segmentDescription, broodlineGoal };
});
