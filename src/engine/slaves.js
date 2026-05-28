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
  SLAVE_LOW_DAILY_DISCOUNT,
  SLAVE_LOW_PRICE_FLOOR_PCT,
  SLAVE_LOW_OFFSCREEN_SALE_RATE,
} from "../data/slaves.js";

// The Chain Factor's price drop for a low-tier captive that has lingered N days.
// Floors at SLAVE_LOW_PRICE_FLOOR_PCT of the original — even the auctioneer has
// a bottom line.
function decayedPrice(originalCp, daysLingering) {
  const factor = Math.max(SLAVE_LOW_PRICE_FLOOR_PCT, 1 - daysLingering * SLAVE_LOW_DAILY_DISCOUNT);
  return Math.max(1, Math.round(originalCp * factor));
}

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

  const windowStartDay = lowBucket * SLAVE_LOW_REFRESH_DAYS;
  const daysLingering = Math.max(0, (day || 0) - windowStartDay);
  const low = pickN(lowPool, LOW_TIER_COUNT, lowRng).map((c) => {
    const originalCp = c.priceCp;
    // Off-screen demand is pulled by BOTH appearance (the Block's four-factor
    // appraisal weighs looks AS HEAVILY as skill) and price-as-proxy-for-
    // desirability. Take the max so a striking low-priced captive still gets
    // snapped up, not the average — matches the doctrine in src/data/slaves.js.
    const apprDesir  = c.attractiveness ? (c.attractiveness / 10) : 0.5;
    const priceDesir = Math.min(1.0, originalCp / SLAVE_HIGH_TIER_MIN_CP);
    const desirability = Math.max(apprDesir, priceDesir);
    // Did another buyer snap them up off-screen on a prior night within this
    // window? Roll once per night that has passed since arrival, using the
    // discount visible on that day. The first night-roll uses arrival-day
    // (zero discount, zero chance) — kept in the loop for symmetry.
    let soldOffscreen = false;
    let soldOnDay = null;
    for (let dayN = 0; dayN < daysLingering; dayN++) {
      const priceOnDayN = decayedPrice(originalCp, dayN);
      const discount = 1 - (priceOnDayN / originalCp);
      if (discount <= 0) continue;
      const chance = desirability * discount * SLAVE_LOW_OFFSCREEN_SALE_RATE;
      const offRng = makeRng(`slaves:offscreen:${tileKey}:${lowBucket}:${c.key}:${dayN}`);
      if (offRng() < chance) {
        soldOffscreen = true;
        soldOnDay = windowStartDay + dayN;
        break;
      }
    }
    const currentCp = decayedPrice(originalCp, daysLingering);
    return {
      ...c,
      tier: "low",
      id: `captive-low-${lowBucket}-${c.key}`,
      priceCp: currentCp,
      originalPriceCp: originalCp,
      daysLingering,
      soldOffscreen,
      soldOnDay,
    };
  }).filter((c) => !c.soldOffscreen);

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

// Mark a captive as bought on the tile's slavemarket per-tier record. Used
// both by the legacy buyCaptive path and by the new inspect-haggle-settle
// flow (the narrator's purchase_captive beat in engine/beat.js, which deducts
// the agreed coin and adds the bonded codex entry to the party — this helper
// keeps the captive off the platform when the player reopens the view).
export function markCaptiveBought(state, c, tileKey) {
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
  return { ...state, world: { ...state.world, tiles } };
}

// Pay the auctioneer for a captive's bond. Deducts coin AND marks the captive
// as bought against the current per-tier window — so the same face does not
// reappear on the platform when the player re-opens the menu before the
// window rolls. The custody scene is the narrator's.
export function buyCaptive(state, c, tileKey) {
  if (!canAfford(state.character.inventory.coins, c.priceCp)) return { state, ok: false, reason: "Not enough coin." };
  const coins = copperToCoins(coinsToCopper(state.character.inventory.coins) - c.priceCp);
  const withMark = markCaptiveBought(state, c, tileKey);
  return {
    ok: true,
    state: {
      ...withMark,
      character: { ...withMark.character, inventory: { ...withMark.character.inventory, coins } },
    },
  };
}
