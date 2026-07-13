// Default World Map Layout
// Used as the seed data and fallback starting point.
// Contains key nodes (cities, villages, ruins, shrines) and connections (roads).

export const DEFAULT_NODES = [
  {
    id: "whitemarch",
    name: "Whitemarch",
    kind: "city",
    terrain: "settlement",
    x: 0,
    y: 0,
    placeId: "whitemarch",
    description: "The walled iron-capital. Home of the Counting House and the Grand Market."
  },
  {
    id: "mire_crossroads",
    name: "Mire Crossroads",
    kind: "landmark",
    terrain: "road",
    x: 4,
    y: 0,
    description: "A soggy signpost where the High Road meets the marsh-paths."
  },
  {
    id: "mirecross",
    name: "Mirecross Village",
    kind: "village",
    terrain: "settlement",
    x: 10,
    y: 0,
    description: "A small peat-cutter settlement built on stilts above the standing water."
  },
  {
    id: "tannic_ruins",
    name: "Tannic Ruins",
    kind: "ruin",
    terrain: "forest",
    x: -6,
    y: -8,
    description: "The crumbling stones of an old imperial watchtower, now choked by birch roots."
  },
  {
    id: "pale_shrine",
    name: "Shrine of the Pale God",
    kind: "temple",
    terrain: "settlement",
    x: 2,
    y: 8,
    description: "A solitary stone archway where pilgrims burn sweet peat-bricks for the dead."
  }
];

export const DEFAULT_ROADS = [
  {
    from: "whitemarch",
    to: "mire_crossroads",
    terrain: "road",
    name: "The High Road",
    description: "A well-traveled paved road, though muddy at the margins."
  },
  {
    from: "mire_crossroads",
    to: "mirecross",
    terrain: "road",
    name: "The Peat Track",
    description: "A corduroy path of logs laid over the deep muck of the Mire."
  },
  {
    from: "whitemarch",
    to: "tannic_ruins",
    terrain: "road",
    name: "The Old Wood Path",
    description: "An overgrown trail winding through the twilight of the Tannic Wood."
  },
  {
    from: "mire_crossroads",
    to: "pale_shrine",
    terrain: "road",
    name: "Pilgrim's Way",
    description: "A dirt path beaten flat by centuries of bare-foot pilgrims."
  }
];
