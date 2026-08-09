const TOPOLOGY_EVIDENCE = Object.freeze({
  confidence: "inferred",
  sourceType: "structural-placeholder",
  capturedOn: "2026-08-09",
  observation: "The 12-position Act 1 route and final Gatekeeper boss gate are a mechanics-first vertical-slice topology; public parity capture remains required.",
});

const standardSteps = Array.from({ length: 11 }, (_, index) => Object.freeze({
  id: `arctic-knight-act-1-${index + 1}`,
  position: index + 1,
  totalPositions: 12,
  kind: "standard",
  bossGate: false,
  enemyId: null,
  contentConfidence: "gap",
}));

export const ARCTIC_KNIGHT_ACT_1 = Object.freeze({
  id: "arctic-knight-act-1",
  characterId: "arctic-knight",
  act: 1,
  steps: Object.freeze([
    ...standardSteps,
    Object.freeze({
      id: "arctic-knight-act-1-gatekeeper",
      position: 12,
      totalPositions: 12,
      kind: "boss",
      bossGate: true,
      enemyId: "gatekeeper",
      contentConfidence: "observed-identity-inferred-placement",
    }),
  ]),
  evidence: TOPOLOGY_EVIDENCE,
});

const ACTS = Object.freeze({
  [ARCTIC_KNIGHT_ACT_1.id]: ARCTIC_KNIGHT_ACT_1,
});

export function getReferenceAct(actId) {
  return typeof actId === "string" && Object.hasOwn(ACTS, actId) ? ACTS[actId] : null;
}
