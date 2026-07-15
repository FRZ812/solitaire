import { describe, expect, it } from "vitest";
import { ALL_ITEMS } from "../data/catalog.js";
import { itemIconTaxonomy } from "./item-icon-taxonomy.js";

const EQUIPMENT_KEYS = new Set([
  "dagger", "sword", "axe", "mace",
  "spear", "bow", "crossbow", "arcane",
  "shield", "armor-light", "armor-heavy", "head",
  "hands", "feet", "back-or-cloak", "trinket",
]);

const ITEM_KEYS = new Set([
  "remedy", "food", "drink",
  "tool", "light", "camp",
  "material", "rune", "key-item",
]);

describe("item icon taxonomy", () => {
  it("maps every current catalog item to a valid category cell", () => {
    const unexpectedFallbacks = [];

    for (const item of Object.values(ALL_ITEMS)) {
      const taxonomy = itemIconTaxonomy(item);
      const allowedKeys = taxonomy.atlas === "equipment" ? EQUIPMENT_KEYS : ITEM_KEYS;

      expect(allowedKeys.has(taxonomy.key), item.id).toBe(true);
      expect(taxonomy.column, item.id).toBeGreaterThanOrEqual(0);
      expect(taxonomy.column, item.id).toBeLessThan(taxonomy.columns);
      expect(taxonomy.row, item.id).toBeGreaterThanOrEqual(0);
      expect(taxonomy.row, item.id).toBeLessThan(taxonomy.rows);
      expect(taxonomy.key, item.id).not.toBe(item.id);

      if (taxonomy.key === "key-item") unexpectedFallbacks.push(item.id);
    }

    expect(unexpectedFallbacks).toEqual([]);
  });

  it.each([
    ["iron-dagger", "dagger", 0, 0],
    ["arming-sword", "sword", 1, 0],
    ["battle-axe", "axe", 2, 0],
    ["iron-mace", "mace", 3, 0],
    ["iron-spear", "spear", 0, 1],
    ["hunting-bow", "bow", 1, 1],
    ["light-crossbow", "crossbow", 2, 1],
    ["oak-staff", "arcane", 3, 1],
    ["round-shield", "shield", 0, 2],
    ["padded-gambeson", "armor-light", 1, 2],
    ["full-plate", "armor-heavy", 2, 2],
    ["iron-helm", "head", 3, 2],
    ["leather-bracers", "hands", 0, 3],
    ["marching-boots", "feet", 1, 3],
    ["traveling-cloak", "back-or-cloak", 2, 3],
    ["iron-ring", "trinket", 3, 3],
  ])("maps equipment %s to %s", (itemId, key, column, row) => {
    expect(itemIconTaxonomy(undefined, itemId)).toMatchObject({
      atlas: "equipment",
      key,
      column,
      row,
      columns: 4,
      rows: 4,
    });
  });

  it.each([
    ["healing-salve", "remedy", 0, 0],
    ["trail-rations", "food", 1, 0],
    ["ale", "drink", 2, 0],
    ["rope-hemp", "tool", 0, 1],
    ["torch", "light", 1, 1],
    ["bedroll", "camp", 2, 1],
    ["iron-ingot", "material", 0, 2],
    ["rune-of-flame", "rune", 1, 2],
  ])("maps item %s to %s", (itemId, key, column, row) => {
    expect(itemIconTaxonomy(undefined, itemId)).toMatchObject({
      atlas: "items",
      key,
      column,
      row,
      columns: 3,
      rows: 3,
    });
  });

  it("normalizes secondary kinds and unknown records to sensible shared cells", () => {
    expect(itemIconTaxonomy(undefined, "fodder").key).toBe("food");
    expect(itemIconTaxonomy({ kind: "camp-gear", name: "Travel Tent" }).key).toBe("camp");
    expect(itemIconTaxonomy({ kind: "quest-item", name: "Sealed Writ" })).toMatchObject({
      atlas: "items",
      key: "key-item",
      label: "Key item",
      column: 2,
      row: 2,
    });
    expect(itemIconTaxonomy({ kind: "clothing", slot: "legs", name: "Greaves" }).key).toBe("back-or-cloak");
    expect(itemIconTaxonomy(null, "missing-item-id").key).toBe("key-item");
  });
});
