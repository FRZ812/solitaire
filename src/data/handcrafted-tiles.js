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
  // ============================================================
  "-7,-9":  { terrain: "forest",   poi: { type: "landmark", name: "Hollow Mouth",       description: "A bramble-throat where the ground gives way into a stream-cut hollow. Goblin-sign — bone-charms tied to the lower branches, a kicked-over fire-ring." } },
  "-8,-10": { terrain: "forest",   poi: { type: "den",      name: "Goblin Hollow",      description: "The mouth of the den proper — a clay-and-root passage angling down into hill. Inside: the smell of woodsmoke and worse. Children's stories say a king-of-three rules here. Locals call it the Hollow." } },
  "-9,-10": { terrain: "hills",    poi: { type: "landmark", name: "The Whistling Stones", description: "Three boulders fluted by wind into a sound between a whistle and a moan. Goblin scouts use them as a ward — if they go silent, somebody crossed below." }, vistaRadius: 4 },
  "-8,-11": { terrain: "forest",   poi: { type: "landmark", name: "Bone-Trees",         description: "Five young pines hung with strings of small bones. Crows roost here in numbers and do not scatter when you pass." } },
  "-7,-10": { terrain: "forest",   poi: { type: "hidden", description: null } },
  "-9,-9":  { terrain: "forest",   poi: { type: "hidden", description: null } },

  // ============================================================
  // CHARWOOD BURN (the long forest fire scar)
  // ============================================================
  "-3,-18": { terrain: "plains",   poi: { type: "ruin",     name: "Charwood Burn",      description: "A long blackened scar through the Tannic Wood. The trees on its edge are bone-white; the centre is grown over only in coarse fireweed. The Wood-Cult does not enter." } },
  "-2,-18": { terrain: "plains",   poi: { type: "hidden", description: null } },
  "-4,-17": { terrain: "forest",   poi: null },
  "-3,-19": { terrain: "plains",   poi: { type: "landmark", name: "The Burnt Shrine",   description: "What used to be a Wood-Shrine, now a ring of fire-cracked stone. The Cult has not rebuilt it; they say it was offered to the burn." } },

  // ============================================================
  // BROKENGLASS TOWER (NW glass blade)
  // ============================================================
  "-15,-20": { terrain: "hills",   poi: { type: "ruin",     name: "Brokenglass Tower",  description: "A blade of green glass thrusting from a low ridge, the height of three men. The fluting in it is too regular for nature. At dusk it casts a coloured stripe across the slope below." }, vistaRadius: 8 },
  "-14,-20": { terrain: "hills",   poi: { type: "hidden", description: null } },
  "-15,-21": { terrain: "forest",  poi: { type: "landmark", name: "The Stranger's Camp", description: "A fire-ring with the ashes still warm. Three different boot-prints, none of them matching local lasts." } },

  // ============================================================
  // WITCH-HAG'S COT (NW Bonemarsh edge)
  // ============================================================
  "-12,-28": { terrain: "marsh",   poi: { type: "ruin",     name: "The Witch-Hag's Cot", description: "A single tilted brick chimney rising out of marsh-grass. Snares and clay charms hang in the reeds around it. The locals do not say her name aloud." } },
  "-11,-28": { terrain: "marsh",   poi: { type: "hidden", description: null } },
  "-13,-27": { terrain: "marsh",   poi: { type: "landmark", name: "Knot Field",         description: "A patch of reeds tied in elaborate, regular knots. Walking among them feels wrong — your fingers go cold." } },

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
  // CINDER CHAPTER (Burning Order chapter-house)
  // ============================================================
  "30,-30": { terrain: "settlement", poi: { type: "fortress", name: "The Cinder Chapter", description: "A low chapter-house of fire-blackened stone — the Burning Order's only seat in this Vale. Bronze masks hung in the hall; the central fire has not been allowed to go out in eight generations." } },
  "31,-30": { terrain: "indoor",     poi: { type: "hall",     name: "The Mask-Hall",    description: "A long hall lined with bronze masks on iron pegs. One peg per oath-bound brother since the founding. Three pegs are bare and oiled — vacancies." } },
  "29,-30": { terrain: "indoor",     poi: { type: "smithy",   name: "Chapter Forge",    description: "Where the bronze masks are struck and the lances for the dragon-walks are forged. A blade-tongs hangs on the wall older than the chapter itself." } },
  "30,-31": { terrain: "indoor",     poi: { type: "shrine",   name: "The Hearth",       description: "The chapter's perpetual fire, eight generations unbroken. A young postulant tends it; relieved every hour day or night." } },
  "30,-29": { terrain: "road",       poi: null },

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
  // CAER DRUM (SE hillfort ruin)
  // ============================================================
  "15,15": { terrain: "hills",     poi: { type: "ruin",     name: "Caer Drum",          description: "A low hillfort of dressed grey stone, the outer wall mostly intact, the inner buildings rubble. Spine herders winter sheep inside. The keep-stones are blackened in patches — somebody fought a fire here once." }, vistaRadius: 8 },
  "14,15": { terrain: "hills",     poi: { type: "landmark", name: "The Cattle Stones",  description: "Five stones set deep, joined by a low wall — a herder's holding-pen, half-fallen. Used in the off-season." } },
  "16,15": { terrain: "hills",     poi: { type: "hidden", description: null } },
  "15,14": { terrain: "hills",     poi: null },
  "15,16": { terrain: "forest",    poi: null },

  // ============================================================
  // MOSSBRIDGE HOLD (SE small fortress)
  // ============================================================
  "20,12": { terrain: "settlement", poi: { type: "fortress", name: "Mossbridge Hold",   description: "A stone tower-house with an attached stable, holding the crossing of a small beck. Manned in summer by a Spine-tribe sept; locked and shuttered in winter." } },
  "19,12": { terrain: "hills",     poi: null },
  "21,12": { terrain: "hills",     poi: null },
  "20,11": { terrain: "road",      poi: null },
  "20,13": { terrain: "indoor",    poi: { type: "stable",   name: "Mossbridge Stable",  description: "Cramped, fragrant, and warm — six stalls and a hayloft. The sept's only luxury." } },

  // ============================================================
  // OGRE STAIR (SE den)
  // ============================================================
  "30,28": { terrain: "mountains", poi: { type: "den",      name: "The Ogre Stair",     description: "A switchback of carved stone steps cut into a cliff-face, each step too tall for a man. The mouth at the top is dark, smells of old grease, and the wind blowing out of it is warm." }, vistaRadius: 10 },
  "29,28": { terrain: "mountains", poi: { type: "landmark", name: "The Warning Cairn",  description: "A cairn rebuilt every spring by Spine scouts: do not go further. Three skulls — bear, deer, the third recognisably human — set on its crown." } },
  "30,27": { terrain: "mountains", poi: { type: "hidden", description: null } },

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
  "4,7":   { terrain: "forest",    poi: { type: "den",      name: "The Wolf-Pit",       description: "A natural pit deepened by use, lined with old kills. A grey-pelted pack winters here. Local shepherds bring a tithe of mutton in lambing season; the pack returns the favour by harrying smaller predators." } },
  "3,7":   { terrain: "forest",    poi: { type: "landmark", name: "The Bone-Strewn Track", description: "A game-trail strewn with old bones — sheep, deer, the occasional bigger thing. Walking it you feel watched, but the wolves seldom show themselves by day." } },

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
};
