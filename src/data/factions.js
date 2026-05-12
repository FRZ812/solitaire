// Factions of the central regions — political/cultural groupings tied to
// biomes (via biome.faction). Used by WorldMapView to color regions and label
// who holds what. The narrator can also reference factions through the state
// context; that wiring is light for now.
//
// Factions are grouped roughly by reach:
//   • Vale powers — present in or directly bordering the starting region.
//   • Distant powers — rumour-real, surfaced through the [GEOGRAPHY KNOWN BY
//     REPUTATION] context; the player has not seen them but they shape trade,
//     fear, and politics.
//   • Legendary powers — only spoken of in hearth-stories, tied to fabled
//     landmarks; surfaced through [GEOGRAPHY KNOWN BY LEGEND].
export const FACTIONS = [
  // ---------- Vale powers ----------
  {
    id: "crowsmoor-wardens",
    name: "Crowsmoor Wardens",
    short: "Wardens",
    color: "#8B5A2B",
    description: "Militia and burgesses of Crowsmoor. Keep the eastern road open and the Mire's people fed. Brown leather, crow crests. Reasonable in summer, hungry in spring.",
  },
  {
    id: "whitemarch-iron",
    name: "Whitemarch Iron",
    short: "Iron",
    color: "#5A5550",
    description: "The iron-trading city-state of Whitemarch. Tax-farmers and a small standing army; the roads they pave, they own. The iron-shilling is good as far as the smell of forges reaches.",
  },
  {
    id: "wood-cult",
    name: "The Wood-Cult",
    short: "Cult",
    color: "#3D4A28",
    description: "Acolytes of the old wood, semi-druidic, scattered. They tend the Tannic Wood and resent felling. They do not preach; they prune. A felled tree without their consent is paid for in kind.",
  },
  {
    id: "spine-confederation",
    name: "Spine Confederation",
    short: "Spine",
    color: "#7A2C18",
    description: "A loose confederation of mountain tribes in the Spine Foothills. Hostile to lowland encroachment; they trade only with those they choose. Each clan keeps its own banner; the Confederation flies none.",
  },
  {
    id: "bramble-witches",
    name: "The Bramble Witches",
    short: "Witches",
    color: "#553D6B",
    description: "Hedge-witches and half-pagans of Bramblewych Reach. The Bramble Witches know the old paths and the older debts. They do not call themselves witches; that is what others call them, and they suffer it.",
  },
  {
    id: "free-folk",
    name: "The Free Folk",
    short: "Free",
    color: "#8B857A",
    description: "Whatever wanderers, exiles, and outliers populate the Far Wild. No banner; no oath. Some are honest, some are not, and most are merely tired.",
  },

  // ---------- Distant powers (within rumored reach) ----------
  {
    id: "reeve-levy",
    name: "The Reeve's Levy",
    short: "Levy",
    color: "#3A5340",
    description: "A volunteer levy raised from the freeholds north of the Mire to police the Tannic crossings and run down brigand bands the Wardens won't chase. Grey-and-green sashes; a council of reeves, no lord.",
  },
  {
    id: "sundered-crown",
    name: "The Sundered Crown",
    short: "Sundered",
    color: "#4F2F2F",
    description: "The orc and goblin warbands that gather under the Goblin King at Brokenhold in the wastes. Iron crowns broken into rings; warleaders quarrel constantly, then ride together when the King calls.",
  },
  {
    id: "pale-hand",
    name: "The Pale Hand",
    short: "Pale Hand",
    color: "#6E6A7C",
    description: "A scattered necromancer-fellowship squatting in the bone-marshes north of Black Tarn. They keep to themselves and the things they raise. Most folk do not know them by name — only as the reason the dead north of the Tarn don't stay buried.",
  },
  {
    id: "burning-order",
    name: "The Burning Order",
    short: "Burning",
    color: "#B8541F",
    description: "A militant chapter-house of dragon-hunters sworn since the Long Smoke. Bronze masks, fire-blackened cloaks. They walk the trade roads recruiting; their chapter-keep lies somewhere northeast in the foothills under the Drakeholt.",
  },
  {
    id: "tideless",
    name: "The Tideless",
    short: "Tideless",
    color: "#3B6B70",
    description: "Saltwater-witches and shore-priests of the Hollow Coast, far south. The Tideless do not bury their dead — they weigh them and walk them out. Most lowlanders treat them as rumour.",
  },
  {
    id: "free-companies",
    name: "The Free Companies",
    short: "Companies",
    color: "#7A6035",
    description: "A loose brotherhood of mercenary captains plying the trade-roads between Crowsmoor, Whitemarch, and the south. Companies hire by contract, switch sides by season, and remember every grudge. The Bronze Glove and the Long Spurs are the names most often spoken.",
  },
  {
    id: "iron-plateau-marches",
    name: "Marches of the Iron Plateau",
    short: "Plateau",
    color: "#876A4A",
    description: "Petty-baronies and marcher-lords beyond Whitemarch, raising horsemen on the high tableland. Nominally vassals to the Iron Palace; in practice they pay tribute in remounts and otherwise do as they please.",
  },

  // ---------- Legendary powers (fabled, far-flung) ----------
  {
    id: "demon-king",
    name: "Court of the Demon King",
    short: "Demon",
    color: "#1F1820",
    description: "The court of the polestar fortress — Northstar Castle. Devils, oath-bound dead, and the rare living lord who has sold something to be there. Few who walk toward it return.",
  },
  {
    id: "vyrgun-drakekin",
    name: "The Vyrgun",
    short: "Vyrgun",
    color: "#4B2A4E",
    description: "The drake-blooded warlords of the northern peaks of Vyrnholt — the Drakeholt. They claim descent from the old wyrms and keep tribute-towns at the foot of the mountains. Few have seen them; the smoke of their fires is sometimes visible at sunset from the Spine.",
  },
  {
    id: "starforge-pilgrims",
    name: "The Star-Forge Pilgrims",
    short: "Pilgrims",
    color: "#A87E32",
    description: "Those who walk a year east to the Star-Forge in hope of a piece of the first iron. The pilgrim-road is its own loose society — wandering smiths, ascetics, exiled lords, gamblers with one last stake.",
  },
  {
    id: "witch-queens",
    name: "The Witch-Queens of the Bone Citadel",
    short: "Witch-Q.",
    color: "#9A9088",
    description: "Said to have ruled the western steppes from a fortress of pale bone; said now to be gone. Those who claim otherwise are kept indoors by their families until they recover.",
  },
  {
    id: "tellmar-banners",
    name: "The Hundred Banners of Tellmar",
    short: "Tellmar",
    color: "#3A4F7A",
    description: "The merchant-houses, guildhalls, and sea-captains of the Iron City on the eastern coast. Tellmar gold travels further than any sword; Tellmar grudges last a century.",
  },
  {
    id: "drowned-choir",
    name: "The Drowned Choir",
    short: "Choir",
    color: "#2D4E6E",
    description: "What the Sunken Crown became. They are not said to be hostile, only to sing — and to call up, sometimes, those who answer them. Coastal hamlets know not to drift too close at the slack tide.",
  },
];

export function getFaction(id) {
  return FACTIONS.find((f) => f.id === id) || null;
}
