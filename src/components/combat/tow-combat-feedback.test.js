import { describe, expect, it } from "vitest";
import {
  combatCueForEvent,
  combatEventReceipt,
  combatTempoReceipt,
  recentCombatReceipts,
} from "./tow-combat-feedback.js";

function encounter(overrides = {}) {
  return {
    phase: "player",
    round: 2,
    playerId: "hero",
    enemyIds: ["foe"],
    actors: {
      hero: {
        id: "hero", name: "Sable Ren", side: "player", hp: 80,
        statuses: [],
      },
      foe: {
        id: "foe", name: "Duellist", side: "enemy", hp: 60,
        statuses: [],
      },
    },
    enemyAttacks: {
      foe: [{ id: "swing", name: "Swing", hits: 1, damage: 13 }],
    },
    turn: { actionsRemaining: 1, allies: {} },
    events: [],
    ...overrides,
  };
}

describe("combat feedback receipts", () => {
  it("explains health loss, ward absorption, mitigation, dodge and crit from hit evidence", () => {
    const state = encounter();
    const event = {
      sequence: 8,
      type: "enemy-attack",
      enemyId: "foe",
      targetId: "hero",
      attackId: "swing",
      hits: [
        {
          dodged: false,
          critical: true,
          rawDamage: 26,
          damage: 15,
          prevented: 11,
          absorbed: 5,
          toHp: 10,
          thorn: 2,
          mitigation: { guard: true, steelskin: 2 },
        },
        {
          dodged: true,
          critical: false,
          rawDamage: 13,
          damage: 0,
          prevented: 13,
          absorbed: 0,
          toHp: 0,
          thorn: 0,
          mitigation: { evade: true },
        },
      ],
    };

    const receipt = combatEventReceipt(state, event).text;
    expect(receipt).toContain("lands 1 of 2 hits");
    expect(receipt).toContain("10 health lost");
    expect(receipt).toContain("5 absorbed by ward");
    expect(receipt).toContain("11 reduced by Guard + Steelskin");
    expect(receipt).toContain("1 hit dodged (13 avoided)");
    expect(receipt).toContain("1 critical hit");
    expect(receipt).toContain("Thorn returns 2");
  });

  it("calls out a fully avoided attack and the damage it could have dealt", () => {
    const state = encounter();
    const receipt = combatEventReceipt(state, {
      sequence: 9,
      type: "enemy-attack",
      enemyId: "foe",
      targetId: "hero",
      attackId: "swing",
      hits: [
        { dodged: true, rawDamage: 13, damage: 0, prevented: 13, absorbed: 0, toHp: 0 },
        { dodged: true, rawDamage: 13, damage: 0, prevented: 13, absorbed: 0, toHp: 0 },
      ],
    }).text;
    expect(receipt).toBe("You dodge all 2 hits from Duellist's Swing, avoiding 26 damage.");
  });

  it("explains Haste and cancelled Priority without claiming the foe stole the base action", () => {
    const state = encounter({
      actors: {
        hero: {
          id: "hero", name: "Sable Ren", side: "player", hp: 80,
          statuses: [{ type: "haste", count: 1 }, { type: "priority", count: 2 }],
        },
        foe: {
          id: "foe", name: "Duellist", side: "enemy", hp: 60,
          statuses: [{ type: "priority", count: 3 }],
        },
      },
      turn: { actionsRemaining: 2, allies: {} },
    });
    expect(combatTempoReceipt(state, "hero").text)
      .toBe("Sable Ren has 2 actions left: Haste grants 1; enemy Priority 3 cancels Priority 2. Swift abilities keep them.");
  });

  it("maps player and enemy results to symmetric stage cues", () => {
    const state = encounter();
    expect(combatCueForEvent(state, {
      sequence: 1, type: "skill-damage", actorId: "hero", targetId: "foe",
      hits: [{ dodged: false, critical: false, rawDamage: 10, damage: 10, toHp: 10 }],
    })).toMatchObject({ kind: "hit", attackerId: "hero", targetId: "foe", targetSide: "enemy" });
    expect(combatCueForEvent(state, {
      sequence: 2, type: "enemy-attack", enemyId: "foe", targetId: "hero",
      hits: [{ dodged: true, rawDamage: 13, damage: 0, toHp: 0 }],
    })).toMatchObject({ kind: "dodge", attackerId: "foe", targetId: "hero", targetSide: "player" });
  });

  it("keeps only recent meaningful events", () => {
    const state = encounter({
      events: [
        { sequence: 1, type: "intent-declared" },
        { sequence: 2, type: "skill-shield", actorId: "hero", skillId: "block", amount: 30 },
      ],
    });
    expect(recentCombatReceipts(state)).toEqual([
      expect.objectContaining({ sequence: 2, kind: "guard", text: expect.stringContaining("30 ward") }),
    ]);
  });

  it("reports the exact retreat odds, roll, comparison, and spent action", () => {
    const receipt = combatEventReceipt(encounter(), {
      sequence: 12,
      type: "retreat-attempt",
      actorId: "hero",
      chancePercent: 43,
      playerRating: 82,
      enemyRating: 109,
      roll: 71,
      succeeded: false,
    });
    expect(receipt.text).toContain("43% chance");
    expect(receipt.text).toContain("rolled 71");
    expect(receipt.text).toContain("82 party strength versus 109");
    expect(receipt.text).toContain("action is spent");
  });

  it("uses direct player grammar for retreat receipts", () => {
    const receipt = combatEventReceipt(encounter(), {
      sequence: 13,
      type: "retreat-attempt",
      actorId: "hero",
      chancePercent: 61,
      playerRating: 70,
      enemyRating: 39,
      roll: 32,
      succeeded: true,
    });
    expect(receipt.text).toBe("You lead the party clear (61% chance; rolled 32; 70 party strength versus 39).");
  });

  it("uses direct player grammar for player traits and attacks", () => {
    const state = encounter();
    expect(combatEventReceipt(state, {
      sequence: 14,
      type: "trait-fired",
      actorId: "hero",
      traitId: "ambush",
      amount: 1,
      status: "weak",
    }).text).toBe("Your Ambush grants 1 Weak.");
  });
});
