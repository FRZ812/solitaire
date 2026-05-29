import { describe, it, expect } from "vitest";
import {
  CP_PER_SP, CP_PER_GP,
  coinsToCopper, copperToCoins, canAfford, formatCopper,
  usedSellPrice, DEFAULT_RESALE_RATE, SELLABLE_KINDS,
  buyGood, sellGood,
} from "./economy.js";

// Characterization tests — lock in CURRENT behavior of the coin economy so the
// Stage-1 combat-loot extraction (which also fixes the loot denomination bug)
// can be verified against a known baseline.

describe("coin conversion", () => {
  it("sums denominations into copper (1sp=10cp, 1gp=100cp)", () => {
    expect(CP_PER_SP).toBe(10);
    expect(CP_PER_GP).toBe(100);
    expect(coinsToCopper({ copper: 3, silver: 2, gold: 1 })).toBe(3 + 20 + 100);
    expect(coinsToCopper(null)).toBe(0);
    expect(coinsToCopper({})).toBe(0);
  });

  it("re-expresses copper greedily into the largest denominations", () => {
    expect(copperToCoins(305)).toEqual({ gold: 3, silver: 0, copper: 5 });
    expect(copperToCoins(0)).toEqual({ gold: 0, silver: 0, copper: 0 });
    expect(copperToCoins(-50)).toEqual({ gold: 0, silver: 0, copper: 0 }); // clamps ≥0
    expect(copperToCoins(9.9)).toEqual({ gold: 0, silver: 0, copper: 9 });  // floors
  });

  it("round-trips copper → coins → copper for arbitrary values", () => {
    for (const cp of [0, 1, 9, 10, 99, 100, 250, 1234, 99999]) {
      expect(coinsToCopper(copperToCoins(cp))).toBe(cp);
    }
  });

  it("canAfford compares total copper against a price", () => {
    expect(canAfford({ gold: 1 }, 100)).toBe(true);
    expect(canAfford({ gold: 1 }, 101)).toBe(false);
    expect(canAfford({ silver: 5, copper: 5 }, 55)).toBe(true);
  });

  it("formatCopper drops empty denominations but always shows ≥0cp", () => {
    expect(formatCopper(0)).toBe("0cp");
    expect(formatCopper(305)).toBe("3gp 5cp");
    expect(formatCopper(20)).toBe("2sp");
    expect(formatCopper(123)).toBe("1gp 2sp 3cp");
  });
});

describe("resale pricing", () => {
  it("uses a 0.65 default resale rate, floored at 1", () => {
    expect(DEFAULT_RESALE_RATE).toBe(0.65);
    expect(usedSellPrice(100)).toBe(65);
    expect(usedSellPrice(1)).toBe(1); // floor
    expect(usedSellPrice(0)).toBe(1); // floor
    expect(usedSellPrice(100, 0.5)).toBe(50);
  });

  it("declares which item kinds a trader buys back", () => {
    expect(SELLABLE_KINDS.has("food")).toBe(true);
    expect(SELLABLE_KINDS.has("weapon")).toBe(false); // worn equipment isn't bought back here
  });
});

// Minimal state fixture for buy/sell — only the fields these functions touch.
function shopState(coins = { gold: 0, silver: 0, copper: 0 }, carried = []) {
  return {
    time: { day: 1 },
    character: { inventory: { coins, carried }, carryCapacityMax: 9999 },
    world: {
      tiles: { "0,0": { x: 0, y: 0, terrain: "settlement" } },
      codex: { characters: { wanderer: { id: "wanderer", worn: [] } }, items: {} },
    },
  };
}

describe("buyGood / sellGood", () => {
  const apple = { id: "apple", name: "Apple", kind: "food", weight: 1, value: 5 };

  it("deducts coin, files the item in the codex, and drops it in the pack", () => {
    const r = buyGood(shopState({ gold: 0, silver: 1, copper: 0 }), {
      tileKey: "0,0", bucket: "b1", itemDef: apple, priceCp: 5, qty: 2,
    });
    expect(r.ok).toBe(true);
    expect(coinsToCopper(r.state.character.inventory.coins)).toBe(10 - 10); // 1sp - 2×5cp = 0
    expect(r.state.character.inventory.carried).toEqual([{ itemId: "apple", quantity: 2 }]);
    expect(r.state.world.codex.items.apple).toBeTruthy();
    expect(r.state.world.tiles["0,0"].shop.sold.apple).toBe(2);
  });

  it("refuses a purchase the player can't afford", () => {
    const r = buyGood(shopState({ copper: 4 }), { tileKey: "0,0", bucket: "b1", itemDef: apple, priceCp: 5, qty: 1 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/coin/i);
  });

  it("refuses a purchase that would exceed the carry cap", () => {
    const heavy = { id: "anvil", name: "Anvil", kind: "material", weight: 500, value: 1 };
    const st = shopState({ gold: 99 });
    st.character.carryCapacityMax = 10;
    const r = buyGood(st, { tileKey: "0,0", bucket: "b1", itemDef: heavy, priceCp: 1, qty: 1 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/carry/i);
  });

  it("sellGood removes the stack and credits coin", () => {
    const st = shopState({ copper: 0 }, [{ itemId: "apple", quantity: 3 }]);
    const r = sellGood(st, { itemId: "apple", priceCp: 4, qty: 2 });
    expect(r.ok).toBe(true);
    expect(coinsToCopper(r.state.character.inventory.coins)).toBe(8);
    expect(r.state.character.inventory.carried).toEqual([{ itemId: "apple", quantity: 1 }]);
  });

  it("sellGood refuses what the player doesn't have", () => {
    const r = sellGood(shopState(), { itemId: "ghost", priceCp: 4, qty: 1 });
    expect(r.ok).toBe(false);
  });
});
