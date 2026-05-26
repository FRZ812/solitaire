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
  // City walls — impassable stone mass. Retained as a terrain definition
  // because saved games / legacy maps may still reference it, but the
  // Great Wall of Whitemarch no longer places any "wall" hexes: the inner
  // and outer stone faces were removed, leaving only the wall-walk ring.
  // Speed is high (movement is denied by isPassable, but kept consistent
  // so debug routing reports a sane cost).
  wall:       { color: "#4a473f", label: "Wall",       speed: 999,  flavor: "great stone wall",      dark: true  },
  // Wall-walk — the single ring of walkable stone that IS the Great Wall.
  // Accessible only via the wall-stairs and the gatehouse roofs. Once
  // you're up, the wall-top hexes mesh-connect along the ring so you can
  // walk the whole circuit (broken only at the gate, where the gatehouse
  // roof bridges across). The ring's doors list (see data/handcrafted-
  // tiles.js wall generator) excludes adjacent city streets and adjacent
  // procedural exterior — so the wall still seals the city, and the only
  // way up is the stairs from inside.
  wall_top:   { color: "#7a7569", label: "Wall-walk",  speed: 0.5,  flavor: "stone wall-walk",       dark: false },
  plains:     { color: "#C8C476", label: "Plains",     speed: 1.0,  flavor: "open grass",            dark: false },
  hills:      { color: "#A07B4D", label: "Hills",      speed: 1.4,  flavor: "rolling slopes",        dark: false },
  forest:     { color: "#647037", label: "Forest",     speed: 1.5,  flavor: "dense wood",            dark: true  },
  marsh:      { color: "#6E7B6E", label: "Marsh",      speed: 1.8,  flavor: "wet ground",            dark: true  },
  mountains:  { color: "#4A3A2C", label: "Mountains",  speed: 2.5,  flavor: "stark stone",           dark: true  },
  water:      { color: "#466F86", label: "Water",      speed: 999,  flavor: "deep water",            dark: true  },
};
