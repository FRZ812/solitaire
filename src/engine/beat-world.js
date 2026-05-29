// World mutation steps of applyBeat (Stage 3 extraction). Two pipeline steps at
// different positions: applyWorldMovement materializes the world from the
// evolving codex and resolves map movement (travel arrival, narrator tile_move,
// apiHistory growth, location status, waterskin refill); applyWorldTick runs the
// end-of-beat time tick (food spoilage + codex aging). No import back into
// beat.js, so no cycle.
import { getTile, computeSightFromRadius } from "./world.js";
import { sightRadius } from "./light.js";
import { refillVessels } from "./consumables.js";
import { spoilCarried } from "./spoilage.js";
import { ageState } from "./aging.js";

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

// ctx in: { state, beat, options, codex, character, newTime }. Returns the
// materialized { world, newHistory }; character.inventory may be mutated (refill).
export function applyWorldMovement({ state, beat, options, codex, character, newTime }) {
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
    const r = sightRadius({ world: { ...world, tiles, currentTile: { x, y } }, character, time: newTime });
    world = { ...world, tiles, currentTile: { x, y }, seen: computeSightFromRadius(x, y, r, world.seen) };
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
      const r = sightRadius({ world: { ...world, tiles, currentTile: { x, y } }, character, time: newTime });
      world = { ...world, tiles, currentTile: { x, y }, seen: computeSightFromRadius(x, y, r, world.seen) };
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

  return { world, newHistory };
}

// ctx in: { state, beat, world, codex, character, newTime, newBeats }. Returns
// the (possibly aged) { world }; character.inventory + newBeats mutated in place.
export function applyWorldTick({ state, world, codex, character, newTime, newBeats }) {
  // Food spoils as the clock turns. Any perishable stack past its freshUntil is
  // tossed, with a quiet log notice so the player isn't surprised by an empty pack.
  const sp = spoilCarried(character.inventory.carried, newTime.day, codex.items);
  if (sp.spoiled.length) {
    character.inventory = { ...character.inventory, carried: sp.carried };
    newBeats.push({ id: `spoil${Date.now()}`, type: "spoilage", lines: sp.spoiled.map((s) => `${s.quantity}× ${s.name}`) });
  }

  // Codex characters age as the clock turns. ageState mutates only the world's
  // characters map and activates any pre-authored successors of those who died
  // this tick — it no-ops when no character crosses a year boundary, so it's
  // safe to call after every beat. Death beats render only when someone died.
  const ageSnap = ageState({ ...state, time: newTime, world });
  if (ageSnap.state.world !== world) world = ageSnap.state.world;
  if (ageSnap.deaths.length) {
    const lines = ageSnap.deaths.map((d) => {
      const name = world.codex.characters[d.id]?.name || d.id;
      return `${name} dies at ${d.age}.`;
    });
    newBeats.push({ id: `age${Date.now()}`, type: "passage", lines });
  }

  return { world };
}
