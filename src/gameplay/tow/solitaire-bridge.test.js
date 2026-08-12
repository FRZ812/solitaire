import { describe, expect, it } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { generateEnemyGroup } from "../../data/bestiary.js";
import { isTowActor } from "../kernel/tow-actor.js";
import { createTowEncounter, endTurn, useSkill } from "./encounter.js";
import {
  PROVISIONAL_BRIDGE_POLICY,
  towEncounterSupport,
  towEnemyFromBestiary,
  towPlayerFromCharacter,
} from "./solitaire-bridge.js";

function world() {
  const state = makeInitialState();
  return { character: state.character, codex: state.world.codex };
}

describe("characters cross the bridge", () => {
  it("produces a valid Tower of Winter actor from a real starting character", () => {
    const { character, codex } = world();
    const actor = towPlayerFromCharacter(character, codex);
    expect(isTowActor(actor)).toBe(true);
    expect(actor.name).toBe(character.name || "Wanderer");
    expect(actor.hp).toBeGreaterThan(0);
    expect(actor.hp).toBeLessThanOrEqual(actor.maxHp);
  });

  it("keeps every rate inside the kernel's range", () => {
    const { character, codex } = world();
    const actor = towPlayerFromCharacter(character, codex);
    for (const rate of [actor.stats.critRate, actor.stats.dodgeRate]) {
      expect(Number.isSafeInteger(rate)).toBe(true);
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(100);
    }
  });

  it("takes attack from the middle of the weapon band", () => {
    const { codex } = world();
    const character = { ...world().character, name: "Test", vitality: 20, vitalityMax: 20 };
    const actor = towPlayerFromCharacter(character, codex);
    expect(PROVISIONAL_BRIDGE_POLICY.attackFromWeapon).toBe("midpoint");
    expect(actor.stats.attack).toBeGreaterThan(0);
  });

  it("does not arrive already wounded because gear raised the pool", () => {
    const { character, codex } = world();
    const full = { ...character, vitality: character.vitalityMax };
    const actor = towPlayerFromCharacter(full, codex);
    expect(actor.hp).toBe(actor.maxHp);
  });

  it("carries a wound across rather than healing it", () => {
    const { character, codex } = world();
    const hurt = { ...character, vitality: Math.max(1, character.vitalityMax - 5) };
    const actor = towPlayerFromCharacter(hurt, codex);
    expect(actor.hp).toBeLessThan(actor.maxHp);
  });

  it("accepts a custom actor id", () => {
    const { character, codex } = world();
    expect(towPlayerFromCharacter(character, codex, { id: "wanderer" }).id).toBe("wanderer");
  });
});

describe("bestiary enemies cross the bridge", () => {
  const bandit = {
    npcId: "road-bandit",
    name: "Road bandit",
    health: 18,
    maxHealth: 24,
    weapon: { min: 3, max: 7 },
    armor: 2,
    ward: 1,
    dodge: 5,
  };

  it("produces a valid actor that keeps its current wound", () => {
    const actor = towEnemyFromBestiary(bandit);
    const { attacks, ...actorOnly } = actor;
    expect(isTowActor(actorOnly)).toBe(true);
    expect(actor.id).toBe("road-bandit");
    expect(actor.hp).toBe(18);
    expect(actor.maxHp).toBe(24);
    expect(actor.stats).toEqual({ attack: 5, defense: 3, critRate: 0, dodgeRate: 5 });
  });

  it("turns a damage band into a move set, including a multi-hit flurry", () => {
    // Multi-hit has to reach live fights, because Steelskin, Thorn and Burn all behave
    // differently against three small hits than against one heavy blow.
    expect(towEnemyFromBestiary(bandit).attacks).toEqual([
      { id: "road-bandit-jab", name: "Jab", hits: 1, damage: 3 },
      { id: "road-bandit-swing", name: "Swing", hits: 1, damage: 5 },
      { id: "road-bandit-heavy", name: "Heavy blow", hits: 1, damage: 7 },
      { id: "road-bandit-flurry", name: "Flurry", hits: 2, damage: 2 },
    ]);
  });

  it("omits a flurry when the band is too narrow for one to threaten", () => {
    const narrow = towEnemyFromBestiary({ ...bandit, weapon: { min: 4, max: 5 } });
    expect(narrow.attacks.map((attack) => attack.hits)).toEqual([1, 1, 1]);
  });

  it("collapses a fixed-damage weapon to one attack", () => {
    const fixed = towEnemyFromBestiary({ ...bandit, weapon: { min: 5, max: 5 } });
    expect(fixed.attacks).toHaveLength(1);
    expect(fixed.attacks[0].damage).toBe(5);
  });

  it("rejects an enemy with no usable identity", () => {
    expect(() => towEnemyFromBestiary(null)).toThrow(/invalid-enemy/);
    expect(() => towEnemyFromBestiary({ name: "Nameless" })).toThrow(/invalid-enemy-id/);
  });

  it("converts a real generated group", () => {
    const group = generateEnemyGroup("bandits", { power: 3, maxTier: "common" });
    expect(group.length).toBeGreaterThan(0);
    group.forEach((enemy, index) => {
      const { attacks, ...actorOnly } = towEnemyFromBestiary(enemy, { id: `foe-${index}` });
      expect(isTowActor(actorOnly)).toBe(true);
      expect(attacks.length).toBeGreaterThan(0);
    });
  });
});

describe("admission", () => {
  it("accepts a plain fight", () => {
    expect(towEncounterSupport({ character: {}, party: [], enemies: [{ name: "Foe" }] }))
      .toEqual({ ok: true, reason: null });
  });

  it("refuses what the kernel cannot express, rather than dropping it", () => {
    const enemies = [{ name: "Foe" }];
    expect(towEncounterSupport({ character: {}, party: [], enemies: [] }))
      .toMatchObject({ ok: false, reason: "no-enemies" });
    expect(towEncounterSupport({ character: {}, party: [], enemies: [{ abilities: ["roar"] }] }))
      .toMatchObject({ ok: false, reason: "unsupported-enemy-mechanics" });
    // A condition nobody has decided about is the fail-closed case that stops a newly
    // authored debuff from silently doing nothing.
    expect(towEncounterSupport({
      character: { conditions: [{ name: "Unclassified Affliction" }] },
      party: [],
      enemies,
    })).toMatchObject({ ok: false, reason: "unsupported-condition" });
  });

  it("carries what it can adapt instead of refusing the whole fight", () => {
    // Abilities, racial passives and companions no longer block. The package is the combat
    // identity, and admission records each of them by name rather than dropping them in
    // silence; conditions arrive as opening statuses. Delegating to admission is what keeps
    // this file and that one from ever disagreeing about which is which.
    expect(towEncounterSupport({
      character: {
        abilities: ["cleave"],
        conditions: [{ name: "Bleeding" }],
        racialPassives: ["darkvision"],
      },
      party: ["ally"],
      enemies: [{ name: "Foe" }],
    })).toEqual({ ok: true, reason: null });
  });

  it("admits a multi-enemy group, which the old adapter could not", () => {
    expect(towEncounterSupport({
      character: {},
      party: [],
      enemies: [{ name: "One" }, { name: "Two" }, { name: "Three" }],
    })).toEqual({ ok: true, reason: null });
  });
});

describe("a real Solitaire fight runs on the kernel end to end", () => {
  it("fights a generated bandit group to a terminal outcome", () => {
    const { character, codex } = world();
    // A plain fighter, so this test measures the bridge rather than the adapters: abilities
    // and racial passives are superseded by the package, and conditions arrive as opening
    // statuses, all of which admission covers on its own.
    const plain = { ...character, abilities: [], conditions: [], racialPassives: [] };
    const group = generateEnemyGroup("bandits", { power: 2, maxTier: "common" });

    // Real bestiary foes carry abilities the kernel has no port for yet. Admission must
    // refuse them outright — a fight that silently dropped them would be a quieter,
    // easier fight than the one the world described.
    if (group.some((enemy) => enemy.abilities?.length)) {
      expect(towEncounterSupport({ character: plain, party: [], enemies: group }))
        .toMatchObject({ ok: false, reason: "unsupported-enemy-mechanics" });
    }

    const portable = group.map((enemy) => ({ ...enemy, abilities: [], statuses: [], procs: [] }));
    expect(towEncounterSupport({ character: plain, party: [], enemies: portable }).ok).toBe(true);

    let state = createTowEncounter({
      seed: "solitaire-bridge-fight",
      player: towPlayerFromCharacter(plain, codex, { id: "wanderer" }),
      enemies: portable.map((enemy, index) => towEnemyFromBestiary(enemy, { id: `foe-${index}` })),
      build: { traits: { ironclad: 4 }, skills: ["strike", "block"] },
    });

    for (let turn = 0; turn < 200 && state.phase === "player"; turn += 1) {
      const used = useSkill(state, turn % 3 === 0 ? "block" : "strike");
      state = used.ok ? used.state : state;
      if (state.phase !== "player") break;
      state = endTurn(state).state;
    }

    expect(["victory", "defeat"]).toContain(state.phase);
    expect(state.events.length).toBeGreaterThan(0);
    expect(state.events.some((entry) => entry.type === "enemy-attack")).toBe(true);
  });
});
