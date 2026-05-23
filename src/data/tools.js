// Adventuring tools — multi-purpose kit used through NARRATION, not the combat
// engine. A tool isn't "used up" by a button; it sits in the pack and the
// narrator checks for it when the player attempts something it enables (rope to
// climb or lower a companion, pitons to descend a sheer face, a torch to light a
// black hex, lockpicks on a barred chest). Surfaced to the narrator in
// [INVENTORY]; the ITEM RULESET doctrine tells it how to adjudicate their use.
//
// kind "tool" so they stack in the pack, sell to a general trader, and show no
// Use button. `tool.uses` is the list of things the item makes possible; some
// carry `tool.consumable:true` (driven in and left, or burned down) so the
// narrator knows they deplete with use.

export const TOOLS = {
  // ---- climbing & traversal (the player's vertical kit) ----
  "rope-hemp": {
    id: "rope-hemp", name: "Coil of Rope (50ft)", kind: "tool", tier: "common", value: 35,
    appearance: "Fifty feet of waxed hemp rope, coiled and slung.",
    description: "The traveller's most versatile tool — climb, lower a companion, lash a raft, bind a prisoner, span a gap, haul a load.",
    tool: { uses: ["climb", "descend", "lower", "secure", "bind", "haul"] },
  },
  "rope-silk": {
    id: "rope-silk", name: "Silk Climbing-Rope (60ft)", kind: "tool", tier: "uncommon", value: 220,
    appearance: "Sixty feet of thin, impossibly strong braided silk.",
    description: "Lighter and stronger than hemp, and it grips knots well — favoured by climbers who trust their lives to it.",
    tool: { uses: ["climb", "descend", "lower", "secure"] },
  },
  "grappling-hook": {
    id: "grappling-hook", name: "Grappling Hook", kind: "tool", tier: "common", value: 60,
    appearance: "A four-tined iron hook with a tie-off eye.",
    description: "Thrown and set, it turns a sheer wall or a ship's rail into a climb. Pairs with a rope.",
    tool: { uses: ["climb", "anchor", "snag"] },
  },
  "pitons": {
    id: "pitons", name: "Iron Pitons (set of 10)", kind: "tool", tier: "common", value: 45,
    appearance: "Ten flanged iron spikes with eyes, and a stout driving-hammer.",
    description: "Hammered into rock or ice to descend or ascend a sheer face — set a line of them and rope between to work down a cliff. Driven pitons are left behind.",
    tool: { uses: ["descend", "climb", "anchor"], consumable: true },
  },
  "crampons": {
    id: "crampons", name: "Crampons", kind: "tool", tier: "common", value: 40,
    appearance: "Spiked iron frames that strap under the boots.",
    description: "Bite into ice and frozen scree. Footing on a glacier or a frosted pass that would otherwise turn an ankle or a life.",
    tool: { uses: ["climb", "traverse-ice"] },
  },

  // ---- light & fire ----
  "torch": {
    id: "torch", name: "Bundle of Torches", kind: "tool", tier: "common", value: 6,
    appearance: "A bundle of pitch-soaked rushes bound to handle-staves.",
    description: "Cheap light for a black hex — a cellar, a cave, a moonless road. Each burns about an hour, then it's spent.",
    tool: { uses: ["light"], consumable: true },
  },
  "lantern": {
    id: "lantern", name: "Hooded Lantern", kind: "tool", tier: "common", value: 90,
    appearance: "A tin lantern with a horn pane and a sliding hood.",
    description: "Steady, shutterable light that a wind won't kill — hood it to hide, open it to read a room. Burns lamp-oil.",
    tool: { uses: ["light", "signal"] },
  },
  "lamp-oil": {
    id: "lamp-oil", name: "Flask of Lamp-Oil", kind: "tool", tier: "common", value: 8,
    appearance: "A stoppered clay flask of fish-oil.",
    description: "Feeds a lantern for hours — or, flung and lit, makes a nasty fire. Spent when used.",
    tool: { uses: ["fuel", "fire"], consumable: true },
  },
  "tinderbox": {
    id: "tinderbox", name: "Tinderbox", kind: "tool", tier: "common", value: 12,
    appearance: "A tin of flint, fire-steel, and charcloth.",
    description: "Strikes a flame in moments where bare hands and damp wood would take an hour. The difference between a warm camp and a cold one.",
    tool: { uses: ["fire", "light"] },
  },

  // ---- entry, work & survival ----
  "lockpicks": {
    id: "lockpicks", name: "Lockpicks", kind: "tool", tier: "common", value: 70,
    appearance: "A leather roll of slender hooks, tension-wrenches, and rakes.",
    description: "Coaxes a lock open without the key — a chest, a cell, a counting-house door. Better picks (and a steady Reflex) beat better locks.",
    tool: { uses: ["pick-lock"] },
  },
  "fine-lockpicks": {
    id: "fine-lockpicks", name: "Masterwork Lockpicks", kind: "tool", tier: "uncommon", value: 320,
    appearance: "Blued-steel picks in a fitted ivory case, each tool to a hair's tolerance.",
    description: "A thief's pride — turns locks that defeat common picks, and quietly.",
    tool: { uses: ["pick-lock"] },
  },
  "crowbar": {
    id: "crowbar", name: "Crowbar", kind: "tool", tier: "common", value: 30,
    appearance: "A forearm of forged iron, hooked and chisel-tipped.",
    description: "Pries open a nailed crate, a stuck door, a coffin lid — and serves as a desperate cudgel at need.",
    tool: { uses: ["pry", "force-door"] },
  },
  "shovel": {
    id: "shovel", name: "Folding Spade", kind: "tool", tier: "common", value: 25,
    appearance: "A short iron spade with a hinged ash handle.",
    description: "Digs a grave, a latrine, a cache, or down to whatever the map promised was buried.",
    tool: { uses: ["dig", "bury"] },
  },
  "whetstone": {
    id: "whetstone", name: "Whetstone", kind: "tool", tier: "common", value: 10,
    appearance: "A flat grey honing-stone in an oiled cloth.",
    description: "Keeps an edge keen between fights. A dull blade is a club; a honed one bites.",
    tool: { uses: ["sharpen", "maintain-gear"] },
  },
  "repair-kit": {
    id: "repair-kit", name: "Armourer's Repair Kit", kind: "tool", tier: "common", value: 55,
    appearance: "A satchel of rivets, wire, leather scraps, awl, and a small hammer.",
    description: "Patches a split strap, a sprung rivet, a battered helm — keeps gear serviceable far from any smith.",
    tool: { uses: ["maintain-gear", "repair"] },
  },
  "bedroll": {
    id: "bedroll", name: "Bedroll & Blanket", kind: "tool", tier: "common", value: 20,
    appearance: "A rolled wool blanket and an oiled-canvas ground sheet.",
    description: "A dry, warm night's rest in the open — the difference between waking restored and waking sick.",
    tool: { uses: ["rest", "camp"] },
  },
  "waterskin": {
    id: "waterskin", name: "Waterskin", kind: "tool", tier: "common", value: 14,
    appearance: "A stitched leather skin with a horn stopper.",
    description: "Carries a day's water across dry country. Drink to slake thirst; refills itself at any well, settlement, or clean stream.",
    // A refillable vessel: `capacity` draughts per skin, each drink slakes thirst
    // without consuming the skin. Refilled to full at water sources (see beat.js).
    capacity: 3,
    use: { verb: "Drink", needs: { thirst: 34 } },
    tool: { uses: ["carry-water"] },
  },
  "cook-pot": {
    id: "cook-pot", name: "Cook-Pot & Kit", kind: "tool", tier: "common", value: 28,
    appearance: "A dented iron pot, a tin cup, a knife, and a wooden spoon.",
    description: "Turns raw stores into a hot meal — and a hot meal restores more than a cold one. The heart of a good camp.",
    tool: { uses: ["cook", "camp"] },
  },
  "fishing-kit": {
    id: "fishing-kit", name: "Fishing Line & Hooks", kind: "tool", tier: "common", value: 16,
    appearance: "A wound line, bone hooks, and a few feathered lures.",
    description: "Pulls a meal from any river or shore for the price of an hour's patience.",
    tool: { uses: ["forage", "fish"] },
  },
  "snare-wire": {
    id: "snare-wire", name: "Snare Wire", kind: "tool", tier: "common", value: 18,
    appearance: "A coil of fine brass wire and a few set triggers.",
    description: "Set along a game-trail at dusk, it catches rabbit or fowl by morning. Quiet meat for a careful traveller.",
    tool: { uses: ["forage", "trap"] },
  },
  "spyglass": {
    id: "spyglass", name: "Spyglass", kind: "tool", tier: "uncommon", value: 280,
    appearance: "A drawtube of brass and leather with ground-glass lenses.",
    description: "Reads a banner, a road, or a warband at a distance no naked eye can — the difference between a planned approach and a sprung trap.",
    tool: { uses: ["scout", "see-far"] },
  },
  "manacles": {
    id: "manacles", name: "Iron Manacles", kind: "tool", tier: "common", value: 50,
    appearance: "A pair of riveted iron wrist-irons with a stout key.",
    description: "Holds a prisoner who'd otherwise run or knife you in the night — for a bounty taken alive, or a captive you mean to keep.",
    tool: { uses: ["restrain", "bind"] },
  },
  "healers-kit": {
    id: "healers-kit", name: "Field Surgeon's Kit", kind: "tool", tier: "uncommon", value: 180,
    appearance: "A roll of needle, gut, clamps, probe, and clean linen.",
    description: "Lets a steady hand close a wound, set a bone, or draw a barb in the field — care a salve alone can't give. Supplies for many uses.",
    tool: { uses: ["treat-wound", "surgery"] },
  },
  "chalk-and-charcoal": {
    id: "chalk-and-charcoal", name: "Chalk & Charcoal", kind: "tool", tier: "common", value: 4,
    appearance: "A few sticks of chalk and pressed charcoal in a tin.",
    description: "Mark a route through a warren, leave a sign, sketch a map, blaze a trail you mean to find again.",
    tool: { uses: ["mark", "map"] },
  },
};

export function toolDef(id) {
  return TOOLS[id] || null;
}
