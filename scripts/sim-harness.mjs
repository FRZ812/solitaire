// Shared simulation harness — the single place that knows how to drive a fight.
//
// Every balance sim (combat, boss-parity, item-balance, execute) funnels through
// `simulateFight` so the combat-loop rewrite is a one-file edit here rather than
// four divergent copies. Nothing below assumes a deck, energy, a hand, or a
// per-profession resource: it advances whatever loop the engine is running.
//
// Run sims via the Vite loader, not bare node:
//   node scripts/run-sim.mjs combat-sim 500

import {
  initCombat, playerAct, endTurn, abilityUsable, canStandDown, playerStandDown,
} from "../src/engine/combat.js";
import { chooseAction } from "../src/engine/combat-ai.js";
import { getAbilityDef, BASIC_ATTACK } from "../src/data/abilities.js";

export const TERMINAL = new Set(["victory", "defeat", "resolved", "playerFled"]);

const DEFAULT_CAP = 400;
// Bounds the "spend everything this turn" inner loop. Well above any real action
// economy, low enough that a bug that stops consuming actions fails fast instead
// of hanging the sim.
const ACTS_PER_TURN_CAP = 24;

function liveFoes(cs) {
  return cs.enemies.filter((e) => e.health > 0 && !e.resolved && !e._dead);
}

function usableCandidates(cs) {
  return (cs.player.abilities || [])
    .map((a) => ({ id: a.id, tier: a.tier || "common", def: getAbilityDef(a.id) }))
    .filter((c) => c.def && c.id !== "talk" && abilityUsable(cs, c.id));
}

/**
 * The considered player: the shared combat AI, same brain the enemies use.
 * This is the "plays well" arm of the skill-delta measurement.
 */
export function greedyPolicy(cs) {
  const foes = liveFoes(cs);
  if (foes.length === 0) return null;
  const party = [cs.player, ...(cs.allies || [])].filter((a) => a.health > 0 && !a._dead && !a.resolved);
  const choice = chooseAction(cs.player, foes, usableCandidates(cs), { allies: party });
  if (!choice) {
    return abilityUsable(cs, BASIC_ATTACK.id)
      ? { abilityId: BASIC_ATTACK.id, targetIndex: cs.enemies.indexOf(foes[0]) }
      : null;
  }
  const target = choice.target || foes[0];
  return { abilityId: choice.ability.id, targetIndex: cs.enemies.indexOf(target) };
}

/**
 * The unconsidered player: a legal move, chosen at random, against a random
 * live foe. This is the control arm. The gap between this and `greedyPolicy` is
 * the game's skill expression — if it is small, outcomes are luck, which is the
 * exact criticism the redesign is built to answer.
 */
export function randomPolicy(cs) {
  const foes = liveFoes(cs);
  if (foes.length === 0) return null;
  const options = usableCandidates(cs).map((c) => c.id);
  if (abilityUsable(cs, BASIC_ATTACK.id)) options.push(BASIC_ATTACK.id);
  if (options.length === 0) return null;
  const abilityId = options[Math.floor(Math.random() * options.length)];
  const target = foes[Math.floor(Math.random() * foes.length)];
  return { abilityId, targetIndex: cs.enemies.indexOf(target) };
}

/** Always defends. Used to prove that turtling is not a winning strategy. */
export function turtlePolicy(cs) {
  const foes = liveFoes(cs);
  if (foes.length === 0) return null;
  for (const id of ["bulwark-stance", "defend", "guard"]) {
    if (abilityUsable(cs, id)) return { abilityId: id, targetIndex: cs.enemies.indexOf(foes[0]) };
  }
  return abilityUsable(cs, BASIC_ATTACK.id)
    ? { abilityId: BASIC_ATTACK.id, targetIndex: cs.enemies.indexOf(foes[0]) }
    : null;
}

/**
 * Drive one fight to a terminal phase.
 *
 * Two things here are deliberate, and both were bugs in the previous inline
 * copy in combat-sim.mjs:
 *
 *  1. A non-player phase ADVANCES the engine (`endTurn`) instead of breaking out
 *     of the fight. Breaking out left the state non-terminal, so the caller
 *     counted it as neither win nor loss — which is why several scenarios
 *     reported a flat 0%.
 *  2. The player spends every action available in a turn, not one. Under the
 *     three-energy deck model, acting once and ending the turn threw away two
 *     thirds of the turn and made every calibration number meaningless.
 */
export function simulateFight({
  player, codex, enemies, allies = [], opts = {}, policy = greedyPolicy, cap = DEFAULT_CAP,
}) {
  let cs = initCombat(player, codex, enemies, { allies, ...opts });
  let steps = 0;
  let acts = 0;

  while (!TERMINAL.has(cs.phase) && steps < cap) {
    steps += 1;

    if (cs.phase !== "player") { cs = endTurn(cs); continue; }
    if (canStandDown(cs)) { cs = playerStandDown(cs); break; }

    let spent = 0;
    let acted = true;
    while (acted && spent < ACTS_PER_TURN_CAP && !TERMINAL.has(cs.phase)) {
      const move = policy(cs);
      if (move && abilityUsable(cs, move.abilityId)) {
        cs = playerAct(cs, move.abilityId, move.targetIndex);
        acts += 1;
        spent += 1;
      } else acted = false;
    }

    if (TERMINAL.has(cs.phase)) break;
    cs = endTurn(cs);
  }

  return {
    cs,
    acts,
    steps,
    rounds: cs.round || cs.turn || 0,
    // A fight that hit the cap is a harness or engine failure, never a result.
    // Callers must surface this rather than folding it into a win rate.
    aborted: !TERMINAL.has(cs.phase),
  };
}

/** Roll up N fights into the stats every sim reports. */
export function summarize(label, makeRun, runs) {
  let wins = 0, losses = 0, resolved = 0, fled = 0, aborted = 0;
  let rounds = 0, hp = 0, acts = 0, yields = 0, allyDeaths = 0, allyCount = 0;

  for (let i = 0; i < runs; i += 1) {
    const result = makeRun(i);
    const { cs } = result;
    if (result.aborted) { aborted += 1; continue; }
    if (cs.phase === "victory") wins += 1;
    else if (cs.phase === "resolved") { resolved += 1; wins += 1; } // you stood, they broke
    else if (cs.phase === "defeat") losses += 1;
    else if (cs.phase === "playerFled") fled += 1;
    rounds += result.rounds;
    acts += result.acts / Math.max(1, result.rounds);
    hp += cs.player.health / Math.max(1, cs.player.maxHealth);
    yields += cs.enemies.filter((e) => e.resolved === "yielded").length;
    allyCount += (cs.allies || []).length;
    allyDeaths += (cs.allies || []).filter((a) => a._dead).length;
  }

  const scored = runs - aborted;
  const denom = Math.max(1, scored);
  return {
    label, runs, scored, aborted,
    winRate: wins / denom,
    lossRate: losses / denom,
    fledRate: fled / denom,
    resolvedRate: resolved / denom,
    rounds: rounds / denom,
    actsPerRound: acts / denom,
    endHp: hp / denom,
    yieldRate: yields / Math.max(1, allyCount + denom),
    allyDeathRate: allyDeaths / Math.max(1, allyCount),
  };
}

const pct = (n) => `${(n * 100).toFixed(0)}%`;

export function report(stats) {
  const line = [
    stats.label.padEnd(34),
    `win ${pct(stats.winRate).padStart(4)}`,
    `· lose ${pct(stats.lossRate).padStart(4)}`,
    `· rounds ${stats.rounds.toFixed(1).padStart(4)}`,
    `· acts/rd ${stats.actsPerRound.toFixed(2)}`,
    `· endHP ${pct(stats.endHp).padStart(4)}`,
  ].join(" ");
  // Aborted fights are a correctness failure, not a balance result. Shout.
  console.log(stats.aborted > 0 ? `${line}   !! ${stats.aborted} ABORTED` : line);
  return stats;
}

/**
 * The single most important measurement in the redesign: how much does playing
 * well actually matter? Same fight, same construction, considered play versus
 * random legal play. A small delta means the game is decided by dice.
 */
export function skillDelta(label, buildFight, runs) {
  const good = summarize(`${label} [considered]`, () => simulateFight({ ...buildFight(), policy: greedyPolicy }), runs);
  const rand = summarize(`${label} [random]`, () => simulateFight({ ...buildFight(), policy: randomPolicy }), runs);
  const delta = good.winRate - rand.winRate;
  console.log(
    label.padEnd(34),
    `considered ${pct(good.winRate).padStart(4)}`,
    `· random ${pct(rand.winRate).padStart(4)}`,
    `· delta ${(delta * 100).toFixed(0).padStart(4)}pts`,
  );
  return { good, rand, delta };
}
