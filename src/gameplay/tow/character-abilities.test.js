import { describe, expect, it } from "vitest";
import { applyStatus, createStatusStack, statusCount } from "../kernel/status-stack.js";
import {
  characterAbilitiesFor,
  characterAbilityIds,
  getCharacterAbility,
} from "./character-abilities.js";
import {
  createTowEncounter,
  endTurn,
  SUPPORTED_SKILL_EFFECT_TYPES,
  useSkill,
} from "./encounter.js";
import { resolveAttack } from "../kernel/tow-damage.js";
import { STARTING_ARCHETYPES } from "./starting-archetypes.js";

function encounterFor(skillId, {
  playerHp = 100,
  playerMaxHp = 200,
  enemyHp = 300,
  enemyMaxHp = 400,
  enemyShield = 0,
  playerStatuses = createStatusStack(),
  enemyStatuses = createStatusStack(),
} = {}) {
  const created = createTowEncounter({
    seed: `character-ability:${skillId}`,
    player: {
      id: "wanderer",
      name: "Tester",
      hp: playerHp,
      maxHp: playerMaxHp,
      stats: { attack: 20, defense: 20, critRate: 0, dodgeRate: 0 },
    },
    enemies: [{
      id: "foe",
      name: "Target",
      hp: enemyHp,
      maxHp: enemyMaxHp,
      shield: enemyShield,
      stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 },
      attacks: [{ id: "wait", name: "Wait", hits: 1, damage: 0 }],
    }],
    build: { traits: {}, skills: [skillId], runes: [] },
  });
  return {
    ...created,
    actors: {
      ...created.actors,
      wanderer: { ...created.actors.wanderer, hp: playerHp, statuses: playerStatuses },
      foe: { ...created.actors.foe, hp: enemyHp, shield: enemyShield, statuses: enemyStatuses },
    },
  };
}

describe("source roster ability catalogue", () => {
  it("contains every 23-action character catalogue while equipping only five", () => {
    expect(characterAbilityIds()).toHaveLength(276);
    for (const archetype of STARTING_ARCHETYPES) {
      const catalogue = characterAbilitiesFor(archetype.id);
      const equipped = archetype.build.skills.map((id) => getCharacterAbility(id));
      expect(catalogue).toHaveLength(23);
      expect(catalogue.filter((definition) => definition.abilityType === "basic-attack")).toHaveLength(3);
      expect(catalogue.filter((definition) => definition.abilityType === "defensive")).toHaveLength(3);
      expect(catalogue.filter((definition) => definition.abilityType === "archetype")).toHaveLength(17);
      expect(equipped).toHaveLength(5);
      expect(new Set(equipped.map((definition) => definition.abilityType)))
        .toEqual(new Set(["basic-attack", "defensive", "archetype"]));
      expect(equipped.filter((definition) => definition.abilityType === "basic-attack")).toHaveLength(1);
      expect(equipped.filter((definition) => definition.abilityType === "defensive")).toHaveLength(1);
      expect(equipped.filter((definition) => definition.abilityType === "archetype")).toHaveLength(3);
      for (const definition of catalogue) {
        expect(definition.exclusiveTo).toBe(archetype.id);
        expect(definition.source.page).toMatch(/^https:\/\/(?:namu\.wiki|apps\.apple\.com)\//);
        expect(definition.source.sourceName).toBeTruthy();
      }
    }
  });

  it("only advertises effect primitives the production encounter resolves", () => {
    const supported = new Set(SUPPORTED_SKILL_EFFECT_TYPES);
    const effects = characterAbilityIds().flatMap((id) => getCharacterAbility(id).effects);
    expect(effects.every((effect) => supported.has(effect.type))).toBe(true);
  });

  it("resolves the Assassin's sourced Execution strike and consumes enemy wounds", () => {
    let enemyStatuses = createStatusStack();
    enemyStatuses = applyStatus(enemyStatuses, "burn", 10);
    enemyStatuses = applyStatus(enemyStatuses, "poison", 20);
    enemyStatuses = applyStatus(enemyStatuses, "bleed", 5);
    const state = encounterFor("assassin-execution", { enemyHp: 200, enemyStatuses });
    const result = useSkill(state, "assassin-execution", "foe");
    expect(result.ok).toBe(true);
    expect(result.state.actors.foe.hp).toBe(152);
    expect(statusCount(result.state.actors.foe.statuses, "burn")).toBe(0);
    expect(statusCount(result.state.actors.foe.statuses, "poison")).toBe(0);
    expect(statusCount(result.state.actors.foe.statuses, "bleed")).toBe(0);
  });

  it("keeps all three Last Assassin basic forms mechanically distinct", () => {
    const flurry = useSkill(encounterFor("assassin-flurry"), "assassin-flurry", "foe");
    const mutilate = useSkill(encounterFor("assassin-mutilate"), "assassin-mutilate", "foe");
    const hamstring = useSkill(encounterFor("assassin-hamstring-cut"), "assassin-hamstring-cut", "foe");
    expect(flurry.state.events.find((event) => event.type === "skill-damage")?.hits).toHaveLength(2);
    expect(mutilate.state.events.find((event) => event.type === "skill-damage")?.hits).toHaveLength(3);
    expect(hamstring.state.events.find((event) => event.type === "skill-damage")?.hits).toHaveLength(1);
    expect(statusCount(hamstring.state.actors.foe.statuses, "weak")).toBe(2);
  });

  it("resolves authored multi-hit actions as their full hit count", () => {
    const result = useSkill(encounterFor("demon-arrow-rain"), "demon-arrow-rain", "foe");
    expect(result.ok).toBe(true);
    const damageEvent = result.state.events.find((event) => (
      event.type === "skill-damage" && event.skillId === "demon-arrow-rain"
    ));
    expect(damageEvent.hits).toHaveLength(4);
  });

  it("keeps the Witch's sourced All-Out Attack as five hits without invented Doom", () => {
    const definition = getCharacterAbility("witch-all-out-attack");
    expect(definition).toMatchObject({
      rarity: "legendary",
      usesPerAct: 2,
      cooldown: 9,
      note: null,
      source: { sourceName: "총공격", fidelity: "direct" },
    });
    expect(definition.effects).toEqual([{
      type: "damage",
      target: "enemy",
      scale: "attack",
      percentByRank: [40],
      hits: 5,
    }]);

    const result = useSkill(encounterFor(definition.id), definition.id, "foe");
    expect(result.ok).toBe(true);
    const damageEvent = result.state.events.find((event) => (
      event.type === "skill-damage" && event.skillId === definition.id
    ));
    expect(damageEvent.hits).toHaveLength(5);
    expect(statusCount(result.state.actors.foe.statuses, "doom")).toBe(0);
  });

  it("transcribes the captured Witch coefficients, uses, cooldowns, and targets", () => {
    expect(getCharacterAbility("witch-vampiric-touch")).toMatchObject({
      rarity: "uncommon",
      effects: [
        { type: "damage", scale: "attack", percentByRank: [80, 90, 100, 110, 120] },
        { type: "heal", scale: "defense", percentByRank: [30, 40, 50, 60, 70] },
      ],
    });
    expect(getCharacterAbility("witch-bone-shield")).toMatchObject({
      rarity: "common",
      usesPerAct: 15,
      effects: [{ type: "status", status: "bone-shield", countByRank: [1] }],
    });
    expect(getCharacterAbility("witch-skeleton-summon")).toMatchObject({
      rarity: "uncommon",
      usesPerAct: 5,
      consumesTurn: true,
      effects: [{ status: "skeleton", countByRank: [12, 15, 18, 21, 24] }],
    });
    expect(getCharacterAbility("witch-reapers-scythe")).toMatchObject({
      rarity: "rare",
      usesPerActByRank: [6, 8, 10, 12],
      cooldown: 6,
      effects: [{ type: "damage-enemy-max-hp", percentByRank: [13, 13, 13, 13] }],
    });
    expect(getCharacterAbility("witch-bone-sphere")).toMatchObject({
      rarity: "mythical",
      usesPerAct: 2,
      effects: [{ type: "damage", scale: "attack", percentByRank: [555] }],
    });
    expect(getCharacterAbility("witch-limited-life-sentence")).toMatchObject({
      rarity: "mythical",
      usesPerAct: 2,
      cooldown: 15,
      effects: [{ type: "delayed-damage", countByRank: [666, 999], turns: 13 }],
    });
  });

  it("uses the Witch's sourced Bone Shield and Mirror Image lifecycles", () => {
    const shielded = useSkill(encounterFor("witch-bone-shield"), "witch-bone-shield", "foe");
    const contact = resolveAttack({
      attacker: shielded.state.actors.foe,
      defender: shielded.state.actors.wanderer,
      attack: { hits: 1, damage: 100 },
      rng: shielded.state.rng,
    });
    expect(contact.hits[0]).toMatchObject({ damage: 40, mitigation: { boneShield: true } });
    expect(statusCount(contact.defender.statuses, "bone-shield")).toBe(0);

    const mirrored = useSkill(encounterFor("witch-mirror-image"), "witch-mirror-image", "foe");
    const defender = {
      ...mirrored.state.actors.wanderer,
      stats: { ...mirrored.state.actors.wanderer.stats, dodgeRate: 67 },
    };
    const avoided = resolveAttack({
      attacker: mirrored.state.actors.foe,
      defender,
      attack: { hits: 1, damage: 100 },
      rng: mirrored.state.rng,
    });
    expect(avoided.hits[0]).toMatchObject({
      dodged: true,
      avoidance: { chance: 100, mirrorImage: true },
    });
  });

  it("resolves sourced Witch sustain, control, summon, and dispel effects", () => {
    const vampiric = useSkill(
      encounterFor("witch-vampiric-touch", { playerHp: 100 }),
      "witch-vampiric-touch",
      "foe",
    );
    expect(vampiric.state.actors.foe.hp).toBe(284);
    expect(vampiric.state.actors.wanderer.hp).toBe(106);

    const ram = useSkill(encounterFor("witch-battering-ram"), "witch-battering-ram", "foe");
    expect(ram.state.actors.foe.hp).toBe(250);
    expect(statusCount(ram.state.actors.foe.statuses, "stun")).toBe(1);

    let dispelled = createStatusStack();
    for (const type of [
      "invincible", "charge", "overload", "thorn", "bone-shield", "poison-atk",
    ]) dispelled = applyStatus(dispelled, type, 1);
    dispelled = applyStatus(dispelled, "protection", 2);
    dispelled = applyStatus(dispelled, "paralyze", 1);
    const nullified = useSkill(
      encounterFor("witch-nullification", { enemyShield: 30, enemyStatuses: dispelled }),
      "witch-nullification",
      "foe",
    );
    expect(nullified.state.actors.foe.shield).toBe(0);
    expect(nullified.state.actors.foe.statuses).toEqual([
      { type: "protection", count: 2 },
      { type: "paralyze", count: 1 },
    ]);
    expect(nullified.state.turn.actionsRemaining).toBe(1);
  });

  it("multiplies the Witch's own Skeleton host and preserves summon damage per turn", () => {
    const skeletons = applyStatus(createStatusStack(), "skeleton", 10);
    const multiplied = useSkill(
      encounterFor("witch-proliferation", { playerStatuses: skeletons }),
      "witch-proliferation",
      "foe",
    );
    expect(statusCount(multiplied.state.actors.wanderer.statuses, "skeleton")).toBe(15);
    expect(multiplied.state.turn.actionsRemaining).toBe(1);

    const summoned = useSkill(encounterFor("witch-void-monster"), "witch-void-monster", "foe");
    const advanced = endTurn(summoned.state);
    expect(advanced.ok).toBe(true);
    expect(advanced.state.actors.foe.hp).toBe(288);
    expect(statusCount(advanced.state.actors.foe.statuses, "void-monster")).toBe(12);
    expect(advanced.state.events.findLast((event) => event.type === "tick-damage"))
      .toMatchObject({ actorId: "foe", voidMonster: 12 });
  });

  it("keeps Limited-Life Sentence and Forbidden Ritual as real countdowns", () => {
    let sentence = useSkill(
      encounterFor("witch-limited-life-sentence", { enemyHp: 1_000, enemyMaxHp: 1_000 }),
      "witch-limited-life-sentence",
      "foe",
    ).state;
    for (let turn = 1; turn < 13; turn += 1) {
      sentence = endTurn(sentence).state;
      expect(sentence.actors.foe.hp).toBe(1_000);
    }
    sentence = endTurn(sentence).state;
    expect(sentence.actors.foe.hp).toBe(334);
    expect(statusCount(sentence.actors.foe.statuses, "limited-life-sentence")).toBe(0);

    let ritual = useSkill(encounterFor("witch-forbidden-ritual"), "witch-forbidden-ritual", "foe").state;
    expect(ritual.actors.wanderer).toMatchObject({ hp: 100, maxHp: 533 });
    for (let turn = 1; turn < 4; turn += 1) {
      ritual = endTurn(ritual).state;
      expect(ritual.phase).toBe("player");
    }
    ritual = endTurn(ritual).state;
    expect(ritual.phase).toBe("defeat");
    expect(ritual.actors.wanderer.hp).toBe(0);
  });

  it("keeps source fidelity out of player-facing ability notes", () => {
    expect(characterAbilityIds().every((id) => getCharacterAbility(id).note == null)).toBe(true);
  });

  it("resolves dual-stat healing for Blood Thirst", () => {
    const state = encounterFor("vampire-blood-thirst", { playerHp: 40 });
    const result = useSkill(state, "vampire-blood-thirst", "foe");
    expect(result.ok).toBe(true);
    expect(result.state.actors.wanderer.hp).toBe(76);
  });

  it("amplifies the Priestess's three lingering wounds", () => {
    let statuses = createStatusStack();
    statuses = applyStatus(statuses, "burn", 10);
    statuses = applyStatus(statuses, "poison", 20);
    statuses = applyStatus(statuses, "bleed", 5);
    const state = encounterFor("priestess-doom", { enemyStatuses: statuses });
    const result = useSkill(state, "priestess-doom", "foe");
    expect(result.ok).toBe(true);
    expect(statusCount(result.state.actors.foe.statuses, "burn")).toBe(16);
    expect(statusCount(result.state.actors.foe.statuses, "poison")).toBe(32);
    expect(statusCount(result.state.actors.foe.statuses, "bleed")).toBe(8);
  });
});
