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

export const PROFESSION_BRANCHES = Object.freeze({
  wizard: WIZARD_BRANCHES,
  wanderer: twoStage("wanderer", branch("Borrowed Discipline", "Choose how experience is gathered.", "road-scholar", "Road Scholar", "Learn from places and records.", "jack-of-all-trades", "Jack of All Trades", "Learn quickly from practical exposure."), branch("Wandering Mastery", "Choose a mature wandering method.", "pathfinder", "Pathfinder", "Master routes and discovery.", "adaptive-master", "Adaptive Master", "Change disciplines without losing momentum.")),
  fighter: WARRIOR_BRANCHES,
  barbarian: BARBARIAN_BRANCHES,
  ranger: twoStage("ranger", branch("Ranger Conclave", "Choose the ranger's field discipline.", "hunter", "Hunter", "Patient pursuit and killing shots.", "beast-warden", "Beast-Warden", "Partnership with trained beasts."), branch("Wilderness Mastery", "Choose an advanced wilderness focus.", "dragon-hunter", "Dragon-Hunter", "Colossal quarry and anti-monster tactics.", "horizon-walker", "Horizon Walker", "Extreme travel and hostile terrain.")),
  rogue: twoStage("rogue", branch("Roguish Practice", "Choose the rogue's preferred leverage.", "assassin", "Assassin", "Infiltration and decisive killing.", "thief", "Thief", "Access, traps, and acquisition."), branch("Underworld Mastery", "Choose an advanced covert identity.", "shadowblade", "Shadowblade", "Supernatural concealment and precision.", "mastermind", "Mastermind", "Plans, contacts, and manipulated outcomes.")),
  cleric: CLERIC_BRANCHES,
  paladin: twoStage("paladin", branch("Sacred Oath", "Choose the oath that directs power.", "devotion", "Devotion", "Protection, truth, and radiant duty.", "vengeance", "Vengeance", "Pursuit and punishment of sworn foes."), branch("Consecrated Office", "Choose an advanced oath expression.", "holy-shield", "Holy Shield", "Become a sanctuary for allies.", "divine-avenger", "Divine Avenger", "Turn judgment into irresistible pursuit.")),
  sorcerer: SORCERER_BRANCHES,
  warlock: twoStage("warlock", branch("Pact Source", "Choose the power behind the bargain.", "infernal-pact", "Infernal Pact", "Hellfire, command, and costly power.", "fae-pact", "Fae Pact", "Glamour, weather, and binding words."), branch("Pact Mastery", "Choose how the pact relationship changes.", "chain-binder", "Chain Binder", "Command patrons, summons, and thralls.", "forbidden-vessel", "Forbidden Vessel", "Carry more patron power within yourself.")),
  druid: twoStage("druid", branch("Primal Circle", "Choose a relationship with the living world.", "moon-circle", "Circle of the Moon", "Transformation and beasts.", "land-circle", "Circle of the Land", "Terrain, growth, and weather."), branch("Elder Mystery", "Choose an advanced primal mystery.", "archdruid", "Archdruid", "Balance many primal forms.", "worldroot", "Worldroot", "Bind places into a living network.")),
  monk: MONK_BRANCHES,
  bard: twoStage("bard", branch("Bardic College", "Choose the art behind the bard's influence.", "lore-college", "College of Lore", "Stories, secrets, and broad magic.", "valour-college", "College of Valour", "Courage and battlefield performance."), branch("Legendary Performance", "Choose an advanced performance identity.", "world-singer", "World Singer", "Move crowds and shape memory.", "spell-virtuoso", "Spell Virtuoso", "Bind magic into perfected performance.")),
  artificer: twoStage("artificer", branch("Arcane Workshop", "Choose the artificer's primary craft.", "armorer", "Armorer", "Protective devices and enchanted armour.", "alchemist", "Alchemist", "Catalysts, elixirs, and transformations."), branch("Master Invention", "Choose an advanced invention discipline.", "construct-smith", "Construct Smith", "Create autonomous arcane works.", "relic-maker", "Relic Maker", "Create singular enduring artifacts.")),
  innkeeper: twoStage("innkeeper", branch("House Character", "Choose what the house is known for.", "sanctuary-house", "Sanctuary House", "Safety, discretion, and refuge.", "public-house", "Public House", "News, crowds, and local belonging."), branch("Great Establishment", "Choose the mature institution.", "information-hub", "Information Hub", "A network built from guests and rumours.", "grand-host", "Grand Host", "Hospitality at courtly scale.")),
  farmer: twoStage("farmer", branch("Agricultural Practice", "Choose the farm's central discipline.", "crop-master", "Crop Master", "Soil, seed, and harvest.", "stock-master", "Stock Master", "Breeding, health, and animal husbandry."), branch("Land Mastery", "Choose an advanced agricultural legacy.", "estate-farmer", "Estate Farmer", "Coordinate land and many workers.", "greenwarden", "Greenwarden", "Restore damaged and exhausted land.")),
  merchant: twoStage("merchant", branch("Commercial Practice", "Choose the merchant's central market.", "caravan-factor", "Caravan Factor", "Routes, cargo, and distant supply.", "guild-broker", "Guild Broker", "Credit, contracts, and institutional trade."), branch("Market Dominion", "Choose an advanced commercial identity.", "merchant-prince", "Merchant Prince", "Capital and influence at civic scale.", "market-maker", "Market Maker", "Create demand and entirely new trade.")),
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
