import { describe, expect, it } from "vitest";
import {
  applyFusion,
  fusionIds,
  fusionOffer,
  getFusion,
  getTrait,
  hasTraitCapacity,
  isValidRank,
  TRAIT_CAPACITY,
  TRAIT_RANK_CAP,
  traitCadenceAtRank,
  traitCount,
  traitIds,
  traitValueAtRank,
  unmodelledStatusTypes,
} from "./traits.js";

describe("the catalogue", () => {
  it("carries every base trait the wiki lists", () => {
    expect(traitIds()).toHaveLength(35);
    for (const id of ["ironclad", "aegis", "agility", "swift", "detection", "reflection",
      "bloodsuck", "fury", "adaptation", "survival", "endurance", "guardian", "ambush",
      "anatomy", "quickness", "gale", "necromancy", "overheat", "accuracy", "assassin",
      "combo", "judgment"]) {
      expect(getTrait(id)).not.toBeNull();
    }
  });

  it("carries all eighteen fusions", () => {
    expect(fusionIds()).toHaveLength(18);
  });

  it("names only statuses the kernel models", () => {
    // Guards against the catalogue and the status engine drifting apart.
    expect(unmodelledStatusTypes()).toEqual([]);
  });

  it("marks character-exclusive traits", () => {
    expect(getTrait("valiancy").exclusiveTo).toBe("old-king-of-northland");
    expect(getTrait("assassin").exclusiveTo).toBe("last-assassin");
    expect(getTrait("combo").exclusiveTo).toBe("last-assassin");
    expect(getTrait("judgment").exclusiveTo).toBe("exiled-priestess");
    expect(getTrait("innovation").exclusiveTo).toBe("owner-of-clocktower");
    expect(getTrait("ironclad").exclusiveTo).toBeNull();
  });

  it("returns null for unknown ids rather than throwing", () => {
    expect(getTrait("nonsense")).toBeNull();
    expect(getTrait(null)).toBeNull();
    expect(getFusion("nonsense")).toBeNull();
  });
});

describe("rank scaling", () => {
  it("reproduces the evenly-divided spans exactly", () => {
    // Ironclad "Gain 1-13 Steelskin" over seven ranks.
    expect([1, 2, 3, 4, 5, 6, 7].map((rank) => traitValueAtRank("ironclad", rank)))
      .toEqual([1, 3, 5, 7, 9, 11, 13]);
    // Aegis "Gain 3-21 Protection".
    expect([1, 2, 3, 4, 5, 6, 7].map((rank) => traitValueAtRank("aegis", rank)))
      .toEqual([3, 6, 9, 12, 15, 18, 21]);
    // Survival "Gain 8-80 Grow".
    expect([1, 2, 3, 4, 5, 6, 7].map((rank) => traitValueAtRank("survival", rank)))
      .toEqual([8, 20, 32, 44, 56, 68, 80]);
    // Luck "Inflict 18-180 Misfortune".
    expect([1, 7].map((rank) => traitValueAtRank("luck", rank))).toEqual([18, 180]);
  });

  it("anchors every trait to its evidenced endpoints", () => {
    for (const id of traitIds()) {
      const { min, max } = getTrait(id).effect;
      expect(traitValueAtRank(id, 1)).toBe(min);
      expect(traitValueAtRank(id, TRAIT_RANK_CAP)).toBe(max);
    }
  });

  it("never decreases as rank rises", () => {
    for (const id of traitIds()) {
      for (let rank = 2; rank <= TRAIT_RANK_CAP; rank += 1) {
        expect(traitValueAtRank(id, rank)).toBeGreaterThanOrEqual(traitValueAtRank(id, rank - 1));
      }
    }
  });

  it("rejects ranks outside one to seven", () => {
    for (const rank of [0, 8, -1, 1.5, NaN, "3", undefined]) {
      expect(isValidRank(rank)).toBe(false);
      expect(() => traitValueAtRank("ironclad", rank)).toThrow(/invalid-trait-rank/);
    }
    expect(() => traitValueAtRank("nonsense", 1)).toThrow(/unknown-trait/);
  });
});

describe("cadence scaling", () => {
  it("scales a chance rather than an amount where the wiki says so", () => {
    // Agility: "Gain 1 Evade each turn with a 2-23% chance".
    expect(traitCadenceAtRank("agility", 1)).toEqual({ type: "every-turn-chance", chancePercent: 2 });
    expect(traitCadenceAtRank("agility", 7)).toEqual({ type: "every-turn-chance", chancePercent: 23 });
    expect(traitValueAtRank("agility", 7)).toBe(1);
  });

  it("shortens an interval as rank rises", () => {
    // Charge: "Gain 100 Charge every 5-2 turns".
    expect(traitCadenceAtRank("charge", 1)).toEqual({ type: "every-n-turns", turns: 5 });
    expect(traitCadenceAtRank("charge", 7)).toEqual({ type: "every-n-turns", turns: 2 });
    expect(traitValueAtRank("charge", 1)).toBe(100);
  });

  it("returns null for a cadence that does not scale", () => {
    expect(traitCadenceAtRank("ironclad", 4)).toBeNull();
    expect(traitCadenceAtRank("detection", 4)).toBeNull();
    expect(getTrait("detection").cadence).toEqual({ type: "every-n-turns", turns: 4 });
  });
});

describe("fusion", () => {
  const maxed = (...ids) => Object.fromEntries(ids.map((id) => [id, TRAIT_RANK_CAP]));

  it("pairs Metalize from Ironclad and Aegis, not Ironclad and Force Field", () => {
    const metalize = getFusion("metalize");
    expect(metalize.components).toEqual(["aegis", "ironclad"]);
    expect(metalize.rune).toBe("rune-of-metal");
    expect(metalize.effect).toMatchObject({ status: "steelskin", min: 40, max: 40 });
  });

  it("offers only when both components are at rank seven and the rune is held", () => {
    expect(fusionOffer("metalize", {
      traits: maxed("ironclad", "aegis"),
      runes: ["rune-of-metal"],
    }).ok).toBe(true);

    expect(fusionOffer("metalize", {
      traits: { ironclad: TRAIT_RANK_CAP, aegis: 6 },
      runes: ["rune-of-metal"],
    })).toMatchObject({ ok: false, reason: "component-below-rank-cap" });

    expect(fusionOffer("metalize", {
      traits: maxed("ironclad"),
      runes: ["rune-of-metal"],
    })).toMatchObject({ ok: false, reason: "missing-component" });

    expect(fusionOffer("metalize", {
      traits: maxed("ironclad", "aegis"),
      runes: [],
    })).toMatchObject({ ok: false, reason: "missing-rune" });
  });

  it("will not offer a fusion whose rune is not yet evidenced", () => {
    // Breakdown's pairing is known; its rune is not. Refusing to offer is the honest
    // behaviour — inventing a rune id would bake a guess into save data.
    expect(getFusion("breakdown").runeEvidence).toBe("gap");
    expect(fusionOffer("breakdown", {
      traits: maxed("ambush", "anatomy"),
      runes: ["rune-of-metal"],
    })).toMatchObject({ ok: false, reason: "unresolved-rune" });
  });

  it("consumes both components and grants the fusion at max rank", () => {
    const result = applyFusion("metalize", {
      traits: { ...maxed("ironclad", "aegis"), swift: 3 },
      runes: ["rune-of-metal"],
    });
    expect(result.ok).toBe(true);
    expect(result.traits).toEqual({ swift: 3, metalize: TRAIT_RANK_CAP });
    expect(result.traits.ironclad).toBeUndefined();
    expect(result.traits.aegis).toBeUndefined();
  });

  it("does not mutate the build it is given", () => {
    const traits = maxed("ironclad", "aegis");
    const before = JSON.stringify(traits);
    applyFusion("metalize", { traits, runes: ["rune-of-metal"] });
    expect(JSON.stringify(traits)).toBe(before);
  });

  it("refuses to fuse when the offer would be refused", () => {
    expect(applyFusion("metalize", { traits: maxed("ironclad"), runes: ["rune-of-metal"] }))
      .toEqual({ ok: false, reason: "missing-component", traits: null });
    expect(applyFusion("nonsense", { traits: {}, runes: [] }))
      .toEqual({ ok: false, reason: "unknown-fusion", traits: null });
  });

  it("ignores inherited properties when reading a build", () => {
    const traits = Object.create({ ironclad: TRAIT_RANK_CAP, aegis: TRAIT_RANK_CAP });
    expect(fusionOffer("metalize", { traits, runes: ["rune-of-metal"] }))
      .toMatchObject({ ok: false, reason: "missing-component" });
  });
});

describe("build capacity", () => {
  it("holds at most ten traits", () => {
    expect(TRAIT_CAPACITY).toBe(10);
    const nine = Object.fromEntries(traitIds().slice(0, 9).map((id) => [id, 1]));
    expect(traitCount(nine)).toBe(9);
    expect(hasTraitCapacity(nine)).toBe(true);

    const ten = Object.fromEntries(traitIds().slice(0, 10).map((id) => [id, 1]));
    expect(hasTraitCapacity(ten)).toBe(false);
  });

  it("frees a slot when a fusion consumes two traits", () => {
    const full = {
      ...Object.fromEntries(traitIds().slice(0, 8).filter((id) => id !== "ironclad" && id !== "aegis").map((id) => [id, 1])),
      ironclad: TRAIT_RANK_CAP,
      aegis: TRAIT_RANK_CAP,
    };
    const fused = applyFusion("metalize", { traits: full, runes: ["rune-of-metal"] });
    expect(traitCount(fused.traits)).toBe(traitCount(full) - 1);
  });
});
