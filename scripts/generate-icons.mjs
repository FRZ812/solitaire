// Rasterize public/icons/icon.svg into the PNGs Chrome's Android install
// heuristic looks for (192x192 and 512x512). Run with `npm run icons`
// whenever you edit the SVG.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, "..", "public", "icons");

const svg = readFileSync(join(iconsDir, "icon.svg"));

for (const size of [192, 512]) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  const png = resvg.render().asPng();
  const out = join(iconsDir, `icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`${size}x${size} → ${out} (${png.length} bytes)`);
}
