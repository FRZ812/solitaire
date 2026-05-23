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
      drow: { name: "Drow", attributeModifiers: { reflex: 1 }, innateAbilities: [{ id: "shadowstep", tier: "common" }], racialPassives: [{ id: "evasion", tier: "rare" }], social: "feared", traits: ["Darkvision — sees in pitch black.", "Deep-folk of a matriarchal court."], flaws: ["Sunlight-sensitive: bright day saps and pains them."] },
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
    traits: ["Scaled hide and slit-pupiled eyes.", "Carries a thin trace of wyrm-blood — and its breath."],
    flaws: ["Marked and uncommon; draws wary stares far from the Spine."],
    subraces: {
      fire: { name: "Fire-Drake Line", traits: ["Breathes fire; thrives in heat."], flaws: ["Vulnerable to deep cold."] },
      frost: { name: "Frost-Drake Line", traits: ["Breathes killing frost."], flaws: ["Vulnerable to fire."] },
      storm: { name: "Storm-Drake Line", traits: ["Breathes crackling lightning."], flaws: ["Vulnerable to water and earth."] },
    },
  },
  demonborn: {
    id: "demonborn", name: "Demon-Blooded", magic: "innate", social: "feared",
    attributeModifiers: { mind: 1, presence: 1, vigor: 1 },
    racialPassives: [{ id: "stoneskin", tier: "uncommon" }],
    innateAbilities: [{ id: "hellfire-bolt", tier: "common" }, { id: "dread-aura", tier: "common" }],
    traits: ["Hot-skinned, horned; born to infernal fire.", "Attuned to magic from birth."],
    flaws: ["Shunned and watched — temples and the devout meet them with fear or open hostility."],
  },
  vampire: {
    id: "vampire", name: "Vampire", magic: "learned", social: "feared",
    attributeModifiers: { body: 3, reflex: 2, presence: 1 },
    racialPassives: [{ id: "vampiric", tier: "rare" }, { id: "renewing", tier: "rare" }, { id: "tireless", tier: "rare" }],
    innateAbilities: [{ id: "crimson-bite", tier: "common" }],
    traits: ["Naturally superhuman — swift, strong, undying.", "Night-sighted; does not age."],
    flaws: ["Burns in sunlight and recoils from holy power.", "Hungers for blood — must feed, or weaken."],
    subraces: {
      nosferatu: { name: "Nosferatu Bloodline", attributeModifiers: { body: 1 }, racialPassives: [{ id: "stoneskin", tier: "rare" }], traits: ["Monstrous and bestial; immensely strong."], flaws: ["Hideous — cannot pass for living."] },
      patrician: { name: "Patrician Bloodline", attributeModifiers: { presence: 2 }, racialPassives: [{ id: "aegis", tier: "rare" }], traits: ["Elegant and charming; passes among the living."] },
    },
  },
  lycanthrope: {
    id: "lycanthrope", name: "Lycanthrope", magic: "learned", social: "feared",
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
  };
}

export function raceKit(raceId) { return RACES[raceId] || null; }
export function isPlayableRace(raceId) { return !!RACES[raceId]; }
