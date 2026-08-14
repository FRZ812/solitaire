import { describe, expect, it } from "vitest";
import { generalAbilityIds, getSkill } from "../../gameplay/tow/skills.js";
import { characterAbilityIds } from "../../gameplay/tow/character-abilities.js";
import { resolveTowAbilityArt, resolveTowActionName } from "./tow-combat-ability-art.js";
import { weaponPresentationForForm, weaponPresentationFromItemIds } from "../../gameplay/tow/weapon-presentation.js";

describe("generated combat ability art", () => {
  it("changes Strike art and label with the equipped weapon", () => {
    const strike = getSkill("strike");
    const sword = { family: "sword", itemId: "arming-sword", actionName: "Measured Cut" };
    const bow = { family: "bow", itemId: "hunting-bow", actionName: "Loose Arrow" };
    expect(resolveTowAbilityArt(strike, sword)).not.toBe(resolveTowAbilityArt(strike, bow));
    expect(resolveTowActionName(strike, sword)).toBe("Measured Cut");
    expect(resolveTowActionName(strike, bow)).toBe("Loose Arrow");
  });

  it("keeps authored skill art independent from the weapon", () => {
    const block = getSkill("block");
    const sword = resolveTowAbilityArt(block, { family: "sword", itemId: "arming-sword" });
    const bow = resolveTowAbilityArt(block, { family: "bow", itemId: "hunting-bow" });
    expect(sword).toBe(bow);
    expect(resolveTowActionName(block, {})).toBe("Block");
  });

  it("gives alternate weapon forms distinct generated art", () => {
    const strike = getSkill("strike");
    const base = weaponPresentationFromItemIds(["nightfang-dagger"]);
    const triple = weaponPresentationForForm(base, "threefold-shadow");
    const debuff = weaponPresentationForForm(base, "silencing-cut");
    expect(new Set([
      resolveTowAbilityArt(strike, base),
      resolveTowAbilityArt(strike, triple),
      resolveTowAbilityArt(strike, debuff),
    ]).size).toBe(3);
  });

  it("gives all 60 character abilities dedicated generated art", () => {
    const abilityIds = characterAbilityIds();
    const resolved = abilityIds.map((id) => resolveTowAbilityArt(getSkill(id)));
    expect(abilityIds).toHaveLength(60);
    expect(new Set(resolved).size).toBe(abilityIds.length);
    for (const [index, id] of abilityIds.entries()) {
      expect(resolved[index]).toContain(`${id}-v1.webp`);
    }
  });

  it("gives every shared replacement a distinct dedicated icon", () => {
    const abilityIds = generalAbilityIds();
    const resolved = abilityIds.map((id) => resolveTowAbilityArt(getSkill(id)));
    expect(abilityIds).toHaveLength(18);
    expect(new Set(resolved).size).toBe(abilityIds.length);
    for (const art of resolved) expect(art).not.toContain("fallback");
  });
});
