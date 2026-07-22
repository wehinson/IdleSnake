// Small, dependency-free guard for legacy browser saves and canonical sessions.
(function attachSaveGuard(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.IdleSnakeSaveGuard = api;
  else root.IdleSnakeSaveGuard = api;
})(typeof window !== "undefined" ? window : globalThis, () => {
  const LEGACY_VERSION = 2;
  const CURRENT_VERSION = 5;
  // Well below typical 5 MB localStorage quotas, while allowing mature saves.
  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  const MAX_COLLECTION_ENTRIES = 10000;
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const invalid = (code, message) => ({ ok: false, code, message });

  function inspect(value, state) {
    if (typeof value === "number" && !Number.isFinite(value)) return false;
    if (Array.isArray(value)) {
      state.entries += value.length;
      return state.entries <= MAX_COLLECTION_ENTRIES && value.every((item) => inspect(item, state));
    }
    if (isObject(value)) return Object.values(value).every((item) => inspect(item, state));
    return true;
  }
  function nonNegativeNumbers(value) {
    return isObject(value) && Object.values(value).every((item) => Number.isFinite(item) && item >= 0);
  }
  function validateCollections(candidate) {
    const objects = ["currencies", "upgrades", "board", "records", "settings", "nursery", "habitats", "notables", "snakebird", "migration", "resupplyTotals"];
    for (const key of objects) if (candidate[key] !== undefined && candidate[key] !== null && !isObject(candidate[key])) return invalid("structure", "Invalid save structure.");
    const arrays = ["tradeRoutes", "activeResupplyMissions", "completedResupplyMissions", "regions", "prestigeHistory"];
    for (const key of arrays) if (candidate[key] !== undefined && !Array.isArray(candidate[key])) return invalid("structure", "Invalid save structure.");
    const nestedArrays = [["nursery", "hatchlings"], ["nursery", "nestEggs"], ["habitats", "counts"], ["habitats", "upgradeLevels"], ["notables", "retained"], ["notables", "elders"], ["notables", "pending"], ["snakebird", "clearedLevels"], ["snakebird", "bestMoves"], ["migration", "completedMigrations"], ["migration", "failedMigrations"], ["migration", "returnedMigrations"]];
    for (const [parent, key] of nestedArrays) if (candidate[parent]?.[key] !== undefined && !Array.isArray(candidate[parent][key])) return invalid("structure", "Invalid save structure.");
    const nestedObjects = [["board", "mastery"], ["settings", "snakeColors"], ["notables", "masteryRewardsClaimed"], ["migration", "historyTotals"]];
    for (const [parent, key] of nestedObjects) if (candidate[parent]?.[key] !== undefined && !isObject(candidate[parent][key])) return invalid("structure", "Invalid save structure.");
    if (candidate.currencies !== undefined && !nonNegativeNumbers(candidate.currencies)) return invalid("structure", "Invalid save structure.");
    if (candidate.records !== undefined && !nonNegativeNumbers(candidate.records)) return invalid("structure", "Invalid save structure.");
    if (candidate.resupplyTotals !== undefined && !nonNegativeNumbers(candidate.resupplyTotals)) return invalid("structure", "Invalid save structure.");
    if (candidate.migration?.historyTotals !== undefined && !nonNegativeNumbers(candidate.migration.historyTotals)) return invalid("structure", "Invalid save structure.");
    return null;
  }
  function validateLegacySave(candidate) {
    return validateCollections(candidate);
  }
  function validateSessionEconomy(economy) {
    if (!isObject(economy)) return false;
    const nonNegativeFields = ["seeds", "provisions", "branches", "best"];
    if (nonNegativeFields.some((key) => economy[key] !== undefined && (!Number.isFinite(economy[key]) || economy[key] < 0))) return false;
    const objects = ["upgrades", "nursery", "habitats", "notables"];
    if (objects.some((key) => economy[key] !== undefined && !isObject(economy[key]))) return false;
    if (economy.habitats?.counts !== undefined && !Array.isArray(economy.habitats.counts)) return false;
    if (economy.habitats?.upgradeLevels !== undefined && !Array.isArray(economy.habitats.upgradeLevels)) return false;
    if (economy.nursery?.nestEggs !== undefined && !Array.isArray(economy.nursery.nestEggs)) return false;
    if (economy.nursery?.hatchlings !== undefined && !Array.isArray(economy.nursery.hatchlings)) return false;
    for (const key of ["retained", "elders", "pending"]) if (economy.notables?.[key] !== undefined && !Array.isArray(economy.notables[key])) return false;
    return true;
  }
  function validateSessionSave(candidate) {
    if (!Number.isFinite(candidate.savedAt) || candidate.savedAt < 0 || !isObject(candidate.session)) return invalid("structure", "Invalid save structure.");
    const session = candidate.session;
    const objects = ["records", "upgrades", "cosmetics", "snakebirdProgress", "nursery", "habitats", "notables", "migration", "resupplyTotals"];
    for (const key of objects) if (session[key] !== undefined && session[key] !== null && !isObject(session[key])) return invalid("structure", "Invalid save structure.");
    const arrays = ["tradeRoutes", "activeResupplyMissions", "completedResupplyMissions"];
    for (const key of arrays) if (session[key] !== undefined && !Array.isArray(session[key])) return invalid("structure", "Invalid save structure.");
    const nestedArrays = [["snakebirdProgress", "clearedLevels"], ["snakebirdProgress", "bestMoves"], ["nursery", "nestEggs"], ["nursery", "hatchlings"], ["habitats", "counts"], ["habitats", "upgradeLevels"], ["notables", "retained"], ["notables", "elders"], ["notables", "pending"], ["migration", "activeExpeditions"], ["migration", "completedMigrations"], ["migration", "failedMigrations"], ["migration", "returnedMigrations"], ["migration", "settlements"]];
    for (const [parent, key] of nestedArrays) if (session[parent]?.[key] !== undefined && !Array.isArray(session[parent][key])) return invalid("structure", "Invalid save structure.");
    const nestedObjects = [["notables", "masteryRewardsClaimed"], ["migration", "historyTotals"], ["migration", "contributions"]];
    for (const [parent, key] of nestedObjects) if (session[parent]?.[key] !== undefined && !isObject(session[parent][key])) return invalid("structure", "Invalid save structure.");
    const nonNegativeFields = ["elapsedMs", "modeAccumulatorMs", "seeds", "provisions", "branches", "best", "selectedBoardLevel", "selectedDuelGridSize", "nextTradeRouteId", "nextResupplyMissionId"];
    if (nonNegativeFields.some((key) => session[key] !== undefined && (!Number.isFinite(session[key]) || session[key] < 0))) return invalid("structure", "Invalid save structure.");
    if (session.reducedMotion !== undefined && typeof session.reducedMotion !== "boolean") return invalid("structure", "Invalid save structure.");
    if (session.records !== undefined && !nonNegativeNumbers(session.records)) return invalid("structure", "Invalid save structure.");
    if (session.resupplyTotals !== undefined && !nonNegativeNumbers(session.resupplyTotals)) return invalid("structure", "Invalid save structure.");
    if (session.migration?.historyTotals !== undefined && !nonNegativeNumbers(session.migration.historyTotals)) return invalid("structure", "Invalid save structure.");
    for (const settlement of session.migration?.settlements || []) {
      if (!isObject(settlement) || (settlement.economy !== undefined && !validateSessionEconomy(settlement.economy))) return invalid("structure", "Invalid save structure.");
    }
    return null;
  }
  function validateSaveCandidate(candidate) {
    if (!isObject(candidate)) return invalid("structure", "Invalid save structure.");
    if (!Number.isFinite(candidate.saveVersion) || !Number.isInteger(candidate.saveVersion)) return invalid("version", "Invalid save version.");
    if (candidate.saveVersion > CURRENT_VERSION) return invalid("future-version", "Unsupported future save version.");
    if (candidate.saveVersion !== LEGACY_VERSION && candidate.saveVersion !== CURRENT_VERSION) return invalid("version", "Unsupported save version.");
    const structuralError = candidate.saveVersion === LEGACY_VERSION ? validateLegacySave(candidate) : validateSessionSave(candidate);
    if (structuralError) return structuralError;
    const state = { entries: 0 };
    if (!inspect(candidate, state)) return invalid("collection-limit", "Save has too many collection entries.");
    return { ok: true, value: candidate };
  }
  function validateImportText(text) {
    if (typeof text !== "string" || text.length > MAX_IMPORT_BYTES) return invalid("size", "Save is too large.");
    try { return validateSaveCandidate(JSON.parse(text)); }
    catch { return invalid("json", "Invalid JSON."); }
  }
  return { LEGACY_VERSION, CURRENT_VERSION, MAX_IMPORT_BYTES, MAX_COLLECTION_ENTRIES, validateSaveCandidate, validateImportText };
});
