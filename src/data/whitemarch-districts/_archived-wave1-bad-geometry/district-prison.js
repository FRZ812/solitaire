// Prison & Workhouse — the city's holding-and-labour engine on the south-west
// wall, hard by Foundling Court and the Prison Stair. Wave-0 placed two tiles:
// (-3,6) Prison Gate / Family Rail (the public-facing waiting iron) and
// (-3,7) Prison Gate / Intake Desk (service `gaol`, where the warden's
// [INSPECT RIGHTS] flow happens). This module expands the Prison Gate
// footprint with the bible's missing visible details: the side-arch the
// work-gangs leave by, the outer approach to the chain-room where sergeants
// pause, and the public petitioner step where families gather before stepping
// to the rail.
//
// Footprint: one multi-hex POI parented to "whitemarch-prison-gate" /
// "Prison Gate", with each member tile carrying a distinct part/partName.
//
// Out-of-box / DO-NOT-TOUCH neighbours that this module respects but does
// NOT rewrite:
//   - (-5,6) Foundling Court — owned by another district authoring pass.
//   - (-4,7) Prison Stair — already authored on the wall ring; its existing
//     door to (-4,6) is preserved by giving the Work-Gang Side Arch a
//     matching door back.
//   - (-3,8), (-4,8), (-5,7) — wall hexes inside our box that are already
//     correct; we leave them alone (no rewrite).
//   - (-3,5) — unnamed street outside our south boundary; its existing door
//     to (-4,5) and (-4,6) is preserved by the new tiles dooring back.
//
// Access doctrine: Family Rail and the Petitioner Step are public (families,
// petitioners, the watch above). Everything past the gate — Intake Desk,
// Work-Gang Side Arch, Chain Room Approach — is restricted.

export const DISTRICT_ID = "prison";
export const DISTRICT_NAME = "Prison & Workhouse";

export const BOUNDING_BOX = { xmin: -5, xmax: -3, ymin: 5, ymax: 8 };

const PARENT      = "whitemarch-prison-gate";
const PARENT_NAME = "Prison Gate";

export const TILES = {
  // ---------- Family Rail (preserved Wave-0 tile, re-asserted) -------------
  // Public iron rail where families wait. Doors kept as-is: (-3,5) street
  // approach and (-3,7) Intake Desk. Description preserved verbatim.
  "-3,6": {
    terrain: "settlement",
    poi: {
      type: "prison",
      name: "Prison Gate",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "family-rail",
      partName: "Family Rail",
      description:
        "An iron rail set in the street west of the Prison's main door, where families wait with food, bedding, and writs that may or may not be read inside. Children play between the bars; old women keep their place by knitting on stools they own by tenancy of return. The watch on the wall above takes no count of who comes here, only of who leaves.",
    },
    doors: [
      { x: -3, y: 5 },
      { x: -3, y: 7 },
    ],
  },

  // ---------- Intake Desk (preserved Wave-0 tile, re-asserted) -------------
  // The service `gaol` lives HERE — this is where the warden's
  // [INSPECT RIGHTS] flow runs. Description and doors preserved verbatim.
  "-3,7": {
    terrain: "indoor",
    poi: {
      type: "prison",
      name: "Prison Gate",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "intake-desk",
      partName: "Intake Desk",
      service: "gaol",
      description:
        "No ornament but old nail-scars on the door. Intake clerks sort names under a lantern that burns all day; the chain-room waits behind, and the work-gangs leave by the side-arch before dawn and return at dusk, counted twice — once by the gaolers, once by the Registry man.",
    },
    doors: [
      { x: -4, y: 7 },
      { x: -3, y: 6 },
    ],
  },

  // ---------- Work-Gang Side Arch — restricted, the dawn/dusk muster -------
  // The side arch the work-gangs pass through twice a day on their way to
  // and from the wall and the under-works. Connects to the Family Rail at
  // (-3,6) (gangs are mustered past the watching families) and to the
  // Prison Stair at (-4,7) (the wall-watch above counts every chain that
  // goes through). Also connects back to the Chain Room Approach at (-4,5)
  // so a sergeant can step from chain-room to muster without crossing the
  // public rail.
  "-4,6": {
    terrain: "settlement",
    poi: {
      type: "prison",
      name: "Prison Gate",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "work-gang-arch",
      partName: "Work-Gang Side Arch",
      description:
        "A low stone arch in the prison wall, narrower than a cart and taller than a chained man with his head down. The gangs leave by it before dawn and return at dusk, two by two on a single chain, counted at the threshold by a gaoler with a tally-stick and again from the stair above by the wall-watch. The flagstones beneath the arch are worn into a single rutted line. The arch is barred at night with a beam that takes three men to lift.",
    },
    doors: [
      { x: -3, y: 6 },
      { x: -4, y: 5 },
      { x: -4, y: 7 },
    ],
  },

  // ---------- Chain Room Approach — restricted, the sergeants' pause ------
  // The outer approach to the chain-room itself, where sergeants pause to
  // check irons and read the day's list before the gangs go through the
  // side arch. Keeps the existing connectivity into this junction: out to
  // the (-3,5) street, the (-5,6) Foundling Court door, the (-5,5)
  // petitioner step, the (-4,4) street, and the (-3,4) street — but
  // re-coloured as a restricted forecourt rather than open street. The
  // Foundling sisters' door is preserved (the sisters walk this corner
  // with food and bandages for the gangs); families do not pass through.
  "-4,5": {
    terrain: "settlement",
    poi: {
      type: "prison",
      name: "Prison Gate",
      access: "restricted",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "chain-room-approach",
      partName: "Chain Room Approach",
      description:
        "A walled forecourt outside the chain-room proper. The irons themselves are stored within — through the inner door, where the sound is hammer on link and the smell is cold grease — but the sergeants pause here first, in the air, to read the day's list off a slate nailed by the lintel and to check the gangs as they're brought up from the cells. A bench against the wall is polished by the seat of one particular sergeant. The Foundling sisters' side-door opens off the corner; they bring bread and bandages, and are the only people not in irons or livery who walk this stone.",
    },
    doors: [
      { x: -3, y: 5 },
      { x: -3, y: 4 },
      { x: -4, y: 4 },
      { x: -5, y: 6 },
      { x: -4, y: 6 },
      { x: -5, y: 5 },
    ],
  },

  // ---------- Petitioner Step — public, the families' approach corner ----
  // The public-facing corner where families gather BEFORE stepping up to
  // the Family Rail itself. Petition-writers work the kerb here; a saint's
  // niche at the wall takes wax stubs from those waiting on a name. Door
  // to (-4,5) is the path the sisters and sergeants use; door to (-4,4)
  // is the open street back into the city.
  "-5,5": {
    terrain: "street",
    poi: {
      type: "plaza",
      name: "Prison Gate",
      access: "public",
      parent: PARENT,
      parentName: PARENT_NAME,
      part: "petitioner-step",
      partName: "Petitioner Step",
      description:
        "The kerb-corner where families gather before they walk up to the Family Rail proper — a clear stone step worn shallow by feet that come back week after week. A petition-writer keeps a folding desk against the wall on court days and reads charges back to weeping people for a copper a sheet. A saint's niche set into the corner takes wax stubs from those waiting on a name; the stubs are swept off each dawn by whichever Foundling sister comes by with the bread.",
    },
    doors: [
      { x: -4, y: 5 },
      { x: -4, y: 4 },
    ],
  },
};

// No new sealed structures — the prison's wall ring is already authored on
// the Whitemarch walls (Prison Stair at -4,7 and the wall hexes at -3,8 /
// -4,8 / -5,7). This module only fills in the gate's interior footprint.
export const STRUCTURES = [];

// `gaol` is the service the warden's [INSPECT RIGHTS] flow keys off
// (system-prompt.js line 539). Already on the (-3,7) tile in Wave-0; we
// declare it here so the seed-script's BUILDINGS audit accounts for it
// against this module's tiles.
export const SERVICES = [
  "gaol",
];
