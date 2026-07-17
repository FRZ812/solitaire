import { describe, it, expect } from "vitest";
import {
  weaponCategory, armorClass, itemCombatStats, weaponHands,
  equipSlot, slotCapacity, SLOTS, deriveCombatStats,
} from "./combat-stats.js";
import { enemyFromNPC } from "../data/bestiary.js";
import { attributeThresholdMods } from "../data/attribute-tiers.js";
import { resolvePoolForMind } from "./attributes.js";

describe("weaponCategory", () => {
  it("classifies by explicit type, then name keywords", () => {
    expect(weaponCategory({ combat: { weaponType: "axe" }, name: "Whatever" })).toBe("axe");
    expect(weaponCategory({ name: "Iron Dagger" })).toBe("dagger");
    expect(weaponCategory({ name: "Steel Crossbow" })).toBe("crossbow"); // before "bow"
    expect(weaponCategory({ name: "Yew Longbow" })).toBe("bow");
    expect(weaponCategory({ name: "Oak Staff" })).toBe("arcane");
    expect(weaponCategory({ kind: "weapon", name: "Nameless thing" })).toBe("sword"); // weapon fallback
    expect(weaponCategory({ name: "a rock" })).toBe(null); // not a weapon
    expect(weaponCategory(null)).toBe("unarmed");
  });
});

describe("armorClass", () => {
  it("reads explicit class, then infers heavy/light from the name", () => {
    expect(armorClass({ kind: "armor", armorClass: "heavy" })).toBe("heavy");
    expect(armorClass({ kind: "armor", name: "Plate Cuirass" })).toBe("heavy");
    expect(armorClass({ kind: "armor", name: "Chain Hauberk" })).toBe("heavy");
    expect(armorClass({ kind: "armor", name: "Leather Jerkin" })).toBe("light");
    expect(armorClass({ kind: "weapon", name: "Sword" })).toBe(null); // not armor
  });
});

describe("itemCombatStats", () => {
  it("passes through explicit combat stats and fills weapon family defaults", () => {
    const s = itemCombatStats({ name: "Blade", kind: "weapon", combat: { damage: { min: 5, max: 8, type: "physical", pen: 0 } } });
    expect(s.damage.min).toBe(5);
    expect(s.damage.max).toBe(8);
    expect(s.weaponType).toBe("sword");
    expect(typeof s.damage.reach).toBe("number"); // family default filled
  });

  it("derives armor from an armor name (scaled by tier)", () => {
    const s = itemCombatStats({ name: "Plate Armor", kind: "armor", tier: "common" });
    expect(s.armor).toBeGreaterThan(0);
    expect(s.damage).toBe(null);
  });

  it("returns the empty profile for nothing", () => {
    expect(itemCombatStats(null)).toEqual({ armor: 0, ward: 0, dodge: 0, damage: null, weaponType: null, armorClass: null });
  });
});

describe("weaponHands", () => {
  it("honours explicit hands, else infers from family/name", () => {
    expect(weaponHands({ hands: 2, name: "Dagger" })).toBe(2); // explicit wins
    expect(weaponHands({ name: "Yew Longbow" })).toBe(2);       // bow → 2h
    expect(weaponHands({ name: "Greatsword" })).toBe(2);        // great → 2h
    expect(weaponHands({ name: "Oak Wand" })).toBe(1);          // wand → 1h
    expect(weaponHands({ name: "Iron Sword" })).toBe(1);
    expect(weaponHands(null)).toBe(1);
  });
});

describe("equipSlot / slotCapacity", () => {
  it("maps items to paper-doll slots", () => {
    expect(equipSlot({ kind: "weapon", name: "Sword" })).toBe("mainhand");
    expect(equipSlot({ kind: "shield", name: "Buckler" })).toBe("offhand");
    expect(equipSlot({ kind: "armor", name: "Breastplate" })).toBe("body");
    expect(equipSlot({ kind: "trinket", name: "Signet Ring" })).toBe("ring");
    expect(equipSlot({ kind: "clothing", name: "Leather Boots" })).toBe("feet");
    expect(equipSlot({ slot: "head", kind: "clothing", name: "anything" })).toBe("head"); // explicit slot wins
    expect(equipSlot(null)).toBe(null);
  });

  it("only rings hold two; every other slot holds one", () => {
    expect(slotCapacity("ring")).toBe(2);
    expect(slotCapacity("mainhand")).toBe(1);
    expect(slotCapacity("nonexistent")).toBe(1);
    expect(SLOTS.find((s) => s.id === "ring").cap).toBe(2);
  });
});

describe("expanded attribute combat bounds", () => {
  const codex = { characters: { wanderer: { worn: [] } }, items: {} };
  const fighter = (score) => ({
    attributes: { body: score, reflex: score, vigor: score, mind: score, wit: score, presence: score },
    proficiencies: {}, vitalityMax: 1000,
  });

  it("keeps raw apex scores for thresholds while bounding direct combat formulas", () => {
    const oldCap = deriveCombatStats(fighter(30), codex);
    const apex = deriveCombatStats(fighter(90), codex);

    expect(apex.attrs.body).toBe(90);
    expect(apex.weapon.max).toBeGreaterThan(oldCap.weapon.max);
    expect(apex.weapon.max).toBeLessThanOrEqual(oldCap.weapon.max * 2);
    expect(apex.accuracy).toBeGreaterThan(oldCap.accuracy);
    expect(apex.accuracy).toBeLessThanOrEqual(oldCap.accuracy * 2);
    expect(apex.speed).toBeLessThanOrEqual(oldCap.speed * 2);
    expect(apex.armor).toBeLessThanOrEqual(oldCap.armor * 2);

    expect(apex.critChance).toBeLessThanOrEqual(100);
    expect(apex.dodge).toBeLessThanOrEqual(70);
    expect(apex.swiftChance).toBeLessThanOrEqual(0.5);
    expect(apex.phaseChance).toBeLessThanOrEqual(0.4);
    expect([apex.weapon.min, apex.weapon.max, apex.accuracy, apex.speed, apex.armor, apex.ward]
      .every(Number.isFinite)).toBe(true);
  });

  it("uses raw Mind exactly once for NPC Resolve, matching the player pool curve", () => {
    const attributes = { body: 1, reflex: 1, vigor: 1, mind: 90, wit: 1, presence: 1 };
    const enemy = enemyFromNPC({ id: "apex-mind", name: "Apex Mind", attributes, worn: [] }, { items: {} });
    const thresholdBonus = attributeThresholdMods(attributes).statMods.resolveMax || 0;

    expect(enemy.resolveMax).toBe(resolvePoolForMind(90) + thresholdBonus);
    expect(enemy.resolveMax).toBe(enemy.resolve);
  });
});
