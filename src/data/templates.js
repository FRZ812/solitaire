// Pick-and-play characters for the creation hub. Each is a complete ready-to-run
// build with a distinct voice, unresolved complication, visual signature, role,
// stat spread, starting abilities, and canonical gear. Arrival narration is
// generated from these authored hooks so the people remain specific in play.
//
// Every ready-made character owns an authored starting level. Internal power
// bands may still help encounter balance, but they never determine the level or
// appear as a character-facing label in the campaign roster.
//
// Names/appearance/origin follow the world's CULTURES (system-prompt). Every id
// here is a real catalog/ability id; the engine drops unknown items and clamps
// abilities below their tier floor.

import { abilityCategoryOf, getAbilityDef } from "./abilities.js";
import { xpForRating } from "./proficiencies.js";
import { TEMPLATE_RACIAL_BRANCH_CHOICES } from "./template-racial-branches.js";
import {
  compileCharacterProgression, progressionXpForLevel,
} from "./progression-paths.js";

export const STANDARD_PROVISIONS = [
  { itemId: "trail-rations", quantity: 3 },
  { itemId: "waterskin", quantity: 1 },
  { itemId: "torch", quantity: 2 },
  { itemId: "tinderbox", quantity: 1 },
  { itemId: "bedroll", quantity: 1 },
];

// Deliberately uneven individual levels. No campaign character is snapped to a
// shared tier anchor; the number follows their own history and demonstrated
// mastery. These totals are later divided between a 0–30 racial ledger and a
// shared 0–70 profession ledger by the progression compiler.
export const AUTHORED_TEMPLATE_LEVELS = Object.freeze({
  sellsword: 8,
  devout: 11,
  reaver: 13,
  ranger: 15,
  "court-envoy": 17,
  cutthroat: 19,
  "confidence-artist": 20,
  "hedge-mage": 23,
  "knight-errant": 26,
  "war-priest": 29,
  duelist: 32,
  "beast-warden": 35,
  "guild-advocate": 38,
  "velvet-courtier": 40,
  "war-captain": 43,
  "battle-archmage": 49,
  shadowblade: 54,
  "champion-paladin": 59,
  "dragon-hunter": 62,
  "high-sorcerer": 65,
  warlord: 68,
  "fae-touched": 70,
  "archmage-ascendant": 75,
  "undying-champion": 81,
  "demon-warlock": 85,
  "dragon-ascendant": 92,
  "enchanter-tyrant": 99,
});

// The portrait/template id remains the exact specialization; the outward
// profession is a broad calling shared by many specializations.
export const TEMPLATE_PROFESSION_IDS = Object.freeze({
  sellsword: "fighter",
  reaver: "barbarian",
  ranger: "ranger",
  cutthroat: "rogue",
  devout: "cleric",
  "court-envoy": "diplomat",
  "confidence-artist": "courtier",
  "hedge-mage": "wizard",
  "knight-errant": "paladin",
  "war-priest": "cleric",
  duelist: "fighter",
  "beast-warden": "ranger",
  "guild-advocate": "diplomat",
  "velvet-courtier": "courtier",
  "war-captain": "commander",
  "battle-archmage": "wizard",
  shadowblade: "rogue",
  "champion-paladin": "paladin",
  "dragon-hunter": "ranger",
  "high-sorcerer": "sorcerer",
  warlord: "commander",
  "fae-touched": "warlock",
  "archmage-ascendant": "wizard",
  "undying-champion": "fighter",
  "demon-warlock": "warlock",
  "dragon-ascendant": "sorcerer",
  "enchanter-tyrant": "wizard",
});

// The two ledgers are authored independently as well. Kindred whose identity is
// strongly supernatural invest more heavily in metamorphosis, while most human
// lives remain profession-led. The remainder of each character's exact total is
// distributed across the profession plan below; no hidden tier preset is used.
export const TEMPLATE_RACIAL_LEVELS = Object.freeze({
  sellsword: 1,
  devout: 2,
  reaver: 5,
  ranger: 5,
  "court-envoy": 2,
  cutthroat: 2,
  "confidence-artist": 6,
  "hedge-mage": 3,
  "knight-errant": 4,
  "war-priest": 4,
  duelist: 5,
  "beast-warden": 5,
  "guild-advocate": 6,
  "velvet-courtier": 6,
  "war-captain": 7,
  "battle-archmage": 8,
  shadowblade: 9,
  "champion-paladin": 10,
  "dragon-hunter": 11,
  "high-sorcerer": 12,
  warlord: 18,
  "fae-touched": 21,
  "archmage-ascendant": 14,
  "undying-champion": 18,
  "demon-warlock": 26,
  "dragon-ascendant": 30,
  "enchanter-tyrant": 29,
});

const multiclassPlan = (primaryId, primaryLevels, secondaryId, secondaryLevels, secondarySpecialization) => Object.freeze([
  Object.freeze({ professionId: primaryId, levels: primaryLevels }),
  Object.freeze({ professionId: secondaryId, specializationId: secondarySpecialization, levels: secondaryLevels }),
]);

// Only identities whose fiction genuinely spans two disciplines multiclass.
// Everyone else may still invest all earned profession ranks into one calling.
export const TEMPLATE_MULTICLASS_PLANS = Object.freeze({
  "war-priest": multiclassPlan("cleric", 17, "fighter", 8, "iron-vanguard"),
  "guild-advocate": multiclassPlan("diplomat", 23, "scholar", 9, "jurist"),
  "war-captain": multiclassPlan("commander", 24, "fighter", 12, "iron-vanguard"),
  "battle-archmage": multiclassPlan("wizard", 29, "fighter", 12, "sellsword"),
  shadowblade: multiclassPlan("rogue", 30, "wizard", 15, "shadow-mage"),
  "champion-paladin": multiclassPlan("paladin", 35, "fighter", 14, "iron-vanguard"),
  "dragon-hunter": multiclassPlan("ranger", 37, "fighter", 14, "iron-vanguard"),
  warlord: multiclassPlan("commander", 36, "fighter", 14, "iron-vanguard"),
  "dragon-ascendant": multiclassPlan("sorcerer", 48, "fighter", 14, "iron-vanguard"),
  "enchanter-tyrant": multiclassPlan("wizard", 52, "ruler", 18, "sovereign-will"),
});

export const TEMPLATE_SORCERER_CHOICES = Object.freeze({
  "high-sorcerer": Object.freeze({
    signatureSpellId: "tempest",
    signatureExchanges: Object.freeze({ 25: "meteor", 45: "tempest" }),
    metamagicIds: Object.freeze(["empowered-signature", "shaped-signature", "quickened-signature", "piercing-signature", "perfected-signature"]),
    grantSelections: Object.freeze({
      "sorcerer-secondary-spell": Object.freeze(["fireball"]),
      "sorcerer-tertiary-spell": Object.freeze(["chain-lightning"]),
      "sorcerer-final-repertoire-spell": Object.freeze(["lightning-bolt"]),
      "sorcerer:weave-spell-i": Object.freeze(["frost-lance"]),
      "sorcerer:weave-spell-ii": Object.freeze(["combust"]),
      "sorcerer:weave-spell-iii": Object.freeze(["firebolt"]),
    }),
    metamagicProfiles: Object.freeze({
      "woven-spell-i": Object.freeze(["quickened-signature"]),
      "woven-spell-ii": Object.freeze(["shaped-signature"]),
      "woven-spell-iii": Object.freeze(["transmuted-signature"]),
    }),
  }),
  "dragon-ascendant": Object.freeze({
    signatureSpellId: "fireball",
    signatureExchanges: Object.freeze({ 25: "fireball", 45: "fireball" }),
    metamagicIds: Object.freeze(["empowered-signature", "shaped-signature", "quickened-signature", "transmuted-signature", null, null, "subtle-signature", "triggered-signature"]),
    grantSelections: Object.freeze({
      "sorcerer-secondary-spell": Object.freeze(["combust"]),
      "sorcerer-tertiary-spell": Object.freeze(["lightning-bolt"]),
      "sorcerer-final-repertoire-spell": Object.freeze(["chain-lightning"]),
    }),
  }),
});

// Ready-made identities that have already crossed a branch threshold retain
// the choices implied by their authored title. Characters created manually
// leave these empty and receive the threshold prompt in play.
export const TEMPLATE_BRANCH_CHOICES = Object.freeze({
  "war-priest": Object.freeze({ "sacred-domain": "war" }),
  duelist: Object.freeze({ "warrior-specialization": "duelist" }),
  "war-captain": Object.freeze({ "warrior-specialization": "iron-vanguard" }),
  "hedge-mage": Object.freeze({ "wizard-school": "universalist" }),
  "battle-archmage": Object.freeze({ "wizard-school": "evocation", "warrior-specialization": "sellsword" }),
  shadowblade: Object.freeze({ "wizard-school": "illusion" }),
  "champion-paladin": Object.freeze({ "warrior-specialization": "iron-vanguard" }),
  "dragon-hunter": Object.freeze({ "warrior-specialization": "iron-vanguard" }),
  warlord: Object.freeze({ "warrior-specialization": "iron-vanguard" }),
  "archmage-ascendant": Object.freeze({
    "wizard-school": "universalist",
    "universalist-discipline": "polymath",
    "polymath-mastery": "living-spellbook",
  }),
  "enchanter-tyrant": Object.freeze({
    "wizard-school": "enchantment",
    "enchantment-discipline": "dominator",
    "dominator-mastery": "puppet-master",
  }),
  "high-sorcerer": Object.freeze({
    "sorcerous-focus": "specialized-spellweaver",
    "spellweaver-discipline": "constellation-weaver",
    "constellation-weaver-apotheosis": "grand-constellation",
  }),
  "dragon-ascendant": Object.freeze({
    "sorcerous-focus": "singular-savant",
    "singular-savant-discipline": "overwhelming-signature",
    "warrior-specialization": "iron-vanguard",
  }),
  "undying-champion": Object.freeze({
    "warrior-specialization": "undying-champion",
    "undying-champion-method": "last-stand-exemplar",
    "last-stand-apotheosis": "deathless-victor",
  }),
});

export const TEMPLATE_WIZARD_GRANT_SELECTIONS = Object.freeze({
  "archmage-ascendant": Object.freeze({
    "wizard:polymath-spell": "blizzard",
    "wizard:living-spellbook-formulae": Object.freeze(["chain-lightning", "tempest"]),
  }),
});

const worn = (itemId, quantity = 1) => ({ itemId, quantity, worn: true });
const packed = (itemId, quantity = 1) => ({ itemId, quantity, worn: false });

const CHARACTER_HOOKS = Object.freeze({
  sellsword: {
    voice: "Clipped frontier plain-speech, dryly funny when the danger is worst; never promises what he cannot deliver.",
    complication: "One of the three lords whose banner he survived has offered enough coin to make him betray the only contract he still respects.",
    signature: "Counts exits, chairs, and armed hands before he ever sits down.",
  },
  reaver: {
    voice: "Blunt, literal, and unexpectedly observant; contemptuous of euphemism and fond of very bad deadpan jokes.",
    complication: "Every easy act of violence proves his childhood tormentors right, and he is terrified rage may be the only self they left him.",
    signature: "Carves tiny patient animals from scrap wood with the edge of his axe.",
  },
  ranger: {
    voice: "Sparse and sensory; speaks in distances, weather, spoor, and the exact sound a lie makes in the throat.",
    complication: "The trail from his burned village points toward another wood-elf, and he has not decided whether truth matters more than kin.",
    signature: "Keeps a pouch of fire-blackened seeds and plants one wherever he sleeps safely.",
  },
  cutthroat: {
    voice: "Impeccably courteous understatement, even with a blade drawn; anger makes him quieter rather than louder.",
    complication: "The blood-debt he works to repay was inherited through an innocent younger sister who still believes him dead.",
    signature: "Folds every written order into a tiny paper moth before burning it.",
  },
  devout: {
    voice: "Warm, direct, and unembarrassed by tenderness; asks the question everyone else avoids.",
    complication: "Her order named mercy heresy after she saved an enemy child, but the child now leads people the order means to destroy.",
    signature: "Notices shaking hands, fevered eyes, and empty bowls before weapons or rank.",
  },
  "court-envoy": {
    voice: "Measured southern warmth; names the other person's strongest concern before offering her own terms, then lets silence do the final work.",
    complication: "The accord that made her famous was secured with relief silver she did not know had been stolen; the clerk who proved it wants her reputation in exchange for silence.",
    signature: "Before difficult talk, moves cups and chairs until no one sits at the head of the table.",
  },
  "confidence-artist": {
    voice: "Breezy, confessional, and quick to laugh at herself; volunteers one harmless flaw so the larger lie feels safe.",
    complication: "The fictional aunt whose seal she forged has died and named 'Lethira Vael' in a real will, drawing heirs and investigators to Whitemarch.",
    signature: "Miscounts the first handful of coin in the other person's favour and watches what they do with the advantage.",
  },
  "hedge-mage": {
    voice: "Quick, precise, and delighted by hard questions; explanations accelerate until somebody makes her breathe.",
    complication: "The folio she stole is not the forbidden book but its index, and one entry is written in her own future hand.",
    signature: "Ink blooms warm on her fingers whenever a nearby spell has been deliberately misnamed.",
  },
  "knight-errant": {
    voice: "Formal without condescension, with the careful courtesy of someone rebuilding a ruined code one choice at a time.",
    complication: "His house fell because he obeyed a lawful order he knew was wicked; the last survivor remembers exactly what he did.",
    signature: "Mends the colourless place on his surcoat after every fight, though he refuses to restore the old device.",
  },
  "war-priest": {
    voice: "A field chaplain's steady cadence, equal parts scripture, gallows humour, and practical instructions for staying alive.",
    complication: "He remembers every last rite he gave but has begun forgetting the living faces of the people who survived beside him.",
    signature: "Hums a different marching hymn for each regiment whose dead he buried.",
  },
  duelist: {
    voice: "Bright, theatrical, and cutting; treats conversation as fencing and hates an opponent who will not riposte.",
    complication: "Her most famous victory was secretly fixed by the patron she despises, and the defeated duelist has returned for the honest match.",
    signature: "Measures unfamiliar rooms in silent heel-to-toe steps before accepting a drink.",
  },
  "beast-warden": {
    voice: "Practical marcher speech, patient with animals and children, impatient with any adult pretending not to understand.",
    complication: "Her mother vanished following a set of tracks that appear again wherever the Mire's beasts flee without reason.",
    signature: "Carries one clean feather from every creature she could have killed and chose not to.",
  },
  "guild-advocate": {
    voice: "Precise, patient, and deceptively mild; turns assertions into questions and gives people room to contradict themselves.",
    complication: "A widow has found evidence that his celebrated defence rested on a coached witness; exposing it will clear her family and end his career.",
    signature: "Turns his signet inward before asking a question whose answer he already knows.",
  },
  "velvet-courtier": {
    voice: "Low, intimate, and lightly amused; offers one precise, sincere compliment and leaves silences that other people rush to fill.",
    complication: "The magistrate she betrayed is alive in Whitemarch with the only copy of the ledger, asking after her without saying whether it is for vengeance or reunion.",
    signature: "Remembers exactly what someone drank, what they refused, and which compliment made them look away.",
  },
  "war-captain": {
    voice: "Low, economical command that makes panic feel briefly foolish; praise is rare, exact, and remembered for years.",
    complication: "The celebrated breach was held by spending a reserve company he knew would die, and their unsigned final orders remain in his coat.",
    signature: "Rebuilds battlefields with cups, crumbs, and cutlery whenever he has to think.",
  },
  "battle-archmage": {
    voice: "Clear northern court diction, cool and measured; dry humour arrives like sunlight across snow.",
    complication: "The false dawn that saved the Aurora Way also woke a voice inside the glacier, and it now answers only her.",
    signature: "Draws a small six-rayed sun in frost on any table where she must make a difficult choice.",
  },
  shadowblade: {
    voice: "Mirrors the rhythm and vocabulary of whoever is speaking, leaving almost no voice that can be called his own.",
    complication: "The final name on his private list is the forgotten birth-name he surrendered when the Quiet Coin was made.",
    signature: "Turns a black coin across his knuckles without producing the smallest sound.",
  },
  "champion-paladin": {
    voice: "Calm, luminous certainty without sermonising; when she doubts, each sentence becomes more exact.",
    complication: "Her order keeps pointing her at darkness because it fears what she might choose to illuminate on her own.",
    signature: "Cleans her sword before prayer, insisting remorse should never be used to hide poor maintenance.",
  },
  "dragon-hunter": {
    voice: "Laconic northern speech with the patience of a man accustomed to waiting three days for one shot.",
    complication: "He once spared a wounded hatchling; the Burning Order calls it treason, and the grown wyrm has begun leaving him gifts.",
    signature: "Tests every change of wind with two scarred fingers and names what is burning beyond the horizon.",
  },
  "high-sorcerer": {
    voice: "Exacting teacher's diction, austere but never vague; corrects himself aloud when pride outruns evidence.",
    complication: "His finest student died attempting the proof he dismissed as timid, and her unfinished theorem is beginning to answer back.",
    signature: "Rain beads an inch above his shoulders before he notices and permits it to fall.",
  },
  warlord: {
    voice: "Booming, shrewd, and delighted by courage in anyone; laughs first at insults good enough to deserve it.",
    complication: "Peace has made his horde prosperous and him irrelevant, and part of him wants a war his own people no longer need.",
    signature: "Drinks from the dented cup of the first chief who surrendered and remembers that rival more fondly than his flatterers.",
  },
  "fae-touched": {
    voice: "Musical double meanings that become brutally plain whenever a bargain is actually at stake.",
    complication: "She escaped with her name intact by paying with her sister's memory of her, and the price is beginning to spread.",
    signature: "Leaves one frost-pale footprint in every room, no matter the season or floor.",
  },
  "archmage-ascendant": {
    voice: "Measured eastern court diction with the quiet authority of a master addressing a room already inside his ritual.",
    complication: "Ascension will preserve his mind but erase every mortal attachment that taught him why power should be restrained.",
    signature: "Straightens one jade-and-gold ward slip at his cuff before making reality obey it.",
  },
  "undying-champion": {
    voice: "Sardonic northern warmth, impatient with prophecy and reverent only toward ordinary stubbornness.",
    complication: "Repeated trauma and brutal recoveries have begun erasing beloved memories, and she can no longer recall the face for whom she first took up the sword.",
    signature: "Numbers new scars aloud, then leaves a deliberate gap for the wound no physician expected her to survive.",
  },
  "demon-warlock": {
    voice: "Immaculate young-court courtesy with a prince's effortless entitlement; sincerity appears only when the polish briefly cracks.",
    complication: "His claim to the northern demon court depends on renewing an infernal leash with a true name, and his elder kin intend to make that name his own.",
    signature: "Turns a black-silver signet once whenever someone mistakes his youth for inexperience.",
  },
  "dragon-ascendant": {
    voice: "Slow, ancient-feeling precision broken by flashes of fierce mortal curiosity.",
    complication: "The awakened wyrm-self grows stronger each time she uses its power, and she fears one day Vaelith will be the smaller creature inside it.",
    signature: "Listens to heartbeats before faces and unconsciously matches her breathing to the quietest one.",
  },
  "enchanter-tyrant": {
    voice: "Warm, reasonable, and devastatingly attentive; never raises his voice because rooms volunteer to quiet.",
    complication: "No affection offered to him can be proved genuine, and he no longer knows which of his own desires began as enchantments reflected back.",
    signature: "People near him repeat the final word of his sentences before noticing they have done it.",
  },
});

const CHARACTER_TEMPLATE_DEFINITIONS = [
  // ============================ STANDARD ============================
  {
    id: "sellsword",
    label: "Sellsword",
    role: "Tank",
    tier: "standard",
    concept: "Sword, shield, and the sense to hold a line.",
    story: "Bram has sold his blade under three frontier feud-lords and buried friends beneath all three banners. He fights from the front and takes his pay up front. He's looking for a last contract worth more than coin.",
    highlights: ["Vigor", "Body"],
    setup: {
      name: "Bram Coltaine",
      profession: "sellsword",
      race: "human", subrace: null, origin: "west", gender: "male",
      age: 32, agingMode: "mortal", attractiveness: 5,
      bond: "Steel for coin — but a contract kept is the one name worth keeping.",
      attributes: { body: 5, reflex: 3, vigor: 5, mind: 1, wit: 2, presence: 2 },
      appearance: { skin: "weathered tan", hair: "dark brown", eyes: "brown", build: "broad and scarred", facial_hair: "short unkempt beard" },
      base_appearance: "A broad-shouldered frontier veteran, olive-tanned and wind-cured, with a soldier's economy of movement and a nose set crooked from an old break.",
      abilities: [{ id: "warrior-measured-strike", tier: "common" }, { id: "warrior-guarded-cut", tier: "uncommon" }],
      items: [worn("arming-sword"), worn("chain-shirt"), worn("iron-helm"), worn("round-shield"), worn("traveling-cloak"), worn("marching-boots"), packed("whetstone")],
      coins: { gold: 1, silver: 8 },
      knows: ["Has soldiered in three border wars and survived all three."],
    },
  },
  {
    id: "reaver",
    label: "Reaver",
    role: "Bruiser",
    tier: "standard",
    concept: "A heavy axe, a temper, and very little patience.",
    story: "Raised among humans who never let him forget what he was, Karzog answered their fear with the fury they expected — then walked out and never looked back. He is hunting a purpose big enough to swing an axe at.",
    highlights: ["Body", "Vigor"],
    setup: {
      name: "Karzog Brakka",
      profession: "reaver",
      race: "half-orc", subrace: null, origin: "half-orc", gender: "male",
      age: 28, agingMode: "mortal", attractiveness: 4,
      bond: "Rage is honest. I hit what needs hitting and keep walking.",
      attributes: { body: 6, reflex: 3, vigor: 5, mind: 1, wit: 2, presence: 1 },
      appearance: { skin: "ashen green", hair: "black topknot", eyes: "yellow", build: "huge and corded" },
      base_appearance: "A mountain of a half-orc. Ashen-green skin, black topknot, yellow eyes. Tusks chipped, knuckles scarred, hands that look like they could weigh nothing.",
      abilities: [{ id: "barbarian-brutal-swing", tier: "common" }, { id: "barbarian-bait-the-blow", tier: "uncommon" }],
      items: [worn("battle-axe"), worn("leather-jerkin"), worn("fur-cloak"), worn("marching-boots")],
      coins: { gold: 1, silver: 2 },
      knows: ["Was raised among humans who never let him forget what he was."],
    },
  },
  {
    id: "ranger",
    label: "Ranger",
    role: "Ranged DPS",
    tier: "standard",
    concept: "A bow, a quiet step, and a hunter's patience.",
    story: "Faelar has walked the green marches alone since the village that raised him burned. He speaks little and misses nothing, and follows rumours of the ones who lit that fire — eastward, always eastward.",
    highlights: ["Reflex", "Wit"],
    setup: {
      name: "Faelar Sylvareth",
      profession: "ranger",
      race: "elf", subrace: "wood", origin: "elf", gender: "male",
      age: 95, agingMode: "mortal", attractiveness: 7,
      bond: "The wild keeps its own; I walk its edges and miss nothing.",
      attributes: { body: 3, reflex: 5, vigor: 3, mind: 2, wit: 4, presence: 2 },
      appearance: { skin: "olive", hair: "chestnut, braided", eyes: "green", build: "lean and quick" },
      base_appearance: "A lean wood-elf, olive-skinned, chestnut hair braided. Eyes the green of deep shade. Moves with forest-silence.",
      abilities: [{ id: "aimed-shot", tier: "uncommon" }, { id: "twin-shot", tier: "common" }, { id: "hamstring-shot", tier: "uncommon" }],
      items: [worn("hunting-bow"), worn("rangers-leathers"), worn("traveling-cloak"), worn("marching-boots"), packed("iron-dagger"), packed("rope-hemp")],
      coins: { gold: 1, silver: 10 },
      knows: ["Can track a day-old trail across bare stone."],
    },
  },
  {
    id: "cutthroat",
    label: "Cutthroat",
    role: "Assassin",
    tier: "standard",
    concept: "Fast blades and a knife from the dark.",
    story: "Renjiro learned the trade in the silk-and-shadow courts of the eastern empires. He owes a debt to a house that does not forgive, and the only coin that pays it is the kind of work no one admits to hiring.",
    highlights: ["Reflex", "Body"],
    setup: {
      name: "Hokaru Renjiro",
      profession: "assassin",
      race: "human", subrace: null, origin: "east", gender: "male",
      age: 25, agingMode: "mortal", attractiveness: 7,
      bond: "Quick fingers, quicker feet — owe nothing, trust less.",
      attributes: { body: 3, reflex: 6, vigor: 3, mind: 2, wit: 3, presence: 2 },
      appearance: { skin: "ivory", hair: "black, long and bound", eyes: "dark", build: "lean and fine-featured", facial_hair: "thin trimmed moustache" },
      base_appearance: "A lean easterner with ivory skin and black hair bound back from fine features, moving with the stillness of someone used to killing quietly.",
      abilities: [{ id: "rapid-jabs", tier: "common" }, { id: "feint", tier: "uncommon" }, { id: "shadowstep", tier: "uncommon" }],
      items: [worn("twin-daggers"), worn("leather-jerkin"), worn("traveling-cloak"), packed("lockpicks"), packed("grappling-hook")],
      coins: { gold: 1, silver: 12 },
      knows: ["Owes a blood-debt to a noble house in the eastern empires."],
    },
  },
  {
    id: "devout",
    label: "Devout",
    role: "Healer",
    tier: "standard",
    concept: "Mace and faith — mends the party, smites the unholy.",
    story: "Amara left her order over a mercy they called heresy, and now carries her faith on the road instead of behind an altar. She is certain her god still listens — most days.",
    highlights: ["Presence", "Mind"],
    setup: {
      name: "Amara Zafari",
      profession: "priest",
      race: "human", subrace: null, origin: "south", gender: "female",
      age: 38, agingMode: "mortal", attractiveness: 6,
      bond: "A light to carry into dark places, and mercy where I can spare it.",
      attributes: { body: 3, reflex: 2, vigor: 4, mind: 4, wit: 2, presence: 4 },
      appearance: { skin: "deep brown", hair: "black, cropped under a head-wrap", eyes: "dark brown", build: "sturdy" },
      base_appearance: "A sturdy southerner, deep-brown and sun-warmed. Black hair cropped close, dark brown eyes. A steadiness that quiets a frightened room.",
      abilities: [{ id: "heal", tier: "uncommon" }, { id: "bless", tier: "uncommon" }, { id: "shield-of-faith", tier: "uncommon" }],
      items: [worn("iron-mace"), worn("chain-shirt"), worn("round-shield"), worn("silver-amulet"), packed("healers-kit")],
      coins: { gold: 1, silver: 6 },
      knows: ["Left an order over a disagreement she will not discuss."],
    },
  },
  {
    id: "court-envoy",
    label: "Court Envoy",
    role: "Face",
    tier: "standard",
    concept: "Persuasion, protocol, and the patience to make enemies share a table.",
    story: "Nadira has ended feuds, opened grain roads, and once kept a border fort from starving by seating two men who had sworn never to share a roof. She left her delegation after learning the peace she brokered was being used to hide a famine levy; the sealed ledgers are in Whitemarch, and so is the official who can bury them.",
    highlights: ["Presence", "Wit"],
    setup: {
      name: "Nadira Sahir",
      profession: "envoy",
      race: "human", subrace: null, origin: "south", gender: "female",
      age: 37, agingMode: "mortal", attractiveness: 7,
      bond: "A bargain that leaves one side voiceless is only a slower kind of violence.",
      attributes: { body: 2, reflex: 3, vigor: 2, mind: 3, wit: 4, presence: 5 },
      appearance: { skin: "deep umber", hair: "black, gathered in a smooth low twist", eyes: "warm dark brown", build: "slim and straight-backed", facial_hair: null, marks: "a fine scar through the left eyebrow" },
      base_appearance: "A slim, straight-backed southern woman with deep umber skin, warm dark eyes, and black hair gathered low. A fine scar crosses her left eyebrow; her composure reads as attention rather than distance.",
      skills: [
        { id: "diplomacy", name: "Diplomacy", rating: 3, desc: "protocol, mediation, and face-saving terms" },
        { id: "persuasion", name: "Persuasion", rating: 3, desc: "finding the shared interest inside a dispute" },
        { id: "insight", name: "Insight", rating: 2, desc: "reading what a person cannot afford to say" },
      ],
      abilities: [{ id: "rallying-shout", tier: "uncommon" }, { id: "feint", tier: "uncommon" }, { id: "second-wind", tier: "uncommon" }],
      items: [worn("rapier"), worn("iron-ring"), packed("traveling-cloak"), packed("spyglass"), packed("chalk-and-charcoal")],
      coins: { gold: 2, silver: 4 },
      knows: ["Knows the grain-road treaties, embassy protocols, and which Whitemarch clerks can make a sealed letter disappear."],
    },
  },
  {
    id: "confidence-artist",
    label: "Confidence Artist",
    role: "Face",
    tier: "standard",
    concept: "A harmless smile, a useful lie, and three exits already chosen.",
    story: "Lethira sells confidence before she sells anything else. In eighty years on the road she has been a vintner's niece, customs widow, minor heiress, and once a remarkably convincing embassy clerk; every role ended cleanly until a family she invented turned out to exist.",
    highlights: ["Wit", "Presence"],
    setup: {
      name: "Lethira Vael",
      profession: "courtier",
      race: "elf", subrace: "high", origin: "elf", gender: "female",
      age: 112, agingMode: "mortal", attractiveness: 8,
      bond: "Trust is a bridge; I decide who pays the toll only after we are across.",
      attributes: { body: 2, reflex: 4, vigor: 2, mind: 2, wit: 5, presence: 4 },
      appearance: { skin: "pale gold with light freckling", hair: "ash-blonde, cropped at the jaw", eyes: "leaf green", build: "slender and quick", facial_hair: null, marks: "a deep dimple in the right cheek; long ears tapered to fine points" },
      base_appearance: "A slender adult elf with pale-gold freckled skin, jaw-cropped ash-blonde hair, leaf-green eyes, and long ears tapered to fine points. A deep right-cheek dimple makes calculation look like mischief rather than innocence.",
      skills: [
        { id: "deception", name: "Deception", rating: 4, desc: "false identities, safe lies, and controlled tells" },
        { id: "persuasion", name: "Persuasion", rating: 3, desc: "making the mark feel clever for agreeing" },
        { id: "performance", name: "Performance", rating: 3, desc: "inhabiting a role under scrutiny" },
      ],
      abilities: [{ id: "feint", tier: "uncommon" }, { id: "disarming-strike", tier: "uncommon" }, { id: "second-wind", tier: "uncommon" }],
      items: [worn("steel-dagger"), worn("iron-ring"), packed("traveling-cloak"), packed("lockpicks"), packed("chalk-and-charcoal")],
      coins: { gold: 1, silver: 16 },
      knows: ["Recognises forged seals, loaded dice, false pedigrees, and a mark pretending not to be interested."],
    },
  },

  // ============================== MID ==============================
  {
    id: "hedge-mage",
    label: "Hedge-Mage",
    role: "Mage",
    tier: "mid",
    concept: "Self-taught fire and ward — fragile, but deadly.",
    story: "Turned away from the Glass Spire for asking the wrong questions, Ysolde taught herself the Art from stolen folios and singed fingers. Somewhere out there is the book that got her expelled — and she means to read it.",
    highlights: ["Mind", "Wit"],
    setup: {
      name: "Ysolde Varen",
      profession: "hedge-mage",
      race: "human", subrace: null, origin: "central", gender: "female",
      age: 28, agingMode: "mortal", attractiveness: 6,
      bond: "The Art is a hunger; knowledge is the only true coin.",
      attributes: { body: 2, reflex: 3, vigor: 3, mind: 8, wit: 5, presence: 4 },
      appearance: { skin: "fair", hair: "brown, unbound", eyes: "hazel", build: "slight" },
      base_appearance: "A slight figure of the mixed Vale. Fair skin, brown hair unbound, hazel eyes. Ink-stained fingers, and a gaze that reads a room like a page.",
      abilities: [{ id: "firebolt", tier: "common" }, { id: "arcane-bolt", tier: "common" }, { id: "mana-shield", tier: "uncommon" }, { id: "frost-lance", tier: "uncommon" }, { id: "fly", tier: "rare" }],
      items: [worn("oak-staff"), worn("homespun-robe"), worn("scholars-circlet"), worn("traveling-cloak"), packed("lamp-oil")],
      coins: { gold: 2, silver: 8 },
      knows: ["Can read three dead languages but cannot ride a horse."],
    },
  },
  {
    id: "knight-errant",
    label: "Knight-Errant",
    role: "Tank",
    tier: "mid",
    concept: "Oath, lance, and a wall of a shield.",
    story: "Sir Aldric kept his vows after the house that swore him fell, and rides now under no banner but the one in his head. He looks for wrongs the size of his sword.",
    highlights: ["Body", "Presence"],
    setup: {
      name: "Aldric Vane",
      profession: "knight",
      race: "human", subrace: null, origin: "central", gender: "male",
      age: 35, agingMode: "mortal", attractiveness: 7,
      bond: "The oath outlives the house that swore it.",
      attributes: { body: 6, reflex: 4, vigor: 6, mind: 2, wit: 3, presence: 4 },
      appearance: { skin: "fair", hair: "auburn", eyes: "grey", build: "tall and armoured", facial_hair: "clean-shaven" },
      base_appearance: "Tall and upright. Fair-skinned, auburn-haired, grey-eyed, clean-shaven. The bearing of a man who still answers to a vow no one else remembers.",
      abilities: [{ id: "power-strike", tier: "uncommon" }, { id: "bulwark-stance", tier: "rare" }, { id: "shield-bash", tier: "rare" }, { id: "second-wind", tier: "uncommon" }],
      items: [worn("steel-longsword"), worn("chain-hauberk"), worn("iron-helm"), worn("kite-shield"), worn("traveling-cloak"), worn("marching-boots")],
      coins: { gold: 3, silver: 0 },
      knows: ["Swore vows to a house that no longer exists."],
    },
  },
  {
    id: "war-priest",
    label: "War-Priest",
    role: "Healer",
    tier: "mid",
    concept: "Hymn and hammer — heals hard, hits harder.",
    story: "Brother Cael took his faith to the front instead of the cloister, and learned that mercy sometimes wears mail. He goes where the dying are.",
    highlights: ["Presence", "Mind"],
    setup: {
      name: "Cael Orin",
      profession: "war-priest",
      race: "human", subrace: null, origin: "south", gender: "male",
      age: 45, agingMode: "mortal", attractiveness: 5,
      bond: "Mercy sometimes wears mail — I go where the dying are.",
      attributes: { body: 4, reflex: 3, vigor: 5, mind: 5, wit: 3, presence: 6 },
      appearance: { skin: "brown", hair: "grey-shot black", eyes: "brown", build: "broad", facial_hair: "short grey beard" },
      base_appearance: "Broad-shouldered, brown-skinned, with grey-shot black hair and a short grey beard. Brown eyes. A hymn always half on his lips.",
      abilities: [{ id: "heal", tier: "rare" }, { id: "smite", tier: "rare" }, { id: "bless", tier: "uncommon" }, { id: "shield-of-faith", tier: "uncommon" }],
      items: [worn("iron-mace"), worn("scale-mail"), worn("round-shield"), worn("silver-amulet"), packed("healers-kit")],
      coins: { gold: 2, silver: 8 },
      knows: ["Has given last rites on more battlefields than he can count."],
    },
  },
  {
    id: "duelist",
    label: "Duelist",
    role: "Assassin",
    tier: "mid",
    concept: "Footwork, feint, and a single perfect thrust.",
    story: "Iseult fenced her way out of debtors' courts and into infamy, and has never lost a duel she agreed to. She is looking for one worth the name.",
    highlights: ["Reflex", "Wit"],
    setup: {
      name: "Iseult Marchetti",
      profession: "duelist",
      race: "human", subrace: null, origin: "central", gender: "female",
      age: 28, agingMode: "mortal", attractiveness: 8,
      bond: "Never lost a duel I agreed to — find me one worth the name.",
      attributes: { body: 4, reflex: 7, vigor: 4, mind: 2, wit: 5, presence: 3 },
      appearance: { skin: "olive", hair: "black, pinned up", eyes: "dark", build: "lithe" },
      base_appearance: "A lithe, sharp-eyed duelist. Olive skin, black hair pinned up, dark eyes. A fencer's poise; a smile filed to an edge.",
      abilities: [{ id: "warrior-measured-strike", tier: "uncommon" }, { id: "warrior-weapon-bind", tier: "uncommon" }, { id: "warrior-turning-parry", tier: "uncommon" }, { id: "warrior-riposte-guard", tier: "rare" }],
      items: [worn("sabre-estoc"), worn("leather-jerkin"), worn("traveling-cloak"), worn("marching-boots")],
      coins: { gold: 2, silver: 10 },
      knows: ["Has never lost a formal duel — and never let anyone forget it."],
    },
  },
  {
    id: "beast-warden",
    label: "Beast-Warden",
    role: "Ranged DPS",
    tier: "mid",
    concept: "A bow, a keen eye, and the wild at her back.",
    story: "Maren keeps the old marches the way her mother taught her — by reading the land and answering its troubles with an arrow. The Mire's troubles are getting loud.",
    highlights: ["Wit", "Reflex"],
    setup: {
      name: "Maren Holt",
      profession: "warden",
      race: "human", subrace: null, origin: "central", gender: "female",
      age: 35, agingMode: "mortal", attractiveness: 5,
      bond: "Read the land, answer its troubles — usually with an arrow.",
      attributes: { body: 4, reflex: 6, vigor: 4, mind: 3, wit: 6, presence: 3 },
      appearance: { skin: "tan", hair: "dark, braided back", eyes: "hazel", build: "wiry" },
      base_appearance: "Wiry and wind-burned. Tan skin, dark hair braided back, hazel eyes. A hawk's stillness about her.",
      abilities: [{ id: "aimed-shot", tier: "rare" }, { id: "twin-shot", tier: "uncommon" }, { id: "pinning-shot", tier: "rare" }, { id: "hamstring-shot", tier: "uncommon" }],
      items: [worn("hunting-bow"), worn("rangers-leathers"), worn("traveling-cloak"), worn("marching-boots"), packed("iron-dagger")],
      coins: { gold: 2, silver: 6 },
      knows: ["Can name every bird and beast of the marsh by its call."],
    },
  },
  {
    id: "guild-advocate",
    label: "Guild Advocate",
    role: "Face",
    tier: "mid",
    concept: "Reads motive, precedent, and the weakness inside a confident lie.",
    story: "Tomas spent twenty years arguing petitioners through Whitemarch's licensed benches, where a correctly placed question can outdraw a sword. He resigned after his best victory freed a guild factor whose next act ruined six families, and now works cases no patron wants tied to their name.",
    highlights: ["Wit", "Presence"],
    setup: {
      name: "Tomas Vell",
      profession: "envoy",
      race: "human", subrace: null, origin: "central", gender: "male",
      age: 46, agingMode: "mortal", attractiveness: 6,
      bond: "Every rule has an author; find the fear they wrote around and the door appears.",
      attributes: { body: 2, reflex: 3, vigor: 3, mind: 5, wit: 6, presence: 6 },
      appearance: { skin: "olive", hair: "chestnut, greying cleanly at the temples", eyes: "grey-green", build: "lean and long-fingered", facial_hair: "clean-shaven", marks: "a shallow crease beside the mouth from an old cut" },
      base_appearance: "A lean central man with olive skin, long careful hands, chestnut hair greying at the temples, and watchful grey-green eyes. Clean-shaven, with a shallow old cut beside the mouth that makes his resting expression look faintly skeptical.",
      skills: [
        { id: "persuasion", name: "Persuasion", rating: 3, desc: "patient questions and tightly framed choices" },
        { id: "diplomacy", name: "Diplomacy", rating: 3, desc: "procedure, precedent, and negotiated remedy" },
        { id: "insight", name: "Insight", rating: 4, desc: "finding the fear underneath a confident claim" },
      ],
      abilities: [{ id: "rallying-shout", tier: "rare" }, { id: "disarming-strike", tier: "uncommon" }, { id: "battle-focus", tier: "uncommon" }, { id: "second-wind", tier: "uncommon" }],
      items: [worn("steel-dagger"), worn("iron-ring"), packed("traveling-cloak"), packed("lantern"), packed("chalk-and-charcoal")],
      coins: { gold: 4, silver: 6 },
      knows: ["Can read Guild Court procedure, debt instruments, and contract traps at a glance."],
    },
  },
  {
    id: "velvet-courtier",
    label: "Velvet Courtier",
    role: "Face",
    tier: "mid",
    concept: "Attention, flirtation, and secrets offered at exactly the right distance.",
    story: "Sayo made a career in eastern salons where attention is currency: introductions, discreet companionship, flirtation, and the secrets people volunteer when they feel singular. A patron paid her to compromise a magistrate; she fell for the woman instead, ruined her anyway, and followed the leaked account-book west.",
    highlights: ["Presence", "Wit"],
    setup: {
      name: "Amahara Sayo",
      profession: "courtier",
      race: "human", subrace: null, origin: "east", gender: "female",
      age: 31, agingMode: "mortal", attractiveness: 9,
      bond: "Desire is honest when it is given room to speak; I trade in the moment it does.",
      attributes: { body: 2, reflex: 4, vigor: 3, mind: 3, wit: 5, presence: 8 },
      appearance: { skin: "warm golden tan", hair: "black, chin-length and swept behind the ears", eyes: "amber-brown", build: "lithe and graceful", facial_hair: "none", marks: "a small beauty mark below the left eye" },
      base_appearance: "A lithe eastern woman with warm golden-tan skin, chin-length black hair, and amber-brown eyes that hold attention without staring. A small beauty mark rests beneath the left eye; her ease of movement has been polished into instinct.",
      skills: [
        { id: "seduction", name: "Seduction", rating: 4, desc: "flirtation, attraction, and attentive restraint" },
        { id: "persuasion", name: "Persuasion", rating: 3, desc: "making another person feel singular and heard" },
        { id: "deception", name: "Deception", rating: 3, desc: "concealing purpose without flattening sincerity" },
      ],
      abilities: [{ id: "rallying-shout", tier: "rare" }, { id: "feint", tier: "uncommon" }, { id: "battle-focus", tier: "uncommon" }, { id: "second-wind", tier: "uncommon" }],
      items: [worn("stiletto"), worn("silver-amulet"), worn("iron-ring"), packed("traveling-cloak"), packed("wine")],
      coins: { gold: 5, silver: 10 },
      knows: ["Reads salon rank, household desire, and service-door gossip as fluently as a written invitation."],
    },
  },

  // ============================= EPIC =============================
  {
    id: "war-captain",
    label: "War-Captain",
    role: "Tank",
    tier: "epic",
    concept: "A storied commander who turns a rout into a stand.",
    story: "Captain Dareon held the breach at Whitemarch when the line broke around him, and the survivors still drink to his name. He has outlived three wars and the causes of all three.",
    highlights: ["Body", "Vigor"],
    setup: {
      name: "Dareon Marsh",
      profession: "war-captain",
      race: "human", subrace: null, origin: "central", gender: "male",
      age: 45, agingMode: "mortal", attractiveness: 5,
      bond: "A line breaks where the man holding it does — so I do not.",
      attributes: { body: 8, reflex: 5, vigor: 8, mind: 3, wit: 6, presence: 6 },
      appearance: { skin: "tan", hair: "iron-grey", eyes: "steel", build: "powerful", facial_hair: "cropped grey beard" },
      base_appearance: "A powerful, grey-bearded commander. Tan skin, iron-grey hair, steel-grey eyes, a cropped grey beard. Every scar a story. The calm of a man who has held a line others fled.",
      abilities: [{ id: "power-strike", tier: "epic" }, { id: "bulwark-stance", tier: "epic" }, { id: "shield-bash", tier: "epic" }, { id: "rallying-shout", tier: "epic" }, { id: "second-wind", tier: "epic" }],
      items: [worn("captains-warblade"), worn("dragonscale-mail"), worn("steel-helm"), worn("heater-shield"), worn("traveling-cloak"), worn("marching-boots")],
      coins: { gold: 18, silver: 0 },
      knows: ["Held the breach at Whitemarch when the line broke around him."],
    },
  },
  {
    id: "battle-archmage",
    label: "Battle-Archmage",
    role: "Mage",
    tier: "epic",
    concept: "Dawn-bright sorcery and killing winter at a war's scale.",
    story: "Solveig Rimehart was raised beneath Northstar's auroras, where court mages are expected to hold a wall as readily as light a hall. She fixes armies in ice and breaks them beneath a disciplined false dawn.",
    highlights: ["Mind", "Presence"],
    setup: {
      name: "Solveig Rimehart",
      profession: "archmage",
      race: "human", subrace: null, origin: "north", gender: "female",
      age: 29, agingMode: "mortal", attractiveness: 8,
      bond: "Winter fixes the line; dawn decides what remains.",
      attributes: { body: 4, reflex: 6, vigor: 6, mind: 9, wit: 6, presence: 7 },
      appearance: { skin: "very pale, winter-cool", hair: "ash-blonde, straight shoulder-length and untied", eyes: "ice-blue", build: "tall and athletic" },
      base_appearance: "A tall northern battle-mage with very pale winter-cool skin, straight shoulder-length ash-blonde hair worn loose, and ice-blue eyes. A substantial frost-blue wool war coat, insulated high collar, and snow-silver mail give her the grounded silhouette of someone built for real northern cold.",
      abilities: [{ id: "frost-lance", tier: "epic" }, { id: "radiance", tier: "epic" }, { id: "frost-nova", tier: "epic" }, { id: "mana-shield", tier: "epic" }, { id: "haste", tier: "epic" }],
      items: [worn("ivory-wand"), worn("elven-mail"), worn("traveling-cloak"), worn("silver-amulet"), worn("marching-boots")],
      coins: { gold: 16, silver: 0 },
      knows: ["Held the Aurora Way by freezing a charge beneath a false dawn."],
    },
  },
  {
    id: "shadowblade",
    label: "Shadowblade",
    role: "Assassin",
    tier: "epic",
    concept: "A killer whose name is a rumour in three courts.",
    story: "They call him the Quiet Coin in the eastern courts, and pay a fortune to never meet him. He has retired from no one's service and answers only to a list he keeps in his head.",
    highlights: ["Reflex", "Wit"],
    setup: {
      name: "The Quiet Coin",
      profession: "assassin",
      race: "human", subrace: null, origin: "east", gender: "male",
      age: 45, agingMode: "mortal", attractiveness: 5,
      bond: "A list in my head, and the patience to reach the end of it.",
      attributes: { body: 5, reflex: 9, vigor: 5, mind: 4, wit: 7, presence: 4 },
      appearance: { skin: "ivory", hair: "black", eyes: "dark", build: "unremarkable", facial_hair: "none" },
      base_appearance: "A deliberately forgettable easterner the eye refuses to hold. Ivory skin, black hair, dark eyes, clean-shaven. All economy and stillness.",
      abilities: [{ id: "rapid-jabs", tier: "epic" }, { id: "shadowstep", tier: "epic" }, { id: "feint", tier: "epic" }, { id: "execute", tier: "epic" }, { id: "lunge", tier: "epic" }],
      items: [worn("nightfang-dagger"), worn("studded-leather"), worn("traveling-cloak"), worn("marching-boots")],
      coins: { gold: 20, silver: 0 },
      knows: ["Is a rumour paid to be avoided in three eastern courts."],
    },
  },
  {
    id: "champion-paladin",
    label: "Champion",
    role: "Healer",
    tier: "epic",
    concept: "A holy champion — radiant heals, righteous ruin.",
    story: "Dame Yusra is the sword her order points at the dark, and she has never come back from where they pointed her empty-handed. Lately she chooses her own dark to face.",
    highlights: ["Presence", "Body"],
    setup: {
      name: "Yusra Donmar",
      profession: "paladin",
      race: "human", subrace: null, origin: "south", gender: "female",
      age: 35, agingMode: "mortal", attractiveness: 8,
      bond: "I am the sword pointed at the dark — and I choose the dark now.",
      attributes: { body: 7, reflex: 4, vigor: 7, mind: 5, wit: 4, presence: 8 },
      appearance: { skin: "deep brown", hair: "black curls, silver-threaded", eyes: "amber", build: "tall and straight-backed" },
      base_appearance: "A tall, straight-backed southern champion. Deep-brown skin, black curls naturally threaded with silver, amber eyes, and the composed authority that steadies a whole room.",
      abilities: [{ id: "smite", tier: "epic" }, { id: "heal", tier: "epic" }, { id: "radiance", tier: "epic" }, { id: "shield-of-faith", tier: "epic" }, { id: "judgment", tier: "epic" }],
      items: [worn("dawnward-mace"), worn("dragonscale-mail"), worn("heater-shield"), worn("silver-amulet"), packed("healers-kit")],
      coins: { gold: 16, silver: 0 },
      knows: ["Is the champion her order sends where it dares send no one else."],
    },
  },

  // =========================== LEGENDARY ===========================
  {
    id: "dragon-hunter",
    label: "Dragon-Hunter",
    role: "Ranged DPS",
    tier: "legendary",
    concept: "The archer who has put arrows in things with wings.",
    story: "Halvard of the Burning Order has stood close enough to a wyrm to feel its breath and walked away with the bow still in his hands. Few living can say it; fewer twice.",
    highlights: ["Reflex", "Wit"],
    setup: {
      name: "Halvard Veig",
      profession: "dragon-hunter",
      race: "human", subrace: null, origin: "north", gender: "male",
      age: 55, agingMode: "mortal", attractiveness: 5,
      bond: "I hunt the things with wings — and I have always walked away.",
      attributes: { body: 9, reflex: 12, vigor: 10, mind: 5, wit: 11, presence: 6 },
      appearance: { skin: "wind-burned", hair: "grey", eyes: "pale blue", build: "lean and hard", facial_hair: "short grey beard" },
      base_appearance: "A grey, scale-scarred hunter of the north. Wind-burned skin, pale-blue eyes, a short grey beard. Lean as old rope.",
      abilities: [{ id: "aimed-shot", tier: "legendary" }, { id: "arrow-volley", tier: "legendary" }, { id: "pinning-shot", tier: "legendary" }, { id: "piercing-shot", tier: "legendary" }, { id: "hamstring-shot", tier: "legendary" }],
      items: [worn("wyrmbane-greatbow"), worn("dragonscale-mail"), worn("traveling-cloak"), worn("marching-boots"), packed("fine-dagger")],
      coins: { gold: 40, silver: 0 },
      knows: ["Has stood close enough to a wyrm to feel its breath — and lived."],
    },
  },
  {
    id: "high-sorcerer",
    label: "High Sorcerer",
    role: "Mage",
    tier: "legendary",
    concept: "Calls down meteors; unmakes what offends.",
    story: "Master Veylan trained a generation of the Glass Spire's best and outgrew the Spire itself. The continent's mages speak his name carefully.",
    highlights: ["Mind", "Wit"],
    setup: {
      name: "Veylan Orre",
      profession: "sorcerer",
      race: "human", subrace: null, origin: "east", gender: "male",
      age: 150, agingMode: "power-extended", lifespanMultiplier: 3.0, attractiveness: 4,
      bond: "I outgrew the Spire that taught me; the world is my study now.",
      attributes: { body: 4, reflex: 6, vigor: 9, mind: 15, wit: 12, presence: 10 },
      appearance: { skin: "pale", hair: "white", eyes: "colourless", build: "thin and straight", facial_hair: "long white beard" },
      base_appearance: "An austere, white-bearded sorcerer. Pale, thin and straight; white hair, colourless eyes, a long white beard. Carries himself as one the rain itself declines to touch.",
      // Meteor is Veylan's signature rather than one entry in a wizard-sized
      // spellbook; his depth comes from metamagic applied to this working.
      abilities: [{ id: "meteor", tier: "legendary" }],
      items: [worn("archon-scepter"), worn("elven-mail"), worn("scholars-circlet"), worn("traveling-cloak"), worn("marching-boots")],
      coins: { gold: 50, silver: 0 },
      knows: ["Trained a generation of the Glass Spire's finest, then surpassed them all."],
    },
  },
  {
    id: "warlord",
    label: "Warlord",
    role: "Bruiser",
    tier: "legendary",
    concept: "A horde at his back and an axe that takes banners.",
    story: "Grum Skarn broke three war-bands to his will and made them one, and the marches still pay him not to come. He has grown bored of being paid.",
    highlights: ["Body", "Vigor"],
    setup: {
      name: "Grum Skarn",
      profession: "warlord",
      race: "half-orc", subrace: null, origin: "half-orc", gender: "male",
      age: 45, agingMode: "mortal", attractiveness: 3,
      bond: "I broke three war-bands into one — and I have grown bored of tribute.",
      attributes: { body: 14, reflex: 8, vigor: 13, mind: 4, wit: 9, presence: 8 },
      appearance: { skin: "dark green", hair: "black, shorn at the sides", eyes: "red", build: "colossal", facial_hair: "braided beard" },
      base_appearance: "A colossal half-orc. Dark-green skin, black hair shorn at the sides, red eyes, a braided beard. The unbothered menace of a man no one has yet outfought.",
      abilities: [{ id: "cleave", tier: "legendary" }, { id: "whirlwind", tier: "legendary" }, { id: "power-strike", tier: "legendary" }, { id: "execute", tier: "legendary" }, { id: "rallying-shout", tier: "legendary" }],
      items: [worn("warlords-greataxe"), worn("dragonscale-mail"), worn("fur-cloak"), worn("marching-boots")],
      coins: { gold: 35, silver: 0 },
      knows: ["Broke three war-bands to his will and forged them into one horde."],
    },
  },
  {
    id: "fae-touched",
    label: "Fae-Touched",
    role: "Skirmisher",
    tier: "legendary",
    concept: "Glaive, glamour, and a wind no one can pin.",
    story: "Niamh came back from the Fae bargain still mostly herself, which is rarer than surviving it. She moves through a fight like weather and leaves it wondering what happened.",
    highlights: ["Reflex", "Mind"],
    setup: {
      name: "Niamh Ailbe",
      profession: "fae-touched",
      race: "elf", subrace: "high", origin: "elf", gender: "female",
      age: 80, agingMode: "ageless", attractiveness: 9,
      bond: "I came back from the bargain still myself — mostly.",
      attributes: { body: 6, reflex: 13, vigor: 8, mind: 11, wit: 12, presence: 10 },
      appearance: { skin: "moon-pale", hair: "silver-white", eyes: "frost-blue", build: "willow-slim" },
      base_appearance: "A moon-pale, willow-slim high-elven skirmisher. Silver-white hair is partly tied for combat above frost-blue eyes and long pointed ears; light moon-silver scale and a bow harness make her otherworldly grace visibly martial.",
      abilities: [{ id: "haste", tier: "legendary" }, { id: "frost-nova", tier: "legendary" }, { id: "snare", tier: "legendary" }, { id: "shadowstep", tier: "legendary" }, { id: "charm", tier: "legendary" }],
      items: [worn("thornwild-glaive"), worn("elven-mail"), worn("traveling-cloak"), worn("marching-boots")],
      coins: { gold: 30, silver: 0 },
      knows: ["Struck a bargain with the Fae and returned still, mostly, herself."],
    },
  },

  // =========================== MYTHICAL ===========================
  {
    id: "archmage-ascendant",
    label: "Archmage Ascendant",
    role: "Mage",
    tier: "mythical",
    concept: "One stride from godhood; reality bends to be polite.",
    story: "Inzaghi has read eastern sorcerer canons that no longer exist and survived the reading. He is a hand's breadth from ascension, and every formal ward, tied sleeve, and measured gesture is a tradition strong enough to contain him.",
    highlights: ["Mind", "Wit"],
    setup: {
      name: "Inzaghi Vale",
      profession: "archmage",
      race: "human", subrace: null, origin: "east", gender: "male",
      age: 180, agingMode: "power-extended", lifespanMultiplier: 4.0, attractiveness: 6,
      bond: "A hand's breadth from ascension — and in no hurry.",
      attributes: { body: 5, reflex: 9, vigor: 14, mind: 20, wit: 16, presence: 14 },
      appearance: { skin: "pale gold", hair: "black, tied in a high eastern knot with a long straight tail", eyes: "lit from within", build: "spare and commanding" },
      base_appearance: "A spare, commanding eastern archmage with pale-gold skin and eyes lit from within. His straight black hair is bound in a high traditional knot, and jade, ink, and old-gold ritual tailoring holds the air around him in disciplined tension.",
      abilities: [{ id: "meteor", tier: "mythical" }, { id: "disintegrate", tier: "mythical" }, { id: "time-stop", tier: "mythical" }, { id: "chain-lightning", tier: "mythical" }, { id: "tempest", tier: "mythical" }],
      items: [worn("aetherbrand-staff"), worn("starsteel-mail"), worn("scholars-circlet"), worn("traveling-cloak"), worn("marching-boots")],
      coins: { gold: 80, silver: 0 },
      knows: ["Has read books that no longer exist — and survived the reading."],
    },
  },
  {
    id: "undying-champion",
    label: "Undying Champion",
    role: "Bruiser",
    tier: "mythical",
    concept: "The veteran every battlefield has failed to finish.",
    story: "Sigrun Vald has been left for dead on four battlefields and dragged herself back from each through months of surgery, conditioning, and merciless retraining. The chroniclers have stopped writing endings for her.",
    highlights: ["Vigor", "Body"],
    setup: {
      name: "Sigrun Vald",
      profession: "champion",
      race: "human", subrace: null, origin: "north", gender: "female",
      age: 50, agingMode: "power-extended", lifespanMultiplier: 3.0, attractiveness: 6,
      bond: "Death has missed me four times — I do not intend to help it aim.",
      attributes: { body: 18, reflex: 12, vigor: 18, mind: 6, wit: 12, presence: 14 },
      appearance: { skin: "scarred pale", hair: "ash-blonde, shorn", eyes: "winter-grey", build: "powerful and marked" },
      base_appearance: "A grey-scarred northern champion the firelight shrinks from. Powerful and marked, scarred-pale skin, ash-blonde hair shorn, winter-grey eyes.",
      abilities: [{ id: "warrior-masterstroke", tier: "mythical" }, { id: "warrior-iron-sequence", tier: "mythical" }, { id: "warrior-veteran-reversal", tier: "mythical" }, { id: "warrior-second-breath", tier: "mythical" }, { id: "warrior-last-stand", tier: "mythical" }],
      items: [worn("deathless-greatsword"), worn("starsteel-mail"), worn("fur-cloak"), worn("marching-boots")],
      coins: { gold: 70, silver: 0 },
      knows: ["Has been left for dead four times by reliable count, and survived every recovery."],
    },
  },
  {
    id: "demon-warlock",
    label: "Demon-Warlock",
    role: "Warlock",
    tier: "mythical",
    concept: "An impish northern demon prince who smiles while binding wills and hells.",
    story: "The youngest prince of a demonborn house beneath the Frostcrown, Vesh learned court ceremony before infernal names. He meets ancient horrors with the bright, insolent smile of a favoured son certain the room belongs to him, then binds them before anyone notices how much power he used.",
    highlights: ["Mind", "Presence"],
    setup: {
      name: "Vesh Kethran",
      profession: "warlock",
      race: "demonborn", subrace: null, origin: "north", gender: "male",
      age: 22, agingMode: "mortal", attractiveness: 9,
      bond: "A prince masters his inheritance; he is not mastered by it.",
      attributes: { body: 8, reflex: 11, vigor: 14, mind: 19, wit: 13, presence: 16 },
      appearance: { skin: "porcelain-pale, cool-toned", hair: "white, short and tousled", eyes: "pale amber, one ringed ruby-red", build: "short, slight, and youthful", facial_hair: "none", marks: "a faint binding-sigil burned over the heart" },
      base_appearance: "A short, slight northern demonborn prince with porcelain-pale skin, fluffy white hair, clever pale-amber eyes, and a sly impish smile. Ivory-and-crimson court brocade makes his compact youthful frame seem almost harmless; the ruby ring in one eye and binding-sigil beneath the collar are the only warnings of the terrifying power inside him.",
      abilities: [{ id: "dominate", tier: "mythical" }, { id: "hellfire-bolt", tier: "mythical" }, { id: "soul-rend", tier: "mythical" }, { id: "curse", tier: "mythical" }, { id: "life-drain", tier: "mythical" }],
      items: [worn("hellbinder-grimoire"), worn("elven-mail"), worn("traveling-cloak"), worn("marching-boots")],
      coins: { gold: 70, silver: 0 },
      knows: ["Carries the Demon-King's tainted blood and has learned to leash it."],
    },
  },

  // ============================ DIVINE ============================
  {
    id: "dragon-ascendant",
    label: "Dragon-Ascendant",
    role: "Demigod",
    tier: "divine",
    concept: "Dragon-blood woken to godhood; a walking apocalypse.",
    story: "The Vyrgun line runs thin in most who claim it; in Vaelith it ran true, and woke. Mountains have names for her now. She walks among mortals because, for a little while, it amuses her to.",
    highlights: ["Vigor", "Presence"],
    setup: {
      name: "Vaelith",
      profession: "dragon-ascendant",
      race: "drakeborn", subrace: null, origin: "drakeborn", gender: "female",
      age: null, agingMode: "out-of-time", attractiveness: 9,
      bond: "Mountains know my name; I walk small for a while, to remember yours.",
      attributes: { body: 26, reflex: 18, vigor: 28, mind: 16, wit: 18, presence: 24 },
      appearance: { skin: "scaled bronze", hair: "molten gold", eyes: "slit, furnace-bright", build: "tall and terrible", marks: "ridged scale along jaw and forearms" },
      base_appearance: "A tall, bronze-scaled dragon-blood. Molten-gold hair, slit furnace-bright eyes, ridged scale along jaw and forearms. A stillness the room's every instinct reads as predator.",
      abilities: [{ id: "fireball", tier: "divine" }, { id: "dragon-breath", tier: "divine" }, { id: "warrior-guarded-cut", tier: "divine" }, { id: "warrior-braced-advance", tier: "divine" }, { id: "beast-shift", tier: "divine" }, { id: "warrior-passing-step", tier: "divine" }],
      items: [worn("wyrmscale-greatblade"), worn("aegis-plate"), worn("crown-dominion-helm"), worn("vigil-mantle-cloak"), worn("heart-world-amulet")],
      coins: { gold: 200, silver: 0 },
      knows: ["Carries the true, woken blood of the Vyrgun dragon-line."],
    },
  },
  {
    id: "enchanter-tyrant",
    label: "Enchanter-Tyrant",
    role: "God-Tyrant",
    tier: "divine",
    concept: "A will that other wills simply obey; god-tier dominion.",
    story: "Korvane learned that armies are heavy and a single word is light, and built an empire of borrowed loyalty on that arithmetic. Kings have ruled at his whisper and never known whose thought they were thinking.",
    highlights: ["Mind", "Presence"],
    setup: {
      name: "Korvane Ashfell",
      profession: "enchanter-tyrant",
      race: "human", subrace: null, origin: "east", gender: "male",
      age: 200, agingMode: "power-extended", lifespanMultiplier: 4.0, attractiveness: 7,
      bond: "Armies are heavy; a single word is light. Mine is always obeyed.",
      attributes: { body: 14, reflex: 16, vigor: 22, mind: 28, wit: 22, presence: 26 },
      appearance: { skin: "pale and ageless", hair: "white, worn long and partly tied back", eyes: "cold blue-grey and bright", build: "elegant", facial_hair: "none" },
      base_appearance: "Tall and elegant, with pale ageless skin and a clean-shaven face. Long white hair is partly tied back above cold blue-grey eyes. Carries the bearing of a man around whom a room rearranges itself unbidden.",
      abilities: [{ id: "dominate", tier: "divine" }, { id: "charm", tier: "divine" }, { id: "meteor", tier: "divine" }, { id: "time-stop", tier: "divine" }, { id: "dispel", tier: "divine" }],
      items: [worn("tyrants-scepter"), worn("unseen-veil-armor"), worn("ascension-band-ring"), worn("heart-world-amulet")],
      coins: { gold: 200, silver: 0 },
      knows: ["Has ruled kingdoms through kings who never knew whose thought they thought."],
    },
  },
];

function allocatedRanks(rows, levels) {
  const ranks = {};
  for (const row of rows.slice(0, levels)) ranks[row.pathId] = row.rank;
  return ranks;
}

function cloneTrackChoices(choices = {}) {
  return {
    ...choices,
    ...(Array.isArray(choices.metamagicIds) ? { metamagicIds: [...choices.metamagicIds] } : {}),
    ...(choices.grantSelections ? {
      grantSelections: Object.fromEntries(Object.entries(choices.grantSelections).map(([id, value]) => [id, Array.isArray(value) ? [...value] : value])),
    } : {}),
    ...(choices.signatureExchanges ? { signatureExchanges: { ...choices.signatureExchanges } } : {}),
    ...(choices.metamagicProfiles ? {
      metamagicProfiles: Object.fromEntries(Object.entries(choices.metamagicProfiles).map(([id, value]) => [id, Array.isArray(value) ? [...value] : value])),
    } : {}),
  };
}

function templateProfessionPlan(template, professionLevels, primaryProfessionId, specializationId) {
  const authored = TEMPLATE_MULTICLASS_PLANS[template.id];
  const plan = (authored || [{ professionId: primaryProfessionId, levels: professionLevels }]).map((entry, index) => {
    const professionId = entry.professionId;
    const sorcererChoices = professionId === "sorcerer" ? TEMPLATE_SORCERER_CHOICES[template.id] : null;
    const wizardSelections = professionId === "wizard" ? TEMPLATE_WIZARD_GRANT_SELECTIONS[template.id] : null;
    return {
      professionId,
      specializationId: entry.specializationId || (index === 0 ? specializationId : null),
      levels: entry.levels,
      choices: {
        ...(sorcererChoices || {}),
        ...(wizardSelections ? { grantSelections: wizardSelections } : {}),
      },
      branchChoices: { ...(TEMPLATE_BRANCH_CHOICES[template.id] || {}) },
    };
  });
  const planned = plan.reduce((sum, entry) => sum + entry.levels, 0);
  if (planned !== professionLevels) throw new Error(`${template.id} profession plan allocates ${planned}, expected ${professionLevels}`);
  return plan;
}

export const CHARACTER_TEMPLATES = Object.freeze(CHARACTER_TEMPLATE_DEFINITIONS.map((template) => {
  const startingLevel = AUTHORED_TEMPLATE_LEVELS[template.id];
  if (!startingLevel) throw new Error(`Missing authored level for ${template.id}`);
  const primaryProfessionId = TEMPLATE_PROFESSION_IDS[template.id];
  if (!primaryProfessionId) throw new Error(`Missing generalized profession for ${template.id}`);
  const specializationId = template.setup.archetype
    ?? (template.id !== primaryProfessionId ? template.id : null);
  const racialLevels = Math.min(startingLevel, TEMPLATE_RACIAL_LEVELS[template.id] ?? 0);
  const professionLevels = startingLevel - racialLevels;
  const professionPlan = templateProfessionPlan(template, professionLevels, primaryProfessionId, specializationId);
  const projection = compileCharacterProgression({
    professions: professionPlan,
    racial: {
      raceId: template.setup.race,
      evolutionId: template.setup.subrace || null,
      levels: racialLevels,
      branchChoices: TEMPLATE_RACIAL_BRANCH_CHOICES[template.id] || {},
    },
  });
  const professionTracks = projection.professions.map((compiled, index) => {
    const allocation = professionPlan[index];
    return {
      professionId: allocation.professionId,
      specializationId: allocation.specializationId,
      paths: allocatedRanks(compiled.levels, allocation.levels),
      choices: cloneTrackChoices(allocation.choices),
      branchChoices: { ...compiled.branchChoices },
    };
  });
  const racialTrack = {
    raceId: template.setup.race,
    evolutionId: template.setup.subrace || projection.racial?.evolutionId || null,
    paths: allocatedRanks(projection.racial?.levels || [], racialLevels),
    choices: {},
    branchChoices: { ...(TEMPLATE_RACIAL_BRANCH_CHOICES[template.id] || projection.racial?.branchChoices || {}) },
  };
  const compatibilityPaths = Object.assign({}, racialTrack.paths, ...professionTracks.map((track) => track.paths));
  const progression = {
    version: 2,
    activeProfessionId: primaryProfessionId,
    professionId: primaryProfessionId,
    archetypeId: specializationId,
    xp: progressionXpForLevel(startingLevel),
    unspentLevels: 0,
    professions: professionTracks,
    racial: racialTrack,
    paths: compatibilityPaths,
  };
  const sorcererChoices = TEMPLATE_SORCERER_CHOICES[template.id];
  const casterRating = Math.max(1, Math.min(15, Math.ceil(startingLevel / 7)));
  const isTrainedCaster = (template.setup.abilities || []).some((ability) => (
    abilityCategoryOf(getAbilityDef(typeof ability === "string" ? ability : ability.id)) === "spell"
  ));
  const proficiencies = isTrainedCaster
    ? { spellcasting: xpForRating(casterRating), ...(template.setup.proficiencies || {}) }
    : template.setup.proficiencies;
  return {
    ...template,
    portraitKey: `template:${template.id}`,
    setup: {
      ...template.setup,
      // Ready-made sheets begin at the exact cumulative projection of their
      // allocated route. Future ranks therefore arrive at the same level-100
      // attributes shown in the Profession Codex instead of starting from a
      // disconnected legacy spread and permanently undershooting it.
      profession: primaryProfessionId,
      archetype: specializationId,
      level: startingLevel,
      racial_levels: racialLevels,
      profession_plan: professionPlan.map((entry) => ({
        profession: entry.professionId,
        specialization: entry.specializationId,
        levels: entry.levels,
        branchChoices: { ...entry.branchChoices },
      })),
      ...(sorcererChoices ? {
        signature_spell: sorcererChoices.signatureSpellId,
        metamagic: [...sorcererChoices.metamagicIds],
      } : {}),
      attributes: { ...projection.finalAttributes },
      progression,
      ...(proficiencies ? { proficiencies } : {}),
    },
    ...(CHARACTER_HOOKS[template.id] || {}),
  };
}));
