// Purchasable goods — item templates a trader can stock. These get filed into
// world.codex.items the first time the player buys one, so they render in the
// pack and the narrator can reference them by name.
//
// `value` is the base worth in COPPER (see engine/economy.js: 1sp=10cp,
// 1gp=100cp). A shop sets its asking price from this (town.js stock tables
// apply a multiplier + small per-restock variance). `description` carries the
// effect in plain words — the narrator reads it to adjudicate use (e.g. the
// player says "I rub on the salve"), so effects don't need a separate schema.
//
// `kind` for consumables is one of remedy / food / drink / material / supply.
// None of these are in inventory.js EQUIPPABLE, so they stack in the pack and
// never show an Equip button.

export const GOODS = {
  // ---- Healer / apothecary remedies ----
  "healing-salve": {
    id: "healing-salve", name: "Healing Salve", kind: "remedy", value: 25,
    appearance: "A clay pot of green ointment that smells of crushed comfrey and tallow.",
    description: "Rubbed into a wound, it eases the pain and speeds knitting — restores a little vitality and helps shallow cuts close.",
  },
  "blood-staunch": {
    id: "blood-staunch", name: "Staunching Bandages", kind: "remedy", value: 8,
    appearance: "A tight roll of boiled linen packed with powdered yarrow.",
    description: "Bound over a bleeding wound, it stops the flow — clears the Bleeding condition.",
  },
  "splint": {
    id: "splint", name: "Splint & Wrap", kind: "remedy", value: 10,
    appearance: "Two flat ash laths and a length of waxed cord.",
    description: "Set and bound around a broken limb, it lets a Severed Limb or fracture begin to mend.",
  },
  "willow-bark": {
    id: "willow-bark", name: "Willow-Bark", kind: "remedy", value: 5,
    appearance: "A twist of papery grey bark, bitter to chew.",
    description: "Chewed or steeped, it dulls pain and brings down fever.",
  },
  "fever-tonic": {
    id: "fever-tonic", name: "Fever Tonic", kind: "remedy", value: 22,
    appearance: "A stoppered vial of cloudy amber liquid.",
    description: "Drunk down, it breaks a fever and fights off sickness — clears Infected or Festering Wound over a day.",
  },
  "antivenom": {
    id: "antivenom", name: "Antivenom", kind: "remedy", value: 40,
    appearance: "A small lead-grey vial sealed with black wax.",
    description: "Taken quickly after a bite or sting, it neutralises venom — clears the Poisoned condition.",
  },
  "poultice": {
    id: "poultice", name: "Drawing Poultice", kind: "remedy", value: 12,
    appearance: "A muslin packet of mustard, charcoal, and bog-moss.",
    description: "Laid on a dirty or swelling wound overnight, it draws out corruption before it festers.",
  },
  "healing-draught": {
    id: "healing-draught", name: "Healing Draught", kind: "remedy", value: 50,
    appearance: "A heavy glass flask of red-gold liquor that catches the light.",
    description: "A potent alchemical cordial — drunk down, it restores a good deal of vitality at once.",
  },

  // ---- Butcher (meat) ----
  "fresh-meat": {
    id: "fresh-meat", name: "Cut of Meat", kind: "food", value: 4,
    appearance: "A red cut of fresh meat wrapped in waxed cloth.", description: "Cooked over a fire, a filling meal — eases hunger well.",
  },
  "sausage-links": {
    id: "sausage-links", name: "Sausage Links", kind: "food", value: 3,
    appearance: "A coil of fat pork sausages.", description: "Fry or grill them. Quick and filling on the road.",
  },
  "smoked-ham": {
    id: "smoked-ham", name: "Smoked Ham", kind: "food", value: 8,
    appearance: "A dense joint of smoked ham, dark at the rind.", description: "Keeps for weeks. Several hearty meals' worth.",
  },
  "soup-bones": {
    id: "soup-bones", name: "Soup Bones", kind: "food", value: 1,
    appearance: "A bundle of marrow bones.", description: "Boiled into a broth, they stretch a thin meal.",
  },
  "dressed-fowl": {
    id: "dressed-fowl", name: "Dressed Fowl", kind: "food", value: 6,
    appearance: "A plucked and dressed bird, trussed with twine.", description: "Roasted whole, a generous meal.",
  },

  // ---- Fruit peddler ----
  "apples": {
    id: "apples", name: "Handful of Apples", kind: "food", value: 2,
    appearance: "A few russet apples, a little bruised.", description: "Crisp and sweet. A light bite that takes the edge off hunger and thirst.",
  },
  "pears": {
    id: "pears", name: "Ripe Pears", kind: "food", value: 2,
    appearance: "Three soft pears, fragrant and heavy.", description: "Juicy enough to ease thirst as well as hunger.",
  },
  "berries": {
    id: "berries", name: "Punnet of Berries", kind: "food", value: 2,
    appearance: "A leaf-lined punnet of dark berries.", description: "A sweet handful — better as a treat than a meal.",
  },
  "dried-figs": {
    id: "dried-figs", name: "Dried Figs", kind: "food", value: 4,
    appearance: "A string of sticky dried figs.", description: "Keep well and travel well. Dense and sustaining.",
  },

  // ---- Greengrocer (vegetables) ----
  "turnips": {
    id: "turnips", name: "Bunch of Turnips", kind: "food", value: 1,
    appearance: "A muddy bunch of turnips, greens still on.", description: "Cheap and filling, stewed or roasted.",
  },
  "onions": {
    id: "onions", name: "Braid of Onions", kind: "food", value: 1,
    appearance: "A plaited braid of brown onions.", description: "Keep for months. The backbone of any pot.",
  },
  "cabbage": {
    id: "cabbage", name: "Cabbage", kind: "food", value: 2,
    appearance: "A tight, heavy head of green cabbage.", description: "Boiled or fermented, it feeds a camp.",
  },
  "carrots": {
    id: "carrots", name: "Bunch of Carrots", kind: "food", value: 1,
    appearance: "A bunch of earthy carrots.", description: "Sweet and keeping. Good raw or in the pot.",
  },
  "dried-beans": {
    id: "dried-beans", name: "Sack of Dried Beans", kind: "food", value: 3,
    appearance: "A small sack of dried beans.", description: "Soaked and simmered, many filling meals.",
  },
};

export function goodDef(id) {
  return GOODS[id] || null;
}
