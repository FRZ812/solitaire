const POLAR_KNIGHT_GUIDE = Object.freeze({
  confidence: "secondary",
  date: "2023-09-12",
  referenceVersion: "guide-current-on-source-date",
  url: "https://gall.dcinside.com/mgallery/board/view/?id=tow&no=5666",
});

const STRUCTURAL_PLACEHOLDER = Object.freeze({
  confidence: "inferred",
  sourceType: "vertical-slice-policy",
  observation: "Public evidence establishes the character and system shape, but not this exact starting package.",
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const ARCTIC_KNIGHT = deepFreeze({
  id: "arctic-knight",
  name: "Arctic Knight",
  aliases: ["Polar Knight"],
  professionId: "arctic-knight",
  starting: {
    maxHp: 24,
    stats: { attack: 4, defense: 2 },
    actions: ["basic-attack", "basic-defense"],
    skills: ["emergency-evasion", "sleep-bomb"],
  },
  startingConfidence: {
    maxHp: "inferred-placeholder",
    stats: "inferred-placeholder",
    actions: "observed-system-inferred-membership",
    skills: "observed-system-inferred-membership",
  },
  unresolved: [
    "exact-starting-stats",
    "exact-starting-loadout",
    "exclusive-reward-pool",
    "meta-unlock-boundaries",
  ],
  evidence: [POLAR_KNIGHT_GUIDE, STRUCTURAL_PLACEHOLDER],
});

const CHARACTERS = Object.freeze({
  [ARCTIC_KNIGHT.id]: ARCTIC_KNIGHT,
});

export function getReferenceCharacter(characterId) {
  return typeof characterId === "string" && Object.hasOwn(CHARACTERS, characterId)
    ? CHARACTERS[characterId]
    : null;
}

export function createReferencePlayer(characterId, { actorId = "player" } = {}) {
  const character = getReferenceCharacter(characterId);
  if (!character) throw new TypeError(`unknown-character:${characterId}`);
  if (typeof actorId !== "string" || actorId.length === 0) throw new TypeError("invalid-actor-id");
  const starting = JSON.parse(JSON.stringify(character.starting));
  return {
    id: actorId,
    name: character.name,
    hp: starting.maxHp,
    maxHp: starting.maxHp,
    stats: starting.stats,
    actions: starting.actions,
    skills: starting.skills,
  };
}
