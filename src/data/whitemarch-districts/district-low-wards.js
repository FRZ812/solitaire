// Low Wards — dense common housing south of Chain Market and west of the
// Underworks. The commoner contrast to Noble Rise: timber over plaster over
// laundry-rope, public pumps with long lines, pawn brokers with saint icons
// over their ledgers, and a hundred small economies the city's official
// ledger does not see.
//
// Footprint: a single eight-hex POI anchored at (4,4) Tenement Row. Every
// member tile shares parent="whitemarch-low-wards" / parentName="Low Wards"
// with distinct part/partName values.
//
// Firebreak note: per the city bible, the ward walls between Low Wards and
// Noble Rise are the social distance made stone. Those wall hexes sit OUTSIDE
// this district's bounding box (the transition runs through Chain Market and
// the Citadel approach corridor at negative-x coords), so this module does
// not author any terrain:"wall" hexes — it only respects the existing wiring.
//
// Out-of-box neighbours we deliberately do NOT touch:
//   - (3,6) Underworks Brick Descent — owned by district-underworks.
//   - (4,5) and (4,6) — unnamed streets that border the Sewer Mouth at (4,7);
//     the Sewer Mouth's hidden status leans on these reading as plain streets,
//     so we leave them to whoever owns that approach.

export const DISTRICT_ID = "low-wards";
export const DISTRICT_NAME = "Low Wards";

export const BOUNDING_BOX = { xmin: 1, xmax: 4, ymin: 4, ymax: 6 };

const PARENT      = "whitemarch-low-wards";
const PARENT_NAME = "Low Wards";

export const TILES = {
  // ---------- Tenement Row anchor (rewrite of the existing single tile) ----
  "4,4": {
    terrain: "street",
    poi: {
      type: "town",
      name: "Tenement Row",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "tenement-row",
      partName: "Tenement Row",
      description:
        "Timber, plaster, laundry-rope and smoke leaning over itself. Every window has a face until you look at it directly. A public pump knocks somewhere out of sight, roof-bridges cross overhead, and someone has chalked three different warnings beside the same alley-mouth. Children watch the lane-ends for watch patrols; the patrols watch back. Doorways into the rookeries are unmarked and only ever half-shut.",
    },
    doors: [
      { x: 3, y: 4 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
    ],
  },

  // ---------- Public Pump — community face, north side of the Row ---------
  "3,4": {
    terrain: "settlement",
    poi: {
      type: "plaza",
      name: "Public Pump",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "public-pump",
      partName: "Public Pump",
      description:
        "A stone-lipped public pump in a court too small for the line it draws. The handle knocks; the lead spout drips between pulls. Women wait with yoke-buckets and trade news the watch is not invited to hear. A chipped saint-niche set in the pump's pedestal has a fresh wax stub on it — someone is asking for something.",
    },
    doors: [
      { x: 4, y: 4 },
      { x: 4, y: 3 },
      { x: 3, y: 3 },
      { x: 2, y: 4 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
    ],
  },

  // ---------- Cheap Cookshop — the ward's one real trade counter ----------
  "3,5": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Cheap Cookshop",
      service: "cookshop-keeper",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "cheap-cookshop",
      partName: "Cheap Cookshop",
      description:
        "A low room with a black-iron range, a tin counter, and a permanent smell of fried scraps, onion, and lamp-oil. Day-labourers eat standing up; porters pay in copper bits and unfinished stories. The keeper knows everyone's face and almost no one's name, which is exactly the service most of his trade is buying.",
    },
    doors: [
      { x: 4, y: 4 },
      { x: 3, y: 4 },
      { x: 2, y: 5 },
      { x: 2, y: 6 },
      { x: 3, y: 6 },
    ],
  },

  // ---------- Rat Lane — narrow, warning-chalked street ------------------
  "2,4": {
    terrain: "street",
    poi: {
      type: "site",
      name: "Rat Lane",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "rat-lane",
      partName: "Rat Lane",
      description:
        "A lane narrow enough that two yoked porters cannot pass without one of them backing into a doorway. The wall-plaster is chalked over and over: watch-marks, gang-tolls, a fading prayer, the same warning-rune redrawn by three different hands. Something small moves along the gutter and does not hurry.",
    },
    doors: [
      { x: 3, y: 4 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 4 },
      { x: 1, y: 5 },
      { x: 2, y: 5 },
    ],
  },

  // ---------- Pawn Stair — broker counter at the head of a stair ---------
  "2,5": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Pawn Stair",
      service: "pawn-broker",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "pawn-stair",
      partName: "Pawn Stair",
      description:
        "Up six worn steps, a half-door opens onto a counter, a barred grille, and a wall of tagged pledges: a soldier's belt-knife, a wedding hoop, a midwife's lamp, a child's saint-medal. The broker keeps his ledger under a saint icon and reads loans aloud so the queue can witness them. Quiet money also changes hands here; the watch knows and pretends not to.",
    },
    doors: [
      { x: 3, y: 5 },
      { x: 3, y: 4 },
      { x: 2, y: 4 },
      { x: 1, y: 5 },
      { x: 1, y: 6 },
      { x: 2, y: 6 },
    ],
  },

  // ---------- Hidden Chapel — discovery-only, mirrors Sewer Mouth wiring -
  "2,6": {
    terrain: "indoor",
    poi: {
      type: "hidden",
      name: "Hidden Chapel",
      access: "hidden",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "hidden-chapel",
      partName: "Hidden Chapel",
      description:
        "A back-court door no wider than a coffin-lid opens on a low room hung with cheap-cloth icons and the smoke of tallow stubs. The shrine is to a saint the High Temple does not list — a hooded woman with a bandaged hand. The floor is swept; the alms-bowl is empty in the way a thing is empty when it has just been used. Whoever tends this place knows when strangers are coming.",
    },
    // Empty doors — first-visit discovery event opens the chapel; the
    // narrator does not surface it in normal [LOCAL PLACE] listings.
    doors: [],
  },

  // ---------- Roof Bridge — covered walkway above the lane --------------
  "1,5": {
    terrain: "street",
    poi: {
      type: "stair",
      name: "Roof Bridge",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "roof-bridge",
      partName: "Roof Bridge",
      description:
        "A plank-and-rope bridge roofed in patched canvas, slung one storey above the lane between two rookeries. Boards bend underfoot; the canvas hides who is crossing and from where. Children use it as a short-cut; thieves use it as a back-door; the watch will not climb up after either of them.",
    },
    doors: [
      { x: 2, y: 5 },
      { x: 2, y: 4 },
      { x: 1, y: 4 },
      { x: 0, y: 5 },
      { x: 1, y: 6 },
    ],
  },

  // ---------- Back-Court Well — gathering point, community face ----------
  "1,6": {
    terrain: "settlement",
    poi: {
      type: "plaza",
      name: "Back-Court Well",
      service: "pump-elder",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "back-court-well",
      partName: "Back-Court Well",
      description:
        "A round-mouthed stone well in a back court with a chipped saint at its lip and a bench worn shiny by sitters. The court is the ward's unofficial meeting hall: disputes are heard, names are remembered, watch-news is sifted. The well-elder sits with the rope across her knees and decides whose bucket goes down next — which is to say, who in the ward is listened to today.",
    },
    doors: [
      { x: 2, y: 6 },
      { x: 2, y: 5 },
      { x: 1, y: 5 },
      { x: 1, y: 7 },
    ],
  },
};

// Low Wards has firebreak walls (per the bible) but none sit inside this
// district's bounding box — the wall transition lives in Chain Market /
// Citadel approach territory at negative-x coords. No structures to declare.
export const STRUCTURES = [];

export const SERVICES = [
  "cookshop-keeper",
  "pawn-broker",
  "pump-elder",
];
