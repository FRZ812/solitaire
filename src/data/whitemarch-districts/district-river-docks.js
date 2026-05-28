// River Docks — the eastern river-face of Whitemarch, looking out on the
// Whitewend. The bible (docs/region-planning/WHITEMARCH_CITY.md L279-320)
// frames this ward as "almost a second city: lower, wetter, louder, less
// patient with law unless law has a badge and backup." Tar, rope, mud, fish
// scales, river fog, customs awnings, dock gangs hauling sacks in rhythm,
// smugglers using legitimate noise as cover.
//
// Footprint: a single four-hex POI anchored at (4,-2) Quay Edge, expanded
// from the existing single-tile High Quay. Every member tile shares
// parent="whitemarch-river-docks" / parentName="River Docks" with distinct
// part/partName values, mirroring the Low Wards / Halfborn Hostel pattern.
//
// Out-of-box neighbours we deliberately do NOT touch:
//   - (4,0) Public Smith Row and (4,1) Forge Annex — Iron Quarter owns those
//     (and they sit outside this bounding box anyway). Crane Line at (4,-1)
//     preserves its existing outbound door to (3,0), which is the street
//     approach toward the Iron Quarter / Public Smith Row corridor.
//   - (5,-2) Quay Stair — owned by "whitemarch-walls" (a wall-walk stair on
//     the east wall). Crane Line at (4,-1) keeps its outbound door to the
//     Quay Stair so the wall-walk view of the river traffic still wires
//     through; the Quay Stair's reciprocal door to (4,-1) is unchanged.
//   - (3,-3), (4,-3), (2,-1), (2,-2), (3,0), (2,0) — out-of-box streets that
//     the existing (3,-1), (3,-2) tiles connected to. We preserve every one
//     of those outbound links on the rewritten footprint parts so the
//     door-graph upstream of this module is untouched.

export const DISTRICT_ID = "river-docks";
export const DISTRICT_NAME = "River Docks";

export const BOUNDING_BOX = { xmin: 3, xmax: 4, ymin: -3, ymax: -1 };

const PARENT      = "whitemarch-river-docks";
const PARENT_NAME = "River Docks";

export const TILES = {
  // ====================================================================
  // HIGH QUAY — 4-hex footprint (Quay Edge anchor + Crane Line +
  // Customs Awning + River Stairs). The anchor preserves the original
  // High Quay description tone — barges, tally-sticks, customs awnings —
  // and the trade-counter service (dock-customs-officer) lives on the
  // anchor and is shared by the Customs Awning sub-tile.
  // ====================================================================

  // ---------- Quay Edge (anchor, rewrite of the existing single tile) -----
  "4,-2": {
    terrain: "settlement",
    poi: {
      type: "dock",
      name: "High Quay",
      service: "dock-customs-officer",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "quay-edge",
      partName: "Quay Edge",
      description:
        "The quay stands above brown water on stone piles dark with tar. Barges crowd the cranes; customs officers work beneath armed awnings while dock-gangs haul sacks in rhythm, each man watching the tally-stick more closely than the river. The chain-tower shows downstream, and the smuggler-stairs are never far. The customs counter sits at the landward end of the planking, a tall desk with a ledger, a wax-stick, and an officer who has heard every story a barge can carry.",
    },
    // Preserve original outbound door to (3,-2) Customs Awning; extend
    // into the new Crane Line (4,-1) and River Stairs (3,-1) sub-tiles.
    // No direct door to the Quay Stair at (5,-2) — that connection lives
    // on Crane Line, which is where the wall-stair foot lands.
    doors: [
      { x: 3, y: -2 },
      { x: 4, y: -1 },
      { x: 3, y: -1 },
    ],
  },

  // ---------- Crane Line — riverfront working face, wall-stair foot ------
  "4,-1": {
    terrain: "settlement",
    poi: {
      type: "dock",
      name: "Crane Line",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "crane-line",
      partName: "Crane Line",
      description:
        "A line of timber cranes leaning out over the Whitewend, ropes greased dark, counterweights hanging in slings of iron-bound stone. Gang-bosses call the lifts in two languages and a third made out of whistles; the deck-planks bow underfoot with each load. The foot of the Quay Stair lands here against the east wall, so wall-watch and dock-gangs cross paths a dozen times an hour and pretend not to notice.",
    },
    // Preserve original outbound doors to (3,0) — street toward Iron
    // Quarter / Public Smith Row — and to (5,-2) Quay Stair (wall stair
    // foot). Add internal links to Quay Edge (4,-2) and River Stairs (3,-1).
    doors: [
      { x: 4, y: -2 },
      { x: 3, y: -1 },
      { x: 3, y: 0 },
      { x: 5, y: -2 },
    ],
  },

  // ---------- Customs Awning — armed-awning customs post, shared service -
  "3,-2": {
    terrain: "settlement",
    poi: {
      type: "dock",
      name: "Customs Awning",
      service: "dock-customs-officer",
      access: "conditional",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "customs-awning",
      partName: "Customs Awning",
      description:
        "A heavy canvas awning slung between iron poles, weighted with chain at the corners and shaded by a rank of pikes leaned against the post. Customs clerks work standing at a counter of planks across two barrels, stamping bonds and arguing tariffs in three accents at once. Two awning-guards lean on their pikes and watch the queue; entry past the rope is by writ, bond, or the officer's nod, and the nod has been bought before.",
    },
    // Preserve original outbound doors to (3,-3), (2,-2), (2,-1), (4,-3);
    // keep internal links to Quay Edge (4,-2) and River Stairs (3,-1).
    doors: [
      { x: 4, y: -2 },
      { x: 3, y: -3 },
      { x: 2, y: -2 },
      { x: 2, y: -1 },
      { x: 3, y: -1 },
      { x: 4, y: -3 },
    ],
  },

  // ---------- River Stairs — public stairs down to the water ------------
  "3,-1": {
    terrain: "settlement",
    poi: {
      type: "stair",
      name: "River Stairs",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "river-stairs",
      partName: "River Stairs",
      description:
        "Worn stone stairs cutting down from the quay-deck to a slick landing at the water's edge. Fish-wives rinse baskets, ferry-touts call across to the far bank, river priests chalk the day's flood-mark on the lowest dry step. A second flight slips off sideways into the pilings under the deck — smuggler-stair, everyone knows it, but the public face here is the open stairs and the wet stone and the small boats nosing in for a copper passage.",
    },
    // Preserve original outbound doors to (2,-1), (2,0), (3,0); keep
    // internal links to Quay Edge (4,-2), Customs Awning (3,-2), and
    // Crane Line (4,-1).
    doors: [
      { x: 4, y: -2 },
      { x: 3, y: -2 },
      { x: 4, y: -1 },
      { x: 2, y: -1 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
  },
};

// No sealed structures: River Docks sits along the river face but the wall
// hexes (5,-1), (5,-2), (5,-3) are owned by whitemarch-walls and lie
// outside this district's bounding box. Nothing to declare here.
export const STRUCTURES = [];

export const SERVICES = [
  "dock-customs-officer",
];
