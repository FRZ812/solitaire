import { itemTemplate } from "../data/catalog.js";
import { MOUNTS } from "../data/mounts.js";
import { CAPTIVE_POOL } from "../data/slaves.js";
import { PRISONER_POOL } from "../data/gaol.js";
import { readPendingCombatDirective } from "../gameplay/production/pending-directive.js";
import { resolveNarratorIntents } from "../gameplay/campaign/command-gateway.js";
import {
  NARRATOR_CHARACTER_CUE_ACTIONS,
  NARRATOR_CHARACTER_CUE_MANNERS,
  NARRATOR_SCENE_CUE_TEXT,
  NARRATOR_TARGETABLE_CHARACTER_CUE_ACTIONS,
  renderNarratorCharacterCue,
} from "./narrator-story-cues.js";

const compiledTurns = new WeakMap();

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function mintCompiledTurn(turn, projection, turnPolicy) {
  const frozenPolicy = deepFreeze(JSON.parse(JSON.stringify(turnPolicy || {})));
  const frozenTurn = deepFreeze(turn);
  compiledTurns.set(frozenTurn, {
    consumed: false,
    stateRevision: projection.stateRevision,
    turnPolicy: frozenPolicy,
  });
  return frozenTurn;
}

export function consumeCompiledNarratorTurn(turn, stateRevision, operation = "apply") {
  const record = turn && typeof turn === "object" ? compiledTurns.get(turn) : null;
  if (!record) throw new Error(`Refusing to ${operation} an uncompiled narrator turn.`);
  if (record.consumed) throw new Error("This compiled narrator turn has already been consumed.");
  if (record.stateRevision !== stateRevision) {
    throw new Error("Refusing to apply a narrator turn against a different state revision.");
  }
  record.consumed = true;
  return record.turnPolicy;
}

function violation(code, path, message) {
  return { code, path, message };
}

function rejectUnknownKeys(value, allowedKeys, path, violations) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (allowed.has(key)) continue;
    violations.push(violation(
      "SCHEMA_UNKNOWN_KEY",
      `${path}/${key}`,
      "Unknown narrator response fields are forbidden.",
    ));
  }
}

export const NARRATOR_RESPONSE_KEYS = Object.freeze([
  "contract_version", "state_revision", "story", "minutes_passed", "roll", "encounter",
  "vitality_change", "resolve_change", "new_conditions", "tile_discovery", "tile_move",
  "start_combat", "assassination", "location_update", "discoveries", "inventory_changes", "knowledge_updates",
  "attribute_changes", "needs_changes", "recruit_companion", "grant_mount", "buy_mount",
  "purchase_captive", "purchase_rights", "part_ways", "party_removals", "companion_gear",
  "relationship_changes", "memory_updates", "progression_focus", "character_setup",
  "player_update",
]);
const NARRATOR_RESPONSE_KEY_SET = new Set(NARRATOR_RESPONSE_KEYS);
const NARRATOR_EFFECT_KEYS = NARRATOR_RESPONSE_KEYS.filter((key) => (
  !["contract_version", "state_revision", "story"].includes(key)
));

const CHARACTER_KEYS = [
  "id", "name", "race", "gender", "level", "racial_levels", "profession_plan",
  "signature_spell", "metamagic", "origin", "age", "agingMode", "lifespanMultiplier",
  "attractiveness", "appearance", "attributes", "base_appearance", "description", "worn", "knows",
];
const APPEARANCE_KEYS = ["skin", "hair", "eyes", "build", "facial_hair", "marks"];
const ATTRIBUTE_KEYS = ["body", "reflex", "vigor", "mind", "wit", "presence"];
const PROFESSION_KEYS = ["profession", "specialization", "levels", "specializationPath", "branchChoices"];
const NULLABLE_OBJECT_EFFECTS = [
  "roll", "encounter", "tile_discovery", "tile_move", "start_combat", "assassination", "location_update",
  "discoveries", "inventory_changes", "attribute_changes", "needs_changes", "recruit_companion",
  "grant_mount", "buy_mount", "purchase_captive", "purchase_rights", "part_ways",
  "character_setup", "player_update",
];
const NULLABLE_ARRAY_EFFECTS = [
  "new_conditions", "knowledge_updates", "party_removals", "companion_gear",
  "relationship_changes", "memory_updates",
];

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const CHARACTER_CUE_ACTIONS = new Set(NARRATOR_CHARACTER_CUE_ACTIONS);
const TARGETABLE_CHARACTER_CUE_ACTIONS = new Set(NARRATOR_TARGETABLE_CHARACTER_CUE_ACTIONS);
const CHARACTER_CUE_MANNERS = new Set(NARRATOR_CHARACTER_CUE_MANNERS);

function validateEffectEnvelope(candidate, violations) {
  for (const key of ["minutes_passed", "vitality_change", "resolve_change"]) {
    const value = candidate?.[key];
    if (!Number.isSafeInteger(value) || (key === "minutes_passed" && value < 0)) {
      violations.push(violation(
        "SCHEMA_TYPE",
        `/${key}`,
        `${key} must be ${key === "minutes_passed" ? "a nonnegative" : "an"} integer.`,
      ));
    }
  }
  for (const key of NULLABLE_OBJECT_EFFECTS) {
    const value = candidate?.[key];
    if (value !== null && !isPlainObject(value)) {
      violations.push(violation("SCHEMA_TYPE", `/${key}`, `${key} must be an object or null.`));
    }
  }
  for (const key of NULLABLE_ARRAY_EFFECTS) {
    const value = candidate?.[key];
    if (value !== null && !Array.isArray(value)) {
      violations.push(violation("SCHEMA_TYPE", `/${key}`, `${key} must be an array or null.`));
    }
  }
  if (candidate?.progression_focus !== null && candidate?.progression_focus !== "racial") {
    violations.push(violation(
      "SCHEMA_TYPE",
      "/progression_focus",
      "progression_focus must be racial or null.",
    ));
  }
}

function rejectArrayItemKeys(value, allowedKeys, path, violations) {
  if (!Array.isArray(value)) return;
  value.forEach((item, index) => rejectUnknownKeys(item, allowedKeys, `${path}/${index}`, violations));
}

function schemaType(violations, path, message) {
  violations.push(violation("SCHEMA_TYPE", path, message));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const RESERVED_ENTITY_IDS = new Set(["__proto__", "prototype", "constructor"]);
const DISCOVERY_TIERS = new Set(["common", "uncommon", "rare", "epic", "legendary", "divine"]);
const ITEM_KINDS = new Set(["weapon", "armor", "clothing", "tool", "consumable", "trinket", "valuable", "other"]);
const POI_TYPES = new Set(["landmark", "merchant", "shrine", "ruin", "camp", "inn", "smithy", "temple", "stable"]);
const LOCATION_STATUSES = new Set(["normal", "tense", "hostile", "emptied", "razed", "recovering"]);
const SETTLEMENT_TYPES = new Set(["coin", "writ", "ruse", "theft", "gift", "barter"]);

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function isSafeEntityId(value) {
  return typeof value === "string"
    && value.length <= 128
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
    && !RESERVED_ENTITY_IDS.has(value);
}

function isBoundedString(value, max = 5_000) {
  return isNonEmptyString(value) && value.length <= max;
}

function validateDiscoveryEntries(discoveries, violations) {
  if (!discoveries) return;
  const requiredStrings = {
    races: ["name", "appearance", "description"],
    items: ["name", "kind", "appearance", "description"],
    spells: ["name", "description", "acquisition"],
    skills: ["name", "description"],
  };
  for (const [collection, fields] of Object.entries(requiredStrings)) {
    if (!Array.isArray(discoveries[collection])) continue;
    if (discoveries[collection].length > 100) {
      schemaType(violations, `/discoveries/${collection}`, "Discovery collections are limited to 100 entries.");
    }
    discoveries[collection].forEach((entry, index) => {
      const path = `/discoveries/${collection}/${index}`;
      if (!isPlainObject(entry)) {
        schemaType(violations, path, "Discovery entries must be objects.");
        return;
      }
      if (!isSafeEntityId(entry.id)) {
        schemaType(violations, `${path}/id`, "Discovery ids must be safe canonical slugs.");
      }
      for (const field of fields) {
        if (!isBoundedString(entry[field], field === "description" ? 5_000 : 500)) {
          schemaType(violations, `${path}/${field}`, `Discovery ${field} must be a non-empty bounded string.`);
        }
      }
      if (collection === "items" && !ITEM_KINDS.has(entry.kind)) {
        schemaType(violations, `${path}/kind`, "Discovered item kind is outside the wire schema.");
      }
      if (collection === "skills") {
        if (entry.rating !== undefined && (!Number.isSafeInteger(entry.rating) || entry.rating < 0 || entry.rating > 100)) {
          schemaType(violations, `${path}/rating`, "Skill rating must be an integer from 0 to 100.");
        }
        if (entry.tier !== undefined && !DISCOVERY_TIERS.has(entry.tier)) {
          schemaType(violations, `${path}/tier`, "Skill tier is outside the wire schema.");
        }
      }
    });
  }
}

function validateEffectValues(candidate, violations) {
  const roll = candidate?.roll;
  if (roll) {
    for (const key of ["label", "formula", "outcome"]) {
      if (!isNonEmptyString(roll[key])) {
        schemaType(violations, `/roll/${key}`, `Roll ${key} must be a non-empty string.`);
      }
    }
    for (const key of ["dc", "value"]) {
      if (!Number.isSafeInteger(roll[key])) {
        schemaType(violations, `/roll/${key}`, `Roll ${key} must be a safe integer.`);
      }
    }
  }

  (Array.isArray(candidate?.new_conditions) ? candidate.new_conditions : []).forEach((condition, index) => {
    if (typeof condition === "string") {
      if (!condition.trim()) schemaType(violations, `/new_conditions/${index}`, "Condition names must not be empty.");
      return;
    }
    if (!isPlainObject(condition)) {
      schemaType(violations, `/new_conditions/${index}`, "Conditions must be names or condition objects.");
      return;
    }
    if (!isNonEmptyString(condition.name)) {
      schemaType(violations, `/new_conditions/${index}/name`, "Condition name must be a non-empty string.");
    }
    if (!Number.isSafeInteger(condition.duration_minutes) || condition.duration_minutes < 1) {
      schemaType(
        violations,
        `/new_conditions/${index}/duration_minutes`,
        "Condition duration must be a positive integer.",
      );
    }
  });

  for (const key of ["attribute_changes", "needs_changes"]) {
    const effect = candidate?.[key];
    if (!effect) continue;
    for (const [field, value] of Object.entries(effect)) {
      if (!Number.isSafeInteger(value)) {
        schemaType(violations, `/${key}/${field}`, `${key} values must be safe integers.`);
      }
    }
  }

  if (candidate?.tile_move) {
    for (const axis of ["x", "y"]) {
      if (!Number.isSafeInteger(candidate.tile_move[axis])) {
        schemaType(violations, `/tile_move/${axis}`, "Tile coordinates must be safe integers.");
      }
    }
  }

  const combat = candidate?.start_combat;
  if (combat) {
    if (!isNonEmptyString(combat.initiator)) schemaType(violations, "/start_combat/initiator", "Combat initiator must be a non-empty string.");
    if (typeof combat.surprise !== "boolean") schemaType(violations, "/start_combat/surprise", "Combat surprise must be boolean.");
    if (typeof combat.lethal !== "boolean") schemaType(violations, "/start_combat/lethal", "Combat lethal must be boolean.");
    if (!Array.isArray(combat.foes) || combat.foes.length < 1 || combat.foes.length > 16) {
      schemaType(violations, "/start_combat/foes", "Combat foes must be a bounded non-empty array.");
    } else {
      combat.foes.forEach((foe, index) => {
        if (!isPlainObject(foe)) {
          schemaType(violations, `/start_combat/foes/${index}`, "Each combat foe must be an object.");
          return;
        }
        if (!isNonEmptyString(foe.npc_id) && !isNonEmptyString(foe.kind)) {
          schemaType(violations, `/start_combat/foes/${index}`, "Each combat foe must identify a canonical NPC or a foe kind.");
        }
        if (foe.count !== undefined && (!Number.isSafeInteger(foe.count) || foe.count < 1 || foe.count > 100)) {
          schemaType(violations, `/start_combat/foes/${index}/count`, "Foe count must be an integer from 1 to 100.");
        }
      });
    }
    if (typeof combat.note !== "string") schemaType(violations, "/start_combat/note", "Combat note must be a string.");
  }

  const assassination = candidate?.assassination;
  if (assassination) {
    if (!isSafeEntityId(assassination.target_id)) {
      schemaType(violations, "/assassination/target_id", "Assassination target must be a canonical character id.");
    }
    if (!isSafeEntityId(assassination.method)) {
      schemaType(violations, "/assassination/method", "Assassination method must be basic or a canonical ability id.");
    }
    if (!["killed", "survived-undetected", "detected-combat", "interrupted"].includes(assassination.outcome)) {
      schemaType(violations, "/assassination/outcome", "Assassination outcome must come from the closed resolution catalog.");
    }
    if (assassination.outcome === "detected-combat") {
      if (typeof assassination.surprise !== "boolean") {
        schemaType(violations, "/assassination/surprise", "Detected combat must declare its bounded surprise state.");
      }
    } else if (assassination.surprise !== null) {
      schemaType(violations, "/assassination/surprise", "Non-combat assassination outcomes must set surprise to null.");
    }
  }

  for (const key of ["recruit_companion", "part_ways", "grant_mount", "buy_mount"]) {
    const effect = candidate?.[key];
    if (effect && !isNonEmptyString(effect.id)) {
      schemaType(violations, `/${key}/id`, `${key} id must be a non-empty string.`);
    }
  }
  for (const key of ["grant_mount", "buy_mount"]) {
    const name = candidate?.[key]?.name;
    if (name !== undefined && name !== null && typeof name !== "string") {
      schemaType(violations, `/${key}/name`, `${key} name must be a string when supplied.`);
    }
  }
  for (const key of ["purchase_captive", "purchase_rights"]) {
    const effect = candidate?.[key];
    if (effect && !isNonEmptyString(effect.key)) {
      schemaType(violations, `/${key}/key`, `${key} key must be a non-empty string.`);
    }
  }

  const inventory = candidate?.inventory_changes;
  if (inventory) {
    for (const collection of ["added", "removed"]) {
      if (!Array.isArray(inventory[collection])) {
        schemaType(violations, `/inventory_changes/${collection}`, `${collection} must be an array.`);
        continue;
      }
      inventory[collection].forEach((entry, index) => {
        if (!isNonEmptyString(entry?.itemId)) {
          schemaType(violations, `/inventory_changes/${collection}/${index}/itemId`, "Inventory item id must be a non-empty string.");
        }
        if (!Number.isSafeInteger(entry?.quantity) || entry.quantity < 1) {
          schemaType(violations, `/inventory_changes/${collection}/${index}/quantity`, "Inventory quantity must be a positive integer.");
        }
      });
    }
    if (!isPlainObject(inventory.coins)) {
      schemaType(violations, "/inventory_changes/coins", "Inventory coins must be an object.");
    } else {
      for (const denomination of ["copper", "silver", "gold"]) {
        if (inventory.coins[denomination] !== undefined && !Number.isSafeInteger(inventory.coins[denomination])) {
          schemaType(violations, `/inventory_changes/coins/${denomination}`, "Coin deltas must be safe integers.");
        }
      }
    }
  }

  for (const key of ["knowledge_updates", "memory_updates"]) {
    (Array.isArray(candidate?.[key]) ? candidate[key] : []).forEach((entry, index) => {
      if (!isNonEmptyString(entry?.id)) schemaType(violations, `/${key}/${index}/id`, "Character id must be a non-empty string.");
      if (!Array.isArray(entry?.adds) || entry.adds.some((fact) => !isNonEmptyString(fact))) {
        schemaType(violations, `/${key}/${index}/adds`, "Added facts must be an array of non-empty strings.");
      }
    });
  }
  (Array.isArray(candidate?.relationship_changes) ? candidate.relationship_changes : []).forEach((entry, index) => {
    if (!isNonEmptyString(entry?.id)) schemaType(violations, `/relationship_changes/${index}/id`, "Character id must be a non-empty string.");
    if (!Number.isSafeInteger(entry?.delta)) schemaType(violations, `/relationship_changes/${index}/delta`, "Relationship delta must be a safe integer.");
  });
  (Array.isArray(candidate?.party_removals) ? candidate.party_removals : []).forEach((entry, index) => {
    if (!isNonEmptyString(entry?.id)) schemaType(violations, `/party_removals/${index}/id`, "Character id must be a non-empty string.");
    if (entry?.reason !== "dead" && entry?.reason !== "left") {
      schemaType(violations, `/party_removals/${index}/reason`, "Party removal reason must be dead or left.");
    }
  });
  (Array.isArray(candidate?.companion_gear) ? candidate.companion_gear : []).forEach((entry, index) => {
    if (!isNonEmptyString(entry?.id)) {
      schemaType(violations, `/companion_gear/${index}/id`, "Companion id must be a non-empty string.");
    }
    for (const field of ["add", "remove"]) {
      if (!Array.isArray(entry?.[field]) || entry[field].some((id) => !isNonEmptyString(id))) {
        schemaType(
          violations,
          `/companion_gear/${index}/${field}`,
          `Companion gear ${field} must be an array of non-empty item ids.`,
        );
      }
    }
  });
}

function validateRemainingEffectValues(candidate, violations) {
  const encounter = candidate?.encounter;
  if (encounter) {
    if (encounter.type !== "Placed" && encounter.type !== "Random") {
      schemaType(violations, "/encounter/type", "Encounter type must be Placed or Random.");
    }
    if (!isBoundedString(encounter.note, 1_000)) {
      schemaType(violations, "/encounter/note", "Encounter note must be a non-empty bounded string.");
    }
  }

  const discovery = candidate?.tile_discovery;
  if (discovery) {
    for (const key of ["name", "description"]) {
      if (!isBoundedString(discovery[key], key === "name" ? 200 : 2_000)) {
        schemaType(violations, `/tile_discovery/${key}`, `Tile discovery ${key} must be a non-empty bounded string.`);
      }
    }
    if (!POI_TYPES.has(discovery.poi_type)) {
      schemaType(violations, "/tile_discovery/poi_type", "Tile discovery POI type is outside the wire schema.");
    }
  }

  const location = candidate?.location_update;
  if (location) {
    if (!LOCATION_STATUSES.has(location.status)) {
      schemaType(violations, "/location_update/status", "Location status is outside the wire schema.");
    }
    if (typeof location.depopulated !== "boolean") {
      schemaType(violations, "/location_update/depopulated", "Location depopulated must be boolean.");
    }
    if (!isBoundedString(location.note, 2_000)) {
      schemaType(violations, "/location_update/note", "Location note must be a non-empty bounded string.");
    }
  }

  for (const key of ["buy_mount", "purchase_captive", "purchase_rights"]) {
    const effect = candidate?.[key];
    if (!effect) continue;
    const priceField = key === "buy_mount" ? "priceCp" : "agreedPriceCp";
    if (!Number.isSafeInteger(effect[priceField]) || effect[priceField] < 0) {
      schemaType(violations, `/${key}/${priceField}`, `${priceField} must be a nonnegative safe integer.`);
    }
    if (!SETTLEMENT_TYPES.has(effect.settlement)) {
      schemaType(violations, `/${key}/settlement`, "Settlement is outside the wire schema.");
    }
    if (effect.settlement !== "coin" && !isBoundedString(effect.settlementNote, 1_000)) {
      schemaType(violations, `/${key}/settlementNote`, "Non-coin settlements require a bounded objective note.");
    } else if (effect.settlementNote !== undefined && typeof effect.settlementNote !== "string") {
      schemaType(violations, `/${key}/settlementNote`, "Settlement note must be a string.");
    }
  }

  const setup = candidate?.character_setup;
  if (setup) {
    for (const key of ["name", "race", "origin", "base_appearance", "bond"]) {
      if (!isBoundedString(setup[key], key === "base_appearance" ? 2_000 : 500)) {
        schemaType(violations, `/character_setup/${key}`, `Character setup ${key} must be a non-empty bounded string.`);
      }
    }
    if (setup.subrace !== undefined && setup.subrace !== null && !isBoundedString(setup.subrace, 128)) {
      schemaType(violations, "/character_setup/subrace", "Character subrace must be null or a bounded id.");
    }
    if (!["male", "female"].includes(setup.gender)) {
      schemaType(violations, "/character_setup/gender", "Character gender must be male or female.");
    }
    for (const [key, min, max] of [["level", 1, 100], ["racial_levels", 0, 30], ["attractiveness", 1, 10]]) {
      if (!isIntegerBetween(setup[key], min, max)) {
        schemaType(violations, `/character_setup/${key}`, `Character setup ${key} is outside its allowed range.`);
      }
    }
    if (setup.age !== null && !isIntegerBetween(setup.age, 0, 100_000)) {
      schemaType(violations, "/character_setup/age", "Character age must be null or a bounded integer.");
    }
    if (!["mortal", "power-extended", "ageless", "out-of-time"].includes(setup.agingMode)) {
      schemaType(violations, "/character_setup/agingMode", "Character aging mode is outside the wire schema.");
    }
    if (setup.lifespanMultiplier !== undefined
      && (!Number.isFinite(setup.lifespanMultiplier) || setup.lifespanMultiplier <= 0)) {
      schemaType(violations, "/character_setup/lifespanMultiplier", "Lifespan multiplier must be a positive number.");
    }
    if (!Array.isArray(setup.profession_plan) || setup.profession_plan.length < 1 || setup.profession_plan.length > 10) {
      schemaType(violations, "/character_setup/profession_plan", "Character profession plan must be a bounded non-empty array.");
    } else {
      setup.profession_plan.forEach((entry, index) => {
        for (const field of ["profession", "specialization"]) {
          if (!isBoundedString(entry?.[field], 200)) {
            schemaType(violations, `/character_setup/profession_plan/${index}/${field}`, `Profession ${field} must be bounded text.`);
          }
        }
        if (!isIntegerBetween(entry?.levels, 0, 70)) {
          schemaType(violations, `/character_setup/profession_plan/${index}/levels`, "Profession levels must be from 0 to 70.");
        }
      });
    }
    if (!isPlainObject(setup.appearance)) {
      schemaType(violations, "/character_setup/appearance", "Character appearance must be an object.");
    } else {
      for (const field of APPEARANCE_KEYS) {
        if (typeof setup.appearance[field] !== "string" || setup.appearance[field].length > 500) {
          schemaType(violations, `/character_setup/appearance/${field}`, "Appearance fields must be bounded strings.");
        }
      }
    }
    if (!isPlainObject(setup.attributes)) {
      schemaType(violations, "/character_setup/attributes", "Character attributes must be an object.");
    } else {
      for (const field of ATTRIBUTE_KEYS) {
        if (!isIntegerBetween(setup.attributes[field], 0, 90)) {
          schemaType(violations, `/character_setup/attributes/${field}`, "Character attributes must be integers from 0 to 90.");
        }
      }
    }
    if (setup.abilities !== null && !Array.isArray(setup.abilities)) {
      schemaType(violations, "/character_setup/abilities", "Character abilities must be an array or null.");
    }
    if (!Array.isArray(setup.knows) || setup.knows.some((fact) => !isBoundedString(fact, 2_000))) {
      schemaType(violations, "/character_setup/knows", "Character knowledge must be an array of bounded facts.");
    }
  }

  const playerUpdate = candidate?.player_update;
  if (playerUpdate) {
    for (const key of ["name", "bond"]) {
      if (hasOwn(playerUpdate, key) && !isBoundedString(playerUpdate[key], 500)) {
        schemaType(violations, `/player_update/${key}`, `Player ${key} must be a non-empty bounded string.`);
      }
    }
  }

}

const CAPTIVE_KEYS = new Set(CAPTIVE_POOL.map(({ key }) => key));
const PRISONER_KEYS = new Set(PRISONER_POOL.map(({ key }) => key));

function reducerPrecondition(violations, path, message) {
  violations.push(violation("REDUCER_PRECONDITION", path, message));
}

function validateReducerPreconditions(candidate, projection, violations) {
  if (candidate?.character_setup && projection?.created !== false) {
    reducerPrecondition(
      violations,
      "/character_setup",
      "Character setup can be applied only while the engine is in character creation.",
    );
  }
  const inventory = candidate?.inventory_changes;
  if (inventory && Array.isArray(inventory.added)) {
    inventory.added.forEach((entry, index) => {
      if (isNonEmptyString(entry?.itemId) && (!isSafeEntityId(entry.itemId) || !itemTemplate(entry.itemId))) {
        reducerPrecondition(
          violations,
          `/inventory_changes/added/${index}/itemId`,
          "Added inventory ids must resolve to the canonical item catalog.",
        );
      }
    });
  }

  const partyIds = Array.isArray(projection?.partyIds) ? new Set(projection.partyIds) : null;
  if (partyIds) {
    if (candidate?.part_ways?.id && !partyIds.has(candidate.part_ways.id)) {
      reducerPrecondition(violations, "/part_ways/id", "Only a current party member can part ways.");
    }
    (Array.isArray(candidate?.party_removals) ? candidate.party_removals : []).forEach((entry, index) => {
      if (entry?.id && !partyIds.has(entry.id)) {
        reducerPrecondition(
          violations,
          `/party_removals/${index}/id`,
          "Only a current party member can be removed from the party.",
        );
      }
    });
    (Array.isArray(candidate?.companion_gear) ? candidate.companion_gear : []).forEach((entry, index) => {
      if (entry?.id && !partyIds.has(entry.id)) {
        reducerPrecondition(
          violations,
          `/companion_gear/${index}/id`,
          "Gear can be assigned only to a current party member.",
        );
      }
    });
    for (const key of ["recruit_companion", "grant_mount", "buy_mount"]) {
      const id = candidate?.[key]?.id;
      if (id && partyIds.has(id)) {
        reducerPrecondition(violations, `/${key}/id`, "The target is already in the party.");
      }
    }
  }

  if (candidate?.grant_mount?.id) {
    const mount = hasOwn(MOUNTS, candidate.grant_mount.id) ? MOUNTS[candidate.grant_mount.id] : null;
    if (!mount || mount.acquisition === "stable") {
      reducerPrecondition(
        violations,
        "/grant_mount/id",
        "Granted mounts must resolve to an authored non-stable mount.",
      );
    }
  }
  if (candidate?.buy_mount?.id) {
    const mount = hasOwn(MOUNTS, candidate.buy_mount.id) ? MOUNTS[candidate.buy_mount.id] : null;
    if (!mount || mount.acquisition !== "stable") {
      reducerPrecondition(
        violations,
        "/buy_mount/id",
        "Purchased mounts must resolve to an authored stable mount.",
      );
    }
  }
  if (Number.isFinite(projection?.availableCopper)) {
    const pricedEffects = [
      ["buy_mount", candidate?.buy_mount, hasOwn(MOUNTS, candidate?.buy_mount?.id) ? MOUNTS[candidate.buy_mount.id]?.priceCp : null, 0.4, "priceCp"],
      ["purchase_captive", candidate?.purchase_captive, CAPTIVE_POOL.find(({ key }) => key === candidate?.purchase_captive?.key)?.priceCp, 0.5, "agreedPriceCp"],
      ["purchase_rights", candidate?.purchase_rights, PRISONER_POOL.find(({ key }) => key === candidate?.purchase_rights?.key)?.rightsCp, 0.5, "agreedPriceCp"],
    ];
    for (const [key, effect, listPrice, floor, priceField] of pricedEffects) {
      if (!effect || effect.settlement !== "coin" || !Number.isFinite(listPrice) || !Number.isFinite(effect[priceField])) continue;
      const charged = Math.max(Math.round(listPrice * floor), Math.min(effect[priceField], listPrice));
      if (projection.availableCopper < charged) {
        reducerPrecondition(violations, `/${key}/${priceField}`, "The canonical purse cannot fund this coin settlement.");
      }
    }
  }
  if (candidate?.purchase_captive?.key && !CAPTIVE_KEYS.has(candidate.purchase_captive.key)) {
    reducerPrecondition(
      violations,
      "/purchase_captive/key",
      "Purchased captives must resolve to the canonical sale roster.",
    );
  }
  if (candidate?.purchase_rights?.key && !PRISONER_KEYS.has(candidate.purchase_rights.key)) {
    reducerPrecondition(
      violations,
      "/purchase_rights/key",
      "Purchased rights must resolve to the canonical gaol roster.",
    );
  }
}

function validateKnownEffectKeys(candidate, violations) {
  rejectUnknownKeys(candidate?.roll, ["label", "formula", "dc", "value", "outcome"], "/roll", violations);
  rejectUnknownKeys(candidate?.encounter, ["type", "note"], "/encounter", violations);
  rejectUnknownKeys(candidate?.tile_discovery, ["name", "poi_type", "description"], "/tile_discovery", violations);
  rejectUnknownKeys(candidate?.tile_move, ["x", "y"], "/tile_move", violations);
  rejectUnknownKeys(candidate?.start_combat, ["initiator", "surprise", "lethal", "foes", "note"], "/start_combat", violations);
  rejectArrayItemKeys(candidate?.start_combat?.foes, ["npc_id", "kind", "name", "tier", "count"], "/start_combat/foes", violations);
  rejectUnknownKeys(
    candidate?.assassination,
    ["target_id", "method", "outcome", "surprise"],
    "/assassination",
    violations,
  );
  rejectUnknownKeys(candidate?.location_update, ["status", "depopulated", "note"], "/location_update", violations);

  const inventory = candidate?.inventory_changes;
  rejectUnknownKeys(inventory, ["added", "removed", "coins"], "/inventory_changes", violations);
  rejectArrayItemKeys(inventory?.added, ["itemId", "quantity"], "/inventory_changes/added", violations);
  rejectArrayItemKeys(inventory?.removed, ["itemId", "quantity"], "/inventory_changes/removed", violations);
  rejectUnknownKeys(inventory?.coins, ["copper", "silver", "gold"], "/inventory_changes/coins", violations);

  rejectArrayItemKeys(candidate?.knowledge_updates, ["id", "adds"], "/knowledge_updates", violations);
  rejectUnknownKeys(candidate?.attribute_changes, ATTRIBUTE_KEYS, "/attribute_changes", violations);
  rejectUnknownKeys(candidate?.needs_changes, ["hunger", "thirst", "sleep"], "/needs_changes", violations);
  for (const key of ["recruit_companion", "part_ways"]) {
    rejectUnknownKeys(candidate?.[key], ["id"], `/${key}`, violations);
  }
  rejectUnknownKeys(candidate?.grant_mount, ["id", "name"], "/grant_mount", violations);
  rejectUnknownKeys(candidate?.buy_mount, ["id", "priceCp", "name", "settlement", "settlementNote"], "/buy_mount", violations);
  for (const key of ["purchase_captive", "purchase_rights"]) {
    rejectUnknownKeys(candidate?.[key], ["key", "agreedPriceCp", "settlement", "settlementNote"], `/${key}`, violations);
  }
  rejectArrayItemKeys(candidate?.party_removals, ["id", "reason"], "/party_removals", violations);
  rejectArrayItemKeys(candidate?.companion_gear, ["id", "add", "remove"], "/companion_gear", violations);
  rejectArrayItemKeys(candidate?.relationship_changes, ["id", "delta"], "/relationship_changes", violations);
  rejectArrayItemKeys(candidate?.memory_updates, ["id", "adds"], "/memory_updates", violations);

  if (Array.isArray(candidate?.new_conditions)) {
    candidate.new_conditions.forEach((condition, index) => {
      if (typeof condition !== "string") {
        rejectUnknownKeys(condition, ["name", "duration_minutes"], `/new_conditions/${index}`, violations);
      }
    });
  }

  const setup = candidate?.character_setup;
  rejectUnknownKeys(setup, [
    "name", "race", "subrace", "origin", "gender", "level", "racial_levels",
    "profession_plan", "signature_spell", "metamagic", "age", "agingMode",
    "lifespanMultiplier", "attractiveness", "appearance", "base_appearance", "bond",
    "attributes", "abilities", "knows",
  ], "/character_setup", violations);
  rejectArrayItemKeys(setup?.profession_plan, ["profession", "specialization", "levels"], "/character_setup/profession_plan", violations);
  rejectUnknownKeys(setup?.appearance, APPEARANCE_KEYS, "/character_setup/appearance", violations);
  rejectUnknownKeys(setup?.attributes, ATTRIBUTE_KEYS, "/character_setup/attributes", violations);
  if (Array.isArray(setup?.abilities)) {
    setup.abilities.forEach((ability, index) => {
      if (typeof ability !== "string") {
        rejectUnknownKeys(ability, ["id", "tier"], `/character_setup/abilities/${index}`, violations);
      }
    });
  }
  rejectUnknownKeys(candidate?.player_update, ["name", "bond"], "/player_update", violations);

  const discoveries = candidate?.discoveries;
  rejectArrayItemKeys(discoveries?.races, ["id", "name", "appearance", "description"], "/discoveries/races", violations);
  rejectArrayItemKeys(discoveries?.items, ["id", "name", "kind", "appearance", "description"], "/discoveries/items", violations);
  rejectArrayItemKeys(discoveries?.spells, ["id", "name", "description", "acquisition"], "/discoveries/spells", violations);
  rejectArrayItemKeys(discoveries?.skills, ["id", "name", "description", "rating", "tier"], "/discoveries/skills", violations);
}

function validateCanonicalCharacterReferences(candidate, characters, playerId, violations) {
  const check = (id, path) => {
    if (isSafeEntityId(id) && id !== playerId && hasOwn(characters, id)) return;
    violations.push(violation(
      "UNKNOWN_CHARACTER_REF",
      path,
      "Effect character ids must resolve to a canonical non-player character.",
    ));
  };
  for (const key of ["knowledge_updates", "relationship_changes", "memory_updates", "party_removals", "companion_gear"]) {
    (Array.isArray(candidate?.[key]) ? candidate[key] : []).forEach((entry, index) => (
      check(entry?.id, `/${key}/${index}/id`)
    ));
  }
  for (const key of ["recruit_companion", "part_ways"]) {
    if (candidate?.[key] !== null) check(candidate?.[key]?.id, `/${key}/id`);
  }
  if (candidate?.assassination !== null) {
    check(candidate?.assassination?.target_id, "/assassination/target_id");
  }
  (Array.isArray(candidate?.start_combat?.foes) ? candidate.start_combat.foes : []).forEach((foe, index) => {
    if (foe?.npc_id !== null && foe?.npc_id !== undefined) {
      check(foe.npc_id, `/start_combat/foes/${index}/npc_id`);
    }
  });
}

function isIntegerBetween(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function isCompleteNewCharacter(character) {
  if (!character || typeof character !== "object" || Array.isArray(character)) return false;
  if (!isSafeEntityId(character.id)) return false;
  for (const key of ["name", "race", "origin", "base_appearance", "description"]) {
    if (typeof character[key] !== "string" || !character[key].trim()) return false;
  }
  if (!["male", "female"].includes(character.gender)) return false;
  if (!isIntegerBetween(character.level, 1, 100)) return false;
  if (!isIntegerBetween(character.racial_levels, 0, 30)) return false;
  if (!isIntegerBetween(character.attractiveness, 1, 10)) return false;
  if (!Object.prototype.hasOwnProperty.call(character, "age")) return false;
  if (character.age !== null && !isIntegerBetween(character.age, 0, 100_000)) return false;
  if (!["mortal", "power-extended", "ageless", "out-of-time"].includes(character.agingMode)) return false;
  if (character.agingMode === "power-extended" && !(character.lifespanMultiplier > 1)) return false;

  if (!Array.isArray(character.profession_plan) || character.profession_plan.length < 1) return false;
  let professionLevels = 0;
  for (const part of character.profession_plan) {
    if (!part || typeof part !== "object" || Array.isArray(part)) return false;
    if (typeof part.profession !== "string" || !part.profession.trim()) return false;
    if (typeof part.specialization !== "string" || !part.specialization.trim()) return false;
    if (!isIntegerBetween(part.levels, 0, 70)) return false;
    professionLevels += part.levels;
  }
  if (professionLevels + character.racial_levels !== character.level) return false;

  if (!character.appearance || typeof character.appearance !== "object" || Array.isArray(character.appearance)) return false;
  for (const key of ["skin", "hair", "eyes", "build"]) {
    if (typeof character.appearance[key] !== "string" || !character.appearance[key].trim()) return false;
  }
  for (const key of ["facial_hair", "marks"]) {
    if (!Object.prototype.hasOwnProperty.call(character.appearance, key)) return false;
    if (character.appearance[key] !== null && typeof character.appearance[key] !== "string") return false;
  }
  if (!character.attributes || typeof character.attributes !== "object" || Array.isArray(character.attributes)) return false;
  if (!ATTRIBUTE_KEYS.every((key) => isIntegerBetween(character.attributes[key], 0, 90))) return false;
  return Array.isArray(character.worn)
    && character.worn.every((id) => typeof id === "string" && id)
    && Array.isArray(character.knows)
    && character.knows.every((fact) => typeof fact === "string" && fact);
}

export function compileNarratorCandidate({ candidate, projection, turnPolicy, metadata = null, state = null }) {
  const violations = [];
  if (candidate?.contract_version !== projection?.contractVersion) {
    violations.push(violation(
      "SCHEMA_VERSION",
      "/contract_version",
      "Fresh narrator responses must use the current wire contract version.",
    ));
  }
  if (candidate?.state_revision !== projection?.stateRevision) {
    violations.push(violation(
      "STALE_STATE",
      "/state_revision",
      "The narrator response does not match the captured game-state revision.",
    ));
  }
  for (const key of Object.keys(candidate || {})) {
    if (NARRATOR_RESPONSE_KEY_SET.has(key)) continue;
    violations.push(violation(
      "SCHEMA_UNKNOWN_KEY",
      `/${key}`,
      "Unknown narrator response fields are forbidden.",
    ));
  }
  for (const key of NARRATOR_RESPONSE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(candidate || {}, key)) continue;
    violations.push(violation(
      "SCHEMA_MISSING_KEY",
      `/${key}`,
      "Every narrator response field is required by the wire contract.",
    ));
  }
  if (!Array.isArray(candidate?.story) || candidate.story.length < 1 || candidate.story.length > 100) {
    violations.push(violation(
      "SCHEMA_TYPE",
      "/story",
      "Story must contain between 1 and 100 chronological entries.",
    ));
  }
  validateEffectEnvelope(candidate, violations);
  validateKnownEffectKeys(candidate, violations);
  validateEffectValues(candidate, violations);
  validateRemainingEffectValues(candidate, violations);
  validateDiscoveryEntries(candidate?.discoveries, violations);
  validateReducerPreconditions(candidate, projection, violations);
  const allowedEffectList = Array.isArray(turnPolicy?.allowedEffects) ? turnPolicy.allowedEffects : [];
  if (!Array.isArray(turnPolicy?.allowedEffects)) {
    violations.push(violation(
      "MALFORMED_CAPABILITY",
      "/turn_policy/allowedEffects",
      "Engine-issued allowed effects must be an array.",
    ));
  }
  allowedEffectList.forEach((effect, index) => {
    if (typeof effect !== "string" || !NARRATOR_EFFECT_KEYS.includes(effect)) {
      violations.push(violation(
        "MALFORMED_CAPABILITY",
        `/turn_policy/allowedEffects/${index}`,
        "Engine-issued allowed effects must name canonical effect fields.",
      ));
    }
  });
  const allowedEffects = new Set(allowedEffectList);
  if (turnPolicy?.continuation != null) {
    const terminal = turnPolicy.continuation?.terminalEffect;
    if (!isPlainObject(turnPolicy.continuation)
      || typeof terminal !== "string"
      || !NARRATOR_EFFECT_KEYS.includes(terminal)
      || !allowedEffects.has(terminal)) {
      violations.push(violation(
        "MALFORMED_CAPABILITY",
        "/turn_policy/continuation/terminalEffect",
        "Continuation authority requires an allowed canonical terminal effect.",
      ));
    }
  }
  for (const key of NARRATOR_EFFECT_KEYS) {
    const value = candidate?.[key];
    if (value === null || value === 0 || allowedEffects.has(key)) continue;
    violations.push(violation(
      "ILLEGAL_EFFECT",
      `/${key}`,
      "The engine did not issue this effect capability for the current turn.",
    ));
  }
  const effectConstraints = Object.create(null);
  if (turnPolicy && hasOwn(turnPolicy, "effectConstraints") && !isPlainObject(turnPolicy.effectConstraints)) {
    violations.push(violation(
      "MALFORMED_CAPABILITY",
      "/turn_policy/effectConstraints",
      "Engine-issued effect constraints must be an object.",
    ));
  } else {
    for (const [key, constraint] of Object.entries(turnPolicy?.effectConstraints || {})) {
      if (!NARRATOR_EFFECT_KEYS.includes(key) || !allowedEffects.has(key) || !isPlainObject(constraint)) {
        violations.push(violation(
          "MALFORMED_CAPABILITY",
          `/turn_policy/effectConstraints/${key}`,
          "Engine-issued effect constraints must target an allowed canonical effect.",
        ));
        continue;
      }
      let valid = true;
      for (const field of ["fields", "eachFields"]) {
        if (hasOwn(constraint, field) && !isPlainObject(constraint[field])) {
          violations.push(violation(
            "MALFORMED_CAPABILITY",
            `/turn_policy/effectConstraints/${key}/${field}`,
            `Engine-issued ${field} constraints must be an object.`,
          ));
          valid = false;
        }
      }
      for (const field of Object.keys(constraint)) {
        if (["equals", "fields", "eachFields"].includes(field)) continue;
        violations.push(violation(
          "MALFORMED_CAPABILITY",
          `/turn_policy/effectConstraints/${key}/${field}`,
          "Engine-issued effect constraints contain an unknown field.",
        ));
        valid = false;
      }
      if (valid) effectConstraints[key] = constraint;
    }
  }
  for (const [key, constraint] of Object.entries(effectConstraints)) {
    if (Object.prototype.hasOwnProperty.call(constraint || {}, "equals")
      && !Object.is(candidate?.[key], constraint.equals)) {
      violations.push(violation(
        "CAPABILITY_CONSTRAINT",
        `/${key}`,
        "The effect value does not match the engine-issued constraint for this turn.",
      ));
    }
    const effect = candidate?.[key];
    if (effect === null || effect === undefined) continue;
    for (const [field, expected] of Object.entries(constraint?.fields || {})) {
      if (Object.is(effect?.[field], expected)) continue;
      violations.push(violation(
        "CAPABILITY_CONSTRAINT",
        `/${key}/${field}`,
        "The effect target does not match the engine-issued constraint for this turn.",
      ));
    }
    if (Array.isArray(effect)) {
      effect.forEach((entry, index) => {
        for (const [field, expected] of Object.entries(constraint?.eachFields || {})) {
          if (Object.is(entry?.[field], expected)) continue;
          violations.push(violation(
            "CAPABILITY_CONSTRAINT",
            `/${key}/${index}/${field}`,
            "The effect entry target does not match the engine-issued constraint for this turn.",
          ));
        }
      });
    }
  }

  const characters = Object.assign(Object.create(null), projection?.characters || {});
  const present = new Set(projection?.presentSpeakerIds || []);
  const narrativeCharacterIds = new Set(present);
  if (turnPolicy?.storyCharacterIds !== undefined && !Array.isArray(turnPolicy.storyCharacterIds)) {
    violations.push(violation(
      "MALFORMED_CAPABILITY",
      "/turn_policy/storyCharacterIds",
      "Engine-issued story character ids must be an array.",
    ));
  }
  for (const [index, id] of (Array.isArray(turnPolicy?.storyCharacterIds) ? turnPolicy.storyCharacterIds : []).entries()) {
    if (!isSafeEntityId(id) || !hasOwn(characters, id) || id === projection?.playerId) {
      violations.push(violation(
        "MALFORMED_CAPABILITY",
        `/turn_policy/storyCharacterIds/${index}`,
        "Engine-issued story character id is not canonical.",
      ));
    } else narrativeCharacterIds.add(id);
  }
  let discoveries = candidate?.discoveries;
  if (discoveries !== null && discoveries !== undefined) {
    rejectUnknownKeys(discoveries, ["characters", "races", "items", "spells", "skills"], "/discoveries", violations);
    const acceptedCharacters = [];
    const seenIds = new Set();
    for (const collection of ["characters", "races", "items", "spells", "skills"]) {
      if (!Array.isArray(discoveries?.[collection])) {
        violations.push(violation(
          "SCHEMA_TYPE",
          `/discoveries/${collection}`,
          "Every discovery collection must be an array.",
        ));
      }
    }
    for (let index = 0; index < (discoveries?.characters || []).length; index++) {
      const character = discoveries.characters[index];
      const path = `/discoveries/characters/${index}`;
      rejectUnknownKeys(character, CHARACTER_KEYS, path, violations);
      rejectUnknownKeys(character?.appearance, APPEARANCE_KEYS, `${path}/appearance`, violations);
      rejectUnknownKeys(character?.attributes, ATTRIBUTE_KEYS, `${path}/attributes`, violations);
      for (let professionIndex = 0; professionIndex < (character?.profession_plan || []).length; professionIndex++) {
        rejectUnknownKeys(
          character.profession_plan[professionIndex],
          PROFESSION_KEYS,
          `${path}/profession_plan/${professionIndex}`,
          violations,
        );
      }
      const id = character?.id;
      if (!isCompleteNewCharacter(character)) {
        violations.push(violation(
          "INVALID_NEW_CHARACTER",
          `/discoveries/characters/${index}`,
          "New characters must provide a complete canonical identity record.",
        ));
        continue;
      }
      if (seenIds.has(id) || hasOwn(characters, id) || id === projection?.playerId) {
        violations.push(violation(
          "DUPLICATE_ENTITY_ID",
          `/discoveries/characters/${index}/id`,
          "New character ids must be unique and must not overwrite canonical entities.",
        ));
        continue;
      }
      seenIds.add(id);
      const at = { ...(projection?.currentTile || {}) };
      const accepted = { ...character, at, home: { x: at.x, y: at.y } };
      acceptedCharacters.push(accepted);
      characters[id] = accepted;
      present.add(id);
      narrativeCharacterIds.add(id);
    }
    discoveries = { ...discoveries, characters: acceptedCharacters };
  }
  validateCanonicalCharacterReferences(candidate, characters, projection?.playerId, violations);
  const assassination = candidate?.assassination;
  if (assassination) {
    const isDeath = assassination.outcome === "killed";
    const capabilities = isDeath ? projection?.assassinationTargets : projection?.assassinationAttempts;
    const methods = capabilities?.[assassination.target_id]?.methods;
    if (!Array.isArray(methods) || !methods.includes(assassination.method)) {
      violations.push(violation(
        "ASSASSINATION_GUARD",
        "/assassination/method",
        isDeath
          ? "The canonical attacker/target stat blocks and owned abilities do not authorize this death."
          : "The canonical attacker/target stat blocks and owned abilities do not authorize this attempt.",
      ));
    }
    if (candidate?.start_combat) {
      violations.push(violation(
        "ASSASSINATION_CONFLICT",
        "/start_combat",
        "A target settled as dead cannot also enter combat in the same turn.",
      ));
    }
  }
  const story = [];
  let assassinationDeathCues = 0;
  const deadInStory = new Set();

  for (let index = 0; index < (candidate?.story || []).length; index++) {
    const item = candidate.story[index];
    if (item?.type === "beat") {
      const path = `/story/${index}`;
      rejectUnknownKeys(item, ["type", "cue"], path, violations);
      if (hasOwn(item, "text") || hasOwn(item, "character_ids")) {
        violations.push(violation(
          "PLAYER_SOVEREIGNTY",
          `${path}/text`,
          "Fresh narrator beats must use closed world/NPC cues; model-authored beat prose is forbidden.",
        ));
      }
      const cue = item.cue;
      if (!isPlainObject(cue)) {
        violations.push(violation(
          "SCHEMA_TYPE",
          `${path}/cue`,
          "Narrative beats must contain one closed presentation cue.",
        ));
        continue;
      }
      if (cue.kind === "scene") {
        rejectUnknownKeys(cue, ["kind", "event"], `${path}/cue`, violations);
        if (!hasOwn(NARRATOR_SCENE_CUE_TEXT, cue.event)) {
          violations.push(violation(
            "SCHEMA_TYPE",
            `${path}/cue/event`,
            "Scene cue events must come from the closed presentation catalog.",
          ));
          continue;
        }
        story.push({ type: "beat", text: NARRATOR_SCENE_CUE_TEXT[cue.event] });
        continue;
      }
      if (cue.kind !== "character") {
        violations.push(violation(
          "SCHEMA_TYPE",
          `${path}/cue/kind`,
          "Presentation cues must be scene or character cues.",
        ));
        continue;
      }
      rejectUnknownKeys(
        cue,
        ["kind", "actor_id", "action", "target_id", "manner"],
        `${path}/cue`,
        violations,
      );
      const actorDiedEarlier = typeof cue.actor_id === "string" && deadInStory.has(cue.actor_id);
      const validActor = typeof cue.actor_id === "string"
        && cue.actor_id !== projection?.playerId
        && hasOwn(characters, cue.actor_id)
        && narrativeCharacterIds.has(cue.actor_id)
        && !actorDiedEarlier;
      if (actorDiedEarlier) {
        violations.push(violation(
          "DEAD_CHARACTER_ACTION",
          `${path}/cue/actor_id`,
          "A character cannot perform another action after their authorized death cue.",
        ));
      } else if (!validActor) {
        violations.push(violation(
          "UNKNOWN_CHARACTER_REF",
          `${path}/cue/actor_id`,
          "Character cue actors must resolve to canonical non-player narrative characters.",
        ));
      }
      if (!CHARACTER_CUE_ACTIONS.has(cue.action)) {
        violations.push(violation(
          "SCHEMA_TYPE",
          `${path}/cue/action`,
          "Character cue actions must come from the closed presentation catalog.",
        ));
      }
      if (cue.action === "dies") {
        if (!assassination
          || assassination.outcome !== "killed"
          || cue.actor_id !== assassination.target_id
          || cue.target_id !== null
          || cue.manner !== null) {
          violations.push(violation(
            "ASSASSINATION_PRESENTATION",
            `${path}/cue/action`,
            "A death cue must exactly present the authorized assassination target with no target or manner.",
          ));
        } else {
          assassinationDeathCues += 1;
          deadInStory.add(cue.actor_id);
        }
      }
      const validTarget = cue.target_id === null || (
        typeof cue.target_id === "string"
        && cue.target_id !== projection?.playerId
        && hasOwn(characters, cue.target_id)
        && narrativeCharacterIds.has(cue.target_id)
      );
      if (!validTarget) {
        violations.push(violation(
          "UNKNOWN_CHARACTER_REF",
          `${path}/cue/target_id`,
          "Character cue targets must be null or canonical non-player narrative characters.",
        ));
      } else if (cue.target_id !== null && !TARGETABLE_CHARACTER_CUE_ACTIONS.has(cue.action)) {
        violations.push(violation(
          "SCHEMA_TYPE",
          `${path}/cue/target_id`,
          "Only targetable character actions may include a target.",
        ));
      }
      if (cue.manner !== null && !CHARACTER_CUE_MANNERS.has(cue.manner)) {
        violations.push(violation(
          "SCHEMA_TYPE",
          `${path}/cue/manner`,
          "Character cue manners must be null or come from the closed presentation catalog.",
        ));
      }
      if (
        validActor
        && validTarget
        && CHARACTER_CUE_ACTIONS.has(cue.action)
        && (cue.target_id === null || TARGETABLE_CHARACTER_CUE_ACTIONS.has(cue.action))
        && (cue.manner === null || CHARACTER_CUE_MANNERS.has(cue.manner))
      ) {
        story.push({
          type: "beat",
          actorId: cue.actor_id,
          text: renderNarratorCharacterCue(cue, characters),
        });
      }
      continue;
    }
    if (item?.type !== "dialogue") {
      violations.push(violation(
        "SCHEMA_TYPE",
        `/story/${index}/type`,
        "Story entries must be narrative beats or character dialogue.",
      ));
      continue;
    }
    rejectUnknownKeys(item, ["type", "speaker", "line"], `/story/${index}`, violations);
    rejectUnknownKeys(item.speaker, ["kind", "id"], `/story/${index}/speaker`, violations);
    const validLine = typeof item.line === "string"
      && item.line.trim().length > 0
      && item.line.length <= 5_000;
    if (!validLine) {
      violations.push(violation(
        "SCHEMA_TYPE",
        `/story/${index}/line`,
        "Dialogue must be a non-empty bounded string.",
      ));
    }
    const speakerId = item.speaker?.kind === "character" ? item.speaker.id : null;
    const character = speakerId && hasOwn(characters, speakerId) ? characters[speakerId] : null;
    if (!character || speakerId === projection?.playerId || !present.has(speakerId) || deadInStory.has(speakerId)) {
      violations.push(violation(
        "INVALID_SPEAKER",
        `/story/${index}/speaker`,
        "Dialogue speakers must be present non-player characters from the authoritative projection.",
      ));
      continue;
    }
    if (!validLine) continue;
    story.push({ type: "dialogue", speakerId, name: character.name, line: item.line });
  }

  if (assassination?.outcome === "killed" && assassinationDeathCues !== 1) {
    violations.push(violation(
      "ASSASSINATION_PRESENTATION",
      "/story",
      "An authorized assassination death requires exactly one matching closed death cue.",
    ));
  }

  if (violations.length === 0 && state) {
    try {
      const governed = resolveNarratorIntents(state, candidate, {
        stateRevision: projection.stateRevision,
        route: turnPolicy?.id ?? null,
        turnPolicy,
      });
      for (const refusal of governed.refusals) {
        violations.push(violation(
          "OWNER_REFUSAL",
          `/${refusal.field}`,
          `Engine owner rejected ${refusal.field}: ${refusal.reason}.`,
        ));
      }
    } catch {
      violations.push(violation(
        "OWNER_VALIDATION_FAILED",
        "/",
        "The engine could not validate this response atomically.",
      ));
    }
  }

  if (violations.length) return { ok: false, violations };
  const trustedMetadata = metadata ? {
    _raw: metadata.raw,
    _thinking: metadata.thinking,
    _userMsg: metadata.userMsg,
    _model: metadata.model,
    _reasoningDetails: metadata.reasoningDetails,
    // Memories were passed in and never picked up here, so `beat._memories` was always
    // undefined and every fact the `remember` tool recorded merged into nothing. The tool
    // has been writing to a channel that ended at this object.
    //
    // They are minted only now, on a candidate that has passed every check above — which is
    // what makes "a rejected turn persists nothing" true rather than hoped for: an attempt
    // that fails validation returns above and never reaches this line.
    _memories: metadata.memories,
    _memoryProposals: metadata.memoryProposals,
  } : {};
  let materializedCandidate = candidate;
  let materializedPolicy = turnPolicy;
  if (assassination?.outcome === "detected-combat") {
    const target = characters[assassination.target_id];
    materializedCandidate = {
      ...candidate,
      start_combat: {
        initiator: "enemy",
        surprise: assassination.surprise,
        lethal: true,
        foes: [{
          npc_id: assassination.target_id,
          kind: target.kind || "npc",
          name: target.name || assassination.target_id,
          tier: target.tier || "common",
          count: 1,
        }],
        note: `${target.name || assassination.target_id} survives the assassination attempt and fights back.`,
      },
    };
    materializedPolicy = {
      ...(turnPolicy || {}),
      allowedEffects: [...new Set([...(turnPolicy?.allowedEffects || []), "start_combat"])],
    };
  }
  if (materializedCandidate.start_combat) {
    const combatHandoff = readPendingCombatDirective(materializedCandidate.start_combat);
    if (!combatHandoff.ok) {
      return {
        ok: false,
        violations: [violation(
          "COMBAT_HANDOFF",
          "/start_combat",
          `Combat handoff rejected: ${combatHandoff.reason}.`,
        )],
      };
    }
  }
  return {
    ok: true,
    turn: mintCompiledTurn(
      { ...materializedCandidate, story, discoveries, ...trustedMetadata },
      projection,
      materializedPolicy,
    ),
  };
}
