// Pure combat-query and presentation authority for solitaire-tow-v2.
//
// This module does not mutate encounters, choose targets, advance AI, or infer legacy
// presentation. It validates one canonical v2 encounter/session and projects stable data
// shapes for UI consumers. Declared AI intents come only from the canonical encounter
// snapshot so a presentation caller cannot replace or live-retarget a durable lock.

import { cloneJsonData } from "../kernel/json-data.js";
import {
  armTowReactionV2,
  canUseTowAbilityV2,
} from "./action-economy-v2.js";
import {
  TOW_ABILITY_RULESET_V2_ID,
  TOW_ABILITY_RULES_V2_VERSION,
  abilityRulesV2AtRank,
} from "./ability-rules-v2.js";
import {
  getTowAbilityNameV2,
  getTowAbilityRulesV2,
} from "./ability-catalog-v2.js";
import { validateTowCommandLogV2 } from "./commands-v2.js";
import {
  validateTowEncounterStateV2,
} from "./encounter-state-v2.js";
import { verifyTowSessionReplayV2 } from "./replay-v2.js";
import {
  MAX_TOW_SESSION_EVENTS_V2,
  towEncounterCombatResultV2,
  validateTowSessionV2,
} from "./session-v2.js";
import {
  adjudicateTowStatusActionV2,
  resolveTowForcedTargetV2,
} from "./status-runtime-v2.js";
import {
  TOW_FORMATION_SIDES_V2,
  TOW_TARGET_COMMIT_V2_VERSION,
  commitAbilityTargetsV2,
  isAbilityTargetLockV2,
  legalAbilityAnchorsV2,
  lockAbilityTargetV2,
} from "./targeting-v2.js";

export const TOW_PRESENTATION_V2_VERSION = 1;

export const TOW_PRESENTATION_POLICY_V2 = deepFreeze({
  version: TOW_PRESENTATION_V2_VERSION,
  rulesetId: TOW_ABILITY_RULESET_V2_ID,
  source: "validated-v2-encounter-or-replay-verified-v2-session",
  actorOrder: "player-roster-then-enemy-roster",
  formationOrder: "side-then-row-major-including-empty-cells",
  targets: "catalogue-target-lock-and-commit-only",
  intents: "canonical-state-declaration-sequence-with-durable-lock",
  events: "committed-event-snapshots-never-live-retargeting",
  unavailable: "fail-closed",
});

const LEGAL_ANCHOR_INPUT_KEYS = Object.freeze(["abilityId", "actorId"].sort());
const PREVIEW_INPUT_KEYS = Object.freeze(["abilityId", "actorId", "anchor"].sort());
const NO_INPUT_KEYS = Object.freeze([]);
const EVENT_INPUT_KEYS = Object.freeze(["events"]);
const TARGET_COMMIT_KEYS = Object.freeze([
  "abilityId",
  "anchor",
  "casterId",
  "ok",
  "rank",
  "reason",
  "rulesetId",
  "selectedCells",
  "selectedUnits",
  "sourceCell",
  "version",
].sort());
const TARGET_COMMIT_ANCHOR_KEYS = Object.freeze([
  "actorId", "index", "side", "tracking",
].sort());
const TARGET_CELL_KEYS = Object.freeze(["index", "side"].sort());
const TARGET_UNIT_KEYS = Object.freeze(["actorId", "index", "side"].sort());

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && keys.every((key, index) => key === expected[index]);
}

function identifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function formationCell(value) {
  return exactKeys(value, TARGET_CELL_KEYS)
    && TOW_FORMATION_SIDES_V2.includes(value.side)
    && Number.isSafeInteger(value.index)
    && value.index >= 0
    && value.index < 9;
}

function rejected(key, reason) {
  return deepFreeze({ ok: false, reason, [key]: null });
}

function accepted(key, value) {
  return deepFreeze({ ok: true, reason: null, [key]: value });
}

function isSessionCandidate(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && (Object.hasOwn(value, "sessionId")
      || Object.hasOwn(value, "genesis")
      || Object.hasOwn(value, "checksum"));
}

function canonicalSource(source) {
  if (isSessionCandidate(source)) {
    const session = validateTowSessionV2(source);
    if (!session.ok) return { ok: false, reason: session.reason };
    const log = validateTowCommandLogV2(source);
    if (!log.ok) return { ok: false, reason: log.reason };
    const replay = verifyTowSessionReplayV2(source);
    if (!replay.ok) return { ok: false, reason: replay.reason };
    return {
      ok: true,
      state: source.encounter,
      events: source.events,
      sessionId: source.sessionId,
    };
  }
  const encounter = validateTowEncounterStateV2(source);
  return encounter.ok
    ? { ok: true, state: source, events: null, sessionId: null }
    : { ok: false, reason: encounter.reason || "invalid-presentation-v2-source" };
}

function actorCell(state, actorId) {
  for (const side of ["player", "enemy"]) {
    const index = state.formations[side].indexOf(actorId);
    if (index >= 0) return { side, index };
  }
  return null;
}

function decisionActorId(state) {
  if (towEncounterCombatResultV2(state) !== null || state.economy.phase !== "actor-turn") {
    return null;
  }
  const actorId = state.economy.activeActorId;
  const actor = actorId === null ? null : state.actors[actorId];
  return actor?.controller === "human" && actor.hp > 0 && actorCell(state, actorId)
    ? actorId
    : null;
}

function actorProjection(state, actorId) {
  const actor = state.actors[actorId];
  const economy = state.economy.actors[actorId];
  const field = actorCell(state, actorId);
  return {
    id: actor.id,
    name: actor.name,
    side: actor.side,
    controller: actor.controller,
    field,
    hp: actor.hp,
    maxHp: actor.maxHp,
    shield: actor.shield,
    resolve: economy.resolve,
    maxResolve: economy.maxResolve,
    budgets: { ...economy.budgets },
    cooldowns: Object.entries(economy.cooldowns).map(([abilityId, roundsRemaining]) => ({
      abilityId,
      roundsRemaining,
    })),
    armedReaction: economy.armedReaction === null ? null : { ...economy.armedReaction },
    statuses: state.statuses.actors[actorId].map((status) => ({ ...status })),
  };
}

function formationProjection(state, side) {
  return state.formations[side].map((actorId, index) => ({ side, index, actorId }));
}

function persistedIntentsProjection(state) {
  return Object.entries(state.intents)
    .sort(([, left], [, right]) => left.declaredSequence - right.declaredSequence)
    .map(([actorId, intent], index) => {
      const ability = resolvedAbility(state, actorId, intent.abilityId);
      if (ability === null || ability.rank !== intent.rank) {
        throw new TypeError("invalid-presentation-v2-canonical-intent");
      }
      const committed = commitAbilityTargetsV2(state, ability, intent.targetLock);
      return {
        ordinal: index + 1,
        actorId,
        abilityId: ability.id,
        name: getTowAbilityNameV2(ability.id),
        rank: ability.rank,
        lane: ability.action.lane,
        presentation: { ...ability.presentation },
        declaredSequence: intent.declaredSequence,
        policyId: intent.policyId,
        targetLock: cloneJsonData(intent.targetLock),
        targetCommit: committed.ok ? cloneJsonData(committed) : null,
        fizzleReason: committed.ok ? null : committed.reason,
      };
    });
}

export function projectTowCombatViewV2(source) {
  const canonical = canonicalSource(source);
  if (!canonical.ok) return rejected("view", canonical.reason);
  const { state } = canonical;
  const result = towEncounterCombatResultV2(state);
  const view = {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    presentationVersion: TOW_PRESENTATION_V2_VERSION,
    sessionId: canonical.sessionId,
    terminal: result !== null,
    combatResult: result,
    reactionSequence: state.reactionSequence,
    phase: {
      economyPhase: state.economy.phase,
      round: state.economy.round,
      turn: state.economy.turn,
      activeActorId: state.economy.activeActorId,
      decisionActorId: decisionActorId(state),
    },
    scheduler: {
      version: state.scheduler.version,
      round: state.scheduler.round,
      order: [...state.scheduler.order],
      cursor: state.scheduler.cursor,
      priorityActorIds: [...state.scheduler.priorityActorIds],
      skippedActorIds: [...state.scheduler.skippedActorIds],
      turnBase: state.scheduler.turnBase,
    },
    formations: {
      version: state.formations.version,
      player: formationProjection(state, "player"),
      enemy: formationProjection(state, "enemy"),
    },
    actors: [...state.rosters.player, ...state.rosters.enemy]
      .map((actorId) => actorProjection(state, actorId)),
    zones: state.zones.zones.map((zone) => ({ ...zone })),
    intents: persistedIntentsProjection(state),
  };
  return accepted("view", view);
}

function resolvedAbility(state, actorId, abilityId) {
  const actor = state.actors[actorId];
  const equipped = actor?.loadout.find(({ id }) => id === abilityId);
  const definition = equipped ? getTowAbilityRulesV2(abilityId) : null;
  if (!actor || !equipped || !definition) return null;
  try {
    return abilityRulesV2AtRank(definition, equipped.rank);
  } catch {
    return null;
  }
}

function committedAnchors(state, actorId, ability) {
  const candidates = legalAbilityAnchorsV2(state, ability, actorId).flatMap((anchor) => {
    const declaration = anchor.tracking === "unit"
      ? anchor.actorId
      : { side: anchor.side, index: anchor.index };
    const locked = lockAbilityTargetV2(state, ability, actorId, declaration);
    if (!locked.ok) return [];
    const committed = commitAbilityTargetsV2(state, ability, locked.lock);
    return committed.ok ? [{ anchor, lock: locked.lock, commit: committed }] : [];
  });
  const actorSide = state.actors[actorId].side;
  const hostileIds = [...new Set(candidates.flatMap(({ commit }) => (
    commit.selectedUnits
      .filter(({ actorId: selectedId }) => state.actors[selectedId].side !== actorSide)
      .map(({ actorId: selectedId }) => selectedId)
  )))];
  const forced = resolveTowForcedTargetV2(state.statuses, {
    actorId,
    validActorIds: hostileIds,
  });
  if (!forced.ok || forced.event.targetActorId === null) return candidates;
  return candidates.filter(({ commit }) => commit.selectedUnits.some(
    ({ actorId: selectedId }) => selectedId === forced.event.targetActorId,
  ));
}

function legalAbilityContext(state, actorId, abilityId) {
  const currentActorId = decisionActorId(state);
  if (currentActorId === null) return { ok: false, reason: "no-presentation-v2-decision-actor" };
  if (actorId !== currentActorId) return { ok: false, reason: "invalid-presentation-v2-decision-actor" };
  const ability = resolvedAbility(state, actorId, abilityId);
  if (!ability) return { ok: false, reason: "unknown-presentation-v2-ability" };
  const anchors = committedAnchors(state, actorId, ability);
  if (anchors.length === 0) return { ok: false, reason: "no-legal-presentation-v2-anchor" };
  const economy = ability.action.lane === "reaction"
    ? armTowReactionV2(state.economy, {
        actorId,
        abilityId,
        watchedActorId: anchors[0].lock.anchor.actorId,
      })
    : canUseTowAbilityV2(state.economy, { actorId, abilityId });
  if (!economy.ok) return { ok: false, reason: economy.reason };
  const status = adjudicateTowStatusActionV2(state.statuses, {
    actorId,
    lane: ability.action.lane,
  });
  if (!status.ok) return { ok: false, reason: status.reason };
  return { ok: true, ability, anchors, status: status.event };
}

function actionProjection(state, actorId, ability, anchorCount, status) {
  const economy = state.economy.actors[actorId];
  return {
    abilityId: ability.id,
    name: getTowAbilityNameV2(ability.id),
    rank: ability.rank,
    lane: ability.action.lane,
    commandType: ability.action.lane === "reaction" ? "reaction-arm" : "ability",
    reactionArmable: ability.action.lane === "reaction",
    resolveCost: ability.action.resolveCost,
    cooldown: ability.action.cooldown,
    cooldownRemaining: economy.cooldowns[ability.id] ?? 0,
    budgetRemaining: economy.budgets[ability.action.lane],
    presentation: { ...ability.presentation },
    targeting: {
      side: ability.targeting.side,
      includeCaster: ability.targeting.includeCaster,
      anchorShape: ability.targeting.anchor.shape,
      anchorTracking: ability.targeting.anchor.tracking,
      anchorRange: ability.targeting.anchor.range,
      areaShape: ability.targeting.area.shape,
    },
    status: {
      allowed: status.allowed,
      blockedBy: status.blockedBy,
    },
    anchorCount,
    autoConfirm: anchorCount === 1,
  };
}

export function projectTowLegalActionsV2(source) {
  const canonical = canonicalSource(source);
  if (!canonical.ok) return rejected("query", canonical.reason);
  const { state } = canonical;
  const actorId = decisionActorId(state);
  if (actorId === null) {
    return accepted("query", {
      version: TOW_ABILITY_RULES_V2_VERSION,
      rulesetId: TOW_ABILITY_RULESET_V2_ID,
      actorId: null,
      actions: [],
    });
  }
  const actions = state.actors[actorId].loadout.flatMap(({ id }) => {
    const context = legalAbilityContext(state, actorId, id);
    return context.ok ? [actionProjection(
      state,
      actorId,
      context.ability,
      context.anchors.length,
      context.status,
    )] : [];
  });
  return accepted("query", {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    actorId,
    actions,
  });
}

function anchorProjection(entry, ability, autoConfirm) {
  return {
    tracking: entry.anchor.tracking,
    side: entry.anchor.side,
    index: entry.anchor.index,
    occupantActorId: entry.anchor.actorId,
    empty: entry.anchor.actorId === null,
    areaShape: ability.targeting.area.shape,
    selectedCells: entry.commit.selectedCells.map((cell) => ({ ...cell })),
    selectedUnits: entry.commit.selectedUnits.map((unit) => ({ ...unit })),
    autoConfirm,
  };
}

export function projectTowLegalAnchorsV2(source, input) {
  const canonical = canonicalSource(source);
  if (!canonical.ok) return rejected("query", canonical.reason);
  if (!exactKeys(input, LEGAL_ANCHOR_INPUT_KEYS)
    || !identifier(input.actorId)
    || !identifier(input.abilityId)) return rejected("query", "invalid-presentation-v2-anchor-input");
  const context = legalAbilityContext(canonical.state, input.actorId, input.abilityId);
  if (!context.ok) return rejected("query", context.reason);
  return accepted("query", {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    actorId: input.actorId,
    ability: actionProjection(
      canonical.state,
      input.actorId,
      context.ability,
      context.anchors.length,
      context.status,
    ),
    anchors: context.anchors.map((entry) => (
      anchorProjection(entry, context.ability, context.anchors.length === 1)
    )),
  });
}

export function previewTowAbilityTargetV2(source, input) {
  const canonical = canonicalSource(source);
  if (!canonical.ok) return rejected("preview", canonical.reason);
  if (!exactKeys(input, PREVIEW_INPUT_KEYS)
    || !identifier(input.actorId)
    || !identifier(input.abilityId)) return rejected("preview", "invalid-presentation-v2-preview-input");
  const context = legalAbilityContext(canonical.state, input.actorId, input.abilityId);
  if (!context.ok) return rejected("preview", context.reason);
  const locked = lockAbilityTargetV2(
    canonical.state,
    context.ability,
    input.actorId,
    input.anchor,
  );
  if (!locked.ok) return rejected("preview", locked.reason);
  const entry = context.anchors.find(({ lock }) => (
    JSON.stringify(lock) === JSON.stringify(locked.lock)
  ));
  if (!entry) return rejected("preview", "invalid-v2-target");
  return accepted("preview", {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    actorId: input.actorId,
    ability: actionProjection(
      canonical.state,
      input.actorId,
      context.ability,
      context.anchors.length,
      context.status,
    ),
    targetLock: cloneJsonData(entry.lock),
    targetCommit: cloneJsonData(entry.commit),
  });
}

export function projectTowDeclaredIntentsV2(source, input = {}) {
  const canonical = canonicalSource(source);
  if (!canonical.ok) return rejected("projection", canonical.reason);
  if (!exactKeys(input, NO_INPUT_KEYS)) {
    return rejected("projection", "invalid-presentation-v2-intents-input");
  }
  return accepted("projection", {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    intents: persistedIntentsProjection(canonical.state),
  });
}

function validTargetCommit(state, commit) {
  if (!exactKeys(commit, TARGET_COMMIT_KEYS)
    || commit.ok !== true
    || commit.reason !== null
    || commit.version !== TOW_TARGET_COMMIT_V2_VERSION
    || commit.rulesetId !== TOW_ABILITY_RULESET_V2_ID
    || !identifier(commit.abilityId)
    || !identifier(commit.casterId)
    || !Number.isSafeInteger(commit.rank)
    || commit.rank < 1
    || !formationCell(commit.sourceCell)
    || !exactKeys(commit.anchor, TARGET_COMMIT_ANCHOR_KEYS)
    || !["cell", "unit"].includes(commit.anchor.tracking)
    || !TOW_FORMATION_SIDES_V2.includes(commit.anchor.side)
    || !Number.isSafeInteger(commit.anchor.index)
    || commit.anchor.index < 0
    || commit.anchor.index >= 9
    || !Array.isArray(commit.selectedCells)
    || !Array.isArray(commit.selectedUnits)) return false;

  if ((commit.anchor.tracking === "unit" && !identifier(commit.anchor.actorId))
    || (commit.anchor.tracking === "cell" && commit.anchor.actorId !== null)) return false;
  const definition = getTowAbilityRulesV2(commit.abilityId);
  const caster = state.actors[commit.casterId];
  if (!definition || !caster || caster.side !== commit.sourceCell.side) return false;
  try {
    abilityRulesV2AtRank(definition, commit.rank);
  } catch {
    return false;
  }

  const cellKeys = new Set();
  for (const cell of commit.selectedCells) {
    if (!formationCell(cell)) return false;
    const key = `${cell.side}:${cell.index}`;
    if (cellKeys.has(key)) return false;
    cellKeys.add(key);
  }
  const unitIds = new Set();
  for (const unit of commit.selectedUnits) {
    if (!exactKeys(unit, TARGET_UNIT_KEYS)
      || !formationCell({ side: unit.side, index: unit.index })
      || !identifier(unit.actorId)
      || !cellKeys.has(`${unit.side}:${unit.index}`)
      || unitIds.has(unit.actorId)
      || !state.actors[unit.actorId]
      || state.actors[unit.actorId].side !== unit.side) return false;
    unitIds.add(unit.actorId);
  }
  return true;
}

function validEventTargetSnapshots(state, event) {
  if (Object.hasOwn(event, "targetLock")
    && event.targetLock !== null
    && !isAbilityTargetLockV2(event.targetLock)) return false;
  if (!Object.hasOwn(event, "targetCommit") || event.targetCommit === null) return true;
  return validTargetCommit(state, event.targetCommit);
}

function validPresentationEvents(state, events) {
  if (!Array.isArray(events) || events.length > MAX_TOW_SESSION_EVENTS_V2) return false;
  try {
    const snapshot = cloneJsonData(events, "invalid-presentation-v2-events");
    for (let index = 0; index < snapshot.length; index += 1) {
      const event = snapshot[index];
      if (!event
        || typeof event !== "object"
        || Array.isArray(event)
        || event.version !== TOW_ABILITY_RULES_V2_VERSION
        || event.rulesetId !== TOW_ABILITY_RULESET_V2_ID
        || event.ordinal !== index + 1
        || typeof event.type !== "string"
        || event.type.length === 0
        || event.type.length > 256
        || (Object.hasOwn(event, "abilityId")
          && (!identifier(event.abilityId) || getTowAbilityRulesV2(event.abilityId) === null))
        || !validEventTargetSnapshots(state, event)) return false;
      if (event.targetLock) {
        const definition = getTowAbilityRulesV2(event.targetLock.abilityId);
        if (!definition || !state.actors[event.targetLock.casterId]) return false;
        try {
          abilityRulesV2AtRank(definition, event.targetLock.rank);
        } catch {
          return false;
        }
      }
      if (identifier(event.abilityId)
        && event.targetLock
        && event.abilityId !== event.targetLock.abilityId) return false;
      if (identifier(event.abilityId)
        && event.targetCommit
        && event.abilityId !== event.targetCommit.abilityId) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function eventContextKey(event) {
  return identifier(event.commandId) ? `command:${event.commandId}` : "local";
}

function targetContext(event) {
  return event.targetCommit || event.targetLock ? event : null;
}

function eventContext(event, trackers) {
  const key = eventContextKey(event);
  const tracker = trackers.get(key) ?? { base: null, active: null };
  const direct = targetContext(event);
  let context = tracker.active ?? tracker.base;
  if (["action-committed", "reaction-armed"].includes(event.type) && direct) {
    tracker.base = direct;
    tracker.active = direct;
    context = direct;
  } else if (event.type === "reaction-triggered" && direct) {
    tracker.active = direct;
    context = direct;
  } else if (direct) {
    context = direct;
  } else if (identifier(event.abilityId)) {
    const matching = tracker.active?.abilityId === event.abilityId
      ? tracker.active
      : tracker.base?.abilityId === event.abilityId
        ? tracker.base
        : null;
    if (matching) {
      context = matching;
      if (event.type === "ability-effect-started") tracker.active = matching;
    }
  }
  trackers.set(key, tracker);
  return { context, tracker };
}

function eventTargetSnapshot(context) {
  if (!context) return null;
  if (context.targetCommit) {
    return {
      complete: true,
      anchor: { ...context.targetCommit.anchor },
      sourceCell: { ...context.targetCommit.sourceCell },
      selectedCells: context.targetCommit.selectedCells.map((cell) => ({ ...cell })),
      selectedUnits: context.targetCommit.selectedUnits.map((unit) => ({ ...unit })),
    };
  }
  if (context.targetLock) {
    return {
      complete: false,
      anchor: { ...context.targetLock.anchor },
      sourceCell: null,
      selectedCells: [],
      selectedUnits: [],
    };
  }
  return null;
}

export function projectTowEventPresentationV2(source, input = {}) {
  const canonical = canonicalSource(source);
  if (!canonical.ok) return rejected("projection", canonical.reason);
  if (!exactKeys(input, []) && !exactKeys(input, EVENT_INPUT_KEYS)) {
    return rejected("projection", "invalid-presentation-v2-event-input");
  }
  const events = Object.hasOwn(input, "events") ? input.events : canonical.events;
  if (events === null) return rejected("projection", "presentation-v2-events-required");
  if (!validPresentationEvents(canonical.state, events)) {
    return rejected("projection", "invalid-presentation-v2-events");
  }
  const snapshot = cloneJsonData(events);
  const contextTrackers = new Map();
  const payloads = snapshot.map((event) => {
    const resolvedContext = eventContext(event, contextTrackers);
    const { context, tracker } = resolvedContext;
    const abilityId = identifier(event.abilityId) ? event.abilityId : context?.abilityId ?? null;
    const actorId = event.actorId ?? event.sourceActorId ?? context?.actorId ?? null;
    const rank = context?.targetCommit?.rank
      ?? context?.targetLock?.rank
      ?? (abilityId && actorId ? canonical.state.economy.actors[actorId]?.abilityRanks[abilityId] : null)
      ?? null;
    const definition = abilityId === null ? null : getTowAbilityRulesV2(abilityId);
    let ability = null;
    try {
      ability = definition && Number.isSafeInteger(rank)
        ? abilityRulesV2AtRank(definition, rank)
        : null;
    } catch {
      ability = null;
    }
    const payload = {
      ordinal: event.ordinal,
      commandId: event.commandId ?? null,
      type: event.type,
      actorId,
      ability: ability === null ? null : {
        id: ability.id,
        name: getTowAbilityNameV2(ability.id),
        rank: ability.rank,
        lane: ability.action.lane,
        castMode: ability.presentation.castMode,
        tier: ability.presentation.tier,
      },
      targetSnapshot: eventTargetSnapshot(context),
      effect: Number.isSafeInteger(event.effectIndex) ? {
        index: event.effectIndex,
        primitive: event.primitive ?? null,
        recipientIndex: Number.isSafeInteger(event.recipientIndex) ? event.recipientIndex : null,
      } : null,
      detail: event,
    };
    if (event.type === "reaction-completed") tracker.active = tracker.base;
    return payload;
  });
  return accepted("projection", {
    version: TOW_ABILITY_RULES_V2_VERSION,
    rulesetId: TOW_ABILITY_RULESET_V2_ID,
    payloads,
  });
}
