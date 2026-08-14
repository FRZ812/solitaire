// The unequipped half of every Tower of Winter character's authored skill catalogue.
//
// The selector originally shipped only the five equipped actions.  The source roster is
// much larger: every character has three mutually-replacing Basic Attacks, three
// mutually-replacing Defensive actions, and seventeen flexible exclusive skills.  These
// compact specs keep that complete library auditable without duplicating the runtime skill
// schema. `character-abilities.js` compiles every row into the same immutable definition as
// an equipped action, so reward acquisition and combat never receive a second-class shape.

export const CHARACTER_LIBRARY_SOURCE =
  "https://namu.wiki/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91/%EC%BA%90%EB%A6%AD%ED%84%B0";

const freeze = (value) => Object.freeze(value);

function ability(characterId, id, name, sourceName, abilityType, rarity, effects, options = {}) {
  return freeze({
    characterId,
    id,
    name,
    sourceName,
    abilityType,
    rarity,
    effects: freeze(effects.map((effect) => freeze(effect))),
    usesPerAct: options.usesPerAct ?? null,
    cooldown: options.cooldown ?? 0,
    consumesTurn: options.consumesTurn !== false,
    description: options.description || null,
  });
}

const hit = (scale, power, hits = 1) => ["damage", scale, power, hits];
const ward = (scale, power) => ["shield", scale, power];
const heal = (scale, power) => ["heal", scale, power];
const healLost = (power) => ["heal-lost", power];
const boon = (status, power) => ["status", status, "self", power];
const bane = (status, power) => ["status", status, "enemy", power];
const scaledBoon = (status, scale, power) => ["scaled-status", status, "self", scale, power];
const scaledBane = (status, scale, power) => ["scaled-status", status, "enemy", scale, power];
const missingEnemy = (power) => ["lost-damage", "enemy", power];
const missingSelf = (power) => ["lost-damage", "self", power];
const cleanse = (statuses, toPercent = 0, target = "self") => ["cleanse", statuses, toPercent, target];
const amplify = (statuses, percent) => ["amplify", statuses, percent];
const consume = (status, count = 1) => ["consume-status", status, count];

const arctic = "arctic-knight";
const demon = "demon-slayer";
const clock = "owner-of-clocktower";
const king = "old-king-of-northland";
const sleepless = "sleepless-one";
const assassin = "last-assassin";
const witch = "witch-of-eternity";
const mage = "tenacious-mage";
const priestess = "exiled-priestess";
const blade = "wandering-blade";
const vampire = "desolate-vampire";
const automaton = "forsaken-automaton";

export const EXTRA_CHARACTER_ABILITY_SPECS = freeze([
  // Arctic Knight: 2 alternate basics, 2 alternate defences, 14 unequipped exclusives.
  ability(arctic, "arctic-shield-bash", "Shield Bash", "방패 치기", "basic-attack", "uncommon", [hit("defense", [105, 120, 135, 150, 165])]),
  ability(arctic, "arctic-slaughter", "Slaughter", "살육", "basic-attack", "uncommon", [hit("attack", [21, 24, 27, 30, 33]), scaledBane("bleed", "attack", [21, 24, 27, 30, 33])]),
  ability(arctic, "arctic-defensive-stance", "Defensive Stance", "방어 태세", "defensive", "uncommon", [boon("guard", 3)], { usesPerAct: 18 }),
  ability(arctic, "arctic-parry", "Parry", "받아치기", "defensive", "uncommon", [ward("attack", [270, 310, 350, 390, 430])], { usesPerAct: 25 }),
  ability(arctic, "arctic-threatening-cry", "Threatening Cry", "위협의 외침", "archetype", "uncommon", [scaledBane("lethargy", "attack", [60, 70, 80, 90, 100])], { usesPerAct: 7, consumesTurn: false }),
  ability(arctic, "arctic-gather-strength", "Gather Strength", "힘 모으기", "archetype", "uncommon", [boon("strength", [4, 5, 6, 7, 8])], { usesPerAct: 6, consumesTurn: false }),
  ability(arctic, "arctic-giants-smash", "Giant's Smash", "거인의 일격", "archetype", "rare", [hit("max-hp", [13, 16, 19, 22]), bane("stun", 1)], { usesPerAct: 3 }),
  ability(arctic, "arctic-cross-slash", "Cross Slash", "십자 베기", "archetype", "rare", [hit("attack", [75, 90, 105, 120], 2)], { usesPerAct: 7 }),
  ability(arctic, "arctic-battle-cry", "Battle Cry", "전투의 외침", "archetype", "rare", [boon("solidity", 3)], { usesPerAct: 4, consumesTurn: false }),
  ability(arctic, "arctic-fist-of-justice", "Fist of Justice", "정의의 철권", "archetype", "rare", [hit("defense", [115, 140, 165, 190]), scaledBane("lethargy", "defense", [115, 140, 165, 190])], { usesPerAct: 5 }),
  ability(arctic, "arctic-thirst-for-blood", "Thirst for Blood", "피의 갈증", "archetype", "epic", [boon("lifesteal", [12, 16, 20])], { usesPerAct: 4, consumesTurn: false }),
  ability(arctic, "arctic-decisive-warcry", "Decisive Warcry", "결전의 외침", "archetype", "epic", [boon("strength", [9, 12, 15]), boon("unstoppable", 2)], { usesPerAct: 3, consumesTurn: false }),
  ability(arctic, "arctic-retaliation", "Retaliation", "반격", "archetype", "legendary", [ward("defense", [160, 240]), hit("defense", [160, 240])], { usesPerAct: 8 }),
  ability(arctic, "arctic-secret-blow", "Secret Blow", "비장의 일격", "archetype", "legendary", [hit("attack", [260, 340]), bane("vulnerable", [4, 6])], { usesPerAct: 3 }),
  ability(arctic, "arctic-triple-slash", "Triple Slash", "삼중 베기", "archetype", "legendary", [hit("attack", [62, 82], 3)], { usesPerAct: 4 }),
  ability(arctic, "arctic-brutal-slash", "Brutal Slash", "잔혹한 일격", "archetype", "legendary", [hit("attack", [180, 240]), scaledBane("bleed", "attack", [36, 48])], { usesPerAct: 3 }),
  ability(arctic, "arctic-iron-wall-defense", "Iron Wall Defense", "철벽 수비", "archetype", "mythical", [ward("defense", 450), boon("guard", 5)], { usesPerAct: 2 }),
  ability(arctic, "arctic-ultimate-body", "Ultimate Body", "궁극의 육체", "archetype", "mythical", [healLost(70), boon("unstoppable", 4)], { usesPerAct: 1, consumesTurn: false }),

  // Demon Slayer.
  ability(demon, "demon-rapid-fire", "Rapid Fire", "속사", "basic-attack", "uncommon", [hit("attack", [58, 66, 74, 82, 90], 2)]),
  ability(demon, "demon-precise-shot", "Precise Shot", "정밀 사격", "basic-attack", "uncommon", [hit("attack", [120, 140, 160, 180, 200]), bane("vulnerable", 1)]),
  ability(demon, "demon-improvisation", "Improvisation", "임기응변", "defensive", "uncommon", [ward("attack", [190, 220, 250, 280, 310]), boon("evade", 1)], { usesPerAct: 18 }),
  ability(demon, "demon-deflection", "Deflection", "튕겨내기", "defensive", "uncommon", [ward("defense", [240, 280, 320, 360, 400]), bane("lethargy", 1)], { usesPerAct: 22 }),
  ability(demon, "demon-apply-poison", "Apply Poison", "독 바르기", "archetype", "uncommon", [boon("poison-atk", [3, 4, 5, 6, 7])], { usesPerAct: 5, consumesTurn: false }),
  ability(demon, "demon-poison-bottle", "Poison Bottle Toss", "독병 투척", "archetype", "uncommon", [scaledBane("poison", "attack", [80, 100, 120, 140, 160])], { usesPerAct: 7 }),
  ability(demon, "demon-eagle-eye", "Eagle Eye", "독수리의 눈", "archetype", "rare", [boon("sharpen", [15, 20, 25, 30])], { usesPerAct: 5, consumesTurn: false }),
  ability(demon, "demon-triple-shot", "Triple Shot", "삼연사", "archetype", "rare", [hit("attack", [48, 58, 68, 78], 3)], { usesPerAct: 7 }),
  ability(demon, "demon-smoke-bomb", "Smoke Bomb", "연막탄", "archetype", "rare", [boon("conceal", 1), bane("weak", [2, 3, 4, 5])], { usesPerAct: 5, consumesTurn: false }),
  ability(demon, "demon-snipe", "Snipe", "저격", "archetype", "rare", [hit("attack", [220, 270, 320, 370]), bane("vulnerable", [2, 3, 4, 5])], { usesPerAct: 4, cooldown: 3 }),
  ability(demon, "demon-catalyst", "Catalyst", "촉매", "archetype", "epic", [amplify(["poison"], [150, 175, 200])], { usesPerAct: 4, consumesTurn: false }),
  ability(demon, "demon-evasive-shot", "Evasive Shot", "회피 사격", "archetype", "epic", [hit("attack", [110, 140, 170]), boon("evade", 1)], { usesPerAct: 5 }),
  ability(demon, "demon-d-day", "D-Day", "결전의 시간", "archetype", "epic", [boon("strength", [10, 14, 18]), boon("priority", 1)], { usesPerAct: 3, consumesTurn: false }),
  ability(demon, "demon-ultimate-venom", "Ultimate Venom", "궁극의 맹독", "archetype", "legendary", [scaledBane("poison", "attack", [220, 300])], { usesPerAct: 3 }),
  ability(demon, "demon-overwhelm", "Overwhelm", "몰아치기", "archetype", "legendary", [hit("attack", [40, 55], 5), bane("cripple", [5, 7])], { usesPerAct: 3 }),
  ability(demon, "demon-high-speed-shooting", "High-Speed Shooting", "초고속 사격", "archetype", "legendary", [hit("attack", [46, 62], 6)], { usesPerAct: 2 }),
  ability(demon, "demon-shadow-stealth", "Shadow Stealth", "그림자 은신", "archetype", "mythical", [boon("conceal", 3), boon("priority", 2)], { usesPerAct: 1, consumesTurn: false }),
  ability(demon, "demon-endless-grudge", "Endless Grudge", "끝없는 원한", "archetype", "mythical", [missingEnemy([35, 50]), scaledBane("poison", "attack", [140, 200])], { usesPerAct: 2 }),

  // Owner of Clocktower.
  ability(clock, "clocktower-binding-shot", "Binding Shot", "속박 사격", "basic-attack", "uncommon", [hit("attack", [85, 100, 115, 130, 145]), bane("paralyze", 1)]),
  ability(clock, "clocktower-fusion-shot", "Fusion Shot", "융합 사격", "basic-attack", "uncommon", [hit("attack", [62, 72, 82, 92, 102], 2)]),
  ability(clock, "clocktower-fusion-barrier", "Fusion Barrier", "융합 역장", "defensive", "uncommon", [ward("attack", [135, 155, 175, 195, 215]), ward("defense", [135, 155, 175, 195, 215])], { usesPerAct: 22 }),
  ability(clock, "clocktower-cloaking-field", "Cloaking Field", "은폐장", "defensive", "uncommon", [boon("conceal", 1), ward("defense", [160, 190, 220, 250, 280])], { usesPerAct: 14, cooldown: 3 }),
  ability(clock, "clocktower-grappling-hook", "Grappling Hook", "갈고리 발사", "archetype", "uncommon", [hit("attack", [70, 85, 100, 115, 130]), bane("paralyze", 1)], { usesPerAct: 7, consumesTurn: false }),
  ability(clock, "clocktower-high-voltage", "High Voltage", "고전압", "archetype", "uncommon", [bane("paralyze", [1, 1, 2, 2, 3]), bane("doom", [20, 30, 40, 50, 60])], { usesPerAct: 6 }),
  ability(clock, "clocktower-armor-piercing-round", "Armor-Piercing Round", "철갑탄", "archetype", "rare", [hit("attack", [150, 180, 210, 240]), bane("vulnerable", [3, 4, 5, 6])], { usesPerAct: 6 }),
  ability(clock, "clocktower-reinforcement", "Reinforcement", "보강", "archetype", "rare", [boon("tenacity", [6, 8, 10, 12])], { usesPerAct: 5, consumesTurn: false }),
  ability(clock, "clocktower-grenade-toss", "Grenade Toss", "수류탄 투척", "archetype", "rare", [hit("attack", [125, 150, 175, 200]), bane("stun", 1)], { usesPerAct: 5 }),
  ability(clock, "clocktower-preparation", "Preparation", "준비", "archetype", "rare", [boon("priority", 1), boon("overload", [12, 18, 24, 30])], { usesPerAct: 5, consumesTurn: false }),
  ability(clock, "clocktower-ultra-barrier", "Ultra-Powerful Barrier", "초강력 역장", "archetype", "epic", [ward("defense", [350, 425, 500]), boon("guard", 2)], { usesPerAct: 4 }),
  ability(clock, "clocktower-tailored-drink", "Tailored Drink", "특제 드링크", "archetype", "epic", [healLost([30, 40, 50]), cleanse(["burn", "poison", "bleed"], 50)], { usesPerAct: 4, consumesTurn: false }),
  ability(clock, "clocktower-steel-net", "Steel Net", "강철 그물", "archetype", "epic", [bane("paralyze", 2), bane("lethargy", [6, 8, 10])], { usesPerAct: 4, cooldown: 4 }),
  ability(clock, "clocktower-critical-weakness", "Critical Weakness", "결정적 약점", "archetype", "legendary", [bane("vulnerable", [10, 14]), boon("sharpen", [20, 30])], { usesPerAct: 3, consumesTurn: false }),
  ability(clock, "clocktower-buckshot", "Buckshot", "산탄 사격", "archetype", "legendary", [hit("attack", [54, 72], 4)], { usesPerAct: 4 }),
  ability(clock, "clocktower-mysterious-stopwatch", "Mysterious Stopwatch", "신비한 초시계", "archetype", "legendary", [boon("priority", [2, 3])], { usesPerAct: 2, consumesTurn: false }),
  ability(clock, "clocktower-chain-explosion", "Chain Explosion", "유폭", "archetype", "mythical", [hit("attack", [90, 120], 3), bane("burn", [30, 45])], { usesPerAct: 2 }),
  ability(clock, "clocktower-time-machine", "Time Machine", "타임머신", "archetype", "mythical", [healLost(100), cleanse(["burn", "poison", "bleed", "limp", "vulnerable"], 0)], { usesPerAct: 1, consumesTurn: false }),

  // Old King of Northland.
  ability(king, "north-king-smash", "Smash", "강타", "basic-attack", "uncommon", [hit("attack", [125, 145, 165, 185, 205]), boon("overload", [4, 5, 6, 7, 8])]),
  ability(king, "north-king-sweeping-blow", "Sweeping Blow", "후려치기", "basic-attack", "uncommon", [hit("attack", [90, 105, 120, 135, 150]), scaledBane("lethargy", "attack", [35, 45, 55, 65, 75])]),
  ability(king, "north-king-headbutt", "Headbutt", "박치기", "defensive", "uncommon", [ward("defense", [175, 205, 235, 265, 295]), hit("defense", [70, 85, 100, 115, 130])], { usesPerAct: 20 }),
  ability(king, "north-king-endure", "Endure", "버티기", "defensive", "uncommon", [boon("solidity", [2, 2, 3, 3, 4]), ward("max-hp", [12, 14, 16, 18, 20])], { usesPerAct: 18 }),
  ability(king, "north-king-bears-blessing", "Bear's Blessing", "곰의 축복", "archetype", "uncommon", [boon("tenacity", [5, 7, 9, 11, 13])], { usesPerAct: 6, consumesTurn: false }),
  ability(king, "north-king-charge", "Charge", "돌격", "archetype", "uncommon", [hit("max-hp", [10, 12, 14, 16, 18]), bane("stun", 1)], { usesPerAct: 6 }),
  ability(king, "north-king-boulder-toss", "Boulder Toss", "바위 던지기", "archetype", "rare", [hit("defense", [125, 150, 175, 200]), bane("lethargy", [2, 3, 4, 5])], { usesPerAct: 7 }),
  ability(king, "north-king-power-of-earth", "Power of Earth", "대지의 힘", "archetype", "rare", [scaledBoon("strength", "defense", [55, 65, 75, 85])], { usesPerAct: 5, consumesTurn: false }),
  ability(king, "north-king-intimidation", "Intimidation", "위압감", "archetype", "rare", [bane("weak", [4, 5, 6, 7]), bane("lethargy", [4, 5, 6, 7])], { usesPerAct: 5, consumesTurn: false }),
  ability(king, "north-king-warriors-oath", "Warrior's Oath", "전사의 맹세", "archetype", "rare", [boon("unstoppable", [2, 3, 4, 5]), boon("strength", [4, 5, 6, 7])], { usesPerAct: 4, consumesTurn: false }),
  ability(king, "north-king-battle-instinct", "Battle Instinct", "전투 본능", "archetype", "epic", [boon("haste", 1), boon("sharpen", [10, 15, 20])], { usesPerAct: 4, consumesTurn: false }),
  ability(king, "north-king-bear-trap", "Bear Trap", "곰잡이 덫", "archetype", "epic", [bane("paralyze", 2), bane("bleed", [18, 24, 30])], { usesPerAct: 4, cooldown: 4 }),
  ability(king, "north-king-natures-intervention", "Nature's Intervention", "대자연의 중재", "archetype", "epic", [healLost([30, 40, 50]), cleanse(["burn", "poison", "bleed"], 50)], { usesPerAct: 4 }),
  ability(king, "north-king-reckless-blow", "Reckless Blow", "무모한 일격", "archetype", "legendary", [hit("attack", [280, 360]), bane("vulnerable", [5, 7]), boon("vulnerable", [4, 6])], { usesPerAct: 3 }),
  ability(king, "north-king-crumbling-blow", "Crumbling Blow", "붕괴의 일격", "archetype", "legendary", [hit("attack", [230, 310]), bane("vulnerable", [10, 14])], { usesPerAct: 3 }),
  ability(king, "north-king-maelstrom", "Maelstrom", "소용돌이", "archetype", "legendary", [hit("attack", [45, 60], 4), scaledBane("lethargy", "attack", [30, 40])], { usesPerAct: 3 }),
  ability(king, "north-king-rampage", "Rampage", "폭주", "archetype", "mythical", [boon("berserk", 100), boon("haste", 2)], { usesPerAct: 1, consumesTurn: false }),
  ability(king, "north-king-beasts-heart", "Beast's Heart", "야수의 심장", "archetype", "mythical", [scaledBoon("strength", "defense", [100, 130]), heal("defense", [120, 160])], { usesPerAct: 2, consumesTurn: false }),

  // Sleepless One. Swing and Hard Scales are the source starting forms; the previously
  // equipped Flame Strike and Flame Curtain remain in the library as their replacements.
  ability(sleepless, "sleepless-swing", "Swing", "휘두르기", "basic-attack", "common", [hit("attack", [100, 115, 130, 145, 160, 175])]),
  ability(sleepless, "sleepless-spinning-strike", "Spinning Strike", "회전격", "basic-attack", "uncommon", [hit("attack", [62, 72, 82, 92, 102], 2), scaledBane("burn", "attack", [20, 24, 28, 32, 36])]),
  ability(sleepless, "sleepless-hard-scales", "Hard Scales", "단단한 비늘", "defensive", "common", [ward("defense", [250, 300, 350, 400, 450, 500])], { usesPerAct: 30 }),
  ability(sleepless, "sleepless-steel-scales", "Steel Scales", "강철 비늘", "defensive", "uncommon", [ward("defense", [210, 245, 280, 315, 350]), boon("steelskin", [4, 5, 6, 7, 8])], { usesPerAct: 22 }),
  ability(sleepless, "sleepless-detonation", "Detonation", "기폭", "archetype", "uncommon", [amplify(["burn"], [140, 155, 170, 185, 200])], { usesPerAct: 7 }),
  ability(sleepless, "sleepless-fire-rain", "Fire Rain", "불벼락", "archetype", "uncommon", [hit("attack", [42, 50, 58, 66, 74], 3), scaledBane("burn", "attack", [55, 65, 75, 85, 95])], { usesPerAct: 7 }),
  ability(sleepless, "sleepless-acceleration", "Acceleration", "촉진", "archetype", "rare", [boon("haste", [1, 1, 2, 2])], { usesPerAct: 5, consumesTurn: false }),
  ability(sleepless, "sleepless-tail-swipe", "Tail Swipe", "꼬리 치기", "archetype", "rare", [hit("defense", [125, 150, 175, 200]), bane("stun", 1)], { usesPerAct: 6 }),
  ability(sleepless, "sleepless-cool-composure", "Cool Composure", "냉정", "archetype", "rare", [cleanse(["weak", "lethargy", "vulnerable", "limp"], 50), boon("solidity", 2)], { usesPerAct: 5, consumesTurn: false }),
  ability(sleepless, "sleepless-mark-of-the-wild", "Mark of the Wild", "야생의 문장", "archetype", "rare", [boon("strength", [5, 7, 9, 11]), boon("tenacity", [5, 7, 9, 11])], { usesPerAct: 5, consumesTurn: false }),
  ability(sleepless, "sleepless-water-totem", "Water Totem", "물의 토템", "archetype", "epic", [healLost([20, 30, 40]), cleanse(["burn"], 0)], { usesPerAct: 4, consumesTurn: false }),
  ability(sleepless, "sleepless-essence-torrent", "Essence Torrent", "정수 격류", "archetype", "epic", [hit("attack", [55, 70, 85], 3), boon("overload", [10, 15, 20])], { usesPerAct: 4 }),
  ability(sleepless, "sleepless-hardening", "Hardening", "경화", "archetype", "epic", [boon("steelskin", [10, 14, 18]), boon("guard", 2)], { usesPerAct: 4, consumesTurn: false }),
  ability(sleepless, "sleepless-breakthrough", "Breakthrough", "돌파", "archetype", "legendary", [hit("attack", [220, 290]), bane("vulnerable", [6, 9])], { usesPerAct: 3 }),
  ability(sleepless, "sleepless-transference", "Transference", "전이", "archetype", "legendary", [cleanse(["burn", "poison", "bleed"], 0), scaledBane("poison", "attack", [100, 140])], { usesPerAct: 3, consumesTurn: false }),
  ability(sleepless, "sleepless-gale-totem", "Gale Totem", "질풍의 토템", "archetype", "legendary", [boon("haste", 2), boon("priority", 1)], { usesPerAct: 2, consumesTurn: false }),
  ability(sleepless, "sleepless-predators-instinct", "Predator's Instinct", "포식자의 본능", "archetype", "mythical", [boon("focus", 50), boon("lifesteal", 20)], { usesPerAct: 1, consumesTurn: false }),
  ability(sleepless, "sleepless-fire-dragons-breath", "Fire Dragon's Breath", "화룡의 숨결", "archetype", "mythical", [hit("attack", [260, 340]), scaledBane("burn", "attack", [200, 260])], { usesPerAct: 2 }),

  // Last Assassin. The alternate basics and late-game rows use the values visible in the
  // supplied source screenshots; remaining rows preserve the source identity with a
  // kernel-native adaptation.
  ability(assassin, "assassin-mutilate", "Mutilate", "난도질", "basic-attack", "uncommon", [hit("attack", [30, 35, 40, 45, 50], 3)]),
  ability(assassin, "assassin-hamstring-cut", "Hamstring Cut", "힘줄베기", "basic-attack", "uncommon", [hit("attack", [95, 110, 125, 140, 155]), bane("weak", 2)]),
  ability(assassin, "assassin-weapon-block", "Weapon Block", "무기 막기", "defensive", "uncommon", [ward("attack", [210, 245, 280, 315, 350]), boon("guard", 1)], { usesPerAct: 22 }),
  ability(assassin, "assassin-acrobatics", "Acrobatics", "아크로바틱", "defensive", "uncommon", [boon("evade", 1), ward("defense", [145, 170, 195, 220, 245])], { usesPerAct: 18 }),
  ability(assassin, "assassin-boost-up", "Boost Up", "기세 올리기", "archetype", "uncommon", [boon("eviscerate", [3, 4, 5, 6, 7])], { usesPerAct: 6, consumesTurn: false }),
  ability(assassin, "assassin-double-slash", "Double Slash", "이중 베기", "archetype", "uncommon", [hit("attack", [72, 84, 96, 108, 120], 2)], { usesPerAct: 8 }),
  ability(assassin, "assassin-feint", "Feint", "페인트", "archetype", "rare", [boon("evade", 1), bane("vulnerable", [2, 3, 4, 5])], { usesPerAct: 6, consumesTurn: false }),
  ability(assassin, "assassin-decisive-blow", "Decisive Blow", "결정적 일격", "archetype", "rare", [hit("attack", [210, 250, 290, 330]), bane("vulnerable", [3, 4, 5, 6])], { usesPerAct: 5 }),
  ability(assassin, "assassin-ambush", "Ambush", "기습", "archetype", "rare", [missingEnemy([18, 21, 24, 27])], { usesPerAct: 5 }),
  ability(assassin, "assassin-leg-cut", "Leg Cut", "다리 베기", "archetype", "rare", [hit("attack", [90, 110, 130, 150]), bane("lethargy", [4, 5, 6, 7])], { usesPerAct: 6 }),
  ability(assassin, "assassin-perfect-plan", "Perfect Plan", "완벽한 계획", "archetype", "epic", [boon("priority", 1), boon("sharpen", [18, 24, 30])], { usesPerAct: 4, consumesTurn: false }),
  ability(assassin, "assassin-total-defense", "Total Defense", "전력 방어", "archetype", "epic", [ward("defense", [300, 360, 420]), boon("guard", 3)], { usesPerAct: 4 }),
  ability(assassin, "assassin-cold-blood", "Cold Blood", "냉혈", "archetype", "epic", [cleanse(["weak", "lethargy", "vulnerable", "cripple"], 50)], { usesPerAct: 3, consumesTurn: false }),
  ability(assassin, "assassin-finishing-blow", "Finishing Blow", "마무리 일격", "archetype", "legendary", [missingEnemy(30)], { usesPerAct: 2, cooldown: 9 }),
  ability(assassin, "assassin-flash-cut", "Flash Cut", "섬광 베기", "archetype", "legendary", [hit("attack", 30)], { usesPerAct: 6, consumesTurn: false }),
  ability(assassin, "assassin-perfect-opportunity", "Perfect Opportunity", "절호의 기회", "archetype", "legendary", [amplify(["burn", "poison", "bleed", "weak", "lethargy", "vulnerable"], 140)], { usesPerAct: 2, consumesTurn: false }),
  ability(assassin, "assassin-life-saving-pill", "Life-Saving Pill", "구명단", "archetype", "mythical", [healLost(60), cleanse(["burn", "poison", "bleed"], 0)], { usesPerAct: 2 }),
  ability(assassin, "assassin-shadow-strike", "Shadow Strike", "그림자 일격", "archetype", "mythical", [hit("attack", 150), ward("attack", 80), consume("priority", 1)], { usesPerAct: 3 }),

  // Witch of Eternity.
  ability(witch, "witch-attack", "Attack", "공격", "basic-attack", "common", [hit("attack", [100, 115, 130, 145, 160, 175])]),
  ability(witch, "witch-vampiric-touch", "Vampiric Touch", "흡혈의 손길", "basic-attack", "uncommon", [hit("attack", [85, 100, 115, 130, 145]), heal("attack", [35, 40, 45, 50, 55])]),
  ability(witch, "witch-curse-of-aging", "Curse of Aging", "노화의 저주", "defensive", "uncommon", [bane("weak", [3, 4, 5, 6, 7]), ward("defense", [150, 175, 200, 225, 250])], { usesPerAct: 20 }),
  ability(witch, "witch-ghost-form", "Ghost Form", "유체화", "defensive", "uncommon", [boon("invincible", 1), boon("evade", 1)], { usesPerAct: 12, cooldown: 3 }),
  ability(witch, "witch-touch-of-the-dead", "Touch of the Dead", "망자의 손길", "archetype", "uncommon", [hit("attack", [75, 90, 105, 120, 135]), bane("doom", [20, 25, 30, 35, 40])], { usesPerAct: 7 }),
  ability(witch, "witch-demons-sigil", "Demon's Sigil", "악마의 문장", "archetype", "uncommon", [boon("skeleton", [5, 7, 9, 11, 13]), boon("strength", [2, 3, 4, 5, 6])], { usesPerAct: 6, consumesTurn: false }),
  ability(witch, "witch-battering-ram", "Battering Ram", "공성추", "archetype", "rare", [hit("defense", [145, 175, 205, 235]), bane("stun", 1)], { usesPerAct: 6 }),
  ability(witch, "witch-void-monster", "Void Monster", "공허 괴물", "archetype", "rare", [bane("weak", [5, 7, 9, 11]), bane("doom", [35, 45, 55, 65])], { usesPerAct: 5 }),
  ability(witch, "witch-nullification", "Nullification", "무효화", "archetype", "rare", [cleanse(["burn", "poison", "bleed", "weak", "lethargy", "vulnerable"], 0)], { usesPerAct: 5, consumesTurn: false }),
  ability(witch, "witch-reapers-scythe", "Reaper's Scythe", "사신의 낫", "archetype", "rare", [hit("attack", [170, 205, 240, 275]), missingEnemy([10, 12, 14, 16])], { usesPerAct: 5 }),
  ability(witch, "witch-proliferation", "Proliferation", "증식", "archetype", "epic", [boon("skeleton", [12, 16, 20])], { usesPerAct: 4, consumesTurn: false }),
  ability(witch, "witch-skeleton-defense", "Skeleton Defense Formation", "해골 방어진", "archetype", "epic", [ward("defense", [250, 300, 350]), boon("guard", [2, 3, 4])], { usesPerAct: 4 }),
  ability(witch, "witch-forbidden-ritual", "Forbidden Ritual", "금지된 의식", "archetype", "epic", [missingSelf([80, 100, 120]), boon("skeleton", [10, 14, 18])], { usesPerAct: 4 }),
  ability(witch, "witch-gate-underworld", "Gate of the Underworld", "명계의 문", "archetype", "legendary", [boon("skeleton", [25, 35]), bane("doom", [70, 100])], { usesPerAct: 3 }),
  ability(witch, "witch-human-wave-tactics", "Human-Wave Tactics", "인해 전술", "archetype", "legendary", [hit("attack", [38, 52], 5), boon("skeleton", [8, 12])], { usesPerAct: 3 }),
  ability(witch, "witch-hellfire-spirit", "Hellfire Spirit", "지옥불 정령", "archetype", "legendary", [scaledBane("burn", "attack", [150, 210]), boon("skeleton", [8, 12])], { usesPerAct: 3 }),
  ability(witch, "witch-bone-sphere", "Bone Sphere", "뼈의 구체", "archetype", "mythical", [ward("defense", [420, 520]), boon("thorn", [30, 45])], { usesPerAct: 2 }),
  ability(witch, "witch-limited-life-sentence", "Limited-Life Sentence", "시한부 선고", "archetype", "mythical", [bane("doom", [180, 260]), bane("vulnerable", [12, 18])], { usesPerAct: 2, cooldown: 5 }),

  // Tenacious Mage.
  ability(mage, "mage-incinerate", "Incinerate", "불태우기", "basic-attack", "uncommon", [hit("attack", [82, 96, 110, 124, 138]), scaledBane("burn", "attack", [35, 40, 45, 50, 55])]),
  ability(mage, "mage-blood-sword", "Blood Sword", "피의 검", "basic-attack", "uncommon", [hit("attack", [110, 128, 146, 164, 182]), heal("attack", [20, 24, 28, 32, 36])]),
  ability(mage, "mage-life-drain", "Life Drain", "생명력 흡수", "defensive", "uncommon", [hit("attack", [65, 75, 85, 95, 105]), heal("attack", [65, 75, 85, 95, 105])], { usesPerAct: 20 }),
  ability(mage, "mage-blood-protection", "Blood Protection", "피의 보호", "defensive", "uncommon", [ward("max-hp", [18, 21, 24, 27, 30]), boon("lifesteal", [5, 6, 7, 8, 9])], { usesPerAct: 18 }),
  ability(mage, "mage-thorn-veil", "Thorn Veil", "가시 장막", "archetype", "uncommon", [ward("defense", [160, 185, 210, 235, 260]), boon("thorn", [6, 8, 10, 12, 14])], { usesPerAct: 7 }),
  ability(mage, "mage-regeneration", "Regeneration", "재생", "archetype", "uncommon", [healLost([20, 25, 30, 35, 40]), boon("grow", [4, 5, 6, 7, 8])], { usesPerAct: 6 }),
  ability(mage, "mage-blink", "Blink", "점멸", "archetype", "rare", [boon("evade", 1), boon("priority", 1)], { usesPerAct: 5, consumesTurn: false }),
  ability(mage, "mage-fear", "Fear", "공포", "archetype", "rare", [bane("paralyze", 1), bane("weak", [4, 5, 6, 7])], { usesPerAct: 5 }),
  ability(mage, "mage-overload", "Overload", "과부하", "archetype", "rare", [boon("overload", [20, 28, 36, 44])], { usesPerAct: 5, consumesTurn: false }),
  ability(mage, "mage-ignition", "Ignition", "점화", "archetype", "rare", [scaledBane("burn", "attack", [100, 125, 150, 175])], { usesPerAct: 6 }),
  ability(mage, "mage-arrow-of-harmony", "Arrow of Harmony", "조화의 화살", "archetype", "epic", [hit("attack", [150, 185, 220]), ward("defense", [100, 125, 150])], { usesPerAct: 4 }),
  ability(mage, "mage-destruction-ray", "Destruction Ray", "파괴 광선", "archetype", "epic", [hit("attack", [235, 285, 335]), bane("vulnerable", [5, 7, 9])], { usesPerAct: 4 }),
  ability(mage, "mage-ancient-curse", "Ancient Curse", "고대의 저주", "archetype", "epic", [bane("weak", [7, 9, 11]), bane("doom", [60, 80, 100])], { usesPerAct: 4 }),
  ability(mage, "mage-mana-concentration", "Mana Concentration", "마력 결집", "archetype", "legendary", [boon("charge", 100), boon("strength", [12, 18])], { usesPerAct: 3, consumesTurn: false }),
  ability(mage, "mage-invincible", "Invincible", "무적", "archetype", "legendary", [boon("invincible", [2, 3])], { usesPerAct: 2, consumesTurn: false }),
  ability(mage, "mage-disintegrate", "Disintegrate", "분해", "archetype", "legendary", [hit("attack", [300, 400]), bane("doom", [80, 120])], { usesPerAct: 2 }),
  ability(mage, "mage-blood-judgment", "Blood Judgment", "피의 심판", "archetype", "mythical", [missingSelf([140, 190]), heal("attack", [80, 110])], { usesPerAct: 2 }),
  ability(mage, "mage-regression", "Regression", "회귀", "archetype", "mythical", [healLost(100), cleanse(["burn", "poison", "bleed", "weak", "lethargy", "vulnerable", "limp"], 0)], { usesPerAct: 1, consumesTurn: false }),

  // Exiled Priestess. Block is the source starting defence; Holy Shield remains available
  // as one of its two replacement forms.
  ability(priestess, "priestess-holy-shock", "Holy Shock", "신성 충격", "basic-attack", "uncommon", [hit("defense", [95, 110, 125, 140, 155]), boon("judgment", [4, 5, 6, 7, 8])]),
  ability(priestess, "priestess-blow-of-composure", "Blow of Composure", "평정의 일격", "basic-attack", "uncommon", [hit("attack", [105, 120, 135, 150, 165]), heal("defense", [25, 30, 35, 40, 45])]),
  ability(priestess, "priestess-block", "Block", "차단", "defensive", "common", [ward("defense", [250, 300, 350, 400, 450, 500])], { usesPerAct: 30 }),
  ability(priestess, "priestess-counter", "Counter", "응수", "defensive", "uncommon", [ward("defense", [190, 220, 250, 280, 310]), hit("defense", [90, 105, 120, 135, 150])], { usesPerAct: 20 }),
  ability(priestess, "priestess-hour-of-judgment", "Hour of Judgment", "선고의 시간", "archetype", "uncommon", [boon("judgment", [20, 25, 30, 35, 40])], { usesPerAct: 7, consumesTurn: false }),
  ability(priestess, "priestess-instant-heal", "Instant Heal", "순간 치유", "archetype", "uncommon", [healLost([25, 30, 35, 40, 45])], { usesPerAct: 7, consumesTurn: false }),
  ability(priestess, "priestess-weapon-of-judgment", "Weapon of Judgment", "심판의 무기", "archetype", "rare", [boon("doom-atk", [15, 20, 25, 30])], { usesPerAct: 5, consumesTurn: false }),
  ability(priestess, "priestess-divine-barrier", "Divine Barrier", "신성 보호막", "archetype", "rare", [ward("defense", [275, 325, 375, 425]), boon("protection", [5, 6, 7, 8])], { usesPerAct: 5 }),
  ability(priestess, "priestess-holy-smite", "Holy Smite", "신성한 강타", "archetype", "rare", [hit("defense", [145, 175, 205, 235]), bane("doom", [30, 40, 50, 60])], { usesPerAct: 6 }),
  ability(priestess, "priestess-divine-favor", "Divine Favor", "신의 가호", "archetype", "rare", [boon("guard", [2, 3, 4, 5]), boon("tenacity", [4, 5, 6, 7])], { usesPerAct: 5, consumesTurn: false }),
  ability(priestess, "priestess-purification", "Purification", "정화", "archetype", "epic", [cleanse(["burn", "poison", "bleed", "weak", "lethargy", "vulnerable"], 0), healLost([15, 20, 25])], { usesPerAct: 4 }),
  ability(priestess, "priestess-intercession", "Intercession", "중재", "archetype", "epic", [ward("max-hp", [25, 30, 35]), boon("invincible", 1)], { usesPerAct: 4 }),
  ability(priestess, "priestess-greater-heal", "Greater Heal", "대회복", "archetype", "legendary", [healLost([55, 70])], { usesPerAct: 3 }),
  ability(priestess, "priestess-trinity", "Trinity", "삼위일체", "archetype", "legendary", [hit("defense", [75, 95], 3), boon("judgment", [15, 20])], { usesPerAct: 3 }),
  ability(priestess, "priestess-holy-binding", "Holy Binding", "신성한 속박", "archetype", "legendary", [bane("paralyze", [2, 3]), bane("doom", [60, 90])], { usesPerAct: 3, cooldown: 4 }),
  ability(priestess, "priestess-oracle", "Oracle", "신탁", "archetype", "mythical", [boon("priority", 3), boon("judgment", 50)], { usesPerAct: 1, consumesTurn: false }),
  ability(priestess, "priestess-immortality", "Immortality", "불멸", "archetype", "mythical", [boon("invincible", 4), healLost(40)], { usesPerAct: 1, consumesTurn: false }),
  ability(priestess, "priestess-power-of-god", "Power of God", "신의 힘", "archetype", "mythical", [boon("strength", 25), boon("tenacity", 25), boon("unstoppable", 3)], { usesPerAct: 1, consumesTurn: false }),

  // Wandering Blade.
  ability(blade, "blade-killers-sword", "Killer's Sword", "살수의 검", "basic-attack", "uncommon", [hit("attack", [115, 132, 149, 166, 183]), bane("bleed", [4, 5, 6, 7, 8])]),
  ability(blade, "blade-riposte", "Riposte", "역습", "basic-attack", "uncommon", [hit("defense", [110, 128, 146, 164, 182]), boon("initiative", [15, 20, 25, 30, 35])]),
  ability(blade, "blade-flash-step", "Flash Step", "순보", "defensive", "uncommon", [boon("evade", 1), boon("initiative", [20, 25, 30, 35, 40])], { usesPerAct: 18 }),
  ability(blade, "blade-killing-intent-release", "Killing Intent Release", "살기 방출", "defensive", "uncommon", [ward("attack", [190, 220, 250, 280, 310]), bane("weak", [2, 3, 4, 5, 6])], { usesPerAct: 20 }),
  ability(blade, "blade-double-slash", "Double Slash", "이연참", "archetype", "uncommon", [hit("attack", [70, 82, 94, 106, 118], 2), boon("initiative", [20, 25, 30, 35, 40])], { usesPerAct: 8 }),
  ability(blade, "blade-quick-swordsmanship", "Quick Swordsmanship", "쾌검술", "archetype", "uncommon", [boon("haste", 1), boon("initiative", [25, 30, 35, 40, 45])], { usesPerAct: 6, consumesTurn: false }),
  ability(blade, "blade-sword-qi", "Sword Qi", "검기", "archetype", "rare", [hit("attack", [135, 160, 185, 210]), bane("vulnerable", [2, 3, 4, 5])], { usesPerAct: 7 }),
  ability(blade, "blade-domain", "Domain of the Blade", "검의 영역", "archetype", "rare", [boon("sharpen", [12, 16, 20, 24]), boon("tenacity", [4, 5, 6, 7])], { usesPerAct: 5, consumesTurn: false }),
  ability(blade, "blade-secret-sword", "Secret Sword Art", "비검술", "archetype", "rare", [hit("attack", [210, 250, 290, 330]), boon("initiative", [30, 35, 40, 45])], { usesPerAct: 5 }),
  ability(blade, "blade-flying-sword", "Flying Sword Art", "어검술", "archetype", "rare", [hit("attack", [85, 100, 115, 130], 2), boon("priority", 1)], { usesPerAct: 5 }),
  ability(blade, "blade-steal-the-flow", "Steal the Flow", "흐름 빼앗기", "archetype", "epic", [bane("paralyze", 1), boon("priority", 1)], { usesPerAct: 4, consumesTurn: false }),
  ability(blade, "blade-breakthrough", "Breakthrough", "격파", "archetype", "epic", [hit("attack", [205, 250, 295]), bane("vulnerable", [6, 8, 10])], { usesPerAct: 4 }),
  ability(blade, "blade-mountain-of-blades", "Mountain of Blades", "도산검림", "archetype", "epic", [hit("attack", [48, 62, 76], 4)], { usesPerAct: 4 }),
  ability(blade, "blade-selfless-state", "Selfless State", "무아지경", "archetype", "legendary", [boon("evade", 2), boon("haste", 1), boon("unstoppable", 2)], { usesPerAct: 3, consumesTurn: false }),
  ability(blade, "blade-latent-power", "Latent Power", "잠력 폭발", "archetype", "legendary", [boon("overload", [35, 50]), boon("priority", 1)], { usesPerAct: 3, consumesTurn: false }),
  ability(blade, "blade-instant-kill", "Instant-Kill Sword", "즉살검", "archetype", "legendary", [missingEnemy([35, 50]), hit("attack", [120, 160])], { usesPerAct: 2 }),
  ability(blade, "blade-flowing-water", "Flowing-Water Sword", "유수검", "archetype", "mythical", [ward("attack", [330, 440]), hit("attack", [220, 300])], { usesPerAct: 2 }),
  ability(blade, "blade-inversion", "Inversion", "반전", "archetype", "mythical", [consume("vulnerable", 99), boon("strength", 20), boon("priority", 2)], { usesPerAct: 1, consumesTurn: false }),

  // Desolate Vampire.
  ability(vampire, "vampire-bite", "Bite", "물어뜯기", "basic-attack", "uncommon", [hit("attack", [95, 110, 125, 140, 155]), heal("attack", [45, 50, 55, 60, 65])]),
  ability(vampire, "vampire-sever", "Sever", "절단", "basic-attack", "uncommon", [hit("attack", [112, 130, 148, 166, 184]), scaledBane("bleed", "attack", [30, 35, 40, 45, 50])]),
  ability(vampire, "vampire-mist-form", "Mist Form", "안개화", "defensive", "uncommon", [boon("evade", 1), boon("conceal", 1)], { usesPerAct: 16, cooldown: 2 }),
  ability(vampire, "vampire-blood-whirlwind", "Blood Whirlwind", "피의 회오리", "defensive", "uncommon", [ward("attack", [155, 180, 205, 230, 255]), hit("attack", [55, 65, 75, 85, 95], 2)], { usesPerAct: 20 }),
  ability(vampire, "vampire-transformation", "Transformation", "변신", "archetype", "uncommon", [boon("strength", [5, 6, 7, 8, 9]), boon("lifesteal", [5, 6, 7, 8, 9])], { usesPerAct: 6, consumesTurn: false }),
  ability(vampire, "vampire-super-regeneration", "Super Regeneration", "초재생", "archetype", "uncommon", [healLost([25, 30, 35, 40, 45])], { usesPerAct: 7 }),
  ability(vampire, "vampire-blood-hunger", "Blood Hunger", "피의 굶주림", "archetype", "rare", [boon("lifesteal", [12, 15, 18, 21]), boon("strength", [4, 5, 6, 7])], { usesPerAct: 5, consumesTurn: false }),
  ability(vampire, "vampire-backflow", "Backflow", "역류", "archetype", "rare", [cleanse(["bleed", "poison"], 0), heal("attack", [80, 100, 120, 140])], { usesPerAct: 5 }),
  ability(vampire, "vampire-soul-scream", "Soul Scream", "영혼의 절규", "archetype", "rare", [bane("paralyze", 1), bane("weak", [4, 5, 6, 7])], { usesPerAct: 5 }),
  ability(vampire, "vampire-blood-barrier", "Blood Barrier", "피의 결계", "archetype", "rare", [ward("max-hp", [20, 23, 26, 29]), boon("thorn", [5, 6, 7, 8])], { usesPerAct: 5 }),
  ability(vampire, "vampire-blood-spear", "Blood Spear", "피의 창", "archetype", "epic", [hit("attack", [190, 230, 270]), scaledBane("bleed", "attack", [70, 90, 110])], { usesPerAct: 4 }),
  ability(vampire, "vampire-awakening", "Awakening", "각성", "archetype", "epic", [boon("strength", [10, 14, 18]), boon("haste", 1)], { usesPerAct: 4, consumesTurn: false }),
  ability(vampire, "vampire-endless-will", "Endless Will", "끝 모를 의지", "archetype", "epic", [boon("unstoppable", [3, 4, 5]), healLost([20, 25, 30])], { usesPerAct: 4, consumesTurn: false }),
  ability(vampire, "vampire-tear-wound", "Tear Wound", "상처 찢기", "archetype", "legendary", [amplify(["bleed"], [175, 225]), hit("attack", [120, 160])], { usesPerAct: 3 }),
  ability(vampire, "vampire-cruel-touch", "Cruel Touch", "잔혹한 손길", "archetype", "legendary", [missingEnemy([30, 40]), heal("attack", [70, 95])], { usesPerAct: 3 }),
  ability(vampire, "vampire-rain-of-death", "Rain of Death", "죽음의 비", "archetype", "legendary", [hit("attack", [44, 60], 5), scaledBane("bleed", "attack", [100, 140])], { usesPerAct: 3 }),
  ability(vampire, "vampire-devour", "Devour", "포식", "archetype", "mythical", [missingEnemy([45, 60]), healLost([45, 60])], { usesPerAct: 2 }),
  ability(vampire, "vampire-ancestral-blood", "Ancestral Blood", "선조의 피", "archetype", "mythical", [boon("strength", 25), boon("lifesteal", 30), boon("invincible", 1)], { usesPerAct: 1, consumesTurn: false }),

  // Forsaken Automaton.
  ability(automaton, "automaton-pulverizing-cannon", "Pulverizing Cannon", "파쇄포", "basic-attack", "uncommon", [hit("attack", [125, 145, 165, 185, 205]), bane("vulnerable", [2, 3, 4, 5, 6])]),
  ability(automaton, "automaton-impact-cannon", "Impact Cannon", "충격포", "basic-attack", "uncommon", [hit("attack", [92, 107, 122, 137, 152]), bane("stun", 1)]),
  ability(automaton, "automaton-interception", "Interception", "요격", "defensive", "uncommon", [ward("attack", [205, 235, 265, 295, 325]), hit("attack", [65, 75, 85, 95, 105])], { usesPerAct: 22 }),
  ability(automaton, "automaton-force-field", "Deploy Force Field", "역장 전개", "defensive", "uncommon", [ward("defense", [240, 280, 320, 360, 400]), boon("protection", [4, 5, 6, 7, 8])], { usesPerAct: 20 }),
  ability(automaton, "automaton-heat-emission", "Heat Emission", "열기 방출", "archetype", "uncommon", [cleanse(["limp"], 50), scaledBane("burn", "attack", [50, 60, 70, 80, 90])], { usesPerAct: 7, consumesTurn: false }),
  ability(automaton, "automaton-shock-grenade", "Shock Grenade Toss", "충격탄 투척", "archetype", "uncommon", [bane("paralyze", [1, 1, 2, 2, 3]), bane("doom", [20, 25, 30, 35, 40])], { usesPerAct: 7 }),
  ability(automaton, "automaton-barrel-cooling", "Barrel Cooling", "포신 냉각", "archetype", "rare", [cleanse(["limp"], 25), boon("solidity", [1, 1, 2, 2])], { usesPerAct: 5, consumesTurn: false }),
  ability(automaton, "automaton-attack-stance", "Attack Stance", "공격 태세", "archetype", "rare", [boon("strength", [7, 9, 11, 13]), boon("overload", [8, 10, 12, 14])], { usesPerAct: 5, consumesTurn: false }),
  ability(automaton, "automaton-chain-cannon", "Chain Cannon", "사슬포", "archetype", "rare", [hit("attack", [47, 57, 67, 77], 3), bane("paralyze", 1)], { usesPerAct: 6 }),
  ability(automaton, "automaton-flash", "Flash", "섬광", "archetype", "rare", [boon("priority", [1, 1, 2, 2]), bane("weak", [2, 3, 4, 5])], { usesPerAct: 5, consumesTurn: false }),
  ability(automaton, "automaton-electromagnetic-field", "Electromagnetic Field", "전자기장", "archetype", "epic", [bane("paralyze", 2), ward("defense", [180, 220, 260])], { usesPerAct: 4, cooldown: 4 }),
  ability(automaton, "automaton-precision-analysis", "Precision Analysis", "정밀 분석", "archetype", "epic", [boon("sharpen", [20, 28, 36]), bane("vulnerable", [5, 7, 9])], { usesPerAct: 4, consumesTurn: false }),
  ability(automaton, "automaton-aim-correction", "Aim Correction", "조준 보정", "archetype", "epic", [boon("focus", [25, 35, 45]), boon("strength", [4, 6, 8])], { usesPerAct: 4, consumesTurn: false }),
  ability(automaton, "automaton-rapid-acceleration", "Rapid Acceleration", "급가속", "archetype", "legendary", [boon("haste", 2), boon("priority", 1), boon("limp", [5, 7])], { usesPerAct: 3, consumesTurn: false }),
  ability(automaton, "automaton-emergency-fuel", "Emergency Fuel", "비상 연료", "archetype", "legendary", [boon("overload", [35, 50]), healLost([25, 35]), boon("limp", [5, 7])], { usesPerAct: 3, consumesTurn: false }),
  ability(automaton, "automaton-crossfire", "Crossfire", "십자 포화", "archetype", "legendary", [hit("attack", [58, 78], 4)], { usesPerAct: 3 }),
  ability(automaton, "automaton-scorched-earth", "Scorched Earth", "초토화", "archetype", "mythical", [hit("attack", [90, 120], 3), scaledBane("burn", "attack", [160, 220])], { usesPerAct: 2 }),
  ability(automaton, "automaton-infinite-power", "Infinite Power", "무한 동력", "archetype", "mythical", [boon("haste", 3), boon("overload", 60), boon("limp", 15)], { usesPerAct: 1, consumesTurn: false }),
]);

export function extraCharacterAbilitySpecsFor(characterId) {
  return EXTRA_CHARACTER_ABILITY_SPECS.filter((definition) => definition.characterId === characterId);
}
