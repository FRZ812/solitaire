// Canonical, reusable Solitaire combat combat kits.
//
// The source game attached each rules package to one named protagonist. Solitaire treats
// those source ids as migration aliases only: the public identity is a modular archetype
// that can be equipped by any authored character.

const identities = [
  {
    id: "knight",
    legacyId: "arctic-knight",
    name: "Knight",
    descriptor: "Armoured defender",
    role: "Ward and retaliation",
    summary: "A disciplined martial kit built around shieldwork, measured pressure, and punishing overextension.",
    design: "Plate, mail, arming sword, and shield define a grounded defensive kit with cold steel and restrained heraldry.",
    palette: ["cold steel", "weathered navy", "muted crimson", "warm impact sparks"],
    materials: "brushed steel, worn leather, dark wool, restrained heraldry",
    vfxTheme: "weighty steel arcs, shield shock rings, dust, sparks, and compact defensive geometry",
    portraitDirection: "practical plate-and-mail knight with an arming sword and heater shield",
    defaults: { race: "human", origin: "central", gender: "male", age: 32, appearance: { skin: "weathered fair", hair: "short dark brown", eyes: "grey-blue", build: "broad and conditioned", marks: "old training scars" } },
  },
  {
    id: "ranger",
    legacyId: "demon-slayer",
    name: "Ranger",
    descriptor: "Wilderness marksman",
    role: "Ranged control",
    summary: "A mobile hunting kit that controls distance with arrows, traps, fieldcraft, and prepared toxins.",
    design: "A practical bow, layered leather, canvas, and field tools support a self-sufficient wilderness combatant.",
    palette: ["forest green", "weathered umber", "canvas tan", "subdued venom amber"],
    materials: "oiled leather, waxed canvas, ash wood, iron arrowheads",
    vfxTheme: "clean arrow trajectories, taut bow energy, trap cords, leaf fragments, dust, and restrained toxin traces",
    portraitDirection: "field-worn ranger with a longbow, quiver, layered leather and compact survival tools",
    defaults: { race: "human", origin: "east", gender: "female", age: 29, appearance: { skin: "warm olive", hair: "dark brown tied back", eyes: "hazel", build: "lean and athletic", marks: "bowstring callus" } },
  },
  {
    id: "artificer",
    legacyId: "owner-of-artificer",
    name: "Artificer",
    descriptor: "Battlefield engineer",
    role: "Free-action controller",
    summary: "A technical support kit that reshapes a fight with firearms, barriers, grenades, and calibrated devices.",
    design: "Workshop-built mechanisms, visible gauges, and readable engineering make every battlefield device feel serviceable.",
    palette: ["gunmetal", "aged brass", "workshop teal", "controlled electric cyan"],
    materials: "machined steel, brass fittings, glass gauges, insulated leather",
    vfxTheme: "precise muzzle flashes, measured trajectories, mechanical reticles, barrier planes, smoke, and electrical discharge",
    portraitDirection: "practical battlefield engineer with compact firearm, tool harness, brass mechanisms and folded barrier emitter",
    defaults: { race: "human", origin: "central", gender: "female", age: 34, appearance: { skin: "warm brown", hair: "black cut to the jaw", eyes: "dark grey", build: "compact", marks: "small workshop burns on the hands" } },
  },
  {
    id: "berserker",
    legacyId: "old-king-of-northland",
    name: "Berserker",
    descriptor: "Relentless reaver",
    role: "Axe sustain",
    summary: "A high-pressure martial kit that trades safety for momentum, sustain, and overwhelming axe blows.",
    design: "A battle-tested reaver silhouette uses scarred iron, plain hide, and unadorned gear without rank or royal heraldry.",
    palette: ["dark iron", "oxblood", "hide brown", "dusty ember"],
    materials: "scarred iron, boiled leather, rough wool, plain fur trim",
    vfxTheme: "broad axe wakes, ground fractures, thrown stone, dust cones, impact sparks, and raw momentum",
    portraitDirection: "powerful axe fighter in practical leather and partial mail with a plain fur mantle and no royal symbols",
    defaults: { race: "human", origin: "north", gender: "male", age: 38, appearance: { skin: "wind-burned tan", hair: "rough auburn", eyes: "brown", build: "massive and powerful", marks: "axe scars across the forearms" } },
  },
  {
    id: "sorcerer",
    legacyId: "sleepless-one",
    name: "Sorcerer",
    descriptor: "Innate elementalist",
    role: "Elemental attrition",
    summary: "An instinctive magic kit that shapes fire, wind, water, and raw arcane force without formal apparatus.",
    design: "A mortal innate caster channels several elements through instinct, movement, and direct contact rather than formal apparatus.",
    palette: ["ember orange", "storm cyan", "deep violet", "charcoal"],
    materials: "layered travel cloth, scorched leather, small elemental talismans",
    vfxTheme: "organic elemental currents, ember trails, wind crescents, water ribbons, arcane wards, and pressure waves",
    portraitDirection: "innate battle sorcerer in layered travel clothes with controlled fire and wind gathering around empty hands",
    defaults: { race: "human", origin: "south", gender: "female", age: 27, appearance: { skin: "deep brown", hair: "dark curls bound high", eyes: "amber", build: "athletic", marks: "faint elemental glow along the fingertips" } },
  },
  {
    id: "rogue",
    legacyId: "last-assassin",
    name: "Rogue",
    descriptor: "Precision skirmisher",
    role: "Multi-hit finisher",
    summary: "A tempo-driven knife kit built around feints, interruption, precise wounds, and decisive finishers.",
    design: "Functional covert gear, utility blades, and disposable tools support precise infiltration without allegiance to a named school.",
    palette: ["smoke black", "desaturated plum", "cold silver", "brief crimson accents"],
    materials: "soft leather, dark wool, blued steel, ceramic flash charges",
    vfxTheme: "thin knife trails, displaced smoke, flash powder, precise cut lines, and short-lived crimson impact accents",
    portraitDirection: "practical covert skirmisher with paired utility blades, dark layered leathers and compact flash charges",
    defaults: { race: "human", origin: "east", gender: "male", age: 26, appearance: { skin: "olive", hair: "black cropped close", eyes: "dark brown", build: "lean and balanced", marks: "small blade scars on the hands" } },
  },
  {
    id: "warlock",
    legacyId: "witch-of-eternity",
    name: "Warlock",
    descriptor: "Pact channeler",
    role: "Summons and burst",
    summary: "An occult kit that converts pacts, curses, summoned remnants, and dangerous bargains into battlefield control.",
    design: "Pact implements, iron seals, and anonymous remains frame occult power as a dangerous learned practice.",
    palette: ["grave violet", "bone ivory", "pitch black", "muted hellfire orange"],
    materials: "dark wool, aged bone, iron seals, waxed cord",
    vfxTheme: "occult rings, bone fragments, shadow bolts, summoned silhouettes, pact chains, and unstable hellfire",
    portraitDirection: "occult pact caster in dark practical robes with iron seals, bone charms and a restrained violet invocation",
    defaults: { race: "human", origin: "west", gender: "female", age: 35, appearance: { skin: "cool brown", hair: "long silver-black", eyes: "violet-grey", build: "willowy", marks: "pact script at the collarbone" } },
  },
  {
    id: "wizard",
    legacyId: "tenacious-mage",
    name: "Wizard",
    descriptor: "Arcane scholar",
    role: "Charge artillery",
    summary: "A studied spellcraft kit that prepares wards, accumulates charge, and releases exacting arcane artillery.",
    design: "A field scholar carries practical notes and calibrated instruments, leaving biography and academic lineage open to the character.",
    palette: ["lapis blue", "parchment ivory", "copper", "arcane magenta"],
    materials: "travel-worn robes, leather folio, copper instruments, carved wood",
    vfxTheme: "constructed sigils, geometric wards, disciplined mana bolts, layered spell circles, and controlled disintegration",
    portraitDirection: "field wizard with travel-worn robes, slim spellbook, copper instruments and a plain wooden staff",
    defaults: { race: "human", origin: "central", gender: "male", age: 41, appearance: { skin: "medium brown", hair: "short silver-brown", eyes: "amber", build: "spare", marks: "ink and minor rune burns on the fingers" } },
  },
  {
    id: "paladin",
    legacyId: "exiled-priestess",
    name: "Paladin",
    descriptor: "Oathbound guardian",
    role: "Judgment and recovery",
    summary: "A durable sacred martial kit that turns an oath, measured judgment, and protective miracles into frontline authority.",
    design: "Neutral oath heraldry, practical plate, and plain sunburst seals keep faith, institution, and personal history open to the character.",
    palette: ["warm steel", "aged gold", "linen ivory", "sunlit amber"],
    materials: "plate and mail, white wool, worn leather, plain oath seals",
    vfxTheme: "hammer impacts, shield wards, restrained sunbursts, oath lines, cleansing light, and weighty judgment pillars",
    portraitDirection: "armoured oathkeeper with war hammer, shield, ivory mantle and simple sunburst seals without church insignia",
    defaults: { race: "human", origin: "south", gender: "female", age: 33, appearance: { skin: "deep brown", hair: "black in practical braids", eyes: "gold-brown", build: "powerful", marks: "a small oath mark at the brow" } },
  },
  {
    id: "blademaster",
    legacyId: "wandering-blade",
    name: "Blademaster",
    descriptor: "Martial sword adept",
    role: "Initiative tempo",
    summary: "A disciplined sword kit that converts footwork, timing, and focused technique into initiative and counterplay.",
    design: "Disciplined footwork, an unadorned blade, and adaptable travel gear leave school, culture, and personal history open.",
    palette: ["tempered silver", "slate blue", "charcoal", "pale wind cyan"],
    materials: "layered cloth, lacquered leather, tempered steel, plain cord wrapping",
    vfxTheme: "clean sword arcs, compressed wind, restrained chi lines, petal-like steel glints, and countering circles",
    portraitDirection: "disciplined sword adept in layered travel cloth with a long single-edged blade and minimal ornament",
    defaults: { race: "human", origin: "east", gender: "female", age: 30, appearance: { skin: "light olive", hair: "black tied high", eyes: "dark grey", build: "lean and conditioned", marks: "callused sword hand" } },
  },
  {
    id: "vampire",
    legacyId: "desolate-vampire",
    name: "Vampire",
    descriptor: "Bloodbound predator",
    role: "Blood sustain",
    summary: "A supernatural melee kit that spends and restores vitality through blood control, predation, and rapid recovery.",
    design: "A broad vampiric combat tradition uses controlled predation, elegant restraint, and practical night-fighting attire.",
    palette: ["oxblood", "black plum", "pale steel", "deep crimson"],
    materials: "dark tailored wool, supple leather, silvered clasps, restrained antique details",
    vfxTheme: "controlled blood ribbons, claw wakes, mist, pulse rings, dark crimson lances, and rapid regenerative flow",
    portraitDirection: "composed vampire combatant in practical dark winter tailoring with restrained claws and controlled blood magic",
    defaults: { race: "vampire", origin: "west", gender: "male", age: 96, agingMode: "ageless", lifespanMultiplier: 8, appearance: { skin: "pale grey", hair: "black", eyes: "dark crimson", build: "tall and athletic", marks: "subtle old bite scars at one wrist" } },
  },
  {
    id: "automaton",
    legacyId: "forsaken-automaton",
    name: "Automaton",
    descriptor: "Arcane war machine",
    role: "Risk artillery",
    summary: "A constructed combat kit that manages heat, calibration, repair, and heavy integrated weapons.",
    design: "A configurable chassis exposes its heat, calibration, repair, and weapon systems while leaving origin and directive open.",
    palette: ["blackened steel", "aged brass", "furnace orange", "coolant cyan"],
    materials: "riveted steel, brass housings, ceramic insulation, exposed gauges",
    vfxTheme: "cannon recoil, exhaust cones, heat shimmer, calibrated reticles, magnetic fields, sparks, and coolant vapour",
    portraitDirection: "humanoid arcane automaton chassis with integrated cannon, exposed heat gauge and practical field repairs",
    defaults: { race: "human", kindLabel: "Automaton", origin: "central", gender: "male", age: 20, agingMode: "ageless", lifespanMultiplier: 10, appearance: { skin: "brass and blackened steel", hair: "none", eyes: "furnace orange", build: "heavy mechanical frame", marks: "replaceable heat core and field repair plates" } },
  },
];

export const COMBAT_ARCHETYPE_IDENTITIES = Object.freeze(identities.map((entry) => Object.freeze({
  ...entry,
  palette: Object.freeze([...entry.palette]),
  defaults: Object.freeze({
    agingMode: "mortal",
    lifespanMultiplier: 1,
    ...entry.defaults,
    appearance: Object.freeze({ ...entry.defaults.appearance }),
  }),
})));

const byCanonicalId = new Map(COMBAT_ARCHETYPE_IDENTITIES.map((entry) => [entry.id, entry]));
const byAnyId = new Map(COMBAT_ARCHETYPE_IDENTITIES.flatMap((entry) => [
  [entry.id, entry],
  [entry.legacyId, entry],
]));

export function getCombatArchetypeIdentity(id) {
  return typeof id === "string" ? byAnyId.get(id) || null : null;
}

export function canonicalCombatArchetypeId(id) {
  return getCombatArchetypeIdentity(id)?.id || null;
}

export function legacyCombatArchetypeId(id) {
  return getCombatArchetypeIdentity(id)?.legacyId || null;
}

export function sameCombatArchetype(left, right) {
  const a = canonicalCombatArchetypeId(left);
  return Boolean(a && a === canonicalCombatArchetypeId(right));
}

export const COMBAT_ARCHETYPE_ID_BY_LEGACY_ID = Object.freeze(Object.fromEntries(
  COMBAT_ARCHETYPE_IDENTITIES.map((entry) => [entry.legacyId, entry.id]),
));

export const COMBAT_ARCHETYPE_LEGACY_ID_BY_ID = Object.freeze(Object.fromEntries(
  COMBAT_ARCHETYPE_IDENTITIES.map((entry) => [entry.id, entry.legacyId]),
));

export function isCanonicalCombatArchetypeId(id) {
  return typeof id === "string" && byCanonicalId.has(id);
}
