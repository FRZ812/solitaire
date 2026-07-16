import { describe, expect, it } from "vitest";
import { itemTemplate } from "../data/catalog.js";
import {
  BUILDINGS,
  MARKET_PRICE_TIERS,
  buildingForTile,
  marketPriceTierVisual,
} from "../data/town.js";
import { tierColor } from "../data/tiers.js";
import { rollShopStock } from "./town-gen.js";

describe("location market tiers", () => {
  it("maps shop tiers onto the same visual progression used by skill tiers", () => {
    const expected = [
      ["budget", "common", "B"],
      ["standard", "uncommon", "S"],
      ["premium", "rare", "P"],
      ["noble", "very-rare", "N"],
      ["royal", "epic", "R"],
      ["mastercraft", "legendary", "M"],
    ];

    for (const [marketTier, qualityTier, marker] of expected) {
      expect(marketPriceTierVisual(marketTier)).toMatchObject({
        id: marketTier,
        qualityTier,
        marker,
        color: tierColor(qualityTier),
      });
    }
  });

  it("keeps authored shop identity while applying the location's tier and price scale", () => {
    const tile = {
      districtName: "Low Wards",
      poi: {
        service: "general-store",
        name: "Rag-and-Bone Exchange",
        description: "A deliberately cheap resale counter.",
        part: "rag-and-bone",
        marketTier: "budget",
      },
    };

    expect(buildingForTile(tile)).toMatchObject({
      id: "general-store",
      label: "Rag-and-Bone Exchange",
      blurb: "A deliberately cheap resale counter.",
      locationId: "rag-and-bone",
      marketTier: "budget",
      marketTierLabel: "Budget house",
      priceScale: MARKET_PRICE_TIERS.budget.priceScale,
    });
  });

  it("changes asking prices by market tier without changing the deterministic stock roll", () => {
    const stockRule = {
      id: "price-check",
      stock: [{ id: "healing-salve", chance: 1, qty: [1, 1], priceMult: 1 }],
    };
    const budget = rollShopStock({ ...stockRule, priceScale: MARKET_PRICE_TIERS.budget.priceScale }, "same-shop", 0);
    const standard = rollShopStock({ ...stockRule, priceScale: MARKET_PRICE_TIERS.standard.priceScale }, "same-shop", 0);
    const mastercraft = rollShopStock({ ...stockRule, priceScale: MARKET_PRICE_TIERS.mastercraft.priceScale }, "same-shop", 0);

    expect(budget.items.map(({ itemId, qty }) => ({ itemId, qty })))
      .toEqual(standard.items.map(({ itemId, qty }) => ({ itemId, qty })));
    expect(mastercraft.items.map(({ itemId, qty }) => ({ itemId, qty })))
      .toEqual(standard.items.map(({ itemId, qty }) => ({ itemId, qty })));
    expect(budget.items[0].price).toBeLessThan(standard.items[0].price);
    expect(mastercraft.items[0].price).toBeGreaterThan(standard.items[0].price);
    expect(rollShopStock({ ...stockRule, priceScale: MARKET_PRICE_TIERS.mastercraft.priceScale }, "same-shop", 0))
      .toEqual(mastercraft);
  });

  it("reserves epic stock for Royal houses and legendary non-unique stock for Mastercraft houses", () => {
    const expectedTierByService = {
      "royal-armourer": "epic",
      "royal-arcana": "epic",
      "mastercraft-forge": "legendary",
      "mastercraft-arcana": "legendary",
    };

    for (const [service, expectedTier] of Object.entries(expectedTierByService)) {
      const building = BUILDINGS[service];
      expect(building.stock.length, service).toBeGreaterThan(0);
      for (const entry of building.stock) {
        const item = itemTemplate(entry.id);
        expect(item, `${service}:${entry.id}`).toBeTruthy();
        expect(item.tier, `${service}:${entry.id}`).toBe(expectedTier);
        expect(item.unique, `${service}:${entry.id}`).not.toBe(true);
      }
    }
  });
});
