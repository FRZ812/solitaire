const OFFICIAL_GATEKEEPER_SCREENSHOT = Object.freeze({
  fields: Object.freeze(["name", "maxHp"]),
  confidence: "observed",
  sourceType: "first-party-screenshot",
  sourceUrl: "https://play.google.com/store/apps/details?id=com.tailormadegames.combat",
  capturedOn: "2026-08-09",
  observation: "The Gatekeeper is shown at 60/60 HP.",
});

const INFERRED_INTENT_PATTERN = Object.freeze({
  fields: Object.freeze(["intentPatternId"]),
  confidence: "inferred",
  sourceType: "structural-placeholder",
  observation: "The public evidence does not establish the Gatekeeper's intent schedule or values.",
});

const GATEKEEPER_PATTERN_EVIDENCE = Object.freeze({
  fields: Object.freeze(["steps", "options", "damage"]),
  confidence: "inferred",
  sourceType: "structural-placeholder",
  observation: "Authored attacks exist to exercise deterministic intent selection; capture is required for parity.",
});

export const GATEKEEPER_INTENT_PATTERN = Object.freeze({
  id: "gatekeeper-reference-v1",
  steps: Object.freeze([
    Object.freeze({
      id: "opening",
      options: Object.freeze([
        Object.freeze({
          id: "gatekeeper-strike",
          type: "attack",
          target: "player",
          damage: Object.freeze({ min: 3, max: 3 }),
        }),
        Object.freeze({
          id: "gatekeeper-sweeping-strike",
          type: "attack",
          target: "player",
          damage: Object.freeze({ min: 2, max: 4 }),
        }),
      ]),
    }),
    Object.freeze({
      id: "pressure",
      options: Object.freeze([
        Object.freeze({
          id: "gatekeeper-heavy-strike",
          type: "attack",
          target: "player",
          damage: Object.freeze({ min: 4, max: 4 }),
        }),
        Object.freeze({
          id: "gatekeeper-guard-break",
          type: "attack",
          target: "player",
          damage: Object.freeze({ min: 3, max: 4 }),
        }),
      ]),
    }),
  ]),
  evidence: Object.freeze([GATEKEEPER_PATTERN_EVIDENCE]),
});

export const GATEKEEPER = Object.freeze({
  id: "gatekeeper",
  name: "The Gatekeeper",
  maxHp: 60,
  intentPatternId: GATEKEEPER_INTENT_PATTERN.id,
  evidence: Object.freeze([
    OFFICIAL_GATEKEEPER_SCREENSHOT,
    INFERRED_INTENT_PATTERN,
  ]),
});

const ENEMIES = Object.freeze({
  [GATEKEEPER.id]: GATEKEEPER,
});

const INTENT_PATTERNS = Object.freeze({
  [GATEKEEPER_INTENT_PATTERN.id]: GATEKEEPER_INTENT_PATTERN,
});

export function getReferenceEnemy(enemyId) {
  return typeof enemyId === "string" && Object.hasOwn(ENEMIES, enemyId)
    ? ENEMIES[enemyId]
    : null;
}

export function getReferenceIntentPattern(patternId) {
  return typeof patternId === "string" && Object.hasOwn(INTENT_PATTERNS, patternId)
    ? INTENT_PATTERNS[patternId]
    : null;
}
