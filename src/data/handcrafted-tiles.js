// Whitemarch — the walled capital, the only handcrafted place on the map. The
// world was wiped to a clean slate (no rumored/fabled landmarks, no rivers) and
// rebuilt around this one city at the origin; everything beyond the wall falls
// through to procedural generation (see world.js getTile). The rich Mirecross
// original is preserved in handcrafted-tiles.legacy.js (not imported).
//
// This is the "reduced first pass" of docs/region-planning/WHITEMARCH_FIRST_PASS_TILES.md
// (and WHITEMARCH_CITY.md): ~20 district hexes that make the city legible from
// the first step — walls, trade, slavery, law, army, grain, faith, foreign
// contact, prison/custody, and the undercity all present. The player starts
// INSIDE, at Grain Square in the heart of the Grand Market.
//
// Coordinates are axial (pointy-top hex), ~250m each, anchored at (0,0) = Grain
// Square. Multi-hex places (the Grand Market, the Crown Gate gatehouse, the
// Citadel) are authored as footprints — adjacent member hexes sharing a `parent`
// so the map draws them as one place (one icon, one name on select) while each
// hex keeps its own access and detail. Walls/gates are authored in
// data/sealed-structures.js; the auto-application at the bottom of this file
// compiles them into the `doors` graph the engine enforces (world.js
// edgeAllowed / findPath) and the map draws as walls.

import { SEALED_STRUCTURES } from "./sealed-structures.js";

const HEX_DIRS = [
  { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 },
];

// ---- Footprint parents (multi-hex places that read as one) ----
const CROWN_GATE = {
  parent: "whitemarch-crown-gate",
  parentName: "The Crown Gate",
  type: "gate",
};
const GRAND_MARKET = {
  parent: "whitemarch-grand-market",
  parentName: "The Grand Market",
  type: "market",
};
const CITADEL = {
  parent: "whitemarch-citadel",
  parentName: "The Citadel",
};

export const HANDCRAFTED = {
  // ============================================================
  // CROWN GATE WARD — the only way through the Great Wall. The Approach lies
  // OUTSIDE the wall; the gatehouse (Toll Hall + Inspection Yard) is the gate.
  // ============================================================
  "0,-3": { terrain: "road", poi: { type: "gate", name: "Crown Road Approach", access: "public", description: "The road widens into trampled stone before Whitemarch's wall. Carts wait in ranked lines, oxen steaming; pilgrims sleep against bundles. The gate-towers rise black and white through the chimney smoke, signal-bells hung under iron roofs, and Road Wardens watch the queue long before any official does." } },
  "0,-2": { terrain: "settlement", poi: { ...CROWN_GATE, part: "toll-hall", partName: "Toll Hall", name: "The Crown Gate", access: "conditional", description: "A long stone throat beneath the gatehouse. Clerks sit behind barred counters, ledgers chained to the desks; every stamp echoes and every coin is bitten or weighed while guards keep pike-points low enough to remind the crowd that patience is cheaper than injury. Separate counters sort guild, citizen, foreigner, livestock, and bonded traffic." } },
  "0,-1": { terrain: "settlement", poi: { ...CROWN_GATE, part: "inspection-yard", partName: "Inspection Yard", name: "The Crown Gate", access: "conditional", description: "The yard stinks of wet wool, dung, oilcloth, and fear. Soldiers prod wagon-beds with hooked rods, a bored scribe reads seals aloud, and travellers stand apart from their belongings while dogs nose the seams and a gate sergeant decides whose delay will ruin the day." } },

  // ============================================================
  // WALL COMMAND — the dragon-watch atop the Great Wall.
  // ============================================================
  "1,-2": { terrain: "indoor", poi: { type: "tower", name: "Dragon-Watch Tower", access: "restricted", description: "The tower smells of oil, cold iron, and old smoke. Harpoon-frames point through open shutters; signal-mirrors hang under wool covers. On the central rack rests a bolt as long as a man, its head blackened by an alchemy no one in the room jokes about. Veteran watchers look north, where every clear sky is treated as a question." } },

  // ============================================================
  // GRAND MARKET — the city's heart and the player's start. One footprint of
  // four merged stalls-squares; freely walked, never walled.
  // ============================================================
  "0,0":  { terrain: "settlement", poi: { ...GRAND_MARKET, part: "grain-square", partName: "Grain Square", name: "The Grand Market", service: "market", access: "public", description: "Noise given stone. Flour dust drifts from sacks stacked taller than children; bakers argue quotas under guard eyes, farmers curse the weighers, and money-changers click brass pans at the square's quiet corner. Every crowd watches the bins with the private arithmetic of hunger. This is the city's civilian crossroads — and where you stand now." } },
  "1,0":  { terrain: "settlement", poi: { ...GRAND_MARKET, part: "butchers-row", partName: "Butchers' Row", name: "The Grand Market", access: "public", description: "The row runs red by noon however often the apprentices throw water. Meat-hooks creak under awnings, dogs nose the gutters until kicked, and a city inspector chalks carcasses while customers judge freshness by smell, price, and how hungry they will admit to being." } },
  "0,1":  { terrain: "settlement", poi: { ...GRAND_MARKET, part: "cloth-awnings", partName: "Cloth Awnings", name: "The Grand Market", access: "public", description: "Awnings turn the market light to stained colour — bolts of wool, linen, and foreign silk beside boot-stalls, knife-trays, charm-strings, lamp-oil, and patched cloaks. Peddlers' voices are trained to find the coin in any passer-by, and pickpockets work the awning-shadows." } },
  "1,-1": { terrain: "settlement", poi: { ...GRAND_MARKET, part: "night-market", partName: "Night Market", name: "The Grand Market", access: "unofficial", description: "By day only overflow and shuttered backs; by night the lamps are hooded, the stalls fold open, and the city sells what it denies owning — stolen tools, false papers, unlicensed charms, names, routes, poisons, and questions that cost extra if answered honestly. Lookouts watch for a Market Watch sweep." } },

  // ============================================================
  // CARAVAN YARDS / GREAT STABLE — gate traffic and mounts.
  // ============================================================
  "-1,-1": { terrain: "settlement", poi: { type: "yard", name: "Caravan Yard & Stable", service: "stable", access: "public", description: "A fenced acre of mud, canvas, and languages shouted over animals. Drivers cook beside their loads; guards sleep with boots on. A hiring-board under a rain-hood is pinned with work, lies, and one bloodstained scrap nobody has taken down. Past the wagon-lines the stable runs hot — horses under striped blankets, mules biting the rails, a farrier burning hoof in blue smoke, and a military remount-pen behind a locked rail." } },

  // ============================================================
  // RIVER DOCKS — the customs landing on the Whitewend.
  // ============================================================
  "2,-1": { terrain: "settlement", poi: { type: "dock", name: "High Quay", access: "public", description: "The quay stands above brown water on stone piles dark with tar. Barges crowd the cranes; customs officers work beneath armed awnings while dock-gangs haul sacks in rhythm, each man watching the tally-stick more closely than the river. The chain-tower shows downstream, and smuggler-stairs are never far." } },
  "3,-1": { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The broad brown river that feeds Whitemarch — barges, customs-chains, and a current that has carried more than cargo out of the city." } },
  "3,-2": { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend, running fast past the quays. Cold, deep, and patrolled where the chain-tower can see." } },
  "2,-2": { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "A backwater of the Whitewend below the wall, slick with tar and river-weed." } },

  // ============================================================
  // IRON QUARTER — public forges and the smoke of the state foundries.
  // ============================================================
  "-1,0": { terrain: "indoor", poi: { type: "smithy", name: "Public Smith Row", service: "blacksmith", access: "public", description: "The row rings from dawn to curfew; sparks skitter across wet stone and guild-marks hang above each forge. Behind the open shops, higher chimneys mark the state foundries where no customer is allowed to ask what is being cast." } },

  // ============================================================
  // GUILDHALL ROW — licenses, craft disputes, apprenticeship law.
  // ============================================================
  "-1,1": { terrain: "indoor", poi: { type: "court", name: "Guild Court", access: "conditional", description: "Polished slate, ringed by doors that cost more than village houses. Masters sit beneath painted tools and speak of honour while clerks record fines large enough to starve anyone who works without their leave." } },

  // ============================================================
  // FOREIGN QUARTER — compounds, interpreters, treaty houses.
  // ============================================================
  "-2,1": { terrain: "settlement", poi: { type: "town", name: "Embassy Lane", access: "conditional", description: "The lane smells of unfamiliar tea, horse-sweat, and incense. Flags of distant courts hang beside Whitemarch seals; interpreters walk faster than soldiers, and every compound gate has someone watching from both sides. A treaty-inn, a foreign counting-house, and one quiet hostage-residence stand along it." } },

  // ============================================================
  // CHAIN WARD — the public sale-yard and the registry that feeds it.
  // ============================================================
  "1,1": { terrain: "settlement", poi: { type: "slavemarket", name: "Chain Market Steps", service: "slavemarket", access: "guarded", description: "Paved in pale stone so stains show quickly and wash before the next bell. Status-criers stand on a raised platform; buyers wait under awnings. At the petition-rail families press papers through the bars while guards keep their faces toward the crowd. It is run as civic routine — and the horror is in how ordinary it looks." } },
  "2,1": { terrain: "indoor", poi: { type: "hall", name: "Registry Hall", access: "conditional", description: "Quieter than the market and worse for it. Shelves of bound status-rolls climb into the gloom; clerks shift brass weights from name to name. A mural shows Whitemarch raising a wall; below it, people argue whether a seal makes someone free. Public counters open; the collar-archive and recovery-writ office stay barred behind armed Flesh Wardens." } },

  // ============================================================
  // LOW WARDS — dense common housing, labour pools, hiding places.
  // ============================================================
  "0,2": { terrain: "settlement", poi: { type: "town", name: "Tenement Row", access: "public", description: "Timber, plaster, laundry-rope and smoke leaning over itself. Every window has a face until you look at it directly. A public pump knocks in the courtyard, roof-bridges cross overhead, and someone has chalked three different warnings beside the same alley-mouth." } },

  // ============================================================
  // OLD CITY UNDERWORKS — the hidden descent. Sealed off the street (doors:[]);
  // entry is by action, not by a casual road (the narrator opens it).
  // ============================================================
  "1,2": { terrain: "indoor", doors: [], poi: { type: "sewer", name: "Sewer Mouth", access: "hidden", description: "A rusted grate below the Low Wards, half-hidden by broken baskets and old ash. Warm stink breathes from the dark; fresh arrows are scratched into the brick beside older marks that read less like directions than warnings. No casual road leads down — only those who know the way, or force it, go below." } },

  // ============================================================
  // COURT HILL — the public approach to the charter courts.
  // ============================================================
  "-1,2": { terrain: "settlement", poi: { type: "hall", name: "Lower Petition Steps", access: "public", description: "Crowded from sunrise: widows with petitions, debtors with sponsors, merchants with sealed cases, foreigners with interpreters, and soldiers escorting people who learned too late that law moves faster than mercy. The advocate-cloister stands above; debt-collectors wait below." } },

  // ============================================================
  // GRAIN WARD — guarded stores and the politics of bread.
  // ============================================================
  "-2,2": { terrain: "indoor", poi: { type: "granary", name: "Granary Court", access: "guarded", description: "It smells of flour, mouse-poison, and soldier-oil. Tall bins stand behind barred galleries; bakers argue quotas at one window while guards watch the crowd count sacks with the hungry arithmetic of people who know exactly how thin bread can get. The emergency seals are set early this year." } },

  // ============================================================
  // PRISON & WORKHOUSE — the custody threshold, hard by the courts and grain.
  // ============================================================
  "-2,3": { terrain: "indoor", poi: { type: "prison", name: "Prison Gate", service: "gaol", access: "restricted", description: "No ornament but old nail-scars. Intake clerks sort names under a lantern that burns all day; the chain-room waits behind, and the work-gangs leave by the side-arch before dawn and return at dusk, counted twice — once by the gaolers, once by the Registry man. Families wait at the rail with food." } },

  // ============================================================
  // TEMPLE STEPS — oaths, sanctuary, and the hospital cloister. Faces the
  // Citadel's Inner Gate (the high city is entered from beside the temple).
  // ============================================================
  "-1,3": { terrain: "settlement", poi: { type: "temple", name: "Great Oath Steps", service: "healer", access: "public", description: "Steps worn hollow by knees and court-shoes alike. Priests mark contracts with ash, oil, blood, or salt by the god invoked; hospital bells ring from the cloister below, and petitioners wait where temple shade meets city law. Sanctuary here is real but never freedom from the law." } },

  // ============================================================
  // CITADEL WARD — the high city behind the High Wall. One footprint reachable
  // ONLY through the Inner Gate (see sealed-structures.js).
  // ============================================================
  "0,3": { terrain: "settlement", poi: { ...CITADEL, part: "inner-gate", partName: "Inner Gate", name: "The Citadel", type: "gate", access: "restricted", description: "Smaller than the Crown Gate and harder to pass — older stones, quieter guards, cleaner hinges. Beyond the bars the city noise drops into courtyards where messengers run, officers wait, and every door has a second guard behind it. None pass without a permit." } },
  "0,4": { terrain: "settlement", poi: { ...CITADEL, part: "council-hall", partName: "The Iron Palace", name: "The Citadel", type: "city", access: "restricted", description: "The Iron Palace at the city's centre — outer hall, ledger-gallery, and the council room where the Lord-Treasurer reads the city's accounts. The iron-shilling is good because it is said to be good here. War-banners hang in the cold air; the only way in or out is the Inner Gate." } },
};

// Auto-apply `doors` to sealed structures (see world.js edgeAllowed / findPath:
// the engine blocks crossing any edge to a hex not in a tile's door list). Two
// authoring shapes are supported (see data/sealed-structures.js):
//
//   - interior + gates (+ legacy threshold): every interior hex opens to all of
//     its in-area neighbours (a fully-connected interior); every edge OUT of the
//     area is a wall except the `gates` (an interior hex additionally opens to
//     its paired outside hex). A `threshold` hex, if given, keeps default-open
//     doors. Good for walled cities, wards, and dungeons.
//
//   - entry + outside + links: a building/compound whose interior connectivity
//     is an explicit graph. Each hex opens ONLY to its linked neighbours, and the
//     entry hex additionally opens to its `outside` street hex.
//
// Structures are applied in array order; later structures overwrite the doors of
// hexes they touch (so a mesh area can be re-sealed by a nested linked compound).
function setDoors(key, doors) {
  const tile = HANDCRAFTED[key];
  if (!tile) return; // soft-fail: structure-list out of sync with tiles
  HANDCRAFTED[key] = { ...tile, doors };
}

function adjacentHex(a, b) {
  return HEX_DIRS.some((d) => a.x + d.x === b.x && a.y + d.y === b.y);
}

function applyMeshDoors(s) {
  const threshold = s.threshold || [];
  const all = new Set([...threshold, ...s.interior].map((c) => `${c.x},${c.y}`));
  // Gates: an interior hex that additionally opens to a paired OUTSIDE hex (the
  // wall's opening). The outside hex keeps its own default-open doors.
  const gateDoors = new Map(); // interiorKey -> [{x,y} outside]
  for (const [inside, outside] of s.gates || []) {
    if (!adjacentHex(inside, outside)) {
      throw new Error(`Structure "${s.name}": gate ${inside.x},${inside.y} <-> ${outside.x},${outside.y} is not between adjacent hexes`);
    }
    const k = `${inside.x},${inside.y}`;
    if (!gateDoors.has(k)) gateDoors.set(k, []);
    gateDoors.get(k).push({ x: outside.x, y: outside.y });
  }
  for (const c of s.interior) {
    const doors = [];
    for (const d of HEX_DIRS) {
      const nk = `${c.x + d.x},${c.y + d.y}`;
      if (all.has(nk)) doors.push({ x: c.x + d.x, y: c.y + d.y });
    }
    const k = `${c.x},${c.y}`;
    if (gateDoors.has(k)) doors.push(...gateDoors.get(k));
    setDoors(k, doors);
  }
}

function applyLinkedDoors(s) {
  const doorsByKey = new Map(); // key -> Map(neighbourKey -> {x,y})
  const link = (a, b) => {
    if (!adjacentHex(a, b)) {
      throw new Error(`Footprint "${s.name}": link ${a.x},${a.y} <-> ${b.x},${b.y} is not between adjacent hexes`);
    }
    const ka = `${a.x},${a.y}`;
    if (!doorsByKey.has(ka)) doorsByKey.set(ka, new Map());
    doorsByKey.get(ka).set(`${b.x},${b.y}`, { x: b.x, y: b.y });
  };
  for (const [a, b] of s.links) { link(a, b); link(b, a); }
  if (s.entry && s.outside) link(s.entry, s.outside); // the door out to the street

  // Connectivity guard: every member hex must be reachable from the entry
  // through the link graph (the outside street hex is not a member).
  const outsideKey = s.outside ? `${s.outside.x},${s.outside.y}` : null;
  const members = new Set([...doorsByKey.keys()].filter((k) => k !== outsideKey));
  if (s.entry) {
    const start = `${s.entry.x},${s.entry.y}`;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      for (const nb of (doorsByKey.get(stack.pop())?.keys() || [])) {
        if (members.has(nb) && !seen.has(nb)) { seen.add(nb); stack.push(nb); }
      }
    }
    for (const m of members) {
      if (!seen.has(m)) throw new Error(`Footprint "${s.name}": ${m} is not reachable from the entry`);
    }
  }

  // Convention guard: a building/compound entry must open onto a walkable street
  // (a road or a settlement street), not an indoor hall or open water.
  const outsideTerrain = outsideKey ? HANDCRAFTED[outsideKey]?.terrain : null;
  if (outsideKey && outsideTerrain !== "road" && outsideTerrain !== "settlement") {
    console.warn(`Footprint "${s.name}": entry opens onto ${outsideKey}, which is not a street hex`);
  }

  for (const [key, nbs] of doorsByKey) {
    if (key === outsideKey) continue; // the street keeps its default-open doors
    setDoors(key, [...nbs.values()]);
  }
}

for (const s of SEALED_STRUCTURES) {
  if (s.links) applyLinkedDoors(s);
  else applyMeshDoors(s);
}
