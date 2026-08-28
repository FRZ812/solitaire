import { BIOME_VISUALS } from "../data/visual-assets.js";

const DOSSIER_SCENE_IDS = Object.freeze(Object.keys(BIOME_VISUALS));

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "unknown")) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}

export function characterDossierBackground(entry) {
  const id = entry?.id || "unknown";
  if (id === "wanderer" || entry?.kind === "player") return BIOME_VISUALS.whitemarch.image;
  const key = DOSSIER_SCENE_IDS[stableHash(`${id}:${entry?.origin || ""}:${entry?.race || ""}`) % DOSSIER_SCENE_IDS.length];
  return BIOME_VISUALS[key].image;
}
