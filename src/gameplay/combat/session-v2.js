// Durable, reducer-independent session authority for solitaire-combat-v2.
//
// Genesis is the only replay starting point. The encounter, event stream, command log,
// revision, terminal receipt, and full-session checksum are mutually checked projections of
// that immutable input; none is trusted as a replacement for another.

import { cloneJsonData, equalJsonData } from "../kernel/json-data.js";
import { gameplayChecksum } from "../kernel/replay.js";
import {
  COMBAT_ABILITY_RULESET_V2_ID,
  COMBAT_ABILITY_RULES_V2_VERSION,
} from "./ability-rules-v2.js";
import {
  COMBAT_DAMAGE_POLICY_V2_CHECKSUM,
} from "./damage-v2.js";
import { COMBAT_AI_POLICY_REGISTRY_V2_CHECKSUM } from "./ai-v2.js";
import {
  PINNED_COMBAT_ABILITY_CATALOG_V2_CHECKSUM,
  COMBAT_ENCOUNTER_EXECUTION_POLICY_V2,
  COMBAT_ENCOUNTER_POLICY_V2,
  COMBAT_ENCOUNTER_POLICY_V2_ID,
  createCombatEncounterGenesisV2,
  defineCombatEncounterStateV2,
  validateCombatEncounterStateV2,
} from "./encounter-state-v2.js";
import {
  COMBAT_ENCOUNTER_REDUCER_V2_VERSION,
} from "./encounter-v2.js";
import {
  COMBAT_STATUS_POLICY_V2_CHECKSUM,
} from "./status-runtime-v2.js";

export const COMBAT_SESSION_V2_VERSION = 2;
export const COMBAT_SESSION_V2_STATUSES = Object.freeze(["active", "terminal"]);
export const MAX_COMBAT_SESSION_COMMANDS_V2 = 4096;
export const MAX_COMBAT_SESSION_EVENTS_V2 = 100_000;
export const MAX_COMBAT_SESSION_IDENTIFIER_LENGTH_V2 = 256;

const PINNED_STATUS_CHECKSUM = "fnv1a32:bcab7c74";
const PINNED_DAMAGE_CHECKSUM = "fnv1a32:f41dd5bb";
const PINNED_AI_POLICY_CHECKSUM = "fnv1a32:9bcc646d";
const PINNED_ENCOUNTER_POLICY_CHECKSUM = "fnv1a64:439053b5ed42608d";

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
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_COMBAT_SESSION_IDENTIFIER_LENGTH_V2;
}

function sameData(left, right) {
  return equalJsonData(left, right);
}

export const COMBAT_SESSION_EXECUTION_POLICY_V2 = deepFreeze({
  id: "solitaire-combat-v2-session-policy-v1",
  version: COMBAT_SESSION_V2_VERSION,
  rulesetId: COMBAT_ABILITY_RULESET_V2_ID,
  catalogChecksum: PINNED_COMBAT_ABILITY_CATALOG_V2_CHECKSUM,
  encounterPolicyId: COMBAT_ENCOUNTER_POLICY_V2_ID,
  encounterPolicyChecksum: PINNED_ENCOUNTER_POLICY_CHECKSUM,
  reducerVersion: COMBAT_ENCOUNTER_REDUCER_V2_VERSION,
  statusPolicyChecksum: PINNED_STATUS_CHECKSUM,
  damagePolicyChecksum: PINNED_DAMAGE_CHECKSUM,
  aiPolicyChecksum: PINNED_AI_POLICY_CHECKSUM,
  revision: "accepted-command-count",
  eventOwnership: "zero-based-half-open-contiguous-command-ranges",
  replayGenesis: "exact-createCombatEncounterGenesisV2-input",
  stateIntegrity: "before-and-after-every-command",
  supportedCommands: Object.freeze([
    "round-start",
    "actor-turn-start",
    "reaction-arm",
    "ability",
    "actor-turn-end",
    "round-end",
    "ai-step",
  ]),
  unsupported: Object.freeze(["ai", "ai-turn", "ai-ability"]),
});

export function calculateCombatSessionPolicyV2Checksum() {
  return `fnv1a64:${gameplayChecksum(COMBAT_SESSION_EXECUTION_POLICY_V2)}`;
}

// This literal is intentionally repinned only alongside reviewed policy changes.
export const COMBAT_SESSION_POLICY_V2_CHECKSUM = "fnv1a64:b52e642fdb33f8f4";

const SESSION_KEYS = Object.freeze([
  "checksum",
  "commands",
  "encounter",
  "events",
  "genesis",
  "genesisChecksum",
  "policy",
  "policyChecksum",
  "revision",
  "rulesetId",
  "sessionId",
  "status",
  "terminal",
  "version",
].sort());
const CREATE_KEYS = Object.freeze(["genesis", "sessionId"].sort());
const TERMINAL_KEYS = Object.freeze(["result", "revision", "stateChecksum"].sort());

function checksumBody(session) {
  const { checksum: _checksum, ...body } = session;
  return body;
}

export function combatEncounterStateChecksumV2(state) {
  return `state-v2:${gameplayChecksum(state)}`;
}

export function combatGenesisChecksumV2(genesis) {
  return `genesis-v2:${gameplayChecksum(genesis)}`;
}

export function combatSessionChecksumV2(session) {
  return `integrity-v2:${gameplayChecksum(checksumBody(session))}`;
}

export function sealCombatSessionV2(session) {
  const detached = cloneJsonData({ ...session, checksum: null }, "invalid-combat-session-v2");
  detached.checksum = combatSessionChecksumV2(detached);
  return deepFreeze(detached);
}

export function combatEncounterCombatResultV2(state) {
  const validation = validateCombatEncounterStateV2(state);
  if (!validation.ok) return null;
  const playerDefeated = state.rosters.player.every((id) => state.actors[id].hp <= 0);
  const enemyDefeated = state.rosters.enemy.every((id) => state.actors[id].hp <= 0);
  if (playerDefeated && enemyDefeated) return "draw";
  if (enemyDefeated) return "victory";
  if (playerDefeated) return "defeat";
  return null;
}

export function terminalCombatSessionReceiptV2(state, revision) {
  const result = combatEncounterCombatResultV2(state);
  return result === null ? null : deepFreeze({
    result,
    revision,
    stateChecksum: combatEncounterStateChecksumV2(state),
  });
}

function eventShape(event, index) {
  return event
    && typeof event === "object"
    && !Array.isArray(event)
    && event.version === COMBAT_ABILITY_RULES_V2_VERSION
    && event.rulesetId === COMBAT_ABILITY_RULESET_V2_ID
    && event.ordinal === index + 1
    && identifier(event.commandId)
    && typeof event.type === "string"
    && event.type.length > 0;
}

function terminalReason(session) {
  const result = combatEncounterCombatResultV2(session.encounter);
  if (result === null) {
    return session.status === "active" && session.terminal === null
      ? null
      : "invalid-combat-session-v2-terminal-state";
  }
  if (session.status !== "terminal"
    || !exactKeys(session.terminal, TERMINAL_KEYS)
    || session.terminal.result !== result
    || session.terminal.revision !== session.revision
    || session.terminal.stateChecksum !== combatEncounterStateChecksumV2(session.encounter)) {
    return "invalid-combat-session-v2-terminal-state";
  }
  return null;
}

/** Structural session validation. Command-record exactness is owned by commands-v2. */
export function validateCombatSessionV2(value, { verifyChecksum = true } = {}) {
  let reason = null;
  try {
    if (!exactKeys(value, SESSION_KEYS)) reason = "invalid-combat-session-v2-shape";
    else if (value.version !== COMBAT_SESSION_V2_VERSION
      || value.rulesetId !== COMBAT_ABILITY_RULESET_V2_ID) reason = "invalid-combat-session-v2-ruleset";
    else if (!identifier(value.sessionId)) reason = "invalid-combat-session-v2-id";
    else if (value.policyChecksum !== COMBAT_SESSION_POLICY_V2_CHECKSUM
      || !sameData(value.policy, COMBAT_SESSION_EXECUTION_POLICY_V2)) {
      reason = "invalid-combat-session-v2-policy";
    } else if (!Array.isArray(value.commands)
      || value.commands.length > MAX_COMBAT_SESSION_COMMANDS_V2
      || !Number.isSafeInteger(value.revision)
      || value.revision < 0
      || value.revision !== value.commands.length) reason = "invalid-combat-session-v2-revision";
    else if (!Array.isArray(value.events)
      || value.events.length > MAX_COMBAT_SESSION_EVENTS_V2
      || value.events.some((event, index) => !eventShape(event, index))) {
      reason = "invalid-combat-session-v2-events";
    } else if (value.genesisChecksum !== combatGenesisChecksumV2(value.genesis)) {
      reason = "invalid-combat-session-v2-genesis-checksum";
    } else {
      const opening = createCombatEncounterGenesisV2(value.genesis);
      if (!opening.ok) reason = opening.reason || "invalid-combat-session-v2-genesis";
      else {
        const encounter = validateCombatEncounterStateV2(value.encounter);
        if (!encounter.ok) reason = encounter.reason || "invalid-combat-session-v2-encounter";
        else if (!COMBAT_SESSION_V2_STATUSES.includes(value.status)) {
          reason = "invalid-combat-session-v2-status";
        } else reason = terminalReason(value);
      }
    }
    if (reason === null && verifyChecksum
      && value.checksum !== combatSessionChecksumV2(value)) reason = "combat-session-v2-checksum-mismatch";
  } catch {
    reason = "invalid-combat-session-v2-data";
  }
  return Object.freeze({ ok: reason === null, reason });
}

export function defineCombatSessionV2(value, options) {
  const validation = validateCombatSessionV2(value, options);
  if (!validation.ok) throw new TypeError(validation.reason);
  const detached = cloneJsonData(value, "invalid-combat-session-v2");
  detached.encounter = defineCombatEncounterStateV2(detached.encounter);
  return deepFreeze(detached);
}

export function createCombatSessionV2(input) {
  if (!exactKeys(input, CREATE_KEYS) || !identifier(input.sessionId)) {
    return Object.freeze({ ok: false, reason: "invalid-combat-session-v2-create-input", session: null });
  }
  let genesis;
  try {
    genesis = cloneJsonData(input.genesis, "invalid-combat-session-v2-genesis");
  } catch {
    return Object.freeze({ ok: false, reason: "invalid-combat-session-v2-genesis", session: null });
  }
  const opening = createCombatEncounterGenesisV2(genesis);
  if (!opening.ok) return Object.freeze({ ok: false, reason: opening.reason, session: null });
  const terminal = terminalCombatSessionReceiptV2(opening.state, 0);
  const session = sealCombatSessionV2({
    version: COMBAT_SESSION_V2_VERSION,
    rulesetId: COMBAT_ABILITY_RULESET_V2_ID,
    sessionId: input.sessionId,
    policyChecksum: COMBAT_SESSION_POLICY_V2_CHECKSUM,
    policy: COMBAT_SESSION_EXECUTION_POLICY_V2,
    status: terminal === null ? "active" : "terminal",
    revision: 0,
    genesis,
    genesisChecksum: combatGenesisChecksumV2(genesis),
    commands: [],
    events: [],
    encounter: opening.state,
    terminal,
    checksum: null,
  });
  const validation = validateCombatSessionV2(session);
  return validation.ok
    ? deepFreeze({ ok: true, reason: null, session })
    : deepFreeze({ ok: false, reason: validation.reason, session: null });
}

if (COMBAT_STATUS_POLICY_V2_CHECKSUM !== PINNED_STATUS_CHECKSUM
  || COMBAT_DAMAGE_POLICY_V2_CHECKSUM !== PINNED_DAMAGE_CHECKSUM
  || COMBAT_AI_POLICY_REGISTRY_V2_CHECKSUM !== PINNED_AI_POLICY_CHECKSUM
  || `fnv1a64:${gameplayChecksum(COMBAT_ENCOUNTER_POLICY_V2)}`
    !== PINNED_ENCOUNTER_POLICY_CHECKSUM
  || COMBAT_ENCOUNTER_EXECUTION_POLICY_V2.reducerVersion !== COMBAT_ENCOUNTER_REDUCER_V2_VERSION
  || calculateCombatSessionPolicyV2Checksum() !== COMBAT_SESSION_POLICY_V2_CHECKSUM) {
  throw new TypeError("combat-session-v2-upstream-policy-drift");
}
