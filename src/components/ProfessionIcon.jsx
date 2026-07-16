import React from "react";
import professionAtlas from "../assets/generated/professions/profession-atlas-anime-v2.webp";
import { professionRecord } from "../data/professions.js";
import "./profession-icon.css";

// ImageGen-authored 5x5 atlas. The first 23 cells are character-specific and
// the final two are shared by the envoy and courtier social professions. Keeping the index semantic here
// makes the visual source replaceable without scattering pixel coordinates.
export const PROFESSION_ATLAS_CELLS = Object.freeze([
  "sellsword", "reaver", "ranger", "cutthroat", "devout",
  "hedge-mage", "knight-errant", "war-priest", "duelist", "beast-warden",
  "war-captain", "battle-archmage", "shadowblade", "champion-paladin", "dragon-hunter",
  "high-sorcerer", "warlord", "fae-touched", "archmage-ascendant", "undying-champion",
  "demon-warlock", "dragon-ascendant", "enchanter-tyrant", "envoy", "courtier",
]);

const CELL_INDEX = Object.freeze(Object.fromEntries(PROFESSION_ATLAS_CELLS.map((key, index) => [key, index])));
const PROFESSION_FALLBACKS = Object.freeze({
  sellsword: "sellsword", reaver: "reaver", ranger: "ranger", assassin: "cutthroat", priest: "devout",
  "hedge-mage": "hedge-mage", knight: "knight-errant", "war-priest": "war-priest", duelist: "duelist", warden: "beast-warden",
  "war-captain": "war-captain", archmage: "battle-archmage", paladin: "champion-paladin", "dragon-hunter": "dragon-hunter",
  sorcerer: "high-sorcerer", warlord: "warlord", "fae-touched": "fae-touched", champion: "undying-champion",
  warlock: "demon-warlock", "dragon-ascendant": "dragon-ascendant", "enchanter-tyrant": "enchanter-tyrant",
  envoy: "envoy", courtier: "courtier",
});

export function professionIconKey({ templateId, profession } = {}) {
  if (templateId && CELL_INDEX[templateId] != null) return templateId;
  return PROFESSION_FALLBACKS[profession] || professionRecord(profession)?.iconKey || "sellsword";
}

export function professionAtlasPosition(key) {
  const index = CELL_INDEX[key] ?? 0;
  const column = index % 5;
  const row = Math.floor(index / 5);
  return `${column * 25}% ${row * 25}%`;
}

export function ProfessionIcon({ templateId, profession, size = "medium", className = "", decorative = false }) {
  const key = professionIconKey({ templateId, profession });
  const record = professionRecord(profession);
  const label = record?.name || String(profession || key).replace(/[-_]+/g, " ");
  return (
    <span
      className={`profession-icon profession-icon--${size}${className ? ` ${className}` : ""}`}
      style={{ "--profession-atlas": `url(${professionAtlas})`, "--profession-position": professionAtlasPosition(key) }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `${label} profession`}
      aria-hidden={decorative ? "true" : undefined}
      title={decorative ? undefined : label}
      data-profession={profession || undefined}
      data-template={templateId || undefined}
      data-atlas-cell={key}
    ><span aria-hidden="true" /></span>
  );
}
