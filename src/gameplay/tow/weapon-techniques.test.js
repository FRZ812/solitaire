import { describe, expect, it } from "vitest";
import { itemTemplate } from "../../data/catalog.js";
import {
  isWeaponAttackSnapshot,
  weaponAttackAtRank,
  weaponAttackSnapshot,
  weaponAttackSummary,
  weaponTechniqueFromItemIds,
} from "./weapon-techniques.js";

describe("equipment-owned basic attack lineages", () => {
  it("keeps the paired starting attack complete and rankable in place", () => {
    const technique = weaponTechniqueFromItemIds(["nightfang-dagger"]);
    const base = weaponAttackSnapshot(technique);

    expect(technique.activeFormId).toBe("nightfang-hush");
    expect(technique.forms.map((form) => form.id)).toEqual([
      "nightfang-hush", "threefold-shadow", "silencing-cut",
    ]);
    expect(weaponAttackAtRank(base, 1)).toMatchObject({ hits: 2, damagePercent: 50 });
    expect(weaponAttackAtRank(base, 6)).toMatchObject({ hits: 2, damagePercent: 88 });
    expect(weaponAttackSummary(base, 6)).toContain("2 hits");
    expect(base.formId).toBe("nightfang-hush");
  });

  it("treats the triple and debuff forms as optional siblings", () => {
    const triple = weaponTechniqueFromItemIds(["nightfang-dagger"], {}, { formId: "threefold-shadow" });
    const debuff = weaponTechniqueFromItemIds(["nightfang-dagger"], {}, { formId: "silencing-cut" });

    expect(weaponAttackAtRank(weaponAttackSnapshot(triple), 1)).toMatchObject({
      hits: 3,
      damagePercent: 34,
      statusEffects: [],
    });
    expect(weaponAttackAtRank(weaponAttackSnapshot(debuff), 1)).toMatchObject({
      hits: 1,
      damagePercent: 90,
      statusEffects: [{ status: "lethargy", percent: 25 }],
    });
  });

  it("reads a selected refinement from the equipped item record", () => {
    const codex = {
      items: {
        heirloom: { ...itemTemplate("twin-daggers"), towAttackFormId: "hamstring-cut" },
      },
    };
    const technique = weaponTechniqueFromItemIds(["heirloom"], codex);
    expect(technique.itemId).toBe("heirloom");
    expect(technique.activeFormId).toBe("hamstring-cut");
    expect(isWeaponAttackSnapshot(weaponAttackSnapshot(technique))).toBe(true);
  });

  it("gives every handcrafted starting weapon a base plus two refinements", () => {
    for (const itemId of [
      "arming-sword", "hunting-bow", "twin-daggers", "dawnward-mace",
      "oak-staff", "kingsguard-blade", "nightfang-dagger", "wyrmscale-greatblade",
    ]) {
      const technique = weaponTechniqueFromItemIds([itemId]);
      expect(technique.forms, itemId).toHaveLength(3);
      expect(new Set(technique.forms.map((form) => form.id)).size, itemId).toBe(3);
      expect(isWeaponAttackSnapshot(weaponAttackSnapshot(technique)), itemId).toBe(true);
    }
  });
});
