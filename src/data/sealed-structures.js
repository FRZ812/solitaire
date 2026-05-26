// Sealed structures — access-control door specs (see docs/WORLDBUILDING.md,
// Ruling 7, and docs/region-planning/WHITEMARCH_*). The map was wiped to a clean
// slate and rebuilt around the walled city of Whitemarch at the origin; the old
// roadside sandbox is preserved in sealed-structures.legacy.js.
//
// Three authoring shapes (the auto-application at the bottom of
// data/handcrafted-tiles.js picks based on which fields are present):
//
//   streets + buildings + gates — a walled city (or ward) partitioned into
//     STREETS (mesh-connected thoroughfares — squares, plazas, lanes) and
//     BUILDINGS (one-street-only access — every named building opens to its
//     adjacent street and nothing else). Streets mesh with every adjacent
//     hex inside the area, including their building doorways; buildings
//     open only to adjacent streets (plus a paired outside hex if listed
//     in `gates`). The layout is authored SPACIOUS — every building sits
//     in a street grid with three or more street neighbours and any pair
//     of buildings has a parallel street route around them — so findPath
//     never needs to cut diagonally through a building chain to reach a
//     destination. Every non-gate building must have at least one
//     adjacent street, or the apply throws.
//
//   interior + gates (+ legacy threshold) — a sealed AREA with a single
//     fully-meshed interior. Kept for dungeons and tighter walled
//     compounds where every interior hex should be free-walking.
//
//   entry + outside + links — a single building / inner compound whose
//     interior connectivity is an explicit graph. `links` is a list of
//     [a, b] hex pairs that connect; each hex opens ONLY to its linked
//     neighbours. `entry` is the doorway hex and `outside` the adjacent
//     street it opens onto. Used here for the Citadel's High Wall: the
//     inner compound is reachable ONLY through the Inner Gate.
//
// ORDER MATTERS. The structures are applied in array order, and each one
// overwrites the door list of the hexes it touches. The Great Wall (a
// mesh over the entire city interior) MUST come before the Citadel
// (links), so the citadel's gate-only doors override the mesh's
// full-mesh doors — that is what turns the High Wall into a real wall
// while keeping the Inner Gate reachable from the street it faces.
//
// The auto-application validates that links/gates are between adjacent
// hexes, that every linked member is reachable from its entry, that
// every non-gate building has at least one street door, and warns if a
// building entry opens onto something that is not a walkable street.

// Whitemarch interior — STREETS (the thoroughfare grid) and BUILDINGS
// (destination islands set INTO the grid). Streets fill the gaps between
// buildings so the path graph can always route around any cluster. The
// Sewer Mouth is deliberately NOT listed in either — it carries its own
// empty door list so it stays sealed off the street (a hidden descent
// reachable only by narrator-driven entry). The Iron Palace is also NOT
// listed — it sits behind the High Wall and is sealed by the nested
// Citadel structure below.
const WHITEMARCH_STREETS = [
  // ---- Named plazas / squares / steps (places that are also thoroughfares) ----
  { x: 0, y: -3 },  // Gate Square (the open square just inside the Crown Gate's inner ward)
  { x: 0, y: -1 },  // Inspection Yard (was the gate-yard; now a small open yard inside the city)
  { x: 0, y: 0 },   // Grain Square (player start, the heart of the Grand Market)
  { x: 1, y: 1 },   // Chain Market Steps (the paved sale-plaza of the Chain Ward)
  { x: -1, y: 2 },  // Lower Petition Steps (the open court-steps)
  { x: -1, y: 3 },  // Great Oath Steps (the temple plaza, facing the Inner Gate)
  { x: 2, y: 5 },   // Fountain Court (a small civic plaza in the south)

  // ---- North wall walk (just inside the Great Wall) ----
  { x: -2, y: -3 },
  { x: -1, y: -3 },
  { x: 1, y: -3 },
  { x: 2, y: -3 },

  // ---- Gate-side perimeter lanes (the two hexes immediately inside the
  // Toll Hall). Authored explicitly so the gatehouse `door` validation
  // accepts them. The wall generator also places them as perimeter
  // streets; sealed-structures' applyStreetBuildingDoors then re-wires
  // their doors to mesh with the gatehouse + adjacent interior. ----
  { x: 0, y: -4 },
  { x: 1, y: -4 },

  // ---- North row (between wall and gate-yard) ----
  { x: -3, y: -2 },
  { x: -2, y: -2 },
  { x: 1, y: -2 },
  { x: 2, y: -2 },
  { x: 3, y: -2 },

  // ---- Yard row (the inspection band) ----
  { x: -3, y: -1 },
  { x: -1, y: -1 },  // Wagon Lane — the unloading street outside the gate-yard
  { x: 2, y: -1 },

  // ---- Market row (around Grain Square) ----
  { x: -3, y: 0 },
  { x: -1, y: 0 },
  { x: 2, y: 0 },   // Quay Lane — the riverside lane south of the High Quay
  { x: 3, y: 0 },

  // ---- South-of-market row (between market and Chain Ward) ----
  { x: -3, y: 1 },
  { x: -1, y: 1 },

  // ---- Iron Way row (the central avenue, between markets and courts) ----
  { x: -3, y: 2 },
  { x: -2, y: 2 },
  { x: 0, y: 2 },
  { x: 2, y: 2 },
  { x: 3, y: 2 },

  // ---- Iron Way bridge + temple/citadel row ----
  { x: 1, y: 2 },   // bridge from Iron Way to the eastern lanes (was Guild Court)
  { x: 1, y: 3 },
  { x: 2, y: 3 },

  // ---- Southern wards row ----
  { x: -3, y: 4 },
  { x: -2, y: 4 },
  { x: 1, y: 4 },
  { x: 3, y: 4 },

  // ---- South wall walk ----
  { x: -1, y: 5 },
  { x: 0, y: 5 },
  { x: 1, y: 5 },
];

// Every non-gate building carries an explicit `door: {x,y}` naming its single
// front-door street. The spacious street grid means each building has 3+
// adjacent streets, but the path graph treats only ONE of them as the door
// — so a building can be entered from its front and only that front,
// never used as a transit hex between two streets. This is what the user
// sees as "walking the lane past the front of a building" rather than
// "cutting through a shop to reach the next street". Gates (Toll Hall,
// Inner Gate) are the exception: they transit by design, so they take
// the default multi-door treatment (all adjacent streets + the gate-out).
const WHITEMARCH_BUILDINGS = [
  // ---- North-wall ward ----
  { x: -1, y: -2, door: { x: -1, y: -1 } }, // Crown Guardpost — onto Wagon Lane
  { x: 0, y: -2, door: { x: 0, y: -3 } },    // Customs Hall — onto Gate Square
  { x: 3, y: -3, door: { x: 3, y: -2 } },   // Dragon-Watch Tower — onto the east-wall walk

  // ---- Crown Gate (2 hexes, 1 deep × 2 wide, set straight through the
  // wall ring). Each hex carries an explicit doors list so the path
  // graph follows the gate's spine (Approach → Toll Hall → perimeter
  // street → city) and can also cross the gate's east/west pair. The
  // gate-out edge (Toll Hall ↔ Approach) is the structure's only
  // breach of the Great Wall and is declared in the `gates` field
  // below. ----
  { x: 0, y: -5, doors: [{ x: 1, y: -5 }, { x: 0, y: -4 }] }, // Toll Hall — gate-out (0,-6) added via gates field
  { x: 1, y: -5, doors: [{ x: 0, y: -5 }, { x: 1, y: -4 }] }, // Toll Hall (East)

  // ---- Caravan / market wards ----
  { x: -2, y: -1 },                          // Caravan Yard — open yard with gates
                                              // on three sides (no door field —
                                              // multi-door is canon for a yard).
  { x: 1, y: -1, door: { x: 0, y: 0 } },    // Night Market — onto Grain Square (market parent)
  { x: 3, y: -1, door: { x: 2, y: 0 } },    // High Quay — onto Quay Lane
  { x: -2, y: 0, door: { x: -1, y: -1 } },  // Halfborn Hostel — onto Wagon Lane
  { x: 1, y: 0, door: { x: 0, y: 0 } },     // Butchers' Row — onto Grain Square (market parent)
  { x: 0, y: 1, door: { x: 0, y: 0 } },     // Cloth Awnings — onto Grain Square (market parent)

  // ---- Foreign quarter / chain ward / iron quarter ----
  { x: -2, y: 1, door: { x: -3, y: 1 } },   // Embassy Lane — onto the foreign-quarter lane
  { x: 2, y: 1, door: { x: 1, y: 1 } },     // Registry Hall — onto Chain Market Steps
  { x: 3, y: 1, door: { x: 3, y: 0 } },     // Public Smith Row — onto the riverside lane

  // ---- Court hill (Guild Court is in the eastern row, opening onto the
  // riverside lane so the central avenue stays a clean street bridge) ----
  { x: 3, y: 3, door: { x: 3, y: 2 } },     // Guild Court — onto the eastern lane

  // ---- Temple / west wards ----
  { x: -3, y: 3 },                           // Foundling Court — walled
                                              // courtyard with cloister gates
                                              // on both sides (multi-door).
  { x: -2, y: 3, door: { x: -1, y: 2 } },   // Granary Court — onto Lower Petition Steps

  // ---- Citadel (the Inner Gate is in this list so adjacent streets mesh-
  // connect to it for the High Wall override; the Iron Palace is NOT —
  // the High Wall handles it entirely. Inner Gate is multi-door here so
  // that the High-Wall override has a clean slate to overwrite.). ----
  { x: 0, y: 3 },

  // ---- Southern wards ----
  { x: -1, y: 4, door: { x: -1, y: 3 } },   // Prison Gate — onto Great Oath Steps
  { x: 2, y: 4, door: { x: 2, y: 5 } },     // Tenement Row — onto Fountain Court

  // ---- Wall-side buildings (cornered against the inside of the wall,
  // each opening to a city street through the d=1 perimeter ring) ----
  { x: -2, y: -4, door: { x: -2, y: -3 } }, // Watch Bunkhouse — onto the north wall-walk lane
  { x: 4, y: 2,   door: { x: 3, y: 2 } },   // Forge Annex — onto the eastern Iron Way row
  { x: -2, y: 5,  door: { x: -1, y: 5 } },  // Wallside Almshouse — onto the south wall-walk lane
];

export const SEALED_STRUCTURES = [
  // ---------- WHITEMARCH — THE GREAT WALL ----------
  // The whole city is one enclosed area, partitioned into streets and
  // buildings. The path graph runs over the streets; each building opens
  // only onto its adjacent street(s). The only way through the Great Wall
  // is the Crown Gate (Toll Hall ↔ Crown Road Approach).
  {
    name: "The Great Wall of Whitemarch",
    streets: WHITEMARCH_STREETS,
    buildings: WHITEMARCH_BUILDINGS,
    gates: [
      [{ x: 0, y: -5 }, { x: 0, y: -6 }], // Toll Hall opens out to the Crown Road Approach
    ],
  },
  // ---------- WHITEMARCH — THE HIGH WALL (CITADEL) ----------
  // Applied AFTER the Great Wall so it overrides the mesh: the Iron Palace
  // is reachable ONLY through the Inner Gate, which faces the Great Oath
  // Steps.
  {
    name: "The High Wall (Citadel Ward)",
    entry: { x: 0, y: 3 },    // Inner Gate
    outside: { x: -1, y: 3 }, // opens onto the Great Oath Steps
    links: [
      [{ x: 0, y: 3 }, { x: 0, y: 4 }], // Inner Gate -> Iron Palace
    ],
  },
  // ---------- WHITEMARCH — THE UNDERWORKS ----------
  // Five sealed chambers beyond the Sewer Mouth, meshed internally and
  // gated one-way out to the Mouth. The mesh wires every adjacent pair
  // among the interior hexes; the single gate adds Brick Descent's door
  // to (3,5) Sewer Mouth WITHOUT touching Sewer Mouth's own empty doors
  // list — so findPath stays blocked at the Mouth in both directions
  // and entry/return remain narrator-driven (Sewer Mouth carries
  // `doors:[]` as authored in data/handcrafted-tiles.js).
  {
    name: "The Underworks",
    interior: [
      { x: 3, y: 6 }, // Brick Descent
      { x: 3, y: 7 }, // Drain Junction
      { x: 2, y: 7 }, // Old Cistern
      { x: 3, y: 8 }, // Guide Markings
      { x: 4, y: 7 }, // Smuggler Stair
    ],
    gates: [
      [{ x: 3, y: 6 }, { x: 3, y: 5 }], // Brick Descent ↔ Sewer Mouth (one-way out per Sewer Mouth's doors:[])
    ],
  },
];
