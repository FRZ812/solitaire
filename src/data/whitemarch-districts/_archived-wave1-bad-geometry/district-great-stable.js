// Great Stable — the city's ground-speed economy in the NW corner. Horses,
// mules, oxen, courier beasts, foreign mounts, military remounts, fodder
// contracts, farriers, and stable politics. The bible files it as a discrete
// district, but the Caravan Yard & Stable footprint (parent
// "whitemarch-caravan-yard") IS the public face of the Great Stable — caravans
// and the public mount-trade share one yard. So we extend the existing parent
// slug rather than introduce a second one; the trade buttons keep working and
// the player's [LOCAL PLACE] tag still reads "Caravan Yard & Stable".
//
// Anchors we DO NOT rewrite (wave-0 owns them — referenced here for context):
//   (2,-5) Hiring Board     — settlement, public, the recruiter/escort face.
//   (3,-5) Wagon Lines & Stalls — settlement, public, carries service "stable"
//                             (the public-stable trade button — PRESERVED).
//
// New tiles inside the bounding box (1..3, -6..-3):
//   (1,-4) Stall Row     — settlement, public.
//   (1,-5) Farrier Lane  — settlement, public, service "farrier".
//   (2,-4) Fodder Loft   — indoor, public.
//   (2,-3) Remount Pen   — settlement, restricted, service "remount-pen-officer".
//   (3,-4) Tack Room     — indoor, restricted (lockable saddlery).
//
// Out-of-box neighbours we deliberately respect (read but never write):
//   (1,-6), (2,-6), (3,-6) — Whitemarch Walls (parent "Whitemarch walls").
//   (0,-5) Crown Gate Toll Hall — its own door list reaches into the yard;
//                                  we mirror by having Farrier Lane open onto
//                                  the gate-square approach at (0,-4).
//   (0,-4) Crown Gate inner street — the bridge to the rest of the city.
//   (1,-3), (2,-2), (3,-3) — unnamed streets owned by other authors; we open
//                            onto them only where the tile here is itself a
//                            street-grade hex (Stall Row, Fodder Loft, Remount
//                            Pen). The Tack Room is locked and opens only into
//                            the yard interior.
//   (4,-4), (4,-5) — Dragon-Watch Archetype approach; the Tack Room does NOT open
//                    onto the watch corridor.

export const DISTRICT_ID   = "great-stable";
export const DISTRICT_NAME = "Great Stable";

export const BOUNDING_BOX = { xmin: 1, xmax: 3, ymin: -6, ymax: -3 };

const PARENT      = "whitemarch-caravan-yard";
const PARENT_NAME = "Caravan Yard & Stable";

export const TILES = {
  // ---------- Stall Row — the public mounts under blankets at the rail -----
  // The hinge of the new footprint: bridges Farrier Lane (1,-5), Fodder Loft
  // (2,-4), the Hiring Board (2,-5) anchor, and out to the Crown Gate inner
  // street at (0,-4). Reads as a settlement-grade lane between stalls.
  "1,-4": {
    terrain: "settlement",
    poi: {
      type: "yard",
      name: "Caravan Yard & Stable",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "stall-row",
      partName: "Stall Row",
      description:
        "A long line of half-doored stalls under a tile pent-roof, the public face of the city's mount trade. Horses stand head-out under striped blankets, ears flicking at each new voice; mules bite slowly at the rail and are bitten back by their neighbours. A stable boy walks the line with a bucket and a slate, knowing which beast is sold and which is only resting. The straw is fresh near the gate-end and trampled black at the far end, where the cheap stock waits.",
    },
    doors: [
      { x: 2, y: -4 },
      { x: 0, y: -4 },
      { x: 1, y: -3 },
      { x: 1, y: -5 },
      { x: 2, y: -5 },
      { x: 0, y: -3 },
    ],
  },

  // ---------- Farrier Lane — blue smoke, burning hoof, the shoeing trade ---
  // Tucked along the wall under the gate-combat's shadow. Opens to Stall Row,
  // the Hiring Board, the Wagon Lines (the stable proper), and the Crown
  // Gate's Toll Hall at (0,-5) — drivers walk in off the road with a lame
  // beast and walk out shod. Wall hexes at (1,-6) and (2,-6) seal the north
  // edge; we do not author doors through them.
  "1,-5": {
    terrain: "settlement",
    poi: {
      type: "yard",
      name: "Caravan Yard & Stable",
      service: "farrier",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "farrier-lane",
      partName: "Farrier Lane",
      description:
        "A narrow lane between the stall-roof and the city wall, blue with the smoke of burning hoof and loud with the ring of the shoeing-hammer. A farrier's portable forge glows on the cobbles; an apprentice pumps the bellows with his weight thrown into it. A horse stands cross-tied with one hind hoof up in the farrier's lap, the air thick with the smell of singed horn. Drivers wait their turn on a bench polished by a hundred boot-heels, comparing roads and weather.",
    },
    doors: [
      { x: 2, y: -5 },
      { x: 0, y: -5 },
      { x: 1, y: -4 },
      { x: 0, y: -4 },
    ],
  },

  // ---------- Fodder Loft — bales over the stalls, the yard's lung --------
  // Indoor, public; the loft over the stall row. Opens onto Stall Row, the
  // Wagon Lines (the stable service tile), the Tack Room at (3,-4), the
  // Remount Pen at (2,-3), and out to the unnamed street at (1,-3) where
  // carters back wagons in to unload hay. The 7-th axial neighbour (2,-5)
  // Hiring Board is already adjacent via Stall Row; we leave that off here.
  "2,-4": {
    terrain: "indoor",
    poi: {
      type: "yard",
      name: "Caravan Yard & Stable",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "fodder-loft",
      partName: "Fodder Loft",
      description:
        "A timber loft slung over the stall-row, stacked head-high with hay-bales, sacked oats, and bricks of pressed fodder. Dust hangs in the slatted light; the boards above the stalls thump every time a horse below shifts its weight. A loft-keeper sits on a bale with a tally-stick and a chalk-board, marking each load in and out. A trap-hatch drops a measured forkful straight down into the manger; the city's couriers and remount officers all buy from the same heap.",
    },
    doors: [
      { x: 3, y: -4 },
      { x: 1, y: -4 },
      { x: 2, y: -3 },
      { x: 3, y: -5 },
      { x: 1, y: -3 },
    ],
  },

  // ---------- Remount Pen — military beasts behind a locked rail ---------
  // Restricted-access: the army's mounts. The pen face opens onto the Fodder
  // Loft, the Tack Room (saddlery is drawn here under signature), and the
  // outer streets at (1,-3), (2,-2), (3,-3). The pen-officer's window faces
  // those lanes; sergeants come up off Crown Lane to inspect and reject.
  "2,-3": {
    terrain: "settlement",
    poi: {
      type: "yard",
      name: "Caravan Yard & Stable",
      service: "remount-pen-officer",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "remount-pen",
      partName: "Remount Pen",
      description:
        "A square pen of stout oak rails with a locked gate and a city-crest plate above it. The beasts inside are sorted by branding: cavalry chargers, courier hacks, baggage mules, all standing close-cropped and well-fed under a remount officer's eye. The officer sits at a counter under a tile awning with a stack of ledgers and a brass scale for coin and oats both, and rejects expensive lies for a living. Civilians lean on the rail to look; they do not lean long.",
    },
    doors: [
      { x: 3, y: -3 },
      { x: 1, y: -3 },
      { x: 2, y: -2 },
      { x: 2, y: -4 },
      { x: 3, y: -4 },
      { x: 1, y: -2 },
    ],
  },

  // ---------- Tack Room — lockable saddlery, the costliest gear ----------
  // Indoor, restricted. The yard's strong-room: saddles, bridles, courier
  // bags, a few branded officer's saddles under a wax-sealed cabinet. Opens
  // ONLY into the yard interior — the Fodder Loft, the Remount Pen, and the
  // Wagon Lines stable. Does NOT open onto the outer streets (3,-3), (4,-4),
  // (4,-5); the Dragon-Watch corridor stays sealed off this tile.
  "3,-4": {
    terrain: "indoor",
    poi: {
      type: "yard",
      name: "Caravan Yard & Stable",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "tack-room",
      partName: "Tack Room",
      description:
        "A low room walled in pegged oak, every wall a rack: saddles ranked by maker, bridles coiled by length, courier-bags tagged with route-names, blankets folded by colour. A glass-fronted cabinet at the back holds the costliest gear under a wax-sealed clasp — officer's saddles, embossed cavalry tack, a courier's silver-mounted satchel. The keeper sits at a counter with a brass-bound ledger, and lets no buckle off the wall without a name written down beside it.",
    },
    doors: [
      { x: 2, y: -4 },
      { x: 2, y: -3 },
      { x: 3, y: -5 },
    ],
  },
};

// All new tiles share the existing Caravan Yard parent; no fresh sealed
// structures are introduced. The wall ring along the north edge (1,-6),
// (2,-6), (3,-6) belongs to "Whitemarch walls" and is left untouched.
export const STRUCTURES = [];

export const SERVICES = [
  "farrier",
  "remount-pen-officer",
];
