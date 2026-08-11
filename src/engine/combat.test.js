import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initCombat, abilityUsable, playerAct, endTurn,
  canStandDown, playerStandDown,
} from "./combat.js";
import { rollLoot } from "./combat-loot.js";
import { applyCombatResult, applyLoot } from "./combat-result.js";
import { generateEnemyGroup } from "../data/bestiary.js";
import { coinsToCopper } from "./economy.js";
import { BASIC_ATTACK } from "../data/abilities.js";
import { maxResolveFor, maxVitalityFor, recomputeVitalityMax, recomputeResolveMax } from "./attributes.js";
import { progressionLevel } from "./progression.js";

// Deterministic RNG so combat (initiative, hit/crit, loot rolls) is reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CODEX = {
  characters: { wanderer: { id: "wanderer", worn: ["w", "a"] } },
  items: {
    w: { id: "w", name: "Iron Shortsword", kind: "weapon", tier: "common", combat: { damage: { min: 5, max: 8, type: "physical", pen: 0 } } },
    a: { id: "a", name: "Leather Armor", kind: "armor", tier: "common", combat: { armor: 3 } },
  },
};
// Mirror combat-sim's makeFighter: derive the HP/resolve pools from attributes
// (initCombat reads vitalityMax/resolve to build the player's combat stats).
const player = () => {
  const c = {
    name: "Hero",
    attributes: { body: 6, reflex: 6, vigor: 6, mind: 3, wit: 4, presence: 3 },
    abilities: [{ id: "power-strike", tier: "common" }],
    proficiencies: {},
  };
  recomputeVitalityMax(c);
  recomputeResolveMax(c);
  c.resolve = c.resolveMax;
  return c;
};

const TERMINAL = new Set(["victory", "defeat", "resolved", "playerFled"]);

describe("initCombat", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockImplementation(mulberry32(42)));
  afterEach(() => vi.restoreAllMocks());

  it("builds a combat state with player, cloned enemies, and a phase", () => {
    const cs = initCombat(player(), CODEX, generateEnemyGroup("bandits", { count: 2, maxTier: "common" }), {});
    expect(cs.player).toBeTruthy();
    expect(cs.player.maxHealth).toBeGreaterThan(0);
    expect(Array.isArray(cs.enemies)).toBe(true);
    expect(cs.enemies).toHaveLength(2);
    expect(typeof cs.phase).toBe("string");
  });

  it("runs a full fight to a valid terminal phase without throwing or spinning", () => {
    let cs = initCombat(player(), CODEX, generateEnemyGroup("bandits", { count: 1, maxTier: "common" }), {});
    let guard = 0;
    while (!TERMINAL.has(cs.phase) && guard++ < 300) {
      if (cs.phase !== "player") { cs = endTurn(cs); continue; }
      if (canStandDown(cs)) { cs = playerStandDown(cs); break; }
      const target = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved);
      if (target < 0) { cs = endTurn(cs); continue; }
      const ability = abilityUsable(cs, "power-strike") ? "power-strike" : BASIC_ATTACK.id;
      cs = playerAct(cs, ability, target);
      if (TERMINAL.has(cs.phase)) break;
      cs = endTurn(cs);
    }
    expect(guard).toBeLessThan(300);
    expect(typeof cs.phase).toBe("string");
  });
});

describe("abilityUsable", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockImplementation(mulberry32(7)));
  afterEach(() => vi.restoreAllMocks());

  it("rejects unknown abilities, preserves the player's kit, and gates on the player's turn", () => {
    const cs = initCombat(player(), CODEX, generateEnemyGroup("bandits", { count: 1, maxTier: "common" }), { ambush: "player" });
    expect(abilityUsable(cs, "not-a-real-ability")).toBeFalsy();      // not in the kit → never usable
    expect(cs.player.abilities.some((a) => a.id === "power-strike")).toBe(true); // granted ability survived init
    if (cs.phase === "player") {
      // On the player's turn, with a full resolve pool and a drawn-or-fists
      // weapon, at least one of their actions is usable.
      const anyUsable = cs.player.abilities.some((a) => abilityUsable(cs, a.id)) || abilityUsable(cs, BASIC_ATTACK.id);
      expect(anyUsable).toBe(true);
    }
  });
});

describe("rollLoot — canonical coin denominations (Stage-1 fix)", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockImplementation(mulberry32(123)));
  afterEach(() => vi.restoreAllMocks());

  it("rolls coins up into canonical denominations (no silver/copper overflow)", () => {
    // A beefy haul (8 divine foes → ≥128cp) so the total clears a gold piece.
    // Pre-fix this was mis-expressed as tens of silver with gold always 0;
    // copperToCoins now guarantees copper<10 and silver<10.
    const big = Array.from({ length: 8 }, () => ({ kind: "ogre", tier: "divine", maxLootTier: "divine" }));
    const loot = rollLoot(big, { maxLootTier: "divine", region: 5 });
    expect(loot).toHaveProperty("items");
    expect(coinsToCopper(loot.coins)).toBeGreaterThan(0);
    expect(loot.coins.copper).toBeLessThan(10);
    expect(loot.coins.silver).toBeLessThan(10);
    expect(loot.coins.gold).toBeGreaterThan(0);
  });
});

describe("applyCombatResult / applyLoot (combat → campaign-state fold)", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockImplementation(mulberry32(99)));
  afterEach(() => vi.restoreAllMocks());

  const campaignState = () => ({
    character: {
      vitality: 50, vitalityMax: 100, resolve: 5, resolveMax: 10,
      conditions: [], proficiencies: {},
      inventory: { carried: [], coins: { copper: 5, silver: 0, gold: 0 } },
    },
    world: { codex: { characters: { wanderer: {} }, items: {}, skills: {} } },
    party: [], beats: [], apiHistory: [],
  });

  function fightToEnd() {
    let cs = initCombat(player(), CODEX, generateEnemyGroup("bandits", { count: 1, maxTier: "common" }), {});
    let guard = 0;
    while (!TERMINAL.has(cs.phase) && guard++ < 300) {
      if (cs.phase !== "player") { cs = endTurn(cs); continue; }
      if (canStandDown(cs)) { cs = playerStandDown(cs); break; }
      const t = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved);
      if (t < 0) { cs = endTurn(cs); continue; }
      cs = playerAct(cs, abilityUsable(cs, "power-strike") ? "power-strike" : BASIC_ATTACK.id, t);
      if (!TERMINAL.has(cs.phase)) cs = endTurn(cs);
    }
    return cs;
  }

  it("folds combat HP into [0,vitalityMax], appends a recap, and does not mutate input", () => {
    const cs = fightToEnd();
    const st = campaignState();
    const next = applyCombatResult(st, cs, { flavor: "the bandit" });
    expect(next.character.vitality).toBeGreaterThanOrEqual(0);
    expect(next.character.vitality).toBeLessThanOrEqual(100);
    expect(next.apiHistory).toHaveLength(1);
    expect(next.apiHistory[0].content).toContain("[COMBAT REPORT]");
    expect(st.apiHistory).toHaveLength(0); // input untouched
  });

  it("settles nonfatal defeat locally before narrator presentation", () => {
    const st = campaignState();
    st.world.currentTile = { x: 4, y: 7 };
    st.character.inventory.carried = [{ itemId: "kept-blade", qty: 1 }];
    const next = applyCombatResult(st, {
      phase: "defeat",
      player: { health: 0, maxHealth: 100, resolve: 0, statuses: [] },
      enemies: [], allies: [], profGains: {}, loot: null, log: [], executedCount: 0,
    }, { flavor: "the brigand" });

    expect(next.character.vitality).toBe(1);
    expect(next.character.inventory).toEqual(st.character.inventory);
    expect(next.world.currentTile).toEqual({ x: 4, y: 7 });
    expect(next.apiHistory[0].content).toContain("[DEFEAT OUTCOME — ENGINE SETTLED]");
    expect(next.apiHistory[0].content).toContain("No inventory or location change is authorized");
  });

  it("commits permanent combat death before any narrator presentation", () => {
    const st = campaignState();
    const next = applyCombatResult(st, {
      phase: "defeat",
      player: { health: 0, maxHealth: 100, resolve: 0, statuses: [] },
      enemies: [], allies: [], profGains: {}, loot: { items: [{ itemId: "spoils" }] }, log: [], executedCount: 0,
    }, {
      flavor: "the Ash Tyrant",
      permanentDeath: true,
      place: "Black Gate",
    });

    expect(next.character.vitality).toBe(0);
    expect(next.pendingLoot).toBe(null);
    expect(next.ended).toEqual({
      cause: "fallen in battle",
      foe: "the Ash Tyrant",
      place: "Black Gate",
      day: null,
    });
  });

  it("applyLoot adds canonical coin to the purse, conserving total value, and clears pendingLoot", () => {
    const st = campaignState(); // purse = 5cp
    const { state: after } = applyLoot(st, { items: [], coins: { gold: 0, silver: 3, copper: 7 }, ability: null });
    expect(coinsToCopper(after.character.inventory.coins)).toBe(5 + 37); // value conserved
    expect(after.character.inventory.coins.copper).toBeLessThan(10); // canonical
    expect(after.character.inventory.coins.silver).toBeLessThan(10);
    expect(after.pendingLoot).toBe(null);
  });

  it("files a newly dominated combatant with profession, archetype, and progression", () => {
    const st = campaignState();
    const next = applyCombatResult(st, {
      phase: "victory",
      player: { health: 50, maxHealth: 100, resolve: 5, statuses: [] },
      enemies: [],
      allies: [{
        id: "thrall-test", name: "Fen Knife", kind: "marsh-raider", race: "human",
        enthralledBy: "p", health: 20, maxHealth: 20, attrs: { body: 4, reflex: 3, vigor: 3, mind: 1, wit: 2, presence: 1 },
        gear: [{ id: "w" }], abilities: [], statuses: [],
      }],
      profGains: {}, loot: null, log: [], executedCount: 0,
    });
    const thrall = next.world.codex.characters["thrall-test"];

    expect(next.party).toContain("thrall-test");
    expect(thrall).toMatchObject({ profession: "fighter", archetype: "marsh-raider" });
    expect(progressionLevel(thrall)).toBeGreaterThan(0);
    expect(thrall).not.toHaveProperty("health");
    expect(thrall.combatState).toMatchObject({
      health: maxVitalityFor(thrall),
      maxHealth: maxVitalityFor(thrall),
      status: "ok",
    });
    expect(thrall.resolveMax).toBe(maxResolveFor(thrall));
  });
});
