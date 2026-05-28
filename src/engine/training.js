// Expert training: pay an expert trader a fee + time to fast-track a grindy
// proficiency by one rating step (proficiencies normally only grow through use).
// Proficiency XP also feeds its governing attribute, so paid training nudges
// attributes too — the trade-off is steep, rating-scaled coin and hours.

import { ratingFromXp, proficiencyName } from "../data/proficiencies.js";
import { advanceTime } from "./time.js";
import { ageState } from "./aging.js";
import { coinsToCopper, copperToCoins, canAfford } from "./economy.js";

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
  return { ok: true, offer, state: ag.state };
}
