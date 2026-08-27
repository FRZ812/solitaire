import { cloneJsonData } from "../kernel/json-data.js";
import { getReferenceItem } from "../reference/items.js";
import { activeReferenceFusions } from "../reference/fusions.js";
import { getReferenceTrait, TRAIT_LEVEL_CAP } from "../reference/abilities.js";

export const MAX_BUILD_STAT = 1_000_000;

function finiteNonNegative(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_BUILD_STAT) {
    throw new TypeError(`invalid-${label}`);
  }
  return value;
}

function freezeBuild(value) {
  Object.freeze(value.baseStats);
  Object.freeze(value.baseTraits);
  const items = Object.freeze(value.items.map((item) => Object.freeze({ ...item })));
  return Object.freeze({ ...value, items });
}

function normalizedBuild(value) {
  const snapshot = cloneJsonData(value, "invalid-build");
  if (
    !snapshot
    || typeof snapshot !== "object"
    || Array.isArray(snapshot)
    || !snapshot.baseStats
    || typeof snapshot.baseStats !== "object"
    || Array.isArray(snapshot.baseStats)
    || !snapshot.baseTraits
    || typeof snapshot.baseTraits !== "object"
    || Array.isArray(snapshot.baseTraits)
    || !Array.isArray(snapshot.items)
  ) throw new TypeError("invalid-build");

  const baseStats = Object.fromEntries(Object.entries(snapshot.baseStats).map(([id, amount]) => {
    if (id.length === 0) throw new TypeError("invalid-build");
    return [id, finiteNonNegative(amount, "build")];
  }));
  const baseTraits = Object.fromEntries(Object.entries(snapshot.baseTraits).map(([id, level]) => {
    if (!getReferenceTrait(id) || !Number.isInteger(level) || level < 1 || level > TRAIT_LEVEL_CAP) {
      throw new TypeError("invalid-build");
    }
    return [id, level];
  }));
  const instanceIds = new Set();
  const items = snapshot.items.map((item) => {
    if (
      !item
      || typeof item !== "object"
      || Array.isArray(item)
      || typeof item.instanceId !== "string"
      || item.instanceId.length === 0
      || typeof item.itemId !== "string"
      || !getReferenceItem(item.itemId)
      || instanceIds.has(item.instanceId)
    ) throw new TypeError("invalid-build");
    instanceIds.add(item.instanceId);
    return { instanceId: item.instanceId, itemId: item.itemId };
  });
  return freezeBuild({ baseStats, baseTraits, items });
}

function tryBuild(value) {
  try {
    return normalizedBuild(value);
  } catch {
    return null;
  }
}

function mutationResult(value) {
  return Object.freeze(value);
}

export function isBuildState(value) {
  return tryBuild(value) !== null;
}

export function createBuild(input = {}) {
  const snapshot = cloneJsonData(input, "invalid-build-input");
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new TypeError("invalid-build-input");
  }
  const stats = snapshot.stats ?? {};
  const traits = snapshot.traits ?? {};
  if (
    !stats
    || typeof stats !== "object"
    || Array.isArray(stats)
    || !traits
    || typeof traits !== "object"
    || Array.isArray(traits)
  ) throw new TypeError("invalid-build-input");

  const baseStats = Object.fromEntries(
    Object.entries(stats).map(([id, value]) => [id, finiteNonNegative(value, `stat:${id}`)]),
  );
  const baseTraits = Object.fromEntries(Object.entries(traits).map(([id, value]) => {
    if (!getReferenceTrait(id)) throw new TypeError(`unknown-trait:${id}`);
    if (!Number.isInteger(value) || value < 0) throw new TypeError(`invalid-trait:${id}`);
    return [id, Math.min(TRAIT_LEVEL_CAP, value)];
  }).filter(([, value]) => value > 0));
  return freezeBuild({ baseStats, baseTraits, items: [] });
}

export function deriveBuild(build) {
  const canonical = normalizedBuild(build);
  const stats = { ...canonical.baseStats };
  const traits = { ...canonical.baseTraits };
  for (const instance of canonical.items) {
    const definition = getReferenceItem(instance.itemId);
    for (const [id, value] of Object.entries(definition.statGrants)) {
      const next = (stats[id] || 0) + value;
      if (!Number.isSafeInteger(next) || next > MAX_BUILD_STAT) {
        throw new TypeError("invalid-build");
      }
      stats[id] = next;
    }
    for (const [id, value] of Object.entries(definition.traitGrants)) {
      traits[id] = Math.min(TRAIT_LEVEL_CAP, (traits[id] || 0) + value);
    }
  }
  return {
    stats,
    traits,
    items: canonical.items.map((item) => ({ ...item })),
    fusions: activeReferenceFusions(traits),
  };
}

export function equipItem(build, input = {}) {
  const canonical = tryBuild(build);
  if (!canonical) return mutationResult({ ok: false, reason: "invalid-build", build: null });
  let item;
  try {
    item = cloneJsonData(input, "invalid-item-input");
  } catch {
    return mutationResult({ ok: false, reason: "invalid-item-input", build: canonical });
  }
  const { instanceId, itemId } = item;
  if (typeof instanceId !== "string" || instanceId.length === 0) {
    return mutationResult({ ok: false, reason: "invalid-item-instance", build: canonical });
  }
  if (typeof itemId !== "string" || itemId.length === 0) {
    return mutationResult({ ok: false, reason: "invalid-item-id", build: canonical });
  }
  if (!getReferenceItem(itemId)) {
    return mutationResult({ ok: false, reason: "unknown-item", build: canonical });
  }
  const existing = canonical.items.find((entry) => entry.instanceId === instanceId);
  if (existing) {
    if (existing.itemId !== itemId) {
      return mutationResult({ ok: false, reason: "item-instance-conflict", build: canonical });
    }
    return mutationResult({ ok: true, applied: false, build: canonical });
  }
  return mutationResult({
    ok: true,
    applied: true,
    build: freezeBuild({
      baseStats: { ...canonical.baseStats },
      baseTraits: { ...canonical.baseTraits },
      items: [...canonical.items, { instanceId, itemId }],
    }),
  });
}

export function grantBaseStat(build, input = {}) {
  const canonical = tryBuild(build);
  if (!canonical) return mutationResult({ ok: false, reason: "invalid-build", build: null });
  let grant;
  try {
    grant = cloneJsonData(input, "invalid-stat-grant-input");
  } catch {
    return mutationResult({ ok: false, reason: "invalid-stat-grant-input", build: canonical });
  }
  const { statId, amount } = grant;
  if (typeof statId !== "string" || statId.length === 0) {
    return mutationResult({ ok: false, reason: "invalid-stat-id", build: canonical });
  }
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_BUILD_STAT) {
    return mutationResult({ ok: false, reason: "invalid-stat-grant", build: canonical });
  }
  const before = canonical.baseStats[statId] || 0;
  const after = before + amount;
  if (!Number.isSafeInteger(after) || after > MAX_BUILD_STAT) {
    return mutationResult({ ok: false, reason: "stat-cap-exceeded", build: canonical });
  }
  return mutationResult({
    ok: true,
    applied: true,
    build: freezeBuild({
      baseStats: {
        ...canonical.baseStats,
        [statId]: after,
      },
      baseTraits: { ...canonical.baseTraits },
      items: canonical.items,
    }),
  });
}

export function grantBaseTrait(build, input = {}) {
  const canonical = tryBuild(build);
  if (!canonical) return mutationResult({ ok: false, reason: "invalid-build", build: null });
  let grant;
  try {
    grant = cloneJsonData(input, "invalid-trait-grant-input");
  } catch {
    return mutationResult({ ok: false, reason: "invalid-trait-grant-input", build: canonical });
  }
  const { traitId, levels } = grant;
  if (typeof traitId !== "string" || !getReferenceTrait(traitId)) {
    return mutationResult({ ok: false, reason: "unknown-trait", build: canonical });
  }
  if (!Number.isInteger(levels) || levels <= 0) {
    return mutationResult({ ok: false, reason: "invalid-trait-grant", build: canonical });
  }
  const before = canonical.baseTraits[traitId] || 0;
  const after = Math.min(TRAIT_LEVEL_CAP, before + levels);
  if (after === before) return mutationResult({ ok: true, applied: false, build: canonical });
  return mutationResult({
    ok: true,
    applied: true,
    build: freezeBuild({
      baseStats: { ...canonical.baseStats },
      baseTraits: { ...canonical.baseTraits, [traitId]: after },
      items: canonical.items,
    }),
  });
}

export function removeItem(build, instanceId) {
  const canonical = tryBuild(build);
  if (!canonical) return mutationResult({ ok: false, reason: "invalid-build", build: null });
  if (typeof instanceId !== "string" || instanceId.length === 0) {
    return mutationResult({ ok: false, reason: "invalid-item-instance", build: canonical });
  }
  const nextItems = canonical.items.filter((item) => item.instanceId !== instanceId);
  if (nextItems.length === canonical.items.length) {
    return mutationResult({ ok: true, removed: false, build: canonical });
  }
  return mutationResult({
    ok: true,
    removed: true,
    build: freezeBuild({
      baseStats: { ...canonical.baseStats },
      baseTraits: { ...canonical.baseTraits },
      items: nextItems,
    }),
  });
}
