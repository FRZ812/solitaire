// Combat archetypes — the mechanical identity beneath the 29 narrative professions.
//
// The professions in `professions.js` are the world's vocabulary: a Sellsword, a
// Hedge Mage, an Innkeeper. They stay exactly as they are, because the codex, the
// narrator contracts, and the whole social layer are built on them.
//
// What they no longer carry is a bespoke mechanical stack each. Every profession
// resolves to ONE of nine archetypes, and the archetype owns the combat model:
// the stamina economy, what Guard and Evade cost, the seed ability kit, and how
// an AI-run companion of that stripe behaves.
//
// Resolution is one-directional: archetypes know about professions, professions
// know nothing about archetypes. Nothing here is imported by `professions.js`.

import { canonicalProfessionId } from "./progression-paths.js";

// Defensive verbs are universal and always available — they never occupy an
// equipped ability slot. Their COST is what varies by archetype, and that cost is
// the whole tension: you usually know the right answer to a telegraph and often
// cannot afford it.
export const UNIVERSAL_VERBS = Object.freeze(["strike", "guard", "evade"]);

// Telegraph tags. An enemy's wind-up is tagged, and each tag has a correct
// response. A two-option read against a raw damage number is solved once and
// never thought about again; pairing the tag with a stamina price is what keeps
// round six different from round two.
export const TELEGRAPH_TAGS = Object.freeze({
  heavy: Object.freeze({
    id: "heavy", label: "Heavy",
    answer: "evade",
    desc: "One committed blow. Slipping it costs stamina; eating it costs far more.",
  }),
  flurry: Object.freeze({
    id: "flurry", label: "Flurry",
    answer: "guard",
    desc: "Several small hits. Cheap to turn one at a time, draining over a long exchange.",
  }),
  unblockable: Object.freeze({
    id: "unblockable", label: "Unblockable",
    answer: null,
    desc: "Neither guard nor footwork answers this. Interrupt it, or accept it.",
  }),
  grapple: Object.freeze({
    id: "grapple", label: "Grapple",
    answer: "break",
    desc: "A hold. Break it or lose the next action.",
  }),
});

// Stamina and cost numbers are deliberate SEEDS, not final balance. They exist so
// the round loop can be simulated at all; Phase 5 tunes them against the sim
// anchors (65-75% baseline duel, median 4-7 rounds, >=25pt skill delta).
//
//   staminaMax = base + vigor * perVigor      regen is per round, partial by design:
//   a pool that refills every round can never run dry, and a stamina economy that
//   cannot run dry has no tension in it.
function archetype(id, name, config) {
  return Object.freeze({
    id,
    name,
    deferred: false,
    stance: "balanced",
    ...config,
    stamina: Object.freeze({ base: 10, perVigor: 1, regen: 2, ...(config.stamina || {}) }),
    abilities: Object.freeze([...(config.abilities || [])]),
    attributes: Object.freeze([...(config.attributes || [])]),
    professions: Object.freeze([...(config.professions || [])]),
  });
}

export const ARCHETYPES = Object.freeze({
  vanguard: archetype("vanguard", "Vanguard", {
    desc: "Holds the line. Deep stamina, cheap guard, poor footwork — meant to be hit.",
    attributes: ["body", "vigor", "reflex", "wit"],
    stamina: { base: 16, perVigor: 1.4, regen: 2 },
    guardCost: 5,
    evadeCost: 8,
    stance: "aggressive",
    professions: ["fighter", "barbarian", "labourer", "commander"],
    abilities: [
      "warrior-measured-strike", "warrior-guarded-cut", "warrior-turning-parry",
      "warrior-break-guard", "barbarian-brutal-swing", "rallying-shout",
    ],
  }),

  skirmisher: archetype("skirmisher", "Skirmisher", {
    desc: "Wins by not being there. Cheap evasion, expensive guard, punishes an opening.",
    attributes: ["reflex", "wit", "vigor", "body"],
    stamina: { base: 13, perVigor: 1.1, regen: 2 },
    guardCost: 8,
    evadeCost: 5,
    stance: "opportunist",
    professions: ["rogue", "ranger", "mariner"],
    abilities: [
      "rogue-assess-mark", "rogue-testing-cut", "rogue-slip-the-line",
      "ranger-ranging-shot", "ranger-evading-step", "ranger-crippling-shot",
    ],
  }),

  channeler: archetype("channeler", "Channeler", {
    desc: "Ends fights before they reach round five. Shallow stamina — defence is a last resort.",
    attributes: ["mind", "wit", "presence", "reflex"],
    stamina: { base: 8, perVigor: 0.7, regen: 1 },
    guardCost: 7,
    evadeCost: 7,
    stance: "artillery",
    professions: ["wizard", "sorcerer"],
    abilities: [
      "arcane-bolt", "firebolt", "ice-shard", "mana-shield", "combust", "lightning-bolt",
    ],
  }),

  invoker: archetype("invoker", "Invoker", {
    desc: "Keeps the line standing. Wards and mends rather than out-damaging.",
    attributes: ["presence", "mind", "vigor", "wit"],
    stamina: { base: 11, perVigor: 1, regen: 2 },
    guardCost: 6,
    evadeCost: 7,
    stance: "support",
    professions: ["cleric", "healer"],
    abilities: ["bless", "heal", "smite", "shield-of-faith", "radiance", "sanctuary"],
  }),

  zealot: archetype("zealot", "Zealot", {
    desc: "Takes the blow meant for someone else, and is paid for it.",
    attributes: ["presence", "vigor", "body", "wit"],
    stamina: { base: 15, perVigor: 1.3, regen: 2 },
    guardCost: 5,
    evadeCost: 7,
    stance: "protector",
    professions: ["paladin", "monk"],
    abilities: [
      "paladin-oathguard", "paladin-vowed-strike", "paladin-stand-fast",
      "monk-measured-palm", "monk-yielding-guard", "monk-joint-check",
    ],
  }),

  warden: archetype("warden", "Warden", {
    desc: "Turns the ground itself against the fight. Slow, cumulative, seasonal.",
    attributes: ["wit", "mind", "vigor", "presence"],
    stamina: { base: 12, perVigor: 1.1, regen: 2 },
    guardCost: 6,
    evadeCost: 6,
    stance: "controller",
    professions: ["druid"],
    abilities: [
      "druid-verdant-spark", "druid-sunlance", "druid-leafrot",
      "druid-rimebark", "druid-saprise", "druid-frostroot",
    ],
  }),

  occultist: archetype("occultist", "Occultist", {
    desc: "Buys power on credit. Every good turn has a price attached to it.",
    attributes: ["mind", "presence", "wit", "vigor"],
    stamina: { base: 10, perVigor: 0.9, regen: 1 },
    guardCost: 7,
    evadeCost: 7,
    stance: "artillery",
    professions: ["warlock"],
    abilities: [
      "warlock-tithe-bolt", "warlock-debt-mark", "warlock-favors-rebuke",
      "warlock-open-covenant", "warlock-owed-ward", "warlock-covenant-lash",
    ],
  }),

  artisan: archetype("artisan", "Artisan", {
    desc: "Brings tools, not talent. Finite charges, prepared answers, no improvisation.",
    attributes: ["mind", "wit", "reflex", "body"],
    stamina: { base: 11, perVigor: 1, regen: 2 },
    guardCost: 6,
    evadeCost: 6,
    stance: "controller",
    professions: ["artificer", "artisan", "farmer", "merchant", "scholar", "steward"],
    abilities: [
      "artificer-snapfire-capsule", "artificer-field-refit", "artificer-guard-projector",
      "artificer-tangle-line", "artificer-arc-node", "artificer-countermeasure",
    ],
  }),

  voice: archetype("voice", "Voice", {
    desc: "Fights the will behind the weapon. Morale, timing, and the nerve to keep talking.",
    attributes: ["presence", "wit", "reflex", "mind"],
    stamina: { base: 11, perVigor: 0.9, regen: 2 },
    guardCost: 7,
    evadeCost: 6,
    stance: "support",
    professions: ["bard", "diplomat", "courtier", "ruler", "attendant", "performer", "innkeeper"],
    abilities: [
      "bard-clarion-note", "bard-steady-beat", "bard-cutting-verse",
      "bard-rising-tempo", "bard-dissonant-chord", "bard-heartening-chorus",
    ],
  }),
});

// The Wanderer is deliberately unmapped. It is the "not yet anything" profession —
// a life built from whatever the road taught — so it defers to the player's first
// real talent choice rather than being silently filed under a discipline they
// never picked. Until then it resolves to the fallback so combat always has a
// model to run.
export const DEFERRED_PROFESSIONS = Object.freeze(["wanderer"]);
export const FALLBACK_ARCHETYPE_ID = "vanguard";

export const PROFESSION_ARCHETYPE = Object.freeze(
  Object.values(ARCHETYPES).reduce((map, record) => {
    for (const professionId of record.professions) map[professionId] = record.id;
    return map;
  }, {}),
);

export const ARCHETYPE_IDS = Object.freeze(Object.keys(ARCHETYPES));

export function archetypeById(id) {
  return ARCHETYPES[id] || null;
}

/** Which archetype does a profession id resolve to? Aliases are honoured. */
export function archetypeIdForProfession(professionId) {
  const canonical = canonicalProfessionId(professionId) || professionId;
  return PROFESSION_ARCHETYPE[canonical] || null;
}

export function isDeferredProfession(professionId) {
  const canonical = canonicalProfessionId(professionId) || professionId;
  return DEFERRED_PROFESSIONS.includes(canonical);
}

/**
 * The archetype a character actually fights as.
 *
 * Order: an explicit stored choice (how a Wanderer resolves their deferral)
 * beats the profession mapping, which beats the fallback. Never returns null —
 * combat must always have a model.
 *
 * NOTE the key is `combatArchetypeId`, NOT `archetypeId`. `progression.archetypeId`
 * is already taken: it holds the narrative SPECIALIZATION ("Sellsword", "Pale
 * Archivist") — see templates.js:1134 — and characters throughout the codex carry
 * an `archetype` field meaning the same thing. Reusing either name would collide
 * the moment a specialization happened to share a word with an archetype.
 */
export function archetypeForCharacter(character) {
  const progression = character?.progression || {};
  const explicit = archetypeById(progression.combatArchetypeId || character?.combatArchetypeId);
  if (explicit) return explicit;

  const professionId = progression.professionId || progression.activeProfessionId || character?.profession;
  const mapped = archetypeIdForProfession(professionId);
  return ARCHETYPES[mapped] || ARCHETYPES[FALLBACK_ARCHETYPE_ID];
}

/** Max stamina for a combatant, from their archetype profile and Vigor. */
export function staminaMaxFor(archetypeId, vigor = 0) {
  const record = archetypeById(archetypeId) || ARCHETYPES[FALLBACK_ARCHETYPE_ID];
  const { base, perVigor } = record.stamina;
  return Math.max(1, Math.round(base + Math.max(0, vigor) * perVigor));
}

/** What a defensive verb costs this archetype. Unknown verbs are free. */
export function verbCost(archetypeId, verb) {
  const record = archetypeById(archetypeId) || ARCHETYPES[FALLBACK_ARCHETYPE_ID];
  if (verb === "guard") return record.guardCost;
  if (verb === "evade") return record.evadeCost;
  return 0;
}

/** Does this response answer that telegraph? Drives both the AI and the UI hint. */
export function answersTelegraph(tagId, verb) {
  const tag = TELEGRAPH_TAGS[tagId];
  return !!tag && tag.answer !== null && tag.answer === verb;
}
