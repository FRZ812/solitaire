import { describe, expect, it } from "vitest";
import {
  TOW_ABILITY_CATALOG_V2_LIST,
  TOW_ABILITY_STATUS_LIST_V2,
  TOW_ABILITY_ZONE_LIST_V2,
  TOW_DEFAULT_ABILITY_KITS_V2,
  getTowAbilityRulesV2,
} from "./ability-catalog-v2.js";
import { createTowEncounterGenesisV2 } from "./encounter-state-v2.js";
import {
  TOW_SIMULATION_GAUNTLET_CASES_V2,
  TOW_SIMULATION_GAUNTLET_V2_CHECKSUM,
  TOW_SIMULATION_RANK_TIERS_V2,
  TOW_SIMULATION_REQUIRED_COVERAGE_V2,
  aggregateTowSimulationTelemetryV2,
  calculateTowSimulationGauntletV2Checksum,
  runTowSimulationCaseV2,
  towSimulationRandomDrawsV2,
  validateTowSimulationCaseV2,
} from "./simulation-v2.js";

const SOLO_CASES = TOW_SIMULATION_GAUNTLET_CASES_V2
  .filter(({ kind }) => kind === "solo-mirror");
const MIXED_CASES = TOW_SIMULATION_GAUNTLET_CASES_V2
  .filter(({ kind }) => kind.startsWith("mixed-"));
const PROBE_CASES = TOW_SIMULATION_GAUNTLET_CASES_V2
  .filter(({ kind }) => kind === "ability-probe");
const COMBAT_CASES = TOW_SIMULATION_GAUNTLET_CASES_V2
  .filter(({ kind }) => kind !== "ability-probe");

function occupiedIndexes(cells) {
  return cells.flatMap((actorId, index) => actorId === null ? [] : [index]);
}

function hasInternalHole(cells) {
  const occupied = occupiedIndexes(cells);
  if (occupied.length < 2) return false;
  return cells.slice(occupied[0], occupied.at(-1) + 1).some((actorId) => actorId === null);
}

describe("v2 deterministic simulation gauntlet manifest", () => {
  it("pins 36 rank-tier solo mirrors, four mixed geometries, and 60 ability probes", () => {
    expect(SOLO_CASES).toHaveLength(12 * 3);
    expect(MIXED_CASES).toHaveLength(4);
    expect(PROBE_CASES).toHaveLength(60);
    expect(TOW_SIMULATION_GAUNTLET_CASES_V2).toHaveLength(100);
    expect(new Set(TOW_SIMULATION_GAUNTLET_CASES_V2.map(({ id }) => id)).size).toBe(100);
    expect(TOW_SIMULATION_GAUNTLET_CASES_V2.every((value) => (
      validateTowSimulationCaseV2(value).ok
    ))).toBe(true);
    expect(calculateTowSimulationGauntletV2Checksum())
      .toBe(TOW_SIMULATION_GAUNTLET_V2_CHECKSUM);
    expect(TOW_SIMULATION_GAUNTLET_V2_CHECKSUM).toBe("fnv1a64:943eff406e540c59");
  });

  it("represents every kit at exact rank 1, middle, and maximum ranks", () => {
    const observed = new Set();
    for (const caseSpec of SOLO_CASES) {
      const profileId = caseSpec.id.split(":")[1];
      const player = caseSpec.genesis.actors.find(({ side }) => side === "player");
      const enemy = caseSpec.genesis.actors.find(({ side }) => side === "enemy");
      expect(player.loadout).toEqual(enemy.loadout);
      expect(player.loadout.map(({ id }) => id).sort()).toEqual(
        [...TOW_DEFAULT_ABILITY_KITS_V2[profileId]].sort(),
      );
      for (const loadout of player.loadout) {
        const rankCount = getTowAbilityRulesV2(loadout.id).rankCount;
        const expectedRank = caseSpec.rankTier === "rank-1"
          ? 1
          : caseSpec.rankTier === "mid"
            ? Math.ceil(rankCount / 2)
            : rankCount;
        expect(loadout.rank, `${caseSpec.id}:${loadout.id}`).toBe(expectedRank);
      }
      observed.add(`${profileId}:${caseSpec.rankTier}`);
    }
    expect([...observed].sort()).toEqual(
      Object.keys(TOW_DEFAULT_ABILITY_KITS_V2).flatMap((profileId) => (
        TOW_SIMULATION_RANK_TIERS_V2.map((tier) => `${profileId}:${tier}`)
      )).sort(),
    );
  });

  it("materializes side-swapped 3v3/5v5 cases with deterministic holey formations", () => {
    expect(MIXED_CASES.map(({ sideSwapped }) => sideSwapped).sort())
      .toEqual([false, false, true, true]);
    for (const caseSpec of MIXED_CASES) {
      const opening = createTowEncounterGenesisV2(caseSpec.genesis);
      expect(opening.ok, `${caseSpec.id}:${opening.reason}`).toBe(true);
      expect(hasInternalHole(opening.state.formations.player), caseSpec.id).toBe(true);
      expect(hasInternalHole(opening.state.formations.enemy), caseSpec.id).toBe(true);
      const humanSide = caseSpec.sideSwapped ? "enemy" : "player";
      const aiSide = caseSpec.sideSwapped ? "player" : "enemy";
      expect(caseSpec.genesis.actors.filter(({ controller }) => controller === "human")
        .every(({ side }) => side === humanSide)).toBe(true);
      expect(caseSpec.genesis.actors.filter(({ controller }) => controller === "ai")
        .every(({ side }) => side === aiSide)).toBe(true);
    }
  });

  it("uses stable explicit bounded draws and rejects loose inputs", () => {
    const input = { scenarioId: "solo:knight:max", commandOrdinal: 7, count: 8 };
    expect(towSimulationRandomDrawsV2(input)).toEqual(
      towSimulationRandomDrawsV2(structuredClone(input)),
    );
    expect(towSimulationRandomDrawsV2(input)).toHaveLength(8);
    expect(towSimulationRandomDrawsV2(input).every((draw) => (
      Number.isSafeInteger(draw) && draw >= 0 && draw < 10_000
    ))).toBe(true);
    expect(() => towSimulationRandomDrawsV2({ ...input, random: true }))
      .toThrow("invalid-simulation-v2-draw-input");
  });
});

describe("v2 exhaustive ability/status/zone reachability probes", () => {
  const results = [];

  it.each(PROBE_CASES)("executes and persistence-proves $coverageAbilityId", (caseSpec) => {
    const result = runTowSimulationCaseV2({ case: caseSpec, verifyPersistence: true });
    expect(result.ok, `${caseSpec.id}:${result.reason}`).toBe(true);
    expect(result.stopReason).toBe("round-bound");
    expect(result.telemetry.reachedAbilityIds).toContain(caseSpec.coverageAbilityId);
    expect(result.telemetry.commands).toBeLessThanOrEqual(caseSpec.maxCommands);
    expect(result.telemetry.events).toBeLessThanOrEqual(caseSpec.maxEvents);
    expect(result.telemetry.reactions).toBeLessThanOrEqual(caseSpec.maxReactions);
    expect(result.verification).toMatchObject({
      ok: true,
      stateChecksum: result.verification.replayStateChecksum,
      decodedStateChecksum: result.verification.stateChecksum,
      sessionChecksum: result.session.checksum,
    });
    expect(result.verification.encodedBytes).toBeGreaterThan(0);
    results.push(result);
  });

  it("aggregates exact 60/30/7 reachability with all 12 reactions triggered", () => {
    expect(results).toHaveLength(PROBE_CASES.length);
    const aggregate = aggregateTowSimulationTelemetryV2(results);
    expect(aggregate.ok, JSON.stringify(aggregate.missing)).toBe(true);
    expect(aggregate.telemetry.reachedAbilityIds).toEqual(
      TOW_SIMULATION_REQUIRED_COVERAGE_V2.abilityIds,
    );
    expect(aggregate.telemetry.reachedStatusIds).toEqual(
      TOW_SIMULATION_REQUIRED_COVERAGE_V2.statusIds,
    );
    expect(aggregate.telemetry.reachedZoneIds).toEqual(
      TOW_SIMULATION_REQUIRED_COVERAGE_V2.zoneIds,
    );
    expect(aggregate.telemetry.reachedAbilityIds).toHaveLength(
      TOW_ABILITY_CATALOG_V2_LIST.length,
    );
    expect(aggregate.telemetry.reachedStatusIds).toHaveLength(
      TOW_ABILITY_STATUS_LIST_V2.length,
    );
    expect(aggregate.telemetry.reachedZoneIds).toHaveLength(
      TOW_ABILITY_ZONE_LIST_V2.length,
    );
    expect(aggregate.telemetry.triggeredReactionIds).toHaveLength(12);
    expect(aggregate.telemetry.zonePayloadStatusIds).toContain("restraint");
    expect(aggregate.telemetry.mutatedStatusIds).not.toContain("restraint");
    expect(aggregate.checksum).toMatch(/^simulation-v2:[0-9a-f]{16}$/);
  });
});

describe("v2 bounded AI gauntlet execution", () => {
  const results = [];

  it.each(COMBAT_CASES)("runs and persistence-proves $id", (caseSpec) => {
    const result = runTowSimulationCaseV2({ case: caseSpec, verifyPersistence: true });
    expect(result.ok, `${caseSpec.id}:${result.reason}`).toBe(true);
    expect(["terminal", "round-bound", "command-bound", "event-bound", "reaction-bound"])
      .toContain(result.stopReason);
    expect(result.telemetry.commands).toBeLessThanOrEqual(caseSpec.maxCommands);
    expect(result.telemetry.events).toBeLessThanOrEqual(caseSpec.maxEvents);
    expect(result.telemetry.reactions).toBeLessThanOrEqual(caseSpec.maxReactions);
    expect(result.telemetry.rounds).toBeLessThanOrEqual(caseSpec.maxRounds);
    expect(result.verification).toMatchObject({
      ok: true,
      stateChecksum: result.verification.replayStateChecksum,
      decodedStateChecksum: result.verification.stateChecksum,
      sessionChecksum: result.session.checksum,
    });
    expect(result.session.commands.some(({ command }) => command.type === "ai-step"))
      .toBe(true);
    expect(result.session.events.some(({ type }) => type === "ai-intent-declared"))
      .toBe(true);
    results.push(result);
  }, 30_000);

  it("executes every full human mirror kit and reaches reaction windows under the bound", () => {
    expect(results).toHaveLength(COMBAT_CASES.length);
    for (const caseSpec of SOLO_CASES) {
      const result = results.find(({ caseId }) => caseId === caseSpec.id);
      const human = caseSpec.genesis.actors.find(({ controller }) => controller === "human");
      expect(result.telemetry.reachedAbilityIds, caseSpec.id)
        .toEqual(expect.arrayContaining(human.loadout.map(({ id }) => id)));
      const reactionId = human.loadout.find(({ id }) => (
        getTowAbilityRulesV2(id).action.lane === "reaction"
      )).id;
      expect(result.telemetry.armedReactionIds, caseSpec.id).toContain(reactionId);
      expect(result.telemetry.triggeredReactionIds, caseSpec.id).toContain(reactionId);
    }
    const aggregate = aggregateTowSimulationTelemetryV2(results);
    expect(aggregate.telemetry.reachedAbilityIds).toHaveLength(60);
    expect(aggregate.telemetry.triggeredReactionIds).toHaveLength(12);
    expect(aggregate.telemetry.profileIds).toEqual(
      [...TOW_SIMULATION_REQUIRED_COVERAGE_V2.profileIds],
    );
    expect(aggregate.telemetry.actorKitTiers).toEqual(
      TOW_SIMULATION_REQUIRED_COVERAGE_V2.profileIds.flatMap((profileId) => (
        TOW_SIMULATION_RANK_TIERS_V2.map((tier) => `${profileId}:${tier}`)
      )).sort(),
    );
    expect(aggregate.telemetry.controllerSides).toEqual([
      "ai:enemy",
      "ai:player",
      "human:enemy",
      "human:player",
    ]);
    expect(aggregate.telemetry.holeyFormationSides).toEqual(["enemy", "player"]);
    expect(aggregate.telemetry.commands).toBeGreaterThan(0);
    expect(aggregate.telemetry.events).toBeGreaterThan(0);
  });

  it("repeats byte-identical commands, events, state, and checksum", () => {
    const caseSpec = MIXED_CASES.find(({ id }) => id.includes("5v5:max:swapped"));
    const first = runTowSimulationCaseV2({ case: caseSpec, verifyPersistence: false });
    const second = runTowSimulationCaseV2({
      case: structuredClone(caseSpec),
      verifyPersistence: false,
    });
    expect(first.ok, first.reason).toBe(true);
    expect(second.ok, second.reason).toBe(true);
    expect(JSON.stringify(first.session)).toBe(JSON.stringify(second.session));
    expect(first.session.checksum).toBe(second.session.checksum);
    expect(first.telemetry).toEqual(second.telemetry);
  }, 60_000);

});

describe("v2 simulation fail-closed boundary", () => {
  it("rejects malformed case and run envelopes without throwing", () => {
    expect(validateTowSimulationCaseV2({ ...PROBE_CASES[0], legacy: true }))
      .toEqual({ ok: false, reason: "invalid-simulation-v2-case-shape" });
    expect(runTowSimulationCaseV2({
      case: PROBE_CASES[0],
      verifyPersistence: true,
      loose: true,
    })).toMatchObject({ ok: false, reason: "invalid-simulation-v2-run-input" });
  });
});
