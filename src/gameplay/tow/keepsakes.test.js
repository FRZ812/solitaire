import { describe, expect, it } from "vitest";
import {
  DEFAULT_STARTING_KEEPSAKE_ID,
  PERMANENT_STARTING_KEEPSAKES,
  STARTING_KEEPSAKES,
  combatItemIdForKeepsake,
  getStartingKeepsake,
  isKeepsakeUnlocked,
  permanentItemIdForKeepsake,
  startingKeepsakesForFamily,
} from "./keepsakes.js";

describe("starting keepsake catalogue", () => {
  it("spans permanent relic rarity and retained one-use supplies", () => {
    expect(STARTING_KEEPSAKES).toHaveLength(10);
    expect(PERMANENT_STARTING_KEEPSAKES).toHaveLength(6);
    expect(startingKeepsakesForFamily("supply").map((entry) => entry.id)).toEqual([
      "crimson-vial",
      "lucid-tonic",
      "warding-ash",
      "fire-pot",
    ]);
    expect(PERMANENT_STARTING_KEEPSAKES.map((entry) => entry.rarity)).toEqual([
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
      "mythical",
    ]);
    expect(DEFAULT_STARTING_KEEPSAKE_ID).toBe("threadbare-war-ribbon");
  });

  it("models future achievement locks without hiding their authored effects", () => {
    const halo = getStartingKeepsake("saints-broken-halo");
    expect(halo.unlock).toMatchObject({ type: "achievement", id: "hold-the-line" });
    expect(halo.effect).toContain("Aegis I");
    expect(isKeepsakeUnlocked(halo)).toBe(false);
    expect(isKeepsakeUnlocked(halo, ["hold-the-line"])).toBe(true);
    expect(isKeepsakeUnlocked("red-wolf-token")).toBe(true);
  });

  it("keeps picker subtext as lore while effects own every mechanical explanation", () => {
    const mechanicalCopy = /[+%]|\b(?:attack|defence|critical|dodge|health|resolve|aegis|common|uncommon|rare|epic|legendary|mythical)\b/i;
    for (const keepsake of STARTING_KEEPSAKES) {
      expect(keepsake.description, keepsake.id).not.toMatch(mechanicalCopy);
      expect(keepsake.effect, keepsake.id).toMatch(/[+%]|\b(?:ATK|DEF|Resolve|ward|use)\b/i);
    }
  });

  it("separates permanent grants from disposable combat inventory", () => {
    expect(permanentItemIdForKeepsake("frostglass-bead")).toBe("frostglass-bead");
    expect(combatItemIdForKeepsake("frostglass-bead")).toBeNull();
    expect(permanentItemIdForKeepsake("fire-pot")).toBeNull();
    expect(combatItemIdForKeepsake("fire-pot")).toBe("fire-pot");
  });
});
