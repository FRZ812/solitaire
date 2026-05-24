// Mounts — rideable companions, from a stable pony to a true dragon. A mount is a
// full codex character (kind:"mount") filed into world.codex.characters and listed
// in state.party, EXACTLY like a recruited companion (data/companions.js): it
// travels with you, eats and tires (its own `feed`), fights at your side, and
// persists. What sets a mount apart is the mount block:
//
//   • bodyWeight   — its own mass; what it weighs as CARGO when IT rides a bigger
//                    mount (a horse on a dragon). (engine/weight.js)
//   • rideCapacity — the WEIGHT it can bear. Riders (people, gear, even smaller
//                    mounts) stack onto it up to this; headcount never matters, so
//                    you can't cram ten people onto one horse. (engine/riding.js)
//   • moveProfile  — { ground (travel-speed factor), canFly, terrain[] }.
//   • feed         — what it eats from the pack ("fodder"/"meat"/"livestock").
//
// COMBAT comes for free: a mount carries the same combat-kit fields a designed
// creature does (naturalWeapon/naturalArmor/naturalWard/innatePassives/health/
// actionsPerTurn/abilities — see the dragon NPC in initial-state.js), which
// enemyFromNPC → allyFromCompanion (data/bestiary.js) already consume. A ridden
// mount also lends its rider a `mountedBonus` in a fight (engine/combat.js).
//
// ACQUISITION: mundane mounts (`acquisition:"stable"`) are bought at a stable
// (engine/economy.buyMount); exotic/flying ones are EARNED — tamed, quest-won, or
// story-gifted — and granted by the narrator via beat.grant_mount (engine/beat.js).

import { resolvePoolForMind } from "../engine/attributes.js";

const hoof = (min, max, pen = 0) => ({ min, max, type: "physical", pen, category: "hoof", reach: 1, speed: 0, acc: 0 });
const fang = (min, max, pen = 1) => ({ min, max, type: "physical", pen, category: "fang", reach: 1, speed: 0, acc: 1 });
const talon = (min, max, pen = 2) => ({ min, max, type: "physical", pen, category: "claw", reach: 1, speed: 0, acc: 1 });

export const MOUNTS = {
  // ============================================================
  // MUNDANE — bought at a stable
  // ============================================================
  pony: {
    id: "pony", kind: "mount", name: "Pony", race: "pony", tier: "common",
    desc: "A shaggy, sure-footed pony — cheap, placid, and tireless on a good road.",
    bodyWeight: 45, rideCapacity: 95, feed: "fodder", acquisition: "stable", priceCp: 250,
    moveProfile: { ground: 1.3, canFly: false, terrain: ["plains", "road", "hills", "settlement"], graze: ["plains", "hills"] },
    attributes: { body: 3, reflex: 3, vigor: 3, mind: 0, wit: 2, presence: 1 },
    health: 24, naturalWeapon: hoof(2, 4), abilities: [],
    mountedBonus: { accuracy: 0, damageMult: 0, reach: 0, dodge: 0, speed: 1 },
  },
  horse: {
    id: "horse", kind: "mount", name: "Riding Horse", race: "horse", tier: "common",
    desc: "A steady saddle-horse — the traveller's standard, swift on open ground.",
    bodyWeight: 70, rideCapacity: 150, feed: "fodder", acquisition: "stable", priceCp: 500,
    moveProfile: { ground: 1.8, canFly: false, terrain: ["plains", "road", "hills", "settlement"], graze: ["plains", "hills"] },
    attributes: { body: 4, reflex: 3, vigor: 4, mind: 0, wit: 2, presence: 1 },
    health: 34, naturalWeapon: hoof(3, 5), abilities: [],
    mountedBonus: { accuracy: 1, damageMult: 0.05, reach: 0, dodge: 0, speed: 2 },
  },
  mule: {
    id: "mule", kind: "mount", name: "Pack Mule", race: "mule", tier: "common",
    desc: "A stubborn, immensely strong pack-mule — slow, but it hauls a fortune in stores.",
    bodyWeight: 60, rideCapacity: 175, feed: "fodder", acquisition: "stable", priceCp: 200,
    moveProfile: { ground: 1.2, canFly: false, terrain: ["plains", "road", "hills", "mountains", "settlement"], graze: ["plains", "hills"] },
    attributes: { body: 4, reflex: 2, vigor: 5, mind: 0, wit: 2, presence: 1 },
    health: 32, naturalWeapon: hoof(2, 5), abilities: [],
    mountedBonus: { accuracy: 0, damageMult: 0, reach: 0, dodge: -1, speed: 1 },
  },
  camel: {
    id: "camel", kind: "mount", name: "Camel", race: "camel", tier: "uncommon",
    desc: "A spitting, water-thrifty camel — born for dry country where horses founder.",
    bodyWeight: 75, rideCapacity: 175, feed: "fodder", acquisition: "stable", priceCp: 450,
    moveProfile: { ground: 1.6, canFly: false, terrain: ["plains", "road", "desert", "hills"], graze: ["desert", "plains"] },
    attributes: { body: 5, reflex: 2, vigor: 6, mind: 0, wit: 2, presence: 1 },
    health: 40, naturalWeapon: hoof(3, 5), abilities: [],
    mountedBonus: { accuracy: 0, damageMult: 0, reach: 0, dodge: 0, speed: 1 },
  },
  warhorse: {
    id: "warhorse", kind: "mount", name: "Destrier", race: "horse", tier: "rare",
    desc: "A barded warhorse trained to the charge — it tramples a shield-wall and does not shy from blood.",
    bodyWeight: 95, rideCapacity: 195, feed: "fodder", acquisition: "stable", priceCp: 4500,
    moveProfile: { ground: 2.0, canFly: false, terrain: ["plains", "road", "hills", "settlement"], graze: ["plains"] },
    attributes: { body: 7, reflex: 4, vigor: 7, mind: 1, wit: 3, presence: 2 },
    health: 64, naturalArmor: 1, naturalWeapon: hoof(5, 9, 1), abilities: ["power-strike"],
    mountedBonus: { accuracy: 2, damageMult: 0.18, reach: 1, dodge: 0, speed: 2 },
  },

  // ============================================================
  // EXOTIC — earned (tamed / quest / story). Granted via beat.grant_mount.
  // ============================================================
  "dire-wolf": {
    id: "dire-wolf", kind: "mount", name: "Dire Wolf", race: "warg", tier: "rare",
    desc: "A horse-sized wolf, bonded and saddled — silent in forest and hill where no horse can follow.",
    bodyWeight: 55, rideCapacity: 130, feed: "meat", acquisition: "tame",
    moveProfile: { ground: 2.3, canFly: false, terrain: ["forest", "hills", "mountains", "plains", "marsh"], graze: [] },
    attributes: { body: 6, reflex: 6, vigor: 5, mind: 1, wit: 4, presence: 2 },
    health: 50, naturalWeapon: fang(5, 8, 1), abilities: ["rend", "rapid-jabs"],
    mountedBonus: { accuracy: 2, damageMult: 0.12, reach: 0, dodge: 3, speed: 3 },
  },
  griffon: {
    id: "griffon", kind: "mount", name: "Griffon", race: "gryphon", tier: "epic",
    desc: "An eagle-lion of the high crags, broken to the saddle — the first true wing a rider earns.",
    bodyWeight: 160, rideCapacity: 220, feed: "meat", acquisition: "tame",
    moveProfile: { ground: 1.6, canFly: true, terrain: "any", graze: [] },
    attributes: { body: 9, reflex: 8, vigor: 7, mind: 2, wit: 5, presence: 4 },
    health: 84, naturalArmor: 2, naturalWeapon: talon(7, 12, 2), abilities: ["power-strike", "rend"],
    mountedBonus: { accuracy: 3, damageMult: 0.2, reach: 1, dodge: 4, speed: 3 },
  },
  wyvern: {
    id: "wyvern", kind: "mount", name: "Wyvern", race: "wyvern", tier: "legendary",
    desc: "A venom-stinged wyvern, half-tamed and always testing the bond — a killer that happens to carry you.",
    bodyWeight: 240, rideCapacity: 300, feed: "livestock", acquisition: "quest",
    moveProfile: { ground: 1.8, canFly: true, terrain: "any", graze: [] },
    attributes: { body: 12, reflex: 9, vigor: 10, mind: 3, wit: 6, presence: 6 },
    health: 130, naturalArmor: 3, naturalWard: 1, naturalWeapon: fang(8, 13, 3),
    innatePassives: [{ id: "savage", tier: "legendary" }],
    abilities: ["power-strike", "rend", "venom-strike"],
    mountedBonus: { accuracy: 3, damageMult: 0.25, reach: 1, dodge: 3, speed: 4 },
  },
  drake: {
    id: "drake", kind: "mount", name: "Fire-Drake", race: "drakeborn", tier: "mythical",
    desc: "A lesser dragon of the old blood — it breathes fire, bears a rider into legend, and is courted, never bought.",
    bodyWeight: 600, rideCapacity: 450, feed: "livestock", acquisition: "quest",
    moveProfile: { ground: 2.0, canFly: true, terrain: "any", graze: [] },
    attributes: { body: 16, reflex: 10, vigor: 16, mind: 6, wit: 10, presence: 12 },
    health: 280, actionsPerTurn: 1, naturalArmor: 3, naturalWard: 2, naturalWeapon: fang(3, 5, 3),
    innatePassives: [{ id: "savage", tier: "mythical" }, { id: "juggernaut", tier: "mythical" }],
    abilities: ["firebolt", "power-strike", "beast-shift"],
    mountedBonus: { accuracy: 4, damageMult: 0.3, reach: 2, dodge: 2, speed: 4 },
  },
  dragon: {
    id: "dragon", kind: "mount", name: "Dragon", race: "dragon", tier: "divine",
    desc: "A true wyrm that has chosen to bear you — the apex mount, a moving disaster the world points at and dreads.",
    bodyWeight: 1500, rideCapacity: 900, feed: "livestock", acquisition: "narrative",
    moveProfile: { ground: 2.2, canFly: true, terrain: "any", graze: [] },
    attributes: { body: 20, reflex: 14, vigor: 24, mind: 8, wit: 12, presence: 18 },
    health: 420, actionsPerTurn: 2, naturalArmor: 3, naturalWard: 3,
    naturalWeapon: { min: 3, max: 5, type: "physical", pen: 4, category: "fang", reach: 2, speed: 0, acc: 2 },
    innatePassives: [
      { id: "worldbreaker", tier: "divine" },
      { id: "godward", tier: "divine" },
      { id: "juggernaut", tier: "divine" },
      { id: "sunder", tier: "divine" },
      { id: "savage", tier: "mythical" },
    ],
    abilities: ["dragon-breath", "beast-shift"],
    mountedBonus: { accuracy: 5, damageMult: 0.4, reach: 2, dodge: 2, speed: 5 },
  },
};

export const MOUNT_LIST = Object.values(MOUNTS);

export function mountTemplate(id) {
  return MOUNTS[id] || null;
}

export function isMountId(id) {
  return !!MOUNTS[id];
}

// A flyer can carry a rider aloft as a travel mode (engine/fly + App.handleFly).
export function isFlyer(m) {
  return !!m?.moveProfile?.canFly;
}

// The mounts a stable will sell (mundane only). Used by data/town.js stock.
export const STABLE_MOUNTS = MOUNT_LIST.filter((m) => m.acquisition === "stable");

// The full codex-character entry for a mount — same scaffolding as a recruited
// companion (companionCodexEntry), plus the mount block and riding linkage.
export function mountCodexEntry(tmpl) {
  return {
    id: tmpl.id, kind: "mount",
    name: tmpl.name, race: tmpl.race, profession: "mount", origin: null,
    description: tmpl.desc, attributes: tmpl.attributes,
    worn: [], knows: [],
    // Mounts hunger, thirst, and tire like companions — drained on the road and
    // fed from the pack's FODDER/MEAT (engine/upkeep.js), not the party's rations.
    needs: { hunger: 75, thirst: 80, sleep: 80 },
    resolve: resolvePoolForMind(tmpl.attributes?.mind || 0),
    resolveMax: resolvePoolForMind(tmpl.attributes?.mind || 0),
    // The mount block.
    bodyWeight: tmpl.bodyWeight, rideCapacity: tmpl.rideCapacity,
    moveProfile: tmpl.moveProfile, feed: tmpl.feed, tier: tmpl.tier,
    mountedBonus: tmpl.mountedBonus || null,
    // Combat kit (consumed by enemyFromNPC → allyFromCompanion).
    health: tmpl.health, actionsPerTurn: tmpl.actionsPerTurn,
    naturalWeapon: tmpl.naturalWeapon, naturalArmor: tmpl.naturalArmor, naturalWard: tmpl.naturalWard,
    innatePassives: tmpl.innatePassives || [], abilities: [...(tmpl.abilities || [])],
    // Riding linkage (engine/riding.js): what this mount rides, and who rides it.
    ridingOn: null, riders: [],
    relationship: 0, memories: [],
  };
}
