import { describe, expect, it } from "vitest";
import {
  classifyLegacyAbilityGrant,
  clampAbilityTier,
  clampWorldAbilityTier,
  worldAbilityGrantDefinition,
} from "./abilities.js";

describe("legacy ability grant classification", () => {
  it("keeps the explicit campaign powers in the world layer", () => {
    for (const id of ["fly", "dimension-door", "gate", "haste", "bear-strength"]) {
      expect(classifyLegacyAbilityGrant(id), id).toBe("world");
    }
  });

  it("classifies every other canonical ability as combat", () => {
    for (const id of ["basic-attack", "power-strike", "firebolt", "blood-siphon"]) {
      expect(classifyLegacyAbilityGrant(id), id).toBe("combat");
    }
  });

  it("leaves non-canonical lore and narrative skills alone", () => {
    expect(classifyLegacyAbilityGrant("field-lore")).toBe("narrative-skill");
    expect(classifyLegacyAbilityGrant(null)).toBe("narrative-skill");
  });

  it("resolves overlapping Haste against the world boon without changing legacy combat clamping", () => {
    expect(worldAbilityGrantDefinition("haste")).toMatchObject({ kind: "buff", minTier: "rare" });
    expect(clampWorldAbilityTier("haste", "common")).toBe("rare");
    expect(clampAbilityTier("haste", "common")).toBe("very-rare");
  });
});
