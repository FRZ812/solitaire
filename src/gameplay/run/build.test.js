import { describe, expect, it } from "vitest";
import { createBuild, deriveBuild, equipItem, removeItem } from "./build.js";

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

  it("clamps every present positive trait level to at least one", () => {
    const build = createBuild({ traits: { ironclad: 0.25 } });

    expect(build.baseTraits).toEqual({ ironclad: 1 });
    expect(deriveBuild(build).traits).toEqual({ ironclad: 1 });
  });

  it("rejects coercible stat values without executing caller code", () => {
    let coercions = 0;
    const value = { valueOf: () => { coercions += 1; return 4; } };

    expect(() => createBuild({ stats: { attack: value } })).toThrow("invalid-stat:attack");
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
    expect(repeated.build).toBe(equipped.build);
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
      reason: "invalid-item-id",
      build,
    });
    expect(equipItem(build, { instanceId: () => "helm-1", itemId: "mithril-helm" })).toEqual({
      ok: false,
      reason: "invalid-item-instance",
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

  it("activates Steelification only when both configured trait thresholds are met", () => {
    const missingForceField = createBuild({ traits: { ironclad: 7 } });
    const completePair = createBuild({ traits: { ironclad: 1, "force-field": 1 } });

    expect(deriveBuild(missingForceField).fusions).toEqual([]);
    expect(deriveBuild(completePair).fusions).toEqual(["steelification"]);
  });
});
