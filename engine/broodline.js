// Headless broodline minigame — a snake-chain vs. waves of enemy snakes with
// automatic attacks, poison/burn/stun, egg hatching, and per-round formation.
// Real-time; the whole combat simulation is pure here. Port of game.js's
// broodlineStep + its combat helpers. Side-effects (end-run rewards, formation
// UI, HUD) are lifted into returned events. State is the game.js `broodline`
// object; the host renders it and interprets events.
(function attachBroodline(root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeBroodline = engine;
  else root.IdleSnakeBroodline = engine;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const vectors = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };
  const TICK_MS = 220;
  const WAVES_PER_ROUND = 5;
  const MAX = 29; // walls at x/y <= 0 or >= 29 (playable 1..28)

  const key = (p) => `${p.x},${p.y}`;
  const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const vectorsToPoints = (pos) => Object.values(vectors).map((v) => ({ x: pos.x + v.x, y: pos.y + v.y }));

  function randomOpen(rng, occupied = new Set()) {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const point = { x: 1 + Math.floor(rng() * 28), y: 1 + Math.floor(rng() * 28) };
      if (!occupied.has(key(point))) return point;
    }
    return { x: 15, y: 15 };
  }

  const roundSize = (round) => 4 + Math.floor((round - 1) * 1.35);

  function spawnWave(state, rng) {
    const occupied = new Set([key(state.head), ...state.chain.map((part) => key(part.pos))]);
    state.enemies = [];
    const count = roundSize(state.round);
    const rangedCount = Math.max(1, Math.round(count / 4));
    for (let i = 0; i < count; i += 1) {
      const pos = randomOpen(rng, occupied); occupied.add(key(pos));
      const ranged = i < rangedCount;
      state.enemies.push({ type: ranged ? "ranged" : "melee", pos, hp: ranged ? 4 : 7, maxHp: ranged ? 4 : 7, cooldown: rng() * 5, stun: 0, burn: 0, poison: 0, target: null });
    }
  }

  // Pure part of game.js broodlineSpawnRound (host still does state/hint/DOM).
  function spawnRound(state, rng) {
    state.wave = 1;
    spawnWave(state, rng);
    state.phase = "combat";
  }

  function addDrop(state, enemy, rng) {
    const roll = rng();
    const kind = roll < .5 ? "body" : roll < .76 ? "garden" : roll < .84 ? "egg" : roll < .9 ? "cave" : roll < .95 ? "rattle" : roll < .98 ? "electric" : "lava";
    state.pickups.push({ kind, pos: { ...enemy.pos } });
  }

  function damage(state, enemy, dmg, label, rng) {
    if (!enemy || enemy.hp <= 0) return;
    enemy.hp -= dmg;
    state.effects.push({ pos: { ...enemy.pos }, text: label, ttl: 650 });
    if (enemy.hp <= 0) { state.kills += 1; state.pendingSeeds += 2; if (rng() < .65) addDrop(state, enemy, rng); }
  }

  function nearestEnemy(state, pos, range, forwardOnly = false) {
    const dir = vectors[state.direction];
    return state.enemies
      .filter((enemy) => enemy.hp > 0 && (!forwardOnly || ((enemy.pos.x - pos.x) * dir.x + (enemy.pos.y - pos.y) * dir.y >= range.min && manhattan(enemy.pos, pos) <= range.max)))
      .filter((enemy) => manhattan(enemy.pos, pos) <= range.max)
      .sort((a, b) => manhattan(a.pos, pos) - manhattan(b.pos, pos))[0];
  }

  function openEnemyCell(state, point, enemy, reserved = new Set()) {
    if (point.x <= 0 || point.y <= 0 || point.x >= MAX || point.y >= MAX) return false;
    if (state.chain.some((part) => part.pos.x === point.x && part.pos.y === point.y)) return false;
    if (reserved.has(key(point))) return false;
    return !state.enemies.some((other) => other !== enemy && other.hp > 0 && other.pos.x === point.x && other.pos.y === point.y);
  }

  function stepToward(state, enemy, target, reserved) {
    const candidates = [];
    const dx = Math.sign(target.x - enemy.pos.x); const dy = Math.sign(target.y - enemy.pos.y);
    if (Math.abs(target.x - enemy.pos.x) >= Math.abs(target.y - enemy.pos.y)) {
      if (dx) candidates.push({ x: enemy.pos.x + dx, y: enemy.pos.y });
      if (dy) candidates.push({ x: enemy.pos.x, y: enemy.pos.y + dy });
    } else {
      if (dy) candidates.push({ x: enemy.pos.x, y: enemy.pos.y + dy });
      if (dx) candidates.push({ x: enemy.pos.x + dx, y: enemy.pos.y });
    }
    candidates.push(...vectorsToPoints(enemy.pos));
    const next = candidates.find((point) => openEnemyCell(state, point, enemy, reserved));
    if (next) { enemy.pos = next; reserved.add(key(next)); }
  }

  function closestBodyTarget(state, pos) {
    const body = state.chain.map((part, index) => ({ part, index })).filter(({ part }) => part.kind === "body");
    return body.sort((a, b) => manhattan(pos, a.part.pos) - manhattan(pos, b.part.pos))[0] || { part: state.head, index: -1 };
  }

  function meleeTargetCell(state, head, enemy) {
    return vectorsToPoints(head)
      .filter((point) => openEnemyCell(state, point, enemy))
      .sort((a, b) => manhattan(enemy.pos, a) - manhattan(enemy.pos, b))[0];
  }

  function stepAway(state, enemy, target, reserved) {
    const next = vectorsToPoints(enemy.pos)
      .filter((point) => openEnemyCell(state, point, enemy, reserved))
      .sort((a, b) => manhattan(b, target) - manhattan(a, target))[0];
    if (next) { enemy.pos = next; reserved.add(key(next)); }
  }

  function collect(state, growthPos) {
    const head = state.head;
    const index = state.pickups.findIndex((drop) => drop.pos.x === head.x && drop.pos.y === head.y);
    if (index < 0) return;
    const drop = state.pickups.splice(index, 1)[0];
    const tail = { ...growthPos };
    if (drop.kind === "egg") state.chain.push({ kind: "egg", pos: { ...tail }, hatchAt: 30000 });
    else if (drop.kind === "body") state.chain.push({ kind: "body", pos: { ...tail } });
    else { state.chain.push({ kind: drop.kind, pos: { ...tail }, cooldown: 0 }); state.hatchlingsCollected += 1; state.pendingSeeds += 1; if (drop.kind === "cave") state.maxArmor += 1; }
  }

  // Mutates hp/armor/chain/effects. On lethal damage, marks the run ended.
  function takeDamage(state, target = "head") {
    if (state.armor > 0) { state.armor -= 1; state.effects.push({ pos: { ...state.head }, text: "ARMOR", ttl: 700 }); return; }
    state.hp = Math.max(0, state.hp - 1);
    const bodyIndexes = state.chain.map((part, i) => part.kind === "body" ? i : -1).filter((i) => i >= 0);
    if (bodyIndexes.length) {
      const targetIndex = typeof target === "number" && bodyIndexes.includes(target) ? target : bodyIndexes.at(-1);
      state.chain.splice(targetIndex, 1);
    }
    state.effects.push({ pos: { ...state.head }, text: target === "head" ? "HEAD HIT" : "SEGMENT HIT", ttl: 800 });
    if (state.hp <= 0) { state.phase = "ended"; state.endReason = "Overwhelmed"; }
  }

  // One combat tick. Returns { state, events, alive }. Events: endRun{reason},
  // truncate, wave{wave}, roundClear.
  function step(state, ctx) {
    const rng = (ctx && ctx.rng) || Math.random;
    const events = [];
    if (state.phase !== "combat") return { state, events, alive: true };

    if (state.queue.length) state.direction = state.queue.shift();
    const vector = vectors[state.direction];
    const previousHead = { ...state.head };
    const old = state.chain.map((part) => ({ ...part.pos }));
    const next = { x: state.head.x + vector.x, y: state.head.y + vector.y };
    if (next.x <= 0 || next.y <= 0 || next.x >= MAX || next.y >= MAX) {
      state.phase = "ended"; state.endReason = "Wall death";
      return { state, events: [{ type: "endRun", reason: "Wall death" }], alive: false };
    }

    const collision = state.chain.findIndex((part) => part.pos.x === next.x && part.pos.y === next.y);
    if (collision >= 0) { state.chain.splice(collision); state.effects.push({ pos: next, text: "TRUNCATED", ttl: 900 }); events.push({ type: "truncate" }); }
    const retainedLength = state.chain.length;
    const growthPos = retainedLength ? old[retainedLength - 1] : previousHead;
    state.head = next;
    state.chain.forEach((part, index) => { part.pos = index === 0 ? { ...previousHead } : { ...old[index - 1] }; });
    collect(state, growthPos);

    const bite = nearestEnemy(state, next, { min: 0, max: 3 });
    const forward = nearestEnemy(state, next, { min: 3, max: 5 }, true);
    if (bite) damage(state, bite, 2, "FANG BITE", rng); else if (forward) damage(state, forward, 1, "VENOM", rng);

    state.chain.slice(1).forEach((part) => {
      if (!["garden", "electric", "lava", "rattle"].includes(part.kind)) return;
      part.cooldown = Math.max(0, (part.cooldown || 0) - TICK_MS);
      const enemy = nearestEnemy(state, part.pos, part.kind === "rattle" || part.kind === "electric" ? 3 : 2);
      if (enemy && part.cooldown === 0) {
        damage(state, enemy, part.kind === "rattle" ? 0 : 1, part.kind === "electric" ? "STUN" : part.kind === "lava" ? "BURN" : part.kind === "rattle" ? "POISON" : "GARDEN", rng);
        if (part.kind === "electric") enemy.stun = 3;
        if (part.kind === "lava") enemy.burn = 3;
        if (part.kind === "rattle") enemy.poison = 5;
        part.cooldown = part.kind === "garden" ? 500 : 900;
      }
    });

    const reserved = new Set();
    state.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      enemy.cooldown -= 1;
      enemy.stun = Math.max(0, enemy.stun - 1);
      if (enemy.burn > 0) { enemy.burn -= 1; damage(state, enemy, 1, "BURN", rng); }
      if (enemy.poison > 0) { enemy.poison -= 1; damage(state, enemy, 1, "POISON", rng); }
      if (enemy.hp <= 0 || enemy.stun) return;

      if (enemy.type === "melee") {
        const distance = manhattan(enemy.pos, state.head);
        enemy.target = "head";
        if (distance <= 1) {
          if (enemy.cooldown <= 0) { takeDamage(state, "head"); enemy.cooldown = 4; }
          return;
        }
        const attackCell = meleeTargetCell(state, state.head, enemy);
        stepToward(state, enemy, attackCell || state.head, reserved);
        return;
      }

      const target = closestBodyTarget(state, enemy.pos);
      const targetPos = target.index >= 0 ? target.part.pos : target.part;
      const distance = manhattan(enemy.pos, targetPos);
      enemy.target = target.index >= 0 ? target.index : "head";
      if (distance <= 5 && enemy.cooldown <= 0) { takeDamage(state, target.index >= 0 ? target.index : "head"); enemy.cooldown = 5; }
      if (distance < 3) stepAway(state, enemy, targetPos, reserved);
      else if (distance > 5) stepToward(state, enemy, targetPos, reserved);
      else reserved.add(key(enemy.pos));
    });

    state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
    state.effects.forEach((effect) => { effect.ttl -= TICK_MS; });
    state.effects = state.effects.filter((effect) => effect.ttl > 0);
    state.chain.filter((part) => part.kind === "egg").forEach((egg) => {
      egg.hatchAt -= TICK_MS;
      if (egg.hatchAt <= 0) {
        egg.kind = ["garden", "garden", "garden", "cave", "rattle", "electric", "lava"][Math.floor(rng() * 7)];
        state.eggsHatched += 1; state.pendingSeeds += 2;
        state.effects.push({ pos: { ...egg.pos }, text: "HATCH!", ttl: 1000 });
      }
    });

    // Lethal damage taken mid-tick ends the run.
    if (state.phase === "ended") {
      return { state, events: [...events, { type: "endRun", reason: state.endReason || "Overwhelmed" }], alive: false };
    }

    if (!state.enemies.length) {
      if (state.wave < WAVES_PER_ROUND) {
        state.wave += 1;
        state.pendingSeeds += 3;
        state.hp = Math.min(state.maxHp, state.hp + 2);
        spawnWave(state, rng);
        state.effects.push({ pos: { ...state.head }, text: `WAVE ${state.wave}/${WAVES_PER_ROUND}`, ttl: 1000 });
        events.push({ type: "wave", wave: state.wave });
      } else {
        state.phase = "formation";
        state.pendingSeeds += 10 + state.round;
        events.push({ type: "roundClear" });
      }
    }

    return { state, events, alive: true };
  }

  return {
    vectors, TICK_MS, WAVES_PER_ROUND, key, manhattan, roundSize,
    randomOpen, spawnWave, spawnRound, addDrop, damage, nearestEnemy,
    openEnemyCell, stepToward, closestBodyTarget, meleeTargetCell, stepAway,
    collect, takeDamage, step
  };
});
