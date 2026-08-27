// Frozen verifier-only Tower v1.2 semantics from deployed commit d925c35.
// Never route playable/current combat through this module.
// Equipment-owned basic attack lineages for Solitaire's Tower combat bridge.
//
// Tower of Winter establishes two independent ideas for the basic attack slot: learning the
// same attack raises its rank, while another skill may replace that slot with a different
// mechanic. Solitaire keeps those ideas but moves ownership to the equipped weapon. A weapon
// therefore has one active form that can grow through all six ranks, plus optional sibling
// forms that an item upgrade may select. Branches are choices, never mandatory promotions.
//
// Only the active form is snapshotted into a fight. This preserves the exact hit count,
// scaling and status payload for saves/replay even if the catalogue grows later; the larger
// lineage stays presentation and progression data outside the strict actor schema.

import { itemTemplate } from "../../data/catalog-v12.js";
import { itemCombatStats, weaponCategory } from "../../engine/combat-stats-v12.js";

export const WEAPON_ATTACK_VERSION = 1;
export const WEAPON_ATTACK_RANKS = 6;

const STANDARD = Object.freeze([100, 115, 130, 145, 160, 175]);
const PAIRED = Object.freeze([50, 58, 65, 73, 80, 88]);
const TRIPLE = Object.freeze([34, 39, 44, 49, 54, 59]);
const DEBUFF_HIT = Object.freeze([90, 103, 116, 129, 142, 155]);
const DEBUFF = Object.freeze([25, 30, 35, 40, 45, 50]);

function values(source) {
  return Object.freeze([...source]);
}

function status(statusId, percentByRank, scale = "attack") {
  return Object.freeze({
    status: statusId,
    target: "enemy",
    scale,
    percentByRank: values(percentByRank),
  });
}

function form(id, name, {
  role,
  hitsByRank = Object.freeze([1, 1, 1, 1, 1, 1]),
  damagePercentByRank = STANDARD,
  statusEffects = [],
  description,
} = {}) {
  return Object.freeze({
    id,
    name,
    role,
    hitsByRank: values(hitsByRank),
    damagePercentByRank: values(damagePercentByRank),
    statusEffects: Object.freeze([...statusEffects]),
    description,
  });
}

function lineage(id, family, forms) {
  return Object.freeze({ id, family, activeFormId: forms[0].id, forms: Object.freeze(forms) });
}

const SINGLE_HITS = Object.freeze([1, 1, 1, 1, 1, 1]);
const DOUBLE_HITS = Object.freeze([2, 2, 2, 2, 2, 2]);
const TRIPLE_HITS = Object.freeze([3, 3, 3, 3, 3, 3]);

function simpleFamilyLineage(family, baseName) {
  return lineage(`${family}-fundamentals`, family, [
    form(`${family}-fundamental`, baseName, {
      role: "equipped",
      description: "The weapon's foundational attack. Repeated upgrades improve it in place.",
    }),
  ]);
}

const FAMILY_LINEAGES = Object.freeze({
  dagger: simpleFamilyLineage("dagger", "Quick Cut"),
  sword: simpleFamilyLineage("sword", "Slash"),
  axe: simpleFamilyLineage("axe", "Cleave"),
  mace: simpleFamilyLineage("mace", "Crushing Blow"),
  spear: simpleFamilyLineage("spear", "Thrust"),
  bow: simpleFamilyLineage("bow", "Loose Arrow"),
  crossbow: simpleFamilyLineage("crossbow", "Loose Bolt"),
  arcane: simpleFamilyLineage("arcane", "Arcane Bolt"),
  unarmed: simpleFamilyLineage("unarmed", "Unarmed Strike"),
});

// These are weapon lineages, not archetype kits. Moving an upgraded item to another
// character moves its selected form too. The paired blades intentionally begin at two
// hits; their three-hit and single-hit-with-debuff forms are alternatives, not a ladder.
const ITEM_LINEAGES = Object.freeze({
  "arming-sword": lineage("arming-sword-lineage", "sword", [
    form("measured-cut", "Measured Cut", {
      role: "balanced",
      description: "One deliberate cut whose damage continues to rise at every rank.",
    }),
    form("crossing-cuts", "Crossing Cuts", {
      role: "multi-hit",
      hitsByRank: DOUBLE_HITS,
      damagePercentByRank: PAIRED,
      description: "Two measured cuts; each hit tests mitigation separately.",
    }),
    form("hampering-cut", "Hampering Cut", {
      role: "debuff",
      damagePercentByRank: DEBUFF_HIT,
      statusEffects: [status("lethargy", DEBUFF)],
      description: "Keep one hit and trade raw force for an attack-sapping wound.",
    }),
  ]),
  "hunting-bow": lineage("hunting-bow-lineage", "bow", [
    form("loose-arrow", "Loose Arrow", {
      role: "balanced",
      description: "A clean single arrow that remains viable through every rank.",
    }),
    form("split-volley", "Split Volley", {
      role: "multi-hit",
      hitsByRank: DOUBLE_HITS,
      damagePercentByRank: PAIRED,
      description: "Loose twice in one action; mitigation is checked for both arrows.",
    }),
    form("pinning-arrow", "Pinning Arrow", {
      role: "debuff",
      damagePercentByRank: DEBUFF_HIT,
      statusEffects: [status("lethargy", DEBUFF)],
      description: "One placed shot that blunts the target's next attacks.",
    }),
  ]),
  "twin-daggers": lineage("twin-daggers-lineage", "dagger", [
    form("twin-cut", "Twin Cut", {
      role: "balanced multi-hit",
      hitsByRank: DOUBLE_HITS,
      damagePercentByRank: PAIRED,
      description: "The paired blades' native two-hit attack, potent at every rank.",
    }),
    form("threefold-cut", "Threefold Cut", {
      role: "multi-hit",
      hitsByRank: TRIPLE_HITS,
      damagePercentByRank: TRIPLE,
      description: "Add a third lighter hit; every cut resolves independently.",
    }),
    form("hamstring-cut", "Hamstring Cut", {
      role: "debuff",
      damagePercentByRank: DEBUFF_HIT,
      statusEffects: [status("bleed", DEBUFF)],
      description: "Collapse the pair into one deep cut that leaves escalating Bleed.",
    }),
  ]),
  "dawnward-mace": lineage("dawnward-mace-lineage", "mace", [
    form("dawnward-blow", "Dawnward Blow", {
      role: "balanced",
      description: "A single radiant impact that can be strengthened without changing form.",
    }),
    form("pealing-blows", "Pealing Blows", {
      role: "multi-hit",
      hitsByRank: DOUBLE_HITS,
      damagePercentByRank: PAIRED,
      description: "Two ringing impacts, each forcing its own defence check.",
    }),
    form("sunbreak", "Sunbreak", {
      role: "debuff",
      damagePercentByRank: DEBUFF_HIT,
      statusEffects: [status("lethargy", DEBUFF)],
      description: "One concussive strike that weakens the enemy's offence.",
    }),
  ]),
  "oak-staff": lineage("oak-staff-lineage", "arcane", [
    form("staff-bolt", "Staff Bolt", {
      role: "balanced",
      description: "A focused arcane bolt whose original form scales through every rank.",
    }),
    form("forked-bolt", "Forked Bolt", {
      role: "multi-hit",
      hitsByRank: DOUBLE_HITS,
      damagePercentByRank: PAIRED,
      description: "Fork the casting into two independently resolved bolts.",
    }),
    form("cinder-mark", "Cinder Mark", {
      role: "debuff",
      damagePercentByRank: DEBUFF_HIT,
      statusEffects: [status("burn", DEBUFF)],
      description: "One bolt brands the target with a growing Burn.",
    }),
  ]),
  "kingsguard-blade": lineage("kingsguard-blade-lineage", "sword", [
    form("kingsguard-riposte", "Kingsguard Riposte", {
      role: "balanced",
      description: "A disciplined answering cut that remains complete at every rank.",
    }),
    form("double-reply", "Double Reply", {
      role: "multi-hit",
      hitsByRank: DOUBLE_HITS,
      damagePercentByRank: PAIRED,
      description: "Answer with two compact cuts instead of one.",
    }),
    form("binding-cut", "Binding Cut", {
      role: "debuff",
      damagePercentByRank: DEBUFF_HIT,
      statusEffects: [status("lethargy", DEBUFF)],
      description: "A single controlling cut that drains the enemy's striking force.",
    }),
  ]),
  "nightfang-dagger": lineage("nightfang-dagger-lineage", "dagger", [
    form("nightfang-hush", "Nightfang & Hush", {
      role: "balanced multi-hit",
      hitsByRank: DOUBLE_HITS,
      damagePercentByRank: PAIRED,
      description: "The paired night blades' two-hit signature, upgradable in place.",
    }),
    form("threefold-shadow", "Threefold Shadow", {
      role: "multi-hit",
      hitsByRank: TRIPLE_HITS,
      damagePercentByRank: TRIPLE,
      description: "A third shadow cut joins the original pair.",
    }),
    form("silencing-cut", "Silencing Cut", {
      role: "debuff",
      damagePercentByRank: DEBUFF_HIT,
      statusEffects: [status("lethargy", DEBUFF)],
      description: "One precise cut abandons the flurry to cripple retaliation.",
    }),
  ]),
  "wyrmscale-greatblade": lineage("wyrmscale-greatblade-lineage", "sword", [
    form("wyrmscale-cleave", "Wyrmscale Cleave", {
      role: "balanced",
      damagePercentByRank: Object.freeze([110, 126, 143, 159, 176, 193]),
      description: "The greatblade's original heavy arc grows stronger without changing form.",
    }),
    form("dragons-wake", "Dragon's Wake", {
      role: "multi-hit",
      hitsByRank: DOUBLE_HITS,
      damagePercentByRank: Object.freeze([55, 63, 72, 80, 88, 97]),
      description: "Turn the great arc into two rolling impacts.",
    }),
    form("sundering-flame", "Sundering Flame", {
      role: "debuff",
      damagePercentByRank: Object.freeze([100, 114, 129, 143, 158, 172]),
      statusEffects: [status("burn", DEBUFF)],
      description: "One decisive cleave leaves a searing wound behind.",
    }),
  ]),
});

export const COMBAT_WEAPON_FAMILIES = Object.freeze(Object.keys(FAMILY_LINEAGES));
export const STARTING_WEAPON_LINEAGE_IDS = Object.freeze(Object.keys(ITEM_LINEAGES));

function canonicalItem(itemId, codex) {
  return codex?.items?.[itemId] || itemTemplate(itemId) || null;
}

function normalizedFamily(item) {
  const stats = itemCombatStats(item);
  const family = stats.weaponType || weaponCategory(item) || "unarmed";
  return Object.hasOwn(FAMILY_LINEAGES, family) ? family : "unarmed";
}

function selectedWeapon(itemIds, codex) {
  for (const itemId of Array.isArray(itemIds) ? itemIds : []) {
    if (typeof itemId !== "string") continue;
    const item = canonicalItem(itemId, codex);
    if (!item || !itemCombatStats(item).damage) continue;
    return { itemId, item };
  }
  return { itemId: null, item: null };
}

function lineageFor(itemId, item, family) {
  return ITEM_LINEAGES[itemId]
    || ITEM_LINEAGES[item?.id]
    || FAMILY_LINEAGES[family]
    || FAMILY_LINEAGES.unarmed;
}

function activeFormFor(lineage_, item, requestedFormId) {
  const desired = requestedFormId || item?.towAttackFormId || lineage_.activeFormId;
  return lineage_.forms.find((entry) => entry.id === desired) || lineage_.forms[0];
}

export function weaponTechniqueFromItemIds(itemIds = [], codex = {}, options = {}) {
  const { itemId, item } = selectedWeapon(itemIds, codex);
  const family = item ? normalizedFamily(item) : "unarmed";
  const lineage_ = lineageFor(itemId, item, family);
  const activeForm = activeFormFor(lineage_, item, options.formId);
  return Object.freeze({
    lineageId: lineage_.id,
    family,
    itemId,
    activeFormId: activeForm.id,
    activeForm,
    forms: lineage_.forms,
  });
}

export function weaponTechniqueForItem(itemId, codex = {}, options = {}) {
  return weaponTechniqueFromItemIds(itemId ? [itemId] : [], codex, options);
}

/** Read a stored item's selected form, falling back to the lineage's complete base form. */
export function weaponTechniqueForEquippedItem(itemId, codex = {}) {
  const item = itemId ? canonicalItem(itemId, codex) : null;
  return weaponTechniqueFromItemIds(itemId ? [itemId] : [], codex, {
    formId: item?.towAttackFormId,
  });
}

export function weaponAttackSnapshot(technique, formId = technique?.activeFormId) {
  const chosen = technique?.forms?.find((entry) => entry.id === formId) || technique?.activeForm;
  if (!chosen || typeof technique?.lineageId !== "string") return null;
  return {
    version: WEAPON_ATTACK_VERSION,
    lineageId: technique.lineageId,
    formId: chosen.id,
    name: chosen.name,
    hitsByRank: [...chosen.hitsByRank],
    damagePercentByRank: [...chosen.damagePercentByRank],
    statusEffects: chosen.statusEffects.map((entry) => ({
      status: entry.status,
      target: entry.target,
      scale: entry.scale,
      percentByRank: [...entry.percentByRank],
    })),
  };
}

export function weaponAttackSnapshotFromItemIds(itemIds = [], codex = {}, options = {}) {
  const technique = weaponTechniqueFromItemIds(itemIds, codex, options);
  return weaponAttackSnapshot(technique, technique.activeFormId);
}

function validRankArray(value, { minimum = 0 } = {}) {
  return Array.isArray(value)
    && value.length === WEAPON_ATTACK_RANKS
    && value.every((entry) => Number.isSafeInteger(entry) && entry >= minimum);
}

export function isWeaponAttackSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const expected = [
    "damagePercentByRank", "formId", "hitsByRank", "lineageId", "name",
    "statusEffects", "version",
  ].sort();
  const keys = Object.keys(value).sort();
  if (keys.length !== expected.length || !keys.every((key, index) => key === expected[index])) return false;
  if (value.version !== WEAPON_ATTACK_VERSION) return false;
  if (![value.lineageId, value.formId, value.name].every((entry) => typeof entry === "string" && entry.length > 0)) return false;
  if (!validRankArray(value.hitsByRank, { minimum: 1 })) return false;
  if (!validRankArray(value.damagePercentByRank, { minimum: 0 })) return false;
  if (!Array.isArray(value.statusEffects)) return false;
  return value.statusEffects.every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const statusKeys = Object.keys(entry).sort();
    const expectedStatusKeys = ["percentByRank", "scale", "status", "target"].sort();
    return statusKeys.length === expectedStatusKeys.length
      && statusKeys.every((key, index) => key === expectedStatusKeys[index])
      && typeof entry.status === "string"
      && entry.target === "enemy"
      && ["attack", "defense", "max-hp"].includes(entry.scale)
      && validRankArray(entry.percentByRank, { minimum: 0 });
  });
}

export function normalizeWeaponAttackSnapshot(value) {
  if (!isWeaponAttackSnapshot(value)) return null;
  return {
    ...value,
    hitsByRank: [...value.hitsByRank],
    damagePercentByRank: [...value.damagePercentByRank],
    statusEffects: value.statusEffects.map((entry) => ({
      ...entry,
      percentByRank: [...entry.percentByRank],
    })),
  };
}

export function weaponAttackAtRank(snapshot, rank = 1) {
  if (!isWeaponAttackSnapshot(snapshot)) return null;
  const index = Math.max(0, Math.min(WEAPON_ATTACK_RANKS - 1, Number(rank || 1) - 1));
  return {
    hits: snapshot.hitsByRank[index],
    damagePercent: snapshot.damagePercentByRank[index],
    statusEffects: snapshot.statusEffects.map((entry) => ({
      status: entry.status,
      target: entry.target,
      scale: entry.scale,
      percent: entry.percentByRank[index],
    })),
  };
}

export function weaponAttackSummary(snapshot, rank = 1) {
  const resolved = weaponAttackAtRank(snapshot, rank);
  if (!resolved) return "100% attack damage";
  const damage = resolved.hits > 1
    ? `${resolved.hits} hits · ${resolved.damagePercent}% ATK each`
    : `${resolved.damagePercent}% ATK damage`;
  const statuses = resolved.statusEffects.map((entry) => (
    `${entry.percent}% ${entry.scale.toUpperCase()} ${entry.status.replace(/-/g, " ")}`
  ));
  return [damage, ...statuses].join(" · ");
}
