// Whitemarch — the walled iron-capital, authored as a node graph (place scale).
//
// This replaces the old ~921-hex Supabase city. A node is one vantage the player
// stands in; `exits` lists the other nodes you can step to (symmetrised on load,
// so each link is authored once). A node with `service` wires a data/town.js
// BUILDINGS counter; `worldExit: true` marks a node you can step out of onto the
// world hex the city sits on (0,0). `entry` is where you arrive when entering.
//
// Keep it declarative and legible — this whole file is the city. To extend
// Whitemarch, add a node and an exit. No coordinates, no door graph, no pipeline.

export const whitemarch = {
  id: "whitemarch",
  name: "Whitemarch",
  kind: "city",
  worldTile: { x: 0, y: 0 },     // the world hex this place sits on
  entry: "grain-square",         // you grew up here — the market is home ground
  biomeId: "whitemarch",         // difficulty/encounter context (regions.js)
  description:
    "The walled iron-capital where the iron-shilling is minted. Black-and-white " +
    "gate-towers stand over a Great Wall that rings wards of market, dock, chain, " +
    "court, and citadel; the Whitewend runs brown beneath the quays. Inside the " +
    "wall the country gives way wholly to stone, smoke, and crowd.",

  nodes: {
    // ---- The Crown Gate (the mouth of the city; out to the world) ----
    "crown-gate": {
      name: "The Crown Gate",
      district: "Crown Gate Ward",
      type: "gate",
      terrain: "wall",
      access: "guarded",
      worldExit: true,
      description:
        "The great black-and-white gatehouse, chained portcullis up by day. " +
        "Gate-clerks read papers aloud; pikemen of the Watch lean in the shade " +
        "of the arch. Beyond the toll, the open road and the march country.",
      exits: ["toll-hall", "caravan-yard", "grand-concourse"],
    },
    "toll-hall": {
      name: "The Toll Hall",
      district: "Crown Gate Ward",
      type: "hall",
      terrain: "indoor",
      access: "guarded",
      service: "dock-customs-officer",
      description:
        "A stone throat of chained ledgers, stamp-blocks, and inkhorns. Everything " +
        "that enters Whitemarch by the Crown Gate is weighed, counted, and taxed here.",
      exits: ["crown-gate"],
    },

    // ---- The Caravanserai (outer works, just inside the gate) ----
    "caravan-yard": {
      name: "The Caravan Yard",
      district: "The Caravanserai",
      type: "yard",
      terrain: "settlement",
      access: "public",
      service: "caravanserai-warden",
      description:
        "A walled wagon-court of unhitched drays, road-dust, and three languages of " +
        "haggling. Carters sleep in the bunkhouses; the warden keeps the gate-rolls.",
      exits: ["crown-gate", "great-stable"],
    },
    "great-stable": {
      name: "The Great Stable",
      district: "The Caravanserai",
      type: "stable",
      terrain: "settlement",
      access: "public",
      service: "stable",
      description:
        "Long lines of stalls, the warm reek of horse and straw. Drovers, post-riders, " +
        "and the city's own remount string. Mounts change hands in the trampled yard.",
      exits: ["caravan-yard"],
    },

    // ---- The Grand Market (the lively heart) ----
    "grand-concourse": {
      name: "The Grand Concourse",
      district: "The Grand Market",
      type: "plaza",
      terrain: "street",
      access: "public",
      description:
        "The broad paved way that spines the city, awnings and stalls crowding both " +
        "edges. From here the lanes run to every ward; the crowd never quite thins.",
      exits: ["crown-gate", "grain-square", "low-wards", "river-stair", "guild-court"],
    },
    "grain-square": {
      name: "Grain Square",
      district: "The Grand Market",
      type: "market",
      terrain: "settlement",
      access: "public",
      service: "market",
      description:
        "The wet-market heart of Whitemarch — grain-factors' scales, butchers' rows, " +
        "fruit under cloth awnings, a well in the middle worn smooth by rope. You know " +
        "every stall by name.",
      exits: ["grand-concourse", "smith-row", "apothecary-stall"],
    },
    "smith-row": {
      name: "Smith Row",
      district: "The Grand Market",
      type: "smithy",
      terrain: "settlement",
      access: "public",
      service: "blacksmith",
      description:
        "A row of banked forges throwing orange light up soot-black walls — the ring " +
        "of hammer on cooling iron, a wall of tongs, barrels of quench-water. " +
        "Whitemarch iron, worked where it is mined.",
      exits: ["grain-square"],
    },
    "apothecary-stall": {
      name: "The Apothecary's Stall",
      district: "The Grand Market",
      type: "healer",
      terrain: "settlement",
      access: "public",
      service: "apothecary",
      description:
        "A shaded nook hung with drying herbs and stoppered jars — willow-bark, " +
        "comfrey, antivenom for the marsh-bitten. The apothecary weighs powders on " +
        "a tiny brass scale.",
      exits: ["grain-square"],
    },

    // ---- The Low Wards (the poor, crowded quarter) ----
    "low-wards": {
      name: "The Low Wards",
      district: "The Low Wards",
      type: "town",
      terrain: "street",
      access: "public",
      description:
        "Crooked tenement lanes below the market, washing strung overhead, gutters " +
        "running to the river. Poor, crowded, and watched less closely than the rest.",
      exits: ["grand-concourse", "leaning-tankard", "bonepicker-chapel", "almshouse", "chandlery"],
    },
    "leaning-tankard": {
      name: "The Leaning Tankard",
      district: "The Low Wards",
      type: "bldg",
      terrain: "indoor",
      access: "public",
      service: "tavern",
      description:
        "A low common room, a peat fire, and a board by the door thick with curling " +
        "notices held on by knives. Work for hire, news from the road, and the cheapest " +
        "ale inside the wall.",
      exits: ["low-wards"],
    },
    "bonepicker-chapel": {
      name: "Bonepicker's Chapel",
      district: "The Low Wards",
      type: "shrine",
      terrain: "indoor",
      access: "public",
      service: "chapel-priest",
      description:
        "A close, candle-smoked shrine to the Pale God, kept by a priest who buries the " +
        "ward's unclaimed dead. The poor come here for blessing, for silence, and to " +
        "settle small debts of the soul.",
      exits: ["low-wards"],
    },
    "almshouse": {
      name: "The Almshouse Overflow",
      district: "The Low Wards",
      type: "healer",
      terrain: "indoor",
      access: "public",
      service: "healer",
      description:
        "The hospital cloister's overflow ward — rafters hung with drying herbs, the " +
        "air thick with comfrey and tallow. They turn away no one who can stand the wait.",
      exits: ["low-wards"],
    },
    "chandlery": {
      name: "The Tallow Chandlery",
      district: "The Low Wards",
      type: "bldg",
      terrain: "indoor",
      access: "public",
      service: "chandler",
      description:
        "Racks of dipped tallow and rushlight, a barrel of lamp-oil, tinderboxes by the " +
        "door. Whatever burns against the dark, the chandler sells it by the bundle.",
      exits: ["low-wards"],
    },

    // ---- The River Docks (the Whitewend quays) ----
    "river-stair": {
      name: "The River Stair",
      district: "The River Docks",
      type: "stair",
      terrain: "street",
      access: "public",
      description:
        "Worn stone steps down from the concourse to the brown Whitewend. Gulls, " +
        "rope-coils, the slap of water on the quay-stones, and the smell of river-mud.",
      exits: ["grand-concourse", "high-quay", "smuggler-stairs"],
    },
    "high-quay": {
      name: "The High Quay",
      district: "The River Docks",
      type: "dock",
      terrain: "settlement",
      access: "public",
      service: "dock-customs-officer",
      description:
        "The customs quay — barges nosed in three deep, cranes swinging bales, a " +
        "customs-officer with a chained ledger taxing every keel. The city drinks and " +
        "eats off this water.",
      exits: ["river-stair", "warehouse-row"],
    },
    "warehouse-row": {
      name: "Warehouse Row",
      district: "The River Docks",
      type: "bldg",
      terrain: "indoor",
      access: "restricted",
      description:
        "Shuttered bond-warehouses, the air close with grain-dust and tar. Bonded goods, " +
        "guarded goods, and a few crates nobody will admit to owning.",
      exits: ["high-quay"],
    },
    "smuggler-stairs": {
      name: "The Smuggler's Stairs",
      district: "The River Docks",
      type: "hidden",
      terrain: "indoor",
      access: "hidden",
      description:
        "A black slot of stairs between two quay-houses, going down to a water-gate the " +
        "customs rolls don't mention. Things move through here that the Toll Hall never " +
        "weighs.",
      exits: ["river-stair"],
    },

    // ---- The Guild Court & Chain Ward (registry, law, the slave market) ----
    "guild-court": {
      name: "The Guild Court",
      district: "The Guild Court",
      type: "court",
      terrain: "settlement",
      access: "public",
      description:
        "A flagged court ringed by guild-halls and the Registry, where masters take oaths " +
        "and apprentices are bound. Petition-clerks work folding tables under the colonnade.",
      exits: ["grand-concourse", "registry-hall", "chain-steps", "inner-gate"],
    },
    "registry-hall": {
      name: "The Registry Hall",
      district: "The Guild Court",
      type: "hall",
      terrain: "indoor",
      access: "conditional",
      service: "courier",
      description:
        "Wall on wall of pigeon-holed contracts and sealed letters. Every iron-shilling " +
        "minted here is recorded under one of seven hundred contracts; the couriers carry " +
        "what the city wants carried.",
      exits: ["guild-court"],
    },
    "chain-steps": {
      name: "The Chain Steps",
      district: "The Chain Ward",
      type: "slavemarket",
      terrain: "settlement",
      access: "guarded",
      service: "slavemarket",
      description:
        "The sale-steps of the Chain Ward, where the Flesh Wardens walk bonded captives " +
        "out under the iron rail and the Chain Factor reads the roster aloud. Grim, legal, " +
        "and busy. Collar-keys hang heavy at every warden's belt.",
      exits: ["guild-court", "holding-cells"],
    },
    "holding-cells": {
      name: "The Holding Cells",
      district: "The Chain Ward",
      type: "prison",
      terrain: "indoor",
      access: "restricted",
      service: "gaol",
      description:
        "The ward gaol behind the sale-steps — a stone corridor of barred cells and a " +
        "warden's wanted-board. Debtors, captives, and the bountied wait here for sale, " +
        "trial, or whoever will pay their bond.",
      exits: ["chain-steps"],
    },

    // ---- The Citadel (the High Wall — Court Hill & the Iron Palace) ----
    "inner-gate": {
      name: "The Inner Gate",
      district: "The Citadel",
      type: "gate",
      terrain: "wall",
      access: "conditional",
      description:
        "The High Wall's gate onto Court Hill, where the citadel guard read writs before " +
        "they let anyone climb. Without a seal or an appointment, this is as far as the " +
        "crowd comes.",
      exits: ["guild-court", "muster-court"],
    },
    "muster-court": {
      name: "The Muster Court",
      district: "The Citadel",
      type: "barracks",
      terrain: "settlement",
      access: "restricted",
      description:
        "The citadel's drill-court — the city garrison at arms, the muster-rolls, the " +
        "armoury doors. The iron crest is everywhere, cut into stone and stamped on steel.",
      exits: ["inner-gate", "iron-palace"],
    },
    "iron-palace": {
      name: "The Iron Palace",
      district: "The Citadel",
      type: "palace",
      terrain: "indoor",
      access: "restricted",
      description:
        "The seat of the Lord-Treasurer and the Counting House at the city's heart — black " +
        "stone, iron-bound doors, the quiet of real power. The iron-shilling is good where " +
        "it is good because someone in this building says so.",
      exits: ["muster-court"],
    },
  },
};
