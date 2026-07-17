// Bond / memory / shared-gear updates of applyBeat (Stage 3 extraction): the
// relationship_changes, memory_updates, and companion_gear branches, all of which
// fold onto codex characters. Threads the evolving `world` (returned). No import
// back into beat.js, so no cycle.
import { clampRel, MEMORY_CAP } from "./relationships.js";
import { mergeMemoryBank } from "./memory.js";

// ctx in: { beat, world }. Returns the updated { world }.
export function applyRelationships({ beat, world }) {
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
      const mems = mergeMemoryBank(ch.memories, mu.adds, MEMORY_CAP);
      chars[mu.id] = { ...ch, memories: mems };
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

  return { world };
}
