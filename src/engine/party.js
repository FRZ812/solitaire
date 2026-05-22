// The party: recruited companions are real, persisted codex characters listed in
// state.party. Recruiting files the full person into world.codex.characters and
// adds their id to the party; dismissing just removes them from the party (they
// remain known in the codex). The narrator runs them like anyone else.

import { companionCodexEntry } from "../data/companions.js";
import { coinsToCopper, copperToCoins, canAfford } from "./economy.js";

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
