import { describe, expect, it } from "vitest";
import {
  STARTING_COMBAT_ITEMS,
  combatItemsFromInventory,
  normalizeCombatItems,
  settleCombatItems,
  spentCombatItems,
} from "./combat-items.js";

describe("Tower combat consumables", () => {
  it("offers four distinct one-action starting keepsakes", () => {
    expect(STARTING_COMBAT_ITEMS.map((item) => item.id)).toEqual([
      "crimson-vial", "lucid-tonic", "warding-ash", "fire-pot",
    ]);
    expect(STARTING_COMBAT_ITEMS.every((item) => item.consumesTurn)).toBe(true);
    expect(new Set(STARTING_COMBAT_ITEMS.map((item) => item.effect.type)).size).toBe(4);
  });

  it("snapshots only canonical combat items from carried inventory", () => {
    const inventory = {
      carried: [
        { itemId: "crimson-vial", quantity: 1 },
        { itemId: "crimson-vial", quantity: 2 },
        { itemId: "bedroll", quantity: 1 },
        { itemId: "fire-pot", quantity: 1 },
      ],
    };
    expect(combatItemsFromInventory(inventory)).toEqual([
      { id: "crimson-vial", quantity: 3 },
      { id: "fire-pot", quantity: 1 },
    ]);
    expect(normalizeCombatItems([{ id: "nonsense", quantity: 9 }])).toEqual([]);
  });

  it("derives the exact spend from events and removes it from the durable pack", () => {
    const encounter = {
      playerId: "wanderer",
      events: [
        { type: "combat-item-used", actorId: "wanderer", itemId: "crimson-vial" },
        { type: "combat-item-used", actorId: "ally", itemId: "crimson-vial" },
      ],
    };
    const spent = spentCombatItems(encounter);
    expect(spent).toEqual({ "crimson-vial": 1 });
    expect(settleCombatItems({
      carried: [
        { itemId: "crimson-vial", quantity: 1 },
        { itemId: "bedroll", quantity: 1 },
      ],
    }, spent)).toEqual({ carried: [{ itemId: "bedroll", quantity: 1 }] });
  });

  it("spends once across legacy duplicate stacks instead of charging every stack", () => {
    expect(settleCombatItems({
      carried: [
        { itemId: "fire-pot", quantity: 1 },
        { itemId: "fire-pot", quantity: 2 },
      ],
    }, { "fire-pot": 2 })).toEqual({
      carried: [{ itemId: "fire-pot", quantity: 1 }],
    });
  });
});
