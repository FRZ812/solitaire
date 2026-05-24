// Pick-and-play character templates for the creation hub. Each is a complete,
// ready-to-run build — attributes, starting abilities (ids + tiers honoured
// against their floors by the engine), and gear (worn vs packed). Choosing one
// builds the character deterministically and dives straight into the world.
//
// Every id here is a real catalog/ability id; keep them valid (the engine drops
// unknown items and clamps abilities below their tier floor).

// The everyday traveller's kit the system prompt says to always pack, so a fresh
// character is provisioned the same way the narrator would provision them.
export const STANDARD_PROVISIONS = [
  { itemId: "trail-rations", quantity: 3 },
  { itemId: "waterskin", quantity: 1 },
  { itemId: "torch", quantity: 2 },
  { itemId: "tinderbox", quantity: 1 },
  { itemId: "bedroll", quantity: 1 },
];

const worn = (itemId, quantity = 1) => ({ itemId, quantity, worn: true });
const packed = (itemId, quantity = 1) => ({ itemId, quantity, worn: false });

export const CHARACTER_TEMPLATES = [
  {
    id: "sellsword",
    label: "Sellsword",
    icon: "shield",
    concept: "A hardened blade-for-hire. Sword, shield, and the sense to keep a contract.",
    highlights: ["Body", "Vigor"],
    setup: {
      name: "Garran",
      profession: "sellsword",
      race: "human", subrace: null, origin: "west",
      age: "early thirties", attractiveness: "weathered",
      bond: "Steel for coin — but a contract kept is the one name worth keeping.",
      attributes: { body: 7, reflex: 5, vigor: 6, mind: 2, wit: 3, presence: 3 },
      appearance: { skin: "tanned", hair: "cropped brown", eyes: "grey", build: "broad and scarred" },
      base_appearance: "A broad-shouldered veteran with a soldier's economy of movement and a nose set crooked from an old break.",
      abilities: [{ id: "power-strike", tier: "uncommon" }, { id: "rend", tier: "uncommon" }, { id: "second-wind", tier: "uncommon" }],
      items: [worn("steel-longsword"), worn("chain-shirt"), worn("iron-helm"), worn("round-shield"), worn("traveling-cloak"), worn("marching-boots"), packed("whetstone")],
      coins: { gold: 3, silver: 5 },
      knows: ["Has soldiered in three border wars and survived all three."],
    },
  },
  {
    id: "hedge-mage",
    label: "Hedge-Mage",
    icon: "flame",
    concept: "A self-taught spellcaster. Fragile in body, dangerous with fire and ward.",
    highlights: ["Mind", "Wit"],
    setup: {
      name: "Ysolde",
      profession: "hedge-mage",
      race: "human", subrace: null, origin: "central",
      age: "late twenties", attractiveness: "sharp-featured",
      bond: "The Art is a hunger; knowledge is the only true coin.",
      attributes: { body: 2, reflex: 3, vigor: 3, mind: 8, wit: 5, presence: 4 },
      appearance: { skin: "pale", hair: "dark and unbound", eyes: "amber", build: "slight" },
      base_appearance: "A slight figure in a travel-worn robe, ink-stained fingers and eyes that read a room like a page.",
      abilities: [{ id: "firebolt", tier: "common" }, { id: "arcane-bolt", tier: "common" }, { id: "mana-shield", tier: "uncommon" }, { id: "heal", tier: "uncommon" }],
      items: [worn("oak-staff"), worn("black-robe"), worn("scholars-circlet"), worn("traveling-cloak"), packed("lamp-oil")],
      coins: { gold: 2, silver: 8 },
      knows: ["Can read three dead languages but cannot ride a horse."],
    },
  },
  {
    id: "ranger",
    label: "Ranger",
    icon: "woodenBird",
    concept: "A wood-elf scout. Bow, woodcraft, and a hunter's patience.",
    highlights: ["Reflex", "Wit"],
    setup: {
      name: "Faelen",
      profession: "ranger",
      race: "elf", subrace: "wood", origin: "elf",
      age: "ageless, looks thirty", attractiveness: "keen and fair",
      bond: "The wild keeps its own; I walk its edges and miss nothing.",
      attributes: { body: 4, reflex: 7, vigor: 4, mind: 3, wit: 6, presence: 3 },
      appearance: { skin: "olive", hair: "chestnut, braided", eyes: "green", build: "lean and quick" },
      base_appearance: "A lean wood-elf moving with forest-silence, a longbow worn like a part of the body.",
      abilities: [{ id: "aimed-shot", tier: "uncommon" }, { id: "twin-shot", tier: "common" }, { id: "hamstring-shot", tier: "uncommon" }],
      items: [worn("hunting-bow"), worn("rangers-leathers"), worn("traveling-cloak"), worn("marching-boots"), packed("iron-dagger"), packed("rope-hemp")],
      coins: { gold: 1, silver: 12 },
      knows: ["Can track a day-old trail across bare stone."],
    },
  },
  {
    id: "cutthroat",
    label: "Cutthroat",
    icon: "moon",
    concept: "A back-alley rogue. Fast blades, faster feet, and a knack for locks.",
    highlights: ["Reflex", "Wit"],
    setup: {
      name: "Sable",
      profession: "thief",
      race: "human", subrace: null, origin: "east",
      age: "mid twenties", attractiveness: "darkly handsome",
      bond: "Quick fingers, quicker feet — owe nothing, trust less.",
      attributes: { body: 3, reflex: 8, vigor: 3, mind: 4, wit: 6, presence: 3 },
      appearance: { skin: "brown", hair: "black, close-cut", eyes: "dark", build: "wiry" },
      base_appearance: "A wiry figure who keeps to the edges of a room, hands never quite still, eyes always on the exits.",
      abilities: [{ id: "rapid-jabs", tier: "common" }, { id: "feint", tier: "uncommon" }, { id: "shadowstep", tier: "uncommon" }],
      items: [worn("steel-dagger"), worn("leather-jerkin"), worn("traveling-cloak"), packed("iron-dagger"), packed("lockpicks"), packed("grappling-hook")],
      coins: { gold: 2, silver: 10 },
      knows: ["Owes money to someone dangerous in a city left behind."],
    },
  },
  {
    id: "devout",
    label: "Devout",
    icon: "sun",
    concept: "A wandering priest. Mace and faith — mends wounds and smites the unholy.",
    highlights: ["Presence", "Mind"],
    setup: {
      name: "Mara",
      profession: "priest",
      race: "human", subrace: null, origin: "south",
      age: "late thirties", attractiveness: "kind-faced",
      bond: "A light to carry into dark places, and mercy where I can spare it.",
      attributes: { body: 4, reflex: 3, vigor: 5, mind: 6, wit: 5, presence: 6 },
      appearance: { skin: "deep brown", hair: "greying, covered", eyes: "warm brown", build: "sturdy" },
      base_appearance: "A sturdy, road-worn cleric with calloused hands and a steadiness that quiets a frightened room.",
      abilities: [{ id: "heal", tier: "uncommon" }, { id: "bless", tier: "uncommon" }, { id: "shield-of-faith", tier: "uncommon" }, { id: "smite", tier: "rare" }],
      items: [worn("iron-mace"), worn("scale-mail"), worn("round-shield"), worn("silver-amulet"), packed("healers-kit")],
      coins: { gold: 2, silver: 6 },
      knows: ["Left an order over a disagreement she will not discuss."],
    },
  },
  {
    id: "reaver",
    label: "Reaver",
    icon: "swords",
    concept: "A half-orc berserker. A greataxe and a temper, hard to put down.",
    highlights: ["Body", "Vigor"],
    setup: {
      name: "Hruk",
      profession: "reaver",
      race: "half-orc", subrace: null, origin: "half-orc",
      age: "late twenties", attractiveness: "fearsome",
      bond: "Rage is honest. I hit what needs hitting and keep walking.",
      attributes: { body: 8, reflex: 4, vigor: 7, mind: 1, wit: 3, presence: 2 },
      appearance: { skin: "ashen green", hair: "black topknot", eyes: "yellow", build: "huge and corded" },
      base_appearance: "A mountain of a half-orc, tusks chipped, knuckles scarred, a greataxe slung like it weighs nothing.",
      abilities: [{ id: "power-strike", tier: "uncommon" }, { id: "cleave", tier: "rare" }, { id: "second-wind", tier: "uncommon" }],
      items: [worn("steel-greataxe"), worn("studded-leather"), worn("fur-cloak"), worn("marching-boots")],
      coins: { gold: 1, silver: 4 },
      knows: ["Was raised among humans who never let him forget what he was."],
    },
  },
];
