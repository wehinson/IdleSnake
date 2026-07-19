// Permanent settlement connections with two independently operated directions.
// Pure, deterministic, DOM-free, and driven only by the session clock.
(function attachTradeRoutes(root, factory) {
  const api = factory(typeof require === "function" ? require("./config.js") : root.IdleSnakeConfig);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.IdleSnakeTradeRoutes = api;
  else root.IdleSnakeTradeRoutes = api;
})(typeof window !== "undefined" ? window : globalThis, (config) => {
  const cfg = config.tradeRouteConfig;
  const resources = new Set(["seeds", "branches", "provisions"]);
  const directions = new Set(["AToB", "BToA"]);
  const upgradeTypes = new Set(["capacity", "speed", "efficiency", "workerCap"]);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const number = (value) => Math.max(0, Number(value) || 0);
  const integer = (value) => Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number(value) || 0)));

  function maximumWorkers(level) {
    return cfg.direction.baseMaximumWorkers + integer(level) * cfg.direction.workerCapIncreasePerLevel;
  }
  function capacity(direction) {
    return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(cfg.direction.baseShipmentCapacity * cfg.direction.capacityGrowth ** integer(direction.capacityLevel))));
  }
  function efficiency(direction) {
    const levels = cfg.direction.efficiencyByLevel;
    const value = levels[Math.min(levels.length - 1, integer(direction.efficiencyLevel))] ?? levels[0];
    return Math.min(cfg.direction.maximumDeliveryEfficiency, number(value));
  }
  function interval(direction) {
    const upgraded = cfg.direction.baseShipmentIntervalMs * cfg.direction.speedReductionPerLevel ** integer(direction.speedLevel);
    const multiplier = 1 + cfg.direction.workerSpeedBonus * Math.max(0, integer(direction.workersAssigned) - 1);
    return Math.max(cfg.direction.minimumShipmentIntervalMs, Math.round(upgraded / multiplier));
  }
  function upgradeCost(type, level) {
    if (!upgradeTypes.has(type)) return null;
    const item = cfg.upgrades[type];
    return {
      seeds: Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(item.seedBaseCost * item.costGrowth ** integer(level))),
      branches: Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(item.branchBaseCost * item.costGrowth ** integer(level)))
    };
  }
  function constructionCost() {
    return { seeds: cfg.construction.seedCostPerSide, branches: cfg.construction.branchCostPerSide };
  }
  function blankDirection(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    const workerCapLevel = integer(raw.workerCapLevel);
    const maxWorkers = maximumWorkers(workerCapLevel);
    return {
      resourceType: resources.has(raw.resourceType) ? raw.resourceType : "seeds",
      shipmentTarget: integer(raw.shipmentTarget),
      reserveThreshold: integer(raw.reserveThreshold),
      workersAssigned: Math.min(maxWorkers, integer(raw.workersAssigned)),
      maxWorkers,
      capacityLevel: integer(raw.capacityLevel),
      speedLevel: integer(raw.speedLevel),
      efficiencyLevel: Math.min(cfg.direction.efficiencyByLevel.length - 1, integer(raw.efficiencyLevel)),
      workerCapLevel,
      nextShipmentAt: Number.isFinite(Number(raw.nextShipmentAt)) && Number(raw.nextShipmentAt) >= 0 ? Number(raw.nextShipmentAt) : null,
      isPaused: Boolean(raw.isPaused),
      lifetimeResourceSent: integer(raw.lifetimeResourceSent),
      lifetimeResourceDelivered: integer(raw.lifetimeResourceDelivered),
      lifetimeShipments: integer(raw.lifetimeShipments),
      resupplyMissionId: raw.resupplyMissionId == null ? null : String(raw.resupplyMissionId)
    };
  }
  function normalizeRoute(raw, index) {
    raw = raw && typeof raw === "object" ? raw : {};
    const ids = [String(raw.settlementAId || ""), String(raw.settlementBId || "")].sort();
    const swapped = ids[0] !== String(raw.settlementAId || "");
    const route = {
      id: String(raw.id || `trade-route-${index + 1}`),
      settlementAId: ids[0], settlementBId: ids[1],
      createdAt: number(raw.createdAt), isPaused: Boolean(raw.isPaused),
      directionAToB: blankDirection(swapped ? raw.directionBToA : raw.directionAToB),
      directionBToA: blankDirection(swapped ? raw.directionAToB : raw.directionBToA)
    };
    if (route.isPaused || route.directionAToB.isPaused || route.directionAToB.workersAssigned === 0 || route.directionAToB.shipmentTarget === 0) route.directionAToB.nextShipmentAt = null;
    if (route.isPaused || route.directionBToA.isPaused || route.directionBToA.workersAssigned === 0 || route.directionBToA.shipmentTarget === 0) route.directionBToA.nextShipmentAt = null;
    return route;
  }
  function createState(saved) {
    const rawRoutes = Array.isArray(saved) ? saved : [];
    const seen = new Set();
    const tradeRoutes = rawRoutes.map(normalizeRoute).filter((route) => {
      const key = pairKey(route.settlementAId, route.settlementBId);
      if (!route.settlementAId || !route.settlementBId || route.settlementAId === route.settlementBId || seen.has(key)) return false;
      seen.add(key); return true;
    });
    let highest = 0;
    tradeRoutes.forEach((route) => { const match = /^trade-route-(\d+)$/.exec(route.id); if (match) highest = Math.max(highest, Number(match[1])); });
    return { tradeRoutes, nextTradeRouteId: highest + 1 };
  }
  function pairKey(a, b) { return [String(a), String(b)].sort().join("::"); }
  function findSettlement(state, id) { return state.migration?.settlements?.find((item) => item.id === id); }
  function findRoute(state, id) { return state.tradeRoutes.find((item) => item.id === id); }
  function directionFor(route, name) { return name === "AToB" ? route.directionAToB : name === "BToA" ? route.directionBToA : null; }
  function endpoints(route, name) {
    return name === "AToB"
      ? { sourceId: route.settlementAId, destinationId: route.settlementBId }
      : { sourceId: route.settlementBId, destinationId: route.settlementAId };
  }
  function isOperable(route, direction) {
    return !route.isPaused && !direction.isPaused && !direction.resupplyMissionId && direction.workersAssigned > 0 && direction.shipmentTarget > 0;
  }
  function reconcileSchedule(route, direction, now, wasOperable) {
    const operates = isOperable(route, direction);
    if (!operates) direction.nextShipmentAt = null;
    else if (!wasOperable || direction.nextShipmentAt === null) direction.nextShipmentAt = number(now) + interval(direction);
  }
  function reject(reason) { return { accepted: false, reason, events: [] }; }

  function createRoute(state, action, now) {
    const ids = [String(action.settlementAId || ""), String(action.settlementBId || "")].sort();
    if (!ids[0] || ids[0] === ids[1]) return reject("invalidSettlementPair");
    const a = findSettlement(state, ids[0]); const b = findSettlement(state, ids[1]);
    if (!a || !b) return reject("settlementMissing");
    if (a.status !== "established" || b.status !== "established") return reject("settlementNotEstablished");
    if (state.tradeRoutes.some((route) => pairKey(route.settlementAId, route.settlementBId) === pairKey(...ids))) return reject("tradeRouteExists");
    const cost = constructionCost();
    for (const settlement of [a, b]) {
      const economy = settlement.economy || {};
      if (number(economy.seeds) < cost.seeds || number(economy.branches) < cost.branches) return reject("insufficientRouteContribution");
    }
    for (const settlement of [a, b]) { settlement.economy.seeds -= cost.seeds; settlement.economy.branches -= cost.branches; }
    const route = normalizeRoute({ id: `trade-route-${state.nextTradeRouteId++}`, settlementAId: ids[0], settlementBId: ids[1], createdAt: now }, state.tradeRoutes.length);
    state.tradeRoutes.push(route);
    return { accepted: true, route: clone(route), events: [{ type: "tradeRouteCreated", routeId: route.id }] };
  }
  function configureDirection(state, action, now) {
    const route = findRoute(state, action.routeId); if (!route) return reject("tradeRouteMissing");
    const direction = directionFor(route, action.direction); if (!direction) return reject("tradeDirectionMissing");
    if (direction.resupplyMissionId) return reject("resupplyDirectionOccupied");
    const wasOperable = isOperable(route, direction);
    if (!resources.has(action.resourceType)) return reject("invalidTradeResource");
    direction.resourceType = action.resourceType; direction.shipmentTarget = integer(action.shipmentTarget); direction.reserveThreshold = integer(action.reserveThreshold);
    reconcileSchedule(route, direction, now, wasOperable);
    return { accepted: true, events: [{ type: "tradeDirectionConfigured", routeId: route.id, direction: action.direction }] };
  }
  function setDirectionPaused(state, action, now) {
    const route = findRoute(state, action.routeId); if (!route) return reject("tradeRouteMissing");
    const direction = directionFor(route, action.direction); if (!direction) return reject("tradeDirectionMissing");
    if (direction.resupplyMissionId) return reject("resupplyDirectionOccupied");
    const wasOperable = isOperable(route, direction); direction.isPaused = Boolean(action.isPaused); reconcileSchedule(route, direction, now, wasOperable);
    return { accepted: true, events: [{ type: "tradeDirectionPaused", routeId: route.id, direction: action.direction, isPaused: direction.isPaused }] };
  }
  function setRoutePaused(state, action, now) {
    const route = findRoute(state, action.routeId); if (!route) return reject("tradeRouteMissing");
    if (route.directionAToB.resupplyMissionId || route.directionBToA.resupplyMissionId) return reject("resupplyDirectionOccupied");
    const before = { AToB: isOperable(route, route.directionAToB), BToA: isOperable(route, route.directionBToA) };
    route.isPaused = Boolean(action.isPaused);
    reconcileSchedule(route, route.directionAToB, now, before.AToB); reconcileSchedule(route, route.directionBToA, now, before.BToA);
    return { accepted: true, events: [{ type: "tradeRoutePaused", routeId: route.id, isPaused: route.isPaused }] };
  }
  function setWorkers(state, action, now) {
    const route = findRoute(state, action.routeId); if (!route) return reject("tradeRouteMissing");
    const direction = directionFor(route, action.direction); if (!direction) return reject("tradeDirectionMissing");
    if (direction.resupplyMissionId) return reject("resupplyDirectionOccupied");
    const desired = integer(action.workersAssigned); if (desired > direction.maxWorkers) return reject("tradeWorkerLimitExceeded");
    const { sourceId } = endpoints(route, action.direction); const source = findSettlement(state, sourceId); if (!source?.economy?.nursery) return reject("sourceSettlementMissing");
    const delta = desired - direction.workersAssigned;
    if (delta > 0 && integer(source.economy.nursery.colonyCount) < delta) return reject("insufficientColonySnakes");
    const wasOperable = isOperable(route, direction);
    source.economy.nursery.colonyCount = integer(source.economy.nursery.colonyCount) - delta; direction.workersAssigned = desired;
    reconcileSchedule(route, direction, now, wasOperable);
    return { accepted: true, events: [{ type: "tradeWorkersChanged", routeId: route.id, direction: action.direction, workersAssigned: desired }] };
  }
  function purchaseUpgrade(state, action) {
    if (!upgradeTypes.has(action.upgradeType)) return reject("invalidTradeUpgrade");
    const route = findRoute(state, action.routeId); if (!route) return reject("tradeRouteMissing");
    const direction = directionFor(route, action.direction); if (!direction) return reject("tradeDirectionMissing");
    if (direction.resupplyMissionId) return reject("resupplyDirectionOccupied");
    const levelKey = `${action.upgradeType}Level`;
    if (action.upgradeType === "efficiency" && direction.efficiencyLevel >= cfg.direction.efficiencyByLevel.length - 1) return reject("tradeUpgradeMaxed");
    const cost = upgradeCost(action.upgradeType, direction[levelKey]); const { sourceId } = endpoints(route, action.direction); const source = findSettlement(state, sourceId);
    if (!source?.economy) return reject("sourceSettlementMissing");
    if (number(source.economy.seeds) < cost.seeds || number(source.economy.branches) < cost.branches) return reject("insufficientTradeUpgradeResources");
    source.economy.seeds -= cost.seeds; source.economy.branches -= cost.branches; direction[levelKey] += 1;
    if (action.upgradeType === "workerCap") direction.maxWorkers = maximumWorkers(direction.workerCapLevel);
    return { accepted: true, cost, events: [{ type: "tradeDirectionUpgraded", routeId: route.id, direction: action.direction, upgradeType: action.upgradeType }] };
  }
  function dismantleRoute(state, action) {
    const index = state.tradeRoutes.findIndex((item) => item.id === action.routeId); if (index < 0) return reject("tradeRouteMissing");
    const route = state.tradeRoutes[index];
    if (route.directionAToB.resupplyMissionId || route.directionBToA.resupplyMissionId) return reject("resupplyDirectionOccupied");
    for (const name of directions) {
      const direction = directionFor(route, name); const source = findSettlement(state, endpoints(route, name).sourceId);
      if (source?.economy?.nursery) source.economy.nursery.colonyCount = integer(source.economy.nursery.colonyCount) + direction.workersAssigned;
    }
    state.tradeRoutes.splice(index, 1);
    return { accepted: true, events: [{ type: "tradeRouteDismantled", routeId: route.id }] };
  }
  function nextShipmentTime(state, currentTime, endTime) {
    let next = Infinity;
    for (const route of state.tradeRoutes) for (const name of directions) {
      const direction = directionFor(route, name);
      if (!isOperable(route, direction) || direction.nextShipmentAt === null) continue;
      next = Math.min(next, Math.max(number(currentTime), direction.nextShipmentAt));
    }
    return next <= endTime ? next : null;
  }
  function resolveDue(state, now) {
    const events = [];
    const due = [];
    [...state.tradeRoutes].sort((a, b) => a.id.localeCompare(b.id)).forEach((route) => {
      for (const name of ["AToB", "BToA"]) {
        const direction = directionFor(route, name);
        if (isOperable(route, direction) && direction.nextShipmentAt !== null && direction.nextShipmentAt <= now) due.push({ route, name, direction });
      }
    });
    for (const item of due) {
      const { sourceId, destinationId } = endpoints(item.route, item.name); const source = findSettlement(state, sourceId); const destination = findSettlement(state, destinationId);
      if (!source?.economy || !destination?.economy) { item.direction.nextShipmentAt = now + interval(item.direction); continue; }
      const resource = item.direction.resourceType; const balance = number(source.economy[resource]);
      const available = Math.max(0, balance - item.direction.reserveThreshold);
      const sent = Math.floor(Math.min(item.direction.shipmentTarget, capacity(item.direction), available));
      const delivered = Math.floor(sent * efficiency(item.direction));
      if (sent > 0) { source.economy[resource] = balance - sent; destination.economy[resource] = number(destination.economy[resource]) + delivered; }
      item.direction.lifetimeResourceSent += sent; item.direction.lifetimeResourceDelivered += delivered; item.direction.lifetimeShipments += 1;
      item.direction.nextShipmentAt = now + interval(item.direction);
      events.push({ type: sent > 0 ? "tradeShipmentResolved" : "tradeShipmentSkipped", routeId: item.route.id, direction: item.name, resourceType: resource, sent, delivered });
    }
    return { events };
  }

  return { createState, createRoute, configureDirection, setDirectionPaused, setRoutePaused, setWorkers, purchaseUpgrade, dismantleRoute,
    nextShipmentTime, resolveDue, capacity, efficiency, interval, maximumWorkers, upgradeCost, constructionCost, isOperable, endpoints };
});
