import { describe, expect, it } from "vitest";
import { equipItem, transferItem, unequipItem } from "./inventory.js";

const ITEMS = {
  ration: { id: "ration", name: "Trail ration", kind: "food", weight: 2 },
  sword: { id: "sword", name: "Arming sword", kind: "weapon", slot: "mainhand", weight: 3 },
  axe: { id: "axe", name: "Battle axe", kind: "weapon", slot: "mainhand", weight: 4 },
};

function inventory(carried = [], coins = { copper: 0, silver: 0, gold: 0 }) {
  return { carried, coins };
}

function stateWithParty({
  playerCarried = [],
  companionCarried = [],
  playerCapacity = 20,
  companionCapacity = 20,
  companionWorn = [],
} = {}) {
  return {
    party: ["ally"],
    character: {
      abilities: [],
      carryCapacityMax: playerCapacity,
      overburdened: false,
      inventory: inventory(playerCarried, { copper: 7, silver: 0, gold: 0 }),
    },
    world: {
      codex: {
        items: ITEMS,
        spells: {},
        characters: {
          wanderer: { id: "wanderer", worn: [], knows: [] },
          ally: {
            id: "ally",
            name: "Ari",
            kind: "companion",
            attributes: {},
            worn: companionWorn,
            carryCapacityMax: companionCapacity,
            overburdened: false,
            inventory: inventory(companionCarried),
          },
        },
      },
    },
  };
}

describe("transferItem", () => {
  it("moves a partial stack from the wanderer to a companion without mutating the input", () => {
    const state = stateWithParty({
      playerCarried: [{ itemId: "ration", quantity: 3, freshUntil: 8 }],
    });

    const result = transferItem(state, "wanderer", "ally", "ration", 2);

    expect(result.ok).toBe(true);
    expect(result.state.character.inventory.carried).toEqual([
      { itemId: "ration", quantity: 1, freshUntil: 8 },
    ]);
    expect(result.state.world.codex.characters.ally.inventory.carried).toEqual([
      { itemId: "ration", quantity: 2, freshUntil: 8 },
    ]);
    expect(state.character.inventory.carried[0].quantity).toBe(3);
    expect(state.world.codex.characters.ally.inventory.carried).toEqual([]);
  });

  it("moves items back to the wanderer and keeps the earliest expiry when stacks merge", () => {
    const state = stateWithParty({
      playerCarried: [{ itemId: "ration", quantity: 1, freshUntil: 12 }],
      companionCarried: [{ itemId: "ration", quantity: 2, freshUntil: 6 }],
    });

    const result = transferItem(state, "ally", "wanderer", "ration", 2);

    expect(result.ok).toBe(true);
    expect(result.state.character.inventory.carried).toEqual([
      { itemId: "ration", quantity: 3, freshUntil: 6 },
    ]);
    expect(result.state.world.codex.characters.ally.inventory.carried).toEqual([]);
    expect(result.state.character.inventory.coins.copper).toBe(7);
  });

  it("rejects a transfer that would exceed the destination carry capacity", () => {
    const state = stateWithParty({
      playerCarried: [{ itemId: "ration", quantity: 2 }],
      companionCapacity: 3,
    });

    const result = transferItem(state, "wanderer", "ally", "ration", 2);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/cannot carry/i);
    expect(result.state).toBe(state);
  });

  it("rejects invalid quantities and characters outside the current party", () => {
    const state = stateWithParty({ playerCarried: [{ itemId: "ration", quantity: 2 }] });
    const absent = {
      ...state,
      party: [],
    };

    expect(transferItem(state, "wanderer", "ally", "ration", 0).ok).toBe(false);
    expect(transferItem(state, "wanderer", "ally", "ration", 3).ok).toBe(false);
    expect(transferItem(absent, "wanderer", "ally", "ration", 1).ok).toBe(false);
  });
});

describe("party equipment routing", () => {
  it("equips and unequips a transferred companion item", () => {
    const state = stateWithParty({
      companionCarried: [{ itemId: "sword", quantity: 1 }],
      companionWorn: ["axe"],
    });

    const equipped = equipItem(state, "sword", "ally");
    expect(equipped.world.codex.characters.ally.worn).toEqual(["sword"]);
    expect(equipped.world.codex.characters.ally.inventory.carried).toEqual([
      { itemId: "axe", quantity: 1 },
    ]);

    const unequipped = unequipItem(equipped, "sword", "ally");
    expect(unequipped.world.codex.characters.ally.worn).toEqual([]);
    expect(unequipped.world.codex.characters.ally.inventory.carried).toEqual([
      { itemId: "axe", quantity: 1 },
      { itemId: "sword", quantity: 1 },
    ]);
  });
});

describe("Tower on-equip ability grants", () => {
  const mixedRelic = {
    id: "mixed-relic",
    name: "Mixed Relic",
    kind: "trinket",
    slot: "neck",
    grants: {
      abilities: [
        { id: "power-strike", tier: "rare" },
        { id: "invented-cut", tier: "epic" },
        { id: "haste", tier: "uncommon" },
      ],
      spells: [{ id: "road-lore", name: "Road Lore", description: "Old paths remembered." }],
      magicKnows: "The old roads remember my tread.",
    },
  };

  function mixedGrantState({ tower = true } = {}) {
    const state = stateWithParty({ playerCarried: [{ itemId: mixedRelic.id, quantity: 1 }] });
    if (tower) state.character.progressionModel = "tow-archetype";
    state.world.codex.items = {
      ...state.world.codex.items,
      [mixedRelic.id]: mixedRelic,
      "old-save-relic": {
        id: "old-save-relic",
        name: "Old Save Relic",
        kind: "trinket",
        _granted: { abilities: ["firebolt"], spells: ["old-lore"], knows: "Old knowledge." },
      },
    };
    return state;
  }

  it("records only allowed abilities while preserving spell lore, knowledge, and old grant records", () => {
    const state = mixedGrantState();
    const oldGrant = structuredClone(state.world.codex.items["old-save-relic"]._granted);

    const equipped = equipItem(state, mixedRelic.id);

    expect(equipped.character.abilities).toEqual([{ id: "haste", tier: "rare" }]);
    expect(equipped.world.codex.spells).toHaveProperty("road-lore");
    expect(equipped.world.codex.characters.wanderer.knows).toContain("The old roads remember my tread.");
    expect(equipped.world.codex.items[mixedRelic.id]._granted).toEqual({
      abilities: ["haste"],
      spells: ["road-lore"],
      knows: "The old roads remember my tread.",
    });
    expect(equipped.world.codex.items["old-save-relic"]._granted).toEqual(oldGrant);
    expect(state.character.abilities).toEqual([]);
  });

  it("leaves mixed grants unchanged for legacy characters", () => {
    const equipped = equipItem(mixedGrantState({ tower: false }), mixedRelic.id);

    expect(equipped.character.abilities).toEqual([
      { id: "power-strike", tier: "rare" },
      { id: "invented-cut", tier: "epic" },
      { id: "haste", tier: "uncommon" },
    ]);
    expect(equipped.world.codex.items[mixedRelic.id]._granted.abilities).toEqual(["power-strike", "invented-cut", "haste"]);
  });
});
