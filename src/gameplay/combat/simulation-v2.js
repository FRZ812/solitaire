// Pure deterministic gauntlet and reachability harness for solitaire-combat-v2.
//
// This module is intentionally not registered with a runtime or UI. It creates ordinary
// v2 sessions, submits exact serialized commands through commands-v2, and proves every
// returned snapshot by replay plus the bounded persistence codec.

import { gameplayChecksum } from "../kernel/replay.js";
import {
  COMBAT_ABILITY_RULESET_V2_ID,
  COMBAT_ABILITY_RULES_V2_VERSION,
  abilityRulesV2AtRank,
} from "./ability-rules-v2.js";
import {
  COMBAT_ABILITY_CATALOG_V2_LIST,
  COMBAT_ABILITY_STATUS_LIST_V2,
  COMBAT_ABILITY_ZONE_LIST_V2,
  COMBAT_DEFAULT_ABILITY_KITS_V2,
  getCombatAbilityRulesV2,
} from "./ability-catalog-v2.js";
import { createCombatActorV2 } from "./actor-v2.js";
import { COMBAT_AI_POLICY_REGISTRY_V2_CHECKSUM } from "./ai-v2.js";
import { canUseCombatAbilityV2 } from "./action-economy-v2.js";
import {
  dispatchCombatCommandV2,
} from "./commands-v2.js";
import { COMBAT_DAMAGE_POLICY_V2 } from "./damage-v2.js";
import {
  PINNED_COMBAT_ABILITY_CATALOG_V2_CHECKSUM,
  COMBAT_ENCOUNTER_POLICY_V2_ID,
  createCombatEncounterGenesisV2,
} from "./encounter-state-v2.js";
import {
  MAX_COMBAT_AI_STEP_RANDOM_DRAWS_V2,
} from "./encounter-v2.js";
import {
  decodeCombatSessionV2,
  encodeCombatSessionV2,
} from "./persistence-v2.js";
import { replayCombatSessionV2 } from "./replay-v2.js";
import {
  createCombatSessionV2,
  combatEncounterStateChecksumV2,
  validateCombatSessionV2,
} from "./session-v2.js";
import {
  commitAbilityTargetsV2,
  legalAbilityAnchorsV2,
  lockAbilityTargetV2,
} from "./targeting-v2.js";
import { resolveCombatForcedTargetV2 } from "./status-runtime-v2.js";

export const COMBAT_SIMULATION_V2_VERSION = 1;
export const COMBAT_SIMULATION_RANK_TIERS_V2 = Object.freeze(["rank-1", "mid", "max"]);
export const COMBAT_SIMULATION_CASE_KINDS_V2 = Object.freeze([
  "solo-mirror",
  "mixed-3v3",
  "mixed-5v5",
  "ability-probe",
]);
export const COMBAT_SIMULATION_STOP_REASONS_V2 = Object.freeze([
  "terminal",
  "round-bound",
  "command-bound",
  "event-bound",
  "reaction-bound",
]);
export const COMBAT_SIMULATION_BOUNDS_V2 = deepFreeze({
  maxRounds: 6,
  maxCommands: 512,
  maxEvents: 20_000,
  maxReactions: 128,
  maxAiDrawsPerStep: MAX_COMBAT_AI_STEP_RANDOM_DRAWS_V2,
});

const SIDES = Object.freeze(["player", "enemy"]);
// One action can currently resolve at most five damage packets over five recipients
// (50 direct draws). Keep a small explicit surplus for fail-stable future reaction packets.
const AI_STEP_DRAW_POOL = 64;
const SPEC_KEYS = Object.freeze([
  "coverageAbilityId",
  "expectedHoleyFormation",
  "genesis",
  "id",
  "kind",
  "maxCommands",
  "maxEvents",
  "maxReactions",
  "maxRounds",
  "rankTier",
  "sideSwapped",
].sort());
const RUN_INPUT_KEYS = Object.freeze(["case", "verifyPersistence"].sort());
const DRAW_INPUT_KEYS = Object.freeze(["commandOrdinal", "count", "scenarioId"].sort());

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneData(child)]));
  }
  return value;
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index]);
}

function identifier(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 256
    && /^[a-z0-9][a-z0-9:-]*$/.test(value);
}

function positiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function compareIdentifiers(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values) {
  return [...new Set(values)].sort(compareIdentifiers);
}

function formationHasInternalHole(cells) {
  const occupied = cells.flatMap((actorId, index) => actorId === null ? [] : [index]);
  if (occupied.length < 2) return false;
  return cells.slice(occupied[0], occupied.at(-1) + 1).some((actorId) => actorId === null);
}

function rankForTier(definition, tier) {
  if (tier === "rank-1") return 1;
  if (tier === "mid") return Math.ceil(definition.rankCount / 2);
  if (tier === "max") return definition.rankCount;
  throw new TypeError("unknown-simulation-v2-rank-tier");
}

function kitLoadout(profileId, tier) {
  const ids = COMBAT_DEFAULT_ABILITY_KITS_V2[profileId];
  if (!ids) throw new TypeError("unknown-simulation-v2-profile");
  return ids.map((id) => ({
    id,
    rank: rankForTier(getCombatAbilityRulesV2(id), tier),
  }));
}

function createActor({
  controller,
  id,
  loadout,
  preferredRow,
  profileId,
  side,
  speed,
}) {
  const created = createCombatActorV2({
    id,
    name: id,
    side,
    controller,
    aiProfile: controller === "ai" ? { id: profileId, version: 1 } : null,
    preferredRow,
    hp: 50_000,
    maxHp: 50_000,
    shield: 0,
    stats: {
      attack: 100,
      defense: 100,
      speed,
      critChanceBps: 0,
      dodgeChanceBps: 0,
    },
    loadout,
  });
  if (!created.ok) throw new TypeError(created.reason);
  return created.actor;
}

function genesisForActors(actors) {
  const rosters = Object.fromEntries(SIDES.map((side) => [
    side,
    actors.filter((actor) => actor.side === side).map((actor) => actor.id),
  ]));
  return deepFreeze({
    aiPolicyChecksum: COMBAT_AI_POLICY_REGISTRY_V2_CHECKSUM,
    catalogChecksum: PINNED_COMBAT_ABILITY_CATALOG_V2_CHECKSUM,
    policyId: COMBAT_ENCOUNTER_POLICY_V2_ID,
    rosters,
    actors,
    resolveSeeds: actors.map(({ id }) => ({ id, resolve: 100, maxResolve: 100 })),
  });
}

function spec(input) {
  const candidate = deepFreeze({
    id: input.id,
    kind: input.kind,
    rankTier: input.rankTier,
    sideSwapped: input.sideSwapped,
    expectedHoleyFormation: input.expectedHoleyFormation,
    coverageAbilityId: input.coverageAbilityId,
    maxRounds: input.maxRounds ?? COMBAT_SIMULATION_BOUNDS_V2.maxRounds,
    maxCommands: input.maxCommands ?? COMBAT_SIMULATION_BOUNDS_V2.maxCommands,
    maxEvents: input.maxEvents ?? COMBAT_SIMULATION_BOUNDS_V2.maxEvents,
    maxReactions: input.maxReactions ?? COMBAT_SIMULATION_BOUNDS_V2.maxReactions,
    genesis: input.genesis,
  });
  const validation = validateCombatSimulationCaseV2(candidate);
  if (!validation.ok) throw new TypeError(validation.reason);
  return candidate;
}

function soloMirrorCases() {
  return Object.keys(COMBAT_DEFAULT_ABILITY_KITS_V2).flatMap((profileId) => (
    COMBAT_SIMULATION_RANK_TIERS_V2.map((rankTier, tierIndex) => {
      const actors = [
        createActor({
          id: `player:${profileId}`,
          side: "player",
          controller: "human",
          profileId,
          preferredRow: 1,
          speed: 200 + tierIndex,
          loadout: kitLoadout(profileId, rankTier),
        }),
        createActor({
          id: `enemy:${profileId}`,
          side: "enemy",
          controller: "ai",
          profileId,
          preferredRow: 1,
          speed: 100 + tierIndex,
          loadout: kitLoadout(profileId, rankTier),
        }),
      ];
      return spec({
        id: `solo:${profileId}:${rankTier}`,
        kind: "solo-mirror",
        rankTier,
        sideSwapped: false,
        expectedHoleyFormation: false,
        coverageAbilityId: null,
        maxRounds: 4,
        genesis: genesisForActors(actors),
      });
    })
  ));
}

function mixedActors(profileIds, rankTier, sideSwapped, size) {
  const humanSide = sideSwapped ? "enemy" : "player";
  const aiSide = sideSwapped ? "player" : "enemy";
  const rows = size === 3 ? [0, 1, 2] : [0, 2, 1, 0, 2];
  const humanProfiles = profileIds.slice(0, size);
  const aiProfiles = profileIds.slice(size, size * 2);
  return [
    ...humanProfiles.map((profileId, index) => createActor({
      id: `${humanSide}:human:${profileId}`,
      side: humanSide,
      controller: "human",
      profileId,
      preferredRow: rows[index],
      speed: 300 - index * 10,
      loadout: kitLoadout(profileId, rankTier),
    })),
    ...aiProfiles.map((profileId, index) => createActor({
      id: `${aiSide}:ai:${profileId}`,
      side: aiSide,
      controller: "ai",
      profileId,
      preferredRow: rows[index],
      speed: 295 - index * 10,
      loadout: kitLoadout(profileId, rankTier),
    })),
  ];
}

function mixedCases() {
  const profiles = Object.keys(COMBAT_DEFAULT_ABILITY_KITS_V2);
  return [
    [3, "mid", false],
    [3, "mid", true],
    [5, "max", false],
    [5, "max", true],
  ].map(([size, rankTier, sideSwapped]) => spec({
    id: `mixed:${size}v${size}:${rankTier}:${sideSwapped ? "swapped" : "standard"}`,
    kind: `mixed-${size}v${size}`,
    rankTier,
    sideSwapped,
    expectedHoleyFormation: true,
    coverageAbilityId: null,
    maxRounds: 3,
    genesis: genesisForActors(mixedActors(profiles, rankTier, sideSwapped, size)),
  }));
}

function abilityProbeCases() {
  return COMBAT_ABILITY_CATALOG_V2_LIST.map((definition, index) => {
    const abilityId = definition.id;
    const profileId = Object.entries(COMBAT_DEFAULT_ABILITY_KITS_V2)
      .find(([, ids]) => ids.includes(abilityId))?.[0];
    if (!profileId) throw new TypeError("unowned-simulation-v2-ability");
    const actors = [
      createActor({
        id: `player:probe:${index}`,
        side: "player",
        controller: "human",
        profileId,
        preferredRow: 1,
        speed: 200,
        loadout: [{ id: abilityId, rank: definition.rankCount }],
      }),
      createActor({
        id: `enemy:probe:${index}`,
        side: "enemy",
        controller: "human",
        profileId: "knight",
        preferredRow: 1,
        speed: 100,
        loadout: [{ id: "arctic-strike", rank: 1 }],
      }),
    ];
    return spec({
      id: `probe:${abilityId}`,
      kind: "ability-probe",
      rankTier: "max",
      sideSwapped: false,
      expectedHoleyFormation: false,
      coverageAbilityId: abilityId,
      maxRounds: 1,
      maxCommands: 12,
      maxEvents: 2_000,
      maxReactions: 4,
      genesis: genesisForActors(actors),
    });
  });
}

export const COMBAT_SIMULATION_GAUNTLET_CASES_V2 = deepFreeze([
  ...soloMirrorCases(),
  ...mixedCases(),
  ...abilityProbeCases(),
]);

export const COMBAT_SIMULATION_REQUIRED_COVERAGE_V2 = deepFreeze({
  abilityIds: sortedUnique(COMBAT_ABILITY_CATALOG_V2_LIST.map(({ id }) => id)),
  statusIds: sortedUnique(COMBAT_ABILITY_STATUS_LIST_V2.map(({ id }) => id)),
  zoneIds: sortedUnique(COMBAT_ABILITY_ZONE_LIST_V2.map(({ id }) => id)),
  profileIds: sortedUnique(Object.keys(COMBAT_DEFAULT_ABILITY_KITS_V2)),
  rankTiers: [...COMBAT_SIMULATION_RANK_TIERS_V2],
});

export function validateCombatSimulationCaseV2(value) {
  let reason = null;
  try {
    if (!exactKeys(value, SPEC_KEYS)) reason = "invalid-simulation-v2-case-shape";
    else if (!identifier(value.id)
      || !COMBAT_SIMULATION_CASE_KINDS_V2.includes(value.kind)
      || !COMBAT_SIMULATION_RANK_TIERS_V2.includes(value.rankTier)
      || typeof value.sideSwapped !== "boolean"
      || typeof value.expectedHoleyFormation !== "boolean"
      || (value.coverageAbilityId !== null
        && !COMBAT_ABILITY_CATALOG_V2_LIST.some(({ id }) => id === value.coverageAbilityId))) {
      reason = "invalid-simulation-v2-case-identity";
    } else if (!positiveSafeInteger(value.maxRounds)
      || value.maxRounds > COMBAT_SIMULATION_BOUNDS_V2.maxRounds
      || !positiveSafeInteger(value.maxCommands)
      || value.maxCommands > COMBAT_SIMULATION_BOUNDS_V2.maxCommands
      || !positiveSafeInteger(value.maxEvents)
      || value.maxEvents > COMBAT_SIMULATION_BOUNDS_V2.maxEvents
      || !positiveSafeInteger(value.maxReactions)
      || value.maxReactions > COMBAT_SIMULATION_BOUNDS_V2.maxReactions) {
      reason = "invalid-simulation-v2-case-bounds";
    } else {
      const opening = createCombatEncounterGenesisV2(value.genesis);
      if (!opening.ok) reason = opening.reason || "invalid-simulation-v2-case-genesis";
      else if (value.expectedHoleyFormation && SIDES.some((side) => (
        !formationHasInternalHole(opening.state.formations[side])
      ))) reason = "invalid-simulation-v2-case-formation";
      else if (value.kind === "ability-probe"
        && value.coverageAbilityId === null) reason = "invalid-simulation-v2-probe-ability";
      else if (value.kind !== "ability-probe"
        && value.coverageAbilityId !== null) reason = "invalid-simulation-v2-case-coverage";
    }
  } catch {
    reason = "invalid-simulation-v2-case-data";
  }
  return Object.freeze({ ok: reason === null, reason });
}

/** Stable explicit draws; no ambient random source is ever consulted. */
export function combatSimulationRandomDrawsV2(input) {
  if (!exactKeys(input, DRAW_INPUT_KEYS)
    || !identifier(input.scenarioId)
    || !Number.isSafeInteger(input.commandOrdinal)
    || input.commandOrdinal < 0
    || !Number.isSafeInteger(input.count)
    || input.count < 0
    || input.count > COMBAT_SIMULATION_BOUNDS_V2.maxAiDrawsPerStep) {
    throw new TypeError("invalid-simulation-v2-draw-input");
  }
  let state = Number.parseInt(
    gameplayChecksum(`${input.scenarioId}:${input.commandOrdinal}`).slice(-8),
    16,
  ) >>> 0;
  const draws = [];
  for (let index = 0; index < input.count; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    draws.push(state % 10_000);
  }
  return Object.freeze(draws);
}

function commandInput(session, scenarioId, command) {
  return {
    version: COMBAT_ABILITY_RULES_V2_VERSION,
    rulesetId: COMBAT_ABILITY_RULESET_V2_ID,
    commandId: `${scenarioId}:command:${session.revision + 1}`,
    expectedRevision: session.revision,
    ...command,
  };
}

function dispatch(session, scenarioId, command) {
  return dispatchCombatCommandV2(session, commandInput(session, scenarioId, command));
}

function durableAnchor(anchor) {
  return anchor.tracking === "unit"
    ? anchor.actorId
    : { side: anchor.side, index: anchor.index };
}

function recipientCount(state, ability, targetCommit, effect) {
  const caster = state.actors[targetCommit.casterId];
  if (effect.recipient === "caster") return caster.hp > 0 ? 1 : 0;
  if (effect.recipient === "selected-units") return targetCommit.selectedUnits.length;
  if (effect.recipient === "selected-cells") return targetCommit.selectedCells.length;
  if (effect.recipient === "all-allies") {
    return state.rosters[caster.side].filter((id) => state.actors[id].hp > 0).length;
  }
  if (effect.recipient === "all-enemies") {
    const side = caster.side === "player" ? "enemy" : "player";
    return state.rosters[side].filter((id) => state.actors[id].hp > 0).length;
  }
  if (effect.recipient === "all-combatants") {
    return Object.values(state.actors).filter(({ hp }) => hp > 0).length;
  }
  return 0;
}

function projectedAbilityDrawCount(state, ability, targetCommit) {
  return ability.effects.reduce((total, effect) => (
    effect.primitive === "damage"
      ? total + recipientCount(state, ability, targetCommit, effect)
        * COMBAT_DAMAGE_POLICY_V2.direct.randomDrawsPerPacket
      : total
  ), 0);
}

function anchorScore(state, ability, actorId, anchor) {
  const locked = lockAbilityTargetV2(state, ability, actorId, durableAnchor(anchor));
  if (!locked.ok) return null;
  const committed = commitAbilityTargetsV2(state, ability, locked.lock);
  if (!committed.ok) return null;
  const actorSide = state.actors[actorId].side;
  const hostileCount = committed.selectedUnits.filter(({ actorId: targetId }) => (
    state.actors[targetId].side !== actorSide
  )).length;
  const alliedCount = committed.selectedUnits.length - hostileCount;
  const key = anchor.tracking === "unit"
    ? `0:${anchor.actorId}`
    : `1:${anchor.side}:${String(anchor.index).padStart(2, "0")}`;
  const desiredCount = ability.targeting.side === "enemy" ? hostileCount : alliedCount;
  return { anchor: durableAnchor(anchor), committed, desiredCount, key };
}

function chosenTarget(state, ability, actorId, { preferSelf = false } = {}) {
  let candidates = legalAbilityAnchorsV2(state, ability, actorId)
    .map((anchor) => anchorScore(state, ability, actorId, anchor))
    .filter(Boolean);
  const actorSide = state.actors[actorId].side;
  const validActorIds = sortedUnique(candidates.flatMap(({ committed }) => (
    committed.selectedUnits
      .filter(({ actorId: targetId }) => state.actors[targetId].side !== actorSide)
      .map(({ actorId: targetId }) => targetId)
  )));
  const forced = resolveCombatForcedTargetV2(state.statuses, { actorId, validActorIds });
  if (forced.ok && forced.event.targetActorId !== null) {
    candidates = candidates.filter(({ committed }) => (
      committed.selectedUnits.some(({ actorId: targetId }) => (
        targetId === forced.event.targetActorId
      ))
    ));
  }
  candidates.sort((left, right) => (
    (preferSelf && left.committed.selectedUnits.some(({ actorId: id }) => id === actorId) ? -1 : 0)
      - (preferSelf && right.committed.selectedUnits.some(({ actorId: id }) => id === actorId) ? -1 : 0)
      || right.desiredCount - left.desiredCount
      || compareIdentifiers(left.key, right.key)
  ));
  return candidates[0] ?? null;
}

function eventReactionCount(events) {
  return events.filter(({ type }) => [
    "reaction-triggered",
    "reaction-fizzled",
    "reaction-expired",
  ].includes(type)).length;
}

function sessionReactionCount(session) {
  return eventReactionCount(session.events);
}

function boundReason(caseSpec, session) {
  if (session.status === "terminal") return "terminal";
  // Rounds are counted when their exact round-start transition is accepted. Because every
  // AI scheduler transition is now a separate command, this guard cannot overshoot into a
  // later round and needs no controller-specific lookahead.
  if (session.encounter.economy.round >= caseSpec.maxRounds) return "round-bound";
  if (session.commands.length >= caseSpec.maxCommands) return "command-bound";
  if (session.events.length >= caseSpec.maxEvents) return "event-bound";
  if (sessionReactionCount(session) >= caseSpec.maxReactions) return "reaction-bound";
  return null;
}

function failure(caseSpec, reason, session = null) {
  return deepFreeze({
    ok: false,
    reason,
    caseId: caseSpec?.id ?? null,
    stopReason: null,
    session,
    telemetry: null,
    verification: null,
  });
}

function verifySession(session) {
  const valid = validateCombatSessionV2(session);
  if (!valid.ok) return { ok: false, reason: valid.reason };
  const replay = replayCombatSessionV2(session);
  if (!replay.ok) return { ok: false, reason: replay.reason };
  const encoded = encodeCombatSessionV2(session);
  if (!encoded.ok) return { ok: false, reason: encoded.reason };
  const decoded = decodeCombatSessionV2(encoded.payload);
  if (!decoded.ok) return { ok: false, reason: decoded.reason };
  const expectedStateChecksum = combatEncounterStateChecksumV2(session.encounter);
  const replayStateChecksum = combatEncounterStateChecksumV2(replay.encounter);
  const decodedStateChecksum = combatEncounterStateChecksumV2(decoded.session.encounter);
  if (session.checksum !== decoded.session.checksum
    || expectedStateChecksum !== replayStateChecksum
    || expectedStateChecksum !== decodedStateChecksum
    || JSON.stringify(session) !== JSON.stringify(decoded.session)) {
    return { ok: false, reason: "simulation-v2-verification-divergence" };
  }
  return deepFreeze({
    ok: true,
    reason: null,
    sessionChecksum: session.checksum,
    stateChecksum: expectedStateChecksum,
    replayStateChecksum,
    decodedStateChecksum,
    encodedBytes: new TextEncoder().encode(encoded.payload).byteLength,
  });
}

function statusIdsFromZoneEvents(events) {
  const zoneById = Object.fromEntries(COMBAT_ABILITY_ZONE_LIST_V2.map((zone) => [zone.id, zone]));
  return events.flatMap((event) => {
    if (!["zone-created", "zone-replaced", "zone-refreshed", "zone-stacked"]
      .includes(event.type)) return [];
    const subject = zoneById[event.definitionId]?.payload?.subject;
    return typeof subject === "string" ? [subject] : [];
  });
}

function actorKitTier(actor) {
  const profileId = actorProfileId(actor);
  if (profileId === null) return null;
  const ranks = Object.fromEntries(actor.loadout.map(({ id, rank }) => [id, rank]));
  const tier = COMBAT_SIMULATION_RANK_TIERS_V2.find((candidate) => (
    COMBAT_DEFAULT_ABILITY_KITS_V2[profileId].every((id) => (
      ranks[id] === rankForTier(getCombatAbilityRulesV2(id), candidate)
    ))
  ));
  return tier === undefined ? null : `${profileId}:${tier}`;
}

export function collectCombatSimulationTelemetryV2(session) {
  const valid = validateCombatSessionV2(session);
  if (!valid.ok) throw new TypeError(valid.reason);
  const equippedAbilityIds = sortedUnique(session.genesis.actors.flatMap((actor) => (
    actor.loadout.map(({ id }) => id)
  )));
  const committedAbilityIds = sortedUnique(session.events.flatMap((event) => (
    event.type === "action-committed" ? [event.abilityId] : []
  )));
  const armedReactionIds = sortedUnique(session.events.flatMap((event) => (
    event.type === "reaction-armed" ? [event.abilityId ?? event.reaction?.abilityId] : []
  )).filter(Boolean));
  const triggeredReactionIds = sortedUnique(session.events.flatMap((event) => (
    event.type === "reaction-triggered" ? [event.abilityId ?? event.reaction?.abilityId] : []
  )).filter(Boolean));
  const mutatedStatusIds = sortedUnique(session.events.flatMap((event) => (
    event.type === "status-mutated" ? [event.statusId] : []
  )));
  const zonePayloadStatusIds = sortedUnique(statusIdsFromZoneEvents(session.events));
  const zoneIds = sortedUnique(session.events.flatMap((event) => (
    ["zone-created", "zone-replaced", "zone-refreshed", "zone-stacked", "zone-ticked"]
      .includes(event.type) ? [event.definitionId] : []
  )).filter(Boolean));
  const actorKitTiers = session.genesis.actors.map(actorKitTier).filter(Boolean);
  return deepFreeze({
    profileIds: sortedUnique(session.genesis.actors.map(actorProfileId).filter(Boolean)),
    actorKitTiers: sortedUnique(actorKitTiers),
    controllerSides: sortedUnique(session.genesis.actors.map(({ controller, side }) => (
      `${controller}:${side}`
    ))),
    holeyFormationSides: SIDES.filter((side) => (
      formationHasInternalHole(session.encounter.formations[side])
    )),
    equippedAbilityIds,
    reachedAbilityIds: sortedUnique([...committedAbilityIds, ...armedReactionIds]),
    committedAbilityIds,
    armedReactionIds,
    triggeredReactionIds,
    reachedStatusIds: sortedUnique([...mutatedStatusIds, ...zonePayloadStatusIds]),
    mutatedStatusIds,
    zonePayloadStatusIds,
    reachedZoneIds: zoneIds,
    eventTypes: sortedUnique(session.events.map(({ type }) => type)),
    commands: session.commands.length,
    events: session.events.length,
    rounds: session.encounter.economy.round,
    reactions: sessionReactionCount(session),
  });
}

function success(caseSpec, stopReason, session, verifyPersistence) {
  const telemetry = collectCombatSimulationTelemetryV2(session);
  const verification = verifyPersistence
    ? verifySession(session)
    : deepFreeze({
      ok: true,
      reason: null,
      sessionChecksum: session.checksum,
      stateChecksum: combatEncounterStateChecksumV2(session.encounter),
      replayStateChecksum: null,
      decodedStateChecksum: null,
      encodedBytes: null,
    });
  if (!verification.ok) return failure(caseSpec, verification.reason, session);
  return deepFreeze({
    ok: true,
    reason: null,
    caseId: caseSpec.id,
    stopReason,
    session,
    telemetry,
    verification,
  });
}

function startProbeSession(caseSpec) {
  const created = createCombatSessionV2({
    sessionId: `simulation:${caseSpec.id}`,
    genesis: caseSpec.genesis,
  });
  return created.ok ? created.session : null;
}

function dispatchRequired(caseSpec, session, command) {
  const resolved = dispatch(session, caseSpec.id, command);
  return resolved.ok
    ? { ok: true, session: resolved.session, events: resolved.events }
    : { ok: false, reason: resolved.reason, session };
}

function runAbilityProbe(caseSpec, verifyPersistence) {
  let session = startProbeSession(caseSpec);
  if (session === null) return failure(caseSpec, "simulation-v2-session-create-failed");
  const owner = caseSpec.genesis.actors.find(({ side }) => side === "player");
  const foe = caseSpec.genesis.actors.find(({ side }) => side === "enemy");
  const definition = getCombatAbilityRulesV2(caseSpec.coverageAbilityId);
  const ability = abilityRulesV2AtRank(definition, definition.rankCount);
  for (const command of [
    { type: "round-start" },
    { type: "actor-turn-start", actorId: owner.id },
  ]) {
    const next = dispatchRequired(caseSpec, session, command);
    if (!next.ok) return failure(caseSpec, next.reason, session);
    session = next.session;
  }

  const selected = chosenTarget(session.encounter, ability, owner.id, {
    preferSelf: ability.action.lane === "reaction",
  });
  if (selected === null) return failure(caseSpec, "simulation-v2-no-legal-probe-target", session);

  if (ability.action.lane !== "reaction") {
    const drawCount = projectedAbilityDrawCount(session.encounter, ability, selected.committed);
    const acted = dispatchRequired(caseSpec, session, {
      type: "ability",
      actorId: owner.id,
      abilityId: ability.id,
      anchor: selected.anchor,
      randomDraws: combatSimulationRandomDrawsV2({
        scenarioId: caseSpec.id,
        commandOrdinal: session.revision + 1,
        count: drawCount,
      }),
    });
    if (!acted.ok) return failure(caseSpec, acted.reason, session);
    session = acted.session;
    return success(caseSpec, "round-bound", session, verifyPersistence);
  }

  let next = dispatchRequired(caseSpec, session, {
    type: "reaction-arm",
    actorId: owner.id,
    abilityId: ability.id,
    anchor: selected.anchor,
  });
  if (!next.ok) return failure(caseSpec, next.reason, session);
  session = next.session;
  next = dispatchRequired(caseSpec, session, { type: "actor-turn-end", actorId: owner.id });
  if (!next.ok) return failure(caseSpec, next.reason, session);
  session = next.session;
  next = dispatchRequired(caseSpec, session, { type: "actor-turn-start", actorId: foe.id });
  if (!next.ok) return failure(caseSpec, next.reason, session);
  session = next.session;

  const hostileDefinition = getCombatAbilityRulesV2("arctic-strike");
  const hostileAbility = abilityRulesV2AtRank(hostileDefinition, 1);
  const hostileTarget = chosenTarget(session.encounter, hostileAbility, foe.id);
  if (hostileTarget === null) {
    return failure(caseSpec, "simulation-v2-no-legal-reaction-trigger", session);
  }
  const hostileDrawCount = projectedAbilityDrawCount(
    session.encounter,
    hostileAbility,
    hostileTarget.committed,
  );
  next = dispatchRequired(caseSpec, session, {
    type: "ability",
    actorId: foe.id,
    abilityId: hostileAbility.id,
    anchor: hostileTarget.anchor,
    randomDraws: combatSimulationRandomDrawsV2({
      scenarioId: caseSpec.id,
      commandOrdinal: session.revision + 1,
      count: hostileDrawCount,
    }),
  });
  if (!next.ok) return failure(caseSpec, next.reason, session);
  session = next.session;
  return success(caseSpec, "round-bound", session, verifyPersistence);
}

function actorProfileId(actor) {
  if (actor.aiProfile !== null) return actor.aiProfile.id;
  const loadoutIds = new Set(actor.loadout.map(({ id }) => id));
  return Object.entries(COMBAT_DEFAULT_ABILITY_KITS_V2)
    .find(([, ids]) => ids.length === loadoutIds.size
      && ids.every((id) => loadoutIds.has(id)))?.[0] ?? null;
}

function eventAbilityUseCount(session, actorId, abilityId) {
  return session.events.filter((event) => (
    event.type === "action-committed"
      && event.actorId === actorId
      && event.abilityId === abilityId
  )).length;
}

function disruptiveAbility(ability) {
  return ability.effects.some((effect) => (
    ["move", "pull", "push"].includes(effect.primitive)
      || (effect.primitive === "status" && ["paralyze", "stun"].includes(effect.subject))
  ));
}

function orderedLaneCandidates(session, actor, lane) {
  const profileId = actorProfileId(actor);
  const authoredOrder = profileId === null ? [] : COMBAT_DEFAULT_ABILITY_KITS_V2[profileId];
  return actor.loadout.flatMap((loadout) => {
    const definition = getCombatAbilityRulesV2(loadout.id);
    const ability = abilityRulesV2AtRank(definition, loadout.rank);
    if (ability.action.lane !== lane) return [];
    const available = canUseCombatAbilityV2(session.encounter.economy, {
      actorId: actor.id,
      abilityId: ability.id,
    });
    if (!available.ok) return [];
    const target = chosenTarget(session.encounter, ability, actor.id);
    return target === null ? [] : [{
      ability,
      target,
      uses: eventAbilityUseCount(session, actor.id, ability.id),
      disruptive: disruptiveAbility(ability),
      authoredIndex: authoredOrder.indexOf(ability.id),
    }];
  }).sort((left, right) => (
    left.uses - right.uses
      || Number(left.disruptive) - Number(right.disruptive)
      || left.authoredIndex - right.authoredIndex
      || compareIdentifiers(left.ability.id, right.ability.id)
  ));
}

function armHumanReaction(caseSpec, session, actor) {
  if (session.encounter.economy.actors[actor.id].armedReaction !== null) {
    return { ok: true, session };
  }
  const reaction = actor.loadout.flatMap((loadout) => {
    const ability = abilityRulesV2AtRank(getCombatAbilityRulesV2(loadout.id), loadout.rank);
    if (ability.action.lane !== "reaction") return [];
    const economy = session.encounter.economy.actors[actor.id];
    if (economy.budgets.reaction < 1
      || (economy.cooldowns[ability.id] ?? 0) > 0
      || economy.resolve < ability.action.resolveCost) return [];
    const target = chosenTarget(session.encounter, ability, actor.id, { preferSelf: true });
    return target === null ? [] : [{ ability, target }];
  })[0];
  if (!reaction) return { ok: true, session };
  const armed = dispatchRequired(caseSpec, session, {
    type: "reaction-arm",
    actorId: actor.id,
    abilityId: reaction.ability.id,
    anchor: reaction.target.anchor,
  });
  return armed.ok ? { ok: true, session: armed.session } : armed;
}

function useHumanLane(caseSpec, session, actor, lane) {
  const candidates = orderedLaneCandidates(session, actor, lane);
  let current = session;
  for (const candidate of candidates) {
    const drawCount = projectedAbilityDrawCount(
      current.encounter,
      candidate.ability,
      candidate.target.committed,
    );
    const result = dispatchRequired(caseSpec, current, {
      type: "ability",
      actorId: actor.id,
      abilityId: candidate.ability.id,
      anchor: candidate.target.anchor,
      randomDraws: combatSimulationRandomDrawsV2({
        scenarioId: caseSpec.id,
        commandOrdinal: current.revision + 1,
        count: drawCount,
      }),
    });
    if (!result.ok) continue;
    current = result.session;
    const committed = result.events.some((event) => (
      event.type === "action-committed" && event.abilityId === candidate.ability.id
    ));
    return { ok: true, session: current, committed };
  }
  return { ok: true, session: current, committed: false };
}

function completeHumanPriority(caseSpec, session) {
  const actorId = session.encounter.economy.activeActorId;
  const actor = session.encounter.actors[actorId];
  if (!actor || actor.controller !== "human") {
    return { ok: false, reason: "simulation-v2-human-priority-required", session };
  }
  let current = session;
  const armed = armHumanReaction(caseSpec, current, actor);
  if (!armed.ok) return armed;
  current = armed.session;
  for (const lane of ["main", "quick"]) {
    if (current.status === "terminal"
      || current.encounter.economy.phase !== "actor-turn"
      || current.encounter.economy.activeActorId !== actorId) break;
    const used = useHumanLane(caseSpec, current, actor, lane);
    if (!used.ok) return used;
    current = used.session;
  }
  if (current.status === "terminal"
    || current.encounter.economy.phase !== "actor-turn"
    || current.encounter.economy.activeActorId !== actorId) {
    return { ok: true, session: current };
  }
  const ended = dispatchRequired(caseSpec, current, {
    type: "actor-turn-end",
    actorId,
  });
  return ended.ok ? { ok: true, session: ended.session } : ended;
}

function driveAiStep(caseSpec, session) {
  return dispatchRequired(caseSpec, session, {
    type: "ai-step",
    randomDraws: combatSimulationRandomDrawsV2({
      scenarioId: caseSpec.id,
      commandOrdinal: session.revision + 1,
      count: AI_STEP_DRAW_POOL,
    }),
  });
}

function runCombatCase(caseSpec, verifyPersistence) {
  let session = startProbeSession(caseSpec);
  if (session === null) return failure(caseSpec, "simulation-v2-session-create-failed");
  let stopReason = null;
  while (stopReason === null) {
    stopReason = boundReason(caseSpec, session);
    if (stopReason !== null) break;
    const activeId = session.encounter.economy.activeActorId;
    const active = activeId === null ? null : session.encounter.actors[activeId];
    const next = active?.controller === "human"
      ? completeHumanPriority(caseSpec, session)
      : driveAiStep(caseSpec, session);
    if (!next.ok) return failure(caseSpec, next.reason, session);
    session = next.session;
    if (session.commands.length > caseSpec.maxCommands
      || session.events.length > caseSpec.maxEvents
      || sessionReactionCount(session) > caseSpec.maxReactions) {
      return failure(caseSpec, "simulation-v2-bound-overshoot", session);
    }
  }
  return success(caseSpec, stopReason, session, verifyPersistence);
}

/**
 * Run one exact gauntlet case through the ordinary session command boundary.
 */
export function runCombatSimulationCaseV2(input) {
  if (!exactKeys(input, RUN_INPUT_KEYS) || typeof input.verifyPersistence !== "boolean") {
    return failure(null, "invalid-simulation-v2-run-input");
  }
  const validation = validateCombatSimulationCaseV2(input.case);
  if (!validation.ok) return failure(input.case, validation.reason);
  if (input.case.kind === "ability-probe") {
    return runAbilityProbe(input.case, input.verifyPersistence);
  }
  return runCombatCase(input.case, input.verifyPersistence);
}

function coverageDifference(required, reached) {
  const reachedSet = new Set(reached);
  return required.filter((id) => !reachedSet.has(id));
}

export function aggregateCombatSimulationTelemetryV2(results) {
  if (!Array.isArray(results) || results.some((result) => !result?.ok || !result.telemetry)) {
    throw new TypeError("invalid-simulation-v2-results");
  }
  const telemetry = deepFreeze({
    caseIds: sortedUnique(results.map(({ caseId }) => caseId)),
    profileIds: sortedUnique(results.flatMap(({ telemetry: value }) => value.profileIds)),
    actorKitTiers: sortedUnique(results.flatMap(({ telemetry: value }) => value.actorKitTiers)),
    controllerSides: sortedUnique(results.flatMap(({ telemetry: value }) => value.controllerSides)),
    holeyFormationSides: sortedUnique(results.flatMap(({ telemetry: value }) => (
      value.holeyFormationSides
    ))),
    reachedAbilityIds: sortedUnique(results.flatMap(({ telemetry: value }) => (
      value.reachedAbilityIds
    ))),
    committedAbilityIds: sortedUnique(results.flatMap(({ telemetry: value }) => (
      value.committedAbilityIds
    ))),
    armedReactionIds: sortedUnique(results.flatMap(({ telemetry: value }) => (
      value.armedReactionIds
    ))),
    triggeredReactionIds: sortedUnique(results.flatMap(({ telemetry: value }) => (
      value.triggeredReactionIds
    ))),
    reachedStatusIds: sortedUnique(results.flatMap(({ telemetry: value }) => (
      value.reachedStatusIds
    ))),
    mutatedStatusIds: sortedUnique(results.flatMap(({ telemetry: value }) => (
      value.mutatedStatusIds
    ))),
    zonePayloadStatusIds: sortedUnique(results.flatMap(({ telemetry: value }) => (
      value.zonePayloadStatusIds
    ))),
    reachedZoneIds: sortedUnique(results.flatMap(({ telemetry: value }) => (
      value.reachedZoneIds
    ))),
    commands: results.reduce((sum, result) => sum + result.telemetry.commands, 0),
    events: results.reduce((sum, result) => sum + result.telemetry.events, 0),
    reactions: results.reduce((sum, result) => sum + result.telemetry.reactions, 0),
  });
  const missing = deepFreeze({
    abilityIds: coverageDifference(
      COMBAT_SIMULATION_REQUIRED_COVERAGE_V2.abilityIds,
      telemetry.reachedAbilityIds,
    ),
    statusIds: coverageDifference(
      COMBAT_SIMULATION_REQUIRED_COVERAGE_V2.statusIds,
      telemetry.reachedStatusIds,
    ),
    zoneIds: coverageDifference(
      COMBAT_SIMULATION_REQUIRED_COVERAGE_V2.zoneIds,
      telemetry.reachedZoneIds,
    ),
  });
  return deepFreeze({
    ok: Object.values(missing).every((values) => values.length === 0),
    telemetry,
    missing,
    checksum: `simulation-v2:${gameplayChecksum({ telemetry, missing })}`,
  });
}

export function calculateCombatSimulationGauntletV2Checksum() {
  return `fnv1a64:${gameplayChecksum({
    version: COMBAT_SIMULATION_V2_VERSION,
    bounds: COMBAT_SIMULATION_BOUNDS_V2,
    cases: COMBAT_SIMULATION_GAUNTLET_CASES_V2,
    requiredCoverage: COMBAT_SIMULATION_REQUIRED_COVERAGE_V2,
  })}`;
}

export const COMBAT_SIMULATION_GAUNTLET_V2_CHECKSUM = "fnv1a64:943eff406e540c59";

if (COMBAT_ABILITY_RULES_V2_VERSION !== 2
  || COMBAT_ABILITY_CATALOG_V2_LIST.length !== 60
  || COMBAT_ABILITY_STATUS_LIST_V2.length !== 30
  || COMBAT_ABILITY_ZONE_LIST_V2.length !== 7
  || calculateCombatSimulationGauntletV2Checksum() !== COMBAT_SIMULATION_GAUNTLET_V2_CHECKSUM) {
  throw new TypeError("combat-simulation-v2-upstream-drift");
}
