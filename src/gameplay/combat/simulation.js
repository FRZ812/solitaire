// The harness that decides whether the fight is any good.
//
// A telegraph is only worth building if reading it wins fights. That claim is easy to
// assert and easy to get wrong, so it is measured here instead: two policies play the same
// fixtures from the same seeds, and the only difference between them is that one looks at
// what the enemies have declared and the other does not. If the informed policy does not
// pull clearly ahead, the telegraph is decoration and the balance needs work — and the
// gates in the accompanying test will say so rather than quietly passing.
//
// Everything here is deterministic. A run is identified by its seed, package, fixture and
// policy, and re-running that tuple reproduces the same fight down to the last hit. That
// is what makes a balance change reviewable: the numbers moved because the rules moved, not
// because the dice did.
//
// The policies deliberately draw from their own generator rather than the encounter's. A
// policy is not part of the fight; letting its coin-flips advance the combat stream would
// mean changing how the harness picks a skill changes what damage the fight rolls.

import { createRng, nextInt } from "../kernel/rng.js";
import { statusCount } from "../kernel/status-stack.js";
import {
  actorScaleValue,
  combatSkillLegality,
  controlNullifiesActor,
  createCombatEncounter,
  declaredIntents,
  endTurn,
  useSkill,
} from "./encounter.js";
import { combatBuildForCharacter } from "./professions.js";
import { effectMagnitude, getSkill } from "./skills.js";
import { legalSkillAnchors, resolveSkillTargets } from "./targeting.js";

export const COMBAT_SIMULATION_VERSION = 6;

/** A fight that has run this long has stopped being a fight; the run is recorded as a draw. */
export const MAX_SIMULATED_ROUNDS = 200;

/**
 * When the informed policy guards instead of attacking.
 *
 * The first version of this guarded whenever the incoming round threatened a quarter of the
 * player's effective health — and it lost to random play. As health fell the threshold fell
 * with it, so the policy guarded more and more, stopped attacking almost entirely, and
 * ground out forty-round fights it could not win. A rule that gets more defensive the worse
 * things go is a death spiral dressed up as caution.
 *
 * What replaced it compares the two options in the same units. Attacking is worth the damage
 * it deals; guarding is worth the damage it actually prevents, which is the smaller of the
 * shield gained and the damage declared. Guard when prevention beats progress — and use
 * the survival override only when the ward actually changes a lethal result.
 *
 * Both halves need the telegraph. Without a declaration there is no `incoming` to compare
 * against, and the rule degenerates to "always attack".
 */
export const GUARD_RULE = Object.freeze({
  compares: "damage-prevented-vs-damage-dealt",
  minimumCoverage: 0.6,
  dangerHorizonRounds: 2,
  survivalOverride: true,
});

/**
 * How close the end has to be before guarding beats racing.
 *
 * Prevention-beats-progress is the right comparison but it is not the whole rule, and the
 * missing half showed up the moment shields became worth having: a guard that prevents
 * fourteen against an attack that deals nine satisfies it *every round*, so the policy
 * guarded every round, won eventually, and took thirty-seven rounds to do it. Surviving is
 * not the same as winning, and a fight nobody can lose is still a fight nobody enjoys.
 *
 * Two rounds is the horizon. If the declared damage would not put the next round in doubt,
 * the shield is not urgent and the fight is better ended sooner — because every extra round
   * is another round of taking hits, and now another round that may demand scarce Resolve
   * the next fight will miss.
 */
export const DANGER_HORIZON_ROUNDS = 2;

/**
 * How much of the declared round a shield has to actually cover before guarding is worth an
 * action.
 *
 * Comparing prevention against progress is necessary but not sufficient, and the gap showed
 * up against groups: three wolves declaring thirty-seven damage into a twenty-point shield
 * satisfies "prevented beats progress" every round, so the policy guarded every round,
 * killed nothing, and lost to random play. Partial mitigation against a group is not
 * defence, it is a slower loss — the incoming never falls, because nothing ever dies.
 *
 * Requiring the shield to cover most of the blow encodes what a player does instinctively
 * here: if the guard cannot actually stop the round, race it instead and kill something, so
 * that next round's declaration is smaller.
 */
export const SHIELD_COVERAGE = 0.6;

const COMMAND_FORFEITING_STATUSES = new Set(["confuse", "paralyze", "sleep", "stun"]);
const BOUNDARY_DAMAGE_STATUSES = new Set([
  "bleed",
  "burn",
  "doom",
  "fatal-blade",
  "hellfire-spirit",
  "misfortune",
  "poison",
  "void-monster",
]);

// ---------------------------------------------------------------------------
// Reading the board
// ---------------------------------------------------------------------------

/** Which of the player's skills can legally be used right now. */
export function legalSkills(state) {
  return state.build.skills.filter((skillState) => (
    combatSkillLegality(state, skillState.id).ok
  ));
}

/** Exact accepted skill commands, including authoritative spatial anchors and targets. */
export function legalSkillCommands(state) {
  return legalSkills(state).flatMap((skillState) => {
    const definition = getSkill(skillState.id);
    return legalSkillAnchors(state, definition, state.playerId).flatMap((anchorCell) => {
      const resolved = resolveSkillTargets(state, definition, state.playerId, { anchorCell });
      if (!resolved.ok) return [];
      const probe = useSkill(
        state,
        skillState.id,
        resolved.primaryTargetId,
        state.playerId,
        anchorCell,
      );
      if (!probe.ok) return [];
      return [{
        skillState,
        targetId: resolved.primaryTargetId,
        targetIds: resolved.targetIds,
        anchorCell,
      }];
    });
  });
}

function policyCommand(option) {
  return {
    type: "use-skill",
    skillId: option.skillState.id,
    targetId: option.targetId,
    anchorCell: option.anchorCell,
  };
}

/**
 * What a skill does, in the terms a policy cares about.
 *
 * Read off the skill's own effects rather than a hand-kept list, so a skill added to the
 * catalogue is classified without anyone remembering to come back here.
 */
export function classifySkill(skillId) {
  const definition = getSkill(skillId);
  if (!definition) return { offensive: false, defensive: false, control: false };
  // `abilityType` describes the loadout slot, not tactical intent. A general ability can
  // be a ward, heal, attack, or control effect, so classifying every general slot as
  // offensive made the policy ignore Emergency Evasion and Urgent Guard entirely.
  const control = definition.effects.some((effect) => (
    effect.target === "enemy" && effect.type !== "damage"
  ));
  return {
    offensive: definition.effects.some((effect) => (
      effect.target === "enemy"
      && (effect.type.includes("damage") || effect.type.includes("status"))
    )),
    defensive: definition.abilityType === "defensive" || definition.effects.some((effect) => (
      effect.type === "shield"
      || effect.type.startsWith("heal")
      || (effect.target === "self" && ["guard", "steelskin", "protection", "solidity"].includes(effect.status))
    )),
    control,
  };
}

/** Whether using this skill deliberately gives away a later command window. */
function forfeitsFutureCommand(skillState) {
  const definition = getSkill(skillState.id);
  return Boolean(definition?.effects.some((effect) => (
    effect.target === "self" && COMMAND_FORFEITING_STATUSES.has(effect.status)
  )));
}

function projectionFactor(player, target, effect) {
  if (effect.scale) return actorScaleValue(player, effect.scale);
  const owner = effect.factorOwner === "enemy" ? target : player;
  if (!owner) return 0;
  if (effect.factorStatus) return statusCount(owner.statuses, effect.factorStatus);
  if (effect.factorScale === "current-hp") return owner.hp;
  if (effect.factorScale === "lost-hp") return Math.max(0, owner.maxHp - owner.hp);
  if (effect.factorScale === "max-hp") return owner.maxHp;
  return 0;
}

function projectedSourceAmount(player, target, effect, magnitude) {
  const factor = projectionFactor(player, target, effect);
  return Math.floor(effect.factorByRank ? factor * magnitude : (factor * magnitude) / 100);
}

/** The damage one use of a skill would deal to a target, before defence, crit and dodge. */
export function projectedDamage(state, skillState, targetId) {
  const definition = getSkill(skillState.id);
  const player = state.actors[state.playerId];
  const target = state.actors[targetId];
  if (!definition || !target) return 0;
  const authoredDirectDamage = (authoredPerHit, hits = 1) => (
    Math.max(0, authoredPerHit) * hits
  );
  return definition.effects.reduce((total, effect, index) => {
    if (effect.type === "damage-enemy-lost-hp") {
      const magnitude = effectMagnitude(skillState.id, index, skillState.rank);
      const authored = Math.floor(((target.maxHp - target.hp) * magnitude) / 100);
      return total + authoredDirectDamage(authored);
    }
    if (effect.type === "damage-self-lost-hp") {
      const magnitude = effectMagnitude(skillState.id, index, skillState.rank);
      const authored = Math.floor(((player.maxHp - player.hp) * magnitude) / 100);
      return total + authoredDirectDamage(authored);
    }
    if (effect.type === "damage-enemy-max-hp") {
      const magnitude = effectMagnitude(skillState.id, index, skillState.rank);
      const authored = Math.floor((target.maxHp * magnitude) / 100);
      return total + authored;
    }
    if (effect.type === "delayed-damage") {
      return total + effectMagnitude(skillState.id, index, skillState.rank);
    }
    // Damage statuses resolve at the coming boundary. Count at least that first tick when
    // comparing a status attack with a direct strike; their later lifetime is intentionally
    // not assumed here.
    if (
      effect.target === "enemy"
      && ["scaled-status", "status", "status-from-status"].includes(effect.type)
      && BOUNDARY_DAMAGE_STATUSES.has(effect.status)
    ) {
      const magnitude = effectMagnitude(skillState.id, index, skillState.rank);
      return total + (effect.type === "status" ? magnitude : projectedSourceAmount(player, target, effect, magnitude));
    }
    if (effect.type === "scale-status" && effect.target === "enemy") {
      const magnitude = effectMagnitude(skillState.id, index, skillState.rank);
      return total + effect.statuses.reduce((gain, status) => {
        if (!BOUNDARY_DAMAGE_STATUSES.has(status)) return gain;
        const before = statusCount(target.statuses, status);
        return gain + Math.max(0, Math.floor((before * magnitude) / 100) - before);
      }, 0);
    }
    if (effect.type === "scaled-status-enemy-lost-hp") {
      const magnitude = effectMagnitude(skillState.id, index, skillState.rank);
      return total + Math.floor(((target.maxHp - target.hp) * magnitude) / 100);
    }
    if (effect.type !== "damage") return total;
    const magnitude = effectMagnitude(skillState.id, index, skillState.rank);
    return total + authoredDirectDamage(
      projectedSourceAmount(player, target, effect, magnitude),
      effect.hits || 1,
    );
  }, 0);
}

/** The damage every living foe has declared for the coming round, added up. */
export function incomingDamage(state) {
  return declaredIntents(state).reduce((total, intent) => total + intent.hits * intent.damage, 0);
}

/** The shield one use of a skill would put up. */
export function projectedShield(state, skillState) {
  const definition = getSkill(skillState.id);
  const player = state.actors[state.playerId];
  if (!definition) return 0;
  return definition.effects.reduce((total, effect, index) => {
    if (effect.type !== "shield") return total;
    const magnitude = effectMagnitude(skillState.id, index, skillState.rank);
    return total + Math.floor((actorScaleValue(player, effect.scale) * magnitude) / 100);
  }, 0);
}

function livingEnemyIds(state) {
  return state.enemyIds.filter((id) => state.actors[id].hp > 0);
}

/** Immediate HP restored by one use, for policies comparing recovery with progress. */
export function projectedRecovery(state, skillState) {
  const definition = getSkill(skillState.id);
  const player = state.actors[state.playerId];
  if (!definition || !player) return 0;
  return definition.effects.reduce((total, effect, index) => {
    if (effect.type === "heal-lost-fraction") {
      const magnitude = effectMagnitude(skillState.id, index, skillState.rank);
      return total + Math.floor(((player.maxHp - player.hp) * magnitude) / 100);
    }
    if (effect.type === "heal-flat") {
      return total + effectMagnitude(skillState.id, index, skillState.rank);
    }
    if (effect.type === "heal") {
      const magnitude = effectMagnitude(skillState.id, index, skillState.rank);
      return total + projectedSourceAmount(player, null, effect, magnitude);
    }
    return total;
  }, 0);
}

function consecutiveDefensiveRounds(state) {
  const defendedRounds = new Set(state.events
    .filter((event) => event.type === "skill-committed"
      && event.actorId === state.playerId
      && classifySkill(event.skillId).defensive)
    .map((event) => event.round));
  let streak = 0;
  for (let round = state.round - 1; defendedRounds.has(round); round -= 1) streak += 1;
  return streak;
}

function isFreshDefensiveSetup(state, skillState) {
  const definition = getSkill(skillState.id);
  const player = state.actors[state.playerId];
  if (!definition || !player) return false;
  return definition.effects.some((effect) => (
    effect.target === "self"
    && ["guard", "protection", "solidity", "steelskin"].includes(effect.status)
    && statusCount(player.statuses, effect.status) <= 0
  ));
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

/**
 * Play legally, at random, with no attention paid to anything.
 *
 * The control group. It is not a bad player — every move it makes is legal and most are
 * reasonable — it simply never uses the information the telegraph provides.
 */
export const randomLegalPolicy = Object.freeze({
  id: "random-legal",
  usesIntent: false,
  decide(state, rng) {
    const options = legalSkillCommands(state);
    if (options.length === 0) {
      return { command: { type: "end-turn" }, rng };
    }
    // End-turn is one option among the skills, so the policy does not simply spend every
    // action it has every round.
    const pick = nextInt(rng, 0, options.length);
    if (pick.value === options.length) return { command: { type: "end-turn" }, rng: pick.rng };
    return {
      command: policyCommand(options[pick.value]),
      rng: pick.rng,
    };
  },
});

/**
 * Play the fight in front of you.
 *
 * Three reads, in order of how much they change the round:
 *
 *   1. Finish a foe you can finish. A dead foe deals no damage, so removing one is worth
 *      more than any amount of mitigation.
 *   2. Guard when the declared round would take a real bite out of you.
 *   3. Otherwise hit the foe closest to falling, so the group shrinks fastest.
 *
 * Every one of these needs the declarations. Strip the telegraph out and this policy
 * collapses into "attack the weakest thing", which is where the measured gap comes from.
 */
export const intentAwarePolicy = Object.freeze({
  id: "intent-aware",
  usesIntent: true,
  decide(state, rng) {
    if (state.turn.actionsRemaining <= 0) return { command: { type: "end-turn" }, rng };
    const commandOptions = legalSkillCommands(state);
    const options = [...new Map(commandOptions.map((option) => (
      [option.skillState.id, option.skillState]
    ))).values()];
    const targets = livingEnemyIds(state);
    if (options.length === 0 || targets.length === 0) {
      return { command: { type: "end-turn" }, rng };
    }
    const optionFor = (skillState, preferredTargetId = null) => {
      const matching = commandOptions.filter((option) => option.skillState.id === skillState.id);
      return matching.find((option) => option.targetIds.includes(preferredTargetId))
        || matching[0]
        || null;
    };

    const offensive = options.filter((skillState) => classifySkill(skillState.id).offensive);
    const defensive = options.filter((skillState) => classifySkill(skillState.id).defensive);
    const weakest = targets.reduce((lowest, id) => (
      state.actors[id].hp < state.actors[lowest].hp ? id : lowest
    ), targets[0]);
    const player = state.actors[state.playerId];
    const incoming = incomingDamage(state);

    // Do not spend the one paid-ability window on a quick setup when the declared blow
    // requires a paid guard to survive. The shared Resolve cadence deliberately makes that
    // choice exclusive; an informed policy reserves it before considering extra inputs.
    if (incoming >= player.hp + player.shield && defensive.length > 0) {
      const emergencyGuard = defensive.reduce((strongest, skillState) => (
        projectedShield(state, skillState) > projectedShield(state, strongest)
          ? skillState
          : strongest
      ), defensive[0]);
      const shield = Math.max(player.shield, projectedShield(state, emergencyGuard));
      if (incoming < player.hp + shield) {
        return { command: policyCommand(optionFor(emergencyGuard, targets[0])), rng };
      }
    }

    // A paid finisher also reserves the shared cadence window. Do not spend that window on
    // a non-turn setup when a legal attack already removes a foe before it can answer.
    for (const targetId of targets) {
      const target = state.actors[targetId];
      const finisher = offensive.find(
        (skillState) => optionFor(skillState, targetId)
          && projectedDamage(state, skillState, targetId) >= target.hp + target.shield,
      );
      if (finisher) {
        return { command: policyCommand(optionFor(finisher, targetId)), rng };
      }
    }

    // A no-turn ability is an extra input inside this command window, not an alternative
    // to the main action. Use direct free attacks first, then a setup whose effect changes
    // the board. Temporary wards wait until spent; permanent buffs may stack when the
    // additional commitment is worth their shared Resolve cost.
    const freeActions = options.filter((skillState) => {
      const definition = getSkill(skillState.id);
      return definition?.consumesTurn === false;
    });
    if (freeActions.length > 0) {
      const bestFree = freeActions.reduce((best, skillState) => (
        projectedDamage(state, skillState, weakest) > projectedDamage(state, best, weakest)
          ? skillState
          : best
      ), freeActions[0]);
      return { command: policyCommand(optionFor(bestFree, weakest)), rng };
    }


    // The best attack available, and what it would be worth: press whoever is closest to
    // falling, so the group — and the damage it declares each round — shrinks fastest.
    // A self-Paralyze is a real future action cost now. Keep Mortal Blow and similar skills
    // as finishers (the check above), but do not call them the best routine attack merely
    // because their coefficient is largest. An informed player would not repeatedly trade
    // every second command window for overkill while a safe, Resolve-free strike is available.
    const sustainableOffensive = offensive.filter((skillState) => !forfeitsFutureCommand(skillState));
    const routineOffensive = sustainableOffensive.length > 0 ? sustainableOffensive : offensive;
    const bestAttack = routineOffensive.length > 0
      ? routineOffensive.reduce((strongest, skillState) => (
        projectedDamage(state, skillState, weakest) > projectedDamage(state, strongest, weakest)
          ? skillState
          : strongest
      ), routineOffensive[0])
      : null;
    const progress = bestAttack ? projectedDamage(state, bestAttack, weakest) : 0;

    // 2. Guard when guarding is worth more than attacking — measured, not assumed.
    // A multi-window defensive status is setup, not Ward. Establish it once while the
    // current declaration is survivable, then attack behind the remaining per-hit stacks.
    // This distinction keeps Guard useful without letting the one-window shield pool bank.
    const defensiveSetup = defensive.find((skillState) => isFreshDefensiveSetup(state, skillState));
    if (defensiveSetup && incoming < player.hp + player.shield) {
      return { command: policyCommand(optionFor(defensiveSetup, weakest)), rng };
    }

    const recovery = options
      .map((skillState) => ({ skillState, amount: projectedRecovery(state, skillState) }))
      .filter((entry) => entry.amount > 0)
      .sort((first, second) => second.amount - first.amount)[0];
    if (recovery) {
      const lethalNow = incoming >= player.hp + player.shield;
      const survivesAfterRecovery = incoming < player.hp + player.shield + recovery.amount;
      const endangered = incoming * DANGER_HORIZON_ROUNDS >= player.hp + player.shield;
      if ((lethalNow && survivesAfterRecovery) || (endangered && recovery.amount > progress)) {
        return {
          command: policyCommand(optionFor(recovery.skillState, weakest)),
          rng,
        };
      }
    }

    if (defensive.length > 0 && incoming > 0) {
      const bestGuard = defensive.reduce((strongest, skillState) => (
        projectedShield(state, skillState) > projectedShield(state, strongest) ? skillState : strongest
      ), defensive[0]);
      const shield = Math.max(player.shield, projectedShield(state, bestGuard));
      const prevented = Math.min(shield, incoming);
      // A ward only earns the survival override if it actually changes the outcome of this
      // command window. Guarding a lethal 40-point blow with 20 Ward is still a loss, and
      // repeating that futile action was the policy's old death spiral.
      const lethalWithoutGuard = incoming >= player.hp + player.shield;
      const survivesWithGuard = incoming < player.hp + shield;
      const survivalOverride = lethalWithoutGuard && survivesWithGuard;
      const covers = shield >= incoming * SHIELD_COVERAGE;
      // Not merely "is guarding worth more than attacking", but "is it worth more *and*
      // needed". Without the second half the policy guards on every round it can afford to,
      // and grinds out fights it should have finished.
      const endangered = incoming * DANGER_HORIZON_ROUNDS >= player.hp + player.shield;
      const defensiveStreak = consecutiveDefensiveRounds(state);
      const survivalGuardAvailable = survivalOverride && defensiveStreak < 2;
      const routineGuardAvailable = defensiveStreak === 0;
      if (survivalGuardAvailable || (routineGuardAvailable && endangered && covers && prevented > progress)) {
        return { command: policyCommand(optionFor(bestGuard, targets[0])), rng };
      }
    }

    // 3. Otherwise press the advantage.
    if (bestAttack) {
      return { command: policyCommand(optionFor(bestAttack, weakest)), rng };
    }

    return { command: { type: "end-turn" }, rng };
  },
});

export const SIMULATION_POLICIES = Object.freeze([randomLegalPolicy, intentAwarePolicy]);

// ---------------------------------------------------------------------------
// Running one fight
// ---------------------------------------------------------------------------

/**
 * Play one fight to its end and record what happened.
 *
 * The record is the artifact: seed, package, fixture, policy, and everything a balance
 * argument might need to cite — turns, outcome, health left, what was spent, and how many
 * legal options went untouched.
 */
export function simulateEncounter({
  seed,
  player,
  enemies,
  build,
  policy,
  packageId = null,
  fixtureId = null,
  maxRounds = MAX_SIMULATED_ROUNDS,
}) {
  let state = createCombatEncounter({ seed, player, enemies, build });
  let rng = createRng(`${seed}::policy::${policy.id}`);

  const skillUses = {};
  let commands = 0;
  let refusals = 0;
  let turnsWithNoLegalSkill = 0;
  let unusedLegalOptions = 0;

  while (state.phase === "player" && state.round <= maxRounds) {
    const options = legalSkills(state);
    // The gate is "a capable actor always has something to do". An actor who has already
    // spent their action is not capable this instant, and counting that as a dead end would
    // report every normal turn as a failure.
    if (options.length === 0
      && state.turn.actionsRemaining > 0
      && !controlNullifiesActor(state, state.playerId)) {
      turnsWithNoLegalSkill += 1;
    }

    const decision = policy.decide(state, rng);
    rng = decision.rng;
    const command = decision.command;

    if (command.type === "end-turn") {
      // Everything still legal at the moment the turn is handed over is an option the
      // policy chose not to take — the plan's "unused legal options".
      unusedLegalOptions += options.length;
      const result = endTurn(state);
      if (!result.ok) return sealRun({ reason: result.reason });
      state = result.state;
      commands += 1;
      continue;
    }

    const result = useSkill(
      state,
      command.skillId,
      command.targetId,
      state.playerId,
      command.anchorCell || null,
    );
    if (!result.ok) {
      // A refused command still costs the policy its decision; ending the turn keeps the
      // fight moving rather than spinning on an illegal choice forever.
      refusals += 1;
      const ended = endTurn(state);
      if (!ended.ok) return sealRun({ reason: ended.reason });
      state = ended.state;
      commands += 1;
      continue;
    }
    skillUses[command.skillId] = (skillUses[command.skillId] || 0) + 1;
    state = result.state;
    commands += 1;
  }

  return sealRun({ reason: null });

  function sealRun({ reason }) {
    const survivor = state.actors[state.playerId];
    const outcome = state.phase === "player" ? "draw" : state.phase;
    return {
      version: COMBAT_SIMULATION_VERSION,
      seed,
      packageId,
      fixtureId,
      policyId: policy.id,
      outcome,
      reason,
      rounds: state.round,
      commands,
      refusals,
      playerHp: survivor.hp,
      playerHpFraction: survivor.maxHp > 0 ? survivor.hp / survivor.maxHp : 0,
      enemiesDown: state.enemyIds.filter((id) => state.actors[id].hp <= 0).length,
      skillUses,
      turnsWithNoLegalSkill,
      unusedLegalOptions,
    };
  }
}

// ---------------------------------------------------------------------------
// Fixtures and batches
// ---------------------------------------------------------------------------

/**
 * The standard actor every package is measured on.
 *
 * Packages differ by trait and loadout, not by stat line, so holding the stats fixed is
 * what makes two packages comparable at all. The real bridge from a Solitaire character is
 * tested separately; mixing it in here would measure the bridge instead of the fight.
 */
export function standardPlayer(overrides = {}) {
  return {
    id: "wanderer",
    name: "Wanderer",
    maxHp: 120,
    resolve: 8,
    resolveMax: 8,
    resolveRegen: 1,
    stats: { attack: 14, defense: 8, critRate: 5, dodgeRate: 5 },
    ...overrides,
  };
}

function foe(id, name, maxHp, attack, attacks) {
  return {
    id,
    name,
    maxHp,
    stats: { attack, defense: 0, critRate: 4, dodgeRate: 3 },
    attacks,
  };
}

function moveSet(id, light, mid, heavy) {
  return [
    { id: `${id}-jab`, name: "Jab", hits: 1, damage: light },
    { id: `${id}-swing`, name: "Swing", hits: 1, damage: mid },
    { id: `${id}-heavy`, name: "Heavy blow", hits: 1, damage: heavy },
    { id: `${id}-flurry`, name: "Flurry", hits: 2, damage: Math.max(1, Math.round(light * 0.7)) },
  ];
}

/**
 * Authored fixtures, pitched to be a real fight for a level-one package.
 *
 * These are a test stratum, not a runtime rubber-band: the live world picks threats from
 * region, faction and who the enemy actually is, and never scales them to the player.
 */
/**
 * Authored fixtures, calibrated rather than guessed.
 *
 * Every number below came out of a grid sweep across the whole package list, not out of
 * intuition. The current health values and recorded rates were re-measured after importing
 * the shipped 1.4.16 critical multiplier and status lifecycles; retaining the older health
 * pool made exact source rules lock basic packages out of otherwise equal-threat fixtures.
 *
 * `standard` fixtures are the equal-threat stratum the acceptance band applies to.
 * `hard` is deliberately above parity: three wolves against one traveller is a fight the
 * world is allowed to contain and the player is expected to avoid, scout, or bring help to.
 * Flattening it into the band would mean level-scaling the world to the protagonist, which
 * is the thing this design explicitly refuses to do.
 */
export const STANDARD_FIXTURES = Object.freeze([
  Object.freeze({
    id: "lone-brigand",
    name: "A brigand on the road",
    tier: "standard",
    baseline: Object.freeze({ informedWinRate: 0.616667, randomWinRate: 0.02 }),
    enemies: Object.freeze([foe("foe-0", "Brigand", 120, 23, moveSet("foe-0", 14, 23, 36))]),
  }),
  Object.freeze({
    id: "brigand-pair",
    name: "Two brigands",
    tier: "standard",
    baseline: Object.freeze({ informedWinRate: 0.963333, randomWinRate: 0.06 }),
    enemies: Object.freeze([
      foe("foe-0", "Brigand", 54, 13, moveSet("foe-0", 9, 13, 20)),
      foe("foe-1", "Brigand", 54, 13, moveSet("foe-1", 9, 13, 20)),
    ]),
  }),
  Object.freeze({
    id: "armoured-duelist",
    name: "An armoured duelist",
    tier: "standard",
    baseline: Object.freeze({ informedWinRate: 0.483333, randomWinRate: 0.023333 }),
    enemies: Object.freeze([{
      ...foe("foe-0", "Duelist", 122, 22, moveSet("foe-0", 14, 22, 35)),
      stats: { attack: 22, defense: 6, critRate: 6, dodgeRate: 8 },
    }]),
  }),
  Object.freeze({
    id: "wolf-pack",
    name: "Three wolves",
    tier: "hard",
    baseline: Object.freeze({ informedWinRate: 0.60, randomWinRate: 0.01 }),
    enemies: Object.freeze([
      foe("foe-0", "Wolf", 32, 12, moveSet("foe-0", 8, 12, 17)),
      foe("foe-1", "Wolf", 32, 12, moveSet("foe-1", 8, 12, 17)),
      foe("foe-2", "Wolf", 32, 12, moveSet("foe-2", 8, 12, 17)),
    ]),
  }),
]);

/** The equal-threat stratum the acceptance band is defined over. */
export const EQUAL_THREAT_FIXTURES = Object.freeze(
  STANDARD_FIXTURES.filter((fixture) => fixture.tier === "standard"),
);

/**
 * The gates, as recorded numbers rather than folklore.
 *
 * Moving any of these requires a fresh sweep and a reason, which is the point: a balance
 * change that quietly relaxes its own acceptance test has not been reviewed.
 */
export const ACCEPTANCE_TARGETS = Object.freeze({
  // Resolve v6 measures free-basic recovery and scarce paid windows against recalibrated threats:
  // informed play wins 0.688 while random legal play wins about 0.034. The 0.60–0.80 band keeps
  // good tactics viable without letting equal threats collapse into guaranteed victories.
  informedWinRateMin: 0.60,
  informedWinRateMax: 0.80,
  // Shared Resolve makes wasteful sequencing genuinely costly. Requiring a fifty-point
  // gap protects the design claim that reading declarations and rationing power decide fights.
  informedAdvantageMin: 0.50,
  // Current per-package medians run 5–12 rounds. Fifteen allows modest balance movement but
  // catches a return to the old long-resource-war pacing before it reaches production.
  medianRoundsMax: 15,
});

export function getStandardFixture(fixtureId) {
  return STANDARD_FIXTURES.find((fixture) => fixture.id === fixtureId) || null;
}

/** A reproducible seed set. The same name always yields the same fights. */
export function seedSet(name, count) {
  return Array.from({ length: count }, (_, index) => `${name}::${index}`);
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/** Run one package against one fixture under one policy, across a seed set. */
export function simulateMatchup({ packageId, fixture, policy, seeds, level = 1, player }) {
  const build = combatBuildForCharacter({ profession: packageId, level });
  const runs = seeds.map((seed) => simulateEncounter({
    seed: `${fixture.id}::${packageId}::${seed}`,
    player: player || standardPlayer(),
    enemies: fixture.enemies.map((enemy) => ({ ...enemy })),
    build,
    policy,
    packageId,
    fixtureId: fixture.id,
  }));

  const wins = runs.filter((run) => run.outcome === "victory").length;
  const spent = {};
  for (const run of runs) {
    for (const [skillId, count] of Object.entries(run.skillUses)) {
      spent[skillId] = (spent[skillId] || 0) + count;
    }
  }
  return {
    version: COMBAT_SIMULATION_VERSION,
    packageId,
    fixtureId: fixture.id,
    policyId: policy.id,
    runs,
    total: runs.length,
    wins,
    winRate: runs.length > 0 ? wins / runs.length : 0,
    draws: runs.filter((run) => run.outcome === "draw").length,
    medianRounds: median(runs.map((run) => run.rounds)),
    medianPlayerHpFraction: median(runs.map((run) => run.playerHpFraction)),
    turnsWithNoLegalSkill: runs.reduce((total, run) => total + run.turnsWithNoLegalSkill, 0),
    refusals: runs.reduce((total, run) => total + run.refusals, 0),
    skillUses: spent,
  };
}

/** Every package against every fixture, under one policy. */
export function simulateSweep({ packageIds, fixtures = STANDARD_FIXTURES, policy, seeds, level = 1 }) {
  const matchups = [];
  for (const packageId of packageIds) {
    for (const fixture of fixtures) {
      matchups.push(simulateMatchup({ packageId, fixture, policy, seeds, level }));
    }
  }
  const total = matchups.reduce((sum, matchup) => sum + matchup.total, 0);
  const wins = matchups.reduce((sum, matchup) => sum + matchup.wins, 0);
  return {
    version: COMBAT_SIMULATION_VERSION,
    policyId: policy.id,
    matchups,
    total,
    wins,
    winRate: total > 0 ? wins / total : 0,
  };
}
