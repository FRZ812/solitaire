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
    id: "ranger", name: "Ranger", role: "Wilderness", iconKey: "ranger",
    description: "A wilderness specialist combining fieldcraft, pursuit, ranged weapons, and bonds with the wild.",
    specializations: [
      specialization("far-walker", "Far-Walker", "A patient scout and hunter of distant trails."),
      specialization("beast-warden", "Beast-Warden", "A ranger whose practice centres on animal bonds."),
      specialization("dragon-hunter", "Dragon-Hunter", "A specialist in colossal and supernatural quarry."),
    ],
  },
  rogue: {
    id: "rogue", name: "Rogue", role: "Skirmisher", iconKey: "cutthroat",
    description: "A specialist in leverage, stealth, infiltration, precision, and underworld practice.",
    specializations: [
      specialization("cutthroat", "Cutthroat", "An opportunist who ends danger before it can answer."),
      specialization("shadowblade", "Shadowblade", "An infiltrator who joins supernatural movement to precise violence."),
      specialization("assassin", "Assassin", "A patient professional of concealment and decisive killing."),
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
    id: "paladin", name: "Paladin", role: "Sacred warrior", iconKey: "champion-paladin",
    description: "An oath-bound warrior whose conviction becomes protection, healing, and judgment.",
    specializations: [
      specialization("knight-errant", "Knight-Errant", "A wandering oath-bearer beyond any single banner."),
      specialization("champion-paladin", "Champion Paladin", "A consecrated champion who shelters allies in battle."),
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
    description: "A pact-bound caster defined by a patron, narrow themed magic, invocations, boons, and consequential bargains.",
    specializations: [
      specialization("demon-warlock", "Demon Warlock", "An infernal binder who masters every clause of a dangerous debt."),
      specialization("witch", "Witch", "A local occultist of old bargains, curses, remedies, and names."),
      specialization("fae-touched", "Fae-Touched", "A glamour-walker carrying the gifts and prices of a fae compact."),
    ],
  },
  druid: {
    id: "druid", name: "Druid", role: "Primal caster", iconKey: "beast-warden",
    description: "A primal caster shaped by land, weather, beasts, seasons, and transformation.",
    specializations: [specialization("circle-warden", "Circle Warden", "A keeper of a particular land, season, or wild covenant.")],
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
    id: "bard", name: "Bard", role: "Arcane support", iconKey: "courtier",
    description: "A magical artist who shapes courage, memory, emotion, and story through performance.",
    specializations: [specialization("lore-singer", "Lore Singer", "A keeper of magical histories and living songs.")],
  },
  artificer: {
    id: "artificer", name: "Artificer", role: "Arcane craft", iconKey: "hedge-mage",
    description: "An arcane maker who binds spells into tools, constructs, alchemy, and engineered wonders.",
    specializations: [
      specialization("runesmith", "Runesmith", "A maker of inscribed weapons, wards, and lasting enchantments."),
      specialization("alchemist", "Alchemist", "A specialist in reagents, transformation, and prepared compounds."),
    ],
  },

  // Civic, social, service, and productive professions. Their progression grants
  // real capabilities without assuming that competence must be combat-capable.
  innkeeper: {
    id: "innkeeper", name: "Innkeeper", role: "Service", iconKey: "envoy", common: true,
    description: "A host, business keeper, information broker, and steward of public sanctuary.",
    specializations: [specialization("house-steward", "House Steward", "Builds a public room into sanctuary, network, and livelihood.")],
  },
  farmer: {
    id: "farmer", name: "Farmer", role: "Husbandry", iconKey: "beast-warden", common: true,
    description: "A cultivator of soil, stock, seasons, tools, and coordinated rural labour.",
    specializations: [specialization("land-steward", "Land Steward", "Reads a living holding as one connected system.")],
  },
  merchant: {
    id: "merchant", name: "Merchant", role: "Trade", iconKey: "envoy", common: true,
    description: "A professional of appraisal, supply, credit, logistics, negotiation, and market relationships.",
    specializations: [
      specialization("peddler", "Peddler", "A road merchant of modest goods and resilient local networks."),
      specialization("guild-factor", "Guild Factor", "A market operator working across institutions and nations."),
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
