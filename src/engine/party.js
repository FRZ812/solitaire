// The party: recruited companions are real, persisted codex characters listed in
// state.party. Recruiting files the full person into world.codex.characters and
// adds their id to the party; dismissing just removes them from the party (they
// remain known in the codex). The narrator runs them like anyone else.

import { companionCodexEntry } from "../data/companions.js";
import { coinsToCopper, copperToCoins, canAfford } from "./economy.js";
import { effectiveAttributes } from "../data/proficiencies.js";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";

const WEAPON_RE = /sword|blade|bow|crossbow|spear|axe|mace|maul|hammer|knife|dagger|staff|wand|grimoire|lance|halberd|cleaver/i;

// How impressive the player's company looks to someone weighing whether to throw
// in with them: party size, the BEST score in each attribute across everyone
// (player + companions), and how many are armed. Folk don't follow a lone, weak,
// ill-armed wanderer — a strong, well-armed band is a different proposition.
export function partyStanding(state) {
  const codex = state.world.codex;
  const members = [{ attrs: effectiveAttributes(state.character), worn: codex.characters.wanderer?.worn || [] }];
  for (const c of partyMembers(state)) members.push({ attrs: c.attributes || {}, worn: c.worn || [] });
  const size = members.length;
  const bestAttrs = {};
  for (const k of ATTR_KEYS) bestAttrs[k] = Math.max(0, ...members.map((m) => m.attrs[k] || 0));
  const armed = members.filter((m) => (m.worn || []).some((id) => WEAPON_RE.test(id))).length;
  const topAttr = Math.max(0, ...Object.values(bestAttrs));
  const attrSum = Object.values(bestAttrs).reduce((a, b) => a + b, 0);
  const score = size * 2 + topAttr + attrSum / 4 + armed * 1.5;
  const bestLine = ATTR_KEYS.filter((k) => bestAttrs[k] >= Math.max(4, topAttr - 1))
    .map((k) => `${ATTR_LABELS[k]} ${bestAttrs[k]}`).join(", ") || "nothing to boast of";
  const descriptor = size === 1
    ? `a lone wanderer, ${armed ? "armed" : "ill-armed"}`
    : `a band of ${size} (${armed} armed)`;
  return { size, bestAttrs, armed, score: Math.round(score), descriptor, bestLine };
}

const CHOOSINESS_NEED = { low: 6, mid: 12, high: 18 };

// Given the party's standing and how choosy a recruit is, how warmly are they
// likely to take to being asked? (A hint for the UI + the narrator — the
// player's actual words still decide.)
export function recruitOutlook(standing, choosiness = "mid") {
  const need = CHOOSINESS_NEED[choosiness] ?? 12;
  if (standing.score >= need + 5) return "eager";
  if (standing.score >= need) return "open";
  if (standing.score >= need - 6) return "wary";
  return "scornful";
}

// Add a companion to the party from their template, no fee gate (the join was
// won through conversation). Files the full person into the codex the FIRST time;
// on a re-recruit it keeps their existing entry so accumulated memories and bond
// survive a parting and return — no re-introduction needed.
export function addCompanionToParty(state, tmpl) {
  if (!tmpl || isRecruited(state, tmpl.id)) return state;
  const existing = state.world.codex.characters?.[tmpl.id];
  if (existing) return { ...state, party: [...(state.party || []), tmpl.id] };
  const entry = companionCodexEntry(tmpl);
  return {
    ...state,
    party: [...(state.party || []), tmpl.id],
    world: { ...state.world, codex: { ...state.world.codex, characters: { ...state.world.codex.characters, [tmpl.id]: entry } } },
  };
}

export function partyIds(state) {
  return state.party || [];
}

export function partyMembers(state) {
  const chars = state.world.codex.characters;
  return (state.party || []).map((id) => chars[id]).filter(Boolean);
}

export function isRecruited(state, id) {
  return (state.party || []).includes(id);
}

// Recruit a companion from a template: pay any signing fee, file the full person
// into the codex, and add them to the party.
export function recruitCompanion(state, tmpl) {
  if (isRecruited(state, tmpl.id)) return { state, ok: false, reason: "Already with you." };
  if (tmpl.feeCp && !canAfford(state.character.inventory.coins, tmpl.feeCp)) return { state, ok: false, reason: "Not enough coin." };
  const coins = tmpl.feeCp
    ? copperToCoins(coinsToCopper(state.character.inventory.coins) - tmpl.feeCp)
    : state.character.inventory.coins;
  const entry = companionCodexEntry(tmpl);
  return {
    ok: true,
    state: {
      ...state,
      party: [...(state.party || []), tmpl.id],
      character: { ...state.character, inventory: { ...state.character.inventory, coins } },
      world: { ...state.world, codex: { ...state.world.codex, characters: { ...state.world.codex.characters, [tmpl.id]: entry } } },
    },
  };
}

// Part ways with a companion — they leave the party but stay in the codex
// (still a known person you could meet again).
export function dismissCompanion(state, id) {
  return { ok: true, state: { ...state, party: (state.party || []).filter((x) => x !== id) } };
}
