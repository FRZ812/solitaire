import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { progressionAbilityEntries, progressionCombatEntitlements, progressionNarrativeProjection } from "./progression-abilities.js";
import { abilityUsable, endPlayerTurn, initCombat, playerAct } from "./combat.js";
import { recomputeResolveMax, recomputeVitalityMax } from "./attributes.js";
import { createProgression } from "./progression.js";

const CODEX = { characters: { wanderer: { id: "wanderer", worn: [] } }, items: {} };

function professionTrack(professionId, levels, branchChoices = {}, extras = {}) {
  return { professionId, levels, branchChoices, ...extras };
}

function caster(professionId, levels, {
  branchChoices = {},
  signatureSpellId = null,
  metamagicIds = [],
  grantSelections = {},
  metamagicProfiles = {},
  signatureExchanges = {},
  abilities = [],
} = {}) {
  const character = {
    name: "Progression Tester",
    race: "human",
    attributes: { body: 6, reflex: 6, vigor: 12, mind: 30, wit: 6, presence: 10 },
    abilities,
    proficiencies: {},
    conditions: [],
    progression: {
      version: 2,
      signatureSpellId,
      metamagicIds,
      professions: [professionTrack(professionId, levels, branchChoices, {
        signatureSpellId,
        metamagicIds,
        choices: { signatureSpellId, metamagicIds, grantSelections, metamagicProfiles, signatureExchanges },
      })],
      racial: null,
    },
  };
  recomputeVitalityMax(character);
  recomputeResolveMax(character);
  character.vitality = character.vitalityMax;
  character.resolve = character.resolveMax;
  return character;
}

function enemy(overrides = {}) {
  return {
    id: "test-foe",
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
    weapon: { name: "Club", min: 1, max: 2, type: "physical", pen: 0, category: "mace", reach: 1 },
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

function abilityIds(character) {
  return progressionAbilityEntries(character).map((entry) => entry.id);
}

function castOnce(character, abilityId, foes = [enemy()]) {
  const state = initCombat(character, CODEX, foes, { seed: 42 });
  expect(state.player.abilities.some((entry) => entry.id === abilityId)).toBe(true);
  return playerAct(state, abilityId, 0);
}

describe("profession-derived combat abilities", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it("gives an equal-level Wizard a broad spellbook while a Sorcerer exposes only its signature", () => {
    const wizard = abilityIds(caster("wizard", 40));
    const sorcerer = abilityIds(caster("sorcerer", 40, { signatureSpellId: "firebolt" }));

    expect(wizard).toContain("arcane-bolt");
    expect(wizard).toContain("fireball");
    expect(sorcerer).toEqual(["firebolt"]);
    expect(wizard.length).toBeGreaterThan(sorcerer.length * 5);
  });

  it("reads spent ranks and choices from the persisted v2 ledger", () => {
    const character = caster("sorcerer", 1);
    character.progression = createProgression({
      raceId: "human",
      level: 30,
      racialLevels: 0,
      professions: [{ professionId: "sorcerer", specializationId: "high-sorcerer", levels: 30 }],
      signatureSpellId: "firebolt",
      metamagicIds: ["empowered-signature", "quickened-signature"],
    });
    const entitlements = progressionCombatEntitlements(character);

    expect(entitlements.signatureSpellIds).toEqual(["firebolt"]);
    expect(entitlements.metamagicIds).toEqual(["empowered-signature", "quickened-signature"]);
    expect(entitlements.abilities.map((entry) => entry.id)).toEqual(["firebolt"]);
  });

  it("does not turn earned but unspent allocations into early abilities", () => {
    const character = caster("wizard", 1);
    character.progression.professions[0] = {
      professionId: "wizard",
      levels: 50,
      unspentLevels: 50,
      paths: {},
      choices: {},
      branchChoices: {},
    };
    expect(progressionAbilityEntries(character)).toEqual([]);
  });

  it("never grants Wizard branch abilities before the durable nested choice", () => {
    const smuggled = [
      "summon-undead", "enervation", "death-clutch", "soul-siphon", "grasp-heart",
      "antimagic-field", "geas", "greater-invisibility", "polymorph",
    ]
      .map((id) => ({ id, tier: "divine" }));
    const unchosen = caster("wizard", 70, { abilities: smuggled });
    expect(abilityIds(unchosen)).not.toEqual(expect.arrayContaining(smuggled.map((entry) => entry.id)));

    const undeadLord = caster("wizard", 50, {
      branchChoices: { "wizard-school": "necromancy", "necromancy-discipline": "undead-lord" },
    });
    expect(abilityIds(undeadLord)).toContain("summon-undead");
    expect(abilityIds(undeadLord)).not.toContain("enervation");

    const deathDrain = caster("wizard", 50, {
      branchChoices: {
        "wizard-school": "necromancy",
        "necromancy-discipline": "death-magic",
        "death-magic-mastery": "drain",
      },
    });
    expect(abilityIds(deathDrain)).toEqual(expect.arrayContaining(["enervation", "soul-siphon"]));
    expect(abilityIds(deathDrain)).not.toEqual(expect.arrayContaining(["summon-undead", "death-clutch", "grasp-heart"]));
  });

  it("projects the authored entry working for each focused Wizard school", () => {
    const schoolAbility = {
      abjuration: "mana-shield",
      enchantment: "hex",
      illusion: "mirror-image",
      evocation: "combust",
      necromancy: "wither",
      transmutation: "stone-armor",
    };
    for (const [school, exclusiveId] of Object.entries(schoolAbility)) {
      const ids = abilityIds(caster("wizard", 10, { branchChoices: { "wizard-school": school } }));
      expect(ids, school).toContain(exclusiveId);
    }
    const universalist = abilityIds(caster("wizard", 10, { branchChoices: { "wizard-school": "universalist" } }));
    expect(universalist).not.toEqual(expect.arrayContaining(["arcane-convergence", "antimagic-field"]));
  });

  it("makes Enervation inflict a bounded level-drain that weakens force and aim", () => {
    const character = caster("wizard", 30, {
      branchChoices: { "wizard-school": "necromancy", "necromancy-discipline": "death-magic" },
    });
    const after = castOnce(character, "enervation", [enemy({ health: 500, resolve: 12 })]);
    const drained = after.enemies[0].statuses.find((status) => status.type === "levelDrain");

    expect(drained).toMatchObject({ value: 25 });
    expect(drained.duration).toBeGreaterThanOrEqual(4);
    expect(drained.duration).toBeLessThanOrEqual(6);
    expect(after.enemies[0].resolve).toBeLessThan(12);
    expect(after.log.some((entry) => entry.text.includes("skill, aim, and force ebb"))).toBe(true);
  });

  it("makes the deeper Drain focus restore life from its exclusive Soul Siphon", () => {
    const character = caster("wizard", 50, {
      branchChoices: {
        "wizard-school": "necromancy",
        "necromancy-discipline": "death-magic",
        "death-magic-mastery": "drain",
      },
    });
    character.vitality = Math.floor(character.vitalityMax / 2);
    const before = character.vitality;
    const after = castOnce(character, "soul-siphon", [enemy({ health: 1000, maxHealth: 1000 })]);
    expect(after.player.health).toBeGreaterThan(before);
    expect(after.log.some((entry) => entry.text.includes("drains") && entry.text.includes("life"))).toBe(true);
  });

  it("summons bounded undead retainers and caps one caster at two", () => {
    const character = caster("wizard", 30, {
      branchChoices: { "wizard-school": "necromancy", "necromancy-discipline": "undead-lord" },
    });
    let state = initCombat(character, CODEX, [enemy()], { seed: 42 });
    for (let index = 0; index < 3; index += 1) {
      state.phase = "player";
      state.player.actionsLeft = 1;
      state.player.resolve = state.player.resolveMax;
      state.player.cooldowns["summon-undead"] = 0;
      state = playerAct(state, "summon-undead", null);
    }

    expect(state.allies).toHaveLength(2);
    expect(state.allies.every((ally) => ally._summonerUid === "p" && ally.kind === "summoned-undead")).toBe(true);
    expect(state.allies.every((ally) => ally.maxHealth <= 120)).toBe(true);
    expect(state.log.some((entry) => entry.text.includes("maximum of two"))).toBe(true);
  });

  it("allows Grasp Heart only below its threshold and gives bosses a stricter safety bound", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const character = caster("wizard", 50, {
      branchChoices: {
        "wizard-school": "necromancy",
        "necromancy-discipline": "death-magic",
        "death-magic-mastery": "instant-death",
      },
    });
    expect(progressionAbilityEntries(character).find((entry) => entry.id === "grasp-heart")?.tier).toBe("mythical");
    const mortal = castOnce(character, "grasp-heart", [enemy({ health: 120, maxHealth: 500 })]);
    expect(mortal.enemies[0].health).toBe(0);

    const boss = castOnce(character, "grasp-heart", [enemy({ name: "End Boss", boss: true, tier: "legendary", health: 400, maxHealth: 2000 })]);
    expect(boss.enemies[0].health).toBeGreaterThan(0);
    expect(boss.log.some((entry) => entry.text.includes("too strong"))).toBe(true);
  });

  it("rejects a forged branch-exclusive card without its resolved route entitlement", () => {
    const character = caster("wizard", 50, {
      branchChoices: {
        "wizard-school": "abjuration",
        "abjuration-discipline": "warder",
        "warder-mastery": "mirror-warden",
      },
    });
    const state = initCombat(character, CODEX, [enemy()], { seed: 42 });
    state.player.abilities.push({ id: "antimagic-field", tier: "legendary" });

    expect(state.player.progressionBranchAbilityIds).not.toContain("antimagic-field");
    expect(abilityUsable(state, "antimagic-field")).toBe(false);
    expect(playerAct(state, "antimagic-field", null)).toBe(state);
  });

  it("makes Antimagic Field suppress hostile magic while also sealing allied spellcasting", () => {
    const character = caster("wizard", 50, {
      branchChoices: {
        "wizard-school": "abjuration",
        "abjuration-discipline": "nullifier",
        "nullifier-mastery": "nullifier-antimage",
      },
    });
    const mage = enemy({
      name: "Hostile Mage",
      abilities: [{ id: "firebolt", tier: "legendary" }],
      attrs: { mind: 30 },
      resolve: 99,
      resolveMax: 99,
      weapon: { name: "Twig", min: 1, max: 1, type: "physical", pen: 0, category: "mace", reach: 1 },
    });

    const baseline = initCombat(character, CODEX, [mage], { seed: 42 });
    expect(baseline.enemies[0].intent?.abilityId).toBe("firebolt");
    const baselineHealth = baseline.player.health;
    const afterBaseline = endPlayerTurn(baseline);
    const baselineLoss = baselineHealth - afterBaseline.player.health;

    let protectedState = initCombat(character, CODEX, [mage], { seed: 42 });
    protectedState = playerAct(protectedState, "antimagic-field", null);
    expect(protectedState.player.statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "antimagicField", value: 75 }),
    ]));
    expect(abilityUsable(protectedState, "arcane-bolt")).toBe(false);
    const protectedHealth = protectedState.player.health;
    protectedState = endPlayerTurn(protectedState);
    const protectedLoss = protectedHealth - protectedState.player.health;

    expect(baselineLoss).toBeGreaterThan(0);
    expect(protectedLoss).toBeLessThan(baselineLoss / 2);
    expect(protectedState.log.some((entry) => entry.text.includes("antimagic"))).toBe(true);
  });

  it("makes Geas exact a nonlethal vitality and Resolve price for disobedience", () => {
    const character = caster("wizard", 50, {
      branchChoices: {
        "wizard-school": "enchantment",
        "enchantment-discipline": "dominator",
        "dominator-mastery": "oathbinder",
      },
    });
    let state = initCombat(character, CODEX, [enemy({ health: 500, maxHealth: 500, resolve: 12 })], { seed: 42 });
    state = playerAct(state, "geas", 0);
    expect(state.enemies[0].statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "geas", value: 6, sourceUid: "p" }),
    ]));

    state = endPlayerTurn(state);
    expect(state.enemies[0].health).toBe(470);
    expect(state.enemies[0].resolve).toBe(10);
    expect(state.log.some((entry) => entry.text.includes("geas punishes the disobedient attack"))).toBe(true);
  });

  it("makes Greater Invisibility foil direct attacks and empower attacks made from the veil", () => {
    const character = caster("wizard", 50, {
      branchChoices: {
        "wizard-school": "illusion",
        "illusion-discipline": "veilwalker",
        "veilwalker-mastery": "unseen-master",
      },
    });
    const foe = enemy({ accuracy: 100, health: 1000, maxHealth: 1000 });
    let veiled = initCombat(character, CODEX, [foe], { seed: 42 });
    veiled = playerAct(veiled, "greater-invisibility", null);
    const healthBefore = veiled.player.health;
    const afterEnemy = endPlayerTurn(veiled);
    expect(afterEnemy.player.health).toBe(healthBefore);
    expect(afterEnemy.log.some((entry) => entry.text.includes("greater veil leaves nothing to strike"))).toBe(true);

    const plain = playerAct(initCombat(character, CODEX, [foe], { seed: 42 }), "arcane-bolt", 0);
    const plainDamage = foe.maxHealth - plain.enemies[0].health;
    veiled.player.actionsLeft = 1;
    const unseenStrike = playerAct(veiled, "arcane-bolt", 0);
    expect(foe.maxHealth - unseenStrike.enemies[0].health).toBeGreaterThan(plainDamage);
  });

  it("makes Polymorph suppress a stored spell intent and bounds boss transformation", () => {
    const character = caster("wizard", 50, {
      branchChoices: {
        "wizard-school": "transmutation",
        "transmutation-discipline": "fleshshaper",
        "fleshshaper-mastery": "master-shaper",
      },
    });
    const mage = enemy({
      name: "Shape Target",
      abilities: [{ id: "firebolt", tier: "legendary" }],
      attrs: { mind: 30 },
      resolve: 20,
      resolveMax: 20,
      weapon: { name: "Twig", min: 1, max: 1, type: "physical", pen: 0, category: "mace", reach: 1 },
    });
    let state = initCombat(character, CODEX, [mage], { seed: 42 });
    expect(state.enemies[0].intent?.abilityId).toBe("firebolt");
    state = playerAct(state, "polymorph", 0);
    expect(state.enemies[0].statuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "polymorph" }),
    ]));
    const healthBefore = state.player.health;
    state = endPlayerTurn(state);
    expect(healthBefore - state.player.health).toBeLessThanOrEqual(2);
    expect(state.enemies[0].resolve).toBe(20);
    expect(state.log.some((entry) => entry.text.includes("uses Firebolt"))).toBe(false);

    const boss = castOnce(character, "polymorph", [enemy({ boss: true, tier: "legendary", will: 30 })]);
    expect(boss.enemies[0].statuses.some((status) => status.type === "polymorph")).toBe(false);
    expect(boss.log.some((entry) => entry.text.includes("resists the attempted transformation"))).toBe(true);
  });
});

describe("Sorcerer signature metamagic", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  function damageWith(metamagicIds, target = enemy({ health: 1000, maxHealth: 1000 })) {
    const after = castOnce(caster("sorcerer", 60, { signatureSpellId: "firebolt", metamagicIds }), "firebolt", [target]);
    return { damage: target.health - after.enemies[0].health, after };
  }

  it("projects the four-spell general repertoire and unlocks metamagic scope at 20/40/60", () => {
    const metamagicIds = [
      "empowered-signature", "quickened-signature", "piercing-signature",
      "transmuted-signature", "twinned-signature", "perfected-signature",
    ];
    const grantSelections = {
      "sorcerer-secondary-spell": ["combust"],
      "sorcerer-tertiary-spell": ["lightning-bolt"],
      "sorcerer-final-repertoire-spell": ["chain-lightning"],
    };
    const entitlementsAt = (levels) => progressionCombatEntitlements(caster("sorcerer", levels, {
      signatureSpellId: "firebolt", metamagicIds, grantSelections,
    }));

    const nineteen = entitlementsAt(19);
    expect(nineteen.abilities.map((entry) => entry.id)).toEqual(expect.arrayContaining(["firebolt", "combust"]));
    expect(nineteen.abilities.map((entry) => entry.id)).not.toContain("lightning-bolt");
    expect(nineteen.metamagicByAbilityId.firebolt).toEqual(["empowered-signature"]);
    expect(nineteen.metamagicByAbilityId.combust).toEqual([]);

    const twenty = entitlementsAt(20);
    expect(twenty.metamagicByAbilityId.firebolt).toEqual(["empowered-signature", "quickened-signature"]);
    expect(twenty.metamagicByAbilityId.combust).toEqual(["empowered-signature", "quickened-signature"]);

    const thirtyNine = entitlementsAt(39);
    expect(thirtyNine.abilities.map((entry) => entry.id)).toContain("lightning-bolt");
    expect(thirtyNine.metamagicByAbilityId.lightningBolt).toBeUndefined();
    expect(thirtyNine.metamagicByAbilityId["lightning-bolt"]).toEqual([]);

    const forty = entitlementsAt(40);
    expect(forty.metamagicByAbilityId["lightning-bolt"]).toEqual(metamagicIds.slice(0, 4));

    const fiftyNine = entitlementsAt(59);
    expect(fiftyNine.abilities.map((entry) => entry.id)).toContain("chain-lightning");
    expect(fiftyNine.metamagicByAbilityId["chain-lightning"]).toEqual([]);

    const sixty = entitlementsAt(60);
    expect(sixty.metamagicByAbilityId["chain-lightning"]).toEqual(metamagicIds);
  });

  it("keeps Spellweaver profiles independent in both entitlement metadata and cards", () => {
    const character = caster("sorcerer", 30, {
      signatureSpellId: "firebolt",
      metamagicIds: ["empowered-signature"],
      branchChoices: {
        "sorcerous-focus": "specialized-spellweaver",
        "spellweaver-discipline": "constellation-weaver",
      },
      grantSelections: {
        "sorcerer-secondary-spell": ["fireball"],
        "sorcerer-tertiary-spell": ["chain-lightning"],
        "sorcerer:weave-spell-i": ["frost-lance"],
        "sorcerer:weave-spell-ii": ["lightning-bolt"],
      },
      metamagicProfiles: {
        "woven-spell-i": ["quickened-signature"],
        "woven-spell-ii": ["shaped-signature"],
      },
    });
    const entitlements = progressionCombatEntitlements(character);
    expect(entitlements.abilities.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "firebolt", "fireball", "chain-lightning", "frost-lance", "lightning-bolt",
    ]));
    expect(entitlements.metamagicByAbilityId.firebolt).toEqual(["empowered-signature"]);
    expect(entitlements.metamagicByAbilityId.fireball).toEqual(["empowered-signature"]);
    expect(entitlements.metamagicByAbilityId["chain-lightning"]).toEqual([]);
    expect(entitlements.metamagicByAbilityId["frost-lance"]).toEqual(["quickened-signature"]);
    expect(entitlements.metamagicByAbilityId["lightning-bolt"]).toEqual(["shaped-signature"]);

    const state = initCombat(character, CODEX, [enemy({ id: "a" }), enemy({ id: "b" })], { seed: 42 });
    const cardFor = (abilityId) => Object.values(state.deck.cards).find((card) => card.abilityId === abilityId);
    expect(cardFor("frost-lance")).toMatchObject({ energyCost: 0, target: "enemy", metamagic: ["quickened-signature"] });
    expect(cardFor("lightning-bolt")).toMatchObject({ target: "all-enemies", metamagic: ["shaped-signature"] });
    expect(cardFor("fireball").metamagic).toEqual(["empowered-signature"]);
    expect(cardFor("fireball").energyCost).toBe(1);
  });

  it("confines every Singular Savant metamagic slot to the signature spell", () => {
    const metamagicIds = [];
    metamagicIds[0] = "empowered-signature";
    metamagicIds[1] = "quickened-signature";
    metamagicIds[2] = "piercing-signature";
    metamagicIds[6] = "subtle-signature";
    metamagicIds[7] = "triggered-signature";
    const character = caster("sorcerer", 30, {
      signatureSpellId: "firebolt",
      metamagicIds,
      branchChoices: {
        "sorcerous-focus": "singular-savant",
        "singular-savant-discipline": "mutable-signature",
      },
      grantSelections: {
        "sorcerer-secondary-spell": ["combust"],
        "sorcerer-tertiary-spell": ["lightning-bolt"],
      },
    });
    const entitlements = progressionCombatEntitlements(character);

    expect(entitlements.metamagicByAbilityId.firebolt).toEqual(expect.arrayContaining([
      "empowered-signature", "quickened-signature", "piercing-signature",
      "subtle-signature", "triggered-signature",
    ]));
    expect(entitlements.metamagicByAbilityId.combust).toEqual([]);
    expect(entitlements.metamagicByAbilityId["lightning-bolt"]).toEqual([]);
    expect(entitlements.abilities.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "firebolt", "combust", "lightning-bolt",
    ]));
    expect(entitlements.abilities.map((entry) => entry.id)).not.toEqual(expect.arrayContaining([
      "subtle-signature", "triggered-signature",
    ]));
  });

  it("projects every Singular utility mode with its authored narrative effect", () => {
    const expectedEffects = {
      "subtle-signature": "does not conceal its resolved consequences or bypass magical detection",
      "lingering-signature": "one bounded additional interval",
      "triggered-signature": "only one triggered signature may be held at once",
      "reversible-signature": "harm already dealt is not restored",
    };

    for (const [metamagicId, effectText] of Object.entries(expectedEffects)) {
      const metamagicIds = [];
      metamagicIds[6] = metamagicId;
      const projection = progressionNarrativeProjection(caster("sorcerer", 10, {
        signatureSpellId: "firebolt",
        metamagicIds,
        branchChoices: { "sorcerous-focus": "singular-savant" },
      }));
      const profile = projection.metamagicProfiles.find((entry) => entry.abilityId === "firebolt");
      const feature = profile?.features.find((entry) => entry.id === metamagicId);

      expect(profile?.primarySignature, metamagicId).toBe(true);
      expect(feature?.description, metamagicId).toContain(effectText);
    }
  });

  it("replaces an exchanged primary without preserving the former signature as a free spell", () => {
    const exchanged = progressionCombatEntitlements(caster("sorcerer", 30, {
      signatureSpellId: "lightning-bolt",
      signatureExchanges: { 25: "lightning-bolt" },
      metamagicIds: ["empowered-signature", "quickened-signature", "piercing-signature"],
      abilities: ["firebolt"],
    }));

    expect(exchanged.signatureSpellIds).toEqual(["lightning-bolt"]);
    expect(exchanged.abilities.map((entry) => entry.id)).toContain("lightning-bolt");
    expect(exchanged.abilities.map((entry) => entry.id)).not.toContain("firebolt");
    expect(exchanged.metamagicByAbilityId["lightning-bolt"]).toEqual([
      "empowered-signature", "quickened-signature", "piercing-signature",
    ]);

    const independentlyKnown = progressionCombatEntitlements(caster("sorcerer", 30, {
      signatureSpellId: "lightning-bolt",
      signatureExchanges: { 25: "lightning-bolt" },
      grantSelections: { "sorcerer-secondary-spell": ["firebolt"] },
    }));
    expect(independentlyKnown.abilities.map((entry) => entry.id)).toContain("firebolt");
  });

  it("materially empowers, twins, pierces, and transmutes the selected signature spell", () => {
    const baseline = damageWith([]).damage;
    expect(damageWith(["empowered-signature"]).damage).toBeGreaterThan(baseline);
    expect(damageWith(["twinned-signature"]).damage).toBeGreaterThan(baseline);

    const warded = enemy({ health: 1000, maxHealth: 1000, ward: 18 });
    expect(damageWith(["piercing-signature"], warded).damage).toBeGreaterThan(damageWith([], warded).damage);

    const sealed = enemy({ health: 1000, maxHealth: 1000, ward: 100, armor: 0 });
    expect(damageWith(["transmuted-signature"], sealed).damage).toBeGreaterThan(damageWith([], sealed).damage);
  });

  it("makes shaped signatures affect the field and quickened signatures cost no action/energy", () => {
    const character = caster("sorcerer", 60, {
      signatureSpellId: "firebolt",
      metamagicIds: ["shaped-signature", "quickened-signature"],
    });
    const state = initCombat(character, CODEX, [enemy({ id: "a" }), enemy({ id: "b" })], { seed: 42 });
    const signatureCard = Object.values(state.deck.cards).find((card) => card.abilityId === "firebolt");

    expect(signatureCard).toMatchObject({ target: "all-enemies", energyCost: 0, signature: true });
    const actionsBefore = state.player.actionsLeft;
    const after = playerAct(state, "firebolt", 0);
    expect(after.player.actionsLeft).toBe(actionsBefore);
    expect(after.enemies.every((foe) => foe.health < foe.maxHealth)).toBe(true);
  });

  it("keeps metamagic attached only to the current signature spell", () => {
    const character = caster("sorcerer", 60, {
      signatureSpellId: "firebolt",
      metamagicIds: ["empowered-signature", "quickened-signature"],
      abilities: ["firebolt", "frost-lance"],
    });
    const entitlements = progressionCombatEntitlements(character);
    expect(entitlements.signatureSpellIds).toEqual(["firebolt"]);
    expect(entitlements.abilities.map((entry) => entry.id)).not.toContain("frost-lance");
  });

  it("does not activate a selected metamagic slot before its profession threshold", () => {
    const early = progressionCombatEntitlements(caster("sorcerer", 9, {
      signatureSpellId: "firebolt",
      metamagicIds: ["empowered-signature"],
    }));
    const unlocked = progressionCombatEntitlements(caster("sorcerer", 10, {
      signatureSpellId: "firebolt",
      metamagicIds: ["empowered-signature"],
    }));

    expect(early.metamagicIds).toEqual([]);
    expect(unlocked.metamagicIds).toEqual(["empowered-signature"]);
  });
});
