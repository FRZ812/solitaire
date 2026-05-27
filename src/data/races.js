// PLAYABLE races/species + flagship subraces, and the MECHANICAL kit each grants.
// The narrator only DECLARES race + subrace at creation; the engine applies the
// kit from here (so racial powers are list-only, never narrator-invented).
//
// A kit may carry:
//   attributeModifiers     — flat +/- to base attributes (applied in effectiveAttributes)
//   proficiencyGrowthMult  — how fast this kindred learns (XP multiplier; human edge)
//   racialPassives         — always-on affixes (ids from data/passives.js, any tier)
//   innateAbilities        — inborn powers (ids from data/abilities.js; not learned magic)
//   startingSpells         — for magic:"innate" kindreds, a starting cantrip (real spell id)
//   magic                  — "learned" (must acquire magic in play) | "innate" (born attuned)
//   social                 — "normal" | "feared" | "hated" (how strangers treat them)
//   traits / flaws         — lore the narrator honours (boons & weaknesses; immersion > balance)
//
// Subraces INHERIT their race's kit: attributeModifiers add, arrays concat, scalars override.
// (Lore-only kindreds — fae, demon, wyrm — are NOT here: they are non-playable true entities.)

export const RACES = {
  human: {
    id: "human", name: "Human", magic: "learned", social: "normal",
    attributeModifiers: {}, proficiencyGrowthMult: 1.25,
    racialPassives: [], innateAbilities: [],
    traits: ["Versatile and quick — learns every skill markedly faster than any other kindred.", "Ambitious and adaptable; at home anywhere."],
    flaws: ["Short-lived; no inborn power to fall back on."],
  },
  elf: {
    id: "elf", name: "Elf", magic: "learned", social: "normal",
    attributeModifiers: { reflex: 1, mind: 1, vigor: -1 },
    racialPassives: [{ id: "tireless", tier: "rare" }],
    innateAbilities: [],
    traits: ["Centuries-long life; uncanny stillness and grace.", "Keen-eyed and quick."],
    flaws: ["Slow to trust; aloof, and slower to heal than the short-lived."],
    subraces: {
      high: { name: "High Elf", magic: "innate", startingSpells: ["firebolt"], racialPassives: [{ id: "aegis", tier: "rare" }], traits: ["Born to the Art — magic comes as breath."] },
      wood: { name: "Wood Elf", racialPassives: [{ id: "evasion", tier: "rare" }, { id: "fleet", tier: "uncommon" }], traits: ["Forest-silent; reads the wild like a page."] },
      drow: { name: "Drow", darkvision: true, attributeModifiers: { reflex: 1 }, innateAbilities: [{ id: "shadowstep", tier: "common" }], racialPassives: [{ id: "evasion", tier: "rare" }], social: "feared", traits: ["Darkvision — sees in pitch black.", "Deep-folk of a matriarchal court."], flaws: ["Sunlight-sensitive: bright day saps and pains them."] },
    },
  },
  dwarf: {
    id: "dwarf", name: "Dwarf", magic: "learned", social: "normal",
    attributeModifiers: { vigor: 2, body: 1, reflex: -1 },
    racialPassives: [{ id: "stoneskin", tier: "rare" }, { id: "stalwart", tier: "rare" }, { id: "enduring", tier: "rare" }],
    innateAbilities: [],
    traits: ["Stone-dense, tireless, long-lived.", "Master smith; resistant to poison and toxin."],
    flaws: ["Ill at ease in open water and high places; no love of the quick or the airy."],
    subraces: {
      hill: { name: "Hill Dwarf", racialPassives: [{ id: "stalwart", tier: "epic" }], traits: ["Hardier still — a deep well of vitality."] },
      mountain: { name: "Mountain Dwarf", attributeModifiers: { body: 1 }, racialPassives: [{ id: "bulwark", tier: "rare" }], traits: ["Raised to the hauberk; armour sits light on them."] },
    },
  },
  halfling: {
    id: "halfling", name: "Small Folk", magic: "learned", social: "normal",
    attributeModifiers: { reflex: 1, wit: 1, body: -1 }, proficiencyGrowthMult: 1.1,
    racialPassives: [{ id: "fortunate", tier: "rare" }, { id: "evasion", tier: "uncommon" }, { id: "swift", tier: "uncommon" }],
    innateAbilities: [],
    traits: ["Uncannily lucky; braver than their size.", "Quiet-footed and nimble."],
    flaws: ["Small and light — easily overpowered in a straight contest of strength."],
  },
  "half-orc": {
    id: "half-orc", name: "Half-Orc", magic: "learned", social: "hated",
    attributeModifiers: { body: 2, vigor: 1, presence: -1 },
    racialPassives: [{ id: "renewing", tier: "uncommon" }, { id: "stalwart", tier: "rare" }],
    innateAbilities: [{ id: "power-strike", tier: "common" }],
    traits: ["Orcish endurance — shrugs off wounds that would fell a man.", "Relentless under pressure."],
    flaws: ["Scorned by human and orc alike — suspicion, slurs, refused rooms, higher prices."],
  },
  orc: {
    id: "orc", name: "Orc", magic: "learned", social: "hated",
    attributeModifiers: { body: 3, vigor: 1, mind: -1, presence: -1 },
    racialPassives: [{ id: "stalwart", tier: "rare" }, { id: "rampage", tier: "epic" }],
    innateAbilities: [{ id: "power-strike", tier: "uncommon" }],
    traits: ["Massive, warlike, raid-hardened."],
    flaws: ["Dreaded across the marches — open hostility, watchmen's eyes, doors barred against you."],
  },
  goblin: {
    id: "goblin", name: "Goblin", magic: "learned", social: "hated",
    attributeModifiers: { reflex: 2, wit: 1, body: -2 },
    racialPassives: [{ id: "evasion", tier: "rare" }, { id: "swift", tier: "uncommon" }],
    innateAbilities: [{ id: "venom-strike", tier: "common" }],
    traits: ["Small, quick, over-attentive; warren-cunning and sly."],
    flaws: ["Feared and hated; trusted by no one, and weak in a stand-up fight."],
  },
  drakeborn: {
    id: "drakeborn", name: "Drake-Blooded", magic: "learned", social: "normal",
    attributeModifiers: { body: 1, vigor: 1 },
    racialPassives: [{ id: "stoneskin", tier: "rare" }],
    innateAbilities: [{ id: "dragon-breath", tier: "common" }],
    traits: ["Towering and imposing — a head taller than most humans, heavy in the bone and shoulder.", "A vein of fine scales runs from the nape down the shoulders and collar; otherwise of human face, hand, and eye.", "Carries a thin trace of wyrm-blood — and its breath."],
    flaws: ["Hard to miss in a crowd; takes the front of a room whether they want it or not.", "Uncommon south of the Spine; the scale-line draws careful stares once seen."],
    subraces: {
      fire: { name: "Fire-Drake Line", traits: ["Breathes fire; thrives in heat."], flaws: ["Vulnerable to deep cold."] },
      frost: { name: "Frost-Drake Line", traits: ["Breathes killing frost."], flaws: ["Vulnerable to fire."] },
      storm: { name: "Storm-Drake Line", traits: ["Breathes crackling lightning."], flaws: ["Vulnerable to water and earth."] },
    },
  },
  beastfolk: {
    id: "beastfolk", name: "Beast Folk", magic: "learned", social: "feared",
    attributeModifiers: { reflex: 1, wit: 1 },
    racialPassives: [],
    innateAbilities: [],
    traits: ["Humanoid in body — the ears and tail of their kindred animal are the only outward sign.", "Keen-sensed in the way of their kind; reads a room by scent and sound as much as sight."],
    flaws: ["Marked as non-human at a glance — foreign-coded in human capitals where many of their kindred are bonded."],
    subraces: {
      feline: { name: "Feline Line", attributeModifiers: { reflex: 1 }, racialPassives: [{ id: "evasion", tier: "uncommon" }], traits: ["Cat-eared and tailed; silent of step.", "Night-sighted in a measure short of the drow's full darkvision."], flaws: ["Restless under confinement; wears down in cages and cells faster than most."] },
      lupine: { name: "Lupine Line", attributeModifiers: { vigor: 1 }, racialPassives: [{ id: "enduring", tier: "uncommon" }], traits: ["Wolf-eared and tailed; long-paced; nose-keen.", "Pack-instinct — fights harder beside chosen kin."], flaws: ["Falters alone — needs a band, a chosen kin, or a steady purpose to thrive."] },
      ursine: { name: "Ursine Line", attributeModifiers: { body: 1, vigor: 1, reflex: -1 }, racialPassives: [{ id: "stalwart", tier: "uncommon" }], traits: ["Bear-eared and tailed; broad-framed; heavy in the shoulder.", "Slow to rile, hard to put down."], flaws: ["Cumbersome; not for ambush, city stealth, or close quarters."] },
      avian: { name: "Avian Line", attributeModifiers: { wit: 1, body: -1 }, racialPassives: [{ id: "swift", tier: "uncommon" }], traits: ["Hawk- or raven-marked: small feathered crests where ears would sit, a fan-tail of feathers, eyes that catch movement at distance.", "Light-boned; quick of hand; eagle-eyed."], flaws: ["Hollow-framed; takes punishment poorly."] },
    },
  },
  demonborn: {
    id: "demonborn", name: "Demon-Blooded", magic: "innate", social: "feared",
    attributeModifiers: { mind: 1, presence: 1, vigor: 1 },
    racialPassives: [{ id: "stoneskin", tier: "uncommon" }],
    innateAbilities: [{ id: "hellfire-bolt", tier: "common" }, { id: "dread-aura", tier: "common" }],
    traits: ["Skin and frame indistinguishable from a refined high-born — passes anywhere at first glance, often strikingly beautiful in a way that disarms.", "Ram-curl horns at the temples are the only outward sign; many hide them under hair, hood, or a courtier's circlet to move freely.", "Born attuned to magic.", "Natural at allure, sympathy, and the long quiet manipulation — disarming before they are read."],
    flaws: ["Shunned and watched by the devout and the temples once their nature is known — but often trusted further than they should be before that moment comes."],
  },
  vampire: {
    id: "vampire", name: "Vampire", magic: "learned", social: "feared", darkvision: true,
    attributeModifiers: { body: 3, reflex: 2, presence: 1 },
    racialPassives: [{ id: "vampiric", tier: "rare" }, { id: "renewing", tier: "rare" }, { id: "tireless", tier: "rare" }],
    innateAbilities: [{ id: "blood-siphon", tier: "common" }],
    traits: ["Naturally superhuman — swift, strong, undying.", "Night-sighted; does not age."],
    flaws: ["Burns in sunlight and recoils from holy power.", "Hungers for blood — must feed, or weaken."],
    subraces: {
      nosferatu: { name: "Nosferatu Bloodline", attributeModifiers: { body: 2, vigor: 1 }, racialPassives: [{ id: "stoneskin", tier: "rare" }, { id: "savage", tier: "rare" }], traits: ["The warrior bloodline — brutally strong and hard to put down."], flaws: ["Ravenous — the blood-hunger bites harder and sooner."] },
      patrician: { name: "Patrician Bloodline", attributeModifiers: { presence: 2, wit: 2, body: -1 }, racialPassives: [{ id: "fortunate", tier: "rare" }, { id: "aegis", tier: "rare" }], traits: ["Elegant, charming, and cunning — moves through courts and crowds unseen for what they are.", "A manipulator's bloodline; strongest away from open battle, weaker within it."], flaws: ["No warrior — falters in a straight fight against their own kin."] },
    },
  },
  lycanthrope: {
    id: "lycanthrope", name: "Lycanthrope", magic: "learned", social: "feared", darkvision: true,
    attributeModifiers: { body: 2, vigor: 2, reflex: 1, mind: -1 },
    racialPassives: [{ id: "renewing", tier: "rare" }, { id: "tireless", tier: "uncommon" }],
    innateAbilities: [{ id: "rending-claws", tier: "common" }, { id: "beast-shift", tier: "common" }],
    traits: ["Shapeshifter — preternatural strength and swift regeneration.", "Heightened senses; reads scent and sound."],
    flaws: ["Grievously wounded by silver.", "The full moon strains control of the beast."],
  },
};

const addMods = (a = {}, b = {}) => {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = (out[k] || 0) + b[k];
  return out;
};

// Merge a race + optional subrace into one resolved kit (mods add, arrays concat,
// scalars override). Returns null for an unknown / non-playable race.
export function resolveRace(raceId, subraceId) {
  const race = RACES[raceId];
  if (!race) return null;
  const sub = (subraceId && race.subraces) ? race.subraces[subraceId] : null;
  return {
    raceId, subraceId: sub ? subraceId : null,
    name: sub?.name || race.name,
    magic: sub?.magic || race.magic || "learned",
    social: sub?.social || race.social || "normal",
    proficiencyGrowthMult: sub?.proficiencyGrowthMult ?? race.proficiencyGrowthMult ?? 1,
    attributeModifiers: addMods(race.attributeModifiers, sub?.attributeModifiers),
    racialPassives: [...(race.racialPassives || []), ...(sub?.racialPassives || [])],
    innateAbilities: [...(race.innateAbilities || []), ...(sub?.innateAbilities || [])],
    startingSpells: [...(race.startingSpells || []), ...(sub?.startingSpells || [])],
    traits: [...(race.traits || []), ...(sub?.traits || [])],
    flaws: [...(race.flaws || []), ...(sub?.flaws || [])],
    darkvision: !!(race.darkvision || sub?.darkvision),
  };
}

export function raceKit(raceId) { return RACES[raceId] || null; }
export function isPlayableRace(raceId) { return !!RACES[raceId]; }
