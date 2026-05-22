// The Block — Crowsmoor's auction-yard. A grimmer trade than the lawful gaol,
// and deliberately NOT in your home town of Mirecross: a rougher town keeps it.
//
// CAPTIVE_POOL — people the auctioneer holds for sale. Each is a real person with
//                a name, an origin, and the wrong turn of fortune that put them on
//                the block (war, debt, a raid, birth). Buying their BOND pays the
//                auctioneer and makes their fate yours — the custody scene is left
//                to the narrator: free them (they may walk away, or take your road
//                out of gratitude), press them to service, ransom them home, or
//                sell them on. They are not stock; they react like the people they
//                are, coloured by `spirit`.
//
// Rolled deterministically per (tile + refresh window) — see engine/slaves.js.
// Coin is COPPER. Each entry needs a stable `key`.

export const CAPTIVE_POOL = [
  { key: "harl",   name: "Harl of the Reeds",   origin: "a marsh-villager of the lower Mire", taken: "seized when Whitemarch outriders burned his village and sold to clear a debt of arms", spirit: "sullen",  skills: "a steady spear-hand who knows the marsh tracks blind", priceCp: 280, desc: "Big-shouldered, slow to speak, eyes always on the gate. Watches who buys whom." },
  { key: "neela",  name: "Neela",               origin: "of the Reedfolk, born downriver",     taken: "given over for her family's bond-debt when the fishery failed",                     spirit: "wary",    skills: "trained to herbs and fevers — sets bone, draws venom, eases pain", priceCp: 360, desc: "Keeps her hands folded and her counsel close. The auctioneer prices her high; a healer is worth a war-band." },
  { key: "okk",    name: "Okk",                 origin: "orc-blood, hill country of the south", taken: "a prize of a slaver coffle, traded hand to hand up the road",                       spirit: "defiant", skills: "a pit-fighter of fearsome strength, scarred from a hundred bouts",  priceCp: 520, desc: "Chained heavier than the rest. He has not stopped looking for a way to kill the men who hold the chain." },
  { key: "miri",   name: "Miri",               origin: "born in the yard, of the block itself", taken: "a child of bondage who has known no other gate",                                    spirit: "quiet",   skills: "quick fingers, reads and ciphers — raised to be a house-scribe",   priceCp: 200, desc: "Young, watchful, far cleverer than the auctioneer lets on. Counts everything; forgets nothing." },
  { key: "voss",   name: "Voss",               origin: "a mariner of the eastern coast",        taken: "pulled half-drowned from a wrecked galley and sold far inland",                     spirit: "proud",   skills: "a sailor and navigator who reads the coast roads and the stars",    priceCp: 300, desc: "Salt-burned and unbowed. Speaks of the sea like a man speaks of a lover taken from him." },
  { key: "tama",   name: "Tama",               origin: "a steppe-rider of the far east",        taken: "captured in a raid a thousand miles off and bartered the whole way west",           spirit: "defiant", skills: "a horsewoman and bow-hand without equal in this damp country",      priceCp: 440, desc: "Speaks little of the local tongue, and that little is contempt. Her hands twitch for a rein and a bow." },
  { key: "pieter", name: "Old Pieter",         origin: "a craftsman of a famine-struck holding", taken: "sold himself into bond to feed his grandchildren through the hungry winter",        spirit: "broken",  skills: "a master cooper and joiner — failing eyes, but willing, patient hands", priceCp: 90,  desc: "Stooped and grey, ashamed to be looked at. Cheap, the auctioneer says, as if that were the cruelty." },
  { key: "rurik",  name: "Rurik",              origin: "a northman of a broken truce",          taken: "left a hostage when the ransom never came, then quietly sold off",                  spirit: "proud",   skills: "an axe-man and shipwright, sworn now to no lord living",            priceCp: 380, desc: "Stands a head over the others and acts as if the irons are a formality he is choosing to permit." },
];

export const SLAVE_REFRESH_DAYS = 6;
