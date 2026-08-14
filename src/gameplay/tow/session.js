// The durable Tower of Winter combat session.
//
// A fight used to live in two places that both vanish on reload: a React `useState` for the
// encounter and a `useRef` for everything the encounter deliberately does not know — who the
// foes are in the codex, whether blades were drawn, what the spoils should be. Losing the
// first costs the player a fight in progress. Losing the second is worse: a fight that
// reloads without its context cannot settle correctly, because "this foe was Warden Hale"
// and "this was a brawl, not a duel" are exactly the facts settlement reads.
//
// So the session is the durable unit, and it carries three things the encounter does not:
//
//   context — the admission. Everything decided before the first blow and unchangeable
//             after it: lethality, stakes, loot policy, codex bindings, where and why.
//   genesis — the immutable inputs. Enough to rebuild the opening state byte for byte,
//             which is what makes replay a proof rather than a re-enactment.
//   commands — what the player actually did, in order, each one identified.
//
// Randomness is split into named streams. One shared generator means a cosmetic change —
// an extra tie-break roll when two foes have equal Priority — silently shifts every later
// draw, so the loot a player earned yesterday is not the loot they earn today from the same
// seed. Named streams make that impossible: the intent stream can grow new draws without
// the loot stream noticing.

import { cloneJsonData } from "../kernel/json-data.js";
import { createRng, nextFloat } from "../kernel/rng.js";
import { gameplayChecksum } from "../kernel/replay.js";
import { createTowEncounter, isTowEncounter } from "./encounter.js";

export const TOW_SESSION_VERSION = 1;

/** Pinned on every session: a release may not reinterpret a fight already in progress. */
export const TOW_RULESET_ID = "solitaire-tow-v1";

/** The generator behind every stream. Bumping this invalidates replay on purpose. */
export const TOW_RNG_VERSION = "mulberry32-v1";

/**
 * The named randomness streams, in a fixed order.
 *
 * `combat` and `intent` drive the fight and live on the encounter, as `rng` and `intentRng`.
 * `loot` and `rewards` are held on the session until settlement spends them. Each stream
 * lives in exactly one place, so there is no second copy to drift.
 */
export const TOW_RNG_STREAMS = Object.freeze(["combat", "intent", "loot", "rewards"]);

/** The streams the session itself carries; the rest belong to the encounter. */
export const TOW_SESSION_STREAMS = Object.freeze(["loot", "rewards"]);

export const TOW_SESSION_MODES = Object.freeze(["campaign", "practice"]);
export const TOW_SESSION_STATUSES = Object.freeze(["active", "terminal", "settled"]);
export const TOW_LETHAL_POLICIES = Object.freeze(["nonlethal", "lethal", "mixed"]);

/**
 * Whether the *player* may die permanently in this fight.
 *
 * This is an admission fact, recorded before the first command, precisely so it cannot be
 * decided after seeing the result. `lethalPolicy` says what zero health means for the foes;
 * `playerStakes` says what it means for the player, and they are genuinely independent — a
 * duel to the death against a bandit still leaves the player alive at one vitality.
 */
export const TOW_PLAYER_STAKES = Object.freeze(["survivable", "lethal"]);

export const TOW_RETREAT_POLICIES = Object.freeze(["forbidden", "allowed"]);

export const MAX_TOW_COMMANDS = 4096;
export const MAX_TOW_PARTICIPANTS = 32;

const SESSION_KEYS = Object.freeze([
  "checksum",
  "commands",
  "context",
  "encounter",
  "genesis",
  "mode",
  "revision",
  "rulesetId",
  "sessionId",
  "settlementId",
  "status",
  "streams",
  "terminalReceipt",
  "version",
].sort());

const CONTEXT_KEYS = Object.freeze([
  "admission",
  "campaignRevision",
  "detectionFacts",
  "directiveId",
  "hostilityFacts",
  "lethalPolicy",
  "location",
  "lootPolicy",
  "participantBindings",
  "playerStakes",
  "retreatPolicy",
  "rewardPolicy",
  "source",
].sort());

const GENESIS_KEYS = Object.freeze([
  "allySnapshots",
  "effectiveBuild",
  "enemySnapshots",
  "intentSchedules",
  "playerSnapshot",
  "rngVersion",
  "seedManifest",
].sort());

const MAX_IDENTIFIER_LENGTH = 256;

function rejected(reason) {
  return { ok: false, reason, session: null };
}

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const own = Object.keys(value).sort();
  return own.length === keys.length && own.every((key, index) => key === keys[index]);
}

function identifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH;
}

function optionalIdentifier(value) {
  return value === null || identifier(value);
}

function validSeed(seed) {
  return (typeof seed === "string" && seed.length > 0)
    || (typeof seed === "number" && Number.isFinite(seed));
}

function isRngState(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && value.algorithm === "mulberry32"
    && Number.isInteger(value.state)
    && value.state >= 0
    && value.state <= 0xFFFFFFFF;
}

/**
 * Derive one seed per named stream from a single root seed.
 *
 * Deriving by *name* rather than by draw order is the whole point: a stream added in a
 * later phase gets its own seed instead of consuming draws that used to belong to loot.
 */
export function deriveSeedManifest(rootSeed) {
  if (!validSeed(rootSeed)) throw new TypeError("invalid-session-seed");
  return Object.fromEntries(
    TOW_RNG_STREAMS.map((name) => [name, `${rootSeed}::tow-stream::${name}::v1`]),
  );
}

function isSeedManifest(value) {
  return exactKeys(value, [...TOW_RNG_STREAMS].sort())
    && TOW_RNG_STREAMS.every((name) => identifier(value[name]));
}

// ---------------------------------------------------------------------------
// Context — the admission
// ---------------------------------------------------------------------------

function isParticipantBindings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > MAX_TOW_PARTICIPANTS) return false;
  return entries.every(([actorId, binding]) => (
    identifier(actorId)
    && exactKeys(binding, ["campaignEntityId", "lethal"])
    && optionalIdentifier(binding.campaignEntityId)
    // `null` means "follow the session policy"; a boolean is the per-participant override
    // a mixed encounter needs.
    && (binding.lethal === null || typeof binding.lethal === "boolean")
  ));
}

/**
 * Per-foe spoils inputs, keyed by actor id.
 *
 * These three fields are everything the loot roller reads off a foe, and they used to live
 * on the ref that vanished on reload — which meant a reloaded fight settled with no spoils
 * at all. Projecting exactly the three rather than storing whole bestiary entries keeps the
 * save small and keeps world content out of the admission.
 */
function isLootSources(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > MAX_TOW_PARTICIPANTS) return false;
  return entries.every(([actorId, source]) => (
    identifier(actorId)
    && exactKeys(source, ["kind", "maxLootTier", "tier"])
    && optionalIdentifier(source.kind)
    && optionalIdentifier(source.maxLootTier)
    && optionalIdentifier(source.tier)
  ));
}

function isContext(value) {
  if (!exactKeys(value, CONTEXT_KEYS)) return false;
  return optionalIdentifier(value.directiveId)
    && exactKeys(value.source, ["kind", "note"])
    && identifier(value.source.kind)
    && (value.source.note === null || typeof value.source.note === "string")
    && typeof value.location === "string"
    && Number.isSafeInteger(value.campaignRevision)
    && value.campaignRevision >= 0
    && isParticipantBindings(value.participantBindings)
    && exactKeys(value.hostilityFacts, ["initiator", "surprise"])
    && ["player", "enemy"].includes(value.hostilityFacts.initiator)
    && typeof value.hostilityFacts.surprise === "boolean"
    && exactKeys(value.detectionFacts, ["hidden"])
    && typeof value.detectionFacts.hidden === "boolean"
    && TOW_LETHAL_POLICIES.includes(value.lethalPolicy)
    && TOW_PLAYER_STAKES.includes(value.playerStakes)
    && TOW_RETREAT_POLICIES.includes(value.retreatPolicy)
    && exactKeys(value.lootPolicy, ["coinBonus", "maxLootTier", "ownedUniqueIds", "region", "sources"])
    && (value.lootPolicy.maxLootTier === null
      || typeof value.lootPolicy.maxLootTier === "string"
      || Number.isSafeInteger(value.lootPolicy.maxLootTier))
    && Number.isSafeInteger(value.lootPolicy.region)
    && Number.isSafeInteger(value.lootPolicy.coinBonus)
    && Array.isArray(value.lootPolicy.ownedUniqueIds)
    && value.lootPolicy.ownedUniqueIds.every((id) => typeof id === "string")
    && isLootSources(value.lootPolicy.sources)
    && exactKeys(value.rewardPolicy, ["proficiencyId"])
    && optionalIdentifier(value.rewardPolicy.proficiencyId)
    && exactKeys(value.admission, ["notes", "version"])
    && Number.isSafeInteger(value.admission.version)
    && Array.isArray(value.admission.notes)
    && value.admission.notes.every((entry) => (
      Boolean(entry)
      && typeof entry === "object"
      && !Array.isArray(entry)
      && identifier(entry.disposition)
      && identifier(entry.code)
    ));
}

/**
 * Fill a partial admission out to a complete, valid context.
 *
 * Every default here is conservative around death: unstated lethality is a brawl and
 * unstated stakes are survivable. Retreat is universal; the policy field stays in the
 * admission so existing saved sessions retain their exact shape.
 */
export function towCombatContext(input = {}) {
  const loot = input.lootPolicy || {};
  return {
    directiveId: input.directiveId ?? null,
    source: {
      kind: input.source?.kind || "narrator",
      note: input.source?.note ?? null,
    },
    location: typeof input.location === "string" ? input.location : "",
    campaignRevision: Number.isSafeInteger(input.campaignRevision) && input.campaignRevision >= 0
      ? input.campaignRevision
      : 0,
    participantBindings: Object.fromEntries(
      Object.entries(input.participantBindings || {}).map(([actorId, binding]) => [
        actorId,
        {
          campaignEntityId: binding?.campaignEntityId ?? null,
          lethal: typeof binding?.lethal === "boolean" ? binding.lethal : null,
        },
      ]),
    ),
    hostilityFacts: {
      initiator: input.hostilityFacts?.initiator === "enemy" ? "enemy" : "player",
      surprise: Boolean(input.hostilityFacts?.surprise),
    },
    detectionFacts: { hidden: Boolean(input.detectionFacts?.hidden) },
    lethalPolicy: TOW_LETHAL_POLICIES.includes(input.lethalPolicy) ? input.lethalPolicy : "nonlethal",
    playerStakes: TOW_PLAYER_STAKES.includes(input.playerStakes) ? input.playerStakes : "survivable",
    retreatPolicy: TOW_RETREAT_POLICIES.includes(input.retreatPolicy) ? input.retreatPolicy : "allowed",
    lootPolicy: {
      maxLootTier: typeof loot.maxLootTier === "string" || Number.isSafeInteger(loot.maxLootTier)
        ? loot.maxLootTier
        : null,
      region: Number.isSafeInteger(loot.region) ? loot.region : 0,
      coinBonus: Number.isSafeInteger(loot.coinBonus) ? loot.coinBonus : 0,
      ownedUniqueIds: [...(loot.ownedUniqueIds || [])].filter((id) => typeof id === "string"),
      sources: Object.fromEntries(
        Object.entries(loot.sources || {}).map(([actorId, source]) => [actorId, {
          kind: typeof source?.kind === "string" ? source.kind : null,
          maxLootTier: typeof source?.maxLootTier === "string" ? source.maxLootTier : null,
          tier: typeof source?.tier === "string" ? source.tier : null,
        }]),
      ),
    },
    rewardPolicy: { proficiencyId: input.rewardPolicy?.proficiencyId ?? null },
    // What this fight decided not to carry, and why. Durable so that "the companion held
    // back" and "the ability was superseded by the package" survive a reload as recorded
    // facts rather than as things nobody wrote down.
    admission: {
      version: Number.isSafeInteger(input.admission?.version) ? input.admission.version : 1,
      notes: [...(input.admission?.notes || [])],
    },
  };
}

/**
 * Whether a participant's death in this encounter is a real death.
 *
 * A per-participant binding wins over the session policy, which is what `mixed` is for: the
 * duel at the centre of a brawl can be lethal while the bystanders who joined in are not.
 */
export function participantIsLethal(context, actorId) {
  const override = context?.participantBindings?.[actorId]?.lethal;
  if (typeof override === "boolean") return override;
  return context?.lethalPolicy === "lethal";
}

// ---------------------------------------------------------------------------
// Genesis — the immutable opening
// ---------------------------------------------------------------------------

function isGenesis(value) {
  if (!exactKeys(value, GENESIS_KEYS)) return false;
  return isSeedManifest(value.seedManifest)
    && value.rngVersion === TOW_RNG_VERSION
    && Boolean(value.playerSnapshot)
    && typeof value.playerSnapshot === "object"
    && !Array.isArray(value.playerSnapshot)
    && Array.isArray(value.enemySnapshots)
    && value.enemySnapshots.length >= 1
    && value.enemySnapshots.length < MAX_TOW_PARTICIPANTS
    && Array.isArray(value.allySnapshots)
    && value.allySnapshots.length < MAX_TOW_PARTICIPANTS
    && Boolean(value.effectiveBuild)
    && typeof value.effectiveBuild === "object"
    && !Array.isArray(value.effectiveBuild)
    && Boolean(value.intentSchedules)
    && typeof value.intentSchedules === "object"
    && !Array.isArray(value.intentSchedules);
}

/**
 * Rebuild the opening encounter from genesis alone.
 *
 * This is the function that makes replay meaningful. Both the live fight and its
 * verification start here, from the same immutable inputs, so a divergence can only come
 * from the commands in between.
 */
export function encounterFromGenesis(genesis) {
  return createTowEncounter({
    seed: genesis.seedManifest.combat,
    intentSeed: genesis.seedManifest.intent,
    allies: genesis.allySnapshots,
    // Authored rotations where a fixture supplies them; the default generator fills in the
    // rest, so an arbitrary bestiary group telegraphs as readably as a named boss.
    intentSchedules: Object.keys(genesis.intentSchedules).length > 0
      ? genesis.intentSchedules
      : undefined,
    player: genesis.playerSnapshot,
    enemies: genesis.enemySnapshots,
    build: genesis.effectiveBuild,
  });
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

function checksumBody(session) {
  const { checksum, ...body } = session;
  return body;
}

/** The integrity check for a session. Not a signature — it catches corruption, not cheating. */
export function towSessionChecksum(session) {
  return `integrity-v1:${gameplayChecksum(checksumBody(session))}`;
}

/** Re-stamp a session's checksum after a mutation. Every write path ends here. */
export function sealTowSession(session) {
  const sealed = { ...session, checksum: null };
  sealed.checksum = towSessionChecksum(sealed);
  return sealed;
}

/**
 * Every stream's current endpoint.
 *
 * `combat` is read off the encounter rather than mirrored on the session, so there is
 * exactly one place each stream's position is recorded and no way for two copies to drift.
 */
export function towStreamEndpoints(session) {
  return {
    combat: { ...session.encounter.rng },
    intent: { ...session.encounter.intentRng },
    loot: { ...session.streams.loot },
    rewards: { ...session.streams.rewards },
  };
}

/**
 * Record that a terminal session has been folded into the campaign.
 *
 * Idempotent, and deliberately refuses to re-point an existing settlement at a new receipt:
 * a fight settles once, and the second attempt is a race to be absorbed rather than an
 * update to be applied.
 */
export function markTowSessionSettled(session, settlementId) {
  if (!identifier(settlementId)) return { ok: false, reason: "invalid-settlement-id", session };
  if (session.status === "active") return { ok: false, reason: "encounter-not-terminal", session };
  if (session.settlementId !== null) {
    return session.settlementId === settlementId
      ? { ok: true, reason: null, session, duplicate: true }
      : { ok: false, reason: "session-already-settled", session };
  }
  const settled = sealTowSession({
    ...session,
    status: "settled",
    settlementId,
    checksum: null,
  });
  return { ok: true, reason: null, session: settled, duplicate: false };
}

/**
 * A stateful generator over one named stream, for code that expects `Math.random`.
 *
 * The loot roller and everything under it take a plain zero-argument function, so a seeded
 * stream has to be adapted to that shape rather than the other way round — rewriting four
 * data modules into the functional RNG would be a much larger change for the same result.
 * The endpoint is readable afterwards, so what the settlement spent is recorded rather than
 * inferred.
 */
export function streamSequencer(start) {
  let current = { ...start };
  return {
    random() {
      const draw = nextFloat(current);
      current = draw.rng;
      return draw.value;
    },
    endpoint() {
      return { ...current };
    },
  };
}

/**
 * Record what a settlement spent from a session-held stream.
 *
 * Only `loot` and `rewards` live on the session, and only settlement spends them, so this
 * is the one place they move. Anything else touching them would show up immediately as a
 * replay divergence.
 */
export function spendTowSessionStream(session, name, endpoint) {
  if (!TOW_SESSION_STREAMS.includes(name)) {
    return { ok: false, reason: "unknown-session-stream", session };
  }
  if (!isRngState(endpoint)) return { ok: false, reason: "invalid-stream-endpoint", session };
  const next = sealTowSession({
    ...session,
    streams: { ...session.streams, [name]: { ...endpoint } },
    checksum: null,
  });
  return { ok: true, reason: null, session: next };
}

export function isTowSession(value) {
  if (!exactKeys(value, SESSION_KEYS)) return false;
  if (value.version !== TOW_SESSION_VERSION) return false;
  if (value.rulesetId !== TOW_RULESET_ID) return false;
  if (!identifier(value.sessionId)) return false;
  if (!TOW_SESSION_MODES.includes(value.mode)) return false;
  if (!TOW_SESSION_STATUSES.includes(value.status)) return false;
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) return false;
  if (!isContext(value.context)) return false;
  if (!isGenesis(value.genesis)) return false;
  if (!Array.isArray(value.commands) || value.commands.length > MAX_TOW_COMMANDS) return false;
  // The revision *is* the accepted-command count. Keeping them equal by construction means a
  // forged revision cannot make a stale command look current.
  if (value.commands.length !== value.revision) return false;
  if (!isTowEncounter(value.encounter)) return false;
  if (!exactKeys(value.streams, [...TOW_SESSION_STREAMS].sort())) return false;
  if (!TOW_SESSION_STREAMS.every((name) => isRngState(value.streams[name]))) return false;
  if (!optionalIdentifier(value.settlementId)) return false;
  if (value.terminalReceipt !== null && typeof value.terminalReceipt !== "object") return false;
  if (typeof value.checksum !== "string") return false;

  // Status has to agree with what the session actually holds, or a save could claim to be
  // settled while still carrying a live fight.
  const terminal = value.encounter.phase !== "player";
  if (value.status === "active" && (terminal || value.terminalReceipt !== null)) return false;
  if (value.status !== "active" && !terminal) return false;
  if (value.status === "settled" && value.settlementId === null) return false;
  if (value.status !== "settled" && value.settlementId !== null) return false;
  return true;
}

/**
 * Open a durable combat session.
 *
 * @param {object} input
 * @param {string} input.sessionId stable across reloads; the settlement dedupe key
 * @param {string|number} input.rootSeed one seed; every stream is derived from it
 * @param {object} input.player actor input for the player
 * @param {Array<object>} input.enemies actor inputs for the foes, normally with archetype builds;
 * legacy replay snapshots may still carry attack tables
 * @param {object} input.build traits/skills/runes
 * @param {object} input.context the admission; see `towCombatContext`
 * @param {"campaign"|"practice"} [input.mode]
 */
export function createTowSession(input = {}) {
  const { sessionId, rootSeed, player, enemies, build, mode = "campaign" } = input;
  if (!identifier(sessionId)) return rejected("invalid-session-id");
  if (!TOW_SESSION_MODES.includes(mode)) return rejected("invalid-session-mode");
  if (!validSeed(rootSeed)) return rejected("invalid-session-seed");

  let genesis;
  try {
    genesis = cloneJsonData({
      seedManifest: deriveSeedManifest(rootSeed),
      rngVersion: TOW_RNG_VERSION,
      playerSnapshot: player,
      // Each ally carries their own actor line and their own build. Holding them in genesis
      // is what lets a party fight replay exactly, down to which companion was already hurt
      // when the first blow landed.
      allySnapshots: input.allies || [],
      enemySnapshots: enemies,
      effectiveBuild: {
        traits: build?.traits || {},
        skills: build?.skills || [],
        runes: build?.runes || [],
        ...(Object.hasOwn(build || {}, "basicAttack") ? { basicAttack: build.basicAttack || null } : {}),
      },
      // Authored per-enemy telegraph rotations. Empty is the normal case: the encounter
      // derives a default rotation from each foe's own ability loadout (or a legacy replay's
      // immutable attack table), and an authored one is for named patterns and fixtures.
      intentSchedules: input.intentSchedules || {},
    }, "invalid-session-genesis");
  } catch {
    return rejected("invalid-session-genesis");
  }
  if (!isGenesis(genesis)) return rejected("invalid-session-genesis");

  let encounter;
  try {
    encounter = encounterFromGenesis(genesis);
  } catch (error) {
    return rejected(error?.message || "invalid-session-encounter");
  }

  const context = towCombatContext(input.context);
  if (!isContext(context)) return rejected("invalid-session-context");
  // A binding that names no actor in the fight is a mistake worth failing on: it usually
  // means the codex ids and the actor ids were built from different lists, which would
  // quietly write the wrong NPC's death into the world at settlement.
  const actorIds = new Set([encounter.playerId, ...encounter.allyIds, ...encounter.enemyIds]);
  const stray = Object.keys(context.participantBindings).find((id) => !actorIds.has(id));
  if (stray) return rejected("unknown-participant-binding");
  const strayLoot = Object.keys(context.lootPolicy.sources).find((id) => !actorIds.has(id));
  if (strayLoot) return rejected("unknown-loot-source");

  const session = sealTowSession({
    version: TOW_SESSION_VERSION,
    sessionId,
    rulesetId: TOW_RULESET_ID,
    mode,
    status: encounter.phase === "player" ? "active" : "terminal",
    revision: 0,
    context,
    genesis,
    commands: [],
    encounter,
    streams: {
      loot: createRng(genesis.seedManifest.loot),
      rewards: createRng(genesis.seedManifest.rewards),
    },
    terminalReceipt: null,
    settlementId: null,
    checksum: null,
  });

  // A fight can be over before the first command — a one-sided ambush against an already
  // broken foe — so the opening state is validated rather than assumed active.
  if (!isTowSession(session)) return rejected("invalid-session");
  return { ok: true, reason: null, session };
}
