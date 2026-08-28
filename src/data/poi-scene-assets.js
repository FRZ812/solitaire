import marketA from "../assets/generated/poi-scenes/poi-market-a.webp";
import marketB from "../assets/generated/poi-scenes/poi-market-b.webp";
import smithyA from "../assets/generated/poi-scenes/poi-smithy-a.webp";
import smithyB from "../assets/generated/poi-scenes/poi-smithy-b.webp";
import healerA from "../assets/generated/poi-scenes/poi-healer-a.webp";
import healerB from "../assets/generated/poi-scenes/poi-healer-b.webp";
import arcaneA from "../assets/generated/poi-scenes/poi-arcane-a.webp";
import arcaneB from "../assets/generated/poi-scenes/poi-arcane-b.webp";
import hospitalityA from "../assets/generated/poi-scenes/poi-hospitality-a.webp";
import hospitalityB from "../assets/generated/poi-scenes/poi-hospitality-b.webp";
import bathhouseA from "../assets/generated/poi-scenes/poi-bathhouse-a.webp";
import bathhouseB from "../assets/generated/poi-scenes/poi-bathhouse-b.webp";
import stableA from "../assets/generated/poi-scenes/poi-stable-a.webp";
import stableB from "../assets/generated/poi-scenes/poi-stable-b.webp";
import civicA from "../assets/generated/poi-scenes/poi-civic-a.webp";
import civicB from "../assets/generated/poi-scenes/poi-civic-b.webp";
import sacredA from "../assets/generated/poi-scenes/poi-sacred-a.webp";
import sacredB from "../assets/generated/poi-scenes/poi-sacred-b.webp";
import custodyA from "../assets/generated/poi-scenes/poi-custody-a.webp";
import custodyB from "../assets/generated/poi-scenes/poi-custody-b.webp";
import militaryA from "../assets/generated/poi-scenes/poi-military-a.webp";
import militaryB from "../assets/generated/poi-scenes/poi-military-b.webp";
import waterfrontA from "../assets/generated/poi-scenes/poi-waterfront-a.webp";
import waterfrontB from "../assets/generated/poi-scenes/poi-waterfront-b.webp";
import settlementA from "../assets/generated/poi-scenes/poi-settlement-a.webp";
import settlementB from "../assets/generated/poi-scenes/poi-settlement-b.webp";
import ruinA from "../assets/generated/poi-scenes/poi-ruin-a.webp";
import ruinB from "../assets/generated/poi-scenes/poi-ruin-b.webp";
import campA from "../assets/generated/poi-scenes/poi-camp-a.webp";
import campB from "../assets/generated/poi-scenes/poi-camp-b.webp";
import wonderA from "../assets/generated/poi-scenes/poi-wonder-a.webp";
import wonderB from "../assets/generated/poi-scenes/poi-wonder-b.webp";
import tierBudget from "../assets/generated/poi-scenes/poi-tier-budget.webp";
import tierStandard from "../assets/generated/poi-scenes/poi-tier-standard.webp";
import tierPremium from "../assets/generated/poi-scenes/poi-tier-premium.webp";
import tierNoble from "../assets/generated/poi-scenes/poi-tier-noble.webp";
import tierRoyal from "../assets/generated/poi-scenes/poi-tier-royal.webp";
import tierMastercraft from "../assets/generated/poi-scenes/poi-tier-mastercraft.webp";

// ImageGen-authored close scenes use the current daylight title art as their
// style anchor. Each family has two real compositions; stable hashing assigns a
// named POI one of them so revisiting a place never changes its room at random.
export const POI_SCENE_FAMILIES = Object.freeze({
  market: Object.freeze([marketA, marketB]),
  smithy: Object.freeze([smithyA, smithyB]),
  healer: Object.freeze([healerA, healerB]),
  arcane: Object.freeze([arcaneA, arcaneB]),
  hospitality: Object.freeze([hospitalityA, hospitalityB]),
  bathhouse: Object.freeze([bathhouseA, bathhouseB]),
  stable: Object.freeze([stableA, stableB]),
  civic: Object.freeze([civicA, civicB]),
  sacred: Object.freeze([sacredA, sacredB]),
  custody: Object.freeze([custodyA, custodyB]),
  military: Object.freeze([militaryA, militaryB]),
  waterfront: Object.freeze([waterfrontA, waterfrontB]),
  settlement: Object.freeze([settlementA, settlementB]),
  ruin: Object.freeze([ruinA, ruinB]),
  camp: Object.freeze([campA, campB]),
  wonder: Object.freeze([wonderA, wonderB]),
});

// These are abstract brush-and-light treatments rather than second rooms, so
// they can grade any venue without doubling its architecture. The venue's A/B
// base composition still gives every tier multiple concrete scene variants.
export const POI_TIER_TREATMENTS = Object.freeze({
  budget: Object.freeze({ image: tierBudget, opacity: 0.2 }),
  standard: Object.freeze({ image: tierStandard, opacity: 0.12 }),
  premium: Object.freeze({ image: tierPremium, opacity: 0.18 }),
  noble: Object.freeze({ image: tierNoble, opacity: 0.2 }),
  royal: Object.freeze({ image: tierRoyal, opacity: 0.16 }),
  mastercraft: Object.freeze({ image: tierMastercraft, opacity: 0.24 }),
});

const SERVICE_FAMILY = Object.freeze({
  apothecary: "healer",
  healer: "healer",
  herbalist: "healer",
  blacksmith: "smithy",
  farrier: "smithy",
  "carriage-wright": "smithy",
  cartwright: "smithy",
  cooper: "smithy",
  "leather-worker": "smithy",
  "royal-armourer": "smithy",
  "mastercraft-forge": "smithy",
  "magic-shop": "arcane",
  "royal-arcana": "arcane",
  "mastercraft-arcana": "arcane",
  tavern: "hospitality",
  inn: "hospitality",
  stable: "stable",
  gaol: "custody",
  slavemarket: "custody",
  "chapel-priest": "sacred",
  "oath-priest": "sacred",
  "wall-sergeant": "military",
  "noble-gate-guard": "military",
});

const TYPE_FAMILY = Object.freeze({
  market: "market",
  shop: "market",
  merchant: "market",
  smithy: "smithy",
  healer: "healer",
  apothecary: "healer",
  inn: "hospitality",
  tavern: "hospitality",
  restaurant: "hospitality",
  cookshop: "hospitality",
  brothel: "hospitality",
  bathhouse: "bathhouse",
  baths: "bathhouse",
  stable: "stable",
  archive: "civic",
  library: "civic",
  courthouse: "civic",
  registry: "civic",
  guildhall: "civic",
  temple: "sacred",
  shrine: "sacred",
  sanctuary: "sacred",
  monastery: "sacred",
  cemetery: "sacred",
  graveyard: "sacred",
  gaol: "custody",
  jail: "custody",
  prison: "custody",
  "slave-market": "custody",
  slavemarket: "custody",
  checkpoint: "military",
  fortress: "military",
  fort: "military",
  gate: "military",
  barracks: "military",
  watchpost: "military",
  spire: "military",
  palace: "military",
  castle: "military",
  dock: "waterfront",
  docks: "waterfront",
  port: "waterfront",
  harbor: "waterfront",
  harbour: "waterfront",
  warehouse: "waterfront",
  river: "waterfront",
  lake: "waterfront",
  city: "settlement",
  town: "settlement",
  village: "settlement",
  settlement: "settlement",
  hamlet: "settlement",
  ruin: "ruin",
  ruins: "ruin",
  dungeon: "ruin",
  cave: "ruin",
  cavern: "ruin",
  mine: "ruin",
  quarry: "ruin",
  tomb: "ruin",
  camp: "camp",
  campsite: "camp",
  caravan: "camp",
  caravanserai: "camp",
  landmark: "wonder",
  wonder: "wonder",
  park: "wonder",
  garden: "wonder",
  grove: "wonder",
  manor: "wonder",
  estate: "wonder",
  bridge: "wonder",
  ford: "wonder",
});

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function poiIdentity(poi) {
  return poi?.part
    || poi?.landmarkId
    || poi?.name
    || poi?.parent
    || poi?.service
    || poi?.type
    || "unnamed-poi";
}

export function poiSceneFamily(tile) {
  const poi = tile?.poi;
  if (!poi || poi.type === "hidden") return null;
  const service = String(poi.service || "").toLowerCase();
  if (SERVICE_FAMILY[service]) return SERVICE_FAMILY[service];
  const type = String(poi.type || "").toLowerCase();
  return TYPE_FAMILY[type] || "wonder";
}

export function poiSceneVisual(tile) {
  const family = poiSceneFamily(tile);
  if (!family) return null;
  const variants = POI_SCENE_FAMILIES[family];
  const identity = poiIdentity(tile.poi);
  const variantIndex = stableHash(identity) % variants.length;
  const tierId = POI_TIER_TREATMENTS[tile.poi.marketTier] ? tile.poi.marketTier : null;
  return {
    family,
    image: variants[variantIndex],
    variant: variantIndex === 0 ? "a" : "b",
    tierId,
    tier: tierId ? POI_TIER_TREATMENTS[tierId] : null,
  };
}
