// Survival + health tick — the time-driven cluster of applyBeat (Stage 3
// extraction): world passives, needs depletion + auto-eat, condition tick/merge,
// need alerts, light burn-down, passive heal, wound DoT, companion upkeep,
// carry/ride re-derivation, and the body-ledger (vitals/condition delta beats).
// These steps share temps (wp/decayMult/drained/prevNeedConds) and compare the
// evolving character against the OLD `state.character` snapshot, so they stay one
// cohesive step. Threads `codex` (returned); `character` is mutated in place.
import { activeWorldPassives, deriveCombatStats } from "./combat-stats.js";
import { depleteNeeds, applyNeedsChanges, getNeedConditions, mergeConditions, getNeedAlertText } from "./needs.js";
import { tickConditions, condNames, conditionMeta, polarityOf } from "../data/conditions.js";
import { passiveHealVitality } from "./healing.js";
import { autoConsume, woundTick, companionUpkeep } from "./upkeep.js";
import { buffCarryBonus, buffRideBonus } from "./buffs.js";
import { recomputeCarryCapacity } from "./attributes.js";
import { loadOf } from "./weight.js";

// ctx in: { state, beat, character, codex, newBeats }. Returns { codex };
// character + newBeats are mutated in place (same objects the caller holds).
export function applySurvivalTick({ state, beat, character, codex, newBeats }) {
  // Equipped world passives (Enduring slows needs, Mending speeds regen, etc.).
  const wp = activeWorldPassives(state.character, state.world.codex);

  // Needs deplete by time, then narrator-driven changes apply, then conditions auto-update.
  const decayMult = Math.max(0.2, 1 - (wp.needDecayMult || 0));
  const minutes = beat.minutes_passed || 0;
  const upkeepLines = [];
  const prevNeedConds = getNeedConditions(state.character.needs);
  const drained = depleteNeeds(state.character.needs, minutes, decayMult);
  character.needs = applyNeedsChanges(drained, beat.needs_changes);

  // As time passes the party eats and drinks from the shared pack to hold off
  // hunger/thirst — done BEFORE conditions so a fed character isn't marked Hungry.
  if (minutes > 0) {
    const fed = autoConsume(character.inventory, character.needs, codex.items, "");
    character.inventory = fed.inventory;
    character.needs = fed.needs;
    upkeepLines.push(...fed.lines);
  }

  // Count timed buffs/debuffs down by the elapsed minutes (dropping any that ran
  // out), then merge with need-borne conditions and the narrator's replace-list.
  const { conditions: tickedConds, expired } = tickConditions(state.character.conditions, minutes);
  const needsConds = getNeedConditions(character.needs);
  character.conditions = mergeConditions(beat.new_conditions, needsConds, tickedConds);

  // Need alerts fire only on crossing INTO a worse state.
  const newlyTriggered = needsConds.filter(c => !prevNeedConds.includes(c));
  for (const c of newlyTriggered) {
    const text = getNeedAlertText(c);
    if (text) newBeats.push({ id: `alert${Date.now()}-${c}`, type: "need_alert", text });
  }

  // A lit torch burns down with the clock; when it gutters out, say so. Also
  // lazily seeds the field onto saves made before the light mechanic existed.
  {
    const cur = character.light || {};
    const prev = (cur.minutes ?? cur.torchMinutes) || 0; // back-compat with old {torchMinutes}
    if (cur.hooded && cur.source === "lantern" && prev > 0) {
      character.light = { source: "lantern", minutes: prev, hooded: true };
    } else if (prev > 0) {
      const left = Math.max(0, prev - (beat.minutes_passed || 0));
      character.light = left > 0 ? { source: cur.source || "torch", minutes: left } : { source: null, minutes: 0 };
      if (left === 0) {
        const what = cur.source === "lantern" ? "Your lantern sputters dry" : "Your torch gutters out";
        newBeats.push({ id: `torch${Date.now()}`, type: "narration", content: `${what}, and the dark closes back in.` });
      }
    } else if (!character.light || character.light.minutes === undefined) {
      character.light = { source: null, minutes: 0 };
    }
  }

  // Passive regen comes after final conditions, so a freshly-applied "Bleeding" blocks it.
  character.vitality = passiveHealVitality(
    character.vitality, character.vitalityMax,
    character.conditions, beat.minutes_passed || 0, wp.healPerHour || 0
  );

  // Passive resolve recovery from Presence thresholds and item triggers (e.g. Clear Mind,
  // Archmage). Same resolveRegen rate as in combat — one tick per beat.
  const cs = deriveCombatStats(character, codex);
  const rrOoc = cs.triggers?.resolveRegen || 0;
  if (rrOoc && (character.resolveMax ?? 0) > 0) {
    character.resolve = Math.min(character.resolveMax, (character.resolve || 0) + rrOoc);
  }

  // Wounds bite as the clock turns — Bleeding/Poisoned cost vitality until treated.
  if (minutes > 0) {
    const wt = woundTick(character.vitality, character.conditions, minutes);
    character.vitality = wt.vitality;
    upkeepLines.push(...wt.lines);
  }

  // Companions travel the same clock: they hunger, thirst, tire, and call for rest.
  if (minutes > 0 && (state.party || []).length) {
    const cu = companionUpkeep(state.party, codex.characters, character.inventory, minutes, decayMult, codex.items);
    character.inventory = cu.inventory;
    if (Object.keys(cu.companions).length) {
      codex = { ...codex, characters: { ...codex.characters, ...cu.companions } };
    }
    upkeepLines.push(...cu.lines);
  }

  // Boon-conditions → engine seams. Derived every beat from the FINAL conditions
  // (post-tick), so a strength buff lifts the player's carry cap and the mount they
  // ride while it holds, and BOTH fall back the instant it lapses (graceful, no
  // items dropped / no rider thrown — engine/weight + riding handle the overflow).
  character.carryBonus = buffCarryBonus(character.conditions);
  recomputeCarryCapacity(character);
  character.overburdened = loadOf(codex.characters?.wanderer, character.inventory, codex.items) > (character.carryCapacityMax ?? Infinity);
  {
    const rideBonus = buffRideBonus(character.conditions);
    const riddenId = codex.characters?.wanderer?.ridingOn || null;
    const chars2 = { ...codex.characters };
    let touched = false;
    for (const id of (state.party || [])) {
      const c = chars2[id];
      if (!c || c.kind !== "mount") continue;
      const want = id === riddenId ? rideBonus : 0; // buff bolsters only the mount you're on
      if ((c.rideCapacityBonus || 0) !== want) { chars2[id] = { ...c, rideCapacityBonus: want }; touched = true; }
    }
    if (touched) codex = { ...codex, characters: chars2 };
  }

  // One compact upkeep note per beat: what was eaten/drunk, who's flagging, wounds.
  if (upkeepLines.length) newBeats.push({ id: `upkeep${Date.now()}`, type: "upkeep", lines: upkeepLines });

  // Body ledger — surface what just happened to the player's vitals and
  // conditions (Stoneshard-style), but stay quiet during pre-creation limbo.
  if (state.created !== false) {
    // Vitality / resolve / needs deltas. Routine per-hour needs DRIFT stays
    // hidden — only show a need that was RECOVERED, or DRAINED beyond the routine
    // (a poison/curse/exertion sapping it), gauged against the post-drift value.
    const SUDDEN_DRAIN = 12;
    const chips = [];
    const dv = Math.round(character.vitality) - Math.round(state.character.vitality ?? 0);
    if (dv !== 0) chips.push({ stat: "vitality", delta: dv });
    const dr = (character.resolve || 0) - (state.character.resolve || 0);
    if (dr !== 0) chips.push({ stat: "resolve", delta: dr });
    for (const k of ["hunger", "thirst", "sleep"]) {
      const nonPassive = Math.round((character.needs[k] ?? 0) - (drained[k] ?? 0));
      if (nonPassive > 0 || nonPassive <= -SUDDEN_DRAIN) chips.push({ stat: k, delta: nonPassive });
    }
    if (chips.length) newBeats.push({ id: `vd${Date.now()}`, type: "vitals_delta", chips });

    // Conditions gained / lost / expired (need conditions excepted — their onset
    // already speaks through need_alert, their relief through the needs chips).
    const beforeNames = condNames(state.character.conditions);
    const afterNames = condNames(character.conditions);
    const gained = afterNames.filter((n) => !beforeNames.includes(n) && !conditionMeta(n).isNeed);
    const lost = beforeNames.filter((n) => !afterNames.includes(n) && !conditionMeta(n).isNeed);
    if (gained.length || lost.length) {
      const entries = [
        ...gained.map((n) => ({ name: n, dir: "gain", polarity: polarityOf(n) })),
        ...lost.map((n) => ({ name: n, dir: expired.includes(n) ? "expire" : "lose", polarity: polarityOf(n) })),
      ];
      newBeats.push({ id: `cc${Date.now()}`, type: "condition_change", entries });
    }
  }

  return { codex };
}
