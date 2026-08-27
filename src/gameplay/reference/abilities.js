const TRAIT_SOURCE = Object.freeze({
  confidence: "observed-and-secondary",
  captured: "2026-08-09",
  version: "1.4.16-public-evidence",
  urls: Object.freeze([
    "https://play.google.com/store/apps/details?id=com.tailormadegames.combat&hl=en&gl=US",
    "https://gall.dcinside.com/mgallery/board/view/?id=combat&no=5666",
  ]),
});

export const TRAIT_LEVEL_CAP = 7;

const TRAITS = Object.freeze(Object.fromEntries([
  ["ironclad", "Ironclad"],
  ["force-field", "Force Field"],
  ["swift", "Swift"],
  ["anatomy", "Anatomy"],
].map(([id, name]) => [id, Object.freeze({ id, name, levelCap: TRAIT_LEVEL_CAP, evidence: TRAIT_SOURCE })])));

export function getReferenceTrait(traitId) {
  return typeof traitId === "string" && Object.hasOwn(TRAITS, traitId) ? TRAITS[traitId] : null;
}

export function referenceTraits() {
  return Object.values(TRAITS);
}
