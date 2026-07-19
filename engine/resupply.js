// Safe, deterministic settlement-to-settlement population transport.
(function attachResupply(root, factory) {
  const req = typeof require === "function" ? require : null;
  const api = factory(req ? req("./config.js") : root.IdleSnakeConfig, req ? req("./trade-routes.js") : root.IdleSnakeTradeRoutes, req ? req("./notables.js") : root.IdleSnakeNotables, req ? req("./economy.js") : root.IdleSnakeEconomy);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.IdleSnakeResupply = api;
  else root.IdleSnakeResupply = api;
})(typeof window !== "undefined" ? window : globalThis, (config, tradeRoutes, notables, economy) => {
  const cfg = config.resupplyConfig;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const integer = (value) => Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number(value) || 0)));
  const number = (value) => Math.max(0, Number(value) || 0);
  const directions = new Set(["AToB", "BToA"]);
  function findRoute(state, id) { return state.tradeRoutes.find((route) => route.id === id); }
  function settlement(state, id) { return state.migration?.settlements?.find((item) => item.id === id); }
  function lane(route, direction) { return direction === "AToB" ? route.directionAToB : direction === "BToA" ? route.directionBToA : null; }
  function upgradeScore(direction) { return integer(direction?.capacityLevel) + integer(direction?.speedLevel) + integer(direction?.efficiencyLevel) + integer(direction?.workerCapLevel); }
  function routeDiscount(direction) { return Math.min(Math.max(0, Number(cfg.resupplyMaximumRouteDiscount) || 0), Math.max(0, cfg.resupplyMaximumRouteDiscount * (1 - Math.exp(-upgradeScore(direction) / Math.max(0.000001, number(cfg.resupplyDiscountScale)))))); }
  function baseProvisionRequirement(notableCount, adultCount, eggCount) { return integer(notableCount) * number(cfg.resupplyNotableProvisionCost) + integer(adultCount) * number(cfg.resupplyAdultProvisionCost) + integer(eggCount) * number(cfg.resupplyEggProvisionCost); }
  function provisionRequirement(notableCount, adultCount, eggCount, direction) { return Math.max(1, Math.ceil(baseProvisionRequirement(notableCount, adultCount, eggCount) * (1 - routeDiscount(direction)))); }
  function travelDuration(direction) {
    const reduction = Math.min(Math.max(0, Number(cfg.resupplyMaximumWorkerTimeReduction) || 0), Math.max(0, cfg.resupplyMaximumWorkerTimeReduction * (1 - Math.exp(-integer(direction?.workersAssigned) / Math.max(0.000001, number(cfg.resupplyWorkerTimeScale))))));
    return Math.max(integer(cfg.resupplyMinimumTravelSeconds) * 1000, Math.ceil(number(cfg.resupplyBaseTravelSeconds) * 1000 * (1 - reduction)));
  }
  function availableEggs(nursery) { return integer(nursery?.nestEggs?.length) + (nursery?.eggElapsedMs == null ? 0 : 1) + integer(nursery?.resupplyEggHolding); }
  function eligibleNotables(source) { return (source?.economy?.notables?.retained || []).filter((item) => item.status !== "ELDER" && item.status !== "COUNCIL" && !item.isCouncilMember && item.status !== "TRAVELING" && item.status !== "MIGRATING"); }
  function removeEggs(nursery, count) {
    let remaining = integer(count); nursery.nestEggs = Array.isArray(nursery.nestEggs) ? nursery.nestEggs : [];
    while (remaining && nursery.nestEggs.length) { nursery.nestEggs.pop(); remaining -= 1; }
    if (remaining && nursery.eggElapsedMs != null) { nursery.eggElapsedMs = null; remaining -= 1; }
    const holding = Math.min(remaining, integer(nursery.resupplyEggHolding)); nursery.resupplyEggHolding = integer(nursery.resupplyEggHolding) - holding; remaining -= holding;
    return remaining === 0;
  }
  function addEggs(nursery, count) {
    let remaining = integer(count); nursery.nestEggs = Array.isArray(nursery.nestEggs) ? nursery.nestEggs : [];
    const filled = (nursery.eggElapsedMs == null ? 0 : 1) + nursery.nestEggs.length;
    const slots = Math.max(0, economy.nestCapacity(nursery) - filled);
    const entering = Math.min(remaining, slots);
    for (let index = 0; index < entering; index += 1) nursery.nestEggs.push({ elapsedMs: 0, hatchDurationMs: config.nurseryConfig.eggHatchMs });
    nursery.resupplyEggHolding = integer(nursery.resupplyEggHolding) + remaining - entering;
  }
  function reject(reason) { return { accepted: false, reason, events: [] }; }
  function createState(saved, state) {
    saved = saved && typeof saved === "object" ? saved : {};
    const seenIds = new Set(); const occupied = new Set(); const travelingNotables = new Set(); let highest = 0;
    (state.tradeRoutes || []).forEach((route) => { route.directionAToB.resupplyMissionId = null; route.directionBToA.resupplyMissionId = null; });
    const active = (Array.isArray(saved.activeResupplyMissions) ? saved.activeResupplyMissions : []).map((raw, index) => {
      const route = findRoute(state, String(raw?.routeId || "")); const direction = String(raw?.directionId || raw?.direction || "");
      if (!route || !directions.has(direction) || !settlement(state, raw?.sourceSettlementId) || !settlement(state, raw?.destinationSettlementId)) return null;
      const id = String(raw?.id || `resupply-${index + 1}`); const key = `${route.id}:${direction}`;
      if (seenIds.has(id) || occupied.has(key)) return null;
      const ids = [...new Set((Array.isArray(raw?.notableIds) ? raw.notableIds : []).map(String))].filter((item) => !travelingNotables.has(item));
      ids.forEach((item) => travelingNotables.add(item)); seenIds.add(id); occupied.add(key);
      const duration = Math.max(1, number(raw?.travelDuration)); const departure = number(raw?.departureTime); const arrival = Math.max(departure, number(raw?.arrivalTime) || departure + duration);
      const match = /^resupply-(\d+)$/.exec(id); if (match) highest = Math.max(highest, Number(match[1]));
      const cargoNotables = (Array.isArray(raw.notables) ? raw.notables : []).filter((item) => ids.includes(String(item?.id))).map((item) => ({ ...clone(item), id: String(item.id), assignedHabitatId: null, status: "TRAVELING" }));
      return { id, routeId: route.id, directionId: direction, sourceSettlementId: String(raw.sourceSettlementId), destinationSettlementId: String(raw.destinationSettlementId), notableIds: ids, notables: cargoNotables, adultCount: integer(raw.adultCount), eggCount: integer(raw.eggCount), provisionsConsumed: integer(raw.provisionsConsumed), baseProvisionRequirement: integer(raw.baseProvisionRequirement), routeDiscount: Math.max(0, Math.min(1, Number(raw.routeDiscount) || 0)), workerCountAtDeparture: integer(raw.workerCountAtDeparture), travelDuration: duration, departureTime: departure, arrivalTime: arrival, status: "IN_TRANSIT" };
    }).filter(Boolean);
    active.forEach((mission) => { const route = findRoute(state, mission.routeId); lane(route, mission.directionId).resupplyMissionId = mission.id; const source = settlement(state, mission.sourceSettlementId); if (source?.economy?.notables?.retained) source.economy.notables.retained = source.economy.notables.retained.filter((item) => !mission.notableIds.includes(item.id)); });
    const completed = Array.isArray(saved.completedResupplyMissions) ? saved.completedResupplyMissions.map(clone) : [];
    completed.forEach((mission) => { const match = /^resupply-(\d+)$/.exec(String(mission?.id || "")); if (match) highest = Math.max(highest, Number(match[1])); });
    return { activeResupplyMissions: active, completedResupplyMissions: completed, nextResupplyMissionId: Math.max(highest + 1, integer(saved.nextResupplyMissionId) || 1) };
  }
  function dispatch(state, action, now) {
    const route = findRoute(state, action.routeId); const direction = lane(route, action.direction);
    if (!route) return reject("tradeRouteMissing"); if (!direction) return reject("tradeDirectionMissing");
    const occupiedCount = state.activeResupplyMissions.filter((mission) => mission.routeId === route.id && mission.directionId === action.direction).length;
    if (route.isPaused || direction.isPaused) return reject("tradeDirectionPaused"); if (direction.resupplyMissionId || occupiedCount >= Math.max(1, integer(cfg.resupplyMaxConcurrentPerDirection))) return reject("resupplyDirectionOccupied"); if (integer(direction.workersAssigned) < 1) return reject("resupplyWorkerRequired");
    const endpoints = tradeRoutes.endpoints(route, action.direction); const source = settlement(state, endpoints.sourceId); const destination = settlement(state, endpoints.destinationId);
    if (!source?.economy || !destination?.economy || source.status !== "established" || destination.status !== "established") return reject("resupplySettlementMissing");
    const notableIds = [...new Set((Array.isArray(action.notableIds) ? action.notableIds : []).map(String))]; if (!notableIds.length) return reject("resupplyNotableRequired");
    const chosen = eligibleNotables(source).filter((item) => notableIds.includes(item.id)); if (chosen.length !== notableIds.length) return reject("resupplyNotableIneligible");
    const adultCount = integer(action.adultCount); const eggCount = integer(action.eggCount); if (integer(source.economy.nursery?.colonyCount) < adultCount) return reject("insufficientColonySnakes"); if (availableEggs(source.economy.nursery) < eggCount) return reject("insufficientEggs");
    const base = baseProvisionRequirement(chosen.length, adultCount, eggCount); const discount = routeDiscount(direction); const provisions = Math.max(1, Math.ceil(base * (1 - discount))); if (number(source.economy.provisions) < provisions) return reject("insufficientProvisions");
    source.economy.provisions -= provisions; source.economy.nursery.colonyCount -= adultCount; removeEggs(source.economy.nursery, eggCount);
    source.economy.notables.retained = source.economy.notables.retained.filter((item) => !notableIds.includes(item.id)); chosen.forEach((item) => { item.lastAssignedHabitatId = item.assignedHabitatId ?? item.lastAssignedHabitatId; item.assignedHabitatId = null; item.status = "TRAVELING"; });
    const duration = travelDuration(direction); const mission = { id: `resupply-${state.nextResupplyMissionId++}`, routeId: route.id, directionId: action.direction, sourceSettlementId: source.id, destinationSettlementId: destination.id, notableIds, notables: clone(chosen), adultCount, eggCount, provisionsConsumed: provisions, baseProvisionRequirement: base, routeDiscount: discount, workerCountAtDeparture: integer(direction.workersAssigned), travelDuration: duration, departureTime: number(now), arrivalTime: number(now) + duration, status: "IN_TRANSIT" };
    direction.resupplyMissionId = mission.id; direction.nextShipmentAt = null; state.activeResupplyMissions.push(mission);
    return { accepted: true, mission: clone(mission), events: [{ type: "resupplyDeparted", missionId: mission.id, routeId: route.id, direction: action.direction }] };
  }
  function nextArrivalTime(state, currentTime, endTime) { const next = state.activeResupplyMissions.reduce((minimum, mission) => Math.min(minimum, Math.max(number(currentTime), number(mission.arrivalTime))), Infinity); return next <= endTime ? next : null; }
  function resolveDue(state, now) {
    const events = [];
    for (const mission of [...state.activeResupplyMissions].sort((a, b) => a.id.localeCompare(b.id))) {
      if (mission.arrivalTime > now) continue;
      const destination = settlement(state, mission.destinationSettlementId); const route = findRoute(state, mission.routeId); const direction = lane(route, mission.directionId);
      if (!destination?.economy || !route || !direction) continue;
      const cargo = mission.notables || [];
      cargo.forEach((item) => { item.assignedHabitatId = null; item.status = "INACTIVE"; if (destination.economy.notables.retained.length < notables.capacity(destination.economy.notables, destination.economy.habitats.counts)) destination.economy.notables.retained.push(item); else { item.status = "PENDING"; destination.economy.notables.pending.push(item); } });
      destination.economy.nursery.colonyCount = integer(destination.economy.nursery.colonyCount) + mission.adultCount; addEggs(destination.economy.nursery, mission.eggCount);
      direction.resupplyMissionId = null; direction.nextShipmentAt = tradeRoutes.isOperable(route, direction) ? number(now) + tradeRoutes.interval(direction) : null;
      mission.status = "ARRIVED"; mission.arrivalTime = number(now); state.activeResupplyMissions.splice(state.activeResupplyMissions.indexOf(mission), 1); state.completedResupplyMissions.push(clone(mission)); events.push({ type: "resupplyArrived", missionId: mission.id, routeId: route.id, direction: mission.directionId });
    }
    return { events };
  }
  return { createState, dispatch, resolveDue, nextArrivalTime, eligibleNotables, availableEggs, upgradeScore, routeDiscount, baseProvisionRequirement, provisionRequirement, travelDuration };
});
