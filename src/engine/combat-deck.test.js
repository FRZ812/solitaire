import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cardUsable,
  drawCards,
  endPlayerTurn,
  initCombat,
  playCard,
  playerCeasefire,
  playerFlee,
  playerStandDown,
} from "./combat.js";
import { recomputeResolveMax, recomputeVitalityMax } from "./attributes.js";

const CODEX = {
  characters: { wanderer: { id: "wanderer", worn: ["sword"] } },
  items: {
    sword: {
      id: "sword",
      name: "Arming Sword",
      kind: "weapon",
      tier: "common",
      combat: { weaponType: "sword", damage: { min: 5, max: 7, type: "physical", pen: 0 } },
    },
  },
};

function character() {
  const value = {
    name: "Deck Tester",
    attributes: { body: 6, reflex: 5, vigor: 7, mind: 5, wit: 4, presence: 3 },
    abilities: [
      { id: "power-strike", tier: "common" },
      { id: "second-wind", tier: "uncommon" },
      { id: "firebolt", tier: "common" },
      { id: "basic-attack", tier: "common" },
      { id: "defend", tier: "common" },
      { id: "talk", tier: "common" },
    ],
    proficiencies: {},
    conditions: [],
  };
  recomputeVitalityMax(value);
  recomputeResolveMax(value);
  value.vitality = value.vitalityMax;
  value.resolve = value.resolveMax;
  return value;
}

function enemy() {
  return {
    id: "training-foe",
    name: "Training Foe",
    kind: "guard",
    race: "human",
    tier: "common",
    health: 180,
    maxHealth: 180,
    armor: 0,
    ward: 0,
    dodge: 0,
    accuracy: 20,
    critChance: 0,
    critMult: 1.5,
    speed: 3,
    resolve: 0,
    resolveMax: 0,
    weapon: { name: "Blunted Sword", min: 1, max: 1, type: "physical", pen: 0, category: "sword", reach: 1 },
    abilities: [{ id: "power-strike", tier: "common" }],
    statuses: [],
    cooldowns: {},
    demeanor: "fanatic",
    morale: 100,
    moraleMax: 100,
    canTalk: true,
    actionsPerTurn: 1,
  };
}

function fight(seed = 1337) {
  return initCombat(character(), CODEX, [enemy()], { seed });
}

function forceIntoHand(cs0, abilityId) {
  const cs = structuredClone(cs0);
  const uid = Object.keys(cs.deck.cards).find((id) => cs.deck.cards[id].abilityId === abilityId);
  for (const pile of ["draw", "hand", "discard", "exhaust"]) {
    cs.deck[pile] = cs.deck[pile].filter((id) => id !== uid);
  }
  cs.deck.hand.unshift(uid);
  return { cs, uid };
}

function cardCount(cs, abilityId) {
  return Object.values(cs.deck.cards).filter((card) => card.abilityId === abilityId).length;
}

function assertCardConservation(cs) {
  const all = [...cs.deck.draw, ...cs.deck.hand, ...cs.deck.discard, ...cs.deck.exhaust];
  expect(all).toHaveLength(Object.keys(cs.deck.cards).length);
  expect(new Set(all).size).toBe(all.length);
}

describe("deck combat", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.42));
  afterEach(() => vi.restoreAllMocks());

  it("builds the compatibility starter deck, draws five, and shuffles reproducibly", () => {
    const a = fight(77);
    const b = fight(77);
    expect(cardCount(a, "basic-attack")).toBe(4);
    expect(cardCount(a, "defend")).toBe(4);
    expect(cardCount(a, "power-strike")).toBe(1);
    expect(cardCount(a, "second-wind")).toBe(1);
    expect(cardCount(a, "firebolt")).toBe(1);
    expect(cardCount(a, "talk")).toBe(0);
    const powerStrike = Object.values(a.deck.cards).find((card) => card.abilityId === "power-strike");
    expect(powerStrike.statLine).toContain("weapon damage");
    expect(powerStrike.statLine).not.toMatch(/\bcd \d+\b/i);
    expect(powerStrike.requirementLine).toContain("needs sword/axe/mace/spear");
    expect(a.deck.hand).toHaveLength(5);
    expect(a.player.energy).toBe(3);
    expect(a.deck.hand).toEqual(b.deck.hand);
    expect(a.deck.draw).toEqual(b.deck.draw);
    expect(a).not.toHaveProperty("environment");
    assertCardConservation(a);
  });

  it("validates target, energy, Resolve, and weapon before moving a played card", () => {
    let { cs, uid } = forceIntoHand(fight(), "power-strike");
    expect(cardUsable(cs, uid, "missing-target")).toBe(false);
    expect(playCard(cs, uid, "missing-target")).toBe(cs);

    cs.player.energy = 0;
    expect(cardUsable(cs, uid, cs.enemies[0].uid)).toBe(false);
    cs.player.energy = 3;
    cs.player.weapon.category = "arcane";
    expect(cardUsable(cs, uid, cs.enemies[0].uid)).toBe(false);

    ({ cs, uid } = forceIntoHand(fight(), "firebolt"));
    cs.player.resolve = 0;
    expect(cardUsable(cs, uid, cs.enemies[0].uid)).toBe(false);

    ({ cs, uid } = forceIntoHand(fight(), "basic-attack"));
    const beforeEnergy = cs.player.energy;
    const next = playCard(cs, uid, cs.enemies[0].uid);
    expect(next.player.energy).toBe(beforeEnergy - 1);
    expect(next.deck.hand).not.toContain(uid);
    expect(next.deck.discard).toContain(uid);
    assertCardConservation(next);
  });

  it("moves major learned cards to exhaust and can reshuffle discard into draw", () => {
    const forced = forceIntoHand(fight(), "second-wind");
    const next = playCard(forced.cs, forced.uid);
    expect(next.deck.exhaust).toContain(forced.uid);
    expect(next.deck.discard).not.toContain(forced.uid);

    const empty = structuredClone(next);
    empty.deck.discard.push(...empty.deck.draw);
    empty.deck.draw = [];
    const drawn = drawCards(empty, 1);
    expect(drawn.deck.hand.length).toBe(next.deck.hand.length + 1);
    expect(drawn.deck.draw.length).toBeGreaterThanOrEqual(0);
    assertCardConservation(drawn);
  });

  it("stores enemy intent before player input and executes that plan on end round", () => {
    const cs = fight(2026);
    const intent = structuredClone(cs.enemies[0].intent);
    expect(intent).toBeTruthy();
    expect(intent.abilityId).toBeTruthy();
    const after = endPlayerTurn(cs);
    expect(after.round).toBe(2);
    expect(after.phase).toBe("player");
    expect(after.deck.hand).toHaveLength(5);
    expect(after.log.some((entry) => entry.text.includes(intent.name) || entry.text.includes("Training Foe"))).toBe(true);
    expect(after.enemies[0].intent).toBeTruthy();
    assertCardConservation(after);
  });

  it("observes a duration-one enemy stun before expiry and cancels its stored intent", () => {
    const cs = fight(101);
    const planned = structuredClone(cs.enemies[0].intent);
    const healthBefore = cs.player.health;
    cs.enemies[0].statuses.push({ type: "stun", value: 1, duration: 1 });
    const after = endPlayerTurn(cs);
    expect(after.player.health).toBe(healthBefore);
    expect(after.enemies[0].cooldowns[planned.abilityId] || 0).toBe(0);
    expect(after.log.some((entry) => entry.text === "Training Foe is stunned and cannot act.")).toBe(true);
    expect(after.enemies[0].intent.id).not.toBe(planned.id);
  });

  it("observes a duration-one player stun before expiry and cancels card actions", () => {
    const stunned = character();
    stunned.conditions = ["Stunned"];
    const cs = initCombat(stunned, CODEX, [enemy()], { seed: 102 });
    expect(cs.phase).toBe("player");
    expect(cs.round).toBe(2);
    expect(cs.player.energy).toBe(3);
    expect(cs.player.statuses.some((status) => status.type === "stun")).toBe(false);
    expect(cs.deck.hand).toHaveLength(5);
    expect(cs.log.some((entry) => entry.text.includes("stunned and cannot act"))).toBe(true);
  });

  it("observes a duration-one NPC charm before expiry and cancels its stored intent", () => {
    const cs = fight(1021);
    const healthBefore = cs.player.health;
    cs.enemies[0].statuses.push({ type: "charmed", value: 1, duration: 1 });
    const after = endPlayerTurn(cs);
    expect(after.player.health).toBe(healthBefore);
    expect(after.log.some((entry) => entry.text.includes("stands down, held by the charm"))).toBe(true);
  });

  it("shows a pass intent while a multi-turn stun still covers the next enemy turn", () => {
    const cs = fight(1022);
    cs.enemies[0].statuses.push({ type: "stun", value: 1, duration: 2 });
    const round2 = endPlayerTurn(cs);
    expect(round2.enemies[0].intent.name).toBe("Stunned");
    const healthBefore = round2.player.health;
    const round3 = endPlayerTurn(round2);
    expect(round3.player.health).toBe(healthBefore);
    expect(round3.enemies[0].intent.name).not.toBe("Stunned");
  });

  it("auto-resolves controlled player rounds and never exposes a stalled enemy phase", () => {
    const charmed = character();
    charmed.conditions = ["Charmed"];
    const afterCharm = initCombat(charmed, CODEX, [enemy()], { seed: 103 });
    expect(afterCharm.phase).toBe("player");
    expect(afterCharm.round).toBe(4);
    expect(afterCharm.player.statuses.some((status) => status.type === "charmed")).toBe(false);
    expect(afterCharm.log.filter((entry) => entry.text.includes("cannot raise a weapon"))).toHaveLength(3);

    const enthralled = fight(104);
    enthralled.player.statuses.push({ type: "enthralled", value: 1, duration: 1 });
    const afterEnthrall = endPlayerTurn(enthralled);
    expect(afterEnthrall.phase).toBe("player");
    expect(afterEnthrall.round).toBe(3);
    expect(afterEnthrall.log.some((entry) => entry.text.includes("body is not your own"))).toBe(true);
  });

  it.each(["charmed", "enthralled"])("blocks cards, flight, and truce while the player is %s", (type) => {
    const cs = fight(105);
    cs.player.statuses.push({ type, value: 1, duration: 2 });
    cs.ceasefire = true;
    const cardUid = cs.deck.hand[0];
    expect(cardUsable(cs, cardUid, cs.targetUid)).toBe(false);
    expect(playerFlee(cs)).toBe(cs);
    expect(playerCeasefire(cs)).toBe(cs);
    cs.enemies[0].fleeing = true;
    expect(playerStandDown(cs)).toBe(cs);
  });

  it("resolves permanent control as defeat without simulating thousands of rounds", () => {
    const cs = fight(1051);
    cs.player.enthralledBy = cs.enemies[0].uid;
    cs.player.statuses.push({ type: "enthralled", value: 1, duration: 99999 });
    const after = endPlayerTurn(cs);
    expect(after.phase).toBe("defeat");
    expect(after.round).toBe(1);
    expect(after.log.some((entry) => entry.text.includes("will is bound beyond recall"))).toBe(true);
    expect(after.log.length).toBeLessThan(20);
  });

  it("plans against the execution-time cooldown and preserves multi-round cadence", () => {
    const caster = enemy();
    caster.resolve = 20;
    caster.resolveMax = 20;
    caster.abilities = [{ id: "lightning-bolt", tier: "common" }];
    const round1 = initCombat(character(), CODEX, [caster], { seed: 106 });
    expect(round1.enemies[0].intent.abilityId).toBe("lightning-bolt");

    const round2 = endPlayerTurn(round1);
    expect(round2.enemies[0].cooldowns["lightning-bolt"]).toBe(2);
    expect(round2.enemies[0].intent.abilityId).toBe("basic-attack");

    const round3 = endPlayerTurn(round2);
    expect(round3.enemies[0].cooldowns["lightning-bolt"]).toBe(1);
    expect(round3.enemies[0].intent.abilityId).toBe("lightning-bolt");

    const round4 = endPlayerTurn(round3);
    expect(round4.enemies[0].cooldowns["lightning-bolt"]).toBe(2);
    expect(round4.enemies[0].intent.abilityId).toBe("basic-attack");
  });

  it("draws to five around retained cards and suppresses ignored legacy swift rolls", () => {
    const cs = fight(9);
    const retained = cs.deck.hand[0];
    cs.deck.cards[retained].retain = true;
    cs.player.swiftChance = 1;
    cs.log = [];
    const after = endPlayerTurn(cs);
    expect(after.deck.hand).toHaveLength(5);
    expect(after.deck.hand).toContain(retained);
    expect(after.log.some((entry) => /uncanny speed|extra action/i.test(entry.text))).toBe(false);
    assertCardConservation(after);
  });
});
