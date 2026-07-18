// Broad profession records shared by character creation, progression, and the
// living Codex. Exact vocations, titles, schools, pacts, and fighting styles are
// specializations beneath these records; they are never separate outer classes.
import { professionProfile } from "./progression-paths.js";

const specialization = (id, name, description) => Object.freeze({ id, name, description });

const PROFESSION_RECORDS = {
  wanderer: {
    id: "wanderer", name: "Wanderer", role: "Generalist", iconKey: "ranger",
    description: "A road-shaped generalist who combines disciplines as experience demands.",
    specializations: [specialization("adaptive-seeker", "Adaptive Seeker", "Builds a calling from roads taken and lessons borrowed.")],
  },

  // Adventuring professions. These are deliberately broad; authored identities such
  // as Sellsword, Archmage, and Demon Warlock live in `specializations`.
  fighter: {
    id: "fighter", name: "Warrior", role: "Martial", iconKey: "sellsword",
    description: "A wholly nonmagical master of weapons, armour, positioning, counters, physical pressure, and sustained battle.",
    specializations: [
      specialization("sellsword", "Sellsword", "A contract-bound professional of adaptable arms, disciplined risk, and practical survival."),
      specialization("duelist", "Duelist", "A technical combatant who controls a single contest through measure, parries, and tempo."),
      specialization("iron-vanguard", "Iron Vanguard", "An armoured master of bracing, reach, collision, and personally controlled space."),
      specialization("undying-champion", "Undying Champion", "A storied veteran who remains technically dangerous through pain and exhaustion without supernatural aid."),
    ],
  },
  barbarian: {
    id: "barbarian", name: "Barbarian", role: "Fury martial", iconKey: "reaver",
    description: "A physical aggressor who earns Fury by enduring direct hostile harm, then spends it through reckless, armour-respecting force, mass, pain tolerance, voice, momentum, and impact.",
    specializations: [
      specialization("reaver", "Reaver", "Carries committed melee aggression across several nearby threats through broad arcs and relentless pressure."),
      specialization("berserker", "Berserker", "Converts pain and deliberately exposed defence into brief offensive force without healing the injury."),
      specialization("juggernaut", "Juggernaut", "Uses body mass, acceleration, bracing, and collision under strict footing and size limits."),
      specialization("clan-champion", "Clan Champion", "Draws danger and steadies allies through credible challenge, voice, courage, and protective physical presence."),
    ],
  },
  ranger: {
    id: "ranger", name: "Ranger", role: "Fieldcraft", iconKey: "ranger",
    description: "A wholly nonmagical field professional of tracking, terrain, pursuit, survival medicine, ranged precision, traps, ambush, and the handling of already-present trained animals.",
    specializations: [
      specialization("hunter", "Hunter", "Turns verified sign and observed behaviour into patient pursuit and bounded physical precision."),
      specialization("trailblazer", "Trailblazer", "Reads difficult ground and makes practical routes through it without supernatural travel."),
      specialization("beast-warden", "Beast Warden", "Trains, cares for, and coordinates mundane animal allies that are already present."),
      specialization("trapper", "Trapper", "Builds physical restraints and ambush positions from tools, material, terrain, and preparation."),
    ],
  },
  rogue: {
    id: "rogue", name: "Rogue", role: "Subterfuge", iconKey: "cutthroat",
    description: "A wholly mundane specialist in access, stealth, observation, legerdemain, feints, social misdirection, precision, poison handling, locks, escape, and structural sabotage.",
    specializations: [
      specialization("infiltrator", "Infiltrator", "Crosses real architecture, routines, crowds, and access controls without supernatural concealment."),
      specialization("scoundrel", "Scoundrel", "Uses nerve, plausible deception, social expectation, and close physical tricks without compulsion."),
      specialization("assassin", "Assassin", "Prepares identity, approach, timing, anatomy, restraint, and escape for precise physical violence."),
      specialization("saboteur", "Saboteur", "Exploits existing locks, mechanisms, supports, and structural faults without constructing arcane devices."),
    ],
  },
  cleric: {
    id: "cleric", name: "Cleric", role: "Divine caster", iconKey: "devout",
    description: "A divine practitioner of prayer, restoration, protection, judgment, and sacred domains.",
    specializations: [
      specialization("devout", "Devout", "A merciful keeper of healing, warding, and faith."),
      specialization("war-priest", "War-Priest", "A battle cleric carrying ministry into the fighting line."),
    ],
  },
  paladin: {
    id: "paladin", name: "Paladin", role: "Oathbound protector", iconKey: "champion-paladin",
    description: "A non-spell oathbound protector who earns Conviction only by actually bearing hostile harm for others, then spends it on accountable protection, truth, mercy, and guidance.",
    specializations: [
      specialization("shield-oath", "Shield Oath", "Bears reachable physical harm for protected people through covenants, guard lines, and accountable defence."),
      specialization("truth-oath", "Truth Oath", "Calls witnessed conduct to account without compelled confession or supernatural truth-reading."),
      specialization("mercy-oath", "Mercy Oath", "Creates credible paths to surrender, custody, restitution, liberation, and return without erasing consequence."),
      specialization("beacon-oath", "Beacon Oath", "Guides willing companions and communities through visible presence, signals, refuge, and maintained roads."),
    ],
  },
  wizard: {
    id: "wizard", name: "Wizard", role: "Arcane caster", iconKey: "battle-archmage",
    description: "A learned arcane profession defined by the largest spellbook, broad school access, rituals, and prepared versatility.",
    specializations: [
      specialization("hedge-mage", "Hedge Mage", "A self-taught wizard of practical and improvised workings."),
      specialization("battle-archmage", "Battle Archmage", "A wizard who prepares many schools for war."),
      specialization("archmage-ascendant", "Archmage Ascendant", "An apex scholar who bends several schools as one discipline."),
      specialization("enchanter-tyrant", "Enchanter Tyrant", "A specialist in enchantment, compulsion, and sovereign will."),
    ],
  },
  sorcerer: {
    id: "sorcerer", name: "Sorcerer", role: "Innate caster", iconKey: "high-sorcerer",
    description: "An innate caster who cultivates a few signature spells through metamagic, exchange, and repeated enhancement.",
    specializations: [
      specialization("high-sorcerer", "High Sorcerer", "An innate master whose favourite workings have become overwhelming."),
      specialization("dragon-ascendant", "Dragon Ascendant", "A draconic sorcerer whose magic expresses an evolving wyrm lineage."),
    ],
  },
  warlock: {
    id: "warlock", name: "Warlock", role: "Pact caster", iconKey: "demon-warlock",
    description: "A narrow pact spellworker who earns fight-bound Favor only by paying real authored prices, then spends it through infernal covenants, witchcraft, binding chains, or brokered whispers.",
    specializations: [
      specialization("demon-warlock", "Demon Warlock", "An infernal binder of hellfire, hierarchy, dangerous debt, and exact contract enforcement."),
      specialization("witch", "Witch", "A local occultist of curses, remedies, names, tokens, thresholds, and old reciprocal bargains."),
      specialization("chainbinder", "Chainbinder", "A keeper of binding links, seals, custody, shared burden, and accountable release."),
      specialization("whisper-broker", "Whisper Broker", "A dealer in known secrets, spoken terms, reciprocal disclosure, silence, and pact exchange."),
    ],
  },
  druid: {
    id: "druid", name: "Druid", role: "Primal caster", iconKey: "beast-warden",
    description: "A primal spellworker whose native actions turn through Spring, Summer, Autumn, and Winter while shaping living terrain, the Druid's own animal forms, weather, decay, and reclamation.",
    specializations: [
      specialization("circle-of-root", "Circle of Root", "A keeper of growth, soil, roots, living shelter, and terrain stewardship."),
      specialization("circle-of-fang", "Circle of Fang", "A self-shapeshifter who practices coherent animal bodies without summoning or commanding creatures."),
      specialization("circle-of-sky", "Circle of Sky", "A weather worker of wind, pressure, rain, lightning, sunlight, and seasonal heat."),
      specialization("circle-of-cycle", "Circle of Cycle", "A keeper of decay, dormancy, carrion, fungi, nutrient return, and reclamation."),
    ],
  },
  monk: {
    id: "monk", name: "Monk", role: "Hand-to-hand", iconKey: "duelist",
    description: "A primarily unarmed practitioner whose spectacular techniques remain physical products of conditioning, biomechanics, breath, speed, leverage, and impact.",
    specializations: [
      specialization("open-hand", "Open Hand", "Controls anatomy, joints, balance, and restraint through trained unarmed contact."),
      specialization("iron-body", "Iron Body", "Develops a resilient physical frame through progressive loading, alignment, and recovery."),
      specialization("wind-step", "Wind Step", "Produces extreme but physical movement through acceleration, traction, route choice, and landing control."),
      specialization("temple-arms", "Temple Arms", "Permits only its own staff, spear, and temple-blade kata while general Monk practice remains unarmed."),
    ],
  },
  bard: {
    id: "bard", name: "Bard", role: "Performance support", iconKey: "courtier",
    description: "A strictly non-spell performer who alternates trained motifs into Cadence, then spends it on willing coordination, morale, social pressure, timing disruption, and bounded physical sound.",
    specializations: [
      specialization("war-singer", "War Singer", "Coordinates willing allies through drum, chant, shared breath, visible rhythm, and embodied courage."),
      specialization("satirist", "Satirist", "Turns witnessed error, hypocrisy, reputation, language, and audience into precise social pressure."),
      specialization("resonant-virtuoso", "Resonant Virtuoso", "Masters instruments, voice, acoustic direction, layered harmony, and bounded physical vibration."),
      specialization("lorekeeper", "Lorekeeper", "Uses true remembered deeds and observed battle history to orient willing allies in the present."),
    ],
  },
  artificer: {
    id: "artificer", name: "Artificer", role: "Devicecraft", iconKey: "hedge-mage",
    description: "A maker who designs, fabricates, tests, prepares, maintains, and retires finite devices. Artificer workings spend a personal prepared Charge reserve and are never spontaneous spells or free creatures.",
    specializations: [
      specialization("runesmith", "Runesmith", "Builds tested inscriptions into physical objects, interfaces, wards, and weapon fittings."),
      specialization("alchemist", "Alchemist", "Prepares labelled compounds bounded by reagent, dose, container, route, timing, and cleanup."),
      specialization("mechanist", "Mechanist", "Constructs limited mechanisms with explicit sensors, actuators, power, instructions, and failure states."),
      specialization("siegewright", "Siegewright", "Designs portable fieldworks, barriers, launchers, and breach tools around real loads and terrain."),
    ],
  },

  // Civic, social, service, and productive professions. Their progression grants
  // real capabilities without assuming that competence must be combat-capable.
  innkeeper: {
    id: "innkeeper", name: "Innkeeper", role: "Hospitality", iconKey: "envoy", common: true,
    description: "A grounded hospitality professional of shelter, provision, public rooms, staff, information custody, trade, and community refuge.",
    specializations: [
      specialization("hearthkeeper", "Hearthkeeper", "Builds safe lodging, rest, privacy, lawful refuge, and continuity around a physical house."),
      specialization("publican", "Publican", "Stewards the public room as a place of service, boundaries, gathering, and local belonging."),
      specialization("provisioner", "Provisioner", "Masters food, drink, cellar, kitchen, supply, fair measure, and responsible service."),
      specialization("wayhouse-broker", "Wayhouse Broker", "Connects travellers, routes, verified local information, referrals, caravans, and linked houses."),
    ],
  },
  farmer: {
    id: "farmer", name: "Farmer", role: "Husbandry", iconKey: "beast-warden", common: true,
    description: "A grounded husbandry professional of soil, seed, crops, stock, orchards, water, labour, storage, welfare, and land recovery.",
    specializations: [
      specialization("field-cultivator", "Field Cultivator", "Builds annual crop systems through seed, soil, rotation, water, timing, and harvest."),
      specialization("herd-keeper", "Herd Keeper", "Stewards domesticated animals through welfare, pasture, breeding, feed, shelter, and traceable care."),
      specialization("orchard-keeper", "Orchard Keeper", "Works with perennial fruit, nuts, vines, grafts, groves, pollination, and long establishment."),
      specialization("land-reclaimer", "Land Reclaimer", "Restores damaged soil, water, cover, habitat, and productive use through staged material practice."),
    ],
  },
  merchant: {
    id: "merchant", name: "Merchant", role: "Trade", iconKey: "envoy", common: true,
    description: "A grounded trade professional of appraisal, measure, inventory, logistics, contracts, credit, risk, market access, and accountability.",
    specializations: [
      specialization("peddler", "Peddler", "Trades directly through local stalls, shops, roads, customer fit, small lots, and resilient relationships."),
      specialization("caravan-factor", "Caravan Factor", "Coordinates cargo, carriers, routes, storage, customs, loss, and long-distance handoffs."),
      specialization("guild-broker", "Guild Broker", "Works through specifications, tenders, contracts, wholesale lots, institutions, and negotiated supply."),
      specialization("credit-steward", "Credit Steward", "Governs bounded commercial credit, debt records, liquidity, risk, hardship, and responsible finance."),
    ],
  },
  artisan: {
    id: "artisan", name: "Artisan", role: "Craft", iconKey: "sellsword", common: true,
    description: "A material craft professional whose levels develop recipes, efficiency, quality, and masterwork techniques.",
    specializations: [
      specialization("blacksmith", "Blacksmith", "Shapes useful and exceptional metalwork at the forge."),
      specialization("master-maker", "Master Maker", "Carries one material tradition to its highest expression."),
    ],
  },
  labourer: {
    id: "labourer", name: "Labourer", role: "Labour", iconKey: "sellsword", common: true,
    description: "A professional of leverage, endurance, construction, hauling, teamwork, and dependable physical work.",
    specializations: [specialization("guild-hand", "Guild Hand", "Turns practiced labour and coordination into a reliable trade.")],
  },
  scholar: {
    id: "scholar", name: "Scholar", role: "Scholarship", iconKey: "high-sorcerer", common: true,
    description: "A researcher, teacher, archivist, or scribe who advances through discovery rather than battle.",
    specializations: [specialization("polymath", "Polymath", "Connects several fields into new and useful knowledge.")],
  },
  healer: {
    id: "healer", name: "Healer", role: "Medicine", iconKey: "devout", common: true,
    description: "A non-divine practitioner of diagnosis, remedies, surgery, prevention, and long recovery.",
    specializations: [specialization("chirurgeon", "Chirurgeon", "Joins diagnosis, surgery, and bedside judgment to preserve life.")],
  },
  performer: {
    id: "performer", name: "Performer", role: "Arts", iconKey: "courtier", common: true,
    description: "A nonmagical professional of music, theatre, dance, spectacle, audience, and cultural memory.",
    specializations: [specialization("virtuoso", "Virtuoso", "Carries a chosen performance art to unforgettable mastery.")],
  },
  mariner: {
    id: "mariner", name: "Mariner", role: "Seafaring", iconKey: "ranger", common: true,
    description: "A sailor, navigator, shipmaster, or river professional who reads crew, hull, wind, and water together.",
    specializations: [specialization("tide-navigator", "Tide Navigator", "Finds a safe course through hostile water and weather.")],
  },
  diplomat: {
    id: "diplomat", name: "Diplomat", role: "Social", iconKey: "envoy",
    description: "A negotiator of passage, treaties, mediation, institutions, and durable agreement.",
    specializations: [
      specialization("court-envoy", "Court Envoy", "Builds terms and trust across hostile interests."),
      specialization("guild-advocate", "Guild Advocate", "Uses law, procedure, and institutional leverage for a constituency."),
      specialization("speaker", "Speaker", "Leads through consent, memory, and public trust."),
    ],
  },
  courtier: {
    id: "courtier", name: "Courtier", role: "Social", iconKey: "courtier",
    description: "A specialist in etiquette, reputation, access, attention, secrets, and personal influence.",
    specializations: [
      specialization("confidence-artist", "Confidence Artist", "Builds trust quickly and spends it as leverage."),
      specialization("velvet-courtier", "Velvet Courtier", "Moves through status, desire, and secrets with surgical grace."),
    ],
  },
  steward: {
    id: "steward", name: "Steward", role: "Administration", iconKey: "envoy",
    description: "An administrator of households, estates, stores, staff, accounts, and long institutional memory.",
    specializations: [specialization("estate-steward", "Estate Steward", "Makes an institution function when its figurehead cannot.")],
  },
  ruler: {
    id: "ruler", name: "Ruler", role: "Governance", iconKey: "enchanter-tyrant",
    description: "A political profession of law, delegation, legitimacy, consequence, and stewardship of a people.",
    specializations: [
      specialization("monarch", "Monarch", "A sovereign who makes institutions answer a crown."),
      specialization("noble", "Noble", "A titled ruler of land, patronage, obligation, and reputation."),
      specialization("hold-father", "Hold-Father", "An elected keeper of a hold's stores, disputes, and future."),
      specialization("matriarch", "Matriarch", "A communal ruler grounded in kinship, memory, and hard authority."),
    ],
  },
  commander: {
    id: "commander", name: "Commander", role: "Leadership", iconKey: "war-captain",
    description: "A leader of formations, logistics, morale, doctrine, and coordinated action.",
    specializations: [
      specialization("war-captain", "War-Captain", "Turns limited people, ground, and time into a working battle plan."),
      specialization("warlord", "Warlord", "Builds conquest around force, strategy, and the loyalty of victory."),
      specialization("chapter-master", "Chapter-Master", "Holds doctrine and a militant institution in one hand."),
    ],
  },
  attendant: {
    id: "attendant", name: "Attendant", role: "Service", iconKey: "courtier", common: true,
    description: "A household professional trained in care, discretion, routine, messages, presentation, and anticipation.",
    specializations: [specialization("body-attendant", "Body Attendant", "Makes exact care and anticipation appear effortless.")],
  },
};

export const PROFESSIONS = Object.freeze(Object.fromEntries(
  Object.entries(PROFESSION_RECORDS).map(([id, record]) => {
    const progression = professionProfile(id);
    const specializations = Object.freeze([...(progression?.specializations || record.specializations || [])]);
    const first = specializations[0];
    return [id, Object.freeze({
      ...record,
      domain: progression?.domain || record.role?.toLowerCase() || "general",
      specializations,
      // Compatibility fields for older presentation code. New surfaces should
      // use `specializations` and the character's explicit specialization.
      archetype: progression?.archetype || first?.name || "Generalist",
      archetypeDescription: progression?.archetypeDescription || first?.description || record.description,
    })];
  }),
));

export function professionRecord(id) {
  return PROFESSIONS[id] || null;
}
