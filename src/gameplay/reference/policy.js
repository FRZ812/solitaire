export const REFERENCE_POLICY = Object.freeze({
  id: "combat-1.4.16-public-evidence-v2",
  turnOrder: Object.freeze([
    "declare-enemy-intent",
    "player-command",
    "resolve-enemy-intent",
    "declare-next-intent",
  ]),
  turnOrderEvidence: "inferred-policy-gap",
  intentVisibilityEvidence: "inferred-policy-gap",
  skills: Object.freeze({
    loadoutCapacity: 3,
    loadoutCapacityEvidence: "inferred-policy-gap",
  }),
  damage: Object.freeze({
    attackStatMultiplier: 1,
    basicAttackVariance: Object.freeze({ min: 0, max: 2 }),
    evidence: "inferred",
  }),
  defense: Object.freeze({
    base: 3,
    defenseStatMultiplier: 1,
    expires: "after-next-enemy-intent",
    evidence: "inferred",
  }),
  rewards: Object.freeze({
    schemaVersion: 1,
    choiceCount: 3,
    choiceCountEvidence: "observed",
    freeRefreshCount: 1,
    freeRefreshCountEvidence: "inferred",
    selectionAlgorithm: "uniform-with-forced-refresh-change-v1",
    selectionAlgorithmEvidence: "inferred-policy-gap",
    weighting: null,
    weightingEvidence: "unresolved",
    eligibilityEvidence: "incomplete-catalogue",
  }),
  fusions: Object.freeze({
    steelification: Object.freeze({
      requirements: Object.freeze({ ironclad: 1, "force-field": 1 }),
      thresholdEvidence: "inferred",
      combatEffect: null,
      combatEffectEvidence: "unresolved",
    }),
  }),
});
