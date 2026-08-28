// Pure 3x3 formation geometry for archetype combat.
//
// A cell is an integer from 0 through 8 in row-major order:
//
//   0 1 2   front rank
//   3 4 5   middle rank
//   6 7 8   rear rank
//
// "Front" is relative to the side that owns the formation. Rendering may mirror the enemy
// side, but the rules never do; row 0 means the front rank for players and enemies alike.

export const FORMATION_WIDTH = 3;
export const FORMATION_CELL_COUNT = FORMATION_WIDTH * FORMATION_WIDTH;
export const FORMATION_RULES_VERSIONS = Object.freeze([1, 2, 3]);
export const STATIC_FORMATION_RULES_VERSION = 1;
export const MOVING_FORMATION_RULES_VERSION = 2;
// New fights keep every actor in the cell chosen before combat and resolve melee reach
// independently down each column. Versions 1 and 2 remain readable so recorded fights
// preserve their original global-front-rank and round-reflow behavior byte for byte.
export const LOCKED_LANE_FORMATION_RULES_VERSION = 3;
export const FORMATION_CELLS = Object.freeze(
  Array.from({ length: FORMATION_CELL_COUNT }, (_, cell) => cell),
);
export const FORMATION_FOOTPRINTS = Object.freeze([
  "single",
  "row",
  "column",
  "cross-short",
  "cross-full",
  "all",
]);

const MAX_ACTOR_ID_LENGTH = 256;
const FOOTPRINT_SET = new Set(FORMATION_FOOTPRINTS);

export function isFormationRulesVersion(value) {
  return FORMATION_RULES_VERSIONS.includes(value);
}

function isActorId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ACTOR_ID_LENGTH;
}

function assertCell(cell) {
  if (!Number.isSafeInteger(cell) || cell < 0 || cell >= FORMATION_CELL_COUNT) {
    throw new TypeError("invalid-formation-cell");
  }
  return cell;
}

function assertActorIds(actorIds) {
  if (!Array.isArray(actorIds) || actorIds.length > FORMATION_CELL_COUNT) {
    throw new TypeError("invalid-formation-actor-ids");
  }
  if (!actorIds.every(isActorId) || new Set(actorIds).size !== actorIds.length) {
    throw new TypeError("invalid-formation-actor-ids");
  }
}

function assertFormation(formation) {
  if (!Array.isArray(formation) || formation.length !== FORMATION_CELL_COUNT) {
    throw new TypeError("invalid-formation");
  }
  const occupied = formation.filter((actorId) => actorId !== null);
  if (!occupied.every(isActorId) || new Set(occupied).size !== occupied.length) {
    throw new TypeError("invalid-formation");
  }
}

function selectedCells(cells) {
  if (cells === undefined || cells === null) return FORMATION_CELLS;
  if (!Array.isArray(cells)) throw new TypeError("invalid-formation-cells");
  return [...new Set(cells.map(assertCell))].sort((left, right) => left - right);
}

export function formationRow(cell) {
  return Math.floor(assertCell(cell) / FORMATION_WIDTH);
}

export function formationColumn(cell) {
  return assertCell(cell) % FORMATION_WIDTH;
}

/**
 * Normalize a party or enemy roster into exactly nine cells.
 *
 * A preferred formation may be partial, stale, or contain duplicate/unknown occupants.
 * Known actors keep their first valid requested cell. Removed actors are pruned, and every
 * unplaced current actor fills the first remaining cell in row-major order. The actor roster
 * itself is strict because duplicate participant ids are an encounter error, not save noise.
 */
export function normalizeFormation(actorIds, preferredFormation = null) {
  assertActorIds(actorIds);
  if (preferredFormation !== null && preferredFormation !== undefined
    && !Array.isArray(preferredFormation)) {
    throw new TypeError("invalid-formation");
  }

  const known = new Set(actorIds);
  const placed = new Set();
  const formation = Array(FORMATION_CELL_COUNT).fill(null);

  for (const cell of FORMATION_CELLS) {
    const actorId = preferredFormation?.[cell];
    if (!known.has(actorId) || placed.has(actorId)) continue;
    formation[cell] = actorId;
    placed.add(actorId);
  }

  for (const actorId of actorIds) {
    if (placed.has(actorId)) continue;
    const cell = formation.indexOf(null);
    // `assertActorIds` caps the roster at nine, so a missing cell would be an invariant bug.
    if (cell < 0) throw new TypeError("formation-full");
    formation[cell] = actorId;
    placed.add(actorId);
  }

  return formation;
}

/** Resolve one footprint to unique cells in canonical row-major order. */
export function footprintCells(anchorCell, footprint) {
  const anchor = assertCell(anchorCell);
  if (!FOOTPRINT_SET.has(footprint)) throw new TypeError("invalid-formation-footprint");
  if (footprint === "single") return [anchor];
  if (footprint === "all") return [...FORMATION_CELLS];

  const row = formationRow(anchor);
  const column = formationColumn(anchor);
  if (footprint === "row") {
    return Array.from(
      { length: FORMATION_WIDTH },
      (_, offset) => (row * FORMATION_WIDTH) + offset,
    );
  }
  if (footprint === "column") {
    return Array.from(
      { length: FORMATION_WIDTH },
      (_, offset) => (offset * FORMATION_WIDTH) + column,
    );
  }

  const cells = new Set([anchor]);
  if (footprint === "cross-full") {
    for (let offset = 0; offset < FORMATION_WIDTH; offset += 1) {
      cells.add((row * FORMATION_WIDTH) + offset);
      cells.add((offset * FORMATION_WIDTH) + column);
    }
  } else {
    // Short cross: the anchor and only its immediately orthogonal neighbours.
    if (row > 0) cells.add(anchor - FORMATION_WIDTH);
    if (row < FORMATION_WIDTH - 1) cells.add(anchor + FORMATION_WIDTH);
    if (column > 0) cells.add(anchor - 1);
    if (column < FORMATION_WIDTH - 1) cells.add(anchor + 1);
  }
  return [...cells].sort((left, right) => left - right);
}

/** Actor id occupying one cell, or null for an empty cell. */
export function actorAtCell(formation, cell) {
  assertFormation(formation);
  return formation[assertCell(cell)];
}

/** Cell occupied by an actor, or null when that actor is not in this formation. */
export function cellForActor(formation, actorId) {
  assertFormation(formation);
  if (!isActorId(actorId)) throw new TypeError("invalid-formation-actor-id");
  const cell = formation.indexOf(actorId);
  return cell < 0 ? null : cell;
}

/**
 * Living occupants of selected cells, ordered by cell.
 *
 * `actors` is the encounter's actor map. Missing actors, dead actors, and empty cells do not
 * produce entries; no slot is compacted or retargeted when someone falls.
 */
export function livingOccupants(formation, actors, cells = FORMATION_CELLS) {
  assertFormation(formation);
  if (!actors || typeof actors !== "object" || Array.isArray(actors)) {
    throw new TypeError("invalid-formation-actors");
  }
  return selectedCells(cells).flatMap((cell) => {
    const actorId = formation[cell];
    const actor = actorId === null ? null : actors[actorId];
    return actor && Number.isFinite(actor.hp) && actor.hp > 0
      ? [{ cell, actorId, actor }]
      : [];
  });
}

/** Convenience projection when a resolver only needs ids rather than actor records. */
export function livingActorIds(formation, actors, cells = FORMATION_CELLS) {
  return livingOccupants(formation, actors, cells).map((entry) => entry.actorId);
}
