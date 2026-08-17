import { describe, expect, it } from "vitest";
import { gameplayChecksum } from "../kernel/replay.js";
import {
  ABILITY_COST_BANDS,
  ABILITY_PROFILE_SLOTS,
  ABILITY_ROLES,
  abilityProfile,
  abilityRoleLabel,
  isAbilityProfile,
} from "./ability-profile.js";
import { getSkill, skillIds } from "./skills.js";
import { TOW_RULESET_ID, createTowSession } from "./session.js";

function openSession() {
  return createTowSession({
    sessionId: "ability-profile-checksum",
    rootSeed: "ability-profile-seed",
    player: {
      id: "wanderer",
      name: "Wanderer",
      maxHp: 170,
      stats: { attack: 12, defense: 13, critRate: 0, dodgeRate: 0 },
    },
    enemies: [{
      id: "foe-0",
      name: "Bandit",
      maxHp: 40,
      stats: { attack: 9, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 6 }],
    }],
    build: { traits: {}, skills: ["arctic-strike", "arctic-block"] },
  }).session;
}

describe("derived ability profiles", () => {
  it("covers all 312 slotted actions deterministically at every authored rank", () => {
    const ids = skillIds();
    expect(ids).toHaveLength(312);
    for (const id of ids) {
      const definition = getSkill(id);
      for (let rank = 1; rank <= definition.rankCount; rank += 1) {
        const first = abilityProfile(id, rank);
        const second = abilityProfile(definition, rank);
        expect(first, `${id}@${rank}`).toEqual(second);
        expect(isAbilityProfile(first), `${id}@${rank}`).toBe(true);
        expect(Object.isFrozen(first), `${id}@${rank}`).toBe(true);
        expect(Object.isFrozen(first.roles), `${id}@${rank}`).toBe(true);
        expect(Object.isFrozen(first.effectRecipients), `${id}@${rank}`).toBe(true);
        expect(Object.isFrozen(first.economy), `${id}@${rank}`).toBe(true);
        expect(Object.isFrozen(first.progression), `${id}@${rank}`).toBe(true);
        expect(ABILITY_PROFILE_SLOTS).toContain(first.slot);
        expect(first.roles.every((role) => ABILITY_ROLES.includes(role))).toBe(true);
        expect(ABILITY_COST_BANDS).toContain(first.economy.costBand);
        expect(first.effectRecipients).toHaveLength(definition.effects.length);
      }
    }
  });

  it("describes representative party jobs without reading display names", () => {
    expect(abilityProfile("arctic-strike")).toMatchObject({
      slot: "basic",
      roles: ["damage"],
      targeting: { anchorSide: "enemy", reach: "melee", footprint: "single" },
    });
    expect(abilityProfile("priestess-divine-barrier")).toMatchObject({
      slot: "flex",
      roles: ["tank-control", "buff"],
      targeting: { anchorSide: "ally", footprint: "cross-full" },
    });
    expect(abilityProfile("first-aid").roles).toEqual(["heal", "cleanse"]);
    expect(abilityProfile("clocktower-high-voltage").roles).toEqual(["buff", "tempo"]);
    expect(abilityProfile("automaton-infinite-power").roles).toContain("economy");
    expect(abilityProfile("witch-skeleton-summon").roles).toEqual(["buff"]);
    expect(abilityProfile("demon-poison-bottle").roles).toEqual(["damage"]);
    expect(abilityProfile("witch-skull-throw").roles).toEqual(["damage"]);
    expect(abilityProfile("blade-inversion").roles).toEqual(["damage"]);
    expect(abilityProfile("assassin-cold-blood").roles).toEqual(["cleanse"]);
    expect(abilityProfile("automaton-interception", 1).roles).toEqual([]);
    expect(abilityProfile("automaton-interception", 2).roles).toEqual(["tank-control"]);
  });

  it("keeps avoidance separate from turn tempo and names removals by recipient", () => {
    for (const id of [
      "emergency-evasion",
      "demon-evasion",
      "assassin-shadow-strike",
      "clocktower-cloaking-field",
      "blade-flash-step",
      "unbendable-will",
      "vampire-endless-will",
    ]) {
      expect(abilityProfile(id).roles, id).not.toContain("tempo");
    }
    expect(abilityProfile("super-speed").roles).toContain("tempo");
    expect(abilityRoleLabel("cleanse", "first-aid")).toBe("Cleanse");
    expect(abilityRoleLabel("cleanse", "sleepless-transference")).toBe("Cleanse");
    expect(abilityRoleLabel("cleanse", "assassin-cold-blood")).toBe("Dispel");
    expect(abilityRoleLabel("cleanse", "witch-nullification")).toBe("Dispel");
  });

  it("keeps mixed effect recipients explicit", () => {
    expect(abilityProfile("arctic-mortal-blow").effectRecipients)
      .toEqual(["anchor", "caster"]);
    expect(abilityProfile("first-aid").effectRecipients)
      .toEqual(["anchor", "anchor"]);
  });

  it("maps Resolve prices into stable descriptive cost bands", () => {
    expect(abilityProfile("arctic-strike").economy).toMatchObject({
      cost: 0,
      costBand: "free",
      resource: "resolve",
    });
    expect(abilityProfile("arctic-incineration").economy.costBand).toBe("mythical");
  });

  it("does not alter session JSON or its integrity checksum", () => {
    const session = openSession();
    const beforeJson = JSON.stringify(session);
    const beforeChecksum = gameplayChecksum(session);
    const sealedChecksum = session.checksum;
    for (const id of skillIds()) abilityProfile(id);
    expect(JSON.stringify(session)).toBe(beforeJson);
    expect(gameplayChecksum(session)).toBe(beforeChecksum);
    expect(session.checksum).toBe(sealedChecksum);
  });

  it("rejects malformed definitions, ranks, profiles, and future rulesets", () => {
    expect(isAbilityProfile(null)).toBe(false);
    expect(isAbilityProfile({})).toBe(false);
    const valid = abilityProfile("arctic-strike");
    expect(() => isAbilityProfile({ ...valid, roles: 42 })).not.toThrow();
    expect(isAbilityProfile({ ...valid, roles: 42 })).toBe(false);
    expect(isAbilityProfile({ ...valid, targeting: null })).toBe(false);
    expect(isAbilityProfile({
      ...valid,
      targeting: { ...valid.targeting, anchorSide: "ally", allowSelf: true },
    })).toBe(false);
    expect(isAbilityProfile({ ...valid, roles: ["damage", "damage"] })).toBe(false);
    expect(isAbilityProfile({ ...valid, effectRecipients: ["caster"] })).toBe(false);
    expect(isAbilityProfile({ ...valid, presentation: "mythical" })).toBe(false);
    expect(isAbilityProfile({ ...valid, economy: { ...valid.economy, cost: -1 } })).toBe(false);
    expect(isAbilityProfile({
      ...valid,
      economy: { ...valid.economy, cost: 1, costBand: "light" },
    })).toBe(false);
    expect(isAbilityProfile({
      ...valid,
      progression: { ...valid.progression, rank: 999 },
    })).toBe(false);
    expect(() => abilityProfile("missing")).toThrow("invalid-ability-profile:missing");
    expect(() => abilityProfile({ ...getSkill("arctic-strike"), id: "arctic-block" }))
      .toThrow("noncanonical-ability-definition:arctic-block");
    expect(() => abilityProfile("arctic-strike", 0)).toThrow("invalid-skill-rank");
    expect(() => abilityProfile("arctic-strike", 1, { rulesetId: "solitaire-tow-v2" }))
      .toThrow("unsupported-ability-ruleset:solitaire-tow-v2");
    expect(abilityProfile("arctic-strike").rulesetId).toBe(TOW_RULESET_ID);
  });
});
