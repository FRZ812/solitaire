import { progressionGrant } from "./progression-features.js";

const option = (id, name, description, grants = []) => Object.freeze({ id, name, description, grants: Object.freeze(grants) });
const choice = (id, threshold, name, description, options, parentChoiceId = null, parentOptionId = null) => Object.freeze({
  id, threshold, name, description, parentChoiceId, parentOptionId, options: Object.freeze(options),
});
const proficiency = (id) => progressionGrant("proficiency", id);
const ability = (id) => progressionGrant("ability", id);
const action = (id, name, description) => progressionGrant("action", id, name && description ? { name, description } : {});
const passive = (id, name, description, details = {}) => progressionGrant("passive", id, { name, description, ...details });
const abilityChoice = (id, options, count = 1, name = "Spellbook Expansion", description = "Choose a new formula from the eligible wizard spell list.") => progressionGrant("ability-choice", id, {
  name, description, count, options: Object.freeze(options),
});
const SORCERER_SPELLS = Object.freeze(["firebolt", "frost-lance", "combust", "lightning-bolt", "fireball", "chain-lightning", "tempest", "meteor"]);
const SORCERER_METAMAGIC = Object.freeze(["empowered-signature", "shaped-signature", "quickened-signature", "twinned-signature", "piercing-signature", "transmuted-signature", "perfected-signature"]);
const SORCERER_UTILITY_METAMAGIC = Object.freeze(["subtle-signature", "lingering-signature", "triggered-signature", "reversible-signature"]);
const sorcererSpellChoice = (id, name, description) => progressionGrant("ability-choice", id, {
  name, description, count: 1, options: SORCERER_SPELLS,
});
const sorcererMetamagicChoice = (id, slot, name, description, { profileId = null, spellGrantId = null } = {}) => progressionGrant("metamagic-choice", id, {
  name, description, count: 1, options: SORCERER_METAMAGIC, slot,
  appliesTo: profileId ? "specialized-spell-profile" : "signature-spell",
  ...(profileId ? { profileId } : {}),
  ...(spellGrantId ? { spellGrantId } : {}),
});
const sorcererUtilityMetamagicChoice = (id, slot, name, description) => progressionGrant("metamagic-choice", id, {
  name, description, count: 1, options: SORCERER_UTILITY_METAMAGIC, slot,
  appliesTo: "signature-spell", utility: true,
});
const capability = (professionId, branchOption) => progressionGrant("action", `${professionId}:${branchOption.id}`, {
  name: branchOption.name,
  description: branchOption.description,
  branchCapability: true,
});

const twoStage = (professionId, primary, advanced) => Object.freeze([
  choice(`${professionId}-primary`, 15, primary.name, primary.description, [
    option(primary.a.id, primary.a.name, primary.a.description, [capability(professionId, primary.a), proficiency(`${professionId}:${primary.a.id}`)]),
    option(primary.b.id, primary.b.name, primary.b.description, [capability(professionId, primary.b), proficiency(`${professionId}:${primary.b.id}`)]),
  ]),
  choice(`${professionId}-${primary.a.id}-advanced`, 40, advanced.name, advanced.description, [
    option(advanced.a.id, advanced.a.name, advanced.a.description, [capability(professionId, advanced.a), proficiency(`${professionId}:${advanced.a.id}`)]),
    option(advanced.b.id, advanced.b.name, advanced.b.description, [capability(professionId, advanced.b), proficiency(`${professionId}:${advanced.b.id}`)]),
  ], `${professionId}-primary`, primary.a.id),
  choice(`${professionId}-${primary.b.id}-advanced`, 40, advanced.name, advanced.description, [
    option(advanced.a.id, advanced.a.name, advanced.a.description, [capability(professionId, advanced.a), proficiency(`${professionId}:${advanced.a.id}`)]),
    option(advanced.b.id, advanced.b.name, advanced.b.description, [capability(professionId, advanced.b), proficiency(`${professionId}:${advanced.b.id}`)]),
  ], `${professionId}-primary`, primary.b.id),
]);

const branch = (name, description, aId, aName, aDescription, bId, bName, bDescription) => ({
  name, description,
  a: { id: aId, name: aName, description: aDescription },
  b: { id: bId, name: bName, description: bDescription },
});

const WIZARD_BRANCHES = Object.freeze([
  choice("wizard-school", 10, "Arcane School", "Choose the school that receives your deepest study. General wizard circles, rituals, and spellbook growth continue regardless of this choice.", [
    option("abjuration", "Abjuration", "Build magic from wards, negation, and exact rules of protection.", [
      ability("mana-shield"),
      passive("wizard:ward-theory", "Ward Theory", "Mana Shield is treated as a studied abjuration and persistent wards are easier to diagnose, repair, and layer."),
      proficiency("wizard:abjuration"),
    ]),
    option("enchantment", "Enchantment", "Alter attention, emotion, intention, and binding desire.", [
      ability("hex"),
      passive("wizard:subtle-suggestion", "Subtle Suggestion", "Minor compulsions can be concealed inside ordinary cadence when no overtly hostile order is attempted."),
      proficiency("wizard:enchantment"),
    ]),
    option("illusion", "Illusion", "Control what minds accept through false sensation, absence, and embodied fear.", [
      ability("mirror-image"),
      passive("wizard:misdirection", "Misdirection", "Illusions can redirect scrutiny toward a convincing false detail rather than merely hiding the truth."),
      proficiency("wizard:illusion"),
    ]),
    option("evocation", "Evocation", "Project elemental and force energy with disciplined destructive geometry.", [
      ability("combust"),
      passive("wizard:elemental-attunement", "Elemental Attunement", "Choose a familiar elemental expression when preparing spells and handle its ordinary hazards without losing control."),
      proficiency("wizard:evocation"),
    ]),
    option("necromancy", "Necromancy", "Study death, undeath, enervation, and the traffic of stolen vitality.", [
      ability("wither"),
      passive("wizard:grave-lore", "Grave Lore", "Recognize common undead, funerary workings, soul injuries, and the residue left by death magic."),
      proficiency("wizard:necromancy"),
    ]),
    option("transmutation", "Transmutation", "Rewrite matter, living form, motion, and the physical assumptions beneath them.", [
      ability("stone-armor"),
      action("wizard:minor-alchemy", "Minor Alchemy", "Temporarily exchange one mundane material property for another through a prepared transmutative process."),
      proficiency("wizard:transmutation"),
    ]),
    option("universalist", "Universalist", "Trade a single school's early supremacy for prepared flexibility and cross-school scholarship.", [
      passive("wizard:flexible-preparation", "Flexible Preparation", "Replace one low-circle prepared formula during a safe pause without rebuilding the entire preparation."),
      passive("wizard:broad-study", "Broad Study", "Research outside a favored school without the usual unfamiliar-school penalty."),
      proficiency("wizard:universalist"),
    ]),
  ]),

  choice("abjuration-discipline", 30, "Abjuration Discipline", "Decide whether protection should endure hostile force or erase the hostile theorem itself.", [
    option("warder", "Warder", "Layer protections that survive repeated attacks and shelter others.", [
      ability("arcane-aegis"),
      passive("wizard:layered-wards", "Layered Wards", "Separate abjurations can overlap without collapsing into the same warding layer."),
      proficiency("wizard:warder"),
    ]),
    option("nullifier", "Nullifier", "Find the load-bearing clause in hostile magic and remove it.", [
      ability("dispel"),
      passive("wizard:nullifying-theorem", "Nullifying Theorem", "Dispel more reliably identifies which clause must be severed from a complex active spell."),
      proficiency("wizard:nullifier"),
    ]),
  ], "wizard-school", "abjuration"),
  choice("warder-mastery", 50, "Warder Mastery", "Choose whether your final warding art becomes an unbroken fortress or a mirror turned against enemy casters.", [
    option("abjuration-fortress", "Abjuration Fortress", "Become the fixed center of a layered defense that shelters a whole position.", [
      passive("wizard:layered-aegis", "Layered Aegis", "Arcane Aegis can protect an adjacent ally and retains a smaller inner layer when its outer ward breaks."),
      action("wizard:establish-fortress-ward", "Establish Fortress Ward", "Anchor overlapping abjurations to a prepared position so allies inside share their protection."),
      proficiency("wizard:abjuration-fortress"),
    ]),
    option("mirror-warden", "Mirror Warden", "Catch hostile workings at the ward boundary and return their force.", [
      ability("spell-reflection"),
      passive("wizard:perfect-reflection", "Perfect Reflection", "Spell Reflection preserves more of a reflected spell's structure and wastes less of its returning force."),
      proficiency("wizard:mirror-warden"),
    ]),
  ], "abjuration-discipline", "warder"),
  choice("nullifier-mastery", 50, "Nullifier Mastery", "Choose immediate spellbreaking or a domain where magic itself is denied.", [
    option("nullifier-spellbreaker", "Spellbreaker", "Counter workings as they form and punish incomplete casting.", [
      action("wizard:counterspell", "Counterspell", "Use a prepared reaction to contest a visible spell before its formula resolves."),
      passive("wizard:spellbreakers-timing", "Spellbreaker's Timing", "Recognize the final vulnerable instant in a hostile casting and commit negation without hesitation."),
      proficiency("wizard:nullifier-spellbreaker"),
    ]),
    option("nullifier-antimage", "Antimage", "Anchor a field in which lesser magic cannot remain coherent.", [
      ability("antimagic-field"),
      passive("wizard:antimagic-anchor", "Antimagic Anchor", "Your own concentration stabilizes Antimagic Field against attempts to move, narrow, or dispel it."),
      proficiency("wizard:nullifier-antimage"),
    ]),
  ], "abjuration-discipline", "nullifier"),

  choice("enchantment-discipline", 30, "Enchantment Discipline", "Choose whether enchantment wins through invisible influence or direct sovereign command.", [
    option("beguiler", "Beguiler", "Conceal compulsion inside trust, desire, and apparently self-authored decisions.", [
      ability("beguiling-command"),
      passive("wizard:veiled-compulsion", "Veiled Compulsion", "Targets have greater difficulty recognizing that an enchantment shaped their decision after the effect ends."),
      proficiency("wizard:beguiler"),
    ]),
    option("dominator", "Dominator", "Impose a command strongly enough to contest an unwilling mind in the moment.", [
      ability("charm"),
      passive("wizard:iron-command", "Iron Command", "Direct enchantments carry greater authority when the order is short, explicit, and immediately possible."),
      proficiency("wizard:dominator"),
    ]),
  ], "wizard-school", "enchantment"),
  choice("beguiler-mastery", 50, "Beguiler Mastery", "Choose intimate reconstruction of one mind or subtle influence spread across many voices.", [
    option("heartweaver", "Heartweaver", "Rewrite remembered motive and emotional meaning without leaving a crude blank.", [
      action("wizard:rewrite-memory", "Rewrite Memory", "During a sustained working, alter how a creature remembers the meaning and emotional cause of a bounded event."),
      passive("wizard:subtle-compulsion", "Subtle Compulsion", "A carefully plausible enchantment leaves almost no overt magical pressure for its subject to notice."),
      proficiency("wizard:heartweaver"),
    ]),
    option("many-voiced", "Many-Voiced", "Thread one influence through a conversation, performance, or gathered crowd.", [
      passive("wizard:mass-compulsion", "Mass Compulsion", "A single non-destructive suggestion can be carried to several listening minds, though every subject contests it separately."),
      action("wizard:chorus-suggestion", "Chorus Suggestion", "Embed a shared inclination in a speech or performance heard by a gathered audience."),
      proficiency("wizard:many-voiced"),
    ]),
  ], "enchantment-discipline", "beguiler"),
  choice("dominator-mastery", 50, "Dominator Mastery", "Choose absolute control of a present subject or a command that binds across time and distance.", [
    option("puppet-master", "Puppet Master", "Seize active control and maintain a small, tightly governed stable of thralls.", [
      action("wizard:dominate", "Dominate", "Contest a creature's will to direct its immediate movement and ordinary actions while concentration holds."),
      passive("wizard:thrall-capacity", "Thrall Capacity", "Maintain one additional long-bound enchanted subject without weakening every other compulsion."),
      proficiency("wizard:puppet-master"),
    ]),
    option("oathbinder", "Oathbinder", "Turn spoken obligation into a durable magical command with named consequences.", [
      ability("geas"),
      passive("wizard:binding-command", "Binding Command", "A freely spoken promise supplies stronger terms for Geas and is harder to twist through literal evasion."),
      proficiency("wizard:oathbinder"),
    ]),
  ], "enchantment-discipline", "dominator"),

  choice("illusion-discipline", 30, "Illusion Discipline", "Choose between becoming absent from perception and making terror perceptibly real.", [
    option("veilwalker", "Veilwalker", "Move through blind spots and hide the evidence of spellcasting itself.", [
      action("wizard:shadowstep", "Shadowstep", "Cross a short gap between two dim or obscured positions without traversing the visible space between them."),
      passive("wizard:concealed-casting", "Concealed Casting", "Hide the sensory signs of a prepared illusion inside the false scene it creates."),
      proficiency("wizard:veilwalker"),
    ]),
    option("nightmare-weaver", "Nightmare Weaver", "Give a target's own fears enough sensory weight to wound and disable.", [
      ability("phantasmal-killer"),
      passive("wizard:believed-wounds", "Believed Wounds", "A creature that wholly accepts an illusion suffers consequences that persist briefly after disbelief."),
      proficiency("wizard:nightmare-weaver"),
    ]),
  ], "wizard-school", "illusion"),
  choice("veilwalker-mastery", 50, "Veilwalker Mastery", "Choose perfect personal absence or an independent duplicate capable of sustaining deception.", [
    option("unseen-master", "Unseen Master", "Erase yourself from sight and from the small traces by which skilled hunters follow magic.", [
      ability("greater-invisibility"),
      passive("wizard:untraceable", "Untraceable", "Greater Invisibility also suppresses mundane tracks and the obvious residue of your movement."),
      proficiency("wizard:unseen-master"),
    ]),
    option("living-double", "Living Double", "Create a persistent false self with independent posture, speech, and routine.", [
      passive("wizard:persistent-images", "Persistent Images", "One complex illusion can continue a rehearsed sequence without active concentration."),
      action("wizard:create-living-double", "Create Living Double", "Fashion a convincing autonomous double that can speak and follow a bounded script."),
      proficiency("wizard:living-double"),
    ]),
  ], "illusion-discipline", "veilwalker"),
  choice("nightmare-mastery", 50, "Nightmare Mastery", "Choose fear that propagates through groups or a single phantasm made lethally substantial.", [
    option("terror-architect", "Terror Architect", "Design one fear response that spreads when victims witness each other break.", [
      action("wizard:mass-terror", "Mass Terror", "Project a tailored nightmare across a gathered group; each mind resists separately."),
      passive("wizard:contagious-fear", "Contagious Fear", "A creature succumbing to your illusion makes the same fear more convincing to nearby witnesses."),
      proficiency("wizard:terror-architect"),
    ]),
    option("thought-killer", "Thought Killer", "Condense one victim's certainty into a phantasm with momentary physical consequence.", [
      passive("wizard:phantasm-made-real", "Phantasm Made Real", "Phantasmal Killer ignores part of magical protection while its victim fully believes the threat."),
      action("wizard:incarnate-phantasm", "Incarnate Phantasm", "Briefly let a single targeted illusion exert physical force on the mind that created its truth."),
      proficiency("wizard:thought-killer"),
    ]),
  ], "illusion-discipline", "nightmare-weaver"),

  choice("evocation-discipline", 30, "Evocation Discipline", "Choose command of mutable elements or exact battlefield spell geometry.", [
    option("elementalist", "Elementalist", "Convert and intensify elemental power to answer a target's defenses.", [
      ability("elemental-surge"),
      passive("wizard:elemental-conversion", "Elemental Conversion", "When preparing an elemental evocation, exchange its element for another one you have thoroughly studied."),
      proficiency("wizard:elementalist"),
    ]),
    option("battle-evoker", "Battle Evoker", "Place destructive force among allies with disciplined spatial control.", [
      ability("fireball"),
      passive("wizard:sculpt-spell", "Sculpt Spell", "Exclude a small number of clearly perceived allies from the worst of an area evocation."),
      proficiency("wizard:battle-evoker"),
    ]),
  ], "wizard-school", "evocation"),
  choice("elementalist-mastery", 50, "Elementalist Mastery", "Choose controlled cataclysm or sovereignty over living storms.", [
    option("cataclysm", "Cataclysm", "Bring overwhelming elemental ruin down without surrendering its boundary.", [
      ability("meteor"),
      passive("wizard:cataclysm-control", "Cataclysm Control", "Choose a protected center inside your largest elemental evocations where their destructive edge does not fall."),
      proficiency("wizard:cataclysm"),
    ]),
    option("storm-sovereign", "Storm Sovereign", "Sustain and redirect a battlefield storm as a continuing domain.", [
      ability("tempest"),
      passive("wizard:storm-mastery", "Storm Mastery", "Tempest can be redirected between rounds without rebuilding the complete weather equation."),
      proficiency("wizard:storm-sovereign"),
    ]),
  ], "evocation-discipline", "elementalist"),
  choice("battle-evoker-mastery", 50, "Battle Evoker Mastery", "Choose force that breaks the hardest defense or flawless safety inside mass destruction.", [
    option("force-breaker", "Force Breaker", "Drive pure unmaking through armor, wards, and resistant matter.", [
      ability("disintegrate"),
      passive("wizard:force-penetration", "Force Penetration", "Force and unmaking evocations contest magical barriers as though their spell circle were higher."),
      proficiency("wizard:force-breaker"),
    ]),
    option("spell-sculptor", "Spell Sculptor", "Shape every violent edge around chosen lives and structures.", [
      passive("wizard:perfect-sculpting", "Perfect Sculpting", "Area evocations can leave several precise pockets unharmed instead of merely sparing the caster's position."),
      action("wizard:reshape-evocation", "Reshape Evocation", "Alter a prepared area evocation into a line, cone, ring, or bounded burst before releasing it."),
      proficiency("wizard:spell-sculptor"),
    ]),
  ], "evocation-discipline", "battle-evoker"),

  choice("necromancy-discipline", 30, "Necromantic Discipline", "Choose authority over created undead or death magic applied directly to the living soul.", [
    option("undead-lord", "Undead Lord", "Create, command, and improve a bounded company of undead servants.", [
      ability("summon-undead"),
      action("raise-undead"),
      action("command-undead"),
      passive("wizard:undead-command", "Undead Command", "Simple undead under your authority understand coordinated formations and conditional orders."),
      proficiency("wizard:undead-lord"),
    ]),
    option("death-magic", "Death Magic", "Specialize in enervation, level drain, and direct attacks on animating force.", [
      ability("enervation"),
      passive("wizard:death-magic-potency", "Death-Magic Potency", "Your necromantic attacks treat weakened vitality as a flaw they can widen."),
      proficiency("wizard:death-magic"),
    ]),
  ], "wizard-school", "necromancy"),
  choice("undead-lord-mastery", 50, "Undead Lord Mastery", "Choose a numerous legion or a small number of perfected, individually crafted servants.", [
    option("legion-master", "Legion Master", "Raise and coordinate many lesser undead as one military body.", [
      action("wizard:mass-raise-undead", "Mass Raise Undead", "Use a prepared site and sufficient remains to raise a bounded group of lesser undead in one working."),
      passive("wizard:undead-legion", "Undead Legion", "Lesser undead can be organized into formations that consume fewer individual commands."),
      proficiency("wizard:legion-master"),
    ]),
    option("perfect-servitor", "Perfect Servitor", "Invest more craft, memory, and preserved capability into a chosen undead servant.", [
      action("wizard:empower-undead", "Empower Undead", "Rebuild one controlled undead with a selected physical or magical improvement."),
      passive("wizard:perfect-servitor", "Perfect Servitor", "Maintain one individually perfected undead without it counting as a mass of lesser summons."),
      proficiency("wizard:perfect-servitor"),
    ]),
  ], "necromancy-discipline", "undead-lord"),
  choice("death-magic-mastery", 50, "Death Magic Mastery", "Choose bodily ruin, stolen vitality, or the narrow and resisted perfection of instant death.", [
    option("ruin", "Ruin", "Maximize destructive death-energy and force the body toward collapse.", [
      ability("death-clutch"),
      passive("wizard:ruin-potency", "Ruin Potency", "Death Clutch bites more deeply into targets already suffering a curse or level drain."),
      proficiency("wizard:death-ruin"),
    ]),
    option("drain", "Drain", "Steal vitality and magical vigor rather than merely destroying them.", [
      ability("soul-siphon"),
      passive("wizard:life-theft-mastery", "Life-Theft Mastery", "Vitality stolen beyond immediate need can briefly reinforce the necromancer as a fading ward."),
      proficiency("wizard:death-drain"),
    ]),
    option("instant-death", "Instant Death", "Perfect a resisted heart-seizing theorem that only reliably ends already weakened lives.", [
      ability("grasp-heart"),
      passive("wizard:death-threshold-mastery", "Death Threshold Mastery", "Recognize when a living target has crossed the narrow threshold at which Grasp Heart can take hold."),
      proficiency("wizard:instant-death"),
    ]),
  ], "necromancy-discipline", "death-magic"),

  choice("transmutation-discipline", 30, "Transmutation Discipline", "Choose mutable bodies and matter or the manipulation of motion and local time.", [
    option("fleshshaper", "Fleshshaper", "Rewrite physical form, density, and living adaptation.", [
      ability("flesh-to-stone"),
      passive("wizard:mutable-form", "Mutable Form", "Prepared transmutations can exchange one modest physical adaptation for another during safe rest."),
      proficiency("wizard:fleshshaper"),
    ]),
    option("chronomancer", "Chronomancer", "Manipulate tempo, sequence, and the relative speed of a bounded subject.", [
      ability("haste"),
      passive("wizard:tempo-control", "Tempo Control", "Haste can be shaped around deliberate bursts rather than wasting its acceleration between actions."),
      proficiency("wizard:chronomancer"),
    ]),
  ], "wizard-school", "transmutation"),
  choice("fleshshaper-mastery", 50, "Fleshshaper Mastery", "Choose freely adaptive form or irreversible mineral transformation.", [
    option("master-shaper", "Master Shaper", "Assume complete alternate forms while preserving trained mind and magical identity.", [
      ability("polymorph"),
      passive("wizard:adaptive-form", "Adaptive Form", "A chosen polymorphed body can retain one additional trained capability appropriate to its anatomy."),
      proficiency("wizard:master-shaper"),
    ]),
    option("petrifier", "Petrifier", "Make transformations persist after concentration and resist ordinary reversal.", [
      passive("wizard:lasting-transmutation", "Lasting Transmutation", "Flesh to Stone and prepared material changes decay far more slowly after active control ends."),
      action("wizard:fix-transmutation", "Fix Transmutation", "Use rare reagents and a ritual seal to make an eligible material transformation permanent."),
      proficiency("wizard:petrifier"),
    ]),
  ], "transmutation-discipline", "fleshshaper"),
  choice("chronomancer-mastery", 50, "Chronomancer Mastery", "Choose stolen moments held in reserve or relentless acceleration of practiced casting.", [
    option("time-lord", "Time Lord", "Open an interstice between moments and preserve part of it for deliberate action.", [
      ability("time-stop"),
      passive("wizard:temporal-reserve", "Temporal Reserve", "After Time Stop, retain one brief reserved instant that can only be spent on movement or preparation."),
      proficiency("wizard:time-lord"),
    ]),
    option("celerity-savant", "Celerity Savant", "Compress familiar casting sequences until spell and response nearly coincide.", [
      passive("wizard:accelerated-casting", "Accelerated Casting", "One familiar low-circle wizard spell can be woven into another action without consuming a full casting interval."),
      action("wizard:steal-tempo", "Steal Tempo", "Briefly slow a visible foe and use the stolen interval to reposition or begin a prepared formula."),
      proficiency("wizard:celerity-savant"),
    ]),
  ], "transmutation-discipline", "chronomancer"),

  choice("universalist-discipline", 30, "Universalist Discipline", "Choose unmatched breadth of preparation or countermagic informed by every school's structure.", [
    option("polymath", "Polymath", "Turn broad study into a larger and more adaptable living spellbook.", [
      abilityChoice("wizard:polymath-spell", ["frost-nova", "electrocute", "deep-freeze", "lightning-bolt", "blizzard", "chain-lightning"], 1, "Polymath Formula", "Choose one additional general wizard formula from a circle you can study."),
      passive("wizard:expanded-preparation", "Expanded Preparation", "Maintain one additional prepared wizard formula without giving up a defensive reserve."),
      proficiency("wizard:polymath"),
    ]),
    option("countermage", "Countermage", "Use comparative school knowledge to recognize and dismantle unfamiliar workings.", [
      ability("dispel"),
      passive("wizard:school-insight", "School Insight", "After identifying a spell's school, predict the most likely structure of its next escalation or defense."),
      proficiency("wizard:countermage"),
    ]),
  ], "wizard-school", "universalist"),
  choice("polymath-mastery", 50, "Polymath Mastery", "Choose the spellbook as an inexhaustible archive or synthesize several schools into new magic.", [
    option("living-spellbook", "Living Spellbook", "Carry an unusually broad set of mastered formulae and reorganize them as knowledge grows.", [
      abilityChoice("wizard:living-spellbook-formulae", ["frost-nova", "electrocute", "deep-freeze", "fireball", "lightning-bolt", "blizzard", "haste", "chain-lightning", "tempest"], 2, "Living Spellbook Formulae", "Choose two additional general wizard formulae from circles you can study."),
      passive("wizard:expanded-preparation-ii", "Expanded Preparation II", "Prepare two additional wizard formulae and reorganize those selections at a spellbook during safe rest."),
      proficiency("wizard:living-spellbook"),
    ]),
    option("spell-synthesis", "Spell Synthesis", "Combine principles from separate schools without reducing either to a crude imitation.", [
      ability("arcane-convergence"),
      passive("wizard:cross-school-synthesis", "Cross-School Synthesis", "A researched spell can inherit one bounded property from a second school when its theorem explains the interaction."),
      proficiency("wizard:spell-synthesis"),
    ]),
  ], "universalist-discipline", "polymath"),
  choice("countermage-mastery", 50, "Countermage Mastery", "Choose reactive universal spellbreaking or a prepared zone that denies magic altogether.", [
    option("universal-spellbreaker", "Universal Spellbreaker", "Read any school quickly enough to contest its spell at the instant of completion.", [
      action("wizard:universal-counterspell", "Universal Counterspell", "Use a prepared reaction to contest a visible spell without first sharing or identifying its school."),
      passive("wizard:reactive-dispelling", "Reactive Dispelling", "Dispel can be committed during an enemy casting instead of only against an effect that has already resolved."),
      proficiency("wizard:universal-spellbreaker"),
    ]),
    option("universal-antimage", "Universal Antimage", "Apply broad comparative theory to hold a stable field of magical denial.", [
      ability("antimagic-field"),
      passive("wizard:antimagic-anchor", "Antimagic Anchor", "Your own concentration stabilizes Antimagic Field against attempts to move, narrow, or dispel it."),
      proficiency("wizard:universal-antimage"),
    ]),
  ], "universalist-discipline", "countermage"),
]);

// Sorcerer branches modify the chosen signature spell rather than granting the
// breadth of a second spellbook. Every origin has an L30 discipline and each
// discipline has its own L50 apotheosis; no option is selected implicitly.

const SORCERER_BRANCHES = Object.freeze([
  choice("sorcerous-focus", 10, "Sorcerous Focus", "Choose one infinitely mutable primary or several specialized signature spells with independent metamagic profiles.", [
    option("singular-savant", "Singular Savant", "Restrict true mastery to one signature in exchange for many more modification and utility modes.", [
      sorcererUtilityMetamagicChoice("sorcerer:singular-metamagic-i", 6, "Signature Utility I", "Choose a bounded utility modification reserved for the signature."),
      passive("sorcerer:singular-devotion", "Singular Devotion", "Only the current primary signature receives metamagic specialization; widened general scope is deliberately surrendered for extra utility modes.", { metamagicSpellLimit: 1, overridesGeneralMetamagicScope: true, utilityOnlyBonusSlots: true }),
      action("sorcerer:signature-utility-mode", "Signature Utility Mode", "Express one harmless bounded property of the signature as a practical effect."),
    ]),
    option("specialized-spellweaver", "Specialized Spellweaver", "Give several narrow signature spells separately selected metamagic profiles.", [
      sorcererSpellChoice("sorcerer:weave-spell-i", "First Woven Spell", "Choose the first spell to receive an independent profile."),
      sorcererMetamagicChoice("sorcerer:weave-profile-i", 0, "First Woven Profile", "Choose its defining modification.", { profileId: "woven-spell-i", spellGrantId: "sorcerer:weave-spell-i" }),
      passive("sorcerer:separate-profiles", "Separate Profiles", "Each woven signature spell stores modifications independently from the primary and other profiles.", { independentMetamagicProfiles: true, metamagicSpellLimit: 4 }),
    ]),
  ]),
  choice("singular-savant-discipline", 30, "Singular Savant Discipline", "Choose utility through many forms or unsurpassed force in the one signature.", [
    option("mutable-signature", "Mutable Signature", "Unlock more safe shapes, targets, durations, and utility modes.", [
      sorcererUtilityMetamagicChoice("sorcerer:singular-metamagic-ii", 7, "Signature Utility II", "Choose another bounded utility modification reserved for the signature."),
      action("sorcerer:reframe-signature", "Reframe Signature", "Exchange a bounded targeting or area property for a learned utility mode."),
      passive("sorcerer:mutable-signature", "Mutable Signature", "One spell can solve more problems without becoming several learned spells."),
    ]),
    option("overwhelming-signature", "Overwhelming Signature", "Concentrate extra modifications into force, penetration, speed, and reliability.", [
      sorcererUtilityMetamagicChoice("sorcerer:singular-force-ii", 7, "Controlled Overchannel Utility", "Choose a utility safeguard or timing modification for the overchannelled signature."),
      action("sorcerer:overchannel-signature", "Overchannel Signature", "Push the signature beyond ordinary magnitude at a bounded cost."),
      passive("sorcerer:overwhelming-signature", "Overwhelming Signature", "Additional reserve can magnify one selected combat property."),
    ]),
  ], "sorcerous-focus", "singular-savant"),
  choice("mutable-signature-apotheosis", 50, "Mutable Signature Apotheosis", "Choose limitless utility forms or perfect simultaneous modulation.", [
    option("thousand-forms", "Thousand Forms", "Make the one signature a library of safe practical expressions.", [
      sorcererUtilityMetamagicChoice("sorcerer:singular-metamagic-iii", 8, "Signature Utility III", "Choose a final bounded utility modification for the signature."),
      action("sorcerer:invent-signature-mode", "Invent Signature Mode", "Develop a new utility mode by narrowing an established signature property."),
      passive("sorcerer:thousand-forms", "Thousand Forms", "Utility modes can be exchanged safely without changing the signature spell."),
    ]),
    option("perfect-modulator", "Perfect Modulator", "Layer several modifications while preserving exact output.", [
      sorcererUtilityMetamagicChoice("sorcerer:modulator-metamagic-iii", 8, "Perfect Utility Modulation", "Choose a final bounded utility modification for the signature."),
      action("sorcerer:modulate-signature", "Modulate Signature", "Tune force, shape, duration, and sensory expression before release."),
      passive("sorcerer:perfect-modulation", "Perfect Modulation", "Compatible extra signature modifications can coexist safely."),
    ]),
  ], "singular-savant-discipline", "mutable-signature"),
  choice("overwhelming-signature-apotheosis", 50, "Overwhelming Signature Apotheosis", "Choose one catastrophic peak or relentless repeated perfection.", [
    option("cataclysmic-signature", "Cataclysmic Signature", "Build the signature toward its greatest bounded release.", [
      sorcererUtilityMetamagicChoice("sorcerer:cataclysm-metamagic-iii", 8, "Cataclysm Safeguard", "Choose a final bounded timing or reversal safeguard for the signature."),
      action("sorcerer:release-cataclysm", "Release Cataclysm", "Commit an extraordinary reserve to a terrain-scale signature expression."),
      passive("sorcerer:cataclysm-containment", "Cataclysm Containment", "Define strict boundaries before releasing apex magnitude."),
    ]),
    option("inexhaustible-signature", "Inexhaustible Signature", "Repeat the perfected favourite with exceptional economy.", [
      sorcererUtilityMetamagicChoice("sorcerer:inexhaustible-metamagic-iii", 8, "Inexhaustible Utility", "Choose a final bounded utility modification for the signature."),
      action("sorcerer:recall-signature-power", "Recall Signature Power", "Recover part of a resisted signature cast."),
      passive("sorcerer:inexhaustible-signature", "Inexhaustible Signature", "Repeated signature casting wastes progressively less reserve."),
    ]),
  ], "singular-savant-discipline", "overwhelming-signature"),
  choice("spellweaver-discipline", 30, "Spellweaver Discipline", "Choose a larger constellation or a tightly interlocked specialist pair.", [
    option("constellation-weaver", "Constellation Weaver", "Add more narrow spells, each with one defining profile.", [
      sorcererSpellChoice("sorcerer:weave-spell-ii", "Second Woven Spell", "Choose a second independently profiled spell."),
      sorcererMetamagicChoice("sorcerer:weave-profile-ii", 0, "Second Woven Profile", "Choose its defining modification.", { profileId: "woven-spell-ii", spellGrantId: "sorcerer:weave-spell-ii" }),
      passive("sorcerer:constellation-weaving", "Constellation Weaving", "Switch spells without transferring one profile onto another."),
    ]),
    option("paired-specialist", "Paired Specialist", "Perfect two complementary spells with deeper profiles.", [
      sorcererMetamagicChoice("sorcerer:paired-profile-depth", 1, "Paired Profile Depth", "Choose a second modification for the first woven spell.", { profileId: "woven-spell-i", spellGrantId: "sorcerer:weave-spell-i" }),
      action("sorcerer:weave-paired-casting", "Weave Paired Casting", "Let one specialized spell establish the condition used by its pair."),
      passive("sorcerer:paired-specialism", "Paired Specialism", "The signature and woven spell form a deliberate specialist pair."),
    ]),
  ], "sorcerous-focus", "specialized-spellweaver"),
  choice("constellation-weaver-apotheosis", 50, "Constellation Weaver Apotheosis", "Choose a grand constellation or harmonic transitions among profiles.", [
    option("grand-constellation", "Grand Constellation", "Add a third independently modified spell.", [
      sorcererSpellChoice("sorcerer:weave-spell-iii", "Third Woven Spell", "Choose a third independently profiled spell."),
      sorcererMetamagicChoice("sorcerer:weave-profile-iii", 0, "Third Woven Profile", "Choose its defining modification.", { profileId: "woven-spell-iii", spellGrantId: "sorcerer:weave-spell-iii" }),
      passive("sorcerer:grand-constellation", "Grand Constellation", "Three woven profiles remain independently stable."),
    ]),
    option("harmonic-weaver", "Harmonic Weaver", "Chain compatible effects while preserving separate profiles.", [
      sorcererMetamagicChoice("sorcerer:harmonic-profile-depth", 1, "Harmonic Profile", "Choose a second modification for the second woven spell.", { profileId: "woven-spell-ii", spellGrantId: "sorcerer:weave-spell-ii" }),
      action("sorcerer:harmonic-transition", "Harmonic Transition", "Carry a bounded condition from one profile into the next spell."),
      passive("sorcerer:harmonic-weaving", "Harmonic Weaving", "Rapid profile changes preserve casting rhythm."),
    ]),
  ], "spellweaver-discipline", "constellation-weaver"),
  choice("paired-specialist-apotheosis", 50, "Paired Specialist Apotheosis", "Choose maximal depth or perfect counterpoint in the specialist pair.", [
    option("twin-apotheosis", "Twin Apotheosis", "Give the first woven spell a third deep modification.", [
      sorcererMetamagicChoice("sorcerer:twin-profile-depth", 2, "Twin Profile Apotheosis", "Choose a third modification for the first woven spell.", { profileId: "woven-spell-i", spellGrantId: "sorcerer:weave-spell-i" }),
      action("sorcerer:perfect-pair", "Perfect Pair", "Prepare either spell to answer the outcome created by the other."),
      passive("sorcerer:twin-apotheosis", "Twin Apotheosis", "Both spells retain deep but separate identities."),
    ]),
    option("counterpoint-master", "Counterpoint Master", "Make the pair answer opposed battlefield needs.", [
      sorcererMetamagicChoice("sorcerer:counterpoint-profile", 2, "Counterpoint Profile", "Choose a third modification for the first woven spell.", { profileId: "woven-spell-i", spellGrantId: "sorcerer:weave-spell-i" }),
      action("sorcerer:reverse-counterpoint", "Reverse Counterpoint", "Reverse spell order without blending profiles."),
      passive("sorcerer:counterpoint-mastery", "Counterpoint Mastery", "The pair remains distinct even in immediate succession."),
    ]),
  ], "spellweaver-discipline", "paired-specialist"),
]);

const CLERIC_BRANCHES = Object.freeze([
  choice("sacred-domain", 10, "Sacred Domain", "Choose the sacred duty that gives domain ministry its enduring direction.", [
    option("life", "Life Domain", "Preserve life through healing, purification, refuge, and practical care.", [action("cleric:life-domain-office", "Life Domain Office", "Prepare a life-domain liturgy around the particular needs of patients and caregivers."), passive("cleric:life-domain", "Life Domain", "Restoration and protection are measured by survival, recovery, and dignity."), proficiency("cleric:life-domain")]),
    option("light", "Light Domain", "Reveal corruption, defend hope, and confront hostile spirits with sacred radiance.", [action("cleric:reveal-profanity", "Reveal Profanity", "Expose minor spiritual corruption with controlled sacred light."), passive("cleric:light-domain", "Light Domain", "Revelation, hope, and sacred radiance become a distinct ministerial duty."), proficiency("cleric:light-domain")]),
    option("war", "War Domain", "Serve courage, discipline, protection, and just force in communal defense.", [ability("battle-hymn"), passive("cleric:war-domain", "War Domain", "Battle prayer binds force to declared duty and protection of the vulnerable."), proficiency("cleric:war-domain")]),
    option("grave", "Grave Domain", "Guard the boundary between life and death, oppose undeath, and keep rightful memory.", [action("cleric:sense-undeath", "Sense Undeath", "Detect nearby profane animation or a disturbed funerary boundary."), passive("cleric:grave-domain", "Grave Domain", "Death is witnessed and defended against theft, denial, and profane animation."), proficiency("cleric:grave-domain")]),
    option("knowledge", "Knowledge Domain", "Preserve truthful records, reveal hidden context, and make learning answerable to the people it affects.", [action("cleric:consecrate-inquiry", "Consecrate Inquiry", "Define the question, evidence, witnesses, and ethical limits of a sacred investigation."), passive("cleric:knowledge-domain", "Knowledge Domain", "Divination and scholarship preserve uncertainty, provenance, and consent."), proficiency("cleric:knowledge-domain")]),
    option("tempest", "Tempest Domain", "Read storm and sea as sacred forces of warning, passage, destruction, and renewal.", [action("cleric:read-sacred-weather", "Read Sacred Weather", "Interpret immediate weather and spiritual pressure without claiming perfect prediction."), passive("cleric:tempest-domain", "Tempest Domain", "Storm prayer respects collateral danger and the needs of exposed communities."), proficiency("cleric:tempest-domain")]),
    option("nature", "Nature Domain", "Keep the covenants joining settlement, harvest, wild places, beasts, and seasonal change.", [action("cleric:bless-living-place", "Bless Living Place", "Recognize the needs and obligations binding a community to its living landscape."), passive("cleric:nature-domain", "Nature Domain", "Sacred stewardship measures flourishing across people, beasts, soil, and water."), proficiency("cleric:nature-domain")]),
    option("trickery", "Trickery Domain", "Protect freedom through masks, reversals, guarded truth, and the humiliation of unjust power.", [action("cleric:consecrate-mask", "Consecrate Mask", "Prepare a bounded sacred identity for protection, witness, or ritual inversion."), passive("cleric:trickery-domain", "Trickery Domain", "Sacred deception must defend agency rather than manufacture obedience."), proficiency("cleric:trickery-domain")]),
  ]),

  choice("life-ministry", 30, "Life Ministry", "Choose direct miraculous care or institutions of communal preservation.", [
    option("healing-ministry", "Healing Ministry", "Purify affliction, rescue the failing, and guide recovery beyond the first miracle.", [ability("purifying-light"), action("cleric:triage-liturgy", "Triage Liturgy", "Order healing prayer and mundane care across several wounded creatures."), proficiency("cleric:healing-ministry")]),
    option("shelter-ministry", "Shelter Ministry", "Build refuge through wards, supplies, trained helpers, and communal restoration.", [action("cleric:establish-refuge", "Establish Refuge", "Organize a defensible place of care with explicit duties and capacity."), passive("cleric:shelter-ministry", "Shelter Ministry", "Sacred shelter joins practical capacity, accountable custody, and layered wards."), proficiency("cleric:shelter-ministry")]),
  ], "sacred-domain", "life"),
  choice("healing-ministry-apotheosis", 50, "Healing Ministry Apotheosis", "Choose miraculous intercession or mastery over widespread affliction.", [
    option("miracle-physician", "Miracle Physician", "Intercede at the edge of death without replacing the long work of recovery.", [ability("divine-intercession"), passive("cleric:crisis-intercession", "Crisis Intercession", "Emergency grace becomes strongest for allies in genuine mortal danger."), proficiency("cleric:miracle-physician")]),
    option("purity-saint", "Purity Saint", "Cleanse corruption while restoring the strength needed to survive it.", [action("cleric:great-purification", "Great Purification", "Lead a prolonged cure of poison, curse, disease, or spiritual contamination."), passive("cleric:purity-saint", "Purity Saint", "Cleansing preserves the patient instead of treating survival as secondary."), proficiency("cleric:purity-saint")]),
  ], "life-ministry", "healing-ministry"),
  choice("shelter-ministry-apotheosis", 50, "Shelter Ministry Apotheosis", "Choose inviolable refuge or a self-sustaining community of care.", [
    option("sanctuary-saint", "Sanctuary Saint", "Make a gathered refuge untouchable for the brief moment survival requires.", [action("cleric:inviolable-refuge", "Inviolable Refuge", "Complete an apex refuge rite bounded by immediate collective peril."), passive("cleric:sanctuary-saint", "Sanctuary Saint", "Protection is judged by whom the refuge preserves, not by the power it excludes."), proficiency("cleric:sanctuary-saint")]),
    option("house-of-mercy", "House of Mercy", "Turn communal restoration into a durable institution rather than one charismatic miracle.", [action("cleric:found-house-of-mercy", "Found House of Mercy", "Establish accountable long-term systems of shelter and healing."), passive("cleric:house-of-mercy", "House of Mercy", "Durable mercy depends on succession, stores, trained hands, and public trust."), proficiency("cleric:house-of-mercy")]),
  ], "life-ministry", "shelter-ministry"),

  choice("light-ministry", 30, "Light Ministry", "Choose revelation and hope or direct confrontation with profane spirits.", [
    option("beacon-ministry", "Beacon Ministry", "Use sacred light to reveal danger, rally communities, and deny despair.", [ability("dawnburst"), action("cleric:raise-beacon", "Raise Beacon", "Establish a visible sacred signal that guides and steadies allies."), proficiency("cleric:beacon-ministry")]),
    option("exorcist-ministry", "Exorcist Ministry", "Study possession, undeath, and fiends so light can separate them from victims.", [ability("turn-profane"), action("cleric:name-possessor", "Name Possessor", "Identify the category and likely anchors of a possessing spirit."), proficiency("cleric:exorcist-ministry")]),
  ], "sacred-domain", "light"),
  choice("beacon-ministry-apotheosis", 50, "Beacon Ministry Apotheosis", "Choose a realm-visible dawn or a light no despair can extinguish.", [
    option("dawn-herald", "Dawn Herald", "Release overwhelming revelation against gathered darkness.", [action("cleric:unhidden-dawn", "Unhidden Dawn", "Raise a sacred dawn that reveals before it judges and cannot be disguised as ordinary flame."), passive("cleric:dawn-herald", "Dawn Herald", "A beacon becomes revelation rather than indiscriminate flame."), proficiency("cleric:dawn-herald")]),
    option("hope-bearer", "Hope Bearer", "Preserve courage and clear purpose through supernatural terror and loss.", [action("cleric:kindle-hope", "Kindle Hope", "Lead a community through magical despair without denying real suffering."), passive("cleric:hope-bearer", "Hope Bearer", "Hope is restored through shared purpose rather than compelled confidence."), proficiency("cleric:hope-bearer")]),
  ], "light-ministry", "beacon-ministry"),
  choice("exorcist-ministry-apotheosis", 50, "Exorcist Ministry Apotheosis", "Choose forceful banishment or perfect rescue of the possessed host.", [
    option("banisher", "Banisher", "Drive profane entities beyond the boundary they violated.", [ability("exorcise"), passive("cleric:banishing-authority", "Banishing Authority", "Named profane spirits face stronger resisted expulsion."), proficiency("cleric:banisher")]),
    option("soul-liberator", "Soul Liberator", "Prioritize separation and survival when an innocent host is entangled with a spirit.", [ability("purifying-light"), action("cleric:liberate-host", "Liberate Host", "Conduct a careful exorcism that protects identity and bodily survival."), proficiency("cleric:soul-liberator")]),
  ], "light-ministry", "exorcist-ministry"),

  choice("war-ministry", 30, "War Ministry", "Choose care of the fighting community or direct consecrated opposition to its enemies.", [
    option("battle-chaplain", "Battle Chaplain", "Sustain courage, triage, burial, and moral discipline through a campaign.", [action("cleric:campaign-office", "Campaign Office", "Conduct the recurring rites and practical care required by an army."), passive("cleric:battle-chaplain", "Battle Chaplain", "Campaign ministry joins courage with triage, burial, restraint, and accountability."), proficiency("cleric:battle-chaplain")]),
    option("consecrated-warrior", "Consecrated Warrior", "Carry weapon and prayer together against a clearly declared threat.", [ability("consecrated-strike"), passive("cleric:armed-liturgy", "Armed Liturgy", "Weapon practice and Presence cooperate in consecrated combat prayer."), proficiency("cleric:consecrated-warrior")]),
  ], "sacred-domain", "war"),
  choice("battle-chaplain-apotheosis", 50, "Battle Chaplain Apotheosis", "Choose guardian of the host or voice that restores a broken line.", [
    option("host-guardian", "Host Guardian", "Spread disciplined protection across an entire company.", [action("cleric:ward-the-host", "Ward the Host", "Coordinate layered protective stations across a willing organized company."), passive("cleric:host-guardian", "Host Guardian", "Communal wards prioritize allies holding a shared defensive purpose."), proficiency("cleric:host-guardian")]),
    option("banner-saint", "Banner Saint", "Make prayer, witness, and courage a rallying center in catastrophe.", [action("cleric:rally-broken-line", "Rally Broken Line", "Restore order and shared purpose to scattered willing allies."), passive("cleric:banner-saint", "Banner Saint", "A sacred rallying point serves common duty rather than personal glory."), proficiency("cleric:banner-saint")]),
  ], "war-ministry", "battle-chaplain"),
  choice("consecrated-warrior-apotheosis", 50, "Consecrated Warrior Apotheosis", "Choose the perfect sacred weapon or relentless pursuit of a sworn profane foe.", [
    option("sainted-weapon", "Sainted Weapon", "Unify a chosen weapon, declared duty, and consecrated technique.", [action("cleric:perfect-consecrated-weapon", "Perfect Consecrated Weapon", "Bind a chosen weapon to an explicit protective duty and accountable bearer."), passive("cleric:sainted-weapon", "Sainted Weapon", "A consecrated weapon prayer remains bound to its declared protective purpose."), proficiency("cleric:sainted-weapon")]),
    option("divine-avenger", "Divine Avenger", "Pursue a witnessed profane threat without turning vengeance into private appetite.", [action("cleric:declare-sacred-quarry", "Declare Sacred Quarry", "Name a witnessed profane foe as the object of bounded pursuit."), passive("cleric:divine-avenger", "Divine Avenger", "Pursuit ends with the declared profane threat and cannot become private appetite."), proficiency("cleric:divine-avenger")]),
  ], "war-ministry", "consecrated-warrior"),

  choice("grave-ministry", 30, "Grave Ministry", "Choose guidance of the dead or defense of the living from profane death.", [
    option("psychopomp-ministry", "Psychopomp Ministry", "Guide memory, burial, mourning, and willing spirits toward rightful rest.", [ability("turn-profane"), action("cleric:guide-the-dead", "Guide the Dead", "Help a willing or confused spirit understand and approach rightful rest."), proficiency("cleric:psychopomp-ministry")]),
    option("death-warden-ministry", "Death-Warden Ministry", "Guard tombs and communities against undeath, possession, and soul theft.", [ability("exorcise"), action("cleric:ward-the-grave", "Ward the Grave", "Secure a burial place against profane entry and animation."), proficiency("cleric:death-warden-ministry")]),
  ], "sacred-domain", "grave"),
  choice("psychopomp-ministry-apotheosis", 50, "Psychopomp Ministry Apotheosis", "Choose perfect funerary guidance or reconciliation of dangerous memory.", [
    option("keeper-of-last-rites", "Keeper of Last Rites", "Ensure identity, testimony, and burial survive disaster and mass death.", [action("cleric:great-funerary-office", "Great Funerary Office", "Lead rightful rites for many dead without erasing individual names."), passive("cleric:keeper-last-rites", "Keeper of Last Rites", "Even mass rites preserve individual identity, testimony, and rightful custody."), proficiency("cleric:keeper-of-last-rites")]),
    option("memory-reconciler", "Memory Reconciler", "Resolve a haunting by confronting the truth that holds it near the living.", [ability("purifying-light"), action("cleric:reconcile-haunting", "Reconcile Haunting", "Bring witnesses, memory, restitution, and prayer together around a haunting."), proficiency("cleric:memory-reconciler")]),
  ], "grave-ministry", "psychopomp-ministry"),
  choice("death-warden-ministry-apotheosis", 50, "Death-Warden Ministry Apotheosis", "Choose unyielding tomb defense or final authority over profane animation.", [
    option("eternal-sentinel", "Eternal Sentinel", "Create layered wards that remember and report every violation.", [action("cleric:eternal-grave-ward", "Eternal Grave Ward", "Create layered grave wards that record violations for later rightful custodians."), passive("cleric:eternal-sentinel", "Eternal Sentinel", "Grave wards remain legible and maintainable by later rightful custodians."), proficiency("cleric:eternal-sentinel")]),
    option("undead-banisher", "Undead Banisher", "Break the profane force sustaining undead and return remains to stillness.", [action("cleric:final-repose", "Final Repose", "Dismantle profane animation and make the released remains difficult to raise again."), passive("cleric:undead-banisher", "Undead Banisher", "Banishment returns remains to rightful stillness rather than merely scattering an enemy."), proficiency("cleric:undead-banisher")]),
  ], "grave-ministry", "death-warden-ministry"),

  choice("knowledge-ministry", 30, "Knowledge Ministry", "Choose sacred scholarship that preserves truth or oracular service that reveals what ordinary evidence cannot.", [
    option("archive-ministry", "Archive Ministry", "Guard records, testimony, translation, and public memory against loss and manipulation.", [action("cleric:establish-sacred-archive", "Establish Sacred Archive", "Create a documented chain of custody for spiritually or politically sensitive records."), passive("cleric:archive-ministry", "Archive Ministry", "Sacred records retain provenance, dissenting testimony, and rules for responsible access."), proficiency("cleric:archive-ministry")]),
    option("oracle-ministry", "Oracle Ministry", "Practice disciplined divination whose limits and consequences are made explicit.", [action("cleric:oracular-consultation", "Oracular Consultation", "Seek a structured revelation after recording the question, stakes, and acceptable uncertainty."), passive("cleric:oracle-ministry", "Oracle Ministry", "Revelation supplements evidence and never silently replaces it."), proficiency("cleric:oracle-ministry")]),
  ], "sacred-domain", "knowledge"),
  choice("archive-ministry-apotheosis", 50, "Archive Ministry Apotheosis", "Choose an archive that preserves a civilization or a truth that no censorship can erase.", [
    option("living-archive", "Living Archive", "Coordinate custodians, oral memory, replicas, and restoration so knowledge survives catastrophe.", [action("cleric:found-living-archive", "Found Living Archive", "Distribute a body of knowledge across accountable people, places, and media."), passive("cleric:living-archive", "Living Archive", "No single destroyed vault or silenced witness can erase the whole record."), proficiency("cleric:living-archive")]),
    option("saint-of-testimony", "Saint of Testimony", "Preserve suppressed witness and reveal the history powerful institutions attempted to remove.", [action("cleric:restore-erased-testimony", "Restore Erased Testimony", "Reconstruct a damaged public truth from surviving records, witnesses, and sacred memory."), passive("cleric:saint-testimony", "Saint of Testimony", "Restored truth includes provenance and uncertainty instead of becoming convenient legend."), proficiency("cleric:saint-of-testimony")]),
  ], "knowledge-ministry", "archive-ministry"),
  choice("oracle-ministry-apotheosis", 50, "Oracle Ministry Apotheosis", "Choose far-reaching revelation or perfect counsel at a decisive crossroads.", [
    option("far-seeing-hierophant", "Far-Seeing Hierophant", "Connect distant signs and sacred correspondences without collapsing possibility into fate.", [action("cleric:far-seeing-rite", "Far-Seeing Rite", "Survey distant spiritual conditions through a demanding, bounded divination."), passive("cleric:far-seeing-hierophant", "Far-Seeing Hierophant", "Long sight reports possibilities, confidence, and blind places separately."), proficiency("cleric:far-seeing-hierophant")]),
    option("counsel-of-the-crossroads", "Counsel of the Crossroads", "Reveal the hidden cost, obligation, and likely consequence surrounding a momentous choice.", [action("cleric:reveal-crossroads", "Reveal Crossroads", "Clarify the principal consequences of several sincerely available courses without choosing for the petitioner."), passive("cleric:crossroads-counsel", "Crossroads Counsel", "Sacred counsel protects informed agency even when one path appears clearly favored."), proficiency("cleric:counsel-crossroads")]),
  ], "knowledge-ministry", "oracle-ministry"),

  choice("tempest-ministry", 30, "Tempest Ministry", "Choose command of violent storm or sacred guardianship of voyagers and exposed communities.", [
    option("storm-ministry", "Storm Ministry", "Confront enemies and disasters with thunder, lightning, wind, and disciplined warning.", [ability("storm-rebuke"), action("cleric:call-storm-warning", "Call Storm Warning", "Project an unmistakable warning before invoking destructive weather."), proficiency("cleric:storm-ministry")]),
    option("voyager-ministry", "Voyager Ministry", "Guide ships, caravans, fishers, and settlements through dangerous weather and water.", [action("cleric:bless-passage", "Bless Passage", "Prepare a vessel or traveling company for a named route and its expected hazards."), passive("cleric:voyager-ministry", "Voyager Ministry", "Weather sense, logistics, morale, and rescue remain parts of one sacred duty."), proficiency("cleric:voyager-ministry")]),
  ], "sacred-domain", "tempest"),
  choice("storm-ministry-apotheosis", 50, "Storm Ministry Apotheosis", "Choose the voice that breaks a hostile host or the hand that turns catastrophe aside.", [
    option("thunder-hierophant", "Thunder Hierophant", "Make sacred thunder a declaration that scatters aggressors and exposes defiance.", [action("cleric:edict-of-thunder", "Edict of Thunder", "Issue a concussive sacred warning that breaks formations while preserving a route of retreat."), passive("cleric:thunder-hierophant", "Thunder Hierophant", "Destructive storm rites announce their boundary and intended target."), proficiency("cleric:thunder-hierophant")]),
    option("storm-turner", "Storm Turner", "Redirect wind, flood, and lightning away from those unable to escape.", [action("cleric:turn-catastrophic-storm", "Turn Catastrophic Storm", "Conduct an apex rite that diverts part of a natural or magical storm at severe cost."), passive("cleric:storm-turner", "Storm Turner", "Mitigation favors lives and safe passage over property or spectacle."), proficiency("cleric:storm-turner")]),
  ], "tempest-ministry", "storm-ministry"),
  choice("voyager-ministry-apotheosis", 50, "Voyager Ministry Apotheosis", "Choose perfect guidance across impossible waters or a refuge that survives the storm.", [
    option("saint-of-safe-harbors", "Saint of Safe Harbors", "Consecrate ports, rescue networks, and laws of hospitality for all who face the sea.", [action("cleric:consecrate-safe-harbor", "Consecrate Safe Harbor", "Bind a harbor community to rescue, warning, and bounded sanctuary obligations."), passive("cleric:safe-harbor", "Saint of Safe Harbors", "Sacred harbor protection applies before allegiance, wealth, or origin."), proficiency("cleric:saint-safe-harbors")]),
    option("path-through-tempest", "Path Through Tempest", "Find a survivable course where chart, star, and ordinary weathercraft fail.", [action("cleric:open-tempest-path", "Open Tempest Path", "Reveal and briefly stabilize a route through supernatural weather or hostile water."), passive("cleric:path-tempest", "Path Through Tempest", "Miraculous passage still demands capable crews and honest assessment of risk."), proficiency("cleric:path-through-tempest")]),
  ], "tempest-ministry", "voyager-ministry"),

  choice("nature-ministry", 30, "Nature Ministry", "Choose guardianship of wild ecologies or sacred stewardship of cultivated land and settlement.", [
    option("wild-ministry", "Wild Ministry", "Defend habitats, migration, and the agency of untamed living things.", [ability("verdant-aegis"), action("cleric:mediate-wild-boundary", "Mediate Wild Boundary", "Identify and negotiate the pressures where settlement and wild habitat conflict."), proficiency("cleric:wild-ministry")]),
    option("harvest-ministry", "Harvest Ministry", "Sustain soil, water, seed, livestock, labor, and fair distribution through the seasonal cycle.", [action("cleric:bless-seasonal-labor", "Bless Seasonal Labor", "Coordinate a communal agricultural rite around real weather, stores, labor, and need."), passive("cleric:harvest-ministry", "Harvest Ministry", "Abundance is measured by resilient land and equitable survival, not extraction alone."), proficiency("cleric:harvest-ministry")]),
  ], "sacred-domain", "nature"),
  choice("wild-ministry-apotheosis", 50, "Wild Ministry Apotheosis", "Choose communion with an entire living region or defense against those who would ruin it.", [
    option("voice-of-the-biome", "Voice of the Biome", "Read a region's many species, waters, soils, and seasons as a living sacred community.", [action("cleric:commune-with-biome", "Commune with Biome", "Seek the needs, wounds, and likely changes of a bounded ecosystem."), passive("cleric:voice-biome", "Voice of the Biome", "No single charismatic creature is mistaken for the interests of the whole ecology."), proficiency("cleric:voice-of-biome")]),
    option("warden-of-the-green", "Warden of the Green", "Organize beasts, terrain, local people, and sacred law against ecological devastation.", [action("cleric:raise-living-defense", "Raise Living Defense", "Coordinate a region's willing inhabitants and terrain into a temporary defensive covenant."), passive("cleric:warden-green", "Warden of the Green", "Living defense minimizes lasting damage to the place it protects."), proficiency("cleric:warden-of-green")]),
  ], "nature-ministry", "wild-ministry"),
  choice("harvest-ministry-apotheosis", 50, "Harvest Ministry Apotheosis", "Choose miraculous restoration of exhausted land or a covenant securing generations of shared abundance.", [
    option("saint-of-renewed-earth", "Saint of Renewed Earth", "Restore poisoned soil, broken waters, and lost fertility through sustained communal repair.", [action("cleric:renew-exhausted-land", "Renew Exhausted Land", "Lead a long sacred and practical restoration of a damaged agricultural region."), passive("cleric:renewed-earth", "Saint of Renewed Earth", "Restoration changes harmful practice as well as repairing its consequences."), proficiency("cleric:saint-renewed-earth")]),
    option("keeper-of-seasons", "Keeper of Seasons", "Preserve seed, knowledge, stores, and reciprocal obligation across feast and famine.", [action("cleric:establish-seasonal-covenant", "Establish Seasonal Covenant", "Bind willing communities to transparent reserves, seed custody, and mutual famine relief."), passive("cleric:keeper-seasons", "Keeper of Seasons", "Sacred abundance remains accountable across generations and unequal harvests."), proficiency("cleric:keeper-of-seasons")]),
  ], "nature-ministry", "harvest-ministry"),

  choice("trickery-ministry", 30, "Trickery Ministry", "Choose protective deception for the vulnerable or public inversion that exposes arrogant power.", [
    option("mask-ministry", "Mask Ministry", "Create cover identities, false trails, and sanctuaries for people escaping unjust control.", [ability("sacred-misdirection"), action("cleric:prepare-cover-story", "Prepare Cover Story", "Build a consistent protective identity with consent, limits, and an exit plan."), proficiency("cleric:mask-ministry")]),
    option("reversal-ministry", "Reversal Ministry", "Use satire, festival, riddles, and ritual role reversal to reveal what hierarchy conceals.", [action("cleric:rite-of-reversal", "Rite of Reversal", "Temporarily invert public roles so suppressed testimony can be heard without ordinary retaliation."), passive("cleric:reversal-ministry", "Reversal Ministry", "Sacred mockery targets unaccountable power rather than vulnerable identity."), proficiency("cleric:reversal-ministry")]),
  ], "sacred-domain", "trickery"),
  choice("mask-ministry-apotheosis", 50, "Mask Ministry Apotheosis", "Choose an identity no hostile scrutiny can easily break or a network that carries many people to safety.", [
    option("saint-of-many-faces", "Saint of Many Faces", "Maintain sacred identities that preserve truth of purpose while defeating coercive recognition.", [action("cleric:perfect-sacred-identity", "Perfect Sacred Identity", "Construct a complete bounded persona that withstands magical and mundane investigation."), passive("cleric:many-faces", "Saint of Many Faces", "A sacred identity cannot be used to erase responsibility for freely chosen harm."), proficiency("cleric:saint-many-faces")]),
    option("keeper-of-hidden-roads", "Keeper of Hidden Roads", "Build trusted routes, signals, safe houses, and counter-surveillance for the endangered.", [action("cleric:establish-hidden-road", "Establish Hidden Road", "Create a compartmentalized rescue route whose participants know only what they must."), passive("cleric:hidden-roads", "Keeper of Hidden Roads", "Protective secrecy includes consent, verification, and safe dissolution."), proficiency("cleric:keeper-hidden-roads")]),
  ], "trickery-ministry", "mask-ministry"),
  choice("reversal-ministry-apotheosis", 50, "Reversal Ministry Apotheosis", "Choose the fool who may speak forbidden truth or the grand rite that topples a false public story.", [
    option("holy-fool", "Holy Fool", "Speak truth through absurdity, humility, and social license where direct accusation would be silenced.", [action("cleric:holy-fools-rebuke", "Holy Fool's Rebuke", "Expose a contradiction in authority through a public parable, joke, or impossible question."), passive("cleric:holy-fool", "Holy Fool", "Ridicule points upward and leaves space for repentance and reply."), proficiency("cleric:holy-fool")]),
    option("hierophant-of-reversal", "Hierophant of Reversal", "Turn an oppressive institution's symbols and performances into evidence against its claims.", [action("cleric:great-reversal", "Great Reversal", "Lead a public sacred drama that reveals concealed testimony and reverses manufactured legitimacy."), passive("cleric:hierophant-reversal", "Hierophant of Reversal", "The rite reveals contradiction; it does not compel the audience's conclusion."), proficiency("cleric:hierophant-reversal")]),
  ], "trickery-ministry", "reversal-ministry"),
]);

const WARRIOR_BRANCHES = Object.freeze([
  choice("warrior-specialization", 10, "Warrior Specialization", "Choose the personal martial practice that will refine the shared Warrior progression. Every option remains wholly nonmagical and draws only on weapons, armour, conditioning, leverage, timing, and movement.", [
    option("sellsword", "Sellsword", "Survive changing contracts and opponents through practical weapon breadth, disciplined risk, and rapid adaptation.", [
      ability("warrior-weapon-change"),
      passive("warrior:sellsword-adaptation", "Sellsword Adaptation", "Changing a held mundane weapon also changes guard and measure instead of carrying the previous discipline's mistakes forward."),
      proficiency("fighter:sellsword"),
    ]),
    option("duelist", "Duelist", "Control one direct contest through exact measure, invitations, parries, and answer attacks.", [
      ability("warrior-riposte-guard"),
      passive("warrior:duellists-measure", "Duelist's Measure", "Repeated exchanges with one visible opponent make their preferred distance and recovery easier to read."),
      proficiency("fighter:duelist"),
    ]),
    option("iron-vanguard", "Iron Vanguard", "Use armour, reach, bracing, and controlled mass to take and deny physical space personally.", [
      ability("warrior-braced-advance"),
      passive("warrior:vanguard-mass", "Vanguard Mass", "Fitted armour and a planted weapon contribute to resisting direct physical displacement."),
      proficiency("fighter:iron-vanguard"),
    ]),
    option("undying-champion", "Undying Champion", "Remain technically dangerous through pain, fatigue, and injury by conditioning and refusal rather than supernatural endurance.", [
      ability("warrior-second-breath"),
      passive("warrior:champions-refusal", "Champion's Refusal", "Pain alone cannot make the Warrior abandon a still-functional guard, though real injuries retain their consequences."),
      proficiency("fighter:undying-champion"),
    ]),
  ]),

  choice("sellsword-method", 30, "Sellsword Method", "Choose whether contract experience matures into unmatched weapon adaptability or ruthless economy against a studied opponent.", [
    option("arsenal-adept", "Arsenal Adept", "Link several mundane weapon disciplines and change between them without losing the exchange.", [
      ability("warrior-crosscut-sequence"),
      passive("warrior:arsenal-memory", "Arsenal Memory", "Each personally mastered weapon retains its own guard, recovery, and distance when drawn under pressure."),
      proficiency("fighter:arsenal-adept"),
    ]),
    option("contract-veteran", "Contract Veteran", "Measure danger, armour, habits, and escape before spending effort on a decisive engagement.", [
      ability("warrior-read-opponent"),
      passive("warrior:contract-economy", "Contract Economy", "The Warrior distinguishes the objective of a fight from prideful exchanges that do not serve it."),
      proficiency("fighter:contract-veteran"),
    ]),
  ], "warrior-specialization", "sellsword"),
  choice("arsenal-adept-apotheosis", 50, "Arsenal Adept Apotheosis", "Choose complete mastery across an arsenal or the ability to turn almost any sound object into a temporary martial tool.", [
    option("ninefold-armsmaster", "Ninefold Armsmaster", "Maintain a complete library of guards and transitions across every personally trained weapon family.", [
      passive("warrior:ninefold-armsmaster", "Ninefold Armsmaster", "Changing among mastered mundane weapon families preserves accumulated martial tempo and opponent readings.", { preserveTempoOnWeaponChange: true }),
      action("warrior:prepare-ninefold-arsenal", "Prepare Ninefold Arsenal", "Arrange a chosen set of mundane weapons so each can be drawn into its correct guard without searching or untangling equipment."),
      proficiency("fighter:ninefold-armsmaster"),
    ]),
    option("improvised-armiger", "Improvised Armiger", "Read weight, grip, flex, edge, and breaking point well enough to fight briefly with an unorthodox object.", [
      action("warrior:improvise-martial-tool", "Improvise Martial Tool", "Assess a sound mundane object and use it as a bounded substitute for the nearest personally mastered weapon form."),
      passive("warrior:improvised-armiger", "Improvised Armiger", "Improvised tools inherit only physically plausible reach and force and may break under martial use."),
      proficiency("fighter:improvised-armiger"),
    ]),
  ], "sellsword-method", "arsenal-adept"),
  choice("contract-veteran-apotheosis", 50, "Contract Veteran Apotheosis", "Choose a perfect ledger of one opponent's failures or the self-sufficient practice of a blade that never relies on a formation.", [
    option("red-ledger", "Red Ledger", "Record every costly habit an opponent reveals and collect the debt through one economical finish.", [
      passive("warrior:red-ledger", "Red Ledger", "Repeated native Warrior contacts against one opponent preserve a bounded record of their exposed physical habits."),
      action("warrior:close-red-ledger", "Close the Red Ledger", "Commit to an observed physical weakness and end the exchange before the opponent can reset it."),
      proficiency("fighter:red-ledger"),
    ]),
    option("independent-blade", "Independent Blade", "Fight effectively without needing command, formation, patronage, or another profession's support.", [
      passive("warrior:independent-blade", "Independent Blade", "Personal guard and recovery remain reliable when no adjacent ally is screening the Warrior."),
      action("warrior:secure-own-exit", "Secure Own Exit", "Before committing, identify and preserve a physically reachable withdrawal lane for oneself."),
      proficiency("fighter:independent-blade"),
    ]),
  ], "sellsword-method", "contract-veteran"),

  choice("duelist-method", 30, "Duelist Method", "Choose whether mastery answers attacks through perfected counters or dictates the contest through tempo.", [
    option("counterfencer", "Counterfencer", "Build the answer into the guard and punish a committed weapon before it can recover.", [
      ability("warrior-stop-thrust"),
      passive("warrior:counterfencers-patience", "Counterfencer's Patience", "Holding a credible guard preserves the read needed for a later native counter."),
      proficiency("fighter:counterfencer"),
    ]),
    option("tempo-master", "Tempo Master", "Decide when the exchange begins, pauses, accelerates, and ends through distance and initiative.", [
      ability("warrior-seize-tempo"),
      passive("warrior:tempo-masters-cadence", "Tempo Master's Cadence", "A successful native Warrior sequence makes its next distinct step easier to begin cleanly."),
      proficiency("fighter:tempo-master"),
    ]),
  ], "warrior-specialization", "duelist"),
  choice("counterfencer-apotheosis", 50, "Counterfencer Apotheosis", "Choose the answer that turns defence into a perfect riposte or the leverage that dismantles the opponent's weapon structure.", [
    option("perfect-riposte", "Perfect Riposte", "Return through the exact line a parried attack can no longer protect.", [
      passive("warrior:perfect-riposte", "Perfect Riposte", "A successful native parry can preserve one bounded tempo for the immediate answering Warrior technique.", { preserveTempoAfterParry: 1 }),
      action("warrior:declare-riposte-line", "Declare Riposte Line", "Name the physical return line the current guard is prepared to answer after a successful parry."),
      proficiency("fighter:perfect-riposte"),
    ]),
    option("hilt-breaker", "Hilt Breaker", "Attack guard, haft, grip, and hand alignment until the opposing weapon cannot remain soundly presented.", [
      action("warrior:break-weapon-structure", "Break Weapon Structure", "Use a successful bind to damage or displace one physically vulnerable part of an opponent's held weapon structure."),
      passive("warrior:hilt-breaker", "Hilt Breaker", "Weapon attacks target plausible construction and grip weaknesses rather than bypassing equipment by fiat."),
      proficiency("fighter:hilt-breaker"),
    ]),
  ], "duelist-method", "counterfencer"),
  choice("tempo-master-apotheosis", 50, "Tempo Master Apotheosis", "Choose supremacy in the opening instant or control that survives a long and changing duel.", [
    option("first-touch-master", "First-Touch Master", "Win the first meaningful contact and make the opponent answer from a compromised position.", [
      passive("warrior:first-touch", "First-Touch Master", "The first successful native Warrior contact in a fresh engagement establishes one bounded martial tempo."),
      action("warrior:choose-opening-measure", "Choose Opening Measure", "Before weapons meet, declare the mundane distance and first contact the Duelist intends to contest."),
      proficiency("fighter:first-touch-master"),
    ]),
    option("endless-measure", "Endless Measure", "Recalculate distance and cadence through a prolonged duel without losing the contest's history.", [
      passive("warrior:endless-measure", "Endless Measure", "Changing distance does not discard the Duelist's bounded reading of a continuously engaged opponent."),
      action("warrior:reset-duelling-measure", "Reset Duelling Measure", "Use a guarded pause to establish a new ideal distance against the same observed opponent."),
      proficiency("fighter:endless-measure"),
    ]),
  ], "duelist-method", "tempo-master"),

  choice("vanguard-method", 30, "Iron Vanguard Method", "Choose whether controlled mass breaks a defended line or reach prevents an opponent from entering useful distance.", [
    option("linebreaker", "Linebreaker", "Concentrate armour, stride, weapon, and body mass into a controlled breach.", [
      ability("warrior-break-line"),
      passive("warrior:linebreak-structure", "Linebreak Structure", "A direct advance keeps feet, hips, armour, and weapon aligned through physical collision."),
      proficiency("fighter:linebreaker"),
    ]),
    option("reach-keeper", "Reach Keeper", "Make the full practical reach of a long weapon into territory an opponent must earn.", [
      ability("warrior-deny-approach"),
      passive("warrior:reach-keepers-circle", "Reach Keeper's Circle", "A suitable long weapon threatens approach lanes without pretending to strike through solid obstacles."),
      proficiency("fighter:reach-keeper"),
    ]),
  ], "warrior-specialization", "iron-vanguard"),
  choice("linebreaker-apotheosis", 50, "Linebreaker Apotheosis", "Choose an advance that cannot be cheaply displaced or mastery of the violent but exact instant of collision.", [
    option("irresistible-advance", "Irresistible Advance", "Continue through ordinary checks by preserving alignment and shortening each planted step.", [
      passive("warrior:irresistible-advance", "Irresistible Advance", "While using native braced movement, ordinary physical slows and shoves lose part of their effect; immovable barriers still stop movement."),
      action("warrior:plot-breach-line", "Plot Breach Line", "Choose a short physically passable route whose footing can support an armoured breach."),
      proficiency("fighter:irresistible-advance"),
    ]),
    option("collision-master", "Collision Master", "Win body-to-body impact through angle, height, timing, and load-bearing structure.", [
      action("warrior:master-collision", "Master Collision", "Meet a visible physical rush at a chosen angle and redirect its momentum if comparative mass and footing allow."),
      passive("warrior:collision-master", "Collision Master", "Direct collisions are judged through mundane mass, speed, structure, and footing rather than automatic success."),
      proficiency("fighter:collision-master"),
    ]),
  ], "vanguard-method", "linebreaker"),
  choice("reach-keeper-apotheosis", 50, "Reach Keeper Apotheosis", "Choose complete threat around the body or impossible precision at the farthest honest point of the weapon.", [
    option("circle-of-steel", "Circle of Steel", "Recover a long weapon through continuous guarded arcs that deny several approach lines.", [
      passive("warrior:circle-of-steel", "Circle of Steel", "Native sweeping denial remains controlled around multiple nearby threats and never passes harmlessly through allies or obstacles."),
      action("warrior:establish-reach-circle", "Establish Reach Circle", "Mark the physically clear approach lanes a suitable long weapon can presently contest."),
      proficiency("fighter:circle-of-steel"),
    ]),
    option("far-point-master", "Far-Point Master", "Deliver force and control at the last usable span of a long weapon without letting its point wander.", [
      passive("warrior:far-point-master", "Far-Point Master", "Suitable long weapons retain precision at their maximum plausible reach when footing and space remain clear."),
      action("warrior:set-far-point", "Set Far Point", "Choose the exact boundary where an approaching opponent first enters the held weapon's useful reach."),
      proficiency("fighter:far-point-master"),
    ]),
  ], "vanguard-method", "reach-keeper"),

  choice("undying-champion-method", 30, "Undying Champion Method", "Choose practiced recovery from accumulating harm or the dangerous technical clarity of a final stand.", [
    option("hardcase", "Hardcase", "Stay functional by managing shock, breath, bleeding, and pain without erasing the injury itself.", [
      ability("warrior-shake-it-off"),
      passive("warrior:hardcase-triage", "Hardcase Triage", "The Warrior can distinguish a survivable impairment from an injury that must not be loaded again."),
      proficiency("fighter:hardcase"),
    ]),
    option("last-stand-exemplar", "Last-Stand Exemplar", "Simplify the guard and attacks as strength fails, preserving only what can still decide the fight.", [
      ability("warrior-last-stand"),
      passive("warrior:last-stand-clarity", "Last-Stand Clarity", "Severe fatigue removes ornamental choices before it removes the Warrior's essential guard and measure."),
      proficiency("fighter:last-stand-exemplar"),
    ]),
  ], "warrior-specialization", "undying-champion"),
  choice("hardcase-apotheosis", 50, "Hardcase Apotheosis", "Choose a body conditioned around old damage or a complete practical command of personal physical recovery.", [
    option("scarred-colossus", "Scarred Colossus", "Build stable movement around healed damage and known limitations until scars become a map rather than a surprise.", [
      passive("warrior:scarred-colossus", "Scarred Colossus", "Old, fully healed injuries impose less disruption because stance and equipment have been fitted around them; fresh wounds remain dangerous."),
      action("warrior:map-injury-load", "Map Injury Load", "Assess which current movements a known injury can still bear without worsening it."),
      proficiency("fighter:scarred-colossus"),
    ]),
    option("unbroken-body", "Unbroken Body", "Use bracing, compression, breath, and exact rest to recover the body as far as mundane care permits.", [
      action("warrior:field-recompose", "Field Recompose", "During a safe pause, reset joints, bind minor wounds, regulate breath, and restore a usable posture without magically healing damage."),
      passive("warrior:unbroken-body", "Unbroken Body", "Personal recovery practice is faster and more accurate but cannot replace medicine for mortal injury."),
      proficiency("fighter:unbroken-body"),
    ]),
  ], "undying-champion-method", "hardcase"),
  choice("last-stand-apotheosis", 50, "Last-Stand Apotheosis", "Choose the veteran who remains coherent at the edge of collapse or the personal guard refined against overwhelming numbers.", [
    option("deathless-victor", "Deathless Victor", "Remain conscious through one otherwise fight-ending but physically survivable impact by yielding, rolling, and protecting vital structure.", [
      passive("warrior:deathless-victor", "Deathless Victor", "Once between full rests, a nonfatal physical blow that would cause collapse may leave the Warrior barely functional; decapitation, destruction, and mortal trauma are not negated."),
      action("warrior:yield-through-impact", "Yield Through Impact", "Choose how to move with an unavoidable blow so its remaining force crosses less vital structure."),
      proficiency("fighter:deathless-victor"),
    ]),
    option("one-against-many", "One Against Many", "Reduce a crowd to lanes, obstructions, and sequential weapon lines instead of trying to overpower every body at once.", [
      passive("warrior:one-against-many", "One Against Many", "Native moving guards gain bounded defensive value from making nearby enemies obstruct one another; open surrounds remain deadly."),
      action("warrior:funnel-opponents", "Funnel Opponents", "Use reachable terrain and personal position to reduce how many attackers can physically engage at once."),
      proficiency("fighter:one-against-many"),
    ]),
  ], "undying-champion-method", "last-stand-exemplar"),
]);

const MONK_BRANCHES = Object.freeze([
  choice("monk-discipline", 10, "Monk Discipline", "Choose the trained physical method that will refine the shared unarmed Monk progression. Only Temple Arms permits its own bounded weapon kata; every other option remains hand-to-hand.", [
    option("open-hand", "Open Hand", "Use tactile anatomy, joint alignment, leverage, and restraint to control another body's structure with unarmed contact.", [
      ability("monk-open-hand-parry"),
      passive("monk:open-hand-sensitivity", "Open-Hand Sensitivity", "Bare-hand contact reads physical tension and load without becoming supernatural perception.", { unarmedOnly: true }),
      proficiency("monk:open-hand"),
    ]),
    option("iron-body", "Iron Body", "Build a resilient unarmed frame through progressive loading, skeletal alignment, tissue recovery, and exact bracing.", [
      ability("monk-iron-body-brace"),
      passive("monk:progressive-conditioning", "Progressive Conditioning", "Gradual physical loading raises safe impact tolerance without making skin or bone magical.", { unarmedOnly: true }),
      proficiency("monk:iron-body"),
    ]),
    option("wind-step", "Wind Step", "Produce seemingly impossible movement through acceleration, traction, landing mechanics, and route selection rather than magic.", [
      ability("monk-burst-step"),
      passive("monk:explosive-footwork", "Explosive Footwork", "Relaxation and late muscular recruitment increase short physical acceleration within real terrain limits.", { unarmedOnly: true }),
      proficiency("monk:wind-step"),
    ]),
    option("temple-arms", "Temple Arms", "Extend Monk posture practice through dedicated staff, spear, and temple-blade kata that grant no Warrior technique or Martial Tempo.", [
      ability("monk-kata-entry"),
      passive("monk:bounded-temple-arms", "Bounded Temple Arms", "Only Monk-owned Temple Arms cards permit staff, spear, or sword use; general Monk techniques remain unarmed.", { weaponPermitted: true, weaponFamilies: ["staff", "spear", "sword"] }),
      proficiency("monk:temple-arms"),
    ]),
  ]),

  choice("open-hand-method", 30, "Open Hand Method", "Choose detailed joint control or whole-body throwing through contact, anatomy, and leverage.", [
    option("joint-weaver", "Joint Weaver", "Use unarmed frames and small rotations to shorten a limb's safe action without mystical nerve attacks.", [
      ability("monk-locking-palm"),
      passive("monk:joint-map", "Joint Map", "Repeated bare-hand contact improves the reading of a target's visible articulation and safe range."),
      proficiency("monk:joint-weaver"),
    ]),
    option("throwing-circle", "Throwing Circle", "Turn target Posture Strain around hip, shoulder, leg, and floor fulcrums under strict mass limits.", [
      ability("monk-wheel-throw"),
      passive("monk:throwing-circle", "Throwing Circle", "Throw directions follow the target's actual base, momentum, anatomy, and relative weight."),
      proficiency("monk:throwing-circle"),
    ]),
  ], "monk-discipline", "open-hand"),
  choice("joint-weaver-apotheosis", 50, "Joint Weaver Apotheosis", "Choose complete anatomical reading or restraint refined around the minimum force needed.", [
    option("anatomists-hand", "Anatomist's Hand", "Distinguish hinge, socket, tendon, muscle, and protected structure through trained touch and observation.", [
      passive("monk:anatomists-hand", "Anatomist's Hand", "Joint techniques gain precision against familiar living anatomy but lose effect against armour, amorphous bodies, and unknown structures."),
      action("monk:map-articulation", "Map Articulation", "Through safe contact, identify one joint's physical range and the direction it cannot bear."),
      proficiency("monk:anatomists-hand"),
    ]),
    option("gentle-lock", "Gentle Lock", "Control a limb or body line with graduated pressure that stops before permanent damage.", [
      action("monk:apply-gentle-lock", "Apply Gentle Lock", "Spend eligible Posture Strain to secure a manageable articulated target without tearing the joint."),
      passive("monk:gentle-lock", "Gentle Lock", "A compliant target can be restrained with less injury; resistance, armour, size, and anatomy still matter."),
      proficiency("monk:gentle-lock"),
    ]),
  ], "open-hand-method", "joint-weaver"),
  choice("throwing-circle-apotheosis", 50, "Throwing Circle Apotheosis", "Choose greater rotational leverage or the ability to reverse force through an apparently empty centre.", [
    option("great-wheel", "Great Wheel", "Use a wider step and longer fulcrum to rotate a larger but still physically manageable body.", [
      passive("monk:great-wheel", "Great Wheel", "Throws tolerate a modestly larger mass difference only when complete Posture Strain, footing, and leverage are present."),
      action("monk:describe-great-wheel", "Set the Great Wheel", "Choose a clear rotational path and safe landing area before committing a high-leverage throw."),
      proficiency("monk:great-wheel"),
    ]),
    option("empty-centre", "Empty Centre", "Vacate the line of a committed body and give its momentum a new physical path.", [
      action("monk:empty-centre-reversal", "Empty-Centre Reversal", "Redirect a contacted physical rush past the Monk when timing, space, and relative mass permit."),
      passive("monk:empty-centre", "Empty Centre", "The reversal uses the target's existing momentum and cannot create motion from a stationary or anchored body."),
      proficiency("monk:empty-centre"),
    ]),
  ], "open-hand-method", "throwing-circle"),

  choice("iron-body-method", 30, "Iron Body Method", "Choose impact survival through distributed structure or offensive contact hardened by progressive physical conditioning.", [
    option("conditioned-frame", "Conditioned Frame", "Disperse ordinary impact through aligned bone, relaxed tissue, breath, and stance rather than invulnerability.", [
      ability("monk-absorbing-frame"),
      passive("monk:conditioned-frame", "Conditioned Frame", "Prepared alignment spreads a bounded share of physical impact while armour, magic, and mortal trauma retain their rules."),
      proficiency("monk:conditioned-frame"),
    ]),
    option("impact-forger", "Impact Forger", "Develop hands, elbows, knees, and feet for compact heavy contact through gradual loading and precise alignment.", [
      ability("monk-breaking-knuckle"),
      passive("monk:impact-forging", "Impact Forging", "Conditioning supports harder unarmed contact but never bypasses armour as true damage."),
      proficiency("monk:impact-forger"),
    ]),
  ], "monk-discipline", "iron-body"),
  choice("conditioned-frame-apotheosis", 50, "Conditioned Frame Apotheosis", "Choose extraordinary load distribution or disciplined recovery after the body has safely left danger.", [
    option("tempered-frame", "Tempered Frame", "Align the whole body for one severe physical contact while accepting that concentration and position are required.", [
      passive("monk:tempered-frame", "Tempered Frame", "A prepared unarmed brace reduces bounded physical shock; surprise, piercing paths, internal injury, and magic are not negated."),
      action("monk:set-tempered-frame", "Set Tempered Frame", "Plant a physically sound stance and align vulnerable joints before an expected collision."),
      proficiency("monk:tempered-frame"),
    ]),
    option("measured-recovery", "Measured Recovery", "Use breath, compression, mobility checks, food, and rest to restore trained tissue without magical healing.", [
      action("monk:perform-measured-recovery", "Measured Recovery", "During safety, assess and recover ordinary exertion while identifying injuries that require medical care."),
      passive("monk:measured-recovery", "Measured Recovery", "Conditioning recovers more reliably between efforts but cannot regenerate wounds during an exchange."),
      proficiency("monk:measured-recovery"),
    ]),
  ], "iron-body-method", "conditioned-frame"),
  choice("impact-forger-apotheosis", 50, "Impact Forger Apotheosis", "Choose contact suited to break mundane material or precisely transmit physical shock through a moving body.", [
    option("material-breaker", "Material Breaker", "Match contact surface, support, grain, and force direction to a mundane object's real breaking point.", [
      action("monk:break-mundane-material", "Break Mundane Material", "Strike a braced mundane object at an observed structural weakness within the body's plausible force."),
      passive("monk:material-breaker", "Material Breaker", "The technique follows material strength and never shatters enchanted, massive, or unsupported objects by spectacle alone."),
      proficiency("monk:material-breaker"),
    ]),
    option("deep-shock-practitioner", "Deep-Shock Practitioner", "Time a compact impact with the target's motion so ordinary force disperses poorly through its current support.", [
      passive("monk:deep-shock", "Deep Shock", "Resonant Impact exploits full Posture Strain more efficiently against anatomically legible, lightly armoured targets; bosses remain bounded."),
      action("monk:choose-shock-path", "Choose Shock Path", "Identify a physically continuous contact path through stance and tissue before committing the blow."),
      proficiency("monk:deep-shock-practitioner"),
    ]),
  ], "iron-body-method", "impact-forger"),

  choice("wind-step-method", 30, "Wind Step Method", "Choose sustained ground acceleration or airborne redirection built from real takeoff, surfaces, and landing mechanics.", [
    option("burst-runner", "Burst Runner", "Chain short accelerations through traction, stride mechanics, and efficient deceleration without supernatural speed.", [
      ability("monk-rebound-step"),
      passive("monk:burst-running", "Burst Running", "A safe landing or planted turn can feed one further physical burst when the surface supports it."),
      proficiency("monk:burst-runner"),
    ]),
    option("physical-aerialist", "Physical Aerialist", "Use jumps, vaults, rotations, and controlled falls that always require a takeoff, path, and landing.", [
      ability("monk-vaulting-knee"),
      passive("monk:physical-aerialist", "Physical Aerialist", "Airborne techniques obey gravity, available surfaces, carried weight, and the need to land."),
      proficiency("monk:physical-aerialist"),
    ]),
  ], "monk-discipline", "wind-step"),
  choice("burst-runner-apotheosis", 50, "Burst Runner Apotheosis", "Choose exceptional sustained mechanics or complete mastery of physical rebound and redirection.", [
    option("unbroken-sprint", "Unbroken Sprint", "Preserve stride, breathing, and route choice across a long high-speed effort without claiming tirelessness.", [
      passive("monk:unbroken-sprint", "Unbroken Sprint", "Efficient ground mechanics delay ordinary sprint fatigue; terrain, injury, load, and biological endurance remain decisive."),
      action("monk:plot-sprint-line", "Plot Sprint Line", "Read a physically traversable route for traction, obstacles, turns, and necessary deceleration."),
      proficiency("monk:unbroken-sprint"),
    ]),
    option("rebound-master", "Rebound Master", "Turn safe contact with ground or sound structure into a precisely redirected physical burst.", [
      action("monk:master-rebound", "Master Rebound", "Use a reachable load-bearing surface to change direction while preserving a safe landing line."),
      passive("monk:rebound-master", "Rebound Master", "No rebound occurs without a real surface able to bear the force and no direction change ignores momentum."),
      proficiency("monk:rebound-master"),
    ]),
  ], "wind-step-method", "burst-runner"),
  choice("physical-aerialist-apotheosis", 50, "Physical Aerialist Apotheosis", "Choose exact vaulting routes or trained use of falling body weight in one committed contact.", [
    option("vault-master", "Vault Master", "Cross complex but physically connected obstacles through hand placement, momentum, and landing control.", [
      action("monk:master-vault", "Master Vault", "Traverse a sequence of reachable supports whose spacing, strength, and surface permit the movement."),
      passive("monk:vault-master", "Vault Master", "Vaulting preserves more control through irregular routes but cannot cross empty distance without support."),
      proficiency("monk:vault-master"),
    ]),
    option("falling-weight", "Falling Weight", "Add controlled descent and body mass to one strike while accepting the danger and commitment of the landing.", [
      passive("monk:falling-weight", "Falling Weight", "A downward native Monk contact can gain bounded force from real height and mass; misses and unsafe landings retain consequences."),
      action("monk:choose-falling-line", "Choose Falling Line", "Identify a clear descent, contact point, and survivable landing before committing body weight."),
      proficiency("monk:falling-weight"),
    ]),
  ], "wind-step-method", "physical-aerialist"),

  choice("temple-arms-method", 30, "Temple Arms Method", "Choose staff-and-spear leverage or a dedicated temple-blade kata. These are Monk-owned forms and never grant Warrior cards or Martial Tempo.", [
    option("staff-kata", "Staff Kata", "Use staff or spear length as a moving fulcrum for Monk posture pressure, redirection, and distance.", [
      ability("monk-staff-circuit"),
      passive("monk:staff-kata", "Staff Kata", "Only Temple Arms staff-and-spear cards use those weapons; general Monk attacks remain unarmed.", { weaponPermitted: true, weaponFamilies: ["staff", "spear"] }),
      proficiency("monk:staff-kata"),
    ]),
    option("temple-blade-kata", "Temple Blade Kata", "Use a single temple sword through close arcs, flat control, exact recovery, and Monk-specific posture work.", [
      ability("monk-temple-blade-arc"),
      passive("monk:temple-blade-kata", "Temple Blade Kata", "Only Temple Arms blade cards use a sword and they build Posture through placement rather than Warrior Tempo.", { weaponPermitted: true, weaponFamilies: ["sword"] }),
      proficiency("monk:temple-blade-kata"),
    ]),
  ], "monk-discipline", "temple-arms"),
  choice("staff-kata-apotheosis", 50, "Staff Kata Apotheosis", "Choose complete multi-directional staff leverage or a planted gate made from reach and bracing.", [
    option("eight-point-staff", "Eight-Point Staff", "Recover the staff through eight useful contact lines so each movement protects the next.", [
      passive("monk:eight-point-staff", "Eight-Point Staff", "Distinct Monk staff contacts can continue one Posture sequence without multiplying strain from the same motion."),
      action("monk:map-eight-points", "Map Eight Points", "Choose the physically open staff contact and recovery lines around the current position."),
      proficiency("monk:eight-point-staff"),
    ]),
    option("gate-pole", "Gate Pole", "Plant staff or spear as a braced lever that changes an approacher's path without becoming an immovable wall.", [
      action("monk:set-gate-pole", "Set Gate Pole", "Brace a staff or spear against sound footing to redirect one physically manageable approach."),
      passive("monk:gate-pole", "Gate Pole", "The planted form depends on weapon strength, angle, footing, and relative mass and cannot stop colossal force."),
      proficiency("monk:gate-pole"),
    ]),
  ], "temple-arms-method", "staff-kata"),
  choice("temple-blade-apotheosis", 50, "Temple Blade Kata Apotheosis", "Choose one perfect line of edge placement or recovery that returns the blade to guarded readiness.", [
    option("single-line-blade", "Single-Line Blade", "Align step, hip, hand, and edge along one efficient physical cutting path.", [
      passive("monk:single-line-blade", "Single-Line Blade", "A Temple Blade Arc gains bounded precision against a target whose Posture has already been physically strained."),
      action("monk:choose-single-line", "Choose Single Line", "Declare one clear cutting path and its safe stopping distance before moving the blade."),
      proficiency("monk:single-line-blade"),
    ]),
    option("returning-sheath", "Returning Sheath", "Treat recovery and safe resheathing as part of the same kata rather than leaving the edge exposed.", [
      action("monk:return-to-sheath", "Return to Sheath", "Recover a completed temple-blade contact directly into guarded carry when space and scabbard position allow."),
      passive("monk:returning-sheath", "Returning Sheath", "A completed Monk blade technique restores readiness without granting another profession's counter or tempo mechanics."),
      proficiency("monk:returning-sheath"),
    ]),
  ], "temple-arms-method", "temple-blade-kata"),
]);

const BARBARIAN_BRANCHES = Object.freeze([
  choice("barbarian-fury-path", 10, "Barbarian Fury Path", "Choose how a trained body spends self-side Fury through wide aggression, reckless pain conversion, mass and collision, or protective physical presence. No path grants spellwork or another profession's mechanic.", [
    option("reaver", "Reaver", "Carry committed melee violence across several nearby threats through broad arcs, follow-through, and relentless target pressure.", [
      ability("barbarian-reaver-sweep"),
      passive("barbarian:reaver-pressure", "Reaver Pressure", "Wide native Barbarian attacks remain armour-respecting and must follow a physically continuous melee arc.", { furyPath: "reaver" }),
      proficiency("barbarian:reaver"),
    ]),
    option("berserker", "Berserker", "Convert pain and chosen defensive exposure into brief offensive force without healing wounds or surrendering target choice.", [
      ability("barbarian-berserker-abandon"),
      passive("barbarian:berserker-reckoning", "Berserker Reckoning", "Missing vitality and recent direct harm can sharpen native Berserker offence, but self-harm never grants Fury.", { furyPath: "berserker" }),
      proficiency("barbarian:berserker"),
    ]),
    option("juggernaut", "Juggernaut", "Turn carried mass, acceleration, bracing, and bodily collision into force that remains bounded by footing and comparative size.", [
      ability("barbarian-juggernaut-check"),
      passive("barbarian:collision-mass", "Collision Mass", "Native Juggernaut control moves only physically manageable bodies; large, anchored, or boss-scale targets suffer a bounded disruption instead.", { furyPath: "juggernaut" }),
      proficiency("barbarian:juggernaut"),
    ]),
    option("clan-champion", "Clan Champion", "Use visible courage, challenge, voice, and body position to draw danger and steady allies without commands, auras, or supernatural compulsion.", [
      ability("barbarian-clan-challenge"),
      passive("barbarian:champions-presence", "Champion's Presence", "Aware creatures may answer a credible physical challenge according to hearing, courage, intent, and circumstance; no mind is forced.", { furyPath: "clan-champion" }),
      proficiency("barbarian:clan-champion"),
    ]),
  ]),

  choice("reaver-method", 30, "Reaver Method", "Choose pursuit that keeps pressure on the bloodied or complete commitment to a wide field of physical ruin.", [
    option("blood-trail", "Blood Trail", "Drive through an open lane toward a visibly wounded foe and keep the next contact tied to that physical pursuit.", [
      ability("barbarian-blood-trail"),
      passive("barbarian:blood-trail-reading", "Blood Trail Reading", "Visible injury, movement, distance, and obstacles determine pursuit; hidden or bloodless targets are not mystically sensed."),
      proficiency("barbarian:blood-trail"),
    ]),
    option("wide-ruin", "Wide Ruin", "Commit Fury to repeated broad contacts that pressure a group while every target's armour resolves each impact.", [
      ability("barbarian-wide-ruin"),
      passive("barbarian:wide-ruin-geometry", "Wide Ruin Geometry", "A crowd attack reaches only bodies connected by clear weapon and recovery paths around the Reaver."),
      proficiency("barbarian:wide-ruin"),
    ]),
  ], "barbarian-fury-path", "reaver"),
  choice("blood-trail-apex", 50, "Blood Trail Apex", "Choose pursuit that cannot be easily screened or pressure refined around the moment a wounded foe begins to fail.", [
    option("red-pursuer", "Red Pursuer", "Keep a visibly wounded target in reach by reading gait, breath, escape angle, and the bodies trying to screen it.", [
      passive("barbarian:red-pursuer", "Red Pursuer", "Blood Trail loses less movement to ordinary bodily screening when a physically open route still exists."),
      action("barbarian:plot-red-pursuit", "Plot Red Pursuit", "Identify a direct traversable path to one visibly wounded target without crossing solid obstacles or occupied space."),
      proficiency("barbarian:red-pursuer"),
    ]),
    option("finishing-pressure", "Finishing Pressure", "Recognize faltering support and keep force on it without converting weakness into an automatic execution.", [
      action("barbarian:read-finishing-pressure", "Read Finishing Pressure", "Assess whether a wounded target's breath, stance, or grip presents a real physical opening."),
      passive("barbarian:finishing-pressure", "Finishing Pressure", "Native Reaver attacks gain bounded accuracy against visibly failing physical defence but never bypass armour or guarantee a kill."),
      proficiency("barbarian:finishing-pressure"),
    ]),
  ], "reaver-method", "blood-trail"),
  choice("wide-ruin-apex", 50, "Wide Ruin Apex", "Choose mastery of a packed melee or the longest honest arc a heavy weapon and body can sustain.", [
    option("crowd-breaker", "Crowd Breaker", "Make nearby enemies obstruct one another while forcing an attack through the physically open section of the crowd.", [
      passive("barbarian:crowd-breaker", "Crowd Breaker", "Wide native attacks exploit ordinary crowding for bounded pressure; open surrounds and disciplined spacing remain dangerous."),
      action("barbarian:find-crowd-seam", "Find Crowd Seam", "Identify where adjacent bodies, weapons, and terrain leave one continuous broad attack line."),
      proficiency("barbarian:crowd-breaker"),
    ]),
    option("long-arc-reaver", "Long-Arc Reaver", "Use complete hip rotation, grip travel, and weapon weight to extend a broad strike to its real maximum.", [
      action("barbarian:set-long-arc", "Set the Long Arc", "Declare a clear swing and recovery path whose reach follows the held weapon and current footing."),
      passive("barbarian:long-arc", "Long Arc", "Wide attacks retain force farther through a clear arc but cannot pass through allies, walls, or bodies already stopping the weapon."),
      proficiency("barbarian:long-arc-reaver"),
    ]),
  ], "reaver-method", "wide-ruin"),

  choice("berserker-method", 30, "Berserker Method", "Choose exact conversion of recent pain into offence or a deliberately narrowed red state built around repeated reckless contact.", [
    option("pain-eater", "Pain Eater", "Carry the memory of a recent direct hostile hit into the next committed blow without healing, cancelling, or storing the damage itself.", [
      ability("barbarian-pain-eater"),
      passive("barbarian:pain-conversion", "Pain Conversion", "Only recent direct hostile damage can add bounded force to the next native attack; the wound and its consequences remain."),
      proficiency("barbarian:pain-eater"),
    ]),
    option("red-haze", "Red Haze", "Narrow attention to immediate reach and repeat forceful contact while openly sacrificing a defensive line.", [
      ability("barbarian-red-haze"),
      passive("barbarian:red-haze-focus", "Red Haze Focus", "The Berserker keeps target choice, can stop attacking, and gains no supernatural immunity while the guard is exposed."),
      proficiency("barbarian:red-haze"),
    ]),
  ], "barbarian-fury-path", "berserker"),
  choice("pain-eater-apex", 50, "Pain Eater Apex", "Choose exact use of a fresh impact or a body trained to keep old scars from confusing the present exchange.", [
    option("fresh-hurt-engine", "Fresh-Hurt Engine", "Convert the direction and timing of the latest direct hostile hit into one immediate physical answer.", [
      passive("barbarian:fresh-hurt-engine", "Fresh-Hurt Engine", "Pain Eater retains more bounded force when used before another hostile action changes the exchange; indirect damage never qualifies."),
      action("barbarian:name-fresh-hurt", "Name the Fresh Hurt", "Identify the latest qualifying direct hit and the physically connected attack line it opened."),
      proficiency("barbarian:fresh-hurt-engine"),
    ]),
    option("scar-forged", "Scar-Forged", "Separate remembered pain from current damage so an old wound informs posture without becoming imaginary fuel.", [
      action("barbarian:consult-scar-map", "Consult the Scar Map", "Compare a current impact with a known healed injury and adjust stance around the vulnerable line."),
      passive("barbarian:scar-forged", "Scar-Forged", "Old healed injuries interfere less with Pain Eater's reading, but scars grant neither Fury nor damage on their own."),
      proficiency("barbarian:scar-forged"),
    ]),
  ], "berserker-method", "pain-eater"),
  choice("red-haze-apex", 50, "Red Haze Apex", "Choose disciplined control inside reckless aggression or a forward commitment that refuses easy displacement.", [
    option("controlled-red", "Controlled Red", "Hold one selected attack line in the narrowed state while preserving the ability to stop, change targets, or protect an ally.", [
      passive("barbarian:controlled-red", "Controlled Red", "Red Haze imposes a smaller bounded awareness penalty without removing its exposed-guard cost."),
      action("barbarian:set-red-boundary", "Set the Red Boundary", "Name the target, stopping condition, and space the Berserker will not cross during the next reckless sequence."),
      proficiency("barbarian:controlled-red"),
    ]),
    option("no-backward-step", "No Backward Step", "Keep the hips and feet driving through expected contact instead of yielding ground during a chosen assault.", [
      action("barbarian:plant-forward-step", "Plant the Forward Step", "Choose sound footing and a short attack line the Berserker intends to hold through ordinary collision."),
      passive("barbarian:no-backward-step", "No Backward Step", "While using native reckless techniques, ordinary shoves lose bounded force; superior mass, terrain, and boss control still move the body."),
      proficiency("barbarian:no-backward-step"),
    ]),
  ], "berserker-method", "red-haze"),

  choice("juggernaut-method", 30, "Juggernaut Method", "Choose a moving body used as a ram or a massive frame built to receive collision and remain functional.", [
    option("living-ram", "Living Ram", "Turn a short run, lowered shoulder, armour, and body mass into a directed physical breach.", [
      ability("barbarian-living-ram"),
      passive("barbarian:living-ram-line", "Living Ram Line", "The charge requires a traversable lane and sound footing; it cannot pass through an immovable barrier or unmanageable body."),
      proficiency("barbarian:living-ram"),
    ]),
    option("mountain-frame", "Mountain Frame", "Receive force through stance, tissue, bone, carried equipment, and terrain without claiming literal immovability.", [
      ability("barbarian-mountain-frame"),
      passive("barbarian:mountain-frame", "Mountain Frame", "A prepared brace reduces bounded physical shock and forced movement but never negates piercing paths, mortal trauma, or overwhelming mass."),
      proficiency("barbarian:mountain-frame"),
    ]),
  ], "barbarian-fury-path", "juggernaut"),
  choice("living-ram-apex", 50, "Living Ram Apex", "Choose collision against structures and gates or complete commitment to breaking an occupied battle line.", [
    option("gate-breaker", "Gate Breaker", "Match running mass and impact surface to hinges, braces, frames, and other real structural weaknesses.", [
      passive("barbarian:gate-breaker", "Gate Breaker", "Living Ram gains bounded force against a braced mundane structure only when material, route, and impact point make a breach plausible."),
      action("barbarian:choose-breach-point", "Choose Breach Point", "Inspect a mundane barrier for a load-bearing weakness and a safe direct collision line."),
      proficiency("barbarian:gate-breaker"),
    ]),
    option("line-crusher", "Line Crusher", "Drive one manageable body into the pressure behind it so a formation must absorb the collision physically.", [
      action("barbarian:mark-crush-line", "Mark the Crush Line", "Choose a short occupied route where collision can transfer through ordinary bodies and footing."),
      passive("barbarian:line-crusher", "Line Crusher", "A successful Living Ram can disorder nearby ordinary bodies, while large or boss-scale targets receive only bounded guard disruption."),
      proficiency("barbarian:line-crusher"),
    ]),
  ], "juggernaut-method", "living-ram"),
  choice("mountain-frame-apex", 50, "Mountain Frame Apex", "Choose anchoring through perfect load paths or endurance that preserves function under sustained physical pressure.", [
    option("rooted-colossus", "Rooted Colossus", "Spread force through both feet, lowered centre, and the terrain beneath before a known collision arrives.", [
      passive("barbarian:rooted-colossus", "Rooted Colossus", "Mountain Frame resists more ordinary forced movement while stationary on sound footing; broken ground and greater mass still prevail."),
      action("barbarian:set-rooted-frame", "Set Rooted Frame", "Choose the direction of expected force and establish a physically supported stance against it."),
      proficiency("barbarian:rooted-colossus"),
    ]),
    option("enduring-bulk", "Enduring Bulk", "Carry armour, wounds, and repeated impacts through a frame conditioned for prolonged load rather than sudden recovery.", [
      action("barbarian:audit-loaded-frame", "Audit the Loaded Frame", "Assess joints, breath, injury, armour weight, and footing before accepting another collision."),
      passive("barbarian:enduring-bulk", "Enduring Bulk", "Prepared physical bracing degrades more slowly across repeated contacts but never heals accumulated damage."),
      proficiency("barbarian:enduring-bulk"),
    ]),
  ], "juggernaut-method", "mountain-frame"),

  choice("clan-champion-method", 30, "Clan Champion Method", "Choose a challenge that pulls foes toward the Champion or a battle cry that steadies allies through embodied courage.", [
    option("foe-caller", "Foe Caller", "Name and face credible threats so attacking someone else means visibly yielding the challenge or exposing a physical route.", [
      ability("barbarian-foe-caller"),
      passive("barbarian:foe-calling", "Foe Calling", "Challenges depend on hearing, awareness, motive, and pride; mindless, deaf, distant, or disciplined foes cannot be compelled."),
      proficiency("barbarian:foe-caller"),
    ]),
    option("war-cry", "War Cry", "Use a trained voice and fearless physical example to restore shaken allies' willingness to act without issuing orders or casting a spell.", [
      ability("barbarian-war-cry"),
      passive("barbarian:war-cry", "War Cry", "Only conscious allies who can hear and take courage from the Champion gain bounded morale; the cry creates no magical aura."),
      proficiency("barbarian:war-cry"),
    ]),
  ], "barbarian-fury-path", "clan-champion"),
  choice("foe-caller-apex", 50, "Foe Caller Apex", "Choose one challenge held with complete attention or physical positioning that makes the Champion the costly path to an ally.", [
    option("marked-rival", "Marked Rival", "Hold eye line, weapon line, and stance against one named opponent until either body leaves the contest.", [
      passive("barbarian:marked-rival", "Marked Rival", "A continuously aware challenged foe suffers bounded accuracy when attacking elsewhere, but retains full agency and can break contact."),
      action("barbarian:mark-rival", "Mark Rival", "Name one visible aware foe and establish the physical line from which the challenge is maintained."),
      proficiency("barbarian:marked-rival"),
    ]),
    option("bodyguards-challenge", "Bodyguard's Challenge", "Stand where reaching a chosen ally requires crossing the Champion's body, reach, or credible counterattack.", [
      action("barbarian:take-guarding-ground", "Take Guarding Ground", "Move into a physically reachable position that blocks or contests one direct route to an ally."),
      passive("barbarian:bodyguards-challenge", "Bodyguard's Challenge", "Foe Caller protects through position and threat, never teleporting, intercepting distant harm, or forcing target selection."),
      proficiency("barbarian:bodyguards-challenge"),
    ]),
  ], "clan-champion-method", "foe-caller"),
  choice("war-cry-apex", 50, "War Cry Apex", "Choose an example that becomes the clan's centre or a voice trained to restore coherence across a broken line.", [
    option("clan-heart", "Clan Heart", "Remain visibly active under pressure so allies can measure their own courage against a living physical example.", [
      passive("barbarian:clan-heart", "Clan Heart", "Nearby aware allies resist bounded morale loss while they can see the Champion standing; this is neither an aura nor immunity to fear."),
      action("barbarian:stand-as-clan-heart", "Stand as Clan Heart", "Take a visible defensible position from which allies can physically see the Champion endure."),
      proficiency("barbarian:clan-heart"),
    ]),
    option("line-steadying-voice", "Line-Steadying Voice", "Cut through noise with names, shared memory, and a repeated human rhythm that helps shaken allies act together again.", [
      action("barbarian:set-steadying-cadence", "Set a Steadying Cadence", "Use a short audible phrase and bodily rhythm that willing conscious allies can follow through confusion."),
      passive("barbarian:line-steadying-voice", "Line-Steadying Voice", "War Cry reaches more eligible allies through ordinary battle noise but does not command them or affect creatures that cannot hear or understand."),
      proficiency("barbarian:line-steadying-voice"),
    ]),
  ], "clan-champion-method", "war-cry"),
]);

const RANGER_BRANCHES = Object.freeze([
  choice("ranger-field-practice", 10, "Ranger Field Practice", "Choose the practical discipline that first shapes Quarry Insight. Every practice remains mundane fieldcraft built from evidence, terrain, tools, training, and present living allies.", [
    option("hunter", "Hunter", "Study one quarry patiently, preserve its trail, and turn verified behaviour into bounded precision rather than a magical mark.", [
      ability("ranger-patient-aim"),
      passive("ranger:hunter-patience", "Hunter's Patience", "Patient Aim binds its chosen target as the quarry and builds one Quarry Insight only after a successful setup, clearing any previous quarry first; waiting alone reveals nothing.", { rangerPath: "hunter" }),
      proficiency("ranger:hunter"),
    ]),
    option("trailblazer", "Trailblazer", "Read terrain ahead of a pursuit and make a practical path through difficult ground without teleportation or primal guidance.", [
      ability("ranger-pathfinder-step"),
      passive("ranger:trailblazer-route", "Trailblazer Route", "Pathfinder Step binds its chosen target as the quarry and builds one Quarry Insight only when the route setup succeeds, clearing any previous quarry first; barriers and distance remain real.", { rangerPath: "trailblazer" }),
      proficiency("ranger:trailblazer"),
    ]),
    option("beast-warden", "Beast Warden", "Care for, train, and coordinate already-present mundane animal companions through learned signals and trust.", [
      ability("ranger-companion-signal"),
      passive("ranger:present-companion", "Present Companion", "Companion Signal binds its chosen target as the quarry and builds one Quarry Insight only when an already-present trained mundane animal successfully lands its attack, clearing any previous quarry first; it never summons, creates, replaces, or telepathically commands an animal.", { rangerPath: "beast-warden", requiresPresentTrainedAnimal: true, summonsAnimal: false }),
      proficiency("ranger:beast-warden"),
    ]),
    option("trapper", "Trapper", "Shape cordage, anchors, bait, concealment, and terrain into physical capture and ambush tools that remain discoverable and breakable.", [
      ability("ranger-set-snare"),
      passive("ranger:physical-traps", "Physical Traps", "Set Snare binds its chosen target as the quarry and builds one Quarry Insight only when the mundane setup successfully catches or constrains it, clearing any previous quarry first; failed placement builds none.", { rangerPath: "trapper" }),
      proficiency("ranger:trapper"),
    ]),
  ]),

  choice("hunter-method", 30, "Hunter Method", "Choose close study of unusual quarry or exact ranged discipline. Both spend accumulated evidence against the current quarry rather than casting Hunter's Mark.", [
    option("monster-stalker", "Monster Stalker", "Study unfamiliar anatomy, sign, behaviour, and attack patterns until an extraordinary creature becomes a bounded physical problem.", [
      ability("ranger-read-monster"),
      passive("ranger:monster-evidence", "Monster Evidence", "Read Monster spends two Quarry Insight on the current target and exposes only traits supported by observation, remains, testimony, or tested reaction.", { rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true }),
      proficiency("ranger:monster-stalker"),
    ]),
    option("deadeye", "Deadeye", "Control breath, posture, range, wind, release, and restraint for a narrow physical shot against studied quarry.", [
      ability("ranger-deadeye-breath"),
      passive("ranger:deadeye-discipline", "Deadeye Discipline", "Deadeye Breath spends two Quarry Insight on the current target; armour, cover, visibility, ammunition, weapon range, and anatomy still govern the result.", { rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true }),
      proficiency("ranger:deadeye"),
    ]),
  ], "ranger-field-practice", "hunter"),
  choice("monster-stalker-apex", 50, "Monster Stalker Apex", "Choose deeper physical anatomy or the patient reconstruction of a dangerous quarry's learned habits.", [
    option("anatomy-reader", "Anatomy Reader", "Compare movement, wounds, remains, feeding, breath, and failed attacks to map an unfamiliar body's practical limits.", [
      action("ranger:examine-monster-anatomy", "Examine Monster Anatomy", "Study safely observable structure, remains, gait, injury, excretion, and response to build a revisable mundane anatomical record."),
      passive("ranger:anatomy-reader", "Anatomy Reader", "Read Monster gains stronger bounded value from verified anatomy but never invents organs, weaknesses, immunities, or hidden statistics."),
      proficiency("ranger:anatomy-reader"),
    ]),
    option("counter-hunter", "Counter-Hunter", "Treat the quarry as another learner whose routes, feints, appetites, and reactions can change under pursuit.", [
      action("ranger:reconstruct-counter-hunt", "Reconstruct the Counter-Hunt", "Compare abandoned sign, bait, reversals, observation points, and pursuit losses to identify how the quarry may be studying its hunters."),
      passive("ranger:counter-hunter", "Counter-Hunter", "Read Monster adapts to an actually observed repeated tactic; a new behaviour remains unknown until evidenced."),
      proficiency("ranger:counter-hunter"),
    ]),
  ], "hunter-method", "monster-stalker"),
  choice("deadeye-apex", 50, "Deadeye Apex", "Choose complete stillness across extreme ordinary range or exact work through a small temporary shot lane.", [
    option("still-horizon", "Still Horizon", "Prepare body, rest, camouflage, wind calls, distance references, and an exit route for a patient long shot.", [
      action("ranger:establish-longwatch", "Establish a Longwatch", "Prepare a concealed mundane observation and firing position with tested ranges, weather limits, relief, and a safe withdrawal."),
      passive("ranger:still-horizon", "Still Horizon", "Deadeye Breath retains precision farther within the weapon's real range after proper preparation; it never sees through cover or removes travel time."),
      proficiency("ranger:still-horizon"),
    ]),
    option("thread-the-gap", "Thread the Gap", "Wait until movement, cover, bystanders, and armour briefly expose one physically reachable line.", [
      action("ranger:measure-shot-lane", "Measure the Shot Lane", "Identify an observed opening, its duration, intervening material, bystander risk, and the projectile path needed to use it."),
      passive("ranger:thread-the-gap", "Thread the Gap", "Deadeye Breath better uses a verified narrow opening but never ignores solid cover, complete armour, misses, or impossible geometry."),
      proficiency("ranger:thread-the-gap"),
    ]),
  ], "hunter-method", "deadeye"),

  choice("trailblazer-method", 30, "Trailblazer Method", "Choose safe passage for a whole expedition or mobile ranged pursuit across broken ground.", [
    option("pathfinder", "Pathfinder", "Turn survey, local knowledge, weather, hazards, and group limits into a route others can actually follow.", [
      ability("ranger-safe-passage"),
      passive("ranger:pathfinder-passage", "Pathfinder Passage", "Safe Passage spends two Quarry Insight tied to the current quarry to counter its known terrain line; willing travellers still obey footing, load, weather, and speed limits.", { rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true }),
      proficiency("ranger:pathfinder"),
    ]),
    option("skirmisher", "Skirmisher", "Keep ordinary ranged pressure while changing position through terrain that has been read rather than magically crossed.", [
      ability("ranger-running-shot"),
      passive("ranger:skirmisher-footing", "Skirmisher Footing", "Running Shot spends two Quarry Insight against the current target; movement remains bounded by actual ground, encumbrance, obstacles, and weapon handling.", { rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true }),
      proficiency("ranger:skirmisher"),
    ]),
  ], "ranger-field-practice", "trailblazer"),
  choice("pathfinder-apex", 50, "Pathfinder Apex", "Choose expedition-scale route leadership or specialized diagnosis of natural and constructed hazards.", [
    option("expedition-master", "Expedition Master", "Join maps, local testimony, transport, supply, permission, weather, medicine, and extraction into one shared route plan.", [
      action("ranger:brief-expedition-route", "Brief an Expedition Route", "Give willing travellers a staged route, responsibilities, resupply points, hazard responses, rally sites, and abort conditions."),
      passive("ranger:expedition-master", "Expedition Master", "Safe Passage supports more prepared travellers through logistics and briefing, not supernatural group movement or command."),
      proficiency("ranger:expedition-master"),
    ]),
    option("hazard-reader", "Hazard Reader", "Read flood, fire, unstable earth, avalanche, ice, windfall, ruin, and animal traffic before a route enters the danger.", [
      action("ranger:survey-route-hazard", "Survey a Route Hazard", "Inspect visible triggers, extent, recent activity, safe distance, bypasses, and signs that require a specialist."),
      passive("ranger:hazard-reader", "Hazard Reader", "Safe Passage better mitigates an identified physical hazard; concealed, novel, overwhelming, or ignored hazards remain dangerous."),
      proficiency("ranger:hazard-reader"),
    ]),
  ], "trailblazer-method", "pathfinder"),
  choice("skirmisher-apex", 50, "Skirmisher Apex", "Choose unmatched movement through surveyed broken ground or disciplined protection of a withdrawing company.", [
    option("broken-ground-runner", "Broken-Ground Runner", "Use tested footholds, slopes, gaps, handholds, and low cover to preserve movement where a straight sprint would fail.", [
      action("ranger:survey-running-line", "Survey a Running Line", "Mark a physically traversable sequence through rubble, brush, slope, shallow water, or ruined ground before committing at speed."),
      passive("ranger:broken-ground-runner", "Broken-Ground Runner", "Running Shot loses less ordinary accuracy on surveyed difficult ground but grants no teleportation, phasing, flight, or impossible balance."),
      proficiency("ranger:broken-ground-runner"),
    ]),
    option("rearguard-harrier", "Rearguard Harrier", "Use range, cover, route knowledge, and visible pressure to buy a voluntary retreat without ordering companions' bodies.", [
      action("ranger:set-rearguard-bounds", "Set Rearguard Bounds", "Choose successive cover points, signals, casualty routes, and the moment a willing rear guard must disengage."),
      passive("ranger:rearguard-harrier", "Rearguard Harrier", "Running Shot better pressures the studied pursuer during an organized withdrawal; it grants allies neither extra actions nor forced movement."),
      proficiency("ranger:rearguard-harrier"),
    ]),
  ], "trailblazer-method", "skirmisher"),

  choice("beast-warden-method", 30, "Beast Warden Method", "Choose coordinated work with an already-present trained ground-animal group or a present trained hunting bird. Neither method summons or creates a companion.", [
    option("packmaster", "Packmaster", "Care for and coordinate multiple already-present trained mundane animals through distinct learned cues, spacing, and welfare limits.", [
      ability("ranger-pack-command"),
      passive("ranger:present-pack", "Present Pack", "Pack Command spends two Quarry Insight against the current target and can involve only suitable trained animals already present in the fight; no animal appears, transforms, or loses agency.", { rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true, requiresPresentTrainedAnimal: true, summonsAnimal: false }),
      proficiency("ranger:packmaster"),
    ]),
    option("falconer", "Falconer", "Work with one already-present trained mundane raptor through hood, lure, glove, whistle, reward, wind, and safe flight judgment.", [
      ability("ranger-falcon-stoop"),
      passive("ranger:present-raptor", "Present Raptor", "Falcon Stoop spends two Quarry Insight against the current target and requires a suitable trained mundane avian ally already present; it grants no summoning, telepathy, shared senses, or magical return.", { rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true, requiresPresentTrainedAnimal: true, requiresPresentTrainedAvian: true, summonsAnimal: false }),
      proficiency("ranger:falconer"),
    ]),
  ], "ranger-field-practice", "beast-warden"),
  choice("packmaster-apex", 50, "Packmaster Apex", "Choose expert kennel stewardship or exact physical flanking patterns for present trained animals.", [
    option("kennel-captain", "Kennel Captain", "Manage temperament, housing, diet, breeding records, health, pairings, retirement, and retraining across a working animal group.", [
      action("ranger:audit-working-pack", "Audit a Working Pack", "Assess each present animal's health, stress, training reliability, social fit, workload, equipment, and need for rest or retirement."),
      passive("ranger:kennel-captain", "Kennel Captain", "Pack Command remains more reliable among animals trained and housed together, but fear, injury, confusion, unsuitable species, and refusal still matter."),
      proficiency("ranger:kennel-captain"),
    ]),
    option("coordinated-flank", "Coordinated Flank", "Teach distinct approach, hold, release, break, and return signals so present animals do not collapse into one dangerous rush.", [
      action("ranger:rehearse-animal-flank", "Rehearse an Animal Flank", "Practice a safe physical approach pattern with already-present trained animals, clear lanes, recall points, and rewards."),
      passive("ranger:coordinated-flank", "Coordinated Flank", "Pack Command gains bounded positional value from rehearsed present animals; it never duplicates animals, forces obedience, or ignores blocked paths."),
      proficiency("ranger:coordinated-flank"),
    ]),
  ], "beast-warden-method", "packmaster"),
  choice("falconer-apex", 50, "Falconer Apex", "Choose high-circle observation through learned signals or a carefully conditioned physical hunting stoop.", [
    option("high-circle-spotter", "High-Circle Spotter", "Read a trained bird's ordinary flight, alarm, return, and rehearsed signals as limited information about open ground.", [
      action("ranger:work-high-circle", "Work the High Circle", "Release an already-present trained bird where weather, visibility, territory, safety, and return conditioning allow an ordinary aerial survey."),
      passive("ranger:high-circle-spotter", "High-Circle Spotter", "The bird can return learned signals or visible carried tokens; the Ranger never sees through its eyes or learns what it could not communicate."),
      proficiency("ranger:high-circle-spotter"),
    ]),
    option("stoop-master", "Stoop Master", "Condition angle, lure response, target recognition, breakaway, and recall for a present raptor's safest committed descent.", [
      action("ranger:plan-falcon-stoop", "Plan a Falcon Stoop", "Assess wind, height, obstacles, quarry size, bystanders, escape lanes, and the trained bird's condition before giving the learned release cue."),
      passive("ranger:stoop-master", "Stoop Master", "Falcon Stoop gains bounded precision when the real flight line is suitable; bad weather, cover, injury, fear, and an absent bird still prevent it."),
      proficiency("ranger:stoop-master"),
    ]),
  ], "beast-warden-method", "falconer"),

  choice("trapper-method", 30, "Trapper Method", "Choose layered physical restraint or a prepared ambush lane constructed around the current quarry's observed movement.", [
    option("snarewright", "Snarewright", "Combine several visible physical mechanisms so one failure does not make a capture plan imaginary or inescapable.", [
      ability("ranger-layered-snare"),
      passive("ranger:layered-rigging", "Layered Rigging", "Layered Snare spends two Quarry Insight against the current target; material strength, anchors, trigger access, size, footing, awareness, and escape still apply.", { rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true }),
      proficiency("ranger:snarewright"),
    ]),
    option("ambusher", "Ambusher", "Prepare concealment, range cards, trigger discipline, lanes, retreat, and restraint before a quarry enters a physical kill zone.", [
      ability("ranger-kill-zone"),
      passive("ranger:prepared-kill-zone", "Prepared Kill Zone", "Kill Zone spends two Quarry Insight against the current target and works only through actually prepared positions, ordinary attacks, and willing participants.", { rangerQuarryInsightCost: 2, rangerRequiresCurrentQuarry: true }),
      proficiency("ranger:ambusher"),
    ]),
  ], "ranger-field-practice", "trapper"),
  choice("snarewright-apex", 50, "Snarewright Apex", "Choose safer live capture or load-tested rigging for exceptionally large mundane bodies.", [
    option("humane-captor", "Humane Captor", "Design restraint around breathing, circulation, panic, weather, inspection, release, and prompt care rather than suffering.", [
      action("ranger:design-humane-snare", "Design a Humane Snare", "Choose a physical capture mechanism, inspection interval, warning marks, release tool, and species-appropriate injury precautions."),
      passive("ranger:humane-captor", "Humane Captor", "Layered Snare can trade injury for bounded restraint when the target's anatomy and size are known; no trap is painless or safe by declaration."),
      proficiency("ranger:humane-captor"),
    ]),
    option("heavy-game-rigger", "Heavy-Game Rigger", "Calculate anchor, line, counterweight, terrain, redundancy, and safe working distance for a much larger quarry.", [
      action("ranger:load-test-heavy-snare", "Load-Test a Heavy Snare", "Test ordinary components and anchors below their working limit, record failure points, and establish a clear exclusion zone."),
      passive("ranger:heavy-game-rigger", "Heavy-Game Rigger", "Layered Snare better resists known mass and force when properly built, but inadequate material, impossible scale, or bad anchors still fail."),
      proficiency("ranger:heavy-game-rigger"),
    ]),
  ], "trapper-method", "snarewright"),
  choice("ambusher-apex", 50, "Ambusher Apex", "Choose near-perfect mundane concealment or a disciplined set of intersecting physical attack lanes.", [
    option("camouflage-architect", "Camouflage Architect", "Shape colour, texture, shadow, scent, reflection, spoil, approach, and escape around one actual environment.", [
      action("ranger:construct-ambush-hide", "Construct an Ambush Hide", "Build a mundane concealed position suited to local material, weather, sight lines, duration, occupants, and an exit route."),
      passive("ranger:camouflage-architect", "Camouflage Architect", "Kill Zone is harder to notice before use when preparation matches the site; movement, close inspection, unusual senses, and changed conditions can expose it."),
      proficiency("ranger:camouflage-architect"),
    ]),
    option("crossfire-planner", "Crossfire Planner", "Assign safe physical lanes, backstops, ranges, trigger signals, casualty access, and disengagement for willing shooters.", [
      action("ranger:plan-crossfire", "Plan a Crossfire", "Brief willing participants on non-overlapping fields, target identification, withheld-fire conditions, signals, and safe withdrawal."),
      passive("ranger:crossfire-planner", "Crossfire Planner", "Kill Zone gains bounded coverage from prepared willing participants but grants no extra actions, compelled attacks, ammunition, or impossible lines of sight."),
      proficiency("ranger:crossfire-planner"),
    ]),
  ], "trapper-method", "ambusher"),
]);

const ROGUE_BRANCHES = Object.freeze([
  choice("rogue-practice", 10, "Rogue Practice", "Choose the mundane practice that first shapes source-owned Opportunity Windows. Every path relies on physical access, observation, deception, tools, or preparation rather than magic.", [
    option("infiltrator", "Infiltrator", "Enter, cross, observe, take, and leave through real architecture, routines, concealment, and access discipline.", [
      ability("rogue-silent-entry"),
      passive("rogue:infiltrator-opening", "Infiltrator Opening", "Silent Entry creates or refreshes this Rogue's two-turn Window on the chosen target only after a successful mundane access setup; cover alone grants nothing.", { roguePath: "infiltrator" }),
      proficiency("rogue:infiltrator"),
    ]),
    option("scoundrel", "Scoundrel", "Use nerve, appetite, status, plausible lies, feints, and social expectation without enchanting or compelling anyone.", [
      ability("rogue-brazen-feint"),
      passive("rogue:scoundrel-opening", "Scoundrel Opening", "Brazen Feint creates or refreshes this Rogue's Window only when the chosen target successfully takes the physical or contextual bait.", { roguePath: "scoundrel" }),
      proficiency("rogue:scoundrel"),
    ]),
    option("assassin", "Assassin", "Prepare identity, approach, timing, anatomy, weapon, restraint, and escape for deliberate physical violence against a known target.", [
      ability("rogue-killing-measure"),
      passive("rogue:assassin-opening", "Assassin Opening", "Killing Measure creates or refreshes this Rogue's Window only after a successful visible study of the chosen target; it grants no automatic kill.", { roguePath: "assassin" }),
      proficiency("rogue:assassin"),
    ]),
    option("saboteur", "Saboteur", "Find access, fastener, mechanism, support, maintenance, and load faults, then exploit existing material weakness without arcane construction.", [
      ability("rogue-fault-finder"),
      passive("rogue:saboteur-opening", "Saboteur Opening", "Fault Finder creates or refreshes this Rogue's Window only after a successful physical diagnosis tied to the chosen target or its accessible equipment and support.", { roguePath: "saboteur" }),
      proficiency("rogue:saboteur"),
    ]),
  ]),

  choice("rogue-infiltrator-method", 30, "Infiltrator Method", "Choose vertical access across surveyed architecture or unnoticed movement through ordinary crowds. Both exploit only the exact source-owned Window.", [
    option("cat-burglar", "Cat Burglar", "Use ledges, roofs, frames, shafts, balconies, ropes, and load-tested anchors for physical second-story access.", [
      ability("rogue-high-window"),
      passive("rogue:high-window-access", "High Window Access", "High Window consumes this Rogue's Window on the exact target when committed; height, footing, tools, fall risk, cover, and a failed action still apply."),
      proficiency("rogue:cat-burglar"),
    ]),
    option("crowd-ghost", "Crowd Ghost", "Match pace, purpose, spacing, clothing, and attention inside a real crowd without invisibility, teleportation, or erased identity.", [
      ability("rogue-crowd-ghost"),
      passive("rogue:crowd-ghost-method", "Crowd Ghost Method", "Crowd Ghost consumes this Rogue's Window on the exact target when committed and relies on an actual crowd or traffic pattern; close scrutiny can still follow the Rogue."),
      proficiency("rogue:crowd-ghost"),
    ]),
  ], "rogue-practice", "infiltrator"),
  choice("rogue-cat-burglar-apex", 50, "Cat Burglar Apex", "Choose complete survey of elevated access or mastery of physical restraints and emergency exits.", [
    option("roofline-surveyor", "Roofline Surveyor", "Read a connected upper route as structure, ownership, exposure, weather, material, load, and escape rather than a flat path above the street.", [
      action("rogue:survey-roofline", "Survey a Roofline", "Map a physically reachable elevated route with anchors, gaps, weak surfaces, visible windows, occupied spaces, witnesses, and descent alternatives."),
      passive("rogue:roofline-surveyor", "Roofline Surveyor", "High Window gains stronger bounded access from a properly surveyed route but never grants impossible climbing, flight, or safe falls."),
      proficiency("rogue:roofline-surveyor"),
    ]),
    option("escape-artist", "Escape Artist", "Study cuffs, rope, knots, cells, search routines, body position, tools, timing, and the danger of escaping into a worse enclosure.", [
      action("rogue:rehearse-restraint-escape", "Rehearse a Restraint Escape", "Practice release from known mundane restraints under safe supervision, preserving circulation, joints, tools, and a clear stop condition."),
      passive("rogue:escape-artist", "Escape Artist", "High Window better converts a real access gap into egress, while broken limbs, complete immobilization, sealed construction, and active observation still prevent escape."),
      proficiency("rogue:escape-artist"),
    ]),
  ], "rogue-infiltrator-method", "cat-burglar"),
  choice("rogue-crowd-ghost-apex", 50, "Crowd Ghost Apex", "Choose a socially ordinary borrowed role or exceptional reading of how groups open and close around movement.", [
    option("familiar-stranger", "Familiar Stranger", "Become the sort of ordinary worker, guest, courier, mourner, clerk, or neighbour people remember as belonging without impersonating a named person.", [
      action("rogue:prepare-familiar-role", "Prepare a Familiar Role", "Assemble clothing, props, vocabulary, schedule, task, and boundaries for one plausible mundane role in a specific place."),
      passive("rogue:familiar-stranger", "Familiar Stranger", "Crowd Ghost draws less ordinary notice while the performed role fits context; documents, familiarity, conversation, and unusual conduct can expose it."),
      proficiency("rogue:familiar-stranger"),
    ]),
    option("flow-reader", "Flow Reader", "See queues, panic, ceremony, trade, weather, authority, bottlenecks, and sudden attention as forces shaping group movement.", [
      action("rogue:chart-crowd-flow", "Chart Crowd Flow", "Identify ordinary streams, pauses, sight lines, crush risks, exits, vulnerable people, and likely changes before moving through a crowd."),
      passive("rogue:flow-reader", "Flow Reader", "Crowd Ghost preserves its bounded reposition through more ordinary flow changes, but isolation, panic, recognition, or an empty room removes the cover."),
      proficiency("rogue:flow-reader"),
    ]),
  ], "rogue-infiltrator-method", "crowd-ghost"),

  choice("rogue-scoundrel-method", 30, "Scoundrel Method", "Choose an engineered confidence or close physical deceit. Neither method charms a mind or borrows Bard performance.", [
    option("confidence-artist", "Confidence Artist", "Build a believable exchange from real wants, truthful anchors, status signals, social proof, pressure, and an exit before scrutiny catches up.", [
      ability("rogue-confidence-play"),
      passive("rogue:confidence-context", "Confidence Context", "Confidence Play consumes this Rogue's exact Window when committed and works only through intelligible context, motive, attention, and plausible belief; it never compels."),
      proficiency("rogue:confidence-artist"),
    ]),
    option("dirty-fighter", "Dirty Fighter", "Use clothing, walls, furniture, grip, balance, breath, vision, and timing as mundane close-quarters leverage rather than formal technique.", [
      ability("rogue-dirty-trick"),
      passive("rogue:dirty-fighter-method", "Dirty Fighter Method", "Dirty Trick consumes this Rogue's exact Window on commitment; anatomy, protection, awareness, position, and failed contact constrain every effect."),
      proficiency("rogue:dirty-fighter"),
    ]),
  ], "rogue-practice", "scoundrel"),
  choice("rogue-confidence-artist-apex", 50, "Confidence Artist Apex", "Choose a long confidence sustained by institutions or an alibi built to survive hostile reconstruction.", [
    option("long-confidence", "Long Confidence", "Maintain introductions, correspondence, records, habits, obligations, staged proof, and controlled exits across a long ordinary relationship.", [
      action("rogue:stage-long-confidence", "Stage a Long Confidence", "Plan phases, truthful anchors, costs, records, contact boundaries, verification risk, exposure triggers, restitution, and exit."),
      passive("rogue:long-confidence", "Long Confidence", "Confidence Play benefits from established mundane context but never makes contradictory evidence, betrayed trust, or implausible claims disappear."),
      proficiency("rogue:long-confidence"),
    ]),
    option("perfect-alibi", "Perfect Alibi", "Prepare a coherent timeline from actual movements, corroboration, transactions, role, documents, and controlled uncertainty.", [
      action("rogue:stress-test-alibi", "Stress-Test an Alibi", "Challenge a proposed timeline against travel time, witnesses, records, motive, physical traces, likely questions, and facts that cannot safely be changed."),
      passive("rogue:perfect-alibi", "Perfect Alibi", "Confidence Play better survives routine questioning when the account is prepared, but direct proof and knowledgeable witnesses can still break it."),
      proficiency("rogue:perfect-alibi"),
    ]),
  ], "rogue-scoundrel-method", "confidence-artist"),
  choice("rogue-dirty-fighter-apex", 50, "Dirty Fighter Apex", "Choose ruthless leverage inside a clinch or disciplined use of ordinary nearby objects and surfaces.", [
    option("clinch-cheat", "Clinch Cheat", "Use hidden grip, clothing tension, head position, wall pressure, breath, and short strikes inside entanglement without pretending anatomy is uniform.", [
      action("rogue:read-clinch-leverage", "Read Clinch Leverage", "Assess grips, footing, clothing, obstacles, vulnerable joints, bystanders, and the safest available disengagement."),
      passive("rogue:clinch-cheat", "Clinch Cheat", "Dirty Trick gains bounded leverage at real close contact; larger bodies, armour, broken grip, distance, and boss scale remain decisive."),
      proficiency("rogue:clinch-cheat"),
    ]),
    option("improvised-advantage", "Improvised Advantage", "Use loose cloth, grit, a cup, chair, door, stair, table edge, or light source for one plausible physical distraction or barrier.", [
      action("rogue:inventory-improvised-leverage", "Inventory Improvised Leverage", "Identify accessible ordinary objects, surfaces, sight lines, hazards, ownership, and bystander risk before using the room."),
      passive("rogue:improvised-advantage", "Improvised Advantage", "Dirty Trick adapts to a suitable present object but creates no gadget, ammunition, terrain, or effect the environment does not support."),
      proficiency("rogue:improvised-advantage"),
    ]),
  ], "rogue-scoundrel-method", "dirty-fighter"),

  choice("rogue-assassin-method", 30, "Assassin Method", "Choose a prepared first contact from concealment or exact handling of a carried mundane poison. Neither grants supernatural execution.", [
    option("ambusher", "Ambusher", "Prepare route, hide, target identification, first contact, bystanders, restraint, and withdrawal around a real unaware or distracted target.", [
      ability("rogue-first-strike"),
      passive("rogue:ambusher-discipline", "Ambusher Discipline", "First Strike consumes this Rogue's exact Window when committed; awareness, armour, distance, miss chance, survival, and boss protections still apply."),
      proficiency("rogue:ambusher"),
    ]),
    option("poisoner", "Poisoner", "Identify, acquire, store, measure, apply, document, and respond to known mundane toxins without creating venom or immunity.", [
      ability("rogue-venom-work"),
      passive("rogue:carried-poison", "Carried Poison", "Venom Work consumes this Rogue's exact Window and requires a real known carried poison, valid exposure route, viable dose, and susceptible anatomy; no poison appears from the card."),
      proficiency("rogue:poisoner"),
    ]),
  ], "rogue-practice", "assassin"),
  choice("rogue-ambusher-apex", 50, "Ambusher Apex", "Choose extreme patience before first contact or a strike planned around immediate physical disappearance from the site.", [
    option("patient-knife", "Patient Knife", "Wait through discomfort, boredom, weather, schedule changes, false arrivals, and incomplete identification rather than forcing the wrong moment.", [
      action("rogue:keep-ambush-watch", "Keep an Ambush Watch", "Maintain a logged observation post with relief, identification standards, exposure checks, bystander rules, and an abort condition."),
      passive("rogue:patient-knife", "Patient Knife", "First Strike gains bounded precision after a genuinely maintained watch; fatigue, changed routes, detection, and no-show targets still defeat the plan."),
      proficiency("rogue:patient-knife"),
    ]),
    option("first-and-gone", "First-and-Gone", "Make the first contact only when the same preparation already contains a viable physical route away.", [
      action("rogue:pair-strike-and-exit", "Pair Strike and Exit", "Link a real first-contact position to cover transitions, disguise change, transport, casualty handling, rally point, and a route that can still be closed."),
      passive("rogue:first-and-gone", "First-and-Gone", "First Strike supports a bounded withdrawal through a prepared route; it grants no teleportation, invisibility, extra action, or guaranteed escape."),
      proficiency("rogue:first-and-gone"),
    ]),
  ], "rogue-assassin-method", "ambusher"),
  choice("rogue-poisoner-apex", 50, "Poisoner Apex", "Choose exact dose control or responsibility for recognition, isolation, and antidote readiness.", [
    option("dosewright", "Dosewright", "Match known concentration, carrier, route, timing, subject anatomy, degradation, and environmental exposure to a documented mundane dose.", [
      action("rogue:calculate-dose", "Calculate a Dose", "Record a bounded dose estimate, uncertainty, exposure route, storage, handler protection, antidote, and reasons not to proceed."),
      passive("rogue:dosewright", "Dosewright", "Venom Work wastes less of a known suitable poison and varies less under controlled conditions; resistance, error, expiry, and unknown biology remain."),
      proficiency("rogue:dosewright"),
    ]),
    option("antidote-keeper", "Antidote Keeper", "Pair every known toxin with exposure signs, decontamination, isolation, sample custody, supportive care, and any real antidote available.", [
      action("rogue:prepare-poison-response", "Prepare Poison Response", "Create a labelled mundane response kit and briefing for known substances without claiming one antidote treats every toxin."),
      passive("rogue:antidote-keeper", "Antidote Keeper", "Venom Work is less likely to expose prepared handlers, while unknown poison, wrong diagnosis, delayed care, and inadequate medicine remain dangerous."),
      proficiency("rogue:antidote-keeper"),
    ]),
  ], "rogue-assassin-method", "poisoner"),

  choice("rogue-saboteur-method", 30, "Saboteur Method", "Choose exact defeat of locks and fasteners or controlled failure through an existing structural weakness. Neither method constructs inventions.", [
    option("locksmith", "Locksmith", "Defeat, copy, repair, relock, document, and preserve ordinary locking mechanisms through tool feedback and patient diagnosis.", [
      ability("rogue-master-key"),
      passive("rogue:locksmith-method", "Locksmith Method", "Master Key consumes this Rogue's exact Window on commitment and can exploit only an accessible understood fastening or mechanism tied to the target; no universal key appears."),
      proficiency("rogue:locksmith"),
    ]),
    option("wrecker", "Wrecker", "Prepare an existing support, joint, mechanism, load, or maintenance fault to fail at a chosen physical moment with understood consequences.", [
      ability("rogue-planned-collapse"),
      passive("rogue:wrecker-method", "Wrecker Method", "Planned Collapse consumes this Rogue's exact Window and requires a real prepared structural fault; sound material, missing preparation, changed loads, or bad geometry defeat it."),
      proficiency("rogue:wrecker"),
    ]),
  ], "rogue-practice", "saboteur"),
  choice("rogue-locksmith-apex", 50, "Locksmith Apex", "Choose exact key reproduction from physical evidence or the patient diagnosis of safes and compound locks.", [
    option("key-impressionist", "Key Impressionist", "Read and reproduce an ordinary key's cuts, wards, spacing, shoulder, wear, and material from lawful access or a physical impression.", [
      action("rogue:take-key-impression", "Take a Key Impression", "Record an accessible mundane key's relevant geometry with suitable material, time, custody, and a plan to test without damaging the lock."),
      passive("rogue:key-impressionist", "Key Impressionist", "Master Key works more reliably against a known reproduced keyway; changed locks, restricted blanks, poor impressions, and secondary controls still stop it."),
      proficiency("rogue:key-impressionist"),
    ]),
    option("safecracker", "Safecracker", "Diagnose boltwork, wheels, fence, relockers, hinges, tolerances, sound, feel, records, and destructive alternatives before committing.", [
      action("rogue:diagnose-safe", "Diagnose a Safe", "Inspect an accessible mundane safe or compound lock for mechanism, condition, alarms, likely attack, time, noise, evidence, and contents at risk."),
      passive("rogue:safecracker", "Safecracker", "Master Key handles more complex understood mechanisms, but unknown relockers, time locks, active alarms, sound construction, and failed tools remain decisive."),
      proficiency("rogue:safecracker"),
    ]),
  ], "rogue-saboteur-method", "locksmith"),
  choice("rogue-wrecker-apex", 50, "Wrecker Apex", "Choose expert reading of load paths or a collapse deliberately limited around a verified weak section.", [
    option("load-bearing-reader", "Load-Bearing Reader", "Trace how weight, tension, vibration, fasteners, foundations, repairs, and occupants interact before any support is altered.", [
      action("rogue:trace-load-path", "Trace a Load Path", "Survey visible structural loads, redundancy, likely failure spread, occupied spaces, utilities, and the point where an engineer is required."),
      passive("rogue:load-bearing-reader", "Load-Bearing Reader", "Planned Collapse better uses a verified existing weakness, but no observation makes a sound structure weak or a complex failure fully predictable."),
      proficiency("rogue:load-bearing-reader"),
    ]),
    option("selective-collapse", "Selective Collapse", "Limit prepared failure with cuts, wedges, removed fasteners, release order, exclusion zones, and a clear abort rather than indiscriminate ruin.", [
      action("rogue:plan-selective-failure", "Plan Selective Failure", "Define the intended failed section, real preparation, load conditions, safe distance, warning, rescue access, bystander protection, and unacceptable spread."),
      passive("rogue:selective-collapse", "Selective Collapse", "Planned Collapse has tighter bounded reach after exact preparation; shifting loads, hidden damage, fire, crowds, and structural continuity can still spread harm."),
      proficiency("rogue:selective-collapse"),
    ]),
  ], "rogue-saboteur-method", "wrecker"),
]);

const warlockAction = (id, name, description, details = {}) => progressionGrant("action", id, { name, description, noncombatBenefit: true, ...details });
const warlockPassive = (id, name, description, details = {}) => progressionGrant("passive", id, { name, description, noncombatBenefit: true, ...details });

const WARLOCK_BRANCHES = Object.freeze([
  choice("warlock-pact", 10, "Pact Specialization", "Choose the relationship that shapes this Warlock's narrow pactcraft. Every specialization retains paid-price Pact Favor and remains distinct from broad Wizard study, Cleric prayer, Sorcerer metamagic, Druid seasons, and implicit multiclassing.", [
    option("demon-warlock", "Demon Warlock", "Bind infernal heat, hierarchy, debt, names, and contract enforcement through dangerous but explicit prices.", [
      ability("warlock-hellfire-covenant"),
      warlockPassive("warlock:demon-warlock", "Demon Warlock", "Hellfire Covenant pays five percent maximum health as a nonlethal price and builds one Pact Favor only after that health is actually lost. It is pact spellwork, not generic fire evocation or demon ancestry."),
      proficiency("warlock:demon-warlock"),
    ]),
    option("witch", "Witch", "Practice local curses, remedies, names, tokens, thresholds, reciprocal customs, and old bargains without becoming a broad primal or arcane caster.", [
      ability("warlock-witch-mark"),
      warlockPassive("warlock:witch", "Witch", "Witch Mark accepts fifteen percent increased incoming damage on the Witch for two turns, then applies bounded source-owned hex pressure; it builds one Pact Favor only when that self-exposure takes effect."),
      proficiency("warlock:witch"),
    ]),
    option("chainbinder", "Chainbinder", "Turn accepted obligations, links, seals, custody, burden, and release into narrow binding pactcraft rather than physical restraint alone.", [
      ability("warlock-pact-chain"),
      warlockPassive("warlock:chainbinder", "Chainbinder", "Pact Chain pays four percent maximum health as a nonlethal price and builds one Pact Favor only after that health is actually lost. It binds through a valid pact relation rather than conjuring a creature."),
      proficiency("warlock:chainbinder"),
    ]),
    option("whisper-broker", "Whisper Broker", "Trade known secrets, spoken terms, attention, silence, reputation, and reciprocal disclosure as pact currency without reading minds or borrowing Bard performance.", [
      ability("warlock-whispered-terms"),
      warlockPassive("warlock:whisper-broker", "Whisper Broker", "Whispered Terms accepts fifteen percent increased incoming damage on the broker for two turns, then offers bounded voluntary pressure; it builds one Pact Favor only when that self-exposure takes effect."),
      proficiency("warlock:whisper-broker"),
    ]),
  ]),

  choice("warlock-demon-method", 30, "Demon Warlock Method", "Choose Hellfire Adept for paid infernal force or Contract Keeper for exact infernal clauses and collected debt.", [
    option("hellfire-adept", "Hellfire Adept", "Shape hellfire as the narrow consequence of an infernal covenant while preserving price, ward, exposure, and collateral limits.", [
      ability("warlock-infernal-volley"),
      warlockPassive("warlock:hellfire-adept", "Hellfire Adept", "Infernal Volley commits two Pact Favor once for its whole two-hit action, even if either strike misses. It builds no Favor and never charges per hit."),
      proficiency("warlock:hellfire-adept"),
    ]),
    option("contract-keeper", "Contract Keeper", "Master infernal definitions, precedence, notice, cure, collection, release, jurisdiction, and adversarial interpretation.", [
      ability("warlock-devils-due"),
      warlockPassive("warlock:contract-keeper", "Contract Keeper", "Devil's Due commits two Pact Favor once and can enforce only its authored bounded pact consequence; title, intimidation, or unrelated injury creates no debt."),
      proficiency("warlock:contract-keeper"),
    ]),
  ], "warlock-pact", "demon-warlock"),
  choice("warlock-hellfire-adept-mastery", 50, "Hellfire Adept Mastery", "Choose exact accounting of infernal heat and fuel or the bodily discipline required to contain a dangerous covenant without feeding it endlessly.", [
    option("cinder-usurer", "Cinder Usurer", "Measure every spark of hellfire against fuel, heat, air, structure, escape, debt, residue, and the people who would bear its spread.", [
      warlockAction("warlock:audit-infernal-fire", "Audit Infernal Fire", "Trace an infernal burn through source, pact, fuel, heat, smoke, ward, victims, structure, residue, and unpaid consequence before attempting reuse or collection."),
      warlockPassive("warlock:cinder-usurer", "Cinder Usurer", "Infernal pactwork gains bounded precision against a documented covenant debt, but never stops being ward-respecting dangerous fire with real collateral."),
      proficiency("warlock:cinder-usurer"),
    ]),
    option("brimstone-vessel", "Brimstone Vessel", "Contain heat, fumes, pain, pressure, and patron influence within trained limits rather than treating suffering as unlimited fuel.", [
      warlockAction("warlock:prepare-brimstone-vessel", "Prepare a Brimstone Vessel", "Set health limits, cooling, ventilation, witnesses, release signs, emergency quenching, aftercare, and an abort condition before holding infernal power."),
      warlockPassive("warlock:brimstone-vessel", "Brimstone Vessel", "The Warlock contains bounded infernal backlash more reliably after preparation; this grants no immunity, extra Favor, free price, or protection to bystanders."),
      proficiency("warlock:brimstone-vessel"),
    ]),
  ], "warlock-demon-method", "hellfire-adept"),
  choice("warlock-contract-keeper-mastery", 50, "Contract Keeper Mastery", "Choose representation before infernal courts or relentless command of definitions and remedies within one valid agreement.", [
    option("infernal-advocate", "Infernal Advocate", "Represent a willing mortal, outsider, institution, or disputed soul before an infernal authority without pretending advocacy erases jurisdiction.", [
      warlockAction("warlock:prepare-infernal-case", "Prepare an Infernal Case", "Assemble parties, standing, terms, translations, precedent, evidence, witnesses, price, requested remedy, appeal, and protection against retaliation."),
      warlockPassive("warlock:infernal-advocate", "Infernal Advocate", "The Warlock negotiates recognized infernal procedure more effectively while every lie, omission, unauthorized promise, and missed deadline remains dangerous."),
      proficiency("warlock:infernal-advocate"),
    ]),
    option("clause-tyrant", "Clause Tyrant", "Control a pact's exact definitions, triggers, notices, priorities, exceptions, remedies, and end conditions without gaining authority outside it.", [
      warlockAction("warlock:master-clause-table", "Master a Clause Table", "Create a linked index of every defined term, duty, dependency, trigger, exception, remedy, conflict, expiry, and interpretation for a complex pact."),
      warlockPassive("warlock:clause-tyrant", "Clause Tyrant", "Devil's Due is harder to evade through a contradiction this Warlock has actually documented; it never compels unrelated obedience or proves guilt."),
      proficiency("warlock:clause-tyrant"),
    ]),
  ], "warlock-demon-method", "contract-keeper"),

  choice("warlock-witch-method", 30, "Witch Method", "Choose layered curse architecture through the Hexweaver or exact sympathetic connection through the Token Witch.", [
    option("hexweaver", "Hexweaver", "Layer trigger, symptom, duration, exception, warning, maintenance, and release into a narrow curse that remains diagnosable.", [
      ability("warlock-layered-hex"),
      warlockPassive("warlock:hexweaver", "Hexweaver", "Layered Hex commits two Pact Favor once for the entire action and builds none. Its bounded layers remain source-owned pact effects, not generic status spellcasting."),
      proficiency("warlock:hexweaver"),
    ]),
    option("token-witch", "Token Witch", "Work through a verified physical token's provenance and sympathetic relation rather than inventing contact from resemblance alone.", [
      ability("warlock-sympathetic-token"),
      warlockPassive("warlock:token-witch", "Token Witch", "Sympathetic Token commits two Pact Favor once and requires an eligible authentic connection. A fake, severed, contaminated, substituted, or unrelated token grants no universal reach."),
      proficiency("warlock:token-witch"),
    ]),
  ], "warlock-pact", "witch"),
  choice("warlock-hexweaver-mastery", 50, "Hexweaver Mastery", "Choose surgical diagnosis and alteration of curses or patterned malison built around one exact repeated condition.", [
    option("curse-surgeon", "Curse Surgeon", "Separate anchor, carrier, trigger, symptom, fuel, target, exception, maintenance, spread, and release before changing one layer.", [
      warlockAction("warlock:dissect-curse", "Dissect a Curse", "Map a curse with staged safe tests, ordinary care, samples, witness accounts, abort limits, and a plan to alter one verified component at a time."),
      warlockPassive("warlock:curse-surgeon", "Curse Surgeon", "The Warlock can adjust or unwind a known self-authored hex more precisely; foreign, concealed, stronger, or mixed curses remain dangerous and uncertain."),
      proficiency("warlock:curse-surgeon"),
    ]),
    option("pattern-hexer", "Pattern Hexer", "Tie a malison to one observable repeated choice or condition rather than vague fate, identity, bloodline, or moral judgment.", [
      warlockAction("warlock:define-hex-pattern", "Define a Hex Pattern", "Record the exact observable trigger, relevant actor, scope, evidence, notice, duration, exceptions, safe test, and release for a patterned hex."),
      warlockPassive("warlock:pattern-hexer", "Pattern Hexer", "Layered Hex responds more consistently to a declared witnessed pattern; ambiguous behaviour, coerced acts, mistaken identity, and missing observation do not qualify."),
      proficiency("warlock:pattern-hexer"),
    ]),
  ], "warlock-witch-method", "hexweaver"),
  choice("warlock-token-witch-mastery", 50, "Token Witch Mastery", "Choose exact representational models or household-scale custody of names, remedies, wards, memories, and sympathetic objects.", [
    option("poppet-keeper", "Poppet Keeper", "Build a declared representational figure whose materials, subject, purpose, permissions, limits, storage, and destruction remain traceable.", [
      warlockAction("warlock:prepare-poppet", "Prepare a Poppet", "Document every material and source, verify the sympathetic link, label intent and duration, secure consent where required, and plan safe unmaking."),
      warlockPassive("warlock:poppet-keeper", "Poppet Keeper", "Sympathetic pactwork better distinguishes several authenticated tokens; no crafted likeness creates a connection by appearance alone."),
      proficiency("warlock:poppet-keeper"),
    ]),
    option("hearth-reliquary", "Hearth Reliquary", "Keep the small dangerous objects, remedies, names, debts, blessings, griefs, and household bargains accumulated around one community.", [
      warlockAction("warlock:keep-hearth-reliquary", "Keep a Hearth Reliquary", "Catalogue owner, provenance, condition, use, contraindication, access, secrecy, renewal, release, burial, and destruction for each household token."),
      warlockPassive("warlock:hearth-reliquary", "Hearth Reliquary", "The Witch can preserve and retire local sympathetic links more safely; the collection grants no free remote access or authority over its subjects."),
      proficiency("warlock:hearth-reliquary"),
    ]),
  ], "warlock-witch-method", "token-witch"),

  choice("warlock-chainbinder-method", 30, "Chainbinder Method", "Choose direct linked restraint through the Fetterer or voluntary assumption and redistribution of pact burden through the Burden Bearer.", [
    option("fetterer", "Fetterer", "Bind movement or action through exact pact links, anchors, limits, custody, inspection, and release rather than conjured imprisonment.", [
      ability("warlock-binding-links"),
      warlockPassive("warlock:fetterer", "Fetterer", "Binding Links commits two Pact Favor once and creates bounded breakable movement pressure rather than hard restraint. Size, ward, valid target relation, range, duration, and release remain real."),
      proficiency("warlock:fetterer"),
    ]),
    option("burden-bearer", "Burden Bearer", "Accept a defined share of another willing party's pact burden without erasing, healing, or infinitely transferring it.", [
      ability("warlock-shared-burden"),
      warlockPassive("warlock:burden-bearer", "Burden Bearer", "Shared Burden commits two Pact Favor once and redistributes only its bounded authored burden. It cannot recurse, create immunity, transfer death, or become Paladin protection."),
      proficiency("warlock:burden-bearer"),
    ]),
  ], "warlock-pact", "chainbinder"),
  choice("warlock-fetterer-mastery", 50, "Fetterer Mastery", "Choose accountable containment of dangerous pact-bound beings or expert release from coercive and obsolete chains.", [
    option("iron-gaoler", "Iron Gaoler", "Combine pact links with real cells, wards, custody, welfare, inspection, records, authority, emergency response, and release review.", [
      warlockAction("warlock:design-pact-containment", "Design Pact Containment", "Map subject, danger, rights, anchors, material barriers, ward interaction, staff, supplies, visits, failure, evacuation, term, and release authority."),
      warlockPassive("warlock:iron-gaoler", "Iron Gaoler", "Prepared valid Binding Links are more stable within an accountable containment system; they grant no eternal prison or permission to bind an innocent target."),
      proficiency("warlock:iron-gaoler"),
    ]),
    option("chainbreaker-notary", "Chainbreaker Notary", "Identify the exact authority, payment, expiry, contradiction, coercion, lost purpose, or breached protection that permits a chain to be released.", [
      warlockAction("warlock:prepare-chain-release", "Prepare a Chain Release", "Trace each link's origin, holder, beneficiary, price, transfer, enforcement, breach, release condition, witnesses, and protection after severance."),
      warlockPassive("warlock:chainbreaker-notary", "Chainbreaker Notary", "The Warlock can release their own eligible bindings more cleanly and contest documented invalid links; another source's sound pact still requires authority or victory."),
      proficiency("warlock:chainbreaker-notary"),
    ]),
  ], "warlock-chainbinder-method", "fetterer"),
  choice("warlock-burden-bearer-mastery", 50, "Burden Bearer Mastery", "Choose personal surety under a bounded guarantee or fair distribution of necessary pact costs across willing informed participants.", [
    option("covenant-surety", "Covenant Surety", "Guarantee one named duty with a declared maximum price, evidence standard, claim process, expiry, collateral, and release.", [
      warlockAction("warlock:stand-covenant-surety", "Stand Covenant Surety", "Write what is guaranteed, for whom, to whom, under which proof, up to what ceiling, with what exclusions, assets, review, and end."),
      warlockPassive("warlock:covenant-surety", "Covenant Surety", "Shared Burden remains more reliable inside this Warlock's explicit guarantee, but never exceeds its authored cap or creates Favor from transferred harm."),
      proficiency("warlock:covenant-surety"),
    ]),
    option("burden-auditor", "Burden Auditor", "Expose who pays, who benefits, who may refuse, who cannot safely carry more, and which costs have been hidden as tradition.", [
      warlockAction("warlock:audit-shared-burden", "Audit a Shared Burden", "List every material, bodily, social, magical, and future cost, its bearer, consent, capacity, benefit, compensation, relief, and review."),
      warlockPassive("warlock:burden-auditor", "Burden Auditor", "The Warlock can divide an eligible willing burden more fairly before it is bound; unwilling or uninformed parties contribute nothing."),
      proficiency("warlock:burden-auditor"),
    ]),
  ], "warlock-chainbinder-method", "burden-bearer"),

  choice("warlock-whisper-method", 30, "Whisper Broker Method", "Choose leverage from a known protected secret through the Secretmonger or openly negotiated exchange through the Pact Merchant.", [
    option("secretmonger", "Secretmonger", "Use a fact actually known through source, confidence, observation, or pact deposit without mind-reading, fabricated evidence, or automatic compulsion.", [
      ability("warlock-secret-leverage"),
      warlockPassive("warlock:secretmonger", "Secretmonger", "Secret Leverage commits two Pact Favor once and needs an eligible relevant known secret. A guess, lie, inaccessible mind, unrelated confidence, or already-public fact gives no hidden-stat advantage."),
      proficiency("warlock:secretmonger"),
    ]),
    option("pact-merchant", "Pact Merchant", "Make price, benefit, duration, risk, collateral, witnesses, refusal, delivery, and remedy visible enough for a real choice.", [
      ability("warlock-open-bargain"),
      warlockPassive("warlock:pact-merchant", "Pact Merchant", "Open Bargain commits two Pact Favor once. It offers bounded reciprocal pact terms to an aware participant and never charms, dominates, changes allegiance, or treats refusal as breach."),
      proficiency("warlock:pact-merchant"),
    ]),
  ], "warlock-pact", "whisper-broker"),
  choice("warlock-secretmonger-mastery", 50, "Secretmonger Mastery", "Choose an institution built to hold dangerous confidences or mastery of the silence around something that must not be disclosed.", [
    option("confession-vault", "Confession Vault", "Receive, authenticate, compartmentalize, protect, review, lawfully disclose, return, or destroy sensitive testimony without making confession absolution.", [
      warlockAction("warlock:establish-confession-vault", "Establish a Confession Vault", "Set intake, consent, privilege limits, identity separation, corroboration, access, emergencies, retention, audit, witness protection, and destruction."),
      warlockPassive("warlock:confession-vault", "Confession Vault", "Known deposited secrets remain harder to steal or accidentally disclose, but the Warlock gains no truth sense, ownership of testimony, or power to silence its source."),
      proficiency("warlock:confession-vault"),
    ]),
    option("keeper-of-unsaid", "Keeper of the Unsaid", "Protect the space around grief, identity, negotiation, refuge, testimony, and dangerous knowledge without coercing silence.", [
      warlockAction("warlock:write-silence-protocol", "Write a Silence Protocol", "Define subject, participants, voluntary duties, exceptions, emergency disclosure, duration, secure communication, support, breach response, and release."),
      warlockPassive("warlock:keeper-of-unsaid", "Keeper of the Unsaid", "Whisper pactwork better preserves willing agreed confidentiality; witnesses, evidence, independent discovery, lawful duty, and chosen disclosure remain possible."),
      proficiency("warlock:keeper-of-unsaid"),
    ]),
  ], "warlock-whisper-method", "secretmonger"),
  choice("warlock-pact-merchant-mastery", 50, "Pact Merchant Mastery", "Choose exchange among many incompatible traditions or institution-scale brokerage of supernatural obligations and protections.", [
    option("crossroads-factor", "Crossroads Factor", "Translate gifts, taboos, measures, time, risk, names, hospitality, refusal, and honour among cultures and entities that price the same thing differently.", [
      warlockAction("warlock:open-crossroads-market", "Open a Crossroads Market", "Set neutral ground, entry, translation, accepted goods, prohibited prices, provenance, witnesses, dispute, security, departure, and treatment of bystanders."),
      warlockPassive("warlock:crossroads-factor", "Crossroads Factor", "Open Bargain can bridge verified cultural forms more reliably, but translation never becomes consent and incompatible terms still fail."),
      proficiency("warlock:crossroads-factor"),
    ]),
    option("grand-pact-broker", "Grand Pact Broker", "Coordinate layered agreements among communities, patrons, institutions, sanctuaries, suppliers, claimants, and future custodians.", [
      warlockAction("warlock:broker-grand-pact", "Broker a Grand Pact", "Map parties, authority, benefit, price, dependencies, third parties, delivery, records, enforcement, disputes, amendment, severance, audit, and succession."),
      warlockPassive("warlock:grand-pact-broker", "Grand Pact Broker", "The Warlock can keep several reciprocal terms legible within one negotiated structure; no participant is compelled and no hidden price becomes valid."),
      proficiency("warlock:grand-pact-broker"),
    ]),
  ], "warlock-whisper-method", "pact-merchant"),
]);

const druidAbility = (id, authoredSeason) => progressionGrant("ability", id, { authoredSeason, nativeDruidAction: true });
const druidAction = (id, name, description, details = {}) => progressionGrant("action", id, { name, description, noncombatBenefit: true, ...details });
const druidPassive = (id, name, description, details = {}) => progressionGrant("passive", id, { name, description, noncombatBenefit: true, ...details });

const DRUID_BRANCHES = Object.freeze([
  choice("druid-circle", 10, "Primal Circle", "Choose the living relationship that directs this Druid's native seasonal spellwork. Every circle retains the independent Spring-to-Winter cycle and remains distinct from Ranger fieldcraft, summoned companions, arcane study, divine prayer, and pacts.", [
    option("circle-of-root", "Circle of Root", "Deepen growth, soil, root networks, shelter, and terrain stewardship through living land rather than conjured structures.", [
      druidAbility("druid-grove-awakening", "spring"),
      druidPassive("druid:circle-of-root", "Circle of Root", "Grove Awakening is a Spring-authored native action. Its growth requires suitable living material or ground, remains bounded by space and habitat, and leaves real growth to steward."),
      proficiency("druid:circle-of-root"),
    ]),
    option("circle-of-fang", "Circle of Fang", "Transform the Druid's own coherent body into practiced animal forms; no creature is summoned, created, replaced, or commanded.", [
      druidAbility("druid-predator-shape", "summer"),
      druidPassive("druid:circle-of-fang", "Circle of Fang", "Predator Shape is a Summer-authored self-transformation into a practiced living anatomy. It never summons a pet, possesses an animal, shares senses, or grants another profession's abilities."),
      proficiency("druid:circle-of-fang"),
    ]),
    option("circle-of-sky", "Circle of Sky", "Work through existing air, pressure, cloud, sunlight, rain, wind, and electrical charge while respecting actual weather and shelter.", [
      druidAbility("druid-gale-shear", "winter"),
      druidPassive("druid:circle-of-sky", "Circle of Sky", "Gale Shear is a Winter-authored native action whose force, reach, and consequences remain shaped by air, exposure, terrain, mass, and cover."),
      proficiency("druid:circle-of-sky"),
    ]),
    option("circle-of-cycle", "Circle of Cycle", "Guide decay, dormancy, carrion, fungi, nutrient return, and reclamation without confusing renewal with harmlessness.", [
      druidAbility("druid-decay-mark", "autumn"),
      druidPassive("druid:circle-of-cycle", "Circle of Cycle", "Decay Mark is an Autumn-authored source-owned primal effect. It accelerates bounded decline but does not create disease, command undead, steal souls, or become Warlock or necromantic spellwork."),
      proficiency("druid:circle-of-cycle"),
    ]),
  ]),

  choice("druid-root-method", 30, "Root Circle Method", "Choose flourishing living growth through the Grovekeeper or durable bark-and-terrain stewardship through the Heartwood Sage.", [
    option("grovekeeper", "Grovekeeper", "Cultivate thicket, canopy, refuge, food, water, and habitat as a living community whose growth must remain accountable.", [
      druidAbility("druid-entangling-thicket", "spring"),
      druidPassive("druid:grovekeeper", "Grovekeeper", "Entangling Thicket is a Spring-authored native action that needs suitable ground or vegetation and creates bounded living obstruction rather than an inescapable conjured prison."),
      proficiency("druid:grovekeeper"),
    ]),
    option("heartwood-sage", "Heartwood Sage", "Work through bark, wood fibre, roots, soil pressure, slope, and patient living structure to hold people and land together.", [
      druidAbility("druid-ironbark-rise", "winter"),
      druidPassive("druid:heartwood-sage", "Heartwood Sage", "Ironbark Rise is a Winter-authored native action whose protection is bounded, physical enough to burn or break, and dependent on actual living wood or established roots."),
      proficiency("druid:heartwood-sage"),
    ]),
  ], "druid-circle", "circle-of-root"),
  choice("druid-grovekeeper-mastery", 50, "Grovekeeper Mastery", "Choose a vast succession-minded grove or a refuge shaped around the needs and limits of those who dwell there.", [
    option("worldtree-gardener", "Worldtree Gardener", "Guide a many-generational grove whose roots, canopy, seed, water, deadwood, wildlife, harvest, and human memory form one changing whole.", [
      druidAction("druid:found-great-grove", "Found a Great Grove", "Map succession, soils, water, seed sources, access, protected habitat, livelihood, disaster, stewardship rights, and century-scale replacement for a great grove."),
      druidPassive("druid:worldtree-gardener", "Worldtree Gardener", "Root-circle growth better supports a prepared diverse grove, but no single tree becomes invulnerable, omniscient, or a supernatural transport network."),
      proficiency("druid:worldtree-gardener"),
    ]),
    option("sanctuary-grovekeeper", "Sanctuary Grovekeeper", "Shape a living refuge around shelter, food, water, medicine, privacy, wildlife, waste, access, and consent.", [
      druidAction("druid:design-sanctuary-grove", "Design a Sanctuary Grove", "Set capacity, paths, protected zones, gathering rules, fire and storm plans, water, food, care, animal boundaries, and review for a real living refuge."),
      druidPassive("druid:sanctuary-grovekeeper", "Sanctuary Grovekeeper", "Prepared grove effects provide stronger bounded cover and recovery support; they do not compel peace, conceal wrongdoing, or make inhabitants immune."),
      proficiency("druid:sanctuary-grovekeeper"),
    ]),
  ], "druid-root-method", "grovekeeper"),
  choice("druid-heartwood-sage-mastery", 50, "Heartwood Sage Mastery", "Choose rooted routes through difficult country or stewardship of soil, slope, water, and woody structure across a watershed.", [
    option("rootway-architect", "Rootway Architect", "Guide living roots around paths, steps, banks, bridges, buildings, water, and fragile habitat without pretending growth ignores time or load.", [
      druidAction("druid:design-rootway", "Design a Rootway", "Survey soil, grade, load, drainage, access, utilities, tree health, growth clearance, repair, and safe closure for a route supported by living roots."),
      druidPassive("druid:rootway-architect", "Rootway Architect", "Prepared roots can shape firmer bounded terrain while sound stone, severed growth, fire, impossible loads, and unsuitable ground still defeat them."),
      proficiency("druid:rootway-architect"),
    ]),
    option("watershed-keeper", "Watershed Keeper", "Hold upland forest, slope, spring, stream, wetland, field, settlement, and floodplain in one long stewardship.", [
      druidAction("druid:steward-watershed", "Steward a Watershed", "Coordinate flow, erosion, tree cover, habitat, use, waste, flood, drought, access, labour, law, and downstream review across a named drainage."),
      druidPassive("druid:watershed-keeper", "Watershed Keeper", "Heartwood effects better brace surveyed living banks and slopes; they do not create water, stop every flood, or replace engineering."),
      proficiency("druid:watershed-keeper"),
    ]),
  ], "druid-root-method", "heartwood-sage"),

  choice("druid-fang-method", 30, "Fang Circle Method", "Choose a lean pursuit form through the Prowler or a massive protective form through the Greatbeast. Both transform only this Druid's own body.", [
    option("prowler", "Prowler", "Adopt a practiced wolf-like anatomy for scent, pursuit, coordinated footing, controlled bite, endurance, and reading pack distance.", [
      druidAbility("druid-wolf-aspect", "autumn"),
      druidPassive("druid:prowler", "Prowler", "Wolf Aspect is an Autumn-authored self-form. It grants no telepathy, summoned pack, Ranger quarry mechanic, or automatic control of actual wolves."),
      proficiency("druid:prowler"),
    ]),
    option("greatbeast", "Greatbeast", "Adopt a practiced bear-like anatomy for mass, leverage, protective reach, scent, digging, and enduring direct pressure.", [
      druidAbility("druid-bear-aspect", "winter"),
      druidPassive("druid:greatbeast", "Greatbeast", "Bear Aspect is a Winter-authored self-form limited by real space, footing, mass, duration, and practiced return. It summons nothing and does not grant Barbarian Fury."),
      proficiency("druid:greatbeast"),
    ]),
  ], "druid-circle", "circle-of-fang"),
  choice("druid-prowler-mastery", 50, "Prowler Mastery", "Choose a deep library of ecological pursuit forms or perfect control of one quiet, low-impact passage through inhabited wild land.", [
    option("thousand-pelt-stalker", "Thousand-Pelt Stalker", "Study many real predator anatomies without collapsing their different senses, gaits, habitats, diets, and limits into one imaginary apex beast.", [
      druidAction("druid:catalog-practiced-forms", "Catalog Practiced Forms", "Record each self-form's anatomy, habitat, movement, senses, food, duration, safe space, injuries, return conditions, and mistakes before using it again."),
      druidPassive("druid:thousand-pelt-stalker", "Thousand-Pelt Stalker", "The Druid can prepare a wider set of coherent self-forms, but each remains learned separately and never grants every animal trait at once."),
      proficiency("druid:thousand-pelt-stalker"),
    ]),
    option("silent-passage", "Keeper of Silent Passage", "Move through breeding ground, den country, migration, settlement edge, and contested habitat with minimal panic and trace.", [
      druidAction("druid:plan-silent-passage", "Plan a Silent Passage", "Choose timing, wind, scent, cover, distance, no-go areas, group behaviour, waste, emergency retreat, and later sign checks for a low-disturbance route."),
      druidPassive("druid:silent-passage", "Silent Passage", "A practiced Prowler form disturbs ordinary wildlife less when the route and wind were studied; alert animals, poor cover, close approach, and active pursuit remain decisive."),
      proficiency("druid:silent-passage"),
    ]),
  ], "druid-fang-method", "prowler"),
  choice("druid-greatbeast-mastery", 50, "Greatbeast Mastery", "Choose supreme load-bearing anatomy or a remembered library of great animals adapted to different lands.", [
    option("colossus-hide", "Colossus Hide", "Coordinate hide, fat, fur, muscle, bone, breath, stance, heat, and recovery into one stable great form rather than raw size alone.", [
      druidAction("druid:prepare-colossus-form", "Prepare a Colossus Form", "Inspect space, load-bearing ground, exits, heat, food, witnesses, equipment, injury risks, duration, and safe return before a massive transformation."),
      druidPassive("druid:colossus-hide", "Colossus Hide", "Greatbeast form tolerates stronger bounded physical pressure but remains vulnerable to sufficient harm, unsuitable climate, constrained space, exhaustion, and failed footing."),
      proficiency("druid:colossus-hide"),
    ]),
    option("elder-form", "Elder Form", "Reconstruct the body plans of known great animals from bone, track, art, habitat, oral record, and living relatives without inventing impossible hybrids.", [
      druidAction("druid:reconstruct-elder-form", "Reconstruct an Elder Form", "Compare reliable anatomical and ecological evidence, mark uncertainty, model movement and diet, and test partial changes before attempting the complete self-form."),
      druidPassive("druid:elder-form", "Elder Form", "The Druid may learn coherent extinct or rare greatbeast forms supported by evidence; missing anatomy, unsuitable climate, and incomplete practice impose real limits."),
      proficiency("druid:elder-form"),
    ]),
  ], "druid-fang-method", "greatbeast"),

  choice("druid-sky-method", 30, "Sky Circle Method", "Choose charged storm through the Stormcaller or sunlight, heat, and seasonal clarity through the Sunkeeper.", [
    option("stormcaller", "Stormcaller", "Shape pressure, wind, rain, and existing electrical charge into bounded stormwork rather than making weather ignore the sky.", [
      druidAbility("druid-stormbolt", "summer"),
      druidPassive("druid:stormcaller", "Stormcaller", "Stormbolt is a Summer-authored native action requiring a viable charged atmosphere; shelter, grounding, distance, weather, and magical wards remain relevant."),
      proficiency("druid:stormcaller"),
    ]),
    option("sunkeeper", "Sunkeeper", "Concentrate sunlight, radiant heat, glare, thermal movement, and the measured turning between solstices.", [
      druidAbility("druid-sunwheel", "summer"),
      druidPassive("druid:sunkeeper", "Sunkeeper", "Sunwheel is a Summer-authored native action dependent on real sky light or stored seasonal preparation; it is primal sunlight, not Cleric radiance or conjured flame."),
      proficiency("druid:sunkeeper"),
    ]),
  ], "druid-circle", "circle-of-sky"),
  choice("druid-stormcaller-mastery", 50, "Stormcaller Mastery", "Choose stewardship of dangerous regional weather or exact work through the charged instant inside a storm.", [
    option("tempest-shepherd", "Tempest Shepherd", "Guide warning, shelter, water, windbreak, lightning, flood, harvest, travel, and recovery around an approaching storm rather than claiming ownership of it.", [
      druidAction("druid:shepherd-tempest", "Shepherd a Tempest", "Build a regional storm plan from observations, routes, settlements, vulnerable people, animals, stores, waters, communications, refuge, and changing forecasts."),
      druidPassive("druid:tempest-shepherd", "Tempest Shepherd", "Prepared Sky effects can redirect bounded wind and rain within a real storm; they cannot erase a tempest, guarantee safety, or move consequence onto unseen neighbours."),
      proficiency("druid:tempest-shepherd"),
    ]),
    option("thunderhead-oracle", "Thunderhead Reader", "Read charge, pressure, cloud growth, outflow, rain shaft, hail, lightning interval, and terrain quickly enough to act without calling weather prophecy.", [
      druidAction("druid:read-thunderhead", "Read a Thunderhead", "Estimate movement, arrival, exposed zones, lightning risk, flood or hail potential, shelter, uncertainty, and the observation that would change the warning."),
      druidPassive("druid:thunderhead-reader", "Thunderhead Reader", "Stormcaller actions gain bounded precision in a weather system this Druid has actually observed; concealed skies and sudden change still defeat prediction."),
      proficiency("druid:thunderhead-reader"),
    ]),
  ], "druid-sky-method", "stormcaller"),
  choice("druid-sunkeeper-mastery", 50, "Sunkeeper Mastery", "Choose the great seasonal measure of solstice or a living canopy that balances light, heat, shade, water, and work.", [
    option("solstice-herald", "Solstice Herald", "Anchor calendars, journeys, planting, preservation, gatherings, and shared obligations to observed solar turning rather than decree.", [
      druidAction("druid:establish-solstice-calendar", "Establish a Solstice Calendar", "Coordinate horizon observations, records, local seasonal signs, public correction, work, rest, storage, and ritual around the measured year."),
      druidPassive("druid:solstice-herald", "Solstice Herald", "Sunkeeper actions retain stronger bounded seasonal preparation near a properly observed solar turning; cloud, latitude, shelter, and changing climate still matter."),
      proficiency("druid:solstice-herald"),
    ]),
    option("dawn-canopy", "Dawn Canopy", "Shape tree, vine, cloth, orientation, airflow, reflective surface, water, and schedule into humane light and shade.", [
      druidAction("druid:design-dawn-canopy", "Design a Dawn Canopy", "Map daily and seasonal sun, heat load, wind, use, access, plant growth, water, maintenance, fire, and visibility for a living shade system."),
      druidPassive("druid:dawn-canopy", "Dawn Canopy", "Sunwheel and canopy work can distribute bounded light and heat around prepared living cover; they do not create permanent daylight or ignore fire risk."),
      proficiency("druid:dawn-canopy"),
    ]),
  ], "druid-sky-method", "sunkeeper"),

  choice("druid-cycle-method", 30, "Cycle Circle Method", "Choose precise decay and contamination reading through the Rotwarden or safe return of spent life and material through the Reclaimer.", [
    option("rotwarden", "Rotwarden", "Bound rot, mould, disease risk, carrion, spoiled stores, contaminated ground, and necessary decay through observation and containment.", [
      druidAbility("druid-moldering-wave", "autumn"),
      druidPassive("druid:rotwarden", "Rotwarden", "Moldering Wave is an Autumn-authored native action that accelerates existing organic breakdown within strict bounds. It neither creates plague nor affects sound inorganic material by declaration."),
      proficiency("druid:rotwarden"),
    ]),
    option("reclaimer", "Reclaimer", "Return dead growth, waste, ash, carrion, broken habitat, and exhausted soil to safe use without hiding contamination or grief.", [
      druidAbility("druid-reclamation-bloom", "spring"),
      druidPassive("druid:reclaimer", "Reclaimer", "Reclamation Bloom is a Spring-authored native action that converts eligible spent organic residue into bounded new growth. It does not resurrect, erase toxic material, or create mass from nothing."),
      proficiency("druid:reclaimer"),
    ]),
  ], "druid-circle", "circle-of-cycle"),
  choice("druid-rotwarden-mastery", 50, "Rotwarden Mastery", "Choose exact diagnosis of ecological blight or mastery of fungi as decomposer, partner, food, medicine, hazard, and living material.", [
    option("blight-reader", "Blight Reader", "Separate drought, nutrient stress, insect damage, fungus, poison, salt, smoke, crowding, introduced life, and primal corruption before intervening.", [
      druidAction("druid:diagnose-blight", "Diagnose a Blight", "Map pattern, host, timing, vector, soil, water, weather, handling, sample evidence, uncertainty, containment, and specialist needs for a real outbreak."),
      druidPassive("druid:blight-reader", "Blight Reader", "Rotwarden effects can target verified active decay more precisely; an unknown cause, mixed infection, protected host, or bad sample remains uncertain."),
      proficiency("druid:blight-reader"),
    ]),
    option("ashen-mycologist", "Ashen Mycologist", "Guide fungi through burned, poisoned, dead, or exhausted material while respecting host, spore, worker, food, and ecosystem safety.", [
      druidAction("druid:cultivate-reclamation-fungi", "Cultivate Reclamation Fungi", "Choose verified species, substrate, containment, moisture, air, temperature, harvest, disposal, monitoring, and abort conditions for a fungal work."),
      druidPassive("druid:ashen-mycologist", "Ashen Mycologist", "Moldering effects better process prepared eligible organic material; they cannot make unknown fungi safe or neutralize every mineral and magical toxin."),
      proficiency("druid:ashen-mycologist"),
    ]),
  ], "druid-cycle-method", "rotwarden"),
  choice("druid-reclaimer-mastery", 50, "Reclaimer Mastery", "Choose renewal through the complete material economy of carrion or through patient ecological succession after devastation.", [
    option("carrion-gardener", "Carrion Gardener", "Return a dead body to scavenger, soil, plant, record, ritual, and living community without treating death as disposable matter.", [
      druidAction("druid:steward-carrion-return", "Steward Carrion Return", "Confirm identity and authority, record remains, assess disease and poison, respect rites, protect water, choose exposure or burial, and monitor scavenger and soil."),
      druidPassive("druid:carrion-gardener", "Carrion Gardener", "Reclamation work gains bounded yield from safe known carrion; it never consumes living beings, hides evidence, violates custody, or restores the dead."),
      proficiency("druid:carrion-gardener"),
    ]),
    option("renewal-keeper", "Renewal Keeper", "Carry damaged land from immediate safety through pioneer life, soil, water, habitat, livelihood, memory, and self-sustaining succession.", [
      druidAction("druid:lead-great-reclamation", "Lead a Great Reclamation", "Establish phases, evidence, contamination limits, species, labour, rights, livelihood, success measures, disaster response, correction, and succession for long recovery."),
      druidPassive("druid:renewal-keeper", "Renewal Keeper", "Reclamation Bloom better establishes prepared succession on suitable cleared ground; mature ecology still requires time, diversity, weather, stewardship, and freedom from renewed harm."),
      proficiency("druid:renewal-keeper"),
    ]),
  ], "druid-cycle-method", "reclaimer"),
]);

const PALADIN_BRANCHES = Object.freeze([
  choice("paladin-oath", 10, "Paladin Oath", "Choose the witnessed oath that directs this Paladin's native protection and public duty. Each remains oathcraft rather than spellcasting, Cleric prayer, healing, smite, or Warrior technique.", [
    option("shield-oath", "Shield Oath", "Stand between danger and the protected through reachable guard lines, sound equipment, shared risk, and accountable physical defence.", [
      ability("paladin-shield-covenant"),
      passive("paladin:shield-oath", "Shield Oath", "Shield Covenant is a neutral physical guard commitment that creates no Conviction; only real harm intercepted through Oathguard or absorbed through Stand Fast earns the resource."),
      proficiency("paladin:shield-oath"),
    ]),
    option("truth-oath", "Truth Oath", "Put witnessed conduct, contradiction, evidence, answer, and judgment into public view without supernatural truth-reading or compelled confession.", [
      ability("paladin-call-to-account"),
      passive("paladin:truth-oath", "Truth Oath", "Call to Account creates bounded source-owned pressure from witnessed contradiction; it proves no guilt, compels no answer, and builds no Conviction."),
      proficiency("paladin:truth-oath"),
    ]),
    option("mercy-oath", "Mercy Oath", "Create credible paths to surrender, custody, restitution, rescue, release, and reintegration while leaving choice and consequence intact.", [
      ability("paladin-offer-quarter"),
      passive("paladin:mercy-oath", "Mercy Oath", "Offer Quarter is a neutral credible offer to an aware foe, never charm, allegiance change, healing, immunity, or unearned Conviction."),
      proficiency("paladin:mercy-oath"),
    ]),
    option("beacon-oath", "Beacon Oath", "Become a visible, reliable point of orientation for willing companions, refugees, pilgrims, watches, and threatened communities.", [
      ability("paladin-beacon-stance"),
      passive("paladin:beacon-oath", "Beacon Oath", "Beacon Stance uses visible presence and understood signals for bounded morale and orientation; it creates no magical light, healing, compulsion, or Conviction."),
      proficiency("paladin:beacon-oath"),
    ]),
  ]),

  choice("paladin-shield-method", 30, "Shield Oath Office", "Choose protection through exchanged guard positions or authority over a real threshold. Both spend earned Conviction once on commitment and never erase all harm.", [
    option("shieldbearer", "Shieldbearer", "Exchange reachable positions and burdens so a protected line bends around danger without pretending damage disappears.", [
      ability("paladin-rampart-exchange"),
      passive("paladin:rampart-exchange", "Rampart Exchange", "Rampart Exchange commits two Conviction once, requires a shield or guarding weapon and a reachable interception line, and redistributes bounded harm rather than healing it."),
      proficiency("paladin:shieldbearer"),
    ]),
    option("gatekeeper", "Gatekeeper", "Hold doors, bridges, corridors, stairs, breaches, and lawful entries through footing, reach, judgment, and controlled passage.", [
      ability("paladin-threshold-blow"),
      passive("paladin:threshold-blow", "Threshold Blow", "Threshold Blow commits one Conviction once at a real melee threshold; any push remains a bounded physical check against mass, footing, size, and resistance."),
      proficiency("paladin:gatekeeper"),
    ]),
  ], "paladin-oath", "shield-oath"),
  choice("paladin-shieldbearer-apex", 50, "Shieldbearer Apex", "Choose the Paladin as a singular sheltering presence or a teacher of accountable shared defence.", [
    option("living-rampart", "Living Rampart", "Place body, shield, footing, exits, and relief so the protected know exactly where safety begins and what it costs the bearer.", [
      action("paladin:survey-living-rampart", "Survey a Living Rampart", "Mark the real approach lanes, cover, evacuation space, load, relief position, failure point, and protected people before taking guard."),
      passive("paladin:living-rampart", "Living Rampart", "Shieldbearer oathcraft remains effective under heavier bounded pressure when the real guard line was prepared; it grants neither invulnerability nor automatic interception."),
      proficiency("paladin:living-rampart"),
    ]),
    option("brotherhood-wall", "Brotherhood Wall", "Teach willing protectors to overlap shields, responsibilities, warnings, relief, and accountability without borrowing Warrior formations.", [
      action("paladin:drill-brotherhood-wall", "Drill a Brotherhood Wall", "Rehearse spacing, protected lanes, handoffs, withdrawal, casualty passage, relief, and stop signals with willing equipped protectors."),
      passive("paladin:brotherhood-wall", "Brotherhood Wall", "Prepared allies cooperate more reliably around the Paladin's guard commitment while retaining their own agency and profession resources."),
      proficiency("paladin:brotherhood-wall"),
    ]),
  ], "paladin-shield-method", "shieldbearer"),
  choice("paladin-gatekeeper-apex", 50, "Gatekeeper Apex", "Choose exact control of daily passage or steadfast stewardship of a threatened settlement threshold.", [
    option("threshold-sentinel", "Threshold Sentinel", "Know who may cross, who decides, how challenge works, where people wait, and how emergency access overrides ordinary routine.", [
      action("paladin:establish-threshold-protocol", "Establish a Threshold Protocol", "Document lawful entry, accessible challenge, records, search limits, protected exceptions, emergency passage, and review for one real threshold."),
      passive("paladin:threshold-sentinel", "Threshold Sentinel", "At a surveyed threshold, Gatekeeper oathcraft better preserves controlled passage; sealed space, impossible reach, and superior mass still constrain it."),
      proficiency("paladin:threshold-sentinel"),
    ]),
    option("siege-saint", "Siege Saint", "Keep a gate humane and functional through exhaustion, rationing, fear, damaged works, civilian movement, and negotiations under siege.", [
      action("paladin:steward-siege-gate", "Steward a Siege Gate", "Coordinate repairs, reliefs, water, fire response, evacuation lanes, prisoner passage, parley, records, and surrender contingencies at a threatened gate."),
      passive("paladin:siege-saint", "Siege Saint", "The Paladin sustains accountable threshold duty through prolonged hardship but grants no food, healing, repair, immunity, or victory by declaration."),
      proficiency("paladin:siege-saint"),
    ]),
  ], "paladin-shield-method", "gatekeeper"),

  choice("paladin-truth-method", 30, "Truth Oath Office", "Choose a weapon judgment tied to this Paladin's own public accounting or a voluntary command intended to halt immediate violence.", [
    option("inquisitor", "Inquisitor", "Pursue contradiction through witnessed claims, evidence, direct answer, and one measured physical verdict rather than magical certainty.", [
      ability("paladin-verdict-edge"),
      passive("paladin:verdict-edge", "Verdict Edge", "Verdict Edge commits two Conviction once and gains its bounded pressure only from this same Paladin's active Call to Account; another source's mark never qualifies."),
      proficiency("paladin:inquisitor"),
    ]),
    option("magistrate", "Magistrate", "Use clear authority, intelligible terms, proportionate restraint, witness, and review to create a voluntary pause before more harm.", [
      ability("paladin-peace-command"),
      passive("paladin:peace-command", "Peace Command", "Peace Command commits one Conviction once and offers only soft halt pressure to an aware foe who can hear and understand; it cannot compel peace."),
      proficiency("paladin:magistrate"),
    ]),
  ], "paladin-oath", "truth-oath"),
  choice("paladin-inquisitor-apex", 50, "Inquisitor Apex", "Choose candid public exposure or rigorous pursuit of a contradiction without supernatural truth detection.", [
    option("candid-flame", "Candid Flame", "Make the oathfire of office a visible promise that the Paladin's own questions, evidence, and conduct can be examined as closely as the accused.", [
      action("paladin:open-candid-inquiry", "Open a Candid Inquiry", "Publish the precise question, evidence standard, authority, conflicts, witness protections, response, record, and review before proceeding."),
      passive("paladin:candid-flame", "Candid Flame", "Visible oathfire signals declared accountability but never reveals truth, guilt, motive, identity, or divine approval."),
      proficiency("paladin:candid-flame"),
    ]),
    option("falsehood-scourge", "Falsehood Scourge", "Find the seam between statement, record, physical fact, incentive, opportunity, and later revision without treating discomfort as guilt.", [
      action("paladin:map-contradiction", "Map a Contradiction", "Lay two incompatible claims beside their sources, dates, evidence, alternatives, and the exact additional fact needed to resolve them."),
      passive("paladin:falsehood-scourge", "Falsehood Scourge", "Inquisitor oathcraft gains stronger bounded pressure from a demonstrated contradiction, never from silence, unfamiliar custom, fear, or the Paladin's suspicion alone."),
      proficiency("paladin:falsehood-scourge"),
    ]),
  ], "paladin-truth-method", "inquisitor"),
  choice("paladin-magistrate-apex", 50, "Magistrate Apex", "Choose durable networks of sworn public office or mastery of voluntary de-escalation and accountable custody.", [
    option("crown-of-oaths", "Crown of Oaths", "Coordinate many limited offices whose authority, succession, records, conflicts, and correction remain visible to those they govern.", [
      action("paladin:charter-crown-of-oaths", "Charter a Crown of Oaths", "Define each office's duty, boundary, appointment, resources, records, oversight, removal, succession, and public complaint route."),
      passive("paladin:crown-of-oaths", "Crown of Oaths", "The Paladin can reconcile overlapping sworn duties more reliably, but title never grants automatic obedience, truth, competence, or legitimacy."),
      proficiency("paladin:crown-of-oaths"),
    ]),
    option("peacekeeper", "Peacekeeper", "Build pauses, safe separation, surrender terms, neutral custody, and review that let people stop without pretending the underlying wrong vanished.", [
      action("paladin:prepare-peacekeeping-order", "Prepare a Peacekeeping Order", "Set authority, protected zones, disarmament terms, monitors, custody, aid, complaint, escalation, review, and exit for a willing temporary peace."),
      passive("paladin:peacekeeper", "Peacekeeper", "Magistrate pressure is more credible when backed by feasible safe terms; unwilling, unaware, or unreachable actors remain free to refuse."),
      proficiency("paladin:peacekeeper"),
    ]),
  ], "paladin-truth-method", "magistrate"),

  choice("paladin-mercy-method", 30, "Mercy Oath Office", "Choose intercession that preserves another's chance to recover courage or the deliberate bearing of harm already redirected through protection.", [
    option("redeemer", "Redeemer", "Step into danger while offering a willing ally or opponent a credible path back to chosen conduct, without erasing consequence.", [
      ability("paladin-redeeming-intercession"),
      passive("paladin:redeeming-intercession", "Redeeming Intercession", "Redeeming Intercession commits two Conviction once, requires a reachable guard line, intercepts bounded harm, and steadies ordinary fear without restoring health."),
      proficiency("paladin:redeemer"),
    ]),
    option("martyr", "Martyr", "Prepare body and will to bear part of harm already taken through a real protective line rather than seeking injury for its own sake.", [
      ability("paladin-burden-taken"),
      passive("paladin:burden-taken", "Burden Taken", "Burden Taken commits one Conviction once and reduces only a bounded portion of damage already redirected from an ally; direct or self-made harm gains nothing."),
      proficiency("paladin:martyr"),
    ]),
  ], "paladin-oath", "mercy-oath"),
  choice("paladin-redeemer-apex", 50, "Redeemer Apex", "Choose a protected route back into community or the dismantling of coercive bondage with material support.", [
    option("open-hand", "Open Hand", "Offer surrender, confession, restitution, supervision, work, learning, and reintegration under terms that protect those previously harmed.", [
      action("paladin:prepare-open-hand-accord", "Prepare an Open-Hand Accord", "Draft voluntary bounded terms for safety, accountability, restitution, support, review, breach, and release with affected people represented."),
      passive("paladin:open-hand", "Open Hand", "Mercy offers become more credible when the Paladin has real authority and resources to honour them; no one is compelled to accept or forgive."),
      proficiency("paladin:open-hand"),
    ]),
    option("chainbreaker", "Chainbreaker", "Free people from unlawful bondage through evidence, authority, shelter, transport, livelihood, defence, and protection against recapture.", [
      action("paladin:organize-chainbreaking", "Organize Chainbreaking", "Plan identification, lawful or protective authority, safe release, immediate needs, records, family, travel, work, security, and long-term advocacy."),
      passive("paladin:chainbreaker", "Chainbreaker", "The Paladin recognizes practical structures of coercion and release but cannot dissolve a contract, geas, chain, prison, dependency, or political power by title alone."),
      proficiency("paladin:chainbreaker"),
    ]),
  ], "paladin-mercy-method", "redeemer"),
  choice("paladin-martyr-apex", 50, "Martyr Apex", "Choose sustainable distribution of terrible duties or the last accountable intercession when every ordinary protector has fallen away.", [
    option("burden-bearer", "Burden Bearer", "Carry grief, risk, labour, witness, and responsibility without hoarding them as proof of personal purity or denying necessary relief.", [
      action("paladin:share-sworn-burdens", "Share Sworn Burdens", "List the duty, actual load, capable volunteers, rest, support, succession, warning signs, and limits before accepting or redistributing it."),
      passive("paladin:burden-bearer", "Burden Bearer", "Martyr oathcraft better preserves function under redirected harm when relief and care were prepared; it never rewards self-injury or neglect."),
      proficiency("paladin:burden-bearer"),
    ]),
    option("last-intercessor", "Last Intercessor", "Remain the named protector for an urgent bounded duty until a safe handoff, release, or honest failure can be witnessed.", [
      action("paladin:prepare-last-intercession", "Prepare a Last Intercession", "Name the protected people, threat, position, signal, extraction, successor, records, and point beyond which staying would no longer serve them."),
      passive("paladin:last-intercessor", "Last Intercessor", "The Paladin sustains one declared emergency duty under severe pressure but gains no immortality, revival, healing, immunity, or unlimited interception."),
      proficiency("paladin:last-intercessor"),
    ]),
  ], "paladin-mercy-method", "martyr"),

  choice("paladin-beacon-method", 30, "Beacon Oath Office", "Choose a visible oathfire weapon against profane danger or a guarded travelling covenant for companions on a real road.", [
    option("dawnblade", "Dawnblade", "Carry fulfilled Conviction through a physical blade as bounded oathfire against profane foes alone, with armour and ward still meaningful.", [
      ability("paladin-sunward-cut"),
      passive("paladin:sunward-cut", "Sunward Cut", "Sunward Cut commits two Conviction once before an armour-respecting physical cut; only a profane target can receive its bounded radiant rider, and ward still applies."),
      proficiency("paladin:dawnblade"),
    ]),
    option("roadwarden", "Roadwarden", "Guard willing travellers through formation, route knowledge, visible assurance, fear discipline, and a reachable interception line.", [
      ability("paladin-pilgrim-aegis"),
      passive("paladin:pilgrim-aegis", "Pilgrim Aegis", "Pilgrim Aegis commits two Conviction once and provides bounded interception, steadiness, and forced-movement resistance without healing, immunity, conjured shelter, or teleportation."),
      proficiency("paladin:roadwarden"),
    ]),
  ], "paladin-oath", "beacon-oath"),
  choice("paladin-dawnblade-apex", 50, "Dawnblade Apex", "Choose exact stewardship of the visible oathfire edge or the courage to make hostile darkness navigable without magical daylight.", [
    option("suns-edge", "Sun's Edge", "Keep oathfire bounded to declared profane danger, ward-respecting radiant force, accountable weapon use, and immediate sheathing when the condition ends.", [
      action("paladin:declare-suns-edge", "Declare the Sun's Edge", "Name the witnessed profane threat, protected people, intended boundary, responsible bearer, and condition for ending the oathfire display."),
      passive("paladin:suns-edge", "Sun's Edge", "Dawnblade oathfire is more controlled against a verified profane target but never becomes daylight, generic magic damage, a smite, true damage, or proof of guilt."),
      proficiency("paladin:suns-edge"),
    ]),
    option("nightbreaker", "Nightbreaker", "Make fear, confusion, lost routes, silence, and unseen hazards manageable through visible presence, signals, scouts, light sources, and planned refuge.", [
      action("paladin:prepare-nightbreaking-watch", "Prepare a Nightbreaking Watch", "Set mundane lights, signals, sectors, escorts, refuge, missing-person response, relief, and dawn handoff for a dangerous night."),
      passive("paladin:nightbreaker", "Nightbreaker", "Beacon and Dawnblade presence better steadies willing people in darkness, but reveals no hidden creature, dispels no magic, and creates no supernatural light."),
      proficiency("paladin:nightbreaker"),
    ]),
  ], "paladin-beacon-method", "dawnblade"),
  choice("paladin-roadwarden-apex", 50, "Roadwarden Apex", "Choose a connected network of hospitable waypoints or long-range protection that anticipates threats beyond one settlement.", [
    option("pilgrim-beacon", "Pilgrim Beacon", "Connect travellers to known water, shelter, warning, mediation, repair, rites, medicine, and lawful help through maintained human relationships.", [
      action("paladin:found-pilgrim-beacon", "Found a Pilgrim Beacon", "Establish one accountable waypoint with hosts, capacity, signs, supplies, rules, access, maintenance, messages, and referral to the next safe stop."),
      passive("paladin:pilgrim-beacon", "Pilgrim Beacon", "Roadwarden guidance becomes more reliable along maintained routes, never conjuring provisions, shelter, healing, direction, or safe passage where none exists."),
      proficiency("paladin:pilgrim-beacon"),
    ]),
    option("horizon-guardian", "Horizon Guardian", "Protect a region by connecting distant warning, travellers, displaced people, seasonal danger, supply, authority, and relief before crisis reaches the gate.", [
      action("paladin:keep-horizon-covenant", "Keep a Horizon Covenant", "Coordinate neighbouring messengers, refuges, patrol reports, route status, reserves, evacuation, aid requests, and scheduled review across a real region."),
      passive("paladin:horizon-guardian", "Horizon Guardian", "The Paladin can sustain several bounded public duties through accountable delegates and records, but cannot perceive, guard, or command a distant place supernaturally."),
      proficiency("paladin:horizon-guardian"),
    ]),
  ], "paladin-beacon-method", "roadwarden"),
]);

const BARD_BRANCHES = Object.freeze([
  choice("bard-performance-path", 10, "Bard Performance Path", "Choose the trained medium that will refine shared Cadence through willing coordination, social pressure, physical resonance, or remembered history. Every path remains non-spell performance.", [
    option("war-singer", "War Singer", "Use drum, chant, breath, and visible rhythm to help willing allies align movement, courage, and committed timing.", [
      ability("bard-war-drum"),
      passive("bard:war-singer-pulse", "War Singer Pulse", "Native coordination cues help conscious willing allies act together without issuing orders or overriding their choices.", { bardPath: "war-singer" }),
      proficiency("bard:war-singer"),
    ]),
    option("satirist", "Satirist", "Turn witnessed hypocrisy, error, fear, and reputation into precise social pressure against foes who can understand and care.", [
      ability("bard-pointed-satire"),
      passive("bard:satirists-ground", "Satirist's Ground", "Native satire depends on facts, language, audience, and social stakes; it never compels or rewrites a mind.", { bardPath: "satirist" }),
      proficiency("bard:satirist"),
    ]),
    option("resonant-virtuoso", "Resonant Virtuoso", "Master breath, strings, membranes, chambers, and acoustic direction for bounded physical vibration and interlocking tone.", [
      ability("bard-resonant-pulse"),
      passive("bard:physical-resonance", "Physical Resonance", "Native sonic force remains physical, distance-bound, anatomy-bound, and subject to ordinary mitigation.", { bardPath: "resonant-virtuoso" }),
      proficiency("bard:resonant-virtuoso"),
    ]),
    option("lorekeeper", "Lorekeeper", "Use true remembered deeds, patterns, names, and hard-won accounts to orient willing allies in the present moment.", [
      ability("bard-lore-callout"),
      passive("bard:lorekeepers-honesty", "Lorekeeper's Honesty", "Native lore cues draw only on known or observed information and never reveal hidden truths by performance alone.", { bardPath: "lorekeeper" }),
      proficiency("bard:lorekeeper"),
    ]),
  ]),

  choice("war-singer-method", 30, "War Singer Method", "Choose a drumline that carries shared movement or an anthem that rebuilds willing courage through voice and example.", [
    option("drumline", "Drumline", "Make repeated physical pulse into a common walking, bracing, and striking count for willing collaborators.", [
      ability("bard-marching-cadence"),
      passive("bard:drumline-count", "Drumline Count", "Allied timing follows a perceptible shared beat and ends when participants can no longer hear, see, or willingly follow it."),
      proficiency("bard:drumline"),
    ]),
    option("anthemist", "Anthemist", "Build courage from shared words, breath, memory, and the proof of companions still standing together.", [
      ability("bard-defiant-anthem"),
      passive("bard:defiant-words", "Defiant Words", "Native anthems restore and reinforce morale only for conscious willing allies who can perceive and value the performance."),
      proficiency("bard:anthemist"),
    ]),
  ], "bard-performance-path", "war-singer"),
  choice("drumline-apex", 50, "Drumline Apex", "Choose complete mastery of shared steps or a counter-rhythm that makes an opposing advance harder to coordinate.", [
    option("march-master", "March Master", "Keep willing allies on a usable common count through changes of speed, terrain, formation, and fatigue.", [
      passive("bard:march-master", "March Master", "Marching Cadence survives more ordinary changes of pace while each ally remains responsible for footing, injury, and chosen movement."),
      action("bard:set-marching-count", "Set the Marching Count", "Choose a physically audible pace and agreed transition cue suited to the present terrain and willing ensemble."),
      proficiency("bard:march-master"),
    ]),
    option("countermarcher", "Countermarcher", "Place audible emphasis against an observed enemy cadence so their shared preparation loses clean agreement.", [
      action("bard:find-countermarch", "Find the Countermarch", "Observe an opposing group's visible or audible movement count and choose a distinct disruptive rhythm."),
      passive("bard:countermarcher", "Countermarcher", "Disciplined foes suffer only bounded timing pressure, and creatures without a shared rhythm provide nothing to disrupt."),
      proficiency("bard:countermarcher"),
    ]),
  ], "war-singer-method", "drumline"),
  choice("anthemist-apex", 50, "Anthemist Apex", "Choose a verse that holds through renewed fear or a chorus strengthened by every willing voice that answers.", [
    option("unbroken-verse", "Unbroken Verse", "Return to the same honest words after a shock so allies can recover the courage they had already chosen.", [
      passive("bard:unbroken-verse", "Unbroken Verse", "Defiant Anthem grants stronger bounded morale resistance after eligible allies have been shaken; it never grants fear immunity."),
      action("bard:name-defiance", "Name the Defiance", "Tie the next anthem to one true reason the willing ensemble has chosen to remain present."),
      proficiency("bard:unbroken-verse"),
    ]),
    option("many-voiced-answer", "Many-Voiced Answer", "Let willing allies answer in their own voices until the anthem belongs to the group rather than one performer.", [
      action("bard:teach-answering-line", "Teach the Answering Line", "Give willing allies one short response they can repeat without losing their own action or judgment."),
      passive("bard:many-voiced-answer", "Many-Voiced Answer", "A heard allied response extends bounded morale steadiness through participation, not increased volume alone."),
      proficiency("bard:many-voiced-answer"),
    ]),
  ], "war-singer-method", "anthemist"),

  choice("satirist-method", 30, "Satirist Method", "Choose a precisely timed personal heckle or a coordinated chorus that turns witnessed failure into public pressure.", [
    option("heckler", "Heckler", "Place one cutting line inside a foe's visible preparation so recognition and anger spoil the next beat.", [
      ability("bard-hecklers-hook"),
      passive("bard:hecklers-timing", "Heckler's Timing", "The hook depends on a socially reachable foe and an observed preparation; it cannot silence, stun, or compel."),
      proficiency("bard:heckler"),
    ]),
    option("chorus-of-scorn", "Chorus of Scorn", "Coordinate willing voices around one witnessed contradiction so several socially reachable foes feel the audience turn.", [
      ability("bard-chorus-of-scorn"),
      passive("bard:shared-scorn", "Shared Scorn", "Group pressure requires willing participants, intelligible claims, and meaningful witnesses rather than manufactured emotion."),
      proficiency("bard:chorus-of-scorn"),
    ]),
  ], "bard-performance-path", "satirist"),
  choice("heckler-apex", 50, "Heckler Apex", "Choose exact interruption at the preparatory beat or a line sharpened around the target's own boast and audience.", [
    option("perfect-interruption", "Perfect Interruption", "Wait for the breath, gesture, step, or command that reveals a foe's commitment before placing the line.", [
      passive("bard:perfect-interruption", "Perfect Interruption", "Heckler's Hook imposes stronger bounded timing pressure when aimed at an actually observed preparation; bosses do not lose agency."),
      action("bard:mark-preparatory-beat", "Mark the Preparatory Beat", "Identify the visible or audible instant immediately before one repeated hostile action."),
      proficiency("bard:perfect-interruption"),
    ]),
    option("needle-in-the-boast", "Needle in the Boast", "Turn a foe's public claim against its next mistake so self-conscious anger makes precision harder.", [
      action("bard:record-the-boast", "Record the Boast", "Recall one claim the target actually made and the witnessed conduct that now contradicts it."),
      passive("bard:needle-in-the-boast", "Needle in the Boast", "A relevant contradiction deepens social pressure; silent, unknown, shameless, or culturally unreachable foes remain resistant."),
      proficiency("bard:needle-in-the-boast"),
    ]),
  ], "satirist-method", "heckler"),
  choice("chorus-of-scorn-apex", 50, "Chorus of Scorn Apex", "Choose the pressure of many willing witnesses or a public accounting built from undeniable observed conduct.", [
    option("laughing-gallery", "Laughing Gallery", "Shape timing and response so willing bystanders or allies make social isolation audible without losing their own agency.", [
      passive("bard:laughing-gallery", "Laughing Gallery", "Each willing audible response adds bounded public pressure up to a strict limit; a fabricated or coerced crowd adds nothing."),
      action("bard:set-gallery-response", "Set the Gallery Response", "Offer willing listeners a simple response they may choose to give after the Satirist's line."),
      proficiency("bard:laughing-gallery"),
    ]),
    option("public-reckoning", "Public Reckoning", "Arrange names, acts, witnesses, and consequences into a short accusation the present audience can evaluate.", [
      action("bard:assemble-public-reckoning", "Assemble Public Reckoning", "State only known conduct and visible evidence relevant to the socially reachable targets before the audience."),
      passive("bard:public-reckoning", "Public Reckoning", "Chorus of Scorn lasts longer when its claim is publicly substantiated, but it never determines guilt or forces surrender."),
      proficiency("bard:public-reckoning"),
    ]),
  ], "satirist-method", "chorus-of-scorn"),

  choice("resonant-virtuoso-method", 30, "Resonant Virtuoso Method", "Choose concentrated physical vibration against one exposed target or layered interference across several acoustic paths.", [
    option("shattertone", "Shattertone", "Concentrate breath or instrument vibration into a bounded physical tone that jars bodies and vulnerable mundane material.", [
      ability("bard-shattertone"),
      passive("bard:shattertone-physics", "Shattertone Physics", "Frequency, source power, medium, distance, material, anatomy, and protection determine every effect; damage remains physical."),
      proficiency("bard:shattertone"),
    ]),
    option("harmonic-weaver", "Harmonic Weaver", "Layer distinct audible frequencies so their physical interference pressures several foes without becoming elemental or magical force.", [
      ability("bard-harmonic-weave"),
      passive("bard:harmonic-parts", "Harmonic Parts", "Each pressure line remains physical sound shaped by source, medium, distance, anatomy, protection, and current acoustics."),
      proficiency("bard:harmonic-weaver"),
    ]),
  ], "bard-performance-path", "resonant-virtuoso"),
  choice("shattertone-apex", 50, "Shattertone Apex", "Choose precise work against vulnerable mundane resonance or a concussive phrase aimed at bodily timing rather than destruction.", [
    option("material-resonance", "Material Resonance", "Find the physical frequency and support condition at which a small flawed mundane object responds most strongly.", [
      passive("bard:material-resonance", "Material Resonance", "Shattertone gains bounded effectiveness against observed fragile material and never breaks massive, sound, enchanted, or unsupported objects by name alone."),
      action("bard:test-material-tone", "Test Material Tone", "Use controlled low-force sound to identify whether a reachable mundane object has a resonant weakness."),
      proficiency("bard:material-resonance"),
    ]),
    option("concussive-phrase", "Concussive Phrase", "Shape a short pressure wave around a creature's present distance and anatomy to jar its next physical timing.", [
      action("bard:aim-concussive-phrase", "Aim the Concussive Phrase", "Choose the physical sound path and acoustically exposed target before releasing a tightly bounded loud phrase."),
      passive("bard:concussive-phrase", "Concussive Phrase", "Native sonic disruption becomes bounded accuracy pressure against massive or boss-scale bodies and never stun-locks."),
      proficiency("bard:concussive-phrase"),
    ]),
  ], "resonant-virtuoso-method", "shattertone"),
  choice("harmonic-weaver-apex", 50, "Harmonic Weaver Apex", "Choose several perfectly separated pressure lines or a counterpoint that adapts as targets and acoustic paths change.", [
    option("interlocking-parts", "Interlocking Parts", "Place distinct tones so each physical vibration reinforces the next across several reachable foes.", [
      passive("bard:interlocking-parts", "Interlocking Parts", "Harmonic Weave retains bounded pressure across more acoustically exposed targets without multiplying the same contact into unbounded damage."),
      action("bard:assign-interlocking-parts", "Assign Interlocking Parts", "Choose the source, frequency, direction, and reachable target lane for each layered physical tone."),
      proficiency("bard:interlocking-parts"),
    ]),
    option("living-counterpoint", "Living Counterpoint", "Alter one pressure line around a moving target while keeping the remaining audible interference physically coherent.", [
      action("bard:adapt-counterpoint", "Adapt the Counterpoint", "Change one frequency or direction after a target, obstacle, or reflective surface shifts position."),
      passive("bard:living-counterpoint", "Living Counterpoint", "One changing acoustic path does not collapse Harmonic Weave, but silence, separation, absorption, and lost targets still do."),
      proficiency("bard:living-counterpoint"),
    ]),
  ], "resonant-virtuoso-method", "harmonic-weaver"),

  choice("lorekeeper-method", 30, "Lorekeeper Method", "Choose old ballads that steady present courage or immediate battle chronicle that turns witnessed events into usable timing.", [
    option("balladeer", "Balladeer", "Frame known loss, endurance, home, and return in a form willing allies can use to carry present fear.", [
      ability("bard-old-ballad"),
      passive("bard:ballad-memory", "Ballad Memory", "Old Ballad strengthens morale through known human meaning and never grants false memories, prophecy, or health."),
      proficiency("bard:balladeer"),
    ]),
    option("battle-chronicler", "Battle Chronicler", "Name observed actions, failures, and openings quickly enough that willing allies can coordinate around the real fight.", [
      ability("bard-battle-chronicle"),
      passive("bard:witnessed-chronicle", "Witnessed Chronicle", "Only visible or reliably reported events enter the battle account; hidden statistics and intentions remain unknown."),
      proficiency("bard:battle-chronicler"),
    ]),
  ], "bard-performance-path", "lorekeeper"),
  choice("balladeer-apex", 50, "Balladeer Apex", "Choose remembered journeys that make hardship legible or funeral song that lets courage coexist honestly with grief.", [
    option("old-road-memory", "Old-Road Memory", "Use a known journey, return, or survival to give present hardship a truthful shape and expected next step.", [
      passive("bard:old-road-memory", "Old-Road Memory", "Old Ballad offers stronger bounded morale resistance when its story is genuinely known or relevant to willing listeners."),
      action("bard:choose-old-road", "Choose the Old Road", "Select a known account whose hardship and resolution honestly resemble the present fear."),
      proficiency("bard:old-road-memory"),
    ]),
    option("funeral-courage", "Funeral Courage", "Name the dead, the cost, and the work still required without pretending song can erase loss.", [
      action("bard:name-the-cost", "Name the Cost", "Acknowledge a known loss and the willing ensemble's chosen reason to continue despite it."),
      passive("bard:funeral-courage", "Funeral Courage", "Ballad morale recovery remains effective amid grief but never heals trauma, revives anyone, or suppresses mourning."),
      proficiency("bard:funeral-courage"),
    ]),
  ], "lorekeeper-method", "balladeer"),
  choice("battle-chronicler-apex", 50, "Battle Chronicler Apex", "Choose exact recording of an observed weakness or the ability to name the real instant when a fight changes direction.", [
    option("witnessed-weakness", "Witnessed Weakness", "Preserve the sequence that exposed a real defensive or timing flaw so willing allies can recognize its return.", [
      passive("bard:witnessed-weakness", "Witnessed Weakness", "Battle Chronicle grants bounded accuracy only against a flaw actually observed in the current fight; armour and boss limits remain."),
      action("bard:record-witnessed-weakness", "Record Witnessed Weakness", "Describe the visible action sequence that produced one genuine opening in a foe's defence."),
      proficiency("bard:witnessed-weakness"),
    ]),
    option("turning-point", "Turning Point", "Recognize when position, morale, injury, or tempo has truly changed and give willing allies one shared name for it.", [
      action("bard:name-turning-point", "Name the Turning Point", "Call out one visible change in the fight and the timing opportunity it offers willing allies."),
      passive("bard:turning-point", "Turning Point", "A truthful timely callout briefly strengthens native coordination; an invented or obsolete claim provides no benefit."),
      proficiency("bard:turning-point"),
    ]),
  ], "lorekeeper-method", "battle-chronicler"),
]);

const ARTIFICER_BRANCHES = Object.freeze([
  choice("artificer-workshop", 10, "Workshop Discipline", "Choose the family of physical works that receives the Artificer's deepest practice. General design, fabrication, testing, repair, and prepared Device Charges continue regardless of this choice.", [
    option("runesmith", "Runesmith", "Build tested inscriptions into prepared objects, interfaces, wards, and edges without learning a Wizard spellbook.", [
      ability("artificer-inscribed-ward"),
      passive("artificer:inscription-device", "Inscription as Device", "A Runesmith working needs a prepared physical substrate, authored geometry, material compatibility, activation, inspection, and retirement; it is not a spontaneously cast spell."),
      proficiency("artificer:runesmith"),
    ]),
    option("alchemist", "Alchemist", "Prepare labelled compounds whose effects remain bounded by reagent, dose, container, route, timing, and cleanup.", [
      ability("artificer-flash-phial"),
      passive("artificer:prepared-compound", "Prepared Compound", "An Alchemist's combat mixture is fabricated and carried before use. It neither transmutes without material nor becomes a Sorcerer or Wizard spell."),
      proficiency("artificer:alchemist"),
    ]),
    option("mechanist", "Mechanist", "Construct limited mechanisms whose sensors, actuators, power, instructions, and failure states remain explicit.", [
      ability("artificer-clockwork-sentinel"),
      passive("artificer:bounded-mechanism", "Bounded Mechanism", "A Mechanist device performs a narrow authored function for a bounded duration. It has no personhood, free will, permanent body, independent advancement, or creature summoning."),
      proficiency("artificer:mechanist"),
    ]),
    option("siegewright", "Siegewright", "Design portable fieldworks, barriers, launchers, and breach tools around real load paths, terrain, logistics, and evacuation.", [
      ability("artificer-deployable-barricade"),
      passive("artificer:portable-fieldwork", "Portable Fieldwork", "A Siegewright protection occupies real space, needs placement and material, and can be bypassed, damaged, moved, or dismantled."),
      proficiency("artificer:siegewright"),
    ]),
  ]),

  choice("artificer-runesmith-method", 30, "Runesmith Method", "Choose layered protection or carefully bounded weapon interfaces within physical inscription craft.", [
    option("wardwright", "Wardwright", "Stack independent inscriptions whose coverage, load, interference, inspection, and fail-safe behavior remain visible.", [
      ability("artificer-layered-seal"),
      passive("artificer:layered-seal", "Layered Seal", "Layered Seal spends prepared Charges for bounded ward and interference resistance; it never grants invulnerability or generic dispelling."),
      proficiency("artificer:wardwright"),
    ]),
    option("edgewright", "Edgewright", "Fit prepared inscription assemblies to real weapons while preserving grip, balance, material, armour, ward, and removal.", [
      ability("artificer-runic-edge"),
      passive("artificer:runic-edge", "Runic Edge", "Runic Edge augments a willing ally's physical weapon for a bounded duration and never grants a Warrior technique, smite, or permanent magic item."),
      proficiency("artificer:edgewright"),
    ]),
  ], "artificer-workshop", "runesmith"),
  choice("artificer-wardwright-apex", 50, "Wardwright Mastery", "Choose public protective infrastructure or exact containment of a known hazardous interface.", [
    option("aegis-architect", "Aegis Architect", "Coordinate many modest protective devices whose overlap, blind zones, maintenance, power, and evacuation are independently reviewed.", [
      action("artificer:design-aegis-network", "Design an Aegis Network", "Map protected people and assets, device coverage, shared failures, inspection, access, emergency state, responsible maintainers, and staged acceptance."),
      passive("artificer:aegis-architect", "Aegis Architect", "Prepared wards integrate more reliably through documented interfaces but remain finite devices with gaps, upkeep, and failure."),
      proficiency("artificer:aegis-architect"),
    ]),
    option("containment-master", "Containment Master", "Build several independent barriers around one verified hazard without claiming universal suppression.", [
      action("artificer:design-containment", "Design Containment", "Define the hazard, routes, primary and secondary boundaries, monitoring, decontamination, waste, breach response, and release criteria."),
      passive("artificer:containment-master", "Containment Master", "Wardwright devices better resist the one mechanism they were tested against; unknown hazards and common-cause failure remain dangerous."),
      proficiency("artificer:containment-master"),
    ]),
  ], "artificer-runesmith-method", "wardwright"),
  choice("artificer-edgewright-apex", 50, "Edgewright Mastery", "Choose a standardized modular interface or one singular documented weapon-device collaboration.", [
    option("arsenal-standard", "Arsenal Standard", "Create safe interchangeable fittings, markings, tests, maintenance, and withdrawal rules across many ordinary weapons.", [
      action("artificer:publish-arsenal-standard", "Publish an Arsenal Standard", "Define compatible weapons, loads, fittings, tests, labels, training, inspection, repair, change control, and unsafe combinations."),
      passive("artificer:arsenal-standard", "Arsenal Standard", "Runic weapon devices can be fitted and removed more consistently but confer no weapon proficiency or permanent enchantment."),
      proficiency("artificer:arsenal-standard"),
    ]),
    option("relic-collaborator", "Relic Collaborator", "Work with a named bearer and singular object through provenance, consent, reversible tests, and long stewardship.", [
      action("artificer:prepare-relic-collaboration", "Prepare a Relic Collaboration", "Record bearer, object, provenance, existing workings, proposed interface, hazards, reversible test, custody, repair, and termination."),
      passive("artificer:relic-collaborator", "Relic Collaborator", "The Artificer can diagnose and support a singular weapon-device interface without owning, duplicating, teaching, or automatically mastering the relic."),
      proficiency("artificer:relic-collaborator"),
    ]),
  ], "artificer-runesmith-method", "edgewright"),

  choice("artificer-alchemist-method", 30, "Alchemist Method", "Choose protective and restorative delivery or precisely bounded destructive compounds.", [
    option("catalyst-brewer", "Catalyst Brewer", "Prepare aerosols, washes, buffers, carriers, and catalysts that support living recovery without replacing a Healer.", [
      ability("artificer-restorative-aerosol"),
      passive("artificer:restorative-aerosol", "Restorative Aerosol", "The aerosol grants bounded stabilization and condition relief from a prepared compound. It does not restore lost health, diagnose disease, regrow tissue, or cast healing magic."),
      proficiency("artificer:catalyst-brewer"),
    ]),
    option("volatile-compounder", "Volatile Compounder", "Control pressure, reaction rate, casing, direction, dose, fragments, ignition, and residue in short-lived compounds.", [
      ability("artificer-fracture-compound"),
      passive("artificer:fracture-compound", "Fracture Compound", "A prepared compound applies bounded material and armour pressure. It creates no vulnerability from nothing and never deals true damage."),
      proficiency("artificer:volatile-compounder"),
    ]),
  ], "artificer-workshop", "alchemist"),
  choice("artificer-catalyst-brewer-apex", 50, "Catalyst Brewer Mastery", "Choose public preparation standards or expedition-scale stabilization systems.", [
    option("pharmacopeia-keeper", "Pharmacopeia Keeper", "Maintain verified recipes, batches, doses, incompatibilities, outcomes, adverse events, and recall across many makers.", [
      action("artificer:keep-compound-pharmacopeia", "Keep a Compound Pharmacopeia", "Publish identity tests, formula, process, controls, dose, route, limits, storage, expiry, adverse reporting, and recall for each preparation."),
      passive("artificer:pharmacopeia-keeper", "Pharmacopeia Keeper", "Known prepared compounds become more consistent and auditable; undocumented illness and unfamiliar exposure still require a Healer or specialist."),
      proficiency("artificer:pharmacopeia-keeper"),
    ]),
    option("expedition-apothecary", "Expedition Apothecary", "Keep safe water treatment, decontamination, preservation, antidote support, and exposure records working far from a workshop.", [
      action("artificer:prepare-expedition-apothecary", "Prepare an Expedition Apothecary", "Pack verified compounds, labels, dosing tools, clean and dirty zones, records, disposal, resupply, referral, and limits for a defined journey."),
      passive("artificer:expedition-apothecary", "Expedition Apothecary", "Prepared support survives transport and scarcity more reliably but grants no universal cure, diagnosis, immunity, or magical healing."),
      proficiency("artificer:expedition-apothecary"),
    ]),
  ], "artificer-alchemist-method", "catalyst-brewer"),
  choice("artificer-volatile-compounder-apex", 50, "Volatile Compounder Mastery", "Choose exact shaped force or strict stewardship of dangerous reagents and formulae.", [
    option("reaction-sculptor", "Reaction Sculptor", "Control a prepared reaction's direction, duration, pressure, heat, fragments, residue, and abort path through tested geometry.", [
      action("artificer:sculpt-reaction", "Sculpt a Reaction", "Model and test vessel, initiator, propagation, venting, shielding, exclusion, monitoring, and failure before increasing scale."),
      passive("artificer:reaction-sculptor", "Reaction Sculptor", "Volatile device output becomes more contained around its tested geometry, never perfectly selective or consequence-free."),
      proficiency("artificer:reaction-sculptor"),
    ]),
    option("dangerous-goods-master", "Dangerous Goods Master", "Govern acquisition, custody, transport, storage, issue, use, residue, incident response, and destruction for hazardous compounds.", [
      action("artificer:govern-dangerous-goods", "Govern Dangerous Goods", "Create classification, packaging, separation, quantities, route, guards, manifests, emergency information, inspections, and accountable disposal."),
      passive("artificer:dangerous-goods-master", "Dangerous Goods Master", "The workshop can detect loss and misuse earlier; mastery never makes explosive, poisonous, corrosive, or magical reagents harmless."),
      proficiency("artificer:dangerous-goods-master"),
    ]),
  ], "artificer-alchemist-method", "volatile-compounder"),

  choice("artificer-mechanist-method", 30, "Mechanist Method", "Choose a bounded protective automaton or wearable assistive mechanism.", [
    option("sentinel-smith", "Sentinel Smith", "Build narrow watch and interception machines with explicit identification, range, force, timeout, and manual stop.", [
      ability("artificer-interception-automaton"),
      passive("artificer:interception-automaton", "Interception Automaton", "The device absorbs a bounded share of eligible harm for a short duration. It is equipment, not a summoned ally, companion, or independent combatant."),
      proficiency("artificer:sentinel-smith"),
    ]),
    option("servo-engineer", "Servo Engineer", "Fit powered linkages that assist a willing wearer's movement without granting training or rewriting the body.", [
      ability("artificer-overclock-servo"),
      passive("artificer:overclock-servo", "Overclock Servo", "A bounded temporary servo boost improves physical timing while adding wear and never grants Haste, bonus actions, teleportation, or Monk techniques."),
      proficiency("artificer:servo-engineer"),
    ]),
  ], "artificer-workshop", "mechanist"),
  choice("artificer-sentinel-smith-apex", 50, "Sentinel Smith Mastery", "Choose transparent civic safety devices or resilient mobile protection with strict command limits.", [
    option("watchwork-architect", "Watchwork Architect", "Deploy public alarms and bounded response devices whose zones, records, authority, errors, and appeal remain visible.", [
      action("artificer:design-watchwork", "Design Civic Watchwork", "Map threat, protected people, sensors, blind zones, alarm, human verification, force limits, records, privacy, oversight, and shutdown."),
      passive("artificer:watchwork-architect", "Watchwork Architect", "A network shares verified alerts more reliably but never identifies guilt, reads intent, or replaces human authority."),
      proficiency("artificer:watchwork-architect"),
    ]),
    option("guardian-foundry", "Guardian Foundry", "Standardize short-lived protection mechanisms with safe identification, interception caps, maintenance, and recall.", [
      action("artificer:charter-guardian-foundry", "Charter a Guardian Foundry", "Define permitted models, protected users, identification, force and duration limits, acceptance tests, issue, service, incident review, and recall."),
      passive("artificer:guardian-foundry", "Guardian Foundry", "Sentinel devices are more consistent and serviceable but remain destructible bounded equipment, never people or permanent guardians."),
      proficiency("artificer:guardian-foundry"),
    ]),
  ], "artificer-mechanist-method", "sentinel-smith"),
  choice("artificer-servo-engineer-apex", 50, "Servo Engineer Mastery", "Choose accessible assistive craft or heavy work frames governed by real loads and operator limits.", [
    option("mobility-artificer", "Mobility Artificer", "Co-design braces, supports, controls, seating, tools, and powered assistance around one willing person's goals and daily environment.", [
      action("artificer:co-design-mobility-device", "Co-Design a Mobility Device", "Document user goals, consent, fit, comfort, skin, fatigue, control, maintenance, training, environments, repair, and desired changes."),
      passive("artificer:mobility-artificer", "Mobility Artificer", "Assistive devices fit and adapt more reliably; the maker does not define the user's body, needs, identity, or acceptable tradeoffs for them."),
      proficiency("artificer:mobility-artificer"),
    ]),
    option("workframe-master", "Workframe Master", "Build powered frames for defined hauling, lifting, rescue, and fabrication tasks with tested limits and escape.", [
      action("artificer:design-workframe", "Design a Workframe", "Calculate load, stability, controls, pinch zones, power, heat, footing, operator protection, exclusion, rescue, inspection, and shutdown."),
      passive("artificer:workframe-master", "Workframe Master", "A fitted frame assists bounded work; it never grants innate strength, armour proficiency, Warrior techniques, or safe overload."),
      proficiency("artificer:workframe-master"),
    ]),
  ], "artificer-mechanist-method", "servo-engineer"),

  choice("artificer-siegewright-method", 30, "Siegewright Method", "Choose controlled breaching or deployable protection and movement infrastructure.", [
    option("breach-engineer", "Breach Engineer", "Open a selected route through a verified structure using shaped force, shoring, exclusion, fire control, and post-breach inspection.", [
      ability("artificer-shaped-demolition"),
      passive("artificer:shaped-demolition", "Shaped Demolition", "The charge applies bounded armour and structure pressure through prepared geometry. It cannot erase massive works, ignore ward, or deal true damage."),
      proficiency("artificer:breach-engineer"),
    ]),
    option("bulwark-architect", "Bulwark Architect", "Deploy frames, screens, anchors, ramps, and shelters around real terrain, loads, access, and evacuation.", [
      ability("artificer-bulwark-frame"),
      passive("artificer:bulwark-frame", "Bulwark Frame", "The frame supplies bounded physical cover and stability while occupying real space. It can be flanked, damaged, undermined, moved, or dismantled."),
      proficiency("artificer:bulwark-architect"),
    ]),
  ], "artificer-workshop", "siegewright"),
  choice("artificer-breach-engineer-apex", 50, "Breach Engineer Mastery", "Choose rescue access through dangerous structures or accountable siege-scale engineering.", [
    option("rescue-breacher", "Rescue Breacher", "Reach trapped people through the smallest safe opening while controlling collapse, fire, utilities, debris, and medical access.", [
      action("artificer:plan-rescue-breach", "Plan a Rescue Breach", "Locate people, assess structure and services, choose access, shore, isolate, ventilate, communicate, remove debris, and preserve an exit."),
      passive("artificer:rescue-breacher", "Rescue Breacher", "Breaching decisions better preserve survivable space and responder access but never guarantee a stable structure or unharmed occupants."),
      proficiency("artificer:rescue-breacher"),
    ]),
    option("siege-engine-master", "Siege Engine Master", "Govern large launchers and breach machines through range tables, crews, ammunition, maintenance, exclusion, surrender routes, and civilian protection.", [
      action("artificer:govern-siege-engine", "Govern a Siege Engine", "Define lawful target, crew, commands, load, aim, misfire, range, exclusion, fire response, cease conditions, custody, and post-action accounting."),
      passive("artificer:siege-engine-master", "Siege Engine Master", "Large devices operate more consistently under trained crews; they remain logistical systems with inaccuracy, breakdown, counterfire, and grave accountability."),
      proficiency("artificer:siege-engine-master"),
    ]),
  ], "artificer-siegewright-method", "breach-engineer"),
  choice("artificer-bulwark-architect-apex", 50, "Bulwark Architect Mastery", "Choose rapidly deployable refuge or durable public defensive works.", [
    option("refuge-engineer", "Refuge Engineer", "Turn carried frames, cloth, anchors, drainage, light, heat, water, sanitation, and access into temporary humane shelter.", [
      action("artificer:deploy-refuge", "Deploy a Refuge", "Select site, occupancy, access, structure, weather, ventilation, heat, water, sanitation, privacy, watch, maintenance, and safe dismantling."),
      passive("artificer:refuge-engineer", "Refuge Engineer", "Portable fieldworks become safer and faster to establish for known conditions but do not create supplies, land rights, healing, or permanent sanctuary."),
      proficiency("artificer:refuge-engineer"),
    ]),
    option("fortification-steward", "Fortification Steward", "Maintain walls, gates, bridges, towers, drains, stores, alarms, refuges, access, and evacuation as one public safety system.", [
      action("artificer:steward-fortification", "Steward a Fortification", "Inspect structure, use, staffing, water, fire, supplies, repairs, accessibility, civilian movement, siege condition, surrender, and future adaptation."),
      passive("artificer:fortification-steward", "Fortification Steward", "Defensive works retain readiness and humane function longer, but no wall is absolute and no structure substitutes for governance or people."),
      proficiency("artificer:fortification-steward"),
    ]),
  ], "artificer-siegewright-method", "bulwark-architect"),
]);

const INNKEEPER_BRANCHES = Object.freeze([
  choice("innkeeper-calling", 10, "House Calling", "Choose the hospitality responsibility that receives the deepest practice while general shelter, provision, public duty, records, and service continue.", [
    option("hearthkeeper", "Hearthkeeper", "Build safe lodging, rest, privacy, lawful refuge, and continuity around a physical house.", [
      action("innkeeper:survey-house-safety", "Survey House Safety", "Inspect rooms, water, fire, sanitation, access, locks, staff readiness, emergency capacity, and unresolved hazards as one occupied system."),
      passive("innkeeper:hearthkeeper", "Hearthkeeper", "Prepared shelter functions more reliably within verified capacity; walls, locks, rules, and welcome never create invulnerability or absolute sanctuary."),
      proficiency("innkeeper:hearthkeeper"),
    ]),
    option("publican", "Publican", "Steward the public room as a place of service, boundaries, gathering, and local belonging.", [
      action("innkeeper:plan-public-room", "Plan the Public Room", "Arrange service, seating, movement, information, accessibility, sound, watch, privacy edges, dispute response, and closing around the expected gathering."),
      passive("innkeeper:publican", "Publican", "Observable crowd state and house relationships become easier to manage, but the Publican neither reads minds nor gains Bard performance or coercive authority."),
      proficiency("innkeeper:publican"),
    ]),
    option("provisioner", "Provisioner", "Master food, drink, cellar, kitchen, supply, fair measure, and responsible service.", [
      action("innkeeper:plan-house-provision", "Plan House Provision", "Translate occupancy and service into ingredients, drink, water, fuel, labour, storage, dietary separation, waste, contingency, and truthful menu limits."),
      passive("innkeeper:provisioner", "Provisioner", "Known supplies are bought, stored, prepared, and served more consistently; this never creates food, grants healing, or replaces Farmer, Merchant, Artisan, or Healer expertise."),
      proficiency("innkeeper:provisioner"),
    ]),
    option("wayhouse-broker", "Wayhouse Broker", "Connect travellers, routes, verified local information, referrals, caravans, and linked houses.", [
      action("innkeeper:open-traveller-exchange", "Open a Traveller Exchange", "Collect dated route reports, needs, offers, warnings, referrals, messages, and onward lodging under source labels, privacy limits, and visible conflicts."),
      passive("innkeeper:wayhouse-broker", "Wayhouse Broker", "A maintained network yields better practical introductions and travel context, never secret omniscience, guaranteed passage, or Merchant ownership of the route."),
      proficiency("innkeeper:wayhouse-broker"),
    ]),
  ]),

  choice("innkeeper-hearthkeeper-method", 30, "Hearthkeeper Method", "Choose protected refuge or dependable restorative lodging as the mature hearth discipline.", [
    option("sanctuary-warden", "Sanctuary Warden", "Operate temporary lawful refuge through consent, access control, confidentiality, staff safety, records, review, and referral.", [
      action("innkeeper:conduct-refuge-intake", "Conduct a Refuge Intake", "Assess immediate danger and ordinary needs, agree safe contact and access, explain confidentiality limits, record only what is needed, and build a reviewed onward plan."),
      passive("innkeeper:sanctuary-warden", "Sanctuary Warden", "Refuge procedures reduce preventable exposure and confusion, but cannot nullify law, determined pursuit, supernatural detection, structural limits, or the protected person's choices."),
      proficiency("innkeeper:sanctuary-warden"),
    ]),
    option("resthouse-steward", "Resthouse Steward", "Design sleep, quiet, warmth, bathing, meals, pacing, accessibility, and unhurried service around actual recovery needs.", [
      action("innkeeper:prepare-resthouse-stay", "Prepare a Resthouse Stay", "Agree the guest's rest goals, room conditions, food and washing, interruption limits, observation or assistance, referrals, duration, price, and safe departure."),
      passive("innkeeper:resthouse-steward", "Resthouse Steward", "A well-run stay supports ordinary rest and recuperation without restoring health magically, diagnosing disease, or promising recovery."),
      proficiency("innkeeper:resthouse-steward"),
    ]),
  ], "innkeeper-calling", "hearthkeeper"),
  choice("innkeeper-sanctuary-warden-mastery", 50, "Sanctuary Warden Mastery", "Choose a coordinated refuge network or deep safeguarding practice.", [
    option("refuge-network-steward", "Refuge Network Steward", "Connect several accountable safe houses without concentrating every protected identity in one vulnerable ledger.", [
      action("innkeeper:coordinate-refuge-network", "Coordinate a Refuge Network", "Define admission, capacity, secure referral, need-to-know records, transport, supplies, trained contacts, incidents, audit, exit, and emergency isolation between participating houses."),
      passive("innkeeper:refuge-network-steward", "Refuge Network Steward", "Distributed refuge can continue after one house is compromised, while travel, betrayal, resource shortage, jurisdiction, and record exposure remain real dangers."),
      proficiency("innkeeper:refuge-network-steward"),
    ]),
    option("safeguarding-keeper", "Safeguarding Keeper", "Build trauma-aware protection against exploitation, grooming, stalking, trafficking, coercive control, and retaliation.", [
      action("innkeeper:review-safeguarding-case", "Review a Safeguarding Case", "Separate immediate safety, consent, evidence, contact restrictions, specialist advice, dependants, staff exposure, records, review, and the risk created by each intervention."),
      passive("innkeeper:safeguarding-keeper", "Safeguarding Keeper", "Trained patterns and careful referral improve protection decisions; suspicion is not proof and the Innkeeper gains no investigative, judicial, or medical authority."),
      proficiency("innkeeper:safeguarding-keeper"),
    ]),
  ], "innkeeper-hearthkeeper-method", "sanctuary-warden"),
  choice("innkeeper-resthouse-steward-mastery", 50, "Resthouse Steward Mastery", "Choose convalescent hospitality or long-distance pilgrim and expedition rest.", [
    option("convalescent-host", "Convalescent Host", "Coordinate ordinary lodging, hygiene, nourishment, access, quiet, companionship, and professional referrals around a guest under care.", [
      action("innkeeper:coordinate-convalescent-lodging", "Coordinate Convalescent Lodging", "Follow the guest's consent and a Healer's documented limits, adapt rooms and service, recognize urgent deterioration, protect records, and keep hospitality distinct from treatment."),
      passive("innkeeper:convalescent-host", "Convalescent Host", "The house better supports a care plan and caregiver rest; it neither performs medicine nor guarantees that recovery occurs."),
      proficiency("innkeeper:convalescent-host"),
    ]),
    option("pilgrim-rest-master", "Pilgrim Rest Master", "Receive exhausted long-distance travellers through pacing, foot and gear care referrals, food, washing, route knowledge, and inclusive communal rest.", [
      action("innkeeper:prepare-pilgrim-rest", "Prepare Pilgrim Rest", "Separate urgent illness and injury from ordinary fatigue, arrange accessible sleep and washing, manage groups and quiet, protect beliefs and privacy, and provide sourced onward information."),
      passive("innkeeper:pilgrim-rest-master", "Pilgrim Rest Master", "Repeated route experience improves rest planning for known journeys, never erasing exhaustion, weather, scarcity, injury, cost, or cultural difference."),
      proficiency("innkeeper:pilgrim-rest-master"),
    ]),
  ], "innkeeper-hearthkeeper-method", "resthouse-steward"),

  choice("innkeeper-publican-method", 30, "Publican Method", "Choose active taproom stewardship or the house's broader community role.", [
    option("taproom-host", "Taproom Host", "Run a busy public room through timing, responsible service, seating, sound, observation, humour, boundaries, and exact closing practice.", [
      action("innkeeper:conduct-taproom-service", "Conduct Taproom Service", "Brief staff, set capacity and service pace, monitor observable risk, protect tabs and measures, interrupt harassment or conflict, arrange safe departures, reconcile, and close."),
      passive("innkeeper:taproom-host", "Taproom Host", "A trained service rhythm reduces crowd friction and missed warning signs without becoming a buff, debuff, charm, sonic technique, or magical morale effect."),
      proficiency("innkeeper:taproom-host"),
    ]),
    option("community-keeper", "Community Keeper", "Hold meetings, notices, rituals, celebrations, mourning, mutual aid, and everyday belonging without capturing the community for the house.", [
      action("innkeeper:host-community-purpose", "Host a Community Purpose", "Agree purpose, access, representation, layout, service, cost, safety, facilitation, records, complaints, cleanup, and what the house must not control."),
      passive("innkeeper:community-keeper", "Community Keeper", "A trusted venue can help people gather and remember commitments, but trust, consensus, legitimacy, and attendance must still be earned."),
      proficiency("innkeeper:community-keeper"),
    ]),
  ], "innkeeper-calling", "publican"),
  choice("innkeeper-taproom-host-mastery", 50, "Taproom Host Mastery", "Choose mastery of large mixed crowds or difficult house mediation.", [
    option("crowd-steward", "Crowd Steward", "Coordinate entrances, queues, seating, servers, watch, performers, vendors, toilets, exits, transport, and neighbourhood impact for a dense gathering.", [
      action("innkeeper:steward-large-crowd", "Steward a Large Crowd", "Model arrival and departure, cap occupancy, assign zones and communication, protect access and vulnerable guests, define escalation, and stop admission before safe function fails."),
      passive("innkeeper:crowd-steward", "Crowd Steward", "Prepared staff and layout improve flow and early intervention; panic, violence, fire, structural limits, and individual choices remain dangerous."),
      proficiency("innkeeper:crowd-steward"),
    ]),
    option("house-mediator", "House Mediator", "Resolve recurring public-room disputes through evidence, boundaries, restitution, agreed conduct, and review rather than spectacle or favour.", [
      action("innkeeper:mediate-house-conflict", "Mediate House Conflict", "Confirm willingness and safety, hear each party separately where useful, define the bounded issue and house authority, develop options, record agreement, and set follow-up or exclusion."),
      passive("innkeeper:house-mediator", "House Mediator", "Established fairness improves participation in voluntary mediation, never compelling truth, forgiveness, settlement, or obedience."),
      proficiency("innkeeper:house-mediator"),
    ]),
  ], "innkeeper-publican-method", "taproom-host"),
  choice("innkeeper-community-keeper-mastery", 50, "Community Keeper Mastery", "Choose civic assembly practice or a mutual-aid house.", [
    option("assembly-host", "Assembly Host", "Provide neutral-enough physical and procedural support for hearings, guild meetings, elections, councils, and public questions.", [
      action("innkeeper:host-public-assembly", "Host a Public Assembly", "Publish terms, capacity, access, agenda, speaking process, interpretation, security, records, corrections, conflicts, adjournment, cleanup, and house limits."),
      passive("innkeeper:assembly-host", "Assembly Host", "Good hosting makes participation and procedure more workable, but grants the Innkeeper no vote, office, legal jurisdiction, or control of the outcome."),
      proficiency("innkeeper:assembly-host"),
    ]),
    option("mutual-aid-convener", "Mutual Aid Convener", "Turn local offers of rooms, food, transport, childcare, tools, labour, funds, and information into transparent reciprocal support.", [
      action("innkeeper:convene-mutual-aid", "Convene Mutual Aid", "Map needs and offers, consent, eligibility, safeguarding, custody, delivery, worker burden, conflicts, records, review, and sunset without making the house owner of community generosity."),
      passive("innkeeper:mutual-aid-convener", "Mutual Aid Convener", "A trusted coordination point reduces duplication and missed need; it cannot create resources or guarantee fair participation under unequal power."),
      proficiency("innkeeper:mutual-aid-convener"),
    ]),
  ], "innkeeper-publican-method", "community-keeper"),

  choice("innkeeper-provisioner-method", 30, "Provisioner Method", "Choose cellar and preservation stewardship or complex meal and event service.", [
    option("cellar-master", "Cellar Master", "Control source, storage, age, condition, rotation, blending, tasting, serving, loss, and truthful representation for drink and preserved goods.", [
      action("innkeeper:keep-cellar-ledger", "Keep a Cellar Ledger", "Record producer, lot, vessel, date, movement, storage condition, inspection, tasting, issue, loss, substitution, contamination, and remaining stock."),
      passive("innkeeper:cellar-master", "Cellar Master", "Known stock keeps quality and traceability longer under proper conditions, never becoming ageless, unspoilable, medicinal, or more valuable by assertion."),
      proficiency("innkeeper:cellar-master"),
    ]),
    option("feast-steward", "Feast Steward", "Coordinate menus, dietary needs, kitchen timing, service, seating, ceremony, staff, waste, and contingency for large shared meals.", [
      action("innkeeper:direct-feast-service", "Direct Feast Service", "Translate purpose and guest count into courses, tested capacity, sourcing, prep schedule, separation, holds, service sequence, substitutions, leftovers, cleanup, and stop conditions."),
      passive("innkeeper:feast-steward", "Feast Steward", "Complex service stays more coherent under preparation; food remains finite and dependent on ingredients, labour, heat, equipment, hygiene, and time."),
      proficiency("innkeeper:feast-steward"),
    ]),
  ], "innkeeper-calling", "provisioner"),
  choice("innkeeper-cellar-master-mastery", 50, "Cellar Master Mastery", "Choose beverage provenance and service or deep preservation stewardship.", [
    option("beverage-curator", "Beverage Curator", "Build a truthful collection around origin, maker, process, age, storage, flavour, serving, price, alternatives, and responsible use.", [
      action("innkeeper:curate-beverage-service", "Curate Beverage Service", "Document provenance and uncertainty, train accurate description and measures, design non-intoxicating choices, disclose substitutions and conflicts, and monitor adverse patterns."),
      passive("innkeeper:beverage-curator", "Beverage Curator", "The house can match known beverages to stated preferences and food more reliably, without compelling taste, status, purchase, sobriety, or intoxication."),
      proficiency("innkeeper:beverage-curator"),
    ]),
    option("preservation-master", "Preservation Master", "Steward drying, salting, fermenting, pickling, smoking, cooling, sealed storage, and rotation through measured process and inspection.", [
      action("innkeeper:validate-preserved-batch", "Validate a Preserved Batch", "Record ingredients, process, time, temperature or concentration, vessel, seal, storage, sensory checks, sampling, rejection, issue, and illness traceability."),
      passive("innkeeper:preservation-master", "Preservation Master", "Validated methods reduce ordinary loss and uncertainty; unfamiliar organisms, toxins, damaged seals, poor process, and age can still make a batch unsafe."),
      proficiency("innkeeper:preservation-master"),
    ]),
  ], "innkeeper-provisioner-method", "cellar-master"),
  choice("innkeeper-feast-steward-mastery", 50, "Feast Steward Mastery", "Choose prestigious complex banquets or high-volume community feeding.", [
    option("banquet-director", "Banquet Director", "Integrate hospitality, ceremony, precedence, service choreography, special diets, security, workers, suppliers, and public claims for a major occasion.", [
      action("innkeeper:direct-grand-banquet", "Direct a Grand Banquet", "Create the service book, responsibilities, floor and kitchen sequence, rehearsals, access, substitutions, dispute and emergency plans, guest communication, accounts, and post-event review."),
      passive("innkeeper:banquet-director", "Banquet Director", "Rehearsed coordination supports a complex event without granting Courtier rank, Bard performance, Diplomat authority, or immunity from shortage and failure."),
      proficiency("innkeeper:banquet-director"),
    ]),
    option("community-kitchen-keeper", "Community Kitchen Keeper", "Provide safe dignified meals at high volume during poverty, displacement, disaster, seasonal work, or collective celebration.", [
      action("innkeeper:operate-community-kitchen", "Operate a Community Kitchen", "Estimate need, secure lawful supply, protect water and sanitation, design accessible distribution, respect diets and dignity, support workers, control waste, record service, and plan continuity."),
      passive("innkeeper:community-kitchen-keeper", "Community Kitchen Keeper", "A practiced system feeds more people reliably from available inputs, never creating limitless food, labour, fuel, transport, or social consent."),
      proficiency("innkeeper:community-kitchen-keeper"),
    ]),
  ], "innkeeper-provisioner-method", "feast-steward"),

  choice("innkeeper-wayhouse-broker-method", 30, "Wayhouse Broker Method", "Choose accountable information exchange or caravan and onward-lodging coordination.", [
    option("rumour-broker", "Rumour Broker", "Weigh local reports, protect vulnerable sources, correct falsehood, and connect useful information to people who can verify or act.", [
      action("innkeeper:prepare-rumour-brief", "Prepare a Rumour Brief", "Separate direct observation, attributed report, repeated claim, interpretation, contradiction, motive, recency, harm, uncertainty, and recommended verification."),
      passive("innkeeper:rumour-broker", "Rumour Broker", "Repeated contact and disciplined sourcing improve context, never exposing hidden truth, detecting lies automatically, or granting Rogue espionage and Bard lore abilities."),
      proficiency("innkeeper:rumour-broker"),
    ]),
    option("caravan-host", "Caravan Host", "Coordinate group arrival, animals, wagons, guards, storage, resupply, information, repair referrals, onward booking, and departure.", [
      action("innkeeper:coordinate-caravan-stay", "Coordinate a Caravan Stay", "Confirm manifest and authority, capacity, separation, cargo hazards, watch, feeding, water, services, fees, privacy, local impact, departure sequence, and unresolved needs."),
      passive("innkeeper:caravan-host", "Caravan Host", "Known group movements and house turnaround become more predictable through records and preparation, never granting command of travellers, animals, roads, weather, or trade."),
      proficiency("innkeeper:caravan-host"),
    ]),
  ], "innkeeper-calling", "wayhouse-broker"),
  choice("innkeeper-rumour-broker-mastery", 50, "Rumour Broker Mastery", "Choose public verification or protected correspondence.", [
    option("verification-steward", "Verification Steward", "Maintain a public correction and source practice for route, hazard, market, official, missing-person, and community claims.", [
      action("innkeeper:run-verification-desk", "Run a Verification Desk", "Log claims, source and date, seek independent confirmation, publish confidence and corrections, protect sensitive evidence, archive changes, and disclose house interests."),
      passive("innkeeper:verification-steward", "Verification Steward", "The house becomes a more reliable place to check known local claims; new events, secret actors, forged evidence, source error, and deliberate deception remain possible."),
      proficiency("innkeeper:verification-steward"),
    ]),
    option("confidential-correspondent", "Confidential Correspondent", "Carry sensitive practical messages through consent, exact wording, authentication, minimal copies, safe custody, receipt, and destruction.", [
      action("innkeeper:arrange-confidential-message", "Arrange a Confidential Message", "Confirm sender, recipient, purpose, wording, urgency, route, messenger, authentication, disclosure limits, contingency, receipt, retention, and the right to refuse unsafe carriage."),
      passive("innkeeper:confidential-correspondent", "Confidential Correspondent", "Disciplined custody reduces ordinary loss and gossip, never guaranteeing secrecy against coercion, interception, magic, betrayal, or an unsafe recipient."),
      proficiency("innkeeper:confidential-correspondent"),
    ]),
  ], "innkeeper-wayhouse-broker-method", "rumour-broker"),
  choice("innkeeper-caravan-host-mastery", 50, "Caravan Host Mastery", "Choose route-support coordination or a federated network of accountable houses.", [
    option("route-support-factor", "Route Support Factor", "Coordinate verified lodging, water, feed, storage, ferries, repair, guides, escorts, messages, and contingency along a known corridor.", [
      action("innkeeper:plan-route-support", "Plan Route Support", "Map stages, capacities, contacts, prices, seasonal limits, cargo and animal needs, records, fallback, cancellations, warnings, and the point where specialist transport or security is required."),
      passive("innkeeper:route-support-factor", "Route Support Factor", "Prepared support reduces avoidable delay on known routes, never shortening distance, changing weather, guaranteeing passage, or granting Merchant ownership and Ranger fieldcraft."),
      proficiency("innkeeper:route-support-factor"),
    ]),
    option("network-innkeeper", "Network Innkeeper", "Federate independent houses around referral, safety, fair measure, worker protection, emergency aid, correction, audit, and exit.", [
      action("innkeeper:charter-wayhouse-league", "Charter a Wayhouse League", "Define membership, minimum standard, local autonomy, common marks, booking and referral, shared alerts, funds, complaints, inspection, correction, expulsion, succession, and dissolution."),
      passive("innkeeper:network-innkeeper", "Network Innkeeper", "A league can share learning and capacity while every house remains dependent on real staff, stores, buildings, local trust, and accountable governance."),
      proficiency("innkeeper:network-innkeeper"),
    ]),
  ], "innkeeper-wayhouse-broker-method", "caravan-host"),
]);

const FARMER_BRANCHES = Object.freeze([
  choice("farmer-practice", 10, "Agricultural Practice", "Choose the living production system that receives the deepest practice while general soil, water, labour, storage, welfare, and holding stewardship continue.", [
    option("field-cultivator", "Field Cultivator", "Build annual crop systems through seed, soil, rotation, water, timing, and harvest.", [
      action("farmer:design-field-system", "Design a Field System", "Connect plot history, seed, rotation, soil cover, cultivation, water, nutrient plan, weeds and pests, labour, harvest, storage, and review for a known crop sequence."),
      passive("farmer:field-cultivator", "Field Cultivator", "Repeated field records improve timing and diagnosis for known crops, never causing spontaneous growth, perfect yield, weather control, or Druid spellwork."),
      proficiency("farmer:field-cultivator"),
    ]),
    option("herd-keeper", "Herd Keeper", "Steward domesticated animals through welfare, pasture, breeding, feed, shelter, and traceable care.", [
      action("farmer:plan-herd-year", "Plan a Herd Year", "Map animals and groups, feed and pasture, water, shelter, breeding, births, disease prevention, work, movement, culling or sale, retirement, labour, and emergency care."),
      passive("farmer:herd-keeper", "Herd Keeper", "Consistent observation reveals changes in known animals earlier, without speech, telepathy, magical command, summoning, perfect diagnosis, or Ranger animal abilities."),
      proficiency("farmer:herd-keeper"),
    ]),
    option("orchard-keeper", "Orchard Keeper", "Work with perennial fruit, nuts, vines, grafts, groves, pollination, and long establishment.", [
      action("farmer:design-perennial-block", "Design a Perennial Block", "Choose species and varieties, rootstock, site, spacing, pollination, water, supports, floor, access, establishment care, harvest, replacement, and decades-long risk."),
      passive("farmer:orchard-keeper", "Orchard Keeper", "Long observation improves pruning, crop balance, and decline recognition in known perennials; mature trees, harvests, and compatible grafts still require time and biology."),
      proficiency("farmer:orchard-keeper"),
    ]),
    option("land-reclaimer", "Land Reclaimer", "Restore damaged soil, water, cover, habitat, and productive use through staged material practice.", [
      action("farmer:survey-damaged-land", "Survey Damaged Land", "Map cause, continuing source, soil and water condition, contamination, erosion, vegetation, access, ownership, affected people, risks, and evidence needed before intervention."),
      passive("farmer:land-reclaimer", "Land Reclaimer", "Staged restoration improves the chance of recovering function over time; it cannot cleanse unknown contamination, create topsoil, erase ownership, or force an ecosystem to a chosen state."),
      proficiency("farmer:land-reclaimer"),
    ]),
  ]),

  choice("farmer-field-cultivator-method", 30, "Field Cultivator Method", "Choose seed lineage or soil-process mastery as the mature field discipline.", [
    option("seed-steward", "Seed Steward", "Maintain crop identity, viability, diversity, adaptation, multiplication, rights, exchange, and emergency reserve.", [
      action("farmer:manage-seed-cycle", "Manage a Seed Cycle", "Plan accession, selection, isolation, population, harvest, cleaning, drying, storage, testing, regeneration, distribution, return, and loss response for a named seed lot."),
      passive("farmer:seed-steward", "Seed Steward", "Documented seed keeps identity and useful diversity more reliably, never guaranteeing purity, adaptation, germination, ownership, or harvest."),
      proficiency("farmer:seed-steward"),
    ]),
    option("soil-husband", "Soil Husband", "Manage living soil through cover, roots, organic matter, disturbance, compaction, water, nutrients, organisms, and measured correction.", [
      action("farmer:write-soil-husbandry-plan", "Write a Soil Husbandry Plan", "Combine profile, tests, crop need, cover, rotation, traffic, residue, amendments, erosion and water controls, field trials, indicators, and a review horizon."),
      passive("farmer:soil-husband", "Soil Husband", "Known soil responds more predictably to gradual tested practice; recovery remains slow and constrained by parent material, climate, contamination, water, and use."),
      proficiency("farmer:soil-husband"),
    ]),
  ], "farmer-practice", "field-cultivator"),
  choice("farmer-seed-steward-mastery", 50, "Seed Steward Mastery", "Choose community landrace stewardship or accountable crop improvement.", [
    option("landrace-keeper", "Landrace Keeper", "Preserve a diverse locally shaped crop population through many growers, environments, stories, selections, and shared access.", [
      action("farmer:steward-landrace", "Steward a Landrace", "Document origin and variation, recruit growers, set population and exchange practice, compare environments, retain broad samples, acknowledge contributors, and guard against accidental narrowing."),
      passive("farmer:landrace-keeper", "Landrace Keeper", "Distributed growing protects more diversity against one loss, while drift, crossing, poor storage, changing climate, and unequal access remain real."),
      proficiency("farmer:landrace-keeper"),
    ]),
    option("crop-improver", "Crop Improver", "Develop a crop population toward explicit goals through recorded selection, replicated comparison, diversity protection, and honest release.", [
      action("farmer:run-crop-improvement", "Run Crop Improvement", "Define traits and tradeoffs, source diverse parents lawfully, plan crossing or selection, test across sites and seasons, record failures, preserve fallback diversity, and publish evidence and limits."),
      passive("farmer:crop-improver", "Crop Improver", "Selection can shift heritable traits over generations, never instantly inventing characteristics or guaranteeing performance outside tested conditions."),
      proficiency("farmer:crop-improver"),
    ]),
  ], "farmer-field-cultivator-method", "seed-steward"),
  choice("farmer-soil-husband-mastery", 50, "Soil Husband Mastery", "Choose exact fertility accounting or landscape-scale erosion prevention.", [
    option("fertility-planner", "Fertility Planner", "Coordinate crop demand, soil supply, fixation, manure, compost, minerals, residues, timing, loss, water protection, and long-term balance.", [
      action("farmer:balance-regional-fertility", "Balance a Fertility Plan", "Reconcile field budgets and tests, prioritize deficiency without creating excess, sample amendments, stage application, protect workers and water, monitor crop response, and revise assumptions."),
      passive("farmer:fertility-planner", "Fertility Planner", "Material inputs are used more efficiently under measured conditions, but nutrients are never created and excessive, contaminated, mistimed, or unavailable inputs still harm."),
      proficiency("farmer:fertility-planner"),
    ]),
    option("erosion-farmer", "Erosion Farmer", "Coordinate cover, contour, terraces, waterways, buffers, shelter, access, and repair across connected slopes and fields.", [
      action("farmer:design-erosion-system", "Design an Erosion-Control System", "Model wind and water paths, soil vulnerability and extreme events, combine independent measures, secure outlets and maintenance, inspect after storms, and correct transferred harm."),
      passive("farmer:erosion-farmer", "Erosion Farmer", "Layered controls retain more soil and water within their design limits; exceptional events, neglected maintenance, upstream change, and unstable ground can overwhelm them."),
      proficiency("farmer:erosion-farmer"),
    ]),
  ], "farmer-field-cultivator-method", "soil-husband"),

  choice("farmer-herd-keeper-method", 30, "Herd Keeper Method", "Choose breeding and lineage stewardship or pasture-based herd movement and recovery.", [
    option("lineage-breeder", "Lineage Breeder", "Steward health, diversity, temperament, function, local adaptation, records, placement, and lifetime welfare across generations.", [
      action("farmer:audit-breeding-line", "Audit a Breeding Line", "Review ancestry, relatedness, traits and evidence, adverse outcomes, fertility, welfare, environment, demand, ownership, retirement, and reasons to pause or end the line."),
      passive("farmer:lineage-breeder", "Lineage Breeder", "Recorded selection improves informed mate choice over generations; it grants no instant mutation, perfect offspring, magical bond, or authority over an animal's behaviour."),
      proficiency("farmer:lineage-breeder"),
    ]),
    option("pasture-warden", "Pasture Warden", "Move animals through forage, water, shade, shelter, soil, parasites, weather, wildlife, and recovery as one grazing system.", [
      action("farmer:plan-grazing-system", "Plan a Grazing System", "Estimate forage and regrowth, group needs, paddocks and routes, water and shade, rest, weather triggers, parasite pressure, emergency feed, monitoring, and destocking thresholds."),
      passive("farmer:pasture-warden", "Pasture Warden", "Planned movement can protect forage and welfare in known conditions, never creating grass, ignoring drought, preventing disease, or commanding animals at a distance."),
      proficiency("farmer:pasture-warden"),
    ]),
  ], "farmer-practice", "herd-keeper"),
  choice("farmer-lineage-breeder-mastery", 50, "Lineage Breeder Mastery", "Choose rare-line preservation or welfare-centred production breeding.", [
    option("heritage-line-steward", "Heritage Line Steward", "Preserve a rare livestock population through verified ancestry, broad participation, cry or live reserves where available, and useful living roles.", [
      action("farmer:plan-heritage-line", "Plan Heritage-Line Stewardship", "Inventory animals and relatedness, recruit keepers, exchange safely, prioritize diversity and welfare, track births and losses, protect records, and plan disaster recovery."),
      passive("farmer:heritage-line-steward", "Heritage Line Steward", "Coordinated keepers reduce avoidable genetic loss, while small populations, disease, infertility, disasters, ownership, and changing livelihoods remain limiting."),
      proficiency("farmer:heritage-line-steward"),
    ]),
    option("welfare-breeder", "Welfare Breeder", "Select against suffering and fragility while balancing health, behaviour, function, diversity, environment, and realistic human use.", [
      action("farmer:review-welfare-traits", "Review Welfare Traits", "Use lifetime health and behaviour outcomes, not appearance alone, set exclusion and retirement rules, change housing or demand where genetics is not the cause, and publish adverse results."),
      passive("farmer:welfare-breeder", "Welfare Breeder", "Generational selection can reduce some inherited harms; environment, care, chance, hidden inheritance, and competing traits prevent guarantees."),
      proficiency("farmer:welfare-breeder"),
    ]),
  ], "farmer-herd-keeper-method", "lineage-breeder"),
  choice("farmer-pasture-warden-mastery", 50, "Pasture Warden Mastery", "Choose fine grazing allocation or recovery of degraded range.", [
    option("grazing-planner", "Grazing Planner", "Coordinate many groups, paddocks, seasons, forage types, water points, weather, wildlife, labour, and market or household needs.", [
      action("farmer:coordinate-grazing-plan", "Coordinate a Grazing Plan", "Set monitored forage and condition thresholds, sequence groups and recovery, protect sensitive areas, prepare drought and fire moves, record outcomes, and revise stocking honestly."),
      passive("farmer:grazing-planner", "Grazing Planner", "Better allocation can use forage more evenly and protect recovery, but land area, growth rate, access, water, animal needs, and extreme weather remain hard bounds."),
      proficiency("farmer:grazing-planner"),
    ]),
    option("range-restorer", "Range Restorer", "Recover overgrazed or eroded pasture through pressure removal, cover, water repair, reseeding where justified, invasive control, and monitored return.", [
      action("farmer:restore-rangeland", "Restore Rangeland", "Identify causes and reference condition, protect recovering ground, stabilize erosion, repair water distribution, test vegetation work, set grazing return criteria, and monitor beyond the first green season."),
      passive("farmer:range-restorer", "Range Restorer", "Recovery becomes more likely when pressure and causes change; lost soil, altered water, climate, invasive dominance, and continued access can prevent former function."),
      proficiency("farmer:range-restorer"),
    ]),
  ], "farmer-herd-keeper-method", "pasture-warden"),

  choice("farmer-orchard-keeper-method", 30, "Orchard Keeper Method", "Choose grafting and varietal work or whole-grove ecology and continuity.", [
    option("graftmaster", "Graftmaster", "Join compatible living material through clean cuts, cambial alignment, binding, aftercare, labelling, observation, and honest failure.", [
      action("farmer:plan-graft-work", "Plan Graft Work", "Verify identity and compatibility, choose rootstock, scion, method and timing, sanitize tools, label every union, protect and inspect it, remove failed or dangerous growth, and preserve records."),
      passive("farmer:graftmaster", "Graftmaster", "Practised technique improves the success of compatible grafts under good conditions, never making incompatible species unite, creating mature wood, or producing fruit immediately."),
      proficiency("farmer:graftmaster"),
    ]),
    option("grove-steward", "Grove Steward", "Manage canopy, floor, roots, pollination, water, pests, disease, habitat, access, harvest, replacement, and labour across perennial time.", [
      action("farmer:write-grove-plan", "Write a Grove Plan", "Map every block and age, health and gaps, pruning and renewal, soil and water, pollination, pressure, harvest, habitat, work safety, records, and staged replacement."),
      passive("farmer:grove-steward", "Grove Steward", "A documented grove retains function and diversity more reliably, while storms, disease, age, drought, market pressure, and long establishment remain real."),
      proficiency("farmer:grove-steward"),
    ]),
  ], "farmer-practice", "orchard-keeper"),
  choice("farmer-graftmaster-mastery", 50, "Graftmaster Mastery", "Choose a living varietal collection or a nursery capable of supplying healthy trees and vines.", [
    option("varietal-curator", "Varietal Curator", "Maintain a documented living collection of fruit, nut, vine, and perennial varieties through duplicate trees, propagation, description, use, and exchange.", [
      action("farmer:curate-living-varieties", "Curate Living Varieties", "Verify identity and provenance, map duplicates, record traits and environment, monitor disease, propagate safely, share access and recognition, and plan recovery after loss."),
      passive("farmer:varietal-curator", "Varietal Curator", "Distributed living copies preserve more material and knowledge, while mislabelling, disease, incompatibility, climate, and neglected care still cause loss."),
      proficiency("farmer:varietal-curator"),
    ]),
    option("nursery-master", "Nursery Master", "Produce traceable healthy planting material through mother stock, propagation, sanitation, growing, grading, hardening, transport, and establishment guidance.", [
      action("farmer:run-perennial-nursery", "Run a Perennial Nursery", "Control source stock, media and water, tools, lots, pests and disease, spacing, roots, training, grading, labels, rejects, customer fit, dispatch, and recall."),
      passive("farmer:nursery-master", "Nursery Master", "Verified nursery systems improve consistency and traceability; living plants remain variable, perishable, environment-dependent, and unable to guarantee establishment."),
      proficiency("farmer:nursery-master"),
    ]),
  ], "farmer-orchard-keeper-method", "graftmaster"),
  choice("farmer-grove-steward-mastery", 50, "Grove Steward Mastery", "Choose ecologically diverse orchard systems or continuity of a great perennial estate.", [
    option("orchard-ecologist", "Orchard Ecologist", "Integrate crop trees with pollinators, predators, soil life, understory, hedges, water, livestock where appropriate, and habitat monitoring.", [
      action("farmer:design-ecological-orchard", "Design an Ecological Orchard", "Set production and biodiversity goals, map habitat and pressure, diversify structure and bloom, limit harmful inputs, test interactions, monitor indicators, and retain practical harvest and access."),
      passive("farmer:orchard-ecologist", "Orchard Ecologist", "Diverse habitat can improve resilience and biological control, never guaranteeing balance, eliminating pests, or granting Druid command over living systems."),
      proficiency("farmer:orchard-ecologist"),
    ]),
    option("perennial-estate-steward", "Perennial Estate Steward", "Coordinate generations of establishment, production, renewal, labour, processing, records, finance, access, and succession around long-lived crops.", [
      action("farmer:plan-perennial-estate", "Plan a Perennial Estate", "Model age structure, replacement, varieties, water and soil, capital and labour, harvest and processing, disaster reserve, knowledge transfer, public claims, and succession over decades."),
      passive("farmer:perennial-estate-steward", "Perennial Estate Steward", "Staggered renewal and preserved knowledge reduce catastrophic continuity gaps; time, disease, climate, ownership, labour, and failed establishment remain decisive."),
      proficiency("farmer:perennial-estate-steward"),
    ]),
  ], "farmer-orchard-keeper-method", "grove-steward"),

  choice("farmer-land-reclaimer-method", 30, "Land Reclaimer Method", "Choose watershed repair or staged recovery of severely degraded productive land.", [
    option("watershed-keeper", "Watershed Keeper", "Restore water movement, infiltration, storage, quality, banks, wetlands, crossings, access, and shared use across connected holdings.", [
      action("farmer:survey-farm-watershed", "Survey a Farm Watershed", "Map sources, flows, withdrawals, pollution, erosion, flood and drought areas, habitat, structures, rights, users, monitoring, and the upstream causes of local symptoms."),
      passive("farmer:watershed-keeper", "Watershed Keeper", "Connected planning reduces displaced water harm, but cannot create rainfall, erase upstream decisions, purify unknown contamination, or override rights and ecology."),
      proficiency("farmer:watershed-keeper"),
    ]),
    option("reclamation-farmer", "Reclamation Farmer", "Stabilize and rebuild productive function after severe erosion, salinity, compaction, contamination, fire, flood, extraction, or abandonment.", [
      action("farmer:stage-land-reclamation", "Stage Land Reclamation", "Stop continuing damage, protect people and water, establish reference and test plots, repair physical function, introduce suitable cover, monitor contaminants and biology, and delay production until evidence supports it."),
      passive("farmer:reclamation-farmer", "Reclamation Farmer", "Staged work can recover some functions over years; irreversible loss, contamination, altered hydrology, climate, ownership, and unsafe use can demand limits or permanent exclusion."),
      proficiency("farmer:reclamation-farmer"),
    ]),
  ], "farmer-practice", "land-reclaimer"),
  choice("farmer-watershed-keeper-mastery", 50, "Watershed Keeper Mastery", "Choose shared irrigation governance or farming with restored wet areas and floodplains.", [
    option("irrigation-commons-steward", "Irrigation Commons Steward", "Coordinate shared source, storage, channels, gates, maintenance, allocation, quality, drought stages, records, conflicts, and investment.", [
      action("farmer:govern-irrigation-commons", "Govern an Irrigation Commons", "Measure supply, map users and rights, publish schedules and essential priorities, fund and assign maintenance, inspect losses, protect downstream flow, resolve disputes, audit, and amend."),
      passive("farmer:irrigation-commons-steward", "Irrigation Commons Steward", "Transparent measurement and shared maintenance improve reliability, never increasing the watershed's actual supply or eliminating unequal power and drought."),
      proficiency("farmer:irrigation-commons-steward"),
    ]),
    option("wetland-farmer", "Wetland Farmer", "Integrate restored wetlands, floodplain storage, seasonal grazing or harvest, water quality, habitat, access, and production limits.", [
      action("farmer:plan-wetland-holding", "Plan a Wetland Holding", "Map hydrology and seasonal variation, protect sensitive zones, define compatible use and exclusion, manage crossings and stock, monitor water and habitat, and prepare for flood, drought, and public access."),
      passive("farmer:wetland-farmer", "Wetland Farmer", "Compatible uses can coexist with restored water function when pressure stays bounded; wetlands remain dynamic, hazardous, ecologically complex, and not merely unused farmland."),
      proficiency("farmer:wetland-farmer"),
    ]),
  ], "farmer-land-reclaimer-method", "watershed-keeper"),
  choice("farmer-reclamation-farmer-mastery", 50, "Reclamation Farmer Mastery", "Choose accountable contaminated-land recovery or rapid post-disaster agricultural stabilization.", [
    option("contaminated-land-steward", "Contaminated-Land Steward", "Coordinate expert testing, access control, source removal, containment, remediation trials, crop or grazing exclusions, monitoring, records, and truthful land use.", [
      action("farmer:govern-contaminated-land", "Govern Contaminated Land", "Identify authority and affected people, map contaminants and pathways with specialists, prevent exposure, preserve evidence, test remedies, define use restrictions, communicate uncertainty, and maintain long monitoring."),
      passive("farmer:contaminated-land-steward", "Contaminated-Land Steward", "Disciplined governance prevents some exposure and false recovery claims; the Farmer cannot identify, neutralize, or safely farm every contaminant without specialist evidence."),
      proficiency("farmer:contaminated-land-steward"),
    ]),
    option("post-disaster-cultivator", "Post-Disaster Cultivator", "Restore essential water, seed, stock welfare, access, soil cover, tools, storage, labour, and short-cycle production after a major shock.", [
      action("farmer:stabilize-disaster-agriculture", "Stabilize Disaster Agriculture", "Assess people and animals first, protect contaminated areas, inventory surviving resources, secure water and seed, repair only critical systems, coordinate aid, choose realistic production, document ownership, and plan longer recovery."),
      passive("farmer:post-disaster-cultivator", "Post-Disaster Cultivator", "Prioritized recovery uses surviving resources more coherently, never restoring lost topsoil, herds, equipment, harvest, infrastructure, or livelihoods instantly."),
      proficiency("farmer:post-disaster-cultivator"),
    ]),
  ], "farmer-land-reclaimer-method", "reclamation-farmer"),
]);

const MERCHANT_BRANCHES = Object.freeze([
  choice("merchant-practice", 10, "Commercial Practice", "Choose the market function that receives the deepest practice while general appraisal, measure, contracts, accounts, risk, and responsible exchange continue.", [
    option("peddler", "Peddler", "Trade directly through local stalls, shops, roads, customer fit, small lots, and resilient relationships.", [
      action("merchant:plan-direct-trade", "Plan Direct Trade", "Match a truthful offer, stock, price, display, measures, payment, service, returns, safety, route or stall, and likely customer need within carried capacity."),
      passive("merchant:peddler", "Peddler", "Repeated direct contact improves practical knowledge of known customers and local demand, never compelling a sale, revealing private motives, or guaranteeing margin."),
      proficiency("merchant:peddler"),
    ]),
    option("caravan-factor", "Caravan Factor", "Coordinate cargo, carriers, routes, storage, customs, loss, and long-distance handoffs.", [
      action("merchant:plan-caravan-trade", "Plan Caravan Trade", "Define cargo and owners, route and alternates, packages, carriers, animals or vehicles, permits, tolls, stores, security, communications, handoffs, contingencies, and return load."),
      passive("merchant:caravan-factor", "Caravan Factor", "Documented logistics reduce avoidable loss on known routes, never shortening distance, changing weather, commanding carriers, or guaranteeing passage and profit."),
      proficiency("merchant:caravan-factor"),
    ]),
    option("guild-broker", "Guild Broker", "Work through specifications, tenders, contracts, wholesale lots, institutions, and negotiated supply.", [
      action("merchant:broker-institutional-supply", "Broker Institutional Supply", "Clarify authority and need, write a measurable specification, identify qualified sources, disclose conflicts, compare total terms, contract delivery and remedy, and audit performance."),
      passive("merchant:guild-broker", "Guild Broker", "Institutional language and records become easier to navigate, but the Broker gains no office, legal jurisdiction, hidden authority, or automatic access."),
      proficiency("merchant:guild-broker"),
    ]),
    option("credit-steward", "Credit Steward", "Govern bounded commercial credit, debt records, liquidity, risk, hardship, and responsible finance.", [
      action("merchant:write-credit-policy", "Write a Credit Policy", "Define purpose, eligibility evidence, limit, price, collateral, approvals, statements, hardship, default, collection boundaries, reserves, review, and prohibited exploitation."),
      passive("merchant:credit-steward", "Credit Steward", "Disciplined records and limits improve risk visibility; capital, repayment, solvency, trust, collateral, and market value remain finite and uncertain."),
      proficiency("merchant:credit-steward"),
    ]),
  ]),

  choice("merchant-peddler-method", 30, "Peddler Method", "Choose a rooted market place or an itinerant route of direct exchange.", [
    option("stallholder", "Stallholder", "Build a reliable public place of display, measure, service, safety, records, neighbour relations, and repeat custom.", [
      action("merchant:operate-market-stall", "Operate a Market Stall", "Plan lawful space, structure, display, stock security, clear prices, measures, samples, queue and access, cash, returns, waste, weather, and close-down."),
      passive("merchant:stallholder", "Stallholder", "A consistent visible place makes claims and service easier to verify, but location never guarantees attention, trust, safety, sales, or protection from competition."),
      proficiency("merchant:stallholder"),
    ]),
    option("itinerant-trader", "Itinerant Trader", "Carry a bounded assortment between underserved places through route knowledge, portable measures, repairable kit, and reciprocal local ties.", [
      action("merchant:plan-itinerant-round", "Plan an Itinerant Round", "Map communities, permissions, demand evidence, carried load, transport, rest and resupply, safe cash and records, messages, seasonal limits, alternatives, and return."),
      passive("merchant:itinerant-trader", "Itinerant Trader", "A repeated circuit improves realistic assortments and contacts, never granting Ranger travel abilities, guaranteed welcome, limitless inventory, or freedom from road hazards."),
      proficiency("merchant:itinerant-trader"),
    ]),
  ], "merchant-practice", "peddler"),
  choice("merchant-stallholder-mastery", 50, "Stallholder Mastery", "Choose a trusted specialty house or a plural neighbourhood market.", [
    option("specialty-house", "Specialty House", "Build depth in one bounded product family through provenance, comparison, fit, maintenance, returns, and long customer support.", [
      action("merchant:curate-specialty-house", "Curate a Specialty House", "Define scope and refused claims, qualify suppliers, build comparison and demonstration, train service, stock parts or support, record failures, and publish conflicts and guarantees."),
      passive("merchant:specialty-house", "Specialty House", "Deep product knowledge improves appraisal and fit within the documented specialty, never creating universal expertise or making every item authentic and suitable."),
      proficiency("merchant:specialty-house"),
    ]),
    option("market-hall-steward", "Market Hall Steward", "Coordinate independent stalls through fair allocation, measures, sanitation, fire safety, access, information, fees, complaints, and maintenance.", [
      action("merchant:govern-market-hall", "Govern a Market Hall", "Publish stall and fee rules, separate hazards, verify common measures, protect public and worker access, manage shared services, disclose conflicts, resolve complaints, audit, and rotate opportunity."),
      passive("merchant:market-hall-steward", "Market Hall Steward", "Shared infrastructure becomes more reliable when governance is transparent; the Steward gains no ownership of vendors, price control, or immunity from civic authority."),
      proficiency("merchant:market-hall-steward"),
    ]),
  ], "merchant-peddler-method", "stallholder"),
  choice("merchant-itinerant-trader-mastery", 50, "Itinerant Trader Mastery", "Choose remote-community service or an exchange route carrying goods, messages, and repair referrals.", [
    option("frontier-purveyor", "Frontier Purveyor", "Supply remote places through durable goods, spares, truthful substitution, seasonal reserve, local repair, fair scarcity terms, and dependable return.", [
      action("merchant:plan-frontier-supply", "Plan Frontier Supply", "Consult actual needs, calculate carrying and storage, prioritize essentials and repairability, publish scarcity price, protect reserve, arrange local custody, record requests, and avoid dependency traps."),
      passive("merchant:frontier-purveyor", "Frontier Purveyor", "Prepared assortments reduce some remote shortages, never creating stock, eliminating isolation, or granting authority over a community's choices and resources."),
      proficiency("merchant:frontier-purveyor"),
    ]),
    option("circuit-factor", "Circuit Factor", "Coordinate a regular multi-stop route of orders, consignments, returns, payments, messages, and verified local referrals.", [
      action("merchant:manage-trade-circuit", "Manage a Trade Circuit", "Set stops and windows, order cutoffs, title and custody, package records, cash and debt controls, delay communication, return handling, route evidence, and contingency partners."),
      passive("merchant:circuit-factor", "Circuit Factor", "A regular circuit improves consolidation and expectations on known routes, while distance, weather, law, loss, demand, and local alternatives remain real."),
      proficiency("merchant:circuit-factor"),
    ]),
  ], "merchant-peddler-method", "itinerant-trader"),

  choice("merchant-caravan-factor-method", 30, "Caravan Factor Method", "Choose route and carrier coordination or exact custody of complex cargo.", [
    option("route-factor", "Route Factor", "Maintain route, carrier, stage, permit, toll, seasonal, security, lodging, feed or fuel, and alternate-path evidence.", [
      action("merchant:write-route-book", "Write a Route Book", "Record dated stages, distances, capacities, contacts, costs, closures, hazards, customs, credible alternatives, source confidence, and changes without claiming a safe road is guaranteed."),
      passive("merchant:route-factor", "Route Factor", "Better route evidence reduces avoidable planning error, never granting Ranger navigation, control of terrain, official privilege, or immunity to new events."),
      proficiency("merchant:route-factor"),
    ]),
    option("cargo-steward", "Cargo Steward", "Protect mixed ownership and goods through packing, compatibility, manifests, seals, condition, custody, inspection, claims, and delivery.", [
      action("merchant:plan-cargo-custody", "Plan Cargo Custody", "Inventory owners and lots, classify hazards and conditions, design packages and stowage, assign handoffs and inspections, preserve title and seals, and define loss response."),
      passive("merchant:cargo-steward", "Cargo Steward", "Disciplined custody improves traceability and handling, never preventing every theft, breakage, spoilage, seizure, misdelivery, or dishonest declaration."),
      proficiency("merchant:cargo-steward"),
    ]),
  ], "merchant-practice", "caravan-factor"),
  choice("merchant-route-factor-mastery", 50, "Route Factor Mastery", "Choose a resilient trade corridor or difficult customs and border practice.", [
    option("corridor-coordinator", "Corridor Coordinator", "Link carriers, stages, warehouses, ferries, markets, repair, communication, emergency support, and shared standards along a route.", [
      action("merchant:coordinate-trade-corridor", "Coordinate a Trade Corridor", "Map capacity and bottlenecks, align schedules and records, qualify partners, establish disruption alerts and alternates, protect local access, reconcile service, fund common improvements, and audit."),
      passive("merchant:corridor-coordinator", "Corridor Coordinator", "A coordinated corridor can recover from ordinary disruption faster, but no network owns the road, border, weather, politics, carriers, or communities it crosses."),
      proficiency("merchant:corridor-coordinator"),
    ]),
    option("customs-master", "Customs Master", "Navigate complex classification, origin, valuation, permits, inspections, bonded custody, duty, appeal, and changing border rules lawfully.", [
      action("merchant:audit-customs-file", "Audit a Customs File", "Trace every declaration to source evidence, reconcile units and values, expose related parties, preserve inspections and payments, flag uncertainty, correct errors, and prepare lawful challenge."),
      passive("merchant:customs-master", "Customs Master", "Procedural knowledge reduces preventable delay and error, never granting exemption, bribery, false papers, hidden compartments, or control of an official decision."),
      proficiency("merchant:customs-master"),
    ]),
  ], "merchant-caravan-factor-method", "route-factor"),
  choice("merchant-cargo-steward-mastery", 50, "Cargo Steward Mastery", "Choose dangerous-goods governance or high-value provenance and custody.", [
    option("dangerous-cargo-factor", "Dangerous Cargo Factor", "Govern hazardous commercial goods through classification, packaging, separation, quantity, route, manifests, trained handlers, and incident response.", [
      action("merchant:govern-dangerous-cargo", "Govern Dangerous Cargo", "Verify lawful need and identity, set containment and incompatibilities, qualify carrier and route, provide emergency information, inspect handoffs, record residue, and refuse unsafe transport."),
      passive("merchant:dangerous-cargo-factor", "Dangerous Cargo Factor", "Correct controls reduce predictable exposure, never making explosive, toxic, infectious, corrosive, magical, or otherwise hazardous goods safe by paperwork."),
      proficiency("merchant:dangerous-cargo-factor"),
    ]),
    option("provenance-factor", "Provenance Factor", "Preserve title, origin, maker, excavation or collection, repair, ownership, restriction, valuation, custody, and claims for singular goods.", [
      action("merchant:build-provenance-file", "Build a Provenance File", "Gather independent records and testimony, map gaps and contested transfers, inspect marks and alterations, consult affected authorities, restrict sensitive data, and refuse unsupported certainty."),
      passive("merchant:provenance-factor", "Provenance Factor", "A stronger evidence chain improves informed trade but never proves every origin, authenticates by intuition, cures stolen title, or overrides cultural and legal claims."),
      proficiency("merchant:provenance-factor"),
    ]),
  ], "merchant-caravan-factor-method", "cargo-steward"),

  choice("merchant-guild-broker-method", 30, "Guild Broker Method", "Choose contract architecture or long-term supply and procurement coordination.", [
    option("contract-broker", "Contract Broker", "Turn complex exchange into exact scope, interfaces, change, evidence, risk allocation, remedy, and termination.", [
      action("merchant:structure-commercial-contract", "Structure a Commercial Contract", "Map parties and authority, dependencies, deliverables, acceptance, payment, records, changes, warranties, liability, force events, breach, cure, termination, dispute, and transition."),
      passive("merchant:contract-broker", "Contract Broker", "Precise terms reduce some ambiguity and opportunism, never guaranteeing performance, fairness, enforcement, solvency, or shared interpretation."),
      proficiency("merchant:contract-broker"),
    ]),
    option("supply-agent", "Supply Agent", "Represent a buyer's defined need through specification, sourcing, tender, inspection, delivery, inventory, supplier improvement, and conflict disclosure.", [
      action("merchant:manage-procurement", "Manage Procurement", "Confirm authority and budget, challenge unnecessary demand, write specification, research sources, compete fairly, document evaluation, contract and inspect, manage changes, and report total outcome."),
      passive("merchant:supply-agent", "Supply Agent", "Disciplined procurement improves evidence and comparability, never creating supply, erasing scarcity, authorizing corruption, or transferring the client's judgment entirely."),
      proficiency("merchant:supply-agent"),
    ]),
  ], "merchant-practice", "guild-broker"),
  choice("merchant-contract-broker-mastery", 50, "Contract Broker Mastery", "Choose multi-party commercial systems or distressed agreement restructuring.", [
    option("consortium-broker", "Consortium Broker", "Coordinate several independent parties whose scopes, interfaces, funds, evidence, risks, and exits must fit one undertaking.", [
      action("merchant:structure-consortium", "Structure a Consortium", "Define shared purpose and limits, contributions, lead and reserved decisions, interfaces, cost and revenue, records, intellectual and physical property, conflicts, default, replacement, exit, and dissolution."),
      passive("merchant:consortium-broker", "Consortium Broker", "Clear governance makes coordination more workable, never creating common interest, trust, competence, capital, or immunity from one member's failure."),
      proficiency("merchant:consortium-broker"),
    ]),
    option("workout-broker", "Workout Broker", "Restructure a failing commercial agreement to preserve viable work, fair claims, essential supply, and orderly exit rather than hide insolvency.", [
      action("merchant:broker-commercial-workout", "Broker a Commercial Workout", "Verify assets, cash, obligations and disputes, protect workers and client property, compare continuation and closure, negotiate standstill and revised terms, expose sacrifices, and set monitoring and failure triggers."),
      passive("merchant:workout-broker", "Workout Broker", "Transparent restructuring can reduce destructive collapse, never fabricating solvency or forcing creditors, debtors, workers, or partners to accept a loss."),
      proficiency("merchant:workout-broker"),
    ]),
  ], "merchant-guild-broker-method", "contract-broker"),
  choice("merchant-supply-agent-mastery", 50, "Supply Agent Mastery", "Choose public-interest procurement or supplier-system development.", [
    option("public-procurement-steward", "Public Procurement Steward", "Purchase for a community or institution through open need, equal information, conflicts, evaluation, records, complaints, delivery, and public value.", [
      action("merchant:govern-public-procurement", "Govern Public Procurement", "Publish plan and award criteria, consult users, separate roles, disclose interests, preserve bids and scoring, justify exceptions, monitor performance, publish material results, and protect challenge."),
      passive("merchant:public-procurement-steward", "Public Procurement Steward", "Visible process improves accountability, never granting public office, perfect competition, freedom from political pressure, or authority beyond the actual mandate."),
      proficiency("merchant:public-procurement-steward"),
    ]),
    option("supplier-development-factor", "Supplier Development Factor", "Help smaller or struggling suppliers meet real quality, safety, capacity, labour, record, and delivery needs without captive dependency.", [
      action("merchant:plan-supplier-development", "Plan Supplier Development", "Assess gaps jointly, separate mandatory from preferred change, provide staged orders and technical referrals, share forecasts, protect fair payment and ownership, verify progress, and preserve alternate buyers and exit."),
      passive("merchant:supplier-development-factor", "Supplier Development Factor", "Stable expectations and learning can improve capacity over time; capital, skill, materials, leadership, demand, and independent choice remain limiting."),
      proficiency("merchant:supplier-development-factor"),
    ]),
  ], "merchant-guild-broker-method", "supply-agent"),

  choice("merchant-credit-steward-method", 30, "Credit Steward Method", "Choose ledger-based commercial banking or explicit risk pooling and underwriting.", [
    option("ledger-banker", "Ledger Banker", "Safeguard deposits and payment records, extend bounded productive credit, maintain liquidity, and reconcile every claim and release.", [
      action("merchant:manage-commercial-ledger", "Manage a Commercial Ledger", "Separate client and house funds, authenticate instructions, record value date and fees, reconcile independently, set reserves and limits, issue statements, correct errors, and prepare for runs or failure."),
      passive("merchant:ledger-banker", "Ledger Banker", "Strong ledgers and liquidity controls reduce some error and panic, never creating money, guaranteeing deposits, predicting repayment, or making leverage harmless."),
      proficiency("merchant:ledger-banker"),
    ]),
    option("risk-underwriter", "Risk Underwriter", "Pool bounded uncertain loss through defined exposure, evidence, price, exclusions, reserves, prevention, claims, and review.", [
      action("merchant:underwrite-trade-risk", "Underwrite a Trade Risk", "Identify insured interest and period, gather exposure evidence, define covered events and exclusions plainly, estimate correlated loss, set premium and reserve, require prevention, and write claims procedure."),
      passive("merchant:risk-underwriter", "Risk Underwriter", "Risk pooling can distribute eligible financial loss, never preventing the event, restoring life or goods, guaranteeing claim payment, or covering undeclared certainty."),
      proficiency("merchant:risk-underwriter"),
    ]),
  ], "merchant-practice", "credit-steward"),
  choice("merchant-ledger-banker-mastery", 50, "Ledger Banker Mastery", "Choose resilient settlement systems or responsible enterprise finance.", [
    option("clearinghouse-steward", "Clearinghouse Steward", "Reconcile many reciprocal obligations through authenticated instructions, netting, reserves, settlement finality, exceptions, and transparent failure rules.", [
      action("merchant:operate-clearinghouse", "Operate a Clearinghouse", "Define participants and collateral, validate claims, match and net without hiding exposure, set cycles and finality, reconcile accounts, manage default waterfall, publish incidents, and permit orderly exit."),
      passive("merchant:clearinghouse-steward", "Clearinghouse Steward", "Structured settlement reduces redundant transfers and some counterparty confusion, never eliminating credit risk, liquidity need, fraud, legal dispute, or systemic concentration."),
      proficiency("merchant:clearinghouse-steward"),
    ]),
    option("enterprise-financier", "Enterprise Financier", "Provide bounded capital against a tested business plan, governance, cash evidence, downside protection, fair return, and a viable exit.", [
      action("merchant:structure-enterprise-finance", "Structure Enterprise Finance", "Assess purpose, people, market, costs, cash ranges, assets, risks and harms, choose debt or shared ownership terms, protect workers and essentials, set reporting and covenants, and plan distress without predation."),
      passive("merchant:enterprise-financier", "Enterprise Financier", "Careful finance can enable real capacity, never creating a viable enterprise, guaranteeing return, granting control beyond terms, or justifying extraction after failure."),
      proficiency("merchant:enterprise-financier"),
    ]),
  ], "merchant-credit-steward-method", "ledger-banker"),
  choice("merchant-risk-underwriter-mastery", 50, "Risk Underwriter Mastery", "Choose mutual protection or catastrophe-resilient commercial coverage.", [
    option("mutual-assurance-steward", "Mutual Assurance Steward", "Organize member-owned protection through shared exposure, contributions, prevention, claims, reserves, surplus, governance, and exit.", [
      action("merchant:charter-mutual-assurance", "Charter Mutual Assurance", "Define members and covered interests, assess comparable risk, collect and safeguard contributions, inspect prevention, adjudicate claims independently, publish accounts, handle extraordinary loss, and dissolve fairly."),
      passive("merchant:mutual-assurance-steward", "Mutual Assurance Steward", "Shared ownership aligns some incentives, while correlated loss, weak reserves, adverse selection, fraud, disputes, and unequal voice remain real."),
      proficiency("merchant:mutual-assurance-steward"),
    ]),
    option("catastrophe-underwriter", "Catastrophe Underwriter", "Build layered reserves, limits, triggers, reinsurance or reciprocal backing, claims logistics, and recovery finance for rare large commercial loss.", [
      action("merchant:plan-catastrophe-cover", "Plan Catastrophe Cover", "Model plausible event ranges and correlation, cap concentration, diversify backing, define objective triggers and exclusions, test liquidity and claims surge, communicate uncovered loss, and rehearse failure."),
      passive("merchant:catastrophe-underwriter", "Catastrophe Underwriter", "Prepared layers can fund a bounded share of eligible recovery, never predicting or preventing catastrophe, covering infinite loss, or replacing public and community response."),
      proficiency("merchant:catastrophe-underwriter"),
    ]),
  ], "merchant-credit-steward-method", "risk-underwriter"),
]);

export const PROFESSION_BRANCHES = Object.freeze({
  wizard: WIZARD_BRANCHES,
  wanderer: twoStage("wanderer", branch("Borrowed Discipline", "Choose how experience is gathered.", "road-scholar", "Road Scholar", "Learn from places and records.", "jack-of-all-trades", "Jack of All Trades", "Learn quickly from practical exposure."), branch("Wandering Mastery", "Choose a mature wandering method.", "pathfinder", "Pathfinder", "Master routes and discovery.", "adaptive-master", "Adaptive Master", "Change disciplines without losing momentum.")),
  fighter: WARRIOR_BRANCHES,
  barbarian: BARBARIAN_BRANCHES,
  ranger: RANGER_BRANCHES,
  rogue: ROGUE_BRANCHES,
  cleric: CLERIC_BRANCHES,
  paladin: PALADIN_BRANCHES,
  sorcerer: SORCERER_BRANCHES,
  warlock: WARLOCK_BRANCHES,
  druid: DRUID_BRANCHES,
  monk: MONK_BRANCHES,
  bard: BARD_BRANCHES,
  artificer: ARTIFICER_BRANCHES,
  innkeeper: INNKEEPER_BRANCHES,
  farmer: FARMER_BRANCHES,
  merchant: MERCHANT_BRANCHES,
  artisan: twoStage("artisan", branch("Craft Discipline", "Choose the artisan's material practice.", "smith", "Smith", "Metal, heat, and durable tools.", "fine-crafter", "Fine Crafter", "Precision, ornament, and delicate work."), branch("Masterwork Tradition", "Choose an advanced craft legacy.", "guild-master", "Guild Master", "Teach and coordinate a tradition.", "legendary-maker", "Legendary Maker", "Create singular works known by name.")),
  labourer: twoStage("labourer", branch("Working Discipline", "Choose the labourer's central strength.", "builder", "Builder", "Structures, foundations, and safe work.", "teamster", "Teamster", "Hauling, logistics, and coordinated movement."), branch("Guild Authority", "Choose an advanced labour identity.", "foreman", "Foreman", "Lead crews and complex work.", "master-builder", "Master Builder", "Plan works at civic scale.")),
  scholar: twoStage("scholar", branch("Field of Study", "Choose the scholar's central method.", "historian", "Historian", "Sources, chronology, and living memory.", "natural-philosopher", "Natural Philosopher", "Observation, experiment, and explanation."), branch("Scholarly Mastery", "Choose an advanced scholarly office.", "archivist", "Archivist", "Preserve and connect vast records.", "polymath", "Polymath", "Synthesize multiple disciplines.")),
  healer: twoStage("healer", branch("Medical Practice", "Choose the healer's central method.", "chirurgeon", "Chirurgeon", "Surgery, trauma, and anatomy.", "physician", "Physician", "Diagnosis, disease, and long care."), branch("Medical Mastery", "Choose an advanced medical legacy.", "master-surgeon", "Master Surgeon", "Perform otherwise impossible operations.", "life-preserver", "Life Preserver", "Prevent death through systems of care.")),
  performer: twoStage("performer", branch("Performance Art", "Choose the performer's principal medium.", "actor", "Actor", "Character, speech, and dramatic presence.", "musician", "Musician", "Voice, instrument, rhythm, and song."), branch("Virtuoso Legacy", "Choose an advanced artistic identity.", "crowd-captivator", "Crowd Captivator", "Command a live audience.", "master-artist", "Master Artist", "Create work that survives generations.")),
  mariner: twoStage("mariner", branch("Seafaring Duty", "Choose the mariner's principal responsibility.", "navigator", "Navigator", "Stars, charts, currents, and routes.", "shipmaster", "Shipmaster", "Crew, vessel, cargo, and command."), branch("Ocean Mastery", "Choose an advanced maritime identity.", "tide-master", "Tide Master", "Read impossible waters.", "fleet-captain", "Fleet Captain", "Coordinate many ships and ports.")),
  diplomat: twoStage("diplomat", branch("Diplomatic Practice", "Choose the diplomat's primary method.", "mediator", "Mediator", "Trust, listening, and durable compromise.", "envoy", "Envoy", "Protocol, representation, and formal terms."), branch("Grand Diplomacy", "Choose an advanced diplomatic identity.", "treaty-maker", "Treaty Maker", "Bind realms into lasting agreements.", "spymaster-envoy", "Spymaster Envoy", "Use intelligence and secrets as leverage.")),
  courtier: twoStage("courtier", branch("Courtly Practice", "Choose the courtier's preferred currency.", "socialite", "Socialite", "Attention, access, and introductions.", "intriguer", "Intriguer", "Secrets, factions, and hidden pressure."), branch("Court Dominion", "Choose an advanced courtly identity.", "kingmaker", "Kingmaker", "Shape succession and public legitimacy.", "velvet-tyrant", "Velvet Tyrant", "Control a court without holding its throne.")),
  steward: twoStage("steward", branch("Stewardship Office", "Choose the steward's central responsibility.", "house-steward", "House Steward", "Staff, routine, and household continuity.", "estate-steward", "Estate Steward", "Land, stores, tenants, and accounts."), branch("Great Stewardship", "Choose an advanced institutional role.", "seneschal", "Seneschal", "Coordinate a great household or court.", "realm-administrator", "Realm Administrator", "Make government function at scale.")),
  ruler: twoStage("ruler", branch("Mode of Rule", "Choose how authority is exercised.", "lawgiver", "Lawgiver", "Institutions, law, and durable order.", "war-sovereign", "War Sovereign", "Loyalty, conquest, and military authority."), branch("Sovereign Legacy", "Choose an advanced governing legacy.", "realm-builder", "Realm Builder", "Create institutions that outlive the ruler.", "absolute-sovereign", "Absolute Sovereign", "Concentrate the realm into one will.")),
  commander: twoStage("commander", branch("Command Doctrine", "Choose the commander's central method.", "strategist", "Strategist", "Planning, intelligence, and terrain.", "battle-leader", "Battle Leader", "Presence and direct battlefield command."), branch("High Command", "Choose an advanced command office.", "field-marshal", "Field Marshal", "Coordinate armies and campaigns.", "warlord", "Warlord", "Bind warriors through victory and personal force.")),
  attendant: twoStage("attendant", branch("Household Service", "Choose the attendant's central trust.", "body-attendant", "Body Attendant", "Personal care, confidence, and anticipation.", "chamber-attendant", "Chamber Attendant", "Rooms, routine, messages, and access."), branch("Perfect Service", "Choose an advanced service identity.", "confidant", "Confidant", "Become an indispensable keeper of private truth.", "household-master", "Household Master", "Coordinate service without visible friction.")),
});

export function professionBranchChoices(professionId) {
  return PROFESSION_BRANCHES[professionId] || Object.freeze([]);
}

export function normalizeBranchChoices(professionId, branchChoices = {}, specializationPath = []) {
  const definitions = professionBranchChoices(professionId);
  const normalized = {};
  const entries = Array.isArray(branchChoices)
    ? branchChoices.map((entry) => [entry.choiceId || entry.id, entry.optionId || entry.option])
    : Object.entries(branchChoices || {});
  for (const [choiceId, optionId] of entries) {
    const definition = definitions.find((entry) => entry.id === choiceId);
    if (definition?.options.some((entry) => entry.id === optionId)) normalized[choiceId] = optionId;
  }
  for (const optionId of (Array.isArray(specializationPath) ? specializationPath : [specializationPath]).filter(Boolean)) {
    const definition = definitions.find((entry) => entry.options.some((candidate) => candidate.id === optionId));
    if (definition && !normalized[definition.id]) normalized[definition.id] = optionId;
  }
  return normalized;
}

export function pendingBranchChoices(professionId, level, selections = {}) {
  return professionBranchChoices(professionId).filter((definition) => {
    if (level < definition.threshold || selections[definition.id]) return false;
    if (!definition.parentChoiceId) return true;
    return selections[definition.parentChoiceId] === definition.parentOptionId;
  });
}

export function branchGrantsAtLevel(professionId, level, selections = {}) {
  const grants = [];
  for (const definition of professionBranchChoices(professionId)) {
    if (definition.threshold !== level) continue;
    if (definition.parentChoiceId && selections[definition.parentChoiceId] !== definition.parentOptionId) continue;
    const optionId = selections[definition.id];
    if (!optionId) continue;
    const selected = definition.options.find((entry) => entry.id === optionId);
    if (selected) grants.push(...selected.grants);
  }
  return grants;
}
