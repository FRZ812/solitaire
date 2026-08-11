import { describe, expect, it } from "vitest";
import { createEncounter } from "../kernel/model.js";
import { getReferenceAction } from "./actions.js";
import { ARCTIC_KNIGHT, createReferencePlayer, getReferenceCharacter } from "./characters.js";
import { MAX_SKILL_SLOTS, MAX_SKILL_SLOTS_EVIDENCE, getReferenceSkill } from "./skills.js";

function enemy() {
  return {
    id: "gatekeeper",
    name: "The Gatekeeper",
    hp: 18,
    maxHp: 18,
    stats: { attack: 3, defense: 0 },
    intent: {
      id: "gatekeeper-strike",
      type: "attack",
      targetId: "player",
      damage: { min: 8, max: 8 },
    },
  };
}

describe("Arctic Knight reference package", () => {
  it("declares one immutable, serializable character package with a Polar Knight alias", () => {
    expect(ARCTIC_KNIGHT).toMatchObject({
      id: "arctic-knight",
      name: "Arctic Knight",
      aliases: ["Polar Knight"],
      starting: {
        maxHp: 24,
        stats: { attack: 8, defense: 2 },
        actions: ["basic-attack", "basic-defense"],
        skills: ["emergency-evasion", "sleep-bomb"],
      },
    });
    expect(JSON.parse(JSON.stringify(ARCTIC_KNIGHT))).toEqual(ARCTIC_KNIGHT);
    expect(Object.isFrozen(ARCTIC_KNIGHT)).toBe(true);
    expect(Object.isFrozen(ARCTIC_KNIGHT.starting)).toBe(true);
  });

  it("references only registered actions and skills within the three-slot limit", () => {
    expect(ARCTIC_KNIGHT.starting.actions.every((id) => getReferenceAction(id))).toBe(true);
    expect(ARCTIC_KNIGHT.starting.skills.every((id) => getReferenceSkill(id))).toBe(true);
    expect(ARCTIC_KNIGHT.starting.skills.length).toBeLessThanOrEqual(MAX_SKILL_SLOTS);
    expect(MAX_SKILL_SLOTS_EVIDENCE).toBe("inferred-policy-gap");
  });

  it("marks unsupported starting numbers and loadout membership as explicit placeholders", () => {
    expect(ARCTIC_KNIGHT.startingConfidence).toEqual({
      maxHp: "inferred-placeholder",
      stats: "inferred-placeholder",
      actions: "observed-system-inferred-membership",
      skills: "observed-system-inferred-membership",
    });
    expect(ARCTIC_KNIGHT.unresolved).toContain("exact-starting-stats");
    expect(ARCTIC_KNIGHT.unresolved).toContain("exact-starting-loadout");
  });

  it("creates isolated player input accepted by the deterministic encounter model", () => {
    const player = createReferencePlayer("arctic-knight", { actorId: "player" });
    const repeated = createReferencePlayer("arctic-knight", { actorId: "player" });
    player.stats.attack = 999;

    expect(repeated.stats.attack).toBe(8);
    expect(createEncounter({ seed: 17, player: repeated, enemy: enemy() }).actors.player).toMatchObject({
      id: "player",
      name: "Arctic Knight",
      hp: 24,
      maxHp: 24,
      stats: { attack: 8, defense: 2 },
      actions: ["basic-attack", "basic-defense"],
    });
  });

  it.each(["missing", "constructor", "__proto__"])("does not expose unknown character id %s", (id) => {
    expect(getReferenceCharacter(id)).toBe(null);
    expect(() => createReferencePlayer(id)).toThrow(`unknown-character:${id}`);
  });
});
