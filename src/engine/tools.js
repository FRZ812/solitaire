// Player-driven, deterministic uses of pack TOOLS (as opposed to consumables):
// lighting a torch and bedding down to rest. Each returns { ok, state, summary,
// reason } so the UI can log a narration beat — mirroring consumables.js.

import { applyInventoryChanges } from "./inventory.js";
import { advanceTime } from "./time.js";
import { depleteNeeds, getNeedConditions, mergeConditions } from "./needs.js";
import { passiveHealVitality } from "./healing.js";
import { activeWorldPassives } from "./combat-stats.js";
import { TORCH_MINUTES, LANTERN_MINUTES, lightMinutes } from "./light.js";

const FIRE_SOURCES = ["tinderbox", "flint-and-steel"]; // something to strike a flame
const SLEEP_PER_HOUR = 12; // a warm bedroll restores deep rest

function carriedQty(state, id) {
  const c = (state.character.inventory.carried || []).find((x) => x.itemId === id);
  return c ? c.quantity : 0;
}

// Strike a torch alight. Needs a torch AND a fire source — that's why the kit
// bundles a tinderbox; without it the torch is just a stick. A torch is a quick,
// short light (≈1h) that sheds a modest pool.
export function lightTorch(state) {
  const ch = state.character;
  if (lightMinutes(state) > 5) return { state, ok: false, reason: "You already carry a burning light — no need to waste another." };
  if (carriedQty(state, "torch") < 1) return { state, ok: false, reason: "You have no torch to light." };
  if (!FIRE_SOURCES.some((id) => carriedQty(state, id) > 0)) {
    return { state, ok: false, reason: "A torch needs a tinderbox to strike a flame — and you have none." };
  }
  const inventory = applyInventoryChanges(ch.inventory, { removed: [{ itemId: "torch", quantity: 1 }] }, state.time.day);
  const light = { source: "torch", minutes: TORCH_MINUTES };
  return {
    ok: true,
    summary: "You strike the tinderbox; a torch catches and flares, shoving the dark back to the edges of the room.",
    state: { ...state, character: { ...ch, inventory, light } },
  };
}

// Light the hooded lantern. Needs the lantern, a flask of lamp-oil (consumed),
// and a fire source. A lantern is a steady, bright, long light (≈4h) — full
// sight — and can be hooded (extinguished) at will to go dark for stealth.
export function lightLantern(state) {
  const ch = state.character;
  if (lightMinutes(state) > 5) return { state, ok: false, reason: "You already carry a burning light." };
  if (carriedQty(state, "lantern") < 1) return { state, ok: false, reason: "You have no lantern." };
  if (carriedQty(state, "lamp-oil") < 1) return { state, ok: false, reason: "The lantern is dry — you need a flask of lamp-oil." };
  if (!FIRE_SOURCES.some((id) => carriedQty(state, id) > 0)) {
    return { state, ok: false, reason: "You need a tinderbox to strike the lantern alight." };
  }
  const inventory = applyInventoryChanges(ch.inventory, { removed: [{ itemId: "lamp-oil", quantity: 1 }] }, state.time.day);
  const light = { source: "lantern", minutes: LANTERN_MINUTES };
  return {
    ok: true,
    summary: "You feed the lantern a flask of oil and strike it alight — a steady, hooded glow you can carry or shutter at will.",
    state: { ...state, character: { ...ch, inventory, light } },
  };
}

// Snuff or hood your light to go dark on purpose (to hide, or to save a torch).
export function extinguish(state) {
  const ch = state.character;
  if (lightMinutes(state) <= 0) return { state, ok: false, reason: "You carry no burning light." };
  const wasLantern = ch.light?.source === "lantern";
  const light = { source: null, minutes: 0 };
  return {
    ok: true,
    summary: wasLantern ? "You slide the lantern's hood shut and the dark rushes back in." : "You snuff the torch — the dark rushes back in.",
    state: { ...state, character: { ...ch, light } },
  };
}

// Bed down and rest for `hours`. Skips time, restores the Sleep need (the "sleep
// gained"), regenerates vitality over the hours (unless a wound blocks it), and
// lets hunger/thirst drift down as time passes. A torch burns down meanwhile.
export function applyRest(state, hours) {
  const h = Math.max(1, Math.round(hours || 0));
  const minutes = h * 60;
  const ch = state.character;
  if (carriedQty(state, "bedroll") < 1) return { state, ok: false, reason: "You've no bedroll to make a proper rest." };

  const wp = activeWorldPassives(ch, state.world.codex);
  const time = advanceTime(state.time, minutes);
  const decayMult = Math.max(0.2, 1 - (wp.needDecayMult || 0));
  const drained = depleteNeeds(ch.needs, minutes, decayMult);
  const needs = { ...drained, sleep: Math.min(100, drained.sleep + SLEEP_PER_HOUR * h) };
  const sleepGain = Math.round(needs.sleep - ch.needs.sleep);

  const vitality = passiveHealVitality(ch.vitality, ch.vitalityMax, ch.conditions, minutes, wp.healPerHour || 0);
  const hpGain = Math.round(vitality - ch.vitality);

  // Resolve refills only by rest (or certain drinks) — a full night restores the
  // whole Mind-scaled pool; a short nap restores a proportional share.
  const RESOLVE_FULL_REST_H = 8;
  const resolveMax = ch.resolveMax ?? 0;
  const resolve = Math.min(resolveMax, (ch.resolve ?? 0) + Math.ceil(resolveMax * (h / RESOLVE_FULL_REST_H)));
  const resolveGain = Math.round(resolve - (ch.resolve ?? 0));

  // Recompute need-borne conditions (rest can clear Tired/Exhausted, or wake you Hungry).
  const conditions = mergeConditions(null, getNeedConditions(needs), ch.conditions);
  const burned = Math.max(0, lightMinutes(state) - minutes);
  const light = burned > 0 ? { source: ch.light?.source || "torch", minutes: burned } : { source: null, minutes: 0 };

  const gains = [];
  if (sleepGain > 0) gains.push(`+${sleepGain} sleep`);
  if (hpGain > 0) gains.push(`+${hpGain} vitality`);
  if (resolveGain > 0) gains.push(`+${resolveGain} resolve`);
  const summary = `You unroll the bedroll and bed down. You wake ${h} hour${h === 1 ? "" : "s"} later${gains.length ? `, rested — ${gains.join(", ")}` : ""}.`;

  return {
    ok: true,
    summary,
    state: { ...state, time, character: { ...ch, needs, vitality, resolve, conditions, light } },
  };
}
