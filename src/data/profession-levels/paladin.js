// Paladin progression is oathbound protection and public duty. Conviction is
// earned by actually bearing hostile harm through native protection, then spent
// on oathcraft. It is not generic spellcasting, Cleric prayer, or Warrior Tempo.

const grant = (type, id, details = {}) => Object.freeze({ type, id, ...details });
const ability = (id) => grant("ability", id);
const oathAction = (id, name, description, details = {}) => grant("action", id, { name, description, noncombatBenefit: true, ...details });
const oathPassive = (id, name, description, details = {}) => grant("passive", id, { name, description, noncombatBenefit: true, ...details });
const oathProficiency = (id, name, description, details = {}) => grant("proficiency", id, { name, description, noncombatBenefit: true, ...details });
const row = (name, description, grants) => Object.freeze({
  name,
  feature: name,
  description,
  grants: Object.freeze(grants),
});

const ROWS = [
  row("Oathguard", "Name a willing ally under your protection and physically intercept a hostile blow meant for them; Conviction is earned only when Oathguard actually transfers real damage to this Paladin.", [
    ability("paladin-oathguard"),
    oathPassive("paladin:conviction", "Conviction", "Conviction belongs to the Paladin who earned it. It is gained only when Oathguard actually intercepts hostile damage for an ally or Stand Fast actually absorbs a real hostile hit, never from an attempt, zero damage, ordinary injury, self-manufactured harm, healing, or an unrelated action. Native oathcraft spends it only on commitment; it is neither a spell slot nor another profession's resource.", {
      selfSide: true,
      integer: true,
      min: 0,
      max: 5,
      resetEachFight: true,
      earnedOnlyByNativeProtection: true,
      oathguardInterceptsHostileDamageForAlly: true,
      standFastAbsorbsRealHostileHit: true,
      paladinConvictionOnIntercept: 1,
      paladinConvictionOnAbsorb: 1,
      requiresActualDamage: true,
      attemptsBuild: false,
      zeroDamageBuilds: false,
      ordinaryDamageBuilds: false,
      selfManufacturedDamageBuilds: false,
      healingBuilds: false,
      unrelatedActionsBuild: false,
      oncePerHostileActionPerPaladin: true,
      independentPaladins: true,
      nativeOathcraftCommitSpendOnly: true,
      spendsOnCommitEvenIfMissed: true,
      multiHitSpendsOnce: true,
      genericSpellcasting: false,
      borrowedResource: false,
    }),
    oathProficiency("paladin:oathbound-protector", "Oathbound Protector", "Serve through witnessed vows, escort, refuge, accountability, restraint, rescue, and physical protection without borrowing Cleric prayers, Warrior techniques, generic healing, smites, or spellcasting."),
  ]),
  row("Witnessed Vow", "State a duty with a clear beneficiary, boundary, duration, and witness so responsibility can be judged by what was actually promised.", [oathAction("paladin:record-witnessed-vow", "Record a Witnessed Vow", "Write or recite the exact promise, parties, limits, witnesses, date, and conditions under which the duty is fulfilled, transferred, or impossible.")]),
  row("Shield Courtesy", "Carry arms and armour around civilians with deliberate spacing, secured edges, announced movement, and respect for another household's rules.", [oathPassive("paladin:shield-courtesy", "Shield Courtesy", "Disciplined bearing makes an armed Paladin less likely to frighten, obstruct, strike, or damage bystanders and property during ordinary travel and assembly.")]),
  row("Escort Order", "Arrange a protected journey around pace, visibility, vulnerable travellers, rest, permission, choke points, and an agreed response to separation.", [oathAction("paladin:plan-escort", "Plan an Escort", "Set marching order, signals, rest points, safe rooms, alternate routes, responsibilities, and a humane abort condition for a willing group.")]),
  row("Oath Ledger", "Keep promises, witnesses, due dates, conflicts, delegated tasks, and completed duties visible instead of trusting honour to flattering memory.", [oathAction("paladin:maintain-oath-ledger", "Maintain an Oath Ledger", "Record active commitments and supporting evidence, then mark what changed, who was informed, and what restitution remains when a promise cannot be kept.")]),
  row("Vowed Strike", "Commit a weapon stroke to an openly stated protective purpose; the attack remains physical and gains no Conviction merely for being declared.", [
    ability("paladin-vowed-strike"),
    oathAction("paladin:inspect-duty-arms", "Inspect Duty Arms", "Clean, fit, secure, and document the ordinary weapon, shield, armour, straps, and fasteners relied upon for a sworn watch or escort."),
  ]),
  row("Formal Introduction", "Present identity, office, authority, limits, and purpose before asking strangers to trust an armed oath-bearer.", [oathProficiency("paladin:formal-introduction", "Formal Introduction", "Use title, witness, seal, reference, and plain language to establish legitimate authority without demanding supernatural obedience.")]),
  row("Refuge Survey", "Judge a proposed sanctuary by exits, water, sanitation, fire, accessibility, privacy, occupancy, supplies, and who can lawfully admit people.", [oathAction("paladin:survey-refuge", "Survey a Refuge", "Document the capacity, hazards, routes, caretakers, rules, and unmet needs of a real place intended to shelter people temporarily.")]),
  row("Protective Interposition", "Recognize where your body, shield, door, rope, vehicle, or barrier could separate another person from an ordinary hazard without creating a worse one.", [oathPassive("paladin:protective-interposition", "Protective Interposition", "A Paladin who first surveys space can place mundane protection more safely during accidents, evacuations, disputes, and dangerous work.")]),
  row("Paladin Oath", "Choose Shield Oath, Truth Oath, Mercy Oath, or Beacon Oath as the specialization overlaying the uninterrupted oathbound Paladin progression.", [oathPassive("paladin:declared-oath", "Declared Paladin Oath", "The selected oath deepens native protection, accountability, restraint, or guidance without importing Cleric spells, borrowed martial resources, healing, smites, or another profession's cards.")]),

  row("Public Promise", "Make a limited commitment where the people affected can hear its scope and know how to report failure or abuse.", [oathAction("paladin:make-public-promise", "Make a Public Promise", "State one concrete duty, its limits, the responsible Paladin, a review point, and an accessible means for affected people to answer the claim.")]),
  row("Stand Fast", "Brace against a real incoming hostile hit; Conviction is earned only when Stand Fast actually absorbs nonzero harm rather than merely being activated.", [
    ability("paladin-stand-fast"),
    oathAction("paladin:brace-unsafe-structure", "Brace an Unsafe Structure", "Use suitable bodies, props, wedges, rope, and evacuation space to support an accessible failing object briefly without pretending the repair is permanent."),
  ]),
  row("Chain of Witness", "Preserve who saw, heard, handled, recorded, or relayed a claim so testimony does not become anonymous certainty.", [oathAction("paladin:build-witness-chain", "Build a Witness Chain", "List direct witnesses, later tellers, physical records, contradictions, gaps, pressure, and the exact point at which each person learned the account.")]),
  row("Safe-Conduct Terms", "Define who may travel, where, when, under whose protection, with what restrictions, and what the escort can realistically guarantee.", [oathAction("paladin:issue-safe-conduct", "Issue Safe-Conduct Terms", "Draft a bounded mundane guarantee of passage backed by named authorities, route, duration, recognition signs, and a procedure for challenge.")]),
  row("Armour Vigil", "Treat buckles, padding, rust, cracked links, bruising, heat, fatigue, and fit as protection duties rather than cosmetic concerns.", [oathAction("paladin:hold-armour-vigil", "Hold an Armour Vigil", "Inspect and maintain worn protection before duty, including fit for the person expected to carry, run, climb, sit, or render aid in it.")]),
  row("Dispute Boundary", "Separate immediate safety, uncontested facts, disputed claims, authority, remedy, and subjects that require another forum.", [oathAction("paladin:set-dispute-boundary", "Set a Dispute Boundary", "Ask willing parties to define the issue, stop conditions, evidence, speaking order, decision authority, and what cannot be settled here.")]),
  row("Companion Accountability", "Invite allies to name a promised course that has drifted and answer with evidence, correction, or an honest change of vow.", [oathPassive("paladin:companion-accountability", "Companion Accountability", "A group that agrees to mutual review catches missed duties and unsafe assumptions earlier; this grants no power to compel confession or loyalty.")]),
  row("Challenge of Witness", "Call a visible foe to answer conduct before those present; the oathcraft pressures attention and accountability but does not charm, dominate, or reveal supernatural truth.", [
    ability("paladin-challenge-of-witness"),
    oathAction("paladin:convene-witness-hearing", "Convene a Witness Hearing", "Arrange a safe speaking order, direct questions, recorded answers, protection from retaliation, and clear separation between testimony and judgment."),
  ]),
  row("Truthful Terms", "Negotiate without hiding obligations in ceremony, ambiguity, urgency, or unequal access to the written agreement.", [oathProficiency("paladin:truthful-terms", "Truthful Terms", "Explain the practical duty, price, risk, remedy, and exit of an agreement in language the affected parties can examine.")]),
  row("Evacuation Order", "Move those in greatest danger first while preserving routes for rescuers, mobility aids, dependants, animals, records, and later accountability.", [oathAction("paladin:order-evacuation", "Order an Evacuation", "Assign exits, guides, sweep zones, assembly points, headcounts, medical priorities, and a rule against re-entry until hazards are assessed.")]),

  row("Custody Standard", "Protect a detained person's identity, property, body, food, water, rest, legal status, and access to a responsible witness.", [oathPassive("paladin:custody-standard", "Custody Standard", "A Paladin maintaining custody records makes disappearance, theft, abuse, mistaken identity, and indefinite detention harder to conceal.")]),
  row("Night Refuge", "Organize shelter after dark without excluding the injured, poor, foreign, frightened, or socially inconvenient merely for being difficult guests.", [oathAction("paladin:open-night-refuge", "Open a Night Refuge", "Set capacity, watch, privacy, heat, sanitation, food, conflict rules, accessibility, and morning referral for a temporary shelter.")]),
  row("Oath Audit", "Compare a sworn body's public promises with orders, expenditure, complaints, outcomes, and the people who actually bore the cost.", [oathAction("paladin:audit-oath", "Audit an Oath", "Collect dated commitments, evidence of performance, exceptions, harmed parties, delegated responsibility, and proposed restitution without assuming title proves virtue.")]),
  row("Bear the Blow", "Spend earned Conviction to take a bounded hostile impact meant for another; this is native oathcraft, not healing, immunity, or transferred Cleric protection.", [
    ability("paladin-bear-the-blow"),
    oathAction("paladin:organize-rescue-carry", "Organize a Rescue Carry", "Choose a carry, litter, route, pace, bearers, handoff, and stop signal suited to the person's condition and the actual terrain."),
  ]),
  row("Gate Muster", "Confirm names, roles, reliefs, keys, signals, visitors, deliveries, emergency access, and missing personnel before a watch begins.", [oathAction("paladin:muster-gate-watch", "Muster a Gate Watch", "Brief a lawful watch on admission rules, escalation, protected persons, expected traffic, records, and whom to summon when authority is uncertain.")]),
  row("Civilian Corridor", "Mark a route through work, unrest, fire, flood, siege, or dangerous traffic that prioritizes unarmed passage without promising invulnerability.", [oathAction("paladin:mark-civilian-corridor", "Mark a Civilian Corridor", "Establish visible boundaries, times, guides, capacity, search rules, aid points, warnings, and contingencies for a protected passage.")]),
  row("Restitution Measure", "Match remedy to verified harm, benefit gained, ability to repair, ongoing risk, and the injured party's own stated needs.", [oathAction("paladin:measure-restitution", "Measure Restitution", "Draft a specific repair, return, payment, service, apology, protection, or review plan without treating punishment as automatic restoration.")]),
  row("Honest Warning", "State danger early enough to act, with evidence, uncertainty, affected area, safer alternative, and the cost of being wrong.", [oathPassive("paladin:honest-warning", "Honest Warning", "People familiar with the Paladin's restrained alerts are more likely to understand a real warning; credibility is social and can still be lost.")]),
  row("Burden Roster", "Distribute watch, carrying, care, cleaning, risk, and decision duties by capacity and consent instead of leaving them to the most dutiful person.", [oathAction("paladin:prepare-burden-roster", "Prepare a Burden Roster", "List necessary work, qualified people, limits, relief times, accommodations, and who may halt unsafe duty.")]),
  row("Advanced Oath", "Choose the advanced expression within the selected Paladin oath while retaining general Conviction, accountability, protection, and public-duty progression.", [oathPassive("paladin:declared-oath-office", "Declared Advanced Oath", "The chosen office refines Shield, Truth, Mercy, or Beacon oathcraft and never grants generic spellcasting, healing, smites, or another profession's resource.")]),

  row("Common Cause", "Translate different loyalties into one limited task whose success, authority, risks, and ending every participant understands.", [oathPassive("paladin:common-cause", "Common Cause", "Willing groups coordinate a declared shared duty more reliably when each party's boundaries and reasons remain visible.")]),
  row("Steadfast Word", "Spend Conviction on a spoken oathcraft assurance that helps willing allies hold to a chosen course; it is not healing, charm, compulsion, or a Cleric prayer.", [
    ability("paladin-steadfast-word"),
    oathAction("paladin:state-steadying-word", "State a Steadying Word", "Remind a willing person of verified preparation, available help, chosen duty, and a safe next action without dismissing fear or commanding belief."),
  ]),
  row("Watch Relief", "Transfer duty face to face with current hazards, unresolved incidents, keys, detained people, vulnerable guests, supplies, and authority clearly named.", [oathAction("paladin:conduct-watch-relief", "Conduct Watch Relief", "Use a spoken and written handoff so no person, promise, alarm, or restriction disappears between watches.")]),
  row("Protected Testimony", "Let a vulnerable witness speak without forcing public exposure, unsafe confrontation, or detail beyond what they actually remember.", [oathAction("paladin:protect-testimony", "Protect Testimony", "Arrange privacy, support, identity handling, breaks, faithful recording, corroboration, and a plan against retaliation for a willing witness.")]),
  row("Fire and Flood Line", "Set a defensible boundary around an ordinary disaster using terrain, weather, tools, trained labour, escape lanes, and changing conditions.", [oathAction("paladin:set-disaster-line", "Set a Disaster Line", "Mark where people may work, shelter, cross, or must withdraw during fire, flood, collapse, or contamination, then review it as evidence changes.")]),
  row("Prisoner Inventory", "Record a captive's person, injuries, possessions, restraints, charges, transfer, destination, and responsible custodian at every handoff.", [oathAction("paladin:inventory-prisoner", "Inventory a Prisoner", "Create a witnessed custody record that protects evidence and the detained person from theft, substitution, secret injury, or disappearance.")]),
  row("Banner Signals", "Use visible standards, lanterns, horns, bells, shields, and messengers according to a taught code rather than supernatural command.", [oathProficiency("paladin:banner-signals", "Banner Signals", "Teach and recognize a bounded signal set for halt, refuge, evacuation, parley, medical aid, danger, relief, and lawful assembly.")]),
  row("Judgment Stroke", "Spend Conviction on a measured physical judgment against a foe already called to account; armour and ordinary harm rules still apply, with no smite or true damage.", [
    ability("paladin-judgment-stroke"),
    oathAction("paladin:assemble-judgment-docket", "Assemble a Judgment Docket", "Separate allegations, authority, evidence, testimony, defence, precedent, remedy, appeal, and unresolved facts before recommending judgment."),
  ]),
  row("Measure of Force", "Use no more restraint or physical force than the verified danger, lawful purpose, available alternatives, and protection of bystanders require.", [oathPassive("paladin:measure-of-force", "Measure of Force", "A Paladin trained to articulate necessity, proportionality, and aftermath is better able to stop escalation and account for each use of force.")]),
  row("Shelter Steward", "Treat food, bedding, privacy, sanitation, accessibility, discipline, complaints, work, and departure as stewardship rather than charitable theatre.", [oathAction("paladin:steward-shelter", "Steward a Shelter", "Organize a temporary refuge with transparent allocation, responsible staff, posted rules, grievance routes, inventory, and transition plans.")]),

  row("Orphaned Duty", "Identify responsibilities left behind by death, flight, disgrace, or institutional collapse before vulnerable people become nobody's obligation.", [oathAction("paladin:adopt-orphaned-duty", "Adopt an Orphaned Duty", "Document the abandoned promise, urgent beneficiaries, legal authority, available resources, limits, and a responsible long-term transfer.")]),
  row("Road Compact", "Set mutual duties among travellers, settlements, patrols, ferries, inns, and carriers who depend upon the same dangerous route.", [oathAction("paladin:negotiate-road-compact", "Negotiate a Road Compact", "Draft shared expectations for warning, refuge, tolls, repair, missing travellers, bandit reports, emergency aid, and dispute review.")]),
  row("Crowd Passage", "Open space for the injured, children, elders, mobility aids, workers, and messengers through presence, explanation, barriers, and willing cooperation.", [oathAction("paladin:open-crowd-passage", "Open Crowd Passage", "Coordinate a humane physical lane with clear destination, pace, boundaries, stewards, and protection against crush or opportunistic exclusion.")]),
  row("Oath Renewal", "Review whether a vow still serves its named duty, remains possible, conflicts with a greater obligation, or now requires honest release and restitution.", [oathPassive("paladin:oath-renewal", "Oath Renewal", "A Paladin may restate, narrow, transfer, or end a duty openly rather than preserving harmful conduct merely to appear unwavering.")]),
  row("Rescue Priority", "Choose whom to reach first using immediacy, survivability, vulnerability, access, available skill, and danger to rescuers rather than rank or favour.", [oathAction("paladin:set-rescue-priority", "Set Rescue Priority", "Create a revisable rescue order with triage observations, assigned teams, extraction routes, and explicit reasons for delayed aid.")]),
  row("Hold the Line", "Spend Conviction to anchor a bounded protective line allies can use voluntarily; it blocks physical pressure rather than creating a magical wall or Warrior formation.", [
    ability("paladin-hold-the-line"),
    oathAction("paladin:prepare-protective-line", "Prepare a Protective Line", "Choose real barriers, spacing, exits, relief, signals, bystander lanes, and collapse conditions for a defensive or evacuation boundary."),
  ]),
  row("Missing-Person Muster", "Establish the last confirmed place, description, needs, companions, likely routes, hazards, voluntary absence, and who may safely search.", [oathAction("paladin:muster-missing-person-search", "Muster a Missing-Person Search", "Brief searchers on sectors, evidence handling, privacy, return times, communications, medical needs, and when to involve local experts.")]),
  row("False Claim Hearing", "Test an accusation without turning confidence, title, pain, inconsistency, or silence into proof by itself.", [oathAction("paladin:hear-contested-claim", "Hear a Contested Claim", "Record the precise claim, alternatives, evidence, motive, opportunity, corroboration, defence, and consequences of premature judgment.")]),
  row("Last Resort Record", "Document why ordinary negotiation, withdrawal, warning, restraint, or delay could not safely answer a grave threat before escalating force.", [oathPassive("paladin:last-resort-record", "Last Resort Record", "A Paladin who keeps contemporaneous reasons can be reviewed by others and cannot turn solemn language into automatic justification.")]),
  row("Oathbound Apex", "Choose the final specialization within the selected advanced oath, deepening its native protection, truth, mercy, or guidance without gaining a new card.", [oathPassive("paladin:declared-oath-apex", "Declared Oathbound Apex", "The apex grants concrete civic and protective capabilities, never another profession's spells, cards, healing, smites, or combat resource.")]),

  row("Brotherhood Provision", "Ensure fellow protectors have rest, food, equipment, relief, honest orders, medical referral, grievance, and permission to refuse an unlawful duty.", [oathAction("paladin:provision-brotherhood", "Provision a Brotherhood", "Audit the practical welfare and accountability of a sworn protective body without treating loyalty as silence.")]),
  row("Gate Inspection", "Examine hinges, bars, murder holes, stairs, lighting, drainage, crowd flow, fire egress, keys, records, and accessibility as one protective system.", [oathAction("paladin:inspect-gate", "Inspect a Gate", "Document structural, procedural, humane, and emergency faults in a guarded threshold and assign realistic repairs or mitigations.")]),
  row("Prisoner Exchange", "Plan a handover around identity, consent where possible, custody authority, injuries, property, witnesses, neutral ground, and what happens if terms fail.", [oathAction("paladin:arrange-prisoner-exchange", "Arrange a Prisoner Exchange", "Create a timed, witnessed transfer procedure with verification, protected approaches, medical support, records, and safe cancellation signals.")]),
  row("Merciful Arrest", "Spend Conviction to end active resistance with bounded physical custody rather than execution; it grants no healing, irresistible command, or automatic incapacity.", [
    ability("paladin-merciful-arrest"),
    oathAction("paladin:prepare-humane-custody", "Prepare Humane Custody", "Select lawful authority, safe restraints, search witnesses, transport, food, water, medical referral, property records, and review time before detention."),
  ]),
  row("Beacon Route", "Link refuge, water, repair, warning, lawful aid, and reliable messengers into a road others can actually follow.", [oathAction("paladin:establish-beacon-route", "Establish a Beacon Route", "Map ordinary waymarks, signals, safe stops, responsible hosts, seasonal hazards, distances, access limits, and fallback destinations.")]),
  row("Unbroken Testimony", "Preserve an account through exact wording, dated copies, independent witnesses, protected storage, provenance, and visible corrections.", [oathPassive("paladin:unbroken-testimony", "Unbroken Testimony", "A carefully maintained record is harder to erase or distort, but it remains evidence to examine rather than supernatural truth.")]),
  row("Oathfire Edge", "Spend Conviction to carry the visible pressure of a fulfilled vow through one physical weapon edge; it is native oathcraft, not a spell, smite, healing, or true damage.", [
    ability("paladin-oathfire-edge"),
    oathProficiency("paladin:oathfire-discipline", "Oathfire Discipline", "Display, sheath, and explain oathfire without using it as false proof of innocence, divine favour, legal authority, or another person's guilt."),
  ]),
  row("Public Reckoning", "Bring an institution's promise, conduct, harm, defence, remedy, and future oversight before the people entitled to answer it.", [oathAction("paladin:convene-public-reckoning", "Convene a Public Reckoning", "Arrange accessible notice, testimony, documentary evidence, reply, protection, decision authority, remedy, publication, and later review.")]),
  row("Crisis Succession", "Name who assumes each essential duty when leaders are dead, missing, compromised, exhausted, isolated, or lawfully removed.", [oathAction("paladin:plan-crisis-succession", "Plan Crisis Succession", "Write a limited succession chain for command, custody, shelter, supplies, records, and emergency authority with triggers and expiration.")]),
  row("Siege Relief", "Coordinate water, food, sanitation, fire watch, shelter, repair, casualty movement, ration transparency, negotiation, and civilian escape under prolonged danger.", [oathAction("paladin:organize-siege-relief", "Organize Siege Relief", "Create a humane duty and supply plan with reserves, relief crews, protected distribution, complaint channels, and conditions for evacuation or surrender talks.")]),

  row("Pilgrim Hospitality", "Welcome travellers of unfamiliar oath, origin, rank, or belief through transparent rules, safety, orientation, fair exchange, and a known time of departure.", [oathAction("paladin:offer-pilgrim-hospitality", "Offer Pilgrim Hospitality", "Arrange water, shelter, directions, worship or privacy needs, local warnings, responsibilities, and referral without demanding conversion or allegiance.")]),
  row("Last Witness", "Spend Conviction to remain the accountable witness when allies falter, preserving one bounded protective purpose without immunity, revival, healing, or supernatural truth.", [
    ability("paladin-last-witness"),
    oathAction("paladin:preserve-final-account", "Preserve a Final Account", "Record a willing person's name, words, possessions, dependants, unfinished duty, burial wishes, and the conditions under which the account was received."),
  ]),
  row("Broken Oath Inquiry", "Investigate failure through exact terms, capacity, warning, coercion, conflicting duties, benefit, concealment, harm, and attempted repair.", [oathAction("paladin:investigate-broken-oath", "Investigate a Broken Oath", "Build a review that distinguishes deliberate betrayal, negligence, incapacity, impossible conditions, mistaken terms, and justified refusal.")]),
  row("Dawn Watch", "Prepare a community's first safe hours after danger by confirming people, routes, water, fire, structures, custody, supplies, messages, and immediate decisions.", [oathAction("paladin:hold-dawn-watch", "Hold a Dawn Watch", "Lead a daylight damage and welfare survey with assigned sectors, visible findings, urgent barriers, family reunification, and a public next briefing.")]),
  row("Chainbreaker Writ", "Document the authority, evidence, safety, shelter, property, dependants, and long-term support needed to release someone from unlawful bondage.", [oathAction("paladin:prepare-chainbreaker-writ", "Prepare a Chainbreaker Writ", "Create a witnessed emancipation and protection record that anticipates retaliation, fraudulent claims, travel needs, livelihood, and legal challenge.")]),
  row("Honoured Dead", "Identify, recover, record, safeguard, return, or respectfully lay to rest the dead without erasing culture, evidence, family, or unknown identity.", [oathAction("paladin:honour-the-dead", "Honour the Dead", "Organize dignified recovery, identification, possessions, rites, records, family notice, burial, and later correction when facts remain uncertain.")]),
  row("Horizon Watch", "Look beyond the defended gate to roads, weather, displacement, failing alliances, supply, disease, and distant warnings that will become tomorrow's emergency.", [oathAction("paladin:survey-horizon-duty", "Survey Horizon Duty", "Compile a bounded forward review of travellers, messages, routes, seasonal hazards, neighbouring needs, and promises coming due.")]),
  row("Concord Assembly", "Bring rivals into a limited working agreement without pretending one ceremony dissolves history, grief, power, or conflicting interest.", [oathAction("paladin:assemble-concord", "Assemble a Concord", "Set representation, safety, agenda, verified common facts, interim duties, enforcement, review, dissent, and lawful exit for willing parties.")]),
  row("Living Covenant", "Make the sworn institution answerable through records, rotation, training, open complaint, protected dissent, material care, and regular public review.", [oathPassive("paladin:living-covenant", "Living Covenant", "An oath survives its founder more honestly when duty, evidence, resources, correction, and succession are carried by accountable people rather than legend alone.")]),
  row("Oath Incarnate", "Commit all required Conviction to the Paladin's supreme native oathcraft, becoming the physical point of a declared protection without healing, spellcasting, smite, true damage, or borrowed technique.", [
    ability("paladin-oath-incarnate"),
    oathPassive("paladin:incarnate-duty", "Incarnate Duty", "Outside battle, the same mastery lets the Paladin found, repair, or hand on an accountable protective covenant with clear beneficiaries, witnesses, resources, limits, correction, and succession."),
  ]),
];

export const PALADIN_PROGRESSION_LEVELS = Object.freeze(ROWS.map((entry, index) => Object.freeze({
  level: index + 1,
  ...entry,
})));
