const KEEPSAKE_ART = import.meta.glob(
  "../../assets/generated/winter-tower/keepsakes/*.webp",
  { eager: true, import: "default" },
);

export function resolveTowKeepsakeArt(itemOrId) {
  const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
  if (!id) return null;
  return KEEPSAKE_ART[`../../assets/generated/winter-tower/keepsakes/${id}-v1.webp`] || null;
}
