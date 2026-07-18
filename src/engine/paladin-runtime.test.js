import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { abilityCategoryOf, BASIC_ATTACK, DEFEND, getAbilityDef } from "../data/abilities.js";
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

const PALADIN_ABILITY_IDS = [
  "paladin-oathguard",
  "paladin-vowed-strike",
  "paladin-stand-fast",
  "paladin-challenge-of-witness",
  "paladin-bear-the-blow",
  "paladin-steadfast-word",
  "paladin-judgment-stroke",
  "paladin-hold-the-line",
  "paladin-merciful-arrest",
  "paladin-oathfire-edge",
  "paladin-last-witness",
  "paladin-oath-incarnate",
  "paladin-shield-covenant",
  "paladin-call-to-account",
  "paladin-offer-quarter",
  "paladin-beacon-stance",
  "paladin-rampart-exchange",
  "paladin-threshold-blow",
  "paladin-verdict-edge",
  "paladin-peace-command",
  "paladin-redeeming-intercession",
  "paladin-burden-taken",
  "paladin-sunward-cut",
  "paladin-pilgrim-aegis",
];

const CONVICTION_COSTS = new Map([
  ["paladin-bear-the-blow", 1],
  ["paladin-judgment-stroke", 2],
  ["paladin-hold-the-line", 2],
  ["paladin-merciful-arrest", 2],
  ["paladin-oathfire-edge", 3],
  ["paladin-last-witness", 4],
  ["paladin-oath-incarnate", 5],
  ["paladin-rampart-exchange", 2],
  ["paladin-threshold-blow", 1],
  ["paladin-verdict-edge", 2],
  ["paladin-peace-command", 1],
  ["paladin-redeeming-intercession", 2],
  ["paladin-burden-taken", 1],
  ["paladin-sunward-cut", 2],
  ["paladin-pilgrim-aegis", 2],
]);

const AUDIBLE_IDS = [
  "paladin-challenge-of-witness",
  "paladin-steadfast-word",
  "paladin-call-to-account",
  "paladin-offer-quarter",
  "paladin-peace-command",
];

function paladinTrack(levels = 70, branchChoices = {}) {
  return { professionId: "paladin", levels, branchChoices, choices: {} };
}

function makeCharacter({ levels = 70, branchChoices = {}, professionId = "paladin" } = {}) {
  const character = {
    id: "wanderer",
    name: "Paladin Tester",
    race: "human",
    weight: 88,
    attributes: { body: 30, reflex: 16, vigor: 30, mind: 12, wit: 18, presence: 30 },
    abilities: [],
    proficiencies: { swords: 8, awareness: 6, spellcasting: 20 },
    conditions: [],
    progression: {
      version: 2,
      professions: professionId === "paladin"
        ? [paladinTrack(levels, branchChoices)]
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
    weapon: { name: "Club", min: 30, max: 30, type: "physical", pen: 0, category: "mace", reach: 1 },
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
    hearing: true,
    canUnderstand: true,
    understandsSpeech: true,
    languageUnderstanding: true,
    canTalk: true,
    actionsPerTurn: 1,
    ...overrides,
  };
}

function paladinAlly(overrides = {}) {
  return combatant({
    id: "paladin-ally",
    name: "Allied Paladin",
    professionId: "paladin",
    health: 300,
    maxHealth: 300,
    weapon: { name: "Arming Sword", min: 5, max: 5, type: "physical", pen: 0, category: "sword", reach: 1 },
    abilities: [{ id: "paladin-vowed-strike", tier: "common" }],
    ...overrides,
  });
}

function readyState(character = makeCharacter(), enemies = [combatant()], opts = {}) {
  const state = initCombat(character, CODEX, enemies, { seed: 42, ...opts });
  state.player.weapon = { name: "Training Sword", min: 20, max: 20, type: "physical", pen: 0, category: "sword", reach: 1 };
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
    uid = `paladin-test-${abilityId}`;
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

function statusOf(actor, type, sourceUid = null) {
  return (actor.statuses || []).find((status) =>
    status.type === type && (sourceUid == null || status.sourceUid === sourceUid));
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
      kind: def.dmg || def.scaling === "weapon" ? "attack" : "buff",
    };
  });
  enemy.intent = intents[0] || null;
  enemy.intents = intents;
  enemy.actionsPerTurn = Math.max(enemy.actionsPerTurn || 1, intents.length);
  enemy.actionsLeft = enemy.actionsPerTurn;
  return state;
}

function forceBasicAttack(state, enemyIndex = 0, targetUid = "p") {
  return forceEnemyIntents(state, enemyIndex, [BASIC_ATTACK.id], targetUid);
}

function healthLoss(before, after, index = 0) {
  return before.enemies[index].health - after.enemies[index].health;
}

describe("Paladin physical oathcraft, Oathguard, and Conviction runtime", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it("keeps all 24 cards zero-Resolve nonspell oathcraft with no foreign resource or forbidden outcome", () => {
    expect(PALADIN_ABILITY_IDS).toHaveLength(24);
    const foreignResource = /^(?:warriorTempo|monkPosture|barbarianFury|bardCadence|rangerQuarry|rogueOpening|metamagic)/;
    for (const abilityId of PALADIN_ABILITY_IDS) {
      const def = getAbilityDef(abilityId);
      expect(def, abilityId).toMatchObject({
        professionId: "paladin",
        school: "oathcraft",
        progressionExclusive: true,
        resolveCost: 0,
        paladinConvictionMax: 5,
      });
      expect(abilityCategoryOf(def), abilityId).toBe("oathcraft");
      expect([null, "physical"], abilityId).toContain(def.damageType ?? null);
      expect(Object.keys(def).filter((key) => foreignResource.test(key)), abilityId).toEqual([]);
      expect(def.damageType, abilityId).not.toBe("true");
      expect(def.effect?.type || "", abilityId).not.toMatch(/heal|regen|invuln|stun|charm|dominat|compuls|allegiance|instantKill/i);
      expect(Object.keys(def.effect || {}), abilityId).not.toEqual(expect.arrayContaining([
        "heal", "healing", "regen", "invulnerable", "charm", "compulsion", "allegiance",
      ]));
      const cost = CONVICTION_COSTS.get(abilityId) || 0;
      expect(def.paladinConvictionCost || 0, abilityId).toBe(cost);
    }
    expect(PALADIN_ABILITY_IDS.filter((abilityId) => getAbilityDef(abilityId).audible)).toEqual(AUDIBLE_IDS);
  });

  it("resets Conviction between fights and never grants it merely for playing Oathguard or Stand Fast", () => {
    const character = makeCharacter();
    character.paladinConviction = 5;
    let state = readyState(character, [combatant()], { allies: [paladinAlly({ paladinConviction: 5 })] });
    expect(state.player.paladinConviction).toBe(0);
    expect(state.allies[0].paladinConviction).toBe(0);
    expect(state.enemies[0].paladinConviction).toBe(0);

    state = use(state, "paladin-oathguard", null);
    expect(state.player.paladinConviction).toBe(0);
    state = use(state, "paladin-stand-fast", null);
    expect(state.player.paladinConviction).toBe(0);
  });

  it("redirects only actual post-mitigation ally damage within share/cap and earns one Conviction", () => {
    const ally = combatant({ id: "ally", name: "Guarded Ally", health: 200, maxHealth: 200, armor: 5, block: 7, shield: 9 });
    const attacker = combatant({ weapon: { name: "Maul", min: 60, max: 60, type: "physical", pen: 0, category: "mace", reach: 1 } });

    let baseline = readyState(makeCharacter(), [attacker], { allies: [ally] });
    const baselineAllyHealth = baseline.allies[0].health;
    forceBasicAttack(baseline, 0, "a0");
    baseline = endPlayerTurn(baseline);
    const postMitigation = baselineAllyHealth - baseline.allies[0].health;
    expect(postMitigation).toBeGreaterThan(0);

    let guarded = readyState(makeCharacter(), [attacker], { allies: [ally] });
    guarded = use(guarded, "paladin-oathguard", null);
    expect(statusOf(guarded.allies[0], "paladinOathguard", "p")).toEqual(expect.objectContaining({
      value: 30,
      cap: 0.15,
      sourceUid: "p",
    }));
    const allyBefore = guarded.allies[0].health;
    const paladinBefore = guarded.player.health;
    forceBasicAttack(guarded, 0, "a0");
    guarded = endPlayerTurn(guarded);

    const allyLoss = allyBefore - guarded.allies[0].health;
    const paladinLoss = paladinBefore - guarded.player.health;
    expect(allyLoss + paladinLoss).toBe(postMitigation);
    expect(paladinLoss).toBeGreaterThan(0);
    expect(paladinLoss).toBeLessThanOrEqual(Math.round(guarded.player.maxHealth * 0.15));
    expect(paladinLoss).toBeLessThanOrEqual(Math.round(postMitigation * 0.30));
    expect(guarded.player.paladinConviction).toBe(1);
    expect(guarded.player.health).toBeLessThan(paladinBefore);
    expect(guarded.allies[0].health).toBeLessThan(allyBefore);
  });

  it("excludes self, dead or opposing protectors and never recurses through another Oathguard", () => {
    let self = readyState();
    self.player.statuses.push({ type: "paladinOathguard", value: 65, cap: 0.25, duration: 3, sourceUid: "p" });
    const selfHealth = self.player.health;
    forceBasicAttack(self);
    self = endPlayerTurn(self);
    expect(self.player.health).toBeLessThan(selfHealth);
    expect(self.player.paladinConviction).toBe(0);

    let deadSource = readyState(makeCharacter(), [combatant()], {
      allies: [
        paladinAlly({ id: "fallen-paladin", name: "Fallen Paladin" }),
        combatant({ id: "ward", name: "Ward", health: 200, maxHealth: 200 }),
      ],
    });
    deadSource.allies[0].health = 0;
    deadSource.allies[1].statuses.push({ type: "paladinOathguard", value: 65, cap: 0.25, duration: 3, sourceUid: "a0" });
    const wardBefore = deadSource.allies[1].health;
    forceBasicAttack(deadSource, 0, "a1");
    deadSource = endPlayerTurn(deadSource);
    expect(deadSource.allies[1].health).toBeLessThan(wardBefore);
    expect(deadSource.allies[0].paladinConviction).toBe(0);

    let opposingSource = readyState(makeCharacter(), [
      paladinAlly({ id: "enemy-paladin", name: "Enemy Paladin" }),
      combatant({ id: "striker", name: "Enemy Striker" }),
    ], { allies: [combatant({ id: "ward", name: "Ward", health: 200, maxHealth: 200 })] });
    opposingSource.allies[0].statuses.push({ type: "paladinOathguard", value: 65, cap: 0.25, duration: 3, sourceUid: "e0" });
    const opposingWardBefore = opposingSource.allies[0].health;
    forceEnemyIntents(opposingSource, 0, [DEFEND.id], null);
    forceBasicAttack(opposingSource, 1, "a0");
    opposingSource = endPlayerTurn(opposingSource);
    expect(opposingSource.allies[0].health).toBeLessThan(opposingWardBefore);
    expect(opposingSource.enemies[0].paladinConviction).toBe(0);

    let recursive = readyState(makeCharacter(), [combatant()], {
      allies: [paladinAlly({ id: "second-paladin", name: "Second Paladin" }), combatant({ id: "ward", name: "Ward", health: 200, maxHealth: 200 })],
    });
    recursive.allies[1].statuses.push({ type: "paladinOathguard", value: 40, cap: 0.18, duration: 3, sourceUid: "p" });
    recursive.player.statuses.push({ type: "paladinOathguard", value: 65, cap: 0.25, duration: 3, sourceUid: "a0" });
    const playerBefore = recursive.player.health;
    const secondBefore = recursive.allies[0].health;
    forceBasicAttack(recursive, 0, "a1");
    recursive = endPlayerTurn(recursive);
    expect(recursive.player.health).toBeLessThan(playerBefore);
    expect(recursive.allies[0].health).toBe(secondBefore);
    expect(recursive.player.paladinConviction).toBe(1);
    expect(recursive.allies[0].paladinConviction).toBe(0);
  });

  it("uses only the strongest eligible source-owned Oathguard link", () => {
    let state = readyState(makeCharacter(), [combatant()], {
      allies: [paladinAlly({ id: "strong", name: "Strong Protector" }), combatant({ id: "ward", name: "Ward", health: 200, maxHealth: 200 })],
    });
    state.allies[1].statuses.push(
      { type: "paladinOathguard", value: 30, cap: 0.15, duration: 3, sourceUid: "p" },
      { type: "paladinOathguard", value: 55, cap: 0.22, duration: 3, sourceUid: "a0" },
    );
    const playerBefore = state.player.health;
    const strongBefore = state.allies[0].health;
    forceBasicAttack(state, 0, "a1");
    state = endPlayerTurn(state);

    expect(state.player.health).toBe(playerBefore);
    expect(state.allies[0].health).toBeLessThan(strongBefore);
    expect(state.player.paladinConviction).toBe(0);
    expect(state.allies[0].paladinConviction).toBe(1);
  });

  it("earns Conviction only from real Oathguard redirection, never misses, full absorption, or unrelated guard", () => {
    let missed = readyState(makeCharacter(), [combatant({ accuracy: -1000 })], {
      allies: [combatant({ id: "ally", name: "Guarded Ally", health: 200, maxHealth: 200 })],
    });
    missed = use(missed, "paladin-oathguard", null);
    forceBasicAttack(missed, 0, "a0");
    missed = endPlayerTurn(missed);
    expect(missed.player.paladinConviction).toBe(0);

    let absorbed = readyState(makeCharacter(), [combatant()], {
      allies: [combatant({ id: "ally", name: "Shielded Ally", health: 200, maxHealth: 200 })],
    });
    absorbed = use(absorbed, "paladin-oathguard", null);
    // initCombat deliberately clears imported tactical defenses, and allied
    // Block expires when that ally takes their autonomous turn before foes.
    // A live physical shield therefore provides the stable full-absorption case.
    absorbed.allies[0].shield = 500;
    forceBasicAttack(absorbed, 0, "a0");
    absorbed = endPlayerTurn(absorbed);
    expect(absorbed.player.paladinConviction).toBe(0);

    let unrelated = readyState();
    unrelated = playerAct(unrelated, DEFEND.id, null);
    expect(unrelated.player.block).toBeGreaterThan(0);
    forceBasicAttack(unrelated);
    unrelated = endPlayerTurn(unrelated);
    expect(unrelated.player.paladinConviction).toBe(0);
  });

  it("earns at most one Conviction per hostile action/source and caps at five", () => {
    const attacker = combatant({
      weapon: { name: "Twin Clubs", min: 30, max: 30, type: "physical", pen: 0, category: "mace", reach: 1 },
      abilities: [{ id: "cleave", tier: "common" }],
    });
    let state = readyState(makeCharacter(), [attacker], {
      allies: [
        combatant({ id: "one", name: "First Ward", health: 300, maxHealth: 300 }),
        combatant({ id: "two", name: "Second Ward", health: 300, maxHealth: 300 }),
      ],
    });
    state = use(state, "paladin-oathguard", null);
    forceEnemyIntents(state, 0, ["cleave"], null);
    state = endPlayerTurn(state);
    expect(state.player.paladinConviction).toBe(1);
    expect(state.log.filter((entry) => entry.text?.includes("earns Conviction"))).toHaveLength(1);

    state.player.paladinConviction = 4;
    for (const ally of state.allies) {
      ally.statuses.push({ type: "paladinOathguard", value: 30, cap: 0.15, duration: 3, sourceUid: "p" });
    }
    forceEnemyIntents(state, 0, ["cleave"], null);
    state = endPlayerTurn(state);
    expect(state.player.paladinConviction).toBe(5);
    for (const ally of state.allies) {
      ally.statuses.push({ type: "paladinOathguard", value: 30, cap: 0.15, duration: 3, sourceUid: "p" });
    }
    forceEnemyIntents(state, 0, ["cleave"], null);
    state = endPlayerTurn(state);
    expect(state.player.paladinConviction).toBe(5);
  });

  it("earns one Conviction only when Stand Fast Block actually absorbs hostile physical force", () => {
    let state = readyState(makeCharacter(), [combatant({
      abilities: [{ id: "rapid-jabs", tier: "common" }],
      weapon: { name: "Twin Blades", min: 20, max: 20, type: "physical", pen: 0, category: "dagger", reach: 1 },
    })]);
    state = use(state, "paladin-stand-fast", null);
    expect(state.player.paladinConviction).toBe(0);
    const blockBefore = state.player.block;
    forceEnemyIntents(state, 0, ["rapid-jabs"]);
    state = endPlayerTurn(state);
    expect(state.player.block).toBeLessThan(blockBefore);
    expect(state.player.paladinConviction).toBe(1);
    expect(state.log.filter((entry) => entry.text?.includes("earns Conviction"))).toHaveLength(1);

    let missed = readyState(makeCharacter(), [combatant({ accuracy: -1000 })]);
    missed = use(missed, "paladin-stand-fast", null);
    const missedBlock = missed.player.block;
    const missedHealth = missed.player.health;
    expect(missedBlock).toBeGreaterThan(0);
    forceBasicAttack(missed);
    missed = endPlayerTurn(missed);
    // Player Block normally expires as the next player round begins; the
    // enduring contract is that a miss deals no damage and builds no Conviction.
    expect(missed.player.health).toBe(missedHealth);
    expect(missed.player.paladinConviction).toBe(0);
  });

  it("commits Conviction once even on a miss and through all-allies, card, and NPC paths", () => {
    let missed = readyState();
    missed.player.paladinConviction = 2;
    missed.player.accuracy = -1000;
    const targetHealth = missed.enemies[0].health;
    missed = use(missed, "paladin-judgment-stroke", 0);
    expect(missed.player.paladinConviction).toBe(0);
    expect(missed.enemies[0].health).toBe(targetHealth);
    expect(missed.log.filter((entry) => entry.text?.includes("commits 2 Conviction"))).toHaveLength(1);

    let party = readyState(makeCharacter(), [combatant()], { allies: [combatant({ id: "ally", name: "Ally" })] });
    party.player.paladinConviction = 2;
    party = use(party, "paladin-hold-the-line", null);
    expect(party.player.paladinConviction).toBe(0);
    expect(party.log.filter((entry) => entry.text?.includes("commits 2 Conviction"))).toHaveLength(1);

    let cardState = readyState();
    cardState.player.paladinConviction = 2;
    const forced = forceIntoHand(cardState, "paladin-judgment-stroke");
    cardState = forced.state;
    expect(cardUsable(cardState, forced.uid, "e0")).toBe(true);
    cardState = playCard(cardState, forced.uid, "e0");
    expect(cardState.player.paladinConviction).toBe(0);
    expect(cardState.log.filter((entry) => entry.text?.includes("commits 2 Conviction"))).toHaveLength(1);

    const npc = paladinAlly({
      id: "enemy-paladin",
      name: "Enemy Paladin",
      accuracy: -1000,
      abilities: [{ id: "paladin-judgment-stroke", tier: "common" }],
    });
    let npcState = readyState(makeCharacter({ professionId: "cleric", levels: 1 }), [npc]);
    npcState.enemies[0].paladinConviction = 2;
    forceEnemyIntents(npcState, 0, ["paladin-judgment-stroke"]);
    const playerHealth = npcState.player.health;
    npcState = endPlayerTurn(npcState);
    expect(npcState.enemies[0].paladinConviction).toBe(0);
    expect(npcState.player.health).toBe(playerHealth);
    expect(npcState.log.filter((entry) => entry.text?.includes("Enemy Paladin commits 2 Conviction"))).toHaveLength(1);
  });

  it("uses ordinary physical mitigation and a profane-only ward-respecting radiant rider", () => {
    const physicalDamage = (overrides) => {
      let state = readyState(makeCharacter(), [combatant(overrides)]);
      const before = structuredClone(state);
      state = use(state, "paladin-vowed-strike", 0);
      return healthLoss(before, state);
    };
    const baseline = physicalDamage({});
    const pen = getAbilityDef("paladin-vowed-strike").pen || 0;
    expect(baseline).toBeGreaterThan(0);
    expect(physicalDamage({ ward: 500 })).toBe(baseline);
    expect(physicalDamage({ armor: 10 })).toBe(Math.max(0, baseline - Math.max(0, 10 - pen)));
    expect(physicalDamage({ block: 5, shield: 7 })).toBe(Math.max(0, baseline - 12));

    const oathfireDamage = (overrides) => {
      let state = readyState(makeCharacter(), [combatant(overrides)]);
      state.player.paladinConviction = 3;
      const before = structuredClone(state);
      state = use(state, "paladin-oathfire-edge", 0);
      return { damage: healthLoss(before, state), state };
    };
    const human = oathfireDamage({ race: "human" });
    const humanWard = oathfireDamage({ race: "human", ward: 500 });
    const profane = oathfireDamage({ race: "undead" });
    const profaneWard = oathfireDamage({ race: "undead", ward: 500 });
    expect(humanWard.damage).toBe(human.damage);
    expect(profane.damage).toBeGreaterThan(human.damage);
    expect(profaneWard.damage).toBe(human.damage);
    expect(profane.state.log.some((entry) => entry.text?.includes("ward-respecting radiance"))).toBe(true);
    expect(profaneWard.state.log.some((entry) => entry.text?.includes("ward turns aside"))).toBe(true);
  });

  it("gates semantic oathcraft by awareness, hearing, and understanding without control or allegiance change", () => {
    let eligible = readyState(makeCharacter(), [combatant({ health: 120, maxHealth: 120 })]);
    eligible = use(eligible, "paladin-challenge-of-witness", 0);
    expect(statusOf(eligible.enemies[0], "paladinWitnessChallenge", "p")).toBeTruthy();
    expect(eligible.enemies[0].side).toBe("enemy");
    expect(eligible.enemies[0].resolved).toBeFalsy();
    expect((eligible.enemies[0].statuses || []).some((status) =>
      ["stun", "charmed", "dominated", "geas", "enthralled"].includes(status.type))).toBe(false);

    for (const overrides of [
      { aware: false },
      { canHear: false, hearing: false },
      { canUnderstand: false },
      { understandsSpeech: false },
      { demeanor: "mindless" },
    ]) {
      const state = readyState(makeCharacter(), [combatant(overrides)]);
      grantPlayer(state, "paladin-challenge-of-witness");
      selectTarget(state, 0);
      expect(abilityUsable(state, "paladin-challenge-of-witness")).toBe(false);
    }

    const silenced = readyState();
    silenced.player.statuses.push({ type: "silence", value: 1, duration: 2 });
    grantPlayer(silenced, "paladin-challenge-of-witness");
    grantPlayer(silenced, "paladin-vowed-strike");
    grantPlayer(silenced, "paladin-oathguard");
    expect(abilityUsable(silenced, "paladin-challenge-of-witness")).toBe(false);
    expect(abilityUsable(silenced, "paladin-vowed-strike")).toBe(true);
    expect(abilityUsable(silenced, "paladin-oathguard")).toBe(true);
  });

  it("requires this Paladin's own Call to Account before Verdict Edge", () => {
    let state = readyState(makeCharacter(), [combatant({ id: "one" }), combatant({ id: "two", name: "Second Foe" })]);
    grantPlayer(state, "paladin-verdict-edge");
    state.player.paladinConviction = 2;
    state.enemies[0].statuses.push({ type: "paladinCallToAccount", value: 15, duration: 2, sourceUid: "other-paladin" });
    selectTarget(state, 0);
    expect(abilityUsable(state, "paladin-verdict-edge")).toBe(false);

    state = use(state, "paladin-call-to-account", 0);
    state.player.paladinConviction = 2;
    grantPlayer(state, "paladin-verdict-edge");
    selectTarget(state, 1);
    expect(abilityUsable(refresh(state, "paladin-verdict-edge"), "paladin-verdict-edge")).toBe(false);
    selectTarget(state, 0);
    expect(abilityUsable(state, "paladin-verdict-edge")).toBe(true);
    state = playerAct(state, "paladin-verdict-edge", 0);
    expect(state.player.paladinConviction).toBe(0);
    expect(statusOf(state.enemies[0], "paladinVerdictEdge", "p")).toBeTruthy();
  });

  it("has unforced AI establish Oathguard for an exposed ally then choose an affordable spender", () => {
    const actor = paladinAlly({
      uid: "paladin-ai",
      name: "Thinking Paladin",
      paladinConviction: 0,
      attrs: { body: 24, vigor: 24, presence: 24 },
      health: 200,
      maxHealth: 200,
    });
    const target = combatant({ id: "target", uid: "target", health: 300, maxHealth: 300 });
    const candidate = (id) => ({ id, tier: "common", def: getAbilityDef(id) });
    const exposed = combatant({ id: "ally", uid: "ally", health: 35, maxHealth: 100, statuses: [] });

    const guard = chooseAction(actor, [target], [
      candidate("paladin-oathguard"),
      candidate("paladin-vowed-strike"),
      candidate("paladin-judgment-stroke"),
    ], { allies: [actor, exposed] });
    expect(guard.ability.id).toBe("paladin-oathguard");

    actor.paladinConviction = 2;
    exposed.statuses.push({ type: "paladinOathguard", value: 30, cap: 0.15, duration: 3, sourceUid: "paladin-ai" });
    const spender = chooseAction(actor, [target], [
      candidate("paladin-vowed-strike"),
      candidate("paladin-judgment-stroke"),
    ], { allies: [actor, exposed] });
    expect(spender.ability.id).toBe("paladin-judgment-stroke");
  });
});
