// Merge AI-declared discoveries into the codex. Tracks newly-added entries
// and rating increases so the renderer can show "Recorded" / "Growth" beats.

import { COMPANIONS } from "../data/companions.js";
import { canonicalProfessionId, isBroadProfessionName } from "../data/progression-paths.js";
import { normalizeCharacterProgression } from "./progression.js";

const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));

export function sanitizeProfessionPlan(entry, { allowBranches = false } = {}) {
  const rawPlan = Array.isArray(entry?.profession_plan)
    ? entry.profession_plan
    : Array.isArray(entry?.professionPlan) ? entry.professionPlan : [];
  const plan = [];
  let remaining = 70;
  for (const raw of rawPlan) {
    if (!raw || remaining <= 0) break;
    const requested = String(raw.profession || raw.professionId || "").trim();
    const profession = canonicalProfessionId(requested);
    if (!profession) continue;
    const levels = Math.min(remaining, clampInt(raw.levels, 0, 70));
    if (levels <= 0) continue;
    const requestedKey = requested.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const specialization = String(
      raw.specialization || raw.specializationId || raw.archetype || raw.archetypeId
      || (!isBroadProfessionName(requestedKey, profession) ? requested : ""),
    ).trim();
    const specializationPath = String(raw.specializationPath || raw.specialization_path || "").trim();
    const rawBranchChoices = raw.branchChoices && typeof raw.branchChoices === "object" && !Array.isArray(raw.branchChoices)
      ? raw.branchChoices
      : raw.branch_choices && typeof raw.branch_choices === "object" && !Array.isArray(raw.branch_choices)
        ? raw.branch_choices
        : {};
    const branchChoices = Object.fromEntries(Object.entries(rawBranchChoices)
      .filter(([choiceId, optionId]) => choiceId.trim() && typeof optionId === "string" && optionId.trim())
      .map(([choiceId, optionId]) => [choiceId.trim(), optionId.trim()]));
    plan.push({
      profession,
      ...(specialization ? { specialization } : {}),
      levels,
      ...(allowBranches && specializationPath ? { specializationPath } : {}),
      ...(allowBranches && Object.keys(branchChoices).length ? { branchChoices } : {}),
    });
    remaining -= levels;
  }
  return plan;
}

// Narrator input may describe a bounded allocation, but never durable path ids.
// Normalize aliases and caps here; progression.js remains the authority that
// compiles these hints into the versioned ledger.
export function sanitizeNarratorProgressionHints(entry, { existing = false } = {}) {
  if (!entry || typeof entry !== "object") return entry;
  const out = { ...entry };
  delete out.progression;
  delete out.templateId;
  if (existing) {
    for (const key of [
      "level", "racial_levels", "racialLevels", "profession_plan", "professionPlan",
      "signature_spell", "signatureSpell", "metamagic", "metamagic_ids",
    ]) delete out[key];
    return out;
  }

  const plan = sanitizeProfessionPlan(out, { allowBranches: true });
  if (plan.length) {
    out.profession_plan = plan;
    delete out.professionPlan;
    // Compatibility identity is a projection of the primary generalized
    // profession; an exact old-style title is retained only as specialization.
    out.profession = plan[0].profession;
    if (plan[0].specialization) out.archetype = plan[0].specialization;
  } else {
    const requested = String(out.profession || "").trim();
    const profession = canonicalProfessionId(requested);
    if (profession) {
      const requestedKey = requested.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      out.profession = profession;
      if (!out.archetype && !isBroadProfessionName(requestedKey, profession)) out.archetype = requested;
    }
  }

  const hasDeclaredRacialLevels = out.racial_levels != null || out.racialLevels != null;
  if (hasDeclaredRacialLevels) out.racial_levels = clampInt(out.racial_levels ?? out.racialLevels, 0, 30);
  else delete out.racial_levels;
  delete out.racialLevels;
  const professionLevels = plan.reduce((sum, part) => sum + part.levels, 0);
  const plannedTotal = (out.racial_levels || 0) + professionLevels;
  const declared = clampInt(out.level || plannedTotal || 1, 1, 100);
  out.level = plan.length ? Math.max(1, Math.min(100, plannedTotal)) : declared;

  const hasSorcerer = plan.some((part) => part.profession === "sorcerer") || out.profession === "sorcerer";
  if (!hasSorcerer) {
    delete out.signature_spell;
    delete out.signatureSpell;
    delete out.metamagic;
    delete out.metamagic_ids;
  }
  return out;
}

export function mergeDiscoveries(existing, incoming) {
  const out = { ...existing };
  const newlyDiscovered = [];
  if (!incoming) return { codex: out, newlyDiscovered };
  // The generalized profession catalog is engine-owned: exact vocations
  // discovered in play belong on a character as their specialization.
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
      // narrator may propose only bounded allocation hints, never durable paths.
      if (kind === "characters") incoming = sanitizeNarratorProgressionHints(incoming, { existing: !isNew });
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
        // Generation fields are one-shot hints. The compact, validated v2
        // progression ledger is the only durable source after normalization.
        for (const key of [
          "profession_plan", "professionPlan", "racial_levels", "racialLevels",
          "signature_spell", "signatureSpell", "metamagic", "metamagic_ids",
        ]) delete out[kind][e.id][key];
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
