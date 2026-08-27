import { cloneJsonData, equalJsonData } from "../kernel/json-data.js";
import { createIntentState, encounterIntentFromState } from "../kernel/intent.js";
import { createEncounter } from "../kernel/model.js";
import { replayCommandSequence, resolveCommand } from "../kernel/resolve.js";

export const PRODUCTION_COMBAT_SESSION_VERSION = 1;
export const MAX_PRODUCTION_COMBAT_COMMANDS = 4096;
const MAX_IDENTIFIER_LENGTH = 256;
const MAX_NAME_LENGTH = 128;
const MAX_NOTE_LENGTH = 2_000;
const MAX_COMBAT_VALUE = 1_000_000;
const DOMAIN = "solitaire-production-combat";
const SESSION_KEYS = Object.freeze([
  "campaignId",
  "domain",
  "encounter",
  "history",
  "initial",
  "sequence",
  "sessionId",
  "source",
  "status",
  "version",
]);
const INITIAL_KEYS = Object.freeze(["enemy", "player", "rules", "seed", "version"]);
const PLAYER_KEYS = Object.freeze([
  "attack",
  "defense",
  "hp",
  "maxHp",
  "name",
  "proficiencyId",
]);
const ENEMY_KEYS = Object.freeze(["damage", "defense", "hp", "maxHp", "name", "npcId"]);
const DAMAGE_KEYS = Object.freeze(["max", "min"]);
const SOURCE_KEYS = Object.freeze(["kind", "lethal", "note"]);
const ACTION_COMMAND_KEYS = Object.freeze(["actionId", "actorId", "targetId", "type"]);
const trustedSessions = new WeakSet();

export const PRODUCTION_COMBAT_RULES = deepFreeze({
  version: 1,
  id: "solitaire-production-combat-v1",
  actions: [
    {
      id: "strike",
      name: "Strike",
      consumesTurn: true,
      target: "enemy",
      effect: {
        type: "damage",
        stat: "attack",
        multiplier: 1,
        mitigationStat: "defense",
        variance: { min: 0, max: 0 },
      },
    },
    {
      id: "guard",
      name: "Guard",
      consumesTurn: true,
      target: "self",
      effect: {
        type: "defend",
        stat: "defense",
        base: 2,
        multiplier: 1,
      },
    },
  ],
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactKeys(value, keys) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && equalJsonData(Object.keys(value).sort(), keys);
}

function identifier(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_IDENTIFIER_LENGTH;
}

function name(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_NAME_LENGTH;
}

function combatInteger(value, { positive = false } = {}) {
  return Number.isSafeInteger(value)
    && value >= (positive ? 1 : 0)
    && value <= MAX_COMBAT_VALUE;
}

function validSeed(value) {
  return (typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH)
    || Number.isSafeInteger(value);
}

function validPlayer(value) {
  return exactKeys(value, PLAYER_KEYS)
    && name(value.name)
    && combatInteger(value.maxHp, { positive: true })
    && combatInteger(value.hp)
    && value.hp <= value.maxHp
    && combatInteger(value.attack)
    && combatInteger(value.defense)
    && identifier(value.proficiencyId);
}

function validEnemy(value) {
  return exactKeys(value, ENEMY_KEYS)
    && name(value.name)
    && (value.npcId === null || identifier(value.npcId))
    && combatInteger(value.maxHp, { positive: true })
    && combatInteger(value.hp, { positive: true })
    && value.hp <= value.maxHp
    && combatInteger(value.defense)
    && exactKeys(value.damage, DAMAGE_KEYS)
    && combatInteger(value.damage.min)
    && combatInteger(value.damage.max)
    && value.damage.max >= value.damage.min;
}

function validSource(value) {
  return exactKeys(value, SOURCE_KEYS)
    && (value.kind === "narrator" || value.kind === "travel")
    && typeof value.lethal === "boolean"
    && typeof value.note === "string"
    && value.note.length <= MAX_NOTE_LENGTH;
}

function validInitial(value) {
  return exactKeys(value, INITIAL_KEYS)
    && value.version === 1
    && validSeed(value.seed)
    && equalJsonData(value.rules, PRODUCTION_COMBAT_RULES)
    && validPlayer(value.player)
    && validEnemy(value.enemy);
}

function canonicalCommand(value) {
  let command;
  try {
    command = cloneJsonData(value, "invalid-command");
  } catch {
    return null;
  }
  return exactKeys(command, ACTION_COMMAND_KEYS)
    && command.type === "use-action"
    && [command.actorId, command.actionId, command.targetId].every(identifier)
    ? command
    : null;
}

function encounterInput(initial) {
  const pattern = {
    id: "solitaire-production-single-hostile-v1",
    steps: [{
      id: "pressure",
      options: [{
        id: "enemy-strike",
        type: "attack",
        target: "player",
        damage: cloneJsonData(initial.enemy.damage),
      }],
    }],
  };
  const intentState = createIntentState({ seed: initial.seed, pattern });
  if (!intentState.ok) throw new TypeError("invalid-production-combat-initial-state");
  return {
    seed: initial.seed,
    rules: cloneJsonData(initial.rules),
    player: {
      id: "player",
      name: initial.player.name,
      hp: initial.player.hp,
      maxHp: initial.player.maxHp,
      stats: {
        attack: initial.player.attack,
        defense: initial.player.defense,
      },
      actions: ["strike", "guard"],
      skills: [],
      statuses: [],
    },
    enemy: {
      id: "enemy",
      name: initial.enemy.name,
      hp: initial.enemy.hp,
      maxHp: initial.enemy.maxHp,
      stats: { attack: initial.enemy.damage.max, defense: initial.enemy.defense },
      actions: [],
      statuses: [],
      intentState: intentState.state,
      intent: encounterIntentFromState(intentState.state, "player"),
    },
  };
}

function replay(initial, history) {
  let encounter;
  try {
    encounter = createEncounter(encounterInput(initial));
  } catch {
    return { ok: false, reason: "invalid-production-combat-session", encounter: null };
  }
  if (history.length === 0) return { ok: true, encounter };
  const replayed = replayCommandSequence(encounter, history);
  return replayed.ok
    ? { ok: true, encounter: replayed.state }
    : { ok: false, reason: "invalid-production-combat-session", encounter: null };
}

function statusFor(encounter) {
  return encounter.phase === "player" ? "active" : encounter.phase;
}

function ownSession(value) {
  const session = deepFreeze(cloneJsonData(value));
  trustedSessions.add(session);
  return session;
}

function invalid(reason = "invalid-production-combat-session") {
  return { ok: false, reason, session: null };
}

export function readProductionCombatSession(value) {
  if (trustedSessions.has(value)) return { ok: true, session: value };
  let snapshot;
  try {
    snapshot = cloneJsonData(value, "invalid-production-combat-session");
  } catch {
    return invalid();
  }
  if (snapshot?.version !== PRODUCTION_COMBAT_SESSION_VERSION) {
    return invalid("unsupported-production-combat-session-version");
  }
  if (
    !exactKeys(snapshot, SESSION_KEYS)
    || snapshot.domain !== DOMAIN
    || !identifier(snapshot.campaignId)
    || !identifier(snapshot.sessionId)
    || !snapshot.sessionId.startsWith(`${snapshot.campaignId}:`)
    || !validSource(snapshot.source)
    || !validInitial(snapshot.initial)
    || !Array.isArray(snapshot.history)
    || snapshot.history.length > MAX_PRODUCTION_COMBAT_COMMANDS
    || snapshot.sequence !== snapshot.history.length
    || !snapshot.history.every((command) => canonicalCommand(command) !== null)
  ) return invalid();

  const replayed = replay(snapshot.initial, snapshot.history);
  if (
    !replayed.ok
    || !equalJsonData(snapshot.encounter, replayed.encounter)
    || snapshot.status !== statusFor(replayed.encounter)
  ) return invalid();

  return {
    ok: true,
    session: ownSession({
      ...snapshot,
      encounter: replayed.encounter,
    }),
  };
}

export function startProductionCombatSession(value) {
  let request;
  try {
    request = cloneJsonData(value, "invalid-production-combat-input");
  } catch {
    return { ok: false, reason: "invalid-production-combat-input", session: null };
  }
  const initial = {
    version: 1,
    seed: request?.seed,
    rules: cloneJsonData(PRODUCTION_COMBAT_RULES),
    player: request?.player,
    enemy: request?.enemy && {
      ...request.enemy,
      defense: request.enemy.defense ?? 0,
    },
  };
  if (
    !identifier(request?.campaignId)
    || !identifier(request?.sessionId)
    || !request.sessionId.startsWith(`${request.campaignId}:`)
    || !validSource(request?.source)
    || !validInitial(initial)
  ) return { ok: false, reason: "invalid-production-combat-input", session: null };

  const replayed = replay(initial, []);
  if (!replayed.ok) return { ok: false, reason: replayed.reason, session: null };
  return {
    ok: true,
    session: ownSession({
      version: PRODUCTION_COMBAT_SESSION_VERSION,
      domain: DOMAIN,
      campaignId: request.campaignId,
      sessionId: request.sessionId,
      source: request.source,
      initial,
      history: [],
      sequence: 0,
      status: statusFor(replayed.encounter),
      encounter: replayed.encounter,
    }),
  };
}

export function transitionProductionCombatSession(value, commandValue) {
  const opened = trustedSessions.has(value)
    ? { ok: true, session: value }
    : readProductionCombatSession(value);
  if (!opened.ok) return { ...opened, events: [] };
  const session = opened.session;
  if (session.status !== "active") {
    return {
      ok: false,
      reason: "production-combat-already-terminal",
      session,
      events: [],
    };
  }
  if (session.history.length >= MAX_PRODUCTION_COMBAT_COMMANDS) {
    return {
      ok: false,
      reason: "production-combat-history-limit-exceeded",
      session,
      events: [],
    };
  }
  const command = canonicalCommand(commandValue);
  if (!command) return { ok: false, reason: "invalid-command", session, events: [] };
  const resolved = resolveCommand(session.encounter, command);
  if (!resolved.ok) {
    return { ok: false, reason: resolved.reason, session, events: [] };
  }
  const history = [...session.history, command];
  return {
    ok: true,
    reason: null,
    events: deepFreeze(cloneJsonData(resolved.events)),
    session: ownSession({
      ...session,
      history,
      sequence: history.length,
      status: statusFor(resolved.state),
      encounter: resolved.state,
    }),
  };
}
