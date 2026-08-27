import { describe, expect, it } from "vitest";
import { getSkill, skillIds } from "./skills.js";
import {
  ABILITY_EFFECT_RECIPIENTS,
  ABILITY_PRESENTATION_TIERS,
  ALLY_TARGET_ABILITY_IDS,
  abilityTargeting,
  effectRecipient,
  isAbilityTargetingMetadata,
  presentationTier,
} from "./ability-targeting.js";

describe("spatial ability targeting metadata", () => {
  it("deterministically covers every slotted catalogue ability", () => {
    const ids = skillIds();
    expect(ids).toHaveLength(312);
    for (const id of ids) {
      const definition = getSkill(id);
      const first = abilityTargeting(definition);
      const second = abilityTargeting(definition);
      expect(isAbilityTargetingMetadata(first), id).toBe(true);
      expect(second, id).toEqual(first);
      expect(Object.isFrozen(first), id).toBe(true);
      for (const [index, effect] of definition.effects.entries()) {
        expect(ABILITY_EFFECT_RECIPIENTS, `${id}[${index}]`)
          .toContain(effectRecipient(definition, effect, index));
      }
      expect(ABILITY_PRESENTATION_TIERS).toContain(presentationTier(definition, 1));
      expect(ABILITY_PRESENTATION_TIERS)
        .toContain(presentationTier(definition, definition.rankCount));
    }
  });

  it("keeps ordinary attacks and defenses restrained and single-cell", () => {
    expect(abilityTargeting(getSkill("strike"))).toMatchObject({
      anchorSide: "enemy",
      reach: "melee",
      footprint: "single",
      anchorPolicy: "occupied",
      castMode: "melee",
      presentation: "restrained",
    });
    expect(abilityTargeting(getSkill("arctic-block"))).toMatchObject({
      anchorSide: "self",
      reach: "self",
      footprint: "single",
      castMode: "support",
      presentation: "restrained",
    });
    expect(abilityTargeting(getSkill("demon-shoot"))).toMatchObject({
      anchorSide: "enemy",
      reach: "ranged",
      footprint: "single",
      castMode: "projectile",
      presentation: "restrained",
    });
  });

  it("keeps mixed hostile and self effects on different recipients", () => {
    const mortalBlow = getSkill("arctic-mortal-blow");
    expect(abilityTargeting(mortalBlow)).toMatchObject({
      anchorSide: "enemy",
      reach: "melee",
      footprint: "single",
      presentation: "ability",
    });
    expect(mortalBlow.effects.map((effect, index) => (
      effectRecipient(mortalBlow, effect, index)
    ))).toEqual(["anchor", "caster"]);

    const thermalTransfer = getSkill("automaton-fate-manipulator");
    expect(thermalTransfer.effects.map((effect, index) => (
      effectRecipient(thermalTransfer, effect, index)
    ))).toEqual(["anchor", "caster"]);
  });

  it("allows curated heals and boons to select allies, including the caster", () => {
    expect(new Set(ALLY_TARGET_ABILITY_IDS).size).toBe(ALLY_TARGET_ABILITY_IDS.length);
    expect(ALLY_TARGET_ABILITY_IDS).toHaveLength(61);
    for (const id of ALLY_TARGET_ABILITY_IDS) {
      const definition = getSkill(id);
      expect(definition, id).toBeTruthy();
      expect(definition.effects.every((effect) => effect.target === "self"), id).toBe(true);
      expect(abilityTargeting(definition).anchorSide, id).toBe("ally");
    }

    expect(ALLY_TARGET_ABILITY_IDS).toContain("priestess-greater-heal");
    const heal = getSkill("priestess-greater-heal");
    expect(abilityTargeting(heal)).toMatchObject({
      anchorSide: "ally",
      allowSelf: true,
      reach: "ranged",
      footprint: "single",
      castMode: "support",
    });
    expect(effectRecipient(heal, heal.effects[0], 0)).toBe("anchor");

    const firstAid = getSkill("first-aid");
    expect(ALLY_TARGET_ABILITY_IDS).not.toContain("first-aid");
    expect(abilityTargeting(firstAid).anchorSide).toBe("self");
    expect(firstAid.effects.map((effect, index) => (
      effectRecipient(firstAid, effect, index)
    ))).toEqual(["caster", "caster"]);
  });

  it("keeps fixed, intrinsic, resource, and fatal self actions on the caster", () => {
    for (const id of [
      "mage-blink",
      "mage-mana-concentration",
      "witch-forbidden-ritual",
      "automaton-infinite-power",
      "sleepless-cool-composure",
      "sleepless-high-speed-flight",
    ]) {
      const definition = getSkill(id);
      expect(abilityTargeting(definition).anchorSide, id).toBe("self");
      expect(definition.effects.map((effect, index) => (
        effectRecipient(definition, effect, index)
      )), id).toEqual(definition.effects.map(() => "caster"));
    }
  });

  it("assigns authored line, cross, field, and projectile profiles", () => {
    expect(abilityTargeting(getSkill("north-king-whirlwind"))).toMatchObject({
      footprint: "row",
      anchorPolicy: "cell",
      castMode: "field",
    });
    expect(abilityTargeting(getSkill("mage-destruction-ray"))).toMatchObject({
      reach: "ranged",
      footprint: "column",
      castMode: "projectile",
    });
    expect(abilityTargeting(getSkill("clocktower-grenade-toss"))).toMatchObject({
      footprint: "cross-short",
      castMode: "projectile",
    });
    expect(abilityTargeting(getSkill("clocktower-chain-explosion"))).toMatchObject({
      footprint: "cross-full",
      castMode: "field",
    });
    expect(abilityTargeting(getSkill("demon-arrow-rain"))).toMatchObject({
      reach: "global",
      footprint: "all",
      anchorPolicy: "cell",
      castMode: "field",
    });
  });

  it("treats the one all-combatants source effect separately from an allied field", () => {
    const truce = getSkill("north-king-natures-intervention");
    expect(abilityTargeting(truce)).toMatchObject({
      anchorSide: "self",
      reach: "global",
      footprint: "all",
    });
    expect(effectRecipient(truce, truce.effects[0], 0)).toBe("all");
  });

  it("promotes only flexible Mythical actions to the cinematic tier", () => {
    expect(presentationTier(getSkill("arctic-incineration"), 1)).toBe("mythical");
    expect(presentationTier(getSkill("penetration"), 5)).toBe("mythical");
    expect(presentationTier(getSkill("arctic-strike"), 6)).toBe("restrained");
    expect(presentationTier(getSkill("arctic-mortal-blow"), 1)).toBe("ability");
  });

  it("rejects malformed metadata, effects, and ranks", () => {
    expect(isAbilityTargetingMetadata(null)).toBe(false);
    expect(isAbilityTargetingMetadata({})).toBe(false);
    expect(() => abilityTargeting(null)).toThrow("invalid-ability-definition");
    const strike = getSkill("strike");
    expect(() => effectRecipient(strike, { ...strike.effects[0] }, 0))
      .toThrow("unknown-ability-effect");
    expect(() => presentationTier(strike, 0)).toThrow("invalid-ability-rank");
  });
});
