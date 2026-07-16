// Browser adapter: the engine owns every game decision.  This file may read a
// snapshot, render it, send actions, request ticks, and persist serialised
// state.  It deliberately contains no gameplay model, rules, timers or RNG.
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const saveKey = "snake-forever-save";
const scoreEl = document.querySelector("#score");
const timerEl = document.querySelector("#timer");
const bestEl = document.querySelector("#best");
const seedsEl = document.querySelector("#seedsTotal");
const overlay = document.querySelector("#overlay");
const stateText = document.querySelector("#stateText");
const screenHint = document.querySelector("#screenHint");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");
const boardSizeSelect = document.querySelector("#boardSizeSelect");
const duelGridSelect = document.querySelector("#duelGridSelect");
const modeByButton = { 1: "duel", 2: "maze", 3: "breakout", 4: "crossing", 5: "snakebird", 6: "sokoban", 7: "broodline" };

function readSave() {
  try { return JSON.parse(localStorage.getItem(saveKey) || "null"); } catch { return null; }
}
const game = window.IdleSnakeSession.createGameSession({ save: readSave(), now: Date.now() });
game.advanceOffline(Date.now());
let snapshot = game.snapshot();
let dirty = true;
let flushTimer = null;

function persist() {
  dirty = false; flushTimer = null;
  localStorage.setItem(saveKey, JSON.stringify(game.serialize()));
}
function requestPersist() {
  dirty = true;
  if (flushTimer === null) flushTimer = setTimeout(persist, 1000);
}
window.addEventListener("pagehide", () => { if (dirty) persist(); });

function format(value) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0); }
function formatTime(ms) {
  const seconds = Math.floor((ms || 0) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function show(message) { overlay?.classList.remove("hidden"); if (stateText) stateText.textContent = message; }
function hide() { overlay?.classList.add("hidden"); }
function apply(outcome) {
  snapshot = outcome.snapshot;
  for (const item of outcome.events) {
    if (item.type === "runStarted") hide();
    if (item.type === "paused") show("Paused");
    if (item.type === "runEnded") show(item.won ? `Clear · +${format(item.reward)} Seeds` : item.reason || `Game Over${item.reward ? ` · +${format(item.reward)} Seeds` : ""}`);
    if (item.type === "actionRejected" && item.reason !== "blocked") screenHint && (screenHint.textContent = item.reason);
  }
  requestPersist(); render();
}
function action(value) { apply(game.dispatch(value)); }

function board() {
  const a = snapshot.active;
  if (!a) return { columns: 15, rows: 15 };
  if (a.grid) return a.grid;
  if (a.width && a.height) return { columns: a.width, rows: a.height };
  if (a.board) return { columns: 18, rows: 18 };
  return { columns: 30, rows: 30 };
}
function metrics() {
  const grid = board(); const pad = 12; const cell = Math.max(1, Math.floor(Math.min((canvas.width - pad * 2) / grid.columns, (canvas.height - pad * 2) / grid.rows)));
  return { grid, cell, x: Math.floor((canvas.width - cell * grid.columns) / 2), y: Math.floor((canvas.height - cell * grid.rows) / 2) };
}
function rect(point, inset = 2) {
  const m = metrics(); return { x: m.x + point.x * m.cell + inset, y: m.y + point.y * m.cell + inset, s: Math.max(1, m.cell - inset * 2) };
}
function fill(point, color, inset = 2) { const r = rect(point, inset); ctx.fillStyle = color; ctx.fillRect(r.x, r.y, r.s, r.s); }
function keySet(values) { return new Set(values || []); }
function drawGrid() {
  const m = metrics(); ctx.fillStyle = "#102014"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#29422d"; ctx.lineWidth = 1;
  for (let x = 0; x <= m.grid.columns; x += 1) { ctx.beginPath(); ctx.moveTo(m.x + x * m.cell, m.y); ctx.lineTo(m.x + x * m.cell, m.y + m.grid.rows * m.cell); ctx.stroke(); }
  for (let y = 0; y <= m.grid.rows; y += 1) { ctx.beginPath(); ctx.moveTo(m.x, m.y + y * m.cell); ctx.lineTo(m.x + m.grid.columns * m.cell, m.y + y * m.cell); ctx.stroke(); }
}
function drawSnake(parts, head = "#e5f0b0", body = "#91b957") { (parts || []).slice().reverse().forEach((part, index) => fill(part, index === parts.length - 1 ? head : body)); }
function drawSnapshot() {
  const a = snapshot.active; drawGrid(); if (!a) return;
  if (snapshot.mode === "breakout") {
    const sx = canvas.width / a.board.width, sy = canvas.height / a.board.height;
    ctx.fillStyle = "#91b957"; a.bricks.forEach((b) => ctx.fillRect(b.x * sx, b.y * sy, b.width * sx, b.height * sy));
    ctx.fillStyle = "#e5f0b0"; ctx.fillRect(a.paddle.x * sx, a.paddle.y * sy, (a.paddle.length * a.segmentSize + (a.paddle.length - 1) * a.gap) * sx, a.segmentSize * sy);
    a.balls.forEach((ball) => { ctx.beginPath(); ctx.arc(ball.x * sx, ball.y * sy, ball.radius * sx, 0, Math.PI * 2); ctx.fill(); }); return;
  }
  if (snapshot.mode === "snakebird") {
    keySet(a.solids).forEach((id) => { const [x, y] = id.split(",").map(Number); fill({ x, y }, "#52664a", 0); });
    keySet(a.fruits).forEach((id) => { const [x, y] = id.split(",").map(Number); fill({ x, y }, "#e5a04c", 4); });
    if (a.exit) fill(a.exit, "#6b9a5a", 4); drawSnake(a.body); return;
  }
  if (snapshot.mode === "sokoban") {
    keySet(a.walls).forEach((id) => { const [x, y] = id.split(",").map(Number); fill({ x, y }, "#52664a", 0); });
    a.goals.forEach((p) => fill(p, "#e5a04c", 5)); a.crates.forEach((p) => fill(p, "#b87b48", 3)); a.pellets.forEach((p) => fill(p, "#e5a04c", 5)); drawSnake(a.snake); return;
  }
  if (snapshot.mode === "maze") { keySet(a.open).forEach((id) => { const [x, y] = id.split(",").map(Number); fill({ x, y }, "#27482d", 1); }); if (a.food) fill(a.food, "#e5a04c", 4); drawSnake(a.path); return; }
  if (snapshot.mode === "duel") { a.foods.forEach((p) => fill(p, "#e5a04c", 4)); drawSnake(a.player.body, "#d5f1a2", "#91b957"); drawSnake(a.opponent.body, "#fffdf0", "#a7b2a1"); return; }
  if (snapshot.mode === "crossing") { a.cars.forEach((car) => { for (let x = Math.ceil(car.x); x < car.x + car.width; x += 1) fill({ x: (x + a.grid.columns) % a.grid.columns, y: car.row }, "#b85a4d", 1); }); drawSnake(a.snake); return; }
  if (snapshot.mode === "broodline") { a.enemies.forEach((e) => fill(e.pos, "#c4574e", 2)); a.pickups.forEach((p) => fill(p.pos, "#e5a04c", 4)); drawSnake([a.head, ...a.chain.map((p) => p.pos)]); return; }
  (a.foods || []).forEach((food) => fill(food, "#e5a04c", 4)); drawSnake(a.snake);
}
function render() {
  drawSnapshot();
  scoreEl && (scoreEl.textContent = format(snapshot.hud.score)); bestEl && (bestEl.textContent = format(snapshot.best)); seedsEl && (seedsEl.textContent = format(snapshot.seeds)); timerEl && (timerEl.textContent = formatTime(snapshot.elapsedMs));
  pauseButton && (pauseButton.textContent = snapshot.phase === "paused" ? "Resume" : "Pause");
  if (snapshot.phase === "ready") show(`${snapshot.mode === "snake" ? "Snake" : snapshot.mode} · Ready`);
}

const keys = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
document.addEventListener("keydown", (event) => {
  const direction = keys[event.code]; if (direction) { event.preventDefault(); action({ type: "direction", direction }); return; }
  if (event.code === "Enter") { event.preventDefault(); action({ type: "start" }); }
  if (event.code === "Space") { event.preventDefault(); action({ type: snapshot.phase === "paused" ? "resume" : "pause" }); }
});
document.querySelectorAll("[data-direction]").forEach((button) => button.addEventListener("click", () => action({ type: "direction", direction: button.dataset.direction })));
startButton?.addEventListener("click", () => action({ type: "start" }));
pauseButton?.addEventListener("click", () => action({ type: snapshot.phase === "paused" ? "resume" : "pause" }));
resetButton?.addEventListener("click", () => action({ type: "restart" }));
boardSizeSelect?.addEventListener("change", () => action({ type: "selectBoard", level: Number(boardSizeSelect.value) }));
duelGridSelect?.addEventListener("change", () => screenHint && (screenHint.textContent = "Duel board size is fixed in the deterministic session."));
document.querySelectorAll("[data-minigame]").forEach((button) => button.addEventListener("click", () => { const mode = modeByButton[Number(button.dataset.minigame)]; if (mode) action({ type: "selectMode", mode }); }));
const upgradeMap = { boardUpgradeButton: "board", foodTypeButton: "foodType", foodCountButton: "foodCount", shieldButton: "shield", minigamesButton: "minigames" };
Object.entries(upgradeMap).forEach(([id, upgrade]) => document.querySelector(`#${id}`)?.addEventListener("click", () => action({ type: "buyUpgrade", upgrade })));
document.querySelector("#layEggButton")?.addEventListener("click", () => action({ type: "layEgg" }));

let previous = performance.now();
function frame(now) { apply(game.tick(now - previous)); previous = now; requestAnimationFrame(frame); }
render(); requestAnimationFrame(frame);
