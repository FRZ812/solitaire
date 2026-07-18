import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { abilityCategoryOf, BASIC_ATTACK, getAbilityDef } from "../data/abilities.js";
import { cardDefinition } from "../data/combat-cards.js";
import { recomputeResolveMax, recomputeVitalityMax } from "./attributes.js";
import { chooseAction } from "./combat-ai.js";
import {
  abilityUsable,
  cardUsable,
  endPlayerTurn,
  initCombat,
  playCard,
  playerAct,
} from "./combat.js";

const CODEX = { characters: { wanderer: { id: "wanderer", worn: [] } }, items: {} };

const RANGER_ABILITY_IDS = [
  "ranger-quarry-sign",
  "ranger-ranging-shot",
  "ranger-field-dressing",
  "ranger-trail-cut",
  "ranger-pinpoint-volley",
  "ranger-evading-step",
  "ranger-crippling-shot",
  "ranger-pursuit-line",
  "ranger-covering-shot",
  "ranger-kill-window",
  "ranger-relentless-trail",
  "ranger-perfect-hunt",
  "ranger-patient-aim",
  "ranger-pathfinder-step",
  "ranger-companion-signal",
  "ranger-set-snare",
  "ranger-read-monster",
  "ranger-deadeye-breath",
  "ranger-safe-passage",
  "ranger-running-shot",
  "ranger-pack-command",
  "ranger-falcon-stoop",
  "ranger-layered-snare",
  "ranger-kill-zone",
];

const BUILDERS = new Map([
  ["ranger-quarry-sign", 2],
  ["ranger-ranging-shot", 1],
  ["ranger-trail-cut", 1],
  ["ranger-pursuit-line", 1],
  ["ranger-patient-aim", 1],
  ["ranger-pathfinder-step", 1],
  ["ranger-companion-signal", 1],
  ["ranger-set-snare", 1],
]);

const SPENDERS = new Map([
  ["ranger-pinpoint-volley", 2],
  ["ranger-crippling-shot", 2],
  ["ranger-covering-shot", 2],
  ["ranger-kill-window", 3],
  ["ranger-perfect-hunt", 5],
  ["ranger-read-monster", 2],
  ["ranger-deadeye-breath", 2],
  ["ranger-safe-passage", 2],
  ["ranger-running-shot", 2],
  ["ranger-pack-command", 2],
  ["ranger-falcon-stoop", 2],
  ["ranger-layered-snare", 2],
  ["ranger-kill-zone", 2],
]);

function rangerTrack(levels = 70, branchChoices = {}) {
  return { professionId: "ranger", levels, branchChoices, choices: {} };
}

function makeCharacter({ levels = 70, branchChoices = {}, professionId = "ranger" } = {}) {
  const character = {
    id: "wanderer",
    name: "Ranger Tester",
    race: "human",
    weight: 72,
    attributes: { body: 18, reflex: 30, vigor: 24, mind: 12, wit: 30, presence: 16 },
    abilities: [],
    proficiencies: { archery: 8, awareness: 8, spellcasting: 20 },
    conditions: [],
    progression: {
      version: 2,
      professions: professionId === "ranger"
        ? [rangerTrack(levels, branchChoices)]
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
    canSee: true,
    canHear: true,
    actionsPerTurn: 1,
    ...overrides,
  };
}

function trainedBeast(overrides = {}) {
  return combatant({
    id: "trained-beast",
    name: "Trained Hound",
    kind: "beast",
    race: "hound",
    beast: true,
    animal: true,
    trained: true,
    trainedBeast: true,
    mundane: true,
    summoned: false,
    magical: false,
    health: 100,
    maxHealth: 100,
    morale: 100,
    moraleMax: 100,
    ...overrides,
  });
}

function readyState(character = makeCharacter(), enemies = [combatant()], opts = {}) {
  const state = initCombat(character, CODEX, enemies, { seed: 42, ...opts });
  state.player.weapon = { name: "Training Bow", min: 20, max: 20, type: "physical", pen: 0, category: "bow", range: 5 };
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

function selectTarget(state, targetIndex) {
  if (targetIndex == null) return state;
  state.target = targetIndex;
  state.targetUid = state.enemies[targetIndex]?.uid || null;
  return state;
}

function use(state, abilityId, targetIndex = undefined, tier = "common") {
  grantPlayer(state, abilityId, tier);
  refresh(state, abilityId);
  const def = getAbilityDef(abilityId);
  const index = targetIndex === undefined ? (def.target === "enemy" ? 0 : null) : targetIndex;
  selectTarget(state, index);
  return playerAct(state, abilityId, index);
}

function forceIntoHand(state0, abilityId) {
  const state = structuredClone(state0);
  grantPlayer(state, abilityId);
  let uid = Object.keys(state.deck.cards).find((cardUid) => state.deck.cards[cardUid].abilityId === abilityId);
  if (!uid) {
    uid = `ranger-test-${abilityId}`;
    state.deck.cards[uid] = { uid, ...cardDefinition(abilityId, "common") };
  }
  for (const pile of ["draw", "hand", "discard", "exhaust"]) {
    state.deck[pile] = state.deck[pile].filter((cardUid) => cardUid !== uid);
  }
  state.deck.hand.unshift(uid);
  state.phase = "player";
  state.player.energy = 3;
  state.player.actionsLeft = 3;
  return { state, uid };
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
    targetUid: targetMode === "single" ? targetUid : null,
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

describe("Ranger mundane fieldcraft and Quarry Insight runtime", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it("authors exactly the locked builder, spender, and neutral Quarry metadata", () => {
    for (const abilityId of RANGER_ABILITY_IDS) {
      const def = getAbilityDef(abilityId);
      expect(def, abilityId).toMatchObject({
        professionId: "ranger",
        school: "fieldcraft",
        progressionExclusive: true,
        resolveCost: 0,
      });
      expect(abilityCategoryOf(def), abilityId).not.toBe("spell");
      expect(def.innate, abilityId).not.toBe(true);
    }
    for (const [abilityId, amount] of BUILDERS) {
      expect(getAbilityDef(abilityId).rangerQuarryInsightBuild, abilityId).toBe(amount);
      expect(getAbilityDef(abilityId).rangerRequiresCurrentQuarry, abilityId).not.toBe(true);
    }
    for (const [abilityId, amount] of SPENDERS) {
      expect(getAbilityDef(abilityId), abilityId).toMatchObject({
        rangerQuarryInsightCost: amount,
        rangerRequiresCurrentQuarry: true,
      });
    }
    for (const abilityId of ["ranger-field-dressing", "ranger-evading-step"]) {
      expect(getAbilityDef(abilityId).rangerQuarryInsightBuild || 0, abilityId).toBe(0);
      expect(getAbilityDef(abilityId).rangerQuarryInsightCost || 0, abilityId).toBe(0);
    }
    expect(getAbilityDef("ranger-relentless-trail")).toMatchObject({ rangerRequiresCurrentQuarry: true });
  });

  it("resets Quarry Insight, caps it at five, and binds successful builders to one quarry", () => {
    const character = makeCharacter();
    character.rangerQuarryInsight = 5;
    character.rangerQuarryUid = "old-target";
    let state = readyState(character, [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
    expect(state.player).toMatchObject({ rangerQuarryInsight: 0, rangerQuarryUid: null });

    state = use(state, "ranger-quarry-sign", 0);
    expect(state.player).toMatchObject({ rangerQuarryInsight: 2, rangerQuarryUid: "e0" });

    for (let expected = 3; expected <= 5; expected += 1) {
      state = use(state, "ranger-ranging-shot", 0);
      expect(state.player.rangerQuarryInsight).toBe(expected);
      expect(state.player.rangerQuarryUid).toBe("e0");
    }
    state = use(state, "ranger-ranging-shot", 0);
    expect(state.player.rangerQuarryInsight).toBe(5);

    state = use(state, "ranger-ranging-shot", 1);
    expect(state.player).toMatchObject({ rangerQuarryInsight: 1, rangerQuarryUid: "e1" });
  });

  it("builds only after a successful setup or hit and never from a miss", () => {
    let missed = readyState();
    missed.player.accuracy = -1000;
    missed = use(missed, "ranger-ranging-shot", 0);
    expect(missed.player).toMatchObject({ rangerQuarryInsight: 0, rangerQuarryUid: null });

    let hit = readyState();
    hit = use(hit, "ranger-ranging-shot", 0);
    expect(hit.player).toMatchObject({ rangerQuarryInsight: 1, rangerQuarryUid: "e0" });

    let setup = readyState();
    setup = use(setup, "ranger-quarry-sign", 0);
    expect(setup.player).toMatchObject({ rangerQuarryInsight: 2, rangerQuarryUid: "e0" });
  });

  it("requires the selected live quarry and spends the exact cost once for direct and multi-hit actions", () => {
    let state = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
    grantPlayer(state, "ranger-crippling-shot");
    state.player.rangerQuarryInsight = 2;
    state.player.rangerQuarryUid = "e0";

    selectTarget(state, 1);
    expect(abilityUsable(state, "ranger-crippling-shot")).toBe(false);
    selectTarget(state, 0);
    expect(abilityUsable(state, "ranger-crippling-shot")).toBe(true);
    state = use(state, "ranger-crippling-shot", 0);
    expect(state.player.rangerQuarryInsight).toBe(0);
    expect(state.log.filter((entry) => entry.text?.includes("spends 2 Quarry Insight"))).toHaveLength(1);

    let multi = readyState();
    multi.player.rangerQuarryInsight = 2;
    multi.player.rangerQuarryUid = "e0";
    multi = use(multi, "ranger-pinpoint-volley", 0);
    expect(multi.player.rangerQuarryInsight).toBe(0);
    expect(multi.log.filter((entry) => entry.text?.includes("spends 2 Quarry Insight"))).toHaveLength(1);
    expect(multi.log.filter((entry) => entry.text?.includes("hits Training Foe for"))).toHaveLength(3);

    const dead = readyState();
    grantPlayer(dead, "ranger-crippling-shot");
    dead.player.rangerQuarryInsight = 5;
    dead.player.rangerQuarryUid = "e0";
    dead.enemies[0].health = 0;
    expect(abilityUsable(dead, "ranger-crippling-shot")).toBe(false);
  });

  it("spends Quarry Insight exactly once through the card execution path", () => {
    let state = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
    state.player.rangerQuarryInsight = 2;
    state.player.rangerQuarryUid = "e0";
    const forced = forceIntoHand(state, "ranger-crippling-shot");
    state = forced.state;
    selectTarget(state, 0);

    expect(cardUsable(state, forced.uid, "e1")).toBe(false);
    expect(cardUsable(state, forced.uid, "e0")).toBe(true);
    state = playCard(state, forced.uid, "e0");

    expect(state.player.rangerQuarryInsight).toBe(0);
    expect(state.log.filter((entry) => entry.text?.includes("spends 2 Quarry Insight"))).toHaveLength(1);
    expect(state.deck.hand).not.toContain(forced.uid);
    expect([...state.deck.discard, ...state.deck.exhaust]).toContain(forced.uid);
  });

  it("uses the same quarry binding, gain, and one-time spend rules for NPC Rangers", () => {
    const npc = combatant({
      name: "Enemy Ranger",
      accuracy: 1000,
      weapon: { name: "Hunting Bow", min: 8, max: 8, type: "physical", pen: 0, category: "bow", range: 5 },
      abilities: [
        { id: "ranger-quarry-sign", tier: "common" },
        { id: "ranger-crippling-shot", tier: "common" },
      ],
    });
    let state = readyState(makeCharacter({ professionId: "cleric", levels: 1 }), [npc]);
    expect(state.enemies[0]).toMatchObject({ rangerQuarryInsight: 0, rangerQuarryUid: null });

    forceEnemyIntent(state, "ranger-quarry-sign");
    state = endPlayerTurn(state);
    expect(state.enemies[0]).toMatchObject({ rangerQuarryInsight: 2, rangerQuarryUid: "p" });

    forceEnemyIntent(state, "ranger-crippling-shot");
    state = endPlayerTurn(state);
    expect(state.enemies[0].rangerQuarryInsight).toBe(0);
    expect(state.log.filter((entry) => entry.text?.includes("Enemy Ranger spends 2 Quarry Insight"))).toHaveLength(1);
  });

  it("keeps non-audible fieldcraft outside antimagic, silence, Resolve, spell focus, surge, and metamagic", () => {
    const damageWith = (configure = () => {}) => {
      let state = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
      state.player.resolve = 0;
      configure(state);
      grantPlayer(state, "ranger-ranging-shot");
      const actionsBefore = state.player.actionsLeft;
      const before = structuredClone(state);
      expect(abilityUsable(state, "ranger-ranging-shot")).toBe(true);
      state = playerAct(state, "ranger-ranging-shot", 0);
      return { state, damage: healthLoss(before, state), actionsBefore };
    };

    const plain = damageWith();
    const altered = damageWith((state) => {
      state.player.statuses.push({ type: "antimagicField", value: 90, duration: 3 });
      state.player.spellSurge = true;
      state.player.signatureSpellIds = ["ranger-ranging-shot"];
      state.player.metamagicIds = ["empowered-signature", "shaped-signature", "twinned-signature", "quickened-signature"];
      state.player.metamagicByAbilityId = {
        "ranger-ranging-shot": ["empowered-signature", "shaped-signature", "twinned-signature", "quickened-signature"],
      };
      state.player.prof = { ...(state.player.prof || {}), spellcasting: 100 };
      state.player.weapon.spellFocus = 100;
      state.player.weapon.focusPower = 100;
    });

    expect(altered.damage).toBe(plain.damage);
    expect(altered.state.player.actionsLeft).toBe(altered.actionsBefore - 1);
    expect(altered.state.player.resolve).toBe(0);
    expect(altered.state.magicCast).not.toBe(true);
    expect(altered.state.enemies[1].health).toBe(altered.state.enemies[1].maxHealth);

    const silenced = readyState();
    silenced.player.statuses.push({ type: "silence", value: 1, duration: 2 });
    grantPlayer(silenced, "ranger-ranging-shot");
    expect(getAbilityDef("ranger-ranging-shot").audible).not.toBe(true);
    expect(abilityUsable(silenced, "ranger-ranging-shot")).toBe(true);

    silenced.player.rangerQuarryInsight = 0;
    silenced.player.rangerQuarryUid = "e0";
    grantPlayer(silenced, "ranger-companion-signal");
    expect(getAbilityDef("ranger-companion-signal").audible).toBe(true);
    expect(abilityUsable(silenced, "ranger-companion-signal")).toBe(false);
  });

  it("uses ordinary physical mitigation for fieldcraft shots while magical ward is irrelevant", () => {
    const dealtTo = (overrides) => {
      let state = readyState(makeCharacter(), [combatant(overrides)]);
      const before = structuredClone(state);
      state = use(state, "ranger-ranging-shot", 0);
      return healthLoss(before, state);
    };
    const baseline = dealtTo({});
    const rangingPen = getAbilityDef("ranger-ranging-shot").pen || 0;
    expect(baseline).toBeGreaterThan(0);
    expect(dealtTo({ ward: 500 })).toBe(baseline);
    expect(dealtTo({ armor: 10 })).toBe(Math.max(0, baseline - Math.max(0, 10 - rangingPen)));
    expect(dealtTo({ block: 5, shield: 7 })).toBe(Math.max(0, baseline - 12));
  });

  it("uses bounded native trap, terrain, and quarry pressure instead of generic hard control", () => {
    const applySnare = (boss) => {
      let state = readyState(makeCharacter(), [combatant({ boss, health: 120, maxHealth: 120 })]);
      state = use(state, "ranger-quarry-sign", 0);
      state = use(state, "ranger-set-snare", 0);
      return state;
    };
    const ordinary = applySnare(false);
    const boss = applySnare(true);
    const ordinarySnare = statusOf(ordinary.enemies[0], "rangerSetSnare");
    const bossSnare = statusOf(boss.enemies[0], "rangerSetSnare");
    expect(ordinarySnare).toBeTruthy();
    expect(bossSnare).toBeTruthy();
    expect(bossSnare.duration).toBe(1);
    expect(bossSnare.value < ordinarySnare.value || bossSnare.duration < ordinarySnare.duration).toBe(true);
    expect(boss.player.rangerQuarryInsight).toBe(3);

    let terrain = readyState();
    terrain = use(terrain, "ranger-trail-cut", 0);
    expect(statusOf(terrain.enemies[0], "rangerTrailCut")).toBeTruthy();
    expect(terrain.player).toMatchObject({ rangerQuarryInsight: 1, rangerQuarryUid: "e0" });

    let layered = readyState(makeCharacter(), [combatant({ boss: true, health: 120, maxHealth: 120 })]);
    layered.player.rangerQuarryInsight = 2;
    layered.player.rangerQuarryUid = "e0";
    layered = use(layered, "ranger-layered-snare", 0);
    expect(statusOf(layered.enemies[0], "rangerLayeredSnare")).toBeTruthy();

    for (const actor of [boss.enemies[0], layered.enemies[0]]) {
      expect((actor.statuses || []).some((status) => ["stun", "slow", "charmed", "dominated", "vulnerable"].includes(status.type))).toBe(false);
      expect(actor.actionsLeft).toBeGreaterThanOrEqual(0);
    }
  });

  it("makes Field Dressing mundane stabilization and morale support, never magical HP or Resolve restoration", () => {
    let state = readyState(makeCharacter(), [combatant()], {
      allies: [combatant({
        id: "ally",
        name: "Wounded Ally",
        health: 35,
        maxHealth: 100,
        resolve: 11,
        resolveMax: 50,
        morale: 25,
        moraleMax: 100,
        statuses: [{ type: "bleed", value: 3, duration: 3 }],
      })],
    });
    state.player.health = Math.max(1, state.player.maxHealth - 20);
    state.player.resolve = 13;
    const playerBefore = { health: state.player.health, resolve: state.player.resolve };
    const allyBefore = { health: state.allies[0].health, resolve: state.allies[0].resolve, morale: state.allies[0].morale };

    state = use(state, "ranger-field-dressing", null);

    expect(state.player.health).toBe(playerBefore.health);
    expect(state.player.resolve).toBe(playerBefore.resolve);
    expect(state.allies[0].health).toBe(allyBefore.health);
    expect(state.allies[0].resolve).toBe(allyBefore.resolve);
    expect(state.allies[0].morale > allyBefore.morale || !!statusOf(state.allies[0], "rangerFieldDressing")).toBe(true);
    expect(statusOf(state.allies[0], "regen")).toBeFalsy();
    expect(state.magicCast).not.toBe(true);
  });

  it("rejects animal commands without an eligible conscious mundane trained beast and never summons one", () => {
    const prepare = (allies) => {
      const state = readyState(makeCharacter(), [combatant()], { allies });
      state.player.rangerQuarryInsight = 2;
      state.player.rangerQuarryUid = "e0";
      grantPlayer(state, "ranger-companion-signal");
      grantPlayer(state, "ranger-pack-command");
      grantPlayer(state, "ranger-falcon-stoop");
      selectTarget(state, 0);
      return state;
    };

    for (const allies of [
      [],
      [trainedBeast({ conscious: false, unconscious: true })],
      [trainedBeast({ summoned: true, magical: true, mundane: false })],
    ]) {
      const state = prepare(allies);
      expect(abilityUsable(state, "ranger-companion-signal")).toBe(false);
      expect(abilityUsable(state, "ranger-pack-command")).toBe(false);
    }

    let houndState = prepare([trainedBeast()]);
    expect(abilityUsable(houndState, "ranger-companion-signal")).toBe(true);
    const allyCount = houndState.allies.length;
    houndState.player.rangerQuarryInsight = 0;
    houndState = use(houndState, "ranger-companion-signal", 0);
    expect(houndState.player.rangerQuarryInsight).toBe(1);
    expect(houndState.allies).toHaveLength(allyCount);

    houndState.player.rangerQuarryInsight = 2;
    const targetHealth = houndState.enemies[0].health;
    houndState = use(houndState, "ranger-pack-command", 0);
    expect(houndState.player.rangerQuarryInsight).toBe(0);
    expect(houndState.enemies[0].health).toBeLessThan(targetHealth);
    expect(houndState.allies).toHaveLength(allyCount);

    const houndOnly = prepare([trainedBeast()]);
    expect(abilityUsable(houndOnly, "ranger-falcon-stoop")).toBe(false);
    const hawkState = prepare([trainedBeast({ name: "Trained Hawk", race: "hawk", flying: true })]);
    expect(abilityUsable(hawkState, "ranger-falcon-stoop")).toBe(true);
  });

  it("has unforced AI rank setup, quarry spenders, mundane support, and available beast commands", () => {
    const actor = combatant({
      name: "Thinking Ranger",
      attrs: { reflex: 24, wit: 24, vigor: 18 },
      weapon: { name: "Hunting Bow", min: 12, max: 12, type: "physical", pen: 0, category: "bow", range: 5 },
      rangerQuarryInsight: 0,
      rangerQuarryUid: null,
    });
    const target = combatant({ id: "target", uid: "target", health: 300, maxHealth: 300 });
    const candidate = (id) => ({ id, tier: "common", def: getAbilityDef(id) });

    const setup = chooseAction(actor, [target], [
      candidate("ranger-quarry-sign"),
      candidate("ranger-crippling-shot"),
      candidate("ranger-ranging-shot"),
    ], { allies: [actor] });
    expect(["ranger-quarry-sign", "ranger-ranging-shot"]).toContain(setup.ability.id);

    actor.rangerQuarryInsight = 2;
    actor.rangerQuarryUid = "target";
    const spender = chooseAction(actor, [target], [
      candidate("ranger-ranging-shot"),
      candidate("ranger-crippling-shot"),
    ], { allies: [actor] });
    expect(spender.ability.id).toBe("ranger-crippling-shot");

    actor.rangerQuarryInsight = 0;
    actor.rangerQuarryUid = null;
    const support = chooseAction(actor, [target], [
      candidate("ranger-field-dressing"),
      candidate("ranger-ranging-shot"),
    ], {
      allies: [actor, combatant({ id: "ally", health: 40, maxHealth: 100, morale: 25, moraleMax: 100, statuses: [{ type: "bleed", value: 2, duration: 2 }] })],
    });
    expect(support.ability.id).toBe("ranger-field-dressing");

    actor.rangerQuarryInsight = 2;
    actor.rangerQuarryUid = "target";
    const beast = trainedBeast({ uid: "beast" });
    const command = chooseAction(actor, [target], [
      candidate("ranger-pack-command"),
      candidate("ranger-ranging-shot"),
    ], { allies: [actor, beast] });
    expect(command.ability.id).toBe("ranger-pack-command");
    expect(abilityCategoryOf(command.def)).not.toBe("spell");
  });

  it("does not generate Quarry Insight from ordinary attacks or unrelated actions", () => {
    let state = readyState();
    state = playerAct(state, BASIC_ATTACK.id, 0);
    expect(state.player).toMatchObject({ rangerQuarryInsight: 0, rangerQuarryUid: null });
  });
});
