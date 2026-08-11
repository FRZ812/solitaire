// Character positions — a hidden world-sim layer. EVERY codex character has a
// last-known location (`at:{x,y,day}`) and a `home`; the field is mechanical and
// persistent but NOT shown in the normal UI. Scrying reveals a live reading for
// anyone; authored playable-roster characters can additionally be selected as an
// approximate atlas trail so the player has a practical way to seek them out.
//
// Movement is LAZY: off-map characters DRIFT — a slow, homeward-biased random walk
// — but we never tick them per beat. Their current hex is COMPUTED on demand from
// their stored `at` + the days elapsed, so tracking "everyone" costs nothing until
// something (a scry) actually asks. The player and anyone travelling in the party
// are exactly at the player's current tile.

import { hexNeighbors, hexDistance } from "./world.js";
import { makeRng } from "./town-gen.js";
import { LANDMARKS } from "../data/continent.js";
import { isLivingCharacter } from "./aging.js";

const DRIFT_DAYS_PER_STEP = 2; // an off-map soul wanders ~one hex every couple of days
const DRIFT_MAX_STEPS = 40;    // cap the walk (~80 days fully resolves); keeps it cheap
const WANDER_RADIUS = 6;       // homebodies roam within ~this many hexes of home

export function homeOf(char) {
  return (char?.home && typeof char.home.x === "number") ? char.home
    : (char?.at && typeof char.at.x === "number") ? char.at : null;
}

// Where a character mechanically IS right now (hidden unless scryed). Party + player
// → the player's tile (exact). Everyone else → a homeward drift advanced lazily from
// `at` by elapsed days. Returns { x, y, exact } or null if never located.
export function characterPosition(state, id) {
  const char = state.world.codex.characters?.[id];
  if (!char) return null;
  if (id === "wanderer" || (state.party || []).includes(id)) {
    const c = state.world.currentTile;
    return { x: c.x, y: c.y, exact: true };
  }
  const at = char.at;
  if (!at || typeof at.x !== "number") return null; // whereabouts never recorded
  const home = homeOf(char);
  const today = state.time?.day ?? 0;
  const steps = Math.min(DRIFT_MAX_STEPS, Math.max(0, Math.floor((today - (at.day ?? today)) / DRIFT_DAYS_PER_STEP)));
  let x = at.x, y = at.y;
  const rng = makeRng(`drift:${id}:${at.x},${at.y}:${at.day ?? 0}`);
  for (let i = 0; i < steps; i++) {
    const ns = hexNeighbors(x, y);
    let next;
    if (home && hexDistance({ x, y }, home) > 0 && rng() < 0.45) {
      // step homeward — pick the neighbour nearest home
      next = ns.reduce((best, n) => (hexDistance(n, home) < hexDistance(best, home) ? n : best), ns[0]);
    } else {
      next = ns[Math.floor(rng() * ns.length)];
    }
    if (home && hexDistance(next, home) > WANDER_RADIUS) continue; // don't roam off the leash
    x = next.x; y = next.y;
  }
  return { x, y, exact: false };
}

export function canTrackCharacter(state, id) {
  const character = state?.world?.codex?.characters?.[id];
  return !!(
    character?.playable
    && character.trackable !== false
    && character.at
    && typeof character.at.x === "number"
    && !(state.party || []).includes(id)
    && isLivingCharacter(character)
  );
}

export function toggleTrackedCharacter(state, id) {
  const current = state?.world?.trackedCharacterId || null;
  const nextId = current === id ? null : (canTrackCharacter(state, id) ? id : current);
  if (nextId === current) return state;
  return { ...state, world: { ...state.world, trackedCharacterId: nextId } };
}

export function trackedCharacterResult(state) {
  const id = state?.world?.trackedCharacterId;
  if (!id || !canTrackCharacter(state, id)) return null;
  const character = state.world.codex.characters[id];
  const pos = characterPosition(state, id);
  return pos ? { id, name: character.name || id, character, pos } : null;
}

// Authored roster characters only become narrator-visible when the player has
// actually reached their simulated hex. Keeping this query beside the position
// engine prevents the Codex from accidentally teleporting the whole roster into
// every scene merely because their dossiers are known.
export function playableCharactersNear(state, radius = 0) {
  const current = state?.world?.currentTile;
  if (!current) return [];
  const party = new Set(state.party || []);
  return Object.values(state.world.codex.characters || {})
    .filter((character) => character?.playable && !party.has(character.id) && isLivingCharacter(character))
    .map((character) => {
      const pos = characterPosition(state, character.id);
      return pos ? { character, pos, distance: hexDistance(current, pos) } : null;
    })
    .filter((entry) => entry && entry.distance <= radius)
    .sort((a, b) => a.distance - b.distance || String(a.character.name).localeCompare(String(b.character.name)));
}

// Stamp a character's last-known position (on parting, on narrator placement, etc.).
export function stampAt(char, x, y, day) {
  if (!char) return char;
  char.at = { x, y, day: day ?? 0 };
  return char;
}

// Can the player scry at all? (knows Farsight, carries a scrying focus, or stands
// at a scrying basin / observatory.)
export function canScry(state) {
  const codex = state.world.codex;
  if (codex?.spells?.farsight) return true;
  const ab = state.character?.abilities || [];
  if (ab.some((a) => (typeof a === "string" ? a : a?.id) === "farsight")) return true;
  const carried = state.character?.inventory?.carried || [];
  if (carried.some((c) => /scry/i.test(c.itemId || ""))) return true;
  const cur = state.world.currentTile;
  const tile = state.world.tiles?.[`${cur.x},${cur.y}`];
  if (tile?.poi && /scry/i.test(`${tile.poi.name || ""} ${tile.poi.description || ""}`)) return true;
  return false;
}

// Nearest tile-with-a-name to a hex (for narrating "near <place>").
export function nearestKnownPlace(state, x, y) {
  let best = null;
  const consider = (name, tx, ty) => {
    const d = hexDistance({ x, y }, { x: tx, y: ty });
    if (!best || d < best.dist) best = { name, x: tx, y: ty, dist: d };
  };
  for (const [k, t] of Object.entries(state.world.tiles || {})) {
    if (!t?.poi?.name) continue;
    const [tx, ty] = k.split(",").map(Number);
    consider(t.poi.name, tx, ty);
  }
  // Fresh campaigns have only materialized Whitemarch, while the playable cast
  // is intentionally continent-wide. Authored landmarks make early tracking and
  // scry readings meaningful without eagerly generating hundreds of map tiles.
  for (const landmark of LANDMARKS) consider(landmark.name, landmark.coord.x, landmark.coord.y);
  return best;
}

// The full scry reading for a character: their computed hex + nearest known place,
// or null if they cannot be found (whereabouts never recorded).
export function scryResult(state, id) {
  const character = state.world.codex.characters?.[id];
  if (!isLivingCharacter(character)) return null;
  const pos = characterPosition(state, id);
  if (!pos) return null;
  return { id, name: character.name || id, pos, place: nearestKnownPlace(state, pos.x, pos.y) };
}
