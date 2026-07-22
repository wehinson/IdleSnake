// Permanent multi-settlement migration domain. Pure, deterministic, and DOM-free.
(function attachMigration(root, factory) {
  const api = factory(typeof require === "function" ? require("./config.js") : root.IdleSnakeConfig);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.IdleSnakeMigration = api;
  else root.IdleSnakeMigration = api;
})(typeof window !== "undefined" ? window : globalThis, (config) => {
  const cfg = config.migrationConfig;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const nonnegative = (value) => Math.max(0, Number(value) || 0);
  const integer = (value) => Math.max(0, Math.floor(Number(value) || 0));
  const historyInteger = (value) => Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number(value) || 0)));
  const roundPoints = (value) => Math.round(nonnegative(value) * 1000) / 1000;
  const historyLimit = Math.max(1, integer(config.historyRetentionConfig?.migrationPerOutcome) || 50);
  const upgradeDefaults = { boardLevel: 0, foodTypeLevel: 0, foodCountLevel: 0, shieldLevel: 0, minigamesLevel: 0 };
  function retainLatest(items) { return items.length > historyLimit ? items.slice(-historyLimit) : items; }
  function historyCount(savedTotal, items) { return Math.max(historyInteger(savedTotal), items.length); }
  function recordHistory(migration, key, totalKey, expedition) {
    migration[key].push(clone(expedition));
    migration.historyTotals[totalKey] = historyInteger(historyInteger(migration.historyTotals[totalKey]) + 1);
    if (migration[key].length > historyLimit) migration[key].splice(0, migration[key].length - historyLimit);
  }
  function normalizeUpgrades(raw) {
    return Object.fromEntries(Object.keys(upgradeDefaults).map((key) => [key, integer(raw?.[key])]));
  }

  function blankStats() {
    return { maxSnakeScore: 0, totalAdultsProduced: 0, totalNotablesRecruited: 0, habitatsUnlocked: 0, adultSnakesPlaced: 0, boardMasteries: 0, nestSlotsReached: 1, nurserySizeReached: 2 };
  }
  function blankSettlement(id, name, region, now) {
    return { id, name, region, foundedAt: now, status: id === "grasslands" ? "established" : "founding", foundingRemainingMs: id === "grasslands" ? 0 : cfg.founding.baseTimeMs, stats: blankStats(), economy: null };
  }
  function normalizeEconomy(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    return {
      seeds: nonnegative(raw.seeds), branches: nonnegative(raw.branches), provisions: nonnegative(raw.provisions), best: nonnegative(raw.best),
      // Upgrades are settlement-local. Keep an absent field absent here so the
      // session can migrate older saves' active settlement from its former
      // top-level upgrade state; every newly created economy writes this field.
      upgrades: raw.upgrades === undefined ? undefined : normalizeUpgrades(raw.upgrades),
      selectedBoardLevel: integer(raw.selectedBoardLevel),
      nursery: clone(raw.nursery || {}), habitats: clone(raw.habitats || {}), notables: clone(raw.notables || {})
    };
  }
  function normalizeSettlement(raw, index) {
    raw = raw && typeof raw === "object" ? raw : {};
    const id = String(raw.id || (index === 0 ? "grasslands" : `settlement-${index + 1}`));
    return {
      ...blankSettlement(id, raw.name || (id === "grasslands" ? "Grasslands" : `Settlement ${index + 1}`), raw.region || (id === "grasslands" ? "Grasslands" : "Unknown"), nonnegative(raw.foundedAt)),
      status: raw.status === "founding" ? "founding" : "established",
      foundingRemainingMs: nonnegative(raw.foundingRemainingMs),
      stats: { ...blankStats(), ...(raw.stats || {}) },
      economy: id === "grasslands" && !raw.economy ? null : normalizeEconomy(raw.economy)
    };
  }
  function createState(saved, now) {
    saved = saved && typeof saved === "object" ? saved : {};
    const settlements = Array.isArray(saved.settlements) && saved.settlements.length
      ? saved.settlements.map(normalizeSettlement)
      : [blankSettlement("grasslands", "Grasslands", "Grasslands", now)];
    if (!settlements.some((item) => item.id === "grasslands")) settlements.unshift(blankSettlement("grasslands", "Grasslands", "Grasslands", now));
    const completedMigrations = Array.isArray(saved.completedMigrations) ? clone(saved.completedMigrations) : [];
    const failedMigrations = Array.isArray(saved.failedMigrations) ? clone(saved.failedMigrations) : [];
    const returnedMigrations = Array.isArray(saved.returnedMigrations) ? clone(saved.returnedMigrations) : [];
    return {
      availablePoints: roundPoints(saved.availablePoints ?? saved.globalMigrationPoints),
      totalEarned: roundPoints(saved.totalEarned ?? saved.lifetimeMigrationPointsEarned),
      totalSpent: roundPoints(saved.totalSpent ?? saved.lifetimeMigrationPointsSpent),
      contributions: saved.contributions && typeof saved.contributions === "object" ? clone(saved.contributions) : clone(saved.settlementContributionRecords || {}),
      activeExpeditions: Array.isArray(saved.activeExpeditions) ? clone(saved.activeExpeditions) : [],
      completedMigrations: retainLatest(completedMigrations),
      failedMigrations: retainLatest(failedMigrations),
      returnedMigrations: retainLatest(returnedMigrations),
      historyTotals: {
        ...(saved.historyTotals && typeof saved.historyTotals === "object" && !Array.isArray(saved.historyTotals) ? clone(saved.historyTotals) : {}),
        completed: historyCount(saved.historyTotals?.completed, completedMigrations),
        failed: historyCount(saved.historyTotals?.failed, failedMigrations),
        returned: historyCount(saved.historyTotals?.returned, returnedMigrations)
      },
      settlements,
      activeSettlementId: settlements.some((item) => item.id === saved.activeSettlementId) ? saved.activeSettlementId : "grasslands",
      nextExpeditionId: Math.max(1, integer(saved.nextExpeditionId) || 1),
      nextSettlementId: Math.max(1, integer(saved.nextSettlementId) || settlements.length),
      elapsedMs: nonnegative(saved.elapsedMs)
    };
  }
  function notableExperience(notable) {
    if (!notable) return 0;
    return nonnegative(notable.experience) + nonnegative(notable.totalServiceTime) / 60000 +
      (nonnegative(notable.totalProductionAdded) + nonnegative(notable.totalConsumptionPrevented) + nonnegative(notable.totalCapacityEnabled) + nonnegative(notable.totalProvisionsForaged) + nonnegative(notable.totalShortageOutputPreserved)) / 100;
  }
  function factor(value, tuning) { return 1 + tuning.weight * Math.log1p(nonnegative(value) / tuning.scale); }
  function calculateSuccess(manifest, notable) {
    const tuning = cfg.success;
    return tuning.base * factor(notableExperience(notable), tuning.notableExperience) * factor(manifest.adults, tuning.adults) * factor(manifest.provisions, tuning.provisions) * factor(manifest.eggs, tuning.eggs);
  }
  function calculateCost(manifest) {
    const costs = cfg.pointCosts;
    const bundles = (amount, item) => nonnegative(amount) / item.bundleSize * item.cost;
    return roundPoints(costs.notable + integer(manifest.adults) * costs.adult + integer(manifest.eggs) * costs.egg + bundles(manifest.seeds, costs.seeds) + bundles(manifest.branches, costs.branches) + bundles(manifest.provisions, costs.provisions));
  }
  function perStopChance(overallChance, stopCount) { return nonnegative(overallChance) ** (1 / Math.max(1, integer(stopCount))); }
  function contributionValue(metrics) {
    let product = 1;
    Object.entries(cfg.contribution.metrics).forEach(([key, tuning]) => { product *= factor(metrics[key], tuning); });
    return Math.floor(cfg.contribution.basePoints * Math.max(0, product - 1));
  }
  function activeMetrics(state) {
    const migration = state.migration;
    const settlement = migration.settlements.find((item) => item.id === migration.activeSettlementId);
    const previous = settlement?.stats || blankStats();
    const retained = state.notables?.retained?.length || 0;
    const pending = state.notables?.pending?.length || 0;
    const elders = state.notables?.elders?.length || 0;
    const placed = (state.habitats?.counts || []).reduce((sum, count) => sum + integer(count), 0);
    const adultsNow = integer(state.nursery?.colonyCount) + placed;
    const recruited = retained + pending + elders + integer(state.notables?.dismissedCount);
    const localMaxScore = Math.max(nonnegative(previous.maxSnakeScore), nonnegative(state.active?.score));
    return {
      maxSnakeScore: localMaxScore,
      totalAdultsProduced: Math.max(nonnegative(previous.totalAdultsProduced), adultsNow),
      totalNotablesRecruited: Math.max(nonnegative(previous.totalNotablesRecruited), recruited),
      habitatsUnlocked: Math.max(nonnegative(previous.habitatsUnlocked), config.habitatConfig.habitats.filter((item) => localMaxScore >= item.unlockScore).length),
      adultSnakesPlaced: Math.max(nonnegative(previous.adultSnakesPlaced), placed),
      boardMasteries: Math.max(nonnegative(previous.boardMasteries), Object.values(state.notables?.masteryRewardsClaimed || {}).filter(Boolean).length),
      nestSlotsReached: Math.max(nonnegative(previous.nestSlotsReached), 1 + integer(state.nursery?.nestLevel)),
      nurserySizeReached: Math.max(nonnegative(previous.nurserySizeReached), config.nurseryConfig.capacity + integer(state.nursery?.nurseryLevel) * config.nurseryConfig.upgrades.nursery.capacityPerLevel)
    };
  }
  function creditActiveSettlement(state) {
    const migration = state.migration;
    const settlement = migration.settlements.find((item) => item.id === migration.activeSettlementId);
    if (!settlement || settlement.status !== "established") return 0;
    settlement.stats = activeMetrics(state);
    const value = contributionValue(settlement.stats);
    const record = migration.contributions[settlement.id] || { highestCalculatedMigrationValue: 0, totalMigrationPointsCredited: 0 };
    const awarded = Math.max(0, value - nonnegative(record.highestCalculatedMigrationValue));
    record.highestCalculatedMigrationValue = Math.max(value, nonnegative(record.highestCalculatedMigrationValue));
    record.totalMigrationPointsCredited = roundPoints(nonnegative(record.totalMigrationPointsCredited) + awarded);
    migration.contributions[settlement.id] = record;
    migration.availablePoints = roundPoints(migration.availablePoints + awarded);
    migration.totalEarned = roundPoints(migration.totalEarned + awarded);
    return awarded;
  }
  function snapshotEconomy(state) {
    return { seeds: state.seeds, branches: state.branches, provisions: state.provisions, best: state.best, upgrades: clone(state.upgrades), selectedBoardLevel: integer(state.selectedBoardLevel), nursery: clone(state.nursery), habitats: clone(state.habitats), notables: clone(state.notables) };
  }
  function storeActiveSettlement(state) {
    const settlement = state.migration.settlements.find((item) => item.id === state.migration.activeSettlementId);
    if (settlement) settlement.economy = snapshotEconomy(state);
  }
  function manifestAvailable(economy) {
    const n = economy.nursery || {};
    return { adults: integer(n.colonyCount), eggs: (n.eggElapsedMs == null ? 0 : 1) + (Array.isArray(n.nestEggs) ? n.nestEggs.length : 0), seeds: nonnegative(economy.seeds), branches: nonnegative(economy.branches), provisions: nonnegative(economy.provisions) };
  }
  function removeEggs(nursery, count) {
    let remaining = integer(count);
    while (remaining > 0 && nursery.nestEggs?.length) { nursery.nestEggs.pop(); remaining -= 1; }
    if (remaining > 0 && nursery.eggElapsedMs != null) { nursery.eggElapsedMs = null; remaining -= 1; }
    return remaining === 0;
  }
  function weighted(items, rng) {
    const total = items.reduce((sum, item) => sum + nonnegative(item.weight), 0);
    let roll = Math.min(0.999999999999, nonnegative(rng())) * total;
    for (const item of items) { roll -= item.weight; if (roll < 0) return item; }
    return items.at(-1);
  }
  function validateDeparture(migration, economy, notableId, manifest, destination) {
    const available = manifestAvailable(economy);
    if (!cfg.destinations.includes(destination)) return "invalidDestination";
    const destinationKey = String(destination).toLowerCase();
    if (migration.settlements.some((item) => String(item.region || item.name).toLowerCase() === destinationKey)
      || migration.activeExpeditions.some((item) => String(item.destination).toLowerCase() === destinationKey)) return "destinationAlreadySettled";
    if (!notableId) return "notableRequired";
    const notable = economy.notables?.retained?.find((item) => item.id === notableId);
    if (!notable) return "notableMissing";
    if (integer(manifest.adults) < cfg.requirements.adults) return "insufficientAdultsRequired";
    if (integer(manifest.provisions) < cfg.requirements.provisions) return "insufficientProvisionsRequired";
    for (const key of ["adults", "eggs", "seeds", "branches", "provisions"]) if (nonnegative(manifest[key]) > available[key]) return `insufficient${key[0].toUpperCase()}${key.slice(1)}`;
    if (calculateCost(manifest) > migration.availablePoints) return "insufficientMigrationPoints";
    return null;
  }
  function startExpedition(state, action, now, rng) {
    storeActiveSettlement(state);
    const migration = state.migration;
    if (action.originSettlementId !== "grasslands") return { accepted: false, reason: "originMustBeGrasslands" };
    const origin = migration.settlements.find((item) => item.id === action.originSettlementId);
    if (!origin || origin.status !== "established") return { accepted: false, reason: "originMissing" };
    const economy = origin.economy;
    const manifest = { adults: integer(action.manifest?.adults), eggs: integer(action.manifest?.eggs), seeds: integer(action.manifest?.seeds), branches: integer(action.manifest?.branches), provisions: integer(action.manifest?.provisions) };
    const reason = validateDeparture(migration, economy, action.notableId, manifest, action.destination);
    if (reason) return { accepted: false, reason };
    const notableIndex = economy.notables.retained.findIndex((item) => item.id === action.notableId);
    const [notable] = economy.notables.retained.splice(notableIndex, 1);
    notable.assignedHabitatId = null; notable.status = "MIGRATING";
    economy.nursery.colonyCount -= manifest.adults;
    removeEggs(economy.nursery, manifest.eggs);
    economy.seeds -= manifest.seeds; economy.branches -= manifest.branches; economy.provisions -= manifest.provisions;
    const cost = calculateCost(manifest); const stopCount = weighted(cfg.journey.stopCounts, rng).value; const success = calculateSuccess(manifest, notable);
    const expedition = {
      id: `expedition-${migration.nextExpeditionId++}`, originSettlementId: origin.id, destination: action.destination, notable: clone(notable), originalManifest: clone(manifest), currentManifest: clone(manifest),
      migrationPointCost: cost, chanceOfSuccess: success, perStopChance: perStopChance(success, stopCount), stopCount, currentStopIndex: 0, state: "traveling", travelTimeRemainingMs: cfg.journey.travelTimePerLegMs,
      stopEvent: null, attritionHistory: [], playerChoices: [], challengeAttempts: 0, departureTime: now, arrivalTime: null, outcome: null, nextLegAttritionMultiplier: 1
    };
    migration.availablePoints = roundPoints(migration.availablePoints - cost); migration.totalSpent = roundPoints(migration.totalSpent + cost); migration.activeExpeditions.push(expedition);
    if (origin.id === migration.activeSettlementId) loadEconomyIntoState(state, economy);
    return { accepted: true, expedition: clone(expedition), cost };
  }
  function loadEconomyIntoState(state, economy) {
    state.seeds = economy.seeds; state.branches = economy.branches; state.provisions = economy.provisions;
    state.best = economy.best;
    state.upgrades = normalizeUpgrades(economy.upgrades);
    state.selectedBoardLevel = Math.min(state.upgrades.boardLevel, integer(economy.selectedBoardLevel));
    state.nursery = clone(economy.nursery); state.habitats = clone(economy.habitats); state.notables = clone(economy.notables);
  }
  function loadActiveSettlement(state) {
    const target = state.migration.settlements.find((item) => item.id === state.migration.activeSettlementId);
    if (!target?.economy) return false;
    loadEconomyIntoState(state, target.economy); return true;
  }
  function selectSettlement(state, settlementId) {
    const target = state.migration.settlements.find((item) => item.id === settlementId);
    if (!target) return { accepted: false, reason: "settlementMissing" };
    creditActiveSettlement(state); storeActiveSettlement(state);
    state.migration.activeSettlementId = target.id; loadEconomyIntoState(state, target.economy || normalizeEconomy({}));
    return { accepted: true, settlement: clone(target) };
  }
  function attritionRate(resource, successRating) {
    const item = cfg.attrition[resource];
    return item.minimum + item.variable / (1 + nonnegative(successRating) * item.protectionStrength);
  }
  function boundedLoss(amount, rate, minimumSurvival, rng, stochastic) {
    const raw = nonnegative(amount) * rate;
    let loss = stochastic ? Math.floor(raw) + (rng() < raw - Math.floor(raw) ? 1 : 0) : Math.round(raw);
    loss = Math.min(loss, Math.max(0, integer(amount) - integer(minimumSurvival)));
    return Math.max(0, loss);
  }
  function applyTravelAttrition(expedition, rng) {
    const multiplier = nonnegative(expedition.nextLegAttritionMultiplier) || 1; const m = expedition.currentManifest; const losses = {};
    losses.adults = boundedLoss(m.adults, attritionRate("adults", expedition.chanceOfSuccess) * multiplier, cfg.attrition.adults.minimumSurvival, rng, true);
    losses.seeds = boundedLoss(m.seeds, attritionRate("seeds", expedition.chanceOfSuccess) * multiplier, cfg.attrition.seeds.minimumSurvival, rng, false);
    losses.provisions = boundedLoss(m.provisions, attritionRate("provisions", expedition.chanceOfSuccess) * multiplier, cfg.attrition.provisions.minimumSurvival, rng, false);
    m.adults -= losses.adults; m.seeds -= losses.seeds; m.provisions -= losses.provisions;
    expedition.nextLegAttritionMultiplier = 1; expedition.attritionHistory.push({ leg: expedition.currentStopIndex + 1, type: "travel", losses });
    return losses;
  }
  const stopDefinitions = {
    "forked-trail": { title: "Forked trail", description: "Choose speed or shelter.", options: [{ id: "short", label: "Short dangerous path", detail: "Next leg is faster but suffers 50% more attrition.", free: true, travelMultiplier: 0.65, attritionMultiplier: 1.5 }, { id: "long", label: "Long protected path", detail: "Next leg takes longer and suffers 30% less attrition.", free: true, travelMultiplier: 1.5, attritionMultiplier: 0.7 }] },
    "flooded-crossing": { title: "Flooded crossing", description: "Cargo or adults must absorb the crossing.", options: [{ id: "cargo", label: "Abandon cargo", detail: "Lose up to 50 Seeds and 10 Branches; adults are preserved.", free: true, penalty: { seeds: 50, branches: 10 } }, { id: "force", label: "Force through", detail: "Keep cargo but lose 1 adult.", free: true, penalty: { adults: 1 } }] },
    "cold-night": { title: "Cold night", description: "Spend stores or endure the cold.", options: [{ id: "provisions", label: "Spend Provisions", detail: "Spend 25 Provisions and avoid adult losses.", cost: { provisions: 25 } }, { id: "endure", label: "Endure without payment", detail: "Lose 1 adult.", free: true, penalty: { adults: 1 } }] },
    "seed-trial": { title: "The Seed Trial", description: `Eat ${cfg.challenge.requiredSeeds} Seeds on a ${cfg.challenge.columns} by ${cfg.challenge.rows} board.`, challenge: clone(cfg.challenge), options: [] }
  };
  function generateStop(rng) { const selected = weighted(cfg.journey.stopPool, rng); return { id: selected.id, type: selected.type, ...clone(stopDefinitions[selected.id]) }; }
  function findExpedition(migration, id) { return migration.activeExpeditions.find((item) => item.id === id); }
  function returnNotable(migration, originId, notable) {
    const origin = migration.settlements.find((item) => item.id === originId); if (!origin) return;
    origin.economy = origin.economy || normalizeEconomy({}); notable.status = "INACTIVE"; notable.assignedHabitatId = null; origin.economy.notables.retained = origin.economy.notables.retained || []; origin.economy.notables.retained.push(notable);
  }
  function removeActive(migration, expedition) { migration.activeExpeditions.splice(migration.activeExpeditions.indexOf(expedition), 1); }
  function failExpedition(state, expedition, now, rng) {
    const migration = state.migration; const survived = rng() < cfg.journey.notableSurvivalChance;
    if (survived) returnNotable(migration, expedition.originSettlementId, expedition.notable);
    expedition.currentManifest = { adults: 0, eggs: 0, seeds: 0, branches: 0, provisions: 0 }; expedition.state = "failed"; expedition.outcome = survived ? "failed-notable-returned" : "failed-notable-lost"; expedition.arrivalTime = now; expedition.notableSurvived = survived;
    removeActive(migration, expedition); recordHistory(migration, "failedMigrations", "failed", expedition);
    if (migration.activeSettlementId === expedition.originSettlementId) loadEconomyIntoState(state, migration.settlements.find((item) => item.id === expedition.originSettlementId).economy);
  }
  function reachStop(state, expedition, now, rng) {
    applyTravelAttrition(expedition, rng); expedition.currentStopIndex += 1;
    if (expedition.perStopChance < 1 && rng() >= expedition.perStopChance) { failExpedition(state, expedition, now, rng); return "failed"; }
    expedition.stopEvent = generateStop(rng); expedition.state = expedition.stopEvent.type === "challenge" ? "waitingChallenge" : "waitingStop"; expedition.travelTimeRemainingMs = 0; return "stopped";
  }
  function applyPenalty(manifest, penalty) {
    Object.entries(penalty || {}).forEach(([key, amount]) => { manifest[key] = Math.max(key === "adults" || key === "provisions" ? 1 : 0, nonnegative(manifest[key]) - nonnegative(amount)); });
  }
  function beginNextLegOrArrive(state, expedition, now) {
    expedition.stopEvent = null;
    if (expedition.currentStopIndex >= expedition.stopCount) return arrive(state, expedition, now);
    expedition.state = "traveling"; expedition.travelTimeRemainingMs = cfg.journey.travelTimePerLegMs; return "traveling";
  }
  function resolveStop(state, expeditionId, optionId, now) {
    const expedition = findExpedition(state.migration, expeditionId); if (!expedition || expedition.state !== "waitingStop") return { accepted: false, reason: "stopUnavailable" };
    const option = expedition.stopEvent.options.find((item) => item.id === optionId); if (!option) return { accepted: false, reason: "optionMissing" };
    for (const [key, amount] of Object.entries(option.cost || {})) if (nonnegative(expedition.currentManifest[key]) < amount) return { accepted: false, reason: `insufficient${key}` };
    applyPenalty(expedition.currentManifest, option.cost); applyPenalty(expedition.currentManifest, option.penalty);
    expedition.nextLegAttritionMultiplier = option.attritionMultiplier || 1; expedition.playerChoices.push({ stop: expedition.currentStopIndex, optionId, at: now });
    const next = beginNextLegOrArrive(state, expedition, now);
    if (next === "traveling") expedition.travelTimeRemainingMs *= option.travelMultiplier || 1;
    return { accepted: true, state: next };
  }
  function resolveChallenge(state, expeditionId, success, now) {
    const expedition = findExpedition(state.migration, expeditionId); if (!expedition || expedition.state !== "waitingChallenge") return { accepted: false, reason: "challengeUnavailable" };
    expedition.challengeAttempts += 1;
    if (!success) { applyPenalty(expedition.currentManifest, cfg.attrition.failedChallenge); expedition.attritionHistory.push({ stop: expedition.currentStopIndex, type: "failedChallenge", losses: clone(cfg.attrition.failedChallenge) }); return { accepted: true, retry: true }; }
    expedition.playerChoices.push({ stop: expedition.currentStopIndex, optionId: "challenge-complete", at: now }); return { accepted: true, state: beginNextLegOrArrive(state, expedition, now) };
  }
  function skipChallenge(state, expeditionId, now) {
    const expedition = findExpedition(state.migration, expeditionId); if (!expedition || expedition.state !== "waitingChallenge") return { accepted: false, reason: "challengeUnavailable" };
    applyPenalty(expedition.currentManifest, cfg.attrition.skippedChallenge); expedition.attritionHistory.push({ stop: expedition.currentStopIndex, type: "skippedChallenge", losses: clone(cfg.attrition.skippedChallenge) }); expedition.playerChoices.push({ stop: expedition.currentStopIndex, optionId: "challenge-skipped", at: now });
    return { accepted: true, state: beginNextLegOrArrive(state, expedition, now) };
  }
  function returnExpedition(state, expeditionId, now) {
    const migration = state.migration; const expedition = findExpedition(migration, expeditionId); if (!expedition || !["traveling", "waitingStop", "waitingChallenge"].includes(expedition.state)) return { accepted: false, reason: "returnUnavailable" };
    const origin = migration.settlements.find((item) => item.id === expedition.originSettlementId); origin.economy = origin.economy || normalizeEconomy({}); const m = expedition.currentManifest;
    origin.economy.seeds += m.seeds; origin.economy.branches += m.branches; origin.economy.provisions += m.provisions; origin.economy.nursery.colonyCount = integer(origin.economy.nursery.colonyCount) + m.adults;
    origin.economy.nursery.nestEggs = origin.economy.nursery.nestEggs || []; for (let i = 0; i < m.eggs; i += 1) origin.economy.nursery.nestEggs.push({ elapsedMs: 0, hatchDurationMs: config.nurseryConfig.eggHatchMs });
    returnNotable(migration, origin.id, expedition.notable); const refund = roundPoints(expedition.migrationPointCost * cfg.journey.returnRefundRate); migration.availablePoints = roundPoints(migration.availablePoints + refund);
    expedition.state = "returned"; expedition.outcome = "returned"; expedition.arrivalTime = now; expedition.refund = refund; removeActive(migration, expedition); recordHistory(migration, "returnedMigrations", "returned", expedition);
    if (migration.activeSettlementId === origin.id) loadEconomyIntoState(state, origin.economy);
    return { accepted: true, refund };
  }
  function arrive(state, expedition, now) {
    const migration = state.migration; const id = `settlement-${migration.nextSettlementId++}`; const settlement = blankSettlement(id, expedition.destination, expedition.destination, now); const m = expedition.currentManifest;
    settlement.economy = normalizeEconomy({ seeds: m.seeds, branches: m.branches, provisions: m.provisions, upgrades: upgradeDefaults, selectedBoardLevel: 0, nursery: { colonyCount: m.adults, nestEggs: Array.from({ length: m.eggs }, () => ({ elapsedMs: 0, hatchDurationMs: config.nurseryConfig.eggHatchMs })) }, habitats: {}, notables: { retained: [{ ...expedition.notable, status: "INACTIVE", assignedHabitatId: null }] } });
    migration.settlements.push(settlement); expedition.state = "founding"; expedition.outcome = "arrived"; expedition.arrivalTime = now; expedition.settlementId = id; removeActive(migration, expedition); recordHistory(migration, "completedMigrations", "completed", expedition); return "founding";
  }
  function recordSnakeSeeds(state, amount) {
    const settlement = state.migration.settlements.find((item) => item.id === state.migration.activeSettlementId); const seeds = nonnegative(amount);
    if (!settlement || settlement.status !== "founding" || !seeds) return 0;
    const reduction = Math.min(settlement.foundingRemainingMs, seeds * cfg.founding.msRemovedPerSnakeSeed); settlement.foundingRemainingMs -= reduction;
    if (settlement.foundingRemainingMs <= 0) settlement.status = "established"; return reduction;
  }
  function tick(state, dtMs, now, rng, options) {
    const migration = state.migration; const events = []; const dt = nonnegative(dtMs); migration.elapsedMs += dt;
    for (const expedition of [...migration.activeExpeditions]) {
      if (expedition.state !== "traveling") continue;
      expedition.travelTimeRemainingMs -= dt;
      if (expedition.travelTimeRemainingMs <= 0) { const outcome = reachStop(state, expedition, now, rng); events.push({ type: outcome === "failed" ? "migrationFailed" : "migrationStopReached", expeditionId: expedition.id }); }
    }
    for (const settlement of migration.settlements) {
      if (settlement.status !== "founding") continue;
      const before = settlement.foundingRemainingMs; settlement.foundingRemainingMs = Math.max(0, before - dt);
      if (before > 0 && settlement.foundingRemainingMs === 0) { settlement.status = "established"; events.push({ type: "settlementEstablished", settlementId: settlement.id }); }
    }
    if (!options?.deferEconomySync) {
      const awarded = creditActiveSettlement(state); if (awarded) events.push({ type: "migrationPointsEarned", amount: awarded }); storeActiveSettlement(state);
    }
    return { events };
  }
  return { createState, notableExperience, calculateSuccess, calculateCost, perStopChance, contributionValue, creditActiveSettlement, storeActiveSettlement, loadActiveSettlement, selectSettlement, validateDeparture, startExpedition, attritionRate, applyTravelAttrition, resolveStop, resolveChallenge, skipChallenge, returnExpedition, recordSnakeSeeds, tick, manifestAvailable };
});
