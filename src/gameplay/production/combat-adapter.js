import { weaponMasteryId } from "../../data/proficiencies.js";
import { hashSeed } from "../../engine/combat-rng.js";
import { deriveCombatStats } from "../../engine/combat-stats.js";

function unsupported(reason) {
  return { ok: false, reason: `unsupported-${reason}`, input: null };
}

function emptyArray(value) {
  return value === undefined || (Array.isArray(value) && value.length === 0);
}

function finiteCombatNumber(value, { positive = false } = {}) {
  return Number.isFinite(value) && value >= (positive ? 1 : 0);
}

function unsupportedEnemyMechanics(enemy) {
  return !emptyArray(enemy.abilities)
    || !emptyArray(enemy.statuses)
    || !emptyArray(enemy.procs)
    || (enemy.actionsPerTurn !== undefined && enemy.actionsPerTurn !== 1)
    || Number(enemy.block || 0) !== 0
    || Number(enemy.shield || 0) !== 0
    || Number(enemy.magicShield || 0) !== 0
    || Number(enemy.invuln || 0) !== 0;
}

export function adaptNarratorCombatStart({
  campaignId,
  state,
  directive,
  enemies,
  sourceKind = "narrator",
} = {}) {
  if (sourceKind !== "narrator" && sourceKind !== "travel") return unsupported("source-kind");
  if (!Array.isArray(enemies) || enemies.length !== 1) return unsupported("multiple-enemies");
  if (!Array.isArray(state?.party) || state.party.length > 0) return unsupported("party-companion");
  if (!emptyArray(state?.character?.abilities)) return unsupported("player-ability");
  if (!emptyArray(state?.character?.conditions)) return unsupported("player-condition");
  if (!emptyArray(state?.character?.racialPassives)) return unsupported("player-passive");
  if (directive?.surprise === true) return unsupported("surprise");
  if (directive?.lethal === false) return unsupported("nonlethal");
  if (state?.pendingLoot) return unsupported("unsettled-loot");
  if (state?.activeCombatSession) return unsupported("active-combat-session");
  if (!Number.isSafeInteger(state?.productionCombatSequence) || state.productionCombatSequence < 0) {
    return unsupported("combat-sequence");
  }

  const enemy = enemies[0];
  if (!emptyArray(enemy?.abilities)) return unsupported("enemy-ability");
  if (unsupportedEnemyMechanics(enemy)) return unsupported("enemy-mechanic");
  if (
    !finiteCombatNumber(enemy?.health, { positive: true })
    || !finiteCombatNumber(enemy?.maxHealth, { positive: true })
    || !finiteCombatNumber(enemy?.weapon?.min)
    || !finiteCombatNumber(enemy?.weapon?.max)
    || !finiteCombatNumber(Number(enemy?.armor || 0))
    || !finiteCombatNumber(Number(enemy?.ward || 0))
    || !finiteCombatNumber(Number(enemy?.dodge || 0))
    || enemy.weapon.max < enemy.weapon.min
  ) return unsupported("enemy-profile");

  let playerStats;
  try {
    playerStats = deriveCombatStats(state.character, state.world?.codex || {});
  } catch {
    return unsupported("player-profile");
  }
  const maxHp = Math.max(1, Math.round(playerStats.maxHealth));
  const baseMaxHp = Math.max(1, Math.round(state.character.vitalityMax));
  const healthBonus = Math.max(0, maxHp - baseMaxHp);
  const hp = Math.max(1, Math.min(maxHp, Math.round(state.character.vitality) + healthBonus));
  const attack = Math.max(1, Math.round((playerStats.weapon.min + playerStats.weapon.max) / 2));
  const defense = Math.max(0, Math.round((playerStats.armor || 0) + (playerStats.ward || 0)));
  // Production v1 collapses passive armour, ward, and half of legacy dodge into
  // one replay-visible mitigation stat. Active blocks, shields, invulnerability,
  // procs, statuses, and abilities remain explicitly unsupported above.
  const enemyDefense = Math.max(0, Math.round(
    Number(enemy.armor || 0)
    + Number(enemy.ward || 0)
    + Number(enemy.dodge || 0) / 2,
  ));
  const sequence = state.productionCombatSequence;

  return {
    ok: true,
    nextSequence: sequence + 1,
    input: {
      campaignId,
      sessionId: `${campaignId}:combat:${sequence}`,
      seed: hashSeed([
        campaignId,
        state.world?.seed || "world",
        sequence,
        directive?.note || enemy.name,
      ]),
      source: {
        kind: sourceKind,
        note: directive?.note || enemy.name || "A hostile encounter begins.",
        lethal: true,
      },
      player: {
        name: state.character.name || "Wanderer",
        hp,
        maxHp,
        attack,
        defense,
        proficiencyId: weaponMasteryId(playerStats.weapon.category),
      },
      enemy: {
        name: enemy.name || "Hostile foe",
        hp: Math.max(1, Math.round(enemy.health)),
        maxHp: Math.max(1, Math.round(enemy.maxHealth)),
        damage: {
          min: Math.max(0, Math.round(enemy.weapon.min)),
          max: Math.max(0, Math.round(enemy.weapon.max)),
        },
        defense: enemyDefense,
        npcId: typeof enemy.npcId === "string" && enemy.npcId.length > 0
          ? enemy.npcId
          : null,
      },
    },
  };
}
