// Distant landmarks the MC knows about as a regional native — visible on the
// map under fog of war when within MAP_VIEW_RADIUS, untravelable until you can
// actually reach them. Coordinates are axial (pointy-top hex).
//
// v12 scale: at ~250m/hex these landmarks sit 15–40 hexes from the Inn —
// genuinely a day or more's travel each, sized to encourage real journeys
// rather than incidental detours.
export const RUMORED = {
  // North — beyond the Tannic Wood. The Tannic river itself lives in
  // data/rivers.js so it renders as a continuous water strip rather than
  // three rumours.
  "-5,-25": { name: "Black Tarn",          kind: "lake",      direction: "northwest", description: "A deep, lightless lake. Old stories cling to it." },
  "-10,-15":{ name: "The Hollow Pines",    kind: "ruin",      direction: "north",     description: "An ancient yew copse older than the names of kings. Nothing has been cut from them in living memory." },

  // Northeast — past Crowsmoor toward Whitemarch
  "25,-15": { name: "Beltsworn",           kind: "village",   direction: "northeast", description: "A frontier village halfway to Whitemarch, paid in coin to keep the road open." },
  "40,-20": { name: "Whitemarch",          kind: "city",      direction: "northeast", description: "A walled city. Said to be where the iron is minted." },

  // Southeast — toward the Spine
  "25,20":  { name: "Caer Aglyn",          kind: "ruin",      direction: "southeast", description: "An old hillfort, earthworks still visible in the right light. Said to have fallen to plague, not arms." },
  "35,25":  { name: "The Spine",           kind: "mountains", direction: "southeast", description: "A spine of broken stone rising from the southern plains." },

  // South / Southwest — past Bramblewych
  "-15,25": { name: "The Last King's Tomb",kind: "ruin",      direction: "south",     description: "The barrow of the last king to hold this country — a name no longer spoken in Crowsmoor." },
  "-20,30": { name: "The Old Wall",        kind: "ruin",      direction: "south",     description: "A broken wall of black brick, long abandoned." },
  "-25,20": { name: "Bramblewych",         kind: "village",   direction: "southwest", description: "A village south of the Mire. Famous for nothing." },
};

export function getRumored(x, y) {
  return RUMORED[`${x},${y}`] || null;
}
