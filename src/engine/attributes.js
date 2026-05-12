import { ATTR_KEYS, ATTR_LABELS } from "../config.js";

export function applyAttributeChanges(attrs, changes) {
  if (!changes) return { next: attrs, growthLines: [] };
  const next = { ...attrs };
  const growthLines = [];
  for (const k of ATTR_KEYS) {
    if (typeof changes[k] === "number" && changes[k] !== 0) {
      const before = next[k] ?? 0;
      next[k] = Math.max(0, Math.min(25, before + changes[k]));
      if (next[k] !== before) growthLines.push(`${ATTR_LABELS[k]} ${before} → ${next[k]}`);
    }
  }
  return { next, growthLines };
}
