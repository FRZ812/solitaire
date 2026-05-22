// Affix Fusion — a rune-triggered ritual. Forge-runes are rare trophies (rolled
// from mighty foes / found at ancient sites, never bought). Carrying one, the
// player "binds" it to a piece of gear that already bears the recipe's two
// component affixes, fusing them into a single signature power. The fusion
// recipes + affix maths live in data/passives.js; this module is just the
// state-level glue (what can be fused right now, and applying it).

import { FUSIONS, applyFusion, availableFusions, passiveLabel, passiveDef } from "../data/passives.js";
import { itemTemplate } from "../data/catalog.js";

// Every fusion this specific rune could perform right now: an owned/worn item
// that bears BOTH components of a recipe whose rune is `runeId`. Returns the
// rows the ritual UI lists.
export function fusionOptionsForRune(state, runeId) {
  if (!runeId) return [];
  const items = state.world?.codex?.items || {};
  const out = [];
  for (const it of Object.values(items)) {
    if (!it.passives || !it.passives.length) continue;
    for (const recipe of availableFusions(it.passives)) {
      if (recipe.rune !== runeId) continue;
      out.push({
        itemId: it.id, itemName: it.name, recipe,
        resultName: passiveDef(recipe.result)?.name || recipe.result,
        aName: passiveDef(recipe.a)?.name || recipe.a,
        bName: passiveDef(recipe.b)?.name || recipe.b,
      });
    }
  }
  return out;
}

// Bind the rune: consume one from the pack, replace the item's two component
// affixes with the fused signature affix (applyFusion keeps the higher tier).
export function applyFusionToItem(state, itemId, recipeId) {
  const recipe = FUSIONS.find((f) => f.id === recipeId);
  const items = state.world?.codex?.items || {};
  const it = items[itemId];
  if (!recipe || !it) return { state, ok: false, reason: "Nothing to fuse here." };
  const carried = state.character.inventory.carried.map((c) => ({ ...c }));
  const idx = carried.findIndex((c) => c.itemId === recipe.rune);
  if (idx < 0 || carried[idx].quantity <= 0) return { state, ok: false, reason: `You lack a ${itemTemplate(recipe.rune)?.name || "rune"}.` };
  carried[idx].quantity -= 1;
  if (carried[idx].quantity <= 0) carried.splice(idx, 1);
  const fused = { ...it, passives: applyFusion(it.passives, recipe) };
  const newItems = { ...items, [itemId]: fused };
  const resultTier = fused.passives.find((p) => p.id === recipe.result)?.tier;
  return {
    ok: true,
    item: fused,
    label: passiveLabel(recipe.result, resultTier),
    state: {
      ...state,
      character: { ...state.character, inventory: { ...state.character.inventory, carried } },
      world: { ...state.world, codex: { ...state.world.codex, items: newItems } },
    },
  };
}
