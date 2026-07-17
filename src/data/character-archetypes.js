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
  const id = entry.archetype || legacy || template?.setup?.archetype
    || professionBuild(entry.profession)?.archetypePathId;
  if (!id) return null;
  const authoredTemplate = TEMPLATE_BY_ID.get(id) || (template?.setup?.archetype === id ? template : null);
  const profession = PROFESSIONS[entry.profession];
  const build = professionBuild(entry.profession);
  const isProfessionArchetype = id === build?.archetypePathId;
  return {
    id,
    label: authoredTemplate?.label || (isProfessionArchetype ? profession?.archetype : null) || labelize(id),
    description: isProfessionArchetype ? profession?.archetypeDescription : authoredTemplate?.concept,
  };
}
