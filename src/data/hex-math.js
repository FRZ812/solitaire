// Axial-hex math helpers used by the MapEditor's power-tools (curtain
// wall pathfinder, line drawing, neighbour walks). Kept terrain-agnostic
// so it can be reused without dragging in editor or engine state.
//
// Coordinate system: axial pointy-top, the same convention the rest of
// the project uses. Cube coordinates are used internally for rounding
// and interpolation because they're more convenient for those ops.

export const HEX_DIRS = [
  { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 },
];

export function hexDist(a, b) {
  const dq = a.x - b.x, dr = a.y - b.y;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function axialToCube(p) {
  return { x: p.x, y: -p.x - p.y, z: p.y };
}

function cubeToAxial(c) {
  return { x: c.x, y: c.z };
}

function cubeRound(c) {
  let rx = Math.round(c.x);
  let ry = Math.round(c.y);
  let rz = Math.round(c.z);
  const dx = Math.abs(rx - c.x);
  const dy = Math.abs(ry - c.y);
  const dz = Math.abs(rz - c.z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx, y: ry, z: rz };
}

function cubeLerp(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

// Straight line of hexes from a to b inclusive (both endpoints). Length
// is hexDist(a, b) + 1. Uses cube linear interpolation + rounding.
export function hexLine(a, b) {
  const N = hexDist(a, b);
  if (N === 0) return [{ x: a.x, y: a.y }];
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  const out = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    out.push(cubeToAxial(cubeRound(cubeLerp(ac, bc, t))));
  }
  return out;
}

// A* shortest-path from start to goal across the hex grid. `costAt(coord)`
// returns the cost of stepping onto that hex (Infinity = impassable).
// Returns a list of hexes from start to goal inclusive, or null if no
// path exists within `maxNodes` expansions. The default cost function
// treats every hex as cost 1 — pass an avoid-set wrapper to route
// around existing tiles.
export function hexAStar(start, goal, costAt = () => 1, maxNodes = 5000) {
  if (start.x === goal.x && start.y === goal.y) {
    return [{ x: start.x, y: start.y }];
  }
  const key = (p) => `${p.x},${p.y}`;
  const open = new Map(); // key -> { coord, f }
  const cameFrom = new Map(); // key -> parent coord
  const gScore = new Map();
  const sKey = key(start);
  gScore.set(sKey, 0);
  open.set(sKey, { coord: start, f: hexDist(start, goal) });
  let expanded = 0;
  while (open.size > 0) {
    if (++expanded > maxNodes) return null;
    // Pull lowest-f node.
    let bestKey = null, bestF = Infinity;
    for (const [k, v] of open) {
      if (v.f < bestF) { bestF = v.f; bestKey = k; }
    }
    const { coord: cur } = open.get(bestKey);
    open.delete(bestKey);
    if (cur.x === goal.x && cur.y === goal.y) {
      // Reconstruct path.
      const path = [{ x: cur.x, y: cur.y }];
      let walk = bestKey;
      while (cameFrom.has(walk)) {
        const parent = cameFrom.get(walk);
        path.unshift({ x: parent.x, y: parent.y });
        walk = key(parent);
      }
      return path;
    }
    const curG = gScore.get(bestKey);
    for (const d of HEX_DIRS) {
      const n = { x: cur.x + d.x, y: cur.y + d.y };
      const nKey = key(n);
      const stepCost = costAt(n);
      if (!isFinite(stepCost)) continue;
      const tentativeG = curG + stepCost;
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, cur);
        gScore.set(nKey, tentativeG);
        const f = tentativeG + hexDist(n, goal);
        open.set(nKey, { coord: n, f });
      }
    }
  }
  return null;
}
