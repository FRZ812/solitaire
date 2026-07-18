import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { abilityCategoryOf, BASIC_ATTACK, getAbilityDef } from "../data/abilities.js";
import { recomputeResolveMax, recomputeVitalityMax } from "./attributes.js";
import { chooseAction } from "./combat-ai.js";
import {
  abilityUsable,
  endPlayerTurn,
  initCombat,
  playerAct,
} from "./combat.js";

const CODEX = { characters: { wanderer: { id: "wanderer", worn: [] } }, items: {} };

const BARD_ABILITY_IDS = [
  "bard-clarion-note",
  "bard-steady-beat",
  "bard-cutting-verse",
  "bard-rising-tempo",
  "bard-dissonant-chord",
  "bard-call-and-response",
  "bard-stinging-refrain",
  "bard-crescendo",
  "bard-syncopated-break",
  "bard-heartening-chorus",
  "bard-counter-melody",
  "bard-grand-finale",
  "bard-war-drum",
  "bard-pointed-satire",
  "bard-resonant-pulse",
  "bard-lore-callout",
  "bard-marching-cadence",
  "bard-defiant-anthem",
  "bard-hecklers-hook",
  "bard-chorus-of-scorn",
  "bard-shattertone",
  "bard-harmonic-weave",
  "bard-old-ballad",
  "bard-battle-chronicle",
];

const GENERIC_SPELL_OR_CONTROL_STATUS = new Set([
  "rally", "focus", "regen", "magicShield", "weaken", "vulnerable", "curse",
  "charm", "charmed", "dominated", "geas", "stun",
]);

function bardTrack(levels = 70, branchChoices = {}) {
  return { professionId: "bard", levels, branchChoices, choices: {} };
}

function makeCharacter({ levels = 70, branchChoices = {}, professionId = "bard" } = {}) {
  const character = {
    id: "wanderer",
    name: "Bard Tester",
    race: "human",
    weight: 70,
    attributes: { body: 12, reflex: 24, vigor: 18, mind: 18, wit: 30, presence: 30 },
    abilities: [],
    proficiencies: { performance: 8, spellcasting: 20 },
    conditions: [],
    progression: {
      version: 2,
      professions: professionId === "bard"
        ? [bardTrack(levels, branchChoices)]
        : [{ professionId, levels, branchChoices: {}, choices: {} }],
      racial: null,
    },
  };
  recomputeVitalityMax(character);
  recomputeResolveMax(character);
  character.vitality = character.vitalityMax;
  character.resolve = character.resolveMax;
  return character;
}

function combatant(overrides = {}) {
  return {
    id: "foe",
    name: "Training Foe",
    kind: "guard",
    race: "human",
    tier: "common",
    health: 5000,
    maxHealth: 5000,
    armor: 0,
    armorClass: null,
    ward: 0,
    sonicGuard: 0,
    dodge: 0,
    accuracy: 1000,
    critChance: 0,
    critMult: 1.5,
    speed: 2,
    resolve: 100,
    resolveMax: 100,
    will: 2,
    weight: 80,
    size: "medium",
    weapon: { name: "Club", min: 2, max: 2, type: "physical", pen: 0, category: "mace", reach: 1 },
    abilities: [],
    statuses: [],
    cooldowns: {},
    demeanor: "fanatic",
    morale: 100,
    moraleMax: 100,
    conscious: true,
    canHear: true,
    hearing: true,
    canUnderstand: true,
    understandsSpeech: true,
    languageUnderstanding: true,
    canTalk: true,
    actionsPerTurn: 1,
    ...overrides,
  };
}

function readyState(character = makeCharacter(), enemies = [combatant()], opts = {}) {
  const state = initCombat(character, CODEX, enemies, { seed: 42, ...opts });
  state.player.weapon = { name: "Performance Baton", min: 1, max: 1, type: "physical", pen: 0, category: "improvised", reach: 1 };
  state.player.accuracy = 1000;
  state.player.critChance = 0;
  state.player.resolve = 100;
  state.player.resolveMax = 100;
  state.player.actionsLeft = 3;
  state.player.energy = 3;
  return state;
}

function refresh(state, abilityId) {
  state.phase = "player";
  state.player.actionsLeft = 3;
  state.player.energy = 3;
  state.player.cooldowns[abilityId] = 0;
  return state;
}

function grantPlayer(state, abilityId, tier = "common") {
  expect(getAbilityDef(abilityId), `${abilityId} must be authored`).toBeTruthy();
  state.player.abilities = (state.player.abilities || []).filter((entry) => entry.id !== abilityId);
  state.player.abilities.push({ id: abilityId, tier });
  state.player.progressionAbilityIds = [...new Set([...(state.player.progressionAbilityIds || []), abilityId])];
  state.player.progressionBranchAbilityIds = [...new Set([...(state.player.progressionBranchAbilityIds || []), abilityId])];
  return state;
}

function use(state, abilityId, targetIndex = undefined, tier = "common") {
  grantPlayer(state, abilityId, tier);
  refresh(state, abilityId);
  const def = getAbilityDef(abilityId);
  const index = targetIndex === undefined ? (def.target === "enemy" ? 0 : null) : targetIndex;
  return playerAct(state, abilityId, index);
}

function statusOf(actor, type) {
  return (actor.statuses || []).find((status) => status.type === type);
}

function forceEnemyIntent(state, abilityId, mode = null, targetUid = "p") {
  const def = getAbilityDef(abilityId);
  const targetMode = mode || (def.target === "all-enemies" ? "aoe" : def.target === "all-allies" ? "all-allies" : def.target === "self" ? "self" : "single");
  const intent = {
    id: `forced-${abilityId}`,
    abilityId,
    tier: "common",
    mode: targetMode,
    targetUid: ["single"].includes(targetMode) ? targetUid : null,
    name: def.name,
    kind: def.dmg ? "attack" : "buff",
  };
  state.enemies[0].intent = intent;
  state.enemies[0].intents = [intent];
  return state;
}

function healthLoss(before, after, index = 0) {
  return before.enemies[index].health - after.enemies[index].health;
}

describe("Bard non-spell performance runtime", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it("resets Cadence to zero, remembers motifs, and builds only when the motif changes", () => {
    const character = makeCharacter();
    character.bardCadence = 4;
    character.bardLastMotif = "story";
    let state = readyState(character);
    expect(state.player).toMatchObject({ bardCadence: 0, bardLastMotif: null });

    state = use(state, "bard-clarion-note", 0);
    expect(state.player).toMatchObject({ bardCadence: 1, bardLastMotif: "voice" });

    state = use(state, "bard-clarion-note", 0);
    expect(state.player).toMatchObject({ bardCadence: 1, bardLastMotif: "voice" });

    state = use(state, "bard-call-and-response", null);
    expect(state.player).toMatchObject({ bardCadence: 1, bardLastMotif: "voice" });

    state = use(state, "bard-steady-beat", null);
    expect(state.player).toMatchObject({ bardCadence: 2, bardLastMotif: "rhythm" });

    state = use(state, "bard-cutting-verse", 0);
    expect(state.player).toMatchObject({ bardCadence: 3, bardLastMotif: "story" });
  });

  it("cost-gates spenders and spends Cadence exactly once for AoE and multi-hit performances", () => {
    let aoe = readyState(makeCharacter(), [
      combatant({ id: "one" }),
      combatant({ id: "two", name: "Second Foe" }),
    ]);
    grantPlayer(aoe, "bard-grand-finale");
    expect(abilityUsable(aoe, "bard-grand-finale")).toBe(false);
    aoe.player.bardCadence = 4;
    expect(abilityUsable(aoe, "bard-grand-finale")).toBe(true);
    aoe = use(aoe, "bard-grand-finale", null);
    expect(aoe.player.bardCadence).toBe(0);
    expect(aoe.player.bardLastMotif).toBe("story");
    expect(aoe.enemies.every((enemy) => enemy.health < enemy.maxHealth)).toBe(true);
    expect(aoe.log.filter((entry) => entry.text?.includes("spends 4 Cadence"))).toHaveLength(1);

    let multi = readyState(makeCharacter(), [
      combatant({ id: "one" }),
      combatant({ id: "two", name: "Second Foe" }),
    ]);
    multi.player.bardCadence = 2;
    multi = use(multi, "bard-harmonic-weave", null);
    expect(multi.player.bardCadence).toBe(0);
    expect(multi.player.bardLastMotif).toBe("harmony");
    expect(multi.log.filter((entry) => entry.text?.includes("spends 2 Cadence"))).toHaveLength(1);
    expect(multi.log.filter((entry) => /hits (Training Foe|Second Foe) for/.test(entry.text || ""))).toHaveLength(4);
  });

  it("classifies every Bard card as audible performance, never a spell or Resolve/metamagic payload", () => {
    for (const abilityId of BARD_ABILITY_IDS) {
      const def = getAbilityDef(abilityId);
      expect(def, abilityId).toMatchObject({
        professionId: "bard",
        school: "performance",
        progressionExclusive: true,
        audible: true,
        resolveCost: 0,
      });
      expect(abilityCategoryOf(def), abilityId).not.toBe("spell");
      expect(def.innate, abilityId).not.toBe(true);
      expect(["performance", "none"], abilityId).toContain(def.scaling);
    }
    for (const abilityId of [
      "bard-cutting-verse",
      "bard-stinging-refrain",
      "bard-pointed-satire",
      "bard-hecklers-hook",
      "bard-chorus-of-scorn",
    ]) {
      expect(getAbilityDef(abilityId).bardRequiresUnderstanding, abilityId).toBe(true);
    }

    let plain = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
    plain.player.resolve = 0;
    const plainBefore = structuredClone(plain);
    plain = use(plain, "bard-clarion-note", 0);
    const plainDamage = healthLoss(plainBefore, plain);

    let altered = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
    altered.player.resolve = 0;
    altered.player.statuses.push({ type: "antimagicField", value: 90, duration: 3 });
    altered.player.signatureSpellIds = ["bard-clarion-note"];
    altered.player.metamagicIds = ["empowered-signature", "shaped-signature", "twinned-signature", "quickened-signature"];
    altered.player.metamagicByAbilityId = {
      "bard-clarion-note": ["empowered-signature", "shaped-signature", "twinned-signature", "quickened-signature"],
    };
    grantPlayer(altered, "bard-clarion-note");
    expect(abilityUsable(altered, "bard-clarion-note")).toBe(true);
    const actionsBefore = altered.player.actionsLeft;
    altered = playerAct(altered, "bard-clarion-note", 0);
    expect(altered.player.resolve).toBe(0);
    expect(altered.player.actionsLeft).toBe(actionsBefore - 1);
    expect(altered.magicCast).not.toBe(true);
    expect(altered.enemies[0].maxHealth - altered.enemies[0].health).toBe(plainDamage);
    expect(altered.enemies[1].health).toBe(altered.enemies[1].maxHealth);

    const silenced = readyState();
    silenced.player.statuses.push({ type: "silence", value: 1, duration: 2 });
    grantPlayer(silenced, "bard-clarion-note");
    // Silence blocks the physical sound channel, not a magical casting channel.
    expect(abilityUsable(silenced, "bard-clarion-note")).toBe(false);
  });

  it("routes sonic damage through bounded acoustic guard, not ward or true-damage bypass", () => {
    const dealtTo = (overrides) => {
      let state = readyState(makeCharacter(), [combatant(overrides)]);
      state.player.bardCadence = 2;
      const before = structuredClone(state);
      state = use(state, "bard-crescendo", null, "divine");
      return { dealt: healthLoss(before, state), state };
    };

    const baseline = dealtTo({}).dealt;
    const warded = dealtTo({ ward: 500 }).dealt;
    const armored = dealtTo({ armor: 40 }).dealt;
    const guarded = dealtTo({ sonicGuard: 25 }).dealt;
    const overGuarded = dealtTo({ sonicGuard: 10000 }).dealt;
    const damped = dealtTo({ dr: 0.5 }).dealt;
    const blocked = dealtTo({ block: 7, shield: 11 }).dealt;
    const immune = dealtTo({ sonicImmune: true }).dealt;

    expect(baseline).toBeGreaterThan(0);
    expect(warded).toBe(baseline);
    expect(armored).toBe(baseline - 10);
    expect(guarded).toBeLessThan(baseline);
    expect(overGuarded).toBeGreaterThan(0);
    expect(overGuarded).toBeLessThan(guarded);
    expect(damped).toBeLessThan(baseline);
    expect(blocked).toBe(Math.max(0, baseline - 18));
    expect(immune).toBe(0);

    let fractured = readyState(makeCharacter(), [combatant({ sonicGuard: 5, health: 120, maxHealth: 120 })]);
    fractured.player.bardCadence = 2;
    fractured = use(fractured, "bard-shattertone", 0);
    const fractureStatus = statusOf(fractured.enemies[0], "bardSonicFracture");
    expect(fractureStatus).toBeTruthy();
    const beforeFollowup = structuredClone(fractured);
    fractured = use(fractured, "bard-clarion-note", 0);
    const fracturedFollowup = healthLoss(beforeFollowup, fractured);

    let intact = readyState(makeCharacter(), [combatant({ sonicGuard: 5, health: 120, maxHealth: 120 })]);
    const intactBefore = structuredClone(intact);
    intact = use(intact, "bard-clarion-note", 0);
    expect(fracturedFollowup).toBeGreaterThan(healthLoss(intactBefore, intact));
  });

  it("applies audible ally performances only to living, conscious, hearing, minded recipients", () => {
    let state = readyState(makeCharacter(), [combatant()], {
      allies: [
        combatant({ id: "hearing", name: "Hearing Ally", health: 100, maxHealth: 100 }),
        combatant({ id: "deaf", name: "Deaf Ally", health: 100, maxHealth: 100, canHear: false, hearing: false, deaf: true }),
        combatant({ id: "unconscious", name: "Unconscious Ally", health: 100, maxHealth: 100, conscious: false, unconscious: true }),
        combatant({ id: "mindless", name: "Mindless Ally", health: 100, maxHealth: 100, demeanor: "mindless" }),
      ],
    });
    state = use(state, "bard-steady-beat", null);

    expect(statusOf(state.allies.find((ally) => ally.name === "Hearing Ally"), "bardSteadyBeat")).toBeTruthy();
    for (const name of ["Deaf Ally", "Unconscious Ally", "Mindless Ally"]) {
      expect(statusOf(state.allies.find((ally) => ally.name === name), "bardSteadyBeat"), name).toBeFalsy();
    }
  });

  it("requires hearing and semantic understanding for satire without charm, compulsion, or forced allegiance", () => {
    const cases = [
      ["eligible", {}, true],
      ["cannot hear", { canHear: false, hearing: false }, false],
      ["deaf status", { statuses: [{ type: "deaf", value: 1, duration: 3 }] }, false],
      ["cannot understand", { canUnderstand: false }, false],
      ["does not understand speech", { understandsSpeech: false }, false],
      ["has no language understanding", { languageUnderstanding: false }, false],
      ["cannot communicate", { canTalk: false }, false],
      ["mindless", { demeanor: "mindless" }, false],
    ];

    for (const [label, overrides, eligible] of cases) {
      let state = readyState(makeCharacter(), [combatant(overrides)]);
      state = use(state, "bard-pointed-satire", 0);
      expect(!!statusOf(state.enemies[0], "bardPointedSatire"), label).toBe(eligible);
      expect((state.enemies[0].statuses || []).some((status) =>
        ["charm", "charmed", "dominated", "geas", "enthralled"].includes(status.type)), label).toBe(false);
      expect(state.enemies[0].side, label).toBe("enemy");
      expect(state.enemies[0].resolved, label).toBeFalsy();
    }
  });

  it("uses native Bard buff and pressure statuses rather than caster or generic control effects", () => {
    let state = readyState();
    state = use(state, "bard-steady-beat", null);
    state = use(state, "bard-dissonant-chord", 0);
    state = use(state, "bard-pointed-satire", 0);

    expect(statusOf(state.player, "bardSteadyBeat")).toBeTruthy();
    expect(statusOf(state.enemies[0], "bardDissonance")).toBeTruthy();
    expect(statusOf(state.enemies[0], "bardPointedSatire")).toBeTruthy();
    for (const actor of [state.player, ...state.enemies]) {
      expect((actor.statuses || []).some((status) => GENERIC_SPELL_OR_CONTROL_STATUS.has(status.type))).toBe(false);
    }
  });

  it.each([
    ["bard-heartening-chorus", 3, "bardHearteningChorus"],
    ["bard-defiant-anthem", 2, "bardDefiantAnthem"],
    ["bard-old-ballad", 2, "bardOldBallad"],
  ])("%s restores only morale or native resistance, never health or Resolve", (abilityId, cost, statusType) => {
    let state = readyState(makeCharacter(), [combatant()], {
      allies: [combatant({ id: "ally", name: "Hearing Ally", health: 55, maxHealth: 100, resolve: 17, resolveMax: 50, morale: 40, moraleMax: 100 })],
    });
    state.player.health = Math.max(1, state.player.maxHealth - 25);
    state.player.resolve = 13;
    const playerBefore = { health: state.player.health, resolve: state.player.resolve };
    const allyBefore = { health: state.allies[0].health, resolve: state.allies[0].resolve, morale: state.allies[0].morale };
    state.player.bardCadence = cost;

    state = use(state, abilityId, null);

    expect(state.player.health).toBe(playerBefore.health);
    expect(state.player.resolve).toBe(playerBefore.resolve);
    expect(state.allies[0].health).toBe(allyBefore.health);
    expect(state.allies[0].resolve).toBe(allyBefore.resolve);
    expect(state.allies[0].morale > allyBefore.morale || !!statusOf(state.allies[0], statusType)).toBe(true);
    expect(statusOf(state.allies[0], "regen")).toBeFalsy();
  });

  it.each([
    ["bard-syncopated-break", "bardSyncopation"],
    ["bard-counter-melody", "bardCounterMelody"],
  ])("softens %s against boss scale and never turns it into a hard stun lock", (abilityId, statusType) => {
    const applyTo = (boss) => {
      let state = readyState(makeCharacter(), [combatant({ boss, health: 120, maxHealth: 120 })]);
      state.player.bardCadence = getAbilityDef(abilityId).bardCadenceCost;
      state = use(state, abilityId, 0);
      return state;
    };

    const ordinary = applyTo(false);
    let bossState = applyTo(true);
    const ordinaryStatus = statusOf(ordinary.enemies[0], statusType);
    const bossStatus = statusOf(bossState.enemies[0], statusType);
    expect(ordinaryStatus).toBeTruthy();
    expect(bossStatus).toBeTruthy();
    expect(bossStatus.value).toBeLessThan(ordinaryStatus.value);
    expect(bossStatus.value).toBeLessThanOrEqual(10);
    expect(bossStatus.duration).toBe(1);
    expect(statusOf(bossState.enemies[0], "stun")).toBeFalsy();

    const actionsBeforeRepeat = bossState.enemies[0].actionsLeft;
    bossState.player.bardCadence = getAbilityDef(abilityId).bardCadenceCost;
    bossState = use(bossState, abilityId, 0);
    expect(statusOf(bossState.enemies[0], "stun")).toBeFalsy();
    expect(statusOf(bossState.enemies[0], "bardActionInterrupted")).toBeFalsy();
    expect(bossState.enemies[0].actionsLeft).toBe(actionsBeforeRepeat);
  });

  it("uses the same motif alternation and one-time Cadence spend for NPC Bards", () => {
    const npc = combatant({
      name: "Enemy Bard",
      abilities: [
        { id: "bard-clarion-note", tier: "common" },
        { id: "bard-steady-beat", tier: "common" },
        { id: "bard-harmonic-weave", tier: "common" },
      ],
    });
    let state = readyState(makeCharacter({ professionId: "cleric", levels: 1 }), [npc]);
    expect(state.enemies[0]).toMatchObject({ bardCadence: 0, bardLastMotif: null });

    forceEnemyIntent(state, "bard-clarion-note");
    state = endPlayerTurn(state);
    expect(state.enemies[0]).toMatchObject({ bardCadence: 1, bardLastMotif: "voice" });

    forceEnemyIntent(state, "bard-steady-beat", "all-allies", null);
    state = endPlayerTurn(state);
    expect(state.enemies[0]).toMatchObject({ bardCadence: 2, bardLastMotif: "rhythm" });

    forceEnemyIntent(state, "bard-harmonic-weave", "aoe", null);
    state = endPlayerTurn(state);
    expect(state.enemies[0].bardCadence).toBe(0);
    expect(state.log.filter((entry) => entry.text?.includes("Enemy Bard spends 2 Cadence"))).toHaveLength(1);
  });

  it("has unforced AI choose useful support and semantic pressure, then an affordable sonic spender", () => {
    const actor = combatant({
      name: "Thinking Bard",
      health: 100,
      maxHealth: 100,
      bardCadence: 3,
      attrs: { presence: 24, wit: 20, reflex: 16 },
    });
    const target = combatant({ id: "target", health: 300, maxHealth: 300 });
    const candidate = (id) => ({ id, tier: "common", def: getAbilityDef(id) });

    const support = chooseAction(actor, [target], [
      candidate("bard-heartening-chorus"),
      candidate("bard-clarion-note"),
    ], {
      allies: [actor, combatant({ id: "ally", morale: 35, moraleMax: 100, health: 100, maxHealth: 100 })],
    });
    expect(support.ability.id).toBe("bard-heartening-chorus");

    actor.bardCadence = 0;
    const pressure = chooseAction(actor, [target], [
      candidate("bard-pointed-satire"),
      candidate("bard-clarion-note"),
    ], { allies: [actor] });
    expect(pressure.ability.id).toBe("bard-pointed-satire");

    actor.bardCadence = 2;
    const spender = chooseAction(actor, [target, combatant({ id: "target-two", name: "Second Target", health: 300, maxHealth: 300 })], [
      candidate("bard-clarion-note"),
      candidate("bard-crescendo"),
    ], { allies: [actor] });
    expect(spender.ability.id).toBe("bard-crescendo");
  });

  it("keeps ordinary attacks outside the Cadence economy", () => {
    let state = readyState();
    state = playerAct(state, BASIC_ATTACK.id, 0);
    expect(state.player).toMatchObject({ bardCadence: 0, bardLastMotif: null });
  });
});
