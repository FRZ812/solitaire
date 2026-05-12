// Factions of the central regions — political/cultural groupings tied to
// biomes (via biome.faction). Used by WorldMapView to color regions and label
// who holds what. The narrator can also reference factions through the state
// context; that wiring is light for now.
export const FACTIONS = [
  {
    id: "crowsmoor-wardens",
    name: "Crowsmoor Wardens",
    short: "Wardens",
    color: "#8B5A2B",
    description: "Militia and burgesses of Crowsmoor. Keep the eastern road open and the Mire's people fed. Brown leather, crow crests.",
  },
  {
    id: "whitemarch-iron",
    name: "Whitemarch Iron",
    short: "Iron",
    color: "#5A5550",
    description: "The iron-trading city-state of Whitemarch. Tax-farmers and a small standing army; the roads they pave, they own.",
  },
  {
    id: "wood-cult",
    name: "The Wood-Cult",
    short: "Cult",
    color: "#3D4A28",
    description: "Acolytes of the old wood, semi-druidic, scattered. They tend the Tannic Wood and resent felling.",
  },
  {
    id: "spine-confederation",
    name: "Spine Confederation",
    short: "Spine",
    color: "#7A2C18",
    description: "A loose confederation of mountain tribes in the Spine Foothills. Hostile to lowland encroachment; they trade only with those they choose.",
  },
  {
    id: "bramble-witches",
    name: "The Bramble Witches",
    short: "Witches",
    color: "#553D6B",
    description: "Hedge-witches and half-pagans of Bramblewych Reach. The Bramble Witches know the old paths and the older debts.",
  },
  {
    id: "free-folk",
    name: "The Free Folk",
    short: "Free",
    color: "#8B857A",
    description: "Whatever wanderers, exiles, and outliers populate the Far Wild. No banner; no oath.",
  },
];

export function getFaction(id) {
  return FACTIONS.find((f) => f.id === id) || null;
}
