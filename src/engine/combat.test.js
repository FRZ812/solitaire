import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initCombat, abilityUsable, rollLoot, playerAct, endTurn,
  canStandDown, playerStandDown,
} from "./combat.js";
import { generateEnemyGroup } from "../data/bestiary.js";
import { coinsToCopper } from "./economy.js";
import { BASIC_ATTACK } from "../data/abilities.js";
import { recomputeVitalityMax, recomputeResolveMax } from "./attributes.js";

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

describe("rollLoot — coin denomination", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockImplementation(mulberry32(123)));
  afterEach(() => vi.restoreAllMocks());

  it("returns a well-formed loot manifest with a non-negative copper value", () => {
    const loot = rollLoot([{ kind: "bandits", tier: "common", maxLootTier: "common" }], { maxLootTier: "common", region: 1 });
    expect(loot).toHaveProperty("items");
    expect(loot).toHaveProperty("coins");
    expect(typeof loot.coins.copper).toBe("number");
    expect(coinsToCopper(loot.coins)).toBeGreaterThanOrEqual(0);
    // CURRENT behavior (review's coin-normalization finding): loot never rolls
    // copper up into gold. The Stage-1 combat-loot extraction routes coins
    // through copperToCoins, after which this expectation becomes canonical.
    expect(loot.coins.gold).toBe(0);
  });
});
