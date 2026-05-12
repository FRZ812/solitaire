// Terrain-based spawn tables for random encounters. Each entry has a kind,
// weight (relative), posture (hostile|neutral|friendly), and a short flavor.
// chance = probability of ANY encounter when entering this terrain.
export const SPAWN_TABLES = {
  marsh: {
    chance: 0.05,
    entries: [
      { kind: "bog-hounds",      weight: 22, posture: "hostile",  desc: "a pack of mud-caked hounds, gaunt with hunger" },
      { kind: "lone-bandit",     weight: 14, posture: "hostile",  desc: "a desperate cutthroat crouched among the reeds" },
      { kind: "swamp-fey",       weight: 10, posture: "neutral",  desc: "a hunched mossy figure half-submerged, watching" },
      { kind: "will-o-wisp",     weight: 10, posture: "neutral",  desc: "a single pale floating light drifting between the reeds" },
      { kind: "marsh-fisher",    weight: 18, posture: "friendly", desc: "a fisher with a reed creel, unbothered by the wet" },
      { kind: "lost-pilgrim",    weight: 12, posture: "friendly", desc: "a lost pilgrim, soaked and shivering" },
      { kind: "drowned-corpse",  weight: 8,  posture: "neutral",  desc: "a bloated corpse half-emerged from the muck, still clothed" },
      { kind: "leech-cloud",     weight: 6,  posture: "hostile",  desc: "a dense cloud of fat leeches dropping from a sagging bough" },
    ],
  },
  forest: {
    chance: 0.05,
    entries: [
      { kind: "wolves",          weight: 22, posture: "hostile",  desc: "a pack of wolves, gaunt and hungry" },
      { kind: "bandits",         weight: 18, posture: "hostile",  desc: "two bandits with rust-spotted blades" },
      { kind: "goblins",         weight: 12, posture: "hostile",  desc: "three goblins, chittering as they spot you" },
      { kind: "bear",            weight: 7,  posture: "hostile",  desc: "a large brown bear rooting at a fallen log" },
      { kind: "deer",            weight: 14, posture: "neutral",  desc: "a doe and her fawn, frozen mid-graze" },
      { kind: "hunter",          weight: 13, posture: "friendly", desc: "a lone hunter checking his snares" },
      { kind: "lost-traveler",   weight: 10, posture: "friendly", desc: "a lost traveler clutching a torn map" },
      { kind: "charcoaler",      weight: 4,  posture: "friendly", desc: "a soot-stained charcoaler tending a smoldering mound" },
    ],
  },
  hills: {
    chance: 0.04,
    entries: [
      { kind: "brigands",        weight: 22, posture: "hostile",  desc: "hill brigands lurking behind the crest" },
      { kind: "goblins",         weight: 14, posture: "hostile",  desc: "a goblin scouting party" },
      { kind: "hill-folk",       weight: 20, posture: "neutral",  desc: "stoic hill folk on their way somewhere" },
      { kind: "shepherd",        weight: 18, posture: "friendly", desc: "a shepherd with a small flock" },
      { kind: "wandering-cleric",weight: 10, posture: "friendly", desc: "a wandering cleric, robe muddied" },
      { kind: "wild-goats",      weight: 10, posture: "neutral",  desc: "a herd of wild goats on the slope" },
      { kind: "hawk",            weight: 6,  posture: "neutral",  desc: "a circling hawk far overhead, screaming" },
    ],
  },
  mountains: {
    chance: 0.06,
    entries: [
      { kind: "wargs",           weight: 22, posture: "hostile",  desc: "two wargs scenting the rocks" },
      { kind: "mountain-bandits",weight: 18, posture: "hostile",  desc: "mountain bandits at a chokepoint" },
      { kind: "rockfall",        weight: 12, posture: "hostile",  desc: "a sudden rockfall ahead — stones skipping down the slope" },
      { kind: "lone-hunter",     weight: 14, posture: "friendly", desc: "a lone hunter dragging a fresh kill" },
      { kind: "hermit",          weight: 12, posture: "neutral",  desc: "a wild-eyed hermit sheltering in an alcove" },
      { kind: "ibex",            weight: 12, posture: "neutral",  desc: "a herd of ibex on a high ledge, motionless" },
      { kind: "ravens",          weight: 10, posture: "neutral",  desc: "a wheel of ravens, three or four of them, circling" },
    ],
  },
  plains: {
    chance: 0.03,
    entries: [
      { kind: "wild-dogs",       weight: 18, posture: "hostile",  desc: "wild dogs hunting in the tall grass" },
      { kind: "boar",            weight: 10, posture: "hostile",  desc: "a wild boar rooting in a hollow" },
      { kind: "refugees",        weight: 22, posture: "friendly", desc: "a family of refugees with what they could carry" },
      { kind: "wandering-merchant",weight: 18, posture: "friendly", desc: "a peddler with a tired mule" },
      { kind: "outrider",        weight: 14, posture: "neutral",  desc: "a roaming outrider on patrol" },
      { kind: "messenger",       weight: 10, posture: "friendly", desc: "a lone rider on urgent business" },
      { kind: "lark",            weight: 8,  posture: "neutral",  desc: "a lark startled from the grass, climbing in song" },
    ],
  },
  road: {
    chance: 0.03,
    entries: [
      { kind: "merchant",        weight: 22, posture: "friendly", desc: "a peddler with a tired mule and a wagon of small goods" },
      { kind: "travelers",       weight: 22, posture: "friendly", desc: "a small group of travelers heading the other way" },
      { kind: "highway-brigands",weight: 14, posture: "hostile",  desc: "highway brigands with bows ready" },
      { kind: "patrol",          weight: 14, posture: "neutral",  desc: "a small patrol of armed riders" },
      { kind: "messenger",       weight: 10, posture: "neutral",  desc: "a lone rider in haste" },
      { kind: "pilgrim",         weight: 10, posture: "friendly", desc: "a pilgrim walking with a staff" },
      { kind: "fallen-cart",     weight: 8,  posture: "neutral",  desc: "an overturned cart by the verge, abandoned" },
    ],
  },
  settlement: {
    chance: 0.02,
    entries: [
      { kind: "beggar",          weight: 28, posture: "friendly", desc: "a beggar with a cracked bowl, eyes hopeful" },
      { kind: "drunkard",        weight: 20, posture: "neutral",  desc: "a drunkard lurching against a wall" },
      { kind: "townsfolk",       weight: 18, posture: "friendly", desc: "townsfolk going about their day" },
      { kind: "pickpocket",      weight: 14, posture: "hostile",  desc: "a hand reaches for your purse — quick, practiced" },
      { kind: "cutthroats",      weight: 8,  posture: "hostile",  desc: "two cutthroats peeling out of a back alley with intent" },
      { kind: "guard",           weight: 8,  posture: "neutral",  desc: "a guard giving you a hard look" },
      { kind: "messenger",       weight: 4,  posture: "neutral",  desc: "a sweating messenger pushing through the crowd" },
    ],
  },
  indoor: { chance: 0, entries: [] },
  water:  { chance: 0, entries: [] },
};
