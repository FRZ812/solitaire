const KEEPSAKE_ART = import.meta.glob(
  "../../assets/generated/combat/keepsakes/*.webp",
  { eager: true, import: "default" },
);

export function resolveCombatKeepsakeArt(itemOrId) {
  const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
  if (!id) return null;
  return KEEPSAKE_ART[`../../assets/generated/combat/keepsakes/${id}-v1.webp`] || null;
}
