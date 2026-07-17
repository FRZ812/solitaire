// Monk progression is authored as physical practice. Even its most spectacular
// results come from conditioning, breath, leverage, acceleration, anatomy, and
// impact. General Monk techniques are unarmed; only the Temple Arms branch
// permits its own bounded weapon kata.

const grant = (type, id, details = {}) => Object.freeze({ type, id, ...details });
const ability = (id) => grant("ability", id);
const action = (id, name, description) => grant("action", id, { name, description });
const passive = (id, name, description, details = {}) => grant("passive", id, { name, description, ...details });
const proficiency = (id, name, description) => grant("proficiency", id, { name, description });
const row = (name, description, grants) => Object.freeze({
  name,
  feature: name,
  description,
  grants: Object.freeze(grants),
});

const ROWS = [
  row("Measured Palm", "Test range and balance with an open-handed contact that begins to strain the target's physical posture.", [ability("monk-measured-palm"), passive("monk:posture-strain", "Posture Strain", "Successful native Monk contacts can build up to three points of target-side balance pressure; armour, anatomy, mass, and size constrain the result.", { targetSide: true, postureStrainMax: 3 }), proficiency("monk:unarmed-foundation", "Unarmed Foundation", "Strike, cover, and recover with hands, elbows, knees, and feet without treating them as armed attacks.")]),
  row("Bare-Hand Alignment", "Stack wrist, elbow, shoulder, and torso so contact does not injure the striking hand.", [passive("monk:bare-hand-alignment", "Bare-Hand Alignment", "Sound skeletal alignment reduces self-inflicted strain from ordinary unarmed contact.")]),
  row("Read the Stance", "Observe foot angle, weight distribution, and hip position before deciding where balance can be pressured.", [action("monk:read-stance", "Read the Stance", "Assess a visible creature's current base of support and whether its anatomy can meaningfully accumulate Posture Strain.")]),
  row("Breath Cadence", "Match exhalation to exertion so tension leaves the body before it hardens movement.", [passive("monk:breath-cadence", "Breath Cadence", "Regular physical exertion disrupts breathing and recovery less severely.")]),
  row("Falling Shape", "Spread impact through rolling surfaces and protect the head without pretending every fall is harmless.", [action("monk:shape-fall", "Shape a Fall", "Convert a plausible short fall or throw into a controlled roll when space and consciousness permit.")]),
  row("Three-Beat Strike", "Join hand, elbow, and palm into one compact sequence that tests several lines without multiplying Posture Strain unfairly.", [ability("monk-three-beat-strike")]),
  row("Wrist and Knuckle Care", "Condition contact surfaces gradually while preserving joint mobility and sensation.", [passive("monk:contact-conditioning", "Contact Conditioning", "Hands and wrists tolerate repeated training contact more safely, but weapons and hard armour remain dangerous.")]),
  row("Hip Line", "Drive and recover the limb from the hips so reach does not pull the spine out of position.", [passive("monk:hip-line", "Hip Line", "Unarmed strikes retain better structure at the edge of their natural reach.")]),
  row("Empty Reach", "Measure the useful distance of hands, elbows, knees, and feet without imagining weapon-length threat.", [action("monk:measure-empty-reach", "Measure Empty Reach", "Identify which natural weapon can make sound contact from the current physical distance.")]),
  row("Discipline Declaration", "Choose the physical practice that will specialize the shared unarmed Monk foundation.", [passive("monk:declared-discipline", "Declared Discipline", "A chosen physical specialization now overlays the uninterrupted hand-to-hand Monk progression.")]),

  row("Elbow Shield", "Use forearm and elbow structure to cover vulnerable lines while remaining close enough to answer.", [passive("monk:elbow-shield", "Elbow Shield", "A compact unarmed guard protects the head and torso without requiring a held shield.")]),
  row("Yielding Guard", "Receive physical force through a moving frame and return a fraction of that motion into position.", [ability("monk-yielding-guard")]),
  row("Foot-Arch Conditioning", "Strengthen the small structures that keep repeated pivots and landings stable.", [passive("monk:foot-arch-conditioning", "Foot-Arch Conditioning", "Ordinary training pivots and landings accumulate less foot and ankle fatigue.")]),
  row("Close Entry", "Cross the final step behind hands and shoulder position instead of lunging through an open line.", [action("monk:close-entry", "Close Entry", "Enter short unarmed distance against a visible opponent when a physically open lane exists.")]),
  row("Tendon Stewardship", "Balance loading, recovery, and range so flexibility does not become unstable looseness.", [passive("monk:tendon-stewardship", "Tendon Stewardship", "Sustained training is less likely to turn useful mobility into repetitive-strain injury.")]),
  row("Free Shoulder", "Let the shoulder blade travel with the arm so force and guard do not compete.", [passive("monk:free-shoulder", "Free Shoulder", "Unarmed recovery remains compact after a long hand strike.")]),
  row("Counted Recovery", "Use a fixed breath count to recognize whether the body can safely repeat an explosive effort.", [action("monk:count-recovery", "Count Recovery", "Assess current breathlessness and the safe timing of the next high-output physical technique.")]),
  row("Joint Check", "Touch a moving joint at the angle that shortens its next action by exploiting existing Posture Strain.", [ability("monk-joint-check")]),
  row("Balance Test", "Apply a small push, pull, or foot pressure to learn where a stance yields before committing to a throw.", [action("monk:test-balance", "Test Balance", "Probe a contacted target's base without dealing harm; relative mass and anatomy determine what can be learned.")]),
  row("Contact Memory", "Remember how a body answered pressure rather than assuming every creature balances like a human.", [passive("monk:contact-memory", "Contact Memory", "Repeated contact improves the reading of the same creature's physical balance and articulation.")]),

  row("Weight Transfer", "Move body weight across the planted foot without bobbing, crossing, or advertising the next strike.", [passive("monk:weight-transfer", "Weight Transfer", "Short unarmed movements waste less force in vertical or lateral sway.")]),
  row("Clinch Frame", "Place forearms and head safely enough to manage close pressure without relying on brute grip strength.", [action("monk:establish-clinch-frame", "Establish Clinch Frame", "Create a bounded close-contact frame against a creature of physically manageable size.")]),
  row("Neck Safety", "Strengthen and align the neck while learning when not to resist rotational force.", [passive("monk:neck-safety", "Neck Safety", "Ordinary grappling and controlled falls threaten disorientation less often; severe trauma remains severe.")]),
  row("Reaping Kick", "Remove a loaded support with shin, foot, and hip timing, exploiting Posture Strain without ignoring mass.", [ability("monk-reaping-kick")]),
  row("Ground Recovery", "Build a protected base from hip, forearm, and planted foot before rising.", [passive("monk:ground-recovery", "Ground Recovery", "Recovering from a mundane fall exposes fewer unguarded lines.")]),
  row("Wall Rebound", "Use a sound nearby surface to redirect a step without claiming impossible traction.", [action("monk:wall-rebound", "Wall Rebound", "Change direction from a sturdy reachable surface when footwear, angle, and material can support the load.")]),
  row("Hand Trapping", "Occupy wrist and forearm paths for an instant to interrupt structure rather than steal or conceal an object.", [action("monk:trap-limb-line", "Trap Limb Line", "Briefly bind a contacted limb's immediate path when anatomy and relative strength permit.")]),
  row("Body Reading", "Read breath, muscular tension, gaze, and load shifts as physical preparation rather than mystical intent.", [passive("monk:body-reading", "Body Reading", "Visible bodily preparation makes committed movement easier to recognize.")]),
  row("Posture Ledger", "Track how much balance pressure a target carries and refuse to spend it on an implausible result.", [passive("monk:posture-ledger", "Posture Ledger", "Posture Strain is target-specific, capped, and cannot be transferred between creatures or treated as supernatural weakness.")]),
  row("Mature Method", "Choose a parent-specific method that deepens the declared physical discipline.", [passive("monk:mature-method", "Mature Method", "The specialization may now develop its own advanced physical method.")]),

  row("Short Power", "Accelerate through a small distance by sequencing foot, hip, torso, and limb instead of winding up.", [passive("monk:short-power", "Short Power", "Close-range unarmed impacts retain meaningful force without a long backswing.")]),
  row("Crossing Step", "Pass outside a committed line and strike from the angle created by ordinary foot speed.", [ability("monk-crossing-step")]),
  row("Recovery Angles", "Choose where a limb returns so defence and the next technique share the same path.", [passive("monk:recovery-angles", "Recovery Angles", "Completed native Monk contacts return through a useful protective line.")]),
  row("Breath After Impact", "Restore breathing after body shock by relaxing what is safe and bracing what is injured.", [action("monk:restore-breath", "Restore Breath", "During a brief safe pause, regulate breath after a physically stunning impact without healing damage.")]),
  row("Alternating Structure", "Move between hands, elbows, knees, and feet without letting one side carry every load.", [passive("monk:alternating-structure", "Alternating Structure", "Distinct natural weapons can form one coherent unarmed sequence without duplicate Posture gain.")]),
  row("Pressure Direction", "Decide whether posture should be lifted, folded, rotated, or driven before applying force.", [action("monk:choose-pressure-direction", "Choose Pressure Direction", "Declare the physically plausible direction in which existing target Posture Strain will be exploited.")]),
  row("Alignment Fracture", "Recognize the instant when stance, spine, and support stop reinforcing one another.", [passive("monk:alignment-fracture", "Alignment Fracture", "A target at maximum Posture Strain presents clearer opportunities for native trips, throws, and interruptions.")]),
  row("Posture Break", "Consume accumulated Posture Strain in a sharp structural disruption that remains weight- and boss-bounded.", [ability("monk-posture-break")]),
  row("Hard-Surface Awareness", "Change target, angle, or contact surface before bare bone meets armour, stone, or steel unsafely.", [passive("monk:hard-surface-awareness", "Hard-Surface Awareness", "The Monk recognizes when direct unarmed impact would be ineffective or self-injuring.")]),
  row("Practiced Restraint", "Stop force after control is established and distinguish incapacitation from needless injury.", [action("monk:apply-restraint", "Apply Restraint", "Convert a physically controlled unarmed position into a bounded nonlethal hold when anatomy allows.")]),

  row("Centre Shift", "Move the body's centre around a planted contact so the target bears pressure from an unexpected direction.", [passive("monk:centre-shift", "Centre Shift", "A maintained physical contact can redirect leverage without requiring a new wind-up.")]),
  row("Contact Without Telegraph", "Relax until the final acceleration so visible tension does not announce every short strike.", [passive("monk:quiet-acceleration", "Quiet Acceleration", "Close unarmed attacks reveal less preparatory muscular tension.")]),
  row("Pain Sorting", "Separate pain that warns of structural damage from pain that can be endured without worsening injury.", [action("monk:sort-pain", "Sort Pain", "Assess whether a current physical pain indicates unsafe loading rather than suppressing it by will alone.")]),
  row("Relative Mass", "Recalculate leverage when the other body is heavier, taller, quadrupedal, armoured, or anchored.", [passive("monk:relative-mass", "Relative Mass", "Posture techniques scale down or fail honestly against mass, anchoring, and anatomy they cannot move.")]),
  row("Elastic Return", "Store only the safe rebound of tendons and stance, never force that tissue cannot bear.", [passive("monk:elastic-return", "Elastic Return", "A controlled physical recoil shortens recovery between distinct unarmed contacts.")]),
  row("Cascade Blows", "Link several natural weapons through changing heights while granting no more than one Posture Strain for the sequence.", [ability("monk-cascade-blows")]),
  row("Pulse Discipline", "Lower the racing pulse through posture and paced exhalation after explosive movement.", [action("monk:discipline-pulse", "Discipline Pulse", "During a safe pause, reduce physical overexertion through measured breath and position.")]),
  row("Crowded Body Geometry", "Navigate shoulders, hips, limbs, and obstacles at close range without claiming unseen passage.", [action("monk:read-body-geometry", "Read Body Geometry", "Identify one physically open close-range lane through a crowded engagement.")]),
  row("Ankle-Hip Chain", "Keep the ankle, knee, and hip sharing rotational load through kicks and pivots.", [passive("monk:ankle-hip-chain", "Ankle-Hip Chain", "High and turning kicks create less self-inflicted joint strain when space permits.")]),
  row("Physical Apotheosis", "Choose the final physical expression of the advanced method without invoking an unseen source.", [passive("monk:physical-apotheosis", "Physical Apotheosis", "The selected method may now reach its unique biomechanical and conditioned apex.")]),

  row("Whole-Body Wave", "Sequence the ground, legs, hips, spine, shoulder, and hand so impact arrives as one physical wave.", [passive("monk:whole-body-wave", "Whole-Body Wave", "A well-planted unarmed contact draws safely on more of the body.")]),
  row("Shock Travel", "Read how a collision moved through tissue, armour, and support instead of mistaking spectacle for magic.", [action("monk:read-shock-travel", "Read Shock Travel", "Examine physical contact signs to infer where impact dispersed, stopped, or overloaded structure.")]),
  row("Skin and Bone Conditioning", "Increase tolerance through gradual loading while preserving sensation and accepting biological limits.", [passive("monk:skin-bone-conditioning", "Skin and Bone Conditioning", "Conditioned contact surfaces tolerate greater ordinary impact but never become supernatural weapons.")]),
  row("Resonant Impact", "Time a compact blow with the target's physical motion so ordinary shock travels through its current structure.", [ability("monk-resonant-impact")]),
  row("Moving Clinch", "Maintain safe head, hip, and forearm position while both bodies change direction.", [action("monk:moving-clinch", "Moving Clinch", "Guide a manageable contacted creature a short distance without treating the hold as domination.")]),
  row("Body Axis", "Track the line around which a creature can physically rotate, fall, or recover.", [passive("monk:body-axis", "Body Axis", "Anatomically legible targets reveal more precise throw and trip directions.")]),
  row("Shoulder Throw", "Consume Posture Strain to rotate a manageable body over a loaded fulcrum, with strict size and boss limits.", [ability("monk-shoulder-throw")]),
  row("Impact Recovery", "Let breath and stance settle after maximum effort before attempting to reproduce it.", [passive("monk:impact-recovery", "Impact Recovery", "Apex unarmed impacts impose less lingering self-disruption when followed by proper recovery.")]),
  row("Short-Range Acceleration", "Reach exceptional limb speed through relaxation and late muscular recruitment rather than supernatural haste.", [passive("monk:short-range-acceleration", "Short-Range Acceleration", "The last span of a compact unarmed technique accelerates with less visible preparation.")]),
  row("Master's Restraint", "Know the exact point at which more leverage changes control into permanent damage.", [passive("monk:masters-restraint", "Master's Restraint", "A physically secured technique can stop at incapacitation when the Monk chooses and anatomy permits.")]),

  row("Asymmetrical Balance", "Remain functional when one foot, hand, or side must carry an unusual share of the stance.", [passive("monk:asymmetrical-balance", "Asymmetrical Balance", "Temporary loss of an ideal physical stance causes less immediate collapse.")]),
  row("Ascending Knee", "Drive upward from a compressed base into a close target, converting existing Posture Strain into lift and interruption.", [ability("monk-ascending-knee")]),
  row("Breath Under Compression", "Preserve a narrow breathing path while clinched, pinned, or folded without claiming freedom from suffocation.", [passive("monk:breath-under-compression", "Breath Under Compression", "Manageable physical compression disrupts breath more slowly; a sealed airway remains an emergency.")]),
  row("Unarmed Adaptability", "Change natural weapon, height, and pressure direction while keeping the discipline recognizably hand-to-hand.", [action("monk:adapt-unarmed-form", "Adapt Unarmed Form", "Choose another natural weapon and contact height suited to the target's visible anatomy.")]),
  row("Nonlethal Certainty", "Control head, spine, airway, and falling direction well enough to end resistance without defaulting to lethal force.", [passive("monk:nonlethal-certainty", "Nonlethal Certainty", "Eligible native Monk finishers may deliberately resolve as physically controlled incapacitation.")]),
  row("Multiple-Body Awareness", "Track nearby limbs and collision paths while accepting that an open surround remains dangerous.", [passive("monk:multiple-body-awareness", "Multiple-Body Awareness", "Visible close-range bodies are less likely to obscure one another's immediate physical movement.")]),
  row("Tactile Structure", "Read tension, emptiness, and load through contact before choosing a direction of force.", [action("monk:read-tactile-structure", "Read Tactile Structure", "Through maintained contact, assess which visible anatomical line currently bears the target's weight.")]),
  row("Biological Limit", "Train at the edge of sustainable performance while treating rest, food, pain, and tissue repair as non-negotiable.", [passive("monk:biological-limit", "Biological Limit", "Apex conditioning remains physical and still requires ordinary recovery.")]),
  row("Complete Posture Reading", "See base, breath, anatomy, motion, armour, and mass as one changing balance problem.", [passive("monk:complete-posture-reading", "Complete Posture Reading", "The Monk recognizes when Posture Strain can be built, exploited only partially, or not applied at all.")]),
  row("Perfect Impact", "Consume complete Posture Strain in one precisely aligned unarmed finish whose force remains physical, armoured, and never true damage.", [ability("monk-perfect-impact"), action("monk:declare-perfect-contact", "Declare Perfect Contact", "Choose the anatomically and physically plausible contact through which the final unarmed impact will travel.")]),
];

if (ROWS.length !== 70) throw new Error(`Monk progression must define exactly 70 levels, received ${ROWS.length}`);

export const MONK_PROGRESSION_LEVELS = Object.freeze(ROWS.map((entry, index) => Object.freeze({
  level: index + 1,
  ...entry,
})));
