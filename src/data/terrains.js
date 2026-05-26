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
  // City walls — impassable stone mass. The Great Wall of Whitemarch is
  // three hexes thick: an inner face, the wall-walk in the middle (passable
  // via stairs only — see `wall_top`), and an outer face. The two faces are
  // wall terrain; the middle is wall_top. Speed is high (movement is denied
  // by isPassable, but kept consistent so debug routing reports a sane cost).
  wall:       { color: "#4a473f", label: "Wall",       speed: 999,  flavor: "great stone wall",      dark: true  },
  // Wall-walk — the walkway ON TOP of the Great Wall, accessible only via
  // the wall-stairs and the gatehouse roofs. Once you're up, the wall-top
  // hexes mesh-connect along the ring so you can walk the whole circuit
  // (broken only at the gate, where the gatehouse roof bridges across).
  // Visually lighter stone than the wall faces, with sky around you.
  wall_top:   { color: "#7a7569", label: "Wall-walk",  speed: 0.5,  flavor: "stone wall-walk",       dark: false },
  plains:     { color: "#C8C476", label: "Plains",     speed: 1.0,  flavor: "open grass",            dark: false },
  hills:      { color: "#A07B4D", label: "Hills",      speed: 1.4,  flavor: "rolling slopes",        dark: false },
  forest:     { color: "#647037", label: "Forest",     speed: 1.5,  flavor: "dense wood",            dark: true  },
  marsh:      { color: "#6E7B6E", label: "Marsh",      speed: 1.8,  flavor: "wet ground",            dark: true  },
  mountains:  { color: "#4A3A2C", label: "Mountains",  speed: 2.5,  flavor: "stark stone",           dark: true  },
  water:      { color: "#466F86", label: "Water",      speed: 999,  flavor: "deep water",            dark: true  },
};
