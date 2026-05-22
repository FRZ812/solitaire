import { advanceTime, formatTime } from "./time.js";
import { getTile, computeSightFrom } from "./world.js";
import {
  depleteNeeds, applyNeedsChanges, getNeedConditions,
  mergeConditions, getNeedAlertText,
} from "./needs.js";
import { passiveHealVitality } from "./healing.js";
import { mergeDiscoveries, applyKnowledgeUpdates } from "./discoveries.js";
import { applyInventoryChanges } from "./inventory.js";
import { applyAttributeChanges } from "./attributes.js";
import { activeWorldPassives } from "./combat-stats.js";

// applyBeat is the heart of the engine. Given the current state and a beat
// from the narrator, it returns the next state plus the new beat entries to
// render in the log.
export function applyBeat(state, beat, options = {}) {
  const newTime = advanceTime(state.time, beat.minutes_passed || 0);
  const newBeats = [...state.beats];
  newBeats.push({ id: `t${Date.now()}`, type: "timestamp", content: formatTime(newTime) });

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
    const discoveryItems = merged.newlyDiscovered.filter(d => d.kind !== "skill_growth");
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

  const inventory = applyInventoryChanges(state.character.inventory, beat.inventory_changes);
  if (beat.inventory_changes) {
    const ch = beat.inventory_changes;
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

  return { ...state, beats: newBeats, time: newTime, character, world, apiHistory: newHistory };
}
