// One door, and a receipt for everything that goes through it.
//
// A narrator turn is overwhelmingly a set of state writes wearing prose: the field inventory
// beside this file counts twenty-five of thirty. Until now each of those applied on arrival,
// which meant "the model said so" and "the engine agreed" were the same event, and there was
// no record distinguishing them.
//
// The gateway makes every mechanical field cross one boundary and come out the other side
// with a receipt saying what happened to it. That is the whole design, and it is deliberately
// complete from the first commit rather than migrated field by field — a path where half the
// fields are policed and half are not is worse than either end, because nobody can tell which
// half they are looking at.
//
// What grows incrementally is not coverage but strictness. Every owner is one of two kinds:
//
//   enforced      — has a real rule and can refuse. A refused field is stripped from the turn
//                   before anything is applied, so the refusal is an actual refusal rather
//                   than a note attached to a change that happened anyway.
//   pass-through  — has no rule yet, so it records a receipt and lets the field by, saying in
//                   its own entry why it is not yet policed.
//
// The distinction is enumerated and tested, so "how much of the narrator is actually governed"
// is a number anyone can read rather than a feeling.

import { CONDITIONS, condName } from "../../data/conditions.js";
import { MEMORY_TEXT_LIMIT, cleanMemoryText } from "../../engine/memory.js";
import { coinsToCopper } from "../../engine/economy.js";
import { itemTemplate } from "../../data/catalog.js";
import { gameplayChecksum } from "../kernel/replay.js";
import { NARRATOR_FIELD_INVENTORY, intentFields } from "./narrator-field-inventory.js";

export const COMMAND_GATEWAY_VERSION = 1;

export const INTENT_STATUS = Object.freeze({
  APPLIED: "applied",
  REFUSED: "refused",
  PASSED_THROUGH: "passed-through",
  ABSENT: "absent",
});

export const OWNER_MODE = Object.freeze({
  ENFORCED: "enforced",
  PASS_THROUGH: "pass-through",
});

/**
 * The most time one narrated beat may claim.
 *
 * Twelve hours. Long enough for any single scene the game actually plays — a march, a night's
 * work, a negotiation that runs late — and short enough that a beat cannot quietly skip a
 * week of hunger, thirst and travel. A longer passage is a sequence of beats, which is what
 * the clock is built to handle.
 */
export const MAX_NARRATED_MINUTES = 12 * 60;

/** The most a single beat may move one attribute. Growth is a progression concern. */
export const MAX_ATTRIBUTE_DELTA = 1;

/**
 * The most a needs value may move in one beat.
 *
 * The needs tick drains roughly two to three points an hour, so twelve hours of neglect is
 * about thirty. A meal or a night's sleep restoring that much is right; a beat handing back
 * a hundred is the travel economy being written off in a sentence.
 */
export const MAX_NEEDS_DELTA = 40;

/** How many durable memories one beat may propose. */
export const MAX_MEMORIES_PER_TURN = 4;

/** How far one beat may move a single relationship. */
export const MAX_RELATIONSHIP_DELTA = 20;

/**
 * A purchase must be affordable.
 *
 * The narrator negotiates the price — that is its job, and a haggle it cannot lose is not a
 * haggle. What it cannot do is agree to a number the purse has never held, because the
 * reducer would then either refuse silently or drive the purse negative.
 */
function affordable(state, copper) {
  return coinsToCopper(state?.character?.inventory?.coins || {}) >= copper;
}

function inParty(state, id) {
  return (state?.party || []).includes(id);
}

function refuse(reason, detail = {}) {
  return { status: INTENT_STATUS.REFUSED, reason, ...detail };
}

function allow(detail = {}) {
  return { status: INTENT_STATUS.APPLIED, reason: null, ...detail };
}

// ---------------------------------------------------------------------------
// Enforced owners
// ---------------------------------------------------------------------------

const ENFORCED = Object.freeze({
  /**
   * Time is the spine every other cost hangs off. A beat that sets it freely can rewind
   * hunger, skip a night's danger, or age out a condition that was supposed to hurt.
   */
  minutes_passed(state, value) {
    if (value === null || value === undefined) return allow();
    if (!Number.isSafeInteger(value) || value < 0) return refuse("time-not-an-integer");
    if (value > MAX_NARRATED_MINUTES) {
      return refuse("time-exceeds-one-beat", { limit: MAX_NARRATED_MINUTES, asked: value });
    }
    return allow();
  },

  /**
   * Health outside combat, bounded by the same ceiling settlement obeys. Without this a
   * story beat is a heal button, and a fight the player barely survived costs nothing.
   */
  vitality_change(state, value) {
    if (value === null || value === undefined || value === 0) return allow();
    if (!Number.isSafeInteger(value)) return refuse("vitality-not-an-integer");
    const max = state?.character?.vitalityMax ?? 0;
    const current = state?.character?.vitality ?? 0;
    if (value > 0 && current + value > max) {
      // Healing past the ceiling is clamped by the reducer anyway; refusing the *claim*
      // keeps the narrator honest about what it is asking for.
      return refuse("vitality-above-maximum", { max, current, asked: value });
    }
    if (value < 0 && Math.abs(value) > max) {
      return refuse("vitality-loss-exceeds-pool", { max, asked: value });
    }
    return allow();
  },

  /**
   * Conditions have real combat expression now — admission turns them into opening statuses
   * — so authoring one is authoring a combat modifier. An unauthored name would block the
   * next fight outright, which is a strange way to find out the narrator invented a disease.
   */
  new_conditions(state, value) {
    if (value === null || value === undefined) return allow();
    if (!Array.isArray(value)) return refuse("conditions-not-a-list");
    const unknown = value
      .map((entry) => condName(entry))
      .filter((name) => name && !Object.hasOwn(CONDITIONS, name));
    if (unknown.length > 0) return refuse("unauthored-condition", { unknown });
    return allow();
  },

  /**
   * Attributes feed every derived combat stat through the bridge, which makes this the most
   * load-bearing field in the contract. A beat may nudge one; it may not rewrite a character.
   */
  attribute_changes(state, value) {
    if (value === null || value === undefined) return allow();
    if (typeof value !== "object" || Array.isArray(value)) return refuse("attributes-not-an-object");
    for (const [key, delta] of Object.entries(value)) {
      if (!Number.isSafeInteger(delta)) return refuse("attribute-delta-not-an-integer", { key });
      if (Math.abs(delta) > MAX_ATTRIBUTE_DELTA) {
        return refuse("attribute-delta-too-large", { key, asked: delta, limit: MAX_ATTRIBUTE_DELTA });
      }
    }
    return allow();
  },

  /**
   * Death is irreversible and sealed against rewind. Killing someone who is already dead, or
   * who does not exist, is the shape a hallucinated name takes.
   */
  assassination(state, value) {
    if (value === null || value === undefined) return allow();
    if (value.outcome !== "killed") return allow();
    const target = state?.world?.codex?.characters?.[value.target_id];
    if (!target) return refuse("unknown-assassination-target", { targetId: value.target_id });
    if (target.combatState?.status === "dead") {
      return refuse("target-already-dead", { targetId: value.target_id });
    }
    return allow();
  },

  /**
   * Creation goes through the one bootstrap compiler. A second start path is how two entry
   * routes drift into producing subtly different characters.
   */
  character_setup(state, value) {
    if (value === null || value === undefined) return allow();
    if (state?.created === true) return refuse("character-already-created");
    return allow();
  },

  /**
   * Hunger, thirst and sleep are drained by an authored tick at two to three points an hour.
   * A beat that hands back a hundred writes off the travel economy in a sentence.
   */
  needs_changes(state, value) {
    if (value === null || value === undefined) return allow();
    if (typeof value !== "object" || Array.isArray(value)) return refuse("needs-not-an-object");
    for (const [need, delta] of Object.entries(value)) {
      if (!["hunger", "thirst", "sleep"].includes(need)) return refuse("unknown-need", { need });
      if (!Number.isFinite(delta)) return refuse("need-delta-not-a-number", { need });
      if (Math.abs(delta) > MAX_NEEDS_DELTA) {
        return refuse("need-delta-too-large", { need, asked: delta, limit: MAX_NEEDS_DELTA });
      }
    }
    return allow();
  },

  /**
   * Typed durable memory was already validated on the way in; the gateway turns that
   * validation into a refusal rather than a silent filter, and bounds how much of the bank
   * one beat may claim.
   */
  memory_updates(state, value) {
    if (value === null || value === undefined) return allow();
    if (!Array.isArray(value)) return refuse("memories-not-a-list");
    if (value.length > MAX_MEMORIES_PER_TURN) {
      return refuse("too-many-memories", { asked: value.length, limit: MAX_MEMORIES_PER_TURN });
    }
    const empty = value.filter((entry) => !cleanMemoryText(entry));
    if (empty.length > 0) return refuse("empty-memory");
    const overlong = value.filter((entry) => typeof entry === "string" && entry.length > MEMORY_TEXT_LIMIT * 4);
    if (overlong.length > 0) return refuse("memory-far-past-limit");
    return allow();
  },

  /**
   * Standing gates recruitment, prices and quest access. A beat may shift how someone feels;
   * it may not turn an enemy into a devotee in one conversation.
   */
  relationship_changes(state, value) {
    if (value === null || value === undefined) return allow();
    if (!Array.isArray(value)) return refuse("relationships-not-a-list");
    for (const change of value) {
      const delta = change?.delta ?? change?.change;
      if (delta === undefined || delta === null) continue;
      if (!Number.isFinite(delta)) return refuse("relationship-delta-not-a-number");
      if (Math.abs(delta) > MAX_RELATIONSHIP_DELTA) {
        return refuse("relationship-delta-too-large", {
          asked: delta, limit: MAX_RELATIONSHIP_DELTA,
        });
      }
    }
    return allow();
  },

  /**
   * Removing companions is consent-bearing, and a bulk removal must not become the way
   * around the confirmation a single one needs. Naming someone who is not in the party is
   * the shape a hallucinated companion takes.
   */
  party_removals(state, value) {
    if (value === null || value === undefined) return allow();
    if (!Array.isArray(value)) return refuse("removals-not-a-list");
    const party = new Set(state?.party || []);
    const strangers = value
      .map((entry) => (typeof entry === "string" ? entry : entry?.id))
      .filter((id) => id && !party.has(id));
    if (strangers.length > 0) return refuse("removing-someone-not-in-the-party", { strangers });
    return allow();
  },

  /**
   * The spendable pool, bounded like vitality. Same argument: a beat that refills it freely
   * makes every rationed thing free.
   */
  resolve_change(state, value) {
    if (value === null || value === undefined || value === 0) return allow();
    if (!Number.isSafeInteger(value)) return refuse("resolve-not-an-integer");
    const max = state?.character?.resolveMax ?? 0;
    const current = state?.character?.resolve ?? 0;
    if (value > 0 && current + value > max) {
      return refuse("resolve-above-maximum", { max, current, asked: value });
    }
    if (value < 0 && Math.abs(value) > max) return refuse("resolve-loss-exceeds-pool", { max });
    return allow();
  },

  /** Consent-bearing, and it must be someone who is actually travelling with the player. */
  part_ways(state, value) {
    if (value === null || value === undefined) return allow();
    if (!value.id) return refuse("part-ways-without-an-id");
    if (!inParty(state, value.id)) {
      return refuse("parting-from-someone-not-in-the-party", { id: value.id });
    }
    return allow();
  },

  /** Steers growth, and the only steer the progression system understands is racial. */
  progression_focus(state, value) {
    if (value === null || value === undefined) return allow();
    if (value !== "racial") return refuse("unknown-progression-focus", { asked: value });
    return allow();
  },

  /**
   * A companion who is already travelling with the player cannot be recruited again, and one
   * bought on credit still has to be bought with money the purse has held.
   */
  recruit_companion(state, value) {
    if (value === null || value === undefined) return allow();
    if (!value.id) return refuse("recruit-without-an-id");
    if (inParty(state, value.id)) return refuse("already-in-the-party", { id: value.id });
    return allow();
  },

  grant_mount(state, value) {
    if (value === null || value === undefined) return allow();
    if (!value.id) return refuse("mount-without-an-id");
    if (inParty(state, value.id)) return refuse("already-in-the-party", { id: value.id });
    return allow();
  },

  buy_mount(state, value) {
    if (value === null || value === undefined) return allow();
    if (!value.id) return refuse("mount-without-an-id");
    if (inParty(state, value.id)) return refuse("already-in-the-party", { id: value.id });
    if (value.settlement === "coin" && !affordable(state, value.priceCp ?? 0)) {
      return refuse("cannot-afford", { asked: value.priceCp });
    }
    return allow();
  },

  purchase_captive(state, value) {
    if (value === null || value === undefined) return allow();
    if (value.settlement === "coin" && !affordable(state, value.agreedPriceCp ?? 0)) {
      return refuse("cannot-afford", { asked: value.agreedPriceCp });
    }
    return allow();
  },

  purchase_rights(state, value) {
    if (value === null || value === undefined) return allow();
    if (value.settlement === "coin" && !affordable(state, value.agreedPriceCp ?? 0)) {
      return refuse("cannot-afford", { asked: value.agreedPriceCp });
    }
    return allow();
  },

  /**
   * Items are combat stats through the bridge, so an invented item id is an invented weapon.
   * Loot-minted instances carry their own entry and are exempt; a bare id must be catalogued.
   */
  inventory_changes(state, value) {
    if (value === null || value === undefined) return allow();
    const invented = [];
    for (const collection of ["added", "removed"]) {
      for (const entry of value?.[collection] || []) {
        if (!entry?.itemId || entry.entry) continue;
        if (!itemTemplate(entry.itemId)) invented.push(entry.itemId);
      }
    }
    if (invented.length > 0) return refuse("uncatalogued-item", { invented });
    return allow();
  },

  /** Companion equipment is companion combat stats; the same catalogue rule applies. */
  companion_gear(state, value) {
    if (value === null || value === undefined) return allow();
    if (!Array.isArray(value)) return refuse("companion-gear-not-a-list");
    const invented = [];
    for (const entry of value) {
      for (const slot of ["weapon", "armor", "offhand", "trinket"]) {
        const itemId = entry?.[slot];
        if (typeof itemId === "string" && itemId && !itemTemplate(itemId)) invented.push(itemId);
      }
    }
    if (invented.length > 0) return refuse("uncatalogued-item", { invented });
    return allow();
  },
});

/**
 * Owners that record but do not yet police, each saying why.
 *
 * This list is the honest measure of how far the migration has to go. Shrinking it is the
 * work; enumerating it is what makes the work reviewable.
 */
export const PASS_THROUGH_REASONS = Object.freeze({
  tile_discovery: "Map reveal rules live in the world generator; the owner has to read them "
    + "rather than invent a second opinion about what is where.",
  tile_move: "Travel cost is owned by the travel lifecycle, which already refuses illegal "
    + "moves on its own path. Routing this through it is a larger change than a bound.",
  location_update: "Named places and services come from the atlas; validating against it is "
    + "a registry join rather than a rule.",
  discoveries: "Additive codex writes. Harmless in isolation, but they become fact for every "
    + "later prompt, so the owner is a content-validation concern.",
  knowledge_updates: "Gates options elsewhere; needs the knowledge registry to validate "
    + "against.",
  player_update: "Identity and appearance. Mostly narrative, but durable, so it wants the "
    + "same discipline once the shape of an identity owner is settled.",
  start_combat: "Admission already projects and can refuse this on the combat path. Routing "
    + "it as a gateway intent as well would give one decision two owners.",
});

function ownerFor(field) {
  if (Object.hasOwn(ENFORCED, field)) {
    return { mode: OWNER_MODE.ENFORCED, resolve: ENFORCED[field] };
  }
  return { mode: OWNER_MODE.PASS_THROUGH, resolve: null };
}

/** Which fields are actually policed, and which merely recorded. */
export function gatewayCoverage() {
  const fields = intentFields();
  const enforced = fields.filter((field) => Object.hasOwn(ENFORCED, field));
  return {
    total: fields.length,
    enforced,
    passThrough: fields.filter((field) => !Object.hasOwn(ENFORCED, field)),
    fraction: fields.length > 0 ? enforced.length / fields.length : 0,
  };
}

/**
 * Run one narrator turn through the gateway.
 *
 * Returns the turn as it should actually be applied — with refused fields stripped — and a
 * receipt for every mechanical field, present or not. Nothing is mutated: the caller applies
 * the returned turn, so a refusal is a field that never reaches the reducer rather than a
 * complaint filed after the fact.
 *
 * @param {object} state campaign state the turn is being applied to
 * @param {object} turn the compiled narrator turn
 * @param {{stateRevision?: number}} context
 */
export function resolveNarratorIntents(state, turn, { stateRevision = 0 } = {}) {
  const receipts = [];
  let accepted = turn;

  for (const field of intentFields()) {
    const present = turn?.[field] !== undefined && turn?.[field] !== null;
    if (!present) {
      receipts.push(receipt(field, INTENT_STATUS.ABSENT, null, stateRevision));
      continue;
    }
    const owner = ownerFor(field);
    if (owner.mode === OWNER_MODE.PASS_THROUGH) {
      receipts.push(receipt(field, INTENT_STATUS.PASSED_THROUGH, null, stateRevision));
      continue;
    }
    const verdict = owner.resolve(state, turn[field]);
    if (verdict.status === INTENT_STATUS.REFUSED) {
      // Stripped before application. This is what makes the refusal real.
      if (accepted === turn) accepted = { ...turn };
      accepted[field] = null;
      receipts.push(receipt(field, INTENT_STATUS.REFUSED, verdict.reason, stateRevision, verdict));
      continue;
    }
    receipts.push(receipt(field, INTENT_STATUS.APPLIED, null, stateRevision));
  }

  const refusals = receipts.filter((entry) => entry.status === INTENT_STATUS.REFUSED);
  return { turn: accepted, receipts, refusals, refused: refusals.length > 0 };
}

function receipt(field, status, reason, stateRevision, detail = {}) {
  const { status: _s, reason: _r, ...rest } = detail;
  const body = {
    version: COMMAND_GATEWAY_VERSION,
    field,
    status,
    reason,
    stateRevision,
    ...rest,
  };
  return { ...body, id: `intent-${gameplayChecksum(body)}` };
}

/** One plain line per refusal, for a player who should know their beat was trimmed. */
export function refusalNotice(refusals) {
  if (!refusals || refusals.length === 0) return null;
  const named = refusals.map((entry) => `${entry.field} (${entry.reason})`).join(", ");
  return `Part of that turn was not applied: ${named}.`;
}

/** Every field the inventory knows about is either enforced or explicitly passed through. */
export function unownedIntentFields() {
  return intentFields().filter((field) => (
    !Object.hasOwn(ENFORCED, field) && !Object.hasOwn(PASS_THROUGH_REASONS, field)
  ));
}

/** The inventory rows this gateway covers, for a coverage report that cannot drift. */
export function gatewayInventoryRows() {
  return NARRATOR_FIELD_INVENTORY.filter((row) => row.disposition === "intent");
}
