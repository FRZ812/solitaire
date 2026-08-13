// Level-free combat archetypes for a new campaign.
//
// These are mechanical identities, not pre-authored people. A player chooses a way to
// fight, a face, and their own name. Power differences come from fixed base traits plus
// canonical worn equipment; there is no level input and no legacy template identity.

import { itemTemplate } from "../../data/catalog.js";
import { getFusion, getTrait } from "./traits.js";
import { startingPackage } from "./starting-packages.js";
import { describeTowItems, getTowStartItemGrant } from "./start-items.js";

function archetype({
  id,
  name,
  role,
  power,
  professionId,
  traitRank,
  portraitId,
  tagline,
  playstyle,
  attention,
  attributes,
  gear,
  color,
}) {
  const pkg = startingPackage(professionId);
  if (!pkg) throw new TypeError(`unknown-archetype-profession:${professionId}`);
  return Object.freeze({
    id,
    name,
    role,
    power,
    professionId,
    portraitId,
    tagline,
    playstyle,
    attention,
    color,
    attributes: Object.freeze({ ...attributes }),
    gear: Object.freeze([...gear]),
    build: Object.freeze({
      traits: Object.freeze({ [pkg.trait.id]: traitRank }),
      skills: Object.freeze(pkg.skills.map((skill) => skill.id)),
      runes: Object.freeze([]),
    }),
  });
}

export const STARTING_ARCHETYPES = Object.freeze([
  archetype({
    id: "ironbound",
    name: "Ironbound",
    role: "Line holder",
    power: "Grounded",
    professionId: "fighter",
    traitRank: 2,
    portraitId: "frontier",
    tagline: "Meet the blow, keep your feet, answer with steel.",
    playstyle: "The clearest defensive start: Block dangerous intent, then punish the opening.",
    attention: "Low",
    attributes: { body: 4, reflex: 3, vigor: 4, mind: 2, wit: 3, presence: 2 },
    gear: ["arming-sword", "chain-shirt", "round-shield", "traveling-cloak", "marching-boots"],
    color: "#d8a55e",
  }),
  archetype({
    id: "wildstrider",
    name: "Wildstrider",
    role: "Ranged skirmisher",
    power: "Grounded",
    professionId: "ranger",
    traitRank: 2,
    portraitId: "greenway",
    tagline: "Read the field once. Make the first arrow count.",
    playstyle: "Accurate pressure with light-footed defence and small bursts of extra tempo.",
    attention: "Medium",
    attributes: { body: 2, reflex: 4, vigor: 3, mind: 2, wit: 4, presence: 3 },
    gear: ["hunting-bow", "rangers-leathers", "traveling-cloak", "marching-boots"],
    color: "#91ae76",
  }),
  archetype({
    id: "gloamknife",
    name: "Gloamknife",
    role: "Evasive killer",
    power: "Grounded",
    professionId: "rogue",
    traitRank: 2,
    portraitId: "quiet",
    tagline: "A missed blow is an invitation.",
    playstyle: "High critical pressure, emergency evasion, and the fastest grounded opening.",
    attention: "Medium",
    attributes: { body: 3, reflex: 4, vigor: 2, mind: 2, wit: 4, presence: 3 },
    gear: ["twin-daggers", "leather-jerkin", "traveling-cloak", "marching-boots"],
    color: "#9f91bd",
  }),
  archetype({
    id: "dawnwarden",
    name: "Dawnwarden",
    role: "Warded sustainer",
    power: "Heroic",
    professionId: "cleric",
    traitRank: 3,
    portraitId: "sunward",
    tagline: "Carry mercy in one hand and the morning in the other.",
    playstyle: "Strong protection and recovery, with Metalize already forged into Dawnward.",
    attention: "Medium",
    attributes: { body: 3, reflex: 2, vigor: 4, mind: 4, wit: 2, presence: 4 },
    gear: ["dawnward-mace", "dragonscale-mail", "heater-shield", "silver-amulet"],
    color: "#e5c56a",
  }),
  archetype({
    id: "ashcaller",
    name: "Ashcaller",
    role: "Burn artillery",
    power: "Heroic",
    professionId: "wizard",
    traitRank: 3,
    portraitId: "ember",
    tagline: "Heat is only another shape of certainty.",
    playstyle: "Builds Burn and Doom quickly, but survives by timing control and guard skills.",
    attention: "High",
    attributes: { body: 2, reflex: 3, vigor: 3, mind: 5, wit: 4, presence: 2 },
    gear: ["oak-staff", "homespun-robe", "scholars-circlet", "warding-charm"],
    color: "#d77a57",
  }),
  archetype({
    id: "oathforged",
    name: "Oathforged",
    role: "Unbroken protector",
    power: "Heroic",
    professionId: "paladin",
    traitRank: 3,
    portraitId: "oath",
    tagline: "Stand where the world is trying to break.",
    playstyle: "A fortress build whose relic shield carries the Intangible fusion from turn one.",
    attention: "Medium",
    attributes: { body: 4, reflex: 2, vigor: 4, mind: 3, wit: 2, presence: 4 },
    gear: ["kingsguard-blade", "dragonscale-mail", "dragonbone-bulwark", "silver-amulet"],
    color: "#8db2c6",
  }),
  archetype({
    id: "night-sovereign",
    name: "Night Sovereign",
    role: "Fusion assassin",
    power: "Mythic",
    professionId: "rogue",
    traitRank: 4,
    portraitId: "night",
    tagline: "Be gone before the wound understands it is open.",
    playstyle: "Rogue and Breakdown begin forged: conceal, expose, then end a target decisively.",
    attention: "High",
    attributes: { body: 3, reflex: 5, vigor: 3, mind: 3, wit: 5, presence: 3 },
    gear: ["nightfang-dagger", "phantom-leathers", "traveling-cloak", "marching-boots"],
    color: "#766fa5",
  }),
  archetype({
    id: "wyrm-ascendant",
    name: "Wyrm Ascendant",
    role: "Apex juggernaut",
    power: "Ascendant",
    professionId: "barbarian",
    traitRank: 5,
    portraitId: "wyrm",
    tagline: "Walk small only because the road was built for mortals.",
    playstyle: "An intentionally overwhelming start: divine equipment and several complete fusions.",
    attention: "Medium",
    attributes: { body: 5, reflex: 4, vigor: 5, mind: 3, wit: 3, presence: 5 },
    gear: ["wyrmscale-greatblade", "aegis-plate", "crown-dominion-helm", "vigil-mantle-cloak", "heart-world-amulet"],
    color: "#d99550",
  }),
]);

export const STARTING_VISAGES = Object.freeze([
  Object.freeze({
    id: "frontier", label: "Frontier", portraitKey: "template:sellsword",
    race: "human", subrace: null, origin: "west", gender: "male", age: 32,
    appearance: Object.freeze({ skin: "weathered tan", hair: "dark brown", eyes: "brown", build: "broad and scarred", facial_hair: "short beard" }),
    baseAppearance: "A broad-shouldered frontier traveller, weathered by road and wind, moving with a veteran's economy.",
  }),
  Object.freeze({
    id: "greenway", label: "Greenway", portraitKey: "template:ranger",
    race: "elf", subrace: "wood", origin: "elf", gender: "male", age: 95,
    appearance: Object.freeze({ skin: "olive", hair: "chestnut, braided", eyes: "green", build: "lean and quick" }),
    baseAppearance: "A lean wood-elf with chestnut hair bound back, green eyes, and the quiet balance of a life outdoors.",
  }),
  Object.freeze({
    id: "sunward", label: "Sunward", portraitKey: "template:devout",
    race: "human", subrace: null, origin: "south", gender: "female", age: 38,
    appearance: Object.freeze({ skin: "deep brown", hair: "black, cropped under a head-wrap", eyes: "dark brown", build: "sturdy" }),
    baseAppearance: "A sturdy southern traveller with deep-brown skin, cropped black hair, and a steadiness that quiets a room.",
  }),
  Object.freeze({
    id: "ember", label: "Ember", portraitKey: "template:hedge-mage",
    race: "human", subrace: null, origin: "central", gender: "female", age: 28,
    appearance: Object.freeze({ skin: "fair", hair: "brown, unbound", eyes: "hazel", build: "slight" }),
    baseAppearance: "A slight, keen-eyed traveller with unbound brown hair, hazel eyes, and permanently ink-marked fingers.",
  }),
  Object.freeze({
    id: "oath", label: "Oath", portraitKey: "template:champion-paladin",
    race: "human", subrace: null, origin: "south", gender: "female", age: 35,
    appearance: Object.freeze({ skin: "deep brown", hair: "black curls, silver-threaded", eyes: "amber", build: "tall and straight-backed" }),
    baseAppearance: "A tall southern woman with silver-threaded black curls, amber eyes, and an authority that reads as shelter.",
  }),
  Object.freeze({
    id: "quiet", label: "Quiet", portraitKey: "template:cutthroat",
    race: "human", subrace: null, origin: "east", gender: "male", age: 27,
    appearance: Object.freeze({ skin: "ivory", hair: "black, long and bound", eyes: "dark", build: "lean" }),
    baseAppearance: "A lean eastern traveller with black hair bound back and a stillness that makes every movement deliberate.",
  }),
  Object.freeze({
    id: "night", label: "Night", portraitKey: "template:shadowblade",
    race: "human", subrace: null, origin: "east", gender: "male", age: 40,
    appearance: Object.freeze({ skin: "ivory", hair: "black", eyes: "dark", build: "unremarkable", facial_hair: "none" }),
    baseAppearance: "A deliberately forgettable eastern traveller: dark-eyed, clean-shaven, and composed entirely of economy and stillness.",
  }),
  Object.freeze({
    id: "wyrm", label: "Wyrm", portraitKey: "template:dragon-ascendant",
    race: "drakeborn", subrace: null, origin: "drakeborn", gender: "female", age: 34,
    appearance: Object.freeze({ skin: "scaled bronze", hair: "molten gold", eyes: "furnace-bright", build: "tall", marks: "ridged scale along jaw and forearms" }),
    baseAppearance: "A tall bronze-scaled drakeborn with molten-gold hair, furnace-bright eyes, and the stillness of an apex predator.",
  }),
]);

const ARCHETYPE_BY_ID = new Map(STARTING_ARCHETYPES.map((entry) => [entry.id, entry]));
const VISAGE_BY_ID = new Map(STARTING_VISAGES.map((entry) => [entry.id, entry]));

export function getStartingArchetype(id) {
  return typeof id === "string" ? ARCHETYPE_BY_ID.get(id) || null : null;
}

export function getStartingVisage(id) {
  return typeof id === "string" ? VISAGE_BY_ID.get(id) || null : null;
}

export function createDefaultArchetypeDraft() {
  const selected = STARTING_ARCHETYPES[0];
  return { archetypeId: selected.id, visageId: selected.portraitId, name: "" };
}

export function normalizeArchetypeDraft(input = {}) {
  const archetype_ = getStartingArchetype(input.archetypeId) || STARTING_ARCHETYPES[0];
  const visage = getStartingVisage(input.visageId) || getStartingVisage(archetype_.portraitId) || STARTING_VISAGES[0];
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ").slice(0, 48) : "";
  return { archetypeId: archetype_.id, visageId: visage.id, name };
}

export function archetypeItemRows(archetypeId) {
  const selected = getStartingArchetype(archetypeId);
  return selected ? describeTowItems(selected.gear) : [];
}

export function archetypeFusionIds(archetypeId) {
  const ids = new Set();
  for (const row of archetypeItemRows(archetypeId)) {
    for (const id of row.fusions) if (getFusion(id)) ids.add(id);
  }
  return [...ids];
}

export function characterSetupForArchetype(draft) {
  const normalized = normalizeArchetypeDraft(draft);
  const selected = getStartingArchetype(normalized.archetypeId);
  const visage = getStartingVisage(normalized.visageId);
  if (!selected || !visage || normalized.name.length === 0) return null;

  return {
    name: normalized.name,
    bond: selected.tagline,
    profession: selected.professionId,
    archetype: selected.id,
    combatArchetypeId: selected.id,
    progressionModel: "tow-archetype",
    race: visage.race,
    subrace: visage.subrace,
    origin: visage.origin,
    gender: visage.gender,
    age: visage.age,
    agingMode: "mortal",
    lifespanMultiplier: 1,
    attractiveness: 6,
    attributes: { ...selected.attributes },
    appearance: { ...visage.appearance },
    base_appearance: visage.baseAppearance,
    portraitKey: visage.portraitKey,
    abilities: [],
    items: selected.gear.map((itemId) => ({ itemId, quantity: 1, worn: true })),
    coins: selected.power === "Ascendant" ? { gold: 12, silver: 0 } : { gold: 2, silver: 5 },
    knows: [
      `I entered Whitemarch as ${normalized.name}, carrying the ${selected.name} combat archetype.`,
      "My combat power comes from my chosen equipment and Tower of Winter build, not a character level.",
    ],
    profile: {
      source: "tow-archetype-start",
      archetypeId: selected.id,
      archetypeName: selected.name,
      power: selected.power,
      role: selected.role,
    },
    // Kept at the compatibility floor for legacy world systems. It is not surfaced as a
    // TOW power source and never changes the selected combat build.
    level: 1,
  };
}

export function invalidStartingArchetypes() {
  const invalid = [];
  for (const selected of STARTING_ARCHETYPES) {
    if (!getStartingVisage(selected.portraitId)) invalid.push(`${selected.id}:unknown-portrait`);
    if (!startingPackage(selected.professionId)) invalid.push(`${selected.id}:unknown-profession`);
    for (const [traitId, rank] of Object.entries(selected.build.traits)) {
      if (!getTrait(traitId) || !Number.isInteger(rank) || rank < 1 || rank > 7) {
        invalid.push(`${selected.id}:invalid-trait:${traitId}`);
      }
    }
    for (const itemId of selected.gear) {
      if (!itemTemplate(itemId)) invalid.push(`${selected.id}:unknown-item:${itemId}`);
      if (!getTowStartItemGrant(itemId) && itemTemplate(itemId)?.tier !== "common") {
        // Ordinary clothing may be presentation-only; distinctive non-common gear must say
        // what it does in TOW so the UI never advertises a silent power item.
        invalid.push(`${selected.id}:unmapped-power-item:${itemId}`);
      }
    }
  }
  return invalid;
}
