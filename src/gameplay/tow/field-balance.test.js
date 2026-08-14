// What a fight actually feels like at the table, rather than on a fixture.
//
// The acceptance gates in simulation.test.js measure authored fixtures against a fixed
// standard actor, which is the right way to compare packages to each other. It is not a
// measure of the game: a real fight is a real character, built through the bridge from
// attributes and worn gear, against a real bestiary group.
//
// This measures that. It exists because the fixture sweep turned up per-package medians as
// long as forty rounds, and a forty-round fight is an attritional slog in a UI where every
// round is a couple of clicks — doubly so now that skill uses carry between fights. A number
// nobody checks is a number that drifts, so it is checked here.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { generateEnemyGroup } from "../../data/bestiary.js";
import { makeInitialState } from "../../data/initial-state.js";
import { createTowEncounter, endTurn, useSkill } from "./encounter.js";
import { towBuildForCharacter } from "./professions.js";
import { skillStatesForReadiness } from "./readiness.js";
import { intentAwarePolicy, legalSkills } from "./simulation.js";
import { towEnemyFromBestiary, towPlayerFromCharacter } from "./solitaire-bridge.js";
import { createRng } from "../kernel/rng.js";

// Bestiary generation draws on Math.random for group size, tier and stat spread, so a
// measurement built on it would flake — and a balance gate that fails one run in twenty
// teaches people to re-run it rather than read it. Seeding the global for the duration
// keeps the real generation path in the test while making the numbers repeatable.
let restoreRandom;

beforeAll(() => {
  let state = 0x9e3779b9;
  restoreRandom = vi.spyOn(Math, "random").mockImplementation(() => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  });
});

afterAll(() => {
  restoreRandom?.mockRestore();
});

/** A real starting character, as the opening interview leaves them. */
function fieldCharacter(profession) {
  const state = makeInitialState();
  return {
    character: { ...state.character, profession, abilities: [], conditions: [], racialPassives: [] },
    codex: state.world.codex,
  };
}

/** Real bestiary foes, including the authored abilities used to choose their Tower kit. */
function fieldEnemies(kind, seedIndex) {
  return generateEnemyGroup(kind, { power: 1 + (seedIndex % 3), maxTier: "common" });
}

function playOut(seed, profession, kind, seedIndex) {
  const { character, codex } = fieldCharacter(profession);
  const enemies = fieldEnemies(kind, seedIndex);
  const build = towBuildForCharacter(character);
  let state = createTowEncounter({
    seed,
    player: towPlayerFromCharacter(character, codex, { id: "wanderer" }),
    enemies: enemies.map((enemy, index) => towEnemyFromBestiary(enemy, { id: `foe-${index}` })),
    build: { ...build, skills: skillStatesForReadiness(build.skills, {}) },
  });
  let rng = createRng(`${seed}::policy`);
  let guard = 0;
  while (state.phase === "player" && guard < 400) {
    guard += 1;
    const decision = intentAwarePolicy.decide(state, rng);
    rng = decision.rng;
    if (decision.command.type === "end-turn") {
      const ended = endTurn(state);
      if (!ended.ok) break;
      state = ended.state;
      continue;
    }
    const used = useSkill(state, decision.command.skillId, decision.command.targetId);
    if (!used.ok) {
      const ended = endTurn(state);
      if (!ended.ok) break;
      state = ended.state;
      continue;
    }
    state = used.state;
  }
  return { rounds: state.round, outcome: state.phase, state };
}

const PROFESSIONS = ["fighter", "wanderer", "cleric", "rogue"];
const KINDS = ["bandits", "wolves"];

// Computed lazily, on first use inside a test body. Building the runs in the describe body
// would evaluate them during collection — before `beforeAll` installs the seeded generator —
// so the seeding would silently never apply and the whole gate would go back to depending on
// the dice. Memoised so every test reads the same set.
let cachedRuns = null;

function fieldRuns() {
  if (cachedRuns) return cachedRuns;
  const runs = [];
  for (const profession of PROFESSIONS) {
    for (const kind of KINDS) {
      for (let index = 0; index < 6; index += 1) {
        runs.push(playOut(`field::${profession}::${kind}::${index}`, profession, kind, index));
      }
    }
  }
  cachedRuns = runs;
  return runs;
}

function median(values) {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

describe("a real fight at the table", () => {
  it("reaches a decision rather than grinding to the safety limit", () => {
    const runs = fieldRuns();
    expect(runs.every((run) => run.outcome !== "player")).toBe(true);
  });

  it("is long enough to make a decision matter", () => {
    const runs = fieldRuns();
    // Under about three rounds there is no room to read a telegraph, spend a resource, or
    // change your mind — the fight resolves before it starts.
    expect(median(runs.map((run) => run.rounds))).toBeGreaterThanOrEqual(3);
  });

  it("is short enough not to become a clicking exercise", () => {
    const runs = fieldRuns();
    // Every round is a couple of clicks, and skill uses now carry to the next fight, so a
    // long fight costs the player twice. This is the bound the fixture sweep flagged; if a
    // balance change pushes real fights past it, that is worth knowing at the time.
    const rounds = runs.map((run) => run.rounds);
    expect(median(rounds)).toBeLessThanOrEqual(20);
    expect(Math.max(...rounds)).toBeLessThanOrEqual(60);
  });

  it("leaves the road winnable for an ordinary traveller", () => {
    const runs = fieldRuns();
    // Not every fight, and not by much — but a starting character meeting a common bandit
    // group on the road must retain a real route through. Correct enemy command windows now
    // let a free defensive setup resolve before the foe's ordinary action, moving this fixed
    // cohort from just over one quarter to 11/48 wins. Twenty percent records that deliberate
    // pressure without accepting the zero-win lockout caught by the package fixture sweep.
    const wins = runs.filter((run) => run.outcome === "victory").length;
    expect(wins / runs.length).toBeGreaterThan(0.20);
  });

  it("always leaves a capable actor something legal to do", () => {
    const runs = fieldRuns();
    for (const run of runs) {
      if (run.state.phase !== "player") continue;
      if (run.state.turn.actionsRemaining <= 0) continue;
      expect(legalSkills(run.state).length).toBeGreaterThan(0);
    }
  });
});
