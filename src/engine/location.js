export function coordKey(x, y) {
  return `${x},${y}`;
}

export function titleFromId(id) {
  if (!id || typeof id !== "string") return null;
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const DEFAULT_SECTIONS_BY_TYPE = {
  inn: [
    { id: "common-room", name: "Common Room", access: "public", description: "The public room: benches, tables, drink, gossip, and witnesses." },
    { id: "counter", name: "Counter", access: "public", description: "The keeper's reach: coin, keys, food, and answers priced by mood." },
    { id: "guest-room", name: "Guest Room", access: "guarded", description: "Rented sleeping space, private enough for secrets and watched enough for theft." },
    { id: "cellar-or-yard", name: "Cellar Or Yard", access: "restricted", description: "The working back of the house, where stores, ledgers, and trouble are kept." },
  ],
  tavern: [
    { id: "common-room", name: "Common Room", access: "public", description: "The public room: benches, tables, drink, gossip, and witnesses." },
    { id: "bar", name: "Bar", access: "public", description: "The counter, till board, keys, and the keeper's command of the room." },
    { id: "hearth-corner", name: "Hearth Corner", access: "public", description: "A warmer, quieter corner for close talk." },
    { id: "cellar", name: "Cellar", access: "restricted", description: "Stores, barrels, and the place nobody enters by accident." },
  ],
  stable: [
    { id: "stall-row", name: "Stall Row", access: "public", description: "Stalls, straw, restless hooves, and handlers measuring strangers." },
    { id: "yard", name: "Yard", access: "public", description: "The working yard for hitching, loading, watering, and bargaining." },
    { id: "fodder-loft", name: "Fodder Loft", access: "guarded", description: "Feed, ladders, dust, and a useful place to hide the wrong thing." },
    { id: "tack-room", name: "Tack Room", access: "guarded", description: "Saddles, harness, bags, locks, and tools." },
  ],
  healer: [
    { id: "front-room", name: "Front Room", access: "public", description: "The receiving room for aches, blood, payment, and bad news." },
    { id: "treatment-cot", name: "Treatment Cot", access: "guarded", description: "A cot, clean cloth, bitter medicines, and practiced hands." },
    { id: "herb-shelves", name: "Herb Shelves", access: "guarded", description: "Drying bundles, jars, labels, and things not meant for idle fingers." },
    { id: "back-room", name: "Back Room", access: "restricted", description: "Private stores, notes, strong remedies, and whatever the healer keeps from customers." },
  ],
  apothecary: [
    { id: "counter", name: "Counter", access: "public", description: "The public counter where remedies become prices." },
    { id: "mixing-bench", name: "Mixing Bench", access: "guarded", description: "Mortars, scales, sharp smells, and half-finished doses." },
    { id: "drying-racks", name: "Drying Racks", access: "guarded", description: "Bundles, roots, waxed tags, and careful shade." },
    { id: "locked-cabinet", name: "Locked Cabinet", access: "restricted", description: "Poisons, narcotics, rare cures, and official trouble." },
  ],
  smithy: [
    { id: "forge-floor", name: "Forge Floor", access: "public", description: "Heat, sparks, hammer-rhythm, and the smith's working authority." },
    { id: "sales-bench", name: "Sales Bench", access: "public", description: "Finished tools, weapons, repairs, and argument over price." },
    { id: "work-yard", name: "Work Yard", access: "guarded", description: "Fuel, scrap, quench tubs, apprentices, and heavy things underfoot." },
    { id: "locked-rack", name: "Locked Rack", access: "restricted", description: "Commissioned work, special stock, and pieces nobody should touch." },
  ],
  mill: [
    { id: "mill-floor", name: "Mill Floor", access: "public", description: "The working room: meal dust, turning gear, and hands kept away from teeth." },
    { id: "grain-bin", name: "Grain Bin", access: "guarded", description: "Stored sacks, tallies, rats, and accusations waiting for a bad harvest." },
    { id: "wheel-house", name: "Wheel House", access: "guarded", description: "The dangerous machinery room where water, wood, and stone do the work." },
    { id: "loft", name: "Loft", access: "restricted", description: "A dusty upper space for stores, sleep, or hiding." },
  ],
  shop: [
    { id: "shop-floor", name: "Shop Floor", access: "public", description: "Displayed goods, customers, and a keeper watching hands." },
    { id: "counter", name: "Counter", access: "public", description: "Coin, records, wrapping cloth, and the place business becomes binding." },
    { id: "workroom", name: "Workroom", access: "guarded", description: "Repairs, unfinished goods, tools, and the smell of the trade." },
    { id: "back-room", name: "Back Room", access: "restricted", description: "Private stock, ledgers, favors owed, and the better lock." },
  ],
  market: [
    { id: "front-stalls", name: "Front Stalls", access: "public", description: "The obvious trade: awnings, shouted prices, and hands moving coin." },
    { id: "weighing-place", name: "Weighing Place", access: "public", description: "Scales, measures, ledgers, and arguments over fairness." },
    { id: "back-awnings", name: "Back Awnings", access: "guarded", description: "Stall backs, storage crates, tired sellers, and quieter deals." },
  ],
  dock: [
    { id: "quay-edge", name: "Quay Edge", access: "public", description: "Water, ropes, gangplanks, and the danger of being jostled too close." },
    { id: "crane-line", name: "Crane Line", access: "guarded", description: "Cargo hooks, shouting crews, and loads that can kill by accident." },
    { id: "customs-awning", name: "Customs Awning", access: "guarded", description: "Tallies, wax seals, bored officers, and goods waiting to become legal." },
    { id: "lower-stairs", name: "Lower Stairs", access: "hidden", description: "Wet steps beneath the honest level of the quay." },
  ],
  yard: [
    { id: "open-yard", name: "Open Yard", access: "public", description: "The visible ground where crowds, carts, labor, and witnesses gather." },
    { id: "working-edge", name: "Working Edge", access: "guarded", description: "The side where tools, guards, animals, or ledgers make the place function." },
    { id: "back-gate", name: "Back Gate", access: "restricted", description: "A controlled way out, watched because it matters." },
  ],
  gate: [
    { id: "gate-arch", name: "Gate Arch", access: "public", description: "The main passage, loud with footsteps and authority." },
    { id: "guard-room", name: "Guard Room", access: "restricted", description: "Weapons, duty boards, spare cloaks, and people paid to ask questions." },
    { id: "wall-stair", name: "Wall Stair", access: "restricted", description: "A stair up into the defended bones of the place." },
  ],
  tower: [
    { id: "lower-room", name: "Lower Room", access: "guarded", description: "The working base of the tower: benches, stores, posted rules." },
    { id: "stair", name: "Stair", access: "guarded", description: "The vertical route where retreat and pursuit both narrow." },
    { id: "upper-platform", name: "Upper Platform", access: "restricted", description: "The high working level, wind-scoured and watched." },
  ],
  hall: [
    { id: "public-hall", name: "Public Hall", access: "public", description: "The room meant to be seen, judged, and remembered." },
    { id: "clerk-desk", name: "Clerk Desk", access: "guarded", description: "Records, seals, small delays, and large consequences." },
    { id: "back-office", name: "Back Office", access: "restricted", description: "Private decisions, better paper, and doors that close." },
  ],
  palace: [
    { id: "outer-hall", name: "Outer Hall", access: "guarded", description: "The official face: guards, messengers, petitioners, and polished restraint." },
    { id: "council-room", name: "Council Room", access: "restricted", description: "A room for decisions made before the public hears of them." },
    { id: "private-office", name: "Private Office", access: "restricted", description: "Ledgers, letters, and the ruler's quiet leverage." },
  ],
  fortress: [
    { id: "outer-court", name: "Outer Court", access: "guarded", description: "The controlled court where visitors become known quantities." },
    { id: "barracks", name: "Barracks", access: "restricted", description: "Bunks, kit, duty boards, and soldiers off the public face." },
    { id: "wall-stair", name: "Wall Stair", access: "restricted", description: "The route into the defended height of the place." },
    { id: "command-room", name: "Command Room", access: "restricted", description: "Maps, orders, signal records, and someone deciding what matters." },
  ],
  armoury: [
    { id: "issue-counter", name: "Issue Counter", access: "guarded", description: "The place where weapons leave as numbers before they leave as steel." },
    { id: "rack-room", name: "Rack Room", access: "restricted", description: "Rows of kept arms, oilcloth, labels, and careful counting." },
    { id: "repair-bench", name: "Repair Bench", access: "guarded", description: "Files, straps, cracked hafts, and work nobody calls glorious." },
    { id: "locked-cage", name: "Locked Cage", access: "sealed", description: "The dangerous stock behind a better lock." },
  ],
  armory: [
    { id: "issue-counter", name: "Issue Counter", access: "guarded", description: "The place where weapons leave as numbers before they leave as steel." },
    { id: "rack-room", name: "Rack Room", access: "restricted", description: "Rows of kept arms, oilcloth, labels, and careful counting." },
    { id: "repair-bench", name: "Repair Bench", access: "guarded", description: "Files, straps, cracked hafts, and work nobody calls glorious." },
    { id: "locked-cage", name: "Locked Cage", access: "sealed", description: "The dangerous stock behind a better lock." },
  ],
  gaol: [
    { id: "intake", name: "Intake", access: "guarded", description: "Names, charges, keys, and the first narrowing of options." },
    { id: "cells", name: "Cells", access: "restricted", description: "Stone, straw, iron, and voices keeping count of hope." },
    { id: "warden-desk", name: "Warden's Desk", access: "guarded", description: "Keys, boards, reward notices, and official appetite." },
    { id: "yard", name: "Yard", access: "restricted", description: "The watched outdoor space for labor, counting, and punishment." },
  ],
  prison: [
    { id: "intake", name: "Intake", access: "guarded", description: "Names, charges, keys, and the first narrowing of options." },
    { id: "cells", name: "Cells", access: "restricted", description: "Stone, straw, iron, and voices keeping count of hope." },
    { id: "warden-desk", name: "Warden's Desk", access: "guarded", description: "Keys, boards, reward notices, and official appetite." },
    { id: "yard", name: "Yard", access: "restricted", description: "The watched outdoor space for labor, counting, and punishment." },
  ],
  slavemarket: [
    { id: "sale-place", name: "Sale Place", access: "guarded", description: "The public legal face of a brutal trade." },
    { id: "petition-place", name: "Petition Place", access: "public", description: "Where papers, pleas, and official indifference meet." },
    { id: "holding-place", name: "Holding Place", access: "restricted", description: "The controlled space behind the public transaction." },
  ],
  cathedral: [
    { id: "nave", name: "Nave", access: "public", description: "The public sacred room, large enough for awe and politics." },
    { id: "altar-steps", name: "Altar Steps", access: "guarded", description: "The working edge of ritual, contracts, and authority." },
    { id: "cloister", name: "Cloister", access: "guarded", description: "Side passages, quiet offices, and those who keep the place running." },
    { id: "bell-or-vault", name: "Bell Or Vault", access: "restricted", description: "The part reached by permission, trust, or trespass." },
  ],
  temple: [
    { id: "public-altar", name: "Public Altar", access: "public", description: "The visible holy place, open to prayer and performance." },
    { id: "scribe-table", name: "Scribe Table", access: "public", description: "Oaths, names, offerings, and records." },
    { id: "side-room", name: "Side Room", access: "guarded", description: "Vestments, medicines, private petitions, and small mercies." },
  ],
  granary: [
    { id: "ration-window", name: "Ration Window", access: "public", description: "The counter where hunger learns procedure." },
    { id: "bin-gallery", name: "Bin Gallery", access: "guarded", description: "Barred galleries overlooking stored grain." },
    { id: "seal-room", name: "Seal Room", access: "restricted", description: "Emergency marks, keys, tallies, and the power to open food." },
  ],
};

export function poiSections(poi) {
  const sections = poi?.sections;
  if (sections === false || poi?.singleRoom) return [];
  if (!sections) return DEFAULT_SECTIONS_BY_TYPE[String(poi?.type || "").toLowerCase()] || [];
  if (Array.isArray(sections)) {
    return sections
      .map((section, i) => ({ id: section?.id || `section-${i}`, ...(section || {}) }))
      .filter((section) => section && (section.name || section.id));
  }
  if (typeof sections === "object") {
    return Object.entries(sections)
      .map(([id, section]) => ({ id, ...(section || {}) }))
      .filter((section) => section && (section.name || section.id));
  }
  return DEFAULT_SECTIONS_BY_TYPE[String(poi?.type || "").toLowerCase()] || [];
}

export function sectionById(poi, sectionId) {
  if (!sectionId) return null;
  return poiSections(poi).find((section) => section.id === sectionId) || null;
}

export function sectionName(section) {
  if (!section) return null;
  return section.name || titleFromId(section.id) || section.id || null;
}

export function sectionAutoEnterAllowed(section) {
  const access = String(section?.access || "public").toLowerCase();
  return access !== "restricted" && access !== "sealed" && access !== "hidden";
}

export function currentSectionEntry(state, tile) {
  const sectionState = state?.world?.currentSection;
  if (!sectionState || !tile?.poi) return null;
  const here = state?.world?.currentTile;
  if (!here) return null;
  const hereKey = coordKey(here.x, here.y);
  const sectionTileKey = typeof sectionState === "string" ? hereKey : sectionState.tileKey;
  if (sectionTileKey !== hereKey) return null;
  const sectionId = typeof sectionState === "string" ? sectionState : sectionState.sectionId;
  return sectionById(tile.poi, sectionId);
}

export function poiMeta(tile, currentName = null) {
  const poi = tile?.poi;
  if (!poi) return { area: null, district: null, access: null, sections: null };
  const explicitArea = poi.areaName || titleFromId(poi.area);
  const area = explicitArea || (poi.parentName && poi.parentName !== currentName ? poi.parentName : null);
  const district = poi.districtName || titleFromId(poi.district);
  const access = titleFromId(poi.access);
  const sections = poiSections(poi);
  let sectionText = null;
  if (sections.length) {
    const names = sections.map((section) => sectionName(section));
    const shown = names.slice(0, 3).join(", ");
    sectionText = `${sections.length} section${sections.length === 1 ? "" : "s"}${shown ? `: ${shown}${names.length > 3 ? "..." : ""}` : ""}`;
  }
  return { area, district, access, sections: sectionText };
}
