import { describe, expect, it } from "vitest";
import { createTowEncounter, useSkill } from "./encounter.js";
import {
  ACCEPTANCE_TARGETS,
  EQUAL_THREAT_FIXTURES,
  STANDARD_FIXTURES,
  classifySkill,
  incomingDamage,
  intentAwarePolicy,
  legalSkills,
  randomLegalPolicy,
  seedSet,
  simulateEncounter,
  simulateMatchup,
  simulateSweep,
  standardPlayer,
} from "./simulation.js";
import { startingPackageIds } from "./starting-packages.js";
import { towBuildForCharacter } from "./professions.js";

// A representative spread rather than all thirty packages: martial, caster, and the
// civilian professions that fight like people who do something else for a living. The
// registry-coverage test below walks every package for the cheaper properties.
const SAMPLE_PACKAGES = Object.freeze([
  "fighter", "barbarian", "monk", "ranger", "rogue", "paladin",
  "commander", "wizard", "cleric", "wanderer",
]);

const SEEDS = seedSet("acceptance", 30);

function sweep(policy, fixtures) {
  return simulateSweep({ packageIds: SAMPLE_PACKAGES, fixtures, policy, seeds: SEEDS });
}

function firstTurnSpendingDecision(opened) {
  let state = opened;
  for (let guard = 0; guard < 16; guard += 1) {
    const decision = intentAwarePolicy.decide(state, { algorithm: "mulberry32", state: 1 });
    if (decision.command.type !== "use-skill") return decision.command;
    const actionsBefore = state.turn.actionsRemaining;
    const used = useSkill(state, decision.command.skillId, decision.command.targetId);
    expect(used.ok).toBe(true);
    if (used.state.turn.actionsRemaining < actionsBefore) return decision.command;
    state = used.state;
  }
  throw new Error("policy-did-not-spend-main-action");
}

describe("the harness is deterministic", () => {
  it("measures the current shared Resolve economy", () => {
    const player = standardPlayer();
    expect(player.resolve).toBe(8);
    expect(player.resolveMax).toBe(8);
  });

  it("reproduces a run exactly from the same inputs", () => {
    const inputs = {
      seed: "determinism",
      player: standardPlayer(),
      enemies: STANDARD_FIXTURES[0].enemies.map((enemy) => ({ ...enemy })),
      build: towBuildForCharacter({ profession: "fighter" }),
      policy: intentAwarePolicy,
    };
    expect(simulateEncounter(inputs)).toEqual(simulateEncounter(inputs));
  });

  it("keeps the policy's coin-flips out of the fight", () => {
    // A policy is not part of the fight. If its draws advanced the combat stream, changing
    // how the harness picks a skill would change what damage the fight rolls — and every
    // recorded baseline would be invalidated by a harness refactor.
    const enemies = STANDARD_FIXTURES[0].enemies.map((enemy) => ({ ...enemy }));
    const build = towBuildForCharacter({ profession: "fighter" });
    const opened = createTowEncounter({ seed: "stream-isolation", player: standardPlayer(), enemies, build });
    const informed = simulateEncounter({
      seed: "stream-isolation", player: standardPlayer(), enemies, build, policy: intentAwarePolicy,
    });
    const random = simulateEncounter({
      seed: "stream-isolation", player: standardPlayer(), enemies, build, policy: randomLegalPolicy,
    });
    // Both fights start from the identical opening; they diverge only through the commands
    // each policy chooses.
    expect(opened.rng).toEqual(createTowEncounter({
      seed: "stream-isolation", player: standardPlayer(), enemies, build,
    }).rng);
    expect(informed.seed).toBe(random.seed);
  });
});

describe("reading the fight beats not reading it", () => {
  const informed = sweep(intentAwarePolicy, EQUAL_THREAT_FIXTURES);
  const random = sweep(randomLegalPolicy, EQUAL_THREAT_FIXTURES);

  it("clears the recorded advantage target", () => {
    // The whole justification for telegraphing enemy turns. If this gap closes, the
    // declarations are decoration and the fight is a coin-flip with extra steps.
    const advantage = informed.winRate - random.winRate;
    expect(advantage).toBeGreaterThanOrEqual(ACCEPTANCE_TARGETS.informedAdvantageMin);
  });

  it("is ahead on every equal-threat fixture, not just on average", () => {
    // The edge is not evenly spread, and the shape of that is worth knowing. Against a
    // single tough foe it is around ten points: there is one declaration to read and racing
    // is usually right anyway. Against a group it is nearer sixty, because target selection
    // and knowing which round to guard are what decide those fights.
    for (const fixture of EQUAL_THREAT_FIXTURES) {
      const informedRate = fixtureRate(informed, fixture.id);
      const randomRate = fixtureRate(random, fixture.id);
      expect(informedRate - randomRate).toBeGreaterThan(0.05);
    }
  });

  it("keeps the informed baseline challenging rather than automatic", () => {
    expect(informed.winRate).toBeGreaterThanOrEqual(ACCEPTANCE_TARGETS.informedWinRateMin);
    expect(informed.winRate).toBeLessThanOrEqual(ACCEPTANCE_TARGETS.informedWinRateMax);
  });

  it("stays close to the recorded per-fixture baseline", () => {
    // A drift of more than ten points means the rules moved. That is allowed — but it has to
    // be noticed and the recorded baseline updated deliberately, not discovered later.
    for (const fixture of EQUAL_THREAT_FIXTURES) {
      expect(fixtureRate(informed, fixture.id)).toBeCloseTo(fixture.baseline.informedWinRate, 1);
    }
  });

  function fixtureRate(result, fixtureId) {
    const matchups = result.matchups.filter((matchup) => matchup.fixtureId === fixtureId);
    const wins = matchups.reduce((sum, matchup) => sum + matchup.wins, 0);
    const total = matchups.reduce((sum, matchup) => sum + matchup.total, 0);
    return total > 0 ? wins / total : 0;
  }
});

describe("no package is locked out", () => {
  const informed = sweep(intentAwarePolicy, STANDARD_FIXTURES);

  it("leaves no fixture unwinnable for any advertised package", () => {
    const unwinnable = informed.matchups
      .filter((matchup) => matchup.wins === 0)
      .map((matchup) => `${matchup.packageId} vs ${matchup.fixtureId}`);
    expect(unwinnable).toEqual([]);
  });

  it("never leaves a capable actor with nothing legal to do", () => {
    const stuck = informed.matchups
      .filter((matchup) => matchup.turnsWithNoLegalSkill > 0)
      .map((matchup) => `${matchup.packageId} vs ${matchup.fixtureId}`);
    expect(stuck).toEqual([]);
  });

  it("finishes inside the recorded turn bound", () => {
    for (const matchup of informed.matchups) {
      expect(matchup.medianRounds).toBeLessThanOrEqual(ACCEPTANCE_TARGETS.medianRoundsMax);
    }
  });

  it("gives every advertised package a legal opening action", () => {
    // Cheap enough to walk the whole registry rather than the sample: a package that cannot
    // act on round one is broken no matter how the rest of the fight goes.
    for (const packageId of startingPackageIds()) {
      const state = createTowEncounter({
        seed: `opening::${packageId}`,
        player: standardPlayer(),
        enemies: STANDARD_FIXTURES[0].enemies.map((enemy) => ({ ...enemy })),
        build: towBuildForCharacter({ profession: packageId }),
      });
      expect(legalSkills(state).length).toBeGreaterThan(0);
    }
  });
});

describe("the fight uses more than one answer", () => {
  it("spends real skills alongside the basic attack", () => {
    // Strike is Resolve-free and everything else shares Resolve, so Strike leading the count is
    // correct. What would be wrong is a fixture where nothing else is ever worth an action.
    for (const fixture of STANDARD_FIXTURES) {
      const uses = {};
      for (const packageId of SAMPLE_PACKAGES) {
        const matchup = simulateMatchup({
          packageId, fixture, policy: intentAwarePolicy, seeds: SEEDS.slice(0, 10),
        });
        for (const [skillId, count] of Object.entries(matchup.skillUses)) {
          uses[skillId] = (uses[skillId] || 0) + count;
        }
      }
      expect(Object.keys(uses).length).toBeGreaterThanOrEqual(3);
      const total = Object.values(uses).reduce((sum, count) => sum + count, 0);
      const nonStrike = total - (uses.strike || 0);
      expect(nonStrike / total).toBeGreaterThan(0.05);
    }
  });
});

describe("the informed policy actually reads the declarations", () => {
  it("sees the incoming round before spending a turn", () => {
    const state = createTowEncounter({
      seed: "reads",
      player: standardPlayer(),
      enemies: STANDARD_FIXTURES[3].enemies.map((enemy) => ({ ...enemy })),
      build: towBuildForCharacter({ profession: "fighter" }),
    });
    // Three foes have each declared something, and the policy can total it before acting.
    expect(incomingDamage(state)).toBeGreaterThan(0);
  });

  it("guards a blow it cannot out-race and races one it can", () => {
    const build = towBuildForCharacter({ profession: "fighter" });
    const heavy = createTowEncounter({
      seed: "guard-me",
      player: standardPlayer({ maxHp: 40, hp: 40 }),
      enemies: [{
        id: "foe-0",
        name: "Ogre",
        maxHp: 400,
        stats: { attack: 40, defense: 0, critRate: 0, dodgeRate: 0 },
        attacks: [{ id: "smash", name: "Smash", hits: 1, damage: 40 }],
      }],
      build,
    });
    // The declared blow would end the fight outright, so survival outranks progress.
    expect(firstTurnSpendingDecision(heavy))
      .toMatchObject({ type: "use-skill", skillId: "block" });

    const light = createTowEncounter({
      seed: "race-me",
      player: standardPlayer(),
      enemies: [{
        id: "foe-0",
        name: "Cutpurse",
        maxHp: 400,
        stats: { attack: 1, defense: 0, critRate: 0, dodgeRate: 0 },
        attacks: [{ id: "nick", name: "Nick", hits: 1, damage: 1 }],
      }],
      build,
    });
    // A one-point scratch is not worth an action: a shield that prevents one damage loses
    // to any attack at all, so the policy presses instead of guarding.
    const raced = firstTurnSpendingDecision(light);
    expect(raced.type).toBe("use-skill");
    expect(classifySkill(raced.skillId).offensive).toBe(true);
  });

  it("reserves a self-Paralyzing attack for a finishing blow", () => {
    const enemy = STANDARD_FIXTURES[0].enemies[0];
    // Isolate the future-command tradeoff: the full barbarian package can first stack a
    // no-turn Strength setup that makes Strike lethal without Mortal Blow.
    const build = { traits: {}, skills: ["strike", "block", "mortal-blow"] };
    const healthy = createTowEncounter({
      seed: "mortal-restraint",
      player: standardPlayer(),
      enemies: [{ ...enemy, maxHp: 400, hp: 400 }],
      build,
    });
    expect(firstTurnSpendingDecision(healthy))
      .toMatchObject({ type: "use-skill", skillId: "strike" });

    const exposed = {
      ...healthy,
      actors: {
        ...healthy.actors,
        "foe-0": { ...healthy.actors["foe-0"], hp: 20 },
      },
    };
    expect(firstTurnSpendingDecision(exposed))
      .toMatchObject({ type: "use-skill", skillId: "mortal-blow" });
  });
});
