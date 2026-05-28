// Temple Steps — the new ward placed between Noble Rise (SW) and Low Wards
// (SE), filling the central corridor between the Inner Gate (Citadel) and
// Chain Market. The district is tight: three settlement/street hexes carrying
// the city's oath-life, hospital-life, and pilgrim-life onto a plaza that
// looks the Citadel in the face.
//
// Whitemarch regulates faith because faith can feed, heal, bury, riot, or
// crown; the Temple Steps are where that regulation becomes ash on a wrist,
// a bell from a cloister, or a queue of pilgrims at a brass rail. Incense
// over blood and boiled bandages, funeral bells competing with market bells.
//
// Footprint inside the bounding box (0..1, 2..4):
//
//   y=2: 0,2 Chain Market Steps Viewing Yard -- DO NOT TOUCH (Chain Market).
//        1,2 unnamed street                    -- LEFT UNTOUCHED (outside the
//                                                  temple's reach; market spur).
//   y=3: 0,3 Hospital Cloister                 (rewrites unnamed street)
//        1,3 Fountain Court                    -- DO NOT TOUCH (named POI).
//   y=4: 0,4 Great Oath Steps (anchor plaza)   (rewrites unnamed street)
//        1,4 Sanctuary Rail                    (rewrites unnamed street)
//
// Out-of-box neighbours we deliberately respect:
//   - (0,5) Citadel Inner Gate — the Oath Steps face it; preserve (0,4)↔(0,5).
//   - (-1,4) Noble Gate — the gate's outer face opens onto (0,4); preserve.
//   - (-1,3) Chain Market petition rail — preserve (0,3)↔(-1,3).
//   - (0,2) Viewing Yard — preserve (0,3)↔ via its own door list (the yard's
//     door is (-1,3) only; we do not reach back into Chain Market from (0,3)
//     beyond what was already there).
//   - (1,5) Low Wards Roof Bridge — preserve (1,4)↔(1,5).
//   - (1,3) Fountain Court — preserve (0,3)/(0,4)/(1,4)↔(1,3) where each
//     already existed.
//   - (-1,5) was an unnamed street that Noble Rise now owns as House
//     Vaerwynne Front (sealed away from this corridor); the live (0,4)→(-1,5)
//     link becomes one-way dead under Noble Rise's wiring, so this module
//     drops it from the plaza's door list rather than carry a stale stub.

export const DISTRICT_ID   = "temple-steps";
export const DISTRICT_NAME = "Temple Steps";

export const BOUNDING_BOX = { xmin: 0, xmax: 1, ymin: 2, ymax: 4 };

const PARENT      = "whitemarch-temple-steps";
const PARENT_NAME = "Temple Steps";

export const TILES = {
  // ---------- Great Oath Steps — the temple plaza (anchor) ----------------
  // The plaza facing the Citadel's Inner Gate. Worn-hollow stone steps,
  // oath altars set into the flag, priests in pale robes marking contracts
  // in ash (city), oil (house), blood (war), or salt (sea). Pilgrims sleep
  // under the colonnade along the north edge; petition-clerks sit at low
  // benches with the city's protection-letters drafted in a clear hand.
  // The Hospital Cloister bell rings up from (0,3) one storey below the
  // plaza's south rail. Status legitimises law and war here every morning.
  "0,4": {
    terrain: "settlement",
    poi: {
      type: "temple",
      name: "Great Oath Steps",
      service: "oath-priest",
      access: "public",
      area: "temple-steps",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "great-oath-steps",
      partName: "Great Oath Steps",
      description:
        "Broad pale-stone steps worn hollow by knees and court shoes alike, climbing in three shallow flights to a flagged temple plaza that looks the Inner Gate of the Citadel full in the face. Four oath altars stand along the back wall — one for each of the marks the priests use: a brass dish of grey wood-ash, a stoppered cruet of olive oil, a shallow basin kept under a clean linen for blood, and a small stone bowl of pale salt. Petitioners kneel; a priest in a pale robe touches the chosen mark to the inside of the wrist and reads the contract aloud while a temple scribe writes the witness-line in a heavy book on a sloped lectern. Funeral bells and the Hospital Cloister's quieter bell ring up from below; pilgrims in road-stained cloaks sleep along the colonnade, their bowls beside them, their staves leaning on the wall. The city watch holds the lower step and admits no weapons drawn above it.",
    },
    // Preserve every street link except the one into (-1,5) — that hex is
    // now House Vaerwynne Front (Noble Rise) and seals away from this
    // corridor on its side, so the link would be a one-way dead-end.
    doors: [
      { x:  1, y: 4 }, // Sanctuary Rail (this district)
      { x:  1, y: 3 }, // Fountain Court (named POI, preserve)
      { x:  0, y: 3 }, // Hospital Cloister (this district)
      { x: -1, y: 4 }, // Noble Gate outer face (Noble Rise, preserve)
      { x:  0, y: 5 }, // Inner Gate of the Citadel (preserve)
    ],
  },

  // ---------- Hospital Cloister — indoor lay-sisters' ward ----------------
  // One storey below the plaza, reached by a covered stair through the
  // south rail. Whitewashed vaults, rope-strung cots, a bell that calls the
  // sisters back to the wards on the hour. Lay-sisters of the Oath wash
  // wounds in vinegar-water, set bones, listen to fevered confessions, and
  // turn away no one who climbs the steps before nightfall. The bell heard
  // up on the plaza rings from a small belfry over the cloister's door.
  "0,3": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Hospital Cloister",
      service: "hospital-sister",
      access: "public",
      area: "temple-steps",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "hospital-cloister",
      partName: "Hospital Cloister",
      description:
        "A low whitewashed cloister one stair below the Oath Steps, lit by tall slot-windows and lamps in iron cages. Rope-strung cots line the long walls in pairs; a kettle of vinegar-water steams on a charcoal brazier at the head of each row. Lay-sisters of the Oath move between the cots with linen rolls, splint-sticks, and small wooden cups of bitter tea — they wear pale grey with the temple's wreath stitched at the shoulder. A novice rings the cloister bell from a rope by the door each hour to call the sisters back to the wards. A side-room behind a curtain serves the temple scribe-desk, where protection-letters and burial-papers are drawn up for petitioners too weak to stand on the plaza above; the brass alms-bowl by the door is half-full of mixed copper. No one who climbs the south rail before nightfall is turned away, though the sister at the door notes every face.",
    },
    // The cloister is indoor and the spec calls for a single plaza entry;
    // we add the Chain Market petition-rail link only because it was the
    // existing street-line tying the corridor together and the bible places
    // the hospital with one ear to the market. Everything else seals.
    doors: [
      { x:  0, y: 4 }, // Great Oath Steps plaza (the only temple-side door)
      { x: -1, y: 3 }, // Chain Market petition rail (preserve corridor link)
    ],
  },

  // ---------- Sanctuary Rail — pilgrim queue at the temple's outer rail ---
  // The east edge of the plaza, where pilgrims and petitioners wait their
  // turn at a brass rail under the colonnade. A line for sanctuary requests
  // forms here in the cool of the morning; the rail is where temple law
  // meets city law and either holds or fails. The Roof Bridge from the Low
  // Wards drops a stair down to this rail (preserve the (1,4)↔(1,5) link).
  "1,4": {
    terrain: "settlement",
    poi: {
      type: "plaza",
      name: "Sanctuary Rail",
      access: "public",
      area: "temple-steps",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "sanctuary-rail",
      partName: "Sanctuary Rail",
      description:
        "A polished brass rail set into pale stone along the east edge of the Oath Steps plaza, sheltered under a tiled colonnade. The line of pilgrims, debtors, fugitives and grieving kin forms here at dawn and is sorted by a temple steward with a slate — sanctuary requests to the inner gate-priest, healing petitions down the stair to the cloister, oath-witnesses up the steps to the altars. A copper alms-cup hangs from a chain at the rail's mid-point; the cup is rung by hand to call the next petitioner. Watch-sergeants stand at the rail's south end and will not cross it — the brass line is the legal threshold of temple ground, and a hand on the rail with the right word spoken is enough to halt an arrest until the priests have heard the case.",
    },
    // Preserve every street neighbour that mattered: plaza, Fountain Court,
    // the next eastward street (2,4), the next northward street (2,3), and
    // the Low Wards Roof Bridge (1,5). Drop the (0,5) link — Inner Gate's
    // own door list only reaches (0,4) and (0,6), so the line was a stub.
    doors: [
      { x:  0, y: 4 }, // Great Oath Steps plaza (this district)
      { x:  1, y: 3 }, // Fountain Court (named POI, preserve)
      { x:  2, y: 3 }, // unnamed street (preserve)
      { x:  2, y: 4 }, // unnamed street (preserve)
      { x:  1, y: 5 }, // Low Wards Roof Bridge (preserve)
    ],
  },
};

// No sealed-structure entry: the Temple Steps' "ward wall" is the brass
// Sanctuary Rail and the temple's social authority, not stone. The Hospital
// Cloister is an indoor hex whose access is governed by its door list
// (single plaza entry plus the existing corridor link), not by a wall-ring.
export const STRUCTURES = [];

// Services this district references. The temple-scribe desk is named inside
// the Hospital Cloister's description but not bound as a tile service in
// this pass; declare it here so Wave 3 S1 adds it to BUILDINGS for future
// binding (matches the noble-rise pattern with marriage-clerk).
export const SERVICES = [
  "oath-priest",
  "hospital-sister",
  "temple-scribe",
];
