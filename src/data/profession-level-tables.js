import { WIZARD_PROGRESSION_LEVELS } from "./profession-levels/wizard.js";
import { SORCERER_PROGRESSION_LEVELS } from "./profession-levels/sorcerer.js";
import { CLERIC_PROGRESSION_LEVELS } from "./profession-levels/cleric.js";
import { WARRIOR_PROGRESSION_LEVELS } from "./profession-levels/warrior.js";
import { MONK_PROGRESSION_LEVELS } from "./profession-levels/monk.js";
import { BARBARIAN_PROGRESSION_LEVELS } from "./profession-levels/barbarian.js";

// Registry hook for authoring professions one at a time. A missing table is
// deliberately reported as content-incomplete; the engine does not pretend a
// generated filler route is finished authored progression.
export const PROFESSION_LEVEL_TABLES = Object.freeze({
  wizard: WIZARD_PROGRESSION_LEVELS,
  sorcerer: SORCERER_PROGRESSION_LEVELS,
  cleric: CLERIC_PROGRESSION_LEVELS,
  fighter: WARRIOR_PROGRESSION_LEVELS,
  monk: MONK_PROGRESSION_LEVELS,
  barbarian: BARBARIAN_PROGRESSION_LEVELS,
});

export const PROFESSION_CONTENT_STATUS = Object.freeze({ wizard: "complete", sorcerer: "complete", cleric: "complete", fighter: "complete", monk: "complete", barbarian: "complete" });

export function professionLevelTable(professionId) {
  return PROFESSION_LEVEL_TABLES[professionId] || null;
}

export function professionContentStatus(professionId) {
  return PROFESSION_CONTENT_STATUS[professionId] || "content-incomplete";
}
