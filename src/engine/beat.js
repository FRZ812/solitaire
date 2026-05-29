import { advanceTime, formatTime } from "./time.js";
import { mergeDiscoveries, applyKnowledgeUpdates } from "./discoveries.js";
import { applyInventoryChanges } from "./inventory.js";
import { itemTemplate } from "../data/catalog.js";
import { getAbilityDef, clampAbilityTier } from "../data/abilities.js";
import { tierOrder } from "../data/tiers.js";
import { applyAttributeChanges, recomputeVitalityMax, recomputeResolveMax, recomputeCarryCapacity } from "./attributes.js";
import { loadOf } from "./weight.js";
// applyBeat is composed of ordered pipeline steps; the larger cohesive blocks
// live in sibling modules and just thread the evolving codex / world / party.
import { applyAcquisitions } from "./beat-acquisitions.js";
import { applyCreation } from "./beat-creation.js";
import { applySurvivalTick } from "./beat-tick.js";
import { applyWorldMovement, applyWorldTick } from "./beat-world.js";
import { applyRelationships } from "./beat-relationships.js";

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
  if (beat.narration) newBeats.push({ id: `n${Date.now()}`, type: "narration", content: beat.narration, thinking: beat._thinking || null, truncated: beat._truncated || false });

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
  recomputeResolveMax(character); // Mind drives the resolve pool, same pattern
  recomputeCarryCapacity(character); // Body/Vigor drive how much you can haul
  // Narrator-granted loot can push you past the HARD cap (we never silently drop a
  // gift); being overburdened bites travel speed (engine: handleTravel). Shop buys
  // and the pack screen block at the cap — this only catches narrative grants.
  character.overburdened = loadOf(codex.characters?.wanderer, character.inventory, codex.items) > (character.carryCapacityMax ?? Infinity);

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

  // Survival + health tick (needs deplete/eat, conditions, light burn, passive
  // heal, wounds, companion upkeep, carry/ride re-derive, body-ledger) —
  // extracted to beat-tick.js. Threads codex; character is mutated in place.
  {
    const tick = applySurvivalTick({ state, beat, character, codex, newBeats });
    codex = tick.codex;
  }

  // World materialize + map movement (travel arrival, narrator tile_move,
  // apiHistory growth, location status, waterskin refill) — extracted to
  // beat-world.js. Threads world (+ newHistory); character.inventory may refill.
  const _wm = applyWorldMovement({ state, beat, options, codex, character, newTime });
  let world = _wm.world;
  const newHistory = _wm.newHistory;

  // Party acquisitions (recruit / grant / buy mount, purchase captive / rights,
  // part ways) — coin handling + codex filing extracted to beat-acquisitions.js.
  let party = state.party || [];
  {
    const acq = applyAcquisitions({ state, beat, world, party, character, newTime, newBeats });
    world = acq.world;
    party = acq.party;
  }

  // Bond / memory / shared-gear updates onto codex characters — extracted to
  // beat-relationships.js.
  world = applyRelationships({ beat, world }).world;

  // Opening character-creation interview + identity updates (character_setup /
  // player_update) — extracted to beat-creation.js.
  let created = state.created;
  {
    const cre = applyCreation({ beat, character, world, created });
    world = cre.world;
    created = cre.created;
  }

  // End-of-beat time tick: food spoilage + codex aging — extracted to beat-world.js.
  world = applyWorldTick({ state, world, codex, character, newTime, newBeats }).world;

  return { ...state, beats: newBeats, time: newTime, character, world, apiHistory: newHistory, party, created };
}
