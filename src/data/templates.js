// Pick-and-play character templates for the creation hub. Each is a complete,
// ready-to-run build — a clear party ROLE, a distinct stat spread, starting
// abilities (ids + tiers honoured against their floors by the engine), gear
// (worn vs packed), and a short backstory a player can step into and role-play,
// or ignore and build their own from the limbo.
//
// Names, appearance, and origin follow the world's CULTURES (system-prompt):
// north (Norse-cold), east (ancient empires, silk & bound black hair), south
// (warm coasts, deep brown skin, head-wraps), west (weathered frontier), central
// (the mixed Vale) — and the non-human kindreds carry their own look and name.
//
// Roles map loosely to the familiar party composition (tank / bruiser / ranged
// dps / assassin / mage / healer) so a group can see what they're missing.
//
// Every id here is a real catalog/ability id; keep them valid (the engine drops
// unknown items and clamps abilities below their tier floor).

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
    role: "Tank",
    icon: "shield",
    concept: "Sword, shield, and the sense to hold a line.",
    story: "Bram has sold his blade under three frontier feud-lords and buried friends beneath all three banners. He fights from the front and takes his pay up front — a shield-wall of one, steadiest when the line breaks. He's looking for a last contract worth more than coin.",
    highlights: ["Vigor", "Body"],
    setup: {
      name: "Bram Coltaine",
      profession: "sellsword",
      race: "human", subrace: null, origin: "west",
      age: "early thirties", attractiveness: "weathered",
      bond: "Steel for coin — but a contract kept is the one name worth keeping.",
      attributes: { body: 6, reflex: 4, vigor: 7, mind: 2, wit: 3, presence: 3 },
      appearance: { skin: "weathered tan", hair: "dark brown", eyes: "brown", build: "broad and scarred", facial_hair: "short unkempt beard" },
      base_appearance: "A broad-shouldered frontier veteran, olive-tanned and wind-cured, with a soldier's economy of movement and a nose set crooked from an old break.",
      abilities: [{ id: "power-strike", tier: "uncommon" }, { id: "bulwark-stance", tier: "uncommon" }, { id: "second-wind", tier: "uncommon" }],
      items: [worn("steel-longsword"), worn("chain-shirt"), worn("iron-helm"), worn("kite-shield"), worn("traveling-cloak"), worn("marching-boots"), packed("whetstone")],
      coins: { gold: 3, silver: 5 },
      knows: ["Has soldiered in three border wars and survived all three."],
    },
  },
  {
    id: "reaver",
    label: "Reaver",
    role: "Bruiser",
    icon: "swords",
    concept: "A greataxe, a temper, and very little patience.",
    story: "Raised among humans who never let him forget what he was, Karzog answered their fear with the fury they expected — then walked out and never looked back. The rage is honest, at least; it hides nothing and asks nothing. He is hunting a purpose big enough to swing an axe at.",
    highlights: ["Body", "Vigor"],
    setup: {
      name: "Karzog Bloodtusk",
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
  {
    id: "ranger",
    label: "Ranger",
    role: "Ranged DPS",
    icon: "woodenBird",
    concept: "A bow, a quiet step, and a hunter's patience.",
    story: "Faelar has walked the green marches alone since the village that raised him burned. He speaks little and misses nothing, putting an arrow through trouble before it knows he is there. He follows rumours of the ones who lit that fire — eastward, always eastward.",
    highlights: ["Reflex", "Wit"],
    setup: {
      name: "Faelar Thornwood",
      profession: "ranger",
      race: "elf", subrace: "wood", origin: "elf",
      age: "ageless, looks thirty", attractiveness: "keen and fair",
      bond: "The wild keeps its own; I walk its edges and miss nothing.",
      attributes: { body: 4, reflex: 7, vigor: 4, mind: 3, wit: 6, presence: 3 },
      appearance: { skin: "olive", hair: "chestnut, braided", eyes: "green", build: "lean and quick" },
      base_appearance: "A lean wood-elf moving with forest-silence, eyes the green of deep shade, a longbow worn like a part of the body.",
      abilities: [{ id: "aimed-shot", tier: "uncommon" }, { id: "twin-shot", tier: "common" }, { id: "hamstring-shot", tier: "uncommon" }],
      items: [worn("hunting-bow"), worn("rangers-leathers"), worn("traveling-cloak"), worn("marching-boots"), packed("iron-dagger"), packed("rope-hemp")],
      coins: { gold: 1, silver: 12 },
      knows: ["Can track a day-old trail across bare stone."],
    },
  },
  {
    id: "cutthroat",
    label: "Cutthroat",
    role: "Assassin",
    icon: "moon",
    concept: "Fast blades and a killing blow from the dark.",
    story: "Renjiro learned the trade in the silk-and-shadow courts of the eastern empires, where a quick blade and quicker feet kept him breathing. He owes a debt to a house that does not forgive, and the only coin that pays it is the kind of work no one admits to hiring. Trust is a luxury he sold long ago.",
    highlights: ["Reflex", "Body"],
    setup: {
      name: "Kazan Renjiro",
      profession: "assassin",
      race: "human", subrace: null, origin: "east",
      age: "mid twenties", attractiveness: "coldly handsome",
      bond: "Quick fingers, quicker feet — owe nothing, trust less.",
      attributes: { body: 5, reflex: 8, vigor: 3, mind: 3, wit: 4, presence: 3 },
      appearance: { skin: "ivory", hair: "black, long and bound", eyes: "dark", build: "lean and fine-featured", facial_hair: "thin trimmed moustache" },
      base_appearance: "A lean easterner with ivory skin and black hair bound back from fine features, moving with the stillness of someone used to killing quietly.",
      abilities: [{ id: "rapid-jabs", tier: "common" }, { id: "feint", tier: "uncommon" }, { id: "shadowstep", tier: "uncommon" }],
      items: [worn("steel-dagger"), worn("leather-jerkin"), worn("traveling-cloak"), packed("iron-dagger"), packed("lockpicks"), packed("grappling-hook")],
      coins: { gold: 2, silver: 10 },
      knows: ["Owes a blood-debt to a noble house in the eastern empires."],
    },
  },
  {
    id: "hedge-mage",
    label: "Hedge-Mage",
    role: "Mage",
    icon: "flame",
    concept: "Self-taught fire and ward — fragile, but deadly.",
    story: "Turned away from the Glass Spire for asking the wrong questions, Ysolde taught herself the Art from stolen folios and singed fingers. She hoards knowledge the way misers hoard gold and treats every locked door as a personal insult. Somewhere out there is the book that got her expelled — and she means to read it.",
    highlights: ["Mind", "Wit"],
    setup: {
      name: "Ysolde Varen",
      profession: "hedge-mage",
      race: "human", subrace: null, origin: "central",
      age: "late twenties", attractiveness: "sharp-featured",
      bond: "The Art is a hunger; knowledge is the only true coin.",
      attributes: { body: 2, reflex: 3, vigor: 3, mind: 8, wit: 5, presence: 4 },
      appearance: { skin: "fair", hair: "brown, unbound", eyes: "hazel", build: "slight" },
      base_appearance: "A slight figure of the mixed Vale in a travel-worn robe, ink-stained fingers and eyes that read a room like a page.",
      abilities: [{ id: "firebolt", tier: "common" }, { id: "arcane-bolt", tier: "common" }, { id: "mana-shield", tier: "uncommon" }, { id: "frost-lance", tier: "uncommon" }],
      items: [worn("oak-staff"), worn("black-robe"), worn("scholars-circlet"), worn("traveling-cloak"), packed("lamp-oil")],
      coins: { gold: 2, silver: 8 },
      knows: ["Can read three dead languages but cannot ride a horse."],
    },
  },
  {
    id: "devout",
    label: "Devout",
    role: "Healer",
    icon: "sun",
    concept: "Mace and faith — mends the party, smites the unholy.",
    story: "Amara left her order over a mercy they called heresy, and now carries her faith on the road instead of behind an altar. Her mace is for the things that prey on the helpless; her hands are for everyone else. She is certain her god still listens — most days.",
    highlights: ["Presence", "Mind"],
    setup: {
      name: "Amara Zafari",
      profession: "priest",
      race: "human", subrace: null, origin: "south",
      age: "late thirties", attractiveness: "kind-faced",
      bond: "A light to carry into dark places, and mercy where I can spare it.",
      attributes: { body: 4, reflex: 3, vigor: 5, mind: 6, wit: 4, presence: 7 },
      appearance: { skin: "deep brown", hair: "black, cropped under a head-wrap", eyes: "dark brown", build: "sturdy" },
      base_appearance: "A sturdy southerner, deep-brown and sun-warmed, a bright head-wrap over cropped hair and a steadiness that quiets a frightened room.",
      abilities: [{ id: "heal", tier: "uncommon" }, { id: "bless", tier: "uncommon" }, { id: "shield-of-faith", tier: "uncommon" }, { id: "smite", tier: "rare" }],
      items: [worn("iron-mace"), worn("scale-mail"), worn("round-shield"), worn("silver-amulet"), packed("healers-kit")],
      coins: { gold: 2, silver: 6 },
      knows: ["Left an order over a disagreement she will not discuss."],
    },
  },
];
