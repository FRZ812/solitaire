// Public Tower-combat runtime boundary.
//
// Every implementation import points inward from this file. The v1 modules do not import
// the router, which keeps registration cycle-free and lets App migrate to this facade
// without making the ruleset implementations depend on their own public entry point.
//
// Routing is deliberately narrower than feature detection. A formation schema version,
// ability id, command shape, or other payload detail never selects a runtime. Only the
// exact durable pair `(session.version, session.rulesetId)` does. When a v2 session lands,
// it therefore needs its own registration here; it can never fall through to v1.

import {
  dispatchTowCommand,
  dispatchTowPlayerAction,
  towSessionEvents,
} from "./commands.js";
import { sealTowTerminalReceipt, worldFatesByParticipant } from "./outcomes.js";
import { decodeTowSession, encodeTowSession } from "./persistence.js";
import { replayTowCombatSession, verifyTowSession } from "./replay.js";
import {
  TOW_RETIRED_RUNTIME_IDENTITIES,
  TOW_RULESET_ID,
  TOW_SESSION_VERSION,
} from "./ruleset.js";
import {
  TOW_SESSION_STREAMS,
  createTowSession,
  markTowSessionSettled,
  spendTowSessionStream,
  streamSequencer,
  towSettlementContextForSession,
} from "./session.js";
import { settleTowEncounter } from "./settlement.js";

export const TOW_RUNTIME_REASONS = Object.freeze({
  invalidIdentity: "invalid-tow-runtime-identity",
  legacyRuntime: "unsupported-legacy-tow-runtime",
  unsupportedRuntime: "unsupported-tow-runtime",
});

/** The exact identity of the sole registered runtime. */
export const TOW_V1_RUNTIME_IDENTITY = Object.freeze({
  version: TOW_SESSION_VERSION,
  rulesetId: TOW_RULESET_ID,
});

function identityFields(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const versionDescriptor = Object.getOwnPropertyDescriptor(value, "version");
    const rulesetDescriptor = Object.getOwnPropertyDescriptor(value, "rulesetId");
    if (!versionDescriptor || !Object.hasOwn(versionDescriptor, "value")) return null;
    if (!rulesetDescriptor || !Object.hasOwn(rulesetDescriptor, "value")) return null;
    const version = versionDescriptor.value;
    const rulesetId = rulesetDescriptor.value;
    if (!Number.isSafeInteger(version) || version < 1) return null;
    if (typeof rulesetId !== "string" || rulesetId.length === 0) return null;
    return { version, rulesetId };
  } catch {
    return null;
  }
}

function isRetiredIdentity(identity) {
  return TOW_RETIRED_RUNTIME_IDENTITIES.some((retired) => (
    identity.version === retired.version && identity.rulesetId === retired.rulesetId
  ));
}

/**
 * Stable, collision-free key for one explicit runtime registration.
 *
 * This helper intentionally accepts a pair object rather than a whole encounter or ability
 * definition. Adding `{version: 2, rulesetId: "solitaire-tow-v2"}` later is a separate
 * registration and cannot be inferred from any v1 payload detail.
 */
export function towRuntimeRegistrationKey(identity) {
  const fields = identityFields(identity);
  return fields ? JSON.stringify([fields.version, fields.rulesetId]) : null;
}

/** Return an owned identity pair, or null when either selector is absent or malformed. */
export function towRuntimeIdentity(value) {
  const fields = identityFields(value);
  return fields ? Object.freeze(fields) : null;
}

const V1_RUNTIME = Object.freeze({
  identity: TOW_V1_RUNTIME_IDENTITY,
  create: createTowSession,
  decode: decodeTowSession,
  encode: encodeTowSession,
  dispatch: dispatchTowCommand,
  dispatchPlayerAction: dispatchTowPlayerAction,
  replay(session) {
    return replayTowCombatSession(session.genesis, session.commands);
  },
  verify(session) {
    const decoded = decodeTowSession(session);
    if (!decoded.ok) {
      return { ok: false, reason: decoded.reason, divergence: null };
    }
    return verifyTowSession(decoded.session);
  },
  sealTerminalReceipt: sealTowTerminalReceipt,
  events: towSessionEvents,
  worldFates(session) {
    return worldFatesByParticipant(session.terminalReceipt);
  },
  sequenceStream(session, name) {
    return TOW_SESSION_STREAMS.includes(name)
      ? streamSequencer(session.streams[name])
      : null;
  },
  settleEncounter(state, session, context) {
    return settleTowEncounter(state, session.encounter, context);
  },
  spendStream: spendTowSessionStream,
  markSettled: markTowSessionSettled,
});

// Keep registrations closed over this module. Runtime injection at call time would make a
// saved fight's claimed identity meaningless. A new ruleset is added as another explicit,
// reviewed entry alongside v1.
const RUNTIMES = new Map([
  [towRuntimeRegistrationKey(TOW_V1_RUNTIME_IDENTITY), V1_RUNTIME],
]);

/** Read-only registration metadata for diagnostics and future migration UI. */
export const TOW_RUNTIME_IDENTITIES = Object.freeze([TOW_V1_RUNTIME_IDENTITY]);

function route(value) {
  const identity = identityFields(value);
  if (!identity) {
    return {
      ok: false,
      reason: TOW_RUNTIME_REASONS.invalidIdentity,
      identity: null,
      runtime: null,
    };
  }
  const runtime = RUNTIMES.get(towRuntimeRegistrationKey(identity)) || null;
  if (!runtime && isRetiredIdentity(identity)) {
    return {
      ok: false,
      reason: TOW_RUNTIME_REASONS.legacyRuntime,
      identity: Object.freeze(identity),
      runtime: null,
    };
  }
  return runtime
    ? { ok: true, reason: null, identity: runtime.identity, runtime }
    : {
        ok: false,
        reason: TOW_RUNTIME_REASONS.unsupportedRuntime,
        identity: Object.freeze(identity),
        runtime: null,
      };
}

function verifiedRoute(value) {
  const routed = route(value);
  if (!routed.ok) return { ...routed, session: null };
  const decoded = routed.runtime.decode(value);
  if (!decoded.ok) {
    return { ...routed, ok: false, reason: decoded.reason, session: null };
  }
  const verified = routed.runtime.verify(decoded.session);
  if (!verified.ok) {
    return {
      ...routed,
      ok: false,
      reason: verified.reason,
      session: null,
      verification: verified,
    };
  }
  return { ...routed, session: decoded.session, verification: verified };
}

/** Whether this exact pair has an implementation; never guesses from nested payload data. */
export function supportsTowRuntime(value) {
  return route(value).ok;
}

/**
 * Create a session under an explicitly selected runtime.
 *
 * Keeping identity separate from input means runtime selectors never leak into or modify
 * the v1 creation payload. Callers must choose; omitting the pair is an objective failure.
 */
export function createTowRuntimeSession(identity, input = {}) {
  const routed = route(identity);
  if (!routed.ok) return { ok: false, reason: routed.reason, session: null };
  return routed.runtime.create(input);
}

export function decodeTowRuntimeSession(value) {
  const verified = verifiedRoute(value);
  return verified.ok
    ? { ok: true, reason: null, session: verified.session }
    : { ok: false, reason: verified.reason, session: null };
}

export function encodeTowRuntimeSession(session) {
  const verified = verifiedRoute(session);
  if (!verified.ok) return { ok: false, reason: verified.reason, payload: null };
  return verified.runtime.encode(verified.session);
}

function refusedDispatch(reason, session, playerAction = false) {
  return {
    ok: false,
    reason,
    session,
    command: null,
    events: [],
    duplicate: false,
    ...(playerAction ? { autoAdvanced: false, autoCommand: null } : {}),
  };
}

/** Low-level, exactly-once command dispatch retained for replay tools and tests. */
export function dispatchTowRuntimeCommand(session, input) {
  const verified = verifiedRoute(session);
  if (!verified.ok) return refusedDispatch(verified.reason, session);
  return verified.runtime.dispatch(verified.session, input);
}

/** App-facing dispatch, including the current v1 automatic enemy advance. */
export function dispatchTowRuntimePlayerAction(session, input) {
  const verified = verifiedRoute(session);
  if (!verified.ok) return refusedDispatch(verified.reason, session, true);
  return verified.runtime.dispatchPlayerAction(verified.session, input);
}

/** Replay a session's own genesis and command log under its exact registered runtime. */
export function replayTowRuntimeSession(session) {
  const routed = route(session);
  if (!routed.ok) {
    return {
      ok: false,
      reason: routed.reason,
      encounter: null,
      divergence: null,
      replayedCommands: 0,
    };
  }
  return routed.runtime.replay(session);
}

export function verifyTowRuntimeSession(session) {
  const verified = verifiedRoute(session);
  return verified.verification || (verified.ok
    ? { ok: true, reason: null, divergence: null }
    : { ok: false, reason: verified.reason, divergence: null });
}

/** Project the canonical event log without letting an unsupported session reach v1. */
export function towRuntimeSessionEvents(session) {
  const routed = route(session);
  if (!routed.ok) return { ok: false, reason: routed.reason, events: [] };
  return { ok: true, reason: null, events: routed.runtime.events(session) };
}

/** Read terminal participant fates from a session whose runtime identity was accepted. */
export function towRuntimeWorldFates(session) {
  const routed = route(session);
  if (!routed.ok) return { ok: false, reason: routed.reason, worldFates: {} };
  if (!session.terminalReceipt) {
    return { ok: false, reason: "missing-terminal-receipt", worldFates: {} };
  }
  return { ok: true, reason: null, worldFates: routed.runtime.worldFates(session) };
}

/**
 * Adapt one named session stream to the stateful random function expected by loot/rewards.
 * The sequencer itself stays unchanged; the session pair and stream name are checked before
 * its endpoint can be advanced through the matching runtime.
 */
export function createTowRuntimeStreamSequencer(session, name) {
  const verified = verifiedRoute(session);
  if (!verified.ok) return { ok: false, reason: verified.reason, sequencer: null };
  const sequencer = verified.runtime.sequenceStream(verified.session, name);
  if (!sequencer) {
    return { ok: false, reason: "unknown-session-stream", sequencer: null };
  }
  return {
    ok: true,
    reason: null,
    sequencer,
  };
}

/** Attach the terminal outcome receipt; checksum sealing remains an implementation detail. */
export function sealTowRuntimeTerminalReceipt(session) {
  const verified = verifiedRoute(session);
  if (!verified.ok) return { ok: false, reason: verified.reason, session };
  return verified.runtime.sealTerminalReceipt(verified.session);
}

/**
 * Fold the terminal encounter into campaign state.
 *
 * This deliberately does not mark the session settled. The App spends the deterministic
 * loot/reward streams after campaign folding and only then closes the durable session.
 */
export function settleTowRuntimeEncounter(state, session) {
  const verified = verifiedRoute(session);
  if (!verified.ok) {
    return {
      ok: false,
      reason: verified.reason,
      state,
      receipt: null,
      duplicate: false,
    };
  }
  const ownedSession = verified.session;
  if (ownedSession.mode !== "campaign") {
    return {
      ok: false,
      reason: "campaign-session-required",
      state,
      receipt: null,
      duplicate: false,
    };
  }
  if (state?.mechanics?.campaignId !== ownedSession.context.campaignId) {
    return {
      ok: false,
      reason: "tow-campaign-identity-mismatch",
      state,
      receipt: null,
      duplicate: false,
    };
  }
  if (state?.mechanics?.campaignRevision !== ownedSession.context.campaignRevision) {
    return {
      ok: false,
      reason: "tow-campaign-revision-mismatch",
      state,
      receipt: null,
      duplicate: false,
    };
  }
  if (!ownedSession.terminalReceipt) {
    return {
      ok: false,
      reason: "missing-terminal-receipt",
      state,
      receipt: null,
      duplicate: false,
    };
  }
  return verified.runtime.settleEncounter(
    state,
    ownedSession,
    towSettlementContextForSession(ownedSession),
  );
}

export function spendTowRuntimeSessionStream(session, name, endpoint) {
  const verified = verifiedRoute(session);
  if (!verified.ok) return { ok: false, reason: verified.reason, session };
  return verified.runtime.spendStream(verified.session, name, endpoint);
}

export function markTowRuntimeSessionSettled(session, settlementId) {
  const verified = verifiedRoute(session);
  if (!verified.ok) return { ok: false, reason: verified.reason, session };
  return verified.runtime.markSettled(verified.session, settlementId);
}
