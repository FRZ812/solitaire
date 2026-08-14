// The complete playable Tower of Winter roster, translated into Solitaire's authored
// character-start contract. Selection chooses a whole person: source identity, base stats,
// innate trait, four-action kit, portrait, equipment, and history travel together.

import { itemTemplate } from "../../data/catalog.js";
import { CHARACTER_ABILITY_TYPES } from "./character-abilities.js";
import { getSkill } from "./skills.js";
import { getFusion, getTrait } from "./traits.js";
import { startingPackage } from "./starting-packages.js";
import { describeTowItems, getTowStartItemGrant } from "./start-items.js";

export const TOWER_CHARACTER_SOURCE = "https://namu.wiki/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91/%EC%BA%90%EB%A6%AD%ED%84%B0";
export const TOWER_ROSTER_SIZE = 12;

function authoredCharacter({
  id,
  name,
  sourceName,
  epithet,
  summary,
  history,
  race,
  kindLabel = null,
  origin,
  gender,
  age,
  agingMode = "mortal",
  lifespanMultiplier = 1,
  appearance,
  baseAppearance,
}) {
  return Object.freeze({
    id,
    name,
    sourceName,
    epithet,
    summary,
    history,
    portraitKey: `tow:${id}`,
    race,
    subrace: null,
    kindLabel,
    origin,
    gender,
    age,
    agingMode,
    lifespanMultiplier,
    appearance: Object.freeze({ ...appearance }),
    baseAppearance,
    source: Object.freeze({ page: TOWER_CHARACTER_SOURCE, label: sourceName }),
  });
}

function archetype({
  id,
  name,
  role,
  professionId,
  traitId,
  traitRank = 3,
  skills,
  tagline,
  playstyle,
  attention,
  attributes,
  baseStats,
  gear,
  color,
  portrait = {},
  character,
}) {
  if (!startingPackage(professionId)) throw new TypeError(`unknown-archetype-profession:${professionId}`);
  return Object.freeze({
    id,
    name,
    role,
    power: "Expedition",
    professionId,
    tagline,
    playstyle,
    attention,
    color,
    portrait: Object.freeze({ scale: 1, x: "50%", y: "100%", ...portrait }),
    character,
    attributes: Object.freeze({ ...attributes }),
    baseStats: Object.freeze({ ...baseStats }),
    gear: Object.freeze([...gear]),
    source: Object.freeze({ page: TOWER_CHARACTER_SOURCE, label: character.sourceName }),
    build: Object.freeze({
      traits: Object.freeze({ [traitId]: traitRank }),
      skills: Object.freeze([...skills]),
      runes: Object.freeze([]),
    }),
  });
}

export const STARTING_ARCHETYPES = Object.freeze([
  archetype({
    id: "arctic-knight", name: "Shield Vanguard", role: "Ward and retaliation", professionId: "fighter", traitId: "ironclad",
    skills: ["arctic-strike", "arctic-block", "arctic-deliberate-blow", "arctic-incineration"],
    tagline: "Stand between the expedition and the end of the world.",
    playstyle: "The most forgiving front-line kit: absorb a declared attack, answer without surrendering defence, then accept Incineration's dangerous recoil to end a crisis.",
    attention: "Low", attributes: { body: 4, reflex: 3, vigor: 4, mind: 2, wit: 3, presence: 3 },
    baseStats: { maxHp: 170, attack: 12, defense: 13, critRate: 9, dodgeRate: 4 },
    gear: ["arming-sword", "chain-shirt", "round-shield", "traveling-cloak", "marching-boots"], color: "#c89a58",
    character: authoredCharacter({
      id: "arctic-knight", name: "Arctic Knight", sourceName: "극지의 기사", epithet: "The Last Shield",
      summary: "A weathered northern veteran who treats survival as a duty owed to everyone behind the shield.",
      history: "The Arctic Knight has watched expedition after expedition disappear into the white. He returns not because he expects glory, but because someone must remember how the dead fought and carry that knowledge one floor farther.",
      race: "human", origin: "north", gender: "male", age: 43,
      appearance: { skin: "weathered fair", hair: "iron-grey", eyes: "pale blue", build: "broad and battle-scarred", marks: "an old scar crossing one eye" },
      baseAppearance: "A broad northern veteran in fur-lined plate, one pale eye watchful above a scar, sword and heavy shield worn by long campaigns.",
    }),
  }),
  archetype({
    id: "demon-slayer", name: "Venom Hunter", role: "Ranged control", professionId: "ranger", traitId: "quickness",
    skills: ["demon-shoot", "demon-evasion", "demon-kick", "demon-arrow-rain"],
    tagline: "Every monster leaves a trail. Every trail ends.",
    playstyle: "Open at range, deny a lethal turn with Evasion or Kick, then let Arrow Rain turn every on-hit poison effect into a storm.",
    attention: "Medium", attributes: { body: 2, reflex: 5, vigor: 3, mind: 2, wit: 4, presence: 3 },
    baseStats: { maxHp: 160, attack: 13, defense: 12, critRate: 9, dodgeRate: 5 },
    gear: ["hunting-bow", "leather-jerkin", "traveling-cloak", "marching-boots"], color: "#9eaa62",
    portrait: { scale: 1.04, x: "48%" },
    character: authoredCharacter({
      id: "demon-slayer", name: "Demon Slayer", sourceName: "악마 살육자", epithet: "The Relentless Quarry",
      summary: "A bounty hunter whose caution was forged by grief and whose arrows are prepared for things that refuse to die.",
      history: "She learned the bow as a child and later hunted criminals to support her younger sister. When cultists turned that sister's expedition into a nightmare, the hunter followed their trail north and stopped taking contracts she did not choose herself.",
      race: "human", origin: "east", gender: "female", age: 31,
      appearance: { skin: "winter-pale", hair: "dark auburn", eyes: "hazel", build: "compact and athletic", marks: "poison burns along two fingers" },
      baseAppearance: "A compact winter hunter in layered furs, bow and crossbow tools close at hand, poison vials secured against the cold.",
    }),
  }),
  archetype({
    id: "owner-of-clocktower", name: "Clockwork Savant", role: "Free-action controller", professionId: "artificer", traitId: "innovation",
    skills: ["clocktower-fire", "clocktower-suppressive-shot", "clocktower-missile-support", "clocktower-redesign"],
    tagline: "A perfect design is merely the next failed design, corrected.",
    playstyle: "Suppress incoming pressure, layer a free missile strike over the main action, and Redesign ATK and DEF into exactly the buffs the next turn needs.",
    attention: "High", attributes: { body: 2, reflex: 3, vigor: 3, mind: 5, wit: 5, presence: 3 },
    baseStats: { maxHp: 150, attack: 14, defense: 14, critRate: 9, dodgeRate: 4 },
    gear: ["light-crossbow", "padded-gambeson", "leather-bracers", "traveling-cloak"], color: "#62a8ad",
    portrait: { scale: 1.02, x: "52%" },
    character: authoredCharacter({
      id: "owner-of-clocktower", name: "Owner of Clocktower", sourceName: "시계탑의 주인", epithet: "The Youngest Master",
      summary: "A prodigious engineer who records every failure and trusts a mechanism only after surviving its worst possibility.",
      history: "The Clocktower chose its youngest master while other scholars still called her a student. When missing researchers sent a signal from the north and politics divided her order, she packed the designs no committee would approve and answered it herself.",
      race: "human", origin: "central", gender: "female", age: 21,
      appearance: { skin: "warm ivory", hair: "black, cut to the jaw", eyes: "grey", build: "slight", marks: "copper-lensed workshop goggles" },
      baseAppearance: "A young magitech engineer with a precision weapon, brass mechanisms, barrier emitters, and the composed stare of a practiced lecturer.",
    }),
  }),
  archetype({
    id: "old-king-of-northland", name: "Storm Tyrant", role: "Axe sustain", professionId: "barbarian", traitId: "valiancy",
    skills: ["north-king-cleave", "north-king-vitality", "north-king-whirlwind", "north-king-earthquake"],
    tagline: "A crown can be taken. A king's weight cannot.",
    playstyle: "Every repeated hit compounds Valiancy. Whirlwind erodes the foe, Vitality erases attrition, and Earthquake ends the argument with overwhelming scale.",
    attention: "Medium", attributes: { body: 5, reflex: 2, vigor: 4, mind: 2, wit: 3, presence: 5 },
    baseStats: { maxHp: 160, attack: 14, defense: 13, critRate: 6, dodgeRate: 4 },
    gear: ["battle-axe", "chain-shirt", "traveling-cloak", "marching-boots"], color: "#b66e4a",
    portrait: { scale: 1.07, x: "49%" },
    character: authoredCharacter({
      id: "old-king-of-northland", name: "Old King of Northland", sourceName: "북부의 옛 왕", epithet: "The Uncrowned Avalanche",
      summary: "A defeated northern ruler whose prison could contain his body but never convince him that the war was over.",
      history: "After his realm fell, the old king traded court for a prison yard and made an unlikely ally of its warden. The dead rose beneath their feet; he killed them, surrendered the credit, and walked out toward the Tower with one last campaign left in him.",
      race: "human", origin: "north", gender: "male", age: 61,
      appearance: { skin: "ruddy and scarred", hair: "white", eyes: "ice blue", build: "massive", facial_hair: "heavy white beard" },
      baseAppearance: "A massive elderly warrior in bear-marked northern furs, white beard wind-torn, both hands resting on a brutal axe.",
    }),
  }),
  archetype({
    id: "sleepless-one", name: "Ember Warden", role: "Burn attrition", professionId: "druid", traitId: "ignition",
    skills: ["sleepless-flame-strike", "sleepless-flame-curtain", "sleepless-entangling-roots", "sleepless-high-speed-flight"],
    tagline: "Sleep belongs to creatures who believe morning is promised.",
    playstyle: "Maintain a curtain of fire while roots cancel a dangerous tempo swing. High-Speed Flight converts one ultimate use into four Priority for a decisive sequence.",
    attention: "High", attributes: { body: 4, reflex: 3, vigor: 5, mind: 3, wit: 3, presence: 2 },
    baseStats: { maxHp: 190, attack: 12, defense: 15, critRate: 3, dodgeRate: 3 },
    gear: ["iron-spear", "leather-jerkin", "traveling-cloak", "marching-boots"], color: "#c45e3f",
    portrait: { scale: 1.08, y: "102%" },
    character: authoredCharacter({
      id: "sleepless-one", name: "Sleepless One", sourceName: "잠 못드는 자", epithet: "The Last Warm Scale",
      summary: "A cold-blooded guardian carrying a living ember through a winter that has erased every natural season.",
      history: "The Sleepless One remembers wetlands before the ice and nests that no longer hatch. Fire is not rage to this survivor; it is memory, shelter, and the promise that the world can still be made habitable.",
      race: "drakeborn", kindLabel: "Reptilian", origin: "far-wild", gender: "male", age: 47, lifespanMultiplier: 1.7,
      appearance: { skin: "charcoal scales", hair: "none", eyes: "ember orange", build: "heavy and long-limbed", marks: "a fire-bright throat frill" },
      baseAppearance: "A heavy reptilian warrior with charcoal scales, ember-bright eyes, a tribal spear, and heat shimmering along the throat and claws.",
    }),
  }),
  archetype({
    id: "last-assassin", name: "Crumble Executioner", role: "Multi-hit finisher", professionId: "rogue", traitId: "combo",
    skills: ["assassin-flurry", "assassin-deflect", "assassin-flash-bomb", "assassin-execution"],
    tagline: "One opening is enough. Two blades make certain.",
    playstyle: "Flurry steadily exposes a target. Deflect answers multi-hit intent, Flash Bomb creates a safe opening, and Execution scales with the damage already done.",
    attention: "High", attributes: { body: 3, reflex: 5, vigor: 3, mind: 2, wit: 5, presence: 2 },
    baseStats: { maxHp: 160, attack: 14, defense: 11, critRate: 12, dodgeRate: 5 },
    gear: ["twin-daggers", "leather-jerkin", "traveling-cloak", "marching-boots"], color: "#8b78a8",
    portrait: { scale: 1.03, x: "47%" },
    character: authoredCharacter({
      id: "last-assassin", name: "Last Assassin", sourceName: "최후의 암살자", epithet: "The Final Footstep",
      summary: "The sole surviving practitioner of a school whose techniques now exist only when this killer moves.",
      history: "Names, masters, and safe houses vanished one by one until only a sequence of footsteps remained. The Last Assassin follows that sequence into the Tower, hunting the hand that knew where every hidden door was.",
      race: "human", origin: "east", gender: "male", age: 28,
      appearance: { skin: "olive", hair: "black, bound close", eyes: "dark brown", build: "lean", marks: "a cut through the lower lip" },
      baseAppearance: "A lean assassin in a close dark winter cloak, paired blades low at the hips and a flash charge hidden in one gloved palm.",
    }),
  }),
  archetype({
    id: "witch-of-eternity", name: "Bone Sovereign", role: "Army and burst", professionId: "warlock", traitId: "necromancy",
    skills: ["witch-skull-throw", "witch-bone-shield", "witch-skeleton-summon", "witch-all-out-attack"],
    tagline: "Nothing is gone while the bones still answer.",
    playstyle: "Accumulate Skeletons passively and actively, preserve the host behind Bone Shield, then commit the entire army to one overwhelming attack.",
    attention: "Medium", attributes: { body: 2, reflex: 3, vigor: 3, mind: 5, wit: 4, presence: 4 },
    baseStats: { maxHp: 150, attack: 10, defense: 15, critRate: 12, dodgeRate: 5 },
    gear: ["quarterstaff", "homespun-robe", "traveling-cloak"], color: "#8f769e",
    portrait: { scale: 1.06, x: "51%" },
    character: authoredCharacter({
      id: "witch-of-eternity", name: "Witch of Eternity", sourceName: "영겁의 마녀", epithet: "Keeper of the Unquiet Host",
      summary: "An ancient necromancer who remembers the dead as individuals even while commanding them as an army.",
      history: "Centuries of winter have filled the roads with unburied stories. The Witch gathers their bones, speaks the names that remain, and promises the host one final march toward the thing that stole their spring.",
      race: "human", origin: "central", gender: "female", age: 78, agingMode: "ageless", lifespanMultiplier: 5,
      appearance: { skin: "ashen", hair: "white, floor-length", eyes: "violet", build: "willowy", marks: "bone charms braided through the hair" },
      baseAppearance: "A willowy ancient witch framed by skulls and a hovering bone shield, white hair threaded with charms and violet grave-light.",
    }),
  }),
  archetype({
    id: "tenacious-mage", name: "Ruin Scholar", role: "Charge artillery", professionId: "wizard", traitId: "charge",
    skills: ["mage-magic-arrow", "mage-barrier", "mage-flame-storm", "mage-amplification"],
    tagline: "A failed theorem is only a weapon whose conditions are not yet met.",
    playstyle: "Barrier buys time for Charge to mature. Flame Storm supplies attrition; Amplification converts the current ATK line into a turn of explosive scaling.",
    attention: "Medium", attributes: { body: 2, reflex: 3, vigor: 3, mind: 5, wit: 5, presence: 2 },
    baseStats: { maxHp: 150, attack: 15, defense: 12, critRate: 6, dodgeRate: 5 },
    gear: ["quarterstaff", "homespun-robe", "traveling-cloak"], color: "#b95e58",
    portrait: { scale: 1.04, x: "49%" },
    character: authoredCharacter({
      id: "tenacious-mage", name: "Tenacious Mage", sourceName: "집념의 마도사", epithet: "The Unfinished Theorem",
      summary: "An obsessive scholar who has survived every failed spell by writing down exactly why it almost worked.",
      history: "The Mage has spent a lifetime proving that impossible magic is only expensive magic. With the cold swallowing laboratories and libraries alike, the final experiment requires a sample taken from the heart of the Tower.",
      race: "human", origin: "central", gender: "male", age: 67,
      appearance: { skin: "weathered brown", hair: "silver, swept back", eyes: "amber", build: "spare", facial_hair: "trim silver beard", marks: "rune burns across both hands" },
      baseAppearance: "A spare elder scholar with silver hair, rune-burned hands, brass instruments, and fire coiling around a travel-worn spellstaff.",
    }),
  }),
  archetype({
    id: "exiled-priestess", name: "Judgment Martyr", role: "Missing-health verdict", professionId: "cleric", traitId: "judgment",
    skills: ["priestess-crush", "priestess-holy-shield", "priestess-wrath-of-heaven", "priestess-doom"],
    tagline: "If heaven will not answer, I will deliver the verdict myself.",
    playstyle: "Judgment builds naturally. Holy Shield lets the Priestess survive at a dangerous health line, Wrath weaponizes what is missing, and Doom magnifies every lingering wound.",
    attention: "High", attributes: { body: 4, reflex: 2, vigor: 4, mind: 3, wit: 2, presence: 5 },
    baseStats: { maxHp: 144, attack: 11, defense: 16, critRate: 6, dodgeRate: 4 },
    gear: ["war-hammer", "chain-shirt", "round-shield", "traveling-cloak"], color: "#d2b05e",
    portrait: { scale: 1.08, x: "50%" },
    character: authoredCharacter({
      id: "exiled-priestess", name: "Exiled Priestess", sourceName: "추방된 성녀", epithet: "The Broken Halo",
      summary: "A holy warrior cast out for passing judgment where her order demanded silence.",
      history: "Her sanctuary called obedience a virtue even when obedience protected cruelty. She broke its seal, carried the condemned out, and accepted exile. The fractured halo she wears now marks a vow no institution can revoke.",
      race: "human", origin: "south", gender: "female", age: 34,
      appearance: { skin: "deep brown", hair: "black, braided", eyes: "gold-brown", build: "powerful", marks: "a broken sun brand at the brow" },
      baseAppearance: "A powerful exiled holy warrior with a massive hammer, weathered gold-white vestments, and a halo emblem deliberately broken through its center.",
    }),
  }),
  archetype({
    id: "wandering-blade", name: "Gale Duelist", role: "Initiative tempo", professionId: "monk", traitId: "gale",
    skills: ["blade-slash", "blade-barrier", "blade-chi-liberation", "blade-one-flash"],
    tagline: "The road ends wherever the blade becomes still.",
    playstyle: "Slash and Gale build Initiative toward extra actions. Blade Barrier protects the tempo line, Chi Liberation accelerates it, and One Flash cashes it out.",
    attention: "Medium", attributes: { body: 3, reflex: 5, vigor: 3, mind: 3, wit: 4, presence: 3 },
    baseStats: { maxHp: 160, attack: 14, defense: 12, critRate: 9, dodgeRate: 5 },
    gear: ["iron-longsword", "padded-gambeson", "traveling-cloak", "marching-boots"], color: "#76a6ad",
    portrait: { scale: 1.07, x: "52%" },
    character: authoredCharacter({
      id: "wandering-blade", name: "Wandering Blade", sourceName: "방랑하는 검", epithet: "The Road Between Heartbeats",
      summary: "A swordswoman who measures distance in breaths and never draws without already knowing where the cut will end.",
      history: "She left a celebrated school when its masters began teaching victory without responsibility. The wandering years stripped every ornament from her technique; the Tower is the first opponent vast enough to demand all that remains.",
      race: "human", origin: "east", gender: "female", age: 29,
      appearance: { skin: "light olive", hair: "black, long and tied high", eyes: "dark grey", build: "lean", marks: "callused sword hand" },
      baseAppearance: "An eastern wandering swordswoman in layered travel cloth, long blade half-drawn, wind trails and restrained chi gathering along the edge.",
    }),
  }),
  archetype({
    id: "desolate-vampire", name: "Crimson Survivor", role: "Blood sustain", professionId: "rogue", traitId: "bloodsuck",
    skills: ["vampire-claw", "vampire-blood-thirst", "vampire-heart-destroyer", "vampire-rampage"],
    tagline: "Hunger is not a master. It is a debt I choose how to pay.",
    playstyle: "Every damaging action becomes sustain through Bloodsuck. Blood Thirst recovers without a target, Heart Destroyer opens a wound, and Rampage turns four hits into a violent recovery sequence.",
    attention: "Medium", attributes: { body: 4, reflex: 4, vigor: 4, mind: 3, wit: 4, presence: 4 },
    baseStats: { maxHp: 170, attack: 13, defense: 13, critRate: 9, dodgeRate: 4 },
    gear: ["iron-dagger", "leather-jerkin", "traveling-cloak", "marching-boots"], color: "#a84c58",
    portrait: { scale: 1.06, x: "48%" },
    character: authoredCharacter({
      id: "desolate-vampire", name: "Desolate Vampire", sourceName: "비탄의 흡혈귀", epithet: "The Thirst That Mourns",
      summary: "An immortal duelist who remembers every life taken by hunger and refuses to let those deaths become meaningless.",
      history: "The Vampire once mistook restraint for isolation and lost the one household that still welcomed him. He goes north carrying their names, choosing monsters as prey and treating every recovered heartbeat as borrowed time.",
      race: "vampire", origin: "west", gender: "male", age: 146, agingMode: "ageless", lifespanMultiplier: 8,
      appearance: { skin: "pale grey", hair: "black with a white forelock", eyes: "crimson", build: "tall and elegant", marks: "old bite scars at one wrist" },
      baseAppearance: "A tall tragic vampire in elegant but worn winter attire, clawed hand wreathed in controlled crimson blood magic.",
    }),
  }),
  archetype({
    id: "forsaken-automaton", name: "Overheat Engine", role: "Risk artillery", professionId: "artificer", traitId: "overheat",
    skills: ["automaton-bombardment", "automaton-repair", "automaton-emergency-cooling", "automaton-fate-manipulator"],
    tagline: "Directive lost. Purpose chosen.",
    playstyle: "Overheat makes both sides progressively more vulnerable. Repair holds the chassis together, Cooling vents the worst self-pressure, and Fate Manipulator buys an explosive action sequence at a severe cost.",
    attention: "High", attributes: { body: 5, reflex: 2, vigor: 5, mind: 4, wit: 3, presence: 1 },
    baseStats: { maxHp: 200, attack: 15, defense: 10, critRate: 6, dodgeRate: 3 },
    gear: ["light-crossbow", "chain-hauberk", "iron-helm"], color: "#b57744",
    portrait: { scale: 1.12, y: "104%" },
    character: authoredCharacter({
      id: "forsaken-automaton", name: "Forsaken Automaton", sourceName: "남겨진 자동인형", epithet: "The Abandoned Law",
      summary: "A war machine left without orders, climbing to discover whether a chosen purpose can be more binding than a command.",
      history: "Its cohort was recalled; this unit was not. Years beneath the snow degraded the old directive but preserved a final observation: humans kept walking north without being ordered. The Automaton repaired itself and followed.",
      race: "human", kindLabel: "Automaton", origin: "central", gender: "nonbinary", age: 38, agingMode: "ageless", lifespanMultiplier: 10,
      appearance: { skin: "brass and blackened steel", hair: "none", eyes: "furnace orange", build: "massive mechanical frame", marks: "an exposed, cracked heat core" },
      baseAppearance: "A massive brass-and-steel war automaton with a cannon arm, exposed orange heat core, cooling vents, and a silhouette built to survive artillery.",
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
    towBaseStats: { ...selected.baseStats },
    race: character.race,
    subrace: character.subrace,
    origin: character.origin,
    gender: character.gender,
    age: character.age,
    agingMode: character.agingMode,
    lifespanMultiplier: character.lifespanMultiplier,
    attractiveness: 6,
    attributes: { ...selected.attributes },
    appearance: { ...character.appearance },
    base_appearance: character.baseAppearance,
    portraitKey: character.portraitKey,
    abilities: [],
    items: selected.gear.map((itemId) => ({ itemId, quantity: 1, worn: true })),
    coins: { gold: 2, silver: 5 },
    knows: [
      `I am ${character.name}, ${character.epithet}.`,
      character.history,
      `My source identity is ${character.sourceName}.`,
      "My combat kit has one Basic Attack, Defensive, Special, and Ultimate ability.",
    ],
    profile: {
      source: "tow-authored-character-start",
      sourcePage: TOWER_CHARACTER_SOURCE,
      sourceName: character.sourceName,
      characterId: character.id,
      characterName: character.name,
      epithet: character.epithet,
      archetypeId: selected.id,
      archetypeName: selected.name,
      power: selected.power,
      role: selected.role,
    },
    // World progression remains a compatibility shell. Combat power comes from the source
    // base-stat chassis, the four-action build, and equipment rather than character level.
    level: 1,
  };
}

export function invalidStartingArchetypes() {
  const invalid = [];
  const characterIds = new Set();
  const characterNames = new Set();
  const portraitKeys = new Set();
  for (const selected of STARTING_ARCHETYPES) {
    const character = selected.character;
    if (!character?.id || !character?.name || !character?.portraitKey || !character?.sourceName) {
      invalid.push(`${selected.id}:incomplete-character`);
    }
    if (characterIds.has(character?.id)) invalid.push(`${selected.id}:duplicate-character-id`);
    if (characterNames.has(character?.name)) invalid.push(`${selected.id}:duplicate-character-name`);
    if (portraitKeys.has(character?.portraitKey)) invalid.push(`${selected.id}:duplicate-portrait-key`);
    characterIds.add(character?.id);
    characterNames.add(character?.name);
    portraitKeys.add(character?.portraitKey);
    if (!startingPackage(selected.professionId)) invalid.push(`${selected.id}:unknown-profession`);
    for (const [traitId, rank] of Object.entries(selected.build.traits)) {
      const trait = getTrait(traitId);
      if (!trait || !Number.isInteger(rank) || rank < 1 || rank > 7) {
        invalid.push(`${selected.id}:invalid-trait:${traitId}`);
      }
      if (trait?.exclusiveTo && trait.exclusiveTo !== selected.id) {
        invalid.push(`${selected.id}:foreign-trait:${traitId}`);
      }
    }
    const skills = selected.build.skills.map((id) => getSkill(id));
    if (skills.length !== CHARACTER_ABILITY_TYPES.length || skills.some((skill) => !skill)) {
      invalid.push(`${selected.id}:invalid-four-ability-kit`);
    } else {
      const types = new Set(skills.map((skill) => skill.abilityType));
      if (types.size !== CHARACTER_ABILITY_TYPES.length
        || CHARACTER_ABILITY_TYPES.some((type) => !types.has(type))) {
        invalid.push(`${selected.id}:invalid-ability-types`);
      }
      for (const skill of skills) {
        if (skill.exclusiveTo !== selected.id) invalid.push(`${selected.id}:foreign-skill:${skill.id}`);
        if (!skill.source?.page || !skill.source?.sourceName) invalid.push(`${selected.id}:unsourced-skill:${skill.id}`);
      }
    }
    const stats = selected.baseStats;
    if (!stats || !Number.isInteger(stats.maxHp) || !Number.isInteger(stats.attack)
      || !Number.isInteger(stats.defense) || !Number.isInteger(stats.critRate)
      || !Number.isInteger(stats.dodgeRate)) {
      invalid.push(`${selected.id}:invalid-base-stats`);
    }
    for (const itemId of selected.gear) {
      if (!itemTemplate(itemId)) invalid.push(`${selected.id}:unknown-item:${itemId}`);
      if (!getTowStartItemGrant(itemId) && itemTemplate(itemId)?.tier !== "common") {
        invalid.push(`${selected.id}:unmapped-power-item:${itemId}`);
      }
    }
  }
  if (STARTING_ARCHETYPES.length !== TOWER_ROSTER_SIZE) invalid.push("roster:wrong-size");
  return invalid;
}
