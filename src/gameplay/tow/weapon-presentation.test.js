import { describe, expect, it } from "vitest";
import { itemTemplate } from "../../data/catalog.js";
import {
  COMBAT_WEAPON_FAMILIES,
  weaponPresentationForCharacter,
  weaponPresentationFromItemIds,
} from "./weapon-presentation.js";

describe("equipment-led basic attack presentation", () => {
  it("gives every combat weapon family its own action identity", () => {
    expect(COMBAT_WEAPON_FAMILIES).toEqual([
      "dagger", "sword", "axe", "mace", "spear", "bow", "crossbow", "arcane", "unarmed",
    ]);
    const actions = new Set([
      weaponPresentationFromItemIds(["twin-daggers"]).actionName,
      weaponPresentationFromItemIds(["arming-sword"]).actionName,
      weaponPresentationFromItemIds(["battle-axe"]).actionName,
      weaponPresentationFromItemIds(["iron-mace"]).actionName,
      weaponPresentationFromItemIds(["iron-spear"]).actionName,
      weaponPresentationFromItemIds(["hunting-bow"]).actionName,
      weaponPresentationFromItemIds(["light-crossbow"]).actionName,
      weaponPresentationFromItemIds(["oak-staff"]).actionName,
      weaponPresentationFromItemIds([]).actionName,
    ]);
    expect(actions.size).toBe(9);
  });

  it("keys handcrafted starting actions to the item, not the archetype", () => {
    expect(weaponPresentationFromItemIds(["arming-sword"])).toMatchObject({
      family: "sword",
      itemId: "arming-sword",
      actionName: "Measured Cut",
    });
    expect(weaponPresentationFromItemIds(["kingsguard-blade"])).toMatchObject({
      family: "sword",
      itemId: "kingsguard-blade",
      actionName: "Kingsguard Riposte",
    });
    expect(weaponPresentationFromItemIds(["wyrmscale-greatblade"])).toMatchObject({
      family: "sword",
      itemId: "wyrmscale-greatblade",
      actionName: "Wyrmscale Cleave",
    });
  });

  it("reads the same canonical worn record as Solitaire combat stats", () => {
    const codex = {
      items: {
        bow: itemTemplate("hunting-bow"),
        blade: itemTemplate("arming-sword"),
      },
      characters: { hero: { worn: ["bow", "blade"] } },
    };
    expect(weaponPresentationForCharacter({ id: "hero" }, codex)).toMatchObject({
      family: "bow",
      weaponName: "Hunting Bow",
    });
  });

  it("falls back safely to an unarmed strike", () => {
    expect(weaponPresentationFromItemIds(["unknown-item"])).toMatchObject({
      family: "unarmed",
      familyLabel: "Unarmed",
      itemId: null,
      weaponName: "Unarmed",
      actionName: "Unarmed Strike",
      activeFormId: "unarmed-fundamental",
      attackSnapshot: { formId: "unarmed-fundamental" },
    });
  });
});
