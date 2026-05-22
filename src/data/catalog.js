// Unified item-template lookup across every purchasable / craftable thing:
// consumable goods (goods.js), gear and materials (equipment.js). Stock tables
// (town.js) and the forge (engine/forge.js) resolve ids through here so they
// don't care which file a template lives in.

import { GOODS } from "./goods.js";
import { EQUIPMENT, MATERIALS } from "./equipment.js";
import { TOOLS } from "./tools.js";

export const ALL_ITEMS = { ...GOODS, ...MATERIALS, ...TOOLS, ...EQUIPMENT };

export function itemTemplate(id) {
  return ALL_ITEMS[id] || null;
}
