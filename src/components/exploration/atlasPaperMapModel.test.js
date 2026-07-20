import { describe, expect, it, vi } from "vitest";
import {
  CONTINENT,
  CONTINENT_ROUTES,
  CONTINENT_WATERWAYS,
  REALMS,
} from "../../data/continent.js";
import {
  ATLAS_LANDMARKS,
  ATLAS_LANDMARK_GLYPHS,
  atlasFitZoom,
  projectAxial,
} from "./worldAtlasModel.js";
import {
  ATLAS_PAPER_BASE_HEIGHT,
  ATLAS_PAPER_BASE_WIDTH,
  atlasPaperBasePlacement,
  atlasPaperPick,
  atlasPaperPickFractional,
  atlasPaperProjectedCamera,
  atlasPaperWorldToScreen,
  buildAtlasPaperBaseModel,
  buildAtlasPaperDynamicModel,
  fitAtlasPaperCamera,
  zoomAtlasPaperCamera,
} from "./atlasPaperMapModel.js";

describe("atlas paper-map affine camera", () => {
  const viewport = { width: 960, height: 540 };

  it("converts the shared axial camera before using the 2D projection", () => {
    const camera = { x: 37, y: -19, zoom: 4.5, targetHeight: 12 };
    const projected = atlasPaperProjectedCamera(camera);
    const expected = projectAxial(camera.x, camera.y);

    expect(projected).toMatchObject({ x: expected.x, y: expected.y, zoom: camera.zoom, targetHeight: 12 });
    expect(atlasPaperWorldToScreen(camera, viewport, camera)).toEqual({ x: 480, y: 270 });

    const point = atlasPaperWorldToScreen(camera, viewport, { x: 42.25, y: -23.5 });
    const fractional = atlasPaperPickFractional(camera, viewport, point);
    expect(fractional.x).toBeCloseTo(42.25, 8);
    expect(fractional.y).toBeCloseTo(-23.5, 8);
    expect(atlasPaperPick(camera, viewport, point)).toEqual({ x: 42, y: -23 });
  });

  it("keeps an affine zoom anchor fixed while returning an axial camera", () => {
    const fitted = fitAtlasPaperCamera({ x: 0, y: 0, zoom: 1 }, viewport);
    const starting = zoomAtlasPaperCamera(fitted, viewport, 3, {
      x: viewport.width / 2,
      y: viewport.height / 2,
    });
    const anchor = { x: 520, y: 300 };
    const before = atlasPaperPickFractional(starting, viewport, anchor);
    const zoomed = zoomAtlasPaperCamera(starting, viewport, 1.25, anchor);
    const after = atlasPaperPickFractional(zoomed, viewport, anchor);

    expect(fitted.zoom).toBeCloseTo(atlasFitZoom(viewport), 8);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });
});

describe("atlas paper-map base model", () => {
  it("builds the complete authored chart deterministically without Math.random", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("paper map must use named deterministic streams");
    });
    try {
      const first = buildAtlasPaperBaseModel(CONTINENT.seed, { pixelRatio: 1.5 });
      const second = buildAtlasPaperBaseModel(CONTINENT.seed, { pixelRatio: 1.5 });

      expect(second).toEqual(first);
      expect(first.layout).toMatchObject({
        width: ATLAS_PAPER_BASE_WIDTH,
        height: ATLAS_PAPER_BASE_HEIGHT,
      });
      expect(first.coastline).toHaveLength(CONTINENT.coastline.length);
      expect(first.routes).toHaveLength(CONTINENT_ROUTES.length);
      expect(first.waterways).toHaveLength(CONTINENT_WATERWAYS.length);
      expect(first.realms).toHaveLength(REALMS.length);
      expect(first.labels.map((label) => label.text)).toEqual(REALMS.map((realm) => realm.shortName));
      expect(first.wash.length).toBeGreaterThan(500);
      expect(first.coastline.flatMap((point) => [point.x, point.y]).every(Number.isFinite)).toBe(true);
    } finally {
      random.mockRestore();
    }
  });

  it("changes only the painterly wash stream when the world seed changes", () => {
    const first = buildAtlasPaperBaseModel("first-seed");
    const second = buildAtlasPaperBaseModel("second-seed");

    expect(second.wash).not.toEqual(first.wash);
    expect(second.coastline).toEqual(first.coastline);
    expect(second.routes).toEqual(first.routes);
    expect(second.waterways).toEqual(first.waterways);
  });

  it("places the cached bitmap so its axial camera center lands at viewport center", () => {
    const model = buildAtlasPaperBaseModel(CONTINENT.seed);
    const viewport = { width: 960, height: 540 };
    const camera = { x: 75, y: -28, zoom: 3.4 };
    const placement = atlasPaperBasePlacement(model, camera, viewport);
    const projected = atlasPaperProjectedCamera(camera);
    const baseCenter = {
      x: model.layout.offsetX + (projected.x - model.layout.projectedBounds.xmin) * model.layout.scale,
      y: model.layout.offsetY + (projected.y - model.layout.projectedBounds.ymin) * model.layout.scale,
    };

    expect(placement.x + baseCenter.x * placement.scale).toBeCloseTo(viewport.width / 2, 8);
    expect(placement.y + baseCenter.y * placement.scale).toBeCloseTo(viewport.height / 2, 8);
  });
});

describe("atlas paper-map dynamic layer", () => {
  it("projects landmarks, both journey legs, quests, selection, and the party", () => {
    const viewport = { width: 960, height: 540 };
    const camera = { x: 1, y: 0, zoom: atlasFitZoom(viewport) * 4 };
    const landmarks = [
      { ...ATLAS_LANDMARKS.find((landmark) => landmark.id === "whitemarch"), knowledgeTier: "charted" },
      { ...ATLAS_LANDMARKS.find((landmark) => landmark.id === "mirecross"), quest: { id: "quest-landmark" } },
    ];
    const journey = {
      fullPath: [{ x: 0, y: 0 }, { x: 2, y: -1 }, { x: 4, y: -2 }],
      legPath: [{ x: 0, y: 0 }, { x: 2, y: -1 }],
    };
    const model = buildAtlasPaperDynamicModel({
      camera,
      viewport,
      landmarks,
      partyCoord: { x: 1, y: 0 },
      journey,
      journeyBreaks: [{ x: 2, y: -1, index: 2 }],
      selection: { kind: "landmark", id: "mirecross" },
      questMarkers: [{ id: "quest-open", title: "Open ground", coord: { x: 3, y: -2 } }],
    });

    expect(model.markers).toHaveLength(2);
    expect(model.markers[0].glyph).toBe(ATLAS_LANDMARK_GLYPHS.city);
    expect(model.markers[1]).toMatchObject({ selected: true, quest: true });
    expect(model.party.point).toEqual({ x: 480, y: 270 });
    expect(model.selection.point).toEqual(model.markers[1].point);
    expect(model.quests).toHaveLength(1);
    expect(model.journey.continuation).toHaveLength(3);
    expect(model.journey.currentLeg).toHaveLength(2);
    expect(model.journey.breaks[0]).toMatchObject({ x: 2, y: -1, index: 2 });
  });

  it("uses the same compact declutter set as the focusable paper-map controls", () => {
    const viewport = { width: 390, height: 700 };
    const camera = { x: 0, y: 0, zoom: atlasFitZoom(viewport) * 2 };
    const whitemarch = ATLAS_LANDMARKS.find((landmark) => landmark.id === "whitemarch");
    const mirecross = ATLAS_LANDMARKS.find((landmark) => landmark.id === "mirecross");

    const compact = buildAtlasPaperDynamicModel({ camera, viewport, landmarks: [whitemarch, mirecross] });
    expect(compact.markers.map((marker) => marker.id)).toEqual(["whitemarch"]);

    const selected = buildAtlasPaperDynamicModel({
      camera,
      viewport,
      landmarks: [whitemarch, mirecross],
      selection: { kind: "landmark", id: "mirecross" },
    });
    expect(selected.markers.map((marker) => marker.id)).toEqual(["whitemarch", "mirecross"]);
  });

  it("does not paint an inaccessible landmark underneath the party control", () => {
    const viewport = { width: 390, height: 700 };
    const camera = { x: 0, y: 0, zoom: atlasFitZoom(viewport) * 3 };
    const whitemarch = ATLAS_LANDMARKS.find((landmark) => landmark.id === "whitemarch");
    const model = buildAtlasPaperDynamicModel({
      camera,
      viewport,
      landmarks: [whitemarch],
      partyCoord: whitemarch.coord,
    });

    expect(model.markers).toEqual([]);
    expect(model.party).not.toBeNull();
  });
});
