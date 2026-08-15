#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getTowArchetypeIdentity } from "../src/gameplay/tow/archetype-identities.js";
import { getSkill } from "../src/gameplay/tow/skills.js";
import { buildManifest as buildAnimationManifest } from "./build-combat-vfx-prompt-manifest.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "docs", "design", "combat-ability-card-imagegen-prompts.json");
const CELLS_PER_SHEET = 9;

const GENERAL_STYLE = Object.freeze({
  id: "general",
  name: "General",
  palette: ["neutral steel", "warm impact white", "charcoal", "one restrained accent"],
  materials: "physical steel, dust, cloth, glass, parchment, and restrained combat energy",
  vfxTheme: "plain universal combat symbols with no profession, faction, or protagonist identity",
});

function styleFor(animation) {
  const skill = getSkill(animation.id);
  return getTowArchetypeIdentity(skill?.archetypeId || skill?.exclusiveTo) || GENERAL_STYLE;
}

function concise(value, length = 360) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, length);
}

function cardPrompt(style, sheetIndex, abilities) {
  const occupied = abilities.map((ability, index) => {
    const row = Math.floor(index / 3) + 1;
    const column = (index % 3) + 1;
    return `CELL ${index + 1} (row ${row}, column ${column}) — ${ability.name}: ${concise(ability.direction)}`;
  });
  const empty = Array.from({ length: CELLS_PER_SHEET - abilities.length }, (_, offset) => {
    const index = abilities.length + offset;
    const row = Math.floor(index / 3) + 1;
    const column = (index % 3) + 1;
    return `CELL ${index + 1} (row ${row}, column ${column}) — intentionally empty deep-charcoal field.`;
  });

  return `Create one production-ready 3 by 3 ability-card art sheet for the reusable dark-fantasy RPG archetype ${style.name}, coordinated set ${sheetIndex + 1}.

LAYOUT CONTRACT: one square image divided conceptually into exactly three equal columns and three equal rows, reading left-to-right then top-to-bottom. Each cell is one independent square ability illustration. Keep important content centered with a generous safety margin so the cells can be cropped exactly. Do not draw grid lines, gutters, borders, frames, numbers, letters, names, labels, logos, rarity marks, or UI. Do not let any effect cross a cell boundary.

SHARED KIT LANGUAGE: every occupied cell belongs to the same ${style.name} combat library and must feel deliberately related through the same hand-painted raster rendering, lighting, material response, negative-space ratio, and palette: ${style.palette.join(", ")}. Shared materials: ${style.materials}. Shared motion language: ${style.vfxTheme}. Use a quiet near-black charcoal field with a restrained painterly vignette in every cell, never a scene or location.

MINIMAL CHARACTER-FREE ART: depict only the ability's effect, projectile, impact trace, ward surface, occult construct, tool, or cropped weapon silhouette. Absolutely no person, hero, face, head, body, hand, limb, clothing silhouette, creature portrait, named character, or implied protagonist. No poster composition, crest, badge, symmetrical logo, flat vector icon, SVG-like linework, emoji, stock-game icon, photoreal photograph, or 3D render. The result should be minimal but materially rich: crisp painted edges, subtle volume, believable particles, and one clear asymmetric focal action per cell.

CELL CONTENT:
${[...occupied, ...empty].join("\n")}

COHESION CONTRACT: the nine cells are siblings, not duplicates. Reuse palette, brushwork, scale, darkness, and material physics, but give every occupied cell a distinct silhouette and direction that communicates its own mechanic at thumbnail size. Empty cells must contain no marks at all.`;
}

export function buildAbilityCardManifest({ specPath = null } = {}) {
  const animations = buildAnimationManifest({ specPath });
  const groups = new Map();
  for (const animation of animations) {
    const style = styleFor(animation);
    const key = style.id;
    if (!groups.has(key)) groups.set(key, { style, animations: [] });
    groups.get(key).animations.push(animation);
  }

  const sheets = [];
  for (const { style, animations: group } of groups.values()) {
    for (let offset = 0; offset < group.length; offset += CELLS_PER_SHEET) {
      const abilities = group.slice(offset, offset + CELLS_PER_SHEET).map((entry, index) => Object.freeze({
        cell: index + 1,
        row: Math.floor(index / 3) + 1,
        column: (index % 3) + 1,
        id: entry.id,
        name: entry.name,
        direction: entry.direction,
      }));
      const sheetIndex = Math.floor(offset / CELLS_PER_SHEET);
      sheets.push(Object.freeze({
        id: `ability-cards-${style.id}-${String(sheetIndex + 1).padStart(2, "0")}`,
        ownerId: style.id,
        owner: style.name,
        layout: "3x3",
        cellSize: 512,
        abilities: Object.freeze(abilities),
        prompt: cardPrompt(style, sheetIndex, abilities),
      }));
    }
  }
  return sheets;
}

function parseCli(argv) {
  const options = { specPath: null, output: DEFAULT_OUTPUT, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--spec") options.specPath = path.resolve(argv[++index]);
    else if (value === "--output") options.output = path.resolve(argv[++index]);
    else if (value === "--write") options.write = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseCli(process.argv.slice(2));
  const manifest = buildAbilityCardManifest({ specPath: options.specPath });
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (options.write) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, serialized);
    console.error(`wrote ${manifest.length} nine-up ability-card prompts to ${options.output}`);
  } else {
    process.stdout.write(serialized);
  }
}
