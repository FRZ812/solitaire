const OFFICIAL_STORE_SOURCE = Object.freeze({
  confidence: "observed-labels",
  captured: "2026-08-09",
  version: "1.4.16",
  url: "https://play.google.com/store/apps/details?id=com.tailormadegames.tow&hl=en&gl=US",
});

export const MITHRIL_HELM = Object.freeze({
  id: "mithril-helm",
  name: "Mithril Helm",
  statGrants: Object.freeze({ defense: 2 }),
  traitGrants: Object.freeze({ swift: 1, anatomy: 1 }),
  grantConfidence: Object.freeze({
    labels: "observed",
    magnitudes: "inferred-placeholder",
  }),
  evidence: OFFICIAL_STORE_SOURCE,
});

const ITEMS = Object.freeze({
  [MITHRIL_HELM.id]: MITHRIL_HELM,
});

export function getReferenceItem(itemId) {
  return typeof itemId === "string" && Object.hasOwn(ITEMS, itemId) ? ITEMS[itemId] : null;
}

export function referenceItems() {
  return Object.values(ITEMS);
}
