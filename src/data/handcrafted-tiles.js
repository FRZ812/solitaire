// Whitemarch — the walled capital, the only handcrafted place on the map. The
// world was wiped to a clean slate (no rumored/fabled landmarks, no rivers) and
// rebuilt around this one city at the origin; everything beyond the wall falls
// through to procedural generation (see world.js getTile). The rich Mirecross
// original is preserved in handcrafted-tiles.legacy.js (not imported).
//
// The city is laid out as a SPACIOUS street grid with BUILDING islands set
// into it. Every named building sits with three or more street neighbours;
// every cluster of buildings (the Grand Market, the Chain Ward, the
// Citadel) is ringed by streets so the path graph can always route AROUND
// a district instead of THROUGH it. Streets fill the gaps between
// buildings; buildings never share a long edge without a street alternative
// running parallel. See data/sealed-structures.js for the partition and
// the wall/gate authoring.
//
// Coordinates are axial (pointy-top hex), ~250m each, anchored at (0,0) =
// Grain Square (the player start). Multi-hex places (the Grand Market,
// the Crown Gate gatehouse, the Citadel) are authored as footprints —
// adjacent member hexes sharing a `parent` so the map draws them as one
// place (one icon, one name on select) while each hex keeps its own
// access and detail. Walls/gates are authored in
// data/sealed-structures.js; the auto-application at the bottom of this
// file compiles them into the `doors` graph the engine enforces (world.js
// edgeAllowed / findPath) and the map draws as walls.

import { SEALED_STRUCTURES } from "./sealed-structures.js";

const HEX_DIRS = [
  { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 },
];

// ---- Footprint parents (multi-hex places that read as one) ----
const CROWN_GATE = {
  parent: "whitemarch-crown-gate",
  parentName: "The Crown Gate",
  type: "gate",
};
const GRAND_MARKET = {
  parent: "whitemarch-grand-market",
  parentName: "The Grand Market",
  type: "market",
};
const CITADEL = {
  parent: "whitemarch-citadel",
  parentName: "The Citadel",
};
const CHAIN_MARKET_STEPS = {
  parent: "whitemarch-chain-market-steps",
  parentName: "Chain Market Steps",
  type: "slavemarket",
};
const REGISTRY_HALL = {
  parent: "whitemarch-registry-hall",
  parentName: "Registry Hall",
  type: "hall",
};
const PRISON_GATE = {
  parent: "whitemarch-prison-gate",
  parentName: "Prison Gate",
  type: "prison",
};
const CARAVAN_YARD = {
  parent: "whitemarch-caravan-yard",
  parentName: "Caravan Yard & Stable",
  type: "yard",
};
const GUILD_COURT = {
  parent: "whitemarch-guild-court",
  parentName: "Guild Court",
  type: "court",
};
// The Underworks sit beyond the Sewer Mouth's `doors:[]` seal — entry is
// action-gated (narrator-driven) by design. Each member hex carries
// `area: "underworks"` so the wall generator can recognise and skip them
// when computing the city's wall band (see exclusion below). Members
// otherwise look like ordinary indoor tiles.
const UNDERWORKS = {
  area: "underworks",
  areaName: "The Underworks",
  parent: "whitemarch-underworks",
  parentName: "The Underworks",
  type: "sewer",
};

export const HANDCRAFTED = {
  // ============================================================
  // GATE SQUARE — the open paved square just inside the city, where the
  // Crown Gate complex empties into the streets. Was the Crown Road
  // Approach in the old (thin-wall) layout; now the road is much farther
  // out beyond the wall (see (0,-7) below) and this hex is interior.
  // ============================================================
  "0,-3": { terrain: "street", poi: { type: "plaza", name: "Gate Square", access: "public", description: "A broad paved square just inside the Crown Gate's inner ward, where every wagon and pilgrim that clears the gate complex spills out into the city. Touts, porters, and idle Market Watch lean against the wall-stones; the gate's roar — wheels on stone, ox-bellows, the sergeants — beats out of the inner ward at every gate-bell and falls again as the queue moves." } },

  // ============================================================
  // NORTH WALL WALK — the inside-the-wall lane, broken at the gate. From
  // Wagon Lane in the west around past the Crown Guardpost and out to the
  // Dragon-Watch Tower's wall-stair in the east.
  // ============================================================
  "-2,-3": { terrain: "street", poi: null },
  "-1,-3": { terrain: "street", poi: null },
  "1,-3":  { terrain: "street", poi: null },
  "2,-3":  { terrain: "street", poi: null },

  // ============================================================
  // CROWN GATE — the only way through the Great Wall. Toll Hall is the
  // gatehouse; Inspection Yard is the open paved yard inside, which the
  // path graph uses as a street.
  // ============================================================
  "0,-2": { terrain: "settlement", poi: { type: "hall", name: "Customs Hall", access: "conditional", description: "The city's old toll-hall, kept on after the wall was thickened and the gate moved out into its own complex. Now the cleared paperwork goes here for archiving — sealed receipts, status-stamps, livestock-counts, every entry recorded against the gate's daily roll. Clerks come and go through the small side door; the main counters were boarded over when the new gatehouse opened." } },
  "0,-1": { terrain: "street", poi: { type: "plaza", name: "Crown Lane", access: "public", description: "The lane south of the gate complex, where porters and runners gather waiting for fares and the day's first newssheets are sold off a barrow. The gate's roar carries down the lane and falls again as the queue moves inside the Inner Ward." } },

  // ============================================================
  // CROWN GUARDPOST — gate-guard barracks set into the wall beside Toll
  // Hall on the west side.
  // ============================================================
  "-1,-2": { terrain: "indoor", poi: { type: "barracks", name: "Crown Guardpost", access: "restricted", description: "A squat barracks-block built into the wall beside the gate. Bunks stacked three high under low rafters; pike-racks polished by passing shoulders; a kettle always near boil over a peat-fire that the sergeants refuse to let go out. The gate-watch sleeps here in shifts, and the city's first answer to a gate-side problem is whoever happens to be lacing boots." } },

  // ============================================================
  // GATE LANES — the streets that flank the gate on the inside.
  // ============================================================
  "-3,-2": { terrain: "street", poi: null },
  "-2,-2": { terrain: "street", poi: null },
  "1,-2":  { terrain: "street", poi: null },
  "2,-2":  { terrain: "street", poi: null },
  "3,-2":  { terrain: "street", poi: null },

  // ============================================================
  // DRAGON-WATCH TOWER — the NE wall tower, looking north over the river.
  // ============================================================
  "3,-3": { terrain: "indoor", poi: { type: "tower", name: "Dragon-Watch Tower", access: "restricted", description: "The tower smells of oil, cold iron, and old smoke. Harpoon-frames point through open shutters; signal-mirrors hang under wool covers. On the central rack rests a bolt as long as a man, its head blackened by an alchemy no one in the room jokes about. Veteran watchers look north, where every clear sky is treated as a question." } },

  // ============================================================
  // CARAVAN YARD ROW — the Caravan Yard & Stable is a 2-hex footprint:
  // Wagon Lines & Stalls at (-2,-1) is the fenced yard proper (the wagon
  // park and the stable behind it); Hiring Board at (-3,-1) is the
  // open street-corner where the day's escort work is pinned. Wagon
  // Lane at (-1,-1) is the unloading street beside the gate-yard.
  // ============================================================
  "-3,-1": { terrain: "street", poi: { ...CARAVAN_YARD, part: "hiring-board", partName: "Hiring Board", name: "Caravan Yard & Stable", access: "public", description: "The west corner of the Caravan Yard, where the city's hiring-board is set under a rain-hood and the day's escort-work is pinned each morning. Guards loiter for the recruiter; brokers walk the line reading the postings aloud for those who cannot. One bloodstained scrap stays pinned past every weather; nobody has taken it down, and nobody will say why." } },
  "-2,-1": { terrain: "settlement", poi: { ...CARAVAN_YARD, part: "wagon-lines", partName: "Wagon Lines & Stalls", name: "Caravan Yard & Stable", service: "stable", access: "public", description: "A fenced acre of mud, canvas, and languages shouted over animals. Drivers cook beside their loads; guards sleep with boots on. Past the wagon-lines the stable runs hot — horses under striped blankets, mules biting the rails, a farrier burning hoof in blue smoke, and a military remount-pen behind a locked rail." } },
  "-1,-1": { terrain: "street", poi: null }, // Wagon Lane

  // ============================================================
  // NIGHT MARKET + HIGH QUAY — the eastern stalls and the riverfront. A
  // street lane runs the length of the east wall between them.
  // ============================================================
  "1,-1": { terrain: "settlement", poi: { ...GRAND_MARKET, part: "night-market", partName: "Night Market", name: "The Grand Market", access: "unofficial", description: "A shuttered stall-house north of the square — overflow storage by day, an unofficial market by night, when the lamps are hooded and the boards fold open. The city sells what it denies owning here: stolen tools, false papers, unlicensed charms, names, routes, poisons, and questions that cost extra if answered honestly. Lookouts watch for a Market Watch sweep." } },
  "2,-1": { terrain: "street", poi: null },
  "3,-1": { terrain: "settlement", poi: { type: "dock", name: "High Quay", access: "public", description: "The quay stands above brown water on stone piles dark with tar. Barges crowd the cranes; customs officers work beneath armed awnings while dock-gangs haul sacks in rhythm, each man watching the tally-stick more closely than the river. The chain-tower shows downstream, and smuggler-stairs are never far." } },

  // ============================================================
  // GRAND MARKET — the central plaza. Grain Square at the heart is a
  // street (the open square, the player's start); Butchers' Row, Cloth
  // Awnings, and Night Market are the three covered stall-houses that
  // open onto it. Through-traffic uses Grain Square or the lanes that
  // ring the four-hex footprint, never the stall-houses themselves.
  // ============================================================
  "0,0":  { terrain: "street", poi: { ...GRAND_MARKET, part: "grain-square", partName: "Grain Square", name: "The Grand Market", service: "market", access: "public", description: "Noise given stone. Flour dust drifts from sacks stacked taller than children; bakers argue quotas under guard eyes, farmers curse the weighers, and money-changers click brass pans at the square's quiet corner. Every crowd watches the bins with the private arithmetic of hunger. This is the city's civilian crossroads — and where you stand now." } },
  "1,0":  { terrain: "settlement", poi: { ...GRAND_MARKET, part: "butchers-row", partName: "Butchers' Row", name: "The Grand Market", access: "public", description: "A long covered row of meat-hooks east of the square. The boards run red by noon however often the apprentices throw water; dogs nose the gutters until kicked, and a city inspector chalks carcasses while customers judge freshness by smell, price, and how hungry they will admit to being." } },
  "0,1":  { terrain: "settlement", poi: { ...GRAND_MARKET, part: "cloth-awnings", partName: "Cloth Awnings", name: "The Grand Market", access: "public", description: "The southern stall-row of the market, roofed over in stitched awnings that turn the light to stained colour — bolts of wool, linen, and foreign silk beside boot-stalls, knife-trays, charm-strings, lamp-oil, and patched cloaks. Peddlers' voices are trained to find the coin in any passer-by, and pickpockets work the awning-shadows. The stalls open onto Grain Square; through traffic uses the square or the lanes around the market, not the rows themselves." } },

  // ============================================================
  // MARKET RING — the streets that ring the five-hex Grand Market. The
  // Coin Scales sit at the market's western corner: still a street (the
  // ring routing runs through it), but tagged as the market's quiet
  // money-changers' bay where price becomes debt becomes someone else's
  // problem.
  // ============================================================
  "-3,0": { terrain: "street", poi: null },
  "-1,0": { terrain: "street", poi: { ...GRAND_MARKET, part: "coin-scales", partName: "Coin Scales", name: "The Grand Market", access: "public", description: "The market's quiet western corner. Brass pans click under the hands of money-changers, pawnbrokers, appraisers, and contract witnesses; here a thing becomes a price, a price becomes a debt, and a debt becomes someone else's problem. Armed private guards stand close at the benches; the quiet brokers watch the Chain Ward traffic across the square and write the day's odds against any name they recognise." } },
  "2,0":  { terrain: "street", poi: { ...REGISTRY_HALL, part: "lease-desk", partName: "Lease Desk", name: "Registry Hall", access: "conditional", description: "An open street-counter set into Quay Lane south of the Hall's main door, where labour-lease contracts are written, witnessed, and stamped under an awning the city has never repaired. A clerk's bench, a sand-box for ink-blotting, and a queue of men with thumb-prints inked dark before they know what they have signed." } },
  "3,0":  { terrain: "street", poi: null },

  // ============================================================
  // HALFBORN HOSTEL — the Halfborn Hold's town-lodge for freed kin on
  // city business; west of the gate-yard.
  // ============================================================
  "-2,0": { terrain: "indoor", poi: { type: "town", name: "Halfborn Hostel", access: "public", description: "A long low hostel run by the Halfborn Hold for its own — freed kin in town for trade, witness, or recovery-writs against old owners. The common room smells of black tea and hammer-oil; a hammer-banded matron keeps the rolls and the rules, and the door-rule is plain: no chains inside, and any chain-collar at the threshold comes off before the bed is given. A small clinic-room serves any Halfborn the city has not yet finished bruising." } },

  // ============================================================
  // FOREIGN QUARTER — Embassy Lane on the west, set among streets.
  // ============================================================
  "-3,1": { terrain: "street", poi: null },
  "-2,1": { terrain: "settlement", poi: { type: "town", name: "Embassy Lane", access: "conditional", description: "The lane smells of unfamiliar tea, horse-sweat, and incense. Flags of distant courts hang beside Whitemarch seals; interpreters walk faster than soldiers, and every compound gate has someone watching from both sides. A treaty-inn, a foreign counting-house, and one quiet hostage-residence stand along it." } },
  "-1,1": { terrain: "street", poi: null },

  // ============================================================
  // CHAIN WARD — the public sale-plaza (Chain Market Steps) flanked by
  // Registry Hall to the east and the Grand Market's south wing to the
  // west. The Chain Market is a 3-hex L-shaped footprint: the Sale
  // Platform (the central plaza), the Petition Rail (where families
  // press papers through the bars), and the Viewing Yard (the covered
  // inspection yard east of the platform). All three remain street
  // terrain so the city's south-east through-traffic still routes
  // through the Chain Ward.
  // ============================================================
  "1,1": { terrain: "street", poi: { ...CHAIN_MARKET_STEPS, part: "sale-platform", partName: "Sale Platform", name: "Chain Market Steps", service: "slavemarket", access: "guarded", description: "The raised stone platform at the centre of the steps, paved in pale stone that shows stains quickly and is washed before the next bell. Status-criers work the platform under awnings; buyers stand close with their bidding-clerks at their elbow; the horror in this hex is its civic ordinariness — the bell-clock, the brass weights, the polite paperwork." } },
  "2,1": { terrain: "indoor", poi: { ...REGISTRY_HALL, part: "public-counters", partName: "Public Counters", name: "Registry Hall", access: "conditional", description: "Quieter than the Chain Market steps next door and worse for it. Shelves of bound status-rolls climb into the gloom; clerks shift brass weights from name to name across the public counters. A mural shows Whitemarch raising a wall; below it, people argue whether a seal makes someone free. The collar-archive and recovery-writ offices stay barred behind armed Flesh Wardens further inside." } },

  // ============================================================
  // PUBLIC SMITH ROW — the riverside foundries. Smoke billows out over
  // the water; the state foundries' chimneys are highest on the row.
  // ============================================================
  "3,1": { terrain: "indoor", poi: { type: "smithy", name: "Public Smith Row", service: "blacksmith", access: "public", description: "The row rings from dawn to curfew; sparks skitter across wet stone and guild-marks hang above each forge. Behind the open shops, higher chimneys mark the state foundries where no customer is allowed to ask what is being cast. The smoke leans out over the Whitewend and the river takes it east." } },

  // ============================================================
  // IRON WAY ROW — the central east-west avenue. Lower Petition Steps is
  // the open court-plaza on the west; the Chain Market's Petition Rail
  // and Viewing Yard occupy the eastern two hexes (parented to the Chain
  // Market footprint above, but kept as street terrain so the city's
  // east-west avenue still routes through the row); the rest is paved
  // lane.
  // ============================================================
  "-3,2": { terrain: "street", poi: null },
  "-2,2": { terrain: "street", poi: null },
  "-1,2": { terrain: "street", poi: { type: "hall", name: "Lower Petition Steps", access: "public", description: "A broad paved approach crowded from sunrise: widows with petitions, debtors with sponsors, merchants with sealed cases, foreigners with interpreters, and soldiers escorting people who learned too late that law moves faster than mercy. The advocate-cloister stands above; debt-collectors wait below." } },
  "0,2":  { terrain: "street", poi: null }, // Iron Way (unnamed central avenue)
  "1,2":  { terrain: "street", poi: { ...CHAIN_MARKET_STEPS, part: "petition-rail", partName: "Petition Rail", name: "Chain Market Steps", access: "public", description: "An iron rail set into the southern edge of the steps, where families press papers through the bars to the clerks beyond. Guards keep their faces toward the crowd, not the rail. Charters of birth, contested manumissions, payments-in-arrears all change hands here under the gaze of the Flesh Wardens, and one in ten papers is the only thing standing between a name and a collar." } },
  "2,2":  { terrain: "street", poi: { ...CHAIN_MARKET_STEPS, part: "viewing-yard", partName: "Viewing Yard", name: "Chain Market Steps", access: "guarded", description: "A covered yard east of the platform where buyers inspect lots before the bell. Physicians work a booth along the back wall — teeth, lungs, the marks under sleeves — and a small line of collar-stalls catches the morning sun beside it. Buyers walk the lines slowly; sellers stand with their lots and try to read prices in the buyers' silences." } },
  "3,2":  { terrain: "street", poi: null },

  // ============================================================
  // FOUNDLING + GRANARY — the west wards, paired buildings ringed by the
  // west wall-walk and the Iron Way streets.
  // ============================================================
  "-3,3": { terrain: "indoor", poi: { type: "asylum", name: "Foundling Court", service: "healer", access: "public", description: "A walled courtyard behind the Granary where the city's foundlings and the temple-condemned mad are kept by lay-sisters of the Oath. A small infirmary opens off the cloister, and a list of names is read at the bell each morning; the sisters take in any child set on the step, no questions asked of the leaver. The court is poorer than it looks and tireder than it admits." } },
  "-2,3": { terrain: "indoor", poi: { type: "granary", name: "Granary Court", access: "guarded", description: "It smells of flour, mouse-poison, and soldier-oil. Tall bins stand behind barred galleries; bakers argue quotas at one window while guards watch the crowd count sacks with the hungry arithmetic of people who know exactly how thin bread can get. The emergency seals are set early this year." } },

  // ============================================================
  // GREAT OATH STEPS — the temple plaza, faces the Inner Gate (the
  // citadel's only outside connection).
  // ============================================================
  "-1,3": { terrain: "street", poi: { type: "temple", name: "Great Oath Steps", service: "healer", access: "public", description: "Broad steps worn hollow by knees and court-shoes alike, opening on a paved plaza where petitioners gather. Priests mark contracts with ash, oil, blood, or salt by the god invoked; hospital bells ring from the cloister below, and worshippers wait where temple shade meets city law. Sanctuary here is real but never freedom from the law." } },

  // ============================================================
  // CITADEL — behind the High Wall. The Inner Gate faces the Great Oath
  // Steps; the Iron Palace sits behind. See sealed-structures.js for the
  // High Wall override.
  // ============================================================
  "0,3": { terrain: "settlement", poi: { ...CITADEL, part: "inner-gate", partName: "Inner Gate", name: "The Citadel", type: "gate", access: "restricted", description: "Smaller than the Crown Gate and harder to pass — older stones, quieter guards, cleaner hinges. Beyond the bars the city noise drops into courtyards where messengers run, officers wait, and every door has a second guard behind it. None pass without a permit." } },
  "0,4": { terrain: "settlement", poi: { ...CITADEL, part: "council-hall", partName: "The Iron Palace", name: "The Citadel", type: "city", access: "restricted", description: "The Iron Palace at the city's centre — outer hall, ledger-gallery, and the council room where the Lord-Treasurer reads the city's accounts. The iron-shilling is good because it is said to be good here. War-banners hang in the cold air; the only way in or out is the Inner Gate." } },

  // ============================================================
  // CITADEL FRONTAGE — the lanes running east of the Inner Gate, where
  // messengers and petitioners cluster. Guild Court sits at the river
  // corner on the east-wall lane.
  // ============================================================
  "1,3": { terrain: "street", poi: null },
  "2,3": { terrain: "street", poi: null },
  "3,3": { terrain: "indoor", poi: { ...GUILD_COURT, part: "masters-benches", partName: "Masters' Benches", name: "Guild Court", access: "conditional", description: "Polished slate, ringed by doors that cost more than village houses. Masters sit beneath painted tools and speak of honour while clerks record fines large enough to starve anyone who works without their leave. The court's east face looks out over the Whitewend." } },

  // ============================================================
  // SOUTHERN WARDS — Prison Gate west of the citadel (a 2-hex footprint:
  // Intake Desk at (-1,4) is the door, Family Rail at (-2,4) is the
  // street-side rail where families wait); Tenement Row east; Guild
  // Court's Apprentice Rolls hex at (3,4) is the open-court extension of
  // the Guild Court footprint above.
  // ============================================================
  "-3,4": { terrain: "street", poi: null },
  "-2,4": { terrain: "street", poi: { ...PRISON_GATE, part: "family-rail", partName: "Family Rail", name: "Prison Gate", access: "public", description: "An iron rail set in the street west of the Prison's main door, where families wait with food, bedding, and writs that may or may not be read inside. Children play between the bars; old women keep their place by knitting on stools they own by tenancy of return. The watch on the wall above takes no count of who comes here, only of who leaves." } },
  "-1,4": { terrain: "indoor", poi: { ...PRISON_GATE, part: "intake-desk", partName: "Intake Desk", name: "Prison Gate", service: "gaol", access: "restricted", description: "No ornament but old nail-scars on the door. Intake clerks sort names under a lantern that burns all day; the chain-room waits behind, and the work-gangs leave by the side-arch before dawn and return at dusk, counted twice — once by the gaolers, once by the Registry man." } },
  "1,4":  { terrain: "street", poi: null },
  "2,4":  { terrain: "settlement", poi: { type: "town", name: "Tenement Row", access: "public", description: "Timber, plaster, laundry-rope and smoke leaning over itself. Every window has a face until you look at it directly. A public pump knocks in the courtyard, roof-bridges cross overhead, and someone has chalked three different warnings beside the same alley-mouth." } },
  "3,4":  { terrain: "street", poi: { ...GUILD_COURT, part: "apprentice-rolls", partName: "Apprentice Rolls", name: "Guild Court", access: "public", description: "An open court south of the Guild Court's door, where the apprentice rolls are pinned to a covered board under the eaves. A clerk reads names at the bell; sponsors mark off attendance; failed apprentices come to argue with him and find the next clerk already at the desk. Past the board a flight of slate steps leads back up to the masters' chamber where the names mean fines or letters of leave." } },

  // ============================================================
  // SOUTH WALL WALK — the lane along the inside of the south wall, with
  // Fountain Court the small civic plaza at the SE corner and the Sewer
  // Mouth hidden behind it.
  // ============================================================
  "-1,5": { terrain: "street", poi: null },
  "0,5":  { terrain: "street", poi: null },
  "1,5":  { terrain: "street", poi: null },
  "2,5":  { terrain: "street", poi: { type: "plaza", name: "Fountain Court", access: "public", description: "A small paved court with a stone fountain at the centre — really a cistern with a single iron mouth dribbling green-edged water into a worn basin. Washerwomen come and go, off-duty guards smoke against the rim, and the city posts notices on a board nailed to the south-wall stone. When the city executes someone short of the courts, it happens here." } },

  // ============================================================
  // SEWER MOUTH — the hidden descent into the Underworks. Sealed off the
  // street (doors:[]); entry is by action, not by a casual road (the
  // narrator opens it). Tucked at the SE corner behind Fountain Court.
  // ============================================================
  "3,5": { terrain: "indoor", doors: [], poi: { type: "sewer", name: "Sewer Mouth", access: "hidden", description: "A rusted grate at the city's southeastern corner, half-hidden by broken baskets and old ash beside the south-wall stone. Warm stink breathes from the dark; fresh arrows are scratched into the brick beside older marks that read less like directions than warnings. No casual road leads down — only those who know the way, or force it, go below." } },

  // ============================================================
  // CROWN GATE — the 2-hex gatehouse straight through the Great Wall,
  // matching the wall's new single-ring thickness. The old Inner Ward
  // (city-side bailey) and Outer Ward (queue-yard) were trimmed when
  // the wall was thinned; their functions consolidated into the deeper
  // gatehouse, with Customs Hall (kept at (0,-2) inside the city) and
  // the Crown Road Approach immediately outside handling overflow.
  // Both gatehouse hexes share the Crown Gate parent and carry explicit
  // `doors` lists so the path graph follows the spine
  // (Approach → Toll Hall → city street) and can cross the gate's
  // east/west pair. The gate-out edge (Toll Hall ↔ Approach) is the
  // structure's only breach of the Great Wall, declared in the `gates`
  // field of sealed-structures.js.
  // ============================================================
  "0,-5": { terrain: "settlement", doors: [{ x: 1, y: -5 }, { x: 0, y: -4 }, { x: 0, y: -6 }], poi: { ...CROWN_GATE, part: "gatehouse-w", partName: "Toll Hall", name: "The Crown Gate", access: "conditional", description: "A long stone throat through the wall. Clerks sit behind barred counters, ledgers chained to the desks; every stamp echoes and every coin is bitten or weighed while guards keep pike-points low enough to remind the crowd that patience is cheaper than injury. Separate counters sort guild, citizen, foreigner, livestock, and bonded traffic. Murder-holes in the vault overhead are unstoppered when the bell warns of trouble." } },
  "1,-5": { terrain: "settlement", doors: [{ x: 0, y: -5 }, { x: 1, y: -4 }],                  poi: { ...CROWN_GATE, part: "gatehouse-e", partName: "Toll Hall (East)", name: "The Crown Gate", access: "conditional", description: "The east bay of the gatehouse — guild and bonded counters, the seal-press room, the chained tally-rope down to the under-vault. The east gate-tower lifts above; somewhere up the stairwell, the watch-bell hangs on its blackened beam." } },

  // ============================================================
  // CROWN ROAD APPROACH — the road outside the Great Wall, where the
  // queue forms before the gate. Now sits at (0,-6) immediately beyond
  // the Toll Hall (was at (0,-7), one hex further out, when the gate
  // ran a 3-deep complex with an Outer Ward bailey in between).
  // ============================================================
  "0,-6": { terrain: "road", poi: { type: "gate", name: "Crown Road Approach", access: "public", description: "The road widens into trampled stone before Whitemarch's gate. Carts wait in ranked lines, oxen steaming; pilgrims sleep against bundles. The gate-towers rise black and white through the chimney smoke, signal-bells hung under iron roofs, and Road Wardens watch the queue long before any official does." } },

  // ============================================================
  // THE WHITEWEND — pushed east of the wall band. The 3-hex-thick east
  // wall stands between the city and the river; the wall-side quay
  // remains inside (renamed in lore as the river-customs hall), and the
  // actual barge wharves lie just beyond the wall on the water.
  // ============================================================
  "7,-6": { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The broad brown river that feeds Whitemarch — barges, customs-chains, and a current that has carried more than cargo out of the city." } },
  "7,-5": { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend, running fast past the city's east wall. Cold, deep, and patrolled where the chain-tower can see." } },
  "7,-4": { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend, slick with tar where the bargemen tar their hulls in the off-season." } },
  "7,-3": { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend at the wall-foot, deep and slow against the dressed stone." } },
  "7,-2": { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend, brown with city outflow where the wall's drain-mouths feed it." } },
  "7,-1": { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend at the customs landing, where barges crowd the wall-side wharves at the off-load bells." } },
  "7,0":  { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend, sluggish where the city's outflows muddy it. Skiffs work the shallow line; a chain-boom hangs ready downstream." } },
  "7,1":  { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend below the foundries, hot air rolling off the forges into the morning mist over the water." } },
  "7,2":  { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend, swung wide around the city's eastern wall. Reed-banks hide bones the river has not yet finished arguing with." } },
  "7,3":  { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend, broadening as it leaves the city. Boatmen ply the channel; one old wreck shows a black rib above the slack water." } },
  "7,4":  { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend, slow and brown south of the city, where the gulls work the kitchen-scrap line." } },
  "7,5":  { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend, leaving the city for good — the road downstream and the road that has carried the most away." } },
  "7,6":  { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend at the city's southern shoulder, where reed-beds take over and the gulls thin out." } },
  "7,7":  { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend, broad and slow past the city, headed for the sea no one in Whitemarch has personally seen." } },
  "7,8":  { terrain: "water", poi: { type: "river", name: "The Whitewend", description: "The Whitewend, well clear of the city now — the bank dark with reed and only the occasional fisher-skiff working the slack water." } },

  // ============================================================
  // WALL-SIDE BUILDINGS — buildings sat right against the inside of the
  // Great Wall, so the perimeter reads as city all the way out instead
  // of a uniform yard ring. Each is authored at distance 1 from a city
  // street (the wall generator skips them) and is registered in
  // WHITEMARCH_BUILDINGS with a single declared `door` onto the nearest
  // interior street. Generated d=1 streets pick up the rest of the
  // perimeter and mesh around them.
  // ============================================================
  "-2,-4": { terrain: "indoor", wallside: true, poi: { type: "barracks", name: "Watch Bunkhouse", access: "restricted", description: "A long stone bunkhouse with its back built straight into the wall. Two rows of three-deep cots, lockers stamped with watch-numbers, and a stove always banked. Off-shift watchmen pull boots up here between gate-watch and wall-watch; the sergeants drink at the table by the door where they can see everyone come and go." } },
  "4,2":   { terrain: "indoor", wallside: true, poi: { type: "smithy", name: "Forge Annex", access: "restricted", description: "An outwork of the Public Smith Row, set hard against the east wall so the smoke can vent through high louvres without filling the city. Two charcoal hearths and an oil-bath under hung tongs; the forge-master takes work the main row can't fit and quietly turns out the city's quenched-blade orders for the wall-watch." } },
  "-2,5":  { terrain: "indoor", wallside: true, poi: { type: "town", name: "Wallside Almshouse", access: "public", description: "A two-storey almshouse cornered against the south-west wall behind the Prison Stair. Plain wooden bunks, a soup-line in the morning, and a chaplain who keeps the lamps trimmed. The poor of the southern wards take their bowls here when the courts are sitting and there is no work to be had." } },

  // ============================================================
  // WALL STAIRS — six wall-walk chokepoints. Each stair IS a wall_top
  // tile sitting on the wall ring at distance 2 from the city interior;
  // climbing the stair = stepping onto the wall. The doors are wired by
  // the wall_top doors generator (below): each stair-wall_top opens to
  // its adjacent wall_top neighbours along the ring AND to the adjacent
  // intramural yard tile (the single chokepoint into the wall from
  // ground level). All other wall_top tiles connect only to other
  // wall_top + the gatehouse roof, so these six are the only way up.
  //
  // The stair positions are the d=2 ring neighbours of the old (pre-
  // ring-reshape) d=1 stair tiles, so the named geography still lines
  // up — Crown Stair sits just west of the Crown Gate, Dragon Stair
  // beside the Dragon-Watch Tower, Quay Stair above the foundries, and
  // so on. By writ the wall-walk is for the watch, but the stairs
  // themselves are not gated; anyone can climb, and any of the wall-
  // watch above will notice.
  // ============================================================
  "-1,-5": { terrain: "wall_top", poi: { type: "stair", name: "Crown Stair", access: "restricted", description: "A worked stone stair set into the wall just west of the Crown Gate's inner ward, the climb wide enough for two abreast. Guards take it morning and dusk to relieve the wall-watch; civilians may use it but draw eyes from the gate-towers." } },
  "3,-5":  { terrain: "wall_top", poi: { type: "stair", name: "Dragon Stair", access: "restricted", description: "A narrow stone stair built into the wall's inner face beside the Dragon-Watch Tower. The wall-walk above is guard-only by writ; the stair itself is open to anyone bold enough to climb where the harpoon-watchers can see." } },
  "5,0":   { terrain: "wall_top", poi: { type: "stair", name: "Quay Stair", access: "restricted", description: "A stair on the east wall above the foundries, half-stained by forge-smoke. The wall-walk here looks across the Whitewend to the chain-tower and the barge-traffic working downstream." } },
  "-5,0":  { terrain: "wall_top", poi: { type: "stair", name: "West Stair", access: "restricted", description: "A narrow stair set into the west wall above the Halfborn Hostel, used by the wall-watch and by anyone with cause to look out over the country toward the Tannic Wood." } },
  "1,7":   { terrain: "wall_top", poi: { type: "stair", name: "South Stair", access: "restricted", description: "A broad stair on the south wall behind the Tenement Row, opening onto the south wall-walk. The view here takes in the kitchen-scrap line on the river and the long road south." } },
  "-1,7":  { terrain: "wall_top", poi: { type: "stair", name: "Prison Stair", access: "restricted", description: "A stair on the south-west wall, hard by Prison Gate. The work-gangs pass beneath it twice a day; the wall-watch above keeps a count of every chain that goes in and out." } },

  // ============================================================
  // THE UNDERWORKS — first descent beyond the Sewer Mouth. Five sealed
  // chambers reached only through the rusted grate at (3,5); the gate
  // is one-way by design (Sewer Mouth keeps its empty doors list, so
  // findPath cannot route DOWN OR UP through it — entry and return are
  // narrator-driven). Each member hex carries `area: "underworks"` so
  // the wall generator below can recognise and skip them when computing
  // the city's wall band. The Brick Descent overwrites a wall hex at
  // (3,6); Drain Junction (3,7), Old Cistern (2,7), and Smuggler Stair
  // (4,7) overwrite three south-ring wall-top hexes — the wall walk
  // dips inland here (the wall thickens over the stairhead and the walk
  // routes around). Guide Markings at (3,8) overwrites another wall hex
  // at the band's outer face. Mesh connectivity is wired by the
  // UNDERWORKS sealed-structure entry (data/sealed-structures.js).
  // ============================================================
  "3,6": { terrain: "indoor", poi: { ...UNDERWORKS, part: "brick-descent", partName: "Brick Descent", name: "The Underworks", access: "conditional", description: "The first turn of the stair below the Sewer Mouth — older brick under newer city-work, the rusted grate creaking shut above when the wind takes it. Warm stink rises; cold seeps down past the boots. A guide-mark scratched at eye-level reads as an arrow until you see the loops, which mean something else to the people who come down here on purpose." } },
  "3,7": { terrain: "indoor", poi: { ...UNDERWORKS, part: "drain-junction", partName: "Drain Junction", name: "The Underworks", access: "conditional", description: "Where the city's main outfall meets the older brick. Three drains feed the channel here — the foundries' hot run, the slaughterhouse stand, and the south-wall cistern's overflow — and the smell shifts by the hour. A walkway of cracked slabs runs above the water; a chain hangs over the lip, fastened to no winch anyone remembers." } },
  "2,7": { terrain: "indoor", poi: { ...UNDERWORKS, part: "old-cistern", partName: "Old Cistern", name: "The Underworks", access: "hidden", description: "A drowned chamber where one of the city's foundation-cisterns failed and the floor has sat for a century underwater. Standing water past the knees in places; a broken stair angles down into deeper black. Bones of fish that did not belong in any cistern lie in the silt, and a boot-print in the dust at the rim is fresher than the city above would explain." } },
  "3,8": { terrain: "indoor", poi: { ...UNDERWORKS, part: "guide-markings", partName: "Guide Markings", name: "The Underworks", access: "hidden", description: "A run of older brick where the smugglers' alphabet has been kept up by every generation that has used these tunnels. Scratched arrows under soot-marks under the older signs; a tally-count beside one passage; an eye-shape gouged into the brick at chest height, watched and watching. To know what they mean is to be one of the people who comes back." } },
  "4,7": { terrain: "indoor", poi: { ...UNDERWORKS, part: "smuggler-stair", partName: "Smuggler Stair", name: "The Underworks", access: "hidden", description: "A bricked-up stair-shaft that climbs back up beneath the dock-warehouses, sealed at the top by a flagstone the customs-men do not know is loose. A rope-line still hangs against the wall; a hand-print on the brick stays soot-dark and shoulder-high however often the smugglers wipe down their tracks." } },
};

// Auto-apply `doors` to sealed structures (see world.js edgeAllowed / findPath:
// the engine blocks crossing any edge to a hex not in a tile's door list).
// Three authoring shapes are supported (see data/sealed-structures.js):
//
//   - streets + buildings (+ gates): a walled city partitioned into open
//     thoroughfares (streets) and destinations (buildings). Streets mesh
//     with every adjacent hex inside the area; each building opens ONLY to
//     adjacent streets (plus any gate-paired outside hex). This is the
//     authoring shape used for Whitemarch's Great Wall.
//
//   - interior + gates (+ legacy threshold): every interior hex opens to all
//     of its in-area neighbours (a fully-connected interior); every edge
//     OUT of the area is a wall except the `gates`. Kept for dungeons and
//     other compounds where every interior hex should be free-walking.
//
//   - entry + outside + links: a building/compound whose interior connectivity
//     is an explicit graph. Each hex opens ONLY to its linked neighbours, and
//     the entry hex additionally opens to its `outside` street hex.
//
// Structures are applied in array order; later structures overwrite the doors
// of hexes they touch (so a mesh area can be re-sealed by a nested linked
// compound, e.g. the Citadel inside the Great Wall).
function setDoors(key, doors) {
  const tile = HANDCRAFTED[key];
  if (!tile) return; // soft-fail: structure-list out of sync with tiles
  HANDCRAFTED[key] = { ...tile, doors };
}

function adjacentHex(a, b) {
  return HEX_DIRS.some((d) => a.x + d.x === b.x && a.y + d.y === b.y);
}

// Validates and indexes a structure's gates into a map of inside-key ->
// array of paired outside hexes. Throws if any gate pair is not adjacent.
function indexGates(s) {
  const gateDoors = new Map();
  for (const [inside, outside] of s.gates || []) {
    if (!adjacentHex(inside, outside)) {
      throw new Error(`Structure "${s.name}": gate ${inside.x},${inside.y} <-> ${outside.x},${outside.y} is not between adjacent hexes`);
    }
    const k = `${inside.x},${inside.y}`;
    if (!gateDoors.has(k)) gateDoors.set(k, []);
    gateDoors.get(k).push({ x: outside.x, y: outside.y });
  }
  return gateDoors;
}

// Streets + buildings authoring shape. Streets mesh-connect to every
// adjacent hex in the interior; buildings open ONLY through their named
// front door (or to all adjacent streets if no door is named — the gates).
//
// Building entries are objects:
//   { x, y }                    — default: doors = ALL adjacent streets
//                                  (multi-door; reserved for gates by design)
//   { x, y, door: { x, y } }    — explicit single front door — the canonical
//                                  spacious-layout pattern; the building is a
//                                  pure destination, never a transit hex
//   { x, y, doors: [{x,y}, ...] } — explicit door list (e.g. a passable yard)
//
// Throws if a non-gate building's resolved door list is empty, or if any
// declared door isn't an adjacent street.
function applyStreetBuildingDoors(s) {
  const streetSet = new Set(s.streets.map((c) => `${c.x},${c.y}`));
  const buildingCoords = s.buildings.map((b) => ({ x: b.x, y: b.y }));
  const buildingSet = new Set(buildingCoords.map((c) => `${c.x},${c.y}`));
  for (const k of streetSet) {
    if (buildingSet.has(k)) throw new Error(`Structure "${s.name}": ${k} is listed as both a street and a building`);
  }
  const interior = new Set([...streetSet, ...buildingSet]);
  const gateDoors = indexGates(s);

  // Streets: mesh with all adjacent interior hexes (streets + buildings).
  // Doors are bidirectional in spirit — when a building's `door` names a
  // specific street, the other direction is naturally allowed because the
  // street's mesh-doors include that building, and the building's door list
  // includes that street.
  for (const c of s.streets) {
    const doors = [];
    for (const d of HEX_DIRS) {
      const nk = `${c.x + d.x},${c.y + d.y}`;
      if (interior.has(nk)) doors.push({ x: c.x + d.x, y: c.y + d.y });
    }
    const k = `${c.x},${c.y}`;
    if (gateDoors.has(k)) doors.push(...gateDoors.get(k));
    setDoors(k, doors);
  }

  // Buildings: open ONLY through their declared door, or — for gates — to
  // all adjacent streets plus the paired gate-outside hex. Single-door
  // buildings cannot be used as transit hexes between two streets, which
  // is what keeps findPath routing around buildings rather than through
  // them in the spacious layout.
  for (const b of s.buildings) {
    const k = `${b.x},${b.y}`;
    let doors;
    if (Array.isArray(b.doors)) {
      doors = b.doors.map((p) => ({ x: p.x, y: p.y }));
    } else if (b.door) {
      doors = [{ x: b.door.x, y: b.door.y }];
    } else {
      doors = [];
      for (const d of HEX_DIRS) {
        const nk = `${b.x + d.x},${b.y + d.y}`;
        if (streetSet.has(nk)) doors.push({ x: b.x + d.x, y: b.y + d.y });
      }
    }
    for (const door of doors) {
      const dk = `${door.x},${door.y}`;
      // A building's declared door may point to a street (the canonical front
      // door) OR to another building in the same structure (internal gate-
      // complex connectivity — e.g. Inner Ward ↔ Gatehouse ↔ Outer Ward).
      if (!streetSet.has(dk) && !buildingSet.has(dk)) {
        throw new Error(`Structure "${s.name}": building ${k} declares a door to ${dk}, which is not in the streets or buildings list`);
      }
      // hexDistance != 1 — door not adjacent to the building
      const dq = door.x - b.x, dr = door.y - b.y;
      if ((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2 !== 1) {
        throw new Error(`Structure "${s.name}": building ${k} declares a door to ${dk}, which is not an adjacent hex`);
      }
    }
    if (gateDoors.has(k)) doors.push(...gateDoors.get(k));
    if (doors.length === 0) {
      const tile = HANDCRAFTED[k];
      throw new Error(`Structure "${s.name}": building ${k} (${tile?.poi?.name || tile?.poi?.partName || "?"}) has no adjacent street and is not a gate — every building must open onto at least one street`);
    }
    setDoors(k, doors);
  }
}

function applyMeshDoors(s) {
  const threshold = s.threshold || [];
  const all = new Set([...threshold, ...s.interior].map((c) => `${c.x},${c.y}`));
  const gateDoors = indexGates(s);
  for (const c of s.interior) {
    const doors = [];
    for (const d of HEX_DIRS) {
      const nk = `${c.x + d.x},${c.y + d.y}`;
      if (all.has(nk)) doors.push({ x: c.x + d.x, y: c.y + d.y });
    }
    const k = `${c.x},${c.y}`;
    if (gateDoors.has(k)) doors.push(...gateDoors.get(k));
    setDoors(k, doors);
  }
}

function applyLinkedDoors(s) {
  const doorsByKey = new Map(); // key -> Map(neighbourKey -> {x,y})
  const link = (a, b) => {
    if (!adjacentHex(a, b)) {
      throw new Error(`Footprint "${s.name}": link ${a.x},${a.y} <-> ${b.x},${b.y} is not between adjacent hexes`);
    }
    const ka = `${a.x},${a.y}`;
    if (!doorsByKey.has(ka)) doorsByKey.set(ka, new Map());
    doorsByKey.get(ka).set(`${b.x},${b.y}`, { x: b.x, y: b.y });
  };
  for (const [a, b] of s.links) { link(a, b); link(b, a); }
  if (s.entry && s.outside) link(s.entry, s.outside); // the door out to the street

  // Connectivity guard: every member hex must be reachable from the entry
  // through the link graph (the outside street hex is not a member).
  const outsideKey = s.outside ? `${s.outside.x},${s.outside.y}` : null;
  const members = new Set([...doorsByKey.keys()].filter((k) => k !== outsideKey));
  if (s.entry) {
    const start = `${s.entry.x},${s.entry.y}`;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      for (const nb of (doorsByKey.get(stack.pop())?.keys() || [])) {
        if (members.has(nb) && !seen.has(nb)) { seen.add(nb); stack.push(nb); }
      }
    }
    for (const m of members) {
      if (!seen.has(m)) throw new Error(`Footprint "${s.name}": ${m} is not reachable from the entry`);
    }
  }

  // Convention guard: a building/compound entry must open onto a walkable
  // street (a road, a settlement street, or the new "street" terrain), not
  // an indoor hall or open water.
  const outsideTerrain = outsideKey ? HANDCRAFTED[outsideKey]?.terrain : null;
  const STREET_TERRAINS = new Set(["road", "settlement", "street"]);
  if (outsideKey && !STREET_TERRAINS.has(outsideTerrain)) {
    console.warn(`Footprint "${s.name}": entry opens onto ${outsideKey}, which is not a street hex`);
  }

  for (const [key, nbs] of doorsByKey) {
    if (key === outsideKey) continue; // the street keeps its default-open doors
    setDoors(key, [...nbs.values()]);
  }
}

// ============================================================
// WALL GENERATOR — fills the Great Wall as a SINGLE ring of walkable
// "wall_top" hexes at distance 2 from every interior hex, plus a
// generated perimeter ring of STREET tiles at distance 1 (the lanes
// running just inside the wall). The d=1 streets are interrupted by
// the wall-side buildings authored above (Watch Bunkhouse, Forge
// Annex, Wallside Almshouse), so the perimeter reads as city lanes
// with the occasional building cornered against the wall — not a
// uniform yard ring.
//
// The wall itself is a single hex thick — there is no impassable stone
// mass anymore, only the wall-walk. It still functions as a wall:
// every wall_top hex's `doors` list (set below) opens ONLY to adjacent
// wall_top and to the Crown Gate's gatehouse hexes. Neither the city
// streets nor the d=1 perimeter streets nor procedural exterior hexes
// appear in that list, so edgeAllowed blocks every edge that would
// cross the ring in either direction. The six wall-stairs (authored as
// wall_top tiles with `poi.type === "stair"` at the d=2 ring) are the
// single-tile chokepoints — each opens to its adjacent d=1 street and
// the next wall_top along the ring.
//
// To climb the wall from inside the city you walk to a d=1 perimeter
// street next to a stair and step onto the stair-wall_top (or cross
// via the gatehouse roof); to climb it from outside you must first
// enter the city through the Crown Gate.
//
// The generator runs AFTER the per-tile authoring so it can see what's
// already placed (interior, gate complex, river, approach, stairs,
// wall-side buildings) and fill only the gaps that fall at distance 1
// or 2 from any interior hex.
// ============================================================
{
  // "Interior" for wall-distance purposes = every hex already in HANDCRAFTED
  // that is walkable CITY-CORE ground — not water, not the road approach
  // outside the wall, not the Crown Gate complex itself (gate sits ACROSS
  // the wall ring), not the wall-stairs (which sit ON the ring at d=2),
  // not the Underworks (conceptually below the surface), and not the
  // wall-side buildings (which sit AT d=1 against the wall — counting
  // them as interior would push the ring outward around each one and
  // leave the wall lumpy. They're handcrafted so the wall generator
  // skips them anyway; we just want the ring's GEOMETRY computed from
  // the city core).
  // Including any of these in the distance set would push the ring out.
  const interiorCoords = [];
  for (const key of Object.keys(HANDCRAFTED)) {
    const t = HANDCRAFTED[key];
    if (t.terrain === "water") continue;
    if (t.terrain === "road") continue;                          // Crown Road Approach
    if (t.poi?.parent === "whitemarch-crown-gate") continue;      // gate crosses the ring
    if (t.poi?.type === "stair") continue;                        // stairs sit on the ring
    if (t.poi?.area === "underworks") continue;                   // the Underworks sit beside the ring
    if (t.wallside) continue;                                     // wall-side buildings sit at d=1
    const [x, y] = key.split(",").map(Number);
    interiorCoords.push({ x, y });
  }
  const minDistToInterior = (x, y) => {
    let min = Infinity;
    for (const c of interiorCoords) {
      const dq = x - c.x, dr = y - c.y;
      const d = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
      if (d < min) min = d;
      if (min === 0) return 0;
    }
    return min;
  };
  // Walk a bbox wide enough to cover the wall-walk ring around any interior
  // hex. Margin of 3 is safe — distance 2 outward + 1 buffer.
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const c of interiorCoords) {
    if (c.x < xmin) xmin = c.x;
    if (c.x > xmax) xmax = c.x;
    if (c.y < ymin) ymin = c.y;
    if (c.y > ymax) ymax = c.y;
  }
  // Place perimeter + wall_top hexes:
  //   distance 1 from interior → STREET (a generated perimeter lane —
  //     mesh-connected to other perimeter streets, to the city's
  //     interior streets, to the adjacent stair-wall_top above, and to
  //     the gatehouse where it abuts the gate).
  //   distance 2 from interior → wall-walk (passable; doors set below).
  // Distance 3 (where the outer stone face once sat) is no longer placed;
  // that ring falls through to procedural exterior generation.
  let wallTopCount = 0, perimeterCount = 0;
  for (let x = xmin - 3; x <= xmax + 3; x++) {
    for (let y = ymin - 3; y <= ymax + 3; y++) {
      const key = `${x},${y}`;
      if (HANDCRAFTED[key]) continue;        // interior, gate, river, road, stair, wall-side building — already placed
      const d = minDistToInterior(x, y);
      if (d === 1) {
        HANDCRAFTED[key] = { terrain: "street", poi: null, perimeter: true }; // doors set below
        perimeterCount++;
      } else if (d === 2) {
        HANDCRAFTED[key] = { terrain: "wall_top", poi: null }; // doors set below
        wallTopCount++;
      }
    }
  }
  // Wall-top doors — each wall_top hex meshes with adjacent wall_top hexes
  // (forming a continuous walk along the wall) and with the Crown Gate's
  // gatehouse hexes (so the walk crosses the gate's roof rather than
  // ending at the gate). Stair-tagged wall_tops also open to their
  // adjacent perimeter street(s) — that edge is the single chokepoint
  // from ground level up to the ring. All other wall_top tiles stay
  // sealed off from the perimeter streets.
  for (const key of Object.keys(HANDCRAFTED)) {
    const t = HANDCRAFTED[key];
    if (t.terrain !== "wall_top") continue;
    const [x, y] = key.split(",").map(Number);
    const isStair = t.poi?.type === "stair";
    const doors = [];
    for (const d of HEX_DIRS) {
      const nx = x + d.x, ny = y + d.y;
      const nk = `${nx},${ny}`;
      const nt = HANDCRAFTED[nk];
      if (!nt) continue;
      if (nt.terrain === "wall_top") doors.push({ x: nx, y: ny });
      else if (nt.poi?.parent === "whitemarch-crown-gate" && nt.poi?.part?.startsWith("gatehouse")) {
        doors.push({ x: nx, y: ny });
      }
      else if (isStair && nt.perimeter) doors.push({ x: nx, y: ny });
    }
    HANDCRAFTED[key].doors = doors;
  }
  // Perimeter-street doors — each generated d=1 street meshes with
  // adjacent perimeter streets (so you can walk the full perimeter),
  // with adjacent interior city streets (the lanes that bring you
  // out from the city), with adjacent stair-tagged wall_tops (the
  // chokepoints up), and with the gatehouse hexes (so the perimeter
  // street touching the gate is the inside-of-the-gate hex). It does
  // NOT door to the wall-side buildings authored above — those use
  // their own front door to the city interior, per the standard
  // streets-and-buildings rule.
  for (const key of Object.keys(HANDCRAFTED)) {
    const t = HANDCRAFTED[key];
    if (!t.perimeter) continue;
    const [x, y] = key.split(",").map(Number);
    const doors = [];
    for (const d of HEX_DIRS) {
      const nx = x + d.x, ny = y + d.y;
      const nt = HANDCRAFTED[`${nx},${ny}`];
      if (!nt) continue;
      if (nt.perimeter) doors.push({ x: nx, y: ny });
      else if (nt.terrain === "street") doors.push({ x: nx, y: ny });
      else if (nt.terrain === "wall_top" && nt.poi?.type === "stair") doors.push({ x: nx, y: ny });
      else if (nt.poi?.parent === "whitemarch-crown-gate") doors.push({ x: nx, y: ny });
    }
    HANDCRAFTED[key].doors = doors;
  }
  // Comment retained for any future debugging.
  // console.log(`[whitemarch] generated ${wallTopCount} wall-walk + ${perimeterCount} perimeter hexes`);
}

for (const s of SEALED_STRUCTURES) {
  if (s.streets || s.buildings) applyStreetBuildingDoors(s);
  else if (s.links) applyLinkedDoors(s);
  else applyMeshDoors(s);
}

// ============================================================
// STREET ↔ PERIMETER + WALL-WALK BRIDGES — after the Crown Gate's doors
// are authored, two passes finish the city-perimeter graph:
//   1. Each authored city street adjacent to a generated perimeter
//      street gets that perimeter hex added to its doors. The
//      perimeter side was wired when the wall generator ran; this pass
//      wires the city-street side so the edge is bidirectional.
//   2. The gatehouse middle hexes get extended doors to adjacent
//      wall-top hexes on either side. The wall-walk thus crosses the
//      gatehouse roof, so a guard on the wall walks continuously over
//      the gate rather than dead-ending at it.
// Stairs no longer touch streets directly — they sit on the wall ring
// at d=2 and open to the perimeter street at d=1, which the city
// streets reach via pass (1). So there is no separate street ↔ stair
// bridge.
// ============================================================
for (const key of Object.keys(HANDCRAFTED)) {
  const tile = HANDCRAFTED[key];
  if (tile.terrain !== "street") continue;
  if (tile.perimeter) continue; // perimeter streets already wired
  if (!Array.isArray(tile.doors)) continue;
  const [x, y] = key.split(",").map(Number);
  const existing = new Set(tile.doors.map((d) => `${d.x},${d.y}`));
  const extra = [];
  for (const d of HEX_DIRS) {
    const nx = x + d.x, ny = y + d.y;
    const nk = `${nx},${ny}`;
    if (existing.has(nk)) continue;
    const nt = HANDCRAFTED[nk];
    if (nt && nt.perimeter) extra.push({ x: nx, y: ny });
  }
  if (extra.length) HANDCRAFTED[key] = { ...tile, doors: [...tile.doors, ...extra] };
}
for (const gateKey of ["0,-5", "1,-5"]) {
  const t = HANDCRAFTED[gateKey];
  if (!t || !Array.isArray(t.doors)) continue;
  const [x, y] = gateKey.split(",").map(Number);
  const existing = new Set(t.doors.map((d) => `${d.x},${d.y}`));
  const extra = [];
  for (const d of HEX_DIRS) {
    const nx = x + d.x, ny = y + d.y;
    const nk = `${nx},${ny}`;
    if (existing.has(nk)) continue;
    const nt = HANDCRAFTED[nk];
    if (nt && nt.terrain === "wall_top") extra.push({ x: nx, y: ny });
  }
  if (extra.length) HANDCRAFTED[gateKey] = { ...t, doors: [...t.doors, ...extra] };
}
