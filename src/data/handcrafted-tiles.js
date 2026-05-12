// Hand-placed tiles defining the starting region. Coordinates are axial
// (pointy-top hex). v12 scale: each hex is ~250m, so the road between the Inn
// and Crowsmoor spans more than 20 hexes of mostly procedural country — a
// half-day's walk, not a stroll. The handcrafted entries are concrete vantages
// (a shrine, a gibbet, a knoll); everything else fills in procedurally per
// biome weights.
//
// `vistaRadius` on a tile means arriving there expands sight by that hex
// radius (handled in handleTravel). Use sparingly — only for genuine high
// points or named overlooks.
//
// Sections are organised by region. Multi-tile clusters give a sense of place
// — a village isn't one hex, it's a cluster (gate, square, smithy, inn).
export const HANDCRAFTED = {
  // ============================================================
  // THE DROWNED INN CLUSTER (centred on 0,0)
  // ============================================================
  "0,0":  { terrain: "indoor",     poi: { type: "inn",      name: "The Drowned Inn",  description: "The common room. Smoke-darkened beams, a peat fire, a long oak bar." } },
  "-1,0": { terrain: "settlement", poi: { type: "yard",     name: "Inn Yard",         description: "The packed-earth yard. A well, a hitching post." } },
  "0,-1": { terrain: "indoor",     poi: { type: "stable",   name: "Inn Stable",       description: "A low stable smelling of hay and old leather." } },
  "0,1":  { terrain: "settlement", poi: { type: "landmark", name: "Ferry Landing",    description: "A small wooden quay where the ferry meets the river." } },
  "-1,2": { terrain: "water",      poi: null },
  "1,-1": { terrain: "forest",     poi: null },

  // ============================================================
  // WEST ROAD THROUGH THE MIRE
  // ============================================================
  "-2,0": { terrain: "road",       poi: null },
  "-3,0": { terrain: "road",       poi: { type: "landmark", name: "The Crossroads",   description: "Three tracks meet under a leaning stone." } },
  "-2,-1":{ terrain: "forest",     poi: null },
  "-3,1": { terrain: "marsh",      poi: { type: "hidden", description: null } },
  "-4,0": { terrain: "road",       poi: null },
  "-5,0": { terrain: "road",       poi: { type: "shrine",   name: "Way-shrine of the Three", description: "A wooden three-faced shrine where the road first dips into the Mire. The carvings are sun-bleached and lichened." } },
  "-6,0": { terrain: "road",       poi: null },
  "-7,0": { terrain: "marsh",      poi: { type: "hidden", description: null } },
  "-8,0": { terrain: "road",       poi: null },
  "-9,0": { terrain: "road",       poi: { type: "landmark", name: "Sunken Wain",      description: "A wagon-bed half-swallowed by the bog beside the road. Its axles still stick up, painted long ago in colours no one quite remembers." } },
  "-10,0":{ terrain: "road",       poi: null },

  // ============================================================
  // EAST ROAD ACROSS THE MIRE (Inn → Reedmarsh → Mire's edge)
  // ============================================================
  "1,0":  { terrain: "road",       poi: null },
  "1,1":  { terrain: "marsh",      poi: { type: "hidden", description: null } },
  "2,-1": { terrain: "forest",     poi: null },
  "2,0":  { terrain: "road",       poi: null },
  "3,0":  { terrain: "settlement", poi: { type: "camp",     name: "Reedmarsh",        description: "Old Hareth's wagon-camp, a patch of dry ground in the reeds." } },
  "3,1":  { terrain: "marsh",      poi: null },
  "4,-1": { terrain: "marsh",      poi: { type: "hidden", description: null } },
  "4,0":  { terrain: "road",       poi: null },
  "5,0":  { terrain: "road",       poi: null },
  "5,1":  { terrain: "marsh",      poi: null },

  // ============================================================
  // THE LONG ROAD ACROSS CROWSMOOR REACH
  // ============================================================
  "6,0":  { terrain: "road",       poi: null },
  "7,0":  { terrain: "road",       poi: null },
  "8,0":  { terrain: "road",       poi: null },
  "9,0":  { terrain: "road",       poi: null },
  "10,0": { terrain: "road",       poi: null },
  "11,0": { terrain: "road",       poi: null },
  "12,0": { terrain: "settlement", poi: { type: "camp",     name: "The Open Heath Way-Station", description: "A coaching stop with a thatched roof, a stable, and a sour-faced tollman." } },
  "11,1": { terrain: "plains",     poi: { type: "landmark", name: "The Gibbet",                 description: "A wooden gibbet, currently empty. A militia ledger nailed to the post lists three names." } },
  "10,1": { terrain: "plains",     poi: { type: "hidden", description: null } },
  "13,0": { terrain: "road",       poi: null },
  "14,0": { terrain: "settlement", poi: { type: "inn",      name: "The Heath",                  description: "A long low inn with a slate roof and a yard for the wagons. Cheaper than Crowsmoor and twice the gossip." } },
  "14,-1":{ terrain: "plains",     poi: null },
  "14,1": { terrain: "plains",     poi: null },
  "15,0": { terrain: "road",       poi: null },
  "16,0": { terrain: "road",       poi: null },
  "17,0": { terrain: "road",       poi: null },
  "18,0": { terrain: "road",       poi: null },
  "19,0": { terrain: "road",       poi: null },
  "20,0": { terrain: "plains",     poi: { type: "landmark", name: "Five Stones",                description: "Five upright stones in a circle, taller than a man, weathered featureless. Older than Crowsmoor by a long way." } },
  "21,0": { terrain: "road",       poi: null },
  "22,0": { terrain: "road",       poi: null },
  "23,0": { terrain: "road",       poi: null },

  // ============================================================
  // CROWSMOOR TOWN CLUSTER
  // ============================================================
  "24,0": { terrain: "settlement", poi: { type: "gate",     name: "Crowsmoor West Gate",        description: "Stone posts, no doors. A militia ledger nailed to one." } },
  "25,0": { terrain: "settlement", poi: { type: "town",     name: "Crowsmoor",                  description: "The walled town of Crowsmoor. A market square at its centre with a stone well; three roads converge at the gates." } },
  "26,0": { terrain: "settlement", poi: { type: "gate",     name: "Crowsmoor East Gate",        description: "The road north leaves the town here." } },
  "26,-1":{ terrain: "indoor",     poi: { type: "smithy",   name: "The Smithy",                 description: "Crowsmoor's only smith." } },
  "25,1": { terrain: "indoor",     poi: { type: "temple",   name: "Temple",                     description: "A small temple. Stone benches, a single guttering candle." } },
  "25,-1":{ terrain: "indoor",     poi: { type: "mill",     name: "Mill House",                 description: "A working mill, the wheel groaning against the stream." } },
  "24,1": { terrain: "indoor",     poi: { type: "inn",      name: "The Sleeping Crow",          description: "Crowsmoor's tavern. Lower ceiling, lower prices." } },
  "27,-1":{ terrain: "indoor",     poi: { type: "stable",   name: "Crowsmoor Stable",           description: "Half a dozen stalls." } },
  "26,1": { terrain: "settlement", poi: { type: "garden",   name: "Temple Garden",              description: "Walled herb-beds and a few thin apple trees." } },
  "24,-1":{ terrain: "plains",     poi: { type: "hidden", description: null } },
  "27,0": { terrain: "road",       poi: null },
  "28,-1":{ terrain: "plains",     poi: null },

  // ============================================================
  // TANNIC WOOD (north of the Mire) — and the road to the Ford
  // ============================================================
  "0,-3":  { terrain: "forest",    poi: { type: "camp",     name: "Charcoal Camp",      description: "A blackened ring where a charcoal-burner lived through the autumn. Cooling now." } },
  "-3,-3": { terrain: "forest",    poi: { type: "landmark", name: "The Stag-Throne",    description: "An ancient oak shaped by some old pruning into a chair. Antlers are nailed across its back." } },
  "3,-3":  { terrain: "forest",    poi: { type: "shrine",   name: "Wood-Shrine",        description: "A clearing held by ash-trees. Offerings of bread and copper rest at the base of the eldest." } },
  "-5,-3": { terrain: "marsh",     poi: { type: "landmark", name: "Black Slough",       description: "A finger of marsh reaching north into the Wood. Bird-skulls hang from one of the alders." } },
  "-2,-4": { terrain: "hills",     poi: { type: "landmark", name: "Yew Knoll",          description: "A bare knoll crowned with three old yews. Cattle have refused to graze here in living memory." }, vistaRadius: 6 },
  "4,-4":  { terrain: "forest",    poi: { type: "hidden", description: null } },

  // North road toward the Tannic Ford
  "1,-4":  { terrain: "road",      poi: null },
  "2,-5":  { terrain: "road",      poi: null },
  "3,-6":  { terrain: "road",      poi: null },
  "3,-7":  { terrain: "road",      poi: null },
  "4,-8":  { terrain: "road",      poi: null },
  "4,-9":  { terrain: "road",      poi: null },
  "5,-10": { terrain: "road",      poi: null },
  "5,-11": { terrain: "road",      poi: null },
  "5,-12": { terrain: "settlement", poi: { type: "landmark", name: "The Tannic Ford",   description: "Where the wagon-track meets the river. The ferry-house stands roofless and char-eaved; a low timber slipway leads down to the gravel bar. In low water you can wade." } },
  "4,-12": { terrain: "marsh",      poi: { type: "ruin",      name: "Burnt Ferry-House", description: "A roofless shell of timber-and-daub. The hearth-stones are split through. A char-painted name is still legible on a beam: HARROD'S FORD." } },
  "6,-12": { terrain: "forest",     poi: null },
  "5,-13": { terrain: "road",       poi: null },

  // ============================================================
  // GOBLIN HOLLOW DEN CLUSTER (rumored den, NW)
  // Threshold (-8,-10) is the den mouth. Inner warren spirals down/west; the
  // King-of-Three's hollow at (-9,-13) is the deepest interior tile.
  // ============================================================
  // Approach & exterior
  "-7,-9":   { terrain: "forest", poi: { type: "landmark", name: "Hollow Mouth",         description: "A bramble-throat where the ground gives way into a stream-cut hollow. Goblin-sign — bone-charms tied to the lower branches, a kicked-over fire-ring." } },
  "-9,-10":  { terrain: "hills",  poi: { type: "landmark", name: "The Whistling Stones", description: "Three boulders fluted by wind into a sound between a whistle and a moan. Goblin scouts use them as a ward — if they go silent, somebody crossed below." }, vistaRadius: 4 },
  "-8,-11":  { terrain: "forest", poi: { type: "landmark", name: "Bone-Trees",           description: "Five young pines hung with strings of small bones. Crows roost here in numbers and do not scatter when you pass." } },
  "-7,-10":  { terrain: "forest", poi: { type: "hidden", description: null } },
  "-9,-9":   { terrain: "forest", poi: { type: "landmark", name: "Slop Pit",             description: "A wallowing-pit dug into a clay bank — refuse-bones, broken pots, a flap of skinned hide. The smell warns visitors as well as any sentry." } },

  // Threshold
  "-8,-10":  { terrain: "forest", poi: { type: "den",      name: "Goblin Hollow",        description: "The mouth of the den proper — a clay-and-root passage angling down into the hill. The air coming up out of it is warm and yeasty. Two crude torches set in iron sockets gutter at the entrance; both are lit." } },

  // Interior warren — indoor tiles spiralling inward
  "-9,-11":  { terrain: "indoor", poi: { type: "warren",   name: "The Antechamber",      description: "A low earthen vault held up by jammed roof-beams. Wet straw on the floor; a fire-ring under a smoke-hole that doesn't draw well. Three side-tunnels lead deeper." } },
  "-8,-12":  { terrain: "indoor", poi: { type: "warren",   name: "Sentry Burrow",        description: "A guard-warren — a half-dozen sleeping pallets and a stand of crude spears against the wall. The watch keeps two awake at any hour; usually no more." } },
  "-9,-12":  { terrain: "indoor", poi: { type: "warren",   name: "The Hounds' Run",      description: "A long, narrow tunnel kennelled with chained dogs — half-mastiff, half-bog-hound, fed on table-scraps and worse. They bark before they bite; sometimes." } },
  "-10,-11": { terrain: "indoor", poi: { type: "vault",    name: "The Coin-Hole",        description: "A side-chamber the goblins use as a treasury: a pit floored with mismatched copper and clay, capped by a flat stone the king sits on when he counts." } },
  "-10,-12": { terrain: "indoor", poi: { type: "shrine",   name: "Idol of the Three",    description: "A small alcove with a three-headed clay figure — the king, the queen, and the third one whose face has been pressed flat. Offerings of teeth at the base." } },
  "-9,-13":  { terrain: "indoor", poi: { type: "throne_room", name: "The King's Hollow", description: "The deep chamber. A king-of-three goblin sits on a chair stitched together from saddle-leather and broken shields. Two iron-collared mastiffs at his feet, a torch-bearer to either side. This is where the den ends." } },

  // ============================================================
  // CHARWOOD BURN (the long forest fire scar)
  // ============================================================
  "-3,-18": { terrain: "plains",   poi: { type: "ruin",     name: "Charwood Burn",      description: "A long blackened scar through the Tannic Wood. The trees on its edge are bone-white; the centre is grown over only in coarse fireweed. The Wood-Cult does not enter." } },
  "-2,-18": { terrain: "plains",   poi: { type: "hidden", description: null } },
  "-4,-17": { terrain: "forest",   poi: null },
  "-3,-19": { terrain: "plains",   poi: { type: "landmark", name: "The Burnt Shrine",   description: "What used to be a Wood-Shrine, now a ring of fire-cracked stone. The Cult has not rebuilt it; they say it was offered to the burn." } },

  // ============================================================
  // BROKENGLASS TOWER (NW glass blade) — surface ruin + buried hall
  // Threshold (-15,-20) is the blade itself. Inside the hill below it,
  // an older buried hall persists. Boss-figure / final tile is the
  // singing reliquary at (-15,-22).
  // ============================================================
  // Exterior
  "-14,-20": { terrain: "hills",  poi: { type: "landmark", name: "Glass-Light Slope",    description: "A south-facing slope rendered alien by the tower's coloured shadow at sunrise. Local goats refuse to lie here even in good weather." } },
  "-16,-20": { terrain: "hills",  poi: { type: "landmark", name: "The Singing Slab",     description: "A flat stone the size of a wagon-bed, set askew. Struck, it sings a note that doesn't quite decay. The goats DO eat near it." } },
  "-15,-21": { terrain: "forest", poi: { type: "landmark", name: "The Stranger's Camp",  description: "A fire-ring with the ashes still warm. Three different boot-prints, none of them matching local lasts." } },
  "-14,-21": { terrain: "hills",  poi: { type: "landmark", name: "Shard Field",          description: "A scattering of green-glass shards in the heather, the largest the length of a forearm. They do not warm in the sun." } },
  "-16,-21": { terrain: "hills",  poi: { type: "hidden", description: null } },

  // Threshold
  "-15,-20": { terrain: "hills",  poi: { type: "ruin",     name: "Brokenglass Tower",    description: "A blade of green glass thrusting from a low ridge, the height of three men. The fluting in it is too regular for nature. At dusk it casts a coloured stripe across the slope below. The base shows a crack large enough to descend through." }, vistaRadius: 8 },

  // Buried hall — older than the tower above; the tower is the chimney of this
  "-15,-19": { terrain: "indoor", poi: { type: "hall",     name: "The Glass Stair",      description: "Steps cut into the hillside, faintly green where the lamp-light catches them. They descend further than the tower's height would suggest." } },
  "-16,-22": { terrain: "indoor", poi: { type: "hall",     name: "The Light-Vault",      description: "A low vault domed in green glass, lit by sunlight that should not reach here. The walls hum faintly when you breathe." } },
  "-14,-22": { terrain: "indoor", poi: { type: "shrine",   name: "The Bowing Stones",    description: "A semicircle of small kneeling-stones, each polished by a thousand prostrations. One faces the wrong way." } },
  "-15,-22": { terrain: "indoor", poi: { type: "throne_room", name: "The Reliquary",     description: "The deepest chamber. A pedestal of green glass holds a single thing wrapped in white cloth — and a figure seated cross-legged opposite it, who has been waiting longer than any name remembers. Watch the cloth, not the figure." } },

  // ============================================================
  // WITCH-HAG'S COT (NW Bonemarsh edge) — the Hag herself at the cellar
  // ============================================================
  // Exterior
  "-11,-28": { terrain: "marsh",  poi: { type: "landmark", name: "Bonemarsh Causeway", description: "A line of laid stones across the soft ground — old and sinking. They point straight at the chimney." } },
  "-13,-27": { terrain: "marsh",  poi: { type: "landmark", name: "Knot Field",         description: "A patch of reeds tied in elaborate, regular knots. Walking among them feels wrong — your fingers go cold." } },
  "-12,-27": { terrain: "marsh",  poi: { type: "landmark", name: "Snare Walk",         description: "Half a dozen snares strung between stunted alders. The catches are unusual — small bones, a buckle, a length of red ribbon, a child's tooth." } },
  "-13,-28": { terrain: "marsh",  poi: { type: "garden",   name: "The Hag's Garden",   description: "A square of black earth lifted above the bog. Things grow here in winter — nightshade, blackthorn, three rows of something with leaves like wet hair." } },
  "-12,-29": { terrain: "marsh",  poi: { type: "hidden", description: null } },

  // Threshold
  "-12,-28": { terrain: "marsh",  poi: { type: "ruin",     name: "The Witch-Hag's Cot", description: "A tilted brick chimney rising out of marsh-grass — and, when you stand close, the lid of a half-sunk doorway in the peat beside it. Snares and clay charms hang in the reeds. The locals do not say her name aloud." } },

  // Interior
  "-11,-29": { terrain: "indoor", poi: { type: "hall",     name: "The Sitting-Room",   description: "A single low room with a peat fire and a chair pulled to face the door. A teacup sits on the floor by the chair, full." } },
  "-13,-29": { terrain: "indoor", poi: { type: "shrine",   name: "The Names-Wall",     description: "A wall scratched with names — hundreds, layered, in different hands and tools. Some have been crossed through; some are very recent." } },
  "-12,-30": { terrain: "indoor", poi: { type: "throne_room", name: "The Cellar",       description: "Down a short stair into peat-cool dark. A pallet, a kettle, a long table. The Hag is here — old as roots, polite, terribly attentive. There is a price for what she does. Some people pay it twice without knowing." } },

  // ============================================================
  // PILGRIM'S REST (way-village on the Whitemarch road)
  // ============================================================
  "12,-8":  { terrain: "settlement", poi: { type: "village",  name: "Pilgrim's Rest",   description: "A village halfway between Crowsmoor and Beltsworn, kept alive by foot-pilgrims to the Cathedral and the Stones. Two inns and a chapel; everyone keeps a clean step." } },
  "11,-8":  { terrain: "road",       poi: null },
  "13,-8":  { terrain: "road",       poi: null },
  "12,-9":  { terrain: "indoor",     poi: { type: "inn",      name: "The Wayfarer",     description: "A pilgrim-inn with three storeys and a chapel attached. Cheap dormitory beds, indifferent food, the prayers free." } },
  "12,-7":  { terrain: "indoor",     poi: { type: "temple",   name: "Pilgrim's Chapel", description: "A whitewashed chapel with three iron bells. Pilgrims hang strips of cloth at the door — wishes carried on toward Whitemarch." } },
  "11,-9":  { terrain: "settlement", poi: { type: "square",   name: "The Common",       description: "A muddy square with a stocks, a water-trough, and a stone marker counting the miles to Whitemarch (still legible) and to Tellmar (illegible)." } },
  "13,-9":  { terrain: "indoor",     poi: { type: "smithy",   name: "Iron-and-Shoe",    description: "A modest smithy doing pilgrim work — boot-nails, walking-iron, devotional pins struck from offcuts." } },

  // ============================================================
  // SKYFLASH TOWER (Whitemarch outrider signal-tower)
  // ============================================================
  "20,-10": { terrain: "settlement", poi: { type: "fortress", name: "Skyflash Tower",   description: "A square stone signal-tower three storeys high, garrisoned by Whitemarch outriders. At dusk a mirror on its parapet flashes word to the city: ALL WELL, or otherwise." }, vistaRadius: 12 },
  "19,-10": { terrain: "road",       poi: null },
  "21,-10": { terrain: "road",       poi: null },
  "20,-9":  { terrain: "plains",     poi: { type: "yard",     name: "Tower Yard",       description: "The walled yard at the foot of the tower. Six tethered horses; a forge for shoeing; a notice-board in three hands." } },
  "20,-11": { terrain: "indoor",     poi: { type: "stable",   name: "Tower Stable",     description: "Bigger than the tower's needs — the outriders relay mounts here in either direction." } },

  // ============================================================
  // CINDER CHAPTER (Burning Order chapter-house) — chapter buildings clustered
  // around the perpetual hearth. Master at the chapter-master's cell.
  // ============================================================
  // Threshold
  "30,-30": { terrain: "settlement", poi: { type: "fortress", name: "The Cinder Chapter", description: "A low chapter-house of fire-blackened stone — the Burning Order's only seat in this Vale. Bronze masks hung in the hall; the central fire has not been allowed to go out in eight generations." } },

  // Approach
  "30,-29": { terrain: "road",       poi: { type: "gate",     name: "Chapter Gate",     description: "An archway through a low outer wall; a charred wooden door, propped open by day. The arch is carved with masks running its full length." } },
  "31,-29": { terrain: "settlement", poi: { type: "yard",     name: "Walking-Yard",     description: "The yard where novices walk with lit braziers strapped to their backs as a discipline. Stone-paved, kept swept; the floor blackened in seven concentric rings." } },
  "29,-29": { terrain: "settlement", poi: { type: "stable",   name: "Chapter Stable",   description: "Six stalls, all occupied — the Order keeps swift mounts for relay-rides to the Drakeholt outriders. The horses are quartered with the smell of forge-smoke and barely flinch at fire." } },

  // Outer ring (chapter buildings)
  "31,-30": { terrain: "indoor",     poi: { type: "hall",     name: "The Mask-Hall",    description: "A long hall lined with bronze masks on iron pegs. One peg per oath-bound brother since the founding. Three pegs are bare and oiled — vacancies." } },
  "29,-30": { terrain: "indoor",     poi: { type: "smithy",   name: "Chapter Forge",    description: "Where the bronze masks are struck and the lances for the dragon-walks are forged. A blade-tongs hangs on the wall older than the chapter itself." } },
  "30,-31": { terrain: "indoor",     poi: { type: "shrine",   name: "The Hearth",       description: "The chapter's perpetual fire, eight generations unbroken. A young postulant tends it; relieved every hour day or night." } },
  "31,-31": { terrain: "indoor",     poi: { type: "hall",     name: "Refectory",        description: "A long table that seats forty — the chapter eats together. Bowls of plain food; a reader's lectern at one end, currently with a battered copy of the Sermon on the Smoke." } },
  "29,-31": { terrain: "indoor",     poi: { type: "shop",     name: "The Lance-Vault",  description: "A locked stone room behind the forge — racks of bronze-headed lances, dragon-iron rivets, jars of green-fire oil. The vault is the chapter's reason for being." } },
  "32,-30": { terrain: "indoor",     poi: { type: "hall",     name: "Novice Dormitory", description: "Sixteen narrow beds in two facing rows. A bronze brazier glowing dim at each end. The novices sleep in their cloaks." } },
  "28,-30": { terrain: "indoor",     poi: { type: "hall",     name: "Archive Room",     description: "Wall-cases of bound ledgers — every dragon-walk since the founding, every brother lost, every confirmed kill." } },

  // Inner — master's cell
  "30,-32": { terrain: "indoor",     poi: { type: "throne_room", name: "The Chapter-Master's Cell", description: "A small windowless chamber behind the Hearth. The Chapter-Master sleeps here on a plain pallet. A bronze mask older than the Chapter rests on his nightstand. He is permitted no visitors and entertains them anyway." } },

  // ============================================================
  // BURNT CROFT (E ruin)
  // ============================================================
  "18,5":  { terrain: "plains",    poi: { type: "ruin",     name: "The Burnt Croft",    description: "A farmhouse burned to its foundation-stones. A signpost still names ÆLF & PIETT; nobody has taken it down. The fence-line is grown over with bramble." } },
  "17,5":  { terrain: "plains",    poi: { type: "landmark", name: "The Heather Cairn",  description: "A small cairn of field-stones in the heather. Three pebbles laid carefully on top — somebody has visited in the last month." } },
  "18,6":  { terrain: "plains",    poi: { type: "hidden", description: null } },

  // ============================================================
  // HOLLYMAN'S CROSSING (E road-village, fork)
  // ============================================================
  "30,0":  { terrain: "settlement", poi: { type: "village",  name: "Hollyman's Crossing", description: "A small road-village where the east road forks — south for the Spine, east for the Iron Plateau. A holly tree grows in the centre of the green, older than the village." } },
  "29,0":  { terrain: "road",       poi: null },
  "31,0":  { terrain: "road",       poi: null },
  "30,-1": { terrain: "indoor",     poi: { type: "inn",      name: "The Holly-Bough",    description: "An inn known for its strong cider and weak ale. The taproom is built around the holly itself — its trunk pierces the floor and the roof." } },
  "30,1":  { terrain: "indoor",     poi: { type: "smithy",   name: "Crossing Smithy",    description: "A smithy that does wagon-iron and pilgrim-iron in equal share. The smith is a grim woman with a Spine-tribe accent and a Whitemarch ledger." } },
  "29,1":  { terrain: "indoor",     poi: { type: "shop",     name: "Hollyman's Stores",  description: "A general-stores stocked for both the southern and the eastern roads. Trail-rations, lamp-oil, salt, salt, more salt." } },
  "31,-1": { terrain: "road",       poi: null },

  // ============================================================
  // CAER DRUM (SE hillfort ruin) — outer wall + inner buildings; a Spine
  // sept holds the south keep through winter. Boss / hidden: a Spine warlord
  // claimant in the southern keep.
  // ============================================================
  // Threshold and outer ring
  "15,15": { terrain: "hills",     poi: { type: "ruin",     name: "Caer Drum",           description: "A low hillfort of dressed grey stone, the outer wall mostly intact, the inner buildings rubble. Spine herders winter sheep inside. The keep-stones are blackened in patches — somebody fought a fire here once." }, vistaRadius: 8 },
  "14,15": { terrain: "settlement", poi: { type: "gate",     name: "The West Gate",      description: "An arch of dressed stone, the doors long gone. Sheep-droppings on the threshold; a herder's chalked tally on the lintel." } },
  "16,15": { terrain: "settlement", poi: { type: "gate",     name: "The East Sally-Port", description: "A narrow postern in the east wall, half-collapsed. Tracks suggest somebody comes and goes through it; the herders pretend not to notice." } },
  "15,14": { terrain: "hills",     poi: { type: "landmark", name: "The Cattle Stones",   description: "Five stones set deep, joined by a low wall — a herder's holding-pen, half-fallen. Used in the off-season." } },
  "15,16": { terrain: "forest",    poi: { type: "landmark", name: "The Burial Bank",     description: "An earthen ridge below the fort's south wall, scattered with old shaped stones. Burials, or a collapsed barrack-line; the Spine sept argues either way." } },

  // Inner ring
  "14,16": { terrain: "indoor",    poi: { type: "hall",     name: "The Mead-Hall",       description: "A roofless great-hall of fallen black timbers, the hearth still recognisable in the centre. Crows nest in what was the rafters." } },
  "16,14": { terrain: "indoor",    poi: { type: "armoury",  name: "The Armoury",         description: "A half-buried stone vault. Empty racks, an iron-bound chest with the lock broken, three skulls in a corner laid out neat." } },
  "15,13": { terrain: "indoor",    poi: { type: "shrine",   name: "The Hawk-Shrine",     description: "A small stone shrine set into the north wall. A worn carving of a hawk on a man's shoulder; offerings of small bones." } },
  "16,16": { terrain: "indoor",    poi: { type: "stable",   name: "The Sheep-Pen",       description: "What was a stable, now used as a pen. Hay piled at one end; a Spine herder's hat hangs from a nail by the door." } },
  "14,14": { terrain: "indoor",    poi: { type: "cellar",   name: "The Drum Cellar",     description: "A deep barrel-vault below the hall — the fort's namesake, said to be where they kept the war-drum that called the levy. The drum is gone." } },

  // Deepest tile — held by the sept's claimant warlord through winters
  "15,17": { terrain: "indoor",    poi: { type: "throne_room", name: "The South Keep",  description: "The keep-tower, the only roof still on a Caer Drum building. The Spine sept holds it. Inside: a hearth, a long table, and whichever claimant of the Drum-Banner is currently quartered there — usually three to a dozen warriors with him." } },

  // ============================================================
  // MOSSBRIDGE HOLD (SE small fortress) — beck crossing + tower-house
  // ============================================================
  // Threshold
  "20,12": { terrain: "settlement", poi: { type: "fortress", name: "Mossbridge Hold",   description: "A stone tower-house with an attached stable, holding the crossing of a small beck. Manned in summer by a Spine-tribe sept; locked and shuttered in winter." } },

  // Beck approach
  "20,11": { terrain: "road",      poi: { type: "landmark", name: "The Mossbridge",     description: "A single arched stone bridge, moss-grown to the parapet, holding rain in three or four shallow puddles. The Spine sept charge a copper for a beast and nothing for a man." } },
  "19,12": { terrain: "hills",     poi: { type: "landmark", name: "West-bank Camp",     description: "A flat shelf above the beck where summer travellers camp without paying. A fire-ring; a long-dead lantern hook on a hawthorn." } },
  "21,12": { terrain: "hills",     poi: { type: "landmark", name: "East-bank Watch",    description: "A low cairn used as a watchpoint by the sept. From here the bridge is in full view; a horn-call carries to the tower." } },

  // Inner tower
  "20,13": { terrain: "indoor",    poi: { type: "stable",   name: "Mossbridge Stable",  description: "Cramped, fragrant, and warm — six stalls and a hayloft. The sept's only luxury." } },
  "21,11": { terrain: "indoor",    poi: { type: "hall",     name: "Hold Ground-Hall",   description: "The lower hall of the tower-house. A long table, a banked fire, three stools and a folding chair the captain uses. A trapdoor in the floor; a stair in the corner." } },
  "21,13": { terrain: "indoor",    poi: { type: "cellar",   name: "Hold Cellar",        description: "Below the ground-hall: salt-stores, a brick of cured ham, a wheel of hard cheese, a barrel of small-beer with the tap mended twice." } },
  "20,14": { terrain: "indoor",    poi: { type: "armoury",  name: "Hold Armoury",       description: "Up a short stair from the hall: a rack of six spears, three crossbows, a stack of bolts in oiled cloth. A coat of mail on a peg, its owner not currently in residence." } },
  "19,13": { terrain: "indoor",    poi: { type: "throne_room", name: "The Captain's Loft", description: "The tower's top room — a single window each way, a bed pushed against one wall, a desk under the south light. The captain of the sept sleeps and works here when in residence; in winter a single steward lives here alone." } },

  // ============================================================
  // OGRE STAIR (SE den) — cliff-cut stair + cave system; the ogre sleeps
  // at the deepest tile.
  // ============================================================
  // Threshold + approach
  "30,28": { terrain: "mountains", poi: { type: "den",      name: "The Ogre Stair",     description: "A switchback of carved stone steps cut into a cliff-face, each step too tall for a man. The mouth at the top is dark, smells of old grease, and the wind blowing out of it is warm." }, vistaRadius: 10 },
  "29,28": { terrain: "mountains", poi: { type: "landmark", name: "The Warning Cairn",  description: "A cairn rebuilt every spring by Spine scouts: do not go further. Three skulls — bear, deer, the third recognisably human — set on its crown." } },
  "30,27": { terrain: "mountains", poi: { type: "landmark", name: "Lower Switchback",   description: "The bottom of the great stair. Black-greasy steps, sized for a stride longer than a man's. Worn shiny in the middle by long, slow descents." } },
  "31,27": { terrain: "mountains", poi: { type: "landmark", name: "Crowned Stone",      description: "A boulder at the head of the cliff-path on which the ogre, or something with similar habits, has carefully balanced a man's helmet." } },

  // Vestibule
  "29,29": { terrain: "indoor",    poi: { type: "hall",     name: "Bone Vestibule",     description: "A wide cave mouth where the prey is dropped before the eating. The floor is paved in cracked bones; a path is worn through them by something dragging itself in and out." } },
  "30,29": { terrain: "indoor",    poi: { type: "warren",   name: "The Larder",         description: "A side-chamber the ogre uses as a larder. Three half-eaten things hanging from iron hooks; flies in numbers that should not survive winter." } },
  "31,28": { terrain: "indoor",    poi: { type: "warren",   name: "The Hoard Pile",     description: "A pile of what the ogre has thought worth keeping: belt-buckles, a halberd, two pairs of riding boots (one bloody), an unstrung lute." } },

  // Deepest tile
  "30,30": { terrain: "indoor",    poi: { type: "throne_room", name: "The Snoring Hollow", description: "A high-ceilinged chamber warm with body-heat. The ogre sleeps here on a mound of pelts and stolen cloaks — when it sleeps. It is not always asleep." } },

  // ============================================================
  // HOLLOW CAIRN (S ruin)
  // ============================================================
  "8,12":  { terrain: "hills",     poi: { type: "ruin",     name: "Hollow Cairn",       description: "A burial cairn split open along its long axis — frost or hand. Inside, the slabs are carved with a script nobody alive reads aloud. The local goats refuse the slope." } },
  "7,12":  { terrain: "plains",    poi: null },
  "9,12":  { terrain: "hills",     poi: { type: "hidden", description: null } },

  // ============================================================
  // BRAMBLE FERRY (S waterway crossing)
  // ============================================================
  "5,18":  { terrain: "settlement", poi: { type: "landmark", name: "Bramble Ferry",     description: "A pole-ferry across a slow stretch of water at the southern edge of the Reach. The ferryman is short, foul-tempered, and accepts copper or a story; he is particular about which." } },
  // (4,18) and (6,18) are left to the Whitewend river path; the ferry crosses there.
  "5,17":  { terrain: "road",      poi: null },
  "5,19":  { terrain: "road",      poi: null },

  // ============================================================
  // GREYPOOL (S coast-edge fishing village)
  // ============================================================
  "0,35":  { terrain: "settlement", poi: { type: "village",  name: "Greypool",          description: "A reed-built fishing village on the inland edge of the Hollow Coast. The houses are stilted; the lanes are plank. The Tideless visit twice a year and the village keeps its lamps shuttered those nights." } },
  "-1,35": { terrain: "indoor",     poi: { type: "inn",      name: "The Reed-Lantern",  description: "A stilt-built inn with a fish-oil lantern blue-hooded against the Tideless visits. The food is fish and the drink is fish and the beds are dry." } },
  "1,35":  { terrain: "indoor",     poi: { type: "smithy",   name: "Pool-Smithy",       description: "A smith working mostly in salt-rusted iron — boat-fittings, eel-spears, hinges replaced twice a year." } },
  "0,34":  { terrain: "road",      poi: null },
  "0,36":  { terrain: "settlement", poi: { type: "landmark", name: "The Boat-Pyre",    description: "A low platform where the village burns its lost. Three flat stones for ash; a fourth, always kept clean, for the Tideless." } },

  // ============================================================
  // TANNIC MILL (W milling hamlet)
  // ============================================================
  "-22,-3":{ terrain: "settlement", poi: { type: "village",  name: "Tannic Mill",       description: "A milling-hamlet on a side-channel of the Tannic. Six houses and the mill. The miller takes a tenth in flour and a thirteenth in talk." } },
  "-22,-2":{ terrain: "indoor",    poi: { type: "mill",     name: "The Mill",          description: "A working water-mill, the wheel groaning. The miller is a tall man missing two fingers and most opinions about his neighbours." } },
  "-21,-3":{ terrain: "road",      poi: null },
  "-23,-3":{ terrain: "road",      poi: null },
  "-22,-4":{ terrain: "plains",    poi: null },

  // ============================================================
  // BRIARCROSS (W crossroads-village, witch-tolerated)
  // ============================================================
  "-25,10":{ terrain: "settlement", poi: { type: "village",  name: "Briarcross",        description: "A crossroads-village in the Bramblewych. Hedge-witches teach openly here; the Wardens leave it alone. The hedges between the houses are taller than the houses." } },
  "-24,10":{ terrain: "indoor",    poi: { type: "inn",      name: "The Briarwick",     description: "An inn whose walls are woven hawthorn over a timber frame. The food is plain; the questions asked at the door are not." } },
  "-26,10":{ terrain: "indoor",    poi: { type: "hall",     name: "The Teaching-Hedge", description: "A long open shed where the witches take pupils. A row of small wooden chairs faces a stump set with a chalked slate." } },
  "-25,9": { terrain: "indoor",    poi: { type: "shop",     name: "Briar's Stores",    description: "A small shop run by a half-deaf woman who also sells charms under the counter — three to a string, no haggling." } },
  "-25,11":{ terrain: "settlement", poi: { type: "square",   name: "The Briar Common", description: "A village green roofed entirely by old, low-trained hawthorn. Standing under it at noon, the light is the colour of weak tea." } },
  "-25,12":{ terrain: "road",      poi: null },
  "-25,8": { terrain: "road",      poi: null },

  // ============================================================
  // THE BLACK MOUND (W ruin)
  // ============================================================
  "-30,-5":{ terrain: "hills",     poi: { type: "ruin",     name: "The Black Mound",   description: "A black-earth tumulus the size of a barn. Locals warn that nothing planted near it grows; carrion crows nest on it summer-long, in numbers larger than the available food can explain." } },
  "-29,-5":{ terrain: "plains",    poi: { type: "hidden", description: null } },
  "-30,-4":{ terrain: "plains",    poi: { type: "landmark", name: "Crowless Field",   description: "A field where the wind moves the grass and nothing else. No birds; no insects. Locals walk around it." } },

  // ============================================================
  // BRAMBLEWYCH REACH (S of the Mire) — kept and extended
  // ============================================================
  "0,3":   { terrain: "forest",    poi: { type: "landmark", name: "The Hedge-Maze",     description: "An overgrown maze of hawthorn higher than a man. The original purpose is no longer remembered." } },
  "-2,3":  { terrain: "plains",    poi: { type: "landmark", name: "The Bramble Cairn",  description: "A waist-high cairn buried in briar. Coins of a forgotten mint litter its base." } },
  "-4,4":  { terrain: "marsh",     poi: { type: "landmark", name: "The Drowned Field",  description: "A square of low ground that was once tilled. The furrows still hold under the water." } },
  "2,3":   { terrain: "forest",    poi: { type: "hidden", description: null } },
  "7,3":   { terrain: "hills",     poi: { type: "landmark", name: "The Watchpost",      description: "A stone tower, two stories, half-fallen. Someone keeps a fire in it some nights. From the top the country opens up for miles." }, vistaRadius: 12 },
  "9,3":   { terrain: "hills",     poi: { type: "hidden", description: null } },
  // A second wolf-den, well within reach south of the road
  "4,7":   { terrain: "forest",    poi: { type: "den",      name: "The Wolf-Pit",         description: "A natural pit deepened by use, lined with old kills. A grey-pelted pack winters here. Local shepherds bring a tithe of mutton in lambing season; the pack returns the favour by harrying smaller predators." } },
  "3,7":   { terrain: "forest",    poi: { type: "landmark", name: "The Bone-Strewn Track", description: "A game-trail strewn with old bones — sheep, deer, the occasional bigger thing. Walking it you feel watched, but the wolves seldom show themselves by day." } },
  "5,7":   { terrain: "forest",    poi: { type: "landmark", name: "The Sheep-Tithe Stone", description: "A flat boulder at the edge of the pack's range. Shepherds leave a quarter of mutton on it through the cold months; in the morning the stone is clean." } },
  "4,8":   { terrain: "forest",    poi: { type: "warren",   name: "Kit-Warren",           description: "A network of half-dug burrows where the pack's young are kept. The bitch-wolves do not allow strangers within three trees of it; they will close to a kill without warning." } },
  "4,6":   { terrain: "forest",    poi: { type: "throne_room", name: "The Old Wolf's Hollow", description: "A deep root-hollow under a fallen oak, dry under the worst rain. The pack's old grey leader takes his shelter here — older than any wolf has a right to be, lame in one foreleg, eyes the colour of a winter sky. He has been seen to watch men without rising." } },

  // ============================================================
  // WHITEMARCH (city, Whitemarch Iron)
  // ============================================================
  "40,-20": { terrain: "settlement", poi: { type: "city",      name: "Whitemarch",            description: "The walled iron-city. Tax-farmers and militiamen, the Cathedral bell that times the workers, the smell of iron-shavings on the wind." } },
  "41,-20": { terrain: "settlement", poi: { type: "gate",      name: "Whitemarch East Gate",  description: "Stone-arched, double-doored, manned by a pair of bored militiamen with the iron crest at their shoulders." } },
  "40,-21": { terrain: "indoor",     poi: { type: "cathedral", name: "The Iron Cathedral",    description: "A vault of iron and white stone. The bell weighs three tons; iron-workers throughout the city orient their day by its tolls." } },
  "39,-20": { terrain: "settlement", poi: { type: "gate",      name: "Whitemarch West Gate",  description: "The road from Crowsmoor and Beltsworn enters here. Always a queue of carts at midday." } },
  "40,-19": { terrain: "settlement", poi: { type: "gate",      name: "Whitemarch South Gate", description: "Wagon-rutted ground, the road south toward the Mire." } },
  "41,-21": { terrain: "indoor",     poi: { type: "mint",      name: "The Royal Mint",        description: "Where the Whitemarch iron-shilling is struck. Guarded around the clock." } },
  "39,-21": { terrain: "indoor",     poi: { type: "hall",      name: "Knights' Hall",         description: "The garrison of the city's small standing army. Three banners hang inside; only one of them is current." } },
  "39,-19": { terrain: "indoor",     poi: { type: "smithy",    name: "The Forges",            description: "Twenty-three forges crowd this district, all bound to the city's iron monopoly." } },
  "41,-19": { terrain: "indoor",     poi: { type: "hall",      name: "The Counting House",    description: "The city's mercantile heart. Where ledgers are reconciled and quiet ruin is contracted." } },
  "41,-22": { terrain: "indoor",     poi: { type: "palace",    name: "The Iron Palace",       description: "Seat of the Lord-Treasurer. Less a palace than an over-large counting-house with battlements." } },
  "40,-22": { terrain: "settlement", poi: { type: "gate",      name: "Whitemarch North Gate", description: "The road northeast toward the Tannic Fords and the broader empire." } },
  "38,-20": { terrain: "road",       poi: null },
  "42,-20": { terrain: "road",       poi: null },
  "42,-21": { terrain: "settlement", poi: { type: "square",    name: "Trade Quarter",         description: "A wider square where the iron-merchants hold their accounts. Crowded at dawn, empty by noon." } },
  "42,-22": { terrain: "indoor",     poi: { type: "hall",      name: "Iron Counting House",   description: "Smaller than the central Counting House — this annex deals with retail and small loans." } },
  "39,-22": { terrain: "indoor",     poi: { type: "inn",       name: "The Sleeping Knight",   description: "An inn for visiting nobles. Marble lintels, real fires, prices to match." } },
  "38,-19": { terrain: "indoor",     poi: { type: "shop",      name: "Cobblers' Row",         description: "A row of shoe-makers and harness-mongers along the inner wall." } },
  "38,-21": { terrain: "settlement", poi: { type: "yard",      name: "Beggars' Row",          description: "Where the city's beggars are licensed and tolerated. A queue forms before each Cathedral bell." } },
  "38,-18": { terrain: "settlement", poi: { type: "yard",      name: "Outer Slums",           description: "Beyond the inner wall. Tin-roofed shacks; the iron-shavings dust the children." } },
  "40,-18": { terrain: "settlement", poi: { type: "yard",      name: "South Wagon-Yard",      description: "The unloading-yard for southbound caravans. Stained brown with mule-dung." } },
  "39,-18": { terrain: "indoor",     poi: { type: "shop",      name: "Tannery Lane",          description: "Where the city's hides are processed. The smell is famous and worse than its reputation." } },

  // ============================================================
  // BRAMBLEWYCH (village, Bramble Witches)
  // ============================================================
  "-25,20": { terrain: "settlement", poi: { type: "village",   name: "Bramblewych",           description: "A village of moss-roofed cottages and hedge-mazes. The earth here knows the names of the dead." } },
  "-24,20": { terrain: "indoor",     poi: { type: "inn",       name: "The Hanging Garlic",    description: "A low-ceilinged inn where most patrons are pilgrims. Garlic-strings, dried marigolds, the smell of warm bread and goose-fat." } },
  "-24,19": { terrain: "indoor",     poi: { type: "hall",      name: "The Bramble House",     description: "A long-house of woven hawthorn, where the witches hold council." } },
  "-25,19": { terrain: "indoor",     poi: { type: "shrine",    name: "The Witch's Shrine",    description: "A single-room shrine to no named god — the bramble-witches refuse to name their patrons." } },
  "-26,20": { terrain: "settlement", poi: { type: "garden",    name: "The Herb Garden",       description: "A communal garden of physic-plants. Every villager has a row." } },
  "-26,21": { terrain: "indoor",     poi: { type: "smithy",    name: "The Iron-Bender",       description: "A small smithy serving the village. Iron-work for charms, plow-shares, and nails." } },
  "-25,21": { terrain: "settlement", poi: { type: "square",    name: "Bramblewych Common",    description: "A muddy common where village business is done. A single well and a hanging-tree, currently unused." } },
  "-23,20": { terrain: "road",       poi: null },
  "-27,20": { terrain: "road",       poi: null },

  // ============================================================
  // BELTSWORN (village, Whitemarch Iron; frontier on the road)
  // ============================================================
  "25,-15": { terrain: "settlement", poi: { type: "village",   name: "Beltsworn",             description: "A frontier village halfway between Crowsmoor and Whitemarch. Paid in iron coin to keep the road open." } },
  "26,-15": { terrain: "indoor",     poi: { type: "inn",       name: "The Strap-and-Bell",    description: "A coaching-inn where the road-wardens stable their horses. Loud at suppertime; quiet by midnight." } },
  "24,-15": { terrain: "settlement", poi: { type: "gate",      name: "Beltsworn Gate",        description: "A wooden gate-house, repaired so often it's mostly recent timber." } },
  "25,-14": { terrain: "indoor",     poi: { type: "smithy",    name: "The Wagon-Smith",       description: "The village smith does mostly wagon-iron — felloes, axle-pins, draw-pins." } },
  "25,-16": { terrain: "indoor",     poi: { type: "hall",      name: "Warden's Hall",         description: "The road-wardens' barracks. Six bunks; usually four are occupied." } },
  "23,-15": { terrain: "road",       poi: null },
  "27,-15": { terrain: "road",       poi: null },

  // ============================================================================
  // ============================================================================
  // FABLED STRUCTURES — laid out per Ruling 2 of docs/WORLDBUILDING.md.
  //
  // The player will not normally reach these. Their layouts exist so that:
  //   1. NPCs can speak about them with internal geography.
  //   2. If a long-arc quest, dream, artifact, or spell brings the player
  //      there, the structure is already built — and is genuinely a place
  //      to explore, not a single tile to visit-fight-leave.
  //
  // All coords below have |x| or |y| ≥ 60 so they never overlap close-in
  // data and never render on the local map.
  // ============================================================================
  // ============================================================================

  // ============================================================
  // NORTHSTAR CASTLE — seat of the Demon King (~25 tiles, four wards)
  // Threshold at (30,-150). Sanctum at (30,-153).
  // ============================================================
  // Outer ward — frostbitten approach, barbican, killing-ground
  "29,-149": { terrain: "mountains", poi: { type: "landmark",   name: "Polestar Approach",     description: "The road that does not end. The last verst before the gate — black ice on basalt, the cold of a place where the sun does not finish setting. Travellers' bones lie in the verge where they sat down once too long." } },
  "31,-149": { terrain: "mountains", poi: { type: "landmark",   name: "The Watcher-Pillars",   description: "Two pillars of black stone, taller than a town's spire. Carved faces on each. Their gaze is colder than the wind." } },
  "30,-149": { terrain: "settlement", poi: { type: "gate",       name: "The Frost Barbican",    description: "A barbican of ice-glassed iron. Two pairs of doors, both standing open. The threshold is etched with names; not all of them are in any language you know." } },
  "30,-150": { terrain: "settlement", poi: { type: "fortress",   name: "Northstar Castle",      description: "The Demon King's seat. The polestar overhead does not move. The walls are blacker than night and hum at frequencies just below hearing. The outer ward is paved with old swords laid edge-down — pilgrims, suitors, would-be assassins, every one." } },
  "29,-150": { terrain: "settlement", poi: { type: "yard",       name: "The Killing-Ground",    description: "A square of paved black stone where the King takes counsel from those who came with steel. Three iron pikes set in the centre, all currently occupied." } },
  "31,-150": { terrain: "settlement", poi: { type: "stable",     name: "The Cold Stables",      description: "Stables for the King's outriders — beasts that breathe a vapour that does not warm the air. The grooms here volunteered. There is no other way to be a groom here." } },

  // Inner ward — courts, devil halls, oath-bound barracks
  "30,-151": { terrain: "settlement", poi: { type: "yard",       name: "The Black Court",       description: "An inner ward without sky — the polestar walled off by the keep above. Braziers of green-blue flame. Petitioners stand here. They do not sit." } },
  "29,-151": { terrain: "indoor",     poi: { type: "hall",       name: "The Devil-Hall",        description: "A long hall where the King's chosen take their meat. Their host is a courtesy; their hunger is not. Pull no chair you have not been offered." } },
  "31,-151": { terrain: "indoor",     poi: { type: "hall",       name: "The Oath-Barracks",     description: "Dormitory of the oath-bound dead — knights and lords who bartered their last sleep for a place at the King's side. The pallets are made every morning by hands that do not need to. The pallets are slept on by no one." } },
  "28,-150": { terrain: "indoor",     poi: { type: "armoury",    name: "The Sword-Wall",        description: "Every blade ever surrendered at the gate hangs here, polished, oiled, and labelled with the name of the bearer. Some of the names are still warm." } },
  "32,-150": { terrain: "indoor",     poi: { type: "vault",      name: "The Tribute-Vault",     description: "Stacked crates, kingdom-tags burned into the wood. Salt, ore, books, virgin-spun cloth, three things in jars that move occasionally. Tribute from peoples who pretend they do not pay." } },

  // Sanctum approach — chapel of cold things, oracle's well
  "30,-152": { terrain: "indoor",     poi: { type: "shrine",     name: "The Chapel of Cold Things", description: "A chapel without a god. The pews face a single tall window of black glass through which something occasionally moves. Lit candles burn here without their wicks shortening." } },
  "29,-152": { terrain: "indoor",     poi: { type: "warren",     name: "The Below-Stair",       description: "A narrow stair descending and ascending at once, depending where you set your foot. Used by the King's couriers. Don't put two feet on the same step." } },
  "31,-152": { terrain: "indoor",     poi: { type: "shrine",     name: "The Oracle's Well",     description: "A round well of black water in a small octagonal room. Drop a coin; you may be answered. You may be answered by someone you did not ask." } },

  // Throne — the polestar throne
  "30,-153": { terrain: "indoor",     poi: { type: "throne_room", name: "The Polestar Throne",   description: "A high vault open at the apex to a single fixed star. The throne is a chair of fused iron and frost-stone, set on a dais of nine steps each colder than the last. The Demon King sits, when He sits, where the star can see Him directly. Most often He does not sit." } },

  // ============================================================
  // BROKENHOLD — Vault of the Goblin King (~22 tiles, nested wards)
  // Threshold (-120,-60). Throne at (-120,-63). Imperial vault older than
  // every banner that has flown above it.
  // ============================================================
  // Outer wall — broken & rebuilt mismatched
  "-121,-59": { terrain: "hills",      poi: { type: "landmark",   name: "Tribute Hill",          description: "A long earth ramp scraped flat by countless wheels. Tribute-wagons stack three deep on it on market days. The grass is gone." } },
  "-119,-59": { terrain: "hills",      poi: { type: "landmark",   name: "The Sundered Stones",    description: "A heaped-up cairn the height of a wagon, built from the smashed standing-stones of whichever god ruled here before. A goblin cookfire smoulders at its base." } },
  "-120,-59": { terrain: "settlement", poi: { type: "gate",       name: "The Broken Gate",       description: "The outer gate of Brokenhold — half its arch still imperial dressed-stone, the other half rebuilt in raw boulders with iron pegs. The doors are made of three lashed plank-walls. They are not properly opened or closed; they are dragged." } },
  "-120,-60": { terrain: "settlement", poi: { type: "fortress",   name: "Brokenhold",            description: "The Vault of the Goblin King. An imperial fortress of the second age, squatted by the Sundered Crown. Mismatched stone, fluttering banners, cookfires in every angle of the curtain wall, the smell of smoke and animal and unwashed steel. The shape of empire is still inside it, like a skeleton in a sack." } },
  "-121,-60": { terrain: "settlement", poi: { type: "yard",       name: "The Slop Ward",         description: "A cobbled outer yard now an open butchery and kitchen. Three fires, four spits, a chained mastiff at each. Three captured banners hang from one wall as flags of triumph." } },
  "-119,-60": { terrain: "settlement", poi: { type: "yard",       name: "The Slave-Pens",        description: "A long roofless ward divided into pens. People in them — most of them quiet. A goblin overseer with a whip too large for him sits on a rail." } },

  // Second wall
  "-120,-61": { terrain: "settlement", poi: { type: "gate",       name: "The Inner Gate",        description: "An imperial gate intact — black iron, oiled, working. The Sundered Crown's only piece of restraint; they have not let it fall." } },
  "-121,-61": { terrain: "indoor",     poi: { type: "hall",       name: "The War-Room",          description: "A high vault hung with maps slashed into being and reslashed into uselessness. A long table covered in mismatched figurines representing every war-band the King has notionally aligned. The figurines change positions when no one is looking." } },
  "-119,-61": { terrain: "indoor",     poi: { type: "hall",       name: "Captains' Hall",        description: "A mead-hall of the orcs and goblins who command war-bands. Twelve names painted onto the wall by a careful and patient hand — three of them crossed through this season." } },
  "-122,-60": { terrain: "indoor",     poi: { type: "vault",      name: "The Old Treasury",      description: "An imperial treasury room. Its older locks have been pried off; new chains and crude padlocks substitute. Inside: a strange mix of imperial gold, copper junk, and recent loot still bloody on the seals." } },
  "-118,-60": { terrain: "indoor",     poi: { type: "dungeon",    name: "The Black Cells",       description: "Old imperial gaol cells, still in use. Some of the prisoners have been here since before the squatters arrived." } },

  // Inner keep
  "-120,-62": { terrain: "indoor",     poi: { type: "hall",       name: "The Imperial Hall",     description: "The great hall — older than the banners, intact. Marble floor, vaulted ceiling, an empty dais. The orcs do not sit here. They use it as a corridor. The Goblin King uses it as a corridor too." } },
  "-121,-62": { terrain: "indoor",     poi: { type: "armoury",    name: "The Engine Yard",       description: "An interior court the orcs use for assembling siege-engines too large to wheel through the outer gates. Three half-built things. Two priests of the Sundered Crown tending the third." } },
  "-119,-62": { terrain: "indoor",     poi: { type: "shrine",     name: "The Shrine of Broken Iron", description: "A shrine to the Sundered Crown's iron — heaps of broken weapon-rings stacked floor to ceiling. A goblin priest tends a small fire of iron-shavings continuously." } },

  // Sanctum — the king's chamber
  "-120,-63": { terrain: "indoor",     poi: { type: "throne_room", name: "The Goblin King's Throne", description: "An imperial throne-room with imperial bones. The throne itself is older than any king, ringed with iron crowns broken into circles. The Goblin King sits upon it most of the day. He is bigger than a goblin should be. He listens. He does not blink as often as he should." } },
  "-120,-64": { terrain: "indoor",     poi: { type: "vault",      name: "The King's Hoard",      description: "A locked vault behind the throne. The King is the only key. Tribute from every band: a sun-jewel from the south, an iron-shilling chest from Whitemarch caravans, a child's small wooden bird that he keeps separately on a shelf." } },

  // ============================================================
  // DRAKESPIRE — north peak of the Drakeholt, the great wyrm's court
  // (~14 tiles). Threshold (0,-130). The Great Wyrm at (0,-133).
  // ============================================================
  // Tribute approach
  "-1,-128":  { terrain: "mountains",  poi: { type: "landmark",   name: "Tribute Road",          description: "A road of cut switchbacks climbing the lower scree. Banners of the tribute-towns lashed to poles every hundred paces, frayed silk in a dozen colours." } },
  "1,-128":   { terrain: "mountains",  poi: { type: "landmark",   name: "Smoke Cairn",           description: "A stack of fire-cracked stones from which thin smoke rises — pilgrim-offering, kept lit through the cold months by Vyrgun acolytes." } },
  "0,-129":   { terrain: "settlement", poi: { type: "village",    name: "Tribute Town",          description: "A small huddle of stone houses below the peak. Vyrgun servants live here, eating once a day, raising children for the higher work. The drakes pay nothing in coin." } },
  "-1,-129":  { terrain: "indoor",     poi: { type: "hall",       name: "Tribute Receiving-Hall", description: "Where the goods come up the road and are catalogued. Three Vyrgun stewards behind a long stone counter, three couriers with hand-bells dispatching it onward." } },
  "1,-129":   { terrain: "indoor",     poi: { type: "stable",     name: "Mountain-Pony Stable",  description: "Stable for the ridge-ponies that carry tribute up. The ponies stand placid; they live a long time here, and know better than to startle." } },

  // The Spire itself
  "0,-130":   { terrain: "mountains",  poi: { type: "fortress",   name: "Drakespire",            description: "A single black tooth rising out of the upper Drakeholt — the Vyrgun call it Vyrnholt. Smoke from no cookfire bends in the wind around it. There is a fissure in its base, taller than a horse, leading inside." }, vistaRadius: 18 },
  "-1,-130":  { terrain: "mountains",  poi: { type: "landmark",   name: "The Vyrgun Watch",      description: "A platform of cut stone where the Vyrgun warlord-on-watch keeps the day's vigil. A drake-bone horn on a peg. A trough of meat already prepared." } },
  "1,-130":   { terrain: "mountains",  poi: { type: "den",        name: "Drake-Stable",          description: "A wide cave where the lesser drakes are kept and fed when not at the wing. Three pens, two occupied. The air is acrid; the floor smokes faintly." } },

  // Inner
  "0,-131":   { terrain: "indoor",     poi: { type: "hall",       name: "The Inner Hall",        description: "A natural lava-tube widened and finished. Floor swept; walls hung with the scaled skins of drakes who fell out of favour. The air smells like a hot anvil cooling." } },
  "-1,-131":  { terrain: "indoor",     poi: { type: "shrine",     name: "The Egg-Vault",         description: "A round chamber kept warm by something below the floor. Three egg-stands. Two stand empty; the third holds a shell-larger-than-a-shield." } },
  "1,-131":   { terrain: "indoor",     poi: { type: "armoury",    name: "The Vyrgun Hoard",      description: "Armour and weapons of slain dragon-hunters, displayed. Bronze masks of the Burning Order; a Drakespire helm with no skull in it; a black-fire lance with the binding burned out." } },
  "0,-132":   { terrain: "indoor",     poi: { type: "hall",       name: "The Warlord's Court",   description: "A vaulted court where the senior Vyrgun warlord receives. The chair is large but plain. A drake's claw hangs above it; the warlord has not earned the wyrm's chair." } },

  // Sanctum — the great wyrm
  "0,-133":   { terrain: "indoor",     poi: { type: "throne_room", name: "The Wyrm's Court",      description: "A huge chamber of natural stone, blackened with millennia of smoke. At the centre, on a mound of melt-fused gold, the great wyrm of the Drakeholt — older than the empire that named these mountains, older than the empire that named the people who named them. He is rarely awake. He is always aware." } },

  // ============================================================
  // BONE CITADEL — the empty hold of the Witch-Queens (~12 tiles)
  // Threshold (-100,-90). Singing chamber + empty throne at (-100,-93).
  // ============================================================
  "-101,-89": { terrain: "plains",     poi: { type: "landmark",   name: "Rib-Cairn",             description: "A mound of long pale ribs stacked taller than a horse. Some animal, or several; some other thing, perhaps. Wind makes a flute-note in one of them." } },
  "-99,-89":  { terrain: "plains",     poi: { type: "landmark",   name: "Singing Grass",         description: "A patch of grass that hums softly when stepped on — a different note for each footfall. The Witch-Queens chose this hill for a reason. They left for one." } },
  "-100,-89": { terrain: "settlement", poi: { type: "gate",       name: "The Bone Gate",         description: "A gate of arching pale bone — leg-bones, jaw-bones, vertebrae fitted with patient art. The bones are warm to the touch." } },
  "-100,-90": { terrain: "settlement", poi: { type: "fortress",   name: "The Bone Citadel",      description: "A fortress of pale bone risen out of the steppe — the last hold of the Witch-Queens. It is said to be empty. The wind sings inside it on still nights. Birds do not nest in its eaves." } },
  "-101,-90": { terrain: "settlement", poi: { type: "yard",       name: "The Empty Ward",        description: "An inner courtyard with paving-stones still bright as if washed yesterday. No moss. No grass at the joints. Footprints in dust, slowly fading." } },
  "-99,-90":  { terrain: "indoor",     poi: { type: "hall",       name: "The Bone Hall",         description: "A great hall whose walls are inlaid panels of vertebrae. Sourceless light. Long benches for a feast that has not begun. Cutlery laid. Names cut into the place-settings." } },

  // Inner — singing chamber, library
  "-100,-91": { terrain: "indoor",     poi: { type: "hall",       name: "The Tongue Hall",       description: "A long high chamber where the Witch-Queens are said to have held court. The acoustics are deliberate; a whisper at one end is plain at the other. Try not to whisper." } },
  "-101,-91": { terrain: "indoor",     poi: { type: "shrine",     name: "The Library of Lullabies", description: "A circular library of bone scrolls, ivory tablets, parchment. The Witch-Queens' lullabies. Reading one aloud is dangerous; reading one silently is also dangerous, in different ways." } },
  "-99,-91":  { terrain: "indoor",     poi: { type: "shrine",     name: "The Cradle Room",       description: "A room with seven empty cradles arranged in a circle. Each is rocked, faintly, by no hand. The wood is warm." } },
  "-100,-92": { terrain: "indoor",     poi: { type: "hall",       name: "The Singing Chamber",   description: "A domed inner chamber whose floor is patterned in concentric circles of vertebrae. Standing at the centre, you hear yourself singing — though your mouth is closed." } },

  // Sanctum
  "-100,-93": { terrain: "indoor",     poi: { type: "throne_room", name: "The Empty Throne",      description: "A throne of fitted skulls, fronted by a low dais. There is no Witch-Queen in it. The seat is faintly warm. The Queen is not gone; the Queen is between blinks." } },

  // ============================================================
  // LICHGATE — Pale Hand's seat in the Bonemarsh (~10 tiles)
  // Threshold (-130,-100). Inner archway at (-130,-103).
  // ============================================================
  "-131,-99":  { terrain: "marsh",     poi: { type: "landmark",   name: "Bog-Causeway",          description: "A causeway of stones laid into the bog, sinking unevenly. Half the stones are tombstones with their names scrubbed out." } },
  "-129,-99":  { terrain: "marsh",     poi: { type: "landmark",   name: "Pale Hand Banner",      description: "A pale grey banner driven into the bog on a long pole. The flag is unmoving even in wind; the wind doesn't quite reach it." } },
  "-130,-99":  { terrain: "settlement", poi: { type: "gate",       name: "The Outer Arch",        description: "A modest stone arch over the causeway's end. A dead man stands at watch beneath it. He is bored." } },
  "-130,-100": { terrain: "settlement", poi: { type: "fortress",   name: "The Lichgate",          description: "The Pale Hand's hold — a black archway in the middle of a bog that opens upon nothing the eye can quite resolve. The fortress is built around it, low and wet and quiet. The dead that walk the Bonemarsh come from there and return to there." } },
  "-131,-100": { terrain: "indoor",    poi: { type: "hall",       name: "The Cold Hall",         description: "A hall warmed only by the breath of the not-living. The Pale Hand keep no fire here; it would offend the residents. Long tables, place-settings, no plates." } },
  "-129,-100": { terrain: "indoor",    poi: { type: "shrine",     name: "Ossuary",               description: "Stacked skulls floor to ceiling, sorted by age. Some of them still smile at you when they think you are not looking back." } },

  // Inner
  "-130,-101": { terrain: "indoor",    poi: { type: "hall",       name: "The Cold-Room",         description: "A chamber kept ritually cold by means the Pale Hand do not discuss. They lay their fresh dead here for the change." } },
  "-131,-101": { terrain: "indoor",    poi: { type: "shrine",     name: "Master's Cell",         description: "A working room belonging to whichever Hand currently masters the Gate. Books, jars, a half-finished letter to no one — and a chair that is never sat in." } },
  "-130,-102": { terrain: "indoor",    poi: { type: "hall",       name: "The Antechamber",       description: "The room directly before the Gate proper. Air still and faintly cold. A robe-rack with three robes, the colours wrong." } },
  "-130,-103": { terrain: "indoor",    poi: { type: "throne_room", name: "The Inner Archway",     description: "The Gate itself. A black stone arch ten feet tall, opening onto a vista the eye cannot resolve — sometimes a stair, sometimes a corridor, sometimes a place you have been and forgotten. The Pale Hand's Master-of-the-Gate is here, when present. Otherwise it is alone, which is worse." } },

  // ============================================================
  // MOLE-HALLS OF DURNNOCH — dwarven hold under the Pale Steppe (~16 tiles)
  // Threshold (-150,-20). Throne at (-150,-23). Three iron gates, two welded.
  // ============================================================
  "-151,-19": { terrain: "mountains",  poi: { type: "landmark",   name: "First Iron Gate",       description: "An iron gate ten feet tall set into a rock-face. Welded shut from within with seams a finger thick. A small grate at eye height has been carefully kept clean." } },
  "-149,-19": { terrain: "mountains",  poi: { type: "landmark",   name: "Second Iron Gate",      description: "A second iron gate, twin to the first, also welded shut. Beneath the lintel a low slot for slipping in a written message. Outside the slot a stack of unread letters from the surface, weathered to illegibility." } },
  "-150,-19": { terrain: "mountains",  poi: { type: "gate",       name: "Third Iron Gate",       description: "The only opening — a heavy iron gate that opens once a year to the surface, by appointment, for two dwarven hours, for trade. There is currently no appointment." } },
  "-150,-20": { terrain: "indoor",     poi: { type: "fortress",   name: "The Mole-Halls of Durnnoch", description: "An underground city carved by the stone-folk — dwarves. Said to be still inhabited; said to be only wind in great corridors. The truth is some of both." } },
  "-151,-20": { terrain: "indoor",     poi: { type: "hall",       name: "The Surface Hall",      description: "The first hall inside the Third Gate. Wide enough to drive a wagon down. Iron-banded benches along both walls; a stove at one end, banked low. The Surface Steward sits behind a stone desk and asks your business." } },
  "-149,-20": { terrain: "indoor",     poi: { type: "yard",       name: "The Market Run",        description: "A long arcaded chamber where the small year-trade is done. Mostly silent, gaslit. Brass scales, marble counters, smell of stone and oiled iron." } },

  // Mid-levels
  "-150,-21": { terrain: "indoor",     poi: { type: "hall",       name: "Hammer Hall",           description: "A wider hall whose walls are inlaid with hammers — every clan-symbol of every dwarven family ever sworn to Durnnoch. Some of the hammers are crossed through with a single iron line; those clans are no more." } },
  "-151,-21": { terrain: "indoor",     poi: { type: "smithy",     name: "The Deep Forge",        description: "The hold's working forge. Three furnaces, all lit. The air is hot and dry; the smoke goes up a chimney that comes out a hundred miles away through an arrangement nobody outside Durnnoch understands." } },
  "-149,-21": { terrain: "indoor",     poi: { type: "shop",       name: "Library of Strata",     description: "The Mole-Halls' archive — books shelved by depth and age, both. Some of the lowest books require a permit from the Throne to read." } },
  "-150,-22": { terrain: "indoor",     poi: { type: "hall",       name: "The Long Hall",         description: "A hall as long as four wagons head to tail. Stone tables along both walls for the seven hundred dwarves of Durnnoch's household to take their meals at once. Two-thirds of the seats are empty year-round." } },

  // Inner — chamber of stewards, ancestor crypt
  "-151,-22": { terrain: "indoor",     poi: { type: "hall",       name: "Steward Chamber",       description: "The room of the Seven Stewards, who run the Hold while the Throne is unfilled or asleep. Seven stone chairs around a stone table. Currently five chairs are warm." } },
  "-149,-22": { terrain: "indoor",     poi: { type: "shrine",     name: "Ancestor Crypt",        description: "A side-chamber lined with stone biers. Each bears a sleeping dwarf carved from the same block. The carvings are unsettlingly recent in places, though no one has worked here in living memory." } },
  "-150,-23": { terrain: "indoor",     poi: { type: "throne_room", name: "The Throne Under the Mountain", description: "A vault as tall as a tower, lit by a single shaft from the surface above. The Throne is a chair of fitted black stone on a dais of three steps. There has been no Throne-Holder for two hundred years and three. The chair waits." } },

  // ============================================================
  // TELLMAR — the Iron City on the eastern coast (~20 tiles, sprawling port)
  // Threshold (200,0). Council chamber at (200,3). Mostly walkable.
  // ============================================================
  // Sea wall + docks
  "199,-1": { terrain: "settlement", poi: { type: "gate",       name: "Tellmar Sea-Gate",      description: "A pair of iron-banded towers flanking the entry to the harbour. Banners of three trade-houses hang from one tower; banners of three others from the other. The towers do not speak unless forced to." } },
  "201,-1": { terrain: "settlement", poi: { type: "landmark",   name: "Black-Iron Quay",        description: "The famous quay of Tellmar — black-iron pilings sunk into the harbour mud, planks of imported oak. Stevedores in a hundred liveries." } },
  "200,-1": { terrain: "settlement", poi: { type: "yard",       name: "Customs Yard",          description: "A walled yard where every import is weighed and bonded. The bonded warehouses on either side hold a king's ransom in tea, cloth, oil, copper, and a few things best left un-named." } },

  // The city itself
  "200,0":  { terrain: "settlement", poi: { type: "city",       name: "Tellmar",               description: "The Iron City of the eastern coast — a port of black-iron docks and a hundred banners. Every road in the known world leads, eventually, to Tellmar. The streets are wide; the alleys are not." } },
  "199,0":  { terrain: "settlement", poi: { type: "square",     name: "Banner Square",         description: "The famous square where the hundred banners are hung. They are renumbered every solstice as houses rise and fall." } },
  "201,0":  { terrain: "settlement", poi: { type: "square",     name: "Black-Iron Plaza",      description: "A vast paved plaza of imported black iron — Tellmar's symbol and its boast. The plaza is hot in summer and warm in winter, both unnaturally." } },

  // Inner districts
  "200,1":  { terrain: "indoor",     poi: { type: "hall",       name: "The Banner-Hall",       description: "Long hall where the Hundred Banners' clerks file their petitions. Marble desks in long rows. The chatter is constant; the silence between bell-tolls deafening." } },
  "199,1":  { terrain: "indoor",     poi: { type: "shop",       name: "The Glass Quarter",     description: "A neighbourhood of glass-fronted shops — Tellmar's pride. Cloth from the south, iron from the west, books from anywhere. Bargains exist; they are not on display." } },
  "201,1":  { terrain: "indoor",     poi: { type: "shop",       name: "The Spice Lanes",       description: "Narrow lanes between tall-leaning houses where every variety of spice the eastern coast can produce is unpacked, weighed, and re-packed. The smell is famous." } },
  "200,2":  { terrain: "indoor",     poi: { type: "hall",       name: "The Treasury",          description: "Tellmar's treasury — guarded around the clock. Said to hold the original seal-die of the Tellmar tael. Said to hold many other things." } },
  "199,2":  { terrain: "indoor",     poi: { type: "shrine",     name: "Cathedral of Seven Coins", description: "A cathedral to the seven trade-gods of the city. Different banners worship different ones; the cathedral is large enough." } },
  "201,2":  { terrain: "indoor",     poi: { type: "hall",       name: "Tax-House",             description: "Where the customs revenue is reckoned. The Tax-House is taller than any bank and shorter than the Cathedral, by a careful measurement enforced for two centuries." } },
  "198,0":  { terrain: "indoor",     poi: { type: "inn",        name: "The Black Iron Inn",    description: "The most famous inn in Tellmar. The walls are panelled in black iron, and the rooms cost a small kingdom a night." } },
  "202,0":  { terrain: "indoor",     poi: { type: "hall",       name: "The Long Counting House", description: "A bookkeeper's hall a quarter-mile long. Every contract in the city eventually passes through it." } },

  // Sanctum — the Council of Banners
  "200,3":  { terrain: "indoor",     poi: { type: "throne_room", name: "The Hundred Banners' Chamber", description: "The high chamber where the heads of the Hundred Banners sit in council. A circular room with a hundred polished seats and a long table you cannot walk around in less than a quarter-hour. The most powerful chamber on the eastern coast." } },
  "199,3":  { terrain: "indoor",     poi: { type: "vault",      name: "Sealed Archive",        description: "The locked archive of Banner contracts going back four centuries. Three steward-clerks read here without speaking and are not relieved." } },
  "201,3":  { terrain: "indoor",     poi: { type: "shrine",     name: "Coin Chapel",           description: "A small chapel where the new heads of each Banner are sworn in. The walls are lined with the masks each banner-head wore in their first season. Some are recent; some are very, very old." } },

  // ============================================================
  // STAR-FORGE — primordial forge southeast beyond the Spine (~9 tiles)
  // Threshold (140,90). The Anvil at (140,93).
  // ============================================================
  "139,91": { terrain: "mountains",  poi: { type: "landmark",   name: "Pilgrim Camp",          description: "A patch of flat ground a half-day's walk from the Forge where pilgrims rest before the final climb. A long-burned fire-ring, a heap of left-behind shoes." } },
  "141,91": { terrain: "mountains",  poi: { type: "landmark",   name: "Burning Order Cairn",   description: "A cairn raised by the Burning Order in the long-ago — a memorial to those they sent to the Forge and lost. Names cut deep enough to outlast the cairn itself." } },
  "140,90": { terrain: "mountains",  poi: { type: "ruin",       name: "The Star-Forge",        description: "A forge older than the gods, where the first iron was hammered out of fallen stars. Pilgrims walk a year to reach it; some return with a piece of black metal worth more than a kingdom. The threshold is a cooling-yard of slag and meteor-glass." }, vistaRadius: 8 },
  "140,91": { terrain: "settlement", poi: { type: "yard",       name: "Cooling-Yard",          description: "A square paved in cooling-stones — a place where the metal worked at the Forge is left to set into its final form. Strange shapes form here without help." } },
  "139,92": { terrain: "indoor",     poi: { type: "hall",       name: "The Outer Forge",       description: "An antechamber to the Forge itself — bellows the size of houses, racks of clamps and grips no living smith would attempt to lift, a hearth still warm from a fire no one can remember lighting." } },
  "141,92": { terrain: "indoor",     poi: { type: "armoury",    name: "The Star-Metal Vault",  description: "A locked chamber holding what little of the first iron remains, in small chests. The locks are very old. The chests have never been opened." } },
  "140,92": { terrain: "indoor",     poi: { type: "hall",       name: "The Inner Forge",       description: "A central hall in which a single great hearth still burns. The fire never went out. The hearth has never been fed. The hearth's flame is not a colour you know." } },
  "139,93": { terrain: "indoor",     poi: { type: "shrine",     name: "The Smith's Cell",      description: "A small cell that pilgrims pass through before reaching the Anvil. Its sole furniture is a low pallet and a tally-board with one mark each for the pilgrims who have reached the Anvil. There are thirteen marks." } },
  "140,93": { terrain: "indoor",     poi: { type: "throne_room", name: "The Anvil",             description: "A single black anvil in a chamber of natural stone, lit by the impossible fire of the Inner Forge through a slit in the wall. The Anvil has no hammer. The hammer is the one that finds you." } },

  // ============================================================
  // SUNKEN CROWN — drowned empire (~7 tiles, mostly water + ruined spires)
  // Threshold (-100,130). Drowned Court at (-100,133).
  // ============================================================
  "-101,131": { terrain: "water",     poi: { type: "landmark",   name: "Low-Tide Approach",     description: "At low water, a paved street emerges from the surf — black-stained but recognisably an avenue. The paving continues underwater for a long way." } },
  "-99,131":  { terrain: "water",     poi: { type: "ruin",       name: "First Spire",           description: "A blackened tower-stump visible above the water at most tides. Bells inside it ring without rope; the locals avoid this stretch of beach when the wind is in the wrong quarter." } },
  "-100,130": { terrain: "water",     poi: { type: "ruin",       name: "The Sunken Crown",      description: "An empire of the second age, drowned in a single night. Fisherfolk speak of towers visible at low tide, and bells that ring without rope. The threshold to its drowned districts is a paved street descending beneath the swells." } },
  "-101,130": { terrain: "water",     poi: { type: "ruin",       name: "Second Spire",          description: "A second spire — wholly submerged. Light passes through coloured-glass windows still intact and catches the seabed in patches of red and blue." } },
  "-100,131": { terrain: "water",     poi: { type: "ruin",       name: "The Drowned Plaza",     description: "A wide central plaza now under twenty feet of water. Ringed by columns; in the centre, a statue of an emperor no one remembers, his crown still on his head." } },
  "-100,132": { terrain: "water",     poi: { type: "ruin",       name: "The Choir Steps",       description: "A descending colonnade — the approach to the inner court. The bells of the empire are heard most clearly here. The choir is heard most clearly here." } },
  "-100,133": { terrain: "water",     poi: { type: "throne_room", name: "The Drowned Court",     description: "The inner sanctum — a domed hall whose roof has held against the sea by means no living engineer can replicate. Inside, dry. Air stale. The court of the Sunken Crown is in attendance. They have not stopped attending." } },

  // ============================================================
  // HEARTWOOD — primal forest, far west (~10 tiles)
  // Threshold (-180,30). Heart Tree at (-180,33).
  // ============================================================
  "-181,29": { terrain: "forest",    poi: { type: "landmark",   name: "Yew Ring",              description: "A circle of yews older than any nation. The trees do not allow the wood to fall outside their ring; pick up a dropped twig and you may keep it forever." } },
  "-179,29": { terrain: "forest",    poi: { type: "landmark",   name: "First Spring",          description: "A small dark spring with three flat stones laid for kneeling. The water tastes like memory; not your own." } },
  "-180,30": { terrain: "forest",    poi: { type: "ruin",       name: "The Heartwood",         description: "A wood so old its trees walked once, and may again. The Bramble Witches will not enter past its outer ring of yew. It is said the first language is still spoken there, by those who never stopped speaking it." } },
  "-181,30": { terrain: "forest",    poi: { type: "shrine",     name: "Speaking Glade",        description: "A clearing where the trees lean inward to listen. Speak a true thing here; it is heard. Speak a false thing; it is heard. The trees keep score." } },
  "-179,30": { terrain: "forest",    poi: { type: "warren",     name: "The Trees-That-Were-People", description: "A copse of human-shaped birches. Their bark is wrinkled, their roots clustered like clasped hands. Some of them weep, in dry weather, what looks like resin and is not." } },
  "-180,31": { terrain: "forest",    poi: { type: "shrine",     name: "The Listening Grove",   description: "A grove of immense fir trees whose canopy is so dense the floor is dark at noon. The dark is also a presence. It will not harm a polite visitor." } },
  "-181,31": { terrain: "forest",    poi: { type: "hidden", description: null } },
  "-180,32": { terrain: "forest",    poi: { type: "shrine",     name: "The Antlered Stone",    description: "A standing stone in the shape of a man with antlers. A path of small offerings encircles it. The most recent offering is yours, even if you have left none." } },
  "-180,33": { terrain: "forest",    poi: { type: "throne_room", name: "The Heart Tree",        description: "The oldest tree, the heart of the wood. Its trunk is wider than a tower. A door of polished bark, of which no hinge is visible, breathes faintly in and out. Inside, the One Who Speaks the First Language is at home. He has been at home for a long time." } },

  // ============================================================
  // PILLAR OF STORMS — Hollow Coast lighthouse (~5 tiles)
  // ============================================================
  "9,159":   { terrain: "marsh",      poi: { type: "landmark",   name: "Storm-Beach",           description: "A grey beach of round stones the size of skulls. The waves do not break on them; they suck. The Tideless keep this beach clean of bodies in their own way." } },
  "11,159":  { terrain: "marsh",      poi: { type: "landmark",   name: "Wave-Cut Stairs",       description: "A flight of stairs cut into a basalt cliff by water alone — too regular to be honest. They lead up to the Pillar." } },
  "10,160":  { terrain: "settlement", poi: { type: "ruin",       name: "The Pillar of Storms",  description: "A black basalt lighthouse the height of a hill, half-eaten by the sea. Tideless priests tend it; on storm-nights its lantern is said to light by no hand at all. The threshold is a great iron door, ajar." }, vistaRadius: 15 },
  "10,161":  { terrain: "indoor",     poi: { type: "warren",     name: "The Spiral",            description: "A spiral stair winding up the inside of the Pillar. Every twenty steps an iron door to a sea-locker room. The Tideless keep what the storms bring them in these lockers; some of it is alive." } },
  "10,162":  { terrain: "indoor",     poi: { type: "throne_room", name: "The Lantern Room",      description: "The top of the Pillar. A great copper basin holding nothing visible. On storm-nights it burns with a flame of no colour, light that goes outward and outward and never comes home. The Lighthouse-Mother kneels here through the worst of the weather." } },

  // ============================================================
  // CINDER THRONE — high in the Drakeholt beyond Drakespire (~6 tiles)
  // ============================================================
  "59,-159": { terrain: "mountains",  poi: { type: "landmark",   name: "Ash Approach",          description: "A long climbing path through unburned ash that has lain here since before the Burning Order existed. Knee-deep in places." } },
  "61,-159": { terrain: "mountains",  poi: { type: "landmark",   name: "The Memorial Pikes",    description: "A line of iron pikes hammered into rock — each bearing a bronze mask of a Burning Order brother who attempted the Throne and did not return. There are more pikes than the Order has answered for in its records." } },
  "60,-160": { terrain: "mountains",  poi: { type: "ruin",       name: "The Cinder Throne",     description: "A seat of fused obsidian where, the Burning Order say, the first wyrm was unmade. The Order sends its champions there; few are heard from again, and the few who are speak in a voice that is not quite their own. The threshold itself is the place." }, vistaRadius: 10 },
  "60,-161": { terrain: "indoor",     poi: { type: "shrine",     name: "Inner Sanctum",         description: "A chamber of fused obsidian walls. Sourceless red light. The air smells of old fire. The Order's last champion lies here, or her successor; they are not always distinguishable." } },
  "59,-160": { terrain: "indoor",     poi: { type: "vault",      name: "The Burnt Library",     description: "A library of books whose pages are scorched but legible. Every book is the same book. Every reading is different." } },
  "60,-162": { terrain: "indoor",     poi: { type: "throne_room", name: "The Obsidian Seat",     description: "The throne. It is occupied. It has always been occupied. Whoever you came up looking for has not been here for a long time; whoever is here is here." } },

  // ============================================================
  // SILVER LACUNA — elder-folk valley east-southeast (~7 tiles)
  // ============================================================
  "179,59":  { terrain: "forest",     poi: { type: "landmark",   name: "Lacuna Edge",           description: "The lip of the long valley. The grass beyond it is a colour you have never quite seen; it returns to ordinary green if you walk back ten paces." } },
  "181,59":  { terrain: "forest",     poi: { type: "landmark",   name: "Silent Stones",         description: "A line of standing stones marking the boundary. No sound passes them in either direction — including bird-song, including the rain." } },
  "180,60":  { terrain: "forest",     poi: { type: "ruin",       name: "The Silver Lacuna",     description: "A long valley said to belong to the Elder-folk — the Silver Lacuna. Tellmar caravans go around it by a week's detour rather than cross. Those who have crossed it speak softly and only when they cannot avoid the subject." } },
  "179,60":  { terrain: "forest",     poi: { type: "shrine",     name: "The Glass Pool",        description: "A pool whose surface reflects a sky that doesn't match the one above. If you look at it from the wrong angle, you see your back." } },
  "181,60":  { terrain: "forest",     poi: { type: "shrine",     name: "Elder Ring",            description: "A ring of seven white-barked trees that may have been planted, may have grown, may have simply arrived. Standing in their centre is permitted; sitting is not." } },
  "180,61":  { terrain: "forest",     poi: { type: "hall",       name: "The Long Hall",         description: "A roofless hall of moss and pale stone, longer than any single building you have walked. Tables set; no chairs. The Elder-folk are said to stand to eat." } },
  "180,62":  { terrain: "indoor",     poi: { type: "throne_room", name: "The Silver Court",      description: "A round chamber whose walls are mirror-polished pale stone. Standing in it, you appear to be standing in a vast crowd of yourself. The Elder-King receives in this chamber. He does not speak first." } },

  // ============================================================
  // EMPTY LIGHTHOUSE — far west uncharted coast (~5 tiles)
  // ============================================================
  "-221,89":  { terrain: "marsh",     poi: { type: "landmark",   name: "Untaken Beach",         description: "A beach of pale gravel that does not look the same when you turn around. No tracks. The driftwood is bone-white." } },
  "-219,89":  { terrain: "marsh",     poi: { type: "landmark",   name: "Cold Channel",          description: "A salt-channel running parallel to the beach. Half-frozen even in summer. Things float in it that are not the same things twice." } },
  "-220,90":  { terrain: "settlement", poi: { type: "ruin",       name: "The Empty Lighthouse",  description: "A white tower on a shore no living captain can chart twice. It has never not been lit; its keeper has never been found." }, vistaRadius: 20 },
  "-220,91":  { terrain: "indoor",    poi: { type: "warren",     name: "The Empty Spiral",      description: "A spiral stair winding up the inside of the lighthouse. The doors at each landing are unlocked and the rooms beyond them are empty in a specific way — as if their occupants stepped out just before you arrived." } },
  "-220,92":  { terrain: "indoor",    poi: { type: "throne_room", name: "The Always-Lit Lantern", description: "The top of the lighthouse. The lantern burns. There is no one tending it. Standing here, you sometimes hear footsteps below — the keeper, perhaps, on his way up. He never arrives." } },

  // ============================================================
  // GLASSLAKE — Tideless lake south of the Hollow Coast (~4 tiles)
  // ============================================================
  "-51,179":  { terrain: "marsh",     poi: { type: "landmark",   name: "Glasslake Strand",      description: "A wet shore of small green stones — the lake's stones, polished by the lake. Pocket a stone here and it will be in your pocket somewhere else later." } },
  "-50,180":  { terrain: "water",     poi: { type: "lake",       name: "The Glasslake",         description: "A lake the colour of bottle-glass, perfectly still. The Tideless will not name what they say lives under it. Fish drawn from it cook by themselves." } },
  "-49,180":  { terrain: "marsh",     poi: { type: "shrine",     name: "Lakeshore Shrine",      description: "A small Tideless shrine — three flat stones, a smell of brine, a wooden plaque whose inscription is in tidemarks." } },
  "-50,181":  { terrain: "water",     poi: { type: "throne_room", name: "The Glass Floor",       description: "The bottom of the lake, said to be a single sheet of green glass. The Thing Beneath sleeps a thumb's breadth below it. Anyone who has confirmed this has not returned to be asked a second time." } },

  // ============================================================
  // WHITEBONE PLAIN — battle-grave between Brokenhold and the Drakeholt
  // (~5 tiles). No central boss; the plain itself is the encounter.
  // ============================================================
  "-91,-109": { terrain: "plains",    poi: { type: "landmark",   name: "Whitegrass Edge",       description: "The edge of the Plain. The grass goes white in tufts; the soil under it is half marrow." } },
  "-89,-109": { terrain: "plains",    poi: { type: "landmark",   name: "Black Stone",           description: "A single black stone the size of a man, in a sea of white grass. Names cut all over it. They keep being cut. Nobody is here." } },
  "-90,-110": { terrain: "plains",    poi: { type: "ruin",       name: "The Whitebone Plain",   description: "A plain where two armies fell at once in the Long Smoke and no one buried either of them. The grass grows in white tufts there, rooted in old marrow. Pilgrims walk it without speaking." } },
  "-90,-111": { terrain: "plains",    poi: { type: "shrine",     name: "The Pikemen's Field",   description: "A patch of plain where iron pikes still stand, half-rotted. The pikes appear to be exactly the number of pikemen that fell. They have never been miscounted." } },
  "-91,-110": { terrain: "plains",    poi: { type: "shrine",     name: "The Two Cairns",        description: "Two long cairns, set parallel — the only burials on the Plain. Said to hold the two captains who agreed to draw their armies up here. Said to be empty." } },
};
