import importantAtlas from "../assets/generated/character-portraits/codex-important-atlas-v1.png";
import successorAtlas from "../assets/generated/character-portraits/codex-successors-atlas-v1.png";
import demonKingPortrait from "../assets/generated/character-portraits/codex-individual/demon-king.webp";
import valeKingAsarPortrait from "../assets/generated/character-portraits/codex-individual/variants/vale-king-asar-portrait-v2.png";
import goblinKingPortrait from "../assets/generated/character-portraits/codex-individual/variants/goblin-king-portrait-v2.png";
import selenyanSpeakerPortrait from "../assets/generated/character-portraits/codex-individual/variants/selenyan-speaker-portrait-v2.png";
import glassSpireMasterPortrait from "../assets/generated/character-portraits/codex-individual/variants/glass-spire-master-portrait-v2.png";
import greatWyrmPortrait from "../assets/generated/character-portraits/codex-individual/variants/great-wyrm-portrait-v2.png";
import hawthornLordPortrait from "../assets/generated/character-portraits/codex-individual/variants/hawthorn-lord-portrait-v2.png";
import witchQueenPortrait from "../assets/generated/character-portraits/codex-individual/variants/witch-queen-portrait-v2.png";
import crowsmoorBaronPortrait from "../assets/generated/character-portraits/codex-individual/variants/crowsmoor-baron-portrait-v2.png";
import whitemarchTreasurerPortrait from "../assets/generated/character-portraits/codex-individual/variants/whitemarch-treasurer-portrait-v2.png";
import cinderChapterMasterPortrait from "../assets/generated/character-portraits/codex-individual/variants/cinder-chapter-master-portrait-v2.png";
import stonebrookHoldFatherPortrait from "../assets/generated/character-portraits/codex-individual/variants/stonebrook-hold-father-portrait-v2.png";
import halfbornMatriarchPortrait from "../assets/generated/character-portraits/codex-individual/variants/halfborn-matriarch-portrait-v2.png";
import heronMasterPortrait from "../assets/generated/character-portraits/codex-individual/variants/heron-master-portrait-v2.png";
import hagPortrait from "../assets/generated/character-portraits/codex-individual/variants/the-hag-portrait-v2.png";
import kingOfThreePortrait from "../assets/generated/character-portraits/codex-individual/variants/king-of-three-portrait-v2.png";
import valeKingAsarViPortrait from "../assets/generated/character-portraits/codex-individual/variants/vale-king-asar-vi-portrait-v2.png";
import halfbornMatriarchElectPortrait from "../assets/generated/character-portraits/codex-individual/variants/halfborn-matriarch-elect-brann-portrait-v2.png";
import stonebrookHoldFatherKorroPortrait from "../assets/generated/character-portraits/codex-individual/variants/stonebrook-hold-father-korro-portrait-v2.png";
import whitemarchTreasurerHalenPortrait from "../assets/generated/character-portraits/codex-individual/variants/whitemarch-treasurer-halen-portrait-v3.png";
import cinderChapterMasterTovarPortrait from "../assets/generated/character-portraits/codex-individual/variants/cinder-chapter-master-tovar-portrait-v2.png";
import crowsmoorBaronHeirPortrait from "../assets/generated/character-portraits/codex-individual/variants/crowsmoor-baron-heir-portrait-v2.png";
import heronMasterApprenticePortrait from "../assets/generated/character-portraits/codex-individual/variants/heron-master-apprentice-portrait-v2.png";

const dimensions = (width, height) => Object.freeze({ width, height });
const grid = (columns, rows) => Object.freeze({ columns, rows });

const DETAIL_PORTRAITS = Object.freeze({
  "demon-king": demonKingPortrait,
  "vale-king-asar": valeKingAsarPortrait,
  "goblin-king": goblinKingPortrait,
  "selenyan-speaker": selenyanSpeakerPortrait,
  "glass-spire-master": glassSpireMasterPortrait,
  "great-wyrm": greatWyrmPortrait,
  "hawthorn-lord": hawthornLordPortrait,
  "witch-queen": witchQueenPortrait,
  "crowsmoor-baron": crowsmoorBaronPortrait,
  "whitemarch-treasurer": whitemarchTreasurerPortrait,
  "cinder-chapter-master": cinderChapterMasterPortrait,
  "stonebrook-hold-father": stonebrookHoldFatherPortrait,
  "halfborn-matriarch": halfbornMatriarchPortrait,
  "heron-master": heronMasterPortrait,
  "the-hag": hagPortrait,
  "king-of-three": kingOfThreePortrait,
  "vale-king-asar-vi": valeKingAsarViPortrait,
  "halfborn-matriarch-elect-brann": halfbornMatriarchElectPortrait,
  "stonebrook-hold-father-korro": stonebrookHoldFatherKorroPortrait,
  "whitemarch-treasurer-halen": whitemarchTreasurerHalenPortrait,
  "cinder-chapter-master-tovar": cinderChapterMasterTovarPortrait,
  "crowsmoor-baron-heir": crowsmoorBaronHeirPortrait,
  "heron-master-apprentice": heronMasterApprenticePortrait,
});

// ImageGen-authored portrait atlases. Pixel and grid dimensions live beside the
// imports so consumers can render either CSS sprites or exact SVG view boxes
// without duplicating layout knowledge.
export const CODEX_PORTRAIT_ATLASES = Object.freeze({
  important: Object.freeze({
    id: "important",
    label: "Important figures",
    src: importantAtlas,
    dimensions: dimensions(1254, 1254),
    grid: grid(4, 4),
  }),
  successors: Object.freeze({
    id: "successors",
    label: "Named successors",
    src: successorAtlas,
    dimensions: dimensions(1254, 1254),
    grid: grid(3, 3),
  }),
});

// The important-figure atlas is fully occupied and follows the canonical Codex
// order in initial-state.js, left-to-right and then top-to-bottom.
const IMPORTANT_FIGURES = Object.freeze([
  ["demon-king", "The Demon King"],
  ["vale-king-asar", "King Asar V of Asalan"],
  ["goblin-king", "The Goblin King"],
  ["selenyan-speaker", "Lirilin of the Long Note"],
  ["glass-spire-master", "The High Master of the Glass Spire"],
  ["great-wyrm", "Vyrnholt, the Great Wyrm"],
  ["hawthorn-lord", "The Hawthorn Lord"],
  ["witch-queen", "The Witch-Queen of the Bone Citadel"],
  ["crowsmoor-baron", "Baron Halrad of Crowsmoor"],
  ["whitemarch-treasurer", "Lord-Treasurer Selia of Whitemarch"],
  ["cinder-chapter-master", "Brother-Master Anders Yoreld"],
  ["stonebrook-hold-father", "Hold-Father Druin Ironvein"],
  ["halfborn-matriarch", "Matriarch Vela of the Halfborn"],
  ["heron-master", "Master Aenya of the Heron"],
  ["the-hag", "The Hag of the Cot"],
  ["king-of-three", "The King-of-Three"],
]);

// The successor atlas reserves its centre and lower-right cells for the visual
// seal/negative space used by the authored sheet.
const SUCCESSORS = Object.freeze([
  ["vale-king-asar-vi", "Prince Asar of Asalan", 0, 0],
  ["halfborn-matriarch-elect-brann", "Brann the Iron-Tongue", 1, 0],
  ["stonebrook-hold-father-korro", "Korro Stoneholt", 2, 0],
  ["whitemarch-treasurer-halen", "Halen Vossane", 0, 1],
  ["cinder-chapter-master-tovar", "Brother-Lieutenant Tovar Eldred", 2, 1],
  ["crowsmoor-baron-heir", "Lady Anwen of Crowsmoor", 0, 2],
  ["heron-master-apprentice", "Naela of the Heron", 1, 2],
]);

function axisPosition(index, count) {
  if (count <= 1) return "0%";
  const percent = Number(((index / (count - 1)) * 100).toFixed(4));
  return `${percent}%`;
}

function portraitRecord(id, label, atlasId, column, row) {
  const atlas = CODEX_PORTRAIT_ATLASES[atlasId];
  const cell = Object.freeze({ column, row });
  return Object.freeze({
    id,
    label,
    atlasId,
    atlas: atlas.src,
    detailSrc: DETAIL_PORTRAITS[id],
    atlasLabel: atlas.label,
    dimensions: atlas.dimensions,
    grid: atlas.grid,
    cell,
    viewBox: `${column} ${row} 1 1`,
    backgroundSize: `${atlas.grid.columns * 100}% ${atlas.grid.rows * 100}%`,
    backgroundPosition: `${axisPosition(column, atlas.grid.columns)} ${axisPosition(row, atlas.grid.rows)}`,
  });
}

const importantRecords = IMPORTANT_FIGURES.map(([id, label], index) => {
  const { columns } = CODEX_PORTRAIT_ATLASES.important.grid;
  return portraitRecord(id, label, "important", index % columns, Math.floor(index / columns));
});

const successorRecords = SUCCESSORS.map(([id, label, column, row]) => (
  portraitRecord(id, label, "successors", column, row)
));

export const CODEX_PORTRAIT_IDS = Object.freeze([
  ...importantRecords.map((record) => record.id),
  ...successorRecords.map((record) => record.id),
]);

export const CODEX_PORTRAIT_MANIFEST = Object.freeze(Object.fromEntries(
  [...importantRecords, ...successorRecords].map((record) => [record.id, record]),
));

export function resolveCodexPortrait(characterOrId) {
  const id = typeof characterOrId === "string" ? characterOrId : characterOrId?.id;
  return (id && CODEX_PORTRAIT_MANIFEST[id]) || null;
}
