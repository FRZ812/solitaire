// The Block — Whitemarch's CHAIN MARKET STEPS. The public sale-platform of the
// Chain Ward (-2,3 in the handcrafted map), backed by the Registry Hall that
// records status, writes labour-leases, and issues recovery-writs. Whitemarch
// runs the trade as a business: it does NOT enslave the central-region natives
// among whom it sits, but imports flesh from elsewhere — eastern coffles,
// southern raids, debt-sales out of the western marches, northern hostages
// whose ransom never came, and the visibly-foreign kindreds (orcs, half-orcs,
// goblins, beast folk, common-line vampires) shipped in by bargemaster to
// bargemaster.
//
// PUBLIC vs PRIVATE. This pool is the PUBLIC platform only. The truly rare —
// demon-blooded, drake-blooded, fae-touched, named bloodlines, patrician-line
// vampires, captives held for a specific patron — are sold privately in the
// Iron Palace's closed hall and the Patrician Houses' viewing rooms, to nobles
// and aristocrats by invitation, and NEVER appear here. Do not add such
// captives to CAPTIVE_POOL; that's a worldbuilding rule, not just a roster gap.
//
// PRICING MODEL. priceCp on each entry is the Chain Factor's appraisal of
// FOUR factors together, not just utility: SKILLS (a healer, a navigator, a
// literate scribe price up), APPEARANCE (the striking and unblemished stand
// above the plain, scarred, or marked), RARITY (an eastern steppe-rider, a
// southern beast-folk, an exotic kindred or origin price up sharply), and
// AGE/CONDITION (the prime years stand above the aged, failing, or broken).
// Appearance and rarity weigh AS HEAVILY as skill, often more — a striking
// captive of an exotic kindred can bond for more than a master cooper. Bargain
// prices reflect plainness, marks, age, brokenness, or commonness, not just
// less skill. The narrator follows the same model when improvising captives
// elsewhere in the world (see the BOND'S PRICE clause in THE BLOCK,
// src/system-prompt.js).
//
// CAPTIVE_POOL — people the auctioneer holds for sale. Each is a real person
//                with a name, an origin, the wrong turn of fortune that put
//                them on the block (war, debt, a raid, birth), and a
//                `freedom_response` cue naming the specific reason they will
//                refuse the player's offer of freedom (the default is refusal —
//                see the THE BLOCK passage in src/system-prompt.js). The
//                refusal categories (war-displaced, childhood-bonded, aged/
//                broken, honour-bound) are a DOCTRINE applied to any captive
//                in the fiction, not just this roster — `freedom_response`
//                here is just the doctrine filled in for each name. Buying
//                their BOND pays the auctioneer and makes their fate yours:
//                keep them in bonded service, ransom them home (if they have
//                one a writ can reach), sell them on, or force-release them at
//                the gate (and play the consequence — abandonment, not
//                liberation). They are not stock; they react like the people
//                they are, coloured by `spirit` and grounded in
//                `freedom_response`.
//
// Rolled deterministically per (tile + refresh window) — see engine/slaves.js.
// Coin is COPPER. Each entry needs a stable `key`.

export const CAPTIVE_POOL = [
  { key: "harl",   name: "Harl of the Reeds",   origin: "a marshland villager of the western marches, where the border-wars run hot", taken: "seized in a border raid by a western warlord and traded east, bargemaster to bargemaster, until the bond reached the Block", spirit: "sullen",   skills: "a steady spear-hand who knows the marsh tracks blind", priceCp: 280, attractiveness: 5, desc: "Big-shouldered, slow to speak, eyes always on the gate. Watches who buys whom.", freedom_response: "war-displaced; refuses because his village is ash and his people scattered — there is no home for a freed body to return to, and his marsh-skills sell here or nowhere" },
  { key: "neela",  name: "Neela",               origin: "of the Reedfolk of the far southern delta", taken: "given over to a southern broker for her family's bond-debt when the delta fishery failed; the bond traded north until it reached a Whitemarch factor", spirit: "wary",     skills: "trained to herbs and fevers — sets bone, draws venom, eases pain", priceCp: 360, attractiveness: 6, desc: "Keeps her hands folded and her counsel close. The auctioneer prices her high; a healer is worth a war-band.", freedom_response: "bond-debt; refuses because the broker who sold her still holds her sisters' contract — her freedom voids none of theirs, and she will not buy hers at their cost" },
  { key: "okk",    name: "Okk",                 origin: "orc-blood, hill country of the south", taken: "a prize of a slaver coffle, traded hand to hand up the road", spirit: "defiant",  skills: "a pit-fighter of fearsome strength, scarred from a hundred bouts", priceCp: 520, attractiveness: 5, desc: "Chained heavier than the rest. He has not stopped looking for a way to kill the men who hold the chain.", freedom_response: "defiant; refuses because freedom for a foreign-blooded pit-fighter in a human capital means a fresh coffle inside a week, and he is not buying that joke" },
  { key: "miri",   name: "Miri",                origin: "born in the yard, of the block itself", taken: "a child of bondage who has known no other gate", spirit: "quiet",    skills: "quick fingers, reads and ciphers — raised to be a house-scribe", priceCp: 200, attractiveness: 6, desc: "Twelve, perhaps thirteen. Watchful, far cleverer than the auctioneer lets on. Counts everything; forgets nothing. Stands the way an apprentice stands at a guild-counter — waiting to be sent for.", freedom_response: "born-to-the-yard, twelve or thirteen; treats the auction as her profession and a placement in a respected household as her advancement track. Refuses because the offer reads as eviction from the only career she has trained for. Asks politely whether the player keeps a scribe at their household, and whether they have a chamberlain who might want one." },
  { key: "voss",   name: "Voss",                origin: "a mariner of the eastern coast", taken: "pulled half-drowned from a wrecked galley and sold far inland", spirit: "proud",    skills: "a sailor and navigator who reads the coast roads and the stars", priceCp: 300, attractiveness: 6, desc: "Salt-burned and unbowed. Speaks of the sea like a man speaks of a lover taken from him.", freedom_response: "sea-cut; refuses because a freed mariner with no ship and no coast is still a mariner — the sea is two months' travel from this gate, and the road between is a slaver's pasture" },
  { key: "tama",   name: "Tama",                origin: "a steppe-rider of the far east", taken: "captured in a raid a thousand miles off and bartered the whole way west", spirit: "defiant",  skills: "a horsewoman and bow-hand without equal in this damp country", priceCp: 440, attractiveness: 7, desc: "Speaks little of the local tongue, and that little is contempt. Her hands twitch for a rein and a bow.", freedom_response: "displaced a thousand miles; refuses because the steppe is a year of hostile country with no horse, no bow, no escort, and the gate is the start of that road, not the end of it" },
  { key: "pieter", name: "Old Pieter",          origin: "a craftsman of a famine-struck eastern holding", taken: "sold himself into bond at an eastern winter-auction to feed his grandchildren; the bond was traded west and west again until it reached the Block", spirit: "broken",   skills: "a master cooper and joiner — failing eyes, but willing, patient hands", priceCp: 90,  attractiveness: 3, desc: "Stooped and grey, ashamed to be looked at. Cheap, the auctioneer says, as if that were the cruelty.", freedom_response: "broken; refuses because he equates freedom with becoming a burden — being useful to one man is the only ground he still trusts to stand on" },
  { key: "rurik",  name: "Rurik",               origin: "a northman of a broken truce", taken: "left a hostage when the ransom never came, then quietly sold off", spirit: "proud",    skills: "an axe-man and shipwright, sworn now to no lord living", priceCp: 380, attractiveness: 8, desc: "Stands a head over the others and acts as if the irons are a formality he is choosing to permit.", freedom_response: "honour-bound; refuses because he will not OWE the player his freedom — a northman's pride does not take a debt that cannot be repaid in coin or arms" },
  { key: "marn",   name: "Marn",                origin: "feline beastfolk of the southern jungle-fringes", taken: "captured in a punitive raid on a southern trade-caravan, the prize chained and barged north until the bond reached the Block", spirit: "watchful", skills: "a knife-fighter and silent climber; reads rooms by scent and breath as well as eye", priceCp: 420, attractiveness: 8, desc: "Cat-eared, dark-furred at the temples, tail tucked beneath a heavy cloak. Wary of standing crowds, calm in motion. Speaks the trade-tongue clean but slow.", freedom_response: "raid-displaced; refuses because a beast-folk on Whitemarch streets without a writ is freshly enslavable to any patrol on any corner, and she has watched it happen to the last one" },
  { key: "yshka",  name: "Yshka",               origin: "lupine beastfolk of the eastern steppe", taken: "taken with the rest of her pack-cousin's hunting band when a steppe-lord paid his tribute in flesh; traded west bargemaster to bargemaster", spirit: "haunted",  skills: "a bow-hand and tracker; reads tracks by nose as well as eye; runs further than any horse the city sells", priceCp: 380, attractiveness: 7, desc: "Wolf-eared and tailed; long-limbed; eyes flicking always to the door. Carries the silence of someone who has not heard her own tongue in a year.", freedom_response: "pack-broken; refuses because her cousins are still bonded elsewhere in the city and her freedom does not free them — and because the steppe is a year's travel through country that will not feed her" },
  { key: "lis",    name: "Lis",                 origin: "born in a southern temple-yard, sold to an eastern household at six", taken: "the eastern household failed; her bond was sold to clear the debt and she was barged west by a broker who specialises in trained children", spirit: "hopeful",  skills: "trained from six as a body-attendant in an eastern noble's household — pours wine, lights lamps, dresses hair, runs messages discreetly; reads and writes the trade-tongue, ciphers a household account", priceCp: 240, attractiveness: 7, desc: "Eleven or twelve. Small for her age, dressed in the brown shift of a trained attendant. Stands straight, eyes lowered, hands folded — the posture of a placement waiting for the right buyer.", freedom_response: "trained-attendant; ambition has been a high-house placement since she was six and the player's offer reads as a demotion. Politely asks the player whether they have a chamberlain, an attendant for the table, anyone who keeps trained children. Will refuse the gate the way an applicant refuses an offer beneath their qualifications." },
];

export const SLAVE_HIGH_TIER_MIN_CP = 360;
export const SLAVE_LOW_REFRESH_DAYS = 4;

// Low-tier captives don't just sit at the same price gathering dust — the Chain
// Factor knocks the bond by SLAVE_LOW_DAILY_DISCOUNT each day they linger, down
// to a SLAVE_LOW_PRICE_FLOOR_PCT floor. And other buyers are watching: at each
// night-close, every still-lingering captive rolls against an off-screen-sale
// chance = (originalPrice / SLAVE_HIGH_TIER_MIN_CP) * discountFraction *
// SLAVE_LOW_OFFSCREEN_SALE_RATE — desirability times bargain depth. If the roll
// hits, someone else takes them off the platform and they vanish from the
// roster the next morning. The rolls are deterministic per (tile, captive,
// night) so the same day at the same tile always shows the same remaining set.
export const SLAVE_LOW_DAILY_DISCOUNT = 0.10;
export const SLAVE_LOW_PRICE_FLOOR_PCT = 0.50;
export const SLAVE_LOW_OFFSCREEN_SALE_RATE = 0.5;
