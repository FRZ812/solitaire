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
        vulnerablePercent: 50,
        damage: 25,
        prevented: 0,
        absorbed: 0,
        toHp: 25,
        mitigation: { vulnerable: 25 },
      }],
    }).text;
    expect(receipt).toContain("25 health lost");
    expect(receipt).toContain("5 added by 50% Vulnerable");
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

  it("names every boundary-damage status in its receipt", () => {
    const event = {
      sequence: 12,
      type: "tick-damage",
      actorId: "foe",
      burn: 2,
      doom: 3,
      poison: 4,
      bleed: 5,
      misfortune: 6,
    };
    expect(combatEventReceipt(encounter(), event).text).toBe(
      "Duellist loses 20 health to 2 Burn + 3 Doom + 4 Poison + 5 Bleed + 6 Misfortune; this bypasses defence and ward.",
    );
    const cues = combatCuesForEvent(encounter(), event);
    expect(cues.map((cue) => cue.kicker)).toEqual(["Burn", "Doom", "Poison", "Bleed", "Misfortune"]);
    expect(cues.map((cue) => cue.hpChange)).toEqual([-2, -3, -4, -5, -6]);
  });

  it("names every special and delayed boundary-damage source", () => {
    const event = {
      sequence: 13,
      type: "tick-damage",
      actorId: "foe",
      voidMonster: 2,
      hellfireSpirit: 3,
      fatalBlade: 4,
      delayedDamage: 5,
      delayedSkillIds: ["witch-limited-life-sentence"],
      total: 14,
      applied: 14,
    };

    expect(combatEventReceipt(encounter(), event).text).toBe(
      "Duellist loses 14 health to 2 Void Monster + 3 Hellfire Spirit + 4 Fatal Blade + 5 Delayed Damage; this bypasses defence and ward.",
    );
    const cues = combatCuesForEvent(encounter(), event);
    expect(cues.map((cue) => cue.kicker)).toEqual([
      "Void Monster", "Hellfire Spirit", "Fatal Blade", "Delayed Damage",
    ]);
    expect(cues.map((cue) => cue.hpChange)).toEqual([-2, -3, -4, -5]);
  });

  it("presents only the canonical HP delta when requested boundary damage overkills", () => {
    const event = {
      sequence: 14,
      type: "tick-damage",
      actorId: "hero",
      delayedDamage: 9999,
      delayedSkillIds: ["automaton-emergency-fuel"],
      delayedStatuses: ["foul-ceremony"],
      total: 9999,
      applied: 100,
    };

    const cues = combatCuesForEvent(encounter(), event);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({
      label: "-100",
      kicker: "Delayed Damage",
      targetId: "hero",
      hpChange: -100,
    });
  });

  it("presents exact status modifications from their authoritative event", () => {
    const event = {
      sequence: 14,
      type: "skill-status-modified",
      actorId: "hero",
      targetId: "hero",
      skillId: "blade-inversion",
      status: "initiative",
      requestedDelta: -10,
      delta: -10,
      before: 20,
      after: 10,
    };

    const receipt = combatEventReceipt(encounter(), event);
    expect(receipt).toMatchObject({ kind: "status" });
    expect(receipt.text).toContain("Initiative 20→10");
    expect(combatCuesForEvent(encounter(), event)[0]).toMatchObject({
      kind: "afflict",
      label: "-10",
      kicker: "Initiative",
      targetId: "hero",
    });
  });

  it("presents temporary maximum-health gains and their fatal timer", () => {
    const event = {
      sequence: 15,
      type: "skill-max-hp",
      actorId: "hero",
      targetId: "hero",
      skillId: "witch-forbidden-ritual",
      amount: 50,
      turns: 4,
      fatal: true,
    };

    const receipt = combatEventReceipt(encounter(), event);
    expect(receipt).toMatchObject({ kind: "status" });
    expect(receipt.text).toContain("50 maximum health for 4 turns");
    expect(receipt.text).toContain("falls to 0 health when the timer expires");
    expect(receipt.text).not.toContain("dies when");
    expect(combatCuesForEvent(encounter(), event)[0]).toMatchObject({
      kind: "empower",
      label: "+50",
      kicker: "Maximum health · 4 turns",
      targetId: "hero",
    });
  });

  it("presents Initiative conversion as the Priority it actually grants", () => {
    const event = {
      sequence: 16,
      type: "initiative-converted",
      actorId: "hero",
      skillId: "blade-quick-swordsmanship",
      initiativeSpent: 100,
      priorityGained: 1,
      remainder: 20,
    };

    const receipt = combatEventReceipt(encounter(), event);
    expect(receipt).toMatchObject({ kind: "tempo" });
    expect(receipt.text).toContain("converts 100 Initiative into 1 Priority");
    expect(receipt.text).toContain("20 Initiative remains");
    expect(combatCuesForEvent(encounter(), event)[0]).toMatchObject({
      kind: "empower",
      label: "+1",
      kicker: "Priority · 20 Initiative remains",
      targetId: "hero",
    });
  });

  it("presents legacy ability-use restoration without calling it Resolve", () => {
    const event = {
      sequence: 17,
      type: "skill-uses-restored",
      actorId: "hero",
      targetId: "hero",
      skillId: "automaton-infinite-power",
      amount: 2,
      restored: 2,
    };

    const receipt = combatEventReceipt(encounter(), event);
    expect(receipt).toMatchObject({ kind: "resource" });
    expect(receipt.text).toContain("restores 2 legacy ability uses");
    expect(receipt.text).not.toContain("Resolve");
    expect(combatCuesForEvent(encounter(), event)[0]).toMatchObject({
      kind: "empower",
      label: "+2",
      kicker: "Ability uses",
      targetId: "hero",
    });
  });

  it("presents the active scaled-status event with its real before and after values", () => {
    const event = {
      sequence: 13,
      type: "skill-status-scaled",
      actorId: "hero",
      targetId: "foe",
      skillId: "priestess-doom",
      statuses: ["burn", "poison", "bleed"],
      percent: 200,
      changed: 30,
      changes: [
        { status: "burn", before: 10, after: 20 },
        { status: "poison", before: 10, after: 20 },
        { status: "bleed", before: 10, after: 20 },
      ],
    };

    const receipt = combatEventReceipt(encounter(), event);
    expect(receipt).toMatchObject({ kind: "status" });
    expect(receipt.text).toContain("Burn 10→20");
    expect(receipt.text).toContain("Poison 10→20");
    expect(receipt.text).toContain("Bleed 10→20");
    expect(combatCuesForEvent(encounter(), event)[0]).toMatchObject({
      kind: "afflict",
      label: "Amplified",
      kicker: "30 stacks",
      targetId: "foe",
    });
  });

  it("presents beneficial status amplification as empowerment with direct grammar", () => {
    const event = {
      sequence: 14,
      type: "skill-status-scaled",
      actorId: "hero",
      targetId: "hero",
      skillId: "witch-proliferation",
      statuses: ["skeleton"],
      percent: 150,
      changed: 5,
      changes: [{ status: "skeleton", before: 10, after: 15 }],
    };

    const receipt = combatEventReceipt(encounter(), event);
    expect(receipt.text).toContain("amplifies your statuses: Skeleton 10→15");
    expect(receipt.text).not.toContain("You's");
    expect(combatCuesForEvent(encounter(), event)[0]).toMatchObject({
      kind: "empower",
      label: "Amplified",
      kicker: "5 stacks",
      targetId: "hero",
      targetSide: "player",
    });
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
        {
          index: 0, dodged: false, critical: false, rawDamage: 7, damage: 7, toHp: 7,
          statusChanges: { attacker: [], defender: [{ type: "protection", before: 3, after: 2 }] },
        },
        {
          index: 1, dodged: false, critical: true, rawDamage: 12, damage: 12, toHp: 12,
          statusChanges: { attacker: [], defender: [{ type: "protection", before: 2, after: 1 }] },
        },
        { index: 2, dodged: false, critical: false, rawDamage: 9, damage: 9, absorbed: 9, toHp: 0 },
        { index: 3, dodged: true, critical: false, rawDamage: 8, damage: 0, toHp: 0 },
      ],
    });

    expect(cues).toHaveLength(4);
    expect(cues.map(({ id, delayMs, label, kind }) => ({ id, delayMs, label, kind }))).toEqual([
      { id: "18-hit-0", delayMs: 0, label: "-7", kind: "hit" },
      { id: "18-hit-1", delayMs: 210, label: "-12", kind: "critical" },
      { id: "18-hit-2", delayMs: 420, label: "0", kind: "ward" },
      { id: "18-hit-3", delayMs: 630, label: "Evaded", kind: "evade" },
    ]);
    expect(cues[1].kicker).toBe("Critical");
    expect(cues[2].kicker).toBe("Ward holds");
    expect(cues.map((cue) => cue.hpChange)).toEqual([-7, -12, 0, 0]);
    expect(cues.map((cue) => cue.shieldChange)).toEqual([0, 0, -9, 0]);
    expect(cues.every((cue) => cue.hitCount === 4)).toBe(true);
    expect(cues.every((cue) => cue.visual.variant === "threefold-cut")).toBe(true);
    expect(cues.slice(0, 2).map((cue) => cue.statusChanges)).toEqual([
      [{ actorId: "foe", type: "protection", before: 3, after: 2 }],
      [{ actorId: "foe", type: "protection", before: 2, after: 1 }],
    ]);
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
      .toEqual(["Fire Strike", "Fire Strike", "Fire Strike", "Swing"]);
    expect(timeline[2].delayMs).toBeGreaterThan(timeline[1].delayMs);
    expect(timeline[3].delayMs).toBeGreaterThan(timeline[2].delayMs);
    expect(timeline[3]).toMatchObject({ attackerId: "foe", targetId: "hero" });
  });

  it("anchors resolved effects to pre-move cells before presenting one atomic formation move", () => {
    const state = encounter({
      formations: {
        version: 2,
        player: [null, "hero", null, null, null, null, null, null, null],
        enemy: [null, null, null, null, "foe", null, null, null, null],
      },
    });
    const timeline = combatCueTimeline(state, [
      {
        sequence: 40,
        type: "enemy-attack",
        enemyId: "foe",
        targetId: "hero",
        attackId: "swing",
        hits: [
          { index: 0, dodged: false, critical: false, rawDamage: 13, damage: 13, toHp: 13 },
        ],
      },
      {
        sequence: 41,
        type: "formation-moved",
        round: 3,
        phase: "round-open",
        moves: [{ actorId: "hero", side: "player", fromCell: 4, toCell: 1 }],
      },
      {
        sequence: 42,
        type: "intent-retargeted",
        enemyId: "foe",
        fromTargetId: "hero",
        targetId: "hero",
      },
    ]);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toMatchObject({
      kind: "hit",
      basicMelee: true,
      sourceCell: { side: "enemy", index: 4 },
      targetCell: { side: "player", index: 4 },
    });
    expect(timeline[1]).toMatchObject({
      id: "41-formation-moved",
      kind: "movement",
      durationMs: 200,
      moves: [{ actorId: "hero", side: "player", fromCell: 4, toCell: 1 }],
      intentRetargets: [{
        type: "intent-retargeted",
        enemyId: "foe",
        fromTargetId: "hero",
        targetId: "hero",
      }],
    });
    expect(timeline[1].formationsBefore.player[4]).toBe("hero");
    expect(timeline[1].formationsBefore.player[1]).toBeNull();
    expect(timeline[1].delayMs).toBeGreaterThan(timeline[0].delayMs);
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
      visual: { family: "fire", variant: "priestess-doom-burn-skill-status-amplified" },
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

  it("surfaces authoritative ward expiry as a negative shield cue", () => {
    const event = {
      sequence: 22,
      type: "ward-expired",
      actorId: "hero",
      amount: 9,
      boundary: "enemy-window",
    };
    expect(combatEventReceipt(encounter(), event).text).toContain("remaining 9 ward expires");
    expect(combatCuesForEvent(encounter(), event)[0]).toMatchObject({
      kind: "ward",
      label: "-9",
      kicker: "Ward expires",
      shieldChange: -9,
      targetId: "hero",
    });
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
