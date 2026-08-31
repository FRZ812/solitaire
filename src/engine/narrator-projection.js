import { characterPosition } from "./positions.js";
import { coinsToCopper } from "./economy.js";
import { isLivingCharacter } from "./aging.js";
import {
  narratorAssassinationAttemptCapabilities,
  narratorAssassinationCapabilities,
} from "./assassination.js";

export const NARRATOR_CONTRACT_VERSION = 3;

export function narratorStateRevision(state) {
  const canonical = JSON.stringify({
    created: state?.created,
    character: state?.character,
    party: state?.party,
    time: state?.time,
    world: state?.world,
    beats: state?.beats,
    apiHistory: state?.apiHistory,
    memories: state?.memories,
    narratorTurnContinuation: state?.narratorTurnContinuation,
  });
  let fnv = 0x811c9dc5;
  let djb = 0x1505;
  for (let index = 0; index < canonical.length; index++) {
    const code = canonical.charCodeAt(index);
    fnv = Math.imul(fnv ^ code, 0x01000193);
    djb = Math.imul(djb, 33) ^ code;
  }
  return `state-v2:${canonical.length}:${(fnv >>> 0).toString(16)}:${(djb >>> 0).toString(16)}`;
}

export function buildNarratorProjection(state) {
  const playerId = state?.character?.id || "wanderer";
  const codexCharacters = state?.world?.codex?.characters || {};
  const characters = Object.create(null);
  const present = new Set();
  const current = state?.world?.currentTile || { x: 0, y: 0 };
  const day = state?.time?.day ?? 0;

  for (const [key, raw] of Object.entries(codexCharacters)) {
    const id = raw?.id || key;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ["__proto__", "prototype", "constructor"].includes(id)) continue;
    const character = { ...raw, id };
    characters[id] = character;
    if (id === playerId || character.kind === "player" || !isLivingCharacter(character)) continue;
    if (id === "threshold-voice" && state?.created === false) {
      present.add(id);
      continue;
    }
    const position = characterPosition(state, id);
    if (position?.x === current.x && position?.y === current.y) present.add(id);
  }

  const presentSpeakerIds = [...present].sort();
  const partyIds = new Set(state?.party || []);
  const combatTargetIds = presentSpeakerIds.filter((id) => (
    id !== "threshold-voice"
    && !partyIds.has(id)
    && characters[id]?.kind !== "mount"
  ));
  const assassinationAttempts = narratorAssassinationAttemptCapabilities(state, presentSpeakerIds);
  const assassinationTargets = narratorAssassinationCapabilities(state, presentSpeakerIds);
  const stateRevision = narratorStateRevision(state);
  const speakers = presentSpeakerIds.length
    ? presentSpeakerIds.map((id) => `${id}:${characters[id].name || id}`).join(" · ")
    : "none";
  const assassinationMethods = Object.entries(assassinationTargets)
    .map(([id, capability]) => `${id}:${capability.methods.join(",")}`)
    .join(" · ") || "none";
  const assassinationAttemptMethods = Object.entries(assassinationAttempts)
    .map(([id, capability]) => `${id}:${capability.methods.join(",")}`)
    .join(" · ") || "none";

  return {
    contractVersion: NARRATOR_CONTRACT_VERSION,
    stateRevision,
    created: state?.created,
    playerId,
    characters,
    partyIds: [...(state?.party || [])],
    combatTargetIds,
    availableCopper: coinsToCopper(state?.character?.inventory?.coins),
    presentSpeakerIds,
    assassinationAttempts,
    assassinationTargets,
    currentTile: { x: current.x, y: current.y, day },
    context: `[NARRATOR CONTRACT — contract_version=${NARRATOR_CONTRACT_VERSION}; state_revision=${stateRevision}; present non-player speakers=${speakers}; valid assassination attempts=${assassinationAttemptMethods}; stat/ability-authorized assassination deaths=${assassinationMethods}. Dialogue may reference only these ids or a complete character declared in this response.]`,
  };
}

const SCOPED_ROUTE_POLICIES = Object.freeze({
  "trade-presentation": {
    requiredSkillIds: ["economy-and-survival"],
    allowedSkillIds: ["economy-and-survival", "inventory-and-light", "narrative-craft"],
    allowedEffects: ["discoveries"],
  },
  "mount-negotiation": {
    requiredSkillIds: ["magic-and-mounts", "economy-and-survival", "narrative-craft"],
    allowedSkillIds: ["magic-and-mounts", "economy-and-survival", "narrative-craft", "codex-and-npcs"],
    allowedEffects: ["buy_mount", "discoveries"],
    continuation: { terminalEffect: "buy_mount" },
  },
  "recruitment-negotiation": {
    requiredSkillIds: ["relationships-and-party", "codex-and-npcs", "narrative-craft"],
    allowedSkillIds: ["relationships-and-party", "codex-and-npcs", "narrative-craft"],
    allowedEffects: ["recruit_companion", "relationship_changes", "memory_updates", "discoveries"],
    continuation: { terminalEffect: "recruit_companion" },
  },
  "party-departure": {
    requiredSkillIds: ["relationships-and-party", "narrative-craft"],
    allowedSkillIds: ["relationships-and-party", "narrative-craft", "codex-and-npcs"],
    allowedEffects: ["part_ways", "relationship_changes", "memory_updates", "discoveries"],
    continuation: { terminalEffect: "part_ways" },
  },
  "scry-presentation": {
    requiredSkillIds: ["magic-and-mounts", "world-and-travel", "narrative-craft"],
    allowedSkillIds: ["magic-and-mounts", "world-and-travel", "narrative-craft", "codex-and-npcs"],
    allowedEffects: [],
  },
  "rights-negotiation": {
    requiredSkillIds: ["economy-and-survival", "relationships-and-party", "codex-and-npcs"],
    allowedSkillIds: ["economy-and-survival", "relationships-and-party", "codex-and-npcs", "narrative-craft"],
    allowedEffects: ["purchase_rights", "discoveries"],
    continuation: { terminalEffect: "purchase_rights" },
  },
  "captive-negotiation": {
    requiredSkillIds: ["economy-and-survival", "relationships-and-party", "codex-and-npcs"],
    allowedSkillIds: ["economy-and-survival", "relationships-and-party", "codex-and-npcs", "narrative-craft"],
    allowedEffects: ["purchase_captive", "discoveries"],
    continuation: { terminalEffect: "purchase_captive" },
  },
  "combat-search-presentation": {
    requiredSkillIds: ["combat-and-consequences", "narrative-craft", "codex-and-npcs"],
    allowedSkillIds: ["combat-and-consequences", "narrative-craft", "codex-and-npcs", "world-and-travel"],
    allowedEffects: ["discoveries"],
  },
  "combat-aftermath": {
    requiredSkillIds: ["combat-and-consequences", "narrative-craft"],
    allowedSkillIds: ["combat-and-consequences", "narrative-craft", "codex-and-npcs", "inventory-and-light"],
    allowedEffects: [],
  },
  "loot-fallout": {
    requiredSkillIds: ["combat-and-consequences", "economy-and-survival", "narrative-craft"],
    allowedSkillIds: ["combat-and-consequences", "economy-and-survival", "narrative-craft", "codex-and-npcs"],
    allowedEffects: ["new_conditions", "discoveries"],
  },
});

export function narratorTurnPolicy(_userMessage, state, routeOptions = {}) {
  const effectiveRouteOptions = routeOptions.route
    ? routeOptions
    : (state?.narratorTurnContinuation || routeOptions);
  if (effectiveRouteOptions.route === "travel-presentation") {
    return {
      id: "travel-presentation",
      requiredSkillIds: ["world-and-travel", "narrative-craft"],
      allowedSkillIds: ["world-and-travel", "narrative-craft", "codex-and-npcs"],
      allowedEffects: [],
    };
  }
  const scoped = SCOPED_ROUTE_POLICIES[effectiveRouteOptions.route];
  if (scoped) {
    return {
      id: effectiveRouteOptions.route,
      ...scoped,
      ...(effectiveRouteOptions.effectConstraints
        ? { effectConstraints: effectiveRouteOptions.effectConstraints }
        : {}),
      ...(effectiveRouteOptions.storyCharacterIds
        ? { storyCharacterIds: [...effectiveRouteOptions.storyCharacterIds] }
        : {}),
    };
  }
  return {
    id: "general-action",
    requiredSkillIds: ["narrative-craft"],
    allowedSkillIds: [
      "narrative-craft", "identity-and-kindreds", "world-and-travel",
      "magic-and-mounts", "economy-and-survival",
      "codex-and-npcs", "relationships-and-party", "inventory-and-light",
      "combat-and-consequences",
    ],
    allowedEffects: ["assassination"],
  };
}
