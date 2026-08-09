export const REFERENCE_POLICY = Object.freeze({
  id: "tow-1.4.16-public-evidence-v1",
  turnOrder: Object.freeze([
    "declare-enemy-intent",
    "player-command",
    "resolve-enemy-intent",
    "declare-next-intent",
  ]),
  damage: Object.freeze({
    attackStatMultiplier: 1,
    basicAttackVariance: Object.freeze({ min: 0, max: 2 }),
    evidence: "inferred",
  }),
});
