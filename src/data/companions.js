// Recruitable companions — real, persistent people. Each is a full codex
// character (the same shape as the named NPCs in initial-state.js): appearance,
// attributes, profession, gear, and what they know. Recruiting one (engine/
// party.js) files this into world.codex.characters as kind "companion" and adds
// them to state.party, so they travel with you, persist, and are run by the
// narrator like anyone else.
//
// Board-only fields (`role`, `desc`, `terms`, `feeCp`) drive the tavern's
// "Looking to join" list; the rest is the person.

export const COMPANIONS = {
  bram: {
    id: "bram", key: "bram", role: "sellsword", terms: "a share of the spoils", feeCp: 0,
    desc: "A scarred sellsword nursing a cheap ale, looking for a road worth walking.",
    name: "Bram Holt", race: "human", profession: "sellsword", origin: "central",
    age: "in his late thirties", attractiveness: "rough, broken-nosed, not unhandsome",
    appearance: { skin: "weathered tan", hair: "black shot with grey, cropped short", eyes: "brown", build: "big, slab-shouldered", facial_hair: "perpetual stubble", marks: "a broken nose and a long scar down the right forearm" },
    base_appearance: "Big and slab-shouldered. Weathered tan, grey-shot black hair cropped short. Broken nose, brown eyes, a long forearm scar.",
    description: "A sellsword between contracts, drinking cheap and watching the door. Loyal to coin first — and, slowly, to people who hold a line beside him.",
    attributes: { body: 7, reflex: 5, vigor: 6, mind: 3, wit: 4, presence: 4 },
    worn: ["boiled-leather-jerkin", "arming-sword", "dented-iron-cap"],
    knows: ["I've soldiered under three banners and buried friends under all of them.", "I'll hold a line for coin; I'll hold it longer for someone who holds it with me."],
  },
  senna: {
    id: "senna", key: "senna", role: "hunter", terms: "an even split and first pick of pelts", feeCp: 0,
    desc: "A marsh-hunter with a yew bow, bored of shooting eels for a living.",
    name: "Senna Rell", race: "human", profession: "hunter", origin: "central",
    age: "in her late twenties", attractiveness: "lean and sharp-eyed, handsome in a hard way",
    appearance: { skin: "wind-burned", hair: "dark blonde in a tight braid", eyes: "pale grey", build: "lean and wiry", facial_hair: "none", marks: "a bowstring callus and a fish-hook scar at the thumb" },
    base_appearance: "Lean and wiry, wind-burned. Dark-blonde hair in a tight braid, pale grey eyes. A bowstring callus on the draw hand.",
    description: "A marsh-hunter who can read water and weather and put an arrow where she looks. Quiet, dry, and quietly tired of the Mire.",
    attributes: { body: 4, reflex: 8, vigor: 5, mind: 5, wit: 6, presence: 3 },
    worn: ["oiled-hunting-leathers", "yew-longbow", "skinning-knife"],
    knows: ["The Mire feeds you if you listen to it and drowns you if you don't.", "I've never missed twice at what mattered."],
  },
  tomkin: {
    id: "tomkin", key: "tomkin", role: "porter", terms: "board, a small wage, and no night-watches", feeCp: 0,
    desc: "A stout halfling who'll carry, cook, and complain in equal measure.",
    name: "Tomkin Burr", race: "halfling", profession: "porter", origin: "central",
    age: "in his forties", attractiveness: "ruddy, round, and amiable",
    appearance: { skin: "ruddy", hair: "curly chestnut, thinning on top", eyes: "hazel", build: "short and barrel-round", facial_hair: "mutton-chop whiskers", marks: "burn-scars on both forearms from a hundred campfires" },
    base_appearance: "Short and barrel-round, ruddy-faced. Curly chestnut hair thinning on top, mutton-chop whiskers, hazel eyes.",
    description: "A hedgerow halfling who's portered for caravans up and down the road. Carries more than looks possible, cooks better than anyone expects, and grumbles the whole way.",
    attributes: { body: 4, reflex: 4, vigor: 6, mind: 5, wit: 6, presence: 5 },
    worn: ["padded-coat", "heavy-pack", "iron-skillet", "long-knife"],
    knows: ["A full belly wins more marches than a sharp sword.", "I know every dry camp and cheap bed between here and Whitemarch."],
  },
  cray: {
    id: "cray", key: "cray", role: "hedge-witch", terms: "a tenth of all coin, and no questions about the cellar-work", feeCp: 30,
    desc: "A hedge-witch with cold hands and a sharp eye, run out of one too many parishes.",
    name: "Mother Cray", race: "human", profession: "witch", origin: "north",
    age: "hard to place — somewhere past fifty", attractiveness: "severe, with a stillness people mistake for calm",
    appearance: { skin: "winter-pale", hair: "iron-grey, pinned back hard", eyes: "pale amber, very steady", build: "thin and upright", facial_hair: "none", marks: "tally-scars along the left forearm and stained fingertips" },
    base_appearance: "Thin and upright, winter-pale. Iron-grey hair pinned back, steady amber eyes, stained fingertips. Tally-scars on the left forearm.",
    description: "A hedge-witch of charms, births, and quieter work, moved on from too many parishes. Useful, unsettling, and entirely worth the tenth she asks.",
    attributes: { body: 3, reflex: 4, vigor: 5, mind: 8, wit: 7, presence: 6 },
    worn: ["black-shawl", "charm-strung-belt", "bone-handled-knife"],
    knows: ["Every cure is a poison measured kindly.", "I owe two debts I do not speak of, and I am owed a great many more."],
  },
  doran: {
    id: "doran", key: "doran", role: "deserter", terms: "a fair split and no banners, ever again", feeCp: 0,
    desc: "A Whitemarch deserter keeping his head down, handy with a spear and quieter about why.",
    name: "Doran Vell", race: "human", profession: "soldier", origin: "central",
    age: "in his early thirties", attractiveness: "tired-handsome, with a soldier's wariness",
    appearance: { skin: "tan, weather-lined young", hair: "brown, regulation-short grown out ragged", eyes: "grey-green", build: "tall and rangy", facial_hair: "a few days' beard", marks: "a faded Whitemarch brand he keeps covered, and a stiff left shoulder" },
    base_appearance: "Tall and rangy, tan and lined before his time. Ragged-grown brown hair, grey-green eyes, a few days' beard. A covered brand on the arm.",
    description: "A Whitemarch spearman who walked away from a war he wouldn't name. Disciplined, steady under pressure, and watching the road behind as much as ahead.",
    attributes: { body: 6, reflex: 6, vigor: 6, mind: 4, wit: 5, presence: 4 },
    worn: ["worn-gambeson", "footman-spear", "round-shield", "iron-cap"],
    knows: ["I held a wall at Whitemarch and I will not do it again for any lord's coin.", "Keep your spacing, watch the flanks, and never let them get behind you."],
  },
};

export const COMPANION_LIST = Object.values(COMPANIONS);

// The full codex-character entry for a recruited companion (drops board-only
// fields; tags them kind "companion").
export function companionCodexEntry(tmpl) {
  return {
    id: tmpl.id, kind: "companion",
    name: tmpl.name, race: tmpl.race, profession: tmpl.profession, origin: tmpl.origin,
    age: tmpl.age, attractiveness: tmpl.attractiveness,
    appearance: tmpl.appearance, base_appearance: tmpl.base_appearance,
    description: tmpl.description, attributes: tmpl.attributes,
    worn: tmpl.worn, knows: tmpl.knows,
  };
}
