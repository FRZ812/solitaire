// Court Hill + Guildhall Row — the legal spine of Whitemarch. Where the city
// turns conflict into documents and craft into licence. The Petition Steps
// crowd is wet, anxious, and bargained-over before it ever reaches a clerk;
// the cloister above sells the language that makes a petition legible; the
// Guild Court a few streets south does the same trick with apprentices and
// fines. The two POIs share a quiet trade: an advocate licensed at the Steps
// is also the back-door advocate the Guild Court hears without delay.
//
// Footprint inside the bounding box (2..4, 0..3):
//
//   y=0: 2,0 Registry Hall lease-desk   -- DO NOT TOUCH (Chain Ward owns).
//        3,0 LOWER PETITION STEPS (anchor) -- rewritten as Petition Steps.
//        4,0 Public Smith Row            -- DO NOT TOUCH (Iron Quarter).
//   y=1: 2,1 Registry Hall public-cnt.  -- DO NOT TOUCH (Chain Ward owns).
//        3,1 ADVOCATE CLOISTER          -- new indoor, part of Petition footprint.
//        4,1 Forge Annex                -- DO NOT TOUCH (Iron Quarter).
//   y=2: 2,2 unnamed street             -- left untouched (Registry approach).
//        3,2 GUILD COURT licence-counter -- new, extends Guild Court footprint.
//        4,2 unnamed street             -- left untouched; its existing doors
//                                          already reach (3,2) and (3,3) which
//                                          keeps the Guild Court approach sane.
//   y=3: 2,3 unnamed street             -- left untouched.
//        3,3 Guild Court apprentice-rolls -- DO NOT REWRITE; existing doors
//                                            already include (3,2), so adding
//                                            License Counter as a third part
//                                            needs no edit to this tile.
//        4,3 Guild Court masters-benches -- DO NOT REWRITE.
//
// Doors preserved from the live row:
//   - (3,0) Lower Petition Steps had doors to (4,0)(3,-1)(2,0)(2,1)(3,1)(4,-1).
//     All six are preserved on the Petition Steps anchor rewrite below; the
//     anchor still reads onto Smith Row, the Registry counters, the Citadel
//     approach street, and the wall-corner hex out of box.
//   - (3,3) and (4,3) Guild Court parts are not rewritten, so their existing
//     door arrays remain authoritative.
//
// Services declared: court-advocate (Cloister), guild-court-clerk (License
// Counter). The Petition Steps anchor itself surfaces the advocate service so
// the queue-tile has a counter the player can interact with without first
// having to push into the cloister.

export const DISTRICT_ID   = "court-guildhall";
export const DISTRICT_NAME = "Court Hill + Guildhall Row";

export const BOUNDING_BOX = { xmin: 2, xmax: 4, ymin: 0, ymax: 3 };

const COURT_HILL       = "whitemarch-court-hill";
const COURT_HILL_NAME  = "Court Hill";
const GUILD_COURT      = "whitemarch-guild-court";
const GUILD_COURT_NAME = "Guild Court";

export const TILES = {
  // ---------- Lower Petition Steps anchor (rewrite of the live tile) -------
  // Anchor of the Court Hill footprint. Preserves the live door list verbatim
  // so neighbour wiring (Smith Row, Registry, the wall-corner approach) is
  // untouched. Adds the court-advocate service so the queue itself is a
  // working counter — a runner posted at the foot of the stairs takes
  // names for the cloister above without the petitioner having to climb.
  "3,0": {
    terrain: "street",
    poi: {
      type: "hall",
      name: "Lower Petition Steps",
      service: "court-advocate",
      access: "public",
      parent: COURT_HILL,
      parentName: COURT_HILL_NAME,
      part: "petition-steps",
      partName: "Petition Steps",
      description:
        "A broad paved approach crowded from sunrise: widows with petitions, debtors with sponsors, merchants with sealed cases, foreigners with interpreters, and soldiers escorting people who learned too late that law moves faster than mercy. The advocate-cloister stands above; debt-collectors wait below. A runner at the foot of the stairs takes names for the cloister, and a chalked board lists today's hearings beside a brazier the petitioners crowd around in wet weather.",
    },
    doors: [
      { x: 4, y: 0 },
      { x: 3, y: -1 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: -1 },
    ],
  },

  // ---------- Advocate Cloister — licensed bench above the Steps ----------
  // Indoor, conditional access: the door is open, but the advocates only sit
  // for petitioners whose papers a runner has already vouched for. Wired to
  // the Steps for the public entrance and to the License Counter behind the
  // cloister — the same advocates who argue petitions hold guild licences
  // and slip through the back door to the Guild Court without queuing.
  "3,1": {
    terrain: "indoor",
    poi: {
      type: "hall",
      name: "Advocate Cloister",
      service: "court-advocate",
      access: "conditional",
      parent: COURT_HILL,
      parentName: COURT_HILL_NAME,
      part: "advocate-cloister",
      partName: "Advocate Cloister",
      description:
        "A covered cloister above the Petition Steps where the city's licensed advocates keep their benches. Each bay is a separate practice — a stained cuff, a ledger of past judgements, a saint above the desk — and the next petitioner is called only when a runner from the Steps has vouched for the papers. The cloister is quiet in the way an arrow is quiet: every voice is measured for what a clerk could later be made to write down. A side door at the back lets a licensed advocate cut through to the Guild Court's licence counter without crossing the public yard.",
    },
    doors: [
      { x: 3, y: 0 },
      { x: 3, y: 2 },
    ],
  },

  // ---------- Guild Court License Counter (third part of the footprint) ----
  // Settlement counter at the Guild Court's public face. Issues craft
  // licences, takes renewal fees, posts revocations. Door to (3,3) keeps the
  // footprint stitched to the apprentice-rolls yard (which already lists
  // (3,2) in its doors); door to (4,2) lets the petitioner approach from the
  // Guildhall Row street; door to (2,3) opens the western approach; the back
  // door to the Advocate Cloister (3,1) is the quiet channel the cloister's
  // description mentions. Skips (2,2) (Registry approach, not our concern)
  // and (3,1) is reached only by the licensed back-door, not the public.
  "3,2": {
    terrain: "settlement",
    poi: {
      type: "court",
      name: "Guild Court",
      service: "guild-court-clerk",
      access: "public",
      parent: GUILD_COURT,
      parentName: GUILD_COURT_NAME,
      part: "license-counter",
      partName: "License Counter",
      description:
        "A covered counter set into the north face of the Guild Court, where the day's licences are issued, renewed, refused, or quietly revoked. The clerk's wax-stamp comes down with the same dry click for a master cooper paying his guild's fee and for a journeyman being told his trade is no longer his. A board behind the counter lists the revocations of the past month and the fines that came with them; a side door at the back of the counter opens onto the cloister where the city's advocates sit, and the licensed ones use it without asking.",
    },
    doors: [
      { x: 3, y: 3 },
      { x: 4, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 1 },
    ],
  },
};

// No sealed structures: Court Hill and Guildhall Row are inside the existing
// city wall ring, and their inter-district seams (Registry Hall west, Iron
// Quarter east) are owned by other modules. The conditional access on the
// cloister and the License Counter's public door cover the social
// firebreaks; no terrain:"wall" hex is authored here.
export const STRUCTURES = [];

export const SERVICES = [
  "court-advocate",
  "guild-court-clerk",
];
