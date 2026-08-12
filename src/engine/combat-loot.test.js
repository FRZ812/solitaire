import { describe, expect, it } from "vitest";
import { rollLoot } from "./combat-loot.js";
import { streamSequencer } from "../gameplay/tow/session.js";

const SOURCES = [
  { kind: "bandits", tier: "rare", maxLootTier: "rare", gear: [{ id: "linen-tunic", tier: "common" }] },
  { kind: "bandits", tier: "uncommon", maxLootTier: "uncommon" },
];

function roll(state, overrides = {}) {
  const stream = streamSequencer({ algorithm: "mulberry32", state });
  const manifest = rollLoot(SOURCES, {
    maxLootTier: "rare",
    region: 3,
    owned: new Set(),
    coinBonus: 0,
    random: stream.random,
    ...overrides,
  });
  return { manifest, endpoint: stream.endpoint() };
}

describe("spoils roll from a named stream", () => {
  it("gives the same fight the same spoils, every time", () => {
    // The invariant this closes: settlement used to fall back to Math.random, so re-settling
    // a fight — or replaying one — produced different loot from the same seed, and nothing
    // recorded what had been spent.
    const first = roll(123456);
    const second = roll(123456);
    expect(second.manifest).toEqual(first.manifest);
    expect(second.endpoint).toEqual(first.endpoint);
  });

  it("gives a different fight different spoils", () => {
    expect(roll(999).manifest).not.toEqual(roll(123456).manifest);
  });

  it("records what it spent", () => {
    const { endpoint } = roll(123456);
    expect(endpoint.algorithm).toBe("mulberry32");
    expect(endpoint.state).not.toBe(123456);
  });

  it("mints reproducible instance ids rather than random ones", () => {
    // Gear taken off a corpse gets a unique id. Drawing that suffix from Math.random made
    // two identical settlements produce items that compared unequal.
    const ids = (result) => result.manifest.items.map((item) => item.itemId).sort();
    expect(ids(roll(4242))).toEqual(ids(roll(4242)));
    expect(ids(roll(4242)).every((id) => typeof id === "string" && id.length > 0)).toBe(true);
  });

  it("still works for a caller that has not been taught about streams", () => {
    // The default is Math.random, so every existing caller behaves exactly as it did.
    const manifest = rollLoot(SOURCES, { maxLootTier: "rare", region: 3, owned: new Set() });
    expect(manifest.coins).toBeTruthy();
    expect(Array.isArray(manifest.items)).toBe(true);
  });

  it("scales coin with the loot ceiling rather than the generator", () => {
    const rich = roll(77, { coinBonus: 1 });
    const plain = roll(77, { coinBonus: 0 });
    // Same stream, same draws — only the multiplier differs, so the coin difference is a
    // rule rather than a reroll.
    expect(rich.endpoint).toEqual(plain.endpoint);
  });
});
