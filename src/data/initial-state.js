import { HANDCRAFTED } from "./handcrafted-tiles.js";
import { RUMORED } from "./rumored.js";
import { FABLED } from "./fabled.js";
import { RIVERS } from "./rivers.js";
import { computeSightFrom, computeSightFromRadius } from "../engine/world.js";
import { bodyWeightForRace } from "../engine/weight.js";
import { carryCapacityFor } from "../engine/attributes.js";

// The player starts knowing the immediate area around the Inn, the riverbank
// strip along each named river (radius 1 patches so the river plus its banks
// are visible end to end), plus small patches of country around each rumored
// landmark (radius 2) and each fabled landmark (radius 3). These pre-revealed
// patches show up as islands of detail in the otherwise-fogged map — anchors
// that orient the player in the wider world before they've ever walked there.
function makeInitialSeen() {
  let seen = computeSightFrom(0, 0);
  for (const r of RIVERS) {
    for (const p of r.path) {
      seen = computeSightFromRadius(p.x, p.y, 1, seen);
    }
  }
  for (const key of Object.keys(RUMORED)) {
    const [x, y] = key.split(",").map(Number);
    seen = computeSightFromRadius(x, y, 2, seen);
  }
  for (const f of Object.values(FABLED)) {
    seen = computeSightFromRadius(f.coord.x, f.coord.y, 3, seen);
  }
  return seen;
}

export function makeInitialState() {
  return {
    character: {
      name: "Wanderer",
      vitality: 24, vitalityMax: 30,
      resolve: 8, resolveMax: 8, // Mind-2 pool (engine/attributes.js); recomputed on creation/load
      conditions: [],
      bond: "Unwritten — your name, your face, and your past are yours to speak into being.",
      attributes: { body: 2, reflex: 3, vigor: 2, mind: 2, wit: 4, presence: 1 },
      // Race/species — chosen in the limbo interview; the engine then applies the
      // kit from data/races.js (these defaults are the unformed/back-compat state).
      race: null, subrace: null,
      racialAttributeModifiers: {},
      proficiencyGrowthMult: 1,
      racialPassives: [],
      needs: { hunger: 60, thirst: 75, sleep: 70 },
      // How much you can haul (engine/weight.js) — derived from Body/Vigor and
      // (re)computed on creation/growth/load (engine/attributes.recomputeCarryCapacity).
      carryCapacityMax: carryCapacityFor({ attributes: { body: 2, vigor: 2 } }),
      overburdened: false,
      // Light carried right now — minutes>0 means a torch/lantern is burning and
      // holding back the dark; it counts down as time passes (engine/light.js).
      light: { source: null, minutes: 0 },
      // Set from the chosen race kit at creation — drow, vampires see in the dark.
      darkvision: false,
      // Learned combat abilities (stored as { id, tier }); Strike + Brace are
      // always available and not listed here. The opening limbo interview grants
      // any starting abilities; more come from victories and teachers.
      abilities: [],
      // Use-based proficiencies { id: xp }. Grow through combat; their XP is what
      // raises the governing attributes (attributes don't grow any other way).
      proficiencies: {},
      inventory: {
        // Empty in limbo — the opening interview grants the starting kit, drawn
        // from the canonical catalog only (no invented items at creation).
        carried: [],
        coins: { copper: 0, silver: 0, gold: 0 },
      },
    },
    time: { day: 3, hour: 13, minute: 30 },
    world: {
      tiles: { "0,0": HANDCRAFTED["0,0"] },
      currentTile: { x: 0, y: 0 },
      seen: makeInitialSeen(),
      codex: {
        characters: {
          "wanderer": {
            id: "wanderer", kind: "player",
            name: "Wanderer", race: "human", profession: null,
            origin: null,
            age: null,
            attractiveness: null,
            // Unset in limbo — the PLAYER authors their own appearance in the
            // opening interview; the narrator must NOT decide their looks.
            appearance: null,
            base_appearance: "Yet unformed — a presence in the grey between-place, with no settled shape until it is named.",
            description: "You — a soul on the threshold, not yet returned to the world. Who you are is still being spoken.",
            attributes: { body: 2, reflex: 3, vigor: 2, mind: 2, wit: 4, presence: 1 },
            worn: [],
            knows: [],
            bodyWeight: 14, ridingOn: null, riders: [],
          },

          // ---------------------------------------------------------------
          // IMPORTANT NAMED FIGURES — by reputation, not by encounter
          // ---------------------------------------------------------------
          // These NPCs the player has grown up hearing about as a regional
          // native. They are NOT met until the narrator stages a meeting.
          // The narrator may quote NPCs as referencing them; the player
          // may speak about them. Their knows lists describe their own
          // experience, not the player's.

          // -------- Legendary rulers (fabled, distant) --------
          "demon-king": {
            id: "demon-king", kind: "npc",
            name: "The Demon King", race: "demon", profession: "monarch",
            age: "older than any kingdom",
            attractiveness: "terrible; the eye refuses to hold him",
            appearance: {
              skin: "not flesh — a banked, shifting heat the colour of cooling iron, darker at the edges",
              hair: "slow black smoke that never quite settles into anything",
              eyes: "too many embers, and not set in a face the way a face should be set",
              build: "vast and never the same shape twice; a presence that bends the cold air around it",
              facial_hair: "none",
              marks: "an old binding-sigil seared across the chest, still faintly smoking",
            },
            base_appearance: "A banked heat the colour of cooling iron, wreathed in slow black smoke, with too many embers for eyes. The shape will not hold still in the eye, and the cold air bends around it.",
            description: "Sits the Polestar Throne at Northstar Castle in the far north — a true demon, the abyssal power the demon-blooded merely descend from. The continent's oldest binding power and its quietest one. Pilgrims walk toward him. Few come back; none come back the same.",
            attributes: { body: 18, reflex: 16, vigor: 26, mind: 22, wit: 20, presence: 28 },
            worn: ["frost-crown", "black-robe", "polestar-sword"],
            // A RAID BOSS by design (see Vyrnholt): a vast authored health pool and
            // two actions a turn — the demon binds and annihilates across a whole
            // party each round, not one foe. Hopeless solo; a true raid for a party.
            health: 440,
            actionsPerTurn: 2,

            innatePassives: [
              { id: "godward",   tier: "divine" },   // the dread that turns aside harm
              { id: "colossus",  tier: "divine" },   // abyssal vitality atop the pool
              { id: "undying",   tier: "divine" },   // a bound demon does not simply die
              { id: "worldbreaker", tier: "divine" },// one annihilating stroke
            ],
            // His signature kit (named powers, not the generic attribute-inferred
            // fallback), tuned at divine to stand level with the great wyrm. Where
            // the wyrm is brute fire and fury, the demon is dread, binding, and one
            // annihilating stroke: execute is the Polestar Sword's killing blow that
            // bypasses all defence (his single-target signature — a stat-scaled
            // spell would land for a fraction of it); curse is the binding-sigil's
            // work, marking a foe so that stroke and his Frost Crown's rime bite all
            // the deeper; dread-aura is his regard made manifest, the fear that makes
            // every blow against him falter. The COLD rides the Frost Crown's
            // frostbrand/cursed procs, so the kit needn't spend a slot on a frost
            // bolt that would barely scratch a divine-tier foe.
            abilities: ["execute", "dread-aura", "curse"],
            knows: [
              "I have not left the Castle in seven hundred years.",
              "Every petitioner is heard. The cost of being heard is not always the same.",
            ],
          },
          "vale-king-asar": {
            id: "vale-king-asar", kind: "npc",
            name: "King Asar V of Asalan", race: "human", profession: "monarch",
            origin: "south",
            age: "in his late fifties",
            attractiveness: "comely in the southern way, royal-handsome",
            appearance: {
              skin: "deep brown, sun-warmed",
              hair: "iron-grey at the temples, otherwise black",
              eyes: "dark amber",
              build: "tall, slightly stooped from a riding-injury",
              facial_hair: "a short, neatly trimmed beard",
              marks: "an old scar along the back of the left hand",
            },
            base_appearance: "Tall, slightly stooped. Deep-brown skin sun-warmed; iron-grey at the temples; amber eyes. A short trimmed beard. A scar along the back of the left hand.",
            description: "The Vale-King, fifth of his name. Holds the throne of Asalan in the far south. Said to be a slow, careful man — known to read every petition, and to forget no slight against the Crown.",
            attributes: { body: 4, reflex: 4, vigor: 5, mind: 9, wit: 11, presence: 14 },
            worn: ["asalan-crown", "royal-red-robe", "ceremonial-sword"],
            knows: [
              "The Privy Council meets each morning at the second hour after dawn.",
              "I read every petition that reaches the throne — every one.",
              "My grandfather signed the trade-peace with Tellmar; I will not be the one to break it.",
            ],
            at: { x: -30, y: 150, day: 0 }, home: { x: -30, y: 150 }, // his seat at Asalan (engine/positions.js)
          },
          "goblin-king": {
            id: "goblin-king", kind: "npc",
            name: "The Goblin King", race: "goblin", profession: "warlord",
            age: "old, by goblin reckoning — perhaps thirty",
            attractiveness: "unsettling — too still",
            appearance: {
              skin: "ash-grey, almost lichen-coloured",
              hair: "thin and white, drawn back",
              eyes: "yellow, large, slow to blink",
              build: "tall for a goblin, broad at the shoulder; iron-collared",
              facial_hair: "none",
              marks: "a brand on the inner forearm — the Sundered Crown's broken ring",
            },
            base_appearance: "Tall for a goblin. Ash-grey skin, thin white hair drawn back, yellow eyes slow to blink. Iron collar at the throat. The Sundered Crown's broken-ring brand on the inner forearm.",
            description: "Sits the throne of Brokenhold in the Sundered Wastes, where the Sundered Crown's warlords gather under his banner. He is bigger than goblins have any right to be, and he listens — which goblins also should not.",
            attributes: { body: 12, reflex: 10, vigor: 14, mind: 8, wit: 9, presence: 10 },
            worn: ["broken-iron-crown", "patchwork-mail", "imperial-cleaver"],
            knows: [
              "I rule from the imperial vault; I do not own it.",
              "Every warband swears, breaks, swears again. I let them.",
            ],
          },
          "selenyan-speaker": {
            id: "selenyan-speaker", kind: "npc",
            name: "Lirilin of the Long Note", race: "elf", profession: "speaker",
            origin: "west",
            age: "uncountable; older than the city's outer trees",
            attractiveness: "the kind of fair that quiets a room",
            appearance: {
              skin: "the colour of unbleached linen",
              hair: "white-silver, plaited to the small of the back",
              eyes: "pale grey, slow to settle on a thing",
              build: "tall, slender, perfectly upright",
              facial_hair: "none",
              marks: "a thin tattoo of nine glyphs around the right wrist",
            },
            base_appearance: "Tall and slender. Skin the colour of unbleached linen; white-silver hair plaited to the small of the back. Pale-grey eyes. Nine glyphs tattooed around the right wrist.",
            description: "Speaker-of-the-Court at Caer Selenya, the tree-built elven city far west. The closest thing the Selenyans have to a queen, though they would correct the word. Sits in the Speakers' Spire.",
            attributes: { body: 4, reflex: 8, vigor: 6, mind: 14, wit: 13, presence: 16 },
            worn: ["silver-circlet", "river-grey-robe", "bow-of-her-mother"],
            knows: [
              "I have read every name on the Hall of Names twice.",
              "The Council briefs me at dawn; the Counsellors answer me at dusk.",
            ],
          },
          "glass-spire-master": {
            id: "glass-spire-master", kind: "npc",
            name: "The High Master of the Glass Spire", race: "human", profession: "sorcerer",
            origin: "east",
            age: "ancient — perhaps a hundred and forty",
            attractiveness: "neither one thing nor the other",
            appearance: {
              skin: "ivory-pale, fine-papered with age",
              hair: "white, cut close, sparse at the crown",
              eyes: "dark, with a slow, considering reading-attention",
              build: "small, light, indifferent to weather",
              facial_hair: "none",
              marks: "ink-stains the cleaning never quite removes",
            },
            base_appearance: "Small and light. Ivory-pale skin, white hair cut close. Dark, slow-attentive eyes. Ink-stains at the fingertips.",
            description: "The High Master sits at the top of the Glass Spire, far east. Trained the masters who trained most of the continent's working sorcerers. Said to write letters that change kingdoms.",
            attributes: { body: 2, reflex: 4, vigor: 4, mind: 22, wit: 18, presence: 12 },
            worn: ["spire-staff", "spire-grey-robe", "scrying-bowl-pendant", "iron-key-ring"],
            knows: [
              "The Spire admits by invitation only; my letters are the invitations.",
              "I have not left the tower in forty-one years.",
            ],
          },
          "great-wyrm": {
            id: "great-wyrm", kind: "npc",
            name: "Vyrnholt, the Great Wyrm", race: "wyrm", profession: null,
            age: "older than every kingdom",
            attractiveness: "magnificent; terrible",
            appearance: {
              skin: "smoke-black scale, the size of shields",
              hair: "none — long ridge-quills along the spine",
              eyes: "gold, slit, the size of dinner-plates",
              build: "longer than a wagon-train; wings folded; tail furled along the chamber wall",
              facial_hair: "none",
              marks: "an old lance-scar across the brow; gold-leaf melted into the right foreclaws",
            },
            base_appearance: "Longer than a wagon-train. Smoke-black scale. Gold slit eyes. A lance-scar across the brow. Gold leaf melted into the right foreclaws.",
            description: "The great wyrm of Drakespire — a true dragon of the old line, the Vyrgun's lord and the Drakeholt's oldest authority. Wakes seldom; is always aware. Tribute climbs the road in his name.",
            attributes: { body: 28, reflex: 16, vigor: 30, mind: 20, wit: 24, presence: 26 },
            // A RAID BOSS by design, not a multiplier — a dragon razes cities. His
            // might is in his nature: a vast authored health pool (a wyrm is not
            // burst down in three turns), THREE actions a turn (he answers a whole
            // party every round, snatching a member up in his jaws while he breathes
            // on the rest), and god-tier innate affixes since he wears no hoard. He
            // is meant to be HOPELESS solo and a true raid for a full, well-built
            // party. Tuned against scripts/boss-parity-sim.mjs.
            worn: [],
            health: 520,            // base pool, ×tier — thousands of HP at divine
            actionsPerTurn: 2,      // a dragon answers the field each round (not a turn-1 wipe)

            naturalArmor: 3,   // scale the size of shields
            naturalWard: 3,    // the old magic banked in dragon-blood
            naturalWeapon: { min: 3, max: 5, type: "physical", pen: 4, category: "fang", reach: 2, speed: 0, acc: 2 },
            innatePassives: [
              { id: "worldbreaker", tier: "divine" },    // raw, world-ending might
              { id: "godward",      tier: "divine" },     // scale that shrugs off a fifth of all harm
              { id: "undying",      tier: "divine" },     // an elder wyrm does not simply die
              { id: "juggernaut",   tier: "divine" },     // a mountain of vitality atop the base pool
              { id: "colossus",     tier: "divine" },     // immense bulk
              { id: "sunder",       tier: "divine" },     // claw and fang cleave any harness
              { id: "savage",       tier: "mythical" },   // a wyrm's strike is ruin
              { id: "cursed",       tier: "divine" },     // a draconic curse — festering wounds halve a foe's healing, breaking any turtle/sustain stack
            ],
            // Kit the combat AI actually fields: dragon-breath engulfs a GROUP
            // (his iconic moment vs a party), beast-shift is his surging wrath that
            // makes his already-devastating bite deadlier vs a lone foe. His crushing
            // natural fang IS his single-target signature — no weaker claw-tech can
            // out-value it, so we don't pad the list with abilities that never fire.
            abilities: ["dragon-breath", "beast-shift"],
            knows: [
              "I have not flown in eighty-three years.",
              "I taste every coin of tribute. Three were poisoned. The poisoners did not return.",
            ],
          },
          "hawthorn-lord": {
            id: "hawthorn-lord", kind: "npc",
            name: "The Hawthorn Lord", race: "fae", profession: "noble",
            origin: "fae",
            age: "older than the wood",
            attractiveness: "fair to the point of cold",
            appearance: {
              skin: "the colour of frost on bark",
              hair: "white-gold, long, gathered with hawthorn",
              eyes: "one pale green, one pale gold",
              build: "tall, slim, very still",
              facial_hair: "none",
              marks: "a thin scar across the left palm, given in some old bargain",
            },
            base_appearance: "Tall and slim and very still. Frost-bark skin, white-gold hair gathered with hawthorn-twigs. Mismatched eyes. A thin scar across the left palm.",
            description: "Holds the Court of Hawthorn at the Fae Crossing — a glade in the Tannic Wood. Takes bargains. Keeps them. The Vale knows three stories of his bargain-keepers' fates; only one of the three is comforting.",
            attributes: { body: 5, reflex: 10, vigor: 6, mind: 14, wit: 16, presence: 18 },
            worn: ["green-livery", "thorn-circlet", "iron-bound-glass-cup"],
            knows: [
              "Every bargain has a name; I know all the names ever made at the Crossing.",
              "Iron is uncomfortable. I keep one piece anyway. The cup, with the rim.",
            ],
          },
          "witch-queen": {
            id: "witch-queen", kind: "npc",
            name: "The Witch-Queen of the Bone Citadel", race: "human", profession: "sorcerer",
            origin: "west",
            age: "uncertain — the Citadel records eight queens, but says nothing of which",
            attractiveness: "described variably; everyone's account differs",
            appearance: {
              skin: "pale",
              hair: "long, white-blonde, or perhaps grey",
              eyes: "described as black, or as silver",
              build: "tall, in robes that read as bone",
              facial_hair: "none",
              marks: "a vertical scar between the brows that some witnesses report and others do not",
            },
            base_appearance: "Tall, in robes the colour of bone. Pale, with long hair the witnesses cannot agree on. Eyes the witnesses cannot agree on either.",
            description: "Said to have ruled the western steppes from the Bone Citadel. Said now to be gone — though the Citadel is not empty, the throne is faintly warm, and the cradles rock by no hand. Those who claim she remains are kept indoors by their families until they recover.",
            attributes: { body: 4, reflex: 6, vigor: 8, mind: 18, wit: 16, presence: 18 },
            worn: ["bone-circlet", "white-robe"],
            knows: [
              "The throne is between blinks.",
              "What is sung in the Singing Chamber is true on the day it is sung.",
            ],
          },

          // -------- Reachable lords & masters (the player may meet these) --------
          "crowsmoor-baron": {
            id: "crowsmoor-baron", kind: "npc",
            name: "Baron Halrad of Crowsmoor", race: "human", profession: "noble",
            origin: "central",
            age: "in his early fifties",
            attractiveness: "plain, weathered, an honest face",
            appearance: {
              skin: "tanned, freckled across the nose",
              hair: "thinning, faded brown",
              eyes: "grey",
              build: "stocky, square-shouldered",
              facial_hair: "short brown beard going to grey",
              marks: "a missing little finger on the left hand",
            },
            base_appearance: "Stocky and square-shouldered. Faded brown thinning hair. Grey eyes. A short greying beard. The little finger on his left hand is missing.",
            description: "Baron of Crowsmoor and effective head of the Crowsmoor Wardens. Runs the town from a modest hall above the Temple. Reads every militia ledger weekly. Honest; tired; reasonable in summer, hungrier in spring.",
            attributes: { body: 5, reflex: 4, vigor: 6, mind: 6, wit: 7, presence: 8 },
            worn: ["warden-brown-cloak", "iron-pinned-tunic", "longsword-of-the-house"],
            knows: [
              "Every gibbet-name posted at the West Gate is mine to put up and take down.",
              "Whitemarch pays the road-toll; I pay them in patrols.",
            ],
          },
          "whitemarch-treasurer": {
            id: "whitemarch-treasurer", kind: "npc",
            name: "Lord-Treasurer Selia of Whitemarch", race: "human", profession: "noble",
            origin: "central",
            age: "in her mid-forties",
            attractiveness: "striking — sharp-featured",
            appearance: {
              skin: "olive, smooth",
              hair: "black, drawn back tight",
              eyes: "dark, fast-reading",
              build: "tall, thin, upright",
              facial_hair: "none",
              marks: "an inkstain at the right cuff, near-permanent",
            },
            base_appearance: "Tall and thin and upright. Olive skin, black hair drawn back tight. Dark fast-reading eyes. A near-permanent inkstain at the right cuff.",
            description: "Lord-Treasurer of Whitemarch and effective head of state. Holds the Iron Palace at the city's centre. The iron-shilling is good where it is good because she says so. Reads ledgers; misses very little.",
            attributes: { body: 3, reflex: 4, vigor: 5, mind: 12, wit: 14, presence: 11 },
            worn: ["iron-crest-tabard", "black-robe", "treasurer's-sealring"],
            knows: [
              "Every iron-shilling minted here is recorded under one of seven hundred contracts.",
              "The Counting House is the city; the Palace is its conscience.",
            ],
          },
          "cinder-chapter-master": {
            id: "cinder-chapter-master", kind: "npc",
            name: "Brother-Master Anders Yoreld", race: "human", profession: "chapter-master",
            origin: "north",
            age: "in his late sixties",
            attractiveness: "carved, severe",
            appearance: {
              skin: "alabaster, sun-burnt only at the brow",
              hair: "white, cropped close",
              eyes: "pale blue",
              build: "tall, lean, ruined-once by a wyvern-bite",
              facial_hair: "none",
              marks: "long burn-scar from temple to jaw, dragon-glass burn",
            },
            base_appearance: "Tall and lean. Alabaster skin sun-burnt at the brow; white hair cropped close. Pale-blue eyes. A long burn-scar from temple to jaw, made by dragon-glass.",
            description: "Master of the Cinder Chapter in the Vale. Walked north four times in his prime. Honoured retired now — but if a wyrm passes south he is on a horse within the hour.",
            attributes: { body: 8, reflex: 7, vigor: 9, mind: 6, wit: 9, presence: 10 },
            worn: ["bronze-mask", "fire-blackened-cloak", "dragon-lance-old"],
            knows: [
              "I have stood close enough to a wyrm to feel its breathing weight the air.",
              "The Hearth has not gone out in eight generations; it will not go out in mine.",
            ],
          },
          "stonebrook-hold-father": {
            id: "stonebrook-hold-father", kind: "npc",
            name: "Hold-Father Druin Ironvein", race: "dwarf", profession: "hold-father",
            origin: "spine-foothills",
            age: "two hundred and thirty",
            attractiveness: "handsome in the dwarven way",
            appearance: {
              skin: "stone-tan, deeply lined",
              hair: "grey-streaked iron-brown, long, gathered",
              eyes: "amber-brown",
              build: "broad, dense, hammer-armed",
              facial_hair: "a full beard banded with three silver rings",
              marks: "a hammer-tally tattoo along the right arm — every year of service",
            },
            base_appearance: "Broad and dense. Stone-tan skin deeply lined. Grey-streaked iron-brown hair, a full beard banded with three silver rings. Amber-brown eyes.",
            description: "Elected Hold-Father of the Stonebrook Holds. Three years left of his term and visibly relieved about it. Receives in his Chamber, prefers visitors to sit, and takes the chair only when ruling.",
            attributes: { body: 8, reflex: 5, vigor: 12, mind: 8, wit: 7, presence: 9 },
            worn: ["hold-father's-mantle", "leather-apron", "hammer-of-office"],
            knows: [
              "I have shod the same forge for ninety-one years.",
              "The Council outvotes me half the time. That is the system working.",
            ],
          },
          "halfborn-matriarch": {
            id: "halfborn-matriarch", kind: "npc",
            name: "Matriarch Vela of the Halfborn", race: "half-orc", profession: "matriarch",
            origin: "central",
            age: "in her early forties",
            attractiveness: "powerful, striking",
            appearance: {
              skin: "warm grey-tan",
              hair: "black, shaved at the sides, long and braided down the back",
              eyes: "amber",
              build: "tall, broad, hammer-armed",
              facial_hair: "none",
              marks: "old chain-scar at the throat — slave's mark, kept visible",
            },
            base_appearance: "Tall, broad, and hammer-armed. Warm grey-tan skin. Black hair shaved at the sides, long-braided down the back. Amber eyes. The old chain-scar at the throat, kept visible.",
            description: "Fifth year of her term. Was a slave for six years before the breaking; helped break three war-bands afterwards. Holds court at a long table, prefers questions to petitions.",
            attributes: { body: 10, reflex: 6, vigor: 12, mind: 7, wit: 8, presence: 11 },
            worn: ["matriarch's-tabard", "iron-braid-ring", "warhammer-of-the-breaking"],
            knows: [
              "Every Halfborn here came from a coffle. I remember the coffles.",
              "The Hold is open by day and watched by night. That has not changed in my term and it will not.",
            ],
          },
          "heron-master": {
            id: "heron-master", kind: "npc",
            name: "Master Aenya of the Heron", race: "human", profession: "sorcerer",
            origin: "central",
            age: "in her late sixties",
            attractiveness: "plain, with a careful watching face",
            appearance: {
              skin: "lined, pale-tan",
              hair: "grey, gathered loose at the nape",
              eyes: "blue, slow",
              build: "thin, upright, hands ink-stained",
              facial_hair: "none",
              marks: "a thin white scar across the back of the left hand from an old binding",
            },
            base_appearance: "Thin and upright. Lined pale-tan skin. Grey hair gathered loose. Slow blue eyes. Hands ink-stained. A thin scar on the back of the left hand.",
            description: "Master of the Heron Tower in the Spine Foothills. Heron-trained; took the tower thirty-one years ago. One apprentice at a time. Rejects most applicants; has accepted three in three decades.",
            attributes: { body: 3, reflex: 4, vigor: 5, mind: 15, wit: 13, presence: 9 },
            worn: ["heron-grey-robe", "ink-and-quill-belt", "sealed-letter-of-the-master"],
            knows: [
              "Apprenticeship at this tower is seven years, minimum. Six have left in the first year. One stayed.",
              "I write to the Spire's High Master four times a year. He writes back twice.",
            ],
          },
          "the-hag": {
            id: "the-hag", kind: "npc",
            name: "The Hag of the Cot", race: "human", profession: "witch",
            origin: "north",
            age: "no one alive remembers her differently",
            attractiveness: "terrible to those expecting beauty; many bear that mistake",
            appearance: {
              skin: "winter-pale, deeply lined, root-like",
              hair: "white, drawn back tight",
              eyes: "pale-amber, attentive",
              build: "small, bent, dense",
              facial_hair: "none",
              marks: "tally-marks down the inside of both forearms — too many to count",
            },
            base_appearance: "Small and bent and dense. Root-lined winter-pale skin. White hair drawn back. Pale-amber attentive eyes. Tally-marks down both forearms.",
            description: "Holds the cellar of the Witch-Hag's Cot at the Bonemarsh edge. Will do almost anything for a fair price; the prices are not always money. Some clients pay twice without knowing.",
            attributes: { body: 3, reflex: 4, vigor: 8, mind: 14, wit: 17, presence: 12 },
            worn: ["black-shawl", "knife-of-the-cellar", "string-of-clay-charms"],
            knows: [
              "I have been here since before the Mire grew its present name.",
              "I owe no debts. I am owed many.",
            ],
          },

          // -------- Local nemeses (the player will likely meet these soon) --------
          "king-of-three": {
            id: "king-of-three", kind: "npc",
            name: "The King-of-Three", race: "goblin", profession: "warlord",
            age: "old for a goblin — perhaps twenty-five",
            attractiveness: "unpleasant",
            appearance: {
              skin: "moss-grey, scarred at the cheek",
              hair: "thin, lank, dark",
              eyes: "yellow",
              build: "small but heavy-shouldered for a goblin",
              facial_hair: "none",
              marks: "three notched stripes on the left temple — kills of name",
            },
            base_appearance: "Small but heavy-shouldered. Moss-grey scarred skin. Lank dark hair. Yellow eyes. Three notched stripes at the left temple.",
            description: "King of the Goblin Hollow den, by acclaim and by attrition. Sits a chair of stitched saddle-leather and broken shields in the King's Hollow. Two iron-collared mastiffs at his feet. He is not the Goblin King at Brokenhold and does not pretend to be — though he keeps a Sundered Crown standard pinned to the wall.",
            attributes: { body: 6, reflex: 7, vigor: 6, mind: 4, wit: 6, presence: 5 },
            worn: ["bone-helm", "stitched-mail", "saddle-leather-chair", "notched-cleaver"],
            knows: [
              "Three bands wanted this hollow. I have it.",
              "If I bring a head to Brokenhold once a year I am left alone.",
            ],
          },
        },
        races: {
          "human":     { id: "human",     name: "Human",     appearance: "Variable. Cardinal cultures shape build, complexion, hair, and dress — northerners are tall and fair; easterners pale and lean; southerners deep-skinned; westerners weathered olive; central folk mixed.", description: "The dominant folk of the region. Visually distinct by cardinal origin (north, east, south, west, central).", common: true },
          "elf":       { id: "elf",       name: "Elf",       appearance: "Tall, slender, fine-featured. Pale skin, fair or silvered hair, long-lived eyes that read older than their face. Long ears tapered to a slight point. The drow sub-kindred are dark-skinned and white-haired.", description: "Sylvan-folk of the Selenyan Court and other older kindreds — patriarchal among the surface clans. Reserved with outsiders, cool toward humans, openly disdainful of dwarves as grasping and crude. Long lives make long grudges. The drow are a matriarchal sub-elf of the deep places (a subculture, not a separate race); surface elves and drow loathe one another." },
          "dwarf":     { id: "dwarf",     name: "Dwarf",     appearance: "Half a tall man's height but twice his breadth. Beard universal to adult men, common to adult women. Dense, hard-bodied; stone-mason hands.", description: "Stone-folk. Workers of metal and stone, long-lived, sworn to hold and clan under male hold-fathers. Plain dealings, fair prices, long memories — and an old, mutual contempt for elves, whom they call vain and faithless." },
          "halfling":  { id: "halfling",  name: "Small Folk", appearance: "Half a man's height, barefoot by preference, broad of foot. Curly hair, ruddy faces, eyes that are usually amused.", description: "The small folk of the hedgerows and root-cellars — gardeners, beekeepers, bakers, brewers. Greenshaw is their best-known village in the Vale. Patronised and underestimated by the taller folk." },
          "goblin":    { id: "goblin",    name: "Goblin",    appearance: "Thigh-high. Lean, wiry, broad of mouth. Skin in shades of grey or moss; eyes large and over-attentive. Sharp small teeth.", description: "Tribal raiders and warren-keepers, feared and hated by the other peoples. Quick, bitter, and clannish. The Sundered Crown gathers them under the Goblin King and trades in slaves; others keep smaller dens." },
          "orc":       { id: "orc",       name: "Orc",       appearance: "Taller than a man, heavier, with lower-canine tusks and slate-grey or olive skin. Build varies from lean-quick to broad-massive.", description: "Warlike kin of the Sundered Crown, dreaded across the marches. Most ride and raid for the Goblin King and keep thralls; some have broken with the Crown and live otherwise." },
          "half-orc":  { id: "half-orc",  name: "Half-Orc",  appearance: "Tall and broad like an orc but with a softer brow and small or absent tusks. Skin in mixed greys and tans. Many bear the marks of slavery or its breaking.", description: "Half-blood folk of human and orc parentage — scorned by both peoples and belonging to neither, many born of raids or bondage. The Halfborn Hold gathers them and their freed kin into a Vale-edge town under elected matriarchy." },
          "drakeborn": { id: "drakeborn", name: "Drake-Blooded", appearance: "A mortal humanoid, visibly scaled along forearms and jaw, slit-pupiled, blunt-clawed. Heights and colours vary — desert-bright to mountain-dark.", description: "Mortals who carry a thin, diluted trace of wyrm-blood — descendants and claimants of the Drakeholt line, who live, age, and die as people. Rare anywhere south of the Spine; the Vyrgun warlords claim fuller blood. For the true dragons of that line, see Wyrm." },
          "fae":       { id: "fae",       name: "Fae",       appearance: "Tall, slim, fair to the point of cold. Eyes one slightly wrong colour; smiles that do not reach the rest of the face. Pulled out of sight at the corner of the eye, then in front of you again.", description: "Old folk of the deep wood — a wholly other kindred, bound by bargain and rule. The Court of Hawthorn is their nearest seat to the Vale; others are spoken of and not named." },
          "demonborn": { id: "demonborn", name: "Demon-Blooded", appearance: "A mortal humanoid: tall, broad-shouldered, hot-skinned. Two slow-growing horns at the temples (some hide them under hair); eyes that don't match. The skin too warm to touch in winter.", description: "Mortals spawned of, made by, or descended from the Demon-King's court — people of tainted heritage who live and die as people, scorned and watched. For the true demons of that court, see Demon. Rare in the Vale; less rare in the marches and along Tellmar's eastern trade." },
          "demon":     { id: "demon",     name: "Demon",        appearance: "An abyssal entity whose form will not hold still in the eye — heat, smoke, embers, and wrongness where a body should be; the air itself bends around it. When it wears a human-seeming shape, that shape is a mask.", description: "An entity of the Demon-King's infernal order, an order of being apart from mortals. Its presence alone unsettles, sickens, or awes; it does not age, hunger, or die as the living do. The demon-blooded only descend from such things. Vanishingly rare in the mortal world; its appearance is an event." },
          "wyrm":      { id: "wyrm",      name: "Wyrm",         appearance: "A true dragon — vast, larger than a hall, scaled, winged, ridge-quilled, with molten-coin eyes and a presence that weights the air.", description: "A true wyrm of the Drakeholt — an ancient apex entity older than kingdoms, hoard-keeper and tribute-lord, always aware. A wholly different order of being from the drake-blooded mortals who carry a thin trace of its line." },
          "vampire":   { id: "vampire",   name: "Vampire",      appearance: "A living corpse of terrible grace — pale, cold, fanged, ageless. The eyes catch light like an animal's; the smile holds too many teeth.", description: "The undying — mortals remade by a blood-curse into something superhuman and damned. Swift, strong, and tireless, they pay for it in sunlight, holy ground, and an endless hunger. Feared and hunted where they are known; most pass unseen among the living." },
          "lycanthrope": { id: "lycanthrope", name: "Lycanthrope", appearance: "A person who is not only a person — too still, too quick, with a wrongness in the teeth and a glint in the eye. Under the moon, something larger wears the skin.", description: "Shape-cursed folk who carry the beast within — preternaturally strong, fast-healing, keen of sense. Silver wounds them as nothing else does, and the full moon strains their hold on the beast. Shunned and feared where the curse is known." },
        },
        professions: {
          "innkeeper":      { id: "innkeeper",      name: "Innkeeper",      description: "Keeper of an inn or tavern.", common: true },
          "farmer":         { id: "farmer",         name: "Farmer",         description: "Tiller of land, raiser of stock.", common: true },
          "peddler":        { id: "peddler",        name: "Peddler",        description: "A traveling trader of small goods.", common: true },
          "monarch":        { id: "monarch",        name: "Monarch",        description: "Crowned ruler of a kingdom or comparable polity." },
          "noble":          { id: "noble",          name: "Noble",          description: "Holder of a title — baron, lord, lord-treasurer, count." },
          "warlord":        { id: "warlord",        name: "Warlord",        description: "Leader of a war-band or sworn warriors by force of arms." },
          "sorcerer":       { id: "sorcerer",       name: "Sorcerer",       description: "Practitioner of binding magic — taught, oathed, or self-discovered." },
          "witch":          { id: "witch",          name: "Witch",          description: "A hedge-magic practitioner working outside the Spire schools — older, less institutional." },
          "speaker":        { id: "speaker",        name: "Speaker",        description: "Selenyan or Greenshaw civic leader; heard, not commanded." },
          "chapter-master": { id: "chapter-master", name: "Chapter-Master", description: "Senior officer of a chapter-house of a militant order." },
          "hold-father":    { id: "hold-father",    name: "Hold-Father",    description: "Elected leader of a dwarven hold for a term of years." },
          "matriarch":      { id: "matriarch",      name: "Matriarch",      description: "Elected female leader; used in matriarchies like the Halfborn Hold." },
        },
        items: {
          "wool-cloak":    { id: "wool-cloak",    name: "Wool Cloak",   appearance: "Heavy charcoal-grey wool, dark across the shoulders from the rain. Frayed hem.", description: "A traveler's cloak.", kind: "clothing" },
          "linen-tunic":   { id: "linen-tunic",   name: "Linen Tunic",  appearance: "Undyed linen, the colour of old milk. Mended at one elbow.", description: "A plain undershirt.", kind: "clothing" },
          "leather-boots": { id: "leather-boots", name: "Leather Boots",appearance: "Cracked dark leather. The left sole is wearing through.", description: "Worn but serviceable.", kind: "clothing" },
          // [DEV/TEST] Equip to awaken magic and learn spells (combat, crowd
          // control, and utility). Unequipping disables the magic again (unless
          // you've acquired it by other means). Remove from carried below to
          // ship without it.
          "grimoire-firstflame": {
            id: "grimoire-firstflame", name: "Grimoire of the First Flame", kind: "weapon", tier: "epic",
            appearance: "A heavy black-bound tome clasped with a coil of cooled lava; its pages hum and warm when opened.",
            description: "[Dev] A teaching grimoire. Equip it to awaken the arcane arts — while you carry it open you can cast the spells it holds; set it aside and the gift sleeps.",
            combat: { weaponType: "staff", damage: { min: 6, max: 10, type: "magical", pen: 2 }, ward: 6 },
            passives: [{ id: "aegis", tier: "epic" }, { id: "clearmind", tier: "rare" }],
            grants: {
              abilities: [
                { id: "firebolt", tier: "rare" },         // combat
                { id: "chain-lightning", tier: "uncommon" }, // combat (AoE)
                { id: "frost-lance", tier: "rare" },      // crowd control (weaken/slow)
                { id: "hex", tier: "uncommon" },          // crowd control (vulnerable)
              ],
              spells: [
                { id: "witchlight",  name: "Witchlight",  description: "Conjure a cool floating light that follows you.", acquisition: "the Grimoire of the First Flame" },
                { id: "mending-word",name: "Mending Word",description: "Knit a small wound or mend a broken object with a spoken word.", acquisition: "the Grimoire of the First Flame" },
                { id: "unseen-hand", name: "Unseen Hand", description: "Move, fetch, or manipulate objects at a short distance.", acquisition: "the Grimoire of the First Flame" },
                { id: "passkey",     name: "Passkey",     description: "Coax mundane locks and bars open.", acquisition: "the Grimoire of the First Flame" },
                { id: "farsight",    name: "Farsight",    description: "Glimpse a distant place you have already seen.", acquisition: "the Grimoire of the First Flame" },
              ],
              magicKnows: "I have awakened magic by studying the Grimoire of the First Flame; while I carry it open I can cast the spells it holds.",
            },
          },
        },
        spells: {},
        skills: {},
      },
    },
    party: [], // recruited companion ids (full people in world.codex.characters)
    created: false, // false until the opening character-creation interview finishes
    beats: [{
      id: "b0", type: "narration",
      content: "There is no floor, yet you are standing. No sky, yet a pale grey light from nowhere at all. You remember nothing — not your name, not your face, not the road that ended here. This is the threshold: the hush between what was and what will be, where a soul must name itself before the world will take it back.\n\nA voice settles around you — everywhere and nowhere at once, patient and very old.\n\n\"Before you step into the Mire and it decides what to make of you, tell me who you are. Begin with your name, and the people and the place you call your own. Take your time — here, there is nothing but the telling.\"",
    }],
    apiHistory: [],
  };
}

// Merge any codex entries that exist in the fresh initial state but are
// missing from a loaded campaign — races, professions, named NPCs, etc.
// added to initial-state.js after the campaign was created. The player's
// own discoveries are preserved (we only add what's missing). Mutates +
// returns a new state object; safe to call repeatedly.
export function migrateCodex(state) {
  if (!state?.world?.codex) return state;
  const fresh = makeInitialState();
  const next = JSON.parse(JSON.stringify(state));
  const ownCodex = next.world.codex;
  for (const sub of ["characters", "races", "professions", "items", "spells", "skills"]) {
    const freshSub = fresh.world.codex[sub] || {};
    if (!ownCodex[sub]) ownCodex[sub] = {};
    for (const [k, v] of Object.entries(freshSub)) {
      // Don't overwrite the player's wanderer entry — they may have grown,
      // updated their worn list, etc. Add everything else that's missing.
      if (sub === "characters" && k === "wanderer") continue;
      if (!ownCodex[sub][k]) ownCodex[sub][k] = v;
    }
  }
  // One-time cleanup for saves made before the creation dedup fix: a self-fact
  // could be filed twice. Collapse every character's knowledge to unique facts.
  for (const ch of Object.values(ownCodex.characters || {})) {
    if (ch && Array.isArray(ch.knows)) {
      ch.knows = [...new Set(ch.knows.filter((f) => typeof f === "string" && f.trim()))];
    }
  }
  // Weight + riding (added with mounts): back-fill the per-character fields so old
  // saves load. carryCapacityMax for the player is (re)derived in App's load path.
  for (const ch of Object.values(ownCodex.characters || {})) {
    if (!ch) continue;
    if (typeof ch.bodyWeight !== "number") ch.bodyWeight = bodyWeightForRace(ch.race);
    if (ch.ridingOn === undefined) ch.ridingOn = null;
    if (!Array.isArray(ch.riders)) ch.riders = [];
  }
  return next;
}
