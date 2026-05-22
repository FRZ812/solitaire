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
};

export function goodDef(id) {
  return GOODS[id] || null;
}
