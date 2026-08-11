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
import { advanceProgression } from "../../engine/progression.js";
import { cloneJsonData } from "../kernel/json-data.js";

export const MAX_TOW_SETTLEMENT_RECEIPTS = 256;

function rejected(reason, state, receipt = null) {
  return { ok: false, reason, state, receipt };
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

/**
 * Settle a terminal Tower of Winter encounter into campaign state.
 *
 * @param {object} state campaign state
 * @param {object} encounter a terminal TOW encounter
 * @param {{encounterId: string, proficiencyId?: string, npcIds?: Record<string,string>}} context
 *   `npcIds` maps encounter actor ids to codex character ids, for foes that are real people.
 */
export function settleTowEncounter(state, encounter, context = {}) {
  const { encounterId, proficiencyId = null, npcIds = {} } = context;
  if (typeof encounterId !== "string" || encounterId.length === 0) {
    return rejected("invalid-encounter-id", state);
  }
  if (!encounter || !["victory", "defeat"].includes(encounter.phase)) {
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

  const player = encounter.actors[encounter.playerId];
  // A defeat leaves the player alive at one vitality — losing a fight is a setback the
  // story continues from, not a delete. Permanent death stays a separate, deliberate path.
  character.vitality = encounter.phase === "defeat"
    ? Math.max(1, Math.min(character.vitalityMax, Math.round(player.hp)))
    : Math.max(0, Math.min(character.vitalityMax, Math.round(player.hp)));

  if (encounter.phase === "defeat") {
    const conditions = new Set((character.conditions || []).map((condition) => (
      typeof condition === "string" ? condition : condition?.name
    )).filter(Boolean));
    conditions.add("Gravely Wounded");
    conditions.add("Bleeding");
    character.conditions = normalizeConditions([...conditions]);
  }

  const gains = proficiencyGains(encounter, proficiencyId);
  character.proficiencies = { ...(character.proficiencies || {}) };
  for (const [id, amount] of Object.entries(gains)) {
    character.proficiencies[id] = (character.proficiencies[id] || 0) + amount;
  }
  const progressionXp = Object.values(gains).reduce((sum, amount) => sum + amount, 0) * 10;
  if (progressionXp > 0) advanceProgression(character, progressionXp);

  // Every foe that maps to a codex character has its state written back, not just the
  // first — a group fight must not leave survivors silently untouched.
  let world = state.world;
  const characters = { ...(state.world?.codex?.characters || {}) };
  let codexTouched = false;
  const fallen = [];
  for (const enemyId of encounter.enemyIds) {
    const enemy = encounter.actors[enemyId];
    if (enemy.hp <= 0) fallen.push(enemy.name);
    const npcId = npcIds[enemyId];
    if (!npcId || !characters[npcId]) continue;
    characters[npcId] = {
      ...characters[npcId],
      combatState: {
        health: Math.max(0, Math.ceil(enemy.hp)),
        maxHealth: enemy.maxHp,
        status: enemy.hp <= 0 ? "dead" : enemy.hp < enemy.maxHp ? "wounded" : "ok",
      },
    };
    codexTouched = true;
  }
  if (codexTouched) {
    const wanderer = characters.wanderer;
    if (wanderer && character.progression) {
      characters.wanderer = {
        ...wanderer,
        profession: character.profession,
        archetype: character.archetype,
        attributes: { ...(character.attributes || {}) },
        progression: cloneJsonData(character.progression),
      };
    }
    world = { ...state.world, codex: { ...state.world.codex, characters } };
  }

  const receipt = ownedReceipt({
    version: 1,
    sessionId: encounterId,
    outcome: encounter.phase,
    rounds: encounter.round,
    sequence: encounter.sequence,
    playerHp: player.hp,
    fallen: fallen.length,
    proficiencyGains: gains,
  });

  const content = encounter.phase === "victory"
    ? `${fallen.length === 1 ? fallen[0] : `${fallen.length} foes`} down. The fight is over.`
    : "The fight goes against you. A last blow lands, and the world tips into black.";

  return {
    ok: true,
    reason: null,
    receipt,
    state: {
      ...state,
      combatSettlementReceipts: [...priorReceipts, receipt],
      character,
      world,
      beats: [
        ...(state.beats || []),
        { id: `tow-combat:${encounterId}:settled`, type: "narration", content },
      ],
    },
  };
}
