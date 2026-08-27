// Frozen verifier-only Tower v1.2 semantics from deployed commit d925c35.
// Never route playable/current combat through this module.
// The Tower of Winter actor. Both sides carry the same five stats — the Gatekeeper's
// stat block lists HP, ATK, crit and dodge exactly as the Arctic Knight's does — plus a
// shield pool that absorbs before HP, a Resolve pool for committed techniques, and a status
// stack that most traits write into.
//
// This deliberately replaces the older { hp, maxHp, guard, stats:{attack,defense} } shape,
// which had nowhere for crit, dodge, shield or status counts to live.

import { isStatusStack } from "./status-stack.js";

export const MAX_ACTOR_VALUE = 1_000_000;
const MAX_NAME_LENGTH = 128;
const MAX_ID_LENGTH = 256;
const SIDES = new Set(["player", "enemy"]);

function boundedInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_ACTOR_VALUE) {
    throw new TypeError(`invalid-${label}`);
  }
  return value;
}

// Crit and dodge are percentages. They are kept as integers because every rate the wiki
// records is whole (9%, 4%, 6%, 1%, +60%, +80%) and floats would break replay equality.
function boundedRate(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100) {
    throw new TypeError(`invalid-${label}`);
  }
  return value;
}

function identifier(value, label, maximum) {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum) {
    throw new TypeError(`invalid-${label}`);
  }
  return value;
}

export function createTowActor(input = {}) {
  const id = identifier(input.id, "actor-id", MAX_ID_LENGTH);
  const name = identifier(input.name, "actor-name", MAX_NAME_LENGTH);
  if (!SIDES.has(input.side)) throw new TypeError("invalid-actor-side");
  const maxHp = boundedInteger(input.maxHp, "max-hp");
  if (maxHp <= 0) throw new TypeError("invalid-max-hp");
  const hp = Math.min(maxHp, boundedInteger(input.hp ?? maxHp, "hp"));
  const statuses = input.statuses ?? [];
  if (!isStatusStack(statuses)) throw new TypeError("invalid-statuses");
  const hasResolve = Object.hasOwn(input, "resolve") || Object.hasOwn(input, "resolveMax");
  const resolveMax = hasResolve ? boundedInteger(input.resolveMax, "resolve-max") : null;
  if (hasResolve && resolveMax <= 0) throw new TypeError("invalid-resolve-max");
  const resolve = hasResolve
    ? Math.min(resolveMax, boundedInteger(input.resolve ?? resolveMax, "resolve"))
    : null;
  return {
    id,
    name,
    side: input.side,
    hp,
    maxHp,
    shield: boundedInteger(input.shield ?? 0, "shield"),
    stats: {
      attack: boundedInteger(input.stats?.attack ?? 0, "attack"),
      defense: boundedInteger(input.stats?.defense ?? 0, "defense"),
      critRate: boundedRate(input.stats?.critRate ?? 0, "crit-rate"),
      dodgeRate: boundedRate(input.stats?.dodgeRate ?? 0, "dodge-rate"),
    },
    statuses: statuses.map((entry) => ({ type: entry.type, count: entry.count })),
    ...(hasResolve ? { resolve, resolveMax } : {}),
  };
}

export function isTowActor(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const legacy = ["hp", "id", "maxHp", "name", "shield", "side", "stats", "statuses"];
  const current = [...legacy, "resolve", "resolveMax"].sort();
  const expected = keys.length === legacy.length ? legacy : current;
  if (keys.length !== expected.length || keys.some((key, at) => key !== expected[at])) {
    return false;
  }
  const statKeys = value.stats && typeof value.stats === "object" && !Array.isArray(value.stats)
    ? Object.keys(value.stats).sort()
    : null;
  const expectedStats = ["attack", "critRate", "defense", "dodgeRate"];
  return typeof value.id === "string"
    && value.id.length > 0
    && value.id.length <= MAX_ID_LENGTH
    && typeof value.name === "string"
    && value.name.length > 0
    && value.name.length <= MAX_NAME_LENGTH
    && SIDES.has(value.side)
    && Number.isSafeInteger(value.maxHp)
    && value.maxHp > 0
    && value.maxHp <= MAX_ACTOR_VALUE
    && Number.isSafeInteger(value.hp)
    && value.hp >= 0
    && value.hp <= value.maxHp
    && Number.isSafeInteger(value.shield)
    && value.shield >= 0
    && value.shield <= MAX_ACTOR_VALUE
    && statKeys !== null
    && statKeys.length === expectedStats.length
    && statKeys.every((key, at) => key === expectedStats[at])
    && Number.isSafeInteger(value.stats.attack)
    && value.stats.attack >= 0
    && value.stats.attack <= MAX_ACTOR_VALUE
    && Number.isSafeInteger(value.stats.defense)
    && value.stats.defense >= 0
    && value.stats.defense <= MAX_ACTOR_VALUE
    && Number.isSafeInteger(value.stats.critRate)
    && value.stats.critRate >= 0
    && value.stats.critRate <= 100
    && Number.isSafeInteger(value.stats.dodgeRate)
    && value.stats.dodgeRate >= 0
    && value.stats.dodgeRate <= 100
    && (keys.length === legacy.length || (
      Number.isSafeInteger(value.resolveMax)
      && value.resolveMax > 0
      && value.resolveMax <= MAX_ACTOR_VALUE
      && Number.isSafeInteger(value.resolve)
      && value.resolve >= 0
      && value.resolve <= value.resolveMax
    ))
    && isStatusStack(value.statuses);
}

export function isDefeated(actor) {
  return actor.hp <= 0;
}
