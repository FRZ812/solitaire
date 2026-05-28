// Gaol posting pools — the warden's wanted board and the cells.
//
// WANTED_POOL  — bounties on named criminals, dead OR alive (alive usually pays
//                more — the warden wants a trial, or what they know). Taking one
//                tracks it like a quest; you hunt them in the world and the
//                narrator settles up on delivery.
// PRISONER_POOL— folk already in the cells whose "rights" the warden will sell:
//                pay the fee and the prisoner's fate is yours (free them, press
//                them to work, ransom them, or sell them on elsewhere).
//
// ENGINE FIELDS. Each entry in BOTH pools carries the full kit a codex
// character expects so the engine can construct a real NPC at the point of
// sale (rights bought from the warden) or capture (a wanted brought in alive):
// `race` / `subrace`, `profession`, a 6-stat `attributes` block weighted from
// the crime and prose, a structured `appearance` object and a `base_appearance`
// sentence in codex tone, and the minimal `worn` they're held in. Gaol-doctrine
// for prisoners: shaved at intake where the gaol shaves, chain-galls at the
// wrists, repeat offences branded on the cheek, the thief cropped at the left
// ear; gaol-issue smock and trousers, barefoot. Wanted in the world wear what
// the road let them keep.
//
// Rolled deterministically per (tile + refresh window) — see engine/gaol.js.
// Coin is COPPER. Each entry needs a stable `key`.

import { resolvePoolForMind } from "../engine/attributes.js";
import { bodyWeightForRace } from "../engine/weight.js";

export const WANTED_POOL = [
  { key: "redhand",   name: "Red-Hand Mott",      gender: "male",   age: 35, agingMode: "mortal", race: "human", profession: "bandit", crime: "highway robbery on the Mire road",        attributes: { body: 4, reflex: 3, vigor: 4, mind: 1, wit: 2, presence: 1 }, appearance: { skin: "weather-burnt tan, freckled at the brow", hair: "red-brown, shoulder-length, unwashed", eyes: "pale blue", build: "heavy through the chest, thick at the wrist", facial_hair: "a short red beard going to grey", marks: "the right hand stained red to the wrist from a fresh kill — the name comes from the habit, not the once" }, base_appearance: "Heavy through the chest. Weather-burnt tan skin freckled at the brow. Unwashed red-brown hair to the shoulder. Pale-blue eyes. A short red beard. The right hand stained red to the wrist — the name comes from the habit, not the once.", worn: ["road-leather-jerkin", "wool-tunic", "patched-trousers", "heavy-boots"], rewardAliveCp: 100, rewardDeadCp: 60,  attractiveness: 4, desc: "Robbed three carters this month. The warden wants him to stand before the baron.", target: { x: -5, y: 0 }, targetName: "the Mire road west" },
  { key: "eel",       name: "The Eel",            gender: "male",   age: 30, agingMode: "mortal", race: "human", profession: "smuggler", crime: "smuggling and a knifing at the ferry",     attributes: { body: 2, reflex: 5, vigor: 3, mind: 2, wit: 3, presence: 1 }, appearance: { skin: "river-pale, sun-spotted at the cheekbone", hair: "black, slicked back, thinning at the crown", eyes: "dark, quick", build: "thin, narrow at the hip, deceptively quick", facial_hair: "clean-shaven, ill-shaved", marks: "a knife-scar from the corner of the mouth to the ear, an inked ferry-mark at the right shoulder" }, base_appearance: "Thin and narrow at the hip. River-pale skin, sun-spotted at the cheek. Slicked-back black hair thinning at the crown. Dark quick eyes. A knife-scar from mouth-corner to ear. A ferry-mark inked at the right shoulder.", worn: ["dark-wool-coat", "river-leather-vest", "patched-trousers", "soft-soled-boots"], rewardAliveCp: 140, rewardDeadCp: 80,  attractiveness: 5, desc: "Slippery as his name. Last seen working the reed-channels east of town.", target: { x: 3, y: 1 }, targetName: "the reed-channels east of town" },
  { key: "vane",      name: "Goodwife Vane",      gender: "female", age: 40, agingMode: "mortal", race: "human", profession: "poisoner", crime: "poisoning a neighbour's well",             attributes: { body: 1, reflex: 2, vigor: 2, mind: 4, wit: 3, presence: 1 }, appearance: { skin: "indoor-pale, lined at the eye", hair: "iron-grey, drawn into a tight widow's knot", eyes: "dark, level", build: "small, square at the shoulder", facial_hair: "none", marks: "herb-stained fingertips, a faint old burn down the right forearm" }, base_appearance: "Small and square at the shoulder. Indoor-pale skin lined at the eye. Iron-grey hair in a tight widow's knot. Dark level eyes. Herb-stained fingertips. A faint old burn down the right forearm.", worn: ["plain-grey-gown", "linen-coif", "wool-shawl", "leather-shoes"], rewardAliveCp: 120, rewardDeadCp: 40,  attractiveness: 5, desc: "Wanted ALIVE — the warden means to learn who paid her." },
  { key: "crows",     name: "Deserter Crows",     gender: "male",   age: 30, agingMode: "mortal", race: "human", profession: "deserter-spearman", crime: "desertion and theft from Whitemarch",      attributes: { body: 4, reflex: 3, vigor: 3, mind: 1, wit: 3, presence: 1 }, appearance: { skin: "marsh-tanned, mud-streaked", hair: "black, cropped short by an army hand, growing out ragged", eyes: "grey-green", build: "tall, rangy, soldier-fit", facial_hair: "a week's stubble", marks: "the Whitemarch spearman's brand on the left shoulder, a tooth missing in front, an old arrow-scar at the right thigh" }, base_appearance: "Tall and rangy. Marsh-tanned skin mud-streaked at the jaw. Black hair cropped short and growing out ragged. Grey-green eyes. A week's stubble. The Whitemarch spearman's brand on the left shoulder. A tooth missing in front; an arrow-scar at the right thigh.", worn: ["faded-whitemarch-tabard", "padded-jack", "patched-trousers", "marsh-boots"], rewardAliveCp: 200, rewardDeadCp: 120, attractiveness: 5, desc: "A trained spearman gone to ground in the Mire. Dangerous, and he knows it.", target: { x: -7, y: 0 }, targetName: "the western marsh" },
  { key: "appr",      name: "The Hag's Apprentice", gender: "female", age: 25, agingMode: "mortal", race: "human", profession: "grave-robber", crime: "grave-robbing in the marsh",             attributes: { body: 2, reflex: 2, vigor: 2, mind: 4, wit: 2, presence: 1 }, appearance: { skin: "marsh-pale, dirt-grimed", hair: "long, lank, dark-brown, tied back with a strip of grave-cloth", eyes: "pale, slightly walleyed", build: "thin, stooped at the shoulder", facial_hair: "none", marks: "fingernails black and broken, a charm-string of small bones at the neck, hag-marks tattooed at the wrists" }, base_appearance: "Thin and stooped at the shoulder. Marsh-pale skin dirt-grimed. Long, lank dark-brown hair. Pale walleyed eyes. Fingernails black and broken. Hag-marks tattooed at the wrists.", worn: ["mud-stained-robe", "wool-tunic", "patched-trousers", "broken-shoes"], rewardAliveCp: 90,  rewardDeadCp: 90,  attractiveness: 4, desc: "Dead or alive, the warden isn't fussy about this one." },
  { key: "sael",      name: "Three-Finger Sael",  gender: "male",   age: 30, agingMode: "mortal", race: "human", profession: "cutpurse", crime: "cutpursing and a fatal brawl",             attributes: { body: 2, reflex: 4, vigor: 2, mind: 1, wit: 3, presence: 1 }, appearance: { skin: "city-pale, smoke-grey at the cheek", hair: "brown, cut short and uneven", eyes: "brown, restless", build: "lean, quick at the wrist", facial_hair: "a thin moustache", marks: "the left hand short two fingers from an old market-justice — only thumb, forefinger, and one beside; a fresh cut at the right cheekbone" }, base_appearance: "Lean and quick at the wrist. City-pale skin smoke-grey at the cheek. Brown hair cut short and uneven. Restless brown eyes. A thin moustache. The left hand short two fingers from an old market-justice. A fresh cut at the right cheekbone.", worn: ["dark-wool-jerkin", "linen-tunic", "patched-trousers", "city-boots"], rewardAliveCp: 110, rewardDeadCp: 70,  attractiveness: 5, desc: "Works the market crowds. Quick with a blade when cornered." },
  { key: "rider",     name: "The Masked Rider",   gender: "male",   age: 30, agingMode: "mortal", race: "human", profession: "highwayman", crime: "holding up the Crowsmoor coach",           attributes: { body: 3, reflex: 4, vigor: 3, mind: 2, wit: 3, presence: 3 }, appearance: { skin: "wind-burnt where the mask leaves a strip uncovered, paler at the brow", hair: "dark, gathered short at the nape", eyes: "grey, behind the slit", build: "tall, balanced in the saddle, light on the foot", facial_hair: "kept clean-shaven so the mask sits flush", marks: "a road-cloak embroidered at the hem with three coach-marks (the carriages he has taken), spur-callouses at both heels" }, base_appearance: "Tall and balanced in the saddle, light on the foot. Wind-burnt skin in a strip across the eyes where the mask sits, paler at the brow. Dark hair gathered short at the nape. Grey eyes. Clean-shaven. Spur-callouses at both heels.", worn: ["black-half-mask", "embroidered-road-cloak", "leather-riding-coat", "fine-linen-shirt", "riding-boots"], rewardAliveCp: 260, rewardDeadCp: 150, attractiveness: 7, desc: "Bold, mounted, and named in three counties. The warden's richest poster.", target: { x: 14, y: 0 }, targetName: "the long road toward Crowsmoor" },
];

export const PRISONER_POOL = [
  { key: "loff",  name: "Loff the Debtor",      gender: "male",   age: 45, agingMode: "mortal", race: "human", profession: "baker", crime: "unpaid debts",                 attributes: { body: 2, reflex: 2, vigor: 2, mind: 2, wit: 2, presence: 2 }, appearance: { skin: "flour-pale, ruddy at the cheek", hair: "thinning brown going grey, shaved at intake", eyes: "tired brown", build: "soft-bellied, heavy at the forearm", facial_hair: "a few days' stubble", marks: "chain-galls at the wrists, a burn-scar on the right forearm from an oven-door, dough-callouses on the palms" }, base_appearance: "Soft-bellied and heavy at the forearm. Flour-pale skin ruddy at the cheek. Thinning brown hair shaved at intake. Tired brown eyes. A few days' stubble. Chain-galls at the wrists; an oven-door burn down the right forearm; dough-callouses on the palms.", worn: ["gaol-smock", "coarse-trousers"], rightsCp: 40,  attractiveness: 5, desc: "A baker who fell behind. Cheap rights — the warden only wants the cell back." },
  { key: "min",   name: "Min the Poacher",      gender: "male",   age: 25, agingMode: "mortal", race: "human", profession: "poacher", crime: "poaching the baron's deer",    attributes: { body: 2, reflex: 4, vigor: 3, mind: 1, wit: 3, presence: 1 }, appearance: { skin: "wood-tanned, brown at the forearm", hair: "dark, shaved at intake, growing back uneven", eyes: "hazel, quick", build: "lean, long in the leg", facial_hair: "patchy chin-hair", marks: "chain-galls at the wrists, a long bramble-scar across the back of the right hand, an arrow-callous on the right forefinger" }, base_appearance: "Lean and long in the leg. Wood-tanned skin brown at the forearm. Dark hair shaved at intake growing back uneven. Quick hazel eyes. Patchy chin-hair. Chain-galls at the wrists. A bramble-scar across the back of the right hand. An arrow-callous on the right forefinger.", worn: ["gaol-smock", "coarse-trousers"], rightsCp: 80,  attractiveness: 5, desc: "Quick and quiet in the woods. Some buy such rights to put a hand to work." },
  { key: "grukk", name: "Grukk, a freed thrall", gender: "male",   age: 25, agingMode: "mortal", race: "half-orc", profession: "labourer", crime: "taken in a slaver sweep, nothing proven", attributes: { body: 4, reflex: 2, vigor: 4, mind: 1, wit: 2, presence: 1 }, appearance: { skin: "grey-green, paler at the throat where a collar sat", hair: "black, shaved at intake", eyes: "yellow", build: "tall, slab-shouldered, slow on the foot", facial_hair: "none", marks: "an old chain-mark deep at the throat, a coffle-brand on the left shoulder, a notched lower tusk, chain-galls fresh at the wrists" }, base_appearance: "Tall and slab-shouldered. Grey-green skin paler at the throat. Black hair shaved at intake. Yellow eyes. A notched lower tusk. An old chain-mark deep at the throat. A coffle-brand on the left shoulder. Fresh chain-galls at the wrists.", worn: ["gaol-smock", "coarse-trousers"], rightsCp: 120, attractiveness: 5, desc: "A half-orc the coffles want back. Buy his rights and his fate is yours to decide." },
  { key: "pell",  name: "Pell the Forger",      gender: "male",   age: 35, agingMode: "mortal", race: "human", profession: "forger", crime: "forging Whitemarch shillings", attributes: { body: 1, reflex: 3, vigor: 2, mind: 4, wit: 4, presence: 2 }, appearance: { skin: "indoor-pale, ink-grimed at the jaw", hair: "dark brown, shaved at intake, growing out fast", eyes: "grey, attentive", build: "slight, narrow-handed, very steady at the wrist", facial_hair: "a thin trimmed moustache, kept", marks: "the cropped left ear of a repeat thief (this is the second time he is in), ink-stains worn into the knuckles, a die-burn at the right thumb-pad" }, base_appearance: "Slight and narrow-handed, very steady at the wrist. Indoor-pale skin ink-grimed at the jaw. Dark-brown hair shaved at intake. Attentive grey eyes. A thin moustache. The left ear cropped — second time in. Ink-stains worn into the knuckles. A die-burn at the right thumb-pad.", worn: ["gaol-smock", "coarse-trousers"], rightsCp: 150, attractiveness: 6, desc: "A clever hand with ink and dies — and a head full of who buys false coin." },
  { key: "sera",  name: "Sera, a runaway",      gender: "female", age: 22, agingMode: "mortal", race: "human", profession: "indentured-housemaid", crime: "fleeing an indenture",         attributes: { body: 1, reflex: 3, vigor: 2, mind: 2, wit: 3, presence: 3 }, appearance: { skin: "warm tan, road-burnt at the cheek", hair: "long chestnut, shaved at intake — now stubble", eyes: "dark, downcast at the warden, sharp away from him", build: "small, slim-wristed", facial_hair: "none", marks: "chain-galls fresh at both wrists, a household-mark inked behind the left ear from her old place, a fading bruise at the jaw from the catch" }, base_appearance: "Small and slim-wristed. Warm tan skin road-burnt at the cheek. Chestnut hair shaved to stubble at intake. Dark eyes — downcast at the warden, sharp away from him. Fresh chain-galls at both wrists. A household-mark inked behind the left ear. A fading bruise at the jaw from the catch.", worn: ["gaol-smock", "coarse-trousers"], rightsCp: 100, attractiveness: 6, desc: "Her old master has posted for her return; the warden will sell her rights to the first coin laid down." },
];

export const GAOL_REFRESH_DAYS = 5;

// The full codex-character entry for a prisoner whose rights the player has
// just bought from the warden — sister to bondedCodexEntry and
// companionCodexEntry. Tagged kind "bonded" (the engine treats the two custody
// flows uniformly — the prisoner's fate is now the player's, exactly as with a
// purchased captive). Coded defensively for thin rows: a PRISONER_POOL entry
// may not yet carry race/profession/appearance/worn/attributes (a sibling
// agent is enriching those fields); the helper defaults sanely so nothing
// crashes. The description comes from `desc`; the codex `origin` field carries
// the prisoner's `crime` (their entry on the rolls — why they were taken).
export function prisonerCodexEntry(prisoner) {
  const attrs = prisoner.attributes || { body: 2, reflex: 2, vigor: 2, mind: 2, wit: 2, presence: 2 };
  const race = prisoner.race || "human";
  return {
    id: `bonded-${prisoner.key}`, // overwritten by beat.js with the day-stamped id
    kind: "bonded",
    name: prisoner.name,
    race,
    subrace: prisoner.subrace || null,
    gender: prisoner.gender,
    profession: prisoner.profession || "prisoner",
    origin: prisoner.origin || prisoner.crime || "",
    age: prisoner.age,
    agingMode: prisoner.agingMode || "mortal",
    lifespanMultiplier: prisoner.lifespanMultiplier ?? 1.0,
    attractiveness: prisoner.attractiveness ?? 5,
    appearance: prisoner.appearance || {},
    base_appearance: prisoner.base_appearance || prisoner.desc || "",
    description: prisoner.desc || "",
    attributes: attrs,
    worn: Array.isArray(prisoner.worn) && prisoner.worn.length ? [...prisoner.worn] : ["rough-tunic"],
    knows: [],
    needs: { hunger: 60, thirst: 60, sleep: 60 },
    resolve: resolvePoolForMind(attrs.mind || 0),
    resolveMax: resolvePoolForMind(attrs.mind || 0),
    abilities: Array.isArray(prisoner.abilities) ? [...prisoner.abilities] : [],
    skills: Array.isArray(prisoner.skills) ? prisoner.skills.map((s) => (typeof s === "string" ? { name: s, rating: 1 } : { ...s })) : [],
    bodyWeight: bodyWeightForRace(race),
    ridingOn: null,
    riders: [],
    relationship: 0,
    memories: [],
  };
}
