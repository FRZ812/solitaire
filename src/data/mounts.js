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
// mount also lends its rider a `mountedBonus` in a fight (the combat kernel).
//
// ACQUISITION: mundane mounts (`acquisition:"stable"`) are haggled for at a stable
// (beat.buy_mount); exotic/flying ones are EARNED — tamed, quest-won, or
// story-gifted — and granted by the narrator via beat.grant_mount (engine/beat.js).

import { resolvePoolForMind, carryCapacityFor } from "../engine/attributes.js";
import { normalizeCharacterProgression } from "../engine/progression.js";

const hoof = (min, max, pen = 0) => ({ min, max, type: "physical", pen, category: "hoof", reach: 1, speed: 0, acc: 0 });
const fang = (min, max, pen = 1) => ({ min, max, type: "physical", pen, category: "fang", reach: 1, speed: 0, acc: 1 });
const talon = (min, max, pen = 2) => ({ min, max, type: "physical", pen, category: "claw", reach: 1, speed: 0, acc: 1 });
const gore = (min, max, pen = 1) => ({ min, max, type: "physical", pen, category: "horn", reach: 1, speed: 0, acc: 0 });
const beak = (min, max, pen = 1) => ({ min, max, type: "physical", pen, category: "beak", reach: 1, speed: 0, acc: 1 });

export const MOUNTS = {
  // ============================================================
  // MUNDANE — bought at a stable
  // ============================================================
  pony: {
    id: "pony", kind: "mount", name: "Pony", race: "pony", tier: "common",
    desc: "A shaggy, sure-footed pony — cheap, placid, and tireless on a good road.",
    bodyWeight: 45, rideCapacity: 32, feed: "fodder", acquisition: "stable", priceCp: 250, needsDecayMult: 0.9,
    moveProfile: { ground: 1.3, canFly: false, terrain: ["plains", "road", "hills", "settlement"], graze: ["plains", "hills"] },
    attributes: { body: 3, reflex: 3, vigor: 3, mind: 0, wit: 2, presence: 1 },
    health: 24, naturalWeapon: hoof(2, 4), abilities: [],
    mountedBonus: { accuracy: 0, damageMult: 0, reach: 0, dodge: 0, speed: 1 },
  },
  horse: {
    id: "horse", kind: "mount", name: "Riding Horse", race: "horse", tier: "common",
    desc: "A steady saddle-horse — the traveller's standard, swift on open ground.",
    bodyWeight: 70, rideCapacity: 40, feed: "fodder", acquisition: "stable", priceCp: 500, needsDecayMult: 0.85,
    moveProfile: { ground: 1.8, canFly: false, terrain: ["plains", "road", "hills", "settlement"], graze: ["plains", "hills"] },
    attributes: { body: 4, reflex: 3, vigor: 4, mind: 0, wit: 2, presence: 1 },
    health: 34, naturalWeapon: hoof(3, 5), abilities: [],
    mountedBonus: { accuracy: 1, damageMult: 0.05, reach: 0, dodge: 0, speed: 2 },
  },
  mule: {
    id: "mule", kind: "mount", name: "Pack Mule", race: "mule", tier: "common",
    desc: "A stubborn, immensely strong pack-mule — slow, but it hauls a fortune in stores.",
    bodyWeight: 60, rideCapacity: 44, feed: "fodder", acquisition: "stable", priceCp: 200, needsDecayMult: 0.7,
    moveProfile: { ground: 1.2, canFly: false, terrain: ["plains", "road", "hills", "mountains", "settlement"], graze: ["plains", "hills"] },
    attributes: { body: 4, reflex: 2, vigor: 5, mind: 0, wit: 2, presence: 1 },
    health: 32, naturalWeapon: hoof(2, 5), abilities: [],
    mountedBonus: { accuracy: 0, damageMult: 0, reach: 0, dodge: -1, speed: 1 },
  },
  camel: {
    id: "camel", kind: "mount", name: "Camel", race: "camel", tier: "uncommon",
    desc: "A spitting, water-thrifty camel — born for dry steppe and badland where horses founder.",
    bodyWeight: 75, rideCapacity: 46, feed: "fodder", acquisition: "stable", priceCp: 450, needsDecayMult: 0.6,
    moveProfile: { ground: 1.6, canFly: false, terrain: ["plains", "road", "hills"], graze: ["plains", "hills"] },
    attributes: { body: 5, reflex: 2, vigor: 6, mind: 0, wit: 2, presence: 1 },
    health: 40, naturalWeapon: hoof(3, 5), abilities: [],
    mountedBonus: { accuracy: 0, damageMult: 0, reach: 0, dodge: 0, speed: 1 },
  },
  warhorse: {
    id: "warhorse", kind: "mount", name: "Destrier", race: "horse", tier: "rare",
    desc: "A barded warhorse trained to the charge — it tramples a shield-wall and does not shy from blood.",
    bodyWeight: 95, rideCapacity: 46, feed: "fodder", acquisition: "stable", priceCp: 4500, needsDecayMult: 0.95,
    moveProfile: { ground: 2.0, canFly: false, terrain: ["plains", "road", "hills", "settlement"], graze: ["plains"] },
    attributes: { body: 7, reflex: 4, vigor: 7, mind: 1, wit: 3, presence: 2 },
    health: 64, naturalArmor: 1, naturalWeapon: hoof(5, 9, 1), abilities: ["power-strike"],
    mountedBonus: { accuracy: 2, damageMult: 0.18, reach: 1, dodge: 0, speed: 2 },
  },
  nag: {
    id: "nag", kind: "mount", name: "Swamp Nag", race: "horse", tier: "common",
    desc: "A swaybacked, bog-bred nag — cheap, plodding, and unbothered by mud. The poorest stable's best.",
    bodyWeight: 60, rideCapacity: 36, feed: "fodder", acquisition: "stable", priceCp: 120, needsDecayMult: 1.1,
    moveProfile: { ground: 1.3, canFly: false, terrain: ["plains", "road", "marsh", "hills", "settlement"], graze: ["plains", "marsh", "hills"] },
    attributes: { body: 3, reflex: 2, vigor: 3, mind: 0, wit: 2, presence: 0 },
    health: 22, naturalWeapon: hoof(2, 4), abilities: [],
    mountedBonus: { accuracy: 0, damageMult: 0, reach: 0, dodge: 0, speed: 1 },
  },
  "marsh-pony": {
    id: "marsh-pony", kind: "mount", name: "Fen Pony", race: "pony", tier: "common",
    desc: "A wetland pony that crosses reed and bog where a plains-horse founders.",
    bodyWeight: 45, rideCapacity: 32, feed: "fodder", acquisition: "stable", priceCp: 220, needsDecayMult: 0.9,
    moveProfile: { ground: 1.3, canFly: false, terrain: ["marsh", "forest", "hills", "plains", "road", "settlement"], graze: ["marsh", "hills", "plains"] },
    attributes: { body: 3, reflex: 3, vigor: 3, mind: 0, wit: 2, presence: 1 },
    health: 24, naturalWeapon: hoof(2, 4), abilities: [],
    mountedBonus: { accuracy: 0, damageMult: 0, reach: 0, dodge: 1, speed: 1 },
  },
  "ridge-pony": {
    id: "ridge-pony", kind: "mount", name: "Ridge Pony", race: "pony", tier: "common",
    desc: "A stocky, sure-footed pony of the high country — placid, long-lived, and tireless on a climb.",
    bodyWeight: 50, rideCapacity: 32, feed: "fodder", acquisition: "stable", priceCp: 300, needsDecayMult: 0.8,
    moveProfile: { ground: 1.4, canFly: false, terrain: ["hills", "mountains", "plains", "road", "settlement"], graze: ["hills", "mountains", "plains"] },
    attributes: { body: 4, reflex: 3, vigor: 4, mind: 0, wit: 2, presence: 1 },
    health: 28, naturalWeapon: hoof(2, 5), abilities: [],
    mountedBonus: { accuracy: 0, damageMult: 0, reach: 0, dodge: 0, speed: 1 },
  },
  courser: {
    id: "courser", kind: "mount", name: "Courser", race: "horse", tier: "rare",
    desc: "A highbred courser — long-striding, deep-winded, and tireless; the pride of a great human stable.",
    bodyWeight: 75, rideCapacity: 38, feed: "fodder", acquisition: "stable", priceCp: 5500, needsDecayMult: 0.55,
    moveProfile: { ground: 2.4, canFly: false, terrain: ["plains", "road", "hills", "settlement"], graze: ["plains", "hills"] },
    attributes: { body: 5, reflex: 5, vigor: 6, mind: 1, wit: 3, presence: 3 },
    health: 50, naturalWeapon: hoof(4, 7), abilities: [],
    mountedBonus: { accuracy: 2, damageMult: 0.1, reach: 0, dodge: 2, speed: 4 },
  },
  "war-stag": {
    id: "war-stag", kind: "mount", name: "War-Stag", race: "stag", tier: "uncommon",
    desc: "A great antlered war-stag, broken to the saddle by the wood-cults — it gores a line and bears a heavy load.",
    bodyWeight: 90, rideCapacity: 54, feed: "fodder", acquisition: "stable", priceCp: 900, needsDecayMult: 0.9,
    moveProfile: { ground: 1.7, canFly: false, terrain: ["forest", "hills", "plains", "marsh", "road"], graze: ["forest", "plains", "hills"] },
    attributes: { body: 5, reflex: 5, vigor: 5, mind: 1, wit: 3, presence: 2 },
    health: 44, naturalWeapon: gore(4, 7, 1), abilities: ["power-strike"],
    mountedBonus: { accuracy: 1, damageMult: 0.12, reach: 1, dodge: 1, speed: 2 },
  },
  "fen-strider": {
    id: "fen-strider", kind: "mount", name: "Fen-Strider", race: "salamander", tier: "uncommon",
    desc: "A horse-broad giant salamander — the only saddle-beast that swims as well as it wades; it eats meat.",
    bodyWeight: 120, rideCapacity: 44, feed: "meat", acquisition: "stable", priceCp: 1100, needsDecayMult: 1.1,
    moveProfile: { ground: 1.5, canFly: false, terrain: ["marsh", "water", "forest", "plains"], graze: [] },
    attributes: { body: 6, reflex: 4, vigor: 6, mind: 1, wit: 2, presence: 2 },
    health: 52, naturalArmor: 1, naturalWeapon: fang(4, 7, 1), abilities: ["power-strike"],
    mountedBonus: { accuracy: 0, damageMult: 0.08, reach: 0, dodge: 2, speed: 1 },
  },
  "mountain-ram": {
    id: "mountain-ram", kind: "mount", name: "Greathorn Ram", race: "ram", tier: "rare",
    desc: "A massive curl-horned ram for true mountain country — it charges a foe off a ledge and never slips.",
    bodyWeight: 110, rideCapacity: 46, feed: "fodder", acquisition: "stable", priceCp: 2800, needsDecayMult: 0.9,
    moveProfile: { ground: 1.6, canFly: false, terrain: ["mountains", "hills", "plains", "road"], graze: ["mountains", "hills"] },
    attributes: { body: 7, reflex: 4, vigor: 7, mind: 1, wit: 3, presence: 2 },
    health: 60, naturalArmor: 1, naturalWeapon: gore(5, 9, 1), abilities: ["power-strike"],
    mountedBonus: { accuracy: 1, damageMult: 0.16, reach: 0, dodge: 0, speed: 2 },
  },
  "axe-beak": {
    id: "axe-beak", kind: "mount", name: "Axe-Beak", race: "axe-beak", tier: "rare",
    desc: "A flightless giant bird, hatchet-beaked and fast as a galloping horse — the steppe-riders' killer.",
    bodyWeight: 80, rideCapacity: 38, feed: "meat", acquisition: "stable", priceCp: 3200, needsDecayMult: 1.15,
    moveProfile: { ground: 2.2, canFly: false, terrain: ["plains", "hills", "forest", "road"], graze: [] },
    attributes: { body: 6, reflex: 7, vigor: 6, mind: 1, wit: 4, presence: 2 },
    health: 54, naturalWeapon: beak(5, 9, 1), abilities: ["power-strike", "rapid-jabs"],
    mountedBonus: { accuracy: 2, damageMult: 0.12, reach: 0, dodge: 3, speed: 3 },
  },
  "dire-boar": {
    id: "dire-boar", kind: "mount", name: "Dire Boar", race: "boar", tier: "rare",
    desc: "A tusked badlands brute — the goblin and orc war-pig; thick-hided, foul-tempered, and unstoppable downhill.",
    bodyWeight: 130, rideCapacity: 52, feed: "meat", acquisition: "stable", priceCp: 3000, needsDecayMult: 1.1,
    moveProfile: { ground: 1.6, canFly: false, terrain: ["hills", "forest", "plains", "mountains", "marsh"], graze: [] },
    attributes: { body: 8, reflex: 4, vigor: 8, mind: 0, wit: 3, presence: 2 },
    health: 68, naturalArmor: 2, naturalWeapon: gore(6, 10, 2), abilities: ["power-strike", "rend"],
    mountedBonus: { accuracy: 1, damageMult: 0.2, reach: 1, dodge: -1, speed: 1 },
  },
  "giant-lizard": {
    id: "giant-lizard", kind: "mount", name: "Saddle Basilisk", race: "basilisk", tier: "epic",
    desc: "A great venomous riding-lizard — the finest beast a coin can buy, and the step below a true drake.",
    bodyWeight: 200, rideCapacity: 75, feed: "livestock", acquisition: "stable", priceCp: 6500, needsDecayMult: 1.0,
    moveProfile: { ground: 1.8, canFly: false, terrain: ["hills", "mountains", "forest", "marsh", "plains"], graze: [] },
    attributes: { body: 10, reflex: 6, vigor: 9, mind: 2, wit: 4, presence: 4 },
    health: 90, naturalArmor: 2, naturalWard: 1, naturalWeapon: fang(7, 12, 2),
    innatePassives: [{ id: "savage", tier: "epic" }],
    abilities: ["power-strike", "rend", "venom-strike"],
    mountedBonus: { accuracy: 2, damageMult: 0.2, reach: 1, dodge: 1, speed: 2 },
  },

  // ============================================================
  // EXOTIC — earned (tamed / quest / story). Granted via beat.grant_mount.
  // ============================================================
  "dire-wolf": {
    id: "dire-wolf", kind: "mount", name: "Dire Wolf", race: "warg", tier: "rare",
    desc: "A horse-sized wolf, bonded and saddled — silent in forest and hill where no horse can follow.",
    bodyWeight: 55, rideCapacity: 32, feed: "meat", acquisition: "tame",
    moveProfile: { ground: 2.3, canFly: false, terrain: ["forest", "hills", "mountains", "plains", "marsh"], graze: [] },
    attributes: { body: 6, reflex: 6, vigor: 5, mind: 1, wit: 4, presence: 2 },
    health: 50, naturalWeapon: fang(5, 8, 1), abilities: ["rend", "rapid-jabs"],
    mountedBonus: { accuracy: 2, damageMult: 0.12, reach: 0, dodge: 3, speed: 3 },
  },
  "ground-drake": {
    id: "ground-drake", kind: "mount", name: "Wingless Drake", race: "drakeborn", tier: "epic",
    desc: "A wingless lesser drake — broken to the saddle in Drakeholt; the closest to a true drake before you earn a flying one. Tamed, never bought.",
    bodyWeight: 300, rideCapacity: 95, feed: "livestock", acquisition: "tame", needsDecayMult: 0.8,
    moveProfile: { ground: 2.0, canFly: false, terrain: ["mountains", "hills", "plains", "forest", "road"], graze: [] },
    attributes: { body: 12, reflex: 7, vigor: 11, mind: 3, wit: 5, presence: 6 },
    health: 110, naturalArmor: 3, naturalWard: 1, naturalWeapon: fang(8, 13, 2),
    innatePassives: [{ id: "savage", tier: "epic" }],
    abilities: ["power-strike", "rend"],
    mountedBonus: { accuracy: 3, damageMult: 0.24, reach: 1, dodge: 1, speed: 3 },
  },
  griffon: {
    id: "griffon", kind: "mount", name: "Griffon", race: "gryphon", tier: "epic",
    desc: "An eagle-lion of the high crags, broken to the saddle — the first true wing a rider earns.",
    bodyWeight: 160, rideCapacity: 64, feed: "meat", acquisition: "tame", needsDecayMult: 0.9,
    moveProfile: { ground: 1.6, canFly: true, terrain: "any", graze: [] },
    attributes: { body: 9, reflex: 8, vigor: 7, mind: 2, wit: 5, presence: 4 },
    health: 84, naturalArmor: 2, naturalWeapon: talon(7, 12, 2), abilities: ["power-strike", "rend"],
    mountedBonus: { accuracy: 3, damageMult: 0.2, reach: 1, dodge: 4, speed: 3 },
  },
  wyvern: {
    id: "wyvern", kind: "mount", name: "Wyvern", race: "wyvern", tier: "legendary",
    desc: "A venom-stinged wyvern, half-tamed and always testing the bond — a killer that happens to carry you.",
    bodyWeight: 240, rideCapacity: 95, feed: "livestock", acquisition: "quest",
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
    bodyWeight: 600, rideCapacity: 150, feed: "livestock", acquisition: "quest", needsDecayMult: 0.8,
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
    bodyWeight: 1500, rideCapacity: 300, feed: "livestock", acquisition: "narrative", needsDecayMult: 0.4,
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

// The mounts a stable will sell (mundane only — acquisition "stable").
export const STABLE_MOUNTS = MOUNT_LIST.filter((m) => m.acquisition === "stable");

// What each REGION's stables sell — keyed by biome id (data/biomes.js getBiome).
// `signature` is always in stock; the rest appear by seeded chance and rotate each
// restock window (engine/town-gen.rollStableMounts). Far/dangerous lands sell
// stranger, stronger ground beasts — the bridge toward the EARNED flyers. A swamp
// stable sells nags, never destriers or drakes; human civilized lands carry the
// premium Courser; the Drakeholt sells ridge-ponies (the ground-drake is tamed,
// not bought). A handcrafted stable tile may override this via poi.mounts.
export const STABLE_STOCK_BY_BIOME = {
  // Vale core — home ground.
  mire:               { signature: "nag",         stock: [{ id: "nag", chance: 1.0 }, { id: "marsh-pony", chance: 0.6 }, { id: "mule", chance: 0.5 }, { id: "fen-strider", chance: 0.2 }] },
  "crowsmoor-reach":  { signature: "horse",       stock: [{ id: "horse", chance: 1.0 }, { id: "pony", chance: 0.7 }, { id: "mule", chance: 0.6 }, { id: "courser", chance: 0.15 }] },
  // Settled frontier.
  "tannic-wood":      { signature: "war-stag",    stock: [{ id: "war-stag", chance: 1.0 }, { id: "marsh-pony", chance: 0.6 }, { id: "pony", chance: 0.5 }, { id: "dire-boar", chance: 0.15 }] },
  "whitemarch-march": { signature: "warhorse",    stock: [{ id: "warhorse", chance: 1.0 }, { id: "horse", chance: 0.9 }, { id: "courser", chance: 0.3 }, { id: "war-stag", chance: 0.3 }] },
  "bramblewych-reach":{ signature: "marsh-pony",  stock: [{ id: "marsh-pony", chance: 1.0 }, { id: "nag", chance: 0.6 }, { id: "mule", chance: 0.5 }, { id: "war-stag", chance: 0.3 }] },
  // The wilds.
  "spine-foothills":  { signature: "ridge-pony",  stock: [{ id: "ridge-pony", chance: 1.0 }, { id: "mule", chance: 0.7 }, { id: "mountain-ram", chance: 0.4 }, { id: "dire-boar", chance: 0.2 }] },
  "iron-plateau":     { signature: "warhorse",    stock: [{ id: "warhorse", chance: 1.0 }, { id: "horse", chance: 1.0 }, { id: "courser", chance: 0.4 }, { id: "camel", chance: 0.4 }] },
  "tellmar-road":     { signature: "horse",       stock: [{ id: "horse", chance: 1.0 }, { id: "camel", chance: 0.6 }, { id: "courser", chance: 0.3 }, { id: "axe-beak", chance: 0.3 }, { id: "giant-lizard", chance: 0.12 }] },
  "witchwood-deep":   { signature: "war-stag",    stock: [{ id: "war-stag", chance: 1.0 }, { id: "marsh-pony", chance: 0.6 }, { id: "dire-boar", chance: 0.25 }, { id: "fen-strider", chance: 0.15 }] },
  // The cursed marches.
  "hollow-coast":     { signature: "marsh-pony",  stock: [{ id: "marsh-pony", chance: 1.0 }, { id: "fen-strider", chance: 0.5 }, { id: "nag", chance: 0.6 }, { id: "mule", chance: 0.4 }] },
  bonemarsh:          { signature: "fen-strider", stock: [{ id: "fen-strider", chance: 1.0 }, { id: "nag", chance: 0.7 }, { id: "marsh-pony", chance: 0.5 }, { id: "dire-boar", chance: 0.2 }] },
  "pale-steppe":      { signature: "camel",       stock: [{ id: "camel", chance: 1.0 }, { id: "axe-beak", chance: 0.5 }, { id: "horse", chance: 0.6 }, { id: "dire-boar", chance: 0.2 }] },
  // The far reaches.
  "sundered-wastes":  { signature: "dire-boar",   stock: [{ id: "dire-boar", chance: 1.0 }, { id: "axe-beak", chance: 0.5 }, { id: "camel", chance: 0.5 }, { id: "giant-lizard", chance: 0.15 }] },
  "drakeholt-peaks":  { signature: "ridge-pony",  stock: [{ id: "ridge-pony", chance: 1.0 }, { id: "mountain-ram", chance: 0.5 }, { id: "dire-boar", chance: 0.3 }] },
  // Past the named world.
  "far-wild":         { signature: "horse",       stock: [{ id: "horse", chance: 1.0 }, { id: "mule", chance: 0.5 }, { id: "axe-beak", chance: 0.3 }, { id: "giant-lizard", chance: 0.2 }] },
};

export const STABLE_STOCK_DEFAULT = {
  signature: "horse",
  stock: [{ id: "horse", chance: 1.0 }, { id: "pony", chance: 1.0 }, { id: "mule", chance: 0.8 }],
};

export function stableStockFor(biomeId) {
  return STABLE_STOCK_BY_BIOME[biomeId] || STABLE_STOCK_DEFAULT;
}

// A beast comes with a NAME, by the custom of its kind (the trader's name for it).
// The player can rename it anytime — no forced ritual on joining.
const MOUNT_NAME_POOLS = {
  horse: ["Briar", "Ash", "Bracken", "Sorrel", "Dapple", "Bayard", "Hazel", "Comet", "Maple", "Pepper", "Tansy", "Fenwick"],
  pony: ["Pip", "Nutmeg", "Acorn", "Biscuit", "Clover", "Tuppence", "Cobble", "Mossy", "Button"],
  stag: ["Thorncrown", "Elkhart", "Bramble", "Hartwood", "Greymane", "Antler", "Brackenhorn"],
  camel: ["Dune", "Sahel", "Ginger", "Khamsin", "Saffron", "Mirage", "Cardamom"],
  ram: ["Boulder", "Crag", "Ramsay", "Granite", "Cliff", "Bash", "Scree"],
  boar: ["Tusk", "Gnash", "Bristle", "Razorback", "Grommash", "Snout", "Gristle"],
  "axe-beak": ["Snip", "Scythe", "Quill", "Talon", "Cleaver", "Strider", "Kek"],
  basilisk: ["Silt", "Verdigris", "Hiss", "Cinder", "Scale", "Venn", "Lurk"],
  salamander: ["Marsh", "Newt", "Bog", "Slick", "Mudd", "Ember", "Reed"],
  drakeborn: ["Emberwing", "Ashmaw", "Cinder", "Scoria", "Vaelth", "Drurr", "Coalfoot"],
  dragon: ["Vyrmoth", "Ashendrake", "Caldrith", "Pyraxis", "Norggath", "Saphirex"],
  wyvern: ["Skreel", "Vexwing", "Talax", "Sleet", "Razix", "Hookmaw"],
  griffon: ["Skyrend", "Feathermane", "Stormcrest", "Gale", "Wynd", "Cirrus"],
  wolf: ["Greyfang", "Shadowtooth", "Winter", "Vask", "Hoarfrost", "Lurk"],
};
const GENERIC_MOUNT_NAMES = ["Roan", "Shadow", "Lucky", "Storm", "Steadfast", "Pal", "Scout"];

export const MOUNT_PROGRESSION_LEVEL_BY_TIER = Object.freeze({
  common: 10,
  uncommon: 15,
  rare: 25,
  "very-rare": 35,
  epic: 45,
  legendary: 65,
  mythical: 85,
  divine: 100,
});

function mountProfession(tmpl) {
  return /(?:dragon|drake|wyvern)/.test(`${tmpl.id} ${tmpl.race}`) ? "dragon-ascendant" : "wanderer";
}

export function generateMountName(race) {
  const pool = MOUNT_NAME_POOLS[race] || GENERIC_MOUNT_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

// The full codex-character entry for a mount — same scaffolding as a recruited
// companion (companionCodexEntry), plus the mount block and riding linkage.
export function mountCodexEntry(tmpl, name) {
  const entry = {
    id: tmpl.id, kind: "mount", portraitKey: `mount:${tmpl.id}`,
    name: name || tmpl.name, species: tmpl.name, race: tmpl.race,
    profession: mountProfession(tmpl), archetype: `${tmpl.id}-mount`,
    level: MOUNT_PROGRESSION_LEVEL_BY_TIER[tmpl.tier] || 10,
    origin: null,
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
    needsDecayMult: tmpl.needsDecayMult ?? 1, // endurance: <1 drains slower (engine/upkeep + App flight)
    mountedBonus: tmpl.mountedBonus || null,
    // Combat kit (consumed by enemyFromNPC → allyFromCompanion).
    health: tmpl.health, actionsPerTurn: tmpl.actionsPerTurn,
    naturalWeapon: tmpl.naturalWeapon, naturalArmor: tmpl.naturalArmor, naturalWard: tmpl.naturalWard,
    innatePassives: tmpl.innatePassives || [], abilities: [...(tmpl.abilities || [])],
    // Riding linkage (engine/riding.js): what this mount rides, and who rides it.
    ridingOn: null, riders: [],
    // Saddlebag — same pack/capacity shape as companions, but coins are null (a
    // mount carries no purse) and there's no `worn` paper-doll; `carried` IS the
    // saddlebag. Capacity scales from Body/Vigor via the shared carryCapacityFor
    // helper, so a pack-mule hauls more than a courser. Note this is the mount's
    // OWN carry-load (its kit and saddlebag stores) — distinct from `rideCapacity`
    // above, which is the WEIGHT it bears as riders and stacked gear.
    inventory: { carried: [], coins: null },
    carryCapacityMax: carryCapacityFor(tmpl),
    overburdened: false,
    carryBonus: 0,
    relationship: 0, memories: [],
  };
  return normalizeCharacterProgression(entry, {
    convertLegacyAttributes: true,
    enforceLevelAttributeScale: true,
    alignAttributesToProgression: true,
  });
}
