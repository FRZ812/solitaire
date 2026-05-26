// Distant landmarks the MC knows about as a regional native — visible on the
// map under fog of war when within MAP_VIEW_RADIUS, untravelable until you can
// actually reach them.
//
// CLEARED to a clean slate: the map was wiped and rebuilt around the walled
// city of Whitemarch alone (data/handcrafted-tiles.js), anchored at the origin.
// There are no rumored landmarks in the wider world for now — everything beyond
// Whitemarch's wall is unnamed procedural country. The rich Mirecross set lives
// in git history; restore entries here to re-seed the wider map.
export const RUMORED = {};

export function getRumored(x, y) {
  return RUMORED[`${x},${y}`] || null;
}
