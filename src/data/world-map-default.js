// Atlas-scale fallback anchors layered around the bundled Whitemarch capital.
//
// The capital itself is compiled by data/whitemarch-capital.js and occupies the
// same axial coordinate space as the continent.  Do not duplicate its streets
// or services here: this file is only for sparse, non-conflicting atlas labels.
// The procedural continent owns the wider road network and regional landmarks.

export const DEFAULT_NODES = [
  {
    id: "whitemarch",
    name: "Whitemarch",
    kind: "city",
    terrain: "settlement",
    x: 0,
    y: 0,
    atlasLandmark: true,
    description:
      "Avarra's walled iron-capital, gathered around Grain Square and the Whitewend quays.",
  },
];

// Continental routes are generated from data/continent.js. Keeping this list
// empty avoids painting an obsolete handful of macro roads across the expanded
// city's local street grid.
export const DEFAULT_ROADS = [];
