// Persistent Notable-leader domain. Pure state transitions; no DOM or storage.
(function attachNotables(root, factory) {
  const api = factory(typeof require === "function" ? require("./config.js") : root.IdleSnakeConfig);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.IdleSnakeNotables = api;
  else root.IdleSnakeNotables = api;
})(typeof window !== "undefined" ? window : globalThis, (config) => {
  const cfg = config.notableConfig;
  const STAT_FIELDS = ["totalServiceTime", "totalProductionAdded", "totalConsumptionPrevented", "totalCapacityEnabled", "totalProvisionsForaged", "totalShortageOutputPreserved"];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function weighted(items, rng) {
    const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
    let roll = Math.max(0, Math.min(0.999999999999, Number(rng()) || 0)) * total;
    for (const item of items) { roll -= item.weight; if (roll < 0) return item.value; }
    return items.at(-1).value;
  }
  function normalizeNotable(raw, status) {
    const value = raw && typeof raw === "object" ? raw : {};
    const result = {
      id: String(value.id || "notable-legacy"), name: String(value.name || "Unnamed"), epithet: String(value.epithet || ""),
      createdAt: Number(value.createdAt) || 0, sourceType: String(value.sourceType || "UNKNOWN"), sourceReference: String(value.sourceReference || ""),
      powerType: String(value.powerType || "PRODUCTION_INCREASE"), powerMagnitude: Math.max(0, Number(value.powerMagnitude) || 0),
      status: status || value.status || "INACTIVE", assignedHabitatId: value.assignedHabitatId == null ? null : Number(value.assignedHabitatId),
      hasServed: Boolean(value.hasServed), habitatsServed: Array.isArray(value.habitatsServed) ? [...new Set(value.habitatsServed.map(Number))] : [],
      retiredAt: value.retiredAt == null ? null : Number(value.retiredAt), lastAssignedHabitatId: value.lastAssignedHabitatId == null ? null : Number(value.lastAssignedHabitatId)
    };
    STAT_FIELDS.forEach((field) => { result[field] = Math.max(0, Number(value[field]) || 0); });
    return result;
  }
  function createState(saved) {
    const raw = saved && typeof saved === "object" ? saved : {};
    return {
      retained: Array.isArray(raw.retained) ? raw.retained.map((item) => normalizeNotable(item)) : [],
      elders: Array.isArray(raw.elders) ? raw.elders.map((item) => normalizeNotable(item, "ELDER")) : [],
      pending: Array.isArray(raw.pending) ? raw.pending.map((item) => normalizeNotable(item, "PENDING")) : [],
      dismissedCount: Math.max(0, Math.floor(Number(raw.dismissedCount) || 0)),
      directRecruitmentsCompleted: Math.max(0, Math.floor(Number(raw.directRecruitmentsCompleted) || 0)),
      masteryRewardsClaimed: raw.masteryRewardsClaimed && typeof raw.masteryRewardsClaimed === "object" ? { ...raw.masteryRewardsClaimed } : {},
      nextId: Math.max(1, Math.floor(Number(raw.nextId) || 1))
    };
  }
  function capacity(state, habitatCounts) {
    const active = (habitatCounts || []).filter((count) => Number(count) > 0).length;
    return cfg.startingNotableCapacity + active * cfg.capacityPerActiveHabitat;
  }
  function rosterOverCapacity(state, habitatCounts) { return state.retained.length > capacity(state, habitatCounts); }
  function magnitudeFor(type, rng) {
    if (type === "PRODUCTION_INCREASE") return weighted(cfg.productionMagnitudeWeights, rng);
    if (type === "CONSUMPTION_REDUCTION") return weighted(cfg.consumptionMagnitudeWeights, rng);
    if (type === "CAPACITY_INCREASE") return weighted(cfg.capacityMagnitudeWeights, rng);
    if (type === "RATIONER") return weighted(cfg.rationerMagnitudeWeights, rng);
    return cfg.foragerProvisionPerSeed;
  }
  function generate(state, source, rng, now, habitatCounts) {
    const type = weighted(cfg.powerTypeWeights, rng);
    const notable = normalizeNotable({
      id: `notable-${state.nextId++}`, name: weighted(cfg.namePools.names.map((value) => ({ value, weight: 1 })), rng),
      epithet: weighted(cfg.namePools.epithets.map((value) => ({ value, weight: 1 })), rng), createdAt: Number(now) || 0,
      sourceType: source.type, sourceReference: source.reference || "", powerType: type, powerMagnitude: magnitudeFor(type, rng), status: "INACTIVE"
    });
    const canRetain = state.retained.length < capacity(state, habitatCounts) && !rosterOverCapacity(state, habitatCounts);
    if (canRetain) state.retained.push(notable);
    else { notable.status = "PENDING"; state.pending.push(notable); }
    return { notable: clone(notable), retained: canRetain, events: [{ type: "NOTABLE_GENERATED", notable: clone(notable) }, { type: canRetain ? "NOTABLE_RETAINED" : "NOTABLE_PENDING", notableId: notable.id }] };
  }
  function findRetained(state, id) { return state.retained.find((item) => item.id === id); }
  function isForagerEligible(habitat) { return Boolean(habitat && !habitat.producesProvisions && habitat.producesSeeds !== false); }
  function hardCapacity(habitat, notable) {
    if (!habitat) return 0;
    const base = Math.max(0, Number(habitat.hardCapacity ?? habitat.naturalCapacity) || 0);
    if (!notable || notable.powerType !== "CAPACITY_INCREASE") return base;
    return Math.max(base + 1, Math.floor(base * (1 + notable.powerMagnitude)));
  }
  function assign(state, notableId, habitatId, habitats, counts) {
    const notable = findRetained(state, notableId); const habitat = habitats[habitatId];
    if (!notable) return { accepted: false, reason: "notableMissing" };
    if (!habitat || !counts[habitatId]) return { accepted: false, reason: "habitatInactive" };
    if (notable.powerType === "FORAGER" && !isForagerEligible(habitat)) return { accepted: false, reason: "foragerIneligible" };
    const events = []; const previous = state.retained.find((item) => item.assignedHabitatId === habitatId && item.id !== notable.id);
    if (notable.assignedHabitatId != null && notable.assignedHabitatId !== habitatId) notable.lastAssignedHabitatId = notable.assignedHabitatId;
    if (previous) { previous.lastAssignedHabitatId = habitatId; previous.assignedHabitatId = null; previous.status = "INACTIVE"; events.push({ type: "NOTABLE_UNASSIGNED", notableId: previous.id, habitatId }); }
    notable.assignedHabitatId = habitatId; notable.status = "ASSIGNED";
    events.push({ type: previous ? "NOTABLE_SWAPPED" : "NOTABLE_ASSIGNED", notableId, habitatId, previousNotableId: previous?.id || null });
    return { accepted: true, events, previous: previous ? clone(previous) : null };
  }
  function unassign(state, notableId) {
    const notable = findRetained(state, notableId); if (!notable || notable.assignedHabitatId == null) return { accepted: false, reason: "notAssigned" };
    const habitatId = notable.assignedHabitatId; notable.lastAssignedHabitatId = habitatId; notable.assignedHabitatId = null; notable.status = "INACTIVE";
    return { accepted: true, events: [{ type: "NOTABLE_UNASSIGNED", notableId, habitatId }] };
  }
  function removeRetained(state, notableId, now) {
    const index = state.retained.findIndex((item) => item.id === notableId); if (index < 0) return null;
    const [removed] = state.retained.splice(index, 1); removed.lastAssignedHabitatId = removed.assignedHabitatId ?? removed.lastAssignedHabitatId; removed.assignedHabitatId = null;
    if (removed.hasServed) { removed.status = "ELDER"; removed.retiredAt = Number(now) || 0; state.elders.push(removed); }
    else { removed.status = "DISMISSED"; state.dismissedCount += 1; }
    return removed;
  }
  function promotePendingIfSpace(state, habitatCounts) {
    if (!state.pending.length || state.retained.length >= capacity(state, habitatCounts)) return null;
    const promoted = state.pending.shift(); promoted.status = "INACTIVE"; promoted.assignedHabitatId = null; state.retained.push(promoted);
    return clone(promoted);
  }
  function resolvePending(state, decision, replaceId, now, habitatCounts) {
    const candidate = state.pending[0]; if (!candidate) return { accepted: false, reason: "noPending" };
    if (decision === "RELIEVE") { state.pending.shift(); state.dismissedCount += 1; return { accepted: true, events: [{ type: "NOTABLE_DISMISSED", notableId: candidate.id }] }; }
    if (decision !== "REPLACE") return { accepted: false, reason: "invalidDecision" };
    const removed = removeRetained(state, replaceId, now); if (!removed) return { accepted: false, reason: "replacementMissing" };
    state.pending.shift(); candidate.status = "INACTIVE"; state.retained.push(candidate);
    return { accepted: true, events: [{ type: removed.hasServed ? "NOTABLE_RETIRED" : "NOTABLE_DISMISSED", notableId: removed.id }, { type: "NOTABLE_RETAINED", notableId: candidate.id }], removed: clone(removed) };
  }
  function recordContribution(state, notableId, habitatId, dtMs, contributions) {
    const notable = findRetained(state, notableId); if (!notable || notable.assignedHabitatId !== habitatId) return;
    const amount = Object.values(contributions || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    if (amount <= 0) return;
    notable.hasServed = true; notable.totalServiceTime += Math.max(0, Number(dtMs) || 0);
    if (!notable.habitatsServed.includes(habitatId)) notable.habitatsServed.push(habitatId);
    Object.entries(contributions).forEach(([field, value]) => { if (STAT_FIELDS.includes(field)) notable[field] += Math.max(0, Number(value) || 0); });
  }
  function assignedTo(state, habitatId) { return state?.retained?.find((item) => item.status === "ASSIGNED" && item.assignedHabitatId === habitatId) || null; }
  return { createState, capacity, rosterOverCapacity, generate, findRetained, assignedTo, isForagerEligible, hardCapacity, assign, unassign, removeRetained, promotePendingIfSpace, resolvePending, recordContribution };
});
