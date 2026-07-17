import { CHARACTER_TEMPLATES } from "./templates.js";
import { PROFESSIONS } from "./professions.js";
import { professionBuild } from "./progression-paths.js";

const TEMPLATE_BY_ID = new Map(CHARACTER_TEMPLATES.map((template) => [template.id, template]));

function labelize(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Archetype is the specialized identity attached to a broad profession. New
// saves persist it directly. The bracket lookup is a migration-only reader for
// the retired field used by older campaigns; no active surface writes it.
export function characterArchetype(entry) {
  if (!entry) return null;
  const template = TEMPLATE_BY_ID.get(entry.templateId);
  const legacy = entry["sub" + "class"];
  const allocations = Array.isArray(entry.progression?.professions) ? entry.progression.professions : [];
  const activeProfessionId = entry.progression?.activeProfessionId
    || entry.progression?.professionId
    || entry.profession;
  const activeAllocation = allocations.find((allocation) => allocation?.professionId === activeProfessionId)
    || allocations[0]
    || null;
  const professionId = activeAllocation?.professionId || activeProfessionId;
  const isLayeredProgression = Number(entry.progression?.version) >= 2;
  const id = entry.archetype
    || activeAllocation?.specializationId
    || entry.progression?.archetypeId
    || legacy
    || template?.setup?.archetype
    || (!isLayeredProgression ? professionBuild(professionId)?.archetypePathId : null);
  if (!id) return null;
  const authoredTemplate = TEMPLATE_BY_ID.get(id) || (template?.setup?.archetype === id ? template : null);
  const profession = PROFESSIONS[professionId];
  const build = professionBuild(professionId);
  const isProfessionArchetype = id === build?.archetypePathId;
  return {
    id,
    label: authoredTemplate?.label || (isProfessionArchetype ? profession?.archetype : null) || labelize(id),
    description: isProfessionArchetype ? profession?.archetypeDescription : authoredTemplate?.concept,
  };
}
