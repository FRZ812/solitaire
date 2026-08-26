import { describe, expect, it } from "vitest";
import { applyStatus, createStatusStack, statusCount } from "../kernel/status-stack.js";
import {
  CHARACTER_ABILITIES,
  characterAbilitiesFor,
  characterAbilityIds,
  getCharacterAbility,
} from "./character-abilities.js";
import {
  TOW_CHARACTER_ABILITY_SOURCE_ROWS,
  TOW_CHARACTER_SOURCE_ROWS,
  TOW_SOURCE_BUILD,
} from "./character-ability-source-data.js";
import {
  createTowEncounter,
  endTurn,
  SUPPORTED_SKILL_EFFECT_TYPES,
  useSkill,
} from "./encounter.js";
import { resolveAttack } from "../kernel/tow-damage.js";
import { createSkillState } from "./skills.js";
import { STARTING_ARCHETYPES } from "./starting-archetypes.js";

const SOURCE_STARTING_TRAIT_IDS = Object.freeze({
  Assassin: "assassin",
  Bloodsuck: "bloodsuck",
  Charge: "charge",
  Gale: "gale",
  Ignition: "ignition",
  Innovation: "innovation",
  Ironclad: "ironclad",
  Justice: "judgment",
  Necromancy: "necromancy",
  Overheat: "overheat",
  Quickness: "quickness",
  Valiancy: "valiancy",
});

function encounterFor(skillId, {
  rank = 1,
  playerHp = 100,
  playerMaxHp = 200,
  enemyHp = 300,
  enemyMaxHp = 400,
  enemyShield = 0,
  playerStatuses = createStatusStack(),
  enemyStatuses = createStatusStack(),
  extraSkills = [],
} = {}) {
  const skillStates = [createSkillState(skillId, rank), ...extraSkills.map((id) => createSkillState(id))];
  const created = createTowEncounter({
    seed: `character-ability:${skillId}:${rank}`,
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
    build: { traits: {}, skills: skillStates, runes: [] },
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

function withStatus(type, count, stack = createStatusStack()) {
  return applyStatus(stack, type, count);
}

function prerequisiteStatusesFor(ability) {
  const ids = new Set();
  for (const effect of ability.effects) {
    if (effect.factorStatus) ids.add(effect.factorStatus);
    for (const status of effect.statuses || []) ids.add(status);
    if (["modify-status", "reduce-statuses"].includes(effect.type) && effect.status) {
      ids.add(effect.status);
    }
  }
  return [...ids].reduce(
    (statuses, type) => applyStatus(statuses, type, 10),
    createStatusStack(),
  );
}

describe("source-calibrated archetype ability catalogue", () => {
  it("maps all 276 shipped records one-to-one across the 12 reusable archetype kits", () => {
    expect(TOW_CHARACTER_ABILITY_SOURCE_ROWS).toHaveLength(276);
    expect(characterAbilityIds()).toHaveLength(276);
    expect(new Set(Object.values(CHARACTER_ABILITIES).map((ability) => ability.source.sourceId)).size)
      .toBe(276);

    for (const archetype of STARTING_ARCHETYPES) {
      const catalogue = characterAbilitiesFor(archetype.id);
      const equipped = archetype.build.skills.map((id) => getCharacterAbility(id));
      expect(catalogue).toHaveLength(23);
      expect(catalogue.filter((ability) => ability.abilityType === "basic-attack")).toHaveLength(3);
      expect(catalogue.filter((ability) => ability.abilityType === "defensive")).toHaveLength(3);
      expect(catalogue.filter((ability) => ability.abilityType === "archetype")).toHaveLength(17);
      expect(equipped).toHaveLength(5);
      expect(equipped.filter((ability) => ability.abilityType === "basic-attack")).toHaveLength(1);
      expect(equipped.filter((ability) => ability.abilityType === "defensive")).toHaveLength(1);
      expect(equipped.filter((ability) => ability.abilityType === "archetype")).toHaveLength(3);
    }
  });

  it("classifies every source translation and removes remake notes", () => {
    const adapted = [];
    for (const ability of Object.values(CHARACTER_ABILITIES)) {
      const expectedFidelity = ability.id === "automaton-interception" ? "adapted" : "direct";
      expect(ability.source).toMatchObject({ build: TOW_SOURCE_BUILD, fidelity: expectedFidelity });
      if (ability.source.fidelity === "adapted") adapted.push(ability.id);
      expect(ability.source.sourceName).toBeTruthy();
      expect(ability.source.sourceId).toBeGreaterThanOrEqual(1030101);
      expect(ability.note).toBeNull();
      expect(ability.description.length).toBeGreaterThan(10);
      expect(ability.description).not.toMatch(/source-guided|remake|normalized/i);
    }
    expect(adapted).toEqual(["automaton-interception"]);
  });

  it("labels Interception's skipped inert source row as an adaptation", () => {
    expect(getCharacterAbility("automaton-interception").source).toMatchObject({
      sourceId: 1031206,
      fidelity: "adapted",
      detail: expect.stringContaining("zero-value source row"),
    });
  });

  it("uses the shipped rules chassis for every playable archetype", () => {
    const expected = new Map(TOW_CHARACTER_SOURCE_ROWS.map(([
      , id, , , , maxHp, attack, defense, critRate, dodgeRate,
    ]) => [id, { maxHp, attack, defense, critRate, dodgeRate }]));
    for (const archetype of STARTING_ARCHETYPES) {
      expect(archetype.baseStats).toMatchObject(expected.get(archetype.legacyId));
      expect(archetype.baseStats.resolveMax).toBeGreaterThan(0);
    }
  });

  it("uses every archetype's shipped rank-3 starting trait", () => {
    const expected = new Map(TOW_CHARACTER_SOURCE_ROWS.map(([
      , id, , , , , , , , , startingTrait,
    ]) => {
      const sourceName = startingTrait.match(/^Starting Trait: (.+) Lv\. 3$/)?.[1];
      return [id, { [SOURCE_STARTING_TRAIT_IDS[sourceName]]: 3 }];
    }));
    for (const archetype of STARTING_ARCHETYPES) {
      expect(archetype.build.traits).toEqual(expected.get(archetype.legacyId));
    }
  });

  it("only advertises effect primitives implemented by the production resolver", () => {
    const supported = new Set(SUPPORTED_SKILL_EFFECT_TYPES);
    const effects = characterAbilityIds().flatMap((id) => getCharacterAbility(id).effects);
    expect(effects.every((effect) => supported.has(effect.type))).toBe(true);
  });

  it("executes every source ability at its first and final rank without an inert branch", () => {
    const failures = [];
    for (const ability of Object.values(CHARACTER_ABILITIES)) {
      for (const rank of new Set([1, ability.rankCount])) {
        try {
          const statuses = prerequisiteStatusesFor(ability);
          let state = encounterFor(ability.id, {
            rank,
            playerStatuses: statuses,
            enemyStatuses: statuses,
          });
          if (ability.id === "automaton-infinite-power") {
            state = {
              ...state,
              actors: {
                ...state.actors,
                wanderer: { ...state.actors.wanderer, resolve: 5, resolveMax: 8 },
              },
            };
          }
          const result = useSkill(state, ability.id, "foe");
          if (!result.ok) failures.push(`${ability.id}@${rank}:${result.reason}`);
        } catch (error) {
          failures.push(`${ability.id}@${rank}:${error.message}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it.each([
    ["arctic-retaliation", 1030118, "Retaliation", 8, 0, [{ type: "scaled-status", status: "counter-attack", percentByRank: [160, 240] }]],
    ["demon-trackers-net", 1030217, "Tracker's Net", 5, 6, [{ type: "scaled-status", status: "cripple", percentByRank: [20, 30] }, { type: "status", status: "paralyze", countByRank: [1, 1] }]],
    ["mage-god-slaying-spear", 1030321, "Grand Arcane Lance", 1, 0, [{ type: "damage", hits: 3, percentByRank: [120, 180] }]],
    ["priestess-doom", 1030418, "Condemnation", 3, 7, [{ type: "scale-status", statuses: ["burn", "poison", "bleed"], percentByRank: [200, 250] }]],
    ["assassin-execution", 1030519, "Execution", 2, 0, [{ type: "damage", percentByRank: [240, 360] }, { type: "scale-status", statuses: ["limp"], percentByRank: [0, 0] }]],
    ["north-king-earthquake", 1030622, "Earthquake", 1, 0, [{ type: "damage", percentByRank: [400] }, { type: "scaled-status", status: "lethargy", percentByRank: [400] }]],
    ["clocktower-chain-explosion", 1030720, "Chain Explosion", 4, 3, [{ type: "scale-status", statuses: ["doom"], percentByRank: [450, 450] }]],
    ["witch-all-out-attack", 1030817, "Skeleton Wave", 2, 9, [{ type: "damage", hits: 5, percentByRank: [40, 40] }]],
    ["sleepless-fire-essence", 1030922, "Fire Essence", 3, 1, [{ type: "scale-status", statuses: ["overload"], percentByRank: [350] }]],
    ["blade-chi-liberation", 1031019, "Chi Liberation", 2, 7, [{ type: "scale-status", statuses: ["doom-atk"], percentByRank: [160, 160] }]],
    ["vampire-rampage", 1031122, "Rampage", 1, 0, [{ type: "scaled-status", status: "doom", percentByRank: [30] }, { type: "damage", percentByRank: [50] }]],
    ["automaton-fate-manipulator", 1031222, "Thermal Transfer", 3, 0, [{ type: "status-from-status", status: "limp", factorByRank: [1] }, { type: "scale-status", statuses: ["limp"], percentByRank: [0] }]],
  ])("calibrates %s against source record %i", (id, sourceId, name, uses, cooldown, effects) => {
    expect(getCharacterAbility(id)).toMatchObject({
      name,
      usesPerAct: uses,
      cooldown,
      source: { sourceId, fidelity: "direct" },
      effects,
    });
  });

  it("resolves Arctic retaliation as a one-turn DEF-scaled counter pool", () => {
    const armed = useSkill(encounterFor("arctic-retaliation"), "arctic-retaliation", "foe");
    expect(statusCount(armed.state.actors.wanderer.statuses, "counter-attack")).toBe(32);
    const contact = resolveAttack({
      attacker: armed.state.actors.foe,
      defender: armed.state.actors.wanderer,
      attack: { hits: 1, damage: 10 },
      rng: armed.state.rng,
    });
    expect(contact.attacker.hp).toBe(268);
    expect(contact.hits[0].thorn).toBe(32);
  });

  it("resolves each character's corrected signature mechanics", () => {
    const net = useSkill(encounterFor("demon-trackers-net"), "demon-trackers-net", "foe");
    expect(statusCount(net.state.actors.foe.statuses, "cripple")).toBe(4);
    expect(statusCount(net.state.actors.foe.statuses, "paralyze")).toBe(1);

    const spear = useSkill(encounterFor("mage-god-slaying-spear"), "mage-god-slaying-spear", "foe");
    expect(spear.state.events.find((event) => event.type === "skill-damage")?.hits).toHaveLength(3);

    const wounds = withStatus("bleed", 5, withStatus("poison", 20, withStatus("burn", 10)));
    const perdition = useSkill(encounterFor("priestess-doom", { enemyStatuses: wounds }), "priestess-doom", "foe");
    expect(perdition.state.actors.foe.statuses).toEqual(expect.arrayContaining([
      { type: "burn", count: 20 },
      { type: "poison", count: 40 },
      { type: "bleed", count: 10 },
    ]));

    const marked = withStatus("limp", 30, wounds);
    const behead = useSkill(encounterFor("assassin-execution", { enemyStatuses: marked }), "assassin-execution", "foe");
    expect(behead.state.actors.foe.hp).toBe(238);
    expect(statusCount(behead.state.actors.foe.statuses, "limp")).toBe(0);
    expect(statusCount(behead.state.actors.foe.statuses, "burn")).toBe(9);

    const quake = useSkill(encounterFor("north-king-earthquake"), "north-king-earthquake", "foe");
    expect(quake.state.actors.foe.hp).toBe(220);
    expect(statusCount(quake.state.actors.foe.statuses, "lethargy")).toBe(80);

    const missile = useSkill(encounterFor("clocktower-missile-support"), "clocktower-missile-support", "foe");
    expect(statusCount(missile.state.actors.foe.statuses, "doom")).toBe(40);
    expect(missile.state.turn.actionsRemaining).toBe(1);

    const wave = useSkill(encounterFor("witch-all-out-attack"), "witch-all-out-attack", "foe");
    expect(wave.state.events.find((event) => event.type === "skill-damage")?.hits).toHaveLength(5);
    expect(statusCount(wave.state.actors.foe.statuses, "doom")).toBe(0);
  });

  it("resolves source multipliers, costs, and transfers without invented secondary buffs", () => {
    const fireEssence = useSkill(
      encounterFor("sleepless-fire-essence", { playerStatuses: withStatus("overload", 10) }),
      "sleepless-fire-essence",
      "foe",
    );
    expect(statusCount(fireEssence.state.actors.wanderer.statuses, "overload")).toBe(35);
    expect(fireEssence.state.turn.actionsRemaining).toBe(1);

    const chi = useSkill(
      encounterFor("blade-chi-liberation", { playerStatuses: withStatus("doom-atk", 10) }),
      "blade-chi-liberation",
      "foe",
    );
    expect(statusCount(chi.state.actors.wanderer.statuses, "doom-atk")).toBe(16);
    expect(statusCount(chi.state.actors.wanderer.statuses, "priority")).toBe(0);

    const rampage = useSkill(encounterFor("vampire-rampage"), "vampire-rampage", "foe");
    expect(statusCount(rampage.state.actors.wanderer.statuses, "doom")).toBe(60);
    expect(rampage.state.actors.foe.hp).toBe(200);

    const fate = useSkill(
      encounterFor("automaton-fate-manipulator", { playerStatuses: withStatus("limp", 20) }),
      "automaton-fate-manipulator",
      "foe",
    );
    expect(statusCount(fate.state.actors.wanderer.statuses, "limp")).toBe(0);
    expect(statusCount(fate.state.actors.foe.statuses, "limp")).toBe(20);
    expect(statusCount(fate.state.actors.wanderer.statuses, "priority")).toBe(0);
  });

  it("keeps source countdown payloads exact", () => {
    expect(getCharacterAbility("witch-limited-life-sentence")).toMatchObject({
      effects: [{ type: "delayed-damage", countByRank: [666], turnsByRank: [13] }],
    });
    expect(getCharacterAbility("witch-forbidden-ritual")).toMatchObject({
      effects: [{ type: "temporary-max-hp", countByRank: [3333], turns: 4, expirationDamage: 9999 }],
    });

    let ritual = useSkill(encounterFor("witch-forbidden-ritual"), "witch-forbidden-ritual", "foe").state;
    expect(ritual.actors.wanderer.maxHp).toBe(3533);
    for (let turn = 1; turn < 4; turn += 1) ritual = endTurn(ritual).state;
    ritual = endTurn(ritual).state;
    expect(ritual.phase).toBe("defeat");
    expect(ritual.actors.wanderer.hp).toBe(0);
  });

  it("restores other limited ability uses with Infinite Power", () => {
    let state = encounterFor("automaton-infinite-power", {
      extraSkills: ["automaton-barrel-cooling"],
    });
    state = {
      ...state,
      build: {
        ...state.build,
        skills: state.build.skills.map((entry) => (
          entry.id === "automaton-barrel-cooling" ? { ...entry, usesRemaining: 0 } : entry
        )),
      },
    };
    const result = useSkill(state, "automaton-infinite-power", "foe");
    expect(result.ok).toBe(true);
    expect(result.state.build.skills.find((entry) => entry.id === "automaton-barrel-cooling").usesRemaining)
      .toBe(3);
  });

  it("makes Infinite Power a priced net Resolve recovery in current encounters", () => {
    const legacy = encounterFor("automaton-infinite-power");
    const state = {
      ...legacy,
      actors: {
        ...legacy.actors,
        wanderer: { ...legacy.actors.wanderer, resolve: 5, resolveMax: 8 },
      },
    };
    const result = useSkill(state, "automaton-infinite-power", "foe");
    expect(result.ok).toBe(true);
    expect(result.state.actors.wanderer.resolve).toBe(6);
    expect(result.state.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "resolve-spent", amount: 2 }),
      expect.objectContaining({ type: "skill-resolve-restored", restored: 3 }),
    ]));
  });
});
