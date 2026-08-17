// Expert training: pay an expert trader a fee + time to fast-track a grindy
// proficiency by one rating step (proficiencies normally only grow through use).
// The session also earns global character XP; the player allocates any earned
// level afterward. Its trade-off is steep, rating-scaled coin and hours.

import { ratingFromXp, proficiencyName } from "../data/proficiencies.js";
import { advanceTime } from "./time.js";
import { ageState } from "./aging.js";
import { coinsToCopper, copperToCoins, canAfford } from "./economy.js";
import { advanceProgression, earnedLevelGrowthText, usesLegacyCharacterProgression } from "./progression.js";

// XP needed to reach a rating (ratingFromXp = floor(sqrt(xp/6)) → xp = 6·r²).
const xpForRating = (r) => 6 * r * r;

// The next training step for a proficiency, or { capped:true } if the expert
// can teach no further.
export function trainingOffer(state, profId, cap) {
  const xp = state.character.proficiencies?.[profId] || 0;
  const cur = ratingFromXp(xp);
  const next = cur + 1;
  const name = proficiencyName(profId);
  if (next > cap) return { profId, name, cur, capped: true };
  const xpGain = Math.max(1, xpForRating(next) - xp);
  return {
    profId, name, cur, next, xpGain, capped: false,
    costCp: 20 * next * next,   // 80 / 180 / 320 / 500 … rises sharply
    hours: 4 + next * 2,        // 6 / 8 / 10 / 12 … a session's length
  };
}

// Apply a training session: deduct the fee, add the XP, advance time.
export function applyTraining(state, profId, cap) {
  const offer = trainingOffer(state, profId, cap);
  if (offer.capped) return { state, ok: false, reason: "There's nothing more they can teach you." };
  if (!canAfford(state.character.inventory.coins, offer.costCp)) return { state, ok: false, reason: "Not enough coin." };
  const coins = copperToCoins(coinsToCopper(state.character.inventory.coins) - offer.costCp);
  const profs = { ...(state.character.proficiencies || {}) };
  profs[profId] = (profs[profId] || 0) + offer.xpGain;
  const time = advanceTime(state.time, offer.hours * 60);
  const ag = ageState({
    ...state,
    time,
    character: { ...state.character, proficiencies: profs, inventory: { ...state.character.inventory, coins } },
  });
  const next = ag.state;
  const usesLegacyProgression = usesLegacyCharacterProgression(next.character);
  if (usesLegacyProgression) {
    const progress = advanceProgression(next.character, offer.xpGain * 10);
    if (progress.earnedLevels > 0) {
      next.beats = [
        ...(next.beats || []),
        {
          id: `training-level-${Date.now()}`,
          type: "growth",
          text: earnedLevelGrowthText(progress),
        },
      ];
    }
  }
  const wanderer = next.world?.codex?.characters?.wanderer;
  if (wanderer && usesLegacyProgression && next.character.progression) {
    next.world = {
      ...next.world,
      codex: {
        ...next.world.codex,
        characters: {
          ...next.world.codex.characters,
          wanderer: {
            ...wanderer,
            profession: next.character.profession,
            archetype: next.character.archetype,
            attributes: { ...(next.character.attributes || {}) },
            progression: {
              ...next.character.progression,
              paths: { ...next.character.progression.paths },
            },
          },
        },
      },
    };
  }
  return { ok: true, offer, state: next };
}
