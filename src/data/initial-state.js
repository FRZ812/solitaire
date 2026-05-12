import { HANDCRAFTED } from "./handcrafted-tiles.js";
import { RUMORED } from "./rumored.js";
import { FABLED } from "./fabled.js";
import { RIVERS } from "./rivers.js";
import { computeSightFrom, computeSightFromRadius } from "../engine/world.js";

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
      resolve: 4, resolveMax: 6,
      conditions: ["Wet"],
      bond: "A small wooden bird carved by your sister, who vanished seven years ago.",
      attributes: { body: 2, reflex: 3, vigor: 2, mind: 2, wit: 4, presence: 1 },
      needs: { hunger: 60, thirst: 75, sleep: 70 },
      inventory: {
        carried: [{ itemId: "wooden-bird", quantity: 1 }],
        coins: { copper: 8, silver: 3, gold: 0 },
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
            origin: "central",
            age: "around thirty",
            attractiveness: "weathered, not unhandsome",
            appearance: {
              skin: "weathered tan",
              hair: "dark brown, cropped travel-short",
              eyes: "hazel",
              build: "lean and road-hardened",
              facial_hair: null,
              marks: "a small healed scar near the right temple",
            },
            base_appearance: "Lean and road-hardened. Weathered tan, dark brown hair cropped short. Hazel eyes. A small old scar near the right temple.",
            description: "You. A traveler bearing a wooden bird and a long sorrow.",
            attributes: { body: 2, reflex: 3, vigor: 2, mind: 2, wit: 4, presence: 1 },
            worn: ["wool-cloak", "linen-tunic", "leather-boots"],
            knows: [
              "My sister carved this wooden bird before she vanished seven years ago.",
              "I came to the Drowned Inn out of the rain on the afternoon of Day 3.",
            ],
          },
        },
        races: {
          "human": { id: "human", name: "Human", appearance: "Variable. Cardinal cultures shape build, complexion, hair, and dress — northerners are tall and fair; easterners pale and lean; southerners deep-skinned; westerners weathered olive; central folk mixed.", description: "The dominant folk of the region. Visually distinct by cardinal origin (north, east, south, west, central).", common: true },
        },
        professions: {
          "innkeeper": { id: "innkeeper", name: "Innkeeper", description: "Keeper of an inn or tavern.", common: true },
          "farmer":    { id: "farmer",    name: "Farmer",    description: "Tiller of land, raiser of stock.", common: true },
          "peddler":   { id: "peddler",   name: "Peddler",   description: "A traveling trader of small goods.", common: true },
        },
        items: {
          "wooden-bird":   { id: "wooden-bird",   name: "Wooden Bird",  appearance: "A small dark-stained bird the length of a thumb. The right wing is split where you gripped it too hard once.", description: "Carved by your sister.", kind: "trinket" },
          "wool-cloak":    { id: "wool-cloak",    name: "Wool Cloak",   appearance: "Heavy charcoal-grey wool, dark across the shoulders from the rain. Frayed hem.", description: "A traveler's cloak.", kind: "clothing" },
          "linen-tunic":   { id: "linen-tunic",   name: "Linen Tunic",  appearance: "Undyed linen, the colour of old milk. Mended at one elbow.", description: "A plain undershirt.", kind: "clothing" },
          "leather-boots": { id: "leather-boots", name: "Leather Boots",appearance: "Cracked dark leather. The left sole is wearing through.", description: "Worn but serviceable.", kind: "clothing" },
        },
        spells: {},
        skills: {},
      },
    },
    beats: [{
      id: "b0", type: "narration",
      content: "Rain whispers against warped shutters. The innkeeper, a stooped woman with ink-stained fingers, slides a pewter cup toward you without looking up. The hooded figure in the corner has been watching you for the better part of an hour.",
      timeStamp: "13:30",
    }],
    apiHistory: [],
  };
}
