import { describe, expect, it } from "vitest";
import { makeInitialState } from "../../data/initial-state.js";
import { generateEnemyGroup } from "../../data/bestiary.js";
import { deriveCombatStats } from "../../engine/combat-stats.js";
import { BASE_RESOLVE_REGEN } from "../../engine/attributes.js";
import { isTowActor } from "../kernel/tow-actor.js";
import { createTowEncounter, endTurn, useSkill } from "./encounter.js";
import { getStartingArchetype } from "./starting-archetypes.js";
import {
  PROVISIONAL_BRIDGE_POLICY,
  towArchetypeForEnemy,
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
    const stats = deriveCombatStats(character, codex);
    expect(actor.resolveRegen)
      .toBe(BASE_RESOLVE_REGEN + (stats.triggers?.resolveRegen || 0));
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

  it("takes attack from the weapon band plus the frame behind it", () => {
    // A Tower of Winter skill scales off ATK alone, so ATK has to carry the whole of an
    // actor's offence. The weapon band on its own left a starting character swinging for
    // four against foes holding seventy health between them.
    const { codex } = world();
    const character = { ...world().character, name: "Test", vitality: 20, vitalityMax: 20 };
    const actor = towPlayerFromCharacter(character, codex);
    expect(PROVISIONAL_BRIDGE_POLICY.attackFromWeapon).toBe("midpoint-plus-frame");
    const stats = deriveCombatStats(character, codex);
    const midpoint = Math.round((stats.weapon.min + stats.weapon.max) / 2);
    expect(actor.stats.attack).toBeGreaterThan(midpoint);
  });

  it("never leaves the defensive half of a package worth nothing", () => {
    // Block turns DEF into shield, so a character whose DEF is zero has an inert defensive
    // kit. Solitaire's armour is legitimately zero for someone in cloth; Tower of Winter's
    // DEF is a stat every actor carries.
    const { character, codex } = world();
    const unarmoured = towPlayerFromCharacter(character, codex);
    expect(PROVISIONAL_BRIDGE_POLICY.defenseFloorFromAttack).toBe(true);
    expect(unarmoured.stats.defense).toBeGreaterThan(0);
    expect(unarmoured.stats.defense).toBeGreaterThanOrEqual(unarmoured.stats.attack);
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

  it("preserves the selected source roster chassis in campaign fights", () => {
    const { character, codex } = world();
    const sourceCharacter = {
      ...character,
      name: "Arctic Knight",
      progressionModel: "tow-archetype",
      towBaseStats: { maxHp: 170, attack: 12, defense: 13, critRate: 9, dodgeRate: 4 },
      vitality: character.vitalityMax,
    };
    const actor = towPlayerFromCharacter(sourceCharacter, codex);
    expect(actor.hp).toBe(actor.maxHp);
    expect(actor.maxHp).toBe(170);
    expect(actor.stats).toEqual({ attack: 12, defense: 13, critRate: 9, dodgeRate: 4 });
  });

  it("preserves an archetype's explicitly authored Resolve regeneration", () => {
    const { character, codex } = world();
    const vampire = getStartingArchetype("vampire");
    const sourceCharacter = {
      ...character,
      name: vampire.name,
      attributes: vampire.attributes,
      progressionModel: "tow-archetype",
      towBaseStats: vampire.baseStats,
      vitality: character.vitalityMax,
    };

    const actor = towPlayerFromCharacter(sourceCharacter, codex);

    expect(actor.resolveRegen).toBe(2);
  });

  it("applies the permanent profile keepsake without requiring an equipment slot", () => {
    const { character, codex } = world();
    const sourceCharacter = {
      ...character,
      name: "Arctic Knight",
      progressionModel: "tow-archetype",
      towBaseStats: { maxHp: 170, attack: 12, defense: 13, critRate: 9, dodgeRate: 4 },
      profile: { keepsakeId: "red-wolf-token" },
      vitality: character.vitalityMax,
    };
    const actor = towPlayerFromCharacter(sourceCharacter, codex);
    expect(actor.maxHp).toBe(170);
    expect(actor.stats).toEqual({ attack: 15, defense: 13, critRate: 12, dodgeRate: 4 });
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
    const { archetypeId, build, ...actorOnly } = actor;
    expect(isTowActor(actorOnly)).toBe(true);
    expect(actor.id).toBe("road-bandit");
    expect(actor.hp).toBe(18);
    expect(actor.maxHp).toBe(24);
    expect(actor.stats).toEqual({ attack: 5, defense: 3, critRate: 0, dodgeRate: 5 });
    expect(archetypeId).toBe("knight");
    expect(build).toEqual(getStartingArchetype(archetypeId).build);
  });

  it("equips the same complete archetype kit a playable character uses", () => {
    const enemy = towEnemyFromBestiary({ ...bandit, profession: "rogue" });
    const archetype = getStartingArchetype("last-assassin");
    expect(towArchetypeForEnemy({ profession: "rogue" })).toBe(archetype);
    expect(enemy.archetypeId).toBe(archetype.id);
    expect(enemy.build).toEqual(archetype.build);
    expect(enemy.build.skills).toEqual([
      "assassin-flurry",
      "assassin-deflect",
      "assassin-flash-bomb",
      "assassin-execution",
      "assassin-storm-of-knives",
    ]);
    expect(enemy).not.toHaveProperty("attacks");
  });

  it("lets the world weapon set power without rewriting combat identity", () => {
    const light = towEnemyFromBestiary({ ...bandit, weapon: { min: 1, max: 3 } });
    const heavy = towEnemyFromBestiary({ ...bandit, weapon: { min: 8, max: 8 } });
    expect(light.stats.attack).toBe(2);
    expect(heavy.stats.attack).toBe(8);
    expect(light.archetypeId).toBe(heavy.archetypeId);
    expect(light.build).toEqual(heavy.build);
  });

  it("unlocks the same five-slot kit by world threat tier", () => {
    const archetype = getStartingArchetype("arctic-knight");
    expect(towEnemyFromBestiary({ ...bandit, tier: "common" }).build.skills)
      .toEqual(archetype.build.skills.slice(0, 2));
    expect(towEnemyFromBestiary({ ...bandit, tier: "uncommon" }).build.skills)
      .toEqual(archetype.build.skills.slice(0, 3));
    expect(towEnemyFromBestiary({ ...bandit, tier: "rare" }).build.skills)
      .toEqual(archetype.build.skills);
  });

  it("rejects an enemy with no usable identity", () => {
    expect(() => towEnemyFromBestiary(null)).toThrow(/invalid-enemy/);
    expect(() => towEnemyFromBestiary({ name: "Nameless" })).toThrow(/invalid-enemy-id/);
  });

  it("converts a real generated group", () => {
    const group = generateEnemyGroup("bandits", { power: 3, maxTier: "common" });
    expect(group.length).toBeGreaterThan(0);
    group.forEach((enemy, index) => {
      const { archetypeId, build, ...actorOnly } = towEnemyFromBestiary(enemy, { id: `foe-${index}` });
      expect(isTowActor(actorOnly)).toBe(true);
      expect(getStartingArchetype(archetypeId)).toBeTruthy();
      expect(build.skills.length).toBeGreaterThanOrEqual(2);
      expect(build.skills).toEqual(getStartingArchetype(archetypeId).build.skills.slice(0, build.skills.length));
      expect(build.traits).toEqual(getStartingArchetype(archetypeId).build.traits);
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
    // Bestiary ability labels select a shared archetype; they are no longer a second,
    // partially-supported enemy-only action system.
    expect(towEncounterSupport({ character: {}, party: [], enemies: [{ abilities: ["roar"] }] }))
      .toEqual({ ok: true, reason: null });
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

    expect(towEncounterSupport({ character: plain, party: [], enemies: group }).ok).toBe(true);

    let state = createTowEncounter({
      seed: "solitaire-bridge-fight",
      player: towPlayerFromCharacter(plain, codex, { id: "wanderer" }),
      enemies: group.map((enemy, index) => towEnemyFromBestiary(enemy, { id: `foe-${index}` })),
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
    expect(state.events.some((entry) => (
      entry.actorId?.startsWith("foe-") && entry.type.startsWith("skill-")
    ))).toBe(true);
    expect(state.events.some((entry) => entry.type === "enemy-attack")).toBe(false);
  });
});
