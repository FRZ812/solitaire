// Explicit opt-in party catalogue for solitaire-combat-v2.
//
// This module intentionally imports no v1 ability/profile adapter. Stable source ids and
// names are preserved as authored evidence, while every v2 cost, target, rank table,
// recipient, movement, and zone is written literally against `ability-rules-v2.js`.

import {
  COMBAT_ABILITY_RULESET_V2_ID,
  COMBAT_ABILITY_RULES_V2_VERSION,
  defineAbilityRulesV2,
  defineZoneRulesV2,
  defineZoneRulesV2Registry,
} from "./ability-rules-v2.js";
import {
  defineStatusRulesV2,
  defineStatusRulesV2Registry,
  validateAbilityRuleReferencesV2,
  validateZoneStatusReferencesV2,
} from "./status-rules-v2.js";

export const COMBAT_ABILITY_CATALOG_V2_VERSION = 1;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function effect({
  primitive,
  operation,
  recipient,
  byRank,
  unit = "flat",
  basis = "none",
  scalesFrom = null,
  subject = null,
  motion = null,
}) {
  return {
    primitive,
    operation,
    recipient,
    scalesFrom,
    subject,
    motion,
    value: { unit, basis, byRank },
  };
}

function authoredAbility(value) {
  return defineAbilityRulesV2({
    version: COMBAT_ABILITY_RULES_V2_VERSION,
    rulesetId: COMBAT_ABILITY_RULESET_V2_ID,
    ...value,
  });
}

function authoredZone(value) {
  return defineZoneRulesV2({
    version: COMBAT_ABILITY_RULES_V2_VERSION,
    rulesetId: COMBAT_ABILITY_RULESET_V2_ID,
    ...value,
  });
}

function authoredStatus(value) {
  return defineStatusRulesV2({
    version: COMBAT_ABILITY_RULES_V2_VERSION,
    rulesetId: COMBAT_ABILITY_RULESET_V2_ID,
    ...value,
  });
}

// Event-spent statuses deliberately have no clock decay here. Their mandatory typed runtime
// resolver owns hit, attack, or command consumption and drives the stack to zero; assigning a
// turn clock would silently reinterpret the sourced lifecycle before that resolver exists.
const AUTHORED_STATUSES_V2 = Object.freeze([
  authoredStatus({
    id: "blade-dance-parry",
    provenance: "none",
    duration: { clock: "recipient-turn-end", count: 2 },
    decay: { timing: "none", stacks: 0 },
    expiry: "duration-end",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "defense",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "bleed",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "harmful",
    category: "damage",
    behavior: "periodic-damage",
  }),
  authoredStatus({
    id: "bone-shield",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "defense",
    behavior: "damage-redirect",
  }),
  authoredStatus({
    id: "burn",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "harmful",
    category: "damage",
    behavior: "periodic-damage",
  }),
  authoredStatus({
    id: "challenged",
    provenance: "source-actor",
    duration: { clock: "recipient-turn-end", count: 1 },
    decay: { timing: "none", stacks: 0 },
    expiry: "duration-end",
    stacking: { policy: "replace", cap: 1 },
    polarity: "harmful",
    category: "targeting",
    behavior: "forced-target",
  }),
  authoredStatus({
    id: "cripple",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "harmful",
    category: "offense",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "doom",
    provenance: "none",
    duration: { clock: "recipient-turn-end", count: 1 },
    decay: { timing: "none", stacks: 0 },
    expiry: "duration-end",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "harmful",
    category: "damage",
    behavior: "periodic-damage",
  }),
  authoredStatus({
    id: "delayed-lethargy",
    provenance: "none",
    duration: { clock: "recipient-turn-end", count: 2 },
    decay: { timing: "none", stacks: 0 },
    expiry: "duration-end",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "harmful",
    category: "offense",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "evade",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "recipient-turn-end", stacks: 1 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "defense",
    behavior: "avoidance",
  }),
  authoredStatus({
    id: "haste",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "recipient-turn-end", stacks: 1 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "tempo",
    behavior: "resource-counter",
  }),
  authoredStatus({
    id: "initiative",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "tempo",
    behavior: "resource-counter",
  }),
  authoredStatus({
    id: "injured",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "harmful",
    category: "defense",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "judgment",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "offense",
    behavior: "resource-counter",
  }),
  authoredStatus({
    id: "lethargy",
    provenance: "none",
    duration: { clock: "recipient-turn-end", count: 1 },
    decay: { timing: "none", stacks: 0 },
    expiry: "duration-end",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "harmful",
    category: "offense",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "lifesteal",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "healing",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "limp",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "harmful",
    category: "mobility",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "mirror-image",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "recipient-turn-end", stacks: 1 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "defense",
    behavior: "avoidance",
  }),
  authoredStatus({
    id: "paralyze",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "harmful",
    category: "control",
    behavior: "action-lock",
  }),
  authoredStatus({
    id: "parry",
    provenance: "none",
    duration: { clock: "recipient-turn-end", count: 1 },
    decay: { timing: "none", stacks: 0 },
    expiry: "duration-end",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "defense",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "poison",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "recipient-turn-end", stacks: 1 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "harmful",
    category: "damage",
    behavior: "periodic-damage",
  }),
  authoredStatus({
    id: "predator",
    provenance: "none",
    duration: { clock: "recipient-turn-end", count: 1 },
    decay: { timing: "none", stacks: 0 },
    expiry: "duration-end",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "healing",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "protection",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "defense",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "restraint",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "recipient-turn-end", stacks: 1 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "harmful",
    category: "mobility",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "sharpen",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "offense",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "skeleton",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "summon",
    behavior: "summon-counter",
  }),
  authoredStatus({
    id: "solidity",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "defense",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "strength",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "offense",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "stun",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "harmful",
    category: "control",
    behavior: "action-lock",
  }),
  authoredStatus({
    id: "tenacity",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "defense",
    behavior: "stat-modifier",
  }),
  authoredStatus({
    id: "thorn",
    provenance: "none",
    duration: { clock: "encounter", count: null },
    decay: { timing: "none", stacks: 0 },
    expiry: "at-zero",
    stacking: { policy: "add", cap: 1_000_000 },
    polarity: "beneficial",
    category: "defense",
    behavior: "marker",
  }),
]);

export const COMBAT_ABILITY_STATUSES_V2 = defineStatusRulesV2Registry(AUTHORED_STATUSES_V2);
export const COMBAT_ABILITY_STATUS_LIST_V2 = deepFreeze(Object.values(COMBAT_ABILITY_STATUSES_V2));

const AUTHORED_ZONES_V2 = Object.freeze([
  authoredZone({
    id: "ranger-snare",
    rankCount: 2,
    movementPolicy: "block-exit",
    timing: { trigger: "enter", tick: "after-enter" },
    stacking: { policy: "refresh-duration", cap: null },
    payload: {
      primitive: "status",
      operation: "add",
      recipient: "enemy-occupants",
      scalesFrom: null,
      subject: "restraint",
      potency: { unit: "stacks", basis: "none", byRank: [1, 1] },
    },
  }),
  authoredZone({
    id: "artificer-reinforced-field",
    rankCount: 4,
    movementPolicy: "none",
    timing: { trigger: "occupant-turn", tick: "start" },
    stacking: { policy: "refresh-duration", cap: null },
    payload: {
      primitive: "status",
      operation: "add",
      recipient: "allied-occupants",
      scalesFrom: "caster",
      subject: "protection",
      potency: { unit: "percent", basis: "defense", byRank: [50, 60, 70, 80] },
    },
  }),
  authoredZone({
    id: "sorcerer-binding-growth",
    rankCount: 4,
    movementPolicy: "block-exit",
    timing: { trigger: "enter", tick: "after-enter" },
    stacking: { policy: "refresh-duration", cap: null },
    payload: {
      primitive: "status",
      operation: "add",
      recipient: "enemy-occupants",
      scalesFrom: null,
      subject: "restraint",
      potency: { unit: "stacks", basis: "none", byRank: [1, 1, 1, 1] },
    },
  }),
  authoredZone({
    id: "sorcerer-water-sigil",
    rankCount: 4,
    movementPolicy: "none",
    timing: { trigger: "occupant-turn", tick: "start" },
    stacking: { policy: "refresh-duration", cap: null },
    payload: {
      primitive: "status",
      operation: "add",
      recipient: "allied-occupants",
      scalesFrom: null,
      subject: "tenacity",
      potency: { unit: "stacks", basis: "none", byRank: [3, 4, 5, 6] },
    },
  }),
  authoredZone({
    id: "wizard-flame-storm",
    rankCount: 4,
    movementPolicy: "none",
    timing: { trigger: "round", tick: "end" },
    stacking: { policy: "refresh-duration", cap: null },
    payload: {
      primitive: "status",
      operation: "add",
      recipient: "enemy-occupants",
      scalesFrom: "caster",
      subject: "burn",
      potency: { unit: "percent", basis: "attack", byRank: [18, 22, 26, 30] },
    },
  }),
  authoredZone({
    id: "paladin-sacred-aegis",
    rankCount: 4,
    movementPolicy: "none",
    timing: { trigger: "occupant-turn", tick: "start" },
    stacking: { policy: "refresh-duration", cap: null },
    payload: {
      primitive: "status",
      operation: "add",
      recipient: "allied-occupants",
      scalesFrom: "caster",
      subject: "protection",
      potency: { unit: "percent", basis: "defense", byRank: [35, 45, 55, 65] },
    },
  }),
  authoredZone({
    id: "automaton-scorched-earth",
    rankCount: 2,
    movementPolicy: "none",
    timing: { trigger: "round", tick: "end" },
    stacking: { policy: "refresh-duration", cap: null },
    payload: {
      primitive: "status",
      operation: "add",
      recipient: "enemy-occupants",
      scalesFrom: null,
      subject: "limp",
      potency: { unit: "stacks", basis: "none", byRank: [8, 12] },
    },
  }),
]);

export const COMBAT_ABILITY_ZONES_V2 = defineZoneRulesV2Registry(AUTHORED_ZONES_V2);

const ZONE_STATUS_REFERENCES_V2 = validateZoneStatusReferencesV2(
  COMBAT_ABILITY_ZONES_V2,
  COMBAT_ABILITY_STATUSES_V2,
);
if (!ZONE_STATUS_REFERENCES_V2.ok) throw new TypeError(ZONE_STATUS_REFERENCES_V2.reason);

const AUTHORED_ABILITIES_V2 = Object.freeze([
  // Knight — vanguard protector.
  authoredAbility({
    id: "arctic-strike",
    rankCount: 6,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [0, 0, 0, 0, 0, 0], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "melee", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "melee", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [100, 115, 130, 145, 160, 175] })],
  }),
  authoredAbility({
    id: "arctic-block",
    rankCount: 6,
    action: { lane: "reaction", reactionWindow: "hostile-targeted-before-effects", reactionWatch: "selected-hostile-target", resolveCostByRank: [1, 1, 1, 1, 1, 1], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "adjacent", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "shield", operation: "grant", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "defense", byRank: [250, 300, 350, 400, 450, 500] })],
  }),
  authoredAbility({
    id: "arctic-threatening-cry",
    rankCount: 5,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [1, 1, 1, 1, 1], cooldownByRank: [1, 1, 1, 1, 1] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "field", tierByRank: ["ability", "ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "lethargy", unit: "percent", basis: "attack", byRank: [60, 70, 80, 90, 100] }),
      effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "challenged", unit: "stacks", byRank: [1, 1, 1, 1, 1] }),
    ],
  }),
  authoredAbility({
    id: "arctic-battle-cry",
    rankCount: 4,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [2, 2, 2, 2], cooldownByRank: [1, 1, 1, 1] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "row" } },
    presentation: { castMode: "support", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "solidity", unit: "stacks", byRank: [3, 4, 5, 6] })],
  }),
  authoredAbility({
    id: "arctic-giants-smash",
    rankCount: 4,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [3, 3, 3, 3], cooldownByRank: [0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "cell", range: "melee", tracking: "cell" }, area: { shape: "cross-short" } },
    presentation: { castMode: "melee", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "recipient", unit: "percent", basis: "max-hp", byRank: [13, 16, 19, 22] }),
      effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "stun", unit: "stacks", byRank: [1, 1, 1, 1] }),
      effect({ primitive: "push", operation: "push", recipient: "selected-units", motion: "source-target-vector", unit: "cells", byRank: [1, 1, 1, 1] }),
    ],
  }),

  // Ranger — marksman and area denial.
  authoredAbility({
    id: "demon-shoot",
    rankCount: 6,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [0, 0, 0, 0, 0, 0], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "projectile", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [100, 115, 130, 145, 160, 175] })],
  }),
  authoredAbility({
    id: "demon-evasion",
    rankCount: 6,
    action: { lane: "reaction", reactionWindow: "hostile-targeted-before-effects", reactionWatch: "selected-hostile-target", resolveCostByRank: [1, 1, 1, 1, 1, 1], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "self", includeCaster: true, anchor: { shape: "caster", range: "self", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "caster", subject: "evade", unit: "stacks", byRank: [1, 1, 1, 1, 1, 1] }),
      effect({ primitive: "shield", operation: "grant", recipient: "caster", scalesFrom: "caster", unit: "percent", basis: "defense", byRank: [220, 250, 280, 310, 340, 370] }),
    ],
  }),
  authoredAbility({
    id: "demon-eagle-eye",
    rankCount: 4,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [1, 1, 1, 1], cooldownByRank: [9, 9, 9, 9] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "sharpen", unit: "stacks", byRank: [30, 40, 50, 60] })],
  }),
  authoredAbility({
    id: "demon-trackers-net",
    rankCount: 2,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [2, 2], cooldownByRank: [6, 6] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "cross-short" } },
    presentation: { castMode: "projectile", tierByRank: ["ability", "mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "cripple", unit: "percent", basis: "defense", byRank: [20, 30] }),
      effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "paralyze", unit: "stacks", byRank: [1, 1] }),
      effect({ primitive: "zone", operation: "create", recipient: "selected-cells", subject: "ranger-snare", unit: "rounds", byRank: [2, 2] }),
    ],
  }),
  authoredAbility({
    id: "demon-arrow-rain",
    rankCount: 2,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [4, 4], cooldownByRank: [0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "cell", range: "global", tracking: "cell" }, area: { shape: "all" } },
    presentation: { castMode: "field", tierByRank: ["ability", "mythical"] },
    effects: [
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [35, 50] }),
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [35, 50] }),
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [35, 50] }),
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [35, 50] }),
    ],
  }),

  // Artificer — field engineer and tactical support.
  authoredAbility({
    id: "artificer-fire",
    rankCount: 6,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [0, 0, 0, 0, 0, 0], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "projectile", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [100, 115, 130, 145, 160, 175] })],
  }),
  authoredAbility({
    id: "artificer-suppressive-shot",
    rankCount: 6,
    action: { lane: "reaction", reactionWindow: "hostile-main-before-effects", reactionWatch: "selected-hostile-source", resolveCostByRank: [1, 1, 1, 1, 1, 1], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "projectile", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "lethargy", unit: "percent", basis: "defense", byRank: [125, 150, 175, 200, 225, 250] })],
  }),
  authoredAbility({
    id: "artificer-grappling-hook",
    rankCount: 5,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [1, 1, 1, 1, 1], cooldownByRank: [1, 1, 1, 1, 1] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "projectile", tierByRank: ["ability", "ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "paralyze", unit: "stacks", byRank: [1, 2, 2, 3, 3] }),
      effect({ primitive: "pull", operation: "pull", recipient: "selected-units", motion: "source-target-vector", unit: "cells", byRank: [1, 1, 2, 2, 3] }),
    ],
  }),
  authoredAbility({
    id: "artificer-tailored-drink",
    rankCount: 4,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [2, 2, 2, 2], cooldownByRank: [0, 0, 0, 0] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "haste", unit: "stacks", byRank: [1, 1, 1, 1] }),
      effect({ primitive: "heal", operation: "restore", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "defense", byRank: [60, 75, 90, 105] }),
    ],
  }),
  authoredAbility({
    id: "artificer-ultra-barrier",
    rankCount: 4,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [3, 3, 3, 3], cooldownByRank: [9, 9, 9, 9] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "cross-full" } },
    presentation: { castMode: "support", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "protection", unit: "percent", basis: "defense", byRank: [50, 60, 70, 80] }),
      effect({ primitive: "zone", operation: "create", recipient: "selected-cells", subject: "artificer-reinforced-field", unit: "rounds", byRank: [2, 2, 3, 3] }),
    ],
  }),

  // Berserker — cleaving bruiser and attrition cleanser.
  authoredAbility({
    id: "north-king-cleave",
    rankCount: 6,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [0, 0, 0, 0, 0, 0], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "melee", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "melee", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [100, 115, 130, 145, 160, 175] })],
  }),
  authoredAbility({
    id: "north-king-vitality",
    rankCount: 6,
    action: { lane: "reaction", reactionWindow: "hostile-targeted-after-effects", reactionWatch: "selected-hostile-target", resolveCostByRank: [1, 1, 1, 1, 1, 1], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "self", includeCaster: true, anchor: { shape: "caster", range: "self", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "heal", operation: "restore", recipient: "caster", scalesFrom: "caster", unit: "percent", basis: "defense", byRank: [185, 220, 255, 290, 325, 360] })],
  }),
  authoredAbility({
    id: "north-king-whirlwind",
    rankCount: 4,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [2, 2, 2, 2], cooldownByRank: [0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "cell", range: "melee", tracking: "cell" }, area: { shape: "row" } },
    presentation: { castMode: "melee", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [210, 240, 270, 300] }),
      effect({ primitive: "status", operation: "add", recipient: "caster", subject: "delayed-lethargy", unit: "stacks", byRank: [15, 20, 25, 30] }),
    ],
  }),
  authoredAbility({
    id: "north-king-warriors-oath",
    rankCount: 4,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [1, 1, 1, 0], cooldownByRank: [1, 1, 1, 1] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "cleanse", operation: "clear", recipient: "selected-units", subject: "lethargy", unit: "flat", byRank: [0, 0, 0, 0] }),
      effect({ primitive: "cleanse", operation: "clear", recipient: "selected-units", subject: "delayed-lethargy", unit: "flat", byRank: [0, 0, 0, 0] }),
      effect({ primitive: "cleanse", operation: "clear", recipient: "selected-units", subject: "cripple", unit: "flat", byRank: [0, 0, 0, 0] }),
      effect({ primitive: "cleanse", operation: "clear", recipient: "selected-units", subject: "injured", unit: "flat", byRank: [0, 0, 0, 0] }),
      effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "tenacity", unit: "stacks", byRank: [1, 2, 3, 4] }),
    ],
  }),
  authoredAbility({
    id: "north-king-earthquake",
    rankCount: 1,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [5], cooldownByRank: [0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "cell", range: "global", tracking: "cell" }, area: { shape: "all" } },
    presentation: { castMode: "field", tierByRank: ["mythical"] },
    effects: [
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [400] }),
      effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "lethargy", unit: "percent", basis: "defense", byRank: [400] }),
      effect({ primitive: "push", operation: "push", recipient: "selected-units", motion: "source-target-vector", unit: "cells", byRank: [1] }),
    ],
  }),

  // Sorcerer — elemental zone controller.
  authoredAbility({
    id: "sleepless-swing",
    rankCount: 6,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [0, 0, 0, 0, 0, 0], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "projectile", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [100, 115, 130, 145, 160, 175] })],
  }),
  authoredAbility({
    id: "sleepless-hard-scales",
    rankCount: 6,
    action: { lane: "reaction", reactionWindow: "hostile-targeted-before-effects", reactionWatch: "selected-hostile-target", resolveCostByRank: [1, 1, 1, 1, 1, 1], cooldownByRank: [1, 1, 1, 1, 1, 1] },
    targeting: { side: "self", includeCaster: true, anchor: { shape: "caster", range: "self", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [
      effect({ primitive: "shield", operation: "grant", recipient: "caster", scalesFrom: "caster", unit: "percent", basis: "defense", byRank: [50, 75, 100, 125, 150, 175] }),
      effect({ primitive: "status", operation: "add", recipient: "caster", subject: "solidity", unit: "stacks", byRank: [1, 1, 1, 1, 1, 1] }),
    ],
  }),
  authoredAbility({
    id: "sleepless-entangling-roots",
    rankCount: 4,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [2, 2, 2, 2], cooldownByRank: [5, 5, 5, 5] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "cross-short" } },
    presentation: { castMode: "field", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "paralyze", unit: "stacks", byRank: [1, 1, 1, 1] }),
      effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "poison", unit: "stacks", byRank: [10, 15, 20, 25] }),
      effect({ primitive: "zone", operation: "create", recipient: "selected-cells", subject: "sorcerer-binding-growth", unit: "rounds", byRank: [2, 2, 2, 2] }),
    ],
  }),
  authoredAbility({
    id: "sleepless-water-totem",
    rankCount: 4,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [2, 2, 2, 2], cooldownByRank: [1, 1, 1, 1] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "cross-full" } },
    presentation: { castMode: "support", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "tenacity", unit: "stacks", byRank: [3, 4, 5, 6] }),
      effect({ primitive: "zone", operation: "create", recipient: "selected-cells", subject: "sorcerer-water-sigil", unit: "rounds", byRank: [2, 2, 3, 3] }),
    ],
  }),
  authoredAbility({
    id: "sleepless-fire-dragons-breath",
    rankCount: 2,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [4, 4], cooldownByRank: [7, 7] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "row" } },
    presentation: { castMode: "field", tierByRank: ["ability", "mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "burn", unit: "percent", basis: "attack", byRank: [55, 75] }),
      effect({ primitive: "push", operation: "push", recipient: "selected-units", motion: "source-target-vector", unit: "cells", byRank: [1, 2] }),
    ],
  }),

  // Rogue — mobile disruptor and finisher.
  authoredAbility({
    id: "assassin-flurry",
    rankCount: 6,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [0, 0, 0, 0, 0, 0], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "melee", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "melee", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [50, 57, 64, 71, 78, 85] }),
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [50, 57, 64, 71, 78, 85] }),
    ],
  }),
  authoredAbility({
    id: "assassin-deflect",
    rankCount: 6,
    action: { lane: "reaction", reactionWindow: "hostile-melee-before-effects", reactionWatch: "selected-hostile-target", resolveCostByRank: [1, 1, 1, 1, 1, 1], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "self", includeCaster: true, anchor: { shape: "caster", range: "self", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "status", operation: "add", recipient: "caster", scalesFrom: "caster", subject: "parry", unit: "percent", basis: "defense", byRank: [185, 220, 255, 290, 325, 360] })],
  }),
  authoredAbility({
    id: "assassin-flash-bomb",
    rankCount: 2,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [2, 2], cooldownByRank: [6, 6] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "cross-short" } },
    presentation: { castMode: "field", tierByRank: ["ability", "mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "stun", unit: "stacks", byRank: [2, 3] }),
      effect({ primitive: "move", operation: "move", recipient: "caster", motion: "away-from-anchor", unit: "cells", byRank: [1, 2] }),
    ],
  }),
  authoredAbility({
    id: "assassin-cold-blood",
    rankCount: 2,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [1, 0], cooldownByRank: [0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "melee", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "melee", tierByRank: ["ability", "mythical"] },
    effects: [effect({ primitive: "cleanse", operation: "clear", recipient: "selected-units", subject: "protection", unit: "flat", byRank: [0, 0] })],
  }),
  authoredAbility({
    id: "assassin-execution",
    rankCount: 2,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [4, 4], cooldownByRank: [0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "melee", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "melee", tierByRank: ["ability", "mythical"] },
    effects: [
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [240, 360] }),
      effect({ primitive: "status", operation: "scale", recipient: "selected-units", subject: "limp", unit: "percent", byRank: [0, 0] }),
    ],
  }),

  // Warlock — summon pressure and defensive illusion support.
  authoredAbility({
    id: "witch-attack",
    rankCount: 6,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [0, 0, 0, 0, 0, 0], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "projectile", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [100, 115, 130, 145, 160, 175] })],
  }),
  authoredAbility({
    id: "witch-bone-shield",
    rankCount: 6,
    action: { lane: "reaction", reactionWindow: "hostile-targeted-before-effects", reactionWatch: "selected-hostile-target", resolveCostByRank: [1, 1, 1, 1, 1, 1], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [
      effect({ primitive: "shield", operation: "grant", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "defense", byRank: [50, 80, 110, 140, 170, 200] }),
      effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "bone-shield", unit: "stacks", byRank: [2, 2, 2, 2, 2, 2] }),
    ],
  }),
  authoredAbility({
    id: "witch-skeleton-summon",
    rankCount: 5,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [2, 2, 2, 2, 2], cooldownByRank: [0, 0, 0, 0, 0] },
    targeting: { side: "self", includeCaster: true, anchor: { shape: "caster", range: "self", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["ability", "ability", "ability", "ability", "mythical"] },
    effects: [effect({ primitive: "status", operation: "add", recipient: "caster", subject: "skeleton", unit: "stacks", byRank: [12, 15, 18, 21, 24] })],
  }),
  authoredAbility({
    id: "witch-all-out-attack",
    rankCount: 2,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [3, 3], cooldownByRank: [9, 9] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "row" } },
    presentation: { castMode: "field", tierByRank: ["ability", "mythical"] },
    effects: [
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [40, 52] }),
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [40, 52] }),
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [40, 52] }),
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [40, 52] }),
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [40, 52] }),
    ],
  }),
  authoredAbility({
    id: "witch-mirror-image",
    rankCount: 2,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [2, 2], cooldownByRank: [1, 1] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["ability", "mythical"] },
    effects: [effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "mirror-image", unit: "stacks", byRank: [3, 5] })],
  }),

  // Wizard — artillery and precision amplification.
  authoredAbility({
    id: "mage-magic-arrow",
    rankCount: 6,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [0, 0, 0, 0, 0, 0], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "projectile", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [100, 115, 130, 145, 160, 175] })],
  }),
  authoredAbility({
    id: "mage-barrier",
    rankCount: 6,
    action: { lane: "reaction", reactionWindow: "hostile-targeted-before-effects", reactionWatch: "selected-hostile-target", resolveCostByRank: [1, 1, 1, 1, 1, 1], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [
      effect({ primitive: "shield", operation: "grant", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "defense", byRank: [200, 245, 290, 335, 380, 425] }),
      effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "protection", unit: "stacks", byRank: [4, 4, 4, 4, 4, 4] }),
    ],
  }),
  authoredAbility({
    id: "mage-flame-storm",
    rankCount: 4,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [3, 3, 3, 3], cooldownByRank: [0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "cell", range: "global", tracking: "cell" }, area: { shape: "all" } },
    presentation: { castMode: "field", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "lethargy", unit: "percent", basis: "attack", byRank: [36, 44, 52, 60] }),
      effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "burn", unit: "percent", basis: "attack", byRank: [36, 44, 52, 60] }),
      effect({ primitive: "zone", operation: "create", recipient: "selected-cells", subject: "wizard-flame-storm", unit: "rounds", byRank: [1, 1, 1, 1] }),
    ],
  }),
  authoredAbility({
    id: "mage-amplification",
    rankCount: 1,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [2], cooldownByRank: [0] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["mythical"] },
    effects: [effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "strength", unit: "percent", basis: "attack", byRank: [50] })],
  }),
  authoredAbility({
    id: "mage-god-slaying-spear",
    rankCount: 2,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [4, 4], cooldownByRank: [0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "column" } },
    presentation: { castMode: "projectile", tierByRank: ["ability", "mythical"] },
    effects: [
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [120, 180] }),
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [120, 180] }),
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [120, 180] }),
    ],
  }),

  // Paladin — healer, cleanser, and formation guardian.
  authoredAbility({
    id: "priestess-crush",
    rankCount: 6,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [0, 0, 0, 0, 0, 0], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "melee", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "melee", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [100, 115, 130, 145, 160, 175] })],
  }),
  authoredAbility({
    id: "priestess-block",
    rankCount: 6,
    action: { lane: "reaction", reactionWindow: "hostile-targeted-before-effects", reactionWatch: "selected-hostile-target", resolveCostByRank: [1, 1, 1, 1, 1, 1], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "adjacent", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [
      effect({ primitive: "shield", operation: "grant", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "defense", byRank: [190, 220, 250, 280, 310, 340] }),
      effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "judgment", unit: "percent", basis: "defense", byRank: [60, 72, 84, 96, 108, 120] }),
    ],
  }),
  authoredAbility({
    id: "priestess-instant-heal",
    rankCount: 5,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [1, 1, 1, 1, 1], cooldownByRank: [1, 1, 1, 1, 1] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["ability", "ability", "ability", "ability", "mythical"] },
    effects: [effect({ primitive: "heal", operation: "restore", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "defense", byRank: [60, 70, 80, 90, 100] })],
  }),
  authoredAbility({
    id: "priestess-purification",
    rankCount: 4,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [1, 1, 1, 1], cooldownByRank: [1, 1, 1, 1] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "cross-short" } },
    presentation: { castMode: "support", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "cleanse", operation: "retain-percent", recipient: "selected-units", subject: "burn", unit: "percent", byRank: [40, 30, 20, 0] }),
      effect({ primitive: "cleanse", operation: "retain-percent", recipient: "selected-units", subject: "poison", unit: "percent", byRank: [40, 30, 20, 0] }),
      effect({ primitive: "cleanse", operation: "retain-percent", recipient: "selected-units", subject: "bleed", unit: "percent", byRank: [40, 30, 20, 0] }),
    ],
  }),
  authoredAbility({
    id: "priestess-divine-barrier",
    rankCount: 4,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [3, 3, 3, 3], cooldownByRank: [9, 9, 9, 9] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "cross-full" } },
    presentation: { castMode: "support", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "protection", unit: "percent", basis: "defense", byRank: [35, 45, 55, 65] }),
      effect({ primitive: "zone", operation: "create", recipient: "selected-cells", subject: "paladin-sacred-aegis", unit: "rounds", byRank: [2, 2, 3, 3] }),
    ],
  }),

  // Blademaster — counter-tempo support and finisher.
  authoredAbility({
    id: "blade-slash",
    rankCount: 6,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [0, 0, 0, 0, 0, 0], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "melee", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "melee", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [100, 115, 130, 145, 160, 175] })],
  }),
  authoredAbility({
    id: "blade-barrier",
    rankCount: 6,
    action: { lane: "reaction", reactionWindow: "hostile-melee-before-effects", reactionWatch: "selected-hostile-target", resolveCostByRank: [1, 1, 1, 1, 1, 1], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "self", includeCaster: true, anchor: { shape: "caster", range: "self", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [
      effect({ primitive: "shield", operation: "grant", recipient: "caster", scalesFrom: "caster", unit: "percent", basis: "defense", byRank: [180, 210, 240, 270, 300, 330] }),
      effect({ primitive: "status", operation: "add", recipient: "caster", scalesFrom: "caster", subject: "thorn", unit: "percent", basis: "defense", byRank: [16, 20, 24, 28, 32, 36] }),
    ],
  }),
  authoredAbility({
    id: "blade-steal-the-flow",
    rankCount: 4,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [1, 1, 1, 1], cooldownByRank: [5, 5, 5, 5] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "initiative", unit: "stacks", byRank: [60, 75, 90, 105] })],
  }),
  authoredAbility({
    id: "blade-katana-dance",
    rankCount: 4,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [2, 2, 2, 2], cooldownByRank: [0, 0, 0, 0] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "row" } },
    presentation: { castMode: "support", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "blade-dance-parry", unit: "percent", basis: "defense", byRank: [180, 210, 240, 270] }),
      effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "thorn", unit: "percent", basis: "defense", byRank: [20, 25, 30, 35] }),
    ],
  }),
  authoredAbility({
    id: "blade-one-flash",
    rankCount: 1,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [5], cooldownByRank: [0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "melee", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "melee", tierByRank: ["mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "doom", unit: "percent", basis: "attack", byRank: [1000] }),
      effect({ primitive: "move", operation: "move", recipient: "caster", motion: "nearest-empty-same-row", unit: "cells", byRank: [1] }),
    ],
  }),

  // Vampire — drain bruiser and blood-support off-healer.
  authoredAbility({
    id: "vampire-claw",
    rankCount: 6,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [0, 0, 0, 0, 0, 0], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "melee", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "melee", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [100, 115, 130, 145, 160, 175] })],
  }),
  authoredAbility({
    id: "vampire-blood-thirst",
    rankCount: 6,
    action: { lane: "reaction", reactionWindow: "hostile-targeted-after-effects", reactionWatch: "selected-hostile-target", resolveCostByRank: [1, 1, 1, 1, 1, 1], cooldownByRank: [1, 1, 1, 1, 1, 1] },
    targeting: { side: "self", includeCaster: true, anchor: { shape: "caster", range: "self", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "caster", scalesFrom: "caster", subject: "predator", unit: "percent", basis: "defense", byRank: [250, 280, 310, 340, 370, 400] }),
      effect({ primitive: "status", operation: "add", recipient: "caster", subject: "solidity", unit: "stacks", byRank: [1, 1, 1, 1, 1, 1] }),
    ],
  }),
  authoredAbility({
    id: "vampire-super-regeneration",
    rankCount: 5,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [1, 1, 1, 1, 1], cooldownByRank: [1, 1, 1, 1, 1] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["ability", "ability", "ability", "ability", "mythical"] },
    effects: [effect({ primitive: "heal", operation: "restore", recipient: "selected-units", scalesFrom: "recipient", unit: "percent", basis: "missing-hp", byRank: [15, 18, 21, 24, 27] })],
  }),
  authoredAbility({
    id: "vampire-bloodflow-absorption",
    rankCount: 4,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [2, 2, 2, 2], cooldownByRank: [0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "melee", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "melee", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [
      effect({ primitive: "status", operation: "add", recipient: "selected-units", scalesFrom: "caster", subject: "bleed", unit: "percent", basis: "attack", byRank: [20, 25, 30, 35] }),
      effect({ primitive: "heal", operation: "restore", recipient: "caster", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [120, 140, 160, 180] }),
    ],
  }),
  authoredAbility({
    id: "vampire-ancestral-blood",
    rankCount: 1,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [3], cooldownByRank: [0] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "row" } },
    presentation: { castMode: "support", tierByRank: ["mythical"] },
    effects: [effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "lifesteal", unit: "stacks", byRank: [50] })],
  }),

  // Automaton — artillery, repair, and Resolve economy.
  authoredAbility({
    id: "automaton-bombardment",
    rankCount: 6,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [0, 0, 0, 0, 0, 0], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "projectile", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [100, 115, 130, 145, 160, 175] })],
  }),
  authoredAbility({
    id: "automaton-repair",
    rankCount: 6,
    action: { lane: "reaction", reactionWindow: "hostile-targeted-after-effects", reactionWatch: "selected-hostile-target", resolveCostByRank: [1, 1, 1, 1, 1, 1], cooldownByRank: [0, 0, 0, 0, 0, 0] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["restrained", "restrained", "restrained", "restrained", "restrained", "restrained"] },
    effects: [
      effect({ primitive: "heal", operation: "restore", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "defense", byRank: [185, 220, 255, 290, 325, 360] }),
      effect({ primitive: "cleanse", operation: "retain-percent", recipient: "selected-units", subject: "limp", unit: "percent", byRank: [40, 40, 40, 40, 40, 40] }),
    ],
  }),
  authoredAbility({
    id: "automaton-infinite-power",
    rankCount: 1,
    action: { lane: "quick", reactionWindow: null, reactionWatch: null, resolveCostByRank: [2], cooldownByRank: [1] },
    targeting: { side: "ally", includeCaster: true, anchor: { shape: "occupied-cell", range: "ranged", tracking: "unit" }, area: { shape: "single" } },
    presentation: { castMode: "support", tierByRank: ["mythical"] },
    effects: [effect({ primitive: "resource", operation: "gain", recipient: "selected-units", subject: "resolve", unit: "flat", byRank: [2] })],
  }),
  authoredAbility({
    id: "automaton-chain-cannon",
    rankCount: 4,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [3, 3, 3, 3], cooldownByRank: [8, 7, 6, 5] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "cell", range: "ranged", tracking: "cell" }, area: { shape: "column" } },
    presentation: { castMode: "projectile", tierByRank: ["ability", "ability", "ability", "mythical"] },
    effects: [effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "paralyze", unit: "stacks", byRank: [3, 3, 3, 3] })],
  }),
  authoredAbility({
    id: "automaton-scorched-earth",
    rankCount: 2,
    action: { lane: "main", reactionWindow: null, reactionWatch: null, resolveCostByRank: [5, 5], cooldownByRank: [0, 0] },
    targeting: { side: "enemy", includeCaster: false, anchor: { shape: "cell", range: "global", tracking: "cell" }, area: { shape: "all" } },
    presentation: { castMode: "field", tierByRank: ["ability", "mythical"] },
    effects: [
      effect({ primitive: "damage", operation: "deal", recipient: "selected-units", scalesFrom: "caster", unit: "percent", basis: "attack", byRank: [150, 190] }),
      effect({ primitive: "status", operation: "add", recipient: "selected-units", subject: "limp", unit: "stacks", byRank: [20, 30] }),
      effect({ primitive: "zone", operation: "create", recipient: "selected-cells", subject: "automaton-scorched-earth", unit: "rounds", byRank: [2, 3] }),
    ],
  }),
]);

export const COMBAT_DEFAULT_ABILITY_KITS_V2 = deepFreeze({
  knight: ["arctic-strike", "arctic-block", "arctic-threatening-cry", "arctic-battle-cry", "arctic-giants-smash"],
  ranger: ["demon-shoot", "demon-evasion", "demon-eagle-eye", "demon-trackers-net", "demon-arrow-rain"],
  artificer: ["artificer-fire", "artificer-suppressive-shot", "artificer-grappling-hook", "artificer-tailored-drink", "artificer-ultra-barrier"],
  berserker: ["north-king-cleave", "north-king-vitality", "north-king-whirlwind", "north-king-warriors-oath", "north-king-earthquake"],
  sorcerer: ["sleepless-swing", "sleepless-hard-scales", "sleepless-entangling-roots", "sleepless-water-totem", "sleepless-fire-dragons-breath"],
  rogue: ["assassin-flurry", "assassin-deflect", "assassin-flash-bomb", "assassin-cold-blood", "assassin-execution"],
  warlock: ["witch-attack", "witch-bone-shield", "witch-skeleton-summon", "witch-all-out-attack", "witch-mirror-image"],
  wizard: ["mage-magic-arrow", "mage-barrier", "mage-flame-storm", "mage-amplification", "mage-god-slaying-spear"],
  paladin: ["priestess-crush", "priestess-block", "priestess-instant-heal", "priestess-purification", "priestess-divine-barrier"],
  blademaster: ["blade-slash", "blade-barrier", "blade-steal-the-flow", "blade-katana-dance", "blade-one-flash"],
  vampire: ["vampire-claw", "vampire-blood-thirst", "vampire-super-regeneration", "vampire-bloodflow-absorption", "vampire-ancestral-blood"],
  automaton: ["automaton-bombardment", "automaton-repair", "automaton-infinite-power", "automaton-chain-cannon", "automaton-scorched-earth"],
});

export const COMBAT_ABILITY_NAMES_V2 = deepFreeze({
  "arctic-strike": "Strike",
  "arctic-block": "Block",
  "arctic-threatening-cry": "Challenge",
  "arctic-battle-cry": "Rally",
  "arctic-giants-smash": "Colossus Blow",
  "demon-shoot": "Shoot",
  "demon-evasion": "Evasion",
  "demon-eagle-eye": "Eagle's Eye",
  "demon-trackers-net": "Tracker's Net",
  "demon-arrow-rain": "Rain of Arrows",
  "artificer-fire": "Fire!",
  "artificer-suppressive-shot": "Suppressive Shot",
  "artificer-grappling-hook": "Grappling Hook",
  "artificer-tailored-drink": "Combat Tonic",
  "artificer-ultra-barrier": "Reinforced Field",
  "north-king-cleave": "Slice",
  "north-king-vitality": "Vitality",
  "north-king-whirlwind": "Spinning Axe",
  "north-king-warriors-oath": "Warrior's Oath",
  "north-king-earthquake": "Earthquake",
  "sleepless-swing": "Arcane Lash",
  "sleepless-hard-scales": "Arcane Ward",
  "sleepless-entangling-roots": "Binding Growth",
  "sleepless-water-totem": "Water Sigil",
  "sleepless-fire-dragons-breath": "Dragonfire",
  "assassin-flurry": "Chain Slash",
  "assassin-deflect": "Parrying",
  "assassin-flash-bomb": "Flashbang",
  "assassin-cold-blood": "Cold Blood",
  "assassin-execution": "Execution",
  "witch-attack": "Shadow Bolt",
  "witch-bone-shield": "Bone Shield",
  "witch-skeleton-summon": "Animate Dead",
  "witch-all-out-attack": "Skeleton Wave",
  "witch-mirror-image": "Mirror Image",
  "mage-magic-arrow": "Arcane Missile",
  "mage-barrier": "Mana Shield",
  "mage-flame-storm": "Flame Storm",
  "mage-amplification": "Amplification",
  "mage-god-slaying-spear": "Grand Arcane Lance",
  "priestess-crush": "Smite",
  "priestess-block": "Block",
  "priestess-instant-heal": "Instant Heal",
  "priestess-purification": "Purification",
  "priestess-divine-barrier": "Sacred Aegis",
  "blade-slash": "Measured Slash",
  "blade-barrier": "Blade Barrier",
  "blade-steal-the-flow": "Flow Snatching",
  "blade-katana-dance": "Blade Dance",
  "blade-one-flash": "Final Flash",
  "vampire-claw": "Claw Strike",
  "vampire-blood-thirst": "Bloodthirst",
  "vampire-super-regeneration": "Rapid Regeneration",
  "vampire-bloodflow-absorption": "Sanguine Draw",
  "vampire-ancestral-blood": "Elder Blood",
  "automaton-bombardment": "Bombardment",
  "automaton-repair": "Field Repair",
  "automaton-infinite-power": "Reserve Cell",
  "automaton-chain-cannon": "Chain Cannon",
  "automaton-scorched-earth": "Scorched Earth",
});

// Roles are authored catalogue identity, not inferred by re-running the v1 profile adapter.
// They deliberately overlap: a displacement attack can be both damage and control, while
// a combat tonic can heal, empower, and advance tempo in the same party kit.
export const COMBAT_ABILITY_ROLES_V2 = deepFreeze({
  "arctic-strike": ["damage"],
  "arctic-block": ["tank-control"],
  "arctic-threatening-cry": ["tank-control"],
  "arctic-battle-cry": ["tank-control", "buff"],
  "arctic-giants-smash": ["damage", "tank-control"],
  "demon-shoot": ["damage"],
  "demon-evasion": ["tank-control", "buff"],
  "demon-eagle-eye": ["buff"],
  "demon-trackers-net": ["tank-control"],
  "demon-arrow-rain": ["damage"],
  "artificer-fire": ["damage"],
  "artificer-suppressive-shot": ["tank-control"],
  "artificer-grappling-hook": ["tank-control", "tempo"],
  "artificer-tailored-drink": ["heal", "buff", "tempo"],
  "artificer-ultra-barrier": ["tank-control", "buff"],
  "north-king-cleave": ["damage"],
  "north-king-vitality": ["heal"],
  "north-king-whirlwind": ["damage"],
  "north-king-warriors-oath": ["cleanse", "buff"],
  "north-king-earthquake": ["damage", "tank-control"],
  "sleepless-swing": ["damage"],
  "sleepless-hard-scales": ["tank-control", "buff"],
  "sleepless-entangling-roots": ["damage", "tank-control"],
  "sleepless-water-totem": ["tank-control", "buff"],
  "sleepless-fire-dragons-breath": ["damage", "tank-control"],
  "assassin-flurry": ["damage"],
  "assassin-deflect": ["tank-control", "buff"],
  "assassin-flash-bomb": ["tank-control", "tempo"],
  "assassin-cold-blood": ["cleanse"],
  "assassin-execution": ["damage"],
  "witch-attack": ["damage"],
  "witch-bone-shield": ["tank-control", "buff"],
  "witch-skeleton-summon": ["buff"],
  "witch-all-out-attack": ["damage"],
  "witch-mirror-image": ["tank-control", "buff"],
  "mage-magic-arrow": ["damage"],
  "mage-barrier": ["tank-control", "buff"],
  "mage-flame-storm": ["damage", "tank-control"],
  "mage-amplification": ["buff"],
  "mage-god-slaying-spear": ["damage"],
  "priestess-crush": ["damage"],
  "priestess-block": ["tank-control", "buff"],
  "priestess-instant-heal": ["heal"],
  "priestess-purification": ["cleanse"],
  "priestess-divine-barrier": ["tank-control", "buff"],
  "blade-slash": ["damage"],
  "blade-barrier": ["tank-control", "buff"],
  "blade-steal-the-flow": ["buff", "tempo"],
  "blade-katana-dance": ["tank-control", "buff"],
  "blade-one-flash": ["damage", "tempo"],
  "vampire-claw": ["damage"],
  "vampire-blood-thirst": ["tank-control", "buff"],
  "vampire-super-regeneration": ["heal"],
  "vampire-bloodflow-absorption": ["damage", "heal"],
  "vampire-ancestral-blood": ["buff"],
  "automaton-bombardment": ["damage"],
  "automaton-repair": ["heal", "cleanse"],
  "automaton-infinite-power": ["economy"],
  "automaton-chain-cannon": ["tank-control"],
  "automaton-scorched-earth": ["damage", "tank-control"],
});

function defineCatalog(values) {
  const ids = values.map((definition) => definition.id);
  if (new Set(ids).size !== ids.length) throw new TypeError("duplicate-ability-catalog-v2-id");
  for (const definition of values) {
    const references = validateAbilityRuleReferencesV2(definition, {
      zones: COMBAT_ABILITY_ZONES_V2,
      statuses: COMBAT_ABILITY_STATUSES_V2,
    });
    if (!references.ok) throw new TypeError(references.reason);
  }
  return deepFreeze(Object.fromEntries(values.map((definition) => [definition.id, definition])));
}

export const COMBAT_ABILITY_CATALOG_V2 = defineCatalog(AUTHORED_ABILITIES_V2);
export const COMBAT_ABILITY_CATALOG_V2_LIST = deepFreeze([...AUTHORED_ABILITIES_V2]);
export const COMBAT_ABILITY_ZONE_LIST_V2 = deepFreeze(Object.values(COMBAT_ABILITY_ZONES_V2));

export function getCombatAbilityRulesV2(id) {
  return typeof id === "string" && Object.hasOwn(COMBAT_ABILITY_CATALOG_V2, id)
    ? COMBAT_ABILITY_CATALOG_V2[id]
    : null;
}

export function getCombatAbilityNameV2(id) {
  return typeof id === "string" && Object.hasOwn(COMBAT_ABILITY_NAMES_V2, id)
    ? COMBAT_ABILITY_NAMES_V2[id]
    : null;
}

export function getCombatAbilityRolesV2(id) {
  return typeof id === "string" && Object.hasOwn(COMBAT_ABILITY_ROLES_V2, id)
    ? COMBAT_ABILITY_ROLES_V2[id]
    : null;
}

export function getCombatStatusRulesV2(id) {
  return typeof id === "string" && Object.hasOwn(COMBAT_ABILITY_STATUSES_V2, id)
    ? COMBAT_ABILITY_STATUSES_V2[id]
    : null;
}

export function getCombatDefaultAbilityKitV2(archetypeId) {
  return typeof archetypeId === "string"
    && Object.hasOwn(COMBAT_DEFAULT_ABILITY_KITS_V2, archetypeId)
    ? COMBAT_DEFAULT_ABILITY_KITS_V2[archetypeId]
    : null;
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableSerialize(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function calculateCombatAbilityCatalogV2Checksum() {
  return `fnv1a32:${fnv1a32(stableSerialize({
    version: COMBAT_ABILITY_CATALOG_V2_VERSION,
    kits: COMBAT_DEFAULT_ABILITY_KITS_V2,
    names: COMBAT_ABILITY_NAMES_V2,
    roles: COMBAT_ABILITY_ROLES_V2,
    statuses: COMBAT_ABILITY_STATUS_LIST_V2,
    abilities: COMBAT_ABILITY_CATALOG_V2_LIST,
    zones: COMBAT_ABILITY_ZONE_LIST_V2,
  }))}`;
}

// Deliberately committed. A semantic catalogue change must update this snapshot and its
// compatibility review rather than silently changing the opt-in ruleset under a replay.
export const COMBAT_ABILITY_CATALOG_V2_CHECKSUM = "fnv1a32:8a8adfc6";
