// Quest-board posting pools for the tavern (The Drowned Inn). Three kinds:
//   TASK_POOL   — work to pursue out in the world (errands, hunts, bounties);
//                 accepting one tracks it and tells the narrator about it.
//   RECRUIT_POOL— folk looking to take the road with you (narrative companions
//                 the narrator runs; recruiting hands off to a scene).
//   JOB_POOL    — day-labour the player can take on the spot for coin + time.
//
// Boards are rolled deterministically per (tile + refresh window) — see
// engine/quests.js — so the same notices hang until the board turns over.
// Coin is COPPER (1sp=10cp, 1gp=100cp); rewards/pay anchored to ~1sp/day labour.
// Each entry needs a stable `key` (used to build a stable posting id).

export const TASK_POOL = [
  { key: "cellar-rats",   type: "errand",   title: "Rats in the cellar",        giver: "the innkeeper", rewardCp: 8,  desc: "Something's been at the inn's stores. Clear the cellar." },
  { key: "marsh-ferns",   type: "errand",   title: "Marsh-ferns for the healer", giver: "the healer",    rewardCp: 15, desc: "Cut-leaf fern grows out past the ferry. Bring back a bundle." },
  { key: "lost-mule",     type: "errand",   title: "A carter's lost mule",      giver: "a carter",      rewardCp: 20, desc: "Strayed off the east road two nights gone. Bring it back, or word of it." },
  { key: "letter-reed",   type: "delivery", title: "Letter to Reedmarsh",       giver: "a merchant",    rewardCp: 12, desc: "A sealed letter for old Hareth's camp out east. Discreet, mind." },
  { key: "ford-ring",     type: "delivery", title: "A drowned man's ring",      giver: "a widow",       rewardCp: 30, desc: "Lost at the ford when he went under. Recover it if the river will give it back." },
  { key: "wolves-south",  type: "hunt",     title: "Wolves taking sheep",       giver: "a shepherd",    rewardCp: 30, desc: "A pack works the pasture south of the road. Thin them." },
  { key: "goblin-scout",  type: "hunt",     title: "Goblin-sign to the north",  giver: "the warden",    rewardCp: 40, desc: "Scout the Hollow's edge and bring back what you see. Don't get clever." },
  { key: "marsh-bandit",  type: "bounty",   title: "Bounty: the marsh-bandit",  giver: "the warden",    rewardCp: 50, desc: "Robbing travellers on the Mire road. Dead or alive — the warden isn't fussy." },
];

export const RECRUIT_POOL = [
  { key: "bram",   name: "Bram",       role: "sellsword",  race: "human",    desc: "A scarred sellsword nursing a cheap ale, looking for a road worth walking." },
  { key: "senna",  name: "Senna",      role: "hunter",     race: "human",    desc: "A marsh-hunter with a yew bow, bored of shooting eels for a living." },
  { key: "tomkin", name: "Tomkin",     role: "porter",     race: "halfling", desc: "A stout halfling who'll carry, cook, and complain in equal measure." },
  { key: "cray",   name: "Mother Cray", role: "hedge-witch", race: "human",  desc: "A hedge-witch with cold hands and a sharp eye, run out of one too many parishes." },
  { key: "doran",  name: "Doran",      role: "deserter",   race: "human",    desc: "A Whitemarch deserter keeping his head down, handy with a spear and quieter about why." },
];

export const JOB_POOL = [
  { key: "ferry-haul",  title: "Haul cargo at the ferry", hours: 5, payCp: 6,  needs: { hunger: -12, thirst: -14, sleep: -6 },  desc: "Load and unload the ferry-barges till your back aches." },
  { key: "taproom",     title: "Work the taproom",        hours: 6, payCp: 8,  needs: { hunger: -8,  thirst: -6,  sleep: -10 }, desc: "Pull ale and clear tables through a long, loud evening." },
  { key: "muck-stable", title: "Muck out the stable",     hours: 3, payCp: 4,  needs: { hunger: -6,  thirst: -8,  sleep: -2 },  desc: "Filthy, quick work for quick coin." },
  { key: "dig-drains",  title: "Dig drains in the market", hours: 8, payCp: 10, needs: { hunger: -16, thirst: -18, sleep: -8 }, desc: "A full day in the wet and the cold. Pays a labourer's wage." },
  { key: "night-watch", title: "Stand the night-watch",   hours: 8, payCp: 12, needs: { hunger: -6,  thirst: -6,  sleep: -28 }, desc: "A night on the wall, watching the dark and fighting sleep." },
];

export const BOARD_REFRESH_DAYS = 3;
