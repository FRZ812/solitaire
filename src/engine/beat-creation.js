// Character creation + identity updates — the character_setup and player_update
// branches of applyBeat, extracted (Stage 3) into one pipeline step. Threads the
// evolving `world` and `created` (returned); `character` is mutated in place
// (identity, attributes, abilities, racial kit, derived pools). No import back
// into beat.js, so no cycle.
import { resolveRace } from "../data/races.js";
import { getAbilityDef, clampAbilityTier } from "../data/abilities.js";
import { proficiencyDef } from "../data/proficiencies.js";
import { recomputeVitalityMax, recomputeResolveMax, recomputeCarryCapacity } from "./attributes.js";

// Creation attributes are set directly from the interview, scaled to the
// described concept — NOT hard-capped to a small budget (clamped only to the
// engine's effective ceiling of 30 for roleplay freedom).
const clampAttr = (v) => Math.max(1, Math.min(30, Math.round(v || 0)));

// ctx in: { beat, character, world, created }. Returns { world, created };
// character is mutated in place (same object the caller holds).
export function applyCreation({ beat, character, world, created }) {
  if (beat.character_setup) {
    const cs = beat.character_setup;
    if (cs.name) character.name = cs.name;
    if (cs.bond) character.bond = cs.bond;
    // Keep the compact player state and the full Codex identity aligned. Older
    // creation code only updated the Codex, which left the dossier profession
    // blank and made presentation metadata impossible to persist reliably.
    for (const key of [
      "profession", "subclass", "origin", "gender", "age", "agingMode", "lifespanMultiplier",
      "attractiveness", "appearance", "base_appearance", "templateId", "portraitKey",
      "profile",
    ]) {
      if (cs[key] != null) character[key] = cs[key];
    }
    if (cs.attributes) {
      const a = {};
      for (const k of ["body", "reflex", "vigor", "mind", "wit", "presence"]) a[k] = clampAttr(cs.attributes[k] ?? character.attributes[k]);
      character.attributes = a;
    }
    if (cs.proficiencies && typeof cs.proficiencies === "object") {
      const proficiencies = { ...(character.proficiencies || {}) };
      for (const [id, rawXp] of Object.entries(cs.proficiencies)) {
        const xp = Math.max(0, Math.round(Number(rawXp) || 0));
        if (proficiencyDef(id) && xp > 0) proficiencies[id] = xp;
      }
      character.proficiencies = proficiencies;
    }
    // Grant any starting abilities the concept calls for — martial techniques, or
    // spells if the player explicitly built a magical character. Accepts an
    // `abilities` array (ids or {id,tier}) and/or a legacy single `ability`.
    const startAbilities = [
      ...(Array.isArray(cs.abilities) ? cs.abilities : []),
      ...(cs.ability ? [cs.ability] : []),
    ];
    if (startAbilities.length) {
      const list = Array.isArray(character.abilities) ? [...character.abilities] : [];
      const idOf = (x) => (typeof x === "string" ? x : x.id);
      for (const ab of startAbilities) {
        const entry = typeof ab === "string" ? { id: ab, tier: "common" } : { id: ab.id, tier: ab.tier || "common" };
        if (entry.id) entry.tier = clampAbilityTier(entry.id, entry.tier); // honour tier floors
        if (entry.id && !list.some((x) => idOf(x) === entry.id)) list.push(entry);
      }
      character.abilities = list;
    }
    // Apply the chosen RACE/SUBRACE kit (data/races.js) — engine-applied, so racial
    // powers are list-only. Innate abilities + any innate-magic cantrip join the
    // ability list; passives, attribute leanings, and learning-speed sit on the
    // character; an innate-magic kindred starts attuned (spell recorded as known).
    const kit = cs.race ? resolveRace(cs.race, cs.subrace) : null;
    if (kit) {
      character.race = kit.raceId;
      character.subrace = kit.subraceId;
      character.racialAttributeModifiers = kit.attributeModifiers;
      character.proficiencyGrowthMult = kit.proficiencyGrowthMult;
      character.racialPassives = kit.racialPassives;
      character.darkvision = !!kit.darkvision; // drow, vampires, lycanthropes see in the dark
      const rlist = Array.isArray(character.abilities) ? [...character.abilities] : [];
      const ridOf = (x) => (typeof x === "string" ? x : x.id);
      for (const ab of [...kit.innateAbilities, ...kit.startingSpells]) {
        const entry = typeof ab === "string" ? { id: ab, tier: "common" } : { id: ab.id, tier: ab.tier || "common" };
        if (entry.id && !rlist.some((x) => ridOf(x) === entry.id)) rlist.push(entry);
      }
      character.abilities = rlist;
      if (kit.startingSpells.length) {
        const spells = { ...(world.codex.spells || {}) };
        for (const sid of kit.startingSpells) {
          const def = getAbilityDef(sid);
          if (def && !spells[sid]) spells[sid] = { id: sid, name: def.name, description: def.desc || "An innate spell of your kindred.", acquisition: "innate to your kindred" };
        }
        world = { ...world, codex: { ...world.codex, spells } };
      }
    }
    const w = world.codex.characters.wanderer || {};
    const merged = {
      ...w,
      name: cs.name || w.name,
      race: cs.race || w.race,
      subrace: (kit ? kit.subraceId : (cs.subrace ?? w.subrace ?? null)),
      origin: cs.origin || w.origin,
      profession: cs.profession || w.profession,
      subclass: cs.subclass ?? w.subclass,
      gender: cs.gender ?? w.gender,
      age: cs.age != null ? cs.age : w.age,
      agingMode: cs.agingMode ?? w.agingMode ?? "mortal",
      lifespanMultiplier: cs.lifespanMultiplier ?? w.lifespanMultiplier ?? 1.0,
      attractiveness: cs.attractiveness ?? w.attractiveness,
      appearance: cs.appearance || w.appearance,
      base_appearance: cs.base_appearance || w.base_appearance,
      ...((cs.templateId != null || w.templateId != null) ? { templateId: cs.templateId ?? w.templateId } : {}),
      ...((cs.portraitKey != null || w.portraitKey != null) ? { portraitKey: cs.portraitKey ?? w.portraitKey } : {}),
      ...((cs.profile != null || w.profile != null) ? { profile: cs.profile ?? w.profile } : {}),
      attributes: character.attributes,
      // Dedup: a long (manual) creation may have already filed a self-fact via
      // knowledge_updates before the final sheet repeats it — don't list it twice.
      knows: [...new Set([...(w.knows || []), ...(cs.knows || [])].filter((f) => typeof f === "string" && f.trim()))],
    };
    world = { ...world, codex: { ...world.codex, characters: { ...world.codex.characters, wanderer: merged } } };
    // Creation set attributes + racial vigor/mind — derive starting HP and resolve.
    recomputeVitalityMax(character);
    recomputeResolveMax(character);
    recomputeCarryCapacity(character);
    created = true;
  }

  // The player's name/bond/identity becoming established (or corrected) in the
  // fiction — name, driving bond, and an origin/race fix if the codex got it
  // wrong (e.g. an eastern player mislabelled central at creation).
  if (beat.player_update) {
    if (beat.player_update.name) character.name = beat.player_update.name;
    if (beat.player_update.bond) character.bond = beat.player_update.bond;
    const w = world.codex.characters.wanderer || {};
    const wm = { ...w, name: character.name };
    if (beat.player_update.origin) wm.origin = beat.player_update.origin;
    if (beat.player_update.race) wm.race = beat.player_update.race;
    world = { ...world, codex: { ...world.codex, characters: { ...world.codex.characters, wanderer: wm } } };
  }

  return { world, created };
}
