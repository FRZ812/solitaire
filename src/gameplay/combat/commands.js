// The command boundary: the only way a fight changes.
//
// Before this, a click called the reducer and React kept whatever came back. That works
// until two of them race — an autosave, a double-tap, a reload mid-turn — and then the same
// swing lands twice, or a swing lands against a fight that has already moved on. Neither is
// detectable after the fact, because nothing recorded which inputs the state was built from.
//
// So every accepted input is an identified, sequenced record:
//
//   validate  — is this command legal against *this* revision of the session?
//   resolve   — run it, producing events and stream endpoints, touching nothing
//   apply     — commit: append the command, bump the revision, reseal
//
// Two properties fall out and both matter for play. A command carrying an ID that has
// already been accepted is a no-op that returns the original state, so the double-tap is
// free. A command carrying a revision that is no longer current is refused, so the swing
// against a stale fight cannot land.
//
// Resolution and application are still fused inside `encounter.js`: the reducer applies its
// own events as it produces them. The boundary is named and enforced here — nothing else
// may call the reducer — and the split lands inside the reducer when it is decomposed. What
// is already true is that no state reaches the session except through this file, and every
// byte of it is reproducible from the commands recorded alongside it.

import { cloneJsonData, equalJsonData } from "../kernel/json-data.js";
import { gameplayChecksum } from "../kernel/replay.js";
import {
  actionsLeftFor,
  attemptRetreat as encounterAttemptRetreat,
  endTurn as encounterEndTurn,
  playerSideIds,
  skipTurn as encounterSkipTurn,
  useCombatItem as encounterUseCombatItem,
  useSkill as encounterUseSkill,
} from "./encounter.js";
import {
  MAX_COMBAT_COMMANDS,
  COMBAT_RULESET_ID,
  sealCombatSession,
} from "./session.js";


export const COMBAT_COMMAND_VERSION = 1;

/**
 * Every command type the session schema admits.
 *
 * Surrender is declared but not yet resolvable. Retreat is a first-class replayed command:
 * its party comparison and roll live in the encounter.
 */
export const COMBAT_COMMAND_TYPES = Object.freeze([
  "use-skill",
  "use-item",
  "end-turn",
  "stand-down",
  "attempt-retreat",
  "accept-surrender",
]);

const RESOLVABLE_COMMAND_TYPES = Object.freeze([
  "use-skill",
  "use-item",
  "end-turn",
  "stand-down",
  "attempt-retreat",
]);

const COMMAND_INPUT_KEYS = Object.freeze([
  "actorId",
  "anchorCell",
  "expectedRevision",
  "id",
  "itemId",
  "skillId",
  "targetId",
  "type",
].sort());
const PRIOR_COMMAND_INPUT_KEYS = Object.freeze(
  COMMAND_INPUT_KEYS.filter((key) => key !== "anchorCell"),
);
const LEGACY_COMMAND_INPUT_KEYS = Object.freeze(
  PRIOR_COMMAND_INPUT_KEYS.filter((key) => key !== "itemId"),
);

const MAX_IDENTIFIER_LENGTH = 256;

function identifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH;
}

function isAnchorCell(value) {
  return value === null || (
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === "index,side"
    && (value.side === "player" || value.side === "enemy")
    && Number.isSafeInteger(value.index)
    && value.index >= 0
    && value.index < 9
  );
}

function refused(reason, session) {
  return { ok: false, reason, session, command: null, events: [], duplicate: false };
}

/**
 * Normalise a caller's command into the exact durable input shape.
 *
 * Unknown keys are dropped rather than carried: a command is a replay input, and an extra
 * field that survives into the log is a field replay would have to reproduce.
 */
export function combatCommand(input = {}) {
  return {
    id: input.id,
    expectedRevision: input.expectedRevision,
    type: input.type,
    actorId: input.actorId ?? null,
    anchorCell: input.anchorCell == null ? null : {
      side: input.anchorCell.side,
      index: input.anchorCell.index,
    },
    itemId: input.itemId ?? null,
    skillId: input.skillId ?? null,
    targetId: input.targetId ?? null,
  };
}

function isCommandInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const current = keys.length === COMMAND_INPUT_KEYS.length
    && keys.every((key, index) => key === COMMAND_INPUT_KEYS[index]);
  const prior = keys.length === PRIOR_COMMAND_INPUT_KEYS.length
    && keys.every((key, index) => key === PRIOR_COMMAND_INPUT_KEYS[index]);
  const legacy = keys.length === LEGACY_COMMAND_INPUT_KEYS.length
    && keys.every((key, index) => key === LEGACY_COMMAND_INPUT_KEYS[index]);
  if (!current && !prior && !legacy) return false;
  return identifier(value.id)
    && COMBAT_COMMAND_TYPES.includes(value.type)
    && Number.isSafeInteger(value.expectedRevision)
    && value.expectedRevision >= 0
    && (value.actorId === null || identifier(value.actorId))
    && (value.anchorCell === undefined || isAnchorCell(value.anchorCell))
    && (value.itemId == null || identifier(value.itemId))
    && (value.skillId === null || identifier(value.skillId))
    && (value.targetId === null || identifier(value.targetId));
}

/**
 * Is this command legal against this exact revision of this session?
 *
 * Legality is decided here and nowhere else. A disabled button is a courtesy, not a rule —
 * the same command arriving from a replay, a stale tab, or a test has to meet the same bar.
 */
export function validateCombatCommand(session, command) {
  if (!session || typeof session !== "object") return { ok: false, reason: "invalid-session" };
  if (!isCommandInput(command)) return { ok: false, reason: "invalid-command" };

  if (session.status === "settled") return { ok: false, reason: "session-settled" };
  if (session.status === "terminal" || session.encounter.phase !== "player") {
    return { ok: false, reason: "encounter-over" };
  }
  if (session.commands.some((entry) => entry.id === command.id)) {
    return { ok: false, reason: "duplicate-command" };
  }
  if (command.expectedRevision !== session.revision) {
    return { ok: false, reason: "stale-revision" };
  }
  if (session.commands.length >= MAX_COMBAT_COMMANDS) {
    return { ok: false, reason: "command-limit-exceeded" };
  }
  // One command window covers the whole player side: the protagonist and every ally under
  // their command. Anyone else — a foe, or an actor the session has no model of — would
  // write a fight nobody could replay.
  const commandable = [session.encounter.playerId, ...(session.encounter.allyIds || [])];
  if (command.actorId !== null && !commandable.includes(command.actorId)) {
    return { ok: false, reason: "unknown-actor" };
  }
  if (!RESOLVABLE_COMMAND_TYPES.includes(command.type)) {
    if (command.type === "accept-surrender") {
      return { ok: false, reason: "no-surrender-offered" };
    }
    return { ok: false, reason: "unsupported-command-type" };
  }
  if (command.type === "use-skill" && !identifier(command.skillId)) {
    return { ok: false, reason: "invalid-skill" };
  }
  if (command.type === "use-item" && !identifier(command.itemId)) {
    return { ok: false, reason: "invalid-combat-item" };
  }
  return { ok: true, reason: null };
}

/**
 * The canonical events one command produced.
 *
 * The encounter keeps its own append-only log; a command records the range it appended. So
 * every event is attributable to the command that caused it without storing the log twice,
 * and an event that belongs to no command — the combat-start traits that fire before the
 * player has done anything — is honestly reported as such.
 */
export function combatCommandEvents(session, command) {
  return session.encounter.events
    .slice(command.eventsFrom, command.eventsTo)
    .map((entry) => ({
      ...entry,
      eventSequence: entry.sequence,
      commandId: command.id,
      rulesetId: session.rulesetId,
    }));
}

/** Every event in the session, each stamped with the command that caused it. */
export function combatSessionEvents(session) {
  const owner = new Map();
  for (const command of session.commands) {
    for (let at = command.eventsFrom; at < command.eventsTo; at += 1) owner.set(at, command.id);
  }
  return session.encounter.events.map((entry, index) => ({
    ...entry,
    eventSequence: entry.sequence,
    commandId: owner.get(index) ?? null,
    rulesetId: session.rulesetId,
  }));
}

/**
 * Run a validated command without committing anything.
 *
 * Returns the encounter the command would produce and the stream endpoints it would leave.
 * On refusal nothing has moved — in particular no stream has advanced, which is what makes
 * "an illegal command costs nothing" true rather than merely intended.
 */
export function resolveCombatCommand(session, command) {
  return resolveCombatCommandOnEncounter(session.encounter, command);
}

/**
 * The reducer call itself, against a bare encounter.
 *
 * Replay verification goes through this exact function rather than a parallel one, so a
 * verified session is verified against the code that will actually run it — a second
 * implementation could agree with the recording and still disagree with production.
 */
function resolveCombatCommandOnEncounterInternal(before, command) {
  const actorId = command.actorId ?? before.playerId;
  let result;
  if (command.type === "use-skill") {
    result = encounterUseSkill(
      before,
      command.skillId,
      command.targetId,
      actorId,
      command.anchorCell ?? null,
    );
  } else if (command.type === "use-item") {
    result = encounterUseCombatItem(before, command.itemId, command.targetId, actorId);
  } else if (command.type === "attempt-retreat") {
    result = encounterAttemptRetreat(before, actorId);
  } else if (command.type === "stand-down") {
    result = encounterSkipTurn(before, actorId);
  } else if (command.type === "end-turn") {
    result = encounterEndTurn(before);
  } else {
    return { ok: false, reason: "unsupported-command-type", encounter: before, streams: {} };
  }
  if (!result.ok) return { ok: false, reason: result.reason, encounter: before, streams: {} };

  const after = result.state;
  // Only streams that actually moved are recorded, so a command that spent no randomness
  // does not look like one that did — and a telegraph advancing is visibly a different kind
  // of spend from a damage roll.
  const streams = {};
  if (after.rng.state !== before.rng.state) streams.combat = { ...after.rng };
  if (after.intentRng.state !== before.intentRng.state) streams.intent = { ...after.intentRng };
  return { ok: true, reason: null, encounter: after, streams };
}

export function resolveCombatCommandOnEncounter(before, command) {
  return resolveCombatCommandOnEncounterInternal(before, command);
}

/**
 * Commit a resolution: append the command, bump the revision, reseal the session.
 *
 * The revision and the accepted-command count move together by construction. That is what
 * lets `stale-revision` be trusted — there is no way to advance one without the other.
 */
export function applyCombatResolution(session, command, resolution) {
  const accepted = {
    ...command,
    seq: session.commands.length,
    eventsFrom: session.encounter.sequence,
    eventsTo: resolution.encounter.sequence,
    streams: resolution.streams,
    // The encounter's own hash after this command. Replay compares these in order, so a
    // divergence is localised to the exact command that caused it rather than to the end.
    stateChecksum: gameplayChecksum(resolution.encounter),
  };
  const terminal = resolution.encounter.phase !== "player";
  return sealCombatSession({
    ...session,
    status: terminal ? "terminal" : "active",
    revision: session.revision + 1,
    commands: [...session.commands, accepted],
    encounter: resolution.encounter,
    checksum: null,
  });
}

/**
 * The one entry point a fight changes through.
 *
 * @returns {{ok: boolean, reason: string|null, session: object, command: object|null,
 *   events: Array<object>, duplicate: boolean}}
 *   On refusal the session comes back untouched. On a duplicate the original session comes
 *   back with the original command's events, so a retry is indistinguishable from the first
 *   success — which is exactly what an interrupted save needs on resume.
 */
export function dispatchCombatCommand(session, input) {
  let command;
  try {
    command = cloneJsonData(combatCommand(input), "invalid-command");
  } catch {
    return refused("invalid-command", session);
  }
  if (!isCommandInput(command)) return refused("invalid-command", session);

  const prior = session?.commands?.find?.((entry) => entry.id === command.id);
  if (prior) {
    if (!equalJsonData(combatCommand(prior), command)) {
      return refused("command-id-conflict", session);
    }
    // Exactly-once. The exact normalized command already landed; replaying it must not
    // resolve it again or report a second failure — the caller's recorded intent was met.
    return {
      ok: true,
      reason: null,
      session,
      command: prior,
      events: combatCommandEvents(session, prior),
      duplicate: true,
    };
  }

  const legal = validateCombatCommand(session, command);
  if (!legal.ok) return refused(legal.reason, session);

  const resolution = resolveCombatCommand(session, command);
  if (!resolution.ok) return refused(resolution.reason, session);

  const next = applyCombatResolution(session, command, resolution);
  const accepted = next.commands[next.commands.length - 1];
  return {
    ok: true,
    reason: null,
    session: next,
    command: accepted,
    events: combatCommandEvents(next, accepted),
    duplicate: false,
  };
}

/**
 * Whether the player side has spent every turn-consuming action in this command window.
 *
 * Free skills never lower this budget. Haste and net Priority increase it when the round is
 * opened, so they are naturally spent before the enemy is allowed to answer. With allies,
 * the window stays open until every living party member has either acted or stood down.
 */
function playerSideIsSpent(encounter) {
  if (encounter.phase !== "player") return false;
  const living = playerSideIds(encounter)
    .filter((actorId) => encounter.actors[actorId]?.hp > 0);
  return living.length > 0
    && living.every((actorId) => actionsLeftFor(encounter, actorId) <= 0);
}

/**
 * Dispatch one interactive player action, then advance the enemy automatically if that
 * action exhausted the whole side's budget.
 *
 * The automatic advance is a real, deterministic `end-turn` command rather than hidden
 * reducer work. That keeps the v1 log replayable and leaves old logs — where end-turn was a
 * manual input — unchanged. Both pure dispatches are returned atomically to the caller: if
 * the automatic command cannot be admitted, neither intermediate state is committed.
 */
export function dispatchCombatPlayerAction(session, input) {
  const primary = dispatchCombatCommand(session, input);
  const canAutoAdvance = primary.ok
    && !primary.duplicate
    && ["use-skill", "use-item", "stand-down", "attempt-retreat"].includes(primary.command?.type)
    && playerSideIsSpent(primary.session.encounter);

  if (!canAutoAdvance) {
    return { ...primary, autoAdvanced: false, autoCommand: null };
  }

  const automatic = dispatchCombatCommand(primary.session, {
    id: `auto-end:${primary.session.revision}`,
    expectedRevision: primary.session.revision,
    type: "end-turn",
    actorId: null,
    anchorCell: null,
    itemId: null,
    skillId: null,
    targetId: null,
  });
  if (!automatic.ok) {
    return {
      ...refused(`auto-advance-${automatic.reason}`, session),
      autoAdvanced: false,
      autoCommand: null,
    };
  }

  return {
    ...primary,
    session: automatic.session,
    events: [...primary.events, ...automatic.events],
    autoAdvanced: true,
    autoCommand: automatic.command,
  };
}

/** The ruleset a command log was accepted under; a replay under another is not a replay. */
export function commandLogRulesetId(session) {
  return session?.rulesetId ?? COMBAT_RULESET_ID;
}
