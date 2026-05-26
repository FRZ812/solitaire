// Throwaway visual check for the Whitemarch rebuild. Builds a clean SVG straight
// from the data + engine (same geometry + wall/footprint logic as MapView, but
// without the React markup quirks that crash this resvg build) and rasterizes it,
// so you can eyeball the wall ring, the single Crown Gate gap, the merged
// footprints, and the High-Walled citadel. Run via the esbuild bundle step.
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import { HANDCRAFTED } from "../src/data/handcrafted-tiles.js";
import { getTile, edgeAllowed, isPassable, isSeen } from "../src/engine/world.js";

const HEX_SIZE = 22, HSPACING = Math.sqrt(3) * HEX_SIZE, VSPACING = 1.5 * HEX_SIZE, C = 0;
const HEX_DIRS = [
  { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 },
  { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 },
];
const EDGE_CORNERS = [[0, 1], [5, 0], [4, 5], [3, 4], [2, 3], [1, 2]];
const corner = (cx, cy, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return { x: cx + HEX_SIZE * Math.cos(a), y: cy + HEX_SIZE * Math.sin(a) };
};
const hexPoints = (cx, cy) => Array.from({ length: 6 }, (_, i) => { const p = corner(cx, cy, i); return `${p.x.toFixed(2)},${p.y.toFixed(2)}`; }).join(" ");
const px = (x, y) => C + HSPACING * (x + y / 2);
const py = (x, y) => C + VSPACING * y;

const FILL = {
  settlement: "#46412e", road: "#5a4d34", indoor: "#242a2a", water: "#16384a",
  plains: "#2a4034", forest: "#182e20", hills: "#3a402e", mountains: "#443630", sand: "#4f4430",
};
const fillFor = (t, member) => member ? "#4a3c2b" : (FILL[t.terrain] || "#26302a");

// A state where the city + a ring around it is seen, so walls render against the
// outside country exactly as in play.
const seen = {};
for (let x = -6; x <= 7; x++) for (let y = -7; y <= 8; y++) seen[`${x},${y}`] = true;
const state = { world: { tiles: {}, currentTile: { x: 0, y: 0 }, seen } };

const coords = [];
for (let x = -6; x <= 7; x++) for (let y = -7; y <= 8; y++) coords.push({ x, y });

const polys = [], walls = [], foot = [], labels = [];
const memberOf = (t) => !!t.poi?.parent && t.poi?.type !== "hidden";

// Hexes + dark walls.
for (const c of coords) {
  const t = getTile(state, c.x, c.y);
  const cx = px(c.x, c.y), cy = py(c.x, c.y);
  polys.push(`<polygon points="${hexPoints(cx, cy)}" fill="${fillFor(t, memberOf(t))}" stroke="rgba(215,167,111,0.10)" stroke-width="1"/>`);
  if (!isPassable(t)) continue;
  for (let d = 0; d < 6; d++) {
    const n = { x: c.x + HEX_DIRS[d].x, y: c.y + HEX_DIRS[d].y };
    if (!isSeen(state, n.x, n.y)) continue;
    const nt = getTile(state, n.x, n.y);
    if (!isPassable(nt)) continue;
    if (edgeAllowed(t, c.x, c.y, nt, n.x, n.y)) continue;
    if (memberOf(t) !== memberOf(nt)) continue; // footprint outline draws these
    if (c.x < n.x || (c.x === n.x && c.y < n.y)) {
      const [a, b] = EDGE_CORNERS[d], p1 = corner(cx, cy, a), p2 = corner(cx, cy, b);
      walls.push(`<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="#d8c9a0" stroke-width="4.5"/>`);
    }
  }
}

// Footprint groups: golden outline (gap at the door) + one label at the centroid.
const groups = new Map();
for (const c of coords) {
  const t = getTile(state, c.x, c.y);
  if (!memberOf(t)) continue;
  const g = groups.get(t.poi.parent) || { name: t.poi.parentName || t.poi.parent, tiles: [], keys: new Set() };
  g.tiles.push(c); g.keys.add(`${c.x},${c.y}`); groups.set(t.poi.parent, g);
}
for (const g of groups.values()) {
  let sx = 0, sy = 0;
  for (const c of g.tiles) {
    const cx = px(c.x, c.y), cy = py(c.x, c.y); sx += cx; sy += cy;
    const t = getTile(state, c.x, c.y);
    for (let d = 0; d < 6; d++) {
      const n = { x: c.x + HEX_DIRS[d].x, y: c.y + HEX_DIRS[d].y };
      if (g.keys.has(`${n.x},${n.y}`)) continue;
      const nt = getTile(state, n.x, n.y);
      if (isSeen(state, n.x, n.y) && isPassable(nt) && edgeAllowed(t, c.x, c.y, nt, n.x, n.y)) continue; // door gap
      const [a, b] = EDGE_CORNERS[d], p1 = corner(cx, cy, a), p2 = corner(cx, cy, b);
      foot.push(`<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="#d7a76f" stroke-width="3.25" stroke-opacity="0.85"/>`);
    }
  }
  labels.push({ x: sx / g.tiles.length, y: sy / g.tiles.length, text: g.name });
}

// Single-hex place names.
for (const c of coords) {
  const t = getTile(state, c.x, c.y);
  if (!t.poi?.name || memberOf(t)) continue;
  if (t.terrain === "water") continue;
  labels.push({ x: px(c.x, c.y), y: py(c.x, c.y), text: t.poi.name });
}
const labelSvg = labels.map((l) =>
  `<text x="${l.x.toFixed(1)}" y="${(l.y + 20).toFixed(1)}" text-anchor="middle" font-family="sans-serif" font-size="8" font-weight="bold" fill="#f5dcb8" stroke="#0c1111" stroke-width="0.6" paint-order="stroke">${l.text.replace(/&/g, "&amp;")}</text>`
).join("");

// Start marker at Grain Square.
const start = `<circle cx="${px(0, 0).toFixed(1)}" cy="${py(0, 0).toFixed(1)}" r="6" fill="none" stroke="#7fe3b0" stroke-width="2.5"/>`;

// Bounds + viewBox.
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const key of Object.keys(HANDCRAFTED)) {
  const [x, y] = key.split(",").map(Number);
  minX = Math.min(minX, px(x, y)); maxX = Math.max(maxX, px(x, y));
  minY = Math.min(minY, py(x, y)); maxY = Math.max(maxY, py(x, y));
}
const pad = 55;
const vb = `${(minX - pad).toFixed(0)} ${(minY - pad).toFixed(0)} ${(maxX - minX + 2 * pad).toFixed(0)} ${(maxY - minY + 2 * pad).toFixed(0)}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">
<rect x="${(minX - pad).toFixed(0)}" y="${(minY - pad).toFixed(0)}" width="${(maxX - minX + 2 * pad).toFixed(0)}" height="${(maxY - minY + 2 * pad).toFixed(0)}" fill="#0c1111"/>
${polys.join("\n")}
${walls.join("\n")}
${foot.join("\n")}
${start}
${labelSvg}
</svg>`;

console.log(`hexes: ${polys.length}  dark walls: ${walls.length}  footprint segments: ${foot.length}  labels: ${labels.length}`);
const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 }, background: "#0c1111", font: { loadSystemFonts: true } }).render().asPng();
fs.writeFileSync("scripts/whitemarch-map.png", png);
console.log("wrote scripts/whitemarch-map.png");
