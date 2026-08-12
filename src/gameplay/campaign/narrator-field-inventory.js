// Every mechanical thing the narrator can currently say, and what should become of it.
//
// Phase 8 wants narrator output to stop mutating open-world state directly: an accepted
// turn should raise *intents*, and a deterministic owner should resolve or refuse each one
// and emit a receipt. That is a large migration, and the plan asks for the same thing first
// that Phase 0 asked for before the combat port — an inventory. You cannot migrate a surface
// you have not enumerated, and you cannot tell whether a migration is finished if new fields
// can appear without anyone noticing.
//
// So this is the register. Every field in the narrator response contract resolves to exactly
// one disposition with a stated reason, and a generated test walks the live contract against
// it, so adding a field to the schema without deciding what it is fails here rather than
// shipping as an unreviewed way for a model to change the world.
//
// Four dispositions, and the distinction that matters is between the middle two:
//
//   presentation — prose and cues. Says nothing about state; safe as it stands.
//   intent       — a request the narrator may raise and an engine owner must resolve.
//                  These are the migration: today they apply directly, tomorrow through a
//                  gateway that can refuse them.
//   projection   — the engine's own output, echoed back so the narrator can see it. Already
//                  one-way; nothing to migrate.
//   retired      — should stop existing. Named so the deletion is a decision with a reason
//                  attached rather than a field that quietly lingers.

export const NARRATOR_FIELD_INVENTORY_VERSION = 1;

export const FIELD_DISPOSITION = Object.freeze({
  PRESENTATION: "presentation",
  INTENT: "intent",
  PROJECTION: "projection",
  RETIRED: "retired",
});

const DISPOSITIONS = new Set(Object.values(FIELD_DISPOSITION));

function entry(field, disposition, owner, reason) {
  return Object.freeze({ field, disposition, owner, reason });
}

/**
 * The register.
 *
 * `owner` names the module that would resolve the intent and emit its receipt. It is a
 * commitment about where the rule lives, not a claim that the gateway is built — several of
 * these owners are the modules a later phase creates, and saying so now is what makes the
 * gateway's shape reviewable before it exists.
 */
export const NARRATOR_FIELD_INVENTORY = Object.freeze([
  // --- Presentation: prose and cues, no mechanical claim -----------------------
  entry("contract_version", FIELD_DISPOSITION.PRESENTATION, null,
    "Envelope metadata. Names which contract the response was written against; carries no "
    + "world state and cannot move any."),
  entry("story", FIELD_DISPOSITION.PRESENTATION, null,
    "The prose itself, plus the closed character-cue vocabulary. This is the thing the "
    + "narrator is for, and the only field it should ultimately own outright."),

  // --- Projection: the engine talking to itself -------------------------------
  entry("state_revision", FIELD_DISPOSITION.PROJECTION, "engine/narrator-projection.js",
    "Echoed back so a stale turn can be detected and refused. Already one-way: the engine "
    + "issues it and the narrator repeats it, so there is nothing to migrate."),
  entry("roll", FIELD_DISPOSITION.PROJECTION, "engine/narrator-projection.js",
    "The engine's own roll, shown to the narrator so prose can honour it. A narrator that "
    + "could author this could author its own successes."),
  entry("encounter", FIELD_DISPOSITION.PROJECTION, "gameplay/production/pending-directive.js",
    "The engine-selected encounter offered for narration. Selection is already engine-owned; "
    + "this field is the projection of that choice."),

  // --- Intent: the migration ---------------------------------------------------
  entry("minutes_passed", FIELD_DISPOSITION.INTENT, "campaign/time-owner",
    "Time is the spine every other cost hangs off — travel, needs, rest, light. A narrator "
    + "that sets it directly can rewind hunger or skip a night."),
  entry("vitality_change", FIELD_DISPOSITION.INTENT, "campaign/vitality-owner",
    "Health outside combat. Must be bounded by the same rules combat settlement obeys, or a "
    + "story beat becomes a heal button."),
  entry("resolve_change", FIELD_DISPOSITION.INTENT, "campaign/resolve-owner",
    "The spendable pool. Same argument as vitality, and the reason it is not yet unified "
    + "with Tower of Winter readiness."),
  entry("new_conditions", FIELD_DISPOSITION.INTENT, "campaign/condition-owner",
    "Conditions now have real combat expression through admission, so authoring one is "
    + "authoring a combat modifier. It has to go through a rule that can refuse it."),
  entry("tile_discovery", FIELD_DISPOSITION.INTENT, "campaign/discovery-owner",
    "What the map reveals is world truth. A narrator that writes it can invent geography "
    + "the generator never made."),
  entry("tile_move", FIELD_DISPOSITION.INTENT, "campaign/travel-owner",
    "Position is the input to encounters, travel time and region difficulty; moving without "
    + "paying the journey is the oldest exploit in the game."),
  entry("start_combat", FIELD_DISPOSITION.INTENT, "gameplay/tow/admission.js",
    "Already the closest to done: admission projects and can refuse it. The remaining work "
    + "is routing it as an intent rather than a directive the engine reads back out."),
  entry("assassination", FIELD_DISPOSITION.INTENT, "campaign/death-owner",
    "Death is irreversible and now sealed against rewind. Authoring one has to be an intent "
    + "an owner can refuse, not an effect applied on arrival."),
  entry("location_update", FIELD_DISPOSITION.INTENT, "campaign/location-owner",
    "Named place and its services. Drives shops, rest legality and encounter tables."),
  entry("discoveries", FIELD_DISPOSITION.INTENT, "campaign/discovery-owner",
    "Codex and world knowledge. Additive, but it is what later prompts read as fact."),
  entry("inventory_changes", FIELD_DISPOSITION.INTENT, "campaign/inventory-owner",
    "Items are combat stats through the bridge. A narrator that grants gear grants attack "
    + "and defence."),
  entry("knowledge_updates", FIELD_DISPOSITION.INTENT, "campaign/knowledge-owner",
    "What the character knows, which gates options elsewhere."),
  entry("attribute_changes", FIELD_DISPOSITION.INTENT, "campaign/progression-owner",
    "Attributes feed every derived combat stat. The single most load-bearing field here."),
  entry("needs_changes", FIELD_DISPOSITION.INTENT, "campaign/needs-owner",
    "Hunger, thirst, sleep. Authoring them directly undoes the travel economy."),
  entry("recruit_companion", FIELD_DISPOSITION.INTENT, "campaign/party-owner",
    "A companion is now an allied combat actor with a build. Recruiting one is a mechanical "
    + "act, not a narrative flourish."),
  entry("grant_mount", FIELD_DISPOSITION.INTENT, "campaign/party-owner",
    "Mounts change travel speed and carry capacity."),
  entry("buy_mount", FIELD_DISPOSITION.INTENT, "campaign/trade-owner",
    "As grant_mount, and it moves coin as well."),
  entry("purchase_captive", FIELD_DISPOSITION.INTENT, "campaign/trade-owner",
    "Moves coin and adds a person to the party; both need an owner that can refuse."),
  entry("purchase_rights", FIELD_DISPOSITION.INTENT, "campaign/trade-owner",
    "Buys a prisoner's release from the warden. Moves coin, files a bonded codex entry, and "
    + "adds a person to the party — three durable writes from one narrated conversation."),
  entry("part_ways", FIELD_DISPOSITION.INTENT, "campaign/party-owner",
    "Removing a companion is consent-bearing and must confirm against current state."),
  entry("party_removals", FIELD_DISPOSITION.INTENT, "campaign/party-owner",
    "Bulk form of part_ways; the same rule has to cover it or it becomes the way around it."),
  entry("companion_gear", FIELD_DISPOSITION.INTENT, "campaign/inventory-owner",
    "Companion equipment is now companion combat stats."),
  entry("relationship_changes", FIELD_DISPOSITION.INTENT, "campaign/relationship-owner",
    "Standing gates recruitment, prices and quest access."),
  entry("memory_updates", FIELD_DISPOSITION.INTENT, "engine/memory.js",
    "Typed durable memory. Already validated separately; the gateway makes the validation a "
    + "refusal rather than a filter."),
  entry("progression_focus", FIELD_DISPOSITION.INTENT, "campaign/progression-owner",
    "Steers where growth lands. Narrow, but it is growth."),
  entry("character_setup", FIELD_DISPOSITION.INTENT, "gameplay/tow/character-bootstrap.js",
    "Creation. The bootstrap compiler is already the sole applicator; this field has to "
    + "become a request into it rather than a parallel path."),
  entry("player_update", FIELD_DISPOSITION.INTENT, "campaign/identity-owner",
    "Name, appearance and identity. Mostly narrative, but it writes durable character state "
    + "and so needs the same discipline."),
]);

const BY_FIELD = new Map(NARRATOR_FIELD_INVENTORY.map((row) => [row.field, row]));

export function narratorFieldDisposition(field) {
  return BY_FIELD.get(field) ?? null;
}

/** Fields that still apply directly and must move behind an owner. */
export function intentFields() {
  return NARRATOR_FIELD_INVENTORY
    .filter((row) => row.disposition === FIELD_DISPOSITION.INTENT)
    .map((row) => row.field);
}

/** Fields that carry no mechanical claim and can stay exactly as they are. */
export function presentationFields() {
  return NARRATOR_FIELD_INVENTORY
    .filter((row) => row.disposition === FIELD_DISPOSITION.PRESENTATION)
    .map((row) => row.field);
}

/** Anything in the contract this register has not decided about. */
export function unclassifiedFields(contractFields) {
  return (contractFields || []).filter((field) => !BY_FIELD.has(field));
}

/** Anything the register names that the contract no longer contains. */
export function staleInventoryFields(contractFields) {
  const live = new Set(contractFields || []);
  return NARRATOR_FIELD_INVENTORY
    .filter((row) => !live.has(row.field))
    .map((row) => row.field);
}

export function isValidDisposition(value) {
  return DISPOSITIONS.has(value);
}
