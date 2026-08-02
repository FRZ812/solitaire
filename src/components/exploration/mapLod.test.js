import { describe, expect, it } from "vitest";
import {
  TRAVEL_MAP_MAX_ZOOM,
  TRAVEL_MAP_MIN_ZOOM,
  lodFogScale,
  lodShowsHexOutlines,
  lodShowsPlace,
  lodShowsScenery,
  lodShowsVectorRoutes,
  lodTier,
  oddCount,
  travelMapLod,
} from "./mapLod.js";

// Walk the whole usable zoom range rather than a handful of picked values, so an
// invariant that only breaks at some awkward intermediate zoom still gets caught.
function zoomLadder(steps = 400) {
  const ladder = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    ladder.push(TRAVEL_MAP_MIN_ZOOM * ((TRAVEL_MAP_MAX_ZOOM / TRAVEL_MAP_MIN_ZOOM) ** t));
  }
  return ladder;
}

describe("continuous zoom level of detail", () => {
  it("samples every hex at normal zoom", () => {
    expect(travelMapLod(1)).toMatchObject({ rows: 15, stride: 1, tier: "local" });
    expect(travelMapLod(TRAVEL_MAP_MAX_ZOOM)).toMatchObject({ stride: 1, tier: "local" });
  });

  it("keeps every stride above one even, so samples stay on a clean sub-lattice", () => {
    // `buildRpgViewport` converts offset rows back to axial with
    // `x = offsetColumn - floor(y / 2)`. Only an even stride makes floor(y / 2)
    // advance by exactly S/2 per row; an odd one wobbles the samples by a hex
    // every other row.
    for (const zoom of zoomLadder()) {
      const { stride } = travelMapLod(zoom);
      expect(stride === 1 || stride % 2 === 0, `stride ${stride} at zoom ${zoom}`).toBe(true);
    }
  });

  it("never enumerates more than the bounded window, however far out the camera goes", () => {
    for (const zoom of zoomLadder()) {
      const { rows } = travelMapLod(zoom);
      expect(rows).toBeGreaterThanOrEqual(9);
      expect(rows).toBeLessThanOrEqual(31);
      // Odd rows keep the camera coordinate on a cell instead of between two.
      expect(rows % 2).toBe(1);
    }
  });

  it("widens coverage monotonically as the camera pulls back", () => {
    const ladder = zoomLadder(120);
    let previous = 0;
    // Zooming out must never show less ground than the step before it.
    for (const zoom of [...ladder].reverse()) {
      const { rows, stride } = travelMapLod(zoom);
      const covered = rows * stride;
      expect(covered).toBeGreaterThanOrEqual(previous);
      previous = covered;
    }
  });

  it("reaches the whole continent at minimum zoom", () => {
    const far = travelMapLod(TRAVEL_MAP_MIN_ZOOM);
    // The continent spans about 1063 x 850 hexes; the row window has to clear
    // the shorter axis or the atlas cannot show the landmass at once.
    expect(far.rows * far.stride).toBeGreaterThan(850);
    expect(far.tier).toBe("continent");
  });

  it("clamps beyond the usable range instead of sampling nonsense", () => {
    expect(travelMapLod(500).zoom).toBe(TRAVEL_MAP_MAX_ZOOM);
    expect(travelMapLod(0).zoom).toBe(TRAVEL_MAP_MIN_ZOOM);
    expect(travelMapLod(-4).zoom).toBe(TRAVEL_MAP_MIN_ZOOM);
    expect(travelMapLod(Number.NaN).zoom).toBe(TRAVEL_MAP_MIN_ZOOM);
  });

  it("names the three tiers by stride", () => {
    expect(lodTier(1)).toBe("local");
    expect(lodTier(2)).toBe("region");
    expect(lodTier(6)).toBe("region");
    expect(lodTier(8)).toBe("continent");
    expect(lodTier(28)).toBe("continent");
  });
});

describe("what each tier is allowed to draw", () => {
  it("drops hex furniture the moment one drawn hex stops meaning one hex", () => {
    // An outline around a 28-hex sample claims a boundary that is not there, and
    // scenery is ambient detail of a single hex, not of the patch it stands for.
    expect(lodShowsHexOutlines("local")).toBe(true);
    expect(lodShowsScenery("local")).toBe(true);
    for (const tier of ["region", "continent"]) {
      expect(lodShowsHexOutlines(tier)).toBe(false);
      expect(lodShowsScenery(tier)).toBe(false);
    }
  });

  it("switches roads and rivers to authored ribbons once sampling would break them", () => {
    // A road is one hex wide, so any stride above 1 turns it into dashes.
    expect(lodShowsVectorRoutes("local")).toBe(false);
    expect(lodShowsVectorRoutes("region")).toBe(true);
    expect(lodShowsVectorRoutes("continent")).toBe(true);
  });

  it("thins the place layer down to what gives the continent its shape", () => {
    const minor = { name: "Ashen Well", major: false };
    const major = { name: "Asalan", major: true };
    const unnamed = { name: "", major: false };

    for (const place of [minor, major, unnamed]) expect(lodShowsPlace("local", place)).toBe(true);
    expect(lodShowsPlace("region", minor)).toBe(true);
    expect(lodShowsPlace("region", unnamed)).toBe(false);
    expect(lodShowsPlace("continent", minor)).toBe(false);
    expect(lodShowsPlace("continent", major)).toBe(true);
  });

  it("thins fog with distance so the atlas records travel instead of hiding a continent", () => {
    expect(lodFogScale("local")).toBe(1);
    expect(lodFogScale("region")).toBeLessThan(lodFogScale("local"));
    expect(lodFogScale("continent")).toBeLessThan(lodFogScale("region"));
    expect(lodFogScale("continent")).toBeGreaterThan(0);
  });
});

describe("odd cell counts", () => {
  it("keeps the camera coordinate on a cell", () => {
    expect(oddCount(14.4, 7, 45)).toBe(15);
    expect(oddCount(15, 7, 45)).toBe(15);
    expect(oddCount(6, 7, 45)).toBe(7);
    // At the ceiling it has to step down, not out of range.
    expect(oddCount(900, 7, 44)).toBe(43);
    expect(oddCount(900, 7, 45)).toBe(45);
  });
});
