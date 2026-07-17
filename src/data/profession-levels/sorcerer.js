// Sorcerer is authored independently: one early primary signature expands into
// a compact multi-signature repertoire. General metamagic specialization grows
// from one to four spells; branches decide depth versus independent profiles.

const grant = (type, id, details = {}) => Object.freeze({ type, id, ...details });
const action = (id, name, description) => grant("action", id, { name, description });
const passive = (id, name, description, details = {}) => grant("passive", id, { name, description, ...details });
const proficiency = (id, name, description) => grant("proficiency", id, { name, description });
const row = (name, description, grants = []) => Object.freeze({ name, feature: name, description, grants: Object.freeze(grants) });

const SIGNATURE_SPELLS = Object.freeze([
  "firebolt", "frost-lance", "combust", "lightning-bolt",
  "fireball", "chain-lightning", "tempest", "meteor",
]);
const METAMAGIC = Object.freeze([
  "empowered-signature", "shaped-signature", "quickened-signature",
  "twinned-signature", "piercing-signature", "transmuted-signature",
  "perfected-signature",
]);

const signatureChoice = () => grant("ability-choice", "sorcerer-signature-spell", {
  name: "Signature Spell",
  description: "Choose the spell innate power answers most readily; later Sorcerer features refine this spell above all others.",
  options: SIGNATURE_SPELLS,
  count: 1,
  selectionKey: "signatureSpellId",
  signature: true,
});
const metamagicChoice = (slot) => grant("metamagic-choice", `sorcerer-metamagic-${slot + 1}`, {
  name: `Signature Metamagic ${slot + 1}`,
  description: "Choose a distinct magical modification. General Sorcerer progression lets the chosen metamagic apply to more personal spells over time.",
  options: METAMAGIC,
  count: 1,
  selectionKey: "metamagicIds",
  slot,
  appliesTo: "sorcerer-repertoire",
});
const exchangeChoice = (level) => grant("ability-choice", `sorcerer-signature-exchange-${level}`, {
  name: `Signature Exchange ${level}`,
  description: "Keep the current primary signature or move that focus to another spell. The former primary is retained only if independently chosen for the repertoire; transferable signature refinements move to the new focus.",
  options: SIGNATURE_SPELLS,
  count: 1,
  selectionKey: "signatureSpellId",
  replace: true,
  signature: true,
});
const repertoireChoice = (id, name) => grant("ability-choice", id, {
  name,
  description: "Choose one additional spell for the Sorcerer's deliberately small personal repertoire.",
  options: SIGNATURE_SPELLS,
  count: 1,
});

const ROWS = [
  row("Signature Awakening", "Innate magic first condenses around one primary signature; later levels add a compact set of separately known spells.", [proficiency("innate-arcane", "Innate Arcana", "Channel arcane power by instinct rather than prepared formula."), signatureChoice()]),
  row("Instinctive Casting", "Cast by remembered sensation, emotion, and will without depending on a written spellbook.", [passive("sorcerer-instinctive-casting", "Instinctive Casting", "The signature spell never requires a spellbook or formal preparation.")]),
  row("Reservoir Pulse", "Feel the rhythm of the internal magical reservoir before power becomes strain.", [action("sorcerer:sense-reservoir", "Sense Reservoir", "Judge how much innate magical force can be released safely before rest is required.")]),
  row("Spell Instinct", "Recognize the signature spell's stable shape even while fear or distraction distorts the cast.", [passive("sorcerer-spell-instinct", "Spell Instinct", "Distraction is less likely to interrupt the signature spell.")]),
  row("First Signature Intensification", "Drive more personal force through the signature spell without changing its identity.", [passive("sorcerer-signature-intensification-i", "Signature Intensification I", "The signature spell carries greater force than another spell of the same circle.")]),
  row("Arcane Endurance", "Let the body absorb the harmless aftershocks of repeated innate casting.", [passive("sorcerer-arcane-endurance", "Arcane Endurance", "Repeated signature casting causes less physical fatigue.")]),
  row("Reflexive Channel", "Begin the signature cadence in response to danger before conscious thought catches up.", [action("sorcerer:reflexive-channel", "Reflexive Channel", "Begin shaping the signature spell immediately when a visible threat declares itself.")]),
  row("Personal Repertoire", "Awaken a second known spell and begin a compact multi-signature repertoire without approaching Wizard breadth.", [repertoireChoice("sorcerer-secondary-spell", "Secondary Innate Spell")]),
  row("Blood Resonance", "Identify the emotional and physical conditions under which innate power answers most strongly.", [passive("sorcerer-blood-resonance", "Blood Resonance", "Recognize circumstances that amplify or suppress personal magic.")]),
  row("Origin Revelation", "Choose how Sorcerous specialization treats the primary and future repertoire; metamagic initially applies to one spell.", [metamagicChoice(0), passive("sorcerer-metamagic-scope-i", "Metamagic Scope I", "General metamagic specialization initially applies to one chosen spell.", { spellCount: 1 })]),
  row("Effortless Cadence", "Remove one unnecessary motion from the signature spell's natural rhythm.", [passive("sorcerer-effortless-cadence", "Effortless Cadence", "The familiar opening of the signature spell is faster and less conspicuous.")]),
  row("Power Without Script", "Reconstruct the signature spell from inner sensation after silence, restraint, or lost implements.", [action("sorcerer:cast-without-script", "Cast Without Script", "Attempt the signature spell when ordinary arcane notation or implements are unavailable.")]),
  row("Reservoir Discipline", "Stop a cast at the last safe moment instead of exhausting the whole reservoir.", [passive("sorcerer-reservoir-discipline", "Reservoir Discipline", "Aborted innate spells waste less magical reserve.")]),
  row("Signature Familiarity", "Read minute deviations in the favourite spell before they become dangerous flaws.", [passive("sorcerer-signature-familiarity", "Signature Familiarity", "Detect instability in the signature spell while it is being shaped.")]),
  row("Second Signature Intensification", "Strengthen the signature spell's defining effect rather than merely increasing raw output.", [passive("sorcerer-signature-intensification-ii", "Signature Intensification II", "The signature spell's characteristic rider or battlefield purpose becomes more pronounced.")]),
  row("Innate Counterpressure", "Hold the signature pattern together when hostile magic presses directly against it.", [passive("sorcerer-innate-counterpressure", "Innate Counterpressure", "The signature spell more effectively contests wards and counter-working.")]),
  row("Emotional Key", "Choose and deliberately invoke the emotion that opens the reservoir most cleanly.", [action("sorcerer:invoke-emotional-key", "Invoke Emotional Key", "Center on a chosen emotion to stabilize the next signature cast.")]),
  row("Living Focus", "Use breath, voice, and posture as a focus that cannot be confiscated.", [passive("sorcerer-living-focus", "Living Focus", "The Sorcerer's own body serves as an arcane focus for innate magic.")]),
  row("Signature Recovery", "Draw the fading echo of the favourite spell back into the internal reservoir.", [action("sorcerer:recover-signature", "Recover Signature", "During safe rest, recover power by meditating on the signature spell's residual echo.")]),
  row("Second Metamagic", "Choose another magical transformation and extend metamagic practice beyond the signature to a second personal spell.", [metamagicChoice(1), passive("sorcerer-metamagic-scope-ii", "Metamagic Scope II", "Assign learned general metamagic to as many as two spells in the personal repertoire.", { spellCount: 2 }), proficiency("sorcerer:metamagic-scope-2", "Two-Spell Metamagic", "Maintain metamagic practice across two personal spells.")]),
  row("Personal Spell Memory", "Remember each innate spell as a complete sensation rather than a sequence of instructions.", [passive("sorcerer-personal-spell-memory", "Personal Spell Memory", "Innate spells cannot be lost through damaged notes or stolen books.")]),
  row("Controlled Overflow", "Vent surplus magic around the cast instead of allowing it to recoil through the body.", [action("sorcerer:vent-overflow", "Vent Overflow", "Release excess signature power harmlessly into the surroundings when a cast is interrupted.")]),
  row("Metamagic Fluency", "Apply learned signature transformations without pausing to rebuild the spell from its beginning.", [passive("sorcerer-metamagic-fluency", "Metamagic Fluency", "Known signature metamagic feels like part of the base spell rather than an added theorem.")]),
  row("Innate Precision", "Guide the signature spell by direct intent through crowded and changing conditions.", [passive("sorcerer-innate-precision", "Innate Precision", "Place the signature spell more safely around intended allies and objects.")]),
  row("First Signature Exchange", "Keep the current primary or move signature focus to another spell; the former primary remains learned only when independently held in the repertoire.", [exchangeChoice(25)]),
  row("Transferred Mastery", "Carry established metamagic into an exchanged signature without relearning its deepest instincts.", [passive("sorcerer-transferred-mastery", "Transferred Mastery", "Signature upgrades and metamagic persist after a signature exchange.")]),
  row("Reservoir Expansion", "Widen the internal channel while preserving the pressure needed for decisive casting.", [passive("sorcerer-reservoir-expansion", "Reservoir Expansion", "Maintain a larger reserve for signature casting.")]),
  row("Second Personal Spell", "Add another independently known spell while keeping the growing repertoire deliberately compact.", [repertoireChoice("sorcerer-tertiary-spell", "Tertiary Innate Spell")]),
  row("Spellblood Poise", "Let power move visibly through the body without surrendering judgement to it.", [passive("sorcerer-spellblood-poise", "Spellblood Poise", "Remain composed while heavily charged with innate magic.")]),
  row("Origin Discipline", "Choose a mature depth-or-breadth discipline and add a third general metamagic transformation.", [metamagicChoice(2)]),
  row("Signature Reserve", "Keep a small measure of power that answers only the favourite spell.", [passive("sorcerer-signature-reserve", "Signature Reserve", "Retain a protected reserve that can only fuel the signature spell.")]),
  row("Metamagic Weave", "Layer two compatible refinements without letting either obscure the original spell.", [action("sorcerer:weave-metamagic", "Weave Metamagic", "Combine two known compatible signature refinements in one deliberate cast.")]),
  row("Arcane Self-Knowledge", "Read changes in mood, injury, and identity as changes in the shape of personal magic.", [passive("sorcerer-arcane-self-knowledge", "Arcane Self-Knowledge", "Understand how bodily and emotional conditions alter innate casting.")]),
  row("Signature Persistence", "Keep the favourite spell coherent a moment longer after its normal duration or impact.", [passive("sorcerer-signature-persistence", "Signature Persistence", "Sustained signature effects resist premature collapse.")]),
  row("Third Signature Intensification", "Deepen the favourite spell until its ordinary expression is unmistakably personal.", [passive("sorcerer-signature-intensification-iii", "Signature Intensification III", "The signature spell bears a stronger personal expression and greater potency.")]),
  row("Reservoir Circulation", "Move unused power back through the body instead of leaving it trapped in an unfinished cast.", [passive("sorcerer-reservoir-circulation", "Reservoir Circulation", "Recover part of the reserve committed to a safely cancelled signature spell.")]),
  row("Innate Spellcraft", "Alter the surface expression of an innate spell without pretending to possess a Wizard's breadth.", [action("sorcerer:personalize-spell", "Personalize Spell", "Give an innate spell a stable sensory mark, gesture, or personal manifestation.")]),
  row("Pressure Casting", "Release the signature spell cleanly while the reservoir is near exhaustion.", [passive("sorcerer-pressure-casting", "Pressure Casting", "Low reserves impose less instability on the signature spell.")]),
  row("Resonant Presence", "Let the promise of the favourite spell gather around voice and bearing before it is cast.", [passive("sorcerer-resonant-presence", "Resonant Presence", "Creatures familiar with the signature spell can sense its restrained potential.")]),
  row("Fourth Metamagic", "Choose a fourth transformation and extend general metamagic practice across three personal spells.", [metamagicChoice(3), passive("sorcerer-metamagic-scope-iii", "Metamagic Scope III", "Assign learned general metamagic to as many as three spells in the personal repertoire.", { spellCount: 3 }), proficiency("sorcerer:metamagic-scope-3", "Three-Spell Metamagic", "Maintain distinct casting modifications across three personal spells.")]),
  row("Signature Repetition", "Repeat the favourite cadence without allowing habit to become careless.", [passive("sorcerer-signature-repetition", "Signature Repetition", "Repeated signature casts remain stable and deliberate.")]),
  row("Arcane Pulse Reading", "Read another innate caster by the pressure and rhythm of power moving through them.", [action("sorcerer:read-arcane-pulse", "Read Arcane Pulse", "Assess the source, strain, and dominant expression of another creature's innate magic.")]),
  row("Deep Reservoir", "Reach power beneath the familiar surface without tearing the channel open.", [passive("sorcerer-deep-reservoir", "Deep Reservoir", "Access deeper reserves during a prolonged magical crisis.")]),
  row("Stable Transformation", "Keep metamagic alterations consistent from one signature cast to the next.", [passive("sorcerer-stable-transformation", "Stable Transformation", "Chosen signature transformations are reproducible rather than volatile accidents.")]),
  row("Second Signature Exchange", "Reaffirm the primary focus or transfer it to another known or newly selected spell; replaced focus is not automatic repertoire knowledge.", [exchangeChoice(45)]),
  row("Identity of Power", "An exchanged spell becomes personally recognizable without retaining the old spell's superficial form.", [passive("sorcerer-identity-of-power", "Identity of Power", "The Sorcerer's signature remains identifiable across legitimate exchanges.")]),
  row("Metamagic Reflex", "Call on a familiar refinement at the instant the signature spell leaves the reservoir.", [passive("sorcerer-metamagic-reflex", "Metamagic Reflex", "A known signature metamagic can be selected later in the casting motion.")]),
  row("Final Personal Spell", "Complete the core compact repertoire with another independently known spell built for metamagic depth rather than encyclopedic breadth.", [repertoireChoice("sorcerer-final-repertoire-spell", "Final Innate Repertoire Spell")]),
  row("Sovereign Reservoir", "Treat the internal source as governed territory rather than an unpredictable flood.", [passive("sorcerer-sovereign-reservoir", "Sovereign Reservoir", "Outside magic has greater difficulty disrupting or draining the innate reserve.")]),
  row("Origin Apotheosis", "Choose the ultimate expression of the specialization and a fifth general metamagic transformation.", [metamagicChoice(4)]),
  row("Signature Economy", "Strip away every expenditure that does not serve the favourite spell's defining purpose.", [passive("sorcerer-signature-economy", "Signature Economy", "The signature spell consumes less reserve than comparable innate magic.")]),
  row("Living Metamagic", "Let the signature transformation respond to the cast's immediate conditions without becoming a different spell.", [action("sorcerer:living-metamagic", "Living Metamagic", "Adjust a known metamagic's bounded expression as the signature spell resolves.")]),
  row("Arcane Vitality", "Recover from magical exhaustion as the body learns the reservoir's deepest rhythm.", [passive("sorcerer-arcane-vitality", "Arcane Vitality", "Rest restores the innate reserve more completely.")]),
  row("Signature Authority", "Compel lesser disruptions to yield to the favourite spell's established personal law.", [passive("sorcerer-signature-authority", "Signature Authority", "Lesser counter-working is less likely to alter the signature spell.")]),
  row("Fourth Signature Intensification", "Raise the signature spell beyond the ordinary ceiling of its base formula.", [passive("sorcerer-signature-intensification-iv", "Signature Intensification IV", "The signature spell reaches an exceptional personal magnitude.")]),
  row("Metamagic Conservation", "Recover the power normally lost when a refinement changes the spell's shape.", [passive("sorcerer-metamagic-conservation", "Metamagic Conservation", "Applying signature metamagic wastes less innate reserve.")]),
  row("Reservoir Anchor", "Fix awareness to the deepest stable point inside the innate source.", [action("sorcerer:anchor-reservoir", "Anchor Reservoir", "Stabilize personal magic against forced transformation, suppression, or drain.")]),
  row("Perfect Cadence", "Voice, breath, intent, and power arrive together without conscious sequencing.", [passive("sorcerer-perfect-cadence", "Perfect Cadence", "The signature spell's basic casting cadence is nearly effortless.")]),
  row("Signature Dominion", "The favourite spell establishes a momentary domain in which its own rules are strongest.", [passive("sorcerer-signature-dominion", "Signature Dominion", "The signature spell dominates lesser overlapping magical effects.")]),
  row("Sixth Metamagic", "Choose the sixth learned transformation and extend general metamagic practice across the full four-spell personal repertoire.", [metamagicChoice(5), passive("sorcerer-metamagic-scope-iv", "Metamagic Scope IV", "Assign learned general metamagic to as many as four personal spells.", { spellCount: 4 }), proficiency("sorcerer:metamagic-scope-4", "Four-Spell Metamagic", "Maintain specialized metamagic across the complete narrow repertoire.")]),
  row("Inexhaustible Pattern", "Even a depleted reservoir remembers the complete shape of the favourite spell.", [passive("sorcerer-inexhaustible-pattern", "Inexhaustible Pattern", "Exhaustion cannot erase or permanently damage signature mastery.")]),
  row("Metamagic Reconciliation", "Resolve tension between two refinements by returning both to the signature's personal core.", [action("sorcerer:reconcile-metamagic", "Reconcile Metamagic", "Safely combine two difficult signature transformations through their shared personal pattern.")]),
  row("True Spellblood", "Innate power and living identity can no longer be cleanly separated.", [passive("sorcerer-true-spellblood", "True Spellblood", "Attempts to steal or overwrite innate magic must overcome the Sorcerer's established identity.")]),
  row("Apex Reservoir", "Hold realm-shaping pressure without allowing it to consume the vessel that carries it.", [passive("sorcerer-apex-reservoir", "Apex Reservoir", "Contain and direct an apex quantity of personal arcane power.")]),
  row("Final Signature Exchange", "Choose the final primary focus; any replaced primary remains known only through an independent repertoire selection.", [exchangeChoice(65)]),
  row("Metamagic Legacy", "Every chosen refinement becomes a permanent chapter in the signature spell's living history.", [passive("sorcerer-metamagic-legacy", "Metamagic Legacy", "No learned signature metamagic is lost through later exchange or transformation.")]),
  row("Unbound Expression", "Release the signature spell without forcing it into another caster's inherited appearance.", [action("sorcerer:unbound-expression", "Unbound Expression", "Reveal the signature spell in its complete and uniquely personal form.")]),
  row("Fifth Signature Intensification", "Perfect force, control, and identity together instead of sacrificing one for another.", [passive("sorcerer-signature-intensification-v", "Signature Intensification V", "The signature spell reaches its final balanced personal potency.")]),
  row("Innate Magic Incarnate", "The reservoir answers intention with no gap between self, source, and spell.", [passive("sorcerer-innate-incarnate", "Innate Magic Incarnate", "Personal magic responds immediately to deliberate will.")]),
  row("Sorcerous Apogee", "A primary signature and compact multi-signature repertoire reach their apex with up to four spells under active general metamagic specialization.", [passive("sorcerer-apogee", "Sorcerous Apogee", "Up to four personal spells retain practiced metamagic identities while the current primary remains the deepest focus."), grant("metamagic", "perfected-signature", { appliesTo: "sorcerer-repertoire", capstone: true })]),
];

if (ROWS.length !== 70) throw new Error(`Sorcerer progression must contain 70 authored levels, received ${ROWS.length}`);

export const SORCERER_PROGRESSION_LEVELS = Object.freeze(ROWS.map((entry, index) => Object.freeze({
  level: index + 1,
  ...entry,
})));
