import { getReferenceItem } from "../reference/items.js";
import { activeReferenceFusions } from "../reference/fusions.js";
import { getReferenceTrait, TRAIT_LEVEL_CAP } from "../reference/abilities.js";

function finiteNonNegative(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
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

export function createBuild({ stats = {}, traits = {} } = {}) {
  const baseStats = Object.fromEntries(
    Object.entries(stats).map(([id, value]) => [id, finiteNonNegative(value, `stat:${id}`)]),
  );
  const baseTraits = Object.fromEntries(Object.entries(traits).map(([id, value]) => {
    if (!getReferenceTrait(id)) throw new TypeError(`unknown-trait:${id}`);
    const level = finiteNonNegative(value, `trait:${id}`);
    return [id, level > 0 ? Math.min(TRAIT_LEVEL_CAP, Math.max(1, Math.floor(level))) : 0];
  }).filter(([, value]) => value > 0));
  return freezeBuild({ baseStats, baseTraits, items: [] });
}

export function deriveBuild(build) {
  const stats = { ...build.baseStats };
  const traits = { ...build.baseTraits };
  for (const instance of build.items) {
    const definition = getReferenceItem(instance.itemId);
    for (const [id, value] of Object.entries(definition.statGrants)) {
      stats[id] = (stats[id] || 0) + value;
    }
    for (const [id, value] of Object.entries(definition.traitGrants)) {
      traits[id] = Math.min(TRAIT_LEVEL_CAP, (traits[id] || 0) + value);
    }
  }
  return {
    stats,
    traits,
    items: build.items.map((item) => ({ ...item })),
    fusions: activeReferenceFusions(traits),
  };
}

export function equipItem(build, { instanceId, itemId } = {}) {
  if (typeof instanceId !== "string" || instanceId.length === 0) {
    return { ok: false, reason: "invalid-item-instance", build };
  }
  if (typeof itemId !== "string" || itemId.length === 0) {
    return { ok: false, reason: "invalid-item-id", build };
  }
  if (!getReferenceItem(itemId)) return { ok: false, reason: "unknown-item", build };
  const existing = build.items.find((item) => item.instanceId === instanceId);
  if (existing) {
    if (existing.itemId !== itemId) return { ok: false, reason: "item-instance-conflict", build };
    return { ok: true, applied: false, build };
  }
  return {
    ok: true,
    applied: true,
    build: freezeBuild({
      baseStats: { ...build.baseStats },
      baseTraits: { ...build.baseTraits },
      items: [...build.items, { instanceId, itemId }],
    }),
  };
}

export function removeItem(build, instanceId) {
  const nextItems = build.items.filter((item) => item.instanceId !== instanceId);
  if (nextItems.length === build.items.length) {
    return { ok: true, removed: false, build };
  }
  return {
    ok: true,
    removed: true,
    build: freezeBuild({
      baseStats: { ...build.baseStats },
      baseTraits: { ...build.baseTraits },
      items: nextItems.map((item) => ({ ...item })),
    }),
  };
}
