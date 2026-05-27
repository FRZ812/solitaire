// Slave market (The Block): Whitemarch's Chain Market Steps. The platform is
// open from dawn to dusk and closes at night (building hours live in town.js
// and are enforced by isBuildingOpen in App.jsx). The roster has two tiers:
//   HIGH-TIER (priceCp >= SLAVE_HIGH_TIER_MIN_CP) rotates DAILY — prime lots
//   paraded fresh each morning, the next coffle's faces. "Moving goods."
//   LOW-TIER lingers across SLAVE_LOW_REFRESH_DAYS — the broken old man, the
//   small attendant, the bargain spear-hand stay at the back of the platform
//   until someone takes them or the window rolls.
// Bought captives are removed from the visible roster for the rest of their
// per-tier window (per-tile persistence on state.world.tiles[tileKey].slavemarket).
// Buying is a coin transaction; the custody scene (keep in service / ransom
// home / sell on / force-release) is the narrator's, governed by THE BLOCK in
// src/system-prompt.js.

import { makeRng } from "./town-gen.js";
import { coinsToCopper, copperToCoins, canAfford } from "./economy.js";
import { getTile } from "./world.js";
import {
  CAPTIVE_POOL,
  SLAVE_HIGH_TIER_MIN_CP,
  SLAVE_LOW_REFRESH_DAYS,
} from "../data/slaves.js";

// One bucket per day — the high-tier roster rolls every morning.
export function slaveHighBucket(day) {
  return day || 0;
}

// Multi-day window for the low-tier — the same lingering faces stay on the
// platform until the window rolls.
export function slaveLowBucket(day) {
  return Math.floor((day || 0) / SLAVE_LOW_REFRESH_DAYS);
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

// How many faces of each tier the platform shows at once.
const HIGH_TIER_COUNT = 2;
const LOW_TIER_COUNT  = 3;

// Roll the auctioneer's lots for a tile/day. Two tiers, two cadences. Each tier
// carries its own bucket in the id so the bought-tracking on the tile survives
// day rollovers within the same window and resets when the window rotates.
export function generateSlaveMarket(tileKey, day) {
  const highBucket = slaveHighBucket(day);
  const lowBucket  = slaveLowBucket(day);
  const highPool = CAPTIVE_POOL.filter((c) => c.priceCp >= SLAVE_HIGH_TIER_MIN_CP);
  const lowPool  = CAPTIVE_POOL.filter((c) => c.priceCp <  SLAVE_HIGH_TIER_MIN_CP);
  const highRng = makeRng(`slaves:high:${tileKey}:${highBucket}`);
  const lowRng  = makeRng(`slaves:low:${tileKey}:${lowBucket}`);
  const high = pickN(highPool, HIGH_TIER_COUNT, highRng).map((c) => ({ ...c, tier: "high", id: `captive-high-${highBucket}-${c.key}` }));
  const low  = pickN(lowPool,  LOW_TIER_COUNT,  lowRng ).map((c) => ({ ...c, tier: "low",  id: `captive-low-${lowBucket}-${c.key}` }));
  return { highBucket, lowBucket, captives: [...high, ...low] };
}

// Read/refresh per-tier bought tracking on a tile. A record from a stale
// bucket is treated as empty — the previous window's captives moved on with
// the next coffle, and their bought-ness is irrelevant.
export function slaveMarketStateFor(tile, highBucket, lowBucket) {
  const high = (tile?.slavemarket?.high?.bucket === highBucket)
    ? { bucket: highBucket, bought: { ...tile.slavemarket.high.bought } }
    : { bucket: highBucket, bought: {} };
  const low = (tile?.slavemarket?.low?.bucket === lowBucket)
    ? { bucket: lowBucket, bought: { ...tile.slavemarket.low.bought } }
    : { bucket: lowBucket, bought: {} };
  return { high, low };
}

// Pay the auctioneer for a captive's bond. Deducts coin AND marks the captive
// as bought against the current per-tier window — so the same face does not
// reappear on the platform when the player re-opens the menu before the
// window rolls. The custody scene is the narrator's.
export function buyCaptive(state, c, tileKey) {
  if (!canAfford(state.character.inventory.coins, c.priceCp)) return { state, ok: false, reason: "Not enough coin." };
  const coins = copperToCoins(coinsToCopper(state.character.inventory.coins) - c.priceCp);
  const day = state.time?.day || 0;
  const highBucket = slaveHighBucket(day);
  const lowBucket  = slaveLowBucket(day);
  const [tx, ty] = tileKey.split(",").map(Number);
  const tiles = { ...state.world.tiles };
  const tile = tiles[tileKey] || getTile(state, tx, ty);
  const market = slaveMarketStateFor(tile, highBucket, lowBucket);
  if (c.tier === "high") market.high.bought[c.key] = true;
  else                    market.low.bought[c.key]  = true;
  tiles[tileKey] = { ...tile, slavemarket: market };
  return {
    ok: true,
    state: {
      ...state,
      character: { ...state.character, inventory: { ...state.character.inventory, coins } },
      world: { ...state.world, tiles },
    },
  };
}
