// Cycle-free ruleset identity shared by descriptive profiles, sessions, and replay routing.
// Authoritative modules may import this leaf without pulling the encounter/session graph back
// into themselves.

// Session shape remains v1. Rules identities change whenever the reducer changes a
// deterministic outcome; retired pairs remain recognizable but never execute under current
// mechanics.
export const TOW_LEGACY_V1_SESSION_VERSION = 1;
export const TOW_LEGACY_V1_RULESET_ID = "solitaire-tow-v1";
export const TOW_LEGACY_V1_1_RULESET_ID = "solitaire-tow-v1.1";
export const TOW_LEGACY_V1_2_RULESET_ID = "solitaire-tow-v1.2";
export const TOW_SESSION_VERSION = 1;
export const TOW_RULESET_ID = "solitaire-tow-v1.3";

export const TOW_RETIRED_RUNTIME_IDENTITIES = Object.freeze([
  Object.freeze({
    version: TOW_LEGACY_V1_SESSION_VERSION,
    rulesetId: TOW_LEGACY_V1_RULESET_ID,
  }),
  Object.freeze({
    version: TOW_LEGACY_V1_SESSION_VERSION,
    rulesetId: TOW_LEGACY_V1_1_RULESET_ID,
  }),
  Object.freeze({
    version: TOW_LEGACY_V1_SESSION_VERSION,
    rulesetId: TOW_LEGACY_V1_2_RULESET_ID,
  }),
]);
