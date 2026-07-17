import { ATTRIBUTE_CAP, ATTR_KEYS, CHARACTER_LEVEL_CAP } from "../config.js";

// The progression vocabulary deliberately avoids combat-only class language.
// A Profession is a broad calling, an Archetype is its specialized identity,
// and a Path is one small stackable unit of growth. Grades own the hard rank
// caps: no path can ever span the full character range by itself.
export const PATH_GRADE_CAPS = Object.freeze({
  standard: 15,
  advanced: 10,
  specialized: 5,
});

export const PATH_KINDS = Object.freeze(["profession", "racial", "utility"]);

export const STARTING_LEVEL_BY_POWER_TIER = Object.freeze({
  standard: 10,
  mid: 25,
  epic: 45,
  legendary: 65,
  mythical: 85,
  divine: 100,
});

// These bands are shared by character creation, Codex dossiers, generated
// inhabitants, and narrator context. The deliberately narrow high tiers leave
// a visible gulf above the level-60 ceiling of a living world legend.
export const LEVEL_TIER_BANDS = Object.freeze([
  Object.freeze({ id: "standard", label: "Standard", min: 1, max: 20 }),
  Object.freeze({ id: "mid", label: "Veteran", min: 21, max: 40 }),
  Object.freeze({ id: "epic", label: "Epic", min: 41, max: 60 }),
  Object.freeze({ id: "legendary", label: "Legendary", min: 61, max: 70 }),
  Object.freeze({ id: "mythical", label: "Mythical", min: 71, max: 85 }),
  Object.freeze({ id: "divine", label: "Divine", min: 86, max: 100 }),
]);

export function levelTier(level) {
  const value = Math.max(1, Math.min(CHARACTER_LEVEL_CAP, Math.floor(Number(level) || 1)));
  return LEVEL_TIER_BANDS.find((band) => value >= band.min && value <= band.max) || LEVEL_TIER_BANDS[0];
}

export function progressionXpForLevel(level) {
  const bounded = Math.max(1, Math.min(CHARACTER_LEVEL_CAP, Math.floor(Number(level) || 1)));
  const completed = bounded - 1;
  return completed * completed * 20;
}

// Authored and generated sheets gain room for larger scores as their shared
// stack grows. A level-100 character may reach the 90 apex; a newcomer cannot
// simply declare an apex sheet without also carrying the progression for it.
export function attributeCeilingForLevel(level) {
  const bounded = Math.max(1, Math.min(CHARACTER_LEVEL_CAP, Math.floor(Number(level) || 1)));
  const mortalCurve = 10 + Math.floor(bounded * 0.8);
  // The final specialized stacks deliberately accelerate inside the Divine
  // band. This envelope covers every legal route projection (some reach 90 at
  // level 94) while retaining the slower curve through level 84.
  const divineCurve = bounded >= 85 ? 79 + Math.ceil(((bounded - 85) * 11) / 9) : 0;
  return Math.min(ATTRIBUTE_CAP, Math.max(mortalCurve, divineCurve));
}

// One-time migration from the retired 0–30 scale. The curve barely moves
// ordinary scores but opens sharply at the legendary end: 5→6, 10→14,
// 20→42, 30→90. Never apply this to an already-versioned character.
export function expandLegacyAttribute(value) {
  const old = Math.max(0, Math.min(30, Number(value) || 0));
  if (old === 0) return 0;
  return Math.min(ATTRIBUTE_CAP, Math.round(old * (1 + 2 * Math.pow(old / 30, 1.5))));
}

export function expandLegacyAttributes(attributes = {}) {
  return Object.fromEntries(ATTR_KEYS.map((key) => [key, expandLegacyAttribute(attributes[key])]));
}

const profile = (name, domain, archetype, archetypeDescription, attributes, utility, signature) => ({
  name, domain, archetype, archetypeDescription, attributes, utility, signature,
});

// Every canonical profession has an authored non-combat-inclusive domain and a
// specialized archetype. These records also drive its projected stat shape;
// weights are intentionally uneven so a level-100 build has real weaknesses.
export const PROFESSION_PROFILES = Object.freeze({
  wanderer: profile("Wanderer", "generalist", "Adaptive Seeker", "Builds an identity from roads taken, disciplines borrowed, and choices made in motion.", ["wit", "vigor", "reflex", "presence"], "Wayfaring", "A Path Without End"),
  innkeeper: profile("Innkeeper", "service", "House Steward", "Builds a public room into sanctuary, network, and livelihood.", ["presence", "wit", "mind", "vigor"], "Hospitality", "Open Door"),
  farmer: profile("Farmer", "husbandry", "Land Steward", "Reads soil, season, stock, and the human labor binding them together.", ["vigor", "body", "wit", "mind"], "Husbandry", "Living Harvest"),
  peddler: profile("Peddler", "trade", "Road Broker", "Turns roads, rumors, and modest wares into a resilient moving enterprise.", ["wit", "presence", "reflex", "vigor"], "Logistics", "Market Without Walls"),
  artisan: profile("Artisan", "craft", "Master Maker", "Turns material knowledge, practiced hands, and patient design into works that outlive their maker.", ["wit", "mind", "body", "vigor"], "Craftsmanship", "Masterwork Without Peer"),
  labourer: profile("Labourer", "labor", "Guild Hand", "Makes endurance, leverage, teamwork, and practical judgment into a dependable living craft.", ["vigor", "body", "wit", "presence"], "Endurance", "The Work of Many Hands"),
  scholar: profile("Scholar", "scholarship", "Polymath", "Builds deep learning into discovery, teaching, archival memory, and solutions no one else can see.", ["mind", "wit", "presence", "reflex"], "Research", "Living Archive"),
  healer: profile("Healer", "medicine", "Master Chirurgeon", "Joins diagnosis, surgery, remedies, and bedside judgment into the power to preserve life.", ["mind", "wit", "presence", "vigor"], "Medicine", "Death Denied"),
  performer: profile("Performer", "arts", "Virtuoso", "Shapes voice, movement, story, and audience into an art able to carry memory across generations.", ["presence", "wit", "reflex", "mind"], "Performance", "Song the World Remembers"),
  merchant: profile("Merchant", "trade", "Guild Factor", "Builds supply, credit, trust, and risk into an enterprise spanning roads and nations.", ["wit", "presence", "mind", "vigor"], "Commerce", "Market of Nations"),
  mariner: profile("Mariner", "seafaring", "Tide Navigator", "Reads wind, water, hull, crew, and stars as one moving system.", ["wit", "reflex", "vigor", "mind"], "Navigation", "Master of Every Tide"),
  outlaw: profile("Outlaw", "underworld", "Free-Road Captain", "Survives outside law through stealth, nerve, contacts, mobility, and chosen loyalties.", ["reflex", "wit", "presence", "body"], "Underworld", "No Chain Holds"),
  soldier: profile("Soldier", "martial", "Line Veteran", "Turns drill, formation, fieldcraft, and mutual trust into survival under organized violence.", ["vigor", "body", "reflex", "wit"], "Drill", "The Last Line"),
  hunter: profile("Hunter", "wilderness", "Master Tracker", "Reads quarry, terrain, weather, patience, and the ethics of taking life from the wild.", ["wit", "reflex", "vigor", "body"], "Tracking", "No Quarry Escapes"),
  attendant: profile("Attendant", "service", "Household Steward", "Makes discretion, anticipation, care, and exact routine into the invisible structure of a household.", ["presence", "wit", "reflex", "mind"], "Stewardship", "The Perfect Household"),
  monarch: profile("Monarch", "governance", "Sovereign", "Makes institutions, loyalties, and consequence answer a single crown.", ["presence", "mind", "wit", "vigor"], "Statecraft", "Living Realm"),
  noble: profile("Noble", "governance", "Estate Architect", "Shapes land, patronage, obligation, and reputation into lasting power.", ["presence", "wit", "mind", "vigor"], "Stewardship", "House Eternal"),
  witch: profile("Witch", "occult", "Coven Keeper", "Braids practical craft, old bargains, and dangerous local knowledge.", ["mind", "wit", "presence", "vigor"], "Herblore", "Name Beneath Names"),
  speaker: profile("Speaker", "civic", "Consensus Voice", "Leads through trust, memory, and the difficult craft of being heard.", ["presence", "wit", "mind", "vigor"], "Mediation", "Many Voices, One Word"),
  "chapter-master": profile("Chapter-Master", "command", "Order Marshal", "Holds doctrine, discipline, and a militant institution in one hand.", ["presence", "body", "mind", "vigor"], "Logistics", "The Chapter Endures"),
  "hold-father": profile("Hold-Father", "civic", "Hold Steward", "Guards a people's stores, disputes, memory, and stone-bound future.", ["vigor", "presence", "mind", "body"], "Stewardship", "Heart of the Hold"),
  matriarch: profile("Matriarch", "civic", "Kinship Anchor", "Turns kinship, care, memory, and hard authority into communal survival.", ["presence", "wit", "vigor", "mind"], "Mediation", "The Line Unbroken"),

  sellsword: profile("Sellsword", "martial", "Contract Vanguard", "Holds the paid line through discipline, shield-work, and terms kept.", ["vigor", "body", "reflex", "wit"], "Fieldcraft", "Unbroken Contract"),
  reaver: profile("Reaver", "martial", "Momentum Breaker", "Turns impact, pain, and relentless motion into battlefield dominance.", ["body", "vigor", "reflex", "presence"], "Intimidation", "Avalanche Incarnate"),
  ranger: profile("Ranger", "wilderness", "Far-Walker", "Masters distance, spoor, weather, and the patient geometry of the hunt.", ["reflex", "wit", "vigor", "body"], "Survival", "Horizon Hunter"),
  assassin: profile("Assassin", "covert", "Quiet Blade", "Controls notice, approach, and the decisive instant before resistance begins.", ["reflex", "wit", "body", "mind"], "Infiltration", "Death Between Heartbeats"),
  priest: profile("Priest", "devotional", "Mercy Keeper", "Channels belief into restoration, protection, and moral authority.", ["presence", "mind", "vigor", "wit"], "Medicine", "Sanctuary Made Flesh"),
  "hedge-mage": profile("Hedge-Mage", "arcane", "Improvised Thaumaturge", "Makes personal, practical magic from scraps no academy would trust.", ["mind", "wit", "presence", "reflex"], "Ritualcraft", "Impossible Working"),
  knight: profile("Knight-Errant", "martial", "Oath Vanguard", "Joins armor, horsemanship, duty, and independent judgment.", ["vigor", "body", "presence", "reflex"], "Riding", "Oath Beyond Banners"),
  "war-priest": profile("War-Priest", "devotional", "Battle Chaplain", "Carries restoration and judgment through the center of a battle.", ["presence", "vigor", "mind", "body"], "Medicine", "Last Rite, First Stand"),
  duelist: profile("Duelist", "martial", "Perfect Measure", "Wins through distance, nerve, technical precision, and one exact opening.", ["reflex", "wit", "body", "presence"], "Etiquette", "The Final Measure"),
  warden: profile("Beast-Warden", "wilderness", "Wild Bondkeeper", "Reads beasts and broken country as partners rather than obstacles.", ["wit", "reflex", "vigor", "presence"], "Beastcraft", "Voice of the Wild"),
  "war-captain": profile("War-Captain", "command", "Line Commander", "Turns terrain, frightened people, and limited time into victory.", ["presence", "wit", "vigor", "body"], "Logistics", "Army of One Will"),
  archmage: profile("Archmage", "arcane", "Grand Theurgist", "Unifies many schools into magic at the scale of armies and realms.", ["mind", "wit", "presence", "vigor"], "Ritualcraft", "Lawgiver to Reality"),
  paladin: profile("Paladin", "devotional", "Consecrated Champion", "Makes conviction a shelter to allies and a weapon against corruption.", ["presence", "vigor", "body", "mind"], "Leadership", "Dawn That Walks"),
  "dragon-hunter": profile("Dragon-Hunter", "wilderness", "Wyrm Stalker", "Studies colossal prey until scale, wing, and breath reveal one fatal instant.", ["reflex", "wit", "body", "vigor"], "Monster Lore", "Sky-Piercing Shot"),
  sorcerer: profile("High Sorcerer", "arcane", "Binding Savant", "Builds overwhelming magic from exact theory, will, and disciplined reserves.", ["mind", "wit", "presence", "vigor"], "Scholarship", "Master Equation"),
  warlord: profile("Warlord", "command", "Conquest Marshal", "Leads by proven force, strategic appetite, and the loyalty of victory.", ["body", "presence", "vigor", "wit"], "Logistics", "Banner of Dominion"),
  "fae-touched": profile("Fae-Touched", "occult", "Glamour Walker", "Balances steel, weather, beauty, and the exact language of bargains.", ["reflex", "mind", "presence", "wit"], "Pactcraft", "Name Unbound"),
  champion: profile("Undying Champion", "martial", "Deathless Hero", "Turns accumulated wounds, memory, and refusal into mythic endurance.", ["vigor", "body", "presence", "reflex"], "Leadership", "The Grave Refuses"),
  warlock: profile("Demon-Warlock", "occult", "Infernal Binder", "Commands borrowed horror by mastering every clause of its price.", ["mind", "presence", "wit", "vigor"], "Pactcraft", "Hell in Chains"),
  "dragon-ascendant": profile("Dragon-Ascendant", "racial", "Wyrm Sovereign", "Develops awakened dragon lineage into embodied elemental dominion.", ["vigor", "presence", "body", "mind"], "Lineage", "True Dragon Dominion"),
  "enchanter-tyrant": profile("Enchanter-Tyrant", "arcane", "Sovereign Will", "Makes command, desire, and magical compulsion indistinguishable.", ["presence", "mind", "wit", "vigor"], "Statecraft", "One Will, All Worlds"),
  envoy: profile("Envoy", "social", "Accord Weaver", "Builds passage, terms, and durable trust out of opposed interests.", ["presence", "wit", "mind", "reflex"], "Diplomacy", "Peace Between Empires"),
  courtier: profile("Courtier", "social", "Velvet Operator", "Trades in attention, access, desire, status, and secrets with surgical grace.", ["presence", "wit", "reflex", "mind"], "Intrigue", "Court Without Walls"),
});

// Older content and narrator-authored exact vocations are folded into broad
// professions while preserving the original vocation as the character's
// archetype. This is the compatibility bridge that makes "cooper", "porter",
// or "marsh-spearman" specialized focuses rather than stray class systems.
export const PROFESSION_ALIASES = Object.freeze({
  blacksmith: "artisan", cooper: "artisan", baker: "artisan", forger: "artisan", shipwright: "artisan",
  porter: "labourer", laborer: "labourer", bonded: "labourer", prisoner: "labourer",
  scribe: "scholar", "house-scribe": "scholar",
  "herb-healer": "healer", poisoner: "healer",
  bard: "performer",
  trader: "merchant",
  sailor: "mariner",
  bandit: "outlaw", smuggler: "outlaw", "grave-robber": "outlaw", cutpurse: "outlaw", highwayman: "outlaw", thief: "outlaw",
  "marsh-spearman": "soldier", "pit-fighter": "soldier", "horse-archer": "soldier", "axe-man": "soldier",
  "knife-fighter": "soldier", "deserter-spearman": "soldier", barbarian: "soldier",
  tracker: "hunter", poacher: "hunter",
  "body-attendant": "attendant", "indentured-housemaid": "attendant", housemaid: "attendant",
  monk: "priest",
});

export function canonicalProfessionId(value) {
  const id = slug(value);
  if (!id) return null;
  if (PROFESSION_PROFILES[id]) return id;
  return PROFESSION_ALIASES[id] || null;
}

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function weightsFor(attributes, offset = 0) {
  const weights = Object.fromEntries(ATTR_KEYS.map((key) => [key, 1]));
  [7, 5, 3, 2].forEach((weight, index) => {
    if (attributes[index]) weights[attributes[index]] = weight;
  });
  // Supporting paths change the emphasis without erasing the calling's core
  // shape; a mage's ritual utility still develops Mind, and a farmer's animal
  // craft still develops Vigor. This is what lets apex specialists approach 90
  // while keeping deliberate weaknesses low.
  const emphasis = attributes[offset % Math.max(1, attributes.length)];
  if (emphasis) weights[emphasis] += offset ? 3 : 0;
  return weights;
}

const gradeCap = (grade) => PATH_GRADE_CAPS[grade];

function pathRecord({ id, name, kind = "profession", grade, description, weights, prerequisites = [], milestones = {} }) {
  return Object.freeze({
    id, name, kind, grade, maxRank: gradeCap(grade), description,
    weights: Object.freeze({ ...weights }),
    prerequisites: Object.freeze(prerequisites.map((entry) => Object.freeze({ ...entry }))),
    milestones: Object.freeze({ ...milestones }),
  });
}

const SHARED_PATHS = {
  "awakened-lineage": pathRecord({
    id: "awakened-lineage", name: "Awakened Lineage", kind: "racial", grade: "advanced",
    description: "Invested racial development: inherited senses, form, resilience, and supernatural nature. These ranks share the same 100-level budget as every profession rank.",
    weights: { body: 4, reflex: 3, vigor: 6, mind: 2, wit: 2, presence: 4 },
    prerequisites: [{ totalLevel: 30 }],
    milestones: { 1: "Lineage Stirring", 5: "Ancestral Expression", 10: "Lineage Ascendant" },
  }),
  "worldly-versatility": pathRecord({
    id: "worldly-versatility", name: "Worldly Versatility", kind: "utility", grade: "advanced",
    description: "A utility alternative for characters who do not cultivate racial development: languages, adaptation, contacts, tools, and practiced breadth.",
    weights: { body: 2, reflex: 3, vigor: 3, mind: 4, wit: 5, presence: 4 },
    prerequisites: [{ totalLevel: 30 }],
    milestones: { 1: "Second Discipline", 5: "Adaptable Practice", 10: "Master Generalist" },
  }),
};

function generatedPaths(professionId, p) {
  const root = slug(professionId);
  const coreKind = p.domain === "racial" ? "racial" : "profession";
  const foundation = `${root}-foundation`;
  const practice = `${root}-${slug(p.domain)}-practice`;
  const utility = `${root}-${slug(p.utility)}`;
  const archetype = `${root}-${slug(p.archetype)}`;
  const mastery = `${root}-mastery`;
  const synthesis = `${root}-synthesis`;
  const exemplar = `${root}-exemplar`;
  const specialist = `${root}-${slug(p.utility)}-specialist`;
  const paragon = `${root}-paragon`;
  const transcendent = `${root}-transcendent`;
  return {
    [foundation]: pathRecord({
      id: foundation, name: `${p.name} Foundation`, kind: coreKind, grade: "standard",
      description: `The durable fundamentals of the ${p.name} profession.`, weights: weightsFor(p.attributes),
      milestones: { 1: "Calling Chosen", 5: "Practiced Hand", 10: "Established Professional", 15: "Foundation Complete" },
    }),
    [practice]: pathRecord({
      id: practice, name: `${p.domain[0].toUpperCase()}${p.domain.slice(1)} Practice`, kind: coreKind, grade: "standard",
      description: `A second foundation in ${p.domain}, broadening the calling beyond a single trick.`, weights: weightsFor(p.attributes, 1),
      prerequisites: [{ pathId: foundation, rank: 5 }],
      milestones: { 1: "Cross-Training", 5: "Reliable Practice", 10: "Domain Veteran", 15: "Domain Complete" },
    }),
    [utility]: pathRecord({
      id: utility, name: `${p.utility} Discipline`, kind: "utility", grade: "advanced",
      description: `A side path in ${p.utility.toLowerCase()} that remains useful away from direct confrontation.`, weights: weightsFor(p.attributes, 2),
      prerequisites: [{ pathId: foundation, rank: 10 }, { totalLevel: 25 }],
      milestones: { 1: `${p.utility} Initiate`, 5: `${p.utility} Expert`, 10: `${p.utility} Master` },
    }),
    [archetype]: pathRecord({
      id: archetype, name: p.archetype, kind: coreKind, grade: "advanced", description: p.archetypeDescription,
      weights: weightsFor(p.attributes), prerequisites: [{ pathId: foundation, rank: 15 }, { pathId: practice, rank: 10 }, { totalLevel: 45 }],
      milestones: { 1: "Archetype Awakened", 5: "Archetype Signature", 10: "Archetype Mastered" },
    }),
    [mastery]: pathRecord({
      id: mastery, name: `${p.name} Mastery`, kind: coreKind, grade: "advanced",
      description: `Integrates the profession's foundations into confident, high-order practice.`, weights: weightsFor(p.attributes, 1),
      prerequisites: [{ pathId: archetype, rank: 5 }, { totalLevel: 55 }],
      milestones: { 1: "Master's Method", 5: "Effortless Practice", 10: "Complete Mastery" },
    }),
    [synthesis]: pathRecord({
      id: synthesis, name: `${p.archetype} Synthesis`, kind: coreKind, grade: "advanced",
      description: `Fuses profession, archetype, lineage, and utility experience into one coherent discipline.`, weights: weightsFor(p.attributes, 3),
      prerequisites: [{ pathId: archetype, rank: 10 }, { pathId: mastery, rank: 5 }, { totalLevel: 65 }],
      milestones: { 1: "Disciplines Joined", 5: "Seamless Synthesis", 10: "Perfect Integration" },
    }),
    [exemplar]: pathRecord({
      id: exemplar, name: `${p.name} Exemplar`, kind: coreKind, grade: "specialized",
      description: `Rare ranks that turn mastery into an example others build traditions around.`, weights: weightsFor(p.attributes),
      prerequisites: [{ pathId: mastery, rank: 10 }, { totalLevel: 75 }],
      milestones: { 1: "Exemplar", 3: "Living Standard", 5: "Tradition Founder" },
    }),
    [specialist]: pathRecord({
      id: specialist, name: `${p.utility} Savant`, kind: "utility", grade: "specialized",
      description: `A rare utility culmination proving that non-combat practice can stand beside legendary battle arts.`, weights: weightsFor(p.attributes, 2),
      prerequisites: [{ pathId: utility, rank: 10 }, { totalLevel: 80 }],
      milestones: { 1: "Savant's Insight", 3: "Impossible Technique", 5: "World-Renowned Savant" },
    }),
    [paragon]: pathRecord({
      id: paragon, name: `${p.archetype} Paragon`, kind: coreKind, grade: "specialized",
      description: `A near-mythical expression of the profession's specialized archetype.`, weights: weightsFor(p.attributes, 1),
      prerequisites: [{ pathId: synthesis, rank: 10 }, { pathId: exemplar, rank: 5 }, { totalLevel: 85 }],
      milestones: { 1: "Paragon Threshold", 3: "Mythic Expression", 5: "Archetype Paragon" },
    }),
    [transcendent]: pathRecord({
      id: transcendent, name: p.signature, kind: coreKind, grade: "specialized",
      description: `The final five ranks of this exemplar route: ${p.signature}.`, weights: weightsFor(p.attributes),
      prerequisites: [{ pathId: paragon, rank: 5 }, { pathId: specialist, rank: 5 }, { totalLevel: 95 }],
      milestones: { 1: "Apex Threshold", 3: "World-Class Presence", 5: p.signature },
    }),
  };
}

const generatedCatalog = {};
for (const [professionId, p] of Object.entries(PROFESSION_PROFILES)) {
  Object.assign(generatedCatalog, generatedPaths(professionId, p));
}

export const PROGRESSION_PATHS = Object.freeze({ ...SHARED_PATHS, ...generatedCatalog });

function buildFor(professionId, p) {
  const root = slug(professionId);
  return Object.freeze({
    id: professionId,
    professionId,
    archetype: p.archetype,
    archetypePathId: `${root}-${slug(p.archetype)}`,
    description: p.archetypeDescription,
    allocations: Object.freeze([
      { role: "foundation", pathId: `${root}-foundation`, ranks: 15 },
      { role: "practice", pathId: `${root}-${slug(p.domain)}-practice`, ranks: 15 },
      { role: "utility", pathId: `${root}-${slug(p.utility)}`, ranks: 10 },
      // The same ten-rank slot can cultivate supernatural lineage or broader
      // utility. Either choice consumes the shared level budget.
      { role: "side", pathId: "awakened-lineage", alternatePathId: "worldly-versatility", ranks: 10, choice: "racial-or-utility" },
      { role: "archetype", pathId: `${root}-${slug(p.archetype)}`, ranks: 10 },
      { role: "mastery", pathId: `${root}-mastery`, ranks: 10 },
      { role: "synthesis", pathId: `${root}-synthesis`, ranks: 10 },
      { role: "exemplar", pathId: `${root}-exemplar`, ranks: 5 },
      { role: "utility-specialist", pathId: `${root}-${slug(p.utility)}-specialist`, ranks: 5 },
      { role: "paragon", pathId: `${root}-paragon`, ranks: 5 },
      { role: "transcendent", pathId: `${root}-transcendent`, ranks: 5 },
    ].map((entry) => Object.freeze(entry))),
  });
}

export const PROFESSION_BUILDS = Object.freeze(Object.fromEntries(
  Object.entries(PROFESSION_PROFILES).map(([id, p]) => [id, buildFor(id, p)]),
));

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

function attributeGains(path, rank) {
  const points = path.grade === "standard" ? 2 : path.grade === "advanced" ? 3 : 4;
  const tickets = [];
  for (const key of ATTR_KEYS) {
    for (let i = 0; i < Math.max(1, path.weights[key] || 1); i++) tickets.push(key);
  }
  const gains = Object.fromEntries(ATTR_KEYS.map((key) => [key, 0]));
  const start = (hash(path.id) + rank * 7) % tickets.length;
  for (let point = 0; point < points; point++) {
    gains[tickets[(start + point * 5) % tickets.length]] += 1;
  }
  return Object.fromEntries(Object.entries(gains).filter(([, value]) => value > 0));
}

function prerequisiteMet(requirement, ranks, totalLevel) {
  if (requirement.totalLevel != null && totalLevel < requirement.totalLevel) return false;
  if (requirement.pathId && (ranks[requirement.pathId] || 0) < (requirement.rank || 1)) return false;
  return true;
}

function archetypeVariant(build, value) {
  const requested = slug(value);
  const canonicalId = build.archetypePathId;
  const canonicalName = slug(build.archetype);
  if (!requested || requested === slug(canonicalId) || requested === canonicalName) {
    return { id: canonicalId, label: build.archetype, custom: false };
  }
  return {
    id: requested,
    label: requested.replace(/(^|[-_])([a-z])/g, (_, separator, letter) => `${separator ? " " : ""}${letter.toUpperCase()}`),
    custom: true,
  };
}

function variantPathMap(build, variant) {
  if (!variant.custom) return {};
  return Object.fromEntries(build.allocations
    .filter((allocation) => ["archetype", "synthesis", "paragon", "transcendent"].includes(allocation.role))
    .map((allocation) => [allocation.pathId, `${allocation.pathId}--${variant.id}`]));
}

function materializePath(basePath, allocation, variant, pathMap) {
  const variantId = pathMap[basePath.id];
  const role = allocation.role;
  const shouldReshape = !!variantId;
  const names = {
    archetype: variant.label,
    synthesis: `${variant.label} Synthesis`,
    paragon: `${variant.label} Paragon`,
    transcendent: `${variant.label} Apex`,
  };
  const weights = { ...basePath.weights };
  if (shouldReshape) {
    const seed = hash(`${variant.id}:${role}`);
    weights[ATTR_KEYS[seed % ATTR_KEYS.length]] = (weights[ATTR_KEYS[seed % ATTR_KEYS.length]] || 1) + 5;
    weights[ATTR_KEYS[(seed + 2) % ATTR_KEYS.length]] = (weights[ATTR_KEYS[(seed + 2) % ATTR_KEYS.length]] || 1) + 2;
  }
  return {
    ...basePath,
    id: variantId || basePath.id,
    name: names[role] || basePath.name,
    description: shouldReshape
      ? `${variant.label} redirects this stage of ${basePath.description.charAt(0).toLowerCase()}${basePath.description.slice(1)}`
      : basePath.description,
    weights,
    prerequisites: basePath.prerequisites.map((requirement) => ({
      ...requirement,
      ...(requirement.pathId && pathMap[requirement.pathId] ? { pathId: pathMap[requirement.pathId] } : {}),
    })),
  };
}

export function professionProfile(professionId) {
  return PROFESSION_PROFILES[professionId] || null;
}

export function professionBuild(professionId) {
  return PROFESSION_BUILDS[professionId] || null;
}

export function progressionPath(pathId) {
  return PROGRESSION_PATHS[pathId] || null;
}

// Expand the compact stack into the exact 100-row ledger used by both the
// engine and Codex. The sidePath choice swaps only the explicit racial/utility
// branch; everything else remains identical and validated.
export function compileProfessionBuild(professionId, { sidePath = "racial", archetypeId = null } = {}) {
  const build = professionBuild(professionId);
  if (!build) return null;
  const variant = archetypeVariant(build, archetypeId);
  const pathMap = variantPathMap(build, variant);
  const ranks = {};
  const attributes = Object.fromEntries(ATTR_KEYS.map((key) => [key, 1]));
  const levels = [];
  const segments = [];
  for (const allocation of build.allocations) {
    const chosenId = allocation.choice === "racial-or-utility" && sidePath === "utility"
      ? allocation.alternatePathId
      : allocation.pathId;
    const basePath = progressionPath(chosenId);
    if (!basePath) throw new Error(`Unknown progression path ${chosenId} in ${professionId}`);
    const path = materializePath(basePath, allocation, variant, pathMap);
    if (allocation.ranks > path.maxRank) throw new Error(`${chosenId} exceeds its ${path.grade} cap`);
    const unmet = path.prerequisites.filter((requirement) => !prerequisiteMet(requirement, ranks, levels.length));
    if (unmet.length) throw new Error(`${chosenId} prerequisites are not met in ${professionId}`);
    const start = levels.length + 1;
    for (let rank = 1; rank <= allocation.ranks; rank++) {
      if (levels.length >= CHARACTER_LEVEL_CAP) throw new Error(`${professionId} exceeds level ${CHARACTER_LEVEL_CAP}`);
      const nextLevel = levels.length + 1;
      const proposedGains = attributeGains(path, rank);
      const gains = {};
      for (const [key, amount] of Object.entries(proposedGains)) {
        const before = attributes[key];
        attributes[key] = Math.min(ATTRIBUTE_CAP, attributeCeilingForLevel(nextLevel), before + amount);
        const applied = attributes[key] - before;
        if (applied > 0) gains[key] = applied;
      }
      const feature = path.milestones[rank] || `Deepens ${path.name}`;
      ranks[path.id] = rank;
      levels.push(Object.freeze({
        level: nextLevel,
        professionId,
        pathId: path.id,
        pathName: path.name,
        kind: path.kind,
        grade: path.grade,
        rank,
        maxRank: path.maxRank,
        archetypeId: variant.id,
        attributeGains: Object.freeze({ ...gains }),
        cumulativeAttributes: Object.freeze({ ...attributes }),
        feature,
      }));
    }
    segments.push(Object.freeze({
      pathId: path.id,
      alternatePathId: allocation.alternatePathId || null,
      pathName: path.name,
      kind: path.kind,
      grade: path.grade,
      maxRank: path.maxRank,
      description: path.description,
      prerequisites: Object.freeze(path.prerequisites.map((requirement) => Object.freeze({ ...requirement }))),
      ranks: allocation.ranks,
      start,
      end: levels.length,
    }));
  }
  if (levels.length !== CHARACTER_LEVEL_CAP) throw new Error(`${professionId} expands to ${levels.length}, not ${CHARACTER_LEVEL_CAP}`);
  return Object.freeze({
    ...build,
    archetypeId: variant.id,
    archetype: variant.label,
    sidePath,
    totalLevels: levels.length,
    levels: Object.freeze(levels),
    segments: Object.freeze(segments),
    ranks: Object.freeze({ ...ranks }),
    finalAttributes: Object.freeze({ ...attributes }),
  });
}

export function progressionAtLevel(professionId, level, options) {
  const compiled = compileProfessionBuild(professionId, options);
  if (!compiled) return null;
  const target = Math.max(0, Math.min(CHARACTER_LEVEL_CAP, Math.floor(Number(level) || 0)));
  const rows = compiled.levels.slice(0, target);
  const ranks = {};
  for (const row of rows) ranks[row.pathId] = row.rank;
  return Object.freeze({
    professionId,
    level: target,
    ranks: Object.freeze(ranks),
    latest: rows.at(-1) || null,
    attributes: rows.at(-1)?.cumulativeAttributes || Object.freeze(Object.fromEntries(ATTR_KEYS.map((key) => [key, 1]))),
  });
}

export function validateProgressionCatalog() {
  const errors = [];
  for (const [id, path] of Object.entries(PROGRESSION_PATHS)) {
    if (!PATH_KINDS.includes(path.kind)) errors.push(`${id}: invalid kind ${path.kind}`);
    if (path.maxRank !== PATH_GRADE_CAPS[path.grade]) errors.push(`${id}: cap does not match ${path.grade}`);
    for (const key of Object.keys(path.weights || {})) if (!ATTR_KEYS.includes(key)) errors.push(`${id}: invalid attribute ${key}`);
    for (const requirement of path.prerequisites) {
      if (requirement.pathId && !PROGRESSION_PATHS[requirement.pathId]) errors.push(`${id}: missing prerequisite ${requirement.pathId}`);
    }
  }
  for (const id of Object.keys(PROFESSION_BUILDS)) {
    for (const sidePath of ["racial", "utility"]) {
      try {
        const compiled = compileProfessionBuild(id, { sidePath });
        if (compiled.levels.some((row, index) => row.level !== index + 1)) errors.push(`${id}: non-contiguous levels`);
      } catch (error) {
        errors.push(`${id}: ${error.message}`);
      }
    }
  }
  return errors;
}
