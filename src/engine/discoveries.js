// Merge AI-declared discoveries into the codex. Tracks newly-added entries
// and rating increases so the renderer can show "Recorded" / "Growth" beats.

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
      out[kind][e.id] = { ...prev, ...e };
      if (isNew) {
        newlyDiscovered.push({ kind, name: e.name, id: e.id });
      } else if (kind === "skills" && typeof e.rating === "number" && typeof prev.rating === "number" && e.rating > prev.rating) {
        newlyDiscovered.push({ kind: "skill_growth", name: e.name, id: e.id, from: prev.rating, to: e.rating });
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
