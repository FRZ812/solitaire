// Gaol: deterministic wanted-board + cells generation, taking a bounty, and
// buying a prisoner's rights. Bounties are tracked as quests (world.quests,
// type "bounty") and settled by the narrator on delivery — dead or alive. Buying
// rights is a coin transaction; the custody scene that follows is narrated.

import { makeRng } from "./town-gen.js";
import { coinsToCopper, copperToCoins, canAfford } from "./economy.js";
import { WANTED_POOL, PRISONER_POOL, GAOL_REFRESH_DAYS } from "../data/gaol.js";

export function gaolBucket(day) {
  return Math.floor((day || 0) / GAOL_REFRESH_DAYS);
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

// Roll the warden's board for a tile/day. Stable within a refresh window; ids
// derive from the window so taking a bounty dedupes and re-renders are stable.
export function generateGaol(tileKey, day) {
  const bucket = gaolBucket(day);
  const rng = makeRng(`gaol:${tileKey}:${bucket}`);
  const bounties = pickN(WANTED_POOL, 4, rng).map((b) => ({ ...b, id: `bounty-${bucket}-${b.key}` }));
  const prisoners = pickN(PRISONER_POOL, 4, rng).map((p) => ({ ...p, id: `prisoner-${bucket}-${p.key}` }));
  return { bucket, bounties, prisoners };
}

// Take a bounty contract — tracked as an active quest the narrator can settle on
// delivery (rewardCp = alive, rewardDeadCp = dead).
export function acceptBounty(state, b) {
  const quests = state.world.quests || [];
  if (quests.some((q) => q.id === b.id)) return { state, ok: false, reason: "Already taken." };
  const q = {
    id: b.id, title: `Bounty: ${b.name}`, giver: "the warden", type: "bounty",
    target: b.name, crime: b.crime, desc: b.desc,
    rewardCp: b.rewardAliveCp, rewardDeadCp: b.rewardDeadCp,
    loc: b.target || null, locName: b.targetName || null, // last-seen haunt for the map
    day: state.time.day, status: "active",
  };
  return { ok: true, state: { ...state, world: { ...state.world, quests: [...quests, q] } } };
}

// Pay the warden for a prisoner's rights. Deducts coin; the custody scene that
// follows is left to the narrator.
export function buyPrisonerRights(state, p) {
  if (!canAfford(state.character.inventory.coins, p.rightsCp)) return { state, ok: false, reason: "Not enough coin." };
  const coins = copperToCoins(coinsToCopper(state.character.inventory.coins) - p.rightsCp);
  return { ok: true, state: { ...state, character: { ...state.character, inventory: { ...state.character.inventory, coins } } } };
}
