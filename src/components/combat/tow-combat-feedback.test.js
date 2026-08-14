import { describe, expect, it } from "vitest";
import {
  combatCueForEvent,
  combatCueTimeline,
  combatCuesForEvent,
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
    })).toMatchObject({ kind: "evade", label: "Evaded", attackerId: "foe", targetId: "hero", targetSide: "player" });
  });

  it("states exactly how much Vulnerable added to a hit", () => {
    const receipt = combatEventReceipt(encounter(), {
      sequence: 10,
      type: "enemy-attack",
      enemyId: "foe",
      targetId: "hero",
      attackId: "swing",
      hits: [{
        dodged: false,
        critical: false,
        rawDamage: 20,
        vulnerableBonus: 5,
        damage: 25,
        prevented: 0,
        absorbed: 0,
        toHp: 25,
        mitigation: { vulnerable: 25 },
      }],
    }).text;
    expect(receipt).toContain("25 health lost");
    expect(receipt).toContain("5 added by 25% Vulnerable");
  });

  it("records automatic control skips instead of an input refusal", () => {
    const receipt = combatEventReceipt(encounter(), {
      sequence: 11,
      type: "actor-nullified",
      actorId: "hero",
      controls: ["stun"],
      stacksSpent: 1,
    });
    expect(receipt).toMatchObject({ kind: "control" });
    expect(receipt.text).toContain("automatically loses the command window to Stun");
    expect(combatCuesForEvent(encounter(), {
      sequence: 11,
      type: "actor-nullified",
      actorId: "hero",
      controls: ["stun"],
      stacksSpent: 1,
    })[0]).toMatchObject({ label: "Turn skipped", targetId: "hero" });
  });

  it("emits every resolved hit as its own staggered floating outcome", () => {
    const cues = combatCuesForEvent(encounter(), {
      sequence: 18,
      type: "skill-damage",
      actorId: "hero",
      targetId: "foe",
      skillId: "strike",
      basicAttackFormId: "threefold-cut",
      hits: [
        { index: 0, dodged: false, critical: false, rawDamage: 7, damage: 7, toHp: 7 },
        { index: 1, dodged: false, critical: true, rawDamage: 12, damage: 12, toHp: 12 },
        { index: 2, dodged: false, critical: false, rawDamage: 9, damage: 9, absorbed: 9, toHp: 0 },
        { index: 3, dodged: true, critical: false, rawDamage: 8, damage: 0, toHp: 0 },
      ],
    });

    expect(cues).toHaveLength(4);
    expect(cues.map(({ id, delayMs, label, kind }) => ({ id, delayMs, label, kind }))).toEqual([
      { id: "18-hit-0", delayMs: 0, label: "-7", kind: "hit" },
      { id: "18-hit-1", delayMs: 155, label: "-12", kind: "critical" },
      { id: "18-hit-2", delayMs: 310, label: "0", kind: "ward" },
      { id: "18-hit-3", delayMs: 465, label: "Evaded", kind: "evade" },
    ]);
    expect(cues[1].kicker).toBe("Critical");
    expect(cues[2].kicker).toBe("Ward holds");
    expect(cues.map((cue) => cue.hpChange)).toEqual([-7, -12, 0, 0]);
    expect(cues.map((cue) => cue.shieldChange)).toEqual([0, 0, -9, 0]);
    expect(cues.every((cue) => cue.hitCount === 4)).toBe(true);
    expect(cues.every((cue) => cue.visual.variant === "threefold-cut")).toBe(true);
  });

  it("stages a skill consequence before the enemy counterattack", () => {
    const state = encounter();
    const timeline = combatCueTimeline(state, [
      {
        sequence: 30,
        type: "skill-damage",
        actorId: "hero",
        targetId: "foe",
        skillId: "sleepless-flame-strike",
        hits: [
          { index: 0, dodged: false, critical: false, rawDamage: 8, damage: 8, toHp: 8 },
          { index: 1, dodged: false, critical: false, rawDamage: 6, damage: 6, toHp: 6 },
        ],
      },
      {
        sequence: 31,
        type: "skill-status",
        actorId: "hero",
        targetId: "foe",
        target: "enemy",
        skillId: "sleepless-flame-strike",
        status: "burn",
        count: 4,
      },
      {
        sequence: 32,
        type: "enemy-attack",
        enemyId: "foe",
        targetId: "hero",
        attackId: "swing",
        hits: [{ index: 0, dodged: false, critical: false, rawDamage: 13, damage: 13, toHp: 13 }],
      },
    ]);

    expect(timeline.map((cue) => cue.actionIndex)).toEqual([0, 0, 0, 1]);
    expect(timeline.map((cue) => cue.declarationLabel))
      .toEqual(["Flame Strike", "Flame Strike", "Flame Strike", "Swing"]);
    expect(timeline[2].delayMs).toBeGreaterThan(timeline[1].delayMs);
    expect(timeline[3].delayMs).toBeGreaterThan(timeline[2].delayMs);
    expect(timeline[3]).toMatchObject({ attackerId: "foe", targetId: "hero" });
  });

  it("floats zero and names the defence when a hit is fully blocked", () => {
    const [cue] = combatCuesForEvent(encounter(), {
      sequence: 19,
      type: "enemy-attack",
      enemyId: "foe",
      targetId: "hero",
      attackId: "swing",
      hits: [{
        index: 0,
        dodged: false,
        critical: false,
        rawDamage: 13,
        prevented: 13,
        mitigation: { guard: true },
        damage: 0,
        absorbed: 0,
        toHp: 0,
      }],
    });
    expect(cue).toMatchObject({ kind: "block", label: "0", kicker: "Guard", prevented: 13 });
  });

  it("keeps count-only saved damage events readable and animatable", () => {
    const event = {
      sequence: 20,
      type: "skill-damage",
      actorId: "hero",
      targetId: "foe",
      skillId: "strike",
      amount: 5,
      hits: 2,
    };
    expect(combatEventReceipt(encounter(), event).text)
      .toContain("lands 2 of 2 hits on Duellist: 10 health lost");
    expect(combatCuesForEvent(encounter(), event).map((cue) => cue.label))
      .toEqual(["-5", "-5"]);
  });

  it("surfaces status amplification as its own hostile effect", () => {
    const event = {
      sequence: 21,
      type: "skill-status-amplified",
      actorId: "hero",
      targetId: "foe",
      skillId: "priestess-doom",
      statuses: ["burn", "poison", "bleed"],
      gained: 8,
    };
    expect(combatEventReceipt(encounter(), event).text)
      .toContain("amplifies Duellist's Burn / Poison / Bleed by 8 stacks");
    expect(combatCuesForEvent(encounter(), event)[0]).toMatchObject({
      kind: "afflict",
      label: "Amplified",
      kicker: "+8",
      targetSide: "enemy",
      visual: { family: "afflict", variant: "priestess-doom-amplified" },
    });
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

  it("names who an offensive trait placed its status on", () => {
    const state = encounter();
    expect(combatEventReceipt(state, {
      sequence: 15,
      type: "trait-fired",
      actorId: "hero",
      traitId: "ambush",
      amount: 1,
      status: "weak",
      effectKind: "inflict-status",
      targetIds: ["foe"],
    }).text).toBe("Your Ambush inflicts 1 Weak on Duellist.");
  });
});
