// The people already on the road, and what they want from a stranger.
//
// Spawn tables answer "who is out here" and resolve two ways: a hostile is
// fought, anything else is mentioned. Road events answer a different question --
// what happened on this journey -- and every one of them carries an `offer`,
// which is something the party can answer rather than something they read.
//
// Placement is logic, not a random table. `where` is decided by facts the tile
// already carries: a ferryman needs a road that meets water, a hiring fair needs
// a town within a few hexes, a customs party needs a border. Nothing here is
// placed on ground that would not have produced it.
//
// Only `stops: true` ends a march. That is three entries out of forty-four, and
// each one is something the road is physically closed by.

// What the party is being asked. The whole point of the module: a brief that
// says "a tinker, trade" gives the player a decision; one that says "a tinker"
// gives them scenery.
export const ROAD_OFFERS = Object.freeze({
  trade: "goods or coin change hands",
  aid: "someone needs a hand, and asks",
  toll: "passage is being charged for",
  news: "word from further along the road",
  join: "an invitation to fall in with them",
  "stand-aside": "the road belongs to them for a moment",
  search: "the party and their packs are being looked over",
});

const event = (id, where, offer, label, detail, extra = {}) => Object.freeze({
  id, where, offer, label, detail, stops: false, ...extra,
});

// On a route, out between the settlements and away from any border.
const ROAD = [
  event("roadwork-gang", "road", "stand-aside", "a roadwork gang",
    "A gang has the surface up for thirty paces, sorting broken stone into grades and packing it back down, and they work around whoever comes past."),
  event("broken-axle", "road", "aid", "a carter with a broken axle",
    "A loaded cart sits canted into the verge with its axle snapped clean, and the carter is going through the hedge for something straight enough to splint it."),
  event("drover-herd", "road", "stand-aside", "a drover's herd",
    "Cattle fill the road from bank to bank coming the other way, unhurried, and the drovers walk at the flanks whistling the dogs up and down the line."),
  event("post-rider", "road", "news", "a post rider",
    "A rider comes up fast with a sealed satchel across their back, slows enough to see who is on the road, and will trade what they have heard for what you have."),
  event("tinker-cart", "road", "trade", "a tinker's cart",
    "A cart hung about with mended pans and re-hafted tools stands at the verge, its owner sat on the shaft with a soldering iron in the ashes of a small fire."),
  event("pilgrim-file", "road", "join", "a file of pilgrims",
    "Twenty-odd walkers are going your way at a pace they can hold all day, sharing water down the line, glad of company and safer for numbers."),
  event("verge-camp", "road", "news", "a camp at the verge",
    "A family has pulled off the road for the night with their fire already going and a pot on, and they call across to ask what the way behind you is like."),
  event("salt-carts", "road", "trade", "a salt convoy",
    "Four covered carts move together with hired swords walking beside them, and the factor riding at the head is willing to open a tailgate for a paying stranger."),
  event("wake-procession", "road", "stand-aside", "a wake going by",
    "A coffin is being carried on shoulders between villages with the whole household walking behind it, and the road gives way to them for as long as it takes."),
];

// A route that meets water: bridge, ford, causeway, ferry.
const CROSSING = [
  event("ferryman", "crossing", "trade", "a ferryman on the far bank",
    "The ferry is drawn up on the opposite side with its keeper mending a sweep, and a bell hangs on a post at your end for calling him over. The fare is posted."),
  event("bridge-toll", "crossing", "toll", "a chain across the bridge",
    "A chain is drawn across the bridge mouth beside a hut with a shuttered window. The family here has kept these arches standing for four generations and charges by the head to cross.",
    { stops: true }),
  event("ford-in-spate", "crossing", "news", "a ford running high",
    "The ford is a hand deeper than its depth-stakes like, and three carts are drawn up on the bank waiting for it to drop. The waiting have opinions about how long that takes."),
  event("fishing-weir", "crossing", "trade", "a weir being worked",
    "A weir is staked across the current below the crossing, and the family clearing its traps have more fish than they can carry home."),
  event("bridge-repair", "crossing", "stand-aside", "masons on the piers",
    "Masons are working a hanging stage against the middle pier, repointing joints under the arch, and the near lane is stacked with dressed stone and rope."),
  event("washed-bank", "crossing", "aid", "a bank come away",
    "Water has taken a bite out of the approach and a handline is rigged across the gap on driven stakes. Whoever rigged it is still there, trying to get a laden mule over."),
  event("crossing-vigil", "crossing", "news", "a lantern kept at the crossing",
    "A lantern burns on a bracket at the bridge head, and the one who keeps it lit sits out of the wind with a tally of everyone who has crossed since dark."),
  event("barge-string", "crossing", "stand-aside", "barges coming through",
    "A string of barges is being poled through the arch below, and the crossing holds while the last of them clears — bank ropes, shouted counts, and no hurrying it."),
];

// Within a few hexes of an inhabited landmark: the country a town works.
const SETTLED = [
  event("hiring-fair", "settled", "join", "a hiring fair on the verge",
    "Working people stand along the roadside with the tool of their trade held where it can be seen, and the farms send someone down the line to look them over."),
  event("refugees", "settled", "aid", "people walking the other way",
    "A slow column comes past carrying what they could fasten to their backs, moving with the particular patience of people who have been walking for days."),
  event("boundary-dispute", "settled", "aid", "a boundary being argued",
    "Two households stand either side of a ditch with the hedge-line between them, and both would like a passing stranger to look at where the old stone sits."),
  event("market-carts", "settled", "trade", "carts going in to market",
    "Carts are on the road before light with the year's surplus roped down under sacking, and anything that will not fetch a price in town is cheap out here."),
  event("wedding-party", "settled", "join", "a wedding walking between villages",
    "The whole party is on the road in its best clothes with a fiddle going and the bride's people carrying the chest, and they will not hear of anyone passing dry."),
  event("tithe-wagon", "settled", "news", "a tithe wagon",
    "A wagon stands at a field gate while a clerk counts sacks onto it against a ledger, and the clerk knows exactly how the season has gone for thirty miles around."),
  event("strayed-flock", "settled", "aid", "a shepherd counting short",
    "A shepherd works the hedge line calling, a dozen head down on this morning's count, and asks whether anything woolly has been seen along the road behind."),
  event("baking-day", "settled", "trade", "the oven going at the verge",
    "The village oven stands at the road end and today is baking day, so the whole household is out around it and there is bread coming off faster than it can cool."),
  event("militia-drill", "settled", "join", "militia at drill",
    "The village's own are drilling in a stubble field with billhooks and two real spears, worked through their forms by somebody who has clearly done this for a living."),
];

// The road at a change of country: where one authority hands over to another.
const BORDER = [
  event("levy-company", "border", "stand-aside", "a levy company on the march",
    "A company of raised levies fills the road coming out, four abreast with their carts behind them, and the road is theirs until the last of it has gone past.",
    { stops: true }),
  event("customs-party", "border", "search", "a customs party on the verge",
    "A trestle is set up at the roadside with a ledger open on it, and two of the watch are going through a cart's load item by item while their officer writes."),
  event("boundary-stone", "border", "news", "a warden at the boundary stone",
    "A warden is re-cutting the arms on the boundary stone with a mallet and chisel, and is pleased to explain to anyone passing exactly whose ground begins here."),
  event("walked-to-the-line", "border", "aid", "people walked to the line",
    "A handful of people stand on the far side of the marker with a guard watching them from this one, holding bundles, told to go on and not come back."),
  event("banner-change", "border", "news", "the road changes hands",
    "The waymark posts ahead carry different colours from the ones behind, and a work party is going down the line painting the new arms over the old."),
  event("border-toll", "border", "toll", "a toll post newly raised",
    "A toll post stands where no toll post stood last season, its timber still pale, and the keeper reads the rate off a board he plainly had no part in setting."),
  event("herald", "border", "news", "a herald reading out",
    "A herald in a tabard reads a proclamation aloud at the boundary to whoever happens to be there, then rolls it, moves a hundred paces on, and reads it again."),
  event("escort-handover", "border", "join", "an escort handing over",
    "A caravan sits at the line while the escort that brought it this far settles with the escort that takes it on, and the new one is a rider short."),
];

// Country with no road, no border and no town within reach.
const WILD = [
  event("warm-camp", "wild", "search", "a camp still warm",
    "A ring of stones holds a fire banked with turf and still giving heat, a bed of cut bracken beside it, and no one within sight in any direction."),
  event("lone-rider", "wild", "news", "a rider keeping their distance",
    "A single rider is holding a parallel course a long bowshot off, matching your pace exactly, close enough to be counting and far enough to be gone if answered."),
  event("charcoal-burners", "wild", "trade", "burners at their stack",
    "A turfed dome smoulders in a cleared ring with two people living beside it in a lean-to for the duration of the burn, days from anyone, and short of everything."),
  event("hunt-horns", "wild", "stand-aside", "a hunt working the country",
    "Horns are being sounded across the ground ahead and answered from further off, and the line of it will cross your way before you are through."),
  event("hermit-cell", "wild", "aid", "a hermit's cell",
    "A stone cell stands under an overhang with a covered crock of water set out on the step for whoever passes, and its keeper is old and short of firewood."),
  event("trapline", "wild", "trade", "a trapper running a line",
    "A trapper works down a line of sets with the morning's catch over one shoulder, and would rather carry salt and thread home than the whole of it."),
  event("shieling-child", "wild", "aid", "a child a long way from home",
    "A child is sat on a rock a great deal further from the summer grazing than a child should be, entirely calm about it, waiting for someone who has not come."),
  event("surveyors", "wild", "news", "surveyors with chain and staff",
    "Two people are running a measuring chain across open ground and setting a striped staff at intervals, working for somebody with plans for country like this."),
  event("cairn-builders", "wild", "join", "a cairn being added to",
    "A small group is carrying stones up to a cairn on the rise, one each, for somebody who died out here, and they will hand a stone to anybody who comes past."),
  event("roped-wagon", "wild", "search", "a wagon left roped",
    "A wagon stands on the open ground with its load still roped down and the shafts empty, the team gone and the ground around it printed all over with hooves."),
];

export const ROAD_EVENTS = Object.freeze([...ROAD, ...CROSSING, ...SETTLED, ...BORDER, ...WILD]);

const BY_WHERE = new Map();
for (const entry of ROAD_EVENTS) {
  if (!BY_WHERE.has(entry.where)) BY_WHERE.set(entry.where, []);
  BY_WHERE.get(entry.where).push(entry);
}
for (const list of BY_WHERE.values()) Object.freeze(list);

export function roadEventsWhere(where) {
  return BY_WHERE.get(where) || [];
}
