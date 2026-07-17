import { describe, expect, it } from "vitest";
import { makeInitialState } from "../data/initial-state.js";
import {
  CODEX_PORTRAIT_ATLASES,
  CODEX_PORTRAIT_IDS,
  CODEX_PORTRAIT_MANIFEST,
  resolveCodexPortrait,
} from "./codex-portrait-assets.js";

const IMPORTANT_IDS = [
  "demon-king",
  "vale-king-asar",
  "goblin-king",
  "selenyan-speaker",
  "glass-spire-master",
  "great-wyrm",
  "hawthorn-lord",
  "witch-queen",
  "crowsmoor-baron",
  "whitemarch-treasurer",
  "cinder-chapter-master",
  "stonebrook-hold-father",
  "halfborn-matriarch",
  "heron-master",
  "the-hag",
  "king-of-three",
];

const SUCCESSOR_CELLS = {
  "vale-king-asar-vi": [0, 0],
  "halfborn-matriarch-elect-brann": [1, 0],
  "stonebrook-hold-father-korro": [2, 0],
  "whitemarch-treasurer-halen": [0, 1],
  "cinder-chapter-master-tovar": [2, 1],
  "crowsmoor-baron-heir": [0, 2],
  "heron-master-apprentice": [1, 2],
};

describe("Codex portrait assets", () => {
  it("maps the 16 important figures row-major across the authored 4x4 atlas", () => {
    expect(CODEX_PORTRAIT_ATLASES.important.dimensions).toEqual({ width: 1254, height: 1254 });
    expect(CODEX_PORTRAIT_ATLASES.important.grid).toEqual({ columns: 4, rows: 4 });
    expect(CODEX_PORTRAIT_ATLASES.important.src).toContain("codex-important-atlas-v1.png");

    IMPORTANT_IDS.forEach((id, index) => {
      const record = CODEX_PORTRAIT_MANIFEST[id];
      expect(record.atlasId).toBe("important");
      expect(record.cell).toEqual({ column: index % 4, row: Math.floor(index / 4) });
      expect(record.label).toBeTruthy();
    });

    expect(CODEX_PORTRAIT_MANIFEST.demonKing).toBeUndefined();
    expect(CODEX_PORTRAIT_MANIFEST["selenyan-speaker"].backgroundPosition).toBe("100% 0%");
    expect(CODEX_PORTRAIT_MANIFEST["king-of-three"].backgroundPosition).toBe("100% 100%");
  });

  it("uses the seven explicit successor cells and leaves reserved cells unmapped", () => {
    expect(CODEX_PORTRAIT_ATLASES.successors.dimensions).toEqual({ width: 1254, height: 1254 });
    expect(CODEX_PORTRAIT_ATLASES.successors.grid).toEqual({ columns: 3, rows: 3 });
    expect(CODEX_PORTRAIT_ATLASES.successors.src).toContain("codex-successors-atlas-v1.png");

    for (const [id, [column, row]] of Object.entries(SUCCESSOR_CELLS)) {
      const record = CODEX_PORTRAIT_MANIFEST[id];
      expect(record.atlasId).toBe("successors");
      expect(record.cell).toEqual({ column, row });
      expect(record.viewBox).toBe(`${column} ${row} 1 1`);
      expect(record.label).toBeTruthy();
    }

    const usedCells = new Set(Object.keys(SUCCESSOR_CELLS).map((id) => {
      const { column, row } = CODEX_PORTRAIT_MANIFEST[id].cell;
      return `${column},${row}`;
    }));
    expect(usedCells.has("1,1")).toBe(false);
    expect(usedCells.has("2,2")).toBe(false);
  });

  it("exposes exactly 23 stable canonical IDs and resolves strings or records", () => {
    const canonicalCharacters = makeInitialState().world.codex.characters;
    expect(CODEX_PORTRAIT_IDS).toHaveLength(23);
    expect(new Set(CODEX_PORTRAIT_IDS).size).toBe(23);
    expect(Object.keys(CODEX_PORTRAIT_MANIFEST)).toEqual(CODEX_PORTRAIT_IDS);
    expect(Object.isFrozen(CODEX_PORTRAIT_MANIFEST)).toBe(true);
    for (const id of CODEX_PORTRAIT_IDS) {
      expect(CODEX_PORTRAIT_MANIFEST[id].label).toBe(canonicalCharacters[id].name);
      expect(CODEX_PORTRAIT_MANIFEST[id].detailSrc).toContain(`codex-individual/${id}.webp`);
    }

    expect(resolveCodexPortrait("demon-king")).toBe(CODEX_PORTRAIT_MANIFEST["demon-king"]);
    expect(resolveCodexPortrait({ id: "heron-master-apprentice" })).toBe(CODEX_PORTRAIT_MANIFEST["heron-master-apprentice"]);
    expect(resolveCodexPortrait("wanderer")).toBeNull();
    expect(resolveCodexPortrait("unknown-character")).toBeNull();
    expect(resolveCodexPortrait()).toBeNull();
  });
});
