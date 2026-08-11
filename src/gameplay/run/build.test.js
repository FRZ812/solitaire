import { describe, expect, it } from "vitest";
import {
  MAX_BUILD_STAT,
  createBuild,
  deriveBuild,
  equipItem,
  grantBaseStat,
  grantBaseTrait,
  removeItem,
} from "./build.js";

describe("reference build composition", () => {
  it("clamps authored trait levels at seven without mutating the base build", () => {
    const build = createBuild({
      stats: { attack: 4, defense: 2 },
      traits: { ironclad: 12 },
    });

    const projection = deriveBuild(build);

    expect(projection.traits.ironclad).toBe(7);
    expect(build.baseTraits.ironclad).toBe(7);
    expect(Object.isFrozen(build)).toBe(true);
  });

  it("rejects fractional authored trait levels instead of silently normalizing them", () => {
    expect(() => createBuild({ traits: { ironclad: 1.9 } })).toThrow("invalid-trait:ironclad");
  });

  it("rejects coercible stat values without executing caller code", () => {
    let coercions = 0;
    const value = { valueOf: () => { coercions += 1; return 4; } };

    expect(() => createBuild({ stats: { attack: value } })).toThrow("invalid-build-input");
    expect(coercions).toBe(0);
  });

  it.each(["unknown", "toString", "constructor", "__proto__"])(
    "rejects non-reference trait id %s",
    (traitId) => {
      expect(() => createBuild({ traits: { [traitId]: 1 } })).toThrow(`unknown-trait:${traitId}`);
    },
  );

  it("applies an item instance once across direct stats and trait grants", () => {
    const build = createBuild({ stats: { attack: 4, defense: 2 } });
    const equipped = equipItem(build, { instanceId: "helm-1", itemId: "mithril-helm" });
    const repeated = equipItem(equipped.build, { instanceId: "helm-1", itemId: "mithril-helm" });

    expect(equipped).toMatchObject({ ok: true, applied: true });
    expect(repeated).toMatchObject({ ok: true, applied: false });
    expect(repeated.build).toEqual(equipped.build);
    expect(repeated.build).not.toBe(equipped.build);
    expect(Object.isFrozen(repeated.build)).toBe(true);
    expect(deriveBuild(repeated.build)).toMatchObject({
      stats: { attack: 4, defense: 4 },
      traits: { swift: 1, anatomy: 1 },
      items: [{ instanceId: "helm-1", itemId: "mithril-helm" }],
    });
  });

  it("rejects non-string item identifiers without executing coercion hooks", () => {
    const build = createBuild();
    let coercions = 0;
    const itemId = { [Symbol.toPrimitive]: () => { coercions += 1; return "mithril-helm"; } };

    expect(equipItem(build, { instanceId: "helm-1", itemId })).toEqual({
      ok: false,
      reason: "invalid-item-input",
      build,
    });
    expect(equipItem(build, { instanceId: () => "helm-1", itemId: "mithril-helm" })).toEqual({
      ok: false,
      reason: "invalid-item-input",
      build,
    });
    expect(coercions).toBe(0);
  });

  it("recomputes derived stats and traits from base state when an item is removed", () => {
    const base = createBuild({
      stats: { attack: 4, defense: 2 },
      traits: { swift: 6 },
    });
    const equipped = equipItem(base, { instanceId: "helm-1", itemId: "mithril-helm" }).build;
    const removed = removeItem(equipped, "helm-1");

    expect(deriveBuild(equipped)).toMatchObject({
      stats: { attack: 4, defense: 4 },
      traits: { swift: 7, anatomy: 1 },
    });
    expect(removed).toMatchObject({ ok: true, removed: true });
    expect(deriveBuild(removed.build)).toEqual({
      stats: { attack: 4, defense: 2 },
      traits: { swift: 6 },
      items: [],
      fusions: [],
    });
  });

  it("preserves deserialized input ownership when equipping another item", () => {
    const equipped = equipItem(createBuild(), {
      instanceId: "helm-1",
      itemId: "mithril-helm",
    }).build;
    const restored = JSON.parse(JSON.stringify(equipped));
    const ownedItem = restored.items[0];

    equipItem(restored, { instanceId: "helm-2", itemId: "mithril-helm" });

    expect(Object.isFrozen(ownedItem)).toBe(false);
    expect(restored).toEqual(JSON.parse(JSON.stringify(equipped)));
  });

  it("isolates derived item projections from deserialized canonical input", () => {
    const restored = JSON.parse(JSON.stringify(equipItem(createBuild(), {
      instanceId: "helm-1",
      itemId: "mithril-helm",
    }).build));

    const projection = deriveBuild(restored);
    projection.items[0].instanceId = "mutated";

    expect(restored.items[0].instanceId).toBe("helm-1");
  });

  it("rejects accessor-backed creation and equip input without executing getters", () => {
    let getterCalls = 0;
    const creation = {};
    Object.defineProperty(creation, "stats", {
      enumerable: true,
      get: () => { getterCalls += 1; return {}; },
    });
    const equip = {};
    Object.defineProperty(equip, "itemId", {
      enumerable: true,
      get: () => { getterCalls += 1; return "mithril-helm"; },
    });

    const build = createBuild();
    expect(() => createBuild(creation)).toThrow("invalid-build-input");
    expect(equipItem(build, equip)).toEqual({
      ok: false,
      reason: "invalid-item-input",
      build,
    });
    expect(getterCalls).toBe(0);
  });

  it("isolates no-op receipts from caller-owned deserialized build state", () => {
    const restored = JSON.parse(JSON.stringify(equipItem(createBuild({ stats: { attack: 4 } }), {
      instanceId: "helm-1",
      itemId: "mithril-helm",
    }).build));
    const repeated = equipItem(restored, { instanceId: "helm-1", itemId: "mithril-helm" });
    const missing = removeItem(restored, "missing");

    restored.baseStats.attack = 99;
    expect(repeated.build.baseStats.attack).toBe(4);
    expect(missing.build.baseStats.attack).toBe(4);
    expect(Object.isFrozen(repeated.build)).toBe(true);
    expect(Object.isFrozen(missing.build)).toBe(true);
  });

  it("fails with a stable invalid-build error for unknown persisted items", () => {
    const forged = JSON.parse(JSON.stringify(createBuild()));
    forged.items.push({ instanceId: "unknown-1", itemId: "unknown" });

    expect(() => deriveBuild(forged)).toThrow("invalid-build");
  });

  it("activates Steelification only when both configured trait thresholds are met", () => {
    const missingForceField = createBuild({ traits: { ironclad: 7 } });
    const completePair = createBuild({ traits: { ironclad: 1, "force-field": 1 } });

    expect(deriveBuild(missingForceField).fusions).toEqual([]);
    expect(deriveBuild(completePair).fusions).toEqual(["steelification"]);
  });

  it("grants direct base stats immutably while preserving equipped item instances", () => {
    const equipped = equipItem(createBuild({ stats: { attack: 4, defense: 2 } }), {
      instanceId: "helm-1",
      itemId: "mithril-helm",
    }).build;
    const granted = grantBaseStat(equipped, { statId: "attack", amount: 1 });

    expect(granted).toMatchObject({ ok: true, applied: true });
    expect(deriveBuild(granted.build)).toMatchObject({
      stats: { attack: 5, defense: 4 },
      items: [{ instanceId: "helm-1", itemId: "mithril-helm" }],
    });
    expect(deriveBuild(equipped).stats.attack).toBe(4);
  });

  it("rejects unsafe or overflowing base-stat arithmetic atomically", () => {
    expect(() => createBuild({ stats: { attack: Number.MAX_VALUE } })).toThrow(
      "invalid-stat:attack",
    );
    const saturated = createBuild({ stats: { attack: MAX_BUILD_STAT } });

    expect(grantBaseStat(saturated, { statId: "attack", amount: 1 })).toEqual({
      ok: false,
      reason: "stat-cap-exceeded",
      build: saturated,
    });
    expect(deriveBuild(saturated).stats.attack).toBe(MAX_BUILD_STAT);
  });

  it("grants bounded reference trait levels without accepting unknown traits", () => {
    const build = createBuild({ traits: { ironclad: 6 } });
    const granted = grantBaseTrait(build, { traitId: "ironclad", levels: 4 });

    expect(granted).toMatchObject({ ok: true, applied: true });
    expect(deriveBuild(granted.build).traits.ironclad).toBe(7);
    expect(grantBaseTrait(build, { traitId: "missing", levels: 1 })).toEqual({
      ok: false,
      reason: "unknown-trait",
      build,
    });
  });
});
