import { advanceTime, formatTime } from "./time.js";
import { getTile, computeSightFrom } from "./world.js";
import {
  depleteNeeds, applyNeedsChanges, getNeedConditions,
  mergeConditions, getNeedAlertText,
} from "./needs.js";
import { passiveHealVitality } from "./healing.js";
import { mergeDiscoveries, applyKnowledgeUpdates } from "./discoveries.js";
import { applyInventoryChanges } from "./inventory.js";
import { refillVessels } from "./consumables.js";
import { itemTemplate } from "../data/catalog.js";
import { resolveRace } from "../data/races.js";
import { getAbilityDef, clampAbilityTier } from "../data/abilities.js";
import { tierOrder } from "../data/tiers.js";
import { spoilCarried } from "./spoilage.js";
import { applyAttributeChanges, recomputeVitalityMax } from "./attributes.js";
import { activeWorldPassives } from "./combat-stats.js";
import { COMPANIONS, companionCodexEntry } from "../data/companions.js";
import { clampRel, MEMORY_CAP } from "./relationships.js";

// Can a waterskin be refilled at this tile? Settlements have wells; water/marsh
// tiles and any spring/well/stream/river POI are clean enough; an adjacent
// open-water tile means a stream is within reach.
function canRefillWater(stateLike, x, y) {
  const here = getTile(stateLike, x, y);
  if (!here) return false;
  if (here.terrain === "settlement" || here.terrain === "water" || here.terrain === "marsh") return true;
  const poi = `${here.poi?.name || ""} ${here.poi?.type || ""}`.toLowerCase();
  if (/well|spring|fountain|stream|brook|river|lake|pool|cistern|oasis|ford|creek/.test(poi)) return true;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (getTile(stateLike, x + dx, y + dy)?.terrain === "water") return true;
  }
  return false;
}

// applyBeat is the heart of the engine. Given the current state and a beat
// from the narrator, it returns the next state plus the new beat entries to
// render in the log.
export function applyBeat(state, beat, options = {}) {
  const newTime = advanceTime(state.time, beat.minutes_passed || 0);
  const newBeats = [...state.beats];
  // In limbo (pre-creation) the clock is frozen and meaningless — don't stamp it.
  if (state.created !== false) newBeats.push({ id: `t${Date.now()}`, type: "timestamp", content: formatTime(newTime) });

  if (options.travelTo) {
    newBeats.push({
      id: `tr${Date.now()}`,
      type: "travel_card",
      from: options.travelFrom,
      to: options.travelTo,
      mins: beat.minutes_passed || 0,
    });
  }
  if (beat.encounter) {
    newBeats.push({
      id: `e${Date.now()}`,
      type: "encounter",
      encounterType: beat.encounter.type,
      note: beat.encounter.note,
    });
  }
  if (beat.roll) newBeats.push({ id: `r${Date.now()}`, type: "roll", ...beat.roll });
  if (beat.narration) newBeats.push({ id: `n${Date.now()}`, type: "narration", content: beat.narration, thinking: beat._thinking || null });

  const dialogues = Array.isArray(beat.dialogues)
    ? beat.dialogues
    : (beat.dialogue ? [beat.dialogue] : []);
  let dlgCounter = 0;
  for (const d of dialogues) {
    if (!d || !d.name || !d.line) continue;
    newBeats.push({ id: `d${Date.now()}-${dlgCounter++}`, type: "dialogue", name: d.name, line: d.line });
  }

  let codex = state.world.codex;
  if (beat.discoveries) {
    const merged = mergeDiscoveries(codex, beat.discoveries);
    codex = merged.codex;
    // A granted SPELL is filed as BOTH a spell (lore) and a skill (the ability), so
    // it surfaces twice in the feed — show it once: drop the skill chip when a spell
    // of the same name is present (the ability itself is still recorded in the codex).
    const spellNames = new Set(merged.newlyDiscovered.filter(d => d.kind === "spells").map(d => d.name));
    const discoveryItems = merged.newlyDiscovered.filter(d => d.kind !== "skill_growth" && !(d.kind === "skills" && spellNames.has(d.name)));
    const growthItems = merged.newlyDiscovered.filter(d => d.kind === "skill_growth");
    if (discoveryItems.length > 0) {
      newBeats.push({ id: `disc${Date.now()}`, type: "discovery", items: discoveryItems });
    }
    for (const g of growthItems) {
      newBeats.push({ id: `grow${Date.now()}-${g.id}`, type: "growth", text: `${g.name} ${g.from} → ${g.to}` });
    }
  }
  if (beat.knowledge_updates) codex = applyKnowledgeUpdates(codex, beat.knowledge_updates);

  // Player attribute changes
  let attributes = state.character.attributes;
  if (beat.attribute_changes) {
    const { next, growthLines } = applyAttributeChanges(attributes, beat.attribute_changes);
    attributes = next;
    if (growthLines.length > 0) {
      newBeats.push({ id: `attr${Date.now()}`, type: "growth", text: growthLines.join(" · ") });
    }
  }

  // Granted items must be CANONICAL catalog items — at creation AND in normal
  // play. The narrator grants ids from the [ITEM CATALOG]; anything not in the
  // catalog is an invented item and is dropped here. (Combat spoils are added via
  // applyLoot, a separate path, so engine-generated drops are unaffected.)
  let invChanges = beat.inventory_changes;
  if (invChanges && Array.isArray(invChanges.added)) {
    invChanges = { ...invChanges, added: invChanges.added.filter((a) => a?.itemId && itemTemplate(a.itemId)) };
    // Register freshly-granted catalog items into the codex so they display and
    // persist with their real name/appearance/stats (the narrator no longer
    // defines gear via discoveries.items).
    const add = {};
    for (const a of invChanges.added) if (!codex.items[a.itemId]) add[a.itemId] = itemTemplate(a.itemId);
    if (Object.keys(add).length) codex = { ...codex, items: { ...codex.items, ...add } };
  }
  const inventory = applyInventoryChanges(state.character.inventory, invChanges, newTime.day);
  if (invChanges) {
    const ch = invChanges;
    const lines = [];
    for (const a of (ch.added || [])) {
      const name = codex.items[a.itemId]?.name || a.itemId;
      lines.push(`+${a.quantity || 1}× ${name}`);
    }
    for (const r of (ch.removed || [])) {
      const name = codex.items[r.itemId]?.name || r.itemId;
      lines.push(`−${r.quantity || 1}× ${name}`);
    }
    if (ch.coins) {
      const parts = [];
      if (ch.coins.copper) parts.push(`${ch.coins.copper > 0 ? "+" : ""}${ch.coins.copper}cp`);
      if (ch.coins.silver) parts.push(`${ch.coins.silver > 0 ? "+" : ""}${ch.coins.silver}sp`);
      if (ch.coins.gold)   parts.push(`${ch.coins.gold   > 0 ? "+" : ""}${ch.coins.gold}gp`);
      if (parts.length) lines.push(parts.join(", "));
    }
    if (lines.length) newBeats.push({ id: `inv${Date.now()}`, type: "inventory_delta", lines });
  }

  const character = { ...state.character, inventory, attributes };
  // Reconcile the narrator's equip-doubling: if it both granted an item to the pack
  // (inventory_changes) AND put it on the player's WORN list this beat, the item is
  // in both. Equipping moves it OUT of the pack — drop each NEWLY-worn id from the
  // carried pile (only the new ones, so a worn item + a legit spare aren't eroded).
  {
    const oldWorn = new Set(state.world.codex.characters?.wanderer?.worn || []);
    const newlyWorn = (codex.characters?.wanderer?.worn || []).filter((id) => !oldWorn.has(id));
    if (newlyWorn.length && character.inventory?.carried?.length) {
      const carried = character.inventory.carried.map((c) => ({ ...c }));
      let changed = false;
      for (const id of newlyWorn) {
        const i = carried.findIndex((c) => c.itemId === id);
        if (i >= 0) { carried[i].quantity -= 1; if (carried[i].quantity <= 0) carried.splice(i, 1); changed = true; }
      }
      if (changed) character.inventory = { ...character.inventory, carried };
    }
  }
  // Max HP derives from vigor — keep it in sync whenever attributes may have
  // changed (also lazily migrates older saves). A vigor gain heals by the delta.
  recomputeVitalityMax(character);

  // A combat ability TAUGHT in play (a discoveries.skills entry whose id is a real
  // ability) must become USABLE — mergeDiscoveries only records codex lore, so wire
  // it into character.abilities here, carrying the granted tier (common→divine; the
  // tier scales its power exactly like gear). Re-teaching at a higher tier upgrades
  // it. Narrative skills (Stealth, Lockpicking…) have no ability def and are skipped.
  if (Array.isArray(beat.discoveries?.skills)) {
    const idOf = (x) => (typeof x === "string" ? x : x.id);
    const list = Array.isArray(character.abilities) ? [...character.abilities] : [];
    let skills = codex.skills, skillsTouched = false;
    for (const s of beat.discoveries.skills) {
      if (!s?.id || !getAbilityDef(s.id)) continue;
      const idx = list.findIndex((a) => idOf(a) === s.id);
      const curTier = idx >= 0 ? ((typeof list[idx] === "object" ? list[idx].tier : "common") || "common") : null;
      const grantTier = clampAbilityTier(s.id, s.tier || "common"); // honour tier floors
      // Re-teaching only ever raises the tier — take the higher of the two.
      const tier = curTier && tierOrder(curTier) >= tierOrder(grantTier) ? curTier : grantTier;
      if (idx < 0) list.push({ id: s.id, tier }); else list[idx] = { id: s.id, tier };
      if (codex.skills[s.id]) { // keep the codex entry consistent for display
        if (!skillsTouched) { skills = { ...codex.skills }; skillsTouched = true; }
        skills[s.id] = { ...skills[s.id], combatAbility: true, tier };
      }
    }
    character.abilities = list;
    if (skillsTouched) codex = { ...codex, skills };
  }

  if (beat.vitality_change) character.vitality = Math.max(0, Math.min(character.vitalityMax, character.vitality + beat.vitality_change));
  if (beat.resolve_change)  character.resolve  = Math.max(0, Math.min(character.resolveMax,  character.resolve  + beat.resolve_change));

  // Equipped world passives (Enduring slows needs, Mending speeds regen, etc.).
  const wp = activeWorldPassives(state.character, state.world.codex);

  // Needs deplete by time, then narrator-driven changes apply, then conditions auto-update.
  const prevNeedConds = getNeedConditions(state.character.needs);
  const drained = depleteNeeds(state.character.needs, beat.minutes_passed || 0, Math.max(0.2, 1 - (wp.needDecayMult || 0)));
  const newNeeds = applyNeedsChanges(drained, beat.needs_changes);
  character.needs = newNeeds;

  const needsConds = getNeedConditions(newNeeds);
  character.conditions = mergeConditions(beat.new_conditions, needsConds, state.character.conditions);

  // Need alerts fire only on crossing INTO a worse state.
  const newlyTriggered = needsConds.filter(c => !prevNeedConds.includes(c));
  for (const c of newlyTriggered) {
    const text = getNeedAlertText(c);
    if (text) newBeats.push({ id: `alert${Date.now()}-${c}`, type: "need_alert", text });
  }

  // Passive regen comes after final conditions, so a freshly-applied "Bleeding" blocks it.
  character.vitality = passiveHealVitality(
    character.vitality, character.vitalityMax,
    character.conditions, beat.minutes_passed || 0, wp.healPerHour || 0
  );

  let world = { ...state.world, codex };
  if (options.travelToCoords) {
    const { x, y } = options.travelToCoords;
    const arrivedTile = getTile(state, x, y);
    const tiles = { ...world.tiles };
    let finalTile = { ...arrivedTile };
    if (beat.tile_discovery && (finalTile.poi?.type === "hidden" || !finalTile.poi)) {
      finalTile = { ...finalTile, poi: {
        type: beat.tile_discovery.poi_type || "landmark",
        name: beat.tile_discovery.name || finalTile.poi?.name || null,
        description: beat.tile_discovery.description || null,
      } };
    }
    tiles[`${x},${y}`] = finalTile;
    world = { ...world, tiles, currentTile: { x, y }, seen: computeSightFrom(x, y, world.seen) };
  }

  // Narrator-driven relocation (no map-travel involved). Used for extreme
  // entry — wall-scaling, breaching, teleportation, secret-passage — where
  // the player ends up at a hex they couldn't reach via the door graph.
  // The narrator outputs tile_move:{x,y} on a successful attempt; the
  // engine moves the player there and expands sight. The narrator's prose
  // carries the move context (no travel card synthesized — it would read
  // strangely with no "from").
  if (beat.tile_move && !options.travelToCoords) {
    const { x, y } = beat.tile_move;
    if (typeof x === "number" && typeof y === "number") {
      const arrivedTile = getTile(state, x, y);
      const tiles = { ...world.tiles };
      tiles[`${x},${y}`] = arrivedTile;
      world = { ...world, tiles, currentTile: { x, y }, seen: computeSightFrom(x, y, world.seen) };
    }
  }

  const newHistory = [...state.apiHistory];
  if (beat._userMsg) newHistory.push({ role: "user", content: beat._userMsg });
  if (beat._raw)     newHistory.push({ role: "assistant", content: beat._raw });

  // Lasting consequences the player left on this place (razed, emptied, tense…).
  // Recorded on the current tile with the game-day so the narrator can pace a
  // slow, immersive recovery (or keep it dead).
  if (beat.location_update && world.currentTile) {
    const k = `${world.currentTile.x},${world.currentTile.y}`;
    const tiles = { ...world.tiles };
    const existing = tiles[k] || getTile({ ...state, world }, world.currentTile.x, world.currentTile.y);
    tiles[k] = { ...existing, status: { ...beat.location_update, day: newTime.day } };
    world = { ...world, tiles };
  }

  // At a well, settlement, or clean stream the wanderer tops off any waterskin.
  if (world.currentTile && canRefillWater({ ...state, world }, world.currentTile.x, world.currentTile.y)) {
    character.inventory = refillVessels(character.inventory);
  }

  // A companion the narrator just won over joins the party (the player talked
  // them into it — see [APPROACH RECRUIT] doctrine).
  let party = state.party || [];
  if (beat.recruit_companion?.id) {
    const tmpl = COMPANIONS[beat.recruit_companion.id];
    if (tmpl && !party.includes(tmpl.id)) {
      party = [...party, tmpl.id];
      // File a fresh entry for a new recruit; a returning companion keeps their
      // accumulated memories + bond. Either way the engine FORCES the authored
      // template's stats/kit (attributes, abilities, skills) onto the codex entry
      // — the narrator may have flavored or even restatted them earlier, but the
      // template is authoritative, so the Company view matches the tavern board.
      const existing = world.codex.characters[tmpl.id];
      const entry = existing
        ? { ...existing, attributes: tmpl.attributes, abilities: [...(tmpl.abilities || [])], skills: (tmpl.skills || []).map((s) => ({ ...s })) }
        : companionCodexEntry(tmpl);
      world = { ...world, codex: { ...world.codex, characters: { ...world.codex.characters, [tmpl.id]: entry } } };
    }
  }

  // Bond shifts and shared memories — kept per-character on the codex and
  // surfaced back to the narrator so relationships persist and deepen over time.
  if (Array.isArray(beat.relationship_changes) && beat.relationship_changes.length) {
    const chars = { ...world.codex.characters };
    for (const rc of beat.relationship_changes) {
      const ch = chars[rc?.id];
      if (!ch) continue;
      chars[rc.id] = { ...ch, relationship: clampRel((ch.relationship || 0) + (rc.delta || 0)) };
    }
    world = { ...world, codex: { ...world.codex, characters: chars } };
  }
  if (Array.isArray(beat.memory_updates) && beat.memory_updates.length) {
    const chars = { ...world.codex.characters };
    for (const mu of beat.memory_updates) {
      const ch = chars[mu?.id];
      if (!ch || !Array.isArray(mu.adds)) continue;
      const mems = [...(ch.memories || [])];
      for (const m of mu.adds) if (m && !mems.includes(m)) mems.push(m);
      chars[mu.id] = { ...ch, memories: mems.slice(-MEMORY_CAP) };
    }
    world = { ...world, codex: { ...world.codex, characters: chars } };
  }

  // Sharing loot with the party: move worn gear onto/off a companion. Pair with
  // inventory_changes (remove from the player) when handing something over.
  if (Array.isArray(beat.companion_gear) && beat.companion_gear.length) {
    const chars = { ...world.codex.characters };
    for (const g of beat.companion_gear) {
      const ch = chars[g?.id];
      if (!ch) continue;
      let worn = [...(ch.worn || [])];
      for (const rid of (g.remove || [])) worn = worn.filter((w) => w !== rid);
      for (const aid of (g.add || [])) if (!worn.includes(aid)) worn.push(aid);
      chars[g.id] = { ...ch, worn };
    }
    world = { ...world, codex: { ...world.codex, characters: chars } };
  }

  // Opening character-creation interview result: set the player's identity and
  // a balanced starting attribute spread from the narrator's read of the player.
  let created = state.created;
  // Creation attributes are set directly from the interview, scaled to the
  // described concept — NOT hard-capped to a small budget (clamped only to the
  // engine's effective ceiling of 30 for roleplay freedom).
  const clampAttr = (v) => Math.max(1, Math.min(30, Math.round(v || 0)));
  if (beat.character_setup) {
    const cs = beat.character_setup;
    if (cs.name) character.name = cs.name;
    if (cs.bond) character.bond = cs.bond;
    if (cs.attributes) {
      const a = {};
      for (const k of ["body", "reflex", "vigor", "mind", "wit", "presence"]) a[k] = clampAttr(cs.attributes[k] ?? character.attributes[k]);
      character.attributes = a;
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
      age: cs.age || w.age,
      attractiveness: cs.attractiveness || w.attractiveness,
      appearance: cs.appearance || w.appearance,
      base_appearance: cs.base_appearance || w.base_appearance,
      attributes: character.attributes,
      // Dedup: a long (manual) creation may have already filed a self-fact via
      // knowledge_updates before the final sheet repeats it — don't list it twice.
      knows: [...new Set([...(w.knows || []), ...(cs.knows || [])].filter((f) => typeof f === "string" && f.trim()))],
    };
    world = { ...world, codex: { ...world.codex, characters: { ...world.codex.characters, wanderer: merged } } };
    // Creation set attributes + racial vigor — derive starting max HP from them.
    recomputeVitalityMax(character);
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

  // Food spoils as the clock turns. Any perishable stack past its freshUntil is
  // tossed, with a quiet log notice so the player isn't surprised by an empty pack.
  const sp = spoilCarried(character.inventory.carried, newTime.day, codex.items);
  if (sp.spoiled.length) {
    character.inventory = { ...character.inventory, carried: sp.carried };
    newBeats.push({ id: `spoil${Date.now()}`, type: "spoilage", lines: sp.spoiled.map((s) => `${s.quantity}× ${s.name}`) });
  }

  return { ...state, beats: newBeats, time: newTime, character, world, apiHistory: newHistory, party, created };
}
