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

const ROGUE_ABILITY_IDS = [
  "rogue-assess-mark",
  "rogue-testing-cut",
  "rogue-slip-the-line",
  "rogue-false-opening",
  "rogue-exploit-guard",
  "rogue-sap-blow",
  "rogue-concealed-shift",
  "rogue-hamstring",
  "rogue-switchback-feint",
  "rogue-kidney-shot",
  "rogue-finishing-angle",
  "rogue-perfect-opportunity",
  "rogue-silent-entry",
  "rogue-brazen-feint",
  "rogue-killing-measure",
  "rogue-fault-finder",
  "rogue-high-window",
  "rogue-crowd-ghost",
  "rogue-confidence-play",
  "rogue-dirty-trick",
  "rogue-first-strike",
  "rogue-venom-work",
  "rogue-master-key",
  "rogue-planned-collapse",
];

const OPENING_BUILDERS = [
  "rogue-assess-mark",
  "rogue-testing-cut",
  "rogue-false-opening",
  "rogue-concealed-shift",
  "rogue-switchback-feint",
  "rogue-silent-entry",
  "rogue-brazen-feint",
  "rogue-killing-measure",
  "rogue-fault-finder",
];

const OPENING_EXPLOITS = [
  "rogue-exploit-guard",
  "rogue-sap-blow",
  "rogue-hamstring",
  "rogue-kidney-shot",
  "rogue-finishing-angle",
  "rogue-perfect-opportunity",
  "rogue-high-window",
  "rogue-crowd-ghost",
  "rogue-confidence-play",
  "rogue-dirty-trick",
  "rogue-first-strike",
  "rogue-venom-work",
  "rogue-master-key",
  "rogue-planned-collapse",
];

const GENERIC_HARD_CONTROL = new Set([
  "stun", "slow", "vulnerable", "weaken", "curse", "charmed", "dominated", "geas", "enthralled",
]);

function rogueTrack(levels = 70, branchChoices = {}) {
  return { professionId: "rogue", levels, branchChoices, choices: {} };
}

function makeCharacter({ levels = 70, branchChoices = {}, professionId = "rogue" } = {}) {
  const character = {
    id: "wanderer",
    name: "Rogue Tester",
    race: "human",
    weight: 66,
    attributes: { body: 16, reflex: 30, vigor: 18, mind: 12, wit: 30, presence: 24 },
    abilities: [],
    proficiencies: { daggers: 8, awareness: 8, spellcasting: 20 },
    conditions: [],
    progression: {
      version: 2,
      professions: professionId === "rogue"
        ? [rogueTrack(levels, branchChoices)]
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
    weapon: { name: "Knife", min: 3, max: 3, type: "physical", pen: 0, category: "dagger", reach: 1 },
    abilities: [],
    statuses: [],
    cooldowns: {},
    demeanor: "fanatic",
    morale: 100,
    moraleMax: 100,
    conscious: true,
    aware: true,
    canSee: true,
    canHear: true,
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
  state.player.weapon = { name: "Training Dagger", min: 20, max: 20, type: "physical", pen: 0, category: "dagger", reach: 1 };
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
    uid = `rogue-test-${abilityId}`;
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

function openingsOn(target, sourceUid = null) {
  return (target.statuses || []).filter((status) =>
    status.type === "rogueOpening" && (sourceUid == null || status.sourceUid === sourceUid));
}

function statusOf(actor, type) {
  return (actor.statuses || []).find((status) => status.type === type);
}

function forceEnemyIntents(state, enemyIndex, abilityIds, targetUid = "p") {
  const enemy = state.enemies[enemyIndex];
  const intents = abilityIds.map((abilityId, index) => {
    const def = getAbilityDef(abilityId);
    return {
      id: `forced-${enemyIndex}-${index}-${abilityId}`,
      abilityId,
      tier: "common",
      mode: def.target === "all-enemies" ? "aoe" : def.target === "all-allies" ? "all-allies" : def.target === "self" ? "self" : "single",
      targetUid: def.target === "enemy" ? targetUid : null,
      name: def.name,
      kind: def.dmg ? "attack" : "buff",
    };
  });
  enemy.intent = intents[0] || null;
  enemy.intents = intents;
  enemy.actionsPerTurn = Math.max(enemy.actionsPerTurn || 1, intents.length);
  enemy.actionsLeft = enemy.actionsPerTurn;
  return state;
}

function healthLoss(before, after, index = 0) {
  return before.enemies[index].health - after.enemies[index].health;
}

describe("Rogue physical subterfuge and owned Opportunity runtime", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it("authors the exact 9 builders, 14 exploits, and one neutral card as zero-Resolve nonspells", () => {
    expect(ROGUE_ABILITY_IDS).toHaveLength(24);
    for (const abilityId of ROGUE_ABILITY_IDS) {
      const def = getAbilityDef(abilityId);
      expect(def, abilityId).toMatchObject({
        professionId: "rogue",
        school: "subterfuge",
        progressionExclusive: true,
        resolveCost: 0,
      });
      expect(abilityCategoryOf(def), abilityId).not.toBe("spell");
      expect(def.innate, abilityId).not.toBe(true);
      expect([null, "physical"], abilityId).toContain(def.damageType ?? null);
      if (def.effect?.type) {
        expect(def.effect.type, abilityId).toMatch(/^rogue[A-Z]/);
        expect(GENERIC_HARD_CONTROL.has(def.effect.type), abilityId).toBe(false);
      }
      if (def.selfEffect?.type) expect(def.selfEffect.type, abilityId).toMatch(/^rogue[A-Z]/);
    }
    for (const abilityId of OPENING_BUILDERS) {
      expect(getAbilityDef(abilityId), abilityId).toMatchObject({
        target: "enemy",
        rogueOpeningBuild: true,
        rogueOpeningDuration: 2,
      });
      expect(getAbilityDef(abilityId).rogueOpeningExploit, abilityId).not.toBe(true);
    }
    for (const abilityId of OPENING_EXPLOITS) {
      expect(getAbilityDef(abilityId), abilityId).toMatchObject({
        target: "enemy",
        rogueOpeningExploit: true,
        rogueRequiresOpening: true,
      });
    }
    expect(getAbilityDef("rogue-slip-the-line")).toMatchObject({ target: "self" });
    expect(getAbilityDef("rogue-slip-the-line").rogueOpeningBuild).not.toBe(true);
    expect(getAbilityDef("rogue-slip-the-line").rogueOpeningExploit).not.toBe(true);
    expect(ROGUE_ABILITY_IDS.filter((abilityId) => getAbilityDef(abilityId).audible)).toEqual([
      "rogue-brazen-feint",
      "rogue-confidence-play",
    ]);
  });

  it("creates openings only after successful setup or contact and refreshes instead of stacking", () => {
    let blocked = readyState(makeCharacter(), [combatant({ lineOfSightBlocked: true })]);
    grantPlayer(blocked, "rogue-assess-mark");
    selectTarget(blocked, 0);
    expect(abilityUsable(blocked, "rogue-assess-mark")).toBe(false);
    blocked = playerAct(blocked, "rogue-assess-mark", 0);
    expect(openingsOn(blocked.enemies[0], "p")).toHaveLength(0);

    let missed = readyState();
    missed.player.accuracy = -1000;
    missed = use(missed, "rogue-testing-cut", 0);
    expect(openingsOn(missed.enemies[0], "p")).toHaveLength(0);

    let state = readyState();
    state = use(state, "rogue-assess-mark", 0);
    expect(openingsOn(state.enemies[0], "p")).toEqual([
      expect.objectContaining({ type: "rogueOpening", value: 1, duration: 2, sourceUid: "p" }),
    ]);
    openingsOn(state.enemies[0], "p")[0].duration = 1;
    state = use(state, "rogue-assess-mark", 0);
    expect(openingsOn(state.enemies[0], "p")).toEqual([
      expect.objectContaining({ value: 1, duration: 2, sourceUid: "p" }),
    ]);

    let noFault = readyState();
    grantPlayer(noFault, "rogue-fault-finder");
    selectTarget(noFault, 0);
    expect(abilityUsable(noFault, "rogue-fault-finder")).toBe(false);
    noFault.enemies[0].physicalFaultExposed = true;
    expect(abilityUsable(noFault, "rogue-fault-finder")).toBe(true);
    noFault = playerAct(noFault, "rogue-fault-finder", 0);
    expect(openingsOn(noFault.enemies[0], "p")).toHaveLength(1);
  });

  it("lets one Rogue maintain openings on multiple targets without transferring ownership", () => {
    let state = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
    state = use(state, "rogue-assess-mark", 0);
    state = use(state, "rogue-assess-mark", 1);
    expect(openingsOn(state.enemies[0], "p")).toHaveLength(1);
    expect(openingsOn(state.enemies[1], "p")).toHaveLength(1);

    grantPlayer(state, "rogue-exploit-guard");
    selectTarget(state, 1);
    state = playerAct(refresh(state, "rogue-exploit-guard"), "rogue-exploit-guard", 1);
    expect(openingsOn(state.enemies[0], "p")).toHaveLength(1);
    expect(openingsOn(state.enemies[1], "p")).toHaveLength(0);
  });

  it("keeps two Rogues' openings independent on the same target", () => {
    const rogueEnemy = (id, name) => combatant({
      id,
      name,
      abilities: [{ id: "rogue-assess-mark", tier: "common" }],
    });
    let state = readyState(makeCharacter({ professionId: "cleric", levels: 1 }), [
      rogueEnemy("one", "First Rogue"),
      rogueEnemy("two", "Second Rogue"),
    ]);
    forceEnemyIntents(state, 0, ["rogue-assess-mark"]);
    forceEnemyIntents(state, 1, ["rogue-assess-mark"]);
    state = endPlayerTurn(state);

    expect(openingsOn(state.player)).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceUid: "e0", value: 1 }),
      expect.objectContaining({ sourceUid: "e1", value: 1 }),
    ]));
    expect(openingsOn(state.player)).toHaveLength(2);
  });

  it("requires the exact actor-owned opening and consumes it at commit even when the exploit misses", () => {
    let state = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
    state.enemies[0].statuses.push({ type: "rogueOpening", value: 1, duration: 2, sourceUid: "other-rogue" });
    grantPlayer(state, "rogue-exploit-guard");
    selectTarget(state, 0);
    expect(abilityUsable(state, "rogue-exploit-guard")).toBe(false);

    state = use(state, "rogue-assess-mark", 0);
    expect(abilityUsable(refresh(state, "rogue-exploit-guard"), "rogue-exploit-guard")).toBe(true);
    state.player.accuracy = -1000;
    const targetHealth = state.enemies[0].health;
    state = playerAct(state, "rogue-exploit-guard", 0);

    expect(state.enemies[0].health).toBe(targetHealth);
    expect(openingsOn(state.enemies[0], "p")).toHaveLength(0);
    expect(openingsOn(state.enemies[0], "other-rogue")).toHaveLength(1);
    expect(state.log.filter((entry) => /commits .*Opportunity Window/i.test(entry.text || ""))).toHaveLength(1);

    state.enemies[1].statuses.push({ type: "rogueOpening", value: 1, duration: 2, sourceUid: "p" });
    selectTarget(state, 0);
    expect(abilityUsable(refresh(state, "rogue-exploit-guard"), "rogue-exploit-guard")).toBe(false);
  });

  it("consumes once for a three-hit exploit and once through the card path", () => {
    let multi = readyState();
    multi = use(multi, "rogue-assess-mark", 0);
    multi = use(multi, "rogue-perfect-opportunity", 0);
    expect(openingsOn(multi.enemies[0], "p")).toHaveLength(0);
    expect(multi.log.filter((entry) => entry.text?.includes("hits Training Foe for"))).toHaveLength(3);
    expect(multi.log.filter((entry) => /commits .*Opportunity Window/i.test(entry.text || ""))).toHaveLength(1);

    let cardState = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
    cardState.enemies[0].statuses.push({ type: "rogueOpening", value: 1, duration: 2, sourceUid: "p" });
    const forced = forceIntoHand(cardState, "rogue-exploit-guard");
    cardState = forced.state;
    expect(cardUsable(cardState, forced.uid, "e1")).toBe(false);
    expect(cardUsable(cardState, forced.uid, "e0")).toBe(true);
    cardState = playCard(cardState, forced.uid, "e0");
    expect(openingsOn(cardState.enemies[0], "p")).toHaveLength(0);
    expect(cardState.log.filter((entry) => /commits .*Opportunity Window/i.test(entry.text || ""))).toHaveLength(1);
  });

  it("uses the same successful setup and commit-time consumption for NPC Rogues", () => {
    const npc = combatant({
      name: "Enemy Rogue",
      accuracy: -1000,
      abilities: [
        { id: "rogue-assess-mark", tier: "common" },
        { id: "rogue-perfect-opportunity", tier: "common" },
      ],
    });
    let state = readyState(makeCharacter({ professionId: "cleric", levels: 1 }), [npc]);
    forceEnemyIntents(state, 0, ["rogue-assess-mark", "rogue-perfect-opportunity"]);
    const playerHealth = state.player.health;
    state = endPlayerTurn(state);

    expect(state.player.health).toBe(playerHealth);
    expect(openingsOn(state.player, "e0")).toHaveLength(0);
    expect(state.log.filter((entry) => /Enemy Rogue commits .*Opportunity Window/i.test(entry.text || ""))).toHaveLength(1);
  });

  it("expires openings through ordinary status turns and never creates one from basic or neutral actions", () => {
    let state = readyState();
    state = use(state, "rogue-assess-mark", 0);
    expect(openingsOn(state.enemies[0], "p")[0].duration).toBe(2);
    state = endPlayerTurn(state);
    expect(openingsOn(state.enemies[0], "p")[0]?.duration).toBe(1);
    state = endPlayerTurn(state);
    expect(openingsOn(state.enemies[0], "p")).toHaveLength(0);

    let unrelated = readyState();
    unrelated = playerAct(unrelated, BASIC_ATTACK.id, 0);
    expect(openingsOn(unrelated.enemies[0], "p")).toHaveLength(0);
    unrelated = use(unrelated, "rogue-slip-the-line", null);
    expect(openingsOn(unrelated.enemies[0], "p")).toHaveLength(0);
  });

  it("keeps nonverbal subterfuge outside antimagic, Resolve, spell focus, surge, and metamagic", () => {
    const damageWith = (configure = () => {}) => {
      let state = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
      state.player.resolve = 0;
      configure(state);
      grantPlayer(state, "rogue-testing-cut");
      const actionsBefore = state.player.actionsLeft;
      const before = structuredClone(state);
      expect(abilityUsable(state, "rogue-testing-cut")).toBe(true);
      state = playerAct(state, "rogue-testing-cut", 0);
      return { state, damage: healthLoss(before, state), actionsBefore };
    };

    const plain = damageWith();
    const altered = damageWith((state) => {
      state.player.statuses.push({ type: "antimagicField", value: 90, duration: 3 });
      state.player.spellSurge = true;
      state.player.signatureSpellIds = ["rogue-testing-cut"];
      state.player.metamagicIds = ["empowered-signature", "shaped-signature", "twinned-signature", "quickened-signature"];
      state.player.metamagicByAbilityId = {
        "rogue-testing-cut": ["empowered-signature", "shaped-signature", "twinned-signature", "quickened-signature"],
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
    grantPlayer(silenced, "rogue-testing-cut");
    grantPlayer(silenced, "rogue-brazen-feint");
    grantPlayer(silenced, "rogue-confidence-play");
    expect(abilityUsable(silenced, "rogue-testing-cut")).toBe(true);
    expect(abilityUsable(silenced, "rogue-brazen-feint")).toBe(false);
    expect(abilityUsable(silenced, "rogue-confidence-play")).toBe(false);
  });

  it("routes weapon subterfuge through ordinary armor, Block, and shield rather than magical ward", () => {
    const dealtTo = (overrides) => {
      let state = readyState(makeCharacter(), [combatant(overrides)]);
      const before = structuredClone(state);
      state = use(state, "rogue-testing-cut", 0);
      return healthLoss(before, state);
    };
    const baseline = dealtTo({});
    const pen = getAbilityDef("rogue-testing-cut").pen || 0;
    expect(baseline).toBeGreaterThan(0);
    expect(dealtTo({ ward: 500 })).toBe(baseline);
    expect(dealtTo({ armor: 10 })).toBe(Math.max(0, baseline - Math.max(0, 10 - pen)));
    expect(dealtTo({ block: 5, shield: 7 })).toBe(Math.max(0, baseline - 12));
  });

  it("uses bounded native soft pressure and weakens boss effects instead of hard-locking", () => {
    const applySap = (boss) => {
      let state = readyState(makeCharacter(), [combatant({ boss, health: 120, maxHealth: 120 })]);
      state = use(state, "rogue-assess-mark", 0);
      state = use(state, "rogue-sap-blow", 0);
      return state;
    };
    const ordinary = applySap(false);
    const boss = applySap(true);
    const ordinaryStatus = statusOf(ordinary.enemies[0], "rogueSapBlow");
    const bossStatus = statusOf(boss.enemies[0], "rogueSapBlow");
    expect(ordinaryStatus).toBeTruthy();
    expect(bossStatus).toBeTruthy();
    expect(bossStatus.duration).toBe(1);
    expect(bossStatus.value < ordinaryStatus.value || bossStatus.duration < ordinaryStatus.duration).toBe(true);

    for (const actor of [ordinary.enemies[0], boss.enemies[0]]) {
      expect((actor.statuses || []).some((status) => GENERIC_HARD_CONTROL.has(status.type))).toBe(false);
      expect(actor.actionsLeft).toBeGreaterThanOrEqual(0);
    }
  });

  it("requires aware understanding for Confidence Play and never charms, compels, or changes allegiance", () => {
    let eligible = readyState(makeCharacter(), [combatant({ health: 120, maxHealth: 120 })]);
    eligible = use(eligible, "rogue-assess-mark", 0);
    eligible = use(eligible, "rogue-confidence-play", 0);
    expect(statusOf(eligible.enemies[0], "rogueConfidencePlay")).toBeTruthy();
    expect(eligible.enemies[0].side).toBe("enemy");
    expect(eligible.enemies[0].resolved).toBeFalsy();
    expect((eligible.enemies[0].statuses || []).some((status) =>
      ["charmed", "dominated", "geas", "enthralled"].includes(status.type))).toBe(false);

    for (const overrides of [
      { aware: false },
      { canUnderstand: false },
      { understandsSpeech: false },
      { demeanor: "mindless" },
    ]) {
      let state = readyState(makeCharacter(), [combatant(overrides)]);
      state = use(state, "rogue-assess-mark", 0);
      grantPlayer(state, "rogue-confidence-play");
      selectTarget(state, 0);
      expect(abilityUsable(refresh(state, "rogue-confidence-play"), "rogue-confidence-play")).toBe(false);
      expect(openingsOn(state.enemies[0], "p")).toHaveLength(1);
    }
  });

  it("keeps concealment physical and never turns Concealed Shift or Crowd Ghost into invisibility", () => {
    let shifted = readyState();
    shifted.player.inCover = true;
    shifted = use(shifted, "rogue-concealed-shift", 0);
    expect(statusOf(shifted.enemies[0], "rogueConcealedShift")).toBeTruthy();
    expect(openingsOn(shifted.enemies[0], "p")).toHaveLength(1);

    let crowded = readyState();
    crowded.battle = { crowded: true };
    crowded = use(crowded, "rogue-assess-mark", 0);
    crowded = use(crowded, "rogue-crowd-ghost", 0);
    expect(statusOf(crowded.player, "rogueCrowdGhost")).toBeTruthy();

    for (const actor of [shifted.player, shifted.enemies[0], crowded.player, crowded.enemies[0]]) {
      expect((actor.statuses || []).some((status) => ["invisible", "greaterInvisibility"].includes(status.type))).toBe(false);
      expect(actor.greaterInvisibility || 0).toBe(0);
    }
  });

  it("keeps Venom Work, Master Key, and Planned Collapse bounded and wholly physical", () => {
    let venom = readyState(makeCharacter(), [combatant({ health: 120, maxHealth: 120 })]);
    venom = use(venom, "rogue-assess-mark", 0);
    venom = use(venom, "rogue-venom-work", 0);
    const venomStatus = statusOf(venom.enemies[0], "rogueVenomWork");
    expect(getAbilityDef("rogue-venom-work").roguePhysicalToxin).toBe(true);
    expect(venomStatus).toBeTruthy();
    expect(venomStatus.value).toBeLessThanOrEqual(30);
    expect(venomStatus.duration).toBeLessThanOrEqual(3);
    expect(venom.enemies[0].health).toBeGreaterThan(0);
    expect(statusOf(venom.enemies[0], "instantKill")).toBeFalsy();

    let key = readyState(makeCharacter(), [combatant({ equipmentAccessible: true, health: 120, maxHealth: 120 })]);
    key = use(key, "rogue-assess-mark", 0);
    key = use(key, "rogue-master-key", 0);
    const keyStatus = statusOf(key.enemies[0], "rogueMasterKey");
    expect(keyStatus).toEqual(expect.objectContaining({
      value: expect.any(Number),
      duration: expect.any(Number),
    }));
    expect(keyStatus.value).toBeLessThanOrEqual(30);
    expect(keyStatus.duration).toBeLessThanOrEqual(3);

    let collapse = readyState(makeCharacter(), [combatant({ structureAssessed: true, health: 120, maxHealth: 120 })]);
    collapse = use(collapse, "rogue-assess-mark", 0);
    collapse = use(collapse, "rogue-planned-collapse", 0);
    const collapseStatus = statusOf(collapse.enemies[0], "roguePlannedCollapse");
    expect(collapseStatus).toEqual(expect.objectContaining({
      value: expect.any(Number),
      duration: expect.any(Number),
    }));
    expect(collapseStatus.value).toBeLessThanOrEqual(30);
    expect(collapseStatus.duration).toBeLessThanOrEqual(3);
    expect((collapse.enemies[0].statuses || []).some((status) => GENERIC_HARD_CONTROL.has(status.type))).toBe(false);
    expect(collapse.enemies[0].health).toBe(120);
  });

  it("has unforced AI choose a setup before selecting an owned-opening exploit", () => {
    const actor = combatant({
      uid: "rogue-ai",
      name: "Thinking Rogue",
      attrs: { reflex: 24, wit: 24, presence: 18 },
      weapon: { name: "Dagger", min: 12, max: 12, type: "physical", pen: 0, category: "dagger", reach: 1 },
    });
    const target = combatant({ id: "target", uid: "target", health: 300, maxHealth: 300 });
    const candidate = (id) => ({ id, tier: "common", def: getAbilityDef(id) });

    const setup = chooseAction(actor, [target], [
      candidate("rogue-assess-mark"),
      candidate("rogue-testing-cut"),
      candidate("rogue-exploit-guard"),
    ], { allies: [actor] });
    expect(["rogue-assess-mark", "rogue-testing-cut"]).toContain(setup.ability.id);

    target.statuses.push({ type: "rogueOpening", value: 1, duration: 2, sourceUid: "rogue-ai" });
    const exploit = chooseAction(actor, [target], [
      candidate("rogue-testing-cut"),
      candidate("rogue-exploit-guard"),
    ], { allies: [actor] });
    expect(exploit.ability.id).toBe("rogue-exploit-guard");
    expect(abilityCategoryOf(exploit.def)).not.toBe("spell");
  });
});
