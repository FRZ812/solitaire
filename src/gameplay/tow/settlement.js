// Folding a finished Tower of Winter encounter back into campaign state.
//
// Generalised from the single-enemy production settlement: a Tower of Winter encounter
// can field a group, so every fallen foe has to reach the codex, not just the first one.
//
// Settlement is idempotent by receipt. A campaign carries one receipt per encounter id,
// and a second attempt returns the original rather than applying an outcome twice — which
// matters because an autosave, a reload and a click can all race the same fight ending.

import { normalizeConditions } from "../../data/conditions.js";
import { XP } from "../../data/proficiencies.js";
import {
  advanceProgression,
  earnedLevelGrowthText,
  stripTowLegacyProgression,
  usesLegacyCharacterProgression,
} from "../../engine/progression.js";
import { cloneJsonData } from "../kernel/json-data.js";
import { settleCombatItems, spentCombatItems } from "./combat-items.js";
import { activeTowItemIds, towItemActorBonuses } from "./start-items.js";

export const MAX_TOW_SETTLEMENT_RECEIPTS = 256;

function rejected(reason, state, receipt = null) {
  return { ok: false, reason, state, receipt, duplicate: reason === "tow-encounter-already-settled" };
}

function ownedReceipt(value) {
  const receipt = cloneJsonData(value);
  for (const child of Object.values(receipt)) {
    if (child && typeof child === "object") Object.freeze(child);
  }
  return Object.freeze(receipt);
}

// Proficiency comes from what the player actually did, read off the encounter's own event
// log rather than a tally kept alongside it that could drift.
function proficiencyGains(encounter, proficiencyId) {
  const gains = {};
  let strikes = 0;
  let guards = 0;
  for (const entry of encounter.events) {
    if (entry.type === "skill-damage") strikes += 1;
    if (entry.type === "skill-shield") guards += 1;
  }
  if (strikes > 0 && proficiencyId) gains[proficiencyId] = strikes * XP.WEAPON_HIT;
  if (guards > 0) gains.endurance = guards * XP.ENDURANCE;
  return gains;
}

export function deriveTowSettlementReceipt(state, encounter, context = {}) {
  const { encounterId, proficiencyId = null } = context;
  const player = encounter.actors[encounter.playerId];
  const gains = usesLegacyCharacterProgression(state.character)
    ? proficiencyGains(encounter, proficiencyId)
    : {};
  return {
    version: 1,
    sessionId: encounterId,
    outcome: encounter.phase,
    rounds: encounter.round,
    sequence: encounter.sequence,
    playerHp: player.hp,
    playerResolve: Number.isFinite(player.resolve) ? player.resolve : null,
    combatItemsSpent: spentCombatItems(encounter, encounter.playerId),
    fallen: encounter.enemyIds.filter((enemyId) => encounter.actors[enemyId].hp <= 0).length,
    proficiencyGains: gains,
  };
}

/**
 * Settle a terminal Tower of Winter encounter into campaign state.
 *
 * @param {object} state campaign state
 * @param {object} encounter a terminal TOW encounter
 * @param {{encounterId: string, proficiencyId?: string, npcIds?: Record<string,string>,
 *   lethal?: boolean, worldFates?: Record<string,"alive"|"dead">}} context
 *   `npcIds` maps encounter actor ids to codex character ids, for foes that are real people.
 *   `worldFates` is the terminal receipt's per-participant verdict; where it names an actor
 *   it decides that actor's fate, because a fight can be lethal for one person in it and
 *   not for another.
 */
export function settleTowEncounter(state, encounter, context = {}) {
  // Lethality belongs to the fiction that started the fight, not to the encounter — a
  // brawl and a duel to the death resolve identically on the kernel and differ only in
  // what zero health means afterwards. Defaulting to lethal keeps a caller that has not
  // been taught the distinction behaving as it always did.
  const { encounterId, proficiencyId = null, npcIds = {}, lethal = true, worldFates = {} } = context;
  if (typeof encounterId !== "string" || encounterId.length === 0) {
    return rejected("invalid-encounter-id", state);
  }
  if (!encounter || !["victory", "defeat", "retreated"].includes(encounter.phase)) {
    return rejected("tow-encounter-not-terminal", state);
  }

  let priorReceipts;
  try {
    priorReceipts = cloneJsonData(state?.combatSettlementReceipts || []);
  } catch {
    return rejected("invalid-tow-settlement-receipts", state);
  }
  if (!Array.isArray(priorReceipts)) return rejected("invalid-tow-settlement-receipts", state);

  const prior = priorReceipts.find((receipt) => receipt?.sessionId === encounterId);
  if (prior) return rejected("tow-encounter-already-settled", state, ownedReceipt(prior));
  if (priorReceipts.length >= MAX_TOW_SETTLEMENT_RECEIPTS) {
    return rejected("tow-settlement-receipt-limit-exceeded", state);
  }

  let character;
  try {
    character = cloneJsonData(state.character);
  } catch {
    return rejected("invalid-tow-settlement-campaign-state", state);
  }
  const usesLegacyProgression = usesLegacyCharacterProgression(character);
  if (!usesLegacyProgression) stripTowLegacyProgression(character);

  const player = encounter.actors[encounter.playerId];
  // A defeat leaves the player alive at one vitality — losing a fight is a setback the
  // story continues from, not a delete. Permanent death stays a separate, deliberate path.
  const campaignVitalityMax = Math.max(1, Math.round(character.vitalityMax ?? player.maxHp));
  const mappedVitality = player.hp > 0
    ? Math.max(1, Math.round(campaignVitalityMax * (player.hp / player.maxHp)))
    : 0;
  character.vitality = encounter.phase === "defeat"
    ? 1
    : Math.max(0, Math.min(campaignVitalityMax, mappedVitality));
  if (Number.isFinite(player.resolve)) {
    const appliedMaxBonus = Math.max(0, Math.round(towItemActorBonuses(
      activeTowItemIds(character, state.world?.codex),
    ).resolveMax || 0));
    character.resolveMax = Math.max(1, Math.round(player.resolveMax));
    character.resolve = Math.max(0, Math.min(character.resolveMax, Math.round(player.resolve)));
    character.towResolveMaxBonus = Math.min(character.resolveMax, appliedMaxBonus);
  }
  const receiptData = deriveTowSettlementReceipt(state, encounter, context);
  const combatItemsSpent = receiptData.combatItemsSpent;
  character.inventory = settleCombatItems(character.inventory, combatItemsSpent);

  if (encounter.phase === "defeat") {
    const conditions = new Set((character.conditions || []).map((condition) => (
      typeof condition === "string" ? condition : condition?.name
    )).filter(Boolean));
    conditions.add("Gravely Wounded");
    conditions.add("Bleeding");
    character.conditions = normalizeConditions([...conditions]);
  }

  // The Tower archetype model owns its combat growth. Feeding these encounters back into
  // the retired proficiency/level ledger would create a second, invisible advancement
  // system even though the old progression screen is no longer mounted.
  const gains = receiptData.proficiencyGains;
  character.proficiencies = { ...(character.proficiencies || {}) };
  for (const [id, amount] of Object.entries(gains)) {
    character.proficiencies[id] = (character.proficiencies[id] || 0) + amount;
  }
  const progressionXp = Object.values(gains).reduce((sum, amount) => sum + amount, 0) * 10;
  // Earning a level has to say so. The old combat result emitted this growth beat, and a
  // level that arrived silently would leave the player with unspent allocations and no
  // idea they had them.
  const progress = progressionXp > 0 && usesLegacyProgression
    ? advanceProgression(character, progressionXp)
    : null;
  const growthText = progress ? earnedLevelGrowthText(progress) : null;

  // Every foe that maps to a codex character has its state written back, not just the
  // first — a group fight must not leave survivors silently untouched. Allies are written
  // back on the same terms: a companion who fought is a person the world should show as
  // having been in a fight, whether they walked away from it or not.
  let world = state.world;
  const characters = { ...(state.world?.codex?.characters || {}) };
  let codexTouched = false;
  const fallen = [];
  for (const enemyId of [...encounter.enemyIds, ...(encounter.allyIds || [])]) {
    const enemy = encounter.actors[enemyId];
    const isFoe = encounter.enemyIds.includes(enemyId);
    if (isFoe && enemy.hp <= 0) fallen.push(enemy.name);
    const npcId = npcIds[enemyId];
    if (!npcId || !characters[npcId]) continue;
    characters[npcId] = {
      ...characters[npcId],
      ...(Number.isFinite(enemy.resolve) ? {
        resolve: Math.max(
          0,
          Math.min(
            Math.round(characters[npcId].resolveMax ?? enemy.resolveMax),
            Math.round(enemy.resolve),
          ),
        ),
      } : {}),
      combatState: {
        health: Math.max(0, Math.ceil(enemy.hp)),
        maxHealth: enemy.maxHp,
        // A foe beaten in a nonlethal fight is unconscious, not a corpse. Recording them
        // dead is unrecoverable: the codex loses a person the player deliberately spared,
        // and they can never return. Where the terminal receipt named this person's fate,
        // that is the answer; the blanket flag only stands in for callers that have none.
        status: enemy.hp <= 0
          ? ((worldFates[enemyId] ? worldFates[enemyId] === "dead" : lethal) ? "dead" : "downed")
          : enemy.hp < enemy.maxHp ? "wounded" : "ok",
      },
    };
    codexTouched = true;
  }
  // The codex's projection of the player has to follow the character, whether or not any
  // foe in this fight was a codex person — otherwise a level earned against nameless
  // bandits leaves the projection stale.
  const wanderer = characters.wanderer;
  if (wanderer) {
    const projection = {
      ...wanderer,
      profession: character.profession,
      archetype: character.archetype,
      attributes: { ...(character.attributes || {}) },
      ...(character.progressionModel ? { progressionModel: character.progressionModel } : {}),
      ...(character.combatArchetypeId ? { combatArchetypeId: character.combatArchetypeId } : {}),
      ...(character.towBaseStats ? { towBaseStats: cloneJsonData(character.towBaseStats) } : {}),
      ...(usesLegacyProgression && character.progression
        ? { progression: cloneJsonData(character.progression) }
        : {}),
    };
    if (!usesLegacyProgression) stripTowLegacyProgression(projection, { forceTow: true });
    characters.wanderer = projection;
    codexTouched = true;
  }
  if (codexTouched) {
    world = { ...state.world, codex: { ...state.world.codex, characters } };
  }

  const receipt = ownedReceipt(receiptData);

  const content = encounter.phase === "victory"
    ? `${fallen.length === 1 ? fallen[0] : `${fallen.length} foes`} down. The fight is over.`
    : encounter.phase === "retreated"
      ? "You break contact and lead the party clear. The fight ends without a victor."
      : "The fight goes against you. A last blow lands, and the world tips into black.";

  return {
    ok: true,
    reason: null,
    duplicate: false,
    receipt,
    state: {
      ...state,
      combatSettlementReceipts: [...priorReceipts, receipt],
      character,
      world,
      beats: [
        ...(state.beats || []),
        { id: `tow-combat:${encounterId}:settled`, type: "narration", content },
        ...(growthText
          ? [{ id: `tow-combat:${encounterId}:growth`, type: "growth", text: growthText }]
          : []),
      ],
    },
  };
}
