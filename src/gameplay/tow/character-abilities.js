// Dedicated five-action kits for the playable Tower of Winter roster.
//
// These definitions are additive to the legacy skill catalogue: old saves and replay
// receipts keep their original ids and semantics. Each starting kit owns two protected
// actions (Basic Attack and Defensive) plus three flexible archetype actions. Shared
// General abilities can replace only those three flexible actions later in play.

export const CHARACTER_ABILITY_TYPES = Object.freeze([
  "basic-attack",
  "defensive",
  "archetype",
  "general",
]);

export const CHARACTER_ABILITY_TYPE_LABELS = Object.freeze({
  "basic-attack": "Basic attack",
  defensive: "Defensive",
  archetype: "Exclusive ability",
  general: "General ability",
});

export const FIXED_CHARACTER_ABILITY_TYPES = Object.freeze(["basic-attack", "defensive"]);
export const FLEXIBLE_CHARACTER_ABILITY_TYPES = Object.freeze(["archetype", "general"]);

const WIKI_PAGE = "https://namu.wiki/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91/%EC%BA%90%EB%A6%AD%ED%84%B0";
const OFFICIAL_CHANGELOG = "https://apps.apple.com/sg/app/tower-of-winter/id6449329520";

const freezeTable = (values) => Object.freeze(values);

function damage(scale, percentByRank, extra = {}) {
  return Object.freeze({
    type: "damage",
    target: "enemy",
    scale,
    percentByRank: freezeTable(percentByRank),
    ...extra,
  });
}

function shield(scale, percentByRank) {
  return Object.freeze({
    type: "shield",
    target: "self",
    scale,
    percentByRank: freezeTable(percentByRank),
  });
}

function status(statusType, target, countByRank) {
  return Object.freeze({
    type: "status",
    status: statusType,
    target,
    countByRank: freezeTable(countByRank),
  });
}

function scaledStatus(statusType, target, scale, percentByRank) {
  return Object.freeze({
    type: "scaled-status",
    status: statusType,
    target,
    scale,
    percentByRank: freezeTable(percentByRank),
  });
}

function heal(scale, percentByRank) {
  return Object.freeze({
    type: "heal",
    target: "self",
    scale,
    percentByRank: freezeTable(percentByRank),
  });
}

function lostHealthDamage(percentByRank, source = "enemy") {
  return Object.freeze({
    type: source === "self" ? "damage-self-lost-hp" : "damage-enemy-lost-hp",
    target: "enemy",
    percentByRank: freezeTable(percentByRank),
  });
}

function skill(id, name, {
  characterId,
  abilityType,
  rarity,
  effects,
  usesPerAct = null,
  cooldown = 0,
  consumesTurn = true,
  description,
  sourceName = name,
  sourcePage = WIKI_PAGE,
  fidelity = "direct",
  sourceDetail,
}) {
  const rankCount = effects.reduce((highest, effect) => Math.max(
    highest,
    effect.percentByRank?.length || effect.countByRank?.length || 1,
  ), 1);
  return Object.freeze({
    id,
    name,
    rarity,
    slot: "slotted",
    abilityType,
    effects: Object.freeze(effects),
    replaces: null,
    consumesTurn,
    cooldown,
    usesPerAct,
    usesPerActByRank: null,
    exclusiveTo: characterId,
    description,
    source: Object.freeze({
      page: sourcePage,
      characterId,
      sourceName,
      fidelity,
      detail: sourceDetail || description,
    }),
    note: fidelity === "adapted" ? "source-guided five-slot adaptation" : null,
    rankCount,
  });
}

const definitions = [
  skill("arctic-strike", "Strike", {
    characterId: "arctic-knight", abilityType: "basic-attack", rarity: "common",
    effects: [damage("attack", [100, 115, 130, 145, 160, 175])],
    description: "A dependable weapon strike dealing 100% ATK damage.",
  }),
  skill("arctic-block", "Block", {
    characterId: "arctic-knight", abilityType: "defensive", rarity: "common", usesPerAct: 30,
    effects: [shield("defense", [250, 300, 350, 400, 450, 500])],
    description: "Raise a shield worth 250% DEF.",
  }),
  skill("arctic-deliberate-blow", "Deliberate Blow", {
    characterId: "arctic-knight", abilityType: "archetype", rarity: "rare", usesPerAct: 10,
    effects: [damage("attack", [110, 135, 160, 185]), shield("defense", [110, 135, 160, 185])],
    description: "Deal 110% ATK damage and gain a 110% DEF shield.",
  }),
  skill("arctic-incineration", "Incineration", {
    characterId: "arctic-knight", abilityType: "archetype", rarity: "mythical", usesPerAct: 1,
    effects: [damage("attack", [110]), scaledStatus("burn", "enemy", "attack", [110]), status("paralyze", "self", [2])],
    description: "Deal 110% ATK damage, inflict equal Burn, then suffer 2 Paralyze.",
  }),
  skill("arctic-mortal-blow", "Mortal Blow", {
    characterId: "arctic-knight", abilityType: "archetype", rarity: "uncommon", usesPerAct: 3,
    effects: [damage("attack", [210, 240, 270, 300, 330]), status("paralyze", "self", [1])],
    description: "Commit to a 210% ATK blow, then remain Paralyzed until the next turn.",
  }),

  skill("demon-shoot", "Shoot", {
    characterId: "demon-slayer", abilityType: "basic-attack", rarity: "common",
    effects: [damage("attack", [100, 115, 130, 145, 160, 175])],
    description: "Loose a precise shot for 100% ATK damage.",
  }),
  skill("demon-evasion", "Evasion", {
    characterId: "demon-slayer", abilityType: "defensive", rarity: "rare", usesPerAct: 10,
    effects: [status("evade", "self", [1]), shield("defense", [220])],
    description: "Gain 1 Evade and a shield worth 220% DEF.",
  }),
  skill("demon-kick", "Kick", {
    characterId: "demon-slayer", abilityType: "archetype", rarity: "rare", usesPerAct: 7,
    effects: [damage("attack", [50]), status("stun", "enemy", [1])],
    description: "Deal 50% ATK damage and Stun the enemy for one turn.",
  }),
  skill("demon-arrow-rain", "Arrow Rain", {
    characterId: "demon-slayer", abilityType: "archetype", rarity: "mythical", usesPerAct: 1,
    effects: [damage("attack", [52], { hits: 4 }), scaledStatus("poison", "enemy", "attack", [80])],
    description: "A four-hit barrage that rapidly builds Poison.", fidelity: "adapted",
    sourceDetail: "The source guide identifies Arrow Rain as the multi-hit core of Venom builds; hit power is normalized for this combat kernel.",
  }),
  skill("demon-trackers-net", "Tracker's Net", {
    characterId: "demon-slayer", abilityType: "archetype", rarity: "rare", usesPerAct: 5, cooldown: 4,
    effects: [status("paralyze", "enemy", [2]), status("vulnerable", "enemy", [4])],
    description: "Pin the quarry for 2 turns and expose it to the next volley.", fidelity: "adapted",
    sourcePage: OFFICIAL_CHANGELOG,
    sourceDetail: "The official changelog names Tracker's Net as a Demon Slayer skill; restraint and exposure are recreated with this kernel's control statuses.",
  }),

  skill("clocktower-fire", "Fire", {
    characterId: "owner-of-clocktower", abilityType: "basic-attack", rarity: "common",
    effects: [damage("attack", [100, 115, 130, 145, 160, 175])],
    description: "Fire a clockwork weapon for 100% ATK damage.",
  }),
  skill("clocktower-suppressive-shot", "Suppressive Shot", {
    characterId: "owner-of-clocktower", abilityType: "defensive", rarity: "common", usesPerAct: 24,
    effects: [scaledStatus("lethargy", "enemy", "defense", [125])],
    description: "Convert 125% DEF into Lethargy on the enemy.",
  }),
  skill("clocktower-missile-support", "Missile Support", {
    characterId: "owner-of-clocktower", abilityType: "archetype", rarity: "legendary", usesPerAct: 2, consumesTurn: false,
    effects: [damage("attack", [200])],
    description: "Call remote missile support for 200% ATK damage without spending the main action.",
  }),
  skill("clocktower-redesign", "Redesign", {
    characterId: "owner-of-clocktower", abilityType: "archetype", rarity: "mythical", usesPerAct: 1, consumesTurn: false,
    effects: [scaledStatus("tenacity", "self", "attack", [40]), scaledStatus("strength", "self", "defense", [40])],
    description: "Reconfigure: gain Tenacity equal to 40% ATK and Strength equal to 40% DEF.",
  }),
  skill("clocktower-improvement", "Improvement", {
    characterId: "owner-of-clocktower", abilityType: "archetype", rarity: "rare", usesPerAct: 4, cooldown: 7, consumesTurn: false,
    effects: [status("strength", "self", [4, 6, 8, 10]), status("tenacity", "self", [4, 6, 8, 10])],
    description: "Tune the mechanism without spending the main action, gaining 4 Strength and 4 Tenacity.",
  }),

  skill("north-king-cleave", "Cleave", {
    characterId: "old-king-of-northland", abilityType: "basic-attack", rarity: "common",
    effects: [damage("attack", [100, 115, 130, 145, 160, 175])],
    description: "Sweep a poleaxe through the enemy for 100% ATK damage.",
  }),
  skill("north-king-vitality", "Vitality", {
    characterId: "old-king-of-northland", abilityType: "defensive", rarity: "rare", usesPerAct: 12,
    effects: [heal("defense", [185])],
    description: "Recover health equal to 185% DEF.",
  }),
  skill("north-king-whirlwind", "Whirlwind", {
    characterId: "old-king-of-northland", abilityType: "archetype", rarity: "epic", usesPerAct: 6,
    effects: [damage("attack", [52], { hits: 3 }), scaledStatus("lethargy", "enemy", "attack", [45])],
    description: "A three-hit axe storm that compounds the King's Lethargy pressure.", fidelity: "adapted",
    sourceDetail: "The source explicitly recommends Whirlwind for Valiancy's per-hit scaling; per-hit power is normalized here.",
  }),
  skill("north-king-earthquake", "Earthquake", {
    characterId: "old-king-of-northland", abilityType: "archetype", rarity: "mythical", usesPerAct: 1,
    effects: [damage("attack", [400]), scaledStatus("lethargy", "enemy", "defense", [400])],
    description: "Shatter the ground for 400% ATK damage and Lethargy equal to 400% DEF.",
  }),
  skill("north-king-neutralizing-blow", "Neutralizing Blow", {
    characterId: "old-king-of-northland", abilityType: "archetype", rarity: "rare", usesPerAct: 7,
    effects: [damage("defense", [140]), scaledStatus("lethargy", "enemy", "defense", [140])],
    description: "Meet a heavy attack with 140% DEF damage and equal Lethargy.", fidelity: "adapted",
    sourceName: "무력화 공격",
    sourceDetail: "The source guide identifies Neutralizing Blow as the Old King's answer to heavy attacks; its paired DEF damage and Lethargy are normalized here.",
  }),

  skill("sleepless-flame-strike", "Flame Strike", {
    characterId: "sleepless-one", abilityType: "basic-attack", rarity: "common",
    effects: [damage("attack", [100]), scaledStatus("burn", "enemy", "attack", [24])],
    description: "Strike for 100% ATK and kindle Burn.", fidelity: "adapted",
  }),
  skill("sleepless-flame-curtain", "Flame Curtain", {
    characterId: "sleepless-one", abilityType: "defensive", rarity: "rare", usesPerAct: 18,
    effects: [shield("defense", [160]), scaledStatus("burn", "enemy", "attack", [35])],
    description: "Raise a fiery ward and scorch the attacker.", fidelity: "adapted",
  }),
  skill("sleepless-entangling-roots", "Entangling Roots", {
    characterId: "sleepless-one", abilityType: "archetype", rarity: "legendary", usesPerAct: 4, cooldown: 4,
    effects: [status("paralyze", "enemy", [2]), scaledStatus("poison", "enemy", "attack", [100])],
    description: "Bind the enemy for 2 turns and seed a heavy Poison.", fidelity: "adapted",
  }),
  skill("sleepless-high-speed-flight", "High-Speed Flight", {
    characterId: "sleepless-one", abilityType: "archetype", rarity: "mythical", usesPerAct: 1, consumesTurn: false,
    effects: [status("priority", "self", [4])],
    description: "Take to the air and gain 4 Priority.",
  }),
  skill("sleepless-fire-essence", "Fire Essence", {
    characterId: "sleepless-one", abilityType: "archetype", rarity: "epic", usesPerAct: 4, cooldown: 6, consumesTurn: false,
    effects: [status("strength", "self", [6]), status("overload", "self", [20])],
    description: "Awaken the stored ember for 6 Strength and 20 Overload without spending the main action.", fidelity: "adapted",
    sourcePage: OFFICIAL_CHANGELOG,
    sourceDetail: "The official changelog names Fire Essence as a Sleepless One skill; its stored-fire power is recreated as a swift Strength and Overload setup.",
  }),

  skill("assassin-flurry", "Flurry", {
    characterId: "last-assassin", abilityType: "basic-attack", rarity: "common",
    effects: [damage("attack", [55], { hits: 2 })],
    description: "The Assassin's two-hit basic attack.",
  }),
  skill("assassin-deflect", "Deflect", {
    characterId: "last-assassin", abilityType: "defensive", rarity: "uncommon", usesPerAct: 25,
    effects: [shield("defense", [175])],
    description: "Raise armor equal to 175% DEF, strongest into repeated hits.",
  }),
  skill("assassin-flash-bomb", "Flash Bomb", {
    characterId: "last-assassin", abilityType: "archetype", rarity: "legendary", usesPerAct: 4, cooldown: 5,
    effects: [status("stun", "enemy", [2]), status("vulnerable", "enemy", [5])],
    description: "Blind the target for 2 turns and expose it to the finishing blow.", fidelity: "adapted",
  }),
  skill("assassin-execution", "Execution", {
    characterId: "last-assassin", abilityType: "archetype", rarity: "mythical", usesPerAct: 1,
    effects: [damage("attack", [100]), lostHealthDamage([45])],
    description: "Strike, then deal bonus damage equal to 45% of the enemy's missing health.", fidelity: "adapted",
  }),
  skill("assassin-storm-of-knives", "Storm of Knives", {
    characterId: "last-assassin", abilityType: "archetype", rarity: "epic", usesPerAct: 5,
    effects: [damage("attack", [42], { hits: 4 }), scaledStatus("bleed", "enemy", "attack", [60])],
    description: "Cut four times in one sequence, then leave Bleed equal to 60% ATK.", fidelity: "adapted",
    sourcePage: OFFICIAL_CHANGELOG,
    sourceDetail: "The official changelog names Storm of Knife as a Last Assassin skill; its rapid sequence is normalized to four hits plus Bleed.",
  }),

  skill("witch-skull-throw", "Skull Throw", {
    characterId: "witch-of-eternity", abilityType: "basic-attack", rarity: "common",
    effects: [damage("attack", [100])],
    description: "Hurl a hexed skull for 100% ATK damage.", fidelity: "adapted",
  }),
  skill("witch-bone-shield", "Bone Shield", {
    characterId: "witch-of-eternity", abilityType: "defensive", rarity: "uncommon", usesPerAct: 24,
    effects: [shield("defense", [150]), status("skeleton", "self", [4])],
    description: "Build a bone ward and preserve 4 Skeletons for the army.", fidelity: "adapted",
  }),
  skill("witch-skeleton-summon", "Skeleton Summon", {
    characterId: "witch-of-eternity", abilityType: "archetype", rarity: "epic", usesPerAct: 6, consumesTurn: false,
    effects: [status("skeleton", "self", [12])],
    description: "Raise 12 Skeletons without spending the main action.", fidelity: "adapted",
  }),
  skill("witch-all-out-attack", "All-Out Attack", {
    characterId: "witch-of-eternity", abilityType: "archetype", rarity: "mythical", usesPerAct: 1,
    effects: [damage("attack", [280]), status("doom", "enemy", [100])],
    description: "Send the entire host forward in one ruinous assault.", fidelity: "adapted",
    sourceDetail: "The source describes an army-spending burst; this kernel recreation packages that payoff as damage plus Doom.",
  }),
  skill("witch-mirror-image", "Mirror Image", {
    characterId: "witch-of-eternity", abilityType: "archetype", rarity: "rare", usesPerAct: 4, cooldown: 6, consumesTurn: false,
    effects: [status("evade", "self", [1]), status("skeleton", "self", [6])],
    description: "Leave a grave-lit double behind: gain 1 Evade and preserve 6 Skeletons.", fidelity: "adapted",
    sourceDetail: "The source documents a temporary duplicate that increases dodge and disappears when struck; one Evade recreates that single-hit image in this kernel.",
  }),

  skill("mage-magic-arrow", "Magic Arrow", {
    characterId: "tenacious-mage", abilityType: "basic-attack", rarity: "common",
    effects: [damage("attack", [100])],
    description: "Launch a compact spell for 100% ATK damage.", fidelity: "adapted",
  }),
  skill("mage-barrier", "Barrier", {
    characterId: "tenacious-mage", abilityType: "defensive", rarity: "common", usesPerAct: 20,
    effects: [shield("defense", [200]), status("protection", "self", [4])],
    description: "Conjure armor worth 200% DEF and gain 4 Protection.",
  }),
  skill("mage-flame-storm", "Flame Storm", {
    characterId: "tenacious-mage", abilityType: "archetype", rarity: "epic", usesPerAct: 5,
    effects: [damage("attack", [45], { hits: 3 }), scaledStatus("burn", "enemy", "attack", [90])],
    description: "Three waves of flame followed by a deep Burn.", fidelity: "adapted",
  }),
  skill("mage-amplification", "Amplification", {
    characterId: "tenacious-mage", abilityType: "archetype", rarity: "mythical", usesPerAct: 1, consumesTurn: false,
    effects: [scaledStatus("strength", "self", "attack", [50])],
    description: "Gain Strength equal to 50% of current ATK without spending the main action.",
  }),
  skill("mage-god-slaying-spear", "God-Slaying Spear", {
    characterId: "tenacious-mage", abilityType: "archetype", rarity: "mythical", usesPerAct: 1,
    effects: [damage("attack", [360]), status("paralyze", "self", [1])],
    description: "Cast a 360% ATK spear through the target, then suffer 1 Paralyze from the strain.", fidelity: "adapted",
    sourceDetail: "The source names God-Slaying Spear as a red capstone; its coefficient and recoil are normalized for the encounter kernel.",
  }),

  skill("priestess-crush", "Crush", {
    characterId: "exiled-priestess", abilityType: "basic-attack", rarity: "common",
    effects: [damage("attack", [100]), status("judgment", "self", [20])],
    description: "Smite for 100% ATK and gather Judgment for the sentence.", fidelity: "adapted",
  }),
  skill("priestess-holy-shield", "Holy Shield", {
    characterId: "exiled-priestess", abilityType: "defensive", rarity: "rare", usesPerAct: 18,
    effects: [shield("max-hp", [25]), status("guard", "self", [2])],
    description: "Pay the strain of faith to raise a fixed ward worth 25% maximum health.", fidelity: "adapted",
  }),
  skill("priestess-wrath-of-heaven", "Wrath of Heaven", {
    characterId: "exiled-priestess", abilityType: "archetype", rarity: "legendary", usesPerAct: 4,
    effects: [lostHealthDamage([100], "self")],
    description: "Deal damage equal to your own missing health.",
  }),
  skill("priestess-doom", "Doom", {
    characterId: "exiled-priestess", abilityType: "archetype", rarity: "mythical", usesPerAct: 3,
    effects: [Object.freeze({ type: "amplify-statuses", target: "enemy", statuses: freezeTable(["burn", "poison", "bleed"]), percentByRank: freezeTable([160]) })],
    description: "Multiply the enemy's Burn, Poison, and Bleed stacks to 160%.",
  }),
  skill("priestess-immediate-judgment", "Immediate Judgment", {
    characterId: "exiled-priestess", abilityType: "archetype", rarity: "mythical", usesPerAct: 2,
    effects: [damage("defense", [260]), status("doom", "enemy", [80])],
    description: "Pass sentence immediately for 260% DEF damage and 80 Doom.", fidelity: "adapted",
    sourceDetail: "The source names Immediate Judgment as a Judgment-consuming finisher; its verdict is normalized as DEF damage plus Doom.",
  }),

  skill("blade-slash", "Slash", {
    characterId: "wandering-blade", abilityType: "basic-attack", rarity: "common",
    effects: [damage("attack", [100]), status("initiative", "self", [25])],
    description: "Slash for 100% ATK and build 25 Initiative.", fidelity: "adapted",
  }),
  skill("blade-barrier", "Blade Barrier", {
    characterId: "wandering-blade", abilityType: "defensive", rarity: "rare", usesPerAct: 20,
    effects: [shield("defense", [210]), status("guard", "self", [2])],
    description: "Turn the sword into a 210% DEF ward with 2 Guard.", fidelity: "adapted",
  }),
  skill("blade-chi-liberation", "Chi Liberation", {
    characterId: "wandering-blade", abilityType: "archetype", rarity: "legendary", usesPerAct: 4, consumesTurn: false,
    effects: [status("priority", "self", [2]), status("strength", "self", [5])],
    description: "Release stored breath for 2 Priority and 5 Strength.", fidelity: "adapted",
  }),
  skill("blade-one-flash", "One Flash", {
    characterId: "wandering-blade", abilityType: "archetype", rarity: "mythical", usesPerAct: 1,
    effects: [damage("attack", [320]), status("priority", "self", [1])],
    description: "Cross the field in one decisive cut, then retain 1 Priority.", fidelity: "adapted",
  }),
  skill("blade-katana-dance", "Katana Dance", {
    characterId: "wandering-blade", abilityType: "archetype", rarity: "epic", usesPerAct: 5,
    effects: [damage("attack", [65], { hits: 3 }), status("initiative", "self", [40])],
    description: "Trace three 65% ATK cuts and carry 40 Initiative into the next exchange.", fidelity: "adapted",
    sourcePage: OFFICIAL_CHANGELOG,
    sourceDetail: "The official changelog names Katana Dance as a Wandering Blade skill; its tempo identity is normalized to three hits and Initiative.",
  }),

  skill("vampire-claw", "Claw", {
    characterId: "desolate-vampire", abilityType: "basic-attack", rarity: "common",
    effects: [damage("attack", [100])],
    description: "Rake the target for 100% ATK; Bloodsuck converts damage into life.", fidelity: "adapted",
  }),
  skill("vampire-blood-thirst", "Blood Thirst", {
    characterId: "desolate-vampire", abilityType: "defensive", rarity: "rare", usesPerAct: 12,
    effects: [heal("attack", [90]), heal("defense", [90])],
    description: "Recover health from both martial power and resilience.", fidelity: "adapted",
    sourceDetail: "The source documents a healing action scaling from both ATK and DEF; each contribution is normalized to 90% here.",
  }),
  skill("vampire-heart-destroyer", "Heart Destroyer", {
    characterId: "desolate-vampire", abilityType: "archetype", rarity: "legendary", usesPerAct: 5,
    effects: [damage("attack", [240]), scaledStatus("bleed", "enemy", "attack", [100])],
    description: "A major blood strike that leaves a deep Bleed.", fidelity: "adapted",
  }),
  skill("vampire-rampage", "Rampage", {
    characterId: "desolate-vampire", abilityType: "archetype", rarity: "mythical", usesPerAct: 1,
    effects: [status("lifesteal", "self", [24]), damage("attack", [48], { hits: 4 })],
    description: "Gain 24% Lifesteal and tear through the enemy four times.", fidelity: "adapted",
  }),
  skill("vampire-bloodflow-absorption", "Bloodflow Absorption", {
    characterId: "desolate-vampire", abilityType: "archetype", rarity: "legendary", usesPerAct: 4,
    effects: [damage("attack", [120]), heal("attack", [80])],
    description: "Draw blood through the wound: deal 120% ATK damage and restore 80% ATK health.", fidelity: "adapted",
    sourceDetail: "The source names Bloodflow Absorption as a blood-control sustain skill; damage and recovery are normalized here.",
  }),

  skill("automaton-bombardment", "Bombardment", {
    characterId: "forsaken-automaton", abilityType: "basic-attack", rarity: "common",
    effects: [damage("attack", [100])],
    description: "Discharge the arm cannon for 100% ATK damage.", fidelity: "adapted",
  }),
  skill("automaton-repair", "Repair", {
    characterId: "forsaken-automaton", abilityType: "defensive", rarity: "uncommon", usesPerAct: 18,
    effects: [Object.freeze({ type: "heal-lost-fraction", target: "self", percentByRank: freezeTable([25]) }), shield("defense", [100])],
    description: "Recover 25% of missing health and restore a 100% DEF casing.", fidelity: "adapted",
  }),
  skill("automaton-emergency-cooling", "Emergency Cooling", {
    characterId: "forsaken-automaton", abilityType: "archetype", rarity: "legendary", usesPerAct: 4, cooldown: 4, consumesTurn: false,
    effects: [Object.freeze({ type: "reduce-statuses", target: "self", statuses: freezeTable(["limp"]), toPercent: 25, percentByRank: freezeTable([75]) }), status("solidity", "self", [2])],
    description: "Vent heat, remove 75% of Limp, and gain 2 Solidity.", fidelity: "adapted",
  }),
  skill("automaton-fate-manipulator", "Fate Manipulator", {
    characterId: "forsaken-automaton", abilityType: "archetype", rarity: "mythical", usesPerAct: 1, consumesTurn: false,
    effects: [status("priority", "self", [3]), status("overload", "self", [50]), status("limp", "self", [12])],
    description: "Force the next sequence: gain 3 Priority and 50 Overload, but take 12 Limp.", fidelity: "adapted",
  }),
  skill("automaton-final-counter", "Final Counter", {
    characterId: "forsaken-automaton", abilityType: "archetype", rarity: "legendary", usesPerAct: 3,
    effects: [shield("defense", [180]), damage("defense", [180])],
    description: "Brace the chassis for a 180% DEF ward and answer with 180% DEF damage.", fidelity: "adapted",
    sourcePage: OFFICIAL_CHANGELOG,
    sourceDetail: "The official changelog names Final Counter as a Forsaken Automaton skill; its reactive exchange is normalized as equal ward and damage.",
  }),
];

export const CHARACTER_ABILITIES = Object.freeze(Object.fromEntries(
  definitions.map((definition) => [definition.id, definition]),
));

export function getCharacterAbility(id) {
  return typeof id === "string" && Object.hasOwn(CHARACTER_ABILITIES, id)
    ? CHARACTER_ABILITIES[id]
    : null;
}

export function characterAbilityIds() {
  return Object.keys(CHARACTER_ABILITIES);
}
