// Pure read models for browser panels, headless clients, and bots.
(function attachQueries(root, factory) {
  const req = typeof require === "function" ? require : null;
  const api = factory(
    req ? req("./config.js") : root.IdleSnakeConfig,
    req ? req("./economy.js") : root.IdleSnakeEconomy,
    req ? req("./notables.js") : root.IdleSnakeNotables,
    req ? req("./migration.js") : root.IdleSnakeMigration,
    req ? req("./trade-routes.js") : root.IdleSnakeTradeRoutes,
    req ? req("./snake.js") : root.IdleSnakeSnake
  );
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.IdleSnakeQueries = api;
})(typeof window !== "undefined" ? window : globalThis, (config, economy, notables, migration, tradeRoutes, snake) => {
  function isFounding(snapshot) {
    return snapshot.migration?.settlements.find((item) => item.id === snapshot.migration.activeSettlementId)?.status === "founding";
  }
  function habitatPanel(snapshot) {
    const { habitats, nursery, provisions, branches } = snapshot;
    const foodValue = economy.foodValueFromUpgrades(snapshot.upgrades);
    const activation = economy.calculateHabitatActivation(habitats.counts, foodValue, snapshot.notables, habitats.upgradeLevels, { activateAllOverCapacity: provisions > 0 });
    const fullActivation = economy.calculateHabitatActivation(habitats.counts, foodValue, snapshot.notables, habitats.upgradeLevels, { activateAllOverCapacity: true });
    const seedIncomeMultiplier = economy.lengthBonus(snapshot).multiplier;
    return {
      activation, fullActivation,
      seedIncomeMultiplier, seedIncomePerSecond: activation.incomePerSecond * seedIncomeMultiplier,
      nextHabitat: (() => {
        const index = config.habitatConfig.habitats.findIndex((_, i) => !economy.habitatUnlocked(habitats.counts, i));
        return index < 0 ? null : { index, previousIndex: index - 1, snakesNeeded: Math.max(0, config.habitatConfig.unlockPreviousSnakes - habitats.counts[index - 1]) };
      })(),
      availableSnakes: Math.floor(nursery.colonyCount), placedSnakes: habitats.counts.reduce((a, b) => a + b, 0),
      habitats: config.habitatConfig.habitats.map((habitat, index) => {
        const count = habitats.counts[index]; const unlocked = economy.habitatUnlocked(habitats.counts, index);
        const workingSnakes = activation.activeCounts[index];
        const notable = activation.leaders[index];
        const upgradeCost = economy.habitatUpgradeCost(habitat, habitats.upgradeLevels[index]);
        const hardCapacity = activation.hardCapacities[index];
        return {
          count, unlocked, visible: unlocked || count > 0, legacyOccupied: !unlocked && count > 0, hardCapacity, upgradeCost,
          multiplier: economy.habitatMultiplier(habitat, count),
          nextMilestone: habitat.milestones.find((item) => count < item.score),
          overCapacity: Math.max(0, count - habitat.naturalCapacity), idleSnakes: activation.idleCounts[index],
          eggHatchReduction: Math.min(config.nurseryConfig.eggHatchMs / 1000, workingSnakes * (habitat.eggHatchReductionSeconds || 0)),
          seedRate: activation.habitatSeedOutputs[index] * seedIncomeMultiplier, branchRate: activation.habitatBranchOutputs[index],
          provisionRate: activation.habitatProvisionOutputs[index],
          foragerRate: notable?.powerType === "FORAGER" && notables.isForagerEligible(habitat) ? activation.habitatSeedOutputs[index] * notable.powerMagnitude : 0,
          notableEffectRates: economy.notableContributionRates(activation, index, habitats.upgradeLevels, habitats.counts, seedIncomeMultiplier),
          provisionsUse: activation.activeOverCapacityCounts[index] * activation.upkeepPerSnakeRates[index] * config.habitatConfig.income.overCapacityProvisionCost * activation.consumptionMultipliers[index],
          notable,
          canAssign: !isFounding(snapshot) && unlocked && nursery.colonyCount >= 1 && count < hardCapacity,
          canUpgrade: !isFounding(snapshot) && unlocked && branches >= upgradeCost
        };
      })
    };
  }
  function nurseryPanel(snapshot) {
    const n = snapshot.nursery; const capacity = economy.nurseryCapacity(n);
    const nestCapacity = economy.nestCapacity(n); const nestCost = economy.nestUpgradeCost(n.nestLevel);
    const cost = economy.nurseryUpgradeCost(n.nurseryLevel);
    const eggHatchDuration = n.eggHatchDurationMs ?? config.nurseryConfig.eggHatchMs;
    const remainingMs = n.eggElapsedMs == null ? null : Math.max(0, eggHatchDuration - n.eggElapsedMs);
    const extraEggs = n.nestEggs || []; const activeCount = n.hatchlings.length;
    const eggHeld = (n.eggElapsedMs !== null && n.eggElapsedMs >= eggHatchDuration || extraEggs.some((egg) => egg.elapsedMs >= egg.hatchDurationMs)) && activeCount >= capacity;
    const primaryHatching = remainingMs !== null && remainingMs > 0;
    const hatching = !eggHeld && (primaryHatching || extraEggs.some((egg) => egg.elapsedMs < egg.hatchDurationMs));
    const nestMaxed = nestCapacity >= config.nurseryConfig.upgrades.nest.maxSlots;
    return {
      capacity, nestCapacity, nestCost, nurseryBranchCost: cost.branches, nurserySeedCost: cost.seeds,
      eggHatchDuration, remainingMs, eggHatchReduction: Math.max(0, (config.nurseryConfig.eggHatchMs - eggHatchDuration) / 1000),
      activeCount, eggRequirement: economy.eggRequirement(n), eggProgress: Math.min(economy.eggRequirement(n), n.eggProgress || 0),
      extraEggs, eggHeld, primaryHatching, hatching, nestMaxed,
      canUpgradeNest: !isFounding(snapshot) && !nestMaxed && snapshot.branches >= nestCost,
      canUpgradeNursery: !isFounding(snapshot) && snapshot.branches >= cost.branches && snapshot.seeds >= cost.seeds,
      feedingPaused: false,
      growthPaused: false,
      provisionsPerSecond: economy.calculateHabitatActivation(snapshot.habitats.counts, economy.foodValueFromUpgrades(snapshot.upgrades), snapshot.notables, snapshot.habitats.upgradeLevels).provisionsProducedPerSecond
    };
  }
  function upgradePanel(snapshot) {
    return Object.fromEntries(Object.entries(config.upgradeConfig).map(([kind, item]) => {
      const level = snapshot.upgrades[`${kind}Level`];
      const maxLevel = Number.isInteger(item.maxLevel) ? item.maxLevel : item.levels?.length - 1;
      const maxed = Number.isFinite(maxLevel) && level >= maxLevel;
      const cost = maxed ? null : Math.ceil(item.baseCost * item.costRatio ** level);
      const unavailableWhileFounding = kind === "minigames" && isFounding(snapshot);
      const eggChances = kind === "eggChance" ? {
        chance: snake.eggSpawnChance(snapshot.upgrades),
        nextChance: snake.eggSpawnChance({ ...snapshot.upgrades, eggChanceLevel: level + 1 })
      } : {};
      return [kind, { level, maxed, cost, unavailableWhileFounding, canBuy: !maxed && !unavailableWhileFounding && snapshot.seeds >= cost, ...eggChances }];
    }));
  }
  function capabilities(snapshot) {
    return {
      minigames: Array.from({ length: snapshot.upgrades.minigamesLevel + 1 }, (_, index) => index),
      canRecruit: !isFounding(snapshot) && snapshot.nursery.colonyCount >= config.notableConfig.directRecruitmentCost && !snapshot.notableRosterOverCapacity,
      tradeUnlocked: snapshot.migration.settlements.length >= 2,
      founding: Boolean(isFounding(snapshot))
    };
  }
  function foodInfo(snapshot) {
    return { type: config.upgradeConfig.foodType.levels[snapshot.upgrades.foodTypeLevel], count: config.upgradeConfig.foodCount.baseCount + snapshot.upgrades.foodCountLevel };
  }
  function tradeConstruction(snapshot, aId, bId) {
    const settlements = snapshot.migration.settlements;
    const a = settlements.find((item) => item.id === aId && item.status === "established");
    const b = settlements.find((item) => item.id === bId && item.status === "established");
    const cost = tradeRoutes.constructionCost();
    const exists = snapshot.tradeRoutes.some((route) => [route.settlementAId, route.settlementBId].sort().join("::") === [aId, bId].sort().join("::"));
    const funded = (settlement) => settlement?.economy?.seeds >= cost.seeds && settlement?.economy?.branches >= cost.branches;
    return { cost, exists, canConstruct: Boolean(a && b && a.id !== b.id && !exists && funded(a) && funded(b)) };
  }
  function exactOptionLosses(manifest, option) {
    const remaining = { ...manifest }; const losses = {};
    [option.cost, option.penalty].forEach((change) => Object.entries(change || {}).forEach(([resource, amount]) => {
      const minimum = resource === "adults" || resource === "provisions" ? 1 : 0;
      const lost = Math.min(Math.max(0, Number(amount) || 0), Math.max(0, (Number(remaining[resource]) || 0) - minimum));
      remaining[resource] = Math.max(minimum, (Number(remaining[resource]) || 0) - lost);
      losses[resource] = (losses[resource] || 0) + lost;
    }));
    return losses;
  }
  function migrationPreview(snapshot, manifest, notableId, destination) {
    const m = snapshot.migration; const home = m.settlements.find((item) => item.id === "grasslands");
    const notable = home?.economy?.notables?.retained?.find((item) => item.id === notableId);
    const cost = migration.calculateCost(manifest); const success = migration.calculateSuccess(manifest, notable);
    const claimed = new Set([...m.settlements.map((item) => String(item.region || item.name).toLowerCase()), ...m.activeExpeditions.map((item) => String(item.destination).toLowerCase())]);
    const destinationAvailable = config.migrationConfig.destinations.includes(destination) && !claimed.has(destination.toLowerCase());
    return { notable, cost, success, adultRate: migration.attritionRate("adults", success) * 100, provisionRate: migration.attritionRate("provisions", success) * 100,
      canDepart: home?.status === "established" && Boolean(notable) && destinationAvailable && manifest.adults >= config.migrationConfig.requirements.adults && manifest.provisions >= config.migrationConfig.requirements.provisions && cost <= m.availablePoints };
  }
  // Fullscreen is a display preference. It is available from a new save, without an upgrade.
  function fullscreenAvailable() {
    return true;
  }
  function minigameOptions(snapshot) {
    return config.minigameCatalog.map((game, index) => {
      const runnerShortcut = index === 8 && snapshot.mode === "duel";
      return { ...game, number: index + 1, unlocked: runnerShortcut || index < snapshot.upgrades.minigamesLevel,
        ...(runnerShortcut ? { mode: "runner", name: "Snake Runner" } : {}) };
    });
  }
  return { minigameOptions, fullscreenAvailable, isFounding, habitatPanel, nurseryPanel, upgradePanel, exactOptionLosses, migrationPreview, capabilities, foodInfo, tradeConstruction };
});
