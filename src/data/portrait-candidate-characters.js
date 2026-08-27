const DEFAULT_ATTRIBUTES = Object.freeze({
  body: 5,
  reflex: 7,
  vigor: 6,
  mind: 10,
  wit: 10,
  presence: 8,
});

function candidate(id, name, {
  gender,
  profession,
  age,
  location,
  look,
  description,
  knows,
  origin = "central",
  race = "human",
  attributes = DEFAULT_ATTRIBUTES,
  worn = [],
}) {
  return Object.freeze({
    id,
    name,
    gender,
    profession,
    age,
    location: Object.freeze({ ...location }),
    look: Object.freeze({ ...look }),
    description,
    knows: Object.freeze([...knows]),
    origin,
    race,
    attributes: Object.freeze({ ...attributes }),
    worn: Object.freeze([...worn]),
  });
}

const CANDIDATES = Object.freeze([
  candidate("star-forge-calibrator-oren", "Oren Vey, Calibrator of Sparks", {
    gender: "male", profession: "artificer", age: 31, origin: "east", location: { x: 325, y: -110 },
    look: { skin: "olive", hair: "tousled black", eyes: "dark brown", build: "lean and fine-handed", marks: "a brass-burn across the left thumb" },
    description: "The elder of two Star-Forge artificer brothers. Oren tunes ignition lattices and refuses to certify any device his younger brother has not tried to break first.",
    knows: ["A stable spark is measured after the housing warms.", "Pavel breaks the design. I find where it lied."], worn: ["mustard-work-mantle", "calibration-picks"],
  }),
  candidate("star-forge-lenswright-pavel", "Pavel Vey, Lenswright", {
    gender: "male", profession: "artificer", age: 27, origin: "east", location: { x: 325, y: -110 },
    look: { skin: "olive", hair: "short black", eyes: "hazel", build: "slender and quick", marks: "glass dust permanently silvering two cuffs" },
    description: "Oren Vey's younger brother and the Star-Forge's most exacting lenswright. Pavel tests arcane housings until weak tolerances reveal themselves.",
    knows: ["If it survives my bench, it may survive a road.", "Oren hears the spark. I watch where the light bends."], worn: ["mustard-shoulder-cape", "lenswright's-calipers"],
  }),
  candidate("brasshaven-clockmaker-nadiya", "Nadiya Sorn, Clockmaker of Brasshaven", {
    gender: "female", profession: "artificer", age: 35, origin: "south", location: { x: 55, y: 250 },
    look: { skin: "pale olive", hair: "black, tied low", eyes: "grey-green", build: "small and steady", marks: "teal dye at the throat and fingertips" },
    description: "A civic clockmaker who keeps Brasshaven's water bells agreeing through heat and dust. Nadiya also repairs navigators' instruments for caravans crossing the dunes.",
    knows: ["A city sharing one hour quarrels less.", "Sand enters every promise with gears."], worn: ["teal-work-scarf", "clockmaker's-tool-belt"],
  }),
  candidate("jade-lock-auditor-seven", "Auditor Seven-of-Cobalt", {
    gender: "neutral", profession: "automaton-auditor", age: 86, origin: "east", race: "automaton", location: { x: 260, y: -70 },
    look: { skin: "pale ceramic over dark steel", hair: "none", eyes: "one cobalt lens", build: "slender articulated frame", marks: "seven hairline seams across the mask" },
    description: "A self-aware lock auditor assigned to the Jade Lock's oldest mechanisms. Seven records every gate-cycle and has begun asking why some orders are never entered in the ledger.",
    knows: ["A gate remembers pressure even when clerks forget names.", "I was instructed to count. I was not instructed to ignore patterns."], worn: ["blue-shoulder-mantle", "seal-key-array"],
  }),
  candidate("red-snow-axe-thane-hroth", "Hroth Cairn-Axe", {
    gender: "male", profession: "axe-thane", age: 49, origin: "north", location: { x: -260, y: -220 },
    look: { skin: "wind-burned", hair: "dark going grey", eyes: "blue-grey", build: "massive and scarred", marks: "a split brow and frost-whitened beard" },
    description: "A Red-Snow Cairn thane who survived three feud winters and now escorts burial parties through contested passes. Hroth speaks softly because no one needs him to shout.",
    knows: ["The cairns are neutral ground until someone lies.", "An axe is heavy enough without anger added."], worn: ["torn-red-cloak", "cairn-axe"],
  }),
  candidate("willowcourt-blade-tutor-saori", "Saori Vale, Willowcourt Blade Tutor", {
    gender: "female", profession: "blademaster", age: 61, origin: "east", location: { x: 350, y: 115 },
    look: { skin: "weathered tan", hair: "long silver, tied back", eyes: "black", build: "narrow and balanced", marks: "one clean scar under the chin" },
    description: "Willowcourt's senior blade tutor, known for ending lessons before pride becomes injury. Saori trains messengers and magistrates rather than duelists seeking applause.",
    knows: ["The useful cut is the one that lets you leave.", "Balance is courtesy paid to the next movement."], worn: ["red-training-mantle", "willow-steel-sabre"],
  }),
  candidate("reedwatch-ward-captain-damari", "Captain Damari Kesh", {
    gender: "male", profession: "knight", age: 33, origin: "east", location: { x: 175, y: -5 },
    look: { skin: "deep brown", hair: "close-shaved", eyes: "amber", build: "tall and square-shouldered", marks: "a pale line across the right knuckle" },
    description: "Ward-captain of Reedwatch Bastion's inner gate. Damari inspects his own gauntlets and every recruit's boots before a patrol leaves.",
    knows: ["A bastion fails at the hinge before the wall.", "Polish is not vanity when rust kills."], worn: ["reedwatch-blue-surcoat", "polished-gate-plate"],
  }),
  candidate("sunward-votive-keeper-amara", "Amara Sol, Keeper of Votives", {
    gender: "female", profession: "paladin", age: 38, origin: "south", location: { x: -15, y: 170 },
    look: { skin: "deep umber", hair: "braided into a crown", eyes: "warm brown", build: "upright and graceful", marks: "gold ash at the brow" },
    description: "The Sunward Bastion's keeper of votive names. Amara carries no command rank, but soldiers seek her before difficult marches because she remembers every family left behind.",
    knows: ["A vow names who pays if you fail.", "Courage without a witness can still be true."], worn: ["cream-and-gold-votive-robes", "sun-disc-pendant"],
  }),
  candidate("pale-shrine-bell-prior-elian", "Prior Elian Mere", {
    gender: "male", profession: "paladin", age: 29, location: { x: 42, y: 22 },
    look: { skin: "fair", hair: "wavy brown", eyes: "grey", build: "slender", marks: "prayer-cord calluses across both palms" },
    description: "A young bell-prior at the Shrine of the Pale God. Elian records the names of travelers who ask for safe passage and rings once for those who return.",
    knows: ["We ring for return, not departure.", "Mercy is work performed before certainty."], worn: ["ochre-prior-stole", "bone-prayer-cord"],
  }),
  candidate("greenwater-field-healer-marta", "Marta Fen, Field Healer", {
    gender: "female", profession: "paladin-healer", age: 52, origin: "west", location: { x: -450, y: 200 },
    look: { skin: "light brown", hair: "dark, streaked grey and pinned low", eyes: "green", build: "solid and practical", marks: "old bandage burns around one forearm" },
    description: "A Greenwater Abbey field healer who travels after floods and skirmishes. Marta teaches novices to bind wounds before asking which banner caused them.",
    knows: ["Stop the bleeding; history can wait.", "Clean cloth is holier than a speech over dirty hands."], worn: ["grey-field-robes", "sun-wheel-healer's-belt"],
  }),
  candidate("wolfglass-trail-warden-torren", "Torren Greybraid", {
    gender: "male", profession: "ranger", age: 64, origin: "north", location: { x: -150, y: -285 },
    look: { skin: "weathered tan", hair: "grey in long braids", eyes: "ice blue", build: "rangy", marks: "a frost scar crossing the nose" },
    description: "Wolfglass's oldest active trail warden. Torren marks safe ice with pale forked stakes and has outlived every apprentice who ignored the sound of moving water.",
    knows: ["Blue ice speaks lower than white ice.", "A straight trail is often the river's joke."], worn: ["green-winter-cloak", "forked-ice-bow"],
  }),
  candidate("mirecross-bow-reeve-kessa", "Kessa Thorn, Bow-Reeve", {
    gender: "female", profession: "ranger", age: 26, location: { x: 55, y: 10 },
    look: { skin: "fair", hair: "black, tied high", eyes: "dark green", build: "athletic", marks: "a cut through the left eyebrow" },
    description: "Mirecross's bow-reeve, responsible for keeping marsh patrols supplied with dry strings and honest route reports. Kessa distrusts anyone who calls mud simple terrain.",
    knows: ["The marsh moves without changing its map.", "A wet bow is a club with memories."], worn: ["dark-scale-jerkin", "mire-yew-bow"],
  }),
  candidate("crane-fort-scout-nia", "Nia of Crane Fort", {
    gender: "female", profession: "ranger", age: 30, origin: "east", location: { x: 220, y: 20 },
    look: { skin: "deep brown", hair: "coiled high under green cloth", eyes: "black", build: "compact and quick", marks: "three white fletching cuts on one glove" },
    description: "A Crane Fort horizon scout who reads dust, birds, and missing market traffic as one report. Nia is usually back before commanders know they needed her.",
    knows: ["An empty road is still a message.", "Count birds before banners."], worn: ["crane-green-cloak", "laminated-scout-bow"],
  }),
  candidate("bramblewych-red-fletch-rosen", "Rosen Red-Fletch", {
    gender: "female", profession: "ranger", age: 24, origin: "west", location: { x: -105, y: 75 },
    look: { skin: "freckled fair", hair: "red in one long braid", eyes: "hazel", build: "lean", marks: "red resin staining both thumbs" },
    description: "A Bramblewych fletcher and boundary runner. Rosen uses red resin on warning arrows so even a recovered shaft says where it was loosed.",
    knows: ["A boundary should warn before it wounds.", "Red resin survives rain better than promises."], worn: ["bramble-green-cloak", "red-fletched-longbow"],
  }),
  candidate("greenharbor-night-factor-lucan", "Lucan Veyr, Night Factor", {
    gender: "male", profession: "rogue", age: 28, origin: "west", location: { x: -474, y: 124 },
    look: { skin: "pale", hair: "ash blond", eyes: "grey", build: "slim", marks: "a hidden needle scar at the wrist" },
    description: "A Greenharbor night factor who arranges discreet cargo transfers that remain legal if read very carefully. Lucan refuses work involving chained passengers.",
    knows: ["A quiet manifest is not an empty one.", "There are cargos I will not make invisible."], worn: ["burgundy-half-cloak", "concealed-ledger-bracer"],
  }),
  candidate("duneveil-thread-mage-sahir", "Sahir al-Nem, Thread Mage", {
    gender: "male", profession: "sorcerer", age: 32, origin: "south", location: { x: -80, y: 240 },
    look: { skin: "pale olive", hair: "black, center-parted", eyes: "blue-grey", build: "slender", marks: "shadow-thread burns across two fingertips" },
    description: "A Duneveil thread mage who binds shade to tent seams and caravan awnings. Sahir's subtle craft is defensive, patient, and often mistaken for shadow sorcery of a harsher school.",
    knows: ["Shade can be woven without becoming darkness.", "The finest ward is noticed only when it tears."], worn: ["long-blue-scarf", "spool-case-of-bound-shadow"],
  }),
  candidate("lotusmouth-river-conjurer-meilin", "Meilin Vao, River Conjurer", {
    gender: "female", profession: "sorcerer", age: 27, origin: "east", location: { x: 486, y: 94 },
    look: { skin: "fair", hair: "red, pinned in loops", eyes: "blue", build: "graceful", marks: "a blue current-mark around one palm" },
    description: "A Lotusmouth conjurer who gives river currents visible forms while pilots learn them. Her blue serpent is instruction, warning, and performance at once.",
    knows: ["A current seen once is remembered longer than a chart.", "The river dislikes being called obedient."], worn: ["blue-river-cloak", "coiled-glass-focus"],
  }),
  candidate("copperstep-ember-shaper-zuri", "Zuri Kesh, Ember Shaper", {
    gender: "female", profession: "sorcerer", age: 34, origin: "east", location: { x: 250, y: -130 },
    look: { skin: "warm brown", hair: "dark curls tied back", eyes: "amber", build: "athletic", marks: "heat-darkened palms" },
    description: "Copperstep's kiln mediator, called when forge crews disagree about fuel, timing, or blame. Zuri shapes flame precisely enough to expose bad metal without ruining it.",
    knows: ["Good fire reveals; bad fire only consumes.", "Metal remembers impatience."], worn: ["orange-kiln-sash", "ember-stone-bracelet"],
  }),
  candidate("black-tarn-courtier-severin", "Severin Vale of Black Tarn", {
    gender: "male", profession: "vampire-courtier", age: 186, origin: "north", race: "vampire", location: { x: -115, y: -105 },
    look: { skin: "very pale", hair: "slick black", eyes: "wine red", build: "tall and narrow", marks: "an antique signet worn smooth" },
    description: "The elder Vale brother and Black Tarn's patient treaty courtier. Severin negotiates feeding accords with villages that would rather never admit such agreements exist.",
    knows: ["A hidden treaty still needs honest measures.", "Adrian mistakes discomfort for injustice; occasionally he is right."], worn: ["burgundy-court-vest", "vale-signet"],
  }),
  candidate("bone-citadel-blood-notary-nyra", "Nyra Sable, Blood Notary", {
    gender: "female", profession: "vampire-notary", age: 121, origin: "west", race: "vampire", location: { x: -325, y: 55 },
    look: { skin: "deep umber", hair: "black in a long low braid", eyes: "dark red", build: "tall and composed", marks: "a crimson seal tattoo inside the right hand" },
    description: "A Bone Citadel notary who records blood debts in terms strict enough to restrain both creditor and debtor. Nyra has invalidated more predatory bargains than she has sealed.",
    knows: ["Blood is evidence, not consent.", "A debt without an end date is ownership wearing ink."], worn: ["black-notary-leathers", "crimson-seal-ring"],
  }),
  candidate("black-tarn-heir-adrian", "Adrian Vale of Black Tarn", {
    gender: "male", profession: "vampire-heir", age: 112, origin: "north", race: "vampire", location: { x: -115, y: -105 },
    look: { skin: "very pale", hair: "tousled black", eyes: "red-brown", build: "slender", marks: "a tiny bite scar beneath the collar" },
    description: "Severin Vale's younger brother and reluctant heir to Black Tarn's household. Adrian challenges old feeding customs, then leaves Severin to make his reforms administratively possible.",
    knows: ["Tradition is not innocence.", "My brother calls me reckless after he has already drafted the amendment."], worn: ["high-black-collar", "tarn-heir-clasp"],
  }),
  candidate("mossmere-seal-bearer-kadira", "Kadira Moss-Seal", {
    gender: "female", profession: "warlock", age: 39, origin: "west", location: { x: -300, y: 80 },
    look: { skin: "deep brown", hair: "long dark braids", eyes: "violet-brown", build: "strong and guarded", marks: "a purple seal at the throat" },
    description: "A Mossmere seal-bearer who carries a closed grimoire containing a marsh spirit's negotiated boundaries. Kadira never opens it without three witnesses.",
    knows: ["A sealed book can still be an active agreement.", "Three witnesses protect the spirit and the village."], worn: ["purple-collared-robe", "bound-marsh-grimoire"],
  }),
  candidate("old-root-ritualist-velisse", "Velisse of the Bound Wrist", {
    gender: "female", profession: "warlock", age: 46, origin: "west", location: { x: -400, y: 260 },
    look: { skin: "pale", hair: "black in two long braids", eyes: "grey-violet", build: "slender", marks: "a ritual binding permanently circling one wrist" },
    description: "A solitary ritualist studying the Old Root Ruins. The two surviving portraits of Velisse record the same binding rite moments apart; they are not separate sisters.",
    knows: ["The wrist-mark is a lock, not a wound.", "Roots remember agreements longer than kingdoms."], worn: ["purple-sashed-black-robes", "bound-wrist-charm"],
  }),
  candidate("thornwatch-grimoire-warden-marek", "Marek Voss, Grimoire Warden", {
    gender: "male", profession: "warlock", age: 55, origin: "west", location: { x: -250, y: 30 },
    look: { skin: "tan", hair: "short, iron-grey", eyes: "brown", build: "broad and tired", marks: "ink-dark veins along the left hand" },
    description: "Thornwatch's grimoire warden, responsible for books too dangerous to destroy and too useful to abandon. Marek reads only with a second person holding the closing cord.",
    knows: ["A dangerous book should have two readers and one exit.", "Destruction is sometimes only uncontrolled release."], worn: ["charcoal-warden-coat", "black-clasped-grimoire"],
  }),
  candidate("glass-dune-astrolabist-cyran", "Cyran Pell, Astrolabist", {
    gender: "male", profession: "wizard", age: 30, origin: "south", location: { x: -30, y: 280 },
    look: { skin: "pale olive", hair: "black, center-parted", eyes: "dark blue", build: "slender", marks: "a compass-point scar beneath one thumb" },
    description: "A Glass Dune Observatory astrolabist who recalculates caravan stars after dust seasons. Cyran trusts instruments, but only after watching them disagree.",
    knows: ["Two instruments agreeing can share one fault.", "The sky is exact; our circles are approximations."], worn: ["black-observatory-robes", "brass-ring-astrolabe"],
  }),
  candidate("heron-itinerant-scholar-tomas", "Tomas Reed of the Heron", {
    gender: "male", profession: "wizard", age: 37, location: { x: 135, y: 40 },
    look: { skin: "medium brown", hair: "short black", eyes: "hazel", build: "average and book-bent", marks: "ink along the beard line" },
    description: "An itinerant Heron scholar who copies field observations before they become tavern certainty. Tomas carries more paper than food and regrets it only in rain.",
    knows: ["A copied error becomes tradition very quickly.", "Write the weather before the theory."], worn: ["blue-grey-scholar-robes", "field-codex"],
  }),
  candidate("blueglass-lexicographer-elowen", "Elowen Marr, Lexicographer", {
    gender: "female", profession: "wizard", age: 28, origin: "south", location: { x: 70, y: 340 },
    look: { skin: "fair", hair: "wavy blond", eyes: "blue-grey", build: "slender", marks: "blue ink on the right middle finger" },
    description: "A Blueglass lexicographer comparing spell terminology across southern dialects. Elowen prevents mistranslated verbs from becoming practical magical disasters.",
    knows: ["A spell's verb is not decoration.", "Two dialects can share a word and disagree about who acts."], worn: ["blue-reading-mantle", "parallel-glossary"],
  }),
  candidate("rimeward-abbey-scrivener-odran", "Odran Hale, Senior Scrivener", {
    gender: "male", profession: "wizard", age: 67, origin: "north", location: { x: -30, y: -355 },
    look: { skin: "deep brown", hair: "short grey curls", eyes: "dark brown", build: "solid and stooped", marks: "frost-pale fingertips" },
    description: "Rimeward Abbey's senior scrivener, preserving magical formulae on cold-stable vellum. Odran has trained three generations to copy what is written rather than what they expect.",
    knows: ["Expectation is the commonest copying error.", "Cold keeps ink honest if hands remain steady."], worn: ["blue-abbey-scarf", "winter-vellum-codex"],
  }),
  candidate("aurora-vault-crystal-archmage-vaelor", "Archmage Vaelor of the Aurora Vault", {
    gender: "male", profession: "archmage", age: 213, origin: "north", location: { x: 70, y: -365 },
    look: { skin: "winter pale", hair: "long white", eyes: "icy blue", build: "tall and spare", marks: "frost-light moving beneath the left palm" },
    description: "The Aurora Vault's crystal archmage, guardian of frozen light records gathered before the northern kingdoms had names. Vaelor is austere, exact, and more interested in preservation than rule.",
    knows: ["Frozen light remembers direction.", "Authority passes. A well-kept record may not."], worn: ["deep-blue-archmage-robes", "spiral-vault-staff", "aurora-crystal"],
  }),
]);

export const PORTRAIT_CANDIDATE_CHARACTER_IDENTITIES = Object.freeze(
  CANDIDATES.map(({ id, name }) => Object.freeze([id, name])),
);

export function makePortraitCandidateCharacters() {
  return Object.fromEntries(CANDIDATES.map((definition) => {
    const { location, look, ...rest } = definition;
    const appearance = {
      skin: look.skin,
      hair: look.hair,
      eyes: look.eyes,
      build: look.build,
      facial_hair: "as pictured",
      marks: look.marks,
    };
    return [definition.id, {
      ...rest,
      id: definition.id,
      kind: "npc",
      portraitKey: `codex:${definition.id}`,
      agingMode: definition.race === "automaton" || definition.race === "vampire"
        ? "power-extended"
        : "mortal",
      ...(definition.race === "vampire" ? { lifespanMultiplier: 4 } : {}),
      attractiveness: 6,
      appearance,
      base_appearance: `${look.build}; ${look.skin} skin; ${look.hair} hair; ${look.eyes} eyes. ${look.marks}.`,
      attributes: { ...definition.attributes },
      worn: [...definition.worn],
      knows: [...definition.knows],
      at: { x: location.x, y: location.y, day: 0 },
      home: { x: location.x, y: location.y },
    }];
  }));
}
