// Interactable battlefield features for dynamic combat — flip a table for cover,
// hurl a stool, topple a log, kick over a brazier. Generated per fight from the
// terrain you're standing in. Each feature has limited uses.
//
// Action types resolved by the combat engine (playerUseEnvironment):
//   cover  — temporary armour for you (guard)
//   throw  — damage one foe, may stagger (stun)
//   topple — knock a foe down (stun) + light damage
//   hazard — area damage to all foes + a lingering burn
//   shove  — heavy damage to one foe + stun (ledges, boulders)

const F = (id, name, icon, action, uses = 1) => ({ id, name, icon, action, uses });

// Pools by terrain. A fight draws a small random subset.
const POOLS = {
  settlement: [
    F("table", "Flip a table", "shield", { type: "cover", armor: 6, dur: 2 }),
    F("stool", "Hurl a stool", "swords", { type: "throw", dmg: [3, 6], stunChance: 0.35 }),
    F("brazier", "Kick over the brazier", "flame", { type: "hazard", dmg: [3, 5], dot: { type: "poison", value: 3, duration: 3 } }),
  ],
  indoor: [
    F("table", "Flip a table", "shield", { type: "cover", armor: 6, dur: 2 }),
    F("hearth", "Scatter the hearth-coals", "flame", { type: "hazard", dmg: [4, 6], dot: { type: "poison", value: 3, duration: 3 } }),
    F("crockery", "Throw the crockery", "swords", { type: "throw", dmg: [2, 5], stunChance: 0.4 }),
  ],
  forest: [
    F("log", "Roll a deadfall log", "swords", { type: "topple", dmg: [3, 6], stun: 1 }),
    F("rock", "Throw a stone", "swords", { type: "throw", dmg: [3, 6], stunChance: 0.3 }),
    F("hive", "Break a wasp-nest", "droplet", { type: "hazard", dmg: [1, 3], dot: { type: "poison", value: 4, duration: 3 } }),
  ],
  hills: [
    F("boulder", "Shove a boulder", "swords", { type: "shove", dmg: [7, 12], stun: 1 }),
    F("scree", "Trigger a scree-slide", "swords", { type: "topple", dmg: [4, 7], stun: 1 }),
  ],
  mountains: [
    F("boulder", "Topple a boulder", "swords", { type: "shove", dmg: [8, 14], stun: 1 }),
    F("rockfall", "Loose a rockfall", "swords", { type: "hazard", dmg: [4, 7], dot: null }),
  ],
  marsh: [
    F("deadfall", "Drop a deadfall branch", "swords", { type: "topple", dmg: [3, 6], stun: 1 }),
    F("mud", "Sling a fistful of mud", "droplet", { type: "throw", dmg: [1, 2], stunChance: 0.6 }),
  ],
  plains: [
    F("cart", "Tip a cart", "shield", { type: "cover", armor: 5, dur: 2 }),
    F("stone", "Throw a field-stone", "swords", { type: "throw", dmg: [3, 6], stunChance: 0.3 }),
  ],
  road: [
    F("cart", "Tip a wagon", "shield", { type: "cover", armor: 5, dur: 2 }),
    F("lantern", "Smash a road-lantern", "flame", { type: "hazard", dmg: [3, 5], dot: { type: "poison", value: 3, duration: 2 } }),
  ],
};
const DEFAULT_POOL = [
  F("rock", "Throw a stone", "swords", { type: "throw", dmg: [3, 6], stunChance: 0.3 }),
  F("ground", "Kick up dirt", "droplet", { type: "throw", dmg: [1, 2], stunChance: 0.5 }),
];

function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }

// 1–3 features for this terrain, each given a fresh instance id so uses track.
export function generateEnvironment(terrain) {
  const pool = POOLS[terrain] || DEFAULT_POOL;
  const n = Math.min(pool.length, 1 + Math.floor(Math.random() * 3));
  return shuffle(pool).slice(0, n).map((f, i) => ({ ...f, id: `${f.id}-${i}`, action: { ...f.action } }));
}
