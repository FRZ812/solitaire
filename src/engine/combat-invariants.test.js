import { describe, it, expect, vi, afterEach } from "vitest";
import {
  initCombat, abilityUsable, playerAct, endTurn, canStandDown, playerStandDown, spendStamina,
  telegraphFor,
} from "./combat.js";
import { BESTIARY, generateEnemyGroup, allyFromCompanion } from "../data/bestiary.js";
import { BASIC_ATTACK } from "../data/abilities.js";
import { recomputeVitalityMax, recomputeResolveMax } from "./attributes.js";

// Model-agnostic safety net for the combat rewrite.
//
// Every assertion here is deliberately independent of HOW combat resolves — no
// deck, no energy, no per-profession resource, no card. They are the properties
// that must hold under the current deck loop AND under the round loop that
// replaces it, so this file survives the migration intact and is the thing that
// catches a rewrite quietly breaking the engine.
//
// It is written against the CURRENT engine and must be green before anything
// moves. A test that cannot be written today is not protecting the migration.

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TERMINAL = new Set(["victory", "defeat", "resolved", "playerFled"]);
const HARD_CAP = 400;

const CODEX = {
  characters: { wanderer: { id: "wanderer", worn: ["w", "a"] } },
  items: {
    w: { id: "w", name: "Iron Shortsword", kind: "weapon", tier: "common", combat: { damage: { min: 5, max: 8, type: "physical", pen: 0 } } },
    a: { id: "a", name: "Leather Armor", kind: "armor", tier: "common", combat: { armor: 3 } },
  },
};

function makePlayer() {
  const c = {
    name: "Hero",
    attributes: { body: 6, reflex: 6, vigor: 6, mind: 4, wit: 4, presence: 3 },
    abilities: [{ id: "power-strike", tier: "common" }],
    proficiencies: {},
  };
  recomputeVitalityMax(c);
  recomputeResolveMax(c);
  c.resolve = c.resolveMax;
  return c;
}

const combatants = (cs) => [cs?.player, ...(cs?.allies || []), ...(cs?.enemies || [])].filter(Boolean);

// Walks the whole state graph looking for numbers that have gone non-finite.
// A single NaN in a damage or stat field silently poisons every downstream
// comparison, and `NaN` fails no ordinary assertion — it has to be hunted.
function findNonFinite(value, path = "", out = [], seen = new WeakSet()) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) out.push(`${path} = ${value}`);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  if (seen.has(value)) return out;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) findNonFinite(value[i], `${path}[${i}]`, out, seen);
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    findNonFinite(child, path ? `${path}.${key}` : key, out, seen);
  }
  return out;
}

function assertStateSane(cs, label) {
  const nonFinite = findNonFinite(cs);
  expect(nonFinite.slice(0, 5), `${label}: non-finite numbers in combat state`).toEqual([]);

  for (const c of combatants(cs)) {
    expect(Number.isFinite(c.health), `${label}: ${c.name} has non-numeric health`).toBe(true);
    expect(Number.isFinite(c.maxHealth), `${label}: ${c.name} has non-numeric maxHealth`).toBe(true);
    expect(c.maxHealth, `${label}: ${c.name} has non-positive maxHealth`).toBeGreaterThan(0);
    expect(c.health, `${label}: ${c.name} health ${c.health} exceeds max ${c.maxHealth}`)
      .toBeLessThanOrEqual(c.maxHealth);
    expect(c.health, `${label}: ${c.name} health went below zero (${c.health})`)
      .toBeGreaterThanOrEqual(0);
    if (c.resolve != null) {
      expect(c.resolve, `${label}: ${c.name} has negative resolve`).toBeGreaterThanOrEqual(0);
    }
    expect(Array.isArray(c.statuses), `${label}: ${c.name} statuses is not an array`).toBe(true);
  }
  expect(typeof cs.phase, `${label}: phase is not a string`).toBe("string");
}

// A deliberately dumb greedy policy. It is not trying to play well — it is
// trying to reach as many engine branches as possible without special-casing
// any particular loop model.
function runFight(cs0, { cap = HARD_CAP } = {}) {
  let cs = cs0;
  let steps = 0;
  assertStateSane(cs, "init");

  while (!TERMINAL.has(cs.phase) && steps < cap) {
    steps += 1;
    const before = cs;

    if (cs.phase !== "player") {
      cs = endTurn(cs);
    } else {
      const target = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved && !e._dead);
      if (target < 0) {
        cs = canStandDown(cs) ? playerStandDown(cs) : endTurn(cs);
      } else {
        const ability = abilityUsable(cs, "power-strike") ? "power-strike" : BASIC_ATTACK.id;
        cs = playerAct(cs, ability, target);
        if (!TERMINAL.has(cs.phase)) cs = endTurn(cs);
      }
    }

    expect(cs, `step ${steps}: an engine call returned null/undefined`).toBeTruthy();
    assertStateSane(cs, `step ${steps}`);
    // Enemies are cloned at init and never re-rolled mid-fight; a growing roster
    // means something is minting combatants during resolution.
    expect(cs.enemies.length, `step ${steps}: enemy roster grew mid-fight`)
      .toBeLessThanOrEqual(before.enemies.length);
  }

  return { cs, steps };
}

const KINDS = Object.keys(BESTIARY);

// Both combat loops must satisfy the same invariants. The deck path is what
// ships today; the round path is what replaces it. Running one fuzz over both
// is the whole point of writing these assertions model-agnostically — the round
// loop inherits the safety net instead of needing a new one.
const LOOPS = ["deck", "round"];

describe("combat invariants — full-bestiary fuzz", () => {
  afterEach(() => vi.restoreAllMocks());

  it("covers the whole authored bestiary", () => {
    expect(KINDS.length).toBeGreaterThanOrEqual(30);
  });

  // 32 kinds x 3 seeds x 2 loops. Every fight is checked at every step, so a
  // violation names the loop, the kind, the seed, the step, and the field.
  for (const kind of KINDS) {
    it(`terminates cleanly and stays sane: ${kind}`, () => {
      for (const loop of LOOPS) {
        for (const seed of [11, 4242, 90210]) {
          vi.spyOn(Math, "random").mockImplementation(mulberry32(seed));
          const enemies = generateEnemyGroup(kind, { count: 2, maxTier: "rare" });
          const cs0 = initCombat(makePlayer(), CODEX, enemies, { loop, seed: `inv-${kind}-${seed}` });
          const { cs, steps } = runFight(cs0);

          expect(steps, `${loop}/${kind}/${seed}: fight did not terminate within ${HARD_CAP} steps`)
            .toBeLessThan(HARD_CAP);
          expect(TERMINAL.has(cs.phase), `${loop}/${kind}/${seed}: ended in non-terminal phase "${cs.phase}"`)
            .toBe(true);
          vi.restoreAllMocks();
        }
      }
    });
  }
});

describe("round loop", () => {
  afterEach(() => vi.restoreAllMocks());

  const startRound = (opts = {}) => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(21));
    return initCombat(makePlayer(), CODEX, generateEnemyGroup("bandits", { count: 2, maxTier: "common" }), {
      loop: "round", seed: "round-loop", ...opts,
    });
  };

  it("builds no deck at all", () => {
    const cs = startRound();
    expect(cs.loop).toBe("round");
    expect(cs.deck).toBeUndefined();
  });

  it("still builds a deck on the default loop", () => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(21));
    const cs = initCombat(makePlayer(), CODEX, generateEnemyGroup("bandits", { count: 1, maxTier: "common" }), {
      seed: "deck-loop",
    });
    expect(cs.loop).toBe("deck");
    expect(cs.deck).toBeTruthy();
  });

  it("hands control to the player with a real initiative order", () => {
    const cs = startRound();
    expect(["player", ...TERMINAL]).toContain(cs.phase);
    expect(Array.isArray(cs.order)).toBe(true);
    expect(cs.order.length).toBeGreaterThan(0);
  });

  it("telegraphs enemy intents before the player acts", () => {
    const cs = startRound();
    const live = cs.enemies.filter((e) => e.health > 0 && !e.resolved);
    expect(live.length).toBeGreaterThan(0);
    // At least one standing foe has declared what it is about to do. That is the
    // read the whole model rests on — it must exist at the moment of decision.
    expect(live.some((e) => e.intent || (e.intents || []).length > 0)).toBe(true);
  });

  it("survives a JSON round-trip like the deck loop does", () => {
    const cs = startRound();
    expect(JSON.parse(JSON.stringify(cs))).toEqual(cs);
  });

  it("runs an ambush from either side", () => {
    for (const ambush of ["player", "enemy"]) {
      const { cs, steps } = runFight(startRound({ ambush }));
      expect(steps, `round/ambush=${ambush} did not terminate`).toBeLessThan(HARD_CAP);
      expect(TERMINAL.has(cs.phase)).toBe(true);
      vi.restoreAllMocks();
    }
  });
});

describe("telegraphs", () => {
  afterEach(() => vi.restoreAllMocks());

  const VALID_TAGS = new Set(["heavy", "flurry", "unblockable", "grapple"]);

  it("only ever emits tags the archetype layer defines", () => {
    for (const loop of LOOPS) {
      for (const kind of ["bandits", "wolves", "orc-raiders", "ogre", "giant-spider"]) {
        vi.spyOn(Math, "random").mockImplementation(mulberry32(88));
        const cs = initCombat(makePlayer(), CODEX, generateEnemyGroup(kind, { count: 3, maxTier: "epic" }), {
          loop, seed: `tel-${loop}-${kind}`,
        });
        for (const enemy of cs.enemies) {
          for (const intent of enemy.intents || []) {
            if (intent.telegraph === null || intent.telegraph === undefined) continue;
            expect(VALID_TAGS.has(intent.telegraph), `${kind} emitted bogus telegraph "${intent.telegraph}"`)
              .toBe(true);
          }
        }
        vi.restoreAllMocks();
      }
    }
  });

  it("names exactly one lead intent when anything is threatening", () => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(12));
    const cs = initCombat(makePlayer(), CODEX, generateEnemyGroup("bandits", { count: 4, maxTier: "rare" }), {
      loop: "round", seed: "tel-lead",
    });
    if (cs.leadIntentId) {
      const owner = cs.enemies.find((e) => e.uid === cs.leadIntentUid);
      expect(owner, "lead intent points at an enemy that is not on the field").toBeTruthy();
      expect((owner.intents || []).some((i) => i.id === cs.leadIntentId)).toBe(true);
      expect(cs.leadTelegraph ?? null).toBe(
        (owner.intents || []).find((i) => i.id === cs.leadIntentId).telegraph ?? null,
      );
    }
  });

  it("prefers a tagged intent over a merely bigger untagged one", () => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(51));
    const cs = initCombat(makePlayer(), CODEX, generateEnemyGroup("wargs", { count: 3, maxTier: "epic" }), {
      loop: "round", seed: "tel-prefer",
    });
    const allIntents = cs.enemies.flatMap((e) => e.intents || []).filter((i) => i.kind !== "pass");
    if (allIntents.some((i) => i.telegraph)) {
      const lead = allIntents.find((i) => i.id === cs.leadIntentId);
      expect(lead?.telegraph, "a tagged intent existed but the lead was untagged").toBeTruthy();
    }
  });

  it("re-declares intents each round rather than leaving a stale read", () => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(19));
    let cs = initCombat(makePlayer(), CODEX, generateEnemyGroup("bandits", { count: 2, maxTier: "common" }), {
      loop: "round", seed: "tel-fresh",
    });
    const roundOf = (state) => state.round || state.turn;
    const firstRound = roundOf(cs);
    const firstIds = cs.enemies.flatMap((e) => (e.intents || []).map((i) => i.id));

    let steps = 0;
    while (!TERMINAL.has(cs.phase) && roundOf(cs) === firstRound && steps < 40) {
      steps += 1;
      if (cs.phase !== "player") { cs = endTurn(cs); continue; }
      const target = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved && !e._dead);
      if (target < 0) { cs = endTurn(cs); continue; }
      cs = playerAct(cs, BASIC_ATTACK.id, target);
      if (!TERMINAL.has(cs.phase)) cs = endTurn(cs);
    }

    if (!TERMINAL.has(cs.phase) && roundOf(cs) > firstRound) {
      const laterIds = cs.enemies.flatMap((e) => (e.intents || []).map((i) => i.id));
      // Intent ids embed the round, so a carried-over id means the player is
      // reading last round's threat.
      for (const id of laterIds) {
        expect(firstIds.includes(id), `intent ${id} survived into a later round`).toBe(false);
      }
    }
  });
});

// The tag-validity test above is satisfied by an implementation that only ever
// emits one tag — and measured against the live bestiary, that is exactly what
// happens today (only `heavy`, on 3.5% of 768 intents across 8 kinds x 4 tier
// caps). These unit tests pin the classifier's four branches directly, so a real
// regression in the logic stays distinguishable from the separate DATA gap
// recorded on telegraphFor: no current enemy action is multi-hit, stun-applying,
// or true-damage, so Guard is never the correct answer until Phase 4 authors
// actions that produce those tags.
describe("telegraphFor — classifier branches", () => {
  const target = { maxHealth: 100 };
  const physical = { type: "physical" };

  it("tags a lone blow that takes a big bite out of the target as heavy", () => {
    expect(telegraphFor({}, physical, 1, 40, target)).toBe("heavy");
  });

  it("leaves an ordinary single swing untagged", () => {
    expect(telegraphFor({}, physical, 1, 8, target)).toBe(null);
  });

  it("tags a multi-hit action as a flurry, regardless of size", () => {
    expect(telegraphFor({}, physical, 3, 4, target)).toBe("flurry");
    expect(telegraphFor({}, physical, 2, 90, target)).toBe("flurry");
  });

  it("tags true damage as unblockable, ahead of every other reading", () => {
    expect(telegraphFor({}, { type: "true" }, 1, 5, target)).toBe("unblockable");
    expect(telegraphFor({}, { type: "true" }, 4, 90, target)).toBe("unblockable");
  });

  it("tags a stun-applying single blow as a grapple", () => {
    expect(telegraphFor({ effect: { type: "stun" } }, physical, 1, 5, target)).toBe("grapple");
  });

  it("threatens nothing when there is no attack profile", () => {
    expect(telegraphFor({ effect: { type: "rally" } }, null, 1, 0, target)).toBe(null);
  });

  it("does not divide by zero on a target with no health", () => {
    expect(() => telegraphFor({}, physical, 1, 5, { maxHealth: 0 })).not.toThrow();
    expect(() => telegraphFor({}, physical, 1, 5, undefined)).not.toThrow();
  });

  it("scales the heavy threshold to the target, not to a flat number", () => {
    // 30 damage is heavy to a 60hp target and ordinary to a 300hp one.
    expect(telegraphFor({}, physical, 1, 30, { maxHealth: 60 })).toBe("heavy");
    expect(telegraphFor({}, physical, 1, 30, { maxHealth: 300 })).toBe(null);
  });
});

describe("stamina", () => {
  afterEach(() => vi.restoreAllMocks());

  it("seeds a pool on every combatant, on both loops", () => {
    for (const loop of LOOPS) {
      vi.spyOn(Math, "random").mockImplementation(mulberry32(3));
      const cs = initCombat(makePlayer(), CODEX, generateEnemyGroup("bandits", { count: 2, maxTier: "common" }), {
        loop, seed: `stam-${loop}`,
      });
      for (const c of combatants(cs)) {
        expect(c.staminaMax, `${loop}: ${c.name} has no stamina pool`).toBeGreaterThan(0);
        expect(c.stamina, `${loop}: ${c.name} stamina above max`).toBeLessThanOrEqual(c.staminaMax);
        expect(c.stamina, `${loop}: ${c.name} negative stamina`).toBeGreaterThanOrEqual(0);
        expect(c.combatArchetypeId, `${loop}: ${c.name} has no combat archetype`).toBeTruthy();
      }
      vi.restoreAllMocks();
    }
  });

  it("never lets stamina leave [0, staminaMax] across a whole fight", () => {
    for (const loop of LOOPS) {
      vi.spyOn(Math, "random").mockImplementation(mulberry32(64));
      const cs0 = initCombat(makePlayer(), CODEX, generateEnemyGroup("wargs", { count: 3, maxTier: "rare" }), {
        loop, seed: `stam-bounds-${loop}`,
      });
      const { cs } = runFight(cs0);
      for (const c of combatants(cs)) {
        expect(c.stamina).toBeGreaterThanOrEqual(0);
        expect(c.stamina).toBeLessThanOrEqual(c.staminaMax);
      }
      vi.restoreAllMocks();
    }
  });

  // spendStamina is exported and has no in-engine callers yet — Guard and Evade
  // wire into it when the round loop becomes the default. It is tested now
  // precisely because it ships without callers: untested public API that nothing
  // exercises is how a silent bug reaches production.
  describe("spendStamina", () => {
    const actorAt = (stamina) => ({ name: "Test", stamina, staminaMax: 20, staggered: false });
    const stateFor = (actor) => ({ player: actor, allies: [], enemies: [], log: [] });

    it("deducts the cost and reports payment when the pool covers it", () => {
      const actor = actorAt(10);
      const cs = stateFor(actor);
      expect(spendStamina(cs, actor, 6)).toBe(true);
      expect(actor.stamina).toBe(4);
      expect(actor.staggered).toBe(false);
      expect(cs.log).toHaveLength(0);
    });

    it("pays exactly to zero without staggering", () => {
      const actor = actorAt(6);
      expect(spendStamina(stateFor(actor), actor, 6)).toBe(true);
      expect(actor.stamina).toBe(0);
      expect(actor.staggered).toBe(false);
    });

    it("staggers, floors at zero, and still lets the action happen when short", () => {
      const actor = actorAt(2);
      const cs = stateFor(actor);
      expect(spendStamina(cs, actor, 6)).toBe(false);
      expect(actor.stamina).toBe(0);       // never negative
      expect(actor.staggered).toBe(true);
      expect(cs.log).toHaveLength(1);
    });

    it("announces a broken guard once, not every round", () => {
      const actor = actorAt(0);
      const cs = stateFor(actor);
      spendStamina(cs, actor, 5);
      spendStamina(cs, actor, 5);
      spendStamina(cs, actor, 5);
      expect(actor.staggered).toBe(true);
      expect(cs.log, "repeated stagger spam the combat log").toHaveLength(1);
    });

    it("names the actor for a foe and addresses the player directly", () => {
      const foe = { ...actorAt(0), name: "Bandit" };
      const foeState = { player: { name: "You" }, allies: [], enemies: [foe], log: [] };
      spendStamina(foeState, foe, 5);
      expect(foeState.log[0].text).toContain("Bandit");

      const you = actorAt(0);
      const youState = stateFor(you);
      spendStamina(youState, you, 5);
      expect(youState.log[0].text).toContain("Your guard breaks");
    });

    it("is a no-op for a free action or a missing actor", () => {
      const actor = actorAt(10);
      const cs = stateFor(actor);
      expect(spendStamina(cs, actor, 0)).toBe(true);
      expect(spendStamina(cs, actor, -3)).toBe(true);
      expect(spendStamina(cs, null, 5)).toBe(true);
      expect(actor.stamina).toBe(10);
      expect(cs.log).toHaveLength(0);
    });

    it("treats a combatant with no stamina field as already spent", () => {
      const actor = { name: "Odd", staggered: false };
      const cs = stateFor(actor);
      expect(spendStamina(cs, actor, 4)).toBe(false);
      expect(actor.stamina).toBe(0);
      expect(actor.staggered).toBe(true);
    });
  });

  it("resolves the player's archetype from their profession", () => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(3));
    const character = makePlayer();
    character.progression = { professionId: "wizard" };
    const cs = initCombat(character, CODEX, generateEnemyGroup("bandits", { count: 1, maxTier: "common" }), {
      loop: "round", seed: "stam-arch",
    });
    expect(cs.player.combatArchetypeId).toBe("channeler");
  });
});

describe("combat invariants — party and edge shapes", () => {
  afterEach(() => vi.restoreAllMocks());

  it("holds with allies in the line", () => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(7));
    const companion = allyFromCompanion(
      { id: "friend", name: "Wick", race: "human", attributes: { body: 5, reflex: 4, vigor: 5, mind: 2, wit: 3, presence: 3 } },
      CODEX,
      { tierId: "common" },
    );
    const cs0 = initCombat(makePlayer(), CODEX, generateEnemyGroup("bandits", { count: 3, maxTier: "rare" }), {
      allies: [companion], seed: "inv-party",
    });
    const { cs, steps } = runFight(cs0);
    expect(steps).toBeLessThan(HARD_CAP);
    expect(TERMINAL.has(cs.phase)).toBe(true);
  });

  it("holds when ambushed from either side", () => {
    for (const ambush of ["player", "enemy"]) {
      vi.spyOn(Math, "random").mockImplementation(mulberry32(31));
      const cs0 = initCombat(makePlayer(), CODEX, generateEnemyGroup("wolves", { count: 2, maxTier: "rare" }), {
        ambush, seed: `inv-ambush-${ambush}`,
      });
      const { cs, steps } = runFight(cs0);
      expect(steps, `ambush=${ambush} did not terminate`).toBeLessThan(HARD_CAP);
      expect(TERMINAL.has(cs.phase), `ambush=${ambush} ended in "${cs.phase}"`).toBe(true);
      vi.restoreAllMocks();
    }
  });

  it("holds for a non-lethal brawl", () => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(55));
    const cs0 = initCombat(makePlayer(), CODEX, generateEnemyGroup("bandits", { count: 2, maxTier: "common" }), {
      lethal: false, seed: "inv-brawl",
    });
    const { cs, steps } = runFight(cs0);
    expect(steps).toBeLessThan(HARD_CAP);
    expect(TERMINAL.has(cs.phase)).toBe(true);
  });

  it("holds against an unknown kind routed through inferTemplate", () => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(77));
    const cs0 = initCombat(makePlayer(), CODEX, generateEnemyGroup("clockwork-abomination", { count: 1, maxTier: "rare" }), {
      seed: "inv-inferred",
    });
    const { cs, steps } = runFight(cs0);
    expect(steps).toBeLessThan(HARD_CAP);
    expect(TERMINAL.has(cs.phase)).toBe(true);
  });
});

// The precondition for persisting an in-progress fight (Phase 2). Combat state
// currently lives only in an App.jsx useState and is lost on refresh; it can
// only move into the saved campaign blob if it is pure, serializable data.
// A Map, Set, function, or circular reference anywhere in the graph breaks that,
// and would do so silently — JSON.stringify turns a Set into `{}`.
describe("combat state is serializable", () => {
  afterEach(() => vi.restoreAllMocks());

  it("survives a JSON round-trip losslessly at init", () => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(5));
    const cs = initCombat(makePlayer(), CODEX, generateEnemyGroup("orc-raiders", { count: 2, maxTier: "rare" }), {
      seed: "inv-serialize",
    });
    expect(JSON.parse(JSON.stringify(cs))).toEqual(cs);
  });

  it("survives a JSON round-trip losslessly mid-fight and at the end", () => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(13));
    let cs = initCombat(makePlayer(), CODEX, generateEnemyGroup("goblins", { count: 3, maxTier: "rare" }), {
      seed: "inv-serialize-mid",
    });
    let steps = 0;
    let checkedMidFight = false;
    while (!TERMINAL.has(cs.phase) && steps < HARD_CAP) {
      steps += 1;
      if (cs.phase !== "player") { cs = endTurn(cs); continue; }
      const target = cs.enemies.findIndex((e) => e.health > 0 && !e.resolved && !e._dead);
      if (target < 0) { cs = endTurn(cs); continue; }
      cs = playerAct(cs, abilityUsable(cs, "power-strike") ? "power-strike" : BASIC_ATTACK.id, target);
      if (steps === 2) {
        expect(JSON.parse(JSON.stringify(cs)), "mid-fight state is not round-trip safe").toEqual(cs);
        checkedMidFight = true;
      }
      if (!TERMINAL.has(cs.phase)) cs = endTurn(cs);
    }
    expect(checkedMidFight, "fight ended before a mid-fight snapshot could be taken").toBe(true);
    expect(JSON.parse(JSON.stringify(cs)), "terminal state is not round-trip safe").toEqual(cs);
  });
});
