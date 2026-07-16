// Headless idle economy: seeds, nursery/eggs, habitats, offline production.
//
// Pure and dt-driven — every mechanic advances from a passed `dtMs`, so the
// same code runs one frame at a time (live) or one huge step (offline catch-up)
// with no wall clock. No DOM, no localStorage, no `Date.now()` inside the sim.
// Ports game.js `advanceNursery`/`updateNursery`/`updateHabitatIncome` and the
// habitat income helpers, lifting their inline save/HUD side-effects out into a
// returned `events` array (see snakebird-engine.js for the shape convention).
(function attachEconomy(root, factory) {
  const engine = factory(
    typeof require === "function" ? require("./config.js") : (root.IdleSnakeConfig || {})
  );
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeEconomy = engine;
  else root.IdleSnakeEconomy = engine;
})(typeof window !== "undefined" ? window : globalThis, (config) => {
  const { nurseryConfig, habitatConfig, upgradeConfig } = config;

  const vectors = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  // Round seeds the way game.js does (4dp) so income accrual matches exactly.
  function roundSeeds(value) {
    return Math.round(value * 10000) / 10000;
  }

  function foodValueFromUpgrades(upgrades) {
    const level = clampNumber(upgrades && upgrades.foodTypeLevel, 0, upgradeConfig.foodType.levels.length - 1, 0);
    return upgradeConfig.foodType.levels[Math.floor(level)].value;
  }

  // ---- Nursery normalization -------------------------------------------------

  // Egg progress is stored as an accumulator (`eggElapsedMs`) rather than the
  // legacy absolute `nestStartedAt` timestamp, so the sim never reads a clock.
  // `deserialize` converts old saves given the host's `now`.
  function createNursery(saved, now) {
    saved = saved && typeof saved === "object" ? saved : {};
    const hatchlings = Array.isArray(saved.hatchlings)
      ? saved.hatchlings.slice(0, nurseryConfig.capacity).map((raw, index) => ({
          id: typeof raw.id === "string" ? raw.id : `hatchling-${index}`,
          x: clampNumber(raw.x, 0, nurseryConfig.columns - 1, index === 0 ? 2 : nurseryConfig.columns - 3),
          y: clampNumber(raw.y, 0, nurseryConfig.rows - 1, index === 0 ? 4 : nurseryConfig.rows - 5),
          direction: vectors[raw.direction] ? raw.direction : (index % 2 === 0 ? "right" : "left"),
          progressMs: clampNumber(raw.progressMs, 0, nurseryConfig.growthMs, 0)
        }))
      : [];

    let eggElapsedMs = null;
    if (Number.isFinite(Number(saved.eggElapsedMs)) && Number(saved.eggElapsedMs) >= 0) {
      eggElapsedMs = clampNumber(saved.eggElapsedMs, 0, nurseryConfig.eggHatchMs, 0);
    } else if (Number.isFinite(Number(saved.nestStartedAt)) && Number(saved.nestStartedAt) > 0) {
      // Legacy save: derive elapsed from the timestamp and the host clock.
      const base = Number.isFinite(Number(now)) ? Number(now) : Number(saved.lastUpdatedAt) || Number(saved.nestStartedAt);
      eggElapsedMs = clampNumber(base - Number(saved.nestStartedAt), 0, nurseryConfig.eggHatchMs, 0);
    }

    return {
      eggElapsedMs,
      hatchlings,
      colonyCount: clampNumber(saved.colonyCount, 0, Number.MAX_SAFE_INTEGER, 0),
      seedTickAccumulatorMs: clampNumber(saved.seedTickAccumulatorMs, 0, nurseryConfig.seedIntervalMs, 0),
      movementAccumulatorMs: clampNumber(saved.movementAccumulatorMs, 0, nurseryConfig.moveIntervalMs, 0)
    };
  }

  function createHabitats(saved) {
    saved = saved && typeof saved === "object" ? saved : {};
    const savedCounts = Array.isArray(saved.counts) ? saved.counts : [];
    return {
      counts: habitatConfig.habitats.map((_, index) =>
        Math.floor(clampNumber(savedCounts[index], 0, Number.MAX_SAFE_INTEGER, 0)))
    };
  }

  function createHatchling(hatchlings, rng) {
    const index = hatchlings.length;
    return {
      id: `hatchling-${Math.floor(rng() * 1e9).toString(36)}`,
      x: index === 0 ? 2 : nurseryConfig.columns - 3,
      y: index === 0 ? 4 : nurseryConfig.rows - 5,
      direction: index % 2 === 0 ? "right" : "left",
      progressMs: 0
    };
  }

  function hatchlingLength(progressMs) {
    if (progressMs >= nurseryConfig.threeBlockMs) return 3;
    if (progressMs >= nurseryConfig.twoBlockMs) return 2;
    return 1;
  }

  function moveHatchlings(nursery, rng) {
    nursery.hatchlings.forEach((hatchling) => {
      const choices = Object.keys(vectors).filter((directionName) => {
        const vector = vectors[directionName];
        const point = { x: hatchling.x + vector.x, y: hatchling.y + vector.y };
        return point.x >= 0 && point.x < nurseryConfig.columns && point.y >= 0 && point.y < nurseryConfig.rows;
      });
      if (choices.length === 0) return;

      const currentVector = vectors[hatchling.direction];
      const straight = currentVector
        ? { x: hatchling.x + currentVector.x, y: hatchling.y + currentVector.y }
        : null;
      const canContinue = straight && straight.x >= 0 && straight.x < nurseryConfig.columns &&
        straight.y >= 0 && straight.y < nurseryConfig.rows;
      if (!canContinue || rng() < 0.24) {
        hatchling.direction = choices[Math.floor(rng() * choices.length)];
      }

      const vector = vectors[hatchling.direction];
      hatchling.x = Math.max(0, Math.min(nurseryConfig.columns - 1, hatchling.x + vector.x));
      hatchling.y = Math.max(0, Math.min(nurseryConfig.rows - 1, hatchling.y + vector.y));
    });
  }

  // Port of game.js advanceNursery: burns seeds to grow hatchlings, graduates
  // them into the colony, and shuffles them around the pen. Mutates `nursery`
  // in place and returns the new seed total plus a `changed` flag.
  function advanceNursery(nursery, seeds, deltaMs, rng) {
    if (deltaMs <= 0) return { seeds, changed: false };
    let changed = false;

    if (nursery.hatchlings.length === 0) {
      nursery.seedTickAccumulatorMs = 0;
      nursery.movementAccumulatorMs = 0;
      return { seeds, changed: false };
    }

    nursery.seedTickAccumulatorMs += deltaMs;
    while (nursery.seedTickAccumulatorMs >= nurseryConfig.seedIntervalMs && nursery.hatchlings.length > 0) {
      const activeCount = nursery.hatchlings.length;
      if (seeds < activeCount) {
        nursery.seedTickAccumulatorMs = 0;
        break;
      }
      seeds -= activeCount;
      nursery.seedTickAccumulatorMs -= nurseryConfig.seedIntervalMs;
      nursery.hatchlings.forEach((hatchling) => {
        hatchling.progressMs = Math.min(nurseryConfig.growthMs, hatchling.progressMs + nurseryConfig.seedIntervalMs);
      });
      changed = true;

      const graduates = nursery.hatchlings.filter((h) => h.progressMs >= nurseryConfig.growthMs);
      if (graduates.length > 0) {
        nursery.colonyCount += graduates.length;
        nursery.hatchlings = nursery.hatchlings.filter((h) => h.progressMs < nurseryConfig.growthMs);
        changed = true;
      }
    }

    if (nursery.hatchlings.length === 0) {
      nursery.seedTickAccumulatorMs = 0;
      nursery.movementAccumulatorMs = 0;
      return { seeds, changed };
    }

    nursery.movementAccumulatorMs += deltaMs;
    let moveCount = 0;
    while (nursery.movementAccumulatorMs >= nurseryConfig.moveIntervalMs && moveCount < 48) {
      moveHatchlings(nursery, rng);
      nursery.movementAccumulatorMs -= nurseryConfig.moveIntervalMs;
      moveCount += 1;
      changed = true;
    }

    return { seeds, changed };
  }

  // dt-driven port of game.js updateNursery: advances the egg accumulator and,
  // when it crosses eggHatchMs, hatches once and splits growth around the hatch
  // instant (existing hatchlings get the pre-hatch slice; the newborn only the
  // remainder) — matching the original wall-clock boundary split.
  function tickNursery(nursery, seeds, dtMs, rng) {
    const events = [];
    if (dtMs <= 0) return { seeds, events };

    if (nursery.eggElapsedMs !== null) {
      const remaining = nurseryConfig.eggHatchMs - nursery.eggElapsedMs;
      if (dtMs >= remaining) {
        ({ seeds } = advanceNursery(nursery, seeds, remaining, rng));
        if (nursery.hatchlings.length < nurseryConfig.capacity) {
          nursery.hatchlings.push(createHatchling(nursery.hatchlings, rng));
          events.push({ type: "hatch" });
        }
        nursery.eggElapsedMs = null;
        nursery.seedTickAccumulatorMs = 0;
        ({ seeds } = advanceNursery(nursery, seeds, dtMs - remaining, rng));
        return { seeds, events };
      }
      nursery.eggElapsedMs += dtMs;
    }

    ({ seeds } = advanceNursery(nursery, seeds, dtMs, rng));
    return { seeds, events };
  }

  function layEgg(state) {
    const nursery = state.nursery;
    if (nursery.eggElapsedMs !== null ||
        nursery.hatchlings.length >= nurseryConfig.capacity ||
        state.seeds < nurseryConfig.eggCost) {
      return { accepted: false };
    }
    nursery.eggElapsedMs = 0;
    nursery.seedTickAccumulatorMs = 0;
    nursery.movementAccumulatorMs = 0;
    state.seeds -= nurseryConfig.eggCost;
    return { accepted: true, events: [{ type: "seedsChanged" }] };
  }

  // ---- Habitat income --------------------------------------------------------

  function habitatMultiplier(habitat, snakeCount) {
    return habitat.milestones.reduce((multiplier, milestone) => {
      if (snakeCount < milestone.score) return multiplier;
      return habitatConfig.income.milestoneMode === "multiply"
        ? multiplier * milestone.multiplier
        : Math.max(multiplier, milestone.multiplier);
    }, 1);
  }

  function habitatIncomePerSecond(habitat, snakeCount, foodValue) {
    const foodMultiplier = habitatConfig.income.foodValueMultiplier ? foodValue : 1;
    return habitatConfig.income.basePerSecond
      * habitat.incomeMultiplier
      * foodMultiplier
      * habitatMultiplier(habitat, snakeCount);
  }

  function totalHabitatIncomePerSecond(counts, foodValue) {
    return habitatConfig.habitats.reduce((total, habitat, index) =>
      total + counts[index] * habitatIncomePerSecond(habitat, counts[index], foodValue), 0);
  }

  function tickHabitats(state, dtMs, foodValue) {
    if (dtMs <= 0) return { events: [] };
    const income = totalHabitatIncomePerSecond(state.habitats.counts, foodValue) * dtMs / 1000;
    if (income > 0) {
      state.seeds = roundSeeds(state.seeds + income);
      return { events: [{ type: "seedsChanged" }] };
    }
    return { events: [] };
  }

  // ---- Unified economy tick --------------------------------------------------

  // Advances every idle system by the same dtMs and returns accumulated events.
  // `ctx` supplies the current food value (from upgrades) and an rng seam.
  function tickEconomy(state, dtMs, ctx) {
    ctx = ctx || {};
    const rng = ctx.rng || Math.random;
    const foodValue = ctx.foodValue != null ? ctx.foodValue : foodValueFromUpgrades(state.upgrades);
    const events = [];

    const nurseryResult = tickNursery(state.nursery, state.seeds, dtMs, rng);
    state.seeds = nurseryResult.seeds;
    events.push(...nurseryResult.events);

    const habitatResult = tickHabitats(state, dtMs, foodValue);
    events.push(...habitatResult.events);

    return { state, events };
  }

  return {
    vectors,
    clampNumber,
    roundSeeds,
    foodValueFromUpgrades,
    createNursery,
    createHabitats,
    createHatchling,
    hatchlingLength,
    moveHatchlings,
    advanceNursery,
    tickNursery,
    layEgg,
    habitatMultiplier,
    habitatIncomePerSecond,
    totalHabitatIncomePerSecond,
    tickHabitats,
    tickEconomy
  };
});
