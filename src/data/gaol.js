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
// Rolled deterministically per (tile + refresh window) — see engine/gaol.js.
// Coin is COPPER. Each entry needs a stable `key`.

export const WANTED_POOL = [
  { key: "redhand",   name: "Red-Hand Mott",      crime: "highway robbery on the Mire road",        rewardAliveCp: 100, rewardDeadCp: 60,  desc: "Robbed three carters this month. The warden wants him to stand before the baron." },
  { key: "eel",       name: "The Eel",            crime: "smuggling and a knifing at the ferry",     rewardAliveCp: 140, rewardDeadCp: 80,  desc: "Slippery as his name. Last seen working the reed-channels east of town." },
  { key: "vane",      name: "Goodwife Vane",      crime: "poisoning a neighbour's well",             rewardAliveCp: 120, rewardDeadCp: 40,  desc: "Wanted ALIVE — the warden means to learn who paid her." },
  { key: "crows",     name: "Deserter Crows",     crime: "desertion and theft from Whitemarch",      rewardAliveCp: 200, rewardDeadCp: 120, desc: "A trained spearman gone to ground in the Mire. Dangerous, and he knows it." },
  { key: "appr",      name: "The Hag's Apprentice", crime: "grave-robbing in the marsh",             rewardAliveCp: 90,  rewardDeadCp: 90,  desc: "Dead or alive, the warden isn't fussy about this one." },
  { key: "sael",      name: "Three-Finger Sael",  crime: "cutpursing and a fatal brawl",             rewardAliveCp: 110, rewardDeadCp: 70,  desc: "Works the market crowds. Quick with a blade when cornered." },
  { key: "rider",     name: "The Masked Rider",   crime: "holding up the Crowsmoor coach",           rewardAliveCp: 260, rewardDeadCp: 150, desc: "Bold, mounted, and named in three counties. The warden's richest poster." },
];

export const PRISONER_POOL = [
  { key: "loff",  name: "Loff the Debtor",      crime: "unpaid debts",                 rightsCp: 40,  desc: "A baker who fell behind. Cheap rights — the warden only wants the cell back." },
  { key: "min",   name: "Min the Poacher",      crime: "poaching the baron's deer",    rightsCp: 80,  desc: "Quick and quiet in the woods. Some buy such rights to put a hand to work." },
  { key: "grukk", name: "Grukk, a freed thrall", crime: "taken in a slaver sweep, nothing proven", rightsCp: 120, desc: "A half-orc the coffles want back. Buy his rights and his fate is yours to decide." },
  { key: "pell",  name: "Pell the Forger",      crime: "forging Whitemarch shillings", rightsCp: 150, desc: "A clever hand with ink and dies — and a head full of who buys false coin." },
  { key: "sera",  name: "Sera, a runaway",      crime: "fleeing an indenture",         rightsCp: 100, desc: "Her old master has posted for her return; the warden will sell her rights to the first coin laid down." },
];

export const GAOL_REFRESH_DAYS = 5;
