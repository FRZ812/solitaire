// Forgeable / purchasable gear and the raw materials it's made from.
//
// Equipment carries NO explicit `combat` block on purpose: itemCombatStats
// (engine/combat-stats.js) infers a weapon's damage / armour's protection from
// the item's NAME and scales it by TIER. So a forged "Iron Longsword" at
// uncommon is automatically stronger than a common one — which lets the forging
// minigame's quality drive power purely through the output tier. Keep the
// descriptive keyword in the name (sword / mace / leather / helm / shield…).
//
// `value` is the base worth in COPPER (1sp=10cp, 1gp=100cp), anchored to the
// system-prompt STANDARD PRICES. `tier` is the default grade when bought from
// stock; the forge overrides it with the grade you hammer out.
//
// Body armour (kind "armor") is single-slot; helms/bracers/boots are kind
// "clothing" so they stack alongside body armour (they still add armour via
// name inference). Shields are their own slot.

export const EQUIPMENT = {
  "iron-dagger":     { id: "iron-dagger",     name: "Iron Dagger",      kind: "weapon",   tier: "common", value: 20,
                       appearance: "A plain leaf-blade dagger with a wrapped grip.", description: "Quick and light. Favours Reflex." },
  "iron-shortsword": { id: "iron-shortsword", name: "Iron Shortsword",  kind: "weapon",   tier: "common", value: 100,
                       appearance: "A short, broad blade with a single fuller.", description: "A reliable arming blade." },
  "iron-longsword":  { id: "iron-longsword",  name: "Iron Longsword",   kind: "weapon",   tier: "common", value: 200,
                       appearance: "A long double-edged blade with a cruciform hilt.", description: "Reach and bite, in trained hands." },
  "iron-mace":       { id: "iron-mace",       name: "Iron Mace",        kind: "weapon",   tier: "common", value: 120,
                       appearance: "A flanged head on a banded haft.", description: "Crushes through armour better than it cuts." },
  "iron-spear":      { id: "iron-spear",      name: "Iron Spear",       kind: "weapon",   tier: "common", value: 80,
                       appearance: "A leaf-point head on a long ash shaft.", description: "Reach and a punching point." },
  "hunting-bow":     { id: "hunting-bow",     name: "Hunting Bow",      kind: "weapon",   tier: "common", value: 100,
                       appearance: "A plain self-bow of seasoned yew.", description: "A ranged weapon. Favours Reflex." },
  "leather-jerkin":  { id: "leather-jerkin",  name: "Leather Jerkin",   kind: "armor",    tier: "common", value: 80,
                       appearance: "A boiled-leather jerkin, oiled against the wet.", description: "Light body armour." },
  "chain-hauberk":   { id: "chain-hauberk",   name: "Chain Hauberk",    kind: "armor",    tier: "common", value: 500,
                       appearance: "A knee-length shirt of riveted mail.", description: "Heavy, but it turns a blade." },
  "iron-helm":       { id: "iron-helm",       name: "Iron Helm",        kind: "clothing", tier: "common", value: 40,
                       appearance: "A simple open-faced iron helm with a nasal bar.", description: "Worn alongside body armour." },
  "round-shield":    { id: "round-shield",    name: "Round Shield",     kind: "shield",   tier: "common", value: 50,
                       appearance: "A round limewood shield with an iron boss.", description: "Raised to catch blows." },
};

// Crafting materials — kind "material", so they stack in the pack, sell to a
// smith, and are consumed by the forge. Buyable at the smithy or market.
export const MATERIALS = {
  "iron-ingot":    { id: "iron-ingot",    name: "Iron Ingot",    kind: "material", value: 8,
                     appearance: "A rough grey bar of smelted iron.", description: "Forge-stock for common arms and armour." },
  "steel-ingot":   { id: "steel-ingot",   name: "Steel Ingot",   kind: "material", value: 25,
                     appearance: "A bright bar of folded steel.", description: "Finer forge-stock for better work." },
  "leather-hide":  { id: "leather-hide",  name: "Leather Hide",  kind: "material", value: 6,
                     appearance: "A cured hide, supple and oiled.", description: "Cut and boiled for leather armour." },
  "hardwood-haft": { id: "hardwood-haft", name: "Hardwood Haft",  kind: "material", value: 4,
                     appearance: "A turned length of seasoned ash.", description: "A handle or shaft for hafted weapons." },
};
