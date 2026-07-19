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
    typeof require === "function" ? require("./config.js") : (root.IdleSnakeConfig || {}),
    typeof require === "function" ? require("./notables.js") : root.IdleSnakeNotables
  );
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
  if (typeof window !== "undefined") window.IdleSnakeEconomy = engine;
  else root.IdleSnakeEconomy = engine;
})(typeof window !== "undefined" ? window : globalThis, (config, notables) => {
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
      ? saved.hatchlings.slice(0, 64).map((raw, index) => ({
          id: typeof raw.id === "string" ? raw.id : `hatchling-${index}`,
          x: clampNumber(raw.x, 0, nurseryConfig.columns - 1, index === 0 ? 2 : nurseryConfig.columns - 3),
          y: clampNumber(raw.y, 0, nurseryConfig.rows - 1, index === 0 ? 4 : nurseryConfig.rows - 5),
          direction: vectors[raw.direction] ? raw.direction : (index % 2 === 0 ? "right" : "left"),
          progressMs: clampNumber(raw.progressMs, 0, nurseryConfig.growthMs, 0),
          temporary: Boolean(raw.temporary)
        }))
      : [];

    let eggElapsedMs = null;
    // saved.eggElapsedMs is explicitly `null` while the nest is empty (Number(null)
    // is 0, which is finite and >= 0, so it must be excluded before the coercion
    // check below or an empty nest resurrects a phantom egg at elapsed=0 on every
    // save round-trip).
    if (saved.eggElapsedMs !== null && Number.isFinite(Number(saved.eggElapsedMs)) && Number(saved.eggElapsedMs) >= 0) {
      eggElapsedMs = clampNumber(saved.eggElapsedMs, 0, nurseryConfig.eggHatchMs, 0);
    } else if (Number.isFinite(Number(saved.nestStartedAt)) && Number(saved.nestStartedAt) > 0) {
      // Legacy save: derive elapsed from the timestamp and the host clock.
      const base = Number.isFinite(Number(now)) ? Number(now) : Number(saved.lastUpdatedAt) || Number(saved.nestStartedAt);
      eggElapsedMs = clampNumber(base - Number(saved.nestStartedAt), 0, nurseryConfig.eggHatchMs, 0);
    }

    return {
      nestLevel: Math.floor(clampNumber(saved.nestLevel, 0, Number.MAX_SAFE_INTEGER, 0)),
      nurseryLevel: Math.floor(clampNumber(saved.nurseryLevel, 0, Number.MAX_SAFE_INTEGER, 0)),
      nestEggs: Array.isArray(saved.nestEggs) ? saved.nestEggs.slice(0, 64).map((egg) => ({
        elapsedMs: clampNumber(egg.elapsedMs, 0, nurseryConfig.eggHatchMs, 0),
        hatchDurationMs: clampNumber(egg.hatchDurationMs, 0, nurseryConfig.eggHatchMs, nurseryConfig.eggHatchMs)
      })) : [],
      resupplyEggHolding: Math.floor(clampNumber(saved.resupplyEggHolding, 0, Number.MAX_SAFE_INTEGER, 0)),
      eggElapsedMs,
      eggHatchDurationMs: clampNumber(saved.eggHatchDurationMs, 0, nurseryConfig.eggHatchMs, nurseryConfig.eggHatchMs),
      eggProgress: clampNumber(saved.eggProgress, 0, Number.MAX_SAFE_INTEGER, 0),
      eggsStarted: Math.floor(clampNumber(saved.eggsStarted, 0, Number.MAX_SAFE_INTEGER, 0)),
      hatchlings,
      colonyCount: clampNumber(saved.colonyCount, 0, Number.MAX_SAFE_INTEGER, 0),
      seedTickAccumulatorMs: clampNumber(saved.seedTickAccumulatorMs, 0, nurseryConfig.seedIntervalMs, 0),
      movementAccumulatorMs: clampNumber(saved.movementAccumulatorMs, 0, nurseryConfig.moveIntervalMs, 0)
    };
  }

  function nestUpgradeCost(level) {
    const upgrade = nurseryConfig.upgrades.nest;
    return Math.ceil(upgrade.branchBaseCost * upgrade.costRatio ** Math.max(0, Math.floor(Number(level) || 0)));
  }

  function nurseryUpgradeCost(level) {
    const upgrade = nurseryConfig.upgrades.nursery;
    const normalizedLevel = Math.max(0, Math.floor(Number(level) || 0));
    return {
      branches: Math.ceil(upgrade.branchBaseCost * upgrade.costRatio ** normalizedLevel),
      seeds: Math.ceil(upgrade.seedBaseCost * upgrade.costRatio ** normalizedLevel)
    };
  }

  function nestCapacity(nursery) {
    const upgrade = nurseryConfig.upgrades.nest;
    return Math.min(upgrade.maxSlots, 1 + Math.max(0, Math.floor(Number(nursery && nursery.nestLevel) || 0)) * upgrade.slotsPerLevel);
  }

  function nurseryCapacity(nursery) {
    return nurseryConfig.capacity + Math.max(0, Math.floor(Number(nursery && nursery.nurseryLevel) || 0)) * nurseryConfig.upgrades.nursery.capacityPerLevel;
  }

  function eggRequirement(nursery) {
    return Math.floor(nurseryConfig.eggCost * Math.pow(nurseryConfig.eggCostRatio, nursery.eggsStarted));
  }

  // An egg can begin as soon as the NEST is empty; the hatchling yard being full
  // does not block starting. Yard backpressure is applied at hatch time: a
  // finished egg holds in the nest (never discarded) until a slot frees.
  function canStartEgg(nursery) {
    return (nursery.eggElapsedMs === null ? 0 : 1) + nursery.nestEggs.length < nestCapacity(nursery);
  }

  // True when the nest holds an egg that has finished incubating but cannot hatch
  // yet because the yard is full (it is being held, not lost).
  function eggHeldForSpace(nursery) {
    return nursery.eggElapsedMs !== null &&
      nursery.eggElapsedMs >= nursery.eggHatchDurationMs &&
      nursery.hatchlings.length >= nurseryCapacity(nursery);
  }

  function startEgg(nursery, eggHatchDurationMs) {
    if (nursery.eggElapsedMs === null) {
      nursery.eggElapsedMs = 0;
      nursery.eggHatchDurationMs = eggHatchDurationMs;
    } else {
      nursery.nestEggs.push({ elapsedMs: 0, hatchDurationMs: eggHatchDurationMs });
    }
    nursery.eggProgress = 0;
    nursery.eggsStarted += 1;
    nursery.seedTickAccumulatorMs = 0;
    nursery.movementAccumulatorMs = 0;
  }

  // Spending does not reverse egg progress. When the nursery is unavailable,
  // progress is capped at one completed egg instead of becoming a queue.
  function creditEggProgress(state, amount) {
    const earned = Math.max(0, Number(amount) || 0);
    if (!earned) return [];
    const nursery = state.nursery;
    nursery.eggProgress = Math.min(eggRequirement(nursery), nursery.eggProgress + earned);
    return tryStartEgg(state);
  }

  function tryStartEgg(state) {
    const nursery = state.nursery;
    if (nursery.eggProgress < eggRequirement(nursery) || !canStartEgg(nursery)) return [];
    const activation = calculateHabitatActivation(
      state.habitats.counts, foodValueFromUpgrades(state.upgrades), state.notables, state.habitats.upgradeLevels);
    const reductionMs = activation.eggHatchReductionSeconds * 1000;
    startEgg(nursery, Math.max(0, nurseryConfig.eggHatchMs - reductionMs));
    return [{ type: "eggStarted" }];
  }

  function reconcileEggProgress(state, previousSeeds) {
    return creditEggProgress(state, state.seeds - previousSeeds);
  }

  function createHabitats(saved) {
    saved = saved && typeof saved === "object" ? saved : {};
    const savedCounts = Array.isArray(saved.counts) ? saved.counts : [];
    const savedUpgradeLevels = Array.isArray(saved.upgradeLevels) ? saved.upgradeLevels : [];
    return {
      counts: habitatConfig.habitats.map((_, index) =>
        Math.floor(clampNumber(savedCounts[index], 0, Number.MAX_SAFE_INTEGER, 0))),
      upgradeLevels: habitatConfig.habitats.map((_, index) =>
        Math.floor(clampNumber(savedUpgradeLevels[index], 0, Number.MAX_SAFE_INTEGER, 0)))
    };
  }

  function createHatchling(hatchlings, rng, capacity) {
    const index = hatchlings.length;
    return {
      id: `hatchling-${Math.floor(rng() * 1e9).toString(36)}`,
      x: index === 0 ? 2 : nurseryConfig.columns - 3,
      y: index === 0 ? 4 : nurseryConfig.rows - 5,
      direction: index % 2 === 0 ? "right" : "left",
      progressMs: 0,
      temporary: index >= (capacity == null ? nurseryConfig.capacity : capacity)
    };
  }

  function hatchlingLength(progressMs) {
    if (progressMs >= nurseryConfig.threeBlockMs) return 3;
    if (progressMs >= nurseryConfig.twoBlockMs) return 2;
    return 1;
  }

  // Egg-board pickups hatch immediately. Existing nursery space is used first;
  // hatchlings beyond the normal capacity are temporary overflow occupants.
  function addEggBoardHatchling(state, rng) {
    const hatchling = createHatchling(state.nursery.hatchlings, rng, nurseryCapacity(state.nursery));
    state.nursery.hatchlings.push(hatchling);
    return { type: "eggBoardHatched", temporary: hatchling.temporary };
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
    // Transported eggs wait safely off-nest, then enter incubation as actual
    // nest slots become available. They are never discarded for lack of space.
    const occupiedSlots = () => (nursery.eggElapsedMs === null ? 0 : 1) + nursery.nestEggs.length;
    while (nursery.resupplyEggHolding > 0 && occupiedSlots() < nestCapacity(nursery)) {
      nursery.nestEggs.push({ elapsedMs: 0, hatchDurationMs: nurseryConfig.eggHatchMs });
      nursery.resupplyEggHolding -= 1;
    }
    // Extra nest slots incubate independently. Finished eggs stay in their
    // slot until there is nursery-yard space, just like the original slot.
    nursery.nestEggs = nursery.nestEggs.filter((egg) => {
      egg.elapsedMs = Math.min(egg.hatchDurationMs, egg.elapsedMs + dtMs);
      if (egg.elapsedMs < egg.hatchDurationMs || nursery.hatchlings.length >= nurseryCapacity(nursery)) return true;
      nursery.hatchlings.push(createHatchling(nursery.hatchlings, rng, nurseryCapacity(nursery)));
      events.push({ type: "eggHatched" });
      return false;
    });

    // Hatch the finished nest egg if the yard has a slot; never discard it.
    const hatchIfPossible = () => {
      if (nursery.eggElapsedMs === null || nursery.eggElapsedMs < nursery.eggHatchDurationMs) return;
      if (nursery.hatchlings.length >= nurseryCapacity(nursery)) return; // hold
      nursery.hatchlings.push(createHatchling(nursery.hatchlings, rng, nurseryCapacity(nursery)));
      events.push({ type: "hatch" });
      nursery.eggElapsedMs = null;
      nursery.seedTickAccumulatorMs = 0;
    };

    if (nursery.eggElapsedMs !== null) {
      const remaining = Math.max(0, nursery.eggHatchDurationMs - nursery.eggElapsedMs);
      if (dtMs >= remaining) {
        // Age hatchlings up to the hatch instant (may graduate one, freeing a
        // slot), attempt to hatch, then age the rest. If the yard was full the
        // egg holds at eggHatchMs; a graduation during the remaining time frees a
        // slot, so re-attempt the hatch afterwards rather than waiting a tick.
        ({ seeds } = advanceNursery(nursery, seeds, remaining, rng));
        nursery.eggElapsedMs = nursery.eggHatchDurationMs; // finished (held if full)
        hatchIfPossible();
        ({ seeds } = advanceNursery(nursery, seeds, dtMs - remaining, rng));
        hatchIfPossible();
        return { seeds, events };
      }
      nursery.eggElapsedMs += dtMs;
    }

    ({ seeds } = advanceNursery(nursery, seeds, dtMs, rng));
    return { seeds, events };
  }

  function layEgg() {
    // Compatibility shim for older callers; eggs now begin automatically.
    return { accepted: false, reason: "automatic" };
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

  function habitatUpgradeCost(habitat, level) {
    const normalizedLevel = Math.max(0, Math.floor(Number(level) || 0));
    return Math.ceil(habitat.upgradeCost * habitatConfig.upgrades.costRatio ** normalizedLevel);
  }

  function habitatBaseMaxCapacity(habitat, level) {
    const normalizedLevel = Math.max(0, Math.floor(Number(level) || 0));
    return habitat.hardCapacity + habitat.capacityPerUpgrade * normalizedLevel;
  }

  function habitatMaxCapacity(habitat, level, notable) {
    return notables.hardCapacity({ ...habitat, hardCapacity: habitatBaseMaxCapacity(habitat, level) }, notable);
  }

  // Assign provision-funded snakes in fair rows: each habitat gets at most one
  // activation before any habitat gets its next one. A snake is indivisible; if
  // its full per-second cost does not fit, it remains idle. Provision-producing
  // snakes add their output to the budget after they have been activated.
  function calculateHabitatActivation(counts, foodValue, notableState, upgradeLevels, options) {
    options = options || {};
    const normalizedCounts = habitatConfig.habitats.map((_, index) =>
      Math.max(0, Math.floor(Number(counts && counts[index]) || 0)));
    const leaders = habitatConfig.habitats.map((_, index) => notables.assignedTo(notableState, index));
    // Food value is a global Seed-only bonus. Branches, provisions, and the
    // provision cost of keeping a snake active all use the base habitat rate.
    const perSnakeRates = habitatConfig.habitats.map((habitat, index) =>
      habitatIncomePerSecond(habitat, normalizedCounts[index], 1));
    const seedPerSnakeRates = habitatConfig.habitats.map((habitat, index) =>
      habitatIncomePerSecond(habitat, normalizedCounts[index], foodValue));
    const productionMultipliers = leaders.map((leader) => leader?.powerType === "PRODUCTION_INCREASE" ? 1 + leader.powerMagnitude : 1);
    const consumptionMultipliers = leaders.map((leader) => leader?.powerType === "CONSUMPTION_REDUCTION" ? Math.max(0, 1 - leader.powerMagnitude) : 1);
    const rationerFloors = leaders.map((leader) => leader?.powerType === "RATIONER" ? leader.powerMagnitude : 0);
    const hardCapacities = habitatConfig.habitats.map((habitat, index) =>
      habitatMaxCapacity(habitat, upgradeLevels && upgradeLevels[index], leaders[index]));
    const naturalCounts = habitatConfig.habitats.map((habitat, index) =>
      Math.min(normalizedCounts[index], habitat.naturalCapacity));
    const overCapacityCounts = habitatConfig.habitats.map((habitat, index) =>
      Math.max(0, normalizedCounts[index] - habitat.naturalCapacity));
    const activeOverCapacityCounts = habitatConfig.habitats.map(() => 0);

    let provisionsProducedPerSecond = habitatConfig.habitats.reduce((total, habitat, index) =>
      total + (habitat.producesProvisions ? naturalCounts[index] * perSnakeRates[index] * productionMultipliers[index] : 0), 0);
    let provisionsConsumedPerSecond = 0;
    const epsilon = 1e-12;

    // A provision bank can keep every over-capacity snake working temporarily.
    // The caller is responsible for limiting that full activation to the period
    // the bank can actually fund.
    if (options.activateAllOverCapacity) {
      overCapacityCounts.forEach((count, index) => { activeOverCapacityCounts[index] = count; });
    } else while (true) {
      const candidates = habitatConfig.habitats
        .map((_, index) => index)
        .filter((index) => activeOverCapacityCounts[index] < overCapacityCounts[index]);
      if (candidates.length === 0) break;

      // If a complete row fits, batch as many identical complete rows as are
      // safe. This preserves round-robin ordering without looping once per snake
      // for very large late-game or malformed save counts.
      let prefixBudgetChange = 0;
      let requiredStartingBudget = 0;
      candidates.forEach((index) => {
        const habitat = habitatConfig.habitats[index];
        const cost = perSnakeRates[index] * habitatConfig.income.overCapacityProvisionCost * consumptionMultipliers[index];
        requiredStartingBudget = Math.max(requiredStartingBudget, cost - prefixBudgetChange);
        prefixBudgetChange += (habitat.producesProvisions ? perSnakeRates[index] * productionMultipliers[index] : 0) - cost;
      });
      const availableBudget = provisionsProducedPerSecond - provisionsConsumedPerSecond;
      if (availableBudget + epsilon >= requiredStartingBudget) {
        const rowsUntilExhausted = Math.min(...candidates.map((index) =>
          overCapacityCounts[index] - activeOverCapacityCounts[index]));
        const affordableRows = prefixBudgetChange >= -epsilon
          ? rowsUntilExhausted
          : Math.max(1, Math.floor((availableBudget - requiredStartingBudget + epsilon) / -prefixBudgetChange) + 1);
        const rows = Math.min(rowsUntilExhausted, affordableRows);
        candidates.forEach((index) => {
          const habitat = habitatConfig.habitats[index];
          const cost = perSnakeRates[index] * habitatConfig.income.overCapacityProvisionCost * consumptionMultipliers[index];
          activeOverCapacityCounts[index] += rows;
          provisionsConsumedPerSecond += rows * cost;
          if (habitat.producesProvisions) provisionsProducedPerSecond += rows * perSnakeRates[index] * productionMultipliers[index];
        });
        continue;
      }

      // The last affordable row may be a prefix. Stop at the first snake that
      // does not fit so no habitat can move into a later row while an earlier
      // eligible habitat is still waiting in this one.
      for (const index of candidates) {
        const habitat = habitatConfig.habitats[index];
        const cost = perSnakeRates[index] * habitatConfig.income.overCapacityProvisionCost * consumptionMultipliers[index];
        if (provisionsConsumedPerSecond + cost > provisionsProducedPerSecond + epsilon) break;
        activeOverCapacityCounts[index] += 1;
        provisionsConsumedPerSecond += cost;
        if (habitat.producesProvisions) provisionsProducedPerSecond += perSnakeRates[index] * productionMultipliers[index];
      }
      break;
    }

    const activeCounts = naturalCounts.map((count, index) => count + activeOverCapacityCounts[index]);
    const idleCounts = overCapacityCounts.map((count, index) => count - activeOverCapacityCounts[index]);
    // Recompute from the final allocation so the temporary bank-funded
    // all-active mode follows the same production and consumption rules.
    provisionsProducedPerSecond = habitatConfig.habitats.reduce((total, habitat, index) =>
      total + (habitat.producesProvisions ? activeCounts[index] * perSnakeRates[index] * productionMultipliers[index] : 0), 0);
    provisionsConsumedPerSecond = activeOverCapacityCounts.reduce((total, active, index) => {
      const habitat = habitatConfig.habitats[index];
      return total + active * perSnakeRates[index] * habitatConfig.income.overCapacityProvisionCost * consumptionMultipliers[index];
    }, 0);
    const outputCounts = activeCounts.map((count, index) => count + idleCounts[index] * rationerFloors[index]);
    const habitatSeedOutputs = habitatConfig.habitats.map((habitat, index) =>
      habitat.producesSeeds === false ? 0 : outputCounts[index] * seedPerSnakeRates[index] * productionMultipliers[index]);
    const habitatBranchOutputs = habitatConfig.habitats.map((habitat, index) =>
      habitat.producesBranches ? outputCounts[index] * perSnakeRates[index] * productionMultipliers[index] : 0);
    const incomePerSecond = habitatSeedOutputs.reduce((total, value) => total + value, 0);
    const branchesPerSecond = habitatBranchOutputs.reduce((total, value) => total + value, 0);
    const foragerProducedPerSecond = habitatConfig.habitats.reduce((total, habitat, index) => {
      const leader = leaders[index];
      return total + (leader?.powerType === "FORAGER" && notables.isForagerEligible(habitat) ? habitatSeedOutputs[index] * leader.powerMagnitude : 0);
    }, 0);
    const eggHatchReductionSeconds = habitatConfig.habitats.reduce((total, habitat, index) =>
      total + activeCounts[index] * (Number(habitat.eggHatchReductionSeconds) || 0), 0);

    return {
      activeCounts,
      activeOverCapacityCounts,
      idleCounts,
      overCapacityCounts,
      perSnakeRates,
      seedPerSnakeRates,
      leaders,
      hardCapacities,
      productionMultipliers,
      consumptionMultipliers,
      rationerFloors,
      habitatSeedOutputs,
      habitatBranchOutputs,
      incomePerSecond,
      branchesPerSecond,
      eggHatchReductionSeconds,
      provisionsProducedPerSecond,
      provisionsConsumedPerSecond,
      foragerProducedPerSecond
    };
  }

  function totalHabitatIncomePerSecond(counts, foodValue) {
    return calculateHabitatActivation(counts, foodValue).incomePerSecond;
  }

  // Sum of only the habitats flagged `producesProvisions`. This is the portion
  // of idle habitat income that also counts toward egg progress; the rest is
  // plain Seeds (income only).
  function totalProvisionsIncomePerSecond(counts, foodValue) {
    return calculateHabitatActivation(counts, foodValue).provisionsProducedPerSecond;
  }

  function tickHabitats(state, dtMs, foodValue) {
    if (dtMs <= 0) return { events: [] };
    const baselineActivation = calculateHabitatActivation(state.habitats.counts, foodValue, state.notables, state.habitats.upgradeLevels);
    const fullActivation = calculateHabitatActivation(
      state.habitats.counts, foodValue, state.notables, state.habitats.upgradeLevels, { activateAllOverCapacity: true });
    const startingProvisions = Math.max(0, Number(state.provisions) || 0);
    const fullDeficitPerSecond = fullActivation.provisionsConsumedPerSecond
      - fullActivation.provisionsProducedPerSecond - fullActivation.foragerProducedPerSecond;
    // Run all assigned snakes while the bank can cover the full-activation
    // deficit. Once exhausted, use the existing self-sustaining fair allocation.
    const bankedSeconds = startingProvisions > 0 && fullDeficitPerSecond > 0
      ? Math.min(dtMs / 1000, startingProvisions / fullDeficitPerSecond)
      : (fullDeficitPerSecond <= 0 ? dtMs / 1000 : 0);
    const segments = [];
    if (bankedSeconds > 0) segments.push({ activation: fullActivation, seconds: bankedSeconds });
    const remainingSeconds = dtMs / 1000 - bankedSeconds;
    if (remainingSeconds > 0) segments.push({ activation: baselineActivation, seconds: remainingSeconds });

    let income = 0;
    let branchIncome = 0;
    let provisionsIncome = 0;
    let spentProvisions = 0;
    let foragedProvisions = 0;
    segments.forEach(({ activation, seconds }) => {
      income += activation.incomePerSecond * seconds;
      branchIncome += activation.branchesPerSecond * seconds;
      provisionsIncome += activation.provisionsProducedPerSecond * seconds;
      spentProvisions += activation.provisionsConsumedPerSecond * seconds;
      foragedProvisions += activation.foragerProducedPerSecond * seconds;
      activation.leaders.forEach((leader, index) => {
      if (!leader) return;
      const baseActiveOutput = activation.activeCounts[index] * activation.perSnakeRates[index];
      const contributions = {};
      if (leader.powerType === "PRODUCTION_INCREASE") contributions.totalProductionAdded = baseActiveOutput * leader.powerMagnitude * seconds;
      if (leader.powerType === "CONSUMPTION_REDUCTION") {
        const baseCost = activation.activeOverCapacityCounts[index] * activation.perSnakeRates[index] * habitatConfig.income.overCapacityProvisionCost;
        contributions.totalConsumptionPrevented = baseCost * leader.powerMagnitude * seconds;
      }
      if (leader.powerType === "CAPACITY_INCREASE") {
        const upgradedBase = habitatBaseMaxCapacity(habitatConfig.habitats[index], state.habitats.upgradeLevels[index]);
        contributions.totalCapacityEnabled = Math.max(0, Math.min(state.habitats.counts[index], activation.hardCapacities[index]) - upgradedBase) * seconds;
      }
      if (leader.powerType === "FORAGER") contributions.totalProvisionsForaged = activation.habitatSeedOutputs[index] * leader.powerMagnitude * seconds;
      if (leader.powerType === "RATIONER") contributions.totalShortageOutputPreserved = activation.idleCounts[index] * activation.perSnakeRates[index] * leader.powerMagnitude * activation.productionMultipliers[index] * seconds;
        notables.recordContribution(state.notables, leader.id, index, seconds * 1000, contributions);
      });
    });
    state.provisions = roundSeeds(Math.max(0, startingProvisions + provisionsIncome - spentProvisions + foragedProvisions));
    state.branches = roundSeeds(Math.max(0, (Number(state.branches) || 0) + branchIncome));
    if (income > 0) {
      state.seeds = roundSeeds(state.seeds + income);
      return { income, branchIncome, provisionsIncome, foragedProvisions, events: [{ type: "seedsChanged" }] };
    }
    return { income: 0, branchIncome, provisionsIncome: 0, foragedProvisions, events: branchIncome > 0 ? [{ type: "branchesChanged" }] : [] };
  }

  // ---- Unified economy tick --------------------------------------------------

  // Advances every idle system by the same dtMs and returns accumulated events.
  // `ctx` supplies the current food value (from upgrades) and an rng seam.
  function tickEconomy(state, dtMs, ctx) {
    ctx = ctx || {};
    const rng = ctx.rng || Math.random;
    const foodValue = ctx.foodValue != null ? ctx.foodValue : foodValueFromUpgrades(state.upgrades);
    const events = [];

    // Split passive time at egg thresholds. This lets an offline catch-up begin
    // incubation at the moment its passive income reaches the requirement,
    // rather than incorrectly waiting until the end of a long catch-up.
    let remainingMs = Math.max(0, Number(dtMs) || 0);
    let guard = 0;
    while (remainingMs > 0 && guard < 10000) {
      events.push(...tryStartEgg(state));
      // Slice at the moment PROVISIONS income (not total habitat income) would
      // complete the current egg, since only provisions contribute to it.
      const activation = calculateHabitatActivation(state.habitats.counts, foodValue, state.notables, state.habitats.upgradeLevels);
      const provisionsPerSecond = activation.provisionsProducedPerSecond;
      const needed = eggRequirement(state.nursery) - state.nursery.eggProgress;
      const canAccrue = provisionsPerSecond > 0 && needed > 0;
      const untilEggMs = canAccrue ? Math.max(1, needed / provisionsPerSecond * 1000) : Infinity;
      const sliceMs = Math.min(remainingMs, untilEggMs);

      const nurseryResult = tickNursery(state.nursery, state.seeds, sliceMs, rng);
      state.seeds = nurseryResult.seeds;
      events.push(...nurseryResult.events);
      const habitatResult = tickHabitats(state, sliceMs, foodValue);
      events.push(...habitatResult.events);
      events.push(...creditEggProgress(state, habitatResult.provisionsIncome));
      remainingMs -= sliceMs;
      guard += 1;
    }

    events.push(...tryStartEgg(state));

    return { state, events };
  }

  return {
    vectors,
    clampNumber,
    roundSeeds,
    foodValueFromUpgrades,
    createNursery,
    nestUpgradeCost,
    nurseryUpgradeCost,
    nestCapacity,
    nurseryCapacity,
    createHabitats,
    createHatchling,
    addEggBoardHatchling,
    eggRequirement,
    canStartEgg,
    eggHeldForSpace,
    creditEggProgress,
    reconcileEggProgress,
    tryStartEgg,
    hatchlingLength,
    moveHatchlings,
    advanceNursery,
    tickNursery,
    layEgg,
    habitatMultiplier,
    habitatIncomePerSecond,
    habitatUpgradeCost,
    habitatBaseMaxCapacity,
    habitatMaxCapacity,
    calculateHabitatActivation,
    totalHabitatIncomePerSecond,
    totalProvisionsIncomePerSecond,
    tickHabitats,
    tickEconomy
  };
});
