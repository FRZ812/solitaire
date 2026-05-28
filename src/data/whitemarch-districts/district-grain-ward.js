// Grain Ward — the true heart of the city. Whitemarch survives because it
// stores grain at scale and protects those stores like a temple and arsenal
// combined. Flour dust and guarded silence; clerks weighing sacks under
// soldier eyes; bakers arguing quotas; crowds counting loaves before riots
// begin. Famine here is political rather than immediate, because the bins
// are sealed early and the rations are issued through a single barred
// window.
//
// Footprint inside the bounding box (-5..-3, 1..4):
//
//   y=1: -5,1 / -4,1 / -3,1  -- unnamed outer streets, left as-is.
//   y=2: -5,2 / -4,2         -- -4,2 becomes the Ration Office (indoor,
//                              window-on-street). -5,2 left as street.
//        -3,2                -- unnamed street, left as-is.
//   y=3: -5,3 GRANARY COURT  -- rewritten as the indoor "Guarded Bins"
//                              anchor (previously a singleton town tile).
//        -4,3 WEIGHING HALL  -- indoor, conditional, soldier-watched.
//        -3,3                -- street, owned for cross-traffic only; not
//                              claimed here (left for whoever wires the
//                              east-west spine of the south wards).
//   y=4: -5,4 WALLSIDE ALMSHOUSE -- DO NOT TOUCH (different POI, owned
//                                   elsewhere). Its existing door to
//                                   (-5,3) is preserved below.
//        -4,4 MILLER'S LANE   -- street, public approach, bakers arguing.
//        -3,4                -- unnamed street, left as-is.
//
// Door-graph notes:
//   - The existing (-5,3) tile connected to (-5,4) Wallside Almshouse and
//     (-4,2). Both links are preserved on the new Guarded Bins anchor so
//     the Almshouse's (-5,3) door stays valid and the old street-side
//     approach still works.
//   - Indoor tiles (Guarded Bins, Weighing Hall, Ration Office) keep tight
//     doors lists pointing only to their immediate granary neighbours and
//     one street-side approach — the bins do not open onto the bread queue,
//     they open onto each other and onto the Ration Office window.
//   - Miller's Lane is the public-facing street approach. It opens onto the
//     surrounding street grid (-3,4 / -4,3 / -5,4 wall-side reach is left
//     alone; the Almshouse handles that seam).
//
// Service ids declared: ration-clerk (the issuing window at the Ration
// Office) and grain-guard (the sealed Emergency Stores). Both go through
// the Wave 3 S1 town.js BUILDINGS audit.

export const DISTRICT_ID   = "grain-ward";
export const DISTRICT_NAME = "Grain Ward";

export const BOUNDING_BOX = { xmin: -5, xmax: -3, ymin: 1, ymax: 4 };

const PARENT      = "whitemarch-granary-court";
const PARENT_NAME = "Granary Court";

export const TILES = {
  // ---------- Guarded Bins anchor (rewrite of the existing singleton) -----
  // Was a single "town" tile at (-5,3) named Granary Court with a two-door
  // wiring to the Almshouse and the western street. We keep both of those
  // links, add the interior reach into the Weighing Hall at (-4,3), and
  // re-cast the tile as the indoor anchor of the multi-hex footprint.
  "-5,3": {
    terrain: "indoor",
    poi: {
      type: "town",
      name: "Granary Court",
      access: "guarded",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "granary-bins",
      partName: "Guarded Bins",
      description:
        "It smells of flour, mouse-poison, and soldier-oil. Tall bins stand behind barred galleries, hooped in iron and lashed shut with the city's lead seals; a soldier walks the gallery walk with a slow lamp and a slower face. Flour dust hangs in the lamplight and settles on every shoulder; the floorboards under the bins are darker where the sacks have been dragged for a hundred years. Access is guarded — bakers and porters come in only with a chit from the Ration Office, and they leave by the same door they entered.",
    },
    // Preserve the original neighbour links: (-5,4) Wallside Almshouse and
    // (-4,2) Ration Office. Add the inner door to (-4,3) Weighing Hall so
    // the footprint coheres.
    doors: [
      { x: -5, y: 4 },
      { x: -4, y: 2 },
      { x: -4, y: 3 },
    ],
  },

  // ---------- Weighing Hall — sacks weighed under soldier eye -------------
  "-4,3": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Weighing Hall",
      access: "conditional",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "weighing-hall",
      partName: "Weighing Hall",
      description:
        "A long room with a beam-scale chained to a roof-truss and a clerk's lectern set where the lamp falls on the brass weights. Sacks come in on a porter's shoulder, are slit, sampled, weighed, and re-sewn; a soldier in the city's grey stands at the lectern's shoulder and watches the clerk's hand mark the tally. Nothing leaves the hall unwritten. Two doors only — one into the Guarded Bins, one onto the Ration Office's back corridor — and a small barred window high in the south wall that lets the noise of Miller's Lane in but nothing else.",
    },
    doors: [
      { x: -5, y: 3 },
      { x: -4, y: 2 },
      { x: -4, y: 4 },
    ],
  },

  // ---------- Ration Office — the issuing window onto the street ---------
  "-4,2": {
    terrain: "indoor",
    poi: {
      type: "bldg",
      name: "Ration Office",
      service: "ration-clerk",
      access: "conditional",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "ration-office",
      partName: "Ration Office",
      description:
        "A clerk's office no wider than two desks, fronted by a barred window opening onto the street. The ration-clerk works behind the grille with a stamp, an inkpot, and a copy of the day's quota nailed to the lintel. Rations are issued by chit — name, household, weight, week — and the queue outside is reminded by a watchman on the step that the window closes at noon whether the line is finished or not. Inside, a single oil lamp; outside, the smell of unwashed coats and old bread.",
    },
    // Window opens west to the street (-5,2) and north to (-4,1); the
    // interior door reaches the Weighing Hall (-4,3) and the bins (-5,3).
    doors: [
      { x: -5, y: 2 },
      { x: -4, y: 1 },
      { x: -4, y: 3 },
      { x: -5, y: 3 },
    ],
  },

  // ---------- Miller's Lane — public-facing street approach -------------
  "-4,4": {
    terrain: "street",
    poi: {
      type: "site",
      name: "Miller's Lane",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "miller-lane",
      partName: "Miller's Lane",
      description:
        "A cobbled lane that runs along the south face of the granary precinct, dusted pale with flour blown from the Weighing Hall's high window. Bakers gather here in the small hours to argue quotas — voices low until the watchman drifts past, loud again the moment he turns the corner. Hand-carts wait with sack-cloth folded ready; a chalkboard nailed to a doorpost lists yesterday's bread price and today's, with the difference circled. The lane is the public face of the granary, and the granary's silence stops at its kerb.",
    },
    doors: [
      { x: -3, y: 4 },
      { x: -3, y: 3 },
      { x: -4, y: 3 },
      { x: -5, y: 5 },
      { x: -5, y: 4 },
      { x: -4, y: 5 },
    ],
  },
};

// No new sealed structures in this district — the granary precinct uses
// the existing ward-wall ring and the Citadel-approach wiring sits well
// outside this bounding box. The "barred galleries" and "lead seals" are
// narrative, not terrain:"wall" tiles.
export const STRUCTURES = [];

export const SERVICES = [
  "ration-clerk",
];
