// Distant landmarks the MC knows about as a regional native — visible on the
// map under fog of war when within MAP_VIEW_RADIUS, untravelable until you can
// actually reach them. Coordinates are axial (pointy-top hex).
//
// v12 scale: at ~250m/hex these landmarks sit 15–40 hexes from the Inn —
// genuinely a day or more's travel each, sized to encourage real journeys
// rather than incidental detours. Entries outside MAP_VIEW_RADIUS still surface
// in [GEOGRAPHY KNOWN BY REPUTATION] for the narrator, so NPCs can reference
// them as compass-points even when they're off the local map.
export const RUMORED = {
  // ============================================================
  // NORTH — beyond and within the Tannic Wood
  // The Tannic river itself lives in data/rivers.js so it renders as a
  // continuous water strip rather than three rumours.
  // ============================================================
  "-5,-25":  { name: "Black Tarn",          kind: "lake",      direction: "northwest", description: "A deep, lightless lake. Old stories cling to it; the locals do not fish it." },
  "-10,-15": { name: "The Hollow Pines",    kind: "ruin",      direction: "north",     description: "An ancient yew copse older than the names of kings. Nothing has been cut from them in living memory." },
  "-8,-10":  { name: "Goblin Hollow",       kind: "den",       direction: "northwest", description: "A warren of bramble-choked tunnels above a stream. Children of the Mire are told to never come here after dark. Locals say one goblin-band lives there; travellers swear there are three." },
  "5,-12":   { name: "The Tannic Ford",     kind: "landmark",  direction: "north",     description: "Where the wagon-track meets the Tannic. A ferry-house was burned out four winters ago and never rebuilt; horses still ford it in low water." },
  "-3,-18":  { name: "Charwood Burn",       kind: "ruin",      direction: "north",     description: "A long blackened scar through the Tannic Wood — a forest fire of decades past, never quite regrown. The Wood-Cult will not enter it." },
  "-15,-20": { name: "Brokenglass Tower",   kind: "ruin",      direction: "northwest", description: "A blade of green glass thrusting from a low ridge — said to be the upper half of a tower the rest of which fell, or never was." },
  "-12,-28": { name: "The Witch-Hag's Cot", kind: "ruin",      direction: "north",     description: "A single tilted chimney on the edge of the Bonemarsh. Older than living memory, never quite empty." },

  // ============================================================
  // NORTHEAST — Crowsmoor → Beltsworn → Whitemarch corridor
  // ============================================================
  "12,-8":   { name: "Pilgrim's Rest",      kind: "village",   direction: "northeast", description: "A way-village on the Whitemarch road. Two inns, a chapel, a graveyard kept neater than the houses." },
  "20,-10":  { name: "Skyflash Tower",      kind: "fortress",  direction: "northeast", description: "A march-tower of the Whitemarch outriders. At dusk its signal-mirror flashes word to the city; lonely countryfolk set their clocks by it." },
  "25,-15":  { name: "Beltsworn",           kind: "village",   direction: "northeast", description: "A frontier village halfway to Whitemarch, paid in coin to keep the road open." },
  "40,-20":  { name: "Whitemarch",          kind: "city",      direction: "northeast", description: "A walled city. Said to be where the iron is minted." },
  "30,-30":  { name: "The Cinder Chapter",  kind: "fortress",  direction: "northeast", description: "The chapter-house of the Burning Order. A bronze door, a perpetual fire, and recruits sent on toward the Drakeholt." },

  // ============================================================
  // EAST — open road past Crowsmoor
  // ============================================================
  "18,5":    { name: "The Burnt Croft",     kind: "ruin",      direction: "east",      description: "A homestead burned to the foundation-stones some seasons back. A signpost still names the family; nobody has taken the signpost down." },
  "30,0":    { name: "Hollyman's Crossing", kind: "village",   direction: "east",      description: "A small road-village with a smithy and a watering-trough older than the village. The road forks here — south toward the Spine, east toward the Plateau." },

  // ============================================================
  // SOUTHEAST — Spine foothills
  // ============================================================
  "15,15":   { name: "Caer Drum",           kind: "ruin",      direction: "southeast", description: "A low broken hillfort of dressed grey stone. Spine herders pen winter sheep inside its outer wall." },
  "20,12":   { name: "Mossbridge Hold",     kind: "fortress",  direction: "southeast", description: "A small stone tower-house holding the crossing of an unnamed beck. Manned in summer by a Spine-tribe sept; locked and shuttered in winter." },
  "25,20":   { name: "Caer Aglyn",          kind: "ruin",      direction: "southeast", description: "An old hillfort, earthworks still visible in the right light. Said to have fallen to plague, not arms." },
  "35,25":   { name: "The Spine",           kind: "mountains", direction: "southeast", description: "A spine of broken stone rising from the southern plains." },
  "30,28":   { name: "The Ogre Stair",      kind: "den",       direction: "southeast", description: "A switchback of carved stone steps too tall for a man. Spine scouts mark it on charts as RED and do not climb it." },

  // ============================================================
  // SOUTH — past Bramblewych and toward the coast
  // ============================================================
  "8,12":    { name: "Hollow Cairn",        kind: "ruin",      direction: "south",     description: "A burial-cairn split open by frost or hand. The slabs inside are carved with a script nobody alive reads aloud." },
  "5,18":    { name: "Bramble Ferry",       kind: "landmark",  direction: "south",     description: "A pole-ferry across a slow stretch of water at the edge of the Reach. The ferryman takes copper or a story; he is particular about which." },
  "-15,25":  { name: "The Last King's Tomb",kind: "ruin",      direction: "south",     description: "The barrow of the last king to hold this country — a name no longer spoken in Crowsmoor." },
  "-20,30":  { name: "The Old Wall",        kind: "ruin",      direction: "south",     description: "A broken wall of black brick, long abandoned." },
  "-25,20":  { name: "Bramblewych",         kind: "village",   direction: "southwest", description: "A village south of the Mire. Famous for nothing." },
  "0,35":    { name: "Greypool",            kind: "village",   direction: "south",     description: "A reed-built fishing village on the inland edge of the Hollow Coast. The Tideless visit twice a year and the village keeps its lamps shuttered those nights." },

  // ============================================================
  // WEST — Witchwood approaches
  // ============================================================
  "-22,-3":  { name: "Tannic Mill",         kind: "village",   direction: "west",      description: "A milling-hamlet on a side-channel of the Tannic. The miller takes a tenth in flour and a thirteenth in talk." },
  "-25,10":  { name: "Briarcross",          kind: "village",   direction: "west",      description: "A crossroads-village in the Bramblewych. Hedge-witches teach there openly; the Wardens leave it alone." },
  "-30,-5":  { name: "The Black Mound",     kind: "ruin",      direction: "west",      description: "A black-earth tumulus the size of a barn. Locals warn that nothing planted near it grows; carrion crows nest on it summer-long." },

  // ============================================================
  // PEACEFUL PEOPLES — racial and civic settlements within reach
  // ============================================================
  "35,18":   { name: "Stonebrook Hold",     kind: "town",      direction: "southeast", description: "A working dwarven hold in the Spine Foothills — a gate cut into a hillside, a smokehouse market-square below, three hundred stone-folk who keep a trade-tongue and a long memory. They buy iron, sell finished steel, and tolerate visitors who follow the posted rules." },
  "-15,8":   { name: "Greenshaw",           kind: "village",   direction: "south",     description: "A village of the small folk on the inland edge of the Bramblewych Reach. Trim hedges, bee-skeps, and houses with the doors set into the hillside. The Greenshaw keep careful neutrality with the Bramble Witches and feed any traveller who asks politely." },
  "-28,12":  { name: "Selenyan Edge",       kind: "village",   direction: "southwest", description: "A border outpost of the Selenyan Court at the edge of the Witchwood Deep — a clearing of bowyer-trees, a low timber hall, and a wary patrol of two or three. Strangers are welcome to wait at the threshold; passage further west requires invitation." },
  "12,-3":   { name: "Halfborn Hold",       kind: "town",      direction: "east",      description: "A walled town of half-orcs and the freed-from-coffles, on rising ground above the Mire's eastern edge. The matriarchy governs by election; the smithy is busy; the gate is open by day and watched by night. Tribute-banners of three war-bands they helped break hang inside the main gate." },

  // ============================================================
  // MAGIC-UNLOCK SITES — places that map to the system prompt's
  // five magic-acquisition paths (leyline, patron, grimoire, master,
  // bloodline). The narrator should recognise each from context.
  // ============================================================
  "-20,-10": { name: "The Standing Stones of Anwen", kind: "shrine", direction: "northwest", description: "A circle of nine standing stones on a low rise in the Tannic Wood. A leyline crosses the inner ring; those who fast at the centre stone for a dawn and a dusk have been known to wake with something they did not have. Most who try it wake with nothing." },
  "32,8":    { name: "The Heron Tower",     kind: "fortress",  direction: "east",      description: "A grey stone tower on a knoll in the Spine Foothills — the seat of a master of the Heron School of sorcery. The master takes one apprentice at a time and rejects most who ask. Letters arrive there by white-bird; apprenticeship is years, not months." },
  "-18,-8":  { name: "The Fae Crossing",    kind: "shrine",    direction: "north",     description: "A glade in the Tannic Wood where the Court of Hawthorn is said to hold their dusk-rites. Travellers who step inside the toadstool ring at twilight may be addressed by a thing that looks like a tall fair child. A bargain there is binding in ways the Vale does not have words for." },
  "-8,-15":  { name: "The Library of Old Tannic", kind: "shrine", direction: "north", description: "A Wood-Cult library hidden in a clearing of black firs north of the Charwood Burn. The mundane stacks are open to any patient reader; the inner stacks hold grimoires that the Cult will lend to those they trust, after a season or two of trust-building." },
  "-12,12":  { name: "The Bloodline Cairn", kind: "ruin",      direction: "south",     description: "An ancient stone-and-turf barrow at the inner edge of the Bramblewych Reach. The slab inside is older than the names of the bloodlines. Those whose blood already carries the thread are known to wake on it changed. Those whose blood does not, simply wake cold." },
  "8,8":     { name: "Shrine of the Pale God", kind: "shrine", direction: "southeast", description: "A small stone shrine on the southern edge of Crowsmoor Reach, kept in seven-day shifts by an order of seven servants. The Pale God answers, sometimes, those who fast, bleed, and wait through the appointed vigil." },

  // ============================================================
  // OTHER PEACEFUL LANDMARKS — neutral commerce, vista, hermitage
  // ============================================================
  "10,-5":   { name: "The Travellers' Meet", kind: "camp",     direction: "east",      description: "A neutral crossroads-market on a knoll between the Mire's edge and Crowsmoor Reach. Tents and wagons spring up for ten days four times a year; in between, a sturdy circle of cleared ground and three permanent fire-rings waits." },
  "22,5":    { name: "Stargazer's Hill",    kind: "landmark",  direction: "east",      description: "A high knoll in Crowsmoor Reach with a small stone observatory at its crown — three rooms, a brass quadrant, an astronomer of the Heron School in summer residence. The view at night is the best for ten leagues." },
  "-15,0":   { name: "Mendicant Bridge",    kind: "landmark",  direction: "west",      description: "A timber bridge across a Mire-channel west of the Inn. A kindly mendicant keeps a fire under it through the cold months and asks travellers for a story, not coin. Some say the stories are kept somewhere." },
};

export function getRumored(x, y) {
  return RUMORED[`${x},${y}`] || null;
}
