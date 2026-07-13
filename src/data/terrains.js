export const TERRAINS = {
  // Urban tiers — STREET is the cheapest, so A* routes preferentially along
  // the city's street network. SETTLEMENT (built ground — markets, yards,
  // tenement courts) is slightly slower; INDOOR (a sealed building's
  // interior — halls, foundries, archives) is slower still. The previous
  // indoor=0.15 made every building cheaper-than-street and turned every
  // indoor tile into a preferred transit hex; the new ordering keeps the
  // path graph routed where the city's lanes actually run.
  indoor:     { color: "#6B4A2E", label: "Indoor",     speed: 1.0,  flavor: "a building's interior", dark: true },
  settlement: { color: "#E2C475", label: "Settlement", speed: 0.7,  flavor: "built ground",          dark: false },
  street:     { color: "#B0A48A", label: "Street",     speed: 0.4,  flavor: "paved city street",     dark: false },
  road:       { color: "#BFA572", label: "Road",       speed: 0.7,  flavor: "old paving",            dark: false },
  // Wall — the mountable fortress wall. Walkable along its length once
  // you're up there (via a stair, a gatehouse roof, or any opened edge).
  // Author the edge graph so wall hexes only connect to other walls,
  // stairs, and gatehouse buildings; the rest of the perimeter naturally
  // becomes "non-mountable" because plains/water/mountains adjacent to
  // the wall have no door across the boundary. Non-mountable barriers
  // elsewhere just use existing impassable terrain (water, etc.) — there
  // is no separate "impassable wall" terrain anymore.
  wall:       { color: "#7a7569", label: "Wall",       speed: 0.5,  flavor: "stone wall",            dark: false },
  plains:     { color: "#C8C476", label: "Plains",     speed: 1.0,  flavor: "open grass",            dark: false },
  hills:      { color: "#A07B4D", label: "Hills",      speed: 1.4,  flavor: "rolling slopes",        dark: false },
  forest:     { color: "#647037", label: "Forest",     speed: 1.5,  flavor: "dense wood",            dark: true  },
  marsh:      { color: "#6E7B6E", label: "Marsh",      speed: 1.8,  flavor: "wet ground",            dark: true  },
  mountains:  { color: "#4A3A2C", label: "Mountains",  speed: 2.5,  flavor: "stark stone",           dark: true  },
  water:      { color: "#466F86", label: "Water",      speed: 999,  flavor: "deep water",            dark: true  },
  impassable: { color: "rgba(12, 17, 16, 0.85)", label: "Wilderness", speed: 999, flavor: "choking thicket and trackless waste", dark: true },
};
