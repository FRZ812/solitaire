import { progressionGrant } from "./progression-features.js";

const option = (id, name, description, grants) => Object.freeze({
  id,
  name,
  description,
  grants: Object.freeze(grants),
});

const choice = (id, threshold, name, description, options, parentChoiceId = null, parentOptionId = null) => Object.freeze({
  id,
  threshold,
  name,
  description,
  parentChoiceId,
  parentOptionId,
  options: Object.freeze(options),
});

const ability = (id) => progressionGrant("ability", id, { innate: true, source: "racial-branch" });
const proficiency = (id) => progressionGrant("proficiency", id, { source: "racial-branch" });
const passive = (id, name, description) => progressionGrant("passive", id, { name, description, source: "racial-branch" });
const action = (id, name, description) => progressionGrant("action", id, {
  name,
  description,
  source: "racial-branch",
  racialCapability: true,
});

// Racial branches are overlays on the ancestry's uninterrupted 1-30 ladder.
// They never spend a level and never choose themselves: a player reaching a
// threshold receives a pending choice that remains pending until explicitly
// resolved. NPCs may arrive with authored selections already recorded.
export const RACIAL_BRANCHES = Object.freeze({
  human: Object.freeze([
    choice("human-adaptation", 10, "Mortal Potential", "Decide which human strength will be pushed beyond ordinary limits.", [
      option("prodigy", "Prodigy", "Turn curiosity and rapid learning into a supernatural breadth of practice.", [passive("adaptable", "Prodigious Adaptation", "Learn unfamiliar disciplines rapidly and reduce penalties from using unmastered techniques."), action("human-improvisation", "Inspired Improvisation", "Attempt a trained solution with a nearby tool, custom, or fragment of remembered instruction.")]),
      option("paragon", "Paragon", "Refine presence, courage, and physical discipline until others follow your example.", [passive("tireless", "Paragon's Pace", "Sustain disciplined effort beyond normal mortal endurance."), ability("rallying-shout")]),
      option("survivor", "Survivor", "Become difficult to corner, exhaust, or permanently break.", [passive("enduring", "Mortal Tenacity", "Recover from hardship and resist effects that would leave a mortal helpless."), ability("second-wind")]),
    ]),
    choice("human-prodigy-calling", 20, "Prodigy's Calling", "Choose what the prodigy does with impossible breadth.", [
      option("polymath", "Polymath", "Connect several bodies of knowledge into solutions no single discipline can see.", [passive("clearmind", "Polymathic Recall", "Retain and connect lore across unrelated fields."), action("cross-discipline-synthesis", "Cross-Discipline Synthesis", "Combine two known proficiencies for one complex investigation or project.")]),
      option("innovator", "Innovator", "Reject inherited answers and create a workable method under pressure.", [passive("efficient", "Iterative Genius", "Repeated attempts become faster and waste fewer resources."), action("prototype-solution", "Prototype Solution", "Build a temporary device, procedure, or social mechanism for an immediate problem.")]),
    ], "human-adaptation", "prodigy"),
    choice("human-paragon-ideal", 20, "Paragon's Ideal", "Choose the ideal embodied by the mortal exemplar.", [
      option("inspiring-exemplar", "Inspiring Exemplar", "Make nearby people braver and more capable through visible example.", [passive("benediction", "Mortal Inspiration", "Allies rally more readily while they can see the paragon stand."), action("lead-by-example", "Lead by Example", "Turn a successful personal feat into momentum for companions attempting the same objective.")]),
      option("perfected-mortal", "Perfected Mortal", "Pursue balance of body, mind, and will without supernatural ancestry.", [passive("honed", "Perfected Practice", "Careful repetition sharpens all ordinary movement and craft."), proficiency("human:perfected-mortal")]),
    ], "human-adaptation", "paragon"),
    choice("human-survivor-instinct", 20, "Survivor's Instinct", "Choose how survival becomes mastery.", [
      option("unbroken", "Unbroken", "Endure pain, terror, and deprivation without surrendering agency.", [passive("unbowed", "Unbroken Will", "Remain effective while wounded or under coercive pressure."), ability("unbreakable-will")]),
      option("frontier-master", "Frontier Master", "Read danger early and live from almost any hostile land.", [passive("fortunate", "Survivor's Fortune", "Turn a narrow escape into a better position."), action("live-off-nothing", "Live Off Nothing", "Find shelter, water, and a viable route where others see only exposure.")]),
    ], "human-adaptation", "survivor"),
  ]),

  elf: Object.freeze([
    choice("elf-awakening", 10, "Elven Awakening", "Choose which ancient current awakens in the elf's long blood.", [
      option("starborn", "Starborn", "Cultivate luminous thought, patient spellcraft, and the memory of the high courts.", [passive("aegis", "Star-Mantled", "A fine ancestral ward turns aside hostile magic."), ability("mana-shield")]),
      option("greenblood", "Greenblood", "Bind heightened senses and long memory to living woodland.", [passive("evasion", "Leafstep", "Move through natural cover without betraying a trail."), ability("snare")]),
      option("duskborn", "Duskborn", "Embrace the silent, night-seeing inheritance of the deep and moonless places.", [passive("phantom", "Dusk Sight", "Darkness and visual misdirection obscure the elf less than other beings."), ability("shadowstep")]),
    ]),
    choice("elf-starborn-destiny", 20, "Starborn Destiny", "Choose how stellar inheritance reaches maturity.", [
      option("spellweaver", "Spellweaver", "Thread small workings together with exceptional delicacy.", [passive("channeler", "Ancestral Channel", "Innate arcane workings consume less effort when cast with patience."), ability("arcane-convergence")]),
      option("moon-seer", "Moon-Seer", "Read omen, emotion, and distant consequence in reflected light.", [passive("clearmind", "Moonlit Clarity", "Illusion and panic struggle to cloud the seer's judgment."), action("read-moon-omens", "Read Moon Omens", "Interpret a place or decision through celestial patterns and ancestral symbolism.")]),
    ], "elf-awakening", "starborn"),
    choice("elf-greenblood-destiny", 20, "Greenblood Destiny", "Choose how kinship with the wild matures.", [
      option("wild-runner", "Wild Runner", "Become the tireless motion of branch, glade, and hunt.", [passive("fleet", "Wildrunner's Pace", "Natural terrain no longer meaningfully slows travel or pursuit."), action("path-through-leaves", "Path Through Leaves", "Guide a group through living terrain without leaving an ordinary trail.")]),
      option("grove-voice", "Grove Voice", "Hear the condition and old memories of rooted living things.", [passive("tireless", "Grove Sustenance", "Resting among healthy growth restores composure and endurance."), action("speak-for-the-grove", "Speak for the Grove", "Question ancient plants and negotiate with a place's living ecology.")]),
    ], "elf-awakening", "greenblood"),
    choice("elf-duskborn-destiny", 20, "Duskborn Destiny", "Choose what the elf becomes beyond the edge of sight.", [
      option("nightblade", "Nightblade", "Turn perfect silence and timing into predatory precision.", [passive("evasive", "Moonless Motion", "Gain exceptional avoidance after entering combat unseen."), ability("venom-strike")]),
      option("dream-walker", "Dream Walker", "Move through memory, reverie, and crafted perception.", [passive("clearmind", "Lucid Reverie", "Recognize when a dream or illusion is trying to dictate behavior."), ability("mirror-image")]),
    ], "elf-awakening", "duskborn"),
  ]),

  dwarf: Object.freeze([
    choice("dwarf-deep-calling", 10, "Deep Calling", "Choose the ancestral craft carried into the dwarf's elder years.", [
      option("forgeheart", "Forgeheart", "Hear temperature, tension, and impurity in worked material.", [passive("stoneskin", "Forge-Hardened", "Heat, sparks, and punishing workshop conditions cause less harm."), action("hear-the-metal", "Hear the Metal", "Assess hidden flaws and the treatment history of a worked object by touch and sound.")]),
      option("stonewarden", "Stonewarden", "Become a living bulwark shaped by mountain pressure.", [passive("stalwart", "Mountain Stance", "Forced movement and bodily shock are less effective against the dwarf."), ability("bulwark-stance")]),
      option("ancestor-keeper", "Ancestor Keeper", "Carry genealogies, grudges, oaths, and techniques as living obligations.", [passive("clearmind", "Ancestral Recall", "Recall lineage, oath, and traditional procedure with exceptional accuracy."), action("invoke-ancestral-oath", "Invoke Ancestral Oath", "Establish the weight and witnesses of an old compact in negotiation.")]),
    ]),
    choice("dwarf-forgeheart-mastery", 20, "Forgeheart Mastery", "Choose the forgeheart's mature craft.", [
      option("rune-smith", "Rune Smith", "Seat stable enchantment into material through geometry and heat.", [passive("wardstone", "Rune-Hardened", "Carried runes reinforce resistance to hostile workings."), action("inscribe-ancestral-rune", "Inscribe Ancestral Rune", "Prepare a durable lineage rune for a fitting crafted object.")]),
      option("master-founder", "Master Founder", "Create great pieces whose balance survives generations of use.", [passive("efficient", "Founder's Economy", "Large metalwork wastes less fuel and material."), action("cast-great-work", "Cast Great Work", "Plan and execute monumental metalwork beyond an ordinary workshop's scale.")]),
    ], "dwarf-deep-calling", "forgeheart"),
    choice("dwarf-stonewarden-mastery", 20, "Stonewarden Mastery", "Choose the stonewarden's final relationship with the mountain.", [
      option("living-bastion", "Living Bastion", "Hold a passage as though flesh were fitted stone.", [passive("bastion", "Living Bastion", "Guarding a fixed position greatly improves resistance to harm."), ability("stone-armor")]),
      option("deep-delver", "Deep Delver", "Read voids, pressure, and fault through boot and palm.", [passive("enduring", "Deep Endurance", "Thin air, darkness, and long confinement are less debilitating."), action("read-deep-stone", "Read Deep Stone", "Sense instability, worked cavities, and nearby mineral seams through stone.")]),
    ], "dwarf-deep-calling", "stonewarden"),
    choice("dwarf-ancestor-mastery", 20, "Ancestral Office", "Choose how ancestral duty is exercised.", [
      option("oath-judge", "Oath-Judge", "Distinguish an honest compact from clever evasion.", [passive("defiance", "Oathbound Resolve", "Coercion that would force betrayal meets exceptional resistance."), action("judge-the-oath", "Judge the Oath", "Mediate a binding settlement under the laws of lineage and witnessed word.")]),
      option("memory-lord", "Memory Lord", "Become a walking archive of craft and clan history.", [passive("grand-strategist", "Deep Memory", "Old campaigns and works can be reconstructed from fragmentary evidence."), action("restore-lost-tradition", "Restore Lost Tradition", "Reconstruct a lost dwarven method from surviving tools, marks, and oral fragments.")]),
    ], "dwarf-deep-calling", "ancestor-keeper"),
  ]),

  halfling: Object.freeze([
    choice("halfling-heart", 10, "Heartroad", "Choose the small folk virtue that becomes quietly supernatural.", [
      option("hearthkeeper", "Hearthkeeper", "Make safety, food, and belonging persist under pressure.", [passive("mending", "Hearth's Comfort", "Rest and shared meals restore the group more effectively."), action("make-a-hearth", "Make a Hearth", "Create a defensible, comforting camp from remarkably poor surroundings.")]),
      option("fortune-rider", "Fortune Rider", "Trust the narrow opening and arrive exactly where disaster misses.", [passive("fortunate", "Fortune Rider", "Bad outcomes are more likely to leave one useful escape or consolation."), ability("feint")]),
      option("quiet-wayfarer", "Quiet Wayfarer", "Pass unnoticed through roads, thresholds, and dangerous company.", [passive("evasion", "Underfoot", "Larger creatures struggle to pin down the halfling in a crowd or melee."), ability("shadowstep")]),
    ]),
    choice("halfling-hearth-destiny", 20, "Great Hearth", "Choose what the hearthkeeper protects.", [
      option("sanctuary-host", "Sanctuary Host", "Extend hospitality as a ward against fear and betrayal.", [passive("benediction", "Sanctuary Table", "Invited allies resist fear and despair while sharing the hearth."), action("declare-sanctuary", "Declare Sanctuary", "Establish a temporary place of truce whose violation carries social and spiritual weight.")]),
      option("community-root", "Community Root", "Hold a scattered community together through memory and mutual obligation.", [passive("phalanx", "Neighbour's Courage", "Gain resilience when protecting a nearby companion."), action("rally-the-neighbours", "Rally the Neighbours", "Organize ordinary people into a competent mutual-aid effort.")]),
    ], "halfling-heart", "hearthkeeper"),
    choice("halfling-fortune-destiny", 20, "Fortune's Turn", "Choose how improbable luck is directed.", [
      option("luck-broker", "Luck Broker", "Give an ally the opening that would otherwise have been yours.", [passive("reprieve", "Shared Reprieve", "A fortunate escape can protect a nearby ally instead."), action("pass-the-luck", "Pass the Luck", "Transfer a recent situational advantage to a companion's immediate attempt.")]),
      option("impossible-escape", "Impossible Escape", "Always notice the mouse-hole in the trap.", [passive("evasive", "Impossible Escape", "Restraints and encirclement have a chance to yield a narrow exit."), ability("haste")]),
    ], "halfling-heart", "fortune-rider"),
    choice("halfling-wayfarer-destiny", 20, "Wayfarer's Secret", "Choose the quiet wayfarer's mature talent.", [
      option("threshold-walker", "Threshold Walker", "Understand servants' passages, forgotten doors, and social blind spots.", [passive("nimble", "Threshold Step", "Move through occupied spaces with little loss of speed."), action("find-the-small-door", "Find the Small Door", "Locate an overlooked physical or social route into a guarded place.")]),
      option("tale-carrier", "Tale Carrier", "Carry trustworthy news between communities without drawing the powerful's notice.", [passive("swift", "Long Little Road", "Sustain a deceptively fast travel pace over civilized roads."), action("carry-quiet-word", "Carry Quiet Word", "Move a message through common households while concealing its origin.")]),
    ], "halfling-heart", "quiet-wayfarer"),
  ]),

  "half-orc": Object.freeze([
    choice("half-orc-claim", 10, "Blood Claimed", "Choose which inheritance the half-orc claims as their own.", [
      option("ironblood", "Ironblood", "Refuse fragility and turn mixed blood into relentless physical recovery.", [passive("renewing", "Ironblood Recovery", "Recover steadily from wounds that would disable an ordinary warrior."), ability("second-wind")]),
      option("bridgekeeper", "Bridgekeeper", "Make hard-won understanding between peoples into a source of authority.", [passive("unbowed", "Belong to Yourself", "Insults and identity-based coercion cannot easily shake composure."), action("speak-between-peoples", "Speak Between Peoples", "Translate not just language but taboo, status, and grievance between hostile groups.")]),
      option("warhowl", "Warhowl", "Unite human intent with orcish battle instinct.", [passive("rampage", "Warhowl Momentum", "Breaking an enemy's line feeds immediate offensive momentum."), ability("rallying-shout")]),
    ]),
    choice("half-orc-ironblood-form", 20, "Ironblood Form", "Choose how the ironblood body reaches maturity.", [
      option("scarred-colossus", "Scarred Colossus", "Let healed wounds become armor and leverage.", [passive("colossus", "Scarred Colossus", "Size and accumulated hardship improve resistance to direct force."), ability("stone-armor")]),
      option("death-refuser", "Death Refuser", "Remain dangerous at the point where others collapse.", [passive("undying", "Death Refusal", "Once per crisis, remain standing through an otherwise disabling wound."), ability("unbreakable-will")]),
    ], "half-orc-claim", "ironblood"),
    choice("half-orc-bridgekeeper-form", 20, "Bridgekeeper's Office", "Choose how the bridgekeeper changes divided communities.", [
      option("peace-speaker", "Peace-Speaker", "Name the price of peace without concealing either side's wounds.", [passive("clearmind", "Two Truths Held", "Hold contradictory testimony without rushing to a false compromise."), action("forge-blood-truce", "Forge Blood Truce", "Negotiate a limited but binding peace between hereditary enemies.")]),
      option("free-clan-founder", "Free-Clan Founder", "Create belonging for people rejected by inherited categories.", [passive("benediction", "Chosen Kin", "Companions who explicitly join the free clan resist isolation and fear."), action("found-free-clan", "Found Free Clan", "Establish a durable oath of mutual belonging independent of ancestry.")]),
    ], "half-orc-claim", "bridgekeeper"),
    choice("half-orc-warhowl-form", 20, "Warhowl Form", "Choose what the warhowl demands from battle.", [
      option("line-breaker", "Line Breaker", "Turn speed and mass into a breach others can exploit.", [passive("juggernaut", "Line-Breaking Mass", "Charging and forced movement become dramatically harder to stop."), ability("earthshatter")]),
      option("clan-shield", "Clan Shield", "Use terrifying presence to keep danger fixed on yourself.", [passive("phalanx", "Clan Shield", "Interposing for chosen kin improves personal defense."), ability("bulwark-stance")]),
    ], "half-orc-claim", "warhowl"),
  ]),

  orc: Object.freeze([
    choice("orc-ascendance", 10, "High Orc Ascendance", "Choose the strength by which an orc rises beyond common blood.", [
      option("bloodfang", "Bloodfang", "Hunt weakness and grow more dangerous once blood is drawn.", [passive("bloodhunt", "Bloodfang Hunt", "Wounded enemies are easier to pursue and finish."), ability("rend")]),
      option("warcaller", "Warcaller", "Bind warriors through cadence, challenge, and visible courage.", [passive("rampage", "Warcall Momentum", "A fallen foe strengthens the next advance."), ability("rallying-shout")]),
      option("ironhide", "Ironhide", "Harden muscle and hide into living armor.", [passive("stoneskin", "Ironhide", "Natural armor reduces physical harm even without equipment."), ability("stone-armor")]),
    ]),
    choice("orc-bloodfang-destiny", 20, "Bloodfang Destiny", "Choose the elder predator's method.", [
      option("red-hunter", "Red Hunter", "Track injury by scent across battle and wilderness.", [passive("executioner", "Scent of Weakness", "Attacks become more decisive against badly wounded prey."), action("track-by-blood", "Track by Blood", "Follow a wounded creature across terrain despite efforts to hide the trail.")]),
      option("devourer", "Devourer", "Turn the violence of a kill into immediate recovery.", [passive("feast", "Victor's Feast", "Defeating a nearby enemy restores a measure of health and vigor."), ability("execute")]),
    ], "orc-ascendance", "bloodfang"),
    choice("orc-warcaller-destiny", 20, "Warcaller Destiny", "Choose the warcaller's elder command.", [
      option("horde-voice", "Horde Voice", "Make a mass of fighters move as one body.", [passive("grand-strategist", "Horde Cadence", "Nearby allies coordinate charges and withdrawals more effectively."), action("call-the-horde", "Call the Horde", "Organize a large irregular force around a single immediate battle plan.")]),
      option("challenge-chief", "Challenge Chief", "Rule through witnessed tests of courage and strength.", [passive("defiance", "Chief's Defiance", "Direct challenges strengthen resistance to fear and control."), ability("wrath")]),
    ], "orc-ascendance", "warcaller"),
    choice("orc-ironhide-destiny", 20, "Ironhide Destiny", "Choose what the hardened elder body becomes.", [
      option("siege-body", "Siege Body", "Use the body as a ram against doors, shields, and fortifications.", [passive("worldbreaker", "Siege Body", "Strikes against objects and fortifications carry immense force."), ability("earthshatter")]),
      option("unyielding-elder", "Unyielding Elder", "Stand through punishment that would scatter a warband.", [passive("adamant", "Unyielding Hide", "Repeated impacts become less effective during a sustained stand."), ability("unbreakable-will")]),
    ], "orc-ascendance", "ironhide"),
  ]),

  goblin: Object.freeze([
    choice("goblin-rise", 10, "Hobgoblin Rise", "Choose the cunning that carries a goblin beyond the warren's ordinary limits.", [
      option("scrap-savant", "Scrap Savant", "See mechanisms and useful parts where others see refuse.", [passive("efficient", "Nothing Wasted", "Improvised craft consumes fewer viable materials."), action("warren-rig", "Warren Rig", "Assemble a temporary trap, tool, or mechanism from discarded components.")]),
      option("gloom-skulker", "Gloom Skulker", "Turn small stature and constant vigilance into perfect infiltration.", [passive("phantom", "Gloom-Small", "Remain difficult to notice when cover or larger creatures break sightlines."), ability("shadowstep")]),
      option("warren-lord", "Warren Lord", "Coordinate many vulnerable goblins through signals, caches, and contingency.", [passive("grand-strategist", "Warren Mind", "Prepared routes and hidden reserves make a group difficult to corner."), action("organize-warren", "Organize Warren", "Convert cramped terrain into a network of alarms, caches, and escape paths.")]),
    ]),
    choice("goblin-savant-destiny", 20, "Savant's Device", "Choose what the scrap savant learns to build.", [
      option("trap-genius", "Trap Genius", "Build layered traps that herd rather than merely wound.", [passive("precise", "Trap Geometry", "Placed mechanisms trigger more reliably and discriminate intended targets."), action("build-chain-trap", "Build Chain Trap", "Link several small mechanisms into one staged environmental trap.")]),
      option("boomwright", "Boomwright", "Master unstable heat, pressure, and spectacular escape timing.", [passive("incendiary", "Blastwise", "Suffer less harm from one's own fire and explosive devices."), ability("combust")]),
    ], "goblin-rise", "scrap-savant"),
    choice("goblin-skulker-destiny", 20, "Skulker's Art", "Choose the gloom skulker's mature technique.", [
      option("knife-in-dark", "Knife in the Dark", "Turn unseen approach into one precise disabling strike.", [passive("keen-edge", "First Cut", "The first attack made from concealment is more accurate and dangerous."), ability("venom-strike")]),
      option("unseen-scavenger", "Unseen Scavenger", "Enter, recover, and leave without disturbing the story of a place.", [passive("evasion", "Scuttle Away", "Escaping a threatened space briefly improves avoidance."), action("leave-no-warren-sign", "Leave No Warren Sign", "Remove the small disturbances that reveal passage or searching.")]),
    ], "goblin-rise", "gloom-skulker"),
    choice("goblin-lord-destiny", 20, "Warren Dominion", "Choose the warren lord's model of rule.", [
      option("many-eyes", "Many Eyes", "Build an intelligence web from overlooked people and tiny signs.", [passive("hawkeye", "Many Eyes", "Scouts and lookouts under the goblin's plan miss fewer approaching threats."), action("warren-whispers", "Warren Whispers", "Collect local movement and rumor through a distributed watcher network.")]),
      option("tunnel-king", "Tunnel King", "Make earthworks, chokepoints, and retreat routes into sovereign terrain.", [passive("bastion", "Tunnel Advantage", "Fighting in prepared confined terrain greatly improves defense."), action("claim-the-tunnels", "Claim the Tunnels", "Prepare an underground or urban route network for defense and evacuation.")]),
    ], "goblin-rise", "warren-lord"),
  ]),

  drakeborn: Object.freeze([
    choice("drakeborn-breath-line", 10, "Wyrm-Blood Awakening", "Choose which draconic element answers as the blood thickens.", [
      option("ember-line", "Ember Line", "Awaken tyrant fire that clings to armor and ground.", [passive("incendiary", "Ember Scales", "Heat and flame are less able to harm the drakeborn."), ability("dragon-breath")]),
      option("frost-line", "Frost Line", "Awaken killing cold and the patience of winter stone.", [passive("frostbrand", "Rime Scales", "Cold and numbing effects are less able to slow the drakeborn."), ability("frost-nova")]),
      option("storm-line", "Storm Line", "Awaken lightning, thunder, and restless high-air instinct.", [passive("tempest", "Storm Scales", "Electrical harm feeds a brief surge of speed rather than only pain."), ability("electrocute")]),
    ]),
    choice("drakeborn-ember-ascendance", 20, "Ember Ascendance", "Choose the final shape of the fire-line before dragon apotheosis.", [
      option("caldera-heart", "Caldera Heart", "Carry a furnace that erupts outward under pressure.", [passive("soulflame", "Caldera Heart", "Severe wounds kindle greater fire output and resistance."), ability("fireball")]),
      option("cinder-tyrant", "Cinder Tyrant", "Use heat and looming draconic presence to dominate space.", [passive("rampage", "Tyrant Flame", "Enemies broken by fire feed momentum and dread."), ability("mass-terror")]),
    ], "drakeborn-breath-line", "ember-line"),
    choice("drakeborn-frost-ascendance", 20, "Frost Ascendance", "Choose the final shape of the frost-line before dragon apotheosis.", [
      option("glacier-hide", "Glacier Hide", "Layer every vital scale like ancient blue ice that hardens under pressure.", [passive("adamant", "Glacier Hide", "Natural armor hardens while holding position."), ability("deep-freeze")]),
      option("white-tempest", "White Tempest", "Turn breath into a field of blinding cold.", [passive("overload", "Whiteout Pressure", "Area effects become harder to resist after cold has taken hold."), ability("blizzard")]),
    ], "drakeborn-breath-line", "frost-line"),
    choice("drakeborn-storm-ascendance", 20, "Storm Ascendance", "Choose the final shape of the storm-line before dragon apotheosis.", [
      option("thunder-heart", "Thunder Heart", "Make every surge of motion carry concussive force.", [passive("stormrend", "Thunder Heart", "Charged attacks tear through ward more effectively."), ability("lightning-bolt")]),
      option("sky-coil", "Sky Coil", "Embody the speed and reach of a storm front.", [passive("quicksilver", "Sky-Coil Motion", "Initiative and repositioning rise sharply after using innate breath."), ability("chain-lightning")]),
    ], "drakeborn-breath-line", "storm-line"),
  ]),

  beastfolk: Object.freeze([
    choice("beastfolk-primal-line", 10, "Primal Blood", "Choose which instinct becomes the beastfolk's evolved strength.", [
      option("silent-predator", "Silent Predator", "Cultivate feline patience, balance, and a decisive pounce.", [passive("evasion", "Predator's Balance", "Sudden movement and precarious footing rarely expose the beastfolk."), ability("shadowstep")]),
      option("pack-runner", "Pack Runner", "Cultivate lupine endurance, scent, and cooperative pursuit.", [passive("phalanx", "Pack Rhythm", "Fighting near chosen pack improves offense and defense."), action("read-pack-scent", "Read Pack Scent", "Track emotional state, injury, and recent passage by scent.")]),
      option("great-bear", "Great Bear", "Cultivate ursine mass, patience, and protective fury.", [passive("stalwart", "Great-Bear Frame", "Natural mass resists knockback and bodily control."), ability("beast-shift")]),
      option("far-seer", "Far-Seer", "Cultivate avian distance vision, light movement, and high-route instinct.", [passive("hawkeye", "Far-Seer Eyes", "Read fine movement at exceptional distance."), action("read-the-high-road", "Read the High Road", "Plan routes through roofs, cliffs, and exposed heights that ground-bound travelers miss.")]),
    ]),
    choice("beastfolk-predator-apex", 20, "Predator's Apex", "Choose the mature hunting instinct.", [
      option("night-pouncer", "Night Pouncer", "Explode from stillness into a disabling first assault.", [passive("blitz", "Pouncing Start", "The first action from concealment gains exceptional speed."), ability("rending-claws")]),
      option("nine-lived", "Nine-Lived", "Twist away from the fatal angle by impossible instinct.", [passive("reprieve", "Nine-Lived", "A lethal mistake may become a narrow, costly escape."), ability("haste")]),
    ], "beastfolk-primal-line", "silent-predator"),
    choice("beastfolk-pack-apex", 20, "Pack Apex", "Choose how the pack-runner serves chosen kin.", [
      option("alpha-voice", "Alpha Voice", "Coordinate the pack through posture, breath, and a single call.", [passive("grand-strategist", "Pack Command", "Allies following the same marked quarry coordinate more effectively."), ability("rallying-shout")]),
      option("endless-hunter", "Endless Hunter", "Pursue without surrendering distance to exhaustion.", [passive("tireless", "Endless Hunt", "Long pursuits and forced marches drain far less endurance."), action("run-down-prey", "Run Down Prey", "Maintain a group pursuit by reading pace, fatigue, and likely refuge.")]),
    ], "beastfolk-primal-line", "pack-runner"),
    choice("beastfolk-bear-apex", 20, "Great-Bear Apex", "Choose how ursine power protects or destroys.", [
      option("den-guardian", "Den Guardian", "Become immovable when danger reaches chosen home or kin.", [passive("bastion", "Den Guardian", "Defense rises sharply while interposed between danger and an ally."), ability("bulwark-stance")]),
      option("mauling-giant", "Mauling Giant", "Turn weight and claws into overwhelming close violence.", [passive("brutal", "Mauling Mass", "Natural attacks hit with greater force against controlled targets."), ability("earthshatter")]),
    ], "beastfolk-primal-line", "great-bear"),
    choice("beastfolk-seer-apex", 20, "Far-Seer Apex", "Choose how distance and height become mastery.", [
      option("storm-wing", "Storm Wing", "Move with sudden air-pressure changes and weather instinct.", [passive("swift", "Storm-Wing Pace", "Open ground and vertical movement grant exceptional speed."), ability("tempest")]),
      option("horizon-eye", "Horizon Eye", "Read armies, weather, and terrain as moving patterns.", [passive("deadeye", "Horizon Focus", "Extreme distance imposes less loss of precision."), action("survey-the-horizon", "Survey the Horizon", "Produce a high-confidence tactical survey from a distant vantage.")]),
    ], "beastfolk-primal-line", "far-seer"),
  ]),

  demonborn: Object.freeze([
    choice("demonborn-inheritance", 10, "Infernal Inheritance", "Choose what the demon blood is permitted to become.", [
      option("hellfire-scion", "Hellfire Scion", "Feed infernal heat until it becomes a disciplined weapon.", [passive("incendiary", "Hellfire Skin", "Fire and burn effects are less effective against the scion."), ability("hellfire-bolt")]),
      option("velvet-tempter", "Velvet Tempter", "Refine beauty, sympathy, and suggestion into dangerous social gravity.", [passive("fortunate", "Disarming Grace", "First impressions more often begin receptive rather than hostile."), ability("charm")]),
      option("abyssal-vessel", "Abyssal Vessel", "Make room within body and will for a deeper, more monstrous power.", [passive("cursed", "Abyssal Vessel", "Resist hostile shadow magic while becoming more legible to holy senses."), ability("dread-aura")]),
    ]),
    choice("demonborn-hellfire-apex", 20, "Hellfire Apotheosis", "Choose the final discipline of infernal flame.", [
      option("soulflame", "Soulflame", "Burn resolve and spirit instead of only flesh.", [passive("soulflame", "Soulflame Blood", "Infernal attacks become more punishing against weakened will."), ability("soul-rend")]),
      option("living-inferno", "Living Inferno", "Become the center of a spreading field of destructive heat.", [passive("overload", "Infernal Overload", "Sustained spell use intensifies subsequent fire output."), ability("fireball")]),
    ], "demonborn-inheritance", "hellfire-scion"),
    choice("demonborn-tempter-apex", 20, "Tempter Apotheosis", "Choose how the velvet tempter controls a room.", [
      option("heart-thief", "Heart Thief", "Create genuine-seeming attachment that survives ordinary doubt.", [passive("benediction", "Beautiful Lie", "Social targets retain a warmer memory of favorable interactions."), ability("beguiling-command")]),
      option("court-devil", "Court Devil", "Rule through bargains, favors, and carefully rationed fear.", [passive("grand-strategist", "Infernal Etiquette", "Track obligations and leverage across complex social networks."), action("seal-infernal-favour", "Seal Infernal Favour", "Formalize a favor whose exact wording has supernatural social weight.")]),
    ], "demonborn-inheritance", "velvet-tempter"),
    choice("demonborn-vessel-apex", 20, "Vessel Apotheosis", "Choose what occupies the abyssal vessel.", [
      option("dread-incarnate", "Dread Incarnate", "Let the hidden monstrous presence break enemy nerve.", [passive("defiance", "Feeds on Fear", "Frightened enemies strengthen the vessel's resistance."), ability("mass-terror")]),
      option("forbidden-form", "Forbidden Form", "Briefly unfold a body the mortal world was not built to hold.", [passive("ascendant", "Forbidden Anatomy", "Transformation greatly improves resilience but makes concealment impossible."), ability("beast-shift")]),
    ], "demonborn-inheritance", "abyssal-vessel"),
  ]),

  vampire: Object.freeze([
    choice("vampire-dark-legacy", 10, "Dark Legacy", "Before full vampiric evolution, choose which hunger will define the immortal blood.", [
      option("blood-sovereign", "Blood Sovereign", "Rule hunger instead of serving it, turning stolen vitality into authority.", [passive("vampiric", "Sovereign Hunger", "Blood-draining effects restore more vitality when used with restraint."), ability("blood-siphon")]),
      option("night-stalker", "Night Stalker", "Abandon the court for speed, silence, and the geometry of the hunt.", [passive("phantom", "Nocturnal Predator", "Darkness sharply improves concealment and pursuit."), ability("shadowstep")]),
      option("corpse-lord", "Corpse Lord", "Accept kinship with death itself and command lesser dead things.", [passive("revenant", "Grave Authority", "Undead and deathly environments are less able to erode the vampire."), ability("summon-undead")]),
    ]),
    choice("vampire-sovereign-apotheosis", 20, "Sovereign Apotheosis", "Choose the perfected law of blood before becoming a True Vampire.", [
      option("crimson-monarch", "Crimson Monarch", "Bind servants and rivals through blood-oath, awe, and measured feeding.", [passive("bloodthirst", "Crimson Dominion", "Freshly drained blood empowers presence and control rather than frenzy."), ability("dominate")]),
      option("scarlet-alchemist", "Scarlet Alchemist", "Read blood as memory, poison, medicine, and occult medium.", [passive("mending", "Living Vintage", "Carefully prepared blood improves regeneration and recovery."), action("read-the-blood", "Read the Blood", "Analyze fresh blood for lineage, illness, recent exertion, and supernatural contamination.")]),
    ], "vampire-dark-legacy", "blood-sovereign"),
    choice("vampire-stalker-apotheosis", 20, "Stalker Apotheosis", "Choose the perfected hunt before becoming a True Vampire.", [
      option("mist-reaver", "Mist Reaver", "Dissolve the body's outline and strike from cold night vapor.", [passive("umbra", "Mist Body", "Brief movement through darkness gains exceptional avoidance."), ability("mirror-image")]),
      option("apex-hunter", "Apex Hunter", "Mark one heartbeat and pursue it across city, ruin, or wilderness.", [passive("bloodhunt", "Heartbeat Quarry", "A wounded marked target is exceedingly difficult to lose."), action("mark-heartbeat", "Mark Heartbeat", "Memorize one living heartbeat and track its direction while nearby.")]),
    ], "vampire-dark-legacy", "night-stalker"),
    choice("vampire-corpse-apotheosis", 20, "Corpse-Lord Apotheosis", "Choose the throne built from death before becoming a True Vampire.", [
      option("grave-general", "Grave General", "Command disciplined undead retainers rather than a shambling mob.", [passive("grand-strategist", "Deathless Command", "Summoned undead coordinate and retain simple standing orders."), action("marshal-the-dead", "Marshal the Dead", "Organize available corpses or undead into a persistent, ordered host.")]),
      option("deathless-body", "Deathless Body", "Perfect the corpse beneath the immortal face until destruction becomes temporary.", [passive("undying", "True Deathlessness", "Ordinary mortal trauma cannot permanently kill the vampire without exploiting a listed weakness."), ability("unbreakable-will")]),
    ], "vampire-dark-legacy", "corpse-lord"),
  ]),

  lycanthrope: Object.freeze([
    choice("lycanthrope-moon-path", 10, "Moon Path", "Choose how the beast and mortal will learn to share one body.", [
      option("moonclaw", "Moonclaw", "Let predatory instinct sharpen the transformed body's violence.", [passive("savage", "Moonclaw", "Natural attacks become more dangerous while transformed."), ability("rending-claws")]),
      option("pack-alpha", "Pack Alpha", "Turn territorial instinct into protection and coordination of chosen kin.", [passive("phalanx", "Alpha's Pack", "Nearby chosen pack improves resistance and coordinated attacks."), ability("rallying-shout")]),
      option("spirit-beast", "Spirit Beast", "Seek accord with the symbolic beast behind flesh and moon.", [passive("clearmind", "Two Minds in Accord", "Transformation no longer clouds memory or judgment."), ability("beast-shift")]),
    ]),
    choice("lycanthrope-moonclaw-apex", 20, "Moonclaw Apotheosis", "Choose the perfected predatory form.", [
      option("red-maw", "Red Maw", "Feed momentum and recovery through the violence of the hunt.", [passive("feast", "Red Maw", "Defeating bleeding prey restores health while transformed."), ability("execute")]),
      option("silver-scarred", "Silver-Scarred", "Train through the ancestral weakness until silver wounds but no longer rules the mind.", [passive("adamant", "Silver-Scarred", "Silver remains harmful but causes less control loss and panic."), ability("unbreakable-will")]),
    ], "lycanthrope-moon-path", "moonclaw"),
    choice("lycanthrope-alpha-apex", 20, "Alpha Apotheosis", "Choose how the true pack is led.", [
      option("war-pack", "War-Pack Alpha", "Move a hunting band through battle as one many-fanged creature.", [passive("grand-strategist", "War-Pack Rhythm", "Pack members coordinating on the same target gain precision."), action("call-the-war-pack", "Call the War Pack", "Issue scent, gesture, and voice cues that coordinate a mobile group assault.")]),
      option("den-father", "Den-Father", "Make territory and kin safer through tireless vigilance.", [passive("bastion", "Den-Father", "Defense rises when fighting within claimed shelter or beside vulnerable pack."), action("claim-safe-den", "Claim Safe Den", "Prepare a site whose exits, scents, and watches strongly resist surprise.")]),
    ], "lycanthrope-moon-path", "pack-alpha"),
    choice("lycanthrope-spirit-apex", 20, "Spirit-Beast Apotheosis", "Choose the final accord between spirit and flesh.", [
      option("moon-spirit", "Moon Spirit", "Move in a half-real form under moonlight and dream.", [passive("phantom", "Moon-Phased", "Moonlight enables brief supernatural concealment and passage."), ability("shadowstep")]),
      option("primal-exemplar", "Primal Exemplar", "Shift deliberately between human reason and perfected animal senses.", [passive("ascendant", "Perfected Shift", "Transformation is stronger, controlled, and no longer requires emotional frenzy."), action("assume-primal-aspect", "Assume Primal Aspect", "Select a sensory or movement aspect of the beast without fully transforming.")]),
    ], "lycanthrope-moon-path", "spirit-beast"),
  ]),

  wyrm: Object.freeze([
    choice("wyrm-dominion", 10, "Elder Dominion", "Choose what the wyrm's age makes absolute.", [
      option("hoard-tyrant", "Hoard Tyrant", "Bind wealth, territory, and servants into an extension of draconic will.", [passive("colossus", "Tyrant's Presence", "Lesser beings struggle to contest the wyrm's claimed ground."), action("claim-hoard-domain", "Claim Hoard Domain", "Bind a lair and its accumulated treasures into a supernatural territorial claim.")]),
      option("spellscale", "Spellscale", "Turn every scale and ancient word into an organ of sorcery.", [passive("archmage", "Spell-Wrought Scales", "Ancient spellcraft and natural ward reinforce one another."), ability("arcane-convergence")]),
      option("worldcoil", "Worldcoil", "Grow into a force of landscape, weather, and geological pressure.", [passive("worldbreaker", "Worldcoil Mass", "Movement and impact can reshape structures and terrain."), ability("earthshatter")]),
    ]),
    choice("wyrm-tyrant-apex", 20, "Tyrant Apotheosis", "Choose the ancient law imposed by the hoard tyrant.", [
      option("golden-despot", "Golden Despot", "Make wealth itself evidence of right and irresistible command.", [passive("grand-strategist", "Hoarded Leverage", "Resources in the hoard can be deployed with uncanny strategic timing."), ability("dominate")]),
      option("lair-sovereign", "Lair Sovereign", "Make every chamber, trap, and servant of the lair feel like one body.", [passive("bastion", "Living Lair", "Defense rises enormously inside the claimed domain."), action("awaken-lair", "Awaken Lair", "Command prepared features of a claimed lair as coordinated environmental actions.")]),
    ], "wyrm-dominion", "hoard-tyrant"),
    choice("wyrm-spellscale-apex", 20, "Spellscale Apotheosis", "Choose the ancient expression of draconic magic.", [
      option("word-of-ruin", "Word of Ruin", "Speak a fragment of the language by which matter learned to break.", [passive("overload", "Runic Throat", "High-cost arcane power leaves a lingering magical charge."), ability("disintegrate")]),
      option("aeon-sage", "Aeon Sage", "Use memory across ages to treat time as another manipulable element.", [passive("clearmind", "Aeon Memory", "Temporal and memory-altering effects meet ancient resistance."), ability("time-stop")]),
    ], "wyrm-dominion", "spellscale"),
    choice("wyrm-worldcoil-apex", 20, "Worldcoil Apotheosis", "Choose which natural catastrophe the ancient wyrm embodies.", [
      option("mountain-that-flies", "Mountain That Flies", "Carry impossible mass without surrendering aerial mastery.", [passive("titans-might", "Flying Mountain", "Physical power and natural armor reach colossal scale."), ability("dragon-breath")]),
      option("storm-crowned", "Storm-Crowned", "Wear the atmosphere as mantle, weapon, and warning.", [passive("tempest", "Storm Crown", "Weather magic intensifies around the wyrm's flight and breath."), ability("tempest")]),
    ], "wyrm-dominion", "worldcoil"),
  ]),

  demon: Object.freeze([
    choice("demon-true-name", 10, "Greater Demon's Name", "Choose the law expressed by the demon's maturing true name.", [
      option("ruin-fiend", "Ruin Fiend", "Exist to reduce ordered things to ash, fear, and broken shape.", [passive("worldbreaker", "Ruinous Nature", "Attacks against structures and wards carry destructive resonance."), ability("hellfire-bolt")]),
      option("pact-lord", "Pact Lord", "Turn bargains, ownership, and carefully worded consent into chains.", [passive("cursed", "Contractual Being", "Formal bargains empower the demon and expose it to exact wording."), action("write-soul-pact", "Write Soul Pact", "Offer a supernatural contract whose benefits and penalties follow its literal clauses.")]),
      option("temptation-prince", "Temptation Prince", "Rule through desire offered in the shape a victim most wants.", [passive("fortunate", "Desired Shape", "The demon more readily presents as safe, beautiful, or familiar."), ability("charm")]),
    ]),
    choice("demon-ruin-apex", 20, "Ruin Apotheosis", "Choose the archdemon's method of destruction.", [
      option("hellstorm", "Hellstorm", "Spread infernal flame across armies and cities.", [passive("overload", "Hellstorm Core", "Infernal area magic escalates as conflict continues."), ability("meteor")]),
      option("unmaker", "Unmaker", "Focus ruin into exact attacks against wards, souls, and substance.", [passive("piercing", "Unmaking Claw", "Attacks penetrate a greater share of magical and physical protection."), ability("disintegrate")]),
    ], "demon-true-name", "ruin-fiend"),
    choice("demon-pact-apex", 20, "Pact Apotheosis", "Choose the archdemon's relationship to sworn souls.", [
      option("chain-king", "Chain King", "Carry a hierarchy of lesser oaths and bound agents.", [passive("grand-strategist", "Infernal Hierarchy", "Bound agents coordinate through the demon's standing commands."), ability("dominate")]),
      option("wish-broker", "Wish Broker", "Grant exactly enough of a desire to make its price inevitable.", [passive("efficient", "Measured Temptation", "Supernatural bargains expend less power when the target names the desire."), action("grant-crooked-wish", "Grant Crooked Wish", "Fulfill a bounded request through a pact while preserving a literal hidden cost.")]),
    ], "demon-true-name", "pact-lord"),
    choice("demon-temptation-apex", 20, "Temptation Apotheosis", "Choose the final mask of the temptation prince.", [
      option("dream-despot", "Dream Despot", "Enter desire through sleep and govern the story around it.", [passive("phantom", "Dream-Shaped", "Dreams and illusions become natural territory."), ability("phantasmal-killer")]),
      option("beloved-tyrant", "Beloved Tyrant", "Make obedience feel like intimacy, relief, and chosen purpose.", [passive("benediction", "Devoted Fear", "Controlled followers reinforce one another's attachment."), ability("beguiling-command")]),
    ], "demon-true-name", "temptation-prince"),
  ]),

  fae: Object.freeze([
    choice("fae-court-nature", 10, "Fae Nature", "Choose the rule of story and season the fae will embody.", [
      option("glamour-court", "Glamour Court", "Rule names, appearances, etiquette, and dangerous delight.", [passive("phantom", "Glamour Skin", "Appearance and small sensory details answer the fae's intent."), ability("charm")]),
      option("thorn-wild", "Thorn Wild", "Become the beauty and violence of untamed growth.", [passive("savage", "Thornblood", "Natural terrain and bleeding harm feed predatory momentum."), ability("snare")]),
      option("dream-road", "Dream Road", "Walk the unstable border between memory, sleep, and elsewhere.", [passive("clearmind", "Lucid Native", "Dream logic cannot easily erase the fae's chosen purpose."), ability("mirror-image")]),
    ]),
    choice("fae-glamour-apex", 20, "Glamour Apotheosis", "Choose the high fae's courtly dominion.", [
      option("name-thief", "Name Thief", "Learn the true shape of a name and borrow the authority attached to it.", [passive("cursed", "Stolen Name", "Possessing a freely given true name strengthens influence over its owner."), action("take-a-name", "Take a Name", "Accept a freely offered true name as supernatural leverage until returned or outwitted.")]),
      option("revel-queen", "Revel Queen", "Turn celebration, music, and beauty into a court no guest wants to leave.", [passive("benediction", "Endless Revel", "Friendly crowds resist fatigue and ordinary sorrow within the revel."), ability("beguiling-command")]),
    ], "fae-court-nature", "glamour-court"),
    choice("fae-thorn-apex", 20, "Thorn Apotheosis", "Choose the high fae's wild dominion.", [
      option("green-hunt", "Green Hunt", "Lead a supernatural pursuit that terrain itself joins.", [passive("bloodhunt", "Wild Quarry", "Marked prey leaves signs in living terrain even without a physical trail."), action("call-the-green-hunt", "Call the Green Hunt", "Bind hunters, beasts, and a living landscape to one named quarry.")]),
      option("briar-crown", "Briar Crown", "Make sanctuary and cruelty two faces of the same sovereign grove.", [passive("thorned", "Briar Crown", "Attackers suffer retaliatory harm in claimed wild ground."), ability("blizzard")]),
    ], "fae-court-nature", "thorn-wild"),
    choice("fae-dream-apex", 20, "Dream-Road Apotheosis", "Choose where the high fae's impossible road leads.", [
      option("memory-weaver", "Memory Weaver", "Rearrange the emotional shape of a remembered scene without erasing its facts.", [passive("clearmind", "Many-Versioned Memory", "Resist hostile memory alteration by retaining parallel recollections."), action("weave-memory", "Weave Memory", "Alter the emotional emphasis of a consenting or defeated subject's memory.")]),
      option("between-steps", "Between-Steps", "Leave one place through a story and arrive through another.", [passive("quicksilver", "Impossible Route", "Supernatural travel begins more quickly and leaves fewer traces."), ability("shadowstep")]),
    ], "fae-court-nature", "dream-road"),
  ]),
});

export function racialBranchChoices(raceId) {
  return RACIAL_BRANCHES[String(raceId || "").toLowerCase()] || Object.freeze([]);
}

export function normalizeRacialBranchChoices(raceId, branchChoices = {}, evolutionPath = []) {
  const definitions = racialBranchChoices(raceId);
  const normalized = {};
  const entries = Array.isArray(branchChoices)
    ? branchChoices.map((entry) => [entry.choiceId || entry.id, entry.optionId || entry.option])
    : Object.entries(branchChoices || {});
  for (const [choiceId, optionId] of entries) {
    const definition = definitions.find((entry) => entry.id === choiceId);
    if (definition?.options.some((entry) => entry.id === optionId)) normalized[choiceId] = optionId;
  }
  for (const optionId of (Array.isArray(evolutionPath) ? evolutionPath : [evolutionPath]).filter(Boolean)) {
    const definition = definitions.find((entry) => entry.options.some((candidate) => candidate.id === optionId));
    if (definition && !normalized[definition.id]) normalized[definition.id] = optionId;
  }
  // A child selection is only durable while its parent selection leads to it.
  for (const definition of definitions) {
    if (!definition.parentChoiceId || !normalized[definition.id]) continue;
    if (normalized[definition.parentChoiceId] !== definition.parentOptionId) delete normalized[definition.id];
  }
  return Object.freeze(normalized);
}

export function pendingRacialBranchChoices(raceId, level, selections = {}) {
  const normalized = normalizeRacialBranchChoices(raceId, selections);
  return Object.freeze(racialBranchChoices(raceId).filter((definition) => {
    if (level < definition.threshold || normalized[definition.id]) return false;
    if (!definition.parentChoiceId) return true;
    return normalized[definition.parentChoiceId] === definition.parentOptionId;
  }));
}

export function racialBranchGrantsAtLevel(raceId, level, selections = {}) {
  const normalized = normalizeRacialBranchChoices(raceId, selections);
  const grants = [];
  for (const definition of racialBranchChoices(raceId)) {
    if (definition.threshold !== level) continue;
    if (definition.parentChoiceId && normalized[definition.parentChoiceId] !== definition.parentOptionId) continue;
    const option = definition.options.find((entry) => entry.id === normalized[definition.id]);
    if (option) grants.push(...option.grants);
  }
  return Object.freeze(grants);
}

export function resolveRacialBranchChoice(raceId, level, selections, choiceId, optionId) {
  const normalized = normalizeRacialBranchChoices(raceId, selections);
  const pending = pendingRacialBranchChoices(raceId, level, normalized);
  const definition = pending.find((entry) => entry.id === choiceId);
  if (!definition) throw new Error(`Racial choice ${choiceId} is not pending for ${raceId} at racial level ${level}`);
  if (!definition.options.some((entry) => entry.id === optionId)) throw new Error(`Invalid option ${optionId} for racial choice ${choiceId}`);
  return normalizeRacialBranchChoices(raceId, { ...normalized, [choiceId]: optionId });
}
