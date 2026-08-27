import { HANDCRAFTED } from "./handcrafted-map.js";
import { computeSightFrom } from "../engine/world.js";
import { bodyWeightForRace } from "../engine/weight.js";
import { carryCapacityFor, resolvePoolForMind, estimateAttributesFor } from "../engine/attributes.js";
import { itemTemplate } from "./catalog.js";
import { getBiome, BIOMES } from "./biomes.js";
import {
  CONTINENT,
  DEFAULT_WORLD_SEED,
  WORLD_GENERATOR_VERSION,
  WORLD_GEOGRAPHY_VERSION,
} from "./continent.js";
import { PROFESSIONS } from "./professions.js";
import { migratePortraitOverrides } from "../engine/portrait-overrides.js";
import {
  emptyMechanicsSidecar,
  emptyCombatMechanics,
  hasMechanicsSidecar,
} from "../engine/campaign-migration.js";
import { playableRosterCharacters, withoutSelectedPlayableCharacter } from "./playable-roster.js";
import { migrateProgressionState } from "../engine/progression.js";
import { normalizeMemoryBank } from "../engine/memory.js";
import { DEFAULT_NARRATOR_SETTINGS, normalizeNarratorSettings } from "../engine/narrator-settings.js";
import { WANTED_POOL, wantedCodexEntry } from "./gaol.js";

// The unified capital is authored directly in continent coordinates, with
// Grain Square deliberately fixed at the atlas origin.
const GRAIN_SQUARE_FALLBACK = { x: 0, y: 0 };

function comparablePlaceName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Resolve a retired place-graph node onto its authored world-map POI. Exact
// part ids win, then visible names and service ids provide compatibility for
// older node names. The unified world map is hydrated before Solitaire mounts.
function worldPoiCoordinate({ part, service, name, district } = {}) {
  const wantedName = comparablePlaceName(name);
  const wantedDistrict = comparablePlaceName(district);
  let best = null;
  let bestScore = 0;

  for (const [key, tile] of Object.entries(HANDCRAFTED)) {
    const poi = tile?.poi;
    if (!poi) continue;
    if (tile.cityId && tile.cityId !== "whitemarch") continue;
    let score = 0;
    if (part && poi.part === part) score += 100;
    if (wantedName && comparablePlaceName(poi.partName) === wantedName) score += 70;
    if (wantedName && comparablePlaceName(poi.name) === wantedName) score += 60;
    if (service && poi.service === service) score += 50;
    const localArea = comparablePlaceName(
      tile.districtName || poi.districtName || poi.parentName || poi.areaName || poi.district,
    );
    if (wantedDistrict && localArea === wantedDistrict) score += 10;
    if (score <= bestScore) continue;
    const [x, y] = key.split(",").map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    best = { x, y };
    bestScore = score;
  }

  return bestScore >= 50 ? best : null;
}

function grainSquareCoordinate() {
  return worldPoiCoordinate({ part: "grain-square", service: "market", name: "Grain Square", district: "The Grand Market" })
    || GRAIN_SQUARE_FALLBACK;
}

function legacyPlaceCoordinate(legacyPlace) {
  // Every node id shipped by the retired Whitemarch graph is now the `part`
  // id of its replacement POI. Resolve it against the real map directly so
  // save compatibility does not require bundling a second navigation graph.
  return worldPoiCoordinate({ part: legacyPlace?.node }) || grainSquareCoordinate();
}

function migrateLegacyWorldLocation(world) {
  if (!world?.place) return world;
  const destination = legacyPlaceCoordinate(world.place);
  const destinationKey = `${destination.x},${destination.y}`;
  const migrated = { ...world, currentTile: destination };
  delete migrated.place;
  if (migrated.tiles && HANDCRAFTED[destinationKey]) {
    migrated.tiles = { ...migrated.tiles, [destinationKey]: HANDCRAFTED[destinationKey] };
  }
  return migrated;
}

// The player starts at the actual Grain Square POI on the unified world map.
// Whitemarch is their home city — they grew up here,
// every lane is known, every wall-combat is named — so the WHOLE biome rect
// is revealed on start (and re-revealed on load via the migrator below).
// That covers the interior, the 3-hex Great Wall band (so the wall is
// visible, not fogged), the gate complex, the Approach, the river, and the
// immediate procedural surroundings inside the biome. Everything beyond
// the biome (the wider continent) stays fogged until walked.
function revealWhitemarch(seen) {
  const whitemarch = BIOMES.find((b) => b.id === "whitemarch");
  if (whitemarch?.bounds) {
    const { xmin, xmax, ymin, ymax } = whitemarch.bounds;
    for (let x = xmin; x <= xmax; x++) {
      for (let y = ymin; y <= ymax; y++) {
        seen[`${x},${y}`] = true;
      }
    }
  }
  // Defensive backstop — also reveal any HANDCRAFTED Whitemarch hex that
  // somehow falls outside the bbox (shouldn't happen with the current
  // rect, but cheap insurance against authoring drift).
  for (const key of Object.keys(HANDCRAFTED)) {
    const [x, y] = key.split(",").map(Number);
    if (getBiome(x, y).id === "whitemarch") seen[key] = true;
  }
  return seen;
}
function makeInitialSeen(start) {
  let seen = computeSightFrom(start.x, start.y);
  seen = revealWhitemarch(seen);
  return seen;
}

export function campaignWorldSeed(identity = null) {
  const supplied = String(identity || "").trim();
  const generated = supplied || globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${DEFAULT_WORLD_SEED}:campaign:${generated}`;
}

export function makeInitialState({ worldSeed = DEFAULT_WORLD_SEED } = {}) {
  const start = { ...CONTINENT.start.coord };
  const startKey = `${start.x},${start.y}`;
  const state = {
    character: {
      id: "wanderer", kind: "player",
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
      // Use-based proficiencies { id: xp }. They grant bounded mastery growth;
      // the larger attribute curve comes from stacked progression paths.
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
      continentId: CONTINENT.id,
      seed: worldSeed,
      geographyVersion: WORLD_GEOGRAPHY_VERSION,
      generatorVersion: WORLD_GENERATOR_VERSION,
      tiles: HANDCRAFTED[startKey] ? { [startKey]: HANDCRAFTED[startKey] } : {},
      currentTile: start,
      seen: makeInitialSeen(start),
      trackedCharacterId: null,
      codex: {
        characters: {
          "wanderer": {
            id: "wanderer", kind: "player",
            name: "Wanderer", race: "human", profession: null,
            origin: null,
            gender: null,
            age: null,
            agingMode: null,
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
          "threshold-voice": {
            id: "threshold-voice",
            kind: "npc",
            name: "The Threshold Voice",
            race: null,
            profession: "limbo-guide",
            age: null,
            agingMode: "out-of-time",
            description: "The patient, disembodied interviewer at the threshold between unbeing and Avarra.",
            worn: [],
            knows: [],
          },

          // Every ready-made creation character also lives somewhere in Avarra.
          // Character creation removes the selected template's roster copy so
          // the protagonist never persists as their own duplicate NPC.
          ...playableRosterCharacters({ day: 3 }),

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
            name: "The Demon King", race: "demon", gender: "male", profession: "monarch",
            age: null, agingMode: "out-of-time",
            attractiveness: 3,
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
            name: "King Asar V of Asalan", race: "human", gender: "male", profession: "monarch",
            origin: "south",
            age: 58, agingMode: "mortal",
            attractiveness: 7,
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
            successor_id: "vale-king-asar-vi",
          },
          "goblin-king": {
            id: "goblin-king", kind: "npc",
            name: "The Goblin King", race: "goblin", gender: "male", profession: "warlord",
            age: 30, agingMode: "mortal",
            attractiveness: 4,
            appearance: {
              skin: "ash-grey, almost lichen-coloured",
              hair: "thin and white, drawn back",
              eyes: "yellow, large, slow to blink",
              build: "tall for a goblin, broad at the shoulder; iron-collared",
              facial_hair: "none",
              marks: "a brand on the inner forearm — the Sundered Crown's broken ring",
            },
            base_appearance: "Tall for a goblin, broad at the shoulder. Ash-grey skin, thin white hair drawn back, yellow eyes slow to blink. The Sundered Crown's broken-ring brand on the inner forearm.",
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
            name: "Lirilin of the Long Note", race: "elf", gender: "female", profession: "speaker",
            origin: "west",
            age: 1800, agingMode: "power-extended", lifespanMultiplier: 5.0,
            attractiveness: 10,
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
            name: "The High Master of the Glass Spire", race: "human", gender: "male", profession: "sorcerer",
            origin: "east",
            age: 140, agingMode: "power-extended", lifespanMultiplier: 3.0,
            attractiveness: 5,
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
              "I have not left the combat in forty-one years.",
            ],
          },
          "great-wyrm": {
            id: "great-wyrm", kind: "npc",
            name: "Vyrnholt, the Great Wyrm", race: "wyrm", gender: "male", profession: null,
            age: null, agingMode: "out-of-time",
            attractiveness: 7,
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
            name: "The Hawthorn Lord", race: "fae", gender: "male", profession: "noble",
            origin: "fae",
            age: null, agingMode: "out-of-time",
            attractiveness: 8,
            appearance: {
              skin: "the colour of frost on bark",
              hair: "white-gold, long, gathered with hawthorn",
              eyes: "one pale green, one pale gold",
              build: "tall, slim, very still",
              facial_hair: "none",
              marks: "a thin scar across the left palm, given in some old bargain",
            },
            base_appearance: "Tall and slim and very still. Frost-bark skin, long white-gold hair. Mismatched eyes — one pale green, one pale gold. A thin scar across the left palm.",
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
            name: "The Witch-Queen of the Bone Citadel", race: "human", gender: "female", profession: "sorcerer",
            origin: "west",
            age: null, agingMode: "out-of-time",
            attractiveness: 7,
            appearance: {
              skin: "pale",
              hair: "long, white-blonde, or perhaps grey",
              eyes: "described as black, or as silver",
              build: "tall, in robes that read as bone",
              facial_hair: "none",
              marks: "a vertical scar between the brows that some witnesses report and others do not",
            },
            base_appearance: "Tall and pale. Long hair the witnesses cannot agree on. Eyes the witnesses cannot agree on either. A faint vertical scar between the brows that some report and others do not.",
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
            name: "Baron Halrad of Crowsmoor", race: "human", gender: "male", profession: "noble",
            origin: "central",
            age: 52, agingMode: "mortal",
            attractiveness: 5,
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
            successor_id: "crowsmoor-baron-heir",
          },
          "whitemarch-treasurer": {
            id: "whitemarch-treasurer", kind: "npc",
            name: "Lord-Treasurer Selia of Whitemarch", race: "human", gender: "female", profession: "noble",
            origin: "central",
            age: 45, agingMode: "mortal",
            attractiveness: 8,
            appearance: {
              skin: "olive, smooth",
              hair: "black, drawn back tight",
              eyes: "dark, fast-reading",
              build: "tall, thin, upright",
              facial_hair: "none",
              marks: "an inkstain at the right cuff, near-permanent",
            },
            base_appearance: "Tall and thin and upright. Olive skin, black hair drawn back tight. Dark fast-reading eyes. Ink-stained at the right wrist, near-permanent.",
            description: "Lord-Treasurer of Whitemarch and effective head of state. Holds the Iron Palace at the city's centre. The iron-shilling is good where it is good because she says so. Reads ledgers; misses very little.",
            attributes: { body: 3, reflex: 4, vigor: 5, mind: 12, wit: 14, presence: 11 },
            worn: ["iron-crest-tabard", "black-robe", "treasurer's-sealring"],
            knows: [
              "Every iron-shilling minted here is recorded under one of seven hundred contracts.",
              "The Counting House is the city; the Palace is its conscience.",
            ],
            successor_id: "whitemarch-treasurer-halen",
          },
          "cinder-chapter-master": {
            id: "cinder-chapter-master", kind: "npc",
            name: "Brother-Master Anders Yoreld", race: "human", gender: "male", profession: "chapter-master",
            origin: "north",
            age: 67, agingMode: "mortal",
            attractiveness: 5,
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
            successor_id: "cinder-chapter-master-tovar",
          },
          "stonebrook-hold-father": {
            id: "stonebrook-hold-father", kind: "npc",
            name: "Hold-Father Druin Ironvein", race: "dwarf", gender: "male", profession: "hold-father",
            origin: "spine-foothills",
            age: 230, agingMode: "mortal",
            attractiveness: 6,
            appearance: {
              skin: "stone-tan, deeply lined",
              hair: "grey-streaked iron-brown, long, gathered",
              eyes: "amber-brown",
              build: "broad, dense, hammer-armed",
              facial_hair: "a full beard banded with three silver rings",
              marks: "a hammer-tally tattoo along the right arm — every year of service",
            },
            base_appearance: "Broad and dense, hammer-armed. Stone-tan skin deeply lined. Grey-streaked iron-brown hair, a full long beard. Amber-brown eyes. A hammer-tally tattoo along the right arm.",
            description: "Elected Hold-Father of the Stonebrook Holds. Three years left of his term and visibly relieved about it. Receives in his Chamber, prefers visitors to sit, and takes the chair only when ruling.",
            attributes: { body: 8, reflex: 5, vigor: 12, mind: 8, wit: 7, presence: 9 },
            worn: ["hold-father's-mantle", "leather-apron", "hammer-of-office"],
            knows: [
              "I have shod the same forge for ninety-one years.",
              "The Council outvotes me half the time. That is the system working.",
            ],
            successor_id: "stonebrook-hold-father-korro",
          },
          "halfborn-matriarch": {
            id: "halfborn-matriarch", kind: "npc",
            name: "Matriarch Vela of the Halfborn", race: "half-orc", gender: "female", profession: "matriarch",
            origin: "central",
            age: 42, agingMode: "mortal",
            attractiveness: 7,
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
            successor_id: "halfborn-matriarch-elect-brann",
          },
          "heron-master": {
            id: "heron-master", kind: "npc",
            name: "Master Aenya of the Heron", race: "human", gender: "female", profession: "sorcerer",
            origin: "central",
            age: 67, agingMode: "mortal",
            attractiveness: 5,
            appearance: {
              skin: "lined, pale-tan",
              hair: "grey, gathered loose at the nape",
              eyes: "blue, slow",
              build: "thin, upright, hands ink-stained",
              facial_hair: "none",
              marks: "a thin white scar across the back of the left hand from an old binding",
            },
            base_appearance: "Thin and upright. Lined pale-tan skin. Grey hair gathered loose. Slow blue eyes. Hands ink-stained. A thin scar on the back of the left hand.",
            description: "Master of the Heron Archetype in the Spine Foothills. Heron-trained; took the combat thirty-one years ago. One apprentice at a time. Rejects most applicants; has accepted three in three decades.",
            attributes: { body: 3, reflex: 4, vigor: 5, mind: 15, wit: 13, presence: 9 },
            worn: ["heron-grey-robe", "ink-and-quill-belt", "sealed-letter-of-the-master"],
            knows: [
              "Apprenticeship at this combat is seven years, minimum. Six have left in the first year. One stayed.",
              "I write to the Spire's High Master four times a year. He writes back twice.",
            ],
            successor_id: "heron-master-apprentice",
          },
          "the-hag": {
            id: "the-hag", kind: "npc",
            name: "The Hag of the Cot", race: "human", gender: "female", profession: "witch",
            origin: "north",
            age: null, agingMode: "out-of-time",
            attractiveness: 2,
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
            name: "The King-of-Three", race: "goblin", gender: "male", profession: "warlord",
            age: 25, agingMode: "mortal",
            attractiveness: 3,
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

          // -------- Successors (named heirs to active seats; activeAsLeader flips on predecessor death) --------
          // Pre-authored 1-deep heirs to the top-tier mortal seats. Each entry is
          // a real person already living and serving in the parent's shadow —
          // codex-readable from day one, narrator-stageable on the day the
          // predecessor's deathDay fires. `activeAsLeader: false` until then;
          // `successor_id: null` (no second-deep chain — beyond this the narrator
          // improvises). Coordinates match the predecessor's seat; where the
          // predecessor lacks `at`/`home`, the successor's coords are derived
          // from the relevant biome / faction geography.

          "vale-king-asar-vi": {
            id: "vale-king-asar-vi", kind: "npc",
            name: "Prince Asar of Asalan", race: "human", gender: "male", profession: "noble",
            origin: "south",
            age: 32, agingMode: "mortal",
            attractiveness: 7,
            appearance: {
              skin: "deep brown, less weathered than his father's",
              hair: "black, oiled, combed back from a high brow",
              eyes: "dark amber, like his father, but quicker to settle on a thing",
              build: "tall, upright — the riding-injury skipped a generation",
              facial_hair: "a close-trimmed beard, edged sharp at the cheek",
              marks: "no scars; a heavy southern signet on the left forefinger",
            },
            base_appearance: "Tall and upright. Deep-brown skin not yet weathered. Black hair combed back. Quick amber eyes. A close-trimmed beard edged sharp at the cheek.",
            description: "Sixth of his name in waiting — the heir, the eldest son, named to the throne since the cradle. Reads every petition his father has tired of by mid-morning and holds court for them himself in the Lesser Hall, with the Privy Council's younger faction at his shoulder. Trained in administration since fifteen, in southern letters since eight, in the slow patience of his father since never quite enough. Asar V signed a trade-peace with Tellmar and lives by it; Asar VI has already taken three meetings about reopening the question. Sharper than his father in council, hungrier at table, less inclined to leave a slight to settle in the dark.",
            attributes: { body: 5, reflex: 6, vigor: 6, mind: 10, wit: 12, presence: 11 },
            worn: ["heir's-circlet", "royal-red-half-robe", "court-sword"],
            knows: [
              "I have read every petition my father has put aside. I do not put them aside.",
              "The Privy Council is older than I am. Half of it will be younger than I am within five years.",
              "Tellmar's trade-peace is my grandfather's signature, not mine.",
            ],
            at: { x: -30, y: 150, day: 0 }, home: { x: -30, y: 150 },
            activeAsLeader: false, successor_id: null,
          },

          "halfborn-matriarch-elect-brann": {
            id: "halfborn-matriarch-elect-brann", kind: "npc",
            name: "Brann the Iron-Tongue", race: "half-orc", gender: "female", profession: "matriarch",
            origin: "central",
            age: 38, agingMode: "mortal",
            attractiveness: 6,
            appearance: {
              skin: "grey-green, paler at the throat where the collar sat",
              hair: "dark red-brown, shorn close on the right side, long-braided on the left",
              eyes: "dark amber, level",
              build: "shorter than Vela, wider at the shoulder; a wrestler's frame",
              facial_hair: "none",
              marks: "old chain-mark at the throat — kept visible like Vela's; a notched lower tusk on the left",
            },
            base_appearance: "Shorter than Vela, wider at the shoulder. Grey-green skin paler at the throat where the collar sat. Dark red-brown hair shorn close on the right, long-braided on the left. Level amber eyes. The old chain-mark at the throat. A notched lower tusk on the left.",
            description: "Named, not yet elected. Came out of a Crown coffle at eleven, walked four hundred miles to the Hold at twelve, helped break the third war-band at twenty-six and lost the use of two fingers doing it. Voices the elder women of the Hold in Council and the Iron-Tongue is what they call her there — she will say the harder thing in plain words while the rest of the table is still finding the gentler one. Vela trusts her with the night-watch rota and the slaver-prisoner interviews, which is to say with the parts of the work that have to be done by someone who has been on both sides of the chain. Less forgiving than Vela of the slaver who turns up at the gate with a sack of silver and an apology; she would hang the third one in a week where Vela hanged the seventh in a year.",
            attributes: { body: 11, reflex: 7, vigor: 11, mind: 8, wit: 9, presence: 10 },
            worn: ["matriarch-elect's-sash", "iron-braid-ring", "two-handed-maul"],
            knows: [
              "I was eleven when they put the collar on. I was twelve when I took it off.",
              "Vela has hanged seven slavers in a year. I would have hanged the third.",
              "The Council is older than my coffle-mark. It will not be older than my term.",
            ],
            at: { x: 10, y: 4, day: 0 }, home: { x: 10, y: 4 },
            activeAsLeader: false, successor_id: null,
          },

          "stonebrook-hold-father-korro": {
            id: "stonebrook-hold-father-korro", kind: "npc",
            name: "Korro Stoneholt", race: "dwarf", subrace: "mountain", gender: "male", profession: "hold-father",
            origin: "spine-foothills",
            age: 180, agingMode: "mortal",
            attractiveness: 6,
            appearance: {
              skin: "stone-tan, less lined than Druin's, weathered around the eyes",
              hair: "iron-black going to slate at the temples, cropped at the shoulder",
              eyes: "slate-grey, slow to blink",
              build: "thick through the chest, shorter than Druin by a hand",
              facial_hair: "a forked beard banded with two iron rings — no silver yet",
              marks: "a long burn-scar down the right forearm from a vat-burst forty years ago",
            },
            base_appearance: "Thick through the chest, shorter than Druin by a hand. Stone-tan skin weathered around the eyes. Iron-black hair going to slate, cropped at the shoulder. Slow slate-grey eyes. A forked beard. A long burn-scar down the right forearm.",
            description: "Council-Master of Stonebrook these eleven years — Druin's named potential, the man the vote will fall to when the Hold-Father's chair empties. A mountain dwarf from the upper Spine seams, not the river-valley line Druin came up through, and the older Stonebrook councillors have not forgiven him the geography. Reads ledgers Druin signs without looking, and Druin knows it. Where Druin is patient with the Council, Korro is patient with no one — he is the man who will say no when Druin would have said yes, and the Hold knows it, which is part of why they will elect him and part of why some of them will not sleep well the night they do.",
            attributes: { body: 9, reflex: 5, vigor: 11, mind: 10, wit: 9, presence: 8 },
            worn: ["council-master's-mantle", "leather-apron", "ledger-and-stylus", "iron-hammer-of-the-seam"],
            knows: [
              "I have read every contract Druin has signed for eleven years. He signs them. I read them.",
              "I came down from the upper seams. The river-valley dwarves remember it every council.",
              "Druin says yes too often. I will not have that problem.",
            ],
            at: { x: 35, y: 20, day: 0 }, home: { x: 35, y: 20 },
            activeAsLeader: false, successor_id: null,
          },

          "whitemarch-treasurer-halen": {
            id: "whitemarch-treasurer-halen", kind: "npc",
            name: "Halen Vossane", race: "human", gender: "female", profession: "noble",
            origin: "central",
            age: 35, agingMode: "mortal",
            attractiveness: 7,
            appearance: {
              skin: "olive, smooth, well-kept",
              hair: "chestnut-brown, drawn back in a single plait",
              eyes: "hazel, fast-reading like Selia's",
              build: "average height, slim, very neat",
              facial_hair: "none",
              marks: "ink-stains at both cuffs — Selia keeps hers at the right only",
            },
            base_appearance: "Average height and very neat. Olive skin, smooth. Chestnut-brown hair in a single plait. Fast-reading hazel eyes. Ink-stains worn into the skin of both wrists.",
            description: "One of Selia's three deputies and the one Selia trusts with the southern accounts — Asalan tariffs, the Hollow Coast bond-leases, the long ledger of who in Tellmar owes Whitemarch which favour. Came up through the Counting House from a tally-clerk's stool at sixteen; never held a sword, never crossed a wall. Reads ledgers the way Selia reads them, with the same finger-running attention and the same near-permanent inkstain — though Selia keeps hers at the right cuff and Halen has them at both, which the older clerks have a quiet joke about. Where Selia uses the ledger as conscience, Halen uses it as leverage; she has a sharper sense than her master of which contract leaned on at the right moment will fold a southern house without ever drawing the Watch. The Counting House call her the Quiet Knife behind her back, and she has heard it, and does not mind.",
            attributes: { body: 3, reflex: 5, vigor: 5, mind: 12, wit: 13, presence: 9 },
            worn: ["deputy's-tabard", "black-half-robe", "deputy's-sealring", "tally-stylus"],
            knows: [
              "I keep the southern accounts. Selia signs them; I read them first.",
              "A contract leaned on at the right moment folds a house. The Watch never needs to know.",
              "They call me the Quiet Knife in the Counting House. I have heard it. I do not mind.",
            ],
            at: { x: 0, y: 4, day: 0 }, home: { x: 0, y: 4 },
            activeAsLeader: false, successor_id: null,
          },

          "cinder-chapter-master-tovar": {
            id: "cinder-chapter-master-tovar", kind: "npc",
            name: "Brother-Lieutenant Tovar Eldred", race: "human", gender: "male", profession: "chapter-master",
            origin: "north",
            age: 50, agingMode: "mortal",
            attractiveness: 6,
            appearance: {
              skin: "weather-burnt fair, freckled across the bridge of the nose",
              hair: "sandy-brown going grey at the temples, cut to the collar",
              eyes: "grey-blue, patient",
              build: "broad, square, hands roughened from rein and lance",
              facial_hair: "a short brown beard, neatly clipped",
              marks: "a wyrm-burn down the back of the right hand, smaller than Anders' face-scar — he has been close to a wyrm once, not four times",
            },
            base_appearance: "Broad and square. Weather-burnt fair skin freckled across the nose. Sandy-brown hair going grey at the temples. Patient grey-blue eyes. A short brown beard. A wyrm-burn down the back of the right hand.",
            description: "Anders Yoreld's named lieutenant these twelve years and the Chapter's drill-master for nine before that. Walked north once in his prime; felt a wyrm's breathing weight the air once, took the burn on the back of the hand for his trouble, and has been content with the once. Where Anders is severe — would have a brother flogged for a slack girth-strap and then ride him to the wyrm-fall the same day — Tovar is patient: he will let the same fault stand twice before he speaks to it, and speaks then in a voice that gives the brother room to mend it without losing face. The senior brothers count this a virtue; the older ones, the ones who walked north with Anders three times, count it the thing that will kill the Chapter when the next wyrm comes south. Both are probably right.",
            attributes: { body: 8, reflex: 7, vigor: 8, mind: 7, wit: 8, presence: 9 },
            worn: ["bronze-half-mask", "fire-blackened-cloak", "dragon-lance", "drill-master's-baton"],
            knows: [
              "I have stood close enough to a wyrm to feel its breathing weight the air. Once.",
              "Anders would have flogged the brother for the slack girth-strap. I let it stand.",
              "The Hearth has not gone out in eight generations. It will not go out in mine either.",
            ],
            at: { x: 20, y: -20, day: 0 }, home: { x: 20, y: -20 },
            activeAsLeader: false, successor_id: null,
          },

          "crowsmoor-baron-heir": {
            id: "crowsmoor-baron-heir", kind: "npc",
            name: "Lady Anwen of Crowsmoor", race: "human", gender: "female", profession: "noble",
            origin: "central",
            age: 25, agingMode: "mortal",
            attractiveness: 7,
            appearance: {
              skin: "tanned, freckled like her father across the nose",
              hair: "dark brown, long, plaited back for riding",
              eyes: "grey, like Halrad's, and steadier than his",
              build: "tall, lean, rider's hips",
              facial_hair: "none",
              marks: "a thin white scar at the right jaw from a bolt that came too close on the eastern road",
            },
            base_appearance: "Tall and lean. Tanned skin freckled across the nose. Dark brown hair plaited back. Steady grey eyes. A thin white scar at the right jaw.",
            description: "Halrad's elder daughter, raised inside the Wardens' barracks rather than the hall above the Temple — her father wanted her to know the ledgers from the militia end first, and she has. Captain of the East Gate patrol at twenty-two; knows every reeve in the Reach by first name, knows which of them takes a cut off the road-toll and which only takes a cup of ale and a meal. Rides the road herself most weeks; rides it in the saddle, not the carriage. The arrangement with Whitemarch — the toll, the patrols, the iron-wagons through to the Spine — was Halrad's slow work over twenty years; Anwen has already had two meetings with the Counting House about reading the terms again, with the road-tolls being what they are and the Reach being hungrier than it used to be. Honest by inclination, hungry by necessity, and more willing than her father to let the second feed the first.",
            attributes: { body: 6, reflex: 7, vigor: 6, mind: 7, wit: 8, presence: 8 },
            worn: ["warden-brown-half-cloak", "iron-pinned-jerkin", "warden-captain's-sword", "rider's-gloves"],
            knows: [
              "I have ridden the East Gate patrol three years. I know which reeves take a cup, and which take a cut.",
              "My father's road-toll arrangement is twenty years old. I have read it twice this season.",
              "Whitemarch pays in patrols. Patrols cost more than they did when my father drew the contract.",
            ],
            at: { x: 30, y: 0, day: 0 }, home: { x: 30, y: 0 },
            activeAsLeader: false, successor_id: null,
          },

          "heron-master-apprentice": {
            id: "heron-master-apprentice", kind: "npc",
            name: "Naela of the Heron", race: "human", gender: "female", profession: "sorcerer",
            origin: "central",
            age: 33, agingMode: "mortal",
            attractiveness: 6,
            appearance: {
              skin: "pale-tan, smooth, indoor-kept",
              hair: "dark brown, plaited tight to the skull, plait to the small of the back",
              eyes: "dark grey, slow like her master's",
              build: "thin, upright, narrow-shouldered",
              facial_hair: "none",
              marks: "ink-stains down the side of the right hand from heel to little finger — seven years of copy-work",
            },
            base_appearance: "Thin and upright, narrow-shouldered. Pale-tan smooth skin. Dark brown hair plaited tight to the skull, plait to the small of the back. Slow dark-grey eyes. Ink-stains down the side of the right hand.",
            description: "Seven years with Aenya — the one out of three who stayed. The other two left in the first winter; Naela came back from the first winter with chilblains and a fair copy of the second Heron grammar, and Aenya did not throw her out, which at the Heron Archetype is the formal decision. Quiet by training and by inclination. Has bound a witchlight three hundred times now; has bound a binding-sigil twice, both under her master's hand. Will not be Aenya — Aenya took the combat at thirty-six and held it thirty-one years through plain refusal of every applicant who did not deserve it; Naela has already accepted two of three pre-apprentice letters in the past year that Aenya would have set aside without reading, and her master has noticed. Whether that is generosity or the thinness of the line is a question the Heron school will be asking for some time.",
            attributes: { body: 3, reflex: 5, vigor: 5, mind: 13, wit: 11, presence: 7 },
            worn: ["heron-grey-half-robe", "ink-and-quill-belt", "apprentice's-bound-grimoire"],
            knows: [
              "Six left in the first winter. I came back with chilblains and a fair copy. He did not throw me out.",
              "I have bound a witchlight three hundred times. A binding-sigil twice, both under my master's hand.",
              "He sets the letters aside without reading. I have read two and accepted them. He has noticed.",
            ],
            at: { x: 40, y: 25, day: 0 }, home: { x: 40, y: 25 },
            activeAsLeader: false, successor_id: null,
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
          "drakeborn": { id: "drakeborn", name: "Drake-Blooded", appearance: "A mortal humanoid of unusual height and presence, broad-shouldered and heavy in the bone. A fine vein of scales runs from the nape down the shoulders and collar — most else passes for human at a glance: human face, human hands, human eyes. The wyrm-line shows in stature and in the slow heat at the back of the throat.", description: "Mortals who carry a thin, diluted trace of wyrm-blood — descendants and claimants of the Drakeholt line, who live, age, and die as people. Rare anywhere south of the Spine; the Vyrgun warlords claim fuller blood. For the true dragons of that line, see Wyrm." },
          "beastfolk": { id: "beastfolk", name: "Beast Folk", appearance: "A mortal humanoid with the ears and tail of their kindred animal — feline, lupine, ursine, or avian (small feathered crests in place of ears, a fan-tail of feathers). Otherwise of human body, hand, and face; build and bearing vary by lineage.", description: "Mortals of an old animal-kindred line, common to the southern jungle-fringes and the eastern steppe and rare in the central plains. In human capitals they read as foreign at a glance and are often bonded by the same coffles that import the other foreign kindreds. The Halfborn Hold gathers them and any other freed kin into its Vale-edge town." },
          "fae":       { id: "fae",       name: "Fae",       appearance: "Tall, slim, fair to the point of cold. Eyes one slightly wrong colour; smiles that do not reach the rest of the face. Pulled out of sight at the corner of the eye, then in front of you again.", description: "Old folk of the deep wood — a wholly other kindred, bound by bargain and rule. The Court of Hawthorn is their nearest seat to the Vale; others are spoken of and not named." },
          "demonborn": { id: "demonborn", name: "Demon-Blooded", appearance: "A mortal humanoid whose skin and bearing pass for a high-born of any line. The one mark that does not lie is a pair of ram-curl horns at the temples — concealed under hair, hood, or a courtier's circlet by those who wish to move freely. Often strikingly beautiful in a way that puts people at ease before they should be.", description: "Mortals spawned of, made by, or descended from the Demon-King's court — people of tainted heritage who live and die as people, scorned and watched. For the true demons of that court, see Demon. Rare in the Vale; less rare in the marches and along Tellmar's eastern trade." },
          "demon":     { id: "demon",     name: "Demon",        appearance: "An abyssal entity whose form will not hold still in the eye — heat, smoke, embers, and wrongness where a body should be; the air itself bends around it. When it wears a human-seeming shape, that shape is a mask.", description: "An entity of the Demon-King's infernal order, an order of being apart from mortals. Its presence alone unsettles, sickens, or awes; it does not age, hunger, or die as the living do. The demon-blooded only descend from such things. Vanishingly rare in the mortal world; its appearance is an event." },
          "wyrm":      { id: "wyrm",      name: "Wyrm",         appearance: "A true dragon — vast, larger than a hall, scaled, winged, ridge-quilled, with molten-coin eyes and a presence that weights the air.", description: "A true wyrm of the Drakeholt — an ancient apex entity older than kingdoms, hoard-keeper and tribute-lord, always aware. A wholly different order of being from the drake-blooded mortals who carry a thin trace of its line." },
          "vampire":   { id: "vampire",   name: "Vampire",      appearance: "A living corpse of terrible grace — pale, cold, fanged, ageless. The eyes catch light like an animal's; the smile holds too many teeth.", description: "The undying — mortals remade by a blood-curse into something superhuman and damned. Swift, strong, and tireless, they pay for it in sunlight, holy ground, and an endless hunger. Feared and hunted where they are known; most pass unseen among the living." },
          "lycanthrope": { id: "lycanthrope", name: "Lycanthrope", appearance: "A person who is not only a person — too still, too quick, with a wrongness in the teeth and a glint in the eye. Under the moon, something larger wears the skin.", description: "Shape-cursed folk who carry the beast within — preternaturally strong, fast-healing, keen of sense. Silver wounds them as nothing else does, and the full moon strains their hold on the beast. Shunned and feared where the curse is known." },
        },
        professions: { ...PROFESSIONS },
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
    // The production deterministic combat sidecar is campaign-owned so an
    // accepted encounter survives autosave, reload, and device handoff.
    activeCombatSession: null,
    pendingCombatDirective: null,
    pendingTravelCombat: null,
    productionCombatSequence: 0,
    combatSettlementReceipts: [],
    // The Solitaire combat sidecar: the durable build, and the fight in progress. A fight
    // used to live in component state, so it lasted exactly as long as the tab did.
    mechanics: emptyMechanicsSidecar(),
    // Prose the campaign owes and has not yet paid: settlement records the debt in the same
    // commit as its receipt, so a crash between the two costs the scene and not the outcome.
    presentationJobs: [],
    // A reward earned and not yet chosen. Durable, so a win survives a reload with its
    // offer intact rather than quietly evaporating.
    pendingReward: null,
    portraitOverrides: {},
    created: false, // false until the opening character-creation interview finishes
    beats: [{
      id: "b0", type: "narration",
      content: "There is no floor, yet you are standing. No sky, yet a pale grey light from nowhere at all. You remember nothing — not your name, not your face, not the road that ended here. This is the threshold: the hush between what was and what will be, where a soul must name itself before the world will take it back.\n\nA voice settles around you — everywhere and nowhere at once, patient and very old.\n\n\"Before you step into Avarra and it decides what to make of you, tell me who you are. Begin with your name, and the people and the place you call your own. Take your time — here, there is nothing but the telling.\"",
    }],
    apiHistory: [],
    // Durable facts the narrator explicitly chose to remember via the `remember`
    // tool (supabase/functions/narrate/index.ts) — survives independently of the
    // rolling apiHistory window, injected into every state_context (see
    // buildStateContext in engine/api.js). Newest last; capped in beat.js.
    memories: [],
    // Campaign-scoped creative direction and automatic memory policy. These
    // belong to the save rather than localStorage so every device tells the
    // same story when the campaign is resumed.
    narratorSettings: { ...DEFAULT_NARRATOR_SETTINGS },
  };
  return migrateProgressionState(state, { alignAuthoredAttributes: true });
}

export function makeNewCampaignState({ seedFactory = campaignWorldSeed } = {}) {
  return makeInitialState({ worldSeed: seedFactory() });
}

export function resetCampaignState(currentState, { seedFactory = campaignWorldSeed } = {}) {
  return makeInitialState({ worldSeed: currentState?.world?.seed || seedFactory() });
}

function compactProceduralTileForGeneratorMigration(tile) {
  if (!tile || typeof tile !== "object") return tile;
  const isGenerated = tile.procedural || tile.proceduralDelta;
  if (!isGenerated) return tile;
  const delta = { proceduralDelta: true, visited: true };
  if (!tile.authoredFeatureId && tile.poi && tile.poi.type !== "hidden") delta.poi = tile.poi;
  for (const field of ["status", "shop", "aerialSighting", "cache"]) {
    if (tile[field] !== undefined) delta[field] = tile[field];
  }
  return delta;
}

function compactProceduralTileCollection(tiles) {
  if (!tiles || typeof tiles !== "object" || Array.isArray(tiles)) return tiles;
  return Object.fromEntries(Object.entries(tiles).map(([key, tile]) => [
    key,
    compactProceduralTileForGeneratorMigration(tile),
  ]));
}

function supportedWorldVersions(world) {
  const readVersion = (value, fallback, label) => {
    if (value === undefined) return fallback;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
      throw new RangeError(`Invalid world ${label} version: ${String(value)}.`);
    }
    return value;
  };
  const geographyVersion = readVersion(world.geographyVersion, 1, "geography");
  const generatorVersion = readVersion(world.generatorVersion, 2, "generator");
  if (geographyVersion > WORLD_GEOGRAPHY_VERSION || generatorVersion > WORLD_GENERATOR_VERSION) {
    throw new RangeError(
      `This campaign requires world geography ${geographyVersion} and generator ${generatorVersion}; update Solitaire before loading it.`,
    );
  }
  return { geographyVersion, generatorVersion };
}

function migrateWorldVersions(world) {
  const { geographyVersion, generatorVersion } = supportedWorldVersions(world);
  const requiresRebase = geographyVersion < WORLD_GEOGRAPHY_VERSION
    || generatorVersion < WORLD_GENERATOR_VERSION;
  const tiles = requiresRebase
    ? compactProceduralTileCollection(world.tiles || {})
    : world.tiles;
  return {
    ...world,
    ...(tiles ? { tiles } : {}),
    geographyVersion: WORLD_GEOGRAPHY_VERSION,
    generatorVersion: WORLD_GENERATOR_VERSION,
  };
}

const WANTED_BY_KEY = new Map(WANTED_POOL.map((person) => [person.key, person]));

function wantedPersonForActiveBounty(quest) {
  if (quest?.type !== "bounty" || quest.status !== "active") return null;
  if (WANTED_BY_KEY.has(quest.targetKey)) return WANTED_BY_KEY.get(quest.targetKey);
  const characterKey = typeof quest.targetCharacterId === "string"
    ? quest.targetCharacterId.replace(/^wanted-/, "")
    : null;
  if (WANTED_BY_KEY.has(characterKey)) return WANTED_BY_KEY.get(characterKey);
  return WANTED_POOL.find((person) => (
    String(quest.id || "").endsWith(`-${person.key}`) || quest.target === person.name
  )) || null;
}

function backfillActiveBountyTargets(world) {
  const characters = world.codex?.characters;
  if (!characters || !Array.isArray(world.quests)) return;
  for (const quest of world.quests) {
    const person = wantedPersonForActiveBounty(quest);
    if (!person) continue;
    const targetCharacterId = `wanted-${person.key}`;
    if (!quest.targetKey) quest.targetKey = person.key;
    if (!quest.targetCharacterId) quest.targetCharacterId = targetCharacterId;
    const existing = characters[targetCharacterId];
    if (!existing) {
      characters[targetCharacterId] = wantedCodexEntry(person);
      continue;
    }
    if (!existing.kind) existing.kind = "wanted";
    if (typeof existing.portraitKey !== "string" || !existing.portraitKey.trim()) {
      existing.portraitKey = `wanted:${person.key}`;
    }
  }
}

// Merge any codex entries that exist in the fresh initial state but are
// missing from a loaded campaign — races, professions, named NPCs, etc.
// added to initial-state.js after the campaign was created. The player's
// own discoveries are preserved (we only add what's missing). Mutates +
// returns a new state object; safe to call repeatedly.
export function migrateCodex(state) {
  if (!state?.world) return state;
  const next = JSON.parse(JSON.stringify(state));
  if (next.activeCombatSession === undefined) next.activeCombatSession = null;
  if (next.pendingCombatDirective === undefined) next.pendingCombatDirective = null;
  if (next.pendingTravelCombat === undefined) next.pendingTravelCombat = null;
  if (next.productionCombatSequence === undefined) next.productionCombatSequence = 0;
  if (next.combatSettlementReceipts === undefined) next.combatSettlementReceipts = [];
  if (!Array.isArray(next.presentationJobs)) next.presentationJobs = [];
  if (next.pendingReward === undefined) next.pendingReward = null;
  // Backfilled in two steps because a campaign can predate either the sidecar or just its
  // combat slot: the build migration shipped first and left the slot for this one.
  if (!hasMechanicsSidecar(next)) next.mechanics = emptyMechanicsSidecar();
  if (!next.mechanics.combat) next.mechanics = { ...next.mechanics, combat: emptyCombatMechanics() };
  if (
    !Number.isSafeInteger(next.productionCombatSequence)
    || next.productionCombatSequence < 0
    || !Array.isArray(next.combatSettlementReceipts)
  ) {
    throw new RangeError("Invalid production combat campaign lineage.");
  }
  migratePortraitOverrides(next);
  next.world = migrateLegacyWorldLocation(next.world);
  if (Array.isArray(next.turns)) {
    next.turns = next.turns.map((turn) => turn?.world?.place
      ? { ...turn, world: migrateLegacyWorldLocation(turn.world) }
      : turn);
  }
  next.memories = normalizeMemoryBank(next.memories);
  next.narratorSettings = normalizeNarratorSettings(next.narratorSettings);
  if (!next.world.continentId) next.world.continentId = CONTINENT.id;
  if (!next.world.seed) next.world.seed = DEFAULT_WORLD_SEED;
  next.world = migrateWorldVersions(next.world);
  if (Array.isArray(next.pools?.tiles)) {
    next.pools.tiles = next.pools.tiles.map(compactProceduralTileCollection);
  }
  if (Array.isArray(next.turns)) {
    next.turns = next.turns.map((turn) => {
      if (!turn?.world) return turn;
      supportedWorldVersions(turn.world);
      return {
        ...turn,
        world: {
          ...turn.world,
          continentId: turn.world.continentId || next.world.continentId,
          seed: turn.world.seed || next.world.seed,
          geographyVersion: WORLD_GEOGRAPHY_VERSION,
          generatorVersion: WORLD_GENERATOR_VERSION,
        },
      };
    });
  }
  // Location migration is independent of Codex hydration. Very old or
  // deliberately minimal saves may have no Codex, but must still leave the
  // retired place graph and rejoin the one world map.
  if (!next.world.codex) return migrateProgressionState(next);
  const fresh = makeInitialState();
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
  backfillActiveBountyTargets(next.world);
  // One-time cleanup for saves made before the creation dedup fix: a self-fact
  // could be filed twice. Collapse every character's knowledge to unique facts.
  for (const ch of Object.values(ownCodex.characters || {})) {
    if (ch && Array.isArray(ch.knows)) {
      ch.knows = [...new Set(ch.knows.filter((f) => typeof f === "string" && f.trim()))];
    }
  }
  // Reveal Whitemarch on every load — even saves made before this migration
  // existed get the city's full footprint added to their seen set. The
  // player has lived in this city; the streetlamps are lit; fog of war
  // inside the wall is just friction. (Hexes outside the wall stay fogged
  // until walked.)
  if (next.world.seen) next.world.seen = revealWhitemarch(next.world.seen);
  // Weight + riding (added with mounts): back-fill the per-character fields so old
  // saves load. carryCapacityMax for the player is (re)derived in App's load path.
  // Pass A/B/C fields (gender, attractiveness, age, agingMode, lifespanMultiplier):
  // back-fill defaults so an older save's codex doesn't trip the new engine paths.
  // Crucially, a saved character whose `age` is still a freeform STRING (pre-Pass C)
  // would break ageOne's `(cur.age || 0) + 1` arithmetic — coerce to null so the
  // aging engine treats them as un-aged until the narrator next refers to them.
  for (const ch of Object.values(ownCodex.characters || {})) {
    if (!ch) continue;
    if (typeof ch.bodyWeight !== "number") ch.bodyWeight = bodyWeightForRace(ch.race);
    if (ch.ridingOn === undefined) ch.ridingOn = null;
    if (!Array.isArray(ch.riders)) ch.riders = [];
    if (typeof ch.age === "string") ch.age = null;
    if (ch.agingMode === undefined) ch.agingMode = "mortal";
    if (ch.lifespanMultiplier === undefined) ch.lifespanMultiplier = 1.0;
    if (ch.gender === undefined) ch.gender = null;
    if (typeof ch.attractiveness === "string") ch.attractiveness = null;
  }
  // Old bug back-fill: an improvised companion recruited purely via narration
  // (discoveries.characters, no fixed-roster template) could join the party
  // before the engine forced a stat default on a thin entry — leaving them
  // with no `attributes` and an all-zero Company sheet. Repair any such
  // party member found in an existing save.
  for (const id of (next.party || [])) {
    const ch = ownCodex.characters?.[id];
    if (!ch || (ch.attributes && Object.keys(ch.attributes).length > 0)) continue;
    ch.attributes = estimateAttributesFor(ch);
    if (ch.resolve === undefined) ch.resolve = resolvePoolForMind(ch.attributes.mind);
    if (ch.resolveMax === undefined) ch.resolveMax = resolvePoolForMind(ch.attributes.mind);
    if (!ch.needs) ch.needs = { hunger: 70, thirst: 75, sleep: 70 };
  }
  // Creation records historically held the full identity only on the Codex
  // wanderer while the dossier read from state.character. Pull those fields
  // forward once so older campaigns gain the same profession and portrait
  // resolution as newly-created characters.
  const wanderer = ownCodex.characters?.wanderer;
  if (next.character && wanderer) {
    const legacyArchetype = wanderer["sub" + "class"];
    if (next.character.archetype == null && legacyArchetype != null) next.character.archetype = legacyArchetype;
    for (const key of [
      "profession", "archetype", "origin", "gender", "age", "agingMode", "lifespanMultiplier",
      "attractiveness", "appearance", "base_appearance", "templateId", "portraitKey",
      "profile",
    ]) {
      if (next.character[key] == null && wanderer[key] != null) next.character[key] = wanderer[key];
    }
  }
  // Saves created before the world-roster feature gain the authored cast above,
  // but a template-selected protagonist must remain the sole instance of that
  // person. Clear a stale tracking target at the same time.
  const selectedTemplateId = next.character?.templateId ?? wanderer?.templateId ?? null;
  ownCodex.characters = withoutSelectedPlayableCharacter(ownCodex.characters, selectedTemplateId);
  if (next.world.trackedCharacterId && !ownCodex.characters[next.world.trackedCharacterId]) {
    next.world.trackedCharacterId = null;
  }
  // Per-party-member inventory back-fill: companions/bonded/mounts gain a personal
  // `carried` pack (and, for companions, a personal coin pouch — bonded captives
  // and mounts pool with the player). The wanderer already has the canonical
  // pack/coins on state, so they're excluded; dormant ex-party-members keep their
  // existing shape and get back-filled on re-recruit. Also filter phantom `worn`
  // ids — pre-catalog saves may carry thematic strings that aren't real items,
  // which would crash a paper-doll renderer.
  for (const ch of Object.values(ownCodex.characters || {})) {
    if (!ch || ch.id === "wanderer") continue;
    const isPartyShape = ch.kind === "companion" || ch.kind === "bonded" || ch.kind === "mount";
    if (!isPartyShape) continue;
    if (!ch.inventory) {
      ch.inventory = { carried: [], coins: ch.kind === "companion" ? { copper: 0, silver: 0, gold: 0 } : null };
    }
    if (typeof ch.carryCapacityMax !== "number") ch.carryCapacityMax = carryCapacityFor(ch);
    if (typeof ch.overburdened !== "boolean") ch.overburdened = false;
    if (typeof ch.carryBonus !== "number") ch.carryBonus = 0;
    if (Array.isArray(ch.worn)) ch.worn = ch.worn.filter((id) => !!itemTemplate(id));
  }
  return migrateProgressionState(next);
}
