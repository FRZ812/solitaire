// Iron Quarter — the narrow eastern strip of forges, annexes, and slag-yards
// pressed against the river wall. Public smiths take the front of the row; a
// restricted annex shelters the wall-watch's quenched-blade work behind it; and
// the open Work Yard below the row catches the finished iron before it is
// trucked away. The State Foundry chimneys rise above all three tiles, but the
// foundry doors themselves are not in this footprint — the Foreman who issues
// charcoal chits and signs for finished work stands at the Yard, which is the
// closest a citizen ever gets to the foundry without a state warrant.
//
// Footprint inside the bounding box (3..4, 0..2):
//
//   y=0: 3,0 Lower Petition Steps -- DO NOT TOUCH (Court-Guildhall owns).
//        4,0 PUBLIC SMITH ROW     -- rewritten as the "smith-row" part of the
//                                    Iron Quarter footprint. Preserves the
//                                    blacksmith service (trade button) and
//                                    the one-door wiring to (3,0) verbatim.
//   y=1: 3,1 Advocate Cloister    -- DO NOT TOUCH (Court-Guildhall owns).
//        4,1 FORGE ANNEX          -- rewritten as the "forge-annex" part.
//                                    Preserves wallside:true and the lone
//                                    door to (3,1) verbatim.
//   y=2: 3,2 Guild Court License   -- DO NOT TOUCH (Court-Guildhall owns).
//        4,2 WORK YARD            -- NEW tile. Open-air staging for finished
//                                    iron; the state-foundry-foreman keeps a
//                                    standing-desk under the chimneys here.
//
// Doors preserved verbatim:
//   - (4,0) Public Smith Row keeps doors:[{x:3,y:0}] — its only neighbour is
//     the Petition Steps street and the trade button is the only reason a
//     player visits the tile.
//   - (4,1) Forge Annex keeps doors:[{x:3,y:1}] and wallside:true — the
//     annex is a wall-bay, accessible only from the Cloister side.
//
// Doors on the new Work Yard (4,2): the existing pre-rewrite tile at (4,2)
// had doors:[{x:4,y:1},{x:3,y:2},{x:3,y:3},{x:4,y:3}]. We keep the same four
// neighbours so the surrounding street wiring stays intact:
//   - (4,1) Forge Annex — the annex's finished work comes down here.
//   - (3,2) Guild Court License Counter — Court-Guildhall's tile expects (4,2)
//     in its door list (and does list it), so the seam stitches both ways.
//   - (3,3) and (4,3) Guild Court parts — already list (4,2) in their own
//     door arrays per the live row, so cross-traffic stays valid.
//
// Services declared: state-foundry-foreman (Wave 3 S1 will add to BUILDINGS).
// The blacksmith service on (4,0) is already in BUILDINGS — preserved, not
// declared here, per the README's "declare every service id you reference"
// rule applied to NEW services only.

export const DISTRICT_ID   = "iron-quarter";
export const DISTRICT_NAME = "Iron Quarter";

export const BOUNDING_BOX = { xmin: 3, xmax: 4, ymin: 0, ymax: 2 };

const PARENT      = "whitemarch-iron-quarter";
const PARENT_NAME = "Iron Quarter";

export const TILES = {
  // ---------- Public Smith Row — anchor of the Iron Quarter footprint -----
  // Rewrite of the live (4,0) tile. Preserves the blacksmith service (the
  // engine's trade button reads this), the public access, the indoor terrain,
  // the existing description, and the lone door to (3,0). Adds the
  // parent/part fields so the multi-hex footprint coheres.
  "4,0": {
    terrain: "indoor",
    poi: {
      type: "smithy",
      name: "Public Smith Row",
      service: "blacksmith",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "smith-row",
      partName: "Public Smith Row",
      description:
        "The row rings from dawn to curfew; sparks skitter across wet stone and guild-marks hang above each forge. Behind the open shops, higher chimneys mark the state foundries where no customer is allowed to ask what is being cast. The smoke leans out over the Whitewend and the river takes it east.",
    },
    doors: [
      { x: 3, y: 0 },
    ],
  },

  // ---------- Forge Annex — wallside outwork of the row ------------------
  // Rewrite of the live (4,1) tile. Preserves restricted access, indoor
  // terrain, wallside flag, full description, and the lone door to (3,1).
  // Adds parent/part fields.
  "4,1": {
    terrain: "indoor",
    poi: {
      type: "smithy",
      name: "Forge Annex",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "forge-annex",
      partName: "Forge Annex",
      description:
        "An outwork of the Public Smith Row, set hard against the east wall so the smoke can vent through high louvres without filling the city. Two charcoal hearths and an oil-bath under hung tongs; the forge-master takes work the main row can't fit and quietly turns out the city's quenched-blade orders for the wall-watch.",
    },
    doors: [
      { x: 3, y: 1 },
    ],
    wallside: true,
  },

  // ---------- Work Yard — open-air staging under the foundry chimneys ----
  // NEW tile. Was an unnamed street at (4,2) in the live row. Becomes the
  // third part of the Iron Quarter footprint: an open settlement yard where
  // finished iron is mustered for the labor columns, slag is heaped against
  // the wall to be carted out, and the State Foundry's foreman keeps a
  // standing-desk to sign for delivered work and issue charcoal chits to
  // the public row. The foundry itself is not in this footprint — the
  // Foreman is the closest a citizen ever gets to its door.
  "4,2": {
    terrain: "settlement",
    poi: {
      type: "yard",
      name: "Iron Quarter Work Yard",
      service: "state-foundry-foreman",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "work-yard",
      partName: "Work Yard",
      description:
        "An open yard pressed against the east wall, half cobbled and half packed earth blackened by a century of dropped iron. Finished work is stacked here under tarred sailcloth — bar-stock, fitting-chain, bolt-bundles, the city's nailwork — and a heap of slag leans against the wall waiting for the carters who haul it down to the river. The chimneys of the State Foundry rise overhead, two of them never cold; the foundry's own gates are elsewhere, but the foreman stands the yard with a standing-desk, a tally-board, and a wooden box of charcoal chits, signing for delivered work from the public row and refusing to discuss anything beyond it.",
    },
    doors: [
      { x: 4, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
    ],
  },
};

// No sealed structures: the east wall already rings the Quarter, and the
// Forge Annex's wallside:true flag is the only wall-seam this footprint
// needs to declare. The State Foundry's chimneys and gates live outside
// this bounding box and are owned by no module yet.
export const STRUCTURES = [];

// The blacksmith service on (4,0) is preserved but already lives in
// BUILDINGS; only NEW services are declared here.
export const SERVICES = [
  "state-foundry-foreman",
];
