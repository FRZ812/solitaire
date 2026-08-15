import { describe, expect, it } from "vitest";
import { applyStatus, statusCount } from "../kernel/status-stack.js";
import {
  attemptRetreat,
  createTowEncounter,
  declaredIntents,
  endTurn,
  fireTraits,
  isTowEncounter,
  retreatOdds,
  skipTurn,
  useSkill,
} from "./encounter.js";
import { TRAIT_RANK_CAP } from "./traits.js";
import { weaponAttackSnapshot, weaponTechniqueFromItemIds } from "./weapon-techniques.js";

// The Arctic Knight as the wiki records them: 170 HP, 12 ATK, 13 DEF, 9% crit, 4% dodge,
// starting trait Ironclad, starting skills Strike and Block. Crit and dodge are zeroed in
// most cases below so the arithmetic is readable; where they matter they are set back.
function knight(overrides = {}) {
  return {
    id: "arctic-knight",
    name: "Arctic Knight",
    maxHp: 170,
    stats: { attack: 12, defense: 13, critRate: 0, dodgeRate: 0 },
    ...overrides,
  };
}

function foe(overrides = {}) {
  return {
    id: "gatekeeper",
    name: "The Gatekeeper",
    maxHp: 190,
    stats: { attack: 23, defense: 0, critRate: 0, dodgeRate: 0 },
    ...overrides,
  };
}

function start(overrides = {}) {
  return createTowEncounter({
    seed: "tow-encounter-test",
    player: knight(overrides.player),
    enemies: overrides.enemies || [foe()],
    build: { traits: {}, skills: ["strike", "block"], ...overrides.build },
  });
}

describe("starting an encounter", () => {
  it("is a valid encounter with everyone at full health", () => {
    const state = start();
    expect(isTowEncounter(state)).toBe(true);
    expect(state.phase).toBe("player");
    expect(state.round).toBe(1);
    expect(state.actors["arctic-knight"].hp).toBe(170);
    expect(state.actors.gatekeeper.hp).toBe(190);
  });

  it("fires combat-start traits before the first command", () => {
    // Ironclad at rank 7 is 13 Steelskin, and it must be standing before the enemy swings.
    const state = start({ build: { traits: { ironclad: TRAIT_RANK_CAP } } });
    expect(statusCount(state.actors["arctic-knight"].statuses, "steelskin")).toBe(13);
    expect(state.events.some((e) => e.type === "trait-fired" && e.traitId === "ironclad")).toBe(true);
  });

  it("gives Intangible its seven Invincible as an opening, not a play", () => {
    const state = start({ build: { traits: { endurance: 1 } } });
    expect(statusCount(state.actors["arctic-knight"].statuses, "solidity")).toBe(1);
  });

  it("inflicts enemy-targeted traits on every living foe", () => {
    const state = start({
      enemies: [foe(), foe({ id: "second", name: "Second" })],
      build: { traits: { ambush: TRAIT_RANK_CAP } },
    });
    expect(statusCount(state.actors.gatekeeper.statuses, "weak")).toBe(4);
    expect(statusCount(state.actors.second.statuses, "weak")).toBe(4);
  });

  it("fires a build-backed enemy's archetype trait against the player side", () => {
    const state = start({
      enemies: [foe({
        archetypeId: "last-assassin",
        build: { traits: { ambush: TRAIT_RANK_CAP }, skills: ["strike"], runes: [] },
      })],
    });
    expect(statusCount(state.actors["arctic-knight"].statuses, "weak")).toBe(4);
    expect(state.events).toContainEqual(expect.objectContaining({
      type: "trait-fired",
      actorId: "gatekeeper",
      traitId: "ambush",
      effectKind: "inflict-status",
      targetIds: ["arctic-knight"],
    }));
  });

  it("coalesces duplicate hostile trait pressure across a matching enemy line", () => {
    const build = { traits: { ambush: TRAIT_RANK_CAP }, skills: ["strike"], runes: [] };
    const state = start({
      enemies: [
        foe({ build }),
        foe({ id: "second", name: "Second", build }),
      ],
    });
    expect(statusCount(state.actors["arctic-knight"].statuses, "weak")).toBe(4);
    expect(state.events.filter((entry) => (
      entry.type === "trait-fired" && entry.traitId === "ambush"
    ))).toHaveLength(1);
  });

  it("materializes all twelve roster passives at their sourced starting rank", () => {
    const selfCases = [
      ["ironclad", "steelskin", 4],
      ["quickness", "priority", 1],
      ["innovation", "strength", 6],
      ["valiancy", "lethargy-atk", 5],
      ["combo", "eviscerate", 3],
      ["necromancy", "skeleton", 2],
      ["judgment", "judgment", 5],
      ["gale", "initiative-atk", 20],
      ["bloodsuck", "lifesteal", 7],
    ];
    for (const [traitId, status, amount] of selfCases) {
      const state = start({ build: { traits: { [traitId]: 3 } } });
      expect(statusCount(state.actors["arctic-knight"].statuses, status), traitId).toBe(amount);
    }

    const ignition = start({ build: { traits: { ignition: 3 } } });
    expect(statusCount(ignition.actors.gatekeeper.statuses, "burn")).toBe(10);

    const overheat = start({ build: { traits: { overheat: 3 } } });
    expect(statusCount(overheat.actors["arctic-knight"].statuses, "limp")).toBe(7);
    expect(statusCount(overheat.actors.gatekeeper.statuses, "limp")).toBe(7);

    const charging = start({ build: { traits: { charge: 3 } } });
    const charged = fireTraits({ ...charging, round: 4 });
    expect(statusCount(charged.actors["arctic-knight"].statuses, "charge")).toBe(100);
  });

  it("rejects malformed input", () => {
    expect(() => createTowEncounter({ seed: 1, player: knight(), enemies: [] }))
      .toThrow(/invalid-enemies/);
    expect(() => createTowEncounter({ player: knight(), enemies: [foe()] }))
      .toThrow(/invalid-encounter-seed/);
    expect(() => createTowEncounter({
      seed: "s", player: knight(), enemies: [foe()], build: { traits: { nonsense: 1 } },
    })).toThrow(/unknown-trait/);
    expect(() => createTowEncounter({
      seed: "s", player: knight(), enemies: [foe({ id: "arctic-knight" })],
    })).toThrow(/duplicate-actor-id/);
  });
});

describe("using skills", () => {
  it("deals Strike for the recorded fraction of attack power", () => {
    // Strike rank 1 is 100% of ATK. 12 ATK into 0 defence is 12.
    const result = useSkill(start(), "strike");
    expect(result.ok).toBe(true);
    expect(result.state.actors.gatekeeper.hp).toBe(178);
  });

  it("resolves an equipped paired attack as separate hits", () => {
    const technique = weaponTechniqueFromItemIds(["twin-daggers"]);
    const result = useSkill(start({
      build: { basicAttack: weaponAttackSnapshot(technique) },
    }), "strike");
    const event = result.state.events.find((entry) => entry.type === "skill-damage");
    expect(event.basicAttackFormId).toBe("twin-cut");
    expect(event.hits).toHaveLength(2);
    expect(result.state.actors.gatekeeper.hp).toBe(178);
  });

  it("lets a single-hit branch trade the flurry for a debuff", () => {
    const technique = weaponTechniqueFromItemIds(
      ["nightfang-dagger"],
      {},
      { formId: "silencing-cut" },
    );
    const result = useSkill(start({
      build: { basicAttack: weaponAttackSnapshot(technique) },
    }), "strike");
    const damage = result.state.events.find((entry) => entry.type === "skill-damage");
    expect(damage.hits).toHaveLength(1);
    expect(statusCount(result.state.actors.gatekeeper.statuses, "lethargy")).toBe(3);
  });

  it("turns Block into shield from defence, not damage", () => {
    // Block rank 1 is 250% of DEF: 13 * 250% = 32.
    const result = useSkill(start(), "block");
    expect(result.state.actors["arctic-knight"].shield).toBe(32);
    expect(result.state.actors.gatekeeper.hp).toBe(190);
  });

  it("refreshes one ward instead of stacking defensive skills in the same window", () => {
    const state = start({ build: { skills: ["urgent-guard", "block"] } });
    const urgent = useSkill(state, "urgent-guard");
    expect(urgent.state.actors["arctic-knight"].shield).toBe(13);

    const blocked = useSkill(urgent.state, "block");
    expect(blocked.state.actors["arctic-knight"].shield).toBe(32);
    expect(blocked.state.events.filter((event) => event.type === "skill-shield").at(-1))
      .toMatchObject({ amount: 19, ward: 32, before: 13, after: 32 });
  });

  it("spends the turn for a turn-consuming skill and refuses a second", () => {
    const first = useSkill(start(), "strike");
    expect(first.state.turn.actionsRemaining).toBe(0);
    expect(useSkill(first.state, "strike")).toMatchObject({ ok: false, reason: "turn-already-spent" });
  });

  it("leaves the turn open for a turn-free skill", () => {
    const state = start({ build: { skills: ["strike", "warcry"] } });
    const free = useSkill(state, "warcry");
    expect(free.ok).toBe(true);
    expect(free.state.turn.actionsRemaining).toBe(1);
    expect(statusCount(free.state.actors["arctic-knight"].statuses, "solidity")).toBe(3);
    expect(useSkill(free.state, "strike").ok).toBe(true);
  });

  it("refuses a skill that is not in the loadout", () => {
    expect(useSkill(start(), "impregnable")).toMatchObject({ ok: false, reason: "skill-not-held" });
  });

  it("spends an act use", () => {
    const result = useSkill(start(), "block");
    expect(result.state.build.skills.find((s) => s.id === "block").usesRemaining).toBe(29);
  });

  it("meets Steelskin per hit, so the fight reads off the enemy's mitigation", () => {
    const state = start({ enemies: [foe({ statuses: [{ type: "steelskin", count: 4 }] })] });
    const result = useSkill(state, "strike");
    // 12 ATK - 4 Steelskin = 8.
    expect(result.state.actors.gatekeeper.hp).toBe(182);
    expect(statusCount(result.state.actors.gatekeeper.statuses, "steelskin")).toBe(4);
  });

  it("does not mutate the encounter it is given", () => {
    const state = start();
    const before = JSON.stringify(state);
    useSkill(state, "strike");
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("retreat", () => {
  it("compares the whole living party against the whole living enemy side", () => {
    const solo = start();
    const withAlly = createTowEncounter({
      seed: "tow-retreat-party",
      player: knight(),
      allies: [{
        id: "scout",
        name: "Scout",
        maxHp: 90,
        stats: { attack: 9, defense: 4, critRate: 4, dodgeRate: 18 },
        build: { traits: {}, skills: ["strike"] },
      }],
      enemies: [foe()],
      build: { traits: {}, skills: ["strike"] },
    });
    expect(retreatOdds(withAlly).playerRating).toBeGreaterThan(retreatOdds(solo).playerRating);
    expect(retreatOdds(withAlly).chancePercent).toBeGreaterThan(retreatOdds(solo).chancePercent);
  });

  it("is bounded and deterministic from the combat stream", () => {
    const state = start();
    const first = attemptRetreat(state);
    const second = attemptRetreat(state);
    expect(first).toEqual(second);
    expect(retreatOdds(state).chancePercent).toBeGreaterThanOrEqual(10);
    expect(retreatOdds(state).chancePercent).toBeLessThanOrEqual(90);
    expect(first.state.events.at(-1).type).toMatch(/retreat/);
  });

  it("spends exactly one action on a failed attempt and preserves extra Haste actions", () => {
    let seed = 0;
    let result;
    do {
      const state = createTowEncounter({
        seed: `failed-retreat-${seed}`,
        player: knight({ statuses: [{ type: "haste", count: 1 }] }),
        enemies: [foe({ maxHp: 900, stats: { attack: 80, defense: 40, critRate: 20, dodgeRate: 20 } })],
        build: { traits: {}, skills: ["strike"] },
      });
      result = attemptRetreat(state);
      seed += 1;
    } while (result.state.phase !== "player" && seed < 200);
    expect(result.state.phase).toBe("player");
    expect(result.state.turn.actionsRemaining).toBe(1);
    expect(result.state.events.findLast((event) => event.type === "retreat-attempt"))
      .toMatchObject({ succeeded: false });
  });

  it("ends the encounter without a victor on success", () => {
    let seed = 0;
    let result;
    do {
      const state = createTowEncounter({
        seed: `successful-retreat-${seed}`,
        player: knight({ maxHp: 800, stats: { attack: 80, defense: 40, critRate: 20, dodgeRate: 30 } }),
        enemies: [foe({ maxHp: 10, stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 } })],
        build: { traits: {}, skills: ["strike"] },
      });
      result = attemptRetreat(state);
      seed += 1;
    } while (result.state.phase !== "retreated" && seed < 200);
    expect(result.state.phase).toBe("retreated");
    expect(result.state.actors.gatekeeper.hp).toBe(10);
    expect(result.state.events.at(-1)).toMatchObject({ type: "retreated" });
  });
});

describe("ending the turn", () => {
  it("lets the enemy answer and advances the round", () => {
    const result = endTurn(start());
    expect(result.ok).toBe(true);
    expect(result.state.round).toBe(2);
    expect(result.state.turn.actionsRemaining).toBe(1);
    expect(result.state.actors["arctic-knight"].hp).toBeLessThan(170);
  });

  it("spends ward before health and expires any remainder after the hostile window", () => {
    const blocked = useSkill(start(), "block").state;
    const after = endTurn(blocked).state;
    const knightAfter = after.actors["arctic-knight"];
    // 32 ward absorbs the 23-damage swing, then the unused 9 expires instead of banking.
    expect(knightAfter.hp).toBe(170);
    expect(knightAfter.shield).toBe(0);
    expect(after.events).toContainEqual(expect.objectContaining({
      type: "ward-expired",
      actorId: "arctic-knight",
      amount: 9,
      boundary: "enemy-window",
    }));
  });

  it("resolves Misfortune before the affected enemy can take its command", () => {
    const state = start({
      enemies: [foe({
        maxHp: 8,
        hp: 8,
        statuses: [{ type: "misfortune", count: 8 }],
      })],
    });
    const after = endTurn(state).state;
    expect(after.phase).toBe("victory");
    expect(after.events).toContainEqual(expect.objectContaining({
      type: "tick-damage",
      actorId: "gatekeeper",
      misfortune: 8,
    }));
    expect(after.events.some((event) => event.type === "enemy-attack")).toBe(false);
  });

  it("uses a multi-hit attack table, applying permanent mitigation to every hit", () => {
    const state = createTowEncounter({
      seed: "multi-hit",
      player: knight({ stats: { attack: 12, defense: 13, critRate: 0, dodgeRate: 0 } }),
      enemies: [foe({ attacks: [{ id: "flurry", name: "Flurry", hits: 3, damage: 10 }] })],
      build: { traits: { ironclad: 1 }, skills: ["strike"] },
    });
    // Ironclad rank 1 is 1 Steelskin, and source Steelskin never decays.
    expect(statusCount(state.actors["arctic-knight"].statuses, "steelskin")).toBe(1);
    const after = endTurn(state).state;
    const attackEvent = after.events.find((e) => e.type === "enemy-attack");
    expect(attackEvent.hits).toHaveLength(3);
    expect(attackEvent.hits.map((hit) => hit.damage)).toEqual([9, 9, 9]);
    expect(after.actors["arctic-knight"].hp).toBe(170 - 27);
  });

  it("lets every living enemy act", () => {
    const state = start({ enemies: [foe(), foe({ id: "second", name: "Second" })] });
    const after = endTurn(state).state;
    expect(after.events.filter((e) => e.type === "enemy-attack")).toHaveLength(2);
    expect(after.actors["arctic-knight"].hp).toBe(170 - 46);
  });

  it("skips an enemy that is already down", () => {
    const state = start({
      enemies: [foe({ maxHp: 190, hp: 0 }), foe({ id: "second", name: "Second" })],
    });
    const after = endTurn(state).state;
    expect(after.events.filter((e) => e.type === "enemy-attack")).toHaveLength(1);
  });

  it("fires cadence traits on their round, not before", () => {
    // Detection grants Thorn every 4 turns.
    let state = start({ build: { traits: { detection: TRAIT_RANK_CAP } } });
    expect(statusCount(state.actors["arctic-knight"].statuses, "thorn")).toBe(0);
    for (let round = 0; round < 3; round += 1) state = endTurn(state).state;
    expect(state.round).toBe(4);
    expect(statusCount(state.actors["arctic-knight"].statuses, "thorn")).toBe(14);
  });

  it("burns for fixed damage at the holder's turn end, then loses one to the incoming hit", () => {
    const state = start({
      player: { ...knight(), statuses: [{ type: "burn", count: 5 }] },
    });
    const after = endTurn(state).state;
    // The player hands over their turn first, so Burn deals its current 5 before the foe
    // swings. That landed hit then leaves 4 Burn waiting for the player's next turn end.
    expect(after.events.find((e) => e.type === "tick-damage")).toMatchObject({ burn: 5 });
    expect(statusCount(after.actors["arctic-knight"].statuses, "burn")).toBe(4);
    // 5 from Burn plus 23 from the swing. Raw DEF is deliberately not flat mitigation —
    // the evidence has DEF feeding Block's shield and Tenacity, while Steelskin and
    // Protection are what reduce an incoming hit.
    expect(after.actors["arctic-knight"].hp).toBe(170 - 5 - 23);
  });

  it("replicates persistent Burn and Bleed, decaying Poison, and one-turn Doom", () => {
    const state = start({
      player: {
        ...knight(),
        statuses: [
          { type: "burn", count: 5 },
          { type: "poison", count: 3 },
          { type: "bleed", count: 4 },
          { type: "doom", count: 6 },
        ],
      },
      enemies: [foe({ statuses: [{ type: "stun", count: 5 }] })],
    });

    const first = endTurn(state).state;
    expect(first.events.filter((event) => (
      event.type === "tick-damage" && event.actorId === "arctic-knight"
    )).at(-1)).toMatchObject({ burn: 5, poison: 3, bleed: 4, doom: 6 });
    expect(first.actors["arctic-knight"].hp).toBe(170 - 18);
    expect(statusCount(first.actors["arctic-knight"].statuses, "burn")).toBe(5);
    expect(statusCount(first.actors["arctic-knight"].statuses, "poison")).toBe(2);
    expect(statusCount(first.actors["arctic-knight"].statuses, "bleed")).toBe(4);
    expect(statusCount(first.actors["arctic-knight"].statuses, "doom")).toBe(0);

    const second = endTurn(first).state;
    expect(second.events.filter((event) => (
      event.type === "tick-damage" && event.actorId === "arctic-knight"
    )).at(-1)).toMatchObject({ burn: 5, poison: 2, bleed: 4, doom: 0 });
    expect(second.actors["arctic-knight"].hp).toBe(170 - 18 - 11);
    expect(statusCount(second.actors["arctic-knight"].statuses, "burn")).toBe(5);
    expect(statusCount(second.actors["arctic-knight"].statuses, "poison")).toBe(1);
    expect(statusCount(second.actors["arctic-knight"].statuses, "bleed")).toBe(4);
  });

  it("holds newly inflicted source Doom through the next player command window", () => {
    const state = start({
      enemies: [foe({
        archetypeId: "tenacious-mage",
        maxHp: 160,
        stats: { attack: 15, defense: 12, critRate: 0, dodgeRate: 0 },
        build: { traits: {}, skills: ["mage-destruction-ray"], runes: [] },
      })],
    });

    const first = endTurn(state).state;
    expect(first.actors["arctic-knight"].hp).toBe(170);
    expect(statusCount(first.actors["arctic-knight"].statuses, "doom")).toBe(36);
    expect(first.events.some((event) => (
      event.type === "tick-damage"
      && event.actorId === "arctic-knight"
      && event.doom > 0
    ))).toBe(false);

    const waiting = {
      ...first,
      actors: {
        ...first.actors,
        gatekeeper: {
          ...first.actors.gatekeeper,
          statuses: applyStatus(first.actors.gatekeeper.statuses, "stun", 1),
        },
      },
    };
    const second = endTurn(waiting).state;
    expect(second.actors["arctic-knight"].hp).toBe(170 - 36);
    expect(statusCount(second.actors["arctic-knight"].statuses, "doom")).toBe(0);
    expect(second.events.filter((event) => (
      event.type === "tick-damage" && event.actorId === "arctic-knight"
    )).at(-1)).toMatchObject({ doom: 36 });
  });

  it("decays end-of-turn statuses", () => {
    const state = useSkill(start({ build: { skills: ["warcry"] } }), "warcry").state;
    expect(statusCount(state.actors["arctic-knight"].statuses, "solidity")).toBe(3);
    const after = endTurn(state).state;
    // Solidity loses one Count to the landed hit and has no separate per-turn decay.
    expect(statusCount(after.actors["arctic-knight"].statuses, "solidity")).toBe(2);
  });

  it("nullifies an actor held by a control status", () => {
    const state = start({ enemies: [foe({ statuses: [{ type: "sleep", count: 3 }] })] });
    const after = endTurn(state).state;
    expect(after.events.some((e) => e.type === "enemy-nullified")).toBe(true);
    expect(statusCount(after.actors.gatekeeper.statuses, "sleep")).toBe(2);
    expect(after.actors["arctic-knight"].hp).toBe(170);
  });

  it("resolves innate on-hit passives per individual hit", () => {
    const combo = useSkill(start({
      build: { traits: { combo: 3 }, skills: ["assassin-mutilate"] },
    }), "assassin-mutilate");
    // Combo grants Eviscerate; every hit adds its Count as permanent Limp.
    expect(statusCount(combo.state.actors.gatekeeper.statuses, "limp")).toBe(9);

    const valiancy = useSkill(start({
      build: { traits: { valiancy: 3 }, skills: ["assassin-mutilate"] },
    }), "assassin-mutilate");
    expect(statusCount(valiancy.state.actors.gatekeeper.statuses, "lethargy")).toBe(15);

    const gale = useSkill(start({
      build: { traits: { gale: 7 }, skills: ["assassin-mutilate"] },
    }), "assassin-mutilate");
    expect(statusCount(gale.state.actors["arctic-knight"].statuses, "priority")).toBe(1);
    expect(statusCount(gale.state.actors["arctic-knight"].statuses, "initiative")).toBe(20);

    const judgment = useSkill(start({
      build: { traits: { judgment: 3 }, skills: ["assassin-flurry"] },
    }), "assassin-flurry");
    const hit = judgment.state.events.find((event) => event.type === "skill-damage").hits[0];
    expect(hit.onHitStatuses).toContainEqual({ status: "doom", count: 5 });
    expect(statusCount(judgment.state.actors.gatekeeper.statuses, "doom")).toBe(10);
    expect(statusCount(judgment.state.actors["arctic-knight"].statuses, "judgment")).toBe(0);
  });

  it("keeps Spinning Axe's source self-Lethargy separate from Valiancy's attack Lethargy", () => {
    const state = start({
      build: { traits: { valiancy: TRAIT_RANK_CAP }, skills: ["north-king-whirlwind"] },
    });
    const used = useSkill(state, "north-king-whirlwind");
    expect(statusCount(used.state.actors.gatekeeper.statuses, "lethargy")).toBe(17);
    expect(statusCount(used.state.actors["arctic-knight"].statuses, "lethargy")).toBe(15);

    const after = endTurn(used.state).state;
    const attack = after.events.find((event) => event.type === "enemy-attack");
    expect(attack.hits.map((hit) => hit.damage)).toEqual([6]);
    expect(after.actors["arctic-knight"].hp).toBe(170 - 6);
    expect(statusCount(after.actors.gatekeeper.statuses, "lethargy")).toBe(0);
    // StackDownDelay 1 protects the self-inflicted Lethargy from the boundary immediately
    // following the skill that created it.
    expect(statusCount(after.actors["arctic-knight"].statuses, "lethargy")).toBe(15);
  });

  it("turns Necromancy, Bloodsuck, and Charge into combat outcomes", () => {
    const skeletons = useSkill(start({
      build: { traits: { necromancy: 3 }, skills: ["arctic-strike"] },
    }), "arctic-strike");
    expect(skeletons.state.events.find((event) => event.type === "skill-damage").amount).toBe(14);

    const bloodsuck = useSkill(start({
      player: { hp: 100 },
      build: { traits: { bloodsuck: 3 }, skills: ["arctic-strike"] },
    }), "arctic-strike");
    expect(bloodsuck.state.actors["arctic-knight"].hp).toBe(101);

    const charging = start({ build: { traits: { charge: 3 }, skills: ["arctic-strike"] } });
    const charged = fireTraits({ ...charging, round: 4 });
    const strike = useSkill(charged, "arctic-strike");
    expect(strike.state.events.find((event) => event.type === "skill-damage").hits[0])
      .toMatchObject({ critical: true, chargeSpent: 0 });
  });

  it("automatically spends control when the affected player window is skipped", () => {
    const state = start({
      player: { ...knight(), statuses: [{ type: "paralyze", count: 1 }] },
    });
    const skipped = skipTurn(state, state.playerId);
    expect(skipped.ok).toBe(true);
    expect(skipped.state.turn.actionsRemaining).toBe(0);
    expect(statusCount(skipped.state.actors[state.playerId].statuses, "paralyze")).toBe(0);
    expect(skipped.state.events).toContainEqual(expect.objectContaining({
      type: "actor-nullified",
      actorId: state.playerId,
      controls: ["paralyze"],
      stacksSpent: 1,
    }));
  });

  it("enforces a controlled player forfeiture even when a caller hands the window over directly", () => {
    const state = start({
      player: { ...knight(), statuses: [{ type: "paralyze", count: 1 }] },
    });
    const after = endTurn(state).state;
    expect(after.round).toBe(2);
    expect(statusCount(after.actors[state.playerId].statuses, "paralyze")).toBe(0);
    expect(after.events).toContainEqual(expect.objectContaining({
      type: "actor-nullified",
      actorId: state.playerId,
      controls: ["paralyze"],
    }));
  });

  it("keeps freshly inflicted Stun for the player's next command window", () => {
    const state = createTowEncounter({
      seed: "enemy-kick-control",
      player: knight({ maxHp: 400 }),
      enemies: [foe({
        archetypeId: "demon-slayer",
        build: { traits: {}, skills: ["demon-kick"], runes: [] },
      })],
      build: { traits: {}, skills: ["strike"], runes: [] },
      intentSchedules: {
        gatekeeper: { id: "kick-only", steps: [{ id: "kick", attackIds: ["demon-kick"] }] },
      },
    });
    const after = endTurn(state).state;
    expect(statusCount(after.actors[after.playerId].statuses, "stun")).toBe(1);
    expect(after.turn.actionsRemaining).toBe(1);
    expect(after.events).toContainEqual(expect.objectContaining({
      type: "skill-status",
      actorId: "gatekeeper",
      targetId: after.playerId,
      status: "stun",
    }));
  });

  it("lets Unstoppable answer a control status", () => {
    const state = start({
      enemies: [foe({ statuses: [{ type: "sleep", count: 3 }, { type: "unstoppable", count: 4 }] })],
    });
    const after = endTurn(state).state;
    expect(after.events.some((e) => e.type === "enemy-attack")).toBe(true);
  });
});

describe("terminal outcomes", () => {
  it("reaches victory when the last enemy falls", () => {
    const state = start({ enemies: [foe({ maxHp: 190, hp: 5 })] });
    const after = useSkill(state, "strike").state;
    expect(after.phase).toBe("victory");
    expect(after.actors.gatekeeper.hp).toBe(0);
    expect(useSkill(after, "strike")).toMatchObject({ ok: false, reason: "encounter-over" });
    expect(endTurn(after)).toMatchObject({ ok: false, reason: "encounter-over" });
  });

  it("stays alive while any enemy stands", () => {
    const state = start({ enemies: [foe({ maxHp: 190, hp: 5 }), foe({ id: "second", name: "Second" })] });
    const after = useSkill(state, "strike", "gatekeeper").state;
    expect(after.phase).toBe("player");
  });

  it("reaches defeat when the player falls", () => {
    const state = start({ player: { ...knight(), maxHp: 170, hp: 5 } });
    const after = endTurn(state).state;
    expect(after.phase).toBe("defeat");
    expect(after.actors["arctic-knight"].hp).toBe(0);
  });
});

describe("determinism", () => {
  it("replays identically from the same seed", () => {
    const run = () => {
      let state = createTowEncounter({
        seed: "repeatable",
        player: knight({ stats: { attack: 12, defense: 13, critRate: 30, dodgeRate: 20 } }),
        enemies: [foe({ stats: { attack: 23, defense: 0, critRate: 25, dodgeRate: 15 } })],
        build: { traits: { agility: 4, ironclad: 3 }, skills: ["strike", "block"] },
      });
      for (let turn = 0; turn < 5 && state.phase === "player"; turn += 1) {
        const used = useSkill(state, turn % 2 === 0 ? "strike" : "block");
        state = used.ok ? used.state : state;
        if (state.phase !== "player") break;
        state = endTurn(state).state;
      }
      return state;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("keeps the event log sequential", () => {
    let state = start();
    for (let turn = 0; turn < 3; turn += 1) {
      state = useSkill(state, "strike").state;
      state = endTurn(state).state;
    }
    expect(state.events).toHaveLength(state.sequence);
    state.events.forEach((entry, index) => {
      expect(entry.sequence).toBe(index + 1);
      expect(entry.round).toBeGreaterThanOrEqual(1);
    });
    expect(isTowEncounter(state)).toBe(true);
  });
});

describe("Priority and Haste", () => {
  it("gives one action a round by default", () => {
    expect(start().turn.actionsRemaining).toBe(1);
  });

  it("turns Haste into an extra action, spendable the same round", () => {
    // Swift grants Haste; two stacks means three turn-consuming actions this round.
    const state = start({ player: { ...knight(), statuses: [{ type: "haste", count: 2 }] } });
    expect(state.turn.actionsRemaining).toBe(3);
    let after = useSkill(state, "strike").state;
    expect(after.turn.actionsRemaining).toBe(2);
    after = useSkill(after, "strike").state;
    after = useSkill(after, "strike").state;
    expect(after.turn.actionsRemaining).toBe(0);
    expect(useSkill(after, "strike")).toMatchObject({ ok: false, reason: "turn-already-spent" });
    // Three strikes of 12 landed, not one.
    expect(after.actors.gatekeeper.hp).toBe(190 - 36);
  });

  it("lets Priority act before the enemy", () => {
    const state = start({ player: { ...knight(), statuses: [{ type: "priority", count: 3 }] } });
    expect(state.turn.actionsRemaining).toBe(4);
  });

  it("applies High-Speed Flight Priority immediately before the enemy can answer", () => {
    const state = start({
      build: { skills: ["strike", "sleepless-high-speed-flight"] },
    });
    const flight = useSkill(state, "sleepless-high-speed-flight");

    expect(flight.ok).toBe(true);
    expect(statusCount(flight.state.actors[flight.state.playerId].statuses, "priority")).toBe(4);
    // The source Mythic consumes the current action, then grants four Priority actions.
    expect(flight.state.turn.actionsRemaining).toBe(4);
    expect(flight.state.events.some((event) => event.type === "enemy-attack")).toBe(false);

    const firstAction = useSkill(flight.state, "strike");
    expect(firstAction.state.turn.actionsRemaining).toBe(3);
    expect(statusCount(firstAction.state.actors[firstAction.state.playerId].statuses, "priority")).toBe(3);
    expect(firstAction.state.events.some((event) => event.type === "enemy-attack")).toBe(false);

    let sequence = firstAction.state;
    for (let action = 0; action < 3; action += 1) sequence = useSkill(sequence, "strike").state;
    expect(sequence.turn.actionsRemaining).toBe(0);
    expect(statusCount(sequence.actors[sequence.playerId].statuses, "priority")).toBe(0);
  });

  it("lets an enemy spend all four Priority actions before returning control", () => {
    const state = start({
      player: knight({ maxHp: 1000 }),
      enemies: [foe({
        maxHp: 900,
        statuses: [{ type: "priority", count: 4 }],
        attacks: [{ id: "tap", name: "Tap", hits: 1, damage: 2 }],
      })],
    });
    const after = endTurn(state).state;
    const attacks = after.events.filter((event) => event.type === "enemy-attack");
    expect(attacks).toHaveLength(5);
    expect(statusCount(after.actors.gatekeeper.statuses, "priority")).toBe(0);
    expect(after.actors[after.playerId].hp).toBe(1000 - 10);
  });

  it("cancels Priority against the enemy's own", () => {
    // "If the enemy has Priority too, they cancel out each other."
    const state = start({
      player: { ...knight(), statuses: [{ type: "priority", count: 3 }] },
      enemies: [foe({ statuses: [{ type: "priority", count: 2 }] })],
    });
    expect(state.turn.actionsRemaining).toBe(2);
  });

  it("never drops below one action when the enemy out-prioritises you", () => {
    const state = start({
      player: { ...knight(), statuses: [{ type: "priority", count: 1 }] },
      enemies: [foe({ statuses: [{ type: "priority", count: 9 }] })],
    });
    expect(state.turn.actionsRemaining).toBe(1);
  });

  it("ignores the Priority of a foe that is already down", () => {
    const state = start({
      player: { ...knight(), statuses: [{ type: "priority", count: 2 }] },
      enemies: [foe({ maxHp: 190, hp: 0, statuses: [{ type: "priority", count: 5 }] }),
        foe({ id: "second", name: "Second" })],
    });
    expect(state.turn.actionsRemaining).toBe(3);
  });

  it("stacks Haste with net Priority", () => {
    const state = start({
      player: { ...knight(), statuses: [{ type: "haste", count: 1 }, { type: "priority", count: 2 }] },
    });
    expect(state.turn.actionsRemaining).toBe(4);
  });

  it("recomputes the count each round, after cadence traits fire", () => {
    // Haste decays at end of turn, so the extra action is not permanent.
    const state = start({ player: { ...knight(), statuses: [{ type: "haste", count: 1 }] } });
    expect(state.turn.actionsRemaining).toBe(2);
    const after = endTurn(useSkill(state, "strike").state).state;
    expect(after.turn.actionsRemaining).toBe(1);
  });
});

describe("telegraphed enemy turns", () => {
  // A foe with a real move set, so its declaration is a choice rather than a formality.
  function brute(overrides = {}) {
    return foe({
      maxHp: 900,
      stats: { attack: 9, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [
        { id: "jab", name: "Jab", hits: 1, damage: 4 },
        { id: "swing", name: "Swing", hits: 1, damage: 9 },
        { id: "heavy", name: "Heavy blow", hits: 1, damage: 15 },
      ],
      ...overrides,
    });
  }

  function tank(overrides = {}) {
    return { ...knight(), maxHp: 4000, ...overrides };
  }

  function blade(overrides = {}) {
    return foe({
      maxHp: 900,
      stats: { attack: 9, defense: 12, critRate: 0, dodgeRate: 0 },
      archetypeId: "wandering-blade",
      build: {
        traits: { gale: 1 },
        skills: ["blade-slash", "blade-barrier", "blade-chi-liberation", "blade-one-flash"],
        runes: [],
      },
      ...overrides,
    });
  }

  it("declares before the player's first decision", () => {
    // The whole point: information exists before the player spends a turn, so the decision
    // can be better-informed than a guess.
    const state = start({ player: tank(), enemies: [brute()] });
    const declared = declaredIntents(state);
    expect(declared).toHaveLength(1);
    expect(declared[0]).toMatchObject({ enemyId: "gatekeeper", targetId: "arctic-knight" });
    expect(state.events.some((event) => event.type === "intent-declared")).toBe(true);
  });

  it("swings exactly what it declared, every round", () => {
    let state = start({ player: tank(), enemies: [brute()] });
    for (let round = 0; round < 12; round += 1) {
      const promised = declaredIntents(state)[0];
      const after = endTurn(state);
      expect(after.ok).toBe(true);
      const swung = after.state.events.filter((event) => event.type === "enemy-attack").at(-1);
      expect(swung.attackId).toBe(promised.attackId);
      state = after.state;
    }
  });

  it("shows the damage the attack brings, not the damage that will land", () => {
    // Defence, crit and dodge are still live — that is the part the player's decision is
    // supposed to influence.
    const state = start({ player: tank(), enemies: [brute()] });
    const declared = declaredIntents(state)[0];
    const attack = state.enemyAttacks.gatekeeper.find((entry) => entry.id === declared.attackId);
    expect(declared.damage).toBe(attack.damage);
    expect(declared.hits).toBe(attack.hits);
  });

  it("draws declarations off the intent stream, never the combat stream", () => {
    // This is what stops a schedule change rewriting a damage roll a saved fight recorded.
    const state = start({ player: tank(), enemies: [brute()] });
    const opened = createTowEncounter({
      seed: "tow-encounter-test",
      player: tank(),
      enemies: [brute()],
      build: { traits: {}, skills: ["strike", "block"] },
    });
    expect(state.rng).toEqual(opened.rng);
    expect(state.intentRng).not.toEqual(state.rng);
  });

  it("declares and resolves a real defensive skill through the shared skill machinery", () => {
    const state = createTowEncounter({
      seed: "build-backed-ward",
      player: tank(),
      enemies: [blade({ hp: 450 })],
      build: { traits: {}, skills: ["strike", "block"] },
      intentSchedules: {
        gatekeeper: {
          id: "blade-guard",
          steps: [{ id: "brace", attackIds: ["blade-barrier"] }],
        },
      },
    });
    expect(state.enemyArchetypes.gatekeeper).toBe("wandering-blade");
    expect(declaredIntents(state)[0]).toMatchObject({
      enemyId: "gatekeeper",
      attackId: "blade-barrier",
      skillId: "blade-barrier",
      kind: "ward",
      target: "self",
      targetId: "gatekeeper",
      damage: 0,
    });

    const beforeUses = state.enemyBuilds.gatekeeper.skills
      .find((entry) => entry.id === "blade-barrier").usesRemaining;
    const after = endTurn(state).state;
    expect(after.events).toContainEqual(expect.objectContaining({
      type: "skill-shield",
      actorId: "gatekeeper",
      skillId: "blade-barrier",
    }));
    expect(after.actors.gatekeeper.shield).toBeGreaterThan(0);
    expect(after.enemyBuilds.gatekeeper.skills
      .find((entry) => entry.id === "blade-barrier").usesRemaining).toBe(beforeUses - 1);
    expect(after.events.some((entry) => entry.type === "enemy-attack")).toBe(false);
  });

  it("does not let a secondary boon make a healthy foe spam its ward skill", () => {
    const state = createTowEncounter({
      seed: "build-backed-ward-usefulness",
      player: tank(),
      enemies: [blade()],
      build: { traits: {}, skills: ["strike", "block"] },
      intentSchedules: {
        gatekeeper: {
          id: "blade-guard-or-cut",
          steps: [{ id: "answer", attackIds: ["blade-barrier", "blade-slash"] }],
        },
      },
    });

    expect(state.actors.gatekeeper.hp).toBe(state.actors.gatekeeper.maxHp);
    expect(declaredIntents(state)[0]).toMatchObject({
      enemyId: "gatekeeper",
      skillId: "blade-slash",
      kind: "damage",
    });
  });

  it("expires an enemy ward before its next command window instead of stacking another", () => {
    const state = createTowEncounter({
      seed: "build-backed-ward-lifecycle",
      player: tank(),
      enemies: [blade({ hp: 450 })],
      build: { traits: {}, skills: ["strike", "block"] },
      intentSchedules: {
        gatekeeper: {
          id: "blade-guard-loop",
          steps: [{ id: "brace", attackIds: ["blade-barrier"] }],
        },
      },
    });
    const first = endTurn(state).state;
    const firstWard = first.actors.gatekeeper.shield;
    expect(firstWard).toBeGreaterThan(0);

    // Do not touch the foe's ward during the player window. It must still expire before the
    // foe gets another command; if the barrier is selected again, the result is one fresh
    // brace with the same ceiling, never old + new.
    const defended = useSkill(first, "block").state;
    const second = endTurn(defended).state;
    expect(second.events).toContainEqual(expect.objectContaining({
      type: "ward-expired",
      actorId: "gatekeeper",
      amount: firstWard,
      boundary: "player-window",
    }));
    expect(second.actors.gatekeeper.shield).toBeLessThanOrEqual(firstWard);
  });

  it("strikes with the exact authored ability it promised", () => {
    const state = createTowEncounter({
      seed: "build-backed-slash",
      player: tank(),
      enemies: [blade()],
      build: { traits: {}, skills: ["strike", "block"] },
      intentSchedules: {
        gatekeeper: {
          id: "blade-offence",
          steps: [{ id: "cut", attackIds: ["blade-slash"] }],
        },
      },
    });
    const promised = declaredIntents(state)[0];
    const after = endTurn(state).state;
    expect(promised).toMatchObject({ skillId: "blade-slash", name: "Katana Strike", kind: "damage" });
    expect(after.events).toContainEqual(expect.objectContaining({
      type: "skill-damage",
      actorId: "gatekeeper",
      targetId: "arctic-knight",
      skillId: promised.skillId,
    }));
    const strikeEvent = after.events.find((entry) => (
      entry.type === "skill-damage" && entry.skillId === promised.skillId
    ));
    expect(strikeEvent.hits[0].statusChanges.attacker).toContainEqual({
      type: "initiative",
      before: 0,
      after: 10,
    });
    expect(after.intents.gatekeeper.declarationIndex)
      .toBe(state.intents.gatekeeper.declarationIndex + 1);
    expect(after.events.some((entry) => entry.type === "enemy-attack")).toBe(false);
  });

  it("amplifies existing Doom Attack with source Chi Liberation before one sword attack", () => {
    const state = createTowEncounter({
      seed: "enemy-chi-sequence",
      player: tank(),
      enemies: [blade({ statuses: [{ type: "doom-atk", count: 10 }] })],
      build: { traits: {}, skills: ["strike", "block"] },
      intentSchedules: {
        gatekeeper: {
          id: "chi-then-cuts",
          steps: [
            { id: "release", attackIds: ["blade-chi-liberation"] },
            { id: "cut-one", attackIds: ["blade-slash"] },
          ],
        },
      },
    });

    const after = endTurn(state).state;
    const chiEvents = after.events.filter((event) => event.skillId === "blade-chi-liberation");
    const cuts = after.events.filter((event) => (
      event.type === "skill-damage" && event.skillId === "blade-slash"
    ));
    const chiState = after.enemyBuilds.gatekeeper.skills
      .find((skill) => skill.id === "blade-chi-liberation");

    expect(chiEvents).toContainEqual(expect.objectContaining({
      type: "skill-status-scaled",
      statuses: ["doom-atk"],
      percent: 160,
      changed: 6,
    }));
    expect(cuts).toHaveLength(1);
    expect(statusCount(after.actors.gatekeeper.statuses, "doom-atk")).toBe(16);
    expect(statusCount(after.actors["arctic-knight"].statuses, "doom")).toBe(16);
    expect(chiState).toMatchObject({ usesRemaining: 1, cooldownRemaining: 6 });
  });

  it("holds a stunned foe's telegraph rather than erasing the attack", () => {
    // INTENT_CONTROL_POLICY: control buys tempo. The blow the player was shown still lands,
    // one round later, so the telegraph never turns out to have been a lie.
    const state = start({
      player: tank(),
      enemies: [brute({ statuses: [{ type: "stun", count: 3 }] })],
    });
    const promised = declaredIntents(state)[0];
    const after = endTurn(state).state;
    expect(after.events.some((event) => event.type === "enemy-nullified")).toBe(true);
    expect(declaredIntents(after)[0].attackId).toBe(promised.attackId);
    expect(declaredIntents(after)[0].declarationIndex).toBe(promised.declarationIndex);
  });

  it("advances the rotation once a blow actually lands", () => {
    const state = start({ player: tank(), enemies: [brute()] });
    const before = state.intents.gatekeeper.declarationIndex;
    const after = endTurn(state).state;
    expect(after.intents.gatekeeper.declarationIndex).toBe(before + 1);
  });

  it("stops telegraphing for a foe that has fallen", () => {
    const state = start({
      player: tank(),
      enemies: [brute({ maxHp: 1 }), brute({ id: "second", name: "Second" })],
    });
    expect(declaredIntents(state)).toHaveLength(2);
    const after = endTurn(useSkill(state, "strike", "gatekeeper").state).state;
    expect(after.actors.gatekeeper.hp).toBe(0);
    expect(declaredIntents(after).map((intent) => intent.enemyId)).toEqual(["second"]);
  });

  it("declares for a whole group in stable order", () => {
    const first = start({
      player: tank(),
      enemies: [brute(), brute({ id: "second", name: "Second" }), brute({ id: "third", name: "Third" })],
    });
    const second = start({
      player: tank(),
      enemies: [brute(), brute({ id: "second", name: "Second" }), brute({ id: "third", name: "Third" })],
    });
    expect(declaredIntents(first)).toEqual(declaredIntents(second));
    expect(declaredIntents(first).map((intent) => intent.enemyId))
      .toEqual(["gatekeeper", "second", "third"]);
  });

  it("takes an authored rotation over the generated one", () => {
    const state = createTowEncounter({
      seed: "tow-encounter-test",
      player: tank(),
      enemies: [brute()],
      build: { traits: {}, skills: ["strike", "block"] },
      intentSchedules: {
        gatekeeper: { id: "gatekeeper-duel", steps: [{ id: "wind-up", attackIds: ["heavy"] }] },
      },
    });
    expect(state.intents.gatekeeper.patternId).toBe("gatekeeper-duel");
    expect(declaredIntents(state)[0].attackId).toBe("heavy");
    // One step, one option: this foe only ever winds up the heavy blow.
    expect(declaredIntents(endTurn(state).state)[0].attackId).toBe("heavy");
  });

  it("refuses an authored rotation it cannot read", () => {
    expect(() => createTowEncounter({
      seed: "tow-encounter-test",
      player: tank(),
      enemies: [brute()],
      build: { traits: {}, skills: ["strike"] },
      intentSchedules: { gatekeeper: { id: "broken" } },
    })).toThrow("invalid-intent-schedules");
  });

  it("refuses to swing at all when a declaration and the attack table disagree", () => {
    // Only reachable by tampering, but silently substituting a swing of the engine's own
    // choosing would hide exactly the fault that matters.
    const state = start({ player: tank(), enemies: [brute()] });
    const desynced = {
      ...state,
      intents: { ...state.intents, gatekeeper: { ...state.intents.gatekeeper, attackId: "meteor" } },
    };
    const result = endTurn(desynced);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("intent-desync");
    expect(result.state).toBe(desynced);
  });

  it("still fights a foe that has no attack table at all", () => {
    const state = start({ player: tank(), enemies: [foe({ attacks: [] })] });
    expect(declaredIntents(state)).toEqual([]);
    const after = endTurn(state);
    expect(after.ok).toBe(true);
    expect(after.state.events.some((event) => event.type === "enemy-attack")).toBe(true);
  });
});

describe("allies under player command", () => {
  function ally(overrides = {}) {
    return {
      id: "kestrel",
      name: "Kestrel",
      maxHp: 120,
      stats: { attack: 8, defense: 4, critRate: 0, dodgeRate: 0 },
      build: { traits: {}, skills: ["strike", "block"] },
      ...overrides,
    };
  }

  function party(overrides = {}) {
    return createTowEncounter({
      seed: "party",
      player: { ...knight(), maxHp: 400 },
      allies: overrides.allies || [ally()],
      enemies: overrides.enemies || [foe({
        maxHp: 900,
        stats: { attack: 6, defense: 0, critRate: 0, dodgeRate: 0 },
        attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 6 }],
      })],
      build: { traits: {}, skills: ["strike", "block"], ...overrides.build },
    });
  }

  it("puts an ally on the field with a build of their own", () => {
    // Never a copy of the protagonist's package: a companion fighting with the player's
    // traits and skills would be a second protagonist wearing someone else's name.
    const state = party({ allies: [ally({ build: { traits: { ironclad: 3 }, skills: ["strike"] } })] });
    expect(state.allyIds).toEqual(["kestrel"]);
    expect(state.actors.kestrel.side).toBe("player");
    expect(state.allyBuilds.kestrel.skills.map((s) => s.id)).toEqual(["strike"]);
    expect(state.build.skills.map((s) => s.id)).toEqual(["strike", "block"]);
    expect(isTowEncounter(state)).toBe(true);
  });

  it("gives each actor their own action budget for the round", () => {
    const state = party();
    expect(state.turn.actionsRemaining).toBe(1);
    expect(state.turn.allies).toEqual({ kestrel: 1 });
    const acted = useSkill(state, "strike", "gatekeeper", "kestrel").state;
    expect(acted.turn.allies.kestrel).toBe(0);
    // Spending the ally's action leaves the player's untouched.
    expect(acted.turn.actionsRemaining).toBe(1);
  });

  it("fires an ally's own traits, not the player's", () => {
    const state = party({ allies: [ally({ build: { traits: { ironclad: 7 }, skills: ["strike"] } })] });
    expect(statusCount(state.actors.kestrel.statuses, "steelskin")).toBe(13);
    expect(statusCount(state.actors["arctic-knight"].statuses, "steelskin")).toBe(0);
  });

  it("scales an ally's skill off the ally", () => {
    const state = party();
    const before = state.actors.gatekeeper.hp;
    const struck = useSkill(state, "strike", "gatekeeper", "kestrel").state;
    // Kestrel's attack is 8; the knight's is 12. The damage has to be Kestrel's.
    expect(before - struck.actors.gatekeeper.hp).toBe(8);
  });

  it("refuses a command for a foe or a stranger", () => {
    const state = party();
    expect(useSkill(state, "strike", null, "gatekeeper"))
      .toMatchObject({ ok: false, reason: "unknown-actor" });
    expect(useSkill(state, "strike", null, "nobody"))
      .toMatchObject({ ok: false, reason: "unknown-actor" });
  });

  it("refuses a skill the ally does not hold, even when the player does", () => {
    const state = party({ allies: [ally({ build: { traits: {}, skills: ["strike"] } })] });
    expect(useSkill(state, "block", null, "kestrel"))
      .toMatchObject({ ok: false, reason: "skill-not-held" });
    expect(useSkill(state, "block", null, "arctic-knight").ok).toBe(true);
  });

  it("stands an ally down as an explicit command rather than hidden AI", () => {
    const state = party();
    const held = skipTurn(state, "kestrel");
    expect(held.ok).toBe(true);
    expect(held.state.turn.allies.kestrel).toBe(0);
    expect(held.state.events.some((e) => e.type === "actor-stood-down" && e.actorId === "kestrel"))
      .toBe(true);
    expect(skipTurn(held.state, "kestrel")).toMatchObject({ ok: false, reason: "turn-already-spent" });
  });

  it("lets foes declare against anyone on the player's side", () => {
    const state = party();
    const declared = declaredIntents(state)[0];
    expect([state.playerId, "kestrel"]).toContain(declared.targetId);
    expect(declared.targetName).toBe(state.actors[declared.targetId].name);
  });

  it("strikes the next one standing when the declared target has already fallen", () => {
    // A declared target is a statement of intent, not a promise the world holds still.
    const state = party({ allies: [ally({ maxHp: 1 })] });
    const forced = {
      ...state,
      actors: { ...state.actors, kestrel: { ...state.actors.kestrel, hp: 0 } },
      intents: { ...state.intents, gatekeeper: { ...state.intents.gatekeeper, targetId: "kestrel" } },
    };
    const after = endTurn(forced).state;
    const landed = after.events.filter((e) => e.type === "enemy-attack").at(-1);
    expect(landed.targetId).toBe("arctic-knight");
  });

  it("keeps fighting when an ally falls, and ends when the player does", () => {
    // An ally going down is a loss, not the end of the story.
    const state = party({ allies: [ally({ maxHp: 1 })] });
    const downed = {
      ...state,
      actors: { ...state.actors, kestrel: { ...state.actors.kestrel, hp: 0 } },
    };
    expect(endTurn(downed).state.phase).toBe("player");

    const dead = {
      ...state,
      actors: { ...state.actors, "arctic-knight": { ...state.actors["arctic-knight"], hp: 0 } },
    };
    expect(endTurn(dead).state.phase).toBe("defeat");
  });

  it("ticks an ally's cooldowns alongside the player's", () => {
    let state = party();
    state = useSkill(state, "block", null, "kestrel").state;
    const spent = state.allyBuilds.kestrel.skills.find((s) => s.id === "block").usesRemaining;
    state = endTurn(state).state;
    // The use is gone and the round moved on; the ally's build tracked both.
    expect(state.allyBuilds.kestrel.skills.find((s) => s.id === "block").usesRemaining).toBe(spent);
    expect(state.turn.allies.kestrel).toBe(1);
  });

  it("leaves a solo fight's randomness exactly where it was", () => {
    // Adding a companion to the game must not rewrite a fight recorded without one, so a
    // single-candidate target costs no draw at all.
    const solo = createTowEncounter({
      seed: "party",
      player: { ...knight(), maxHp: 400 },
      enemies: [foe({ maxHp: 900, stats: { attack: 6, defense: 0, critRate: 0, dodgeRate: 0 }, attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 6 }] })],
      build: { traits: {}, skills: ["strike", "block"] },
    });
    expect(solo.intentRng).toEqual(createTowEncounter({
      seed: "party",
      player: { ...knight(), maxHp: 400 },
      allies: [],
      enemies: [foe({ maxHp: 900, stats: { attack: 6, defense: 0, critRate: 0, dodgeRate: 0 }, attacks: [{ id: "jab", name: "Jab", hits: 1, damage: 6 }] })],
      build: { traits: {}, skills: ["strike", "block"] },
    }).intentRng);
  });

  it("refuses two actors sharing an id", () => {
    expect(() => party({ allies: [ally({ id: "gatekeeper" })] })).toThrow("duplicate-actor-id");
  });
});
