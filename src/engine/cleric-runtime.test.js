import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAbilityDef } from "../data/abilities.js";
import { recomputeResolveMax, recomputeVitalityMax } from "./attributes.js";
import { abilityUsable, endPlayerTurn, initCombat, playerAct } from "./combat.js";
import { progressionCombatEntitlements, progressionNarrativeProjection } from "./progression-abilities.js";

const CODEX = { characters: { wanderer: { id: "wanderer", worn: [] } }, items: {} };
const DOMAIN_ABILITIES = [
  "purifying-light", "divine-intercession", "turn-profane", "exorcise",
  "consecrated-strike", "storm-rebuke", "verdant-aegis", "sacred-misdirection",
];

function cleric(levels, branchChoices = {}, abilities = []) {
  const character = {
    name: "Cleric Tester",
    race: "human",
    attributes: { body: 8, reflex: 6, vigor: 12, mind: 12, wit: 8, presence: 30 },
    abilities,
    proficiencies: {},
    conditions: [],
    progression: {
      version: 2,
      professions: [{ professionId: "cleric", levels, branchChoices, choices: {} }],
      racial: null,
    },
  };
  recomputeVitalityMax(character);
  recomputeResolveMax(character);
  character.vitality = character.vitalityMax;
  character.resolve = character.resolveMax;
  return character;
}

function foe(overrides = {}) {
  return {
    id: "foe",
    name: "Test Foe",
    kind: "guard",
    race: "human",
    tier: "common",
    health: 500,
    maxHealth: 500,
    armor: 0,
    ward: 0,
    dodge: 0,
    accuracy: 5,
    critChance: 0,
    critMult: 1.5,
    speed: 2,
    resolve: 12,
    resolveMax: 12,
    will: 2,
    weapon: { name: "Club", min: 4, max: 4, type: "physical", pen: 0, category: "mace", reach: 1 },
    abilities: [],
    statuses: [],
    cooldowns: {},
    demeanor: "fanatic",
    morale: 100,
    moraleMax: 100,
    canTalk: true,
    actionsPerTurn: 1,
    ...overrides,
  };
}

function ally(name, health, statuses = []) {
  return foe({
    id: name.toLowerCase(), name, race: "human", side: "player",
    health, maxHealth: 100, statuses, abilities: [],
  });
}

function readyState(character, enemies, allies = []) {
  const state = initCombat(character, CODEX, enemies, { allies, seed: 42 });
  state.player.resolve = 100;
  state.player.resolveMax = 100;
  state.player.actionsLeft = 3;
  return state;
}

describe("Cleric progression runtime", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.99));
  afterEach(() => vi.restoreAllMocks());

  it("projects the general prepared liturgy while rejecting forged domain prayers", () => {
    const general = progressionCombatEntitlements(cleric(70));
    expect(general.abilities.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "bless", "heal", "shield-of-faith", "smite", "radiance", "sanctuary",
      "guardian-aegis", "sanctify", "renewal", "judgment", "unbreakable-will", "last-sanctuary",
    ]));
    expect(general.progressionCapabilities.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "cleric:consecrate-implements", "cleric:read-spiritual-distress", "cleric:petition-guidance",
      "cleric:minor-exorcism", "cleric:organize-relief",
    ]));

    const forged = progressionCombatEntitlements(cleric(70, {}, DOMAIN_ABILITIES.map((id) => ({ id, tier: "divine" }))));
    expect(forged.abilities.map((entry) => entry.id)).not.toEqual(expect.arrayContaining(DOMAIN_ABILITIES));
  });

  it("keeps all eight L10 domains and L30 ministries mutually exclusive", () => {
    const routes = [
      ["life", "life-ministry", "healing-ministry", "purifying-light"],
      ["light", "light-ministry", "exorcist-ministry", "turn-profane"],
      ["war", "war-ministry", "consecrated-warrior", "consecrated-strike"],
      ["grave", "grave-ministry", "death-warden-ministry", "exorcise"],
      ["knowledge", "knowledge-ministry", "oracle-ministry", "cleric:oracular-consultation"],
      ["tempest", "tempest-ministry", "storm-ministry", "storm-rebuke"],
      ["nature", "nature-ministry", "wild-ministry", "verdant-aegis"],
      ["trickery", "trickery-ministry", "mask-ministry", "sacred-misdirection"],
    ];
    for (const [domain, choiceId, optionId, selectedGrant] of routes) {
      const projection = progressionCombatEntitlements(cleric(30, {
        "sacred-domain": domain,
        [choiceId]: optionId,
      }));
      const projected = new Set([
        ...projection.abilities.map((entry) => entry.id),
        ...projection.progressionCapabilities.map((entry) => entry.id),
      ]);
      expect(projected.has(`cleric:${domain}-domain`), domain).toBe(true);
      expect(projected.has(selectedGrant), domain).toBe(true);
      for (const [otherDomain, , , siblingGrant] of routes) {
        if (otherDomain === domain) continue;
        expect(projected.has(`cleric:${otherDomain}-domain`), `${domain} excludes ${otherDomain}`).toBe(false);
        expect(projected.has(siblingGrant), `${domain} excludes ${siblingGrant}`).toBe(false);
      }
    }
  });

  it("makes Life prayers immediate, bounded, and honest about purification versus crisis rescue", () => {
    const purification = readyState(
      cleric(30, { "sacred-domain": "life", "life-ministry": "healing-ministry" }),
      [foe()],
      [ally("Afflicted", 50, [
        { type: "poison", value: 5, duration: 3 },
        { type: "curse", value: 20, duration: 3 },
        { type: "stun", value: 1, duration: 2 },
        { type: "dominated", value: 1, duration: 2 },
      ])],
    );
    const purified = playerAct(purification, "purifying-light", null);
    expect(purified.allies[0].health).toBe(58);
    expect(purified.allies[0].statuses.map((status) => status.type)).toEqual(["stun", "dominated"]);

    const intercession = readyState(
      cleric(50, {
        "sacred-domain": "life",
        "life-ministry": "healing-ministry",
        "healing-ministry-apotheosis": "miracle-physician",
      }),
      [foe()],
      [ally("Critical", 20), ally("Stable", 80)],
    );
    const rescued = playerAct(intercession, "divine-intercession", null);
    expect(rescued.allies[0]).toMatchObject({ health: 45, shield: 10 });
    expect(rescued.allies[1]).toMatchObject({ health: 88, shield: 0 });
  });

  it("turns only profane entities and separates exorcism from generic damage", () => {
    const turner = cleric(30, { "sacred-domain": "light", "light-ministry": "exorcist-ministry" });
    const turned = playerAct(readyState(turner, [
      foe({ id: "mortal", name: "Mortal Guard" }),
      foe({ id: "wight", name: "Crypt Wight", race: "undead", kind: "wight" }),
    ]), "turn-profane", null);
    expect(turned.enemies[0].statuses).toEqual([]);
    expect(turned.enemies[1].statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "stun" }),
      expect.objectContaining({ type: "weaken" }),
    ]));

    const exorcist = cleric(30, { "sacred-domain": "grave", "grave-ministry": "death-warden-ministry" });
    const host = playerAct(readyState(exorcist, [foe({
      id: "host", name: "Possessed Host", health: 300, maxHealth: 300,
      statuses: [{ type: "possessed", value: 1, duration: 9 }],
    })]), "exorcise", 0);
    expect(host.enemies[0].health).toBe(300);
    expect(host.enemies[0].statuses.some((status) => status.type === "possessed")).toBe(false);

    const summoned = playerAct(readyState(exorcist, [foe({ race: "undead", kind: "summoned-undead", _summoned: true })]), "exorcise", 0);
    expect(summoned.enemies[0]).toMatchObject({ health: 0, _banished: true });

    const boss = playerAct(readyState(exorcist, [foe({
      race: "demon", kind: "demon", boss: true, tier: "legendary", health: 5000, maxHealth: 5000,
    })]), "exorcise", 0);
    expect(boss.enemies[0].health).toBe(5000);
    expect(boss.enemies[0].statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "silence" }),
      expect.objectContaining({ type: "weaken" }),
    ]));
  });

  it("gives War, Tempest, Nature, and Trickery bounded mechanics with distinct identities", () => {
    const warrior = cleric(30, { "sacred-domain": "war", "war-ministry": "consecrated-warrior" });
    const unarmed = readyState(warrior, [foe()]);
    expect(abilityUsable(unarmed, "consecrated-strike")).toBe(false);
    unarmed.player.weapon = { name: "Consecrated Sword", min: 10, max: 10, type: "physical", pen: 0, category: "sword", reach: 1 };
    expect(abilityUsable(unarmed, "consecrated-strike")).toBe(true);
    expect(getAbilityDef("consecrated-strike")).toMatchObject({ damageType: "magical", scaling: "weapon", scaleAttr: "presence" });
    const lowWard = playerAct(unarmed, "consecrated-strike", 0);
    const wardedState = readyState(warrior, [foe({ ward: 999 })]);
    wardedState.player.weapon = unarmed.player.weapon;
    const highWard = playerAct(wardedState, "consecrated-strike", 0);
    expect(500 - lowWard.enemies[0].health).toBeGreaterThan(500 - highWard.enemies[0].health);

    const storm = cleric(30, { "sacred-domain": "tempest", "tempest-ministry": "storm-ministry" });
    const stormed = playerAct(readyState(storm, [foe({ id: "a" }), foe({ id: "b" })]), "storm-rebuke", null);
    expect(stormed.enemies.every((entry) => entry.health < 500)).toBe(true);
    expect(stormed.enemies.every((entry) => entry.statuses.some((status) => status.type === "stun"))).toBe(true);

    const nature = cleric(30, { "sacred-domain": "nature", "nature-ministry": "wild-ministry" });
    const sheltered = playerAct(readyState(nature, [foe()], [ally("Companion", 50)]), "verdant-aegis", null);
    expect(sheltered.allies[0]).toMatchObject({ health: 57, shield: 12 });

    const trickery = cleric(30, { "sacred-domain": "trickery", "trickery-ministry": "mask-ministry" });
    const misdirected = playerAct(readyState(trickery, [foe({ health: 1000, maxHealth: 1000 })]), "sacred-misdirection", 0);
    expect(misdirected.enemies[0].statuses.map((status) => status.type)).toContain("misdirected");
    expect(misdirected.enemies[0].statuses.map((status) => status.type)).not.toEqual(expect.arrayContaining(["charmed", "dominated"]));
    const healthBefore = misdirected.player.health;
    const afterIntent = endPlayerTurn(misdirected);
    expect(afterIntent.player.health).toBe(healthBefore);
    expect(afterIntent.log.some((entry) => entry.text.includes("false opening") && entry.text.includes("finds nothing"))).toBe(true);
  });

  it("projects deep Knowledge divination without leaking its Archive sibling", () => {
    const projection = progressionNarrativeProjection(cleric(50, {
      "sacred-domain": "knowledge",
      "knowledge-ministry": "oracle-ministry",
      "oracle-ministry-apotheosis": "far-seeing-hierophant",
    }));
    const capabilities = new Map(projection.progressionCapabilities.map((entry) => [entry.id, entry]));
    expect(capabilities.get("cleric:consecrate-implements")?.scope).toBe("general");
    expect(capabilities.get("cleric:oracular-consultation")).toMatchObject({ scope: "branch", type: "action" });
    expect(capabilities.get("cleric:far-seeing-rite")?.description).toContain("bounded divination");
    expect(capabilities.has("cleric:establish-sacred-archive")).toBe(false);
    expect(capabilities.has("cleric:found-living-archive")).toBe(false);
  });
});
