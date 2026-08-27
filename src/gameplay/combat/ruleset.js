// Cycle-free ruleset identity shared by descriptive profiles, sessions, and replay routing.
// Authoritative modules may import this leaf without pulling the encounter/session graph back
// into themselves.

// Session shape remains v1. Rules identities change whenever the reducer changes a
// deterministic outcome; retired pairs remain recognizable but never execute under current
// mechanics.
export const COMBAT_LEGACY_V1_SESSION_VERSION = 1;
export const COMBAT_LEGACY_V1_RULESET_ID = "solitaire-combat-v1";
export const COMBAT_LEGACY_V1_1_RULESET_ID = "solitaire-combat-v1.1";
export const COMBAT_LEGACY_V1_2_RULESET_ID = "solitaire-combat-v1.2";
export const COMBAT_SESSION_VERSION = 1;
export const COMBAT_RULESET_ID = "solitaire-combat-v1.3";

export const COMBAT_RETIRED_RUNTIME_IDENTITIES = Object.freeze([
  Object.freeze({
    version: COMBAT_LEGACY_V1_SESSION_VERSION,
    rulesetId: COMBAT_LEGACY_V1_RULESET_ID,
  }),
  Object.freeze({
    version: COMBAT_LEGACY_V1_SESSION_VERSION,
    rulesetId: COMBAT_LEGACY_V1_1_RULESET_ID,
  }),
  Object.freeze({
    version: COMBAT_LEGACY_V1_SESSION_VERSION,
    rulesetId: COMBAT_LEGACY_V1_2_RULESET_ID,
  }),
]);
