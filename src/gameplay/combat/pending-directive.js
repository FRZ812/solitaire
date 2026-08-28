import { cloneJsonData } from "../kernel/json-data.js";
import { gameplayChecksum } from "../kernel/replay.js";
import { deriveCombatStats } from "../../engine/combat-stats.js";

const MAX_FOES = 16;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_NAME_LENGTH = 128;
const MAX_NOTE_LENGTH = 2_000;
const DIRECTIVE_KEYS = new Set(["foes", "initiator", "lethal", "note", "surprise"]);
const FOE_KEYS = new Set(["count", "kind", "name", "npc_id", "tier"]);
const HANDOFF_KEYS = new Set(["campaignId", "contextChecksum", "directive", "version"]);
const PENDING_COMBAT_HANDOFF_VERSION = 1;
const TIERS = new Set([
  "common",
  "uncommon",
  "rare",
  "very-rare",
  "epic",
  "legendary",
  "mythical",
  "divine",
]);

function invalid(reason = "invalid-pending-combat-directive") {
  return {
    ok: false,
    reason,
    directive: null,
  };
}

function onlyKnownKeys(value, allowed) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.has(key));
}

function optionalText(value, maximum) {
  return value === undefined
    || value === null
    || (typeof value === "string" && value.length > 0 && value.length <= maximum);
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export function readPendingCombatDirective(value) {
  let input;
  try {
    input = cloneJsonData(value, "invalid-pending-combat-directive");
  } catch {
    return invalid();
  }
  if (!onlyKnownKeys(input, DIRECTIVE_KEYS)) return invalid("invalid-directive-shape");
  if (!Array.isArray(input.foes) || input.foes.length < 1 || input.foes.length > MAX_FOES) {
    return invalid("invalid-foes");
  }
  if (input.initiator !== undefined && !["player", "enemy"].includes(input.initiator)) {
    return invalid("invalid-initiator");
  }
  if (input.surprise !== undefined && typeof input.surprise !== "boolean") {
    return invalid("invalid-surprise");
  }
  if (input.lethal !== undefined && typeof input.lethal !== "boolean") {
    return invalid("invalid-lethal");
  }
  if (!optionalText(input.note, MAX_NOTE_LENGTH)) return invalid("invalid-note");

  const foes = [];
  let total = 0;
  for (const foe of input.foes) {
    if (!onlyKnownKeys(foe, FOE_KEYS)) return invalid("invalid-foe-shape");
    if (!optionalText(foe.npc_id, MAX_IDENTIFIER_LENGTH)) return invalid("invalid-foe-npc-id");
    if (!optionalText(foe.kind, MAX_IDENTIFIER_LENGTH)) return invalid("invalid-foe-kind");
    if (!optionalText(foe.name, MAX_NAME_LENGTH)) return invalid("invalid-foe-name");
    if (foe.tier !== undefined && foe.tier !== null && !TIERS.has(foe.tier)) {
      return invalid("invalid-foe-tier");
    }
    if (foe.count !== undefined && (
      !Number.isSafeInteger(foe.count)
      || foe.count < 1
      || foe.count > MAX_FOES
    )) return invalid("invalid-foe-count");
    if (!foe.npc_id && !foe.kind) return invalid("invalid-foe-identity");
    const count = foe.count ?? 1;
    total += count;
    if (total > MAX_FOES) return invalid("too-many-expanded-foes");
    foes.push({
      npc_id: foe.npc_id ?? null,
      kind: foe.kind ?? "assailant",
      name: foe.name ?? null,
      tier: foe.tier ?? null,
      count,
    });
  }

  return {
    ok: true,
    reason: null,
    directive: freeze({
      initiator: input.initiator ?? "player",
      surprise: input.surprise ?? false,
      lethal: input.lethal ?? true,
      foes,
      note: input.note ?? "Blades are about to be drawn.",
    }),
  };
}

// Hash what admission actually reads, not the raw state blobs it reads them out of.
//
// Hashing `character` and `world.codex` wholesale looked stricter but was wrong: loading a
// save runs migrateCodex, which backfills defaults (lifespanMultiplier, bodyWeight,
// ridingOn, riders, base_appearance) across the character and every codex entry. That
// changed the hash on every reload, so a pending handoff never survived one — and any
// future migration would have broken it again, silently.
//
// The projection covers current campaign ownership, admission blockers, the selected build,
// and the numbers the fight will use. A change to any of those genuinely means the offered
// fight is no longer the fight that would start.
export function combatHandoffContextChecksum(state, campaignId) {
  const character = state.character;
  const stats = deriveCombatStats(character, state.world?.codex || {});
  return gameplayChecksum({
    campaignId,
    campaignRevision: state.mechanics?.campaignRevision ?? 0,
    bootstrapId: state.mechanics?.bootstrapId ?? null,
    build: state.mechanics?.build ?? null,
    activeCombatSessionId: state.mechanics?.combat?.activeCombat?.sessionId ?? null,
    hasPendingReward: Boolean(state.pendingReward),
    hasPendingLoot: Boolean(state.pendingLoot),
    // The fight's numbers.
    vitality: character?.vitality ?? null,
    vitalityMax: character?.vitalityMax ?? null,
    maxHealth: stats.maxHealth ?? null,
    weaponMin: stats.weapon?.min ?? null,
    weaponMax: stats.weapon?.max ?? null,
    weaponCategory: stats.weapon?.category ?? null,
    armor: stats.armor ?? null,
    ward: stats.ward ?? null,
    dodge: stats.dodge ?? null,
    worldSeed: state.world?.seed ?? null,
  });
}

function rejectedHandoff(reason) {
  return { ok: false, reason, handoff: null };
}

export function createPendingCombatHandoff({ campaignId, state, directive } = {}) {
  if (typeof campaignId !== "string" || campaignId.length < 1 || campaignId.length > 256) {
    return rejectedHandoff("invalid-pending-combat-campaign");
  }
  const opened = readPendingCombatDirective(directive);
  if (!opened.ok) return rejectedHandoff(opened.reason);
  let checksum;
  try {
    checksum = combatHandoffContextChecksum(state, campaignId);
  } catch {
    return rejectedHandoff("invalid-pending-combat-context");
  }
  return {
    ok: true,
    reason: null,
    handoff: freeze({
      version: PENDING_COMBAT_HANDOFF_VERSION,
      campaignId,
      contextChecksum: checksum,
      directive: opened.directive,
    }),
  };
}

export function readPendingCombatHandoff(value, { campaignId, state } = {}) {
  let input;
  try {
    input = cloneJsonData(value, "invalid-pending-combat-handoff");
  } catch {
    return rejectedHandoff("invalid-pending-combat-handoff");
  }
  if (
    !onlyKnownKeys(input, HANDOFF_KEYS)
    || input.version !== PENDING_COMBAT_HANDOFF_VERSION
    || typeof input.campaignId !== "string"
    || input.campaignId.length < 1
    || input.campaignId.length > 256
    || typeof input.contextChecksum !== "string"
    || !/^[0-9a-f]{16}$/.test(input.contextChecksum)
  ) return rejectedHandoff("invalid-pending-combat-handoff");
  const opened = readPendingCombatDirective(input.directive);
  if (!opened.ok) return rejectedHandoff(opened.reason);
  if (campaignId !== undefined && input.campaignId !== campaignId) {
    return rejectedHandoff("pending-combat-campaign-mismatch");
  }
  if (state !== undefined) {
    let expected;
    try {
      expected = combatHandoffContextChecksum(state, input.campaignId);
    } catch {
      return rejectedHandoff("invalid-pending-combat-context");
    }
    if (expected !== input.contextChecksum) {
      return rejectedHandoff("pending-combat-context-mismatch");
    }
  }
  return {
    ok: true,
    reason: null,
    handoff: freeze({
      version: input.version,
      campaignId: input.campaignId,
      contextChecksum: input.contextChecksum,
      directive: opened.directive,
    }),
  };
}
