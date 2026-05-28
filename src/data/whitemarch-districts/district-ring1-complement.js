// Ring 1 Complementary Content — a light dressing pass across the existing
// Whitemarch districts. The initial city is treated as a finished district;
// this module only fills in small public-facing services and atmospheric
// landmarks at currently-unnamed street coords. NO new walls, NO new gates,
// NO sealed structures, NO multi-hex footprints — every entry here is a
// standalone street-side landmark that preserves the original tile's terrain
// and door wiring.
//
// Picks (spread across districts, kept inland, never adjacent to the Great
// Wall ring or the Citadel approach):
//   (-3,1) Proclamation Board   — west of the Grand Market
//   (-3,2) Scrivener's Bench    — west wards, near the Petition direction
//   (-4,3) Apothecary's Window  — west wards, near Granary Court
//   (-2,2) Saint of the Lost    — between Grand Market and Chain Market
//   ( 1,-3) Chandler's Stall    — Gate Square / Customs district
//   ( 2,-1) Fishmonger's Bench  — between Grand Market and High Quay
//   ( 2, 3) Leatherworker's Shop — between Registry Hall and Fountain Court
//   ( 3, 2) Dry-Goods Counter   — between Registry Hall and Guild Court
//
// Note on the existing BUILDINGS audit (town.js):
//   - `tavern` ALREADY exists in BUILDINGS (The Iron Tankard) — no new tavern
//     is added here, the city already has one wired.
//   - `apothecary`, `chandler`, `general-store`, `leather-worker`,
//     `fishmonger` are NEW services declared by this module — Wave 3 S1
//     will append them to BUILDINGS.
//   - The Proclamation Board, Scrivener's Bench, and Saint of the Lost are
//     pure-atmospheric POIs with no `service` field (no trade counter).

export const DISTRICT_ID = "ring1-complement";
export const DISTRICT_NAME = "Ring 1 Complementary Content";

export const BOUNDING_BOX = { xmin: -6, xmax: 6, ymin: -6, ymax: 8 };

export const TILES = {
  // ---------- (-3,1) Proclamation Board ---------------------------------
  // West of the Grand Market on the lane that runs toward the West Stair.
  // A public notice-board; the city posts its proclamations here and the
  // illiterate hire a reader off the bench.
  "-3,1": {
    terrain: "street",
    poi: {
      type: "site",
      name: "Proclamation Board",
      access: "public",
      description:
        "A waist-high oak board nailed to the gable of the corner-house, hooded by a shingle to keep the rain off. Layers of parchment overlap layers — toll-rates struck through and re-posted, lost-bond notices, a list of names the watch wants brought in, a militia muster for the third bell. Beside it a bench worn shiny by sitters; a one-eyed reader takes a half-coin to read out anything that matters.",
    },
    doors: [
      { x: -2, y: 1 },
      { x: -2, y: 0 },
      { x: -3, y: 0 },
      { x: -3, y: 2 },
      { x: -4, y: 1 },
      { x: -4, y: 2 },
    ],
  },

  // ---------- (-3,2) Scrivener's Bench ----------------------------------
  // West wards, one step closer to the Granary Court / Almshouse line.
  // Public-writing service: letters, petitions, will-marks for the
  // illiterate; not a trade counter, just dialogue and atmosphere.
  "-3,2": {
    terrain: "street",
    poi: {
      type: "site",
      name: "Scrivener's Bench",
      access: "public",
      description:
        "A long lean-to against a plastered wall, three planks of slope-desk and a bench worn into hollows. A scrivener sits under an awning with a slate of trial-letters chalked beside him: PETITION, WILL-MARK, BOND-RELEASE. Ink-pot, gum, sand-shaker; a queue of farmwives and porters with folded coppers. He writes what you tell him and reads it back; you make your mark, and he keeps a copy under his thumb.",
    },
    doors: [
      { x: -2, y: 2 },
      { x: -2, y: 1 },
      { x: -3, y: 1 },
      { x: -3, y: 3 },
      { x: -4, y: 3 },
      { x: -4, y: 2 },
    ],
  },

  // ---------- (-4,3) Apothecary's Window --------------------------------
  // West wards, just east of the Granary Court / Almshouse pair. The
  // city's herb-and-poison trade has to live SOMEWHERE; this is it.
  "-4,3": {
    terrain: "settlement",
    poi: {
      type: "bldg",
      name: "Apothecary's Window",
      service: "apothecary",
      access: "public",
      description:
        "A hinged shutter in a plaster wall opens onto a half-counter and the dim smell of dried things — rue, valerian, comfrey, wormwood, something sharper underneath. Jars on a shelf are labelled in a careful hand; below the counter a locked drawer is labelled in no hand at all. The apothecary asks what the trouble is, listens longer than a healer would, and measures out powders by a brass scale she keeps tied to her wrist.",
    },
    doors: [
      { x: -3, y: 3 },
      { x: -3, y: 2 },
      { x: -4, y: 2 },
      { x: -4, y: 4 },
    ],
  },

  // ---------- (-2,2) Saint of the Lost ----------------------------------
  // Atmospheric wayshrine on the lane between Grand Market and Chain
  // Market — the foot-traffic from the city's two largest plazas passes
  // it daily; the icon shows the wear.
  "-2,2": {
    terrain: "street",
    poi: {
      type: "site",
      name: "Saint of the Lost",
      access: "public",
      description:
        "A waist-high niche cut into the corner-stone of a tenement, set with a soot-blackened icon of a hooded saint holding a lantern and a length of broken chain. The shelf at her feet collects offerings the wind cannot take: a copper bit, a child's tooth, a cloth-knot of hair, three tallow stubs guttered down to puddles. The plaster around the niche is scrawled with names — petitioners, the missing, the freed — in a dozen different hands.",
    },
    doors: [
      { x: -1, y: 2 },
      { x: -1, y: 1 },
      { x: -2, y: 1 },
      { x: -3, y: 2 },
      { x: -3, y: 3 },
      { x: -2, y: 3 },
    ],
  },

  // ---------- (1,-3) Chandler's Stall -----------------------------------
  // Just inside the Crown Gate / Customs corridor — every traveller who
  // walks in through the gate passes this stall on the way to the Grand
  // Market. Tallow, wick, lamp-oil; the first honest light a stranger
  // can buy after the road.
  "1,-3": {
    terrain: "settlement",
    poi: {
      type: "bldg",
      name: "Chandler's Stall",
      service: "chandler",
      access: "public",
      description:
        "A timber stall built into the side of a customs-row warehouse, hung curtain-thick with dipped tallow tapers on twine, beeswax pillars under a separate awning for the coin trade, coils of cotton wick on pegs. The chandler tests a wick between his teeth before he sells it; a small lamp burns on his counter all day to show off the brightness of his oil. The whole stall smells of warm fat and singed cotton.",
    },
    doors: [
      { x: 2, y: -3 },
      { x: 0, y: -3 },
      { x: 0, y: -2 },
      { x: 1, y: -2 },
      { x: 1, y: -4 },
      { x: 2, y: -4 },
    ],
  },

  // ---------- (2,-1) Fishmonger's Bench ---------------------------------
  // The lane between the Grand Market and the High Quay — the river-fish
  // come up off the Whitewend boats and never quite reach the Grand
  // Market proper. This is where the quay-catch is sold.
  "2,-1": {
    terrain: "settlement",
    poi: {
      type: "bldg",
      name: "Fishmonger's Bench",
      service: "fishmonger",
      access: "public",
      description:
        "A long slate bench under a canvas slope, the slate sluiced down with quay-water every bell so the blood does not crust. Today's catch is laid in fern: river-trout, eel cut in lengths, a half-bushel of small silver fish the porters call white-eyes. The fishmonger keeps a wood-mallet within reach for the eels and a tin cup for change. Cats sit at a polite distance and wait for the trim.",
    },
    doors: [
      { x: 3, y: -1 },
      { x: 3, y: -2 },
      { x: 2, y: -2 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
  },

  // ---------- (2,3) Leatherworker's Shop --------------------------------
  // Between Registry Hall (north) and Fountain Court (south), on the lane
  // that runs toward Guild Court. A licensed craft shop — the Guild
  // Court is one block east, and the leatherworker's licence-tag hangs
  // visibly behind the counter.
  "2,3": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Leatherworker's Shop",
      service: "leather-worker",
      access: "public",
      description:
        "A low-beamed shop smelling of oak-bark tan and neat's-foot oil, the front room hung with belts, satchels, harness-strap, and rolled hide; an awl-board behind the counter holds two dozen tools by their handles. A guild-tag in beaten copper hangs over the till — the licence the Guild Court sells him. He works while he talks, the heel of his hand running a curved blade along a strop without looking down.",
    },
    doors: [
      { x: 3, y: 3 },
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 1, y: 3 },
      { x: 1, y: 4 },
      { x: 2, y: 4 },
    ],
  },

  // ---------- (3,2) Dry-Goods Counter -----------------------------------
  // The block-corner shop between Registry Hall, Guild Court, and the
  // Forge Annex — the city's general store. Sacks, jars, twine, candles,
  // the small daily stock that the Grand Market does not carry as
  // packaged keep-anywhere goods.
  "3,2": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Dry-Goods Counter",
      service: "general-store",
      access: "public",
      description:
        "A narrow shop wedged into a block-corner, the counter and shelving made of the same dark wood and worn to the same shine. Sacks of flour, beans, lentils, salt stand mouth-open on the floor under chalked prices; the upper shelves hold jars of pickle, twine on spools, fire-lighters, soap-bars, paper screws of tea. A brass bell over the door announces every customer; a slate by the till tracks who is owed credit and who is owing.",
    },
    doors: [
      { x: 4, y: 2 },
      { x: 3, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ],
  },
};

// Light complementary pass — no new walls, no gates, no sealed structures.
export const STRUCTURES = [];

// New service ids declared here. Wave 3 S1 will append these to
// BUILDINGS in src/data/town.js. `tavern` is intentionally NOT listed —
// town.js already wires The Iron Tankard at the tavern key.
export const SERVICES = [
  "apothecary",
  "chandler",
  "fishmonger",
  "general-store",
  "leather-worker",
];
