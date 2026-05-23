// Merge AI-declared discoveries into the codex. Tracks newly-added entries
// and rating increases so the renderer can show "Recorded" / "Growth" beats.

import { COMPANIONS } from "../data/companions.js";

export function mergeDiscoveries(existing, incoming) {
  const out = { ...existing };
  const newlyDiscovered = [];
  if (!incoming) return { codex: out, newlyDiscovered };
  // Accept old field names as aliases in case the AI slips.
  if (incoming.classes && !incoming.professions) incoming.professions = incoming.classes;
  if (incoming.abilities && !incoming.skills)    incoming.skills      = incoming.abilities;
  for (const kind of ["characters", "races", "professions", "items", "spells", "skills"]) {
    const entries = incoming[kind];
    if (!entries || !Array.isArray(entries)) continue;
    out[kind] = { ...out[kind] };
    for (const e of entries) {
      if (!e?.id) continue;
      const isNew = !out[kind][e.id];
      const prev = out[kind][e.id] || {};
      let incoming = e;
      // The engine owns companions' attributes — the narrator may flavor their
      // description / knowledge but must not RESTAT an authored companion (their
      // stats come from data/companions.js, applied on recruit). Drop any
      // attributes the narrator tries to set on a companion id.
      if (kind === "characters" && e.attributes && (COMPANIONS[e.id] || prev.kind === "companion")) {
        const { attributes, ...rest } = e;
        incoming = rest;
      }
      out[kind][e.id] = { ...prev, ...incoming };
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
