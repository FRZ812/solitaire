// How much of a generated site the party can know before standing on it.
//
// A fort on a ridge is visible for a day's walk; a bandit camp is not visible
// until you are in it. Between those the map should show *something* — a shape
// at range, a name if travellers use one — so that travel has destinations
// instead of blank ground that turns into a place on arrival.
//
// Pure and data-only: the caller supplies distance and sight history.

// `range` is in hexes from the party. `named` means locals and road traffic use
// a name for the place, so it can appear on the map before the party arrives.
// `secret` places stay off the map entirely until they are entered.
const ARCHETYPE_SIGHTING = Object.freeze({
  fortification: Object.freeze({ range: 7, named: true }),
  settlement: Object.freeze({ range: 6, named: true }),
  ruin: Object.freeze({ range: 5, named: false }),
  wonder: Object.freeze({ range: 5, named: false }),
  "roadside-inn": Object.freeze({ range: 4, named: true }),
  crossing: Object.freeze({ range: 4, named: true }),
  resource: Object.freeze({ range: 4, named: true }),
  shrine: Object.freeze({ range: 3, named: false }),
  camp: Object.freeze({ range: 2, named: false }),
  clearing: Object.freeze({ range: 2, named: false }),
  den: Object.freeze({ range: 1, named: false, secret: true }),
  "bandit-camp": Object.freeze({ range: 1, named: false, secret: true }),
});

// Open ground carries a silhouette much further than closed ground swallows it.
const TERRAIN_SIGHT_SHIFT = Object.freeze({
  mountains: 2,
  hills: 1,
  plains: 1,
  desert: 2,
  tundra: 2,
  steppe: 1,
  forest: -2,
  jungle: -2,
  marsh: -1,
  reedfield: -1,
});

const ARCHETYPE_MAP_ICONS = Object.freeze({
  settlement: "wild-village",
  camp: "wild-campsite",
  clearing: "poi-park",
  den: "wild-monster-den",
  "bandit-camp": "wild-bandit-camp",
  "roadside-inn": "poi-inn",
  shrine: "wild-shrine",
  ruin: "wild-ruin",
  resource: "wild-mine",
  crossing: "wild-bridge",
  fortification: "wild-fortress",
});

const DEFAULT_SIGHTING = Object.freeze({ range: 2, named: false });

// A site on a maintained route earns a name from the traffic that passes it,
// but only if it is the sort of place travellers stop at rather than avoid.
export function siteSighting({ family, terrain, route }) {
  const base = ARCHETYPE_SIGHTING[family] || DEFAULT_SIGHTING;
  return {
    range: Math.max(1, base.range + (TERRAIN_SIGHT_SHIFT[terrain] || 0)),
    named: !base.secret && (base.named || (!!route && base.range >= 3)),
    secret: !!base.secret,
    mapIcon: ARCHETYPE_MAP_ICONS[family] || null,
  };
}

// "" means the site has no place on the map yet.
export function siteKnowledgeGrade(sighting, { distance = null, explored = false } = {}) {
  if (!sighting || sighting.secret) return "";
  const inRange = Number.isFinite(distance) && distance <= sighting.range;
  if (!inRange && !explored) return "";
  return sighting.named ? "rumoured" : "silhouette";
}
