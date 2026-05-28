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
  { key: "redhand",   name: "Red-Hand Mott",      gender: "male",   crime: "highway robbery on the Mire road",        rewardAliveCp: 100, rewardDeadCp: 60,  attractiveness: 4, desc: "Robbed three carters this month. The warden wants him to stand before the baron.", target: { x: -5, y: 0 }, targetName: "the Mire road west" },
  { key: "eel",       name: "The Eel",            gender: "male",   crime: "smuggling and a knifing at the ferry",     rewardAliveCp: 140, rewardDeadCp: 80,  attractiveness: 5, desc: "Slippery as his name. Last seen working the reed-channels east of town.", target: { x: 3, y: 1 }, targetName: "the reed-channels east of town" },
  { key: "vane",      name: "Goodwife Vane",      gender: "female", crime: "poisoning a neighbour's well",             rewardAliveCp: 120, rewardDeadCp: 40,  attractiveness: 5, desc: "Wanted ALIVE — the warden means to learn who paid her." },
  { key: "crows",     name: "Deserter Crows",     gender: "male",   crime: "desertion and theft from Whitemarch",      rewardAliveCp: 200, rewardDeadCp: 120, attractiveness: 5, desc: "A trained spearman gone to ground in the Mire. Dangerous, and he knows it.", target: { x: -7, y: 0 }, targetName: "the western marsh" },
  { key: "appr",      name: "The Hag's Apprentice", gender: "female", crime: "grave-robbing in the marsh",             rewardAliveCp: 90,  rewardDeadCp: 90,  attractiveness: 4, desc: "Dead or alive, the warden isn't fussy about this one." },
  { key: "sael",      name: "Three-Finger Sael",  gender: "male",   crime: "cutpursing and a fatal brawl",             rewardAliveCp: 110, rewardDeadCp: 70,  attractiveness: 5, desc: "Works the market crowds. Quick with a blade when cornered." },
  { key: "rider",     name: "The Masked Rider",   gender: "male",   crime: "holding up the Crowsmoor coach",           rewardAliveCp: 260, rewardDeadCp: 150, attractiveness: 7, desc: "Bold, mounted, and named in three counties. The warden's richest poster.", target: { x: 14, y: 0 }, targetName: "the long road toward Crowsmoor" },
];

export const PRISONER_POOL = [
  { key: "loff",  name: "Loff the Debtor",      gender: "male",   crime: "unpaid debts",                 rightsCp: 40,  attractiveness: 5, desc: "A baker who fell behind. Cheap rights — the warden only wants the cell back." },
  { key: "min",   name: "Min the Poacher",      gender: "male",   crime: "poaching the baron's deer",    rightsCp: 80,  attractiveness: 5, desc: "Quick and quiet in the woods. Some buy such rights to put a hand to work." },
  { key: "grukk", name: "Grukk, a freed thrall", gender: "male",   crime: "taken in a slaver sweep, nothing proven", rightsCp: 120, attractiveness: 5, desc: "A half-orc the coffles want back. Buy his rights and his fate is yours to decide." },
  { key: "pell",  name: "Pell the Forger",      gender: "male",   crime: "forging Whitemarch shillings", rightsCp: 150, attractiveness: 6, desc: "A clever hand with ink and dies — and a head full of who buys false coin." },
  { key: "sera",  name: "Sera, a runaway",      gender: "female", crime: "fleeing an indenture",         rightsCp: 100, attractiveness: 6, desc: "Her old master has posted for her return; the warden will sell her rights to the first coin laid down." },
];

export const GAOL_REFRESH_DAYS = 5;
