// Phase 0: every module in the duplicate stacks has one named destination.
//
// The rule the fusion plan sets is that nothing is deleted until every capability worth
// keeping has a new owner. This ledger is that accounting, and retirement-ledger.test.js
// enforces it: a module marked `delete` with no remaining blocker must not be imported by
// anything, and a module marked `port` must name where its capability is going.

export const DESTINATION = Object.freeze({
  /** Stays where it is. Load-bearing for the live route or genuinely shared. */
  KEEP: "keep",
  /** Its capability moves to a named new owner, then the original goes. */
  PORT: "port",
  /** Superseded outright; removed once nothing imports it. */
  DELETE: "delete",
});

function entry(module, destination, { successor = null, blockedBy = null, why }) {
  return Object.freeze({ module, destination, successor, blockedBy, why });
}

export const RETIREMENT_LEDGER = Object.freeze([
  // ---- kernel: shared infrastructure, model-agnostic -----------------------
  entry("kernel/json-data.js", DESTINATION.KEEP, {
    why: "Prototype-safe JSON clone/compare used by both stacks and by the live route.",
  }),
  entry("kernel/rng.js", DESTINATION.KEEP, {
    why: "Frozen mulberry32 seeded RNG. The determinism guarantee rests on it.",
  }),
  entry("kernel/replay.js", DESTINATION.KEEP, {
    why: "gameplayChecksum and the sealed receipt scaffold. Already load-bearing outside "
      + "the preview gate via the pending-combat context checksum.",
  }),
  entry("kernel/rules.js", DESTINATION.KEEP, {
    why: "Embeddable, exact-key-validated ruleset snapshot. The pattern — pin the rules "
      + "into the save so an old fight stays replayable — is wanted for ruleset pinning.",
  }),
  entry("kernel/status-stack.js", DESTINATION.KEEP, {
    why: "The live status engine: count-based stacks with the four evidenced lifecycles, "
      + "which is what makes traits mechanically real.",
  }),
  entry("kernel/tow-actor.js", DESTINATION.KEEP, {
    why: "The live actor model, carrying crit, dodge and a shield pool separate from HP.",
  }),
  entry("kernel/tow-actor-v12.js", DESTINATION.KEEP, {
    why: "Frozen verifier-only v1.2 actor semantics required to authenticate retired combat "
      + "history without routing playable/current combat through historical rules.",
  }),
  ...[
    "ability-targeting-v12.js",
    "character-abilities-v12.js",
    "combat-items-v12.js",
    "combat-policy-v12.js",
    "commands-v12.js",
    "encounter-v12.js",
    "movement-v12.js",
    "outcomes-v12.js",
    "replay-v12.js",
    "ruleset-v12.js",
    "session-v12.js",
    "skills-v12.js",
    "targeting-v12.js",
    "weapon-techniques-v12.js",
  ].map((module) => entry(`tow/${module}`, DESTINATION.KEEP, {
    why: "Frozen verifier-only deployed-v1.2 semantics; retained solely to authenticate "
      + "historical combat and never registered as a playable runtime.",
  })),
  entry("kernel/tow-damage.js", DESTINATION.KEEP, {
    why: "The live damage resolver. Per-hit resolution is what makes Steelskin, Thorn and "
      + "Burn behave differently against a flurry than against one heavy blow.",
  }),

  // ---- kernel: bound to the weaker resolver --------------------------------
  entry("kernel/intent.js", DESTINATION.PORT, {
    successor: "src/gameplay/tow/intent.js",
    blockedBy: "phase-3-intent-harness",
    why: "Seeded, versioned, embeddable intent pattern machine with a schedule that can be "
      + "re-derived to prove it was not tampered with. TOW picks attacks at random today, "
      + "which is strictly weaker and is why a fight cannot be read.",
  }),
  entry("kernel/model.js", DESTINATION.DELETE, {
    blockedBy: "kernel/resolve.js",
    why: "1v1-capped actor/encounter model with no crit, dodge, shield or multi-hit. "
      + "Superseded by tow-actor.js plus tow/encounter.js.",
  }),
  entry("kernel/resolve.js", DESTINATION.DELETE, {
    blockedBy: "kernel/intent.js port",
    why: "Single-action-per-round resolver superseded by tow/encounter.js. Holds the intent "
      + "advance that the port needs as its reference.",
  }),
  entry("kernel/statuses.js", DESTINATION.DELETE, {
    blockedBy: "kernel/model.js",
    why: "Duration-based, mutating status list with two statuses in use. Superseded by the "
      + "count-based status-stack.js.",
  }),

  // ---- production ---------------------------------------------------------
  entry("production/pending-directive.js", DESTINATION.KEEP, {
    why: "Live and ungated. Persists an offered fight across reload and carries the "
      + "admission-projection checksum.",
  }),
  entry("production/pending-travel-combat.js", DESTINATION.KEEP, {
    why: "Live and ungated. The travel-side half of the same handoff.",
  }),
  entry("production/combat-adapter.js", DESTINATION.DELETE, {
    blockedBy: "app-import",
    why: "1v1-only admission superseded by tow/solitaire-bridge.js, which admits groups.",
  }),
  entry("production/combat-session.js", DESTINATION.DELETE, {
    blockedBy: "phase-2-combat-session",
    why: "Two-action placeholder session. Superseded by the Phase 2 durable combat session; "
      + "its sealed-envelope discipline is the model for that successor.",
  }),
  entry("production/combat-settlement.js", DESTINATION.DELETE, {
    blockedBy: "app-import",
    why: "Single-foe settlement superseded by tow/settlement.js, which settles a group and "
      + "emits a growth beat.",
  }),

  // ---- reference catalogue ------------------------------------------------
  entry("reference/release-gate.js", DESTINATION.KEEP, {
    why: "Descriptor-safe env gate, still the switch for the preview surfaces.",
  }),
  ...[
    ["reference/policy.js", "Provisional policy object; its evidence now lives in docs/design/TOW_EVIDENCE.md."],
    ["reference/characters.js", "One hardcoded Arctic Knight, superseded by the profession packages."],
    ["reference/enemies.js", "One placeholder Gatekeeper with an invented attack pattern."],
    ["reference/encounters.js", "A 12-step act with 11 steps marked contentConfidence: gap."],
    ["reference/skills.js", "Two skills with per-encounter uses, superseded by tow/skills.js."],
    ["reference/abilities.js", "Trait metadata with no effects; nothing fires it in combat."],
    ["reference/actions.js", "Basic attack/defence actions superseded by tow/skills.js."],
    ["reference/fusions.js", "A single fusion contradicted by the captured evidence."],
    ["reference/items.js", "Placeholder item catalogue with no live consumer."],
    ["reference/rewards.js", "Reward definitions belonging to the preview run shell."],
  ].map(([module, why]) => entry(module, DESTINATION.DELETE, {
    blockedBy: "phase-9-cutover",
    why,
  })),

  // ---- run shell ----------------------------------------------------------
  entry("run/campaign-boundary.js", DESTINATION.KEEP, {
    why: "Live via App. Attempt counter, seed lineage, domain check and the monotonic "
      + "transition guard are all combat-model independent.",
  }),
  entry("run/persistence.js", DESTINATION.PORT, {
    successor: "the Phase 2 combat-session codec",
    blockedBy: "phase-2-combat-session",
    why: "Versioned, baseline-tagged, fingerprinted save envelope with tamper detection. "
      + "A live fight is lost on reload today because nothing plays this role for TOW.",
  }),
  entry("run/rewards.js", DESTINATION.PORT, {
    successor: "the TOW reward loop",
    blockedBy: "phase-8-rewards",
    why: "Seeded three-choice offer with one free reroll, eligibility filtering and an "
      + "idempotent claim. Wanted wholesale for trait acquisition.",
  }),
  entry("run/action-progression.js", DESTINATION.PORT, {
    successor: "TOW build progression",
    blockedBy: "phase-8-rewards",
    why: "Per-slot family lock and upgrade levels. tow/skills.js has a `replaces` field "
      + "that nothing consumes; this is the progression that would consume it.",
  }),
  entry("run/state.js", DESTINATION.DELETE, {
    blockedBy: "phase-9-cutover",
    why: "Run/act state machine tied to the reference resolver. Solitaire is persistent and "
      + "uses Resolve rather than per-act refills, so the act container does not survive.",
  }),
  entry("run/build.js", DESTINATION.DELETE, {
    blockedBy: "phase-1-build-authority",
    why: "Reference build composition superseded by the Phase 1 durable TowPlayerBuild.",
  }),
]);

export function ledgerEntryFor(module) {
  return RETIREMENT_LEDGER.find((row) => row.module === module) || null;
}

/** Modules that may be deleted now: marked delete and no longer blocked. */
export function readyForDeletion() {
  return RETIREMENT_LEDGER
    .filter((row) => row.destination === DESTINATION.DELETE && row.blockedBy === null)
    .map((row) => row.module);
}

export function isValidDestination(value) {
  return Object.values(DESTINATION).includes(value);
}
