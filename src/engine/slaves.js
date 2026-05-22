// Slave market (The Block): deterministic auction roster + buying a captive's
// bond. Buying is a coin transaction; what follows — freeing them, pressing them
// to service, ransoming or reselling — is the custody scene the narrator plays.
// Distinct from the gaol (a lawful warden); this is the grim trade of a rougher
// town, and it lives in Crowsmoor, never in the player's home of Mirecross.

import { makeRng } from "./town-gen.js";
import { coinsToCopper, copperToCoins, canAfford } from "./economy.js";
import { CAPTIVE_POOL, SLAVE_REFRESH_DAYS } from "../data/slaves.js";

export function slaveBucket(day) {
  return Math.floor((day || 0) / SLAVE_REFRESH_DAYS);
}

function pickN(pool, n, rng) {
  const avail = pool.slice();
  const out = [];
  for (let k = 0; k < n && avail.length; k++) {
    const idx = Math.floor(rng() * avail.length);
    out.push(avail[idx]);
    avail.splice(idx, 1);
  }
  return out;
}

// Roll the auctioneer's lots for a tile/day. Stable within a refresh window; ids
// derive from the window so buying dedupes and re-renders are stable.
export function generateSlaveMarket(tileKey, day) {
  const bucket = slaveBucket(day);
  const rng = makeRng(`slaves:${tileKey}:${bucket}`);
  const captives = pickN(CAPTIVE_POOL, 4, rng).map((c) => ({ ...c, id: `captive-${bucket}-${c.key}` }));
  return { bucket, captives };
}

// Pay the auctioneer for a captive's bond. Deducts coin; the custody scene that
// follows (free / press to service / ransom / resell) is left to the narrator.
export function buyCaptive(state, c) {
  if (!canAfford(state.character.inventory.coins, c.priceCp)) return { state, ok: false, reason: "Not enough coin." };
  const coins = copperToCoins(coinsToCopper(state.character.inventory.coins) - c.priceCp);
  return { ok: true, state: { ...state, character: { ...state.character, inventory: { ...state.character.inventory, coins } } } };
}
