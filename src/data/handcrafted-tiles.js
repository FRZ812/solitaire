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
export const HANDCRAFTED = {
  // --- The Drowned Inn cluster (centred on (0,0)) ---
  "0,0":  { terrain: "indoor",     poi: { type: "inn",      name: "The Drowned Inn",  description: "The common room. Smoke-darkened beams, a peat fire, a long oak bar." } },
  "-1,0": { terrain: "settlement", poi: { type: "yard",     name: "Inn Yard",         description: "The packed-earth yard. A well, a hitching post." } },
  "0,-1": { terrain: "indoor",     poi: { type: "stable",   name: "Inn Stable",       description: "A low stable smelling of hay and old leather." } },
  "0,1":  { terrain: "settlement", poi: { type: "landmark", name: "Ferry Landing",    description: "A small wooden quay where the ferry meets the river." } },
  "-1,2": { terrain: "water",      poi: null },
  "1,-1": { terrain: "forest",     poi: null },

  // --- West road through the Mire ---
  "-2,0": { terrain: "road",       poi: null },
  "-3,0": { terrain: "road",       poi: { type: "landmark", name: "The Crossroads",   description: "Three tracks meet under a leaning stone." } },
  "-2,-1":{ terrain: "forest",     poi: null },
  "-3,1": { terrain: "marsh",      poi: { type: "hidden", description: null } },
  "-4,0": { terrain: "road",       poi: null },
  "-5,0": { terrain: "road",       poi: { type: "shrine", name: "Way-shrine of the Three", description: "A wooden three-faced shrine where the road first dips into the Mire. The carvings are sun-bleached and lichened." } },

  // --- East road across the Mire (Inn → Reedmarsh → Mire's edge) ---
  "1,0":  { terrain: "road",       poi: null },
  "1,1":  { terrain: "marsh",      poi: { type: "hidden", description: null } },
  "2,-1": { terrain: "forest",     poi: null },
  "2,0":  { terrain: "road",       poi: null },
  "3,0":  { terrain: "settlement", poi: { type: "camp", name: "Reedmarsh", description: "Old Hareth's wagon-camp, a patch of dry ground in the reeds." } },
  "3,1":  { terrain: "marsh",      poi: null },
  "4,-1": { terrain: "marsh",      poi: { type: "hidden", description: null } },
  "4,0":  { terrain: "road",       poi: null },
  "5,0":  { terrain: "road",       poi: null },
  "5,1":  { terrain: "marsh",      poi: null },

  // --- The long road across Crowsmoor Reach (5km of open country) ---
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

  // --- Crowsmoor town cluster (relocated to x=24-28) ---
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

  // --- Tannic Wood (north of the Mire) ---
  "0,-3":  { terrain: "forest",    poi: { type: "camp",     name: "Charcoal Camp",      description: "A blackened ring where a charcoal-burner lived through the autumn. Cooling now." } },
  "-3,-3": { terrain: "forest",    poi: { type: "landmark", name: "The Stag-Throne",    description: "An ancient oak shaped by some old pruning into a chair. Antlers are nailed across its back." } },
  "3,-3":  { terrain: "forest",    poi: { type: "shrine",   name: "Wood-Shrine",        description: "A clearing held by ash-trees. Offerings of bread and copper rest at the base of the eldest." } },
  "-5,-3": { terrain: "marsh",     poi: { type: "landmark", name: "Black Slough",       description: "A finger of marsh reaching north into the Wood. Bird-skulls hang from one of the alders." } },
  "-2,-4": { terrain: "hills",     poi: { type: "landmark", name: "Yew Knoll",          description: "A bare knoll crowned with three old yews. Cattle have refused to graze here in living memory." }, vistaRadius: 6 },
  "4,-4":  { terrain: "forest",    poi: { type: "hidden", description: null } },

  // --- Bramblewych Reach (south of the Mire) ---
  "0,3":   { terrain: "forest",    poi: { type: "landmark", name: "The Hedge-Maze",     description: "An overgrown maze of hawthorn higher than a man. The original purpose is no longer remembered." } },
  "-2,3":  { terrain: "plains",    poi: { type: "landmark", name: "The Bramble Cairn",  description: "A waist-high cairn buried in briar. Coins of a forgotten mint litter its base." } },
  "-4,4":  { terrain: "marsh",     poi: { type: "landmark", name: "The Drowned Field",  description: "A square of low ground that was once tilled. The furrows still hold under the water." } },
  "2,3":   { terrain: "forest",    poi: { type: "hidden", description: null } },
  "7,3":   { terrain: "hills",     poi: { type: "landmark", name: "The Watchpost",      description: "A stone tower, two stories, half-fallen. Someone keeps a fire in it some nights. From the top the country opens up for miles." }, vistaRadius: 12 },
  "9,3":   { terrain: "hills",     poi: { type: "hidden", description: null } },

  // --- Whitemarch (city, faction: Whitemarch Iron) ---
  // The walled iron-city. The central plaza is type "city" so it labels on the
  // map. Buildings around it are "hall" / "cathedral" / "palace" / "mint" etc.
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

  // --- Bramblewych (village, faction: Bramble Witches) ---
  "-25,20": { terrain: "settlement", poi: { type: "village",   name: "Bramblewych",           description: "A village of moss-roofed cottages and hedge-mazes. The earth here knows the names of the dead." } },
  "-24,20": { terrain: "indoor",     poi: { type: "inn",       name: "The Hanging Garlic",    description: "A low-ceilinged inn where most patrons are pilgrims. Garlic-strings, dried marigolds, the smell of warm bread and goose-fat." } },
  "-24,19": { terrain: "indoor",     poi: { type: "hall",      name: "The Bramble House",     description: "A long-house of woven hawthorn, where the witches hold council." } },
  "-25,19": { terrain: "indoor",     poi: { type: "shrine",    name: "The Witch's Shrine",    description: "A single-room shrine to no named god — the bramble-witches refuse to name their patrons." } },
  "-26,20": { terrain: "settlement", poi: { type: "garden",    name: "The Herb Garden",       description: "A communal garden of physic-plants. Every villager has a row." } },
  "-26,21": { terrain: "indoor",     poi: { type: "smithy",    name: "The Iron-Bender",       description: "A small smithy serving the village. Iron-work for charms, plow-shares, and nails." } },
  "-25,21": { terrain: "settlement", poi: { type: "square",    name: "Bramblewych Common",    description: "A muddy common where village business is done. A single well and a hanging-tree, currently unused." } },
  "-23,20": { terrain: "road",       poi: null },
  "-27,20": { terrain: "road",       poi: null },

  // --- Beltsworn (village, faction: Whitemarch Iron; frontier on the road) ---
  "25,-15": { terrain: "settlement", poi: { type: "village",   name: "Beltsworn",             description: "A frontier village halfway between Crowsmoor and Whitemarch. Paid in iron coin to keep the road open." } },
  "26,-15": { terrain: "indoor",     poi: { type: "inn",       name: "The Strap-and-Bell",    description: "A coaching-inn where the road-wardens stable their horses. Loud at suppertime; quiet by midnight." } },
  "24,-15": { terrain: "settlement", poi: { type: "gate",      name: "Beltsworn Gate",        description: "A wooden gate-house, repaired so often it's mostly recent timber." } },
  "25,-14": { terrain: "indoor",     poi: { type: "smithy",    name: "The Wagon-Smith",       description: "The village smith does mostly wagon-iron — felloes, axle-pins, draw-pins." } },
  "25,-16": { terrain: "indoor",     poi: { type: "hall",      name: "Warden's Hall",         description: "The road-wardens' barracks. Six bunks; usually four are occupied." } },
  "23,-15": { terrain: "road",       poi: null },
  "27,-15": { terrain: "road",       poi: null },
};
