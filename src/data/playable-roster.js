// The ready-made creation roster also exists as a cast of authored people in
// every campaign. Each entry is placed at a named, route-connected landmark so
// the same character a player could have chosen can instead be found elsewhere
// in Avarra. The chosen template is removed when character creation resolves;
// `wanderer` is always the only player instance.

import { LANDMARKS } from "./continent.js";
import { CHARACTER_TEMPLATES } from "./templates.js";
import { bodyWeightForRace } from "../engine/weight.js";

export const PLAYABLE_CHARACTER_PLACEMENTS = Object.freeze({
  sellsword: "greenward-gate",
  reaver: "brokenhold",
  ranger: "antlerhold",
  cutthroat: "hanori",
  devout: "saltmother-shrine",
  "court-envoy": "asalan",
  "confidence-artist": "greenharbor",
  "hedge-mage": "heron-combat",
  "knight-errant": "halfborn-hold",
  "war-priest": "sunward-bastion",
  duelist: "crowsmoor",
  "beast-warden": "bramblewych",
  "guild-advocate": "stonebrook",
  "velvet-courtier": "willowcourt",
  "war-captain": "frostgate",
  "battle-archmage": "aurora-vault",
  shadowblade: "lotusmouth",
  "champion-paladin": "brasshaven",
  "dragon-hunter": "drakespire",
  "high-sorcerer": "moon-reed-monastery",
  warlord: "wolfglass",
  "fae-touched": "everpine-court",
  "archmage-ascendant": "jade-lock",
  "undying-champion": "northstar-castle",
  "demon-warlock": "skeldhaven",
  "dragon-ascendant": "ashfang-monastery",
  "enchanter-tyrant": "tellmar",
});

const LANDMARK_BY_ID = new Map(LANDMARKS.map((landmark) => [landmark.id, landmark]));

export function playableCharacterId(templateId) {
  return `playable-${templateId}`;
}

function profileFor(template) {
  const profile = {
    voice: template.voice,
    complication: template.complication,
    signature: template.signature,
  };
  return Object.values(profile).some(Boolean) ? profile : null;
}

export function playableCharacterCodexEntry(template, day = 0) {
  const landmarkId = PLAYABLE_CHARACTER_PLACEMENTS[template.id];
  const landmark = LANDMARK_BY_ID.get(landmarkId);
  if (!landmark) throw new Error(`Missing world placement for playable character ${template.id}`);

  const setup = template.setup;
  const id = playableCharacterId(template.id);
  const abilities = (setup.abilities || [])
    .map((ability) => (typeof ability === "string" ? ability : ability?.id))
    .filter(Boolean);
  const worn = (setup.items || [])
    .filter((item) => item?.worn && item.itemId)
    .map((item) => item.itemId);

  return {
    id,
    kind: "npc",
    playable: true,
    trackable: true,
    templateId: template.id,
    portraitKey: template.portraitKey,
    name: setup.name,
    race: setup.race,
    subrace: setup.subrace ?? null,
    profession: setup.profession,
    archetype: setup.archetype ?? null,
    progression: setup.progression ? {
      ...setup.progression,
      paths: { ...(setup.progression.paths || {}) },
    } : null,
    origin: setup.origin ?? null,
    gender: setup.gender ?? null,
    age: setup.age ?? null,
    agingMode: setup.agingMode ?? "mortal",
    lifespanMultiplier: setup.lifespanMultiplier ?? 1,
    attractiveness: setup.attractiveness ?? null,
    appearance: setup.appearance ? { ...setup.appearance } : null,
    base_appearance: setup.base_appearance || null,
    description: template.story || setup.story || template.concept,
    concept: template.concept,
    role: template.role,
    powerTier: template.tier,
    profile: profileFor(template),
    attributes: { ...(setup.attributes || {}) },
    proficiencies: { ...(setup.proficiencies || {}) },
    abilities,
    worn,
    knows: [...(setup.knows || [])],
    relationship: 0,
    memories: [],
    bodyWeight: bodyWeightForRace(setup.race),
    ridingOn: null,
    riders: [],
    homeName: landmark.name,
    home: { x: landmark.coord.x, y: landmark.coord.y },
    at: { x: landmark.coord.x, y: landmark.coord.y, day },
  };
}

export function playableRosterCharacters({ day = 0, selectedTemplateId = null } = {}) {
  return Object.fromEntries(CHARACTER_TEMPLATES
    .filter((template) => template.id !== selectedTemplateId)
    .map((template) => {
      const entry = playableCharacterCodexEntry(template, day);
      return [entry.id, entry];
    }));
}

// Remove only the campaign-roster copy. A narrator-authored NPC that happens to
// share a profession or template-shaped id is not silently deleted.
export function withoutSelectedPlayableCharacter(characters, selectedTemplateId) {
  if (!selectedTemplateId || !characters) return characters;
  let next = characters;
  for (const [id, character] of Object.entries(characters)) {
    if (!character?.playable || character.templateId !== selectedTemplateId) continue;
    if (next === characters) next = { ...characters };
    delete next[id];
  }
  return next;
}
