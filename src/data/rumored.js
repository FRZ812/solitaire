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
};

export function getRumored(x, y) {
  return RUMORED[`${x},${y}`] || null;
}
