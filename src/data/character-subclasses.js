import { CHARACTER_TEMPLATES } from "./templates.js";

const TEMPLATE_BY_ID = new Map(CHARACTER_TEMPLATES.map((template) => [template.id, template]));

function labelize(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// New characters persist `subclass` directly. Template inference keeps older
// saves equally descriptive without requiring a destructive save migration.
export function characterSubclass(entry) {
  if (!entry) return null;
  const template = TEMPLATE_BY_ID.get(entry.templateId);
  const inferred = template && template.id !== template.setup.profession ? template.id : null;
  const id = entry.subclass || inferred;
  if (!id || id === entry.profession) return null;
  const authored = TEMPLATE_BY_ID.get(id) || (template?.id === id ? template : null);
  return { id, label: authored?.label || labelize(id) };
}
