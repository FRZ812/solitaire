import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ABILITY_LIBRARY, BASIC_ATTACK, getAbilityDef } from "../data/abilities.js";
import { cardDefinition } from "../data/combat-cards.js";
import { recomputeResolveMax, recomputeVitalityMax } from "./attributes.js";
import { chooseAction } from "./combat-ai.js";
import { abilityUsable, cardUsable, initCombat, playCard, playerAct } from "./combat.js";

const CODEX = { characters: { wanderer: { id: "wanderer", worn: [] } }, items: {} };

function makeCharacter() {
  const character = {
    id: "wanderer",
    name: "Artificer Tester",
    race: "human",
    weight: 70,
    attributes: { body: 28, reflex: 30, vigor: 24, mind: 30, wit: 30, presence: 20 },
    abilities: [],
    proficiencies: {},
    conditions: [],
    progression: {
      version: 2,
      professions: [{
        professionId: "artificer",
        levels: 70,
        branchChoices: {
          "artificer-workshop": "runesmith",
          "artificer-runesmith-method": "wardwright",
          "artificer-wardwright-apex": "aegis-architect",
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
    actionsPerTurn: 1,
    ...overrides,
  };
}

function readyState(enemies = [combatant()], opts = {}) {
  const state = initCombat(makeCharacter(), CODEX, enemies, { seed: 42, ...opts });
  state.player.accuracy = 1000;
  state.player.critChance = 0;
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

function forceIntoHand(state0, abilityId) {
  const state = structuredClone(state0);
  grantPlayer(state, abilityId);
  let uid = Object.keys(state.deck.cards).find((cardUid) => state.deck.cards[cardUid].abilityId === abilityId);
  if (!uid) {
    uid = `artificer-test-${abilityId}`;
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

describe("Artificer prepared Device Charge runtime", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it("starts every combatant with exactly five fresh prepared Charges", () => {
    const ally = combatant({ uid: "ally-artificer", professionId: "artificer", artificerDeviceCharges: 0 });
    const enemy = combatant({ uid: "enemy-artificer", professionId: "artificer", artificerDeviceCharges: 1 });
    const state = readyState([enemy], { allies: [ally] });
    expect(state.player.artificerDeviceCharges).toBe(5);
    expect(state.allies[0].artificerDeviceCharges).toBe(5);
    expect(state.enemies[0].artificerDeviceCharges).toBe(5);
  });

  it("commits a device cost once for a missed multihit or multi-target action", () => {
    let state = readyState([combatant({ dodge: 10000 }), combatant({ uid: "foe-2", dodge: 10000 })]);
    state.player.accuracy = 0;
    state = use(state, "artificer-repeating-engine");
    expect(state.player.artificerDeviceCharges).toBe(3);
    expect(state.log.filter((entry) => entry.text?.includes("commits 2 prepared Device Charges"))).toHaveLength(1);

    state.player.artificerDeviceCharges = 5;
    state = use(state, "artificer-relay-bolt", null);
    expect(state.player.artificerDeviceCharges).toBe(3);
    expect(state.log.filter((entry) => entry.text?.includes("commits 2 prepared Device Charges"))).toHaveLength(2);
  });

  it("hard-gates unaffordable devices for ability and card paths", () => {
    let state = readyState();
    grantPlayer(state, "artificer-grand-invention");
    refresh(state, "artificer-grand-invention", null);
    state.player.artificerDeviceCharges = 4;
    expect(abilityUsable(state, "artificer-grand-invention")).toBe(false);

    const prepared = forceIntoHand(state, "artificer-grand-invention");
    state = prepared.state;
    state.player.artificerDeviceCharges = 4;
    expect(cardUsable(state, prepared.uid)).toBe(false);
  });

  it("Field Refit restores two Charges without exceeding five or spending Resolve", () => {
    let state = readyState();
    const resolveBefore = state.player.resolve;
    state.player.artificerDeviceCharges = 1;
    state = use(state, "artificer-field-refit", null);
    expect(state.player.artificerDeviceCharges).toBe(3);
    expect(state.player.resolve).toBe(resolveBefore);

    state.player.artificerDeviceCharges = 4;
    state = use(state, "artificer-field-refit", null);
    expect(state.player.artificerDeviceCharges).toBe(5);
  });

  it("preserves Charge parity when a device is played from a combat card", () => {
    let state = readyState();
    const prepared = forceIntoHand(state, "artificer-snapfire-capsule");
    state = prepared.state;
    expect(cardUsable(state, prepared.uid, state.enemies[0].uid)).toBe(true);
    state = playCard(state, prepared.uid, state.enemies[0].uid);
    expect(state.player.artificerDeviceCharges).toBe(4);
    expect(state.magicCast).not.toBe(true);
  });

  it("makes Arc Node source-owned and benefits only the matching Artificer's devices", () => {
    let state = readyState();
    state = use(state, "artificer-arc-node");
    expect(state.enemies[0].statuses).toContainEqual(expect.objectContaining({
      type: "artificerArcNode",
      sourceUid: "p",
      deviceDamageBonus: 15,
    }));
    state.player.artificerDeviceCharges = 5;
    const before = state.enemies[0].health;
    state = use(state, "artificer-snapfire-capsule");
    expect(state.enemies[0].health).toBeLessThan(before);
    expect(state.player.artificerDeviceCharges).toBe(4);
  });

  it("uses Countermeasure for one bounded condition without restoring health", () => {
    let state = readyState();
    const healthBefore = state.player.health;
    state.player.statuses.push(
      { type: "bleed", value: 3, duration: 3 },
      { type: "weaken", value: 15, duration: 2 },
    );
    state = use(state, "artificer-countermeasure", null);
    expect(state.player.statuses.filter((status) => ["bleed", "weaken"].includes(status.type))).toHaveLength(1);
    expect(state.player.health).toBe(healthBefore);
    expect(state.player.magicShield).toBeGreaterThan(0);
  });

  it("makes NPC Artificers refit when depleted and spend an affordable device otherwise", () => {
    const actor = combatant({ uid: "npc-artificer", professionId: "artificer", artificerDeviceCharges: 1 });
    const foe = combatant({ uid: "target" });
    const candidates = ["artificer-field-refit", "artificer-snapfire-capsule", "artificer-grand-invention"]
      .map((id) => ({ id, tier: "common", def: getAbilityDef(id) }));
    expect(chooseAction(actor, [foe], candidates).ability.id).toBe("artificer-field-refit");
    actor.artificerDeviceCharges = 5;
    expect(chooseAction(actor, [foe], candidates).ability.id).toBe("artificer-grand-invention");
  });

  it("keeps all native devices out of spell, summon, bonus-action, and true-damage shortcuts", () => {
    const native = ABILITY_LIBRARY.filter((def) => def.professionId === "artificer" && def.school === "devicecraft");
    expect(native).toHaveLength(24);
    for (const def of native) {
      expect(def.resolveCost, def.id).toBe(0);
      expect(def.damageType, def.id).not.toBe("true");
      expect(["summonUndead", "bonusAction", "charmed", "dominated", "instantKill"], def.id).not.toContain(def.effect?.type);
    }
    expect(getAbilityDef("artificer-repeating-engine")).toMatchObject({ hits: 3, artificerChargeCost: 2 });
    expect(getAbilityDef(BASIC_ATTACK.id).artificerChargeCost).toBeUndefined();
  });
});
