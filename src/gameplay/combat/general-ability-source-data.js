// Reviewed translation of the pinned Namu General-active source capture.
//
// Source mechanics are preserved per rarity. The only global adaptation is scarcity:
// source per-Act uses become the explicit Resolve costs below because Solitaire has no Act
// boundary. A use-only promotion lowers Resolve by one each tier; effect-changing promotions
// retain a stable price unless the source use row itself changes. This table is the independent
// authority for General tiers; skills.js compiles it rather than inventing rank extension.

export const COMBAT_GENERAL_SOURCE_CAPTURE = Object.freeze({
  url: "https://namu.wiki/w/%EA%B2%A8%EC%9A%B8%EC%9D%98%20%ED%83%91#s-11.1",
  retrieved: "2026-08-26",
  artifact: "docs/design/evidence/combat-general-active-2026-08-26.md",
  rawRowsSha256: "8594d5cc52b2f78b08637ed339d6b97b70e4e6dc705923df61813fda30f9f168",
});

function row({
  id,
  name,
  sourceName,
  sourceLine,
  rarity,
  consumesTurn = true,
  cooldown = 0,
  usesByRank,
  resolveCostByRank,
  effects,
}) {
  return Object.freeze({
    id,
    name,
    sourceName,
    sourceLine,
    rarity,
    consumesTurn,
    cooldown,
    usesByRank: Object.freeze(usesByRank),
    resolveCostByRank: Object.freeze(resolveCostByRank),
    effects: Object.freeze(effects.map((effect) => Object.freeze({
      ...effect,
      ...(effect.values ? { values: Object.freeze(effect.values) } : {}),
      ...(effect.statuses ? { statuses: Object.freeze(effect.statuses) } : {}),
    }))),
  });
}

export const COMBAT_GENERAL_ABILITY_SOURCE_ROWS = Object.freeze([
  row({
    id: "penetration", name: "Penetration", sourceName: "관통 공격", sourceLine: 799, rarity: "uncommon",
    usesByRank: [7, 7, 7, 7, 7], resolveCostByRank: [3, 3, 3, 3, 3],
    effects: [{ type: "scaled-status", status: "doom", target: "enemy", scale: "attack", values: [180, 220, 260, 300, 340] }],
  }),
  row({
    id: "rapid-cooling", name: "Rapid Cooling", sourceName: "급속냉각", sourceLine: 800, rarity: "uncommon", cooldown: 3,
    usesByRank: [5, 6, 7, 8, 9], resolveCostByRank: [7, 6, 5, 4, 3],
    effects: [
      { type: "status", status: "paralyze", target: "enemy", values: [2, 2, 2, 2, 2] },
      { type: "status", status: "solidity", target: "enemy", values: [1, 1, 1, 1, 1] },
    ],
  }),
  row({
    id: "urgent-guard", name: "Urgent Guard", sourceName: "긴급 수비", sourceLine: 801, rarity: "uncommon", consumesTurn: false,
    usesByRank: [7, 7, 7, 7, 7], resolveCostByRank: [3, 3, 3, 3, 3],
    effects: [{ type: "shield", target: "self", scale: "defense", values: [100, 120, 140, 160, 180] }],
  }),
  row({
    id: "stone-skin-elixir", name: "Stone Skin Elixir", sourceName: "돌가죽 영약", sourceLine: 802, rarity: "uncommon", consumesTurn: false,
    usesByRank: [4, 4, 4, 4, 4], resolveCostByRank: [4, 4, 4, 4, 4],
    effects: [{ type: "status", status: "tenacity", target: "self", values: [6, 10, 14, 18, 22] }],
  }),
  row({
    id: "protection-scroll", name: "Protection Scroll", sourceName: "보호 주문서", sourceLine: 803, rarity: "uncommon", consumesTurn: false, cooldown: 6,
    usesByRank: [4, 4, 4, 4, 4], resolveCostByRank: [4, 4, 4, 4, 4],
    effects: [{ type: "status", status: "protection", target: "self", values: [6, 10, 14, 18, 22] }],
  }),
  row({
    id: "elixir-of-wrath", name: "Elixir of Wrath", sourceName: "분노의 영약", sourceLine: 804, rarity: "uncommon", consumesTurn: false, cooldown: 9,
    usesByRank: [3, 3, 3, 3, 3], resolveCostByRank: [4, 4, 4, 4, 4],
    effects: [{ type: "status", status: "strength", target: "self", values: [6, 10, 14, 18, 22] }],
  }),
  row({
    id: "first-aid", name: "First Aid", sourceName: "응급처치", sourceLine: 805, rarity: "uncommon",
    usesByRank: [5, 5, 5, 5, 5], resolveCostByRank: [3, 3, 3, 3, 3],
    effects: [
      { type: "heal-lost-fraction", target: "self", values: [24, 28, 32, 36, 40] },
      { type: "reduce-statuses", target: "self", statuses: ["bleed", "burn", "poison"], toPercent: 60 },
    ],
  }),
  row({
    id: "emergency-evasion", name: "Emergency Evasion", sourceName: "긴급 회피", sourceLine: 806, rarity: "rare", consumesTurn: false,
    usesByRank: [4, 5, 6, 7], resolveCostByRank: [6, 5, 4, 3],
    effects: [{ type: "status", status: "evade", target: "self", values: [1, 1, 1, 1] }],
  }),
  row({
    id: "sudden-blow", name: "Sudden Blow", sourceName: "돌발 일격", sourceLine: 807, rarity: "rare", consumesTurn: false,
    usesByRank: [6, 6, 6, 6], resolveCostByRank: [3, 3, 3, 3],
    effects: [{ type: "damage", target: "enemy", scale: "attack", values: [80, 100, 120, 140] }],
  }),
  row({
    id: "unbendable-will", name: "Unbendable Will", sourceName: "불굴의 의지", sourceLine: 808, rarity: "rare", consumesTurn: false,
    usesByRank: [4, 5, 6, 7], resolveCostByRank: [6, 5, 4, 3],
    effects: [{ type: "status", status: "unstoppable", target: "self", values: [4, 4, 4, 4] }],
  }),
  row({
    id: "killing-instinct", name: "Killing Instinct", sourceName: "살육 본능", sourceLine: 809, rarity: "rare", cooldown: 7,
    usesByRank: [4, 4, 4, 4], resolveCostByRank: [4, 4, 4, 4],
    effects: [{ type: "status", status: "focus", target: "self", values: [20, 30, 40, 50] }],
  }),
  row({
    id: "sleep-grenade", name: "Sleep Grenade Toss", sourceName: "수면탄 투척", sourceLine: 810, rarity: "rare", cooldown: 6,
    usesByRank: [4, 5, 6, 7], resolveCostByRank: [6, 5, 4, 3],
    effects: [{ type: "status", status: "sleep", target: "enemy", values: [3, 3, 3, 3] }],
  }),
  row({
    id: "blade-of-curse", name: "Blade of Curse", sourceName: "저주의 칼날", sourceLine: 811, rarity: "rare", cooldown: 8,
    usesByRank: [3, 3, 3, 3], resolveCostByRank: [4, 4, 4, 4],
    effects: [{ type: "status", status: "lethargy-atk", target: "self", values: [6, 9, 12, 15] }],
  }),
  row({
    id: "beastification", name: "Beastification", sourceName: "야수화", sourceLine: 812, rarity: "legendary",
    usesByRank: [1, 1], resolveCostByRank: [6, 6],
    effects: [{ type: "scaled-status", status: "grow", target: "self", scale: "current-hp", values: [45, 65] }],
  }),
  row({
    id: "judge-of-fate", name: "Judge of Fate", sourceName: "운명의 심판", sourceLine: 813, rarity: "legendary", cooldown: 5,
    usesByRank: [2, 3], resolveCostByRank: [5, 4],
    effects: [{ type: "scaled-status-enemy-lost-hp", status: "misfortune", target: "enemy", values: [30, 30] }],
  }),
  row({
    id: "super-speed", name: "Super Speed", sourceName: "초신속", sourceLine: 814, rarity: "legendary", consumesTurn: false,
    usesByRank: [1, 1], resolveCostByRank: [6, 6],
    effects: [{ type: "status", status: "haste", target: "self", values: [2, 3] }],
  }),
  row({
    id: "transcendence", name: "Transcendence", sourceName: "초월", sourceLine: 815, rarity: "legendary",
    usesByRank: [1, 1], resolveCostByRank: [6, 6],
    effects: [
      { type: "status", status: "strength", target: "self", values: [8, 12] },
      { type: "status", status: "tenacity", target: "self", values: [8, 12] },
      { type: "status", status: "focus", target: "self", values: [20, 30] },
    ],
  }),
  row({
    id: "peace-declaration", name: "Peace Declaration", sourceName: "평화선언", sourceLine: 816, rarity: "legendary", cooldown: 5,
    usesByRank: [2, 3], resolveCostByRank: [5, 4],
    effects: [{ type: "status", status: "paralyze", target: "all", values: [3, 3] }],
  }),
]);

export const COMBAT_GENERAL_ABILITY_SOURCE_BY_ID = Object.freeze(Object.fromEntries(
  COMBAT_GENERAL_ABILITY_SOURCE_ROWS.map((definition) => [definition.id, definition]),
));
