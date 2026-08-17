import { normalizeConditions } from "../../data/conditions.js";
import { XP } from "../../data/proficiencies.js";
import { advanceProgression, usesLegacyCharacterProgression } from "../../engine/progression.js";
import { cloneJsonData } from "../kernel/json-data.js";
import { readProductionCombatSession } from "./combat-session.js";

export const MAX_COMBAT_SETTLEMENT_RECEIPTS = 256;

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

function proficiencyGains(session) {
  const gains = {};
  const strikes = session.history.filter((command) => command.actionId === "strike").length;
  const guards = session.history.filter((command) => command.actionId === "guard").length;
  if (strikes > 0) {
    gains[session.initial.player.proficiencyId] = strikes * XP.WEAPON_HIT;
  }
  if (guards > 0) gains.endurance = guards * XP.ENDURANCE;
  return gains;
}

export function settleProductionCombat(state, { campaignId } = {}) {
  const opened = readProductionCombatSession(state?.activeCombatSession);
  if (!opened.ok) return rejected(opened.reason, state);
  const session = opened.session;
  if (session.campaignId !== campaignId) {
    return rejected("production-combat-campaign-mismatch", state);
  }
  if (!["victory", "defeat"].includes(session.status)) {
    return rejected("production-combat-not-terminal", state);
  }

  let priorReceipts;
  try {
    priorReceipts = cloneJsonData(state?.combatSettlementReceipts || []);
  } catch {
    return rejected("invalid-production-combat-settlement-receipts", state);
  }
  if (!Array.isArray(priorReceipts)) {
    return rejected("invalid-production-combat-settlement-receipts", state);
  }
  const prior = priorReceipts.find((receipt) => receipt?.sessionId === session.sessionId);
  if (prior) {
    return rejected("production-combat-already-settled", state, ownedReceipt(prior));
  }
  if (priorReceipts.length >= MAX_COMBAT_SETTLEMENT_RECEIPTS) {
    return rejected("production-combat-settlement-receipt-limit-exceeded", state);
  }

  let character;
  try {
    character = cloneJsonData(state.character);
  } catch {
    return rejected("invalid-production-combat-campaign-state", state);
  }
  const encounter = session.encounter;
  const player = encounter.actors[encounter.playerId];
  const enemy = encounter.actors[encounter.enemyIds[0]];
  character.vitality = session.status === "defeat"
    ? Math.max(1, Math.min(character.vitalityMax, Math.round(player.hp)))
    : Math.max(0, Math.min(character.vitalityMax, Math.round(player.hp)));
  if (session.status === "defeat") {
    const conditions = new Set((character.conditions || []).map((condition) => (
      typeof condition === "string" ? condition : condition?.name
    )).filter(Boolean));
    conditions.add("Gravely Wounded");
    conditions.add("Bleeding");
    character.conditions = normalizeConditions([...conditions]);
  }

  const gains = proficiencyGains(session);
  character.proficiencies = { ...(character.proficiencies || {}) };
  for (const [id, amount] of Object.entries(gains)) {
    character.proficiencies[id] = (character.proficiencies[id] || 0) + amount;
  }
  const progressionXp = Object.values(gains).reduce((sum, amount) => sum + amount, 0) * 10;
  const usesLegacyProgression = usesLegacyCharacterProgression(character);
  if (progressionXp > 0 && usesLegacyProgression) advanceProgression(character, progressionXp);

  const npcId = session.initial.enemy.npcId;
  let world = state.world;
  if (npcId && state.world?.codex?.characters?.[npcId]) {
    const characters = { ...state.world.codex.characters };
    const npc = { ...characters[npcId] };
    npc.combatState = {
      health: Math.max(0, Math.ceil(enemy.hp)),
      maxHealth: session.initial.enemy.maxHp,
      status: session.status === "victory"
        ? "dead"
        : enemy.hp < session.initial.enemy.maxHp ? "wounded" : "ok",
    };
    characters[npcId] = npc;
    const wanderer = characters.wanderer;
    if (wanderer && usesLegacyProgression && character.progression) {
      characters.wanderer = {
        ...wanderer,
        profession: character.profession,
        archetype: character.archetype,
        attributes: { ...(character.attributes || {}) },
        progression: cloneJsonData(character.progression),
      };
    }
    world = {
      ...state.world,
      codex: {
        ...state.world.codex,
        characters,
      },
    };
  }

  const receipt = ownedReceipt({
    version: 1,
    sessionId: session.sessionId,
    outcome: session.status,
    sequence: session.sequence,
    playerHp: player.hp,
    enemyHp: enemy.hp,
    proficiencyGains: gains,
    loot: "none",
  });
  const resultState = {
    ...state,
    activeCombatSession: null,
    combatSettlementReceipts: [...priorReceipts, receipt],
    character,
    world,
    pendingLoot: null,
    beats: [
      ...(state.beats || []),
      {
        id: `production-combat:${session.sessionId}:settled`,
        type: "narration",
        content: session.status === "victory"
          ? `${session.initial.enemy.name} falls. The fight is over.`
          : "The fight goes against you. A last blow lands, and the world tips into black.",
      },
    ],
  };
  return { ok: true, reason: null, state: resultState, receipt };
}
