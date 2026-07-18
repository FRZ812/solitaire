import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ABILITY_LIBRARY, BASIC_ATTACK, getAbilityDef } from "../data/abilities.js";
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

function makeCharacter() {
  const character = {
    id: "wanderer",
    name: "Warlock Tester",
    race: "human",
    weight: 70,
    attributes: { body: 24, reflex: 24, vigor: 30, mind: 30, wit: 26, presence: 30 },
    abilities: [],
    proficiencies: { spellcasting: 20 },
    conditions: [],
    progression: {
      version: 2,
      professions: [{
        professionId: "warlock",
        levels: 70,
        branchChoices: {
          "warlock-pact": "demon-warlock",
          "warlock-demon-method": "hellfire-adept",
          "warlock-hellfire-adept-mastery": "cinder-usurer",
        },
        choices: {},
      }],
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
    uid: "foe",
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
    weapon: { name: "Club", min: 10, max: 10, type: "physical", pen: 0, category: "mace", reach: 1 },
    abilities: [],
    statuses: [],
    cooldowns: {},
    demeanor: "fanatic",
    morale: 100,
    moraleMax: 100,
    conscious: true,
    aware: true,
    canHear: true,
    canUnderstand: true,
    actionsPerTurn: 1,
    ...overrides,
  };
}

function readyState(enemies = [combatant()], opts = {}) {
  const state = initCombat(makeCharacter(), CODEX, enemies, { seed: 42, ...opts });
  state.player.accuracy = 1000;
  state.player.critChance = 0;
  state.player.resolve = 100;
  state.player.resolveMax = 100;
  state.player.actionsLeft = 3;
  state.player.energy = 3;
  return state;
}

function grantPlayer(state, abilityId, tier = "common") {
  state.player.abilities = (state.player.abilities || []).filter((entry) => entry.id !== abilityId);
  state.player.abilities.push({ id: abilityId, tier });
  state.player.progressionAbilityIds = [...new Set([...(state.player.progressionAbilityIds || []), abilityId])];
  state.player.progressionBranchAbilityIds = [...new Set([...(state.player.progressionBranchAbilityIds || []), abilityId])];
  return state;
}

function refresh(state, abilityId, targetIndex = 0) {
  state.phase = "player";
  state.player.actionsLeft = 3;
  state.player.energy = 3;
  state.player.cooldowns[abilityId] = 0;
  if (targetIndex != null) {
    state.target = targetIndex;
    state.targetUid = state.enemies[targetIndex]?.uid || null;
  }
  return state;
}

function use(state, abilityId, targetIndex = undefined) {
  grantPlayer(state, abilityId);
  const def = getAbilityDef(abilityId);
  const index = targetIndex === undefined ? (def.target === "enemy" ? 0 : null) : targetIndex;
  refresh(state, abilityId, index);
  return playerAct(state, abilityId, index);
}

function statusOf(actor, type, sourceUid = null) {
  return (actor.statuses || []).find((status) => status.type === type
    && (sourceUid == null || status.sourceUid === sourceUid));
}

function forceIntoHand(state0, abilityId) {
  const state = structuredClone(state0);
  grantPlayer(state, abilityId);
  let uid = Object.keys(state.deck.cards).find((cardUid) => state.deck.cards[cardUid].abilityId === abilityId);
  if (!uid) {
    uid = `warlock-test-${abilityId}`;
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

describe("Warlock pact-price and Pact Favor runtime", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it("resets every Warlock combatant's personal Favor to zero at combat start", () => {
    const ally = combatant({ uid: "ally-warlock", professionId: "warlock", warlockFavor: 5 });
    const enemy = combatant({ uid: "enemy-warlock", professionId: "warlock", warlockFavor: 4 });
    const state = readyState([enemy], { allies: [ally] });
    expect(state.player.warlockFavor).toBe(0);
    expect(state.allies[0].warlockFavor).toBe(0);
    expect(state.enemies[0].warlockFavor).toBe(0);
  });

  it("earns one Favor only after Tithe Bolt pays its exact nonlethal health price", () => {
    let state = readyState();
    const beforeHealth = state.player.health;
    const expectedPrice = Math.max(1, Math.round(state.player.maxHealth * 0.04));
    state = use(state, "warlock-tithe-bolt");
    expect(beforeHealth - state.player.health).toBe(expectedPrice);
    expect(state.player.warlockFavor).toBe(1);
    expect(state.log.filter((entry) => entry.text?.includes("earns Pact Favor"))).toHaveLength(1);
  });

  it("applies Open Covenant's bounded self-exposure and aim before earning one Favor", () => {
    let state = readyState();
    const beforeHealth = state.player.health;
    state = use(state, "warlock-open-covenant", null);
    expect(state.player.health).toBe(beforeHealth);
    expect(state.player.warlockFavor).toBe(1);
    expect(statusOf(state.player, "warlockPactExposure")).toMatchObject({ value: 15, duration: 2 });
    expect(statusOf(state.player, "warlockOpenCovenant")).toMatchObject({ value: 10, accuracyBonus: 10, duration: 2 });
  });

  it("commits a spender's Favor once for the whole missed multihit action", () => {
    let state = readyState([combatant({ dodge: 10000 })]);
    state.player.accuracy = 0;
    state.player.warlockFavor = 3;
    const beforeHealth = state.enemies[0].health;
    state = use(state, "warlock-fivefold-collection");
    expect(state.player.warlockFavor).toBe(0);
    expect(state.enemies[0].health).toBe(beforeHealth);
    expect(state.log.filter((entry) => entry.text?.includes("commits 3 Pact Favor"))).toHaveLength(1);
  });

  it("requires the same Warlock's source-owned Debt Mark and Hellfire Covenant", () => {
    let state = readyState();
    grantPlayer(state, "warlock-claim-due");
    state.player.warlockFavor = 2;
    refresh(state, "warlock-claim-due");
    expect(abilityUsable(state, "warlock-claim-due")).toBe(false);
    state.enemies[0].statuses.push({ type: "warlockDebtMark", value: 12, duration: 3, sourceUid: "another-warlock" });
    expect(abilityUsable(state, "warlock-claim-due")).toBe(false);
    state.enemies[0].statuses.push({ type: "warlockDebtMark", value: 12, duration: 3, sourceUid: "p" });
    expect(abilityUsable(state, "warlock-claim-due")).toBe(true);

    grantPlayer(state, "warlock-devils-due");
    refresh(state, "warlock-devils-due");
    expect(abilityUsable(state, "warlock-devils-due")).toBe(false);
    state.enemies[0].statuses.push({ type: "warlockHellfireCovenant", value: 3, duration: 2, sourceUid: "p" });
    expect(abilityUsable(state, "warlock-devils-due")).toBe(true);
  });

  it("keeps secret, speech, and sympathetic-token methods tied to real prerequisites", () => {
    let state = readyState();
    state.player.warlockFavor = 4;
    grantPlayer(state, "warlock-secret-leverage");
    refresh(state, "warlock-secret-leverage");
    expect(abilityUsable(state, "warlock-secret-leverage")).toBe(false);
    state.player.knownSecretTargetUids = [state.enemies[0].uid];
    expect(abilityUsable(state, "warlock-secret-leverage")).toBe(true);
    state.enemies[0].canHear = false;
    expect(abilityUsable(state, "warlock-secret-leverage")).toBe(false);

    state.enemies[0].canHear = true;
    grantPlayer(state, "warlock-sympathetic-token");
    refresh(state, "warlock-sympathetic-token");
    expect(abilityUsable(state, "warlock-sympathetic-token")).toBe(false);
    state.player.carriedSympatheticToken = true;
    expect(abilityUsable(state, "warlock-sympathetic-token")).toBe(true);
  });

  it("refreshes one source-owned Layered Hex at an authored two-layer ceiling", () => {
    let state = readyState();
    for (let cast = 0; cast < 3; cast += 1) {
      state.player.warlockFavor = 5;
      state = use(state, "warlock-layered-hex");
    }
    const layers = state.enemies[0].statuses.filter((status) => status.type === "warlockLayeredHex" && status.sourceUid === "p");
    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({ stacks: 2, maxStacks: 2, duration: 3 });
  });

  it("keeps Pact Favor parity when a builder is played from a combat card", () => {
    let state = readyState();
    const prepared = forceIntoHand(state, "warlock-tithe-bolt");
    state = prepared.state;
    const beforeHealth = state.player.health;
    expect(cardUsable(state, prepared.uid, state.enemies[0].uid)).toBe(true);
    state = playCard(state, prepared.uid, state.enemies[0].uid);
    expect(state.player.health).toBeLessThan(beforeHealth);
    expect(state.player.warlockFavor).toBe(1);
  });

  it("redistributes Shared Burden without healing or recursively redirecting harm", () => {
    const ally = combatant({ uid: "ally", id: "ally", name: "Linked Ally", side: "player", health: 100, maxHealth: 100 });
    let state = readyState([combatant({ uid: "enemy", abilities: [{ id: BASIC_ATTACK.id, tier: "common" }] })], { allies: [ally] });
    state.player.warlockFavor = 2;
    state = use(state, "warlock-shared-burden", null);
    expect(statusOf(state.player, "warlockSharedBurden", "p")).toMatchObject({ value: 20, cap: 0.08 });
    expect(statusOf(state.allies[0], "warlockSharedBurden", "p")).toMatchObject({ value: 20, cap: 0.08 });

    const playerBefore = state.player.health;
    const allyBefore = state.allies[0].health;
    const enemy = state.enemies[0];
    enemy.intent = { id: "forced-basic", abilityId: BASIC_ATTACK.id, tier: "common", mode: "single", targetUid: state.allies[0].uid };
    enemy.intents = [enemy.intent];
    enemy.actionsPerTurn = 1;
    state = endPlayerTurn(state);
    const allyLoss = allyBefore - state.allies[0].health;
    const playerLoss = playerBefore - state.player.health;
    expect(allyLoss).toBeGreaterThan(0);
    expect(playerLoss).toBeGreaterThan(0);
    expect(playerLoss).toBeLessThanOrEqual(Math.round(state.player.maxHealth * 0.08));
    expect(allyLoss + playerLoss).toBe(10);
  });

  it("makes NPC Warlocks build Favor, then prefer an affordable spender", () => {
    const actor = combatant({
      uid: "npc-warlock",
      professionId: "warlock",
      health: 100,
      maxHealth: 100,
      warlockFavor: 0,
    });
    const foe = combatant({ uid: "target" });
    const candidates = ["warlock-tithe-bolt", "warlock-favors-rebuke"].map((id) => ({ id, tier: "common", def: getAbilityDef(id) }));
    expect(chooseAction(actor, [foe], candidates).ability.id).toBe("warlock-tithe-bolt");
    actor.warlockFavor = 1;
    expect(chooseAction(actor, [foe], candidates).ability.id).toBe("warlock-favors-rebuke");
  });

  it("keeps all native Warlock combat actions inside pactcraft with no true damage or forbidden control", () => {
    const native = ABILITY_LIBRARY.filter((def) => def.professionId === "warlock" && def.school === "pactcraft");
    expect(native).toHaveLength(24);
    for (const def of native) {
      expect(def.damageType, def.id).not.toBe("true");
      expect(["instantKill", "charmed", "dominated", "summonUndead"], def.id).not.toContain(def.effect?.type);
    }
  });
});
