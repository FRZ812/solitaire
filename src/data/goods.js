// Purchasable goods — item templates a trader can stock. These get filed into
// world.codex.items the first time the player buys one, so they render in the
// pack and the narrator can reference them by name.
//
// `value` is the base worth in COPPER (see engine/economy.js: 1sp=10cp,
// 1gp=100cp). A shop sets its asking price from this (town.js stock tables
// apply a multiplier + small per-restock variance).
//
// `use` makes a good consumable from the inventory (engine/consumables.js):
//   { verb, vitality, resolve, needs:{hunger,thirst,sleep}, removeConditions[] }
// Applying it spends one and resolves the effect deterministically. `kind` for
// consumables is remedy / food / drink — none are in inventory.js EQUIPPABLE,
// so they stack in the pack and show a Use button instead of Equip.
//
// `perish` (food only) is the shelf life in DAYS — fresh food spoils that many
// days after you acquire it (engine/spoilage.js). Preserved staples (hardtack,
// jerky, salt-pork, dried beans, onions…) omit `perish` and never spoil.

export const GOODS = {
  // ---- Healer / apothecary remedies ----
  "healing-salve": {
    id: "healing-salve", name: "Healing Salve", kind: "remedy", value: 25,
    appearance: "A clay pot of green ointment that smells of crushed comfrey and tallow.",
    description: "Rubbed into a wound, it eases the pain and speeds knitting — restores some vitality.",
    use: { verb: "Apply", vitality: 6 },
  },
  "blood-staunch": {
    id: "blood-staunch", name: "Staunching Bandages", kind: "remedy", value: 8,
    appearance: "A tight roll of boiled linen packed with powdered yarrow.",
    description: "Bound over a bleeding wound, it stops the flow — clears Bleeding and steadies you a little.",
    use: { verb: "Apply", vitality: 2, removeConditions: ["Bleeding"] },
  },
  "splint": {
    id: "splint", name: "Splint & Wrap", kind: "remedy", value: 10,
    appearance: "Two flat ash laths and a length of waxed cord.",
    description: "Set and bound around a broken or wrenched limb, it braces the bone so it can mend.",
    use: { verb: "Apply", vitality: 3 },
  },
  "willow-bark": {
    id: "willow-bark", name: "Willow-Bark", kind: "remedy", value: 5,
    appearance: "A twist of papery grey bark, bitter to chew.",
    description: "Chewed or steeped, it dulls pain and steadies the nerves.",
    use: { verb: "Chew", vitality: 1, resolve: 1 },
  },
  "fever-tonic": {
    id: "fever-tonic", name: "Fever Tonic", kind: "remedy", value: 22,
    appearance: "A stoppered vial of cloudy amber liquid.",
    description: "Drunk down, it breaks a fever and fights off sickness — clears an Infected wound.",
    use: { verb: "Drink", vitality: 2, removeConditions: ["Infected"] },
  },
  "antivenom": {
    id: "antivenom", name: "Antivenom", kind: "remedy", value: 40,
    appearance: "A small lead-grey vial sealed with black wax.",
    description: "Taken quickly after a bite or sting, it neutralises venom — clears Poisoned.",
    use: { verb: "Drink", removeConditions: ["Poisoned"] },
  },
  "poultice": {
    id: "poultice", name: "Drawing Poultice", kind: "remedy", value: 12,
    appearance: "A muslin packet of mustard, charcoal, and bog-moss.",
    description: "Laid on a dirty or swelling wound, it draws out the corruption — clears a Festering Wound.",
    use: { verb: "Apply", vitality: 2, removeConditions: ["Festering Wound"] },
  },
  "healing-draught": {
    id: "healing-draught", name: "Healing Draught", kind: "remedy", value: 50,
    appearance: "A heavy glass flask of red-gold liquor that catches the light.",
    description: "A potent alchemical cordial — drunk down, it restores a good deal of vitality at once.",
    use: { verb: "Drink", vitality: 15 },
  },
  // ---- Character-start keepsakes ----------------------------------------
  // Permanent keepsakes occupy their own authored starting slot. They remain in the pack
  // as named objects, but have no Use action and do not consume a normal equipment slot;
  // their TOW bonuses are derived from the character profile at encounter admission.
  "threadbare-war-ribbon": {
    id: "threadbare-war-ribbon", name: "Threadbare War Ribbon", kind: "keepsake", tier: "common", value: 20,
    appearance: "A faded crimson ribbon tied around a battered iron clasp, worn thin by years of handling.",
    description: "A humble permanent keepsake. Its remembered endurance grants +4 maximum health in Tower combat.",
  },
  "frostglass-bead": {
    id: "frostglass-bead", name: "Frostglass Bead", kind: "keepsake", tier: "uncommon", value: 140,
    appearance: "A clear blue prayer bead on black cord, with a perfect snowflake caught inside.",
    description: "A permanent keepsake that grants +2 Defence and +4 maximum health in Tower combat.",
  },
  "red-wolf-token": {
    id: "red-wolf-token", name: "Red Wolf Token", kind: "keepsake", tier: "rare", value: 520,
    appearance: "A scarred bronze token stamped with a wolf's profile and darkened along one old claw mark.",
    description: "A permanent keepsake that grants +3 Attack and +3% Critical in Tower combat.",
  },
  "saints-broken-halo": {
    id: "saints-broken-halo", name: "Saint's Broken Halo", kind: "keepsake", tier: "epic", value: 2200,
    appearance: "A palm-sized ring of old gold, broken cleanly through one radiant segment.",
    description: "An achievement keepsake that grants +4 Defence, +10 maximum health, and one rank of Aegis.",
  },
  "crownless-coin": {
    id: "crownless-coin", name: "Crownless Coin", kind: "keepsake", tier: "legendary", value: 6800,
    appearance: "A black-gold royal coin split through the erased crown stamped on both faces.",
    description: "An achievement keepsake that grants +5 Attack, +5 Defence, +5% Critical, and +5% Dodge.",
  },
  "heart-of-still-winter": {
    id: "heart-of-still-winter", name: "Heart of Still Winter", kind: "keepsake", tier: "mythical", value: 14000,
    appearance: "A deep-blue crystal heart holding a white star that never flickers and never melts its frost.",
    description: "A mythic achievement keepsake granting +8 Attack, +8 Defence, +20 maximum health, +8% Critical, and +8% Dodge.",
  },

  // Emergency keepsakes are ordinary carried consumables. Their decisive effect is resolved
  // by the replay-safe combat reducer and costs both the holder's action and the single item.
  "crimson-vial": {
    id: "crimson-vial", name: "Crimson Vial", kind: "remedy", value: 65,
    appearance: "A thumb-sized red vial in a wire cage, warm despite the winter air.",
    description: "A single combat draught that restores 25% of maximum health. Chosen as a starting keepsake or found later.",
  },
  "lucid-tonic": {
    id: "lucid-tonic", name: "Lucid Tonic", kind: "remedy", value: 70,
    appearance: "A clear ampoule in which one silver bubble refuses to rise.",
    description: "A single combat draught that restores 3 Resolve. Chosen as a starting keepsake or found later.",
  },
  "warding-ash": {
    id: "warding-ash", name: "Warding Ash", kind: "remedy", value: 55,
    appearance: "Grey temple ash folded into waxed paper and marked with a closed eye.",
    description: "Scattered in combat, it raises a one-window ward worth 150% of Defence.",
  },
  "fire-pot": {
    id: "fire-pot", name: "Fire Pot", kind: "remedy", value: 60,
    appearance: "A pitch-sealed clay pot with a short black fuse under its carrying loop.",
    description: "Thrown in combat, it makes a 150% Attack strike against one target.",
  },

  // ---- Butcher (meat) ----
  "fresh-meat": {
    id: "fresh-meat", name: "Cut of Meat", kind: "food", value: 4, perish: 2,
    appearance: "A red cut of fresh meat wrapped in waxed cloth.", description: "Cooked over a fire, a filling meal.",
    use: { verb: "Eat", needs: { hunger: 35 } },
  },
  "sausage-links": {
    id: "sausage-links", name: "Sausage Links", kind: "food", value: 3, perish: 4,
    appearance: "A coil of fat pork sausages.", description: "Fry or grill them. Quick and filling on the road.",
    use: { verb: "Eat", needs: { hunger: 25 } },
  },
  "smoked-ham": {
    id: "smoked-ham", name: "Smoked Ham", kind: "food", value: 8, perish: 45,
    appearance: "A dense joint of smoked ham, dark at the rind.", description: "Keeps for weeks. A hearty meal's worth.",
    use: { verb: "Eat", needs: { hunger: 40 } },
  },
  "soup-bones": {
    id: "soup-bones", name: "Soup Bones", kind: "food", value: 1, perish: 3,
    appearance: "A bundle of marrow bones.", description: "Boiled into a broth, they stretch a thin meal.",
    use: { verb: "Eat", needs: { hunger: 15, thirst: 5 } },
  },
  "dressed-fowl": {
    id: "dressed-fowl", name: "Dressed Fowl", kind: "food", value: 6, perish: 2,
    appearance: "A plucked and dressed bird, trussed with twine.", description: "Roasted whole, a generous meal.",
    use: { verb: "Eat", needs: { hunger: 40 } },
  },

  // ---- Fruit peddler ----
  "apples": {
    id: "apples", name: "Handful of Apples", kind: "food", value: 2, perish: 18,
    appearance: "A few russet apples, a little bruised.", description: "Crisp and sweet. A light bite that also slakes thirst.",
    use: { verb: "Eat", needs: { hunger: 10, thirst: 8 } },
  },
  "pears": {
    id: "pears", name: "Ripe Pears", kind: "food", value: 2, perish: 6,
    appearance: "Three soft pears, fragrant and heavy.", description: "Juicy enough to ease thirst as well as hunger.",
    use: { verb: "Eat", needs: { hunger: 10, thirst: 12 } },
  },
  "berries": {
    id: "berries", name: "Punnet of Berries", kind: "food", value: 2, perish: 3,
    appearance: "A leaf-lined punnet of dark berries.", description: "A sweet handful — a treat more than a meal.",
    use: { verb: "Eat", needs: { hunger: 8, thirst: 4 } },
  },
  "dried-figs": {
    id: "dried-figs", name: "Dried Figs", kind: "food", value: 4,
    appearance: "A string of sticky dried figs.", description: "Keep well and travel well. Dense and sustaining.",
    use: { verb: "Eat", needs: { hunger: 20 } },
  },

  // ---- Greengrocer (vegetables) ----
  "turnips": {
    id: "turnips", name: "Bunch of Turnips", kind: "food", value: 1, perish: 30,
    appearance: "A muddy bunch of turnips, greens still on.", description: "Cheap and filling, stewed or roasted.",
    use: { verb: "Eat", needs: { hunger: 12 } },
  },
  "onions": {
    id: "onions", name: "Braid of Onions", kind: "food", value: 1,
    appearance: "A plaited braid of brown onions.", description: "Keep for months. The backbone of any pot.",
    use: { verb: "Eat", needs: { hunger: 8 } },
  },
  "cabbage": {
    id: "cabbage", name: "Cabbage", kind: "food", value: 2, perish: 14,
    appearance: "A tight, heavy head of green cabbage.", description: "Boiled or fermented, it feeds a camp.",
    use: { verb: "Eat", needs: { hunger: 15 } },
  },
  "carrots": {
    id: "carrots", name: "Bunch of Carrots", kind: "food", value: 1, perish: 30,
    appearance: "A bunch of earthy carrots.", description: "Sweet and keeping. Good raw or in the pot.",
    use: { verb: "Eat", needs: { hunger: 10 } },
  },
  "dried-beans": {
    id: "dried-beans", name: "Sack of Dried Beans", kind: "food", value: 3,
    appearance: "A small sack of dried beans.", description: "Soaked and simmered, many filling meals.",
    use: { verb: "Eat", needs: { hunger: 25 } },
  },

  // ---- Preserved travel rations (never spoil — the road-keeper's staples) ----
  "hardtack": {
    id: "hardtack", name: "Hardtack", kind: "food", value: 2,
    appearance: "A box of pale, rock-hard ship's biscuit.", description: "Dull, dense, and all but immortal — soak it or break a tooth. The traveller's standby.",
    use: { verb: "Eat", needs: { hunger: 18 } },
  },
  "jerky": {
    id: "jerky", name: "Strips of Jerky", kind: "food", value: 5,
    appearance: "A handful of dark, dried meat strips, tough as leather.", description: "Wind-dried and smoked hard. Keeps for months and travels in a pocket.",
    use: { verb: "Eat", needs: { hunger: 22 } },
  },
  "salt-pork": {
    id: "salt-pork", name: "Salt Pork", kind: "food", value: 6,
    appearance: "A waxed cloth of pork packed grey-white with curing salt.", description: "Salted to keep through any season. Hearty — but the salt leaves you thirsty.",
    use: { verb: "Eat", needs: { hunger: 30, thirst: -8 } },
  },
  "trail-rations": {
    id: "trail-rations", name: "Day's Trail Rations", kind: "food", value: 10,
    appearance: "A wrapped day's ration — hardtack, cheese, dried meat, and nuts.", description: "A balanced day's food for the road, packed to keep. The traveller's standby.",
    use: { verb: "Eat", needs: { hunger: 45 } },
  },

  // ---- Tavern & market drinks (kind "drink") ----
  "ale": {
    id: "ale", name: "Jug of Ale", kind: "drink", value: 2,
    appearance: "A stoppered earthenware jug of brown ale.", description: "Slakes thirst and loosens the shoulders. A mild lift to the spirits — a little resolve back in the field.",
    use: { verb: "Drink", needs: { thirst: 20 }, resolve: 4 },
  },
  "wine": {
    id: "wine", name: "Skin of Wine", kind: "drink", value: 3,
    appearance: "A leather skin of rough red wine.", description: "Sour and warming. Eases thirst and steadies the nerves — restores some resolve between fights.",
    use: { verb: "Drink", needs: { thirst: 15 }, resolve: 6 },
  },
  "spirits": {
    id: "spirits", name: "Flask of Spirits", kind: "drink", value: 6,
    appearance: "A small flask of clear, fierce grain-spirit.", description: "Burns going down. Braces you hard — a deep pull of resolve — but it parches you and muddles the head, so you'll need water and rest the sooner.",
    use: { verb: "Drink", needs: { thirst: -8, sleep: -10 }, resolve: 12 },
  },

  // ---- Mount feed (kind "feed") ----
  // Mounts eat from the pack on the road (engine/upkeep.js) — but their OWN food,
  // not the party's rations. `feedKind` matches a mount's `feed` (data/mounts.js):
  // grazers take fodder, beasts take meat, a drake or dragon takes whole livestock.
  // `nourish` is what one feeding restores. No `use` block, so no player Use button.
  "fodder": {
    id: "fodder", name: "Bale of Fodder", kind: "feed", feedKind: "fodder", value: 4, weight: 6,
    appearance: "A bound bale of hay, oats, and cracked grain.", description: "A day's feed for a horse, pony, mule, or camel. Keeps dry near indefinitely; sold wherever there's a stable.",
    nourish: { hunger: 45, thirst: 5 },
  },
  "raw-meat": {
    id: "raw-meat", name: "Haunch of Raw Meat", kind: "feed", feedKind: "meat", value: 9, weight: 3, perish: 2,
    appearance: "A heavy, bloody haunch wrapped in sacking.", description: "Raw red meat to feed a dire wolf or a griffon. Spoils fast — feed it or lose it.",
    nourish: { hunger: 50 },
  },
  "livestock": {
    id: "livestock", name: "Hobbled Goat", kind: "feed", feedKind: "livestock", value: 70, weight: 30,
    appearance: "A live goat on a short tether, bleating its dread.", description: "A whole beast — the only thing that fills a drake or a dragon. Bulky, costly, and walks itself until the wyrm wants it.",
    nourish: { hunger: 95 },
  },
};

export function goodDef(id) {
  return GOODS[id] || null;
}

const NEED_LABEL = { hunger: "Hunger", thirst: "Thirst", sleep: "Rest" };

// Short, concrete chips of what a consumable's `use` does — the actual numbers,
// so the player sees "+6 Vitality" / "Hunger +35" / "Clears Bleeding" instead of
// vague flavour. Shared by the trader counter and the pack detail panel.
export function useEffectChips(def) {
  const u = def?.use;
  if (!u) return [];
  const chips = [];
  if (u.vitality) chips.push(`${u.vitality > 0 ? "+" : ""}${u.vitality} Vitality`);
  if (u.resolve) chips.push(`${u.resolve > 0 ? "+" : ""}${u.resolve} Resolve`);
  if (u.needs) {
    for (const k of ["hunger", "thirst", "sleep"]) {
      if (u.needs[k]) chips.push(`${NEED_LABEL[k]} ${u.needs[k] > 0 ? "+" : ""}${u.needs[k]}`);
    }
  }
  for (const c of (u.removeConditions || [])) chips.push(`Clears ${c}`);
  return chips;
}
