// Wizard is authored as its own profession, not stamped from a shared caster
// template. These are the continuing general rewards; school and deeper
// specialization rewards are overlaid independently by profession-branches.js.

const grant = (type, id, details = {}) => Object.freeze({ type, id, ...details });
const ability = (id) => grant("ability", id);
const action = (id, name, description) => grant("action", id, { name, description });
const passive = (id, name, description) => grant("passive", id, { name, description });
const circle = (rank) => grant("proficiency", `wizard:arcane-circle-${rank}`, {
  name: `${["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"][rank - 1]} Arcane Circle`,
  description: `May learn and prepare wizard workings of arcane circle ${rank}.`,
});
const row = (feature, description, grants = []) => Object.freeze({ feature, description, grants: Object.freeze(grants) });

const ROWS = [
  row("The First Spellbook", "Begin a written spellbook and learn to prepare a small set of exact formulae.", [circle(1), ability("arcane-bolt"), passive("wizard-prepared-casting", "Prepared Casting", "Choose workings from the spellbook when preparing for danger.")]),
  row("Arcane Notation", "Read and write the shared mathematical notation used by trained wizards.", [action("inscribe-spell", "Inscribe Spell", "Copy a discovered wizard formula into a spellbook with suitable time and materials.")]),
  row("Cantrip Breadth", "Add a second reliable expression of force without narrowing future study.", [ability("firebolt")]),
  row("Ritual Fundamentals", "Stretch safe formulae into slower workings that trade speed for reach and precision.", [action("cast-ritual", "Cast Ritual", "Perform an eligible wizard working as a longer ritual outside immediate combat.")]),
  row("Elemental Primer", "Establish the thermal and crystalline principles shared by several schools.", [ability("ice-shard")]),
  row("Mnemonic Lattice", "Organize prepared formulae into a mental lattice resistant to distraction.", [passive("wizard-mnemonic-lattice", "Mnemonic Lattice", "Prepared workings are harder to disrupt or forget under pressure.")]),
  row("Ward Primer", "Learn the first portable equation that turns mana aside before it reaches flesh.", [ability("mana-shield")]),
  row("Second Arcane Circle", "Open the second circle of formal wizard study and its denser spell structures.", [circle(2)]),
  row("Focused Projection", "Shape cold into a narrow, repeatable line instead of a wasteful burst.", [ability("frost-lance")]),
  row("School Declaration", "General study continues, but a chosen school now begins granting its own rewards."),
  row("Measured Components", "Reduce waste by matching gesture, reagent, and spoken cadence exactly.", [passive("wizard-component-economy", "Component Economy", "Routine wizard preparations consume fewer ordinary materials.")]),
  row("Material Ward", "Bind transmutative density around the body without surrendering mobility.", [ability("stone-armor")]),
  row("Read the Weave", "Recognize the school, structure, and likely purpose of a visible enchantment.", [action("identify-enchantment", "Identify Enchantment", "Study a magical effect or item to reveal its school and operating principle.")]),
  row("Hostile Syntax", "Learn the compact syntax by which a wizard turns a formula against another will.", [ability("combust")]),
  row("Third Arcane Circle", "Gain access to stable multi-part formulae of the third circle.", [circle(3)]),
  row("Defensive Preparation", "Reserve part of every preparation for interruption, escape, or warding.", [passive("wizard-defensive-preparation", "Defensive Preparation", "A prepared wizard can respond more safely to an unexpected magical threat.")]),
  row("Binding Clause", "Add a persistent hostile clause that clings after the first casting.", [ability("hex")]),
  row("Controlled Detonation", "Release stored cold across an area without losing the center of the working.", [ability("frost-nova")]),
  row("Ritual Geometry", "Lay out larger circles whose geometry can involve several assistants or locations.", [action("establish-ritual-circle", "Establish Ritual Circle", "Prepare a stable site for complex or collaborative wizard rituals.")]),
  row("Expanded Spellbook", "Increase the number and variety of formulae that can be maintained in active study.", [passive("wizard-expanded-spellbook", "Expanded Spellbook", "Maintain a broader library of learned wizard spells.")]),
  row("Conductive Formula", "Guide lightning through a chosen path instead of trusting its appetite.", [ability("electrocute")]),
  row("Fourth Arcane Circle", "Open the fourth circle, where battlefield-scale workings become dependable.", [circle(4)]),
  row("Thermal Inversion", "Push a target past ordinary cold into a moment of arrested motion.", [ability("deep-freeze")]),
  row("Battlefield Sphere", "Balance heat, pressure, and distance in the archetypal explosive formula.", [ability("fireball")]),
  row("Arcane Recovery", "Reconstruct expended mental patterns during a deliberate pause.", [action("recover-arcane-reserve", "Arcane Recovery", "Recover part of expended magical capacity during safe rest and study.")]),
  row("Comparative Schools", "Find shared principles between opposed schools without diluting either.", [passive("wizard-comparative-schools", "Comparative Schools", "Cross-school study makes unfamiliar wizard formulae easier to understand.")]),
  row("Linear Lightning", "Compress a storm discharge into a line capable of piercing several defenses.", [ability("lightning-bolt")]),
  row("Fifth Arcane Circle", "Gain access to fifth-circle formulae and their greater preparation burden.", [circle(5)]),
  row("Counter-Theory", "Understand a hostile spell well enough to pull at the theorem holding it together.", [ability("dispel")]),
  row("Greater School Threshold", "Your chosen school may now divide into a deeper discipline while general study continues."),
  row("Spell Sequencing", "Prepare two related formulae so the first leaves the exact conditions required by the second.", [passive("wizard-spell-sequencing", "Spell Sequencing", "Related prepared spells can be chained with less wasted motion.")]),
  row("Contingent Ward", "Suspend a defensive fragment until a declared danger supplies its final term.", [action("establish-contingency", "Establish Contingency", "Bind an eligible protective working to a specific future trigger.")]),
  row("Weather Equation", "Model wind, charge, and pressure as a single violent system.", [ability("blizzard")]),
  row("Spell Penetration", "Identify the load-bearing assumption inside a ward and drive power through it.", [passive("wizard-spell-penetration", "Spell Penetration", "Wizard workings more effectively contest magical wards.")]),
  row("Sustained Acceleration", "Alter local time and motion without letting the formula tear itself apart.", [ability("haste")]),
  row("Sixth Arcane Circle", "Open the sixth circle of high wizardry.", [circle(6)]),
  row("Efficient Preparation", "Compress familiar formulae without losing the annotations that keep them safe.", [passive("wizard-efficient-preparation", "Efficient Preparation", "Prepare familiar wizard spells in less time.")]),
  row("Forked Conduction", "Let lightning choose several victims while retaining control of every branch.", [ability("chain-lightning")]),
  row("Arcane Synthesis", "Build one working from principles normally taught in separate schools.", [action("devise-spell", "Devise Spell", "Research a new wizard formula from known arcane principles.")]),
  row("Living Archive", "Index a large spellbook by relationship and theorem rather than page order.", [passive("wizard-living-archive", "Living Archive", "Recall the location and dependencies of any personally recorded formula.")]),
  row("Rapid Notation", "Capture an unfamiliar magical structure before its evidence fades.", [action("record-spell-structure", "Record Spell Structure", "Make a field notation of a witnessed spell for later research.")]),
  row("Storm Dominion", "Sustain a violent atmospheric working across the whole field.", [ability("tempest")]),
  row("Seventh Arcane Circle", "Enter the seventh circle, where a wizard can alter the terms of a battle or place.", [circle(7)]),
  row("Planar Calculus", "Calculate correspondences between distant places and adjacent layers of reality.", [passive("wizard-planar-calculus", "Planar Calculus", "Analyze portals, summoning boundaries, and planar disturbances.")]),
  row("Greater Countermagic", "Prepare negation as a discipline rather than a single emergency formula.", [passive("wizard-greater-countermagic", "Greater Countermagic", "Dispel and counter-working are more reliable against complex magic.")]),
  row("Immutable Formula", "Hold a prepared spell intact through pain, noise, and hostile magical pressure.", [passive("wizard-immutable-formula", "Immutable Formula", "Severe distraction is less likely to break a prepared working.")]),
  row("Battlefield Geometry", "Treat allies, obstacles, and moving enemies as variables in one cast.", [passive("wizard-battlefield-geometry", "Battlefield Geometry", "Place large wizard effects with greater precision around allies.")]),
  row("Temporal Interstice", "Find the narrow pause between moments and force it open.", [ability("time-stop")]),
  row("Eighth Arcane Circle", "Open the eighth circle of grand wizardry.", [circle(8)]),
  row("Final School Threshold", "A sufficiently deep specialist may now choose the ultimate expression of that school."),
  row("Grand Thesis", "Unify decades of study into a theory that other wizards can test and inherit.", [action("author-arcane-thesis", "Author Arcane Thesis", "Create a durable scholarly work that teaches a new arcane principle.")]),
  row("Spell Echo", "Preserve the fading outline of a cast long enough to study or reinforce it.", [passive("wizard-spell-echo", "Spell Echo", "Recently cast wizard formulae leave a readable arcane afterimage.")]),
  row("Ritual Mastery", "Coordinate long workings whose costs and consequences span days.", [action("conduct-grand-ritual", "Conduct Grand Ritual", "Lead a high-order ritual involving rare components, assistants, or a great site.")]),
  row("Ninth Arcane Circle", "Enter the ninth circle, where individual workings can decide realms.", [circle(9)]),
  row("Perfected Preparation", "Prepare a dense high-circle formula without allowing one unsafe ambiguity.", [passive("wizard-perfect-preparation", "Perfected Preparation", "High-circle wizard spells are prepared with exceptional stability.")]),
  row("Falling Star Theorem", "Call a fragment of celestial ruin through a precisely bounded descent.", [ability("meteor")]),
  row("Grand Wardcraft", "Design wards as layered systems with sacrifice, redundancy, and recovery.", [action("design-grand-ward", "Design Grand Ward", "Create a persistent, layered magical defense for a place or institution.")]),
  row("Arcane Dominion", "Impose a coherent magical law across a prepared site.", [passive("wizard-arcane-dominion", "Arcane Dominion", "Wizard rituals exert stronger control inside a personally prepared domain.")]),
  row("World-Scale Ritual", "Model consequences beyond a room, battlefield, or single lifetime.", [passive("wizard-world-scale-ritual", "World-Scale Ritualist", "Can safely plan rituals whose consequences reach cities or regions.")]),
  row("Tenth Arcane Circle", "Open the final formal circle of mortal wizard study.", [circle(10)]),
  row("Counterfactual Casting", "Prepare for several possible outcomes and complete only the formula reality requires.", [passive("wizard-counterfactual-casting", "Counterfactual Casting", "Apex preparation preserves more than one valid response to uncertain conditions.")]),
  row("Unmaking Ray", "Reduce a material target to an argument reality no longer accepts.", [ability("disintegrate")]),
  row("Perfect Spellbook", "Every annotation, correction, and failed theorem becomes part of one navigable whole.", [passive("wizard-perfect-spellbook", "Perfect Spellbook", "The spellbook functions as a complete personal model of arcane practice.")]),
  row("Mana Sovereignty", "Circulate arcane power through body, focus, and prepared space without waste.", [passive("wizard-mana-sovereignty", "Mana Sovereignty", "Apex wizard workings use magical reserves with exceptional economy.")]),
  row("Grand Universal Theory", "Explain several schools through one deeper law without erasing their distinctions.", [action("formulate-grand-theory", "Formulate Grand Theory", "Research a principle capable of changing how several schools are understood.")]),
  row("Reality Notation", "Read physical law itself as a notation that can be amended at terrible cost.", [passive("wizard-reality-notation", "Reality Notation", "Recognize the arcane structure behind otherwise impossible phenomena.")]),
  row("Spellbook Without End", "Create a self-ordering archive able to accept new magic without losing old truth.", [action("create-endless-spellbook", "Create Endless Spellbook", "Construct an apex grimoire that can safely contain an extraordinary body of magic.")]),
  row("Lawgiver's Preparation", "Prepare magic by declaring the local law it must obey.", [passive("wizard-lawgiver-preparation", "Lawgiver's Preparation", "Prepared workings resist lesser attempts to alter or negate their terms.")]),
  row("Master of Ten Circles", "Move between every formal circle of wizardry without losing the exact scale of the working at hand.", [passive("wizard-ten-circles", "Master of Ten Circles", "All ten arcane circles remain available as one practiced continuum.")]),
  row("Wizard Apogee", "General wizard study reaches its mortal apex: breadth, preparation, ritual, and theory held as one discipline.", [passive("wizard-apogee", "Wizard Apogee", "The broad spellbook and every mastered arcane circle operate as one coherent practice.")]),
];

if (ROWS.length !== 70) throw new Error(`Wizard progression must contain 70 authored levels, received ${ROWS.length}`);

export const WIZARD_PROGRESSION_LEVELS = Object.freeze(ROWS.map((entry, index) => Object.freeze({
  level: index + 1,
  name: entry.feature,
  ...entry,
})));
