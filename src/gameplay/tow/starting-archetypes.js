// Authored, level-free starting characters for a new campaign.
//
// Every selection is a complete person. Name, portrait, history, equipment, traits,
// skills, and starting fusions travel together; the player chooses a character rather
// than assembling one. Power differences come from the fixed worn equipment and TOW
// build, never from a character-level selector.

import { itemTemplate } from "../../data/catalog.js";
import { getFusion, getTrait } from "./traits.js";
import { startingPackage } from "./starting-packages.js";
import { describeTowItems, getTowStartItemGrant } from "./start-items.js";

function authoredCharacter({
  id,
  name,
  epithet,
  summary,
  history,
  portraitKey,
  race,
  subrace = null,
  origin,
  gender,
  age,
  appearance,
  baseAppearance,
}) {
  return Object.freeze({
    id,
    name,
    epithet,
    summary,
    history,
    portraitKey,
    race,
    subrace,
    origin,
    gender,
    age,
    appearance: Object.freeze({ ...appearance }),
    baseAppearance,
  });
}

function archetype({
  id,
  name,
  role,
  power,
  professionId,
  traitRank,
  tagline,
  playstyle,
  attention,
  attributes,
  gear,
  color,
  character,
}) {
  const pkg = startingPackage(professionId);
  if (!pkg) throw new TypeError(`unknown-archetype-profession:${professionId}`);
  return Object.freeze({
    id,
    name,
    role,
    power,
    professionId,
    tagline,
    playstyle,
    attention,
    color,
    character,
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
    tagline: "Meet the blow, keep your feet, answer with steel.",
    playstyle: "The clearest defensive start: Block dangerous intent, then punish the opening.",
    attention: "Low",
    attributes: { body: 4, reflex: 3, vigor: 4, mind: 2, wit: 3, presence: 2 },
    gear: ["arming-sword", "chain-shirt", "round-shield", "traveling-cloak", "marching-boots"],
    color: "#d5a85f",
    character: authoredCharacter({
      id: "garran-holt",
      name: "Garran Holt",
      epithet: "The Marchwall",
      summary: "A former road captain who measures victory by who is still standing behind him.",
      history: "Garran held the Eastwatch breach long enough for an entire market ward to escape. He left the captaincy when his lords called the dead an acceptable cost, but he never laid down the shield.",
      portraitKey: "template:sellsword",
      race: "human",
      origin: "west",
      gender: "male",
      age: 36,
      appearance: { skin: "weathered tan", hair: "dark brown", eyes: "brown", build: "broad and scarred", facial_hair: "short beard" },
      baseAppearance: "A broad-shouldered march veteran with road-worn armour, a short beard, and the economical stillness of someone used to holding a line.",
    }),
  }),
  archetype({
    id: "wildstrider",
    name: "Wildstrider",
    role: "Ranged skirmisher",
    power: "Grounded",
    professionId: "ranger",
    traitRank: 2,
    tagline: "Read the field once. Make the first arrow count.",
    playstyle: "Accurate pressure with light-footed defence and small bursts of extra tempo.",
    attention: "Medium",
    attributes: { body: 2, reflex: 4, vigor: 3, mind: 2, wit: 4, presence: 3 },
    gear: ["hunting-bow", "rangers-leathers", "traveling-cloak", "marching-boots"],
    color: "#8cab72",
    character: authoredCharacter({
      id: "lior-fen",
      name: "Lior Fen",
      epithet: "The Far-Eyed",
      summary: "A greenway outrider who can read an ambush in one bent blade of grass.",
      history: "Liora once guided caravans through roads that had vanished from every map. She came to Whitemarch following a trail of black-fletched arrows that should belong to no living hunter.",
      portraitKey: "template:ranger",
      race: "elf",
      subrace: "wood",
      origin: "elf",
      gender: "male",
      age: 95,
      appearance: { skin: "olive", hair: "chestnut, braided", eyes: "green", build: "lean and quick" },
      baseAppearance: "A lean wood-elf with chestnut hair bound back, green eyes, and the quiet balance of a life spent reading the wild.",
    }),
  }),
  archetype({
    id: "gloamknife",
    name: "Gloamknife",
    role: "Evasive killer",
    power: "Grounded",
    professionId: "rogue",
    traitRank: 2,
    tagline: "A missed blow is an invitation.",
    playstyle: "High critical pressure, emergency evasion, and the fastest grounded opening.",
    attention: "Medium",
    attributes: { body: 3, reflex: 4, vigor: 2, mind: 2, wit: 4, presence: 3 },
    gear: ["twin-daggers", "leather-jerkin", "traveling-cloak", "marching-boots"],
    color: "#9487b1",
    character: authoredCharacter({
      id: "ren-kairo",
      name: "Ren Kairo",
      epithet: "The Unseen Hand",
      summary: "A precise infiltrator who survives by making every enemy commit first.",
      history: "Ren was raised inside an eastern courier house whose sealed messages changed wars. When the house was erased in one night, he kept its final ledger—and the names of everyone who paid for the fire.",
      portraitKey: "template:cutthroat",
      race: "human",
      origin: "east",
      gender: "male",
      age: 29,
      appearance: { skin: "ivory", hair: "black, long and bound", eyes: "dark", build: "lean" },
      baseAppearance: "A lean eastern traveller with black hair bound back and a stillness that makes every movement feel decided in advance.",
    }),
  }),
  archetype({
    id: "dawnwarden",
    name: "Dawnwarden",
    role: "Warded sustainer",
    power: "Heroic",
    professionId: "cleric",
    traitRank: 3,
    tagline: "Carry mercy in one hand and the morning in the other.",
    playstyle: "Strong protection and recovery, with Metalize already forged into Dawnward.",
    attention: "Medium",
    attributes: { body: 3, reflex: 2, vigor: 4, mind: 4, wit: 2, presence: 4 },
    gear: ["dawnward-mace", "dragonscale-mail", "heater-shield", "silver-amulet"],
    color: "#e0bf67",
    character: authoredCharacter({
      id: "samira-avel",
      name: "Samira Avel",
      epithet: "The Dawn-Bearer",
      summary: "A battlefield healer whose mercy is protected by tempered steel and a harder oath.",
      history: "Samira walked out of the Sunscar plague camps carrying a book of the names she could not save. She has crossed half of Avarra since, answering every new disaster before a temple can decide whether it is profitable.",
      portraitKey: "template:devout",
      race: "human",
      origin: "south",
      gender: "female",
      age: 38,
      appearance: { skin: "deep brown", hair: "black, cropped under a head-wrap", eyes: "dark brown", build: "sturdy" },
      baseAppearance: "A sturdy southern traveller with deep-brown skin, cropped black hair, and a steadiness that quiets a room before she speaks.",
    }),
  }),
  archetype({
    id: "ashcaller",
    name: "Ashcaller",
    role: "Burn artillery",
    power: "Heroic",
    professionId: "wizard",
    traitRank: 3,
    tagline: "Heat is only another shape of certainty.",
    playstyle: "Builds Burn and Doom quickly, but survives by timing control and guard skills.",
    attention: "High",
    attributes: { body: 2, reflex: 3, vigor: 3, mind: 5, wit: 4, presence: 2 },
    gear: ["oak-staff", "homespun-robe", "scholars-circlet", "warding-charm"],
    color: "#c96f53",
    character: authoredCharacter({
      id: "ysolda-marr",
      name: "Ysolda Marr",
      epithet: "The Cinder Scholar",
      summary: "A renegade natural philosopher who turns controlled ruin into an exact science.",
      history: "Ysolda burned her own thesis when the Glass Spire demanded it become a weapon. The formula survived in her memory, and now three courts, two guilds, and something beneath the Mire want it back.",
      portraitKey: "template:hedge-mage",
      race: "human",
      origin: "central",
      gender: "female",
      age: 30,
      appearance: { skin: "fair", hair: "brown, unbound", eyes: "hazel", build: "slight" },
      baseAppearance: "A slight, keen-eyed scholar with unbound brown hair, hazel eyes, and fingers permanently marked by ink and soot.",
    }),
  }),
  archetype({
    id: "oathforged",
    name: "Oathforged",
    role: "Unbroken protector",
    power: "Heroic",
    professionId: "paladin",
    traitRank: 3,
    tagline: "Stand where the world is trying to break.",
    playstyle: "A fortress build whose relic shield carries the Intangible fusion from turn one.",
    attention: "Medium",
    attributes: { body: 4, reflex: 2, vigor: 4, mind: 3, wit: 2, presence: 4 },
    gear: ["kingsguard-blade", "dragonscale-mail", "dragonbone-bulwark", "silver-amulet"],
    color: "#7ea8bd",
    character: authoredCharacter({
      id: "caldra-vey",
      name: "Caldra Vey",
      epithet: "The Unbroken Oath",
      summary: "A disgraced royal guard who still keeps the promise her vanished king abandoned.",
      history: "Caldra refused the order that opened her city's gates to a purge. Her crest was broken and her name struck from the rolls; the people she carried out remember both better than the crown does.",
      portraitKey: "template:champion-paladin",
      race: "human",
      origin: "south",
      gender: "female",
      age: 35,
      appearance: { skin: "deep brown", hair: "black curls, silver-threaded", eyes: "amber", build: "tall and straight-backed" },
      baseAppearance: "A tall southern woman with silver-threaded black curls, amber eyes, and an authority that reads as shelter rather than command.",
    }),
  }),
  archetype({
    id: "night-sovereign",
    name: "Night Sovereign",
    role: "Fusion assassin",
    power: "Mythic",
    professionId: "rogue",
    traitRank: 4,
    tagline: "Be gone before the wound understands it is open.",
    playstyle: "Rogue and Breakdown begin forged: conceal, expose, then end a target decisively.",
    attention: "High",
    attributes: { body: 3, reflex: 5, vigor: 3, mind: 3, wit: 5, presence: 3 },
    gear: ["nightfang-dagger", "phantom-leathers", "traveling-cloak", "marching-boots"],
    color: "#7770a9",
    character: authoredCharacter({
      id: "sable-ren",
      name: "Sable Ren",
      epithet: "The Veiled Crown",
      summary: "The last strategist of a murdered shadow court, carrying two forbidden fusions.",
      history: "Sable ruled no land, only the hidden agreements that kept five eastern houses from open war. Someone killed every other signatory in a single winter. He came west to learn which crown bought the silence.",
      portraitKey: "template:shadowblade",
      race: "human",
      origin: "east",
      gender: "male",
      age: 40,
      appearance: { skin: "ivory", hair: "black", eyes: "dark", build: "unremarkable", facial_hair: "none" },
      baseAppearance: "A deliberately forgettable eastern traveller: dark-eyed, clean-shaven, and composed entirely of economy and stillness.",
    }),
  }),
  archetype({
    id: "wyrm-ascendant",
    name: "Wyrm Ascendant",
    role: "Apex juggernaut",
    power: "Ascendant",
    professionId: "barbarian",
    traitRank: 5,
    tagline: "Walk small only because the road was built for mortals.",
    playstyle: "An intentionally overwhelming start: divine equipment and several complete fusions.",
    attention: "Medium",
    attributes: { body: 5, reflex: 4, vigor: 5, mind: 3, wit: 3, presence: 5 },
    gear: ["wyrmscale-greatblade", "aegis-plate", "crown-dominion-helm", "vigil-mantle-cloak", "heart-world-amulet"],
    color: "#cf884a",
    character: authoredCharacter({
      id: "vaeraxa",
      name: "Vaeraxa",
      epithet: "Heir of the First Flame",
      summary: "A drakeborn claimant wearing a dead empire's regalia and power enough to justify it.",
      history: "Vaeraxa woke beneath the Drakeholt with a crown that answers only to her blood and no memory of who sealed her there. Every relic she carries insists she once ruled; every history in Whitemarch insists she never existed.",
      portraitKey: "template:dragon-ascendant",
      race: "drakeborn",
      origin: "drakeborn",
      gender: "female",
      age: 34,
      appearance: { skin: "scaled bronze", hair: "molten gold", eyes: "furnace-bright", build: "tall", marks: "ridged scale along jaw and forearms" },
      baseAppearance: "A tall bronze-scaled drakeborn with molten-gold hair, furnace-bright eyes, and the stillness of an apex predator.",
    }),
  }),
]);

const ARCHETYPE_BY_ID = new Map(STARTING_ARCHETYPES.map((entry) => [entry.id, entry]));

export function getStartingArchetype(id) {
  return typeof id === "string" ? ARCHETYPE_BY_ID.get(id) || null : null;
}

export function createDefaultArchetypeDraft() {
  return { archetypeId: STARTING_ARCHETYPES[0].id, preview: false };
}

export function normalizeArchetypeDraft(input = {}) {
  const selected = getStartingArchetype(input.archetypeId) || STARTING_ARCHETYPES[0];
  return { archetypeId: selected.id, preview: input.preview === true };
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
  const character = selected?.character;
  if (!selected || !character) return null;

  return {
    name: character.name,
    bond: selected.tagline,
    profession: selected.professionId,
    archetype: selected.id,
    combatArchetypeId: selected.id,
    progressionModel: "tow-archetype",
    race: character.race,
    subrace: character.subrace,
    origin: character.origin,
    gender: character.gender,
    age: character.age,
    agingMode: "mortal",
    lifespanMultiplier: 1,
    attractiveness: 6,
    attributes: { ...selected.attributes },
    appearance: { ...character.appearance },
    base_appearance: character.baseAppearance,
    portraitKey: character.portraitKey,
    abilities: [],
    items: selected.gear.map((itemId) => ({ itemId, quantity: 1, worn: true })),
    coins: selected.power === "Ascendant" ? { gold: 12, silver: 0 } : { gold: 2, silver: 5 },
    knows: [
      `I am ${character.name}, known as ${character.epithet}.`,
      character.history,
      `I entered Whitemarch carrying the ${selected.name} combat kit.`,
      "My combat power comes from my equipment and Tower of Will build, not a character level.",
    ],
    profile: {
      source: "tow-authored-character-start",
      characterId: character.id,
      characterName: character.name,
      epithet: character.epithet,
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
  const characterIds = new Set();
  const characterNames = new Set();
  for (const selected of STARTING_ARCHETYPES) {
    const character = selected.character;
    if (!character?.id || !character?.name || !character?.portraitKey) {
      invalid.push(`${selected.id}:incomplete-character`);
    }
    if (characterIds.has(character?.id)) invalid.push(`${selected.id}:duplicate-character-id`);
    if (characterNames.has(character?.name)) invalid.push(`${selected.id}:duplicate-character-name`);
    characterIds.add(character?.id);
    characterNames.add(character?.name);
    if (!startingPackage(selected.professionId)) invalid.push(`${selected.id}:unknown-profession`);
    for (const [traitId, rank] of Object.entries(selected.build.traits)) {
      if (!getTrait(traitId) || !Number.isInteger(rank) || rank < 1 || rank > 7) {
        invalid.push(`${selected.id}:invalid-trait:${traitId}`);
      }
    }
    for (const itemId of selected.gear) {
      if (!itemTemplate(itemId)) invalid.push(`${selected.id}:unknown-item:${itemId}`);
      if (!getTowStartItemGrant(itemId) && itemTemplate(itemId)?.tier !== "common") {
        invalid.push(`${selected.id}:unmapped-power-item:${itemId}`);
      }
    }
  }
  return invalid;
}
