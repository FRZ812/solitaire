// Merge AI-declared discoveries into the codex. Tracks newly-added entries
// and rating increases so the renderer can show "Recorded" / "Growth" beats.

import { COMPANIONS } from "../data/companions.js";
import { normalizeCharacterProgression } from "./progression.js";

export function mergeDiscoveries(existing, incoming) {
  const out = { ...existing };
  const newlyDiscovered = [];
  if (!incoming) return { codex: out, newlyDiscovered };
  // The broad profession catalog is engine-owned: exact vocations discovered
  // in play belong on a character as their archetype, never as an uncompiled
  // profession entry with no 100-level route.
  if (incoming.abilities && !incoming.skills)    incoming.skills      = incoming.abilities;
  for (const kind of ["characters", "races", "items", "spells", "skills"]) {
    const entries = incoming[kind];
    if (!entries || !Array.isArray(entries)) continue;
    out[kind] = { ...out[kind] };
    for (const e of entries) {
      if (!e?.id) continue;
      const isNew = !out[kind][e.id];
      const prev = out[kind][e.id] || {};
      let incoming = e;
      // Rank allocation and playable-template identity are engine-owned. The
      // narrator may propose only a loose starting level; never trust supplied
      // paths or a template id that would bypass the living-world ceiling.
      const hasOwn = (key) => Object.prototype.hasOwnProperty.call(incoming, key);
      if (kind === "characters" && (hasOwn("progression") || hasOwn("templateId"))) {
        const { progression, templateId, ...rest } = incoming;
        incoming = rest;
      }
      // The engine owns attributes after a person enters the Codex. The narrator
      // may seed a brand-new sheet, but later discoveries cannot restat it around
      // earned path ranks. Authored companions are protected even before recruit.
      if (kind === "characters" && Object.prototype.hasOwnProperty.call(incoming, "attributes") && (COMPANIONS[e.id] || prev.kind === "companion" || !isNew)) {
        const { attributes, ...rest } = incoming;
        incoming = rest;
      }
      // Gender is a HARD field — once set on a character, the narrator cannot
      // flip it via a later discoveries update (no mid-conversation pronoun
      // drift). Drop a contradictory gender field; keep everything else.
      if (kind === "characters" && prev.gender && incoming.gender && prev.gender !== incoming.gender) {
        const { gender, ...rest } = incoming;
        incoming = rest;
      }
      out[kind][e.id] = { ...prev, ...incoming };
      // Every person in the Codex uses the same stacked-rank model. A newly
      // narrated `level` seeds that stack, but ordinary world generation is
      // capped at 60 by the progression engine and the loose number is then
      // discarded so it can never disagree with allocated ranks.
      if (kind === "characters" && e.id !== "wanderer") {
        normalizeCharacterProgression(out[kind][e.id], { enforceLevelAttributeScale: isNew });
      }
      if (isNew) {
        newlyDiscovered.push({ kind, name: e.name, id: e.id });
      } else if (kind === "skills" && typeof e.rating === "number" && typeof prev.rating === "number" && e.rating > prev.rating) {
        newlyDiscovered.push({ kind: "skill_growth", name: e.name, id: e.id, from: prev.rating, to: e.rating });
      }
    }
  }

  // Claiming: anything (re)acquired through the narrator's discoveries is now
  // owned by REGULAR means — untag it from any equipped item's `_granted` so it
  // survives that item being unequipped (e.g. a grimoire cantrip you later truly
  // learn stays with you when you set the book down).
  const claimed = [
    ...(incoming.spells || []).map((s) => s.id),
    ...(incoming.skills || []).map((s) => s.id),
  ].filter(Boolean);
  if (claimed.length && out.items) {
    let cloned = false;
    for (const [iid, it] of Object.entries(out.items)) {
      const g = it?._granted;
      if (!g) continue;
      const spells = (g.spells || []).filter((id) => !claimed.includes(id));
      const abilities = (g.abilities || []).filter((id) => !claimed.includes(id));
      if (spells.length !== (g.spells || []).length || abilities.length !== (g.abilities || []).length) {
        if (!cloned) { out.items = { ...out.items }; cloned = true; }
        out.items[iid] = { ...it, _granted: { ...g, spells, abilities } };
      }
    }
  }

  return { codex: out, newlyDiscovered };
}

export function applyKnowledgeUpdates(codex, updates) {
  if (!updates || !Array.isArray(updates) || updates.length === 0) return codex;
  const out = { ...codex, characters: { ...codex.characters } };
  for (const u of updates) {
    if (!u?.id) continue;
    const ch = out.characters[u.id];
    if (!ch) continue;
    const existingKnows = ch.knows || [];
    const adds = Array.isArray(u.adds) ? u.adds : [];
    const newKnows = [...existingKnows];
    for (const f of adds) {
      if (typeof f !== "string" || !f.trim()) continue;
      if (!newKnows.includes(f)) newKnows.push(f);
    }
    out.characters[u.id] = { ...ch, knows: newKnows };
  }
  return out;
}
