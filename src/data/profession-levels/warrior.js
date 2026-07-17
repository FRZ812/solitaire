// Warrior progression is entirely mundane martial mastery. Its extreme feats
// come from leverage, conditioning, timing, equipment, and practiced movement;
// none of these grants are spells, prayers, pacts, primal gifts, or borrowed
// techniques from another profession.

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
  row("Warrior's Measure", "Learn the distance at which the held weapon can strike cleanly without surrendering balance.", [ability("warrior-measured-strike"), proficiency("warrior:martial-foundation", "Martial Foundation", "Fight from a stable guard with common arms and armour.")]),
  row("Weapon Safety", "Carry, ready, and recover a weapon without endangering allies or presenting an accidental opening.", [passive("warrior:weapon-safety", "Weapon Safety", "Routine handling and recovery no longer create needless openings around nearby allies.")]),
  row("Fighting Distance", "Compare reach, stance, and terrain before choosing the first committed step.", [action("warrior:assess-fighting-distance", "Assess Fighting Distance", "Read the practical striking distance between visible combatants and identify who must move first.")]),
  row("Guard Recovery", "Return the weapon and body to protection immediately after an ordinary attack.", [passive("warrior:guard-recovery", "Guard Recovery", "A completed basic attack returns to guard with less exposed motion.")]),
  row("Committed Footwork", "Advance, retreat, and turn without crossing the feet when force is already in motion.", [action("warrior:committed-footwork", "Committed Footwork", "Cross a short threatened space while preserving a usable guard and stable footing.")]),
  row("Guarded Cut", "Put the rear foot, hips, and weapon behind a blow whose recovery closes the same line it opened.", [ability("warrior-guarded-cut")]),
  row("Edge Alignment", "Keep edge, point, or striking face aligned through impact instead of wasting force in a glancing angle.", [passive("warrior:edge-alignment", "Edge Alignment", "Well-timed weapon attacks lose less force to poor alignment.")]),
  row("Armour Familiarity", "Move inside fitted protection until its weight becomes part of ordinary balance rather than an obstacle.", [passive("warrior:armour-familiarity", "Armour Familiarity", "Properly fitted mundane armour imposes less fatigue during sustained movement.")]),
  row("Read the Weapon", "Infer an opponent's likely reach, recovery, and strongest line from the weapon and grip they show.", [action("warrior:read-weapon", "Read the Weapon", "Assess a visible weapon's likely attacks, recovery windows, and unsafe ranges.")]),
  row("Martial Identity", "Choose the kind of Warrior whose practice will overlay the shared discipline without replacing it.", [passive("warrior:declared-practice", "Declared Practice", "A chosen specialization now refines the uninterrupted general Warrior progression.")]),

  row("Hands in Transition", "Move between long, middle, and close grips without fully withdrawing the weapon from use.", [action("warrior:change-grip", "Change Grip", "Adjust the held weapon's grip for reach, leverage, or confined space without putting it away.")]),
  row("Passing Step", "Cross the opponent's attack line behind the weapon and emerge at a safer striking angle.", [ability("warrior-passing-step")]),
  row("Breath Under Load", "Exhale with effort and recover breath behind the guard while armour and impact tax the body.", [passive("warrior:breath-under-load", "Breath Under Load", "Heavy exertion and fitted armour accumulate fatigue more slowly during a fight.")]),
  row("Falling Practice", "Turn a knockdown into a controlled descent and keep the weapon between the body and danger.", [passive("warrior:falling-practice", "Falling Practice", "Mundane falls and forced trips cause less harm and leave a safer recovery posture.")]),
  row("Foundation Without Gaps", "Diagnose weak links in stance, grip, armour fit, and weapon care before they fail under pressure.", [action("warrior:audit-martial-foundation", "Audit Martial Foundation", "Inspect a combatant's mundane equipment and fundamentals for one correctable weakness.")]),
  row("Grip Economy", "Use only the hand pressure needed to guide the weapon, saving strength for contact.", [passive("warrior:grip-economy", "Grip Economy", "Prolonged weapon use causes less forearm fatigue and accidental overcommitment.")]),
  row("Shortened Motion", "Remove flourishes from attacks until the useful path between guard and target is direct.", [passive("warrior:shortened-motion", "Shortened Motion", "Weapon techniques are harder to read from unnecessary preparatory motion.")]),
  row("Weapon Bind", "Catch an opposing weapon against leverage and suppress its next useful line.", [ability("warrior-weapon-bind")]),
  row("Terrain Underfoot", "Test loose stone, mud, stairs, furniture, and slopes before trusting them with committed force.", [action("warrior:test-footing", "Test Footing", "Quickly identify which nearby spaces support a charge, brace, pivot, or safe withdrawal.")]),
  row("Sustained Exchange", "Preserve structure after several consecutive clashes instead of letting form unravel into exhaustion.", [passive("warrior:sustained-exchange", "Sustained Exchange", "Repeated mundane attacks degrade balance and precision more slowly.")]),

  row("Reach Arithmetic", "Treat the opponent's limb, weapon, step, and recovery as one changing measure.", [passive("warrior:reach-arithmetic", "Reach Arithmetic", "Recognize when a small change of grip or footing changes who controls striking distance.")]),
  row("Safe Withdrawal", "Leave an exchange behind a final guarded threat so pursuit cannot begin for free.", [action("warrior:safe-withdrawal", "Safe Withdrawal", "Break from close pressure while keeping a weapon between the Warrior and the nearest pursuer.")]),
  row("Armour Articulation", "Align plates, padding, straps, and joints so protection moves with the body rather than against it.", [passive("warrior:armour-articulation", "Armour Articulation", "Well-maintained armour interferes less with pivots, crouches, and weapon recovery.")]),
  row("Turning Parry", "Receive one weapon line while turning the guard toward the next likely threat.", [ability("warrior-turning-parry")]),
  row("Collision Discipline", "Receive shoulder, shield, haft, and body contact through stance rather than brittle resistance.", [passive("warrior:collision-discipline", "Collision Discipline", "Ordinary shoves and bodily collisions are less likely to break stance.")]),
  row("Fight from the Wall", "Use a wall, doorway, table, or narrow passage to remove angles an opponent could exploit.", [action("warrior:claim-hard-boundary", "Claim Hard Boundary", "Choose a nearby solid boundary and arrange the personal guard around the attacks it excludes.")]),
  row("Weapon Recovery Line", "Let a missed or deflected attack curve naturally back toward guard instead of stopping dead.", [passive("warrior:recovery-line", "Weapon Recovery Line", "A failed weapon attack is less likely to leave the Warrior fully extended.")]),
  row("Strong-Side Denial", "Crowd the line from which an opponent's most powerful attack must begin.", [action("warrior:deny-strong-side", "Deny Strong Side", "Use stance and weapon position to make one visible opponent's favoured attack harder to begin cleanly.")]),
  row("Battle Weariness", "Distinguish pain, breathlessness, failing grip, and structural injury in the middle of an exchange.", [passive("warrior:battle-weariness", "Battle Weariness", "The Warrior can judge personal physical fatigue and injury without mistaking adrenaline for readiness.")]),
  row("Veteran Method", "Commit to a parent-specific veteran doctrine that deepens the chosen martial identity.", [passive("warrior:veteran-method", "Veteran Method", "The specialization may now develop its own advanced doctrine.")]),

  row("Force Through Structure", "Carry force from the ground through the whole frame rather than isolating it in the striking limb.", [passive("warrior:force-through-structure", "Force Through Structure", "Committed weapon impacts draw more effectively on stable full-body leverage.")]),
  row("Sweeping Denial", "Trace a controlled weapon arc that forces every nearby opponent to respect the same contested space.", [ability("warrior-sweeping-denial")]),
  row("Centreline Ownership", "Occupy the direct path between an opponent's weapon and intended target with a credible counter-threat.", [action("warrior:claim-centreline", "Claim Centreline", "Establish personal weapon control over the most direct attack line in a close engagement.")]),
  row("Low Guard Invitation", "Offer a deliberate opening low enough to be tempting and narrow enough to answer safely.", [passive("warrior:low-guard-invitation", "Low Guard Invitation", "A knowingly exposed line can draw a predictable mundane attack without becoming careless surrender.")]),
  row("Shoulder and Hip Unity", "Keep the major joints aligned when cutting, thrusting, bracing, or absorbing impact.", [passive("warrior:joint-unity", "Shoulder and Hip Unity", "Sound alignment reduces self-inflicted strain from high-force martial techniques.")]),
  row("Crowd Geometry", "Track bodies, obstacles, weapon arcs, and exits as moving physical boundaries.", [action("warrior:read-crowd-geometry", "Read Crowd Geometry", "Identify the safest lane and most dangerous congestion in a crowded close fight.")]),
  row("Brace Timing", "Set the stance only when collision becomes inevitable so mobility is not surrendered too early.", [passive("warrior:brace-timing", "Brace Timing", "Late bracing preserves more movement before improving resistance to physical impact.")]),
  row("Break Guard", "Strike fastenings, overlaps, weapon position, and balance until a physical defence loses coherence.", [ability("warrior-break-guard")]),
  row("Opponent Habit Map", "Remember repeated guards, recoveries, and preferred exits until their sequence becomes legible.", [action("warrior:map-opponent-habits", "Map Opponent Habits", "After observing repeated exchanges, record one reliable physical habit of a visible opponent.")]),
  row("Recovery Window", "Recognize the brief interval in which a committed body and weapon cannot answer a second threat.", [passive("warrior:recovery-window", "Recovery Window", "Overcommitted mundane attacks reveal a clearer moment for a trained response.")]),

  row("Discipline Change Under Pressure", "Move from one practiced weapon discipline to another without carrying the first form's assumptions into the second.", [action("warrior:change-discipline", "Change Discipline", "During a brief lull, adopt the grip, guard, and distance of another personally trained mundane weapon discipline.")]),
  row("Armoured Breathing", "Make room for the lungs inside compressed padding, straps, and a guarded posture.", [passive("warrior:armoured-breathing", "Armoured Breathing", "The Warrior recovers breath more reliably while remaining protected by mundane armour.")]),
  row("Tempo Conservation", "Spend speed only when it changes the exchange instead of moving quickly for its own sake.", [passive("warrior:tempo-conservation", "Tempo Conservation", "Patient pauses preserve the sharpness of the next committed martial sequence.")]),
  row("Grip Destruction", "Attack fingers, haft position, and leverage to compromise a held weapon without copying a thief's sleight of hand.", [action("warrior:attack-grip", "Attack Grip", "Use direct weapon pressure to test and degrade one opponent's physical hold on a visible weapon.")]),
  row("Injury Accommodation", "Change stance and motion around an injured limb while refusing movements that would worsen it.", [passive("warrior:injury-accommodation", "Injury Accommodation", "A known physical injury imposes less loss of function when the Warrior can adjust technique around it.")]),
  row("Masterstroke", "Spend accumulated measure and pressure on one exact attack that exploits the exchange already built.", [ability("warrior-masterstroke")]),
  row("Pressure Without Chase", "Close options through position and reach instead of wasting balance in reckless pursuit.", [passive("warrior:pressure-without-chase", "Pressure Without Chase", "A retreating opponent remains threatened without forcing the Warrior into an uncontrolled sprint.")]),
  row("Moving Guard", "Keep protective lines coherent while turning, advancing, retreating, or stepping around an obstacle.", [action("warrior:moving-guard", "Moving Guard", "Relocate a short distance while preserving a declared mundane guard against visible threats.")]),
  row("Impact Redirection", "Let angled armour, haft, guard, and stance send force away from vulnerable structure.", [passive("warrior:impact-redirection", "Impact Redirection", "Well-angled mundane protection wastes more of an incoming physical blow's force.")]),
  row("Martial Apotheosis", "Choose the final personal expression of the veteran doctrine without invoking any supernatural source.", [passive("warrior:martial-apotheosis", "Martial Apotheosis", "The selected veteran doctrine may now reach its unique physical apex.")]),

  row("Load-Bearing Stance", "Stack feet, knees, hips, spine, and guard so extraordinary force travels through the frame without folding it.", [passive("warrior:load-bearing-stance", "Load-Bearing Stance", "A correctly prepared stance withstands extreme but still physical pressure.")]),
  row("Visible Shock", "Read dust, cloth, loose objects, and body movement to understand how a heavy impact travelled.", [action("warrior:read-impact", "Read Impact", "Examine the immediate physical signs of a collision to reconstruct its direction and approximate force.")]),
  row("Armoured Acceleration", "Explode from a stable brace by sequencing mass and steps rather than fighting the armour's weight.", [passive("warrior:armoured-acceleration", "Armoured Acceleration", "A short advance in fitted armour begins with less wasted motion.")]),
  row("Iron Sequence", "Link guarded contacts into a punishing sequence whose force remains entirely weapon, leverage, and trained momentum.", [ability("warrior-iron-sequence")]),
  row("Disarmed Continuity", "Use cover, distance, grappling leverage, and recovery drills to reclaim a weapon while preserving the armed discipline's continuity.", [action("warrior:recover-disarmed", "Recover from Disarm", "Create the physical space or leverage needed to retrieve a dropped weapon without treating empty hands as a separate combat discipline.")]),
  row("Perfect Distance", "Make tiny foot and grip adjustments that keep the weapon effective while denying an opponent the same comfort.", [passive("warrior:perfect-distance", "Perfect Distance", "Personal attacks more often begin from the weapon's ideal mundane measure.")]),
  row("Adaptive Form", "Retain balance, awareness, and tactical intent while weapon, grip, armour, or range changes.", [ability("warrior-adaptive-form"), passive("warrior:seamless-discipline", "Seamless Discipline", "Switching trained martial forms no longer resets the Warrior's reading of an exchange.")]),
  row("Fatal Angle Recognition", "Identify where posture, armour, and movement briefly align into a decisive physical opening.", [action("warrior:recognize-fatal-angle", "Recognize Fatal Angle", "After sustained observation, identify one fleeting but mundane opening in a visible opponent's defence.")]),
  row("Battle-Tested Body", "Condition bone, connective tissue, balance, and recovery for repeated high-force practice without claiming invulnerability.", [passive("warrior:battle-tested-body", "Battle-Tested Body", "Training reduces accumulated strain from repeated martial impacts and abrupt changes of direction.")]),
  row("Exemplar's Economy", "Remove every movement that serves neither attack, defence, position, nor recovery.", [passive("warrior:exemplar-economy", "Exemplar's Economy", "The Warrior's mature technique expends little motion on display or indecision.")]),

  row("Strike Through Contact", "Feel a defence through the weapon and redirect force before the first collision has fully ended.", [passive("warrior:strike-through-contact", "Strike Through Contact", "Weapon contact reveals enough leverage to refine the same committed exchange.")]),
  row("Veteran Reversal", "Turn a committed attack back through the opening it made, spending hard-won tempo on a decisive mundane counter.", [ability("warrior-veteran-reversal")]),
  row("No Wasted Guard", "Let each defensive motion become position for the next attack instead of returning to an arbitrary pose.", [passive("warrior:no-wasted-guard", "No Wasted Guard", "Successful mundane defence preserves more readiness for immediate weapon work.")]),
  row("Masterful Reversal", "Turn the direction of an opponent's force through angle and leverage rather than opposing it head-on.", [action("warrior:masterful-reversal", "Masterful Reversal", "Redirect a committed physical pressure into a safer line when stance and contact permit.")]),
  row("Weight in Motion", "Use carried mass as controlled momentum while retaining the ability to stop, turn, or brace.", [passive("warrior:weight-in-motion", "Weight in Motion", "Armour and weapon mass contribute to impact without automatically causing overcommitment.")]),
  row("Impossible Recovery", "Recover the guard from a seemingly ruined angle through flexibility, grip, and rehearsed emergency steps.", [passive("warrior:impossible-recovery", "Impossible Recovery", "An extreme mundane deflection is less likely to leave the Warrior unable to defend the next line.")]),
  row("Weapon as Leverage", "Use haft, flat, guard, pommel, hook, and length as a complete physical tool rather than only an edge.", [action("warrior:weapon-leverage", "Weapon as Leverage", "Apply a held weapon to pry, brace, hook, or shift a physical obstacle within its construction's limits.")]),
  row("Mortal Limit Conditioning", "Reach the highest sustainable performance through years of loading, rest, nutrition, repetition, and scar-aware practice.", [passive("warrior:mortal-limit-conditioning", "Mortal Limit Conditioning", "Exceptional conditioning remains biological and requires ordinary recovery even at its apex.")]),
  row("Complete Martial Awareness", "Track weapon lines, bodies, footing, exits, and personal fatigue as one continuous physical exchange.", [passive("warrior:complete-awareness", "Complete Martial Awareness", "Visible mundane threats are less likely to disappear from attention during complex close combat.")]),
  row("Perfect Technique", "Unify every learned guard, weapon, step, impact, and recovery into a personal martial form that remains wholly nonmagical.", [ability("warrior-perfect-technique"), action("warrior:perfect-martial-form", "Perfect Martial Form", "Enter the Warrior's fully integrated personal form, choosing the trained distance and guard appropriate to the present physical fight.")]),
];

if (ROWS.length !== 70) throw new Error(`Warrior progression must define exactly 70 levels, received ${ROWS.length}`);

export const WARRIOR_PROGRESSION_LEVELS = Object.freeze(ROWS.map((entry, index) => Object.freeze({
  level: index + 1,
  ...entry,
})));
