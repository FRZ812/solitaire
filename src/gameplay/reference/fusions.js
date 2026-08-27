import { REFERENCE_POLICY } from "./policy.js";

const KNIGHT_GUIDE_SOURCE = Object.freeze({
  confidence: "secondary",
  date: "2023-09-12",
  version: "version-sensitive",
  url: "https://gall.dcinside.com/mgallery/board/view/?id=combat&no=5666",
});

export const STEELIFICATION = Object.freeze({
  id: "steelification",
  name: "Steelification",
  requirements: REFERENCE_POLICY.fusions.steelification.requirements,
  thresholdConfidence: REFERENCE_POLICY.fusions.steelification.thresholdEvidence,
  evidence: KNIGHT_GUIDE_SOURCE,
});

const FUSIONS = Object.freeze({
  [STEELIFICATION.id]: STEELIFICATION,
});

export function activeReferenceFusions(traits) {
  return Object.values(FUSIONS)
    .filter((fusion) => Object.entries(fusion.requirements).every(
      ([traitId, threshold]) => {
        const descriptor = Object.getOwnPropertyDescriptor(traits, traitId);
        return descriptor
          && "value" in descriptor
          && typeof descriptor.value === "number"
          && Number.isFinite(descriptor.value)
          && descriptor.value >= threshold;
      },
    ))
    .map((fusion) => fusion.id);
}

export function referenceFusions() {
  return Object.values(FUSIONS);
}
