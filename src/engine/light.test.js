import { describe, expect, it } from "vitest";
import { SIGHT_RADIUS } from "../config.js";
import { makeInitialState } from "../data/initial-state.js";
import {
  inTheDark,
  isBeacon,
  isDarkHere,
  isHidden,
  lightMinutes,
  lightSource,
  lightStatus,
  locationLightStatus,
  sightRadius,
  visibilityStatus,
} from "./light.js";

function stateAt({ terrain = "plains", poi = null, hour = 12, darkvision = false, light = null, tile = {} } = {}) {
  const state = makeInitialState();
  state.time.hour = hour;
  state.world.currentTile = { x: 1000, y: 0 };
  state.world.tiles["1000,0"] = { terrain, poi, ...tile };
  state.character.darkvision = darkvision;
  state.character.light = light;
  return state;
}

describe("location light and obscurity", () => {
  it("reports the actual ambient source in lit locations at night", () => {
    const town = stateAt({ terrain: "settlement", hour: 23 });
    expect(locationLightStatus(town)).toMatchObject({ dark: false, source: "street-lamps", label: "Street lamps" });
    expect(lightStatus(town).text).toBe("street-lamp light");
    expect(visibilityStatus(town)).toMatchObject({ obscurity: "clear", label: "Visible", detail: "Street lamps" });

    const inn = stateAt({ terrain: "indoor", poi: { type: "inn" }, hour: 23 });
    expect(locationLightStatus(inn)).toMatchObject({ dark: false, source: "interior-lamps", label: "Hearth & lamps" });
    expect(lightStatus(inn).text).toBe("hearth and lamp light");

    const camp = stateAt({ terrain: "plains", poi: { type: "camp" }, hour: 23 });
    expect(locationLightStatus(camp)).toMatchObject({ dark: false, source: "campfires", label: "Campfires" });

    const fortress = stateAt({ terrain: "plains", poi: { type: "fortress" }, hour: 23 });
    expect(locationLightStatus(fortress)).toMatchObject({ dark: false, source: "watch-fires", label: "Watch fires" });

    const capitalStreet = stateAt({ terrain: "street", hour: 23, tile: { cityId: "whitemarch" } });
    expect(locationLightStatus(capitalStreet)).toMatchObject({ dark: false, source: "city-lamps", label: "City lamps" });
    expect(sightRadius(capitalStreet)).toBe(SIGHT_RADIUS);
    expect(visibilityStatus(capitalStreet)).toMatchObject({ obscurity: "clear", detail: "City lamps" });
  });

  it("keeps inhabited halls lit while genuinely lightless interiors remain dark", () => {
    const hall = stateAt({ terrain: "indoor", poi: { type: "hall" }, hour: 23 });
    expect(locationLightStatus(hall).dark).toBe(false);
    expect(visibilityStatus(hall).detail).toBe("Hearth & lamps");

    const dungeon = stateAt({ terrain: "indoor", poi: { type: "dungeon" }, hour: 12 });
    expect(locationLightStatus(dungeon)).toMatchObject({ dark: true, source: null, label: "Darkness" });
    expect(inTheDark(dungeon)).toBe(true);
    expect(isDarkHere(dungeon)).toBe(true);
    expect(isHidden(dungeon)).toBe(true);
    expect(sightRadius(dungeon)).toBe(1);
    expect(visibilityStatus(dungeon)).toMatchObject({
      obscurity: "heavy",
      label: "Hidden",
      detail: "Darkness · sight impaired",
    });
  });

  it("distinguishes darkvision, torchlight, and lantern light in darkness", () => {
    const darkvision = stateAt({ terrain: "forest", hour: 23, darkvision: true });
    expect(inTheDark(darkvision)).toBe(false);
    expect(isHidden(darkvision)).toBe(true);
    expect(isDarkHere(darkvision)).toBe(false);
    expect(sightRadius(darkvision)).toBe(SIGHT_RADIUS);
    expect(visibilityStatus(darkvision)).toMatchObject({ obscurity: "partial", detail: "Darkvision · unseen" });

    const torch = stateAt({ terrain: "forest", hour: 23, light: { source: "torch", minutes: 42 } });
    expect(inTheDark(torch)).toBe(false);
    expect(isDarkHere(torch)).toBe(false);
    expect(isBeacon(torch)).toBe(true);
    expect(sightRadius(torch)).toBe(2);
    expect(lightStatus(torch).text).toBe("lit by torch (~42m left)");
    expect(visibilityStatus(torch)).toMatchObject({ obscurity: "revealed", detail: "Torch · 42m", canExtinguish: true });

    const lantern = stateAt({ terrain: "forest", hour: 23, light: { source: "lantern", minutes: 90 } });
    expect(sightRadius(lantern)).toBe(SIGHT_RADIUS);
    expect(visibilityStatus(lantern)).toMatchObject({ obscurity: "revealed", detail: "Lantern · 90m" });

    const hooded = stateAt({ terrain: "forest", hour: 23, light: { source: "lantern", minutes: 90, hooded: true } });
    expect(lightMinutes(hooded)).toBe(0);
    expect(lightSource(hooded)).toBeNull();
    expect(inTheDark(hooded)).toBe(true);
    expect(isHidden(hooded)).toBe(true);
    expect(sightRadius(hooded)).toBe(1);
    expect(visibilityStatus(hooded)).toMatchObject({ obscurity: "heavy", canExtinguish: false });
  });

  it("keeps ambient and carried sources distinct in an already-lit place", () => {
    const state = stateAt({ terrain: "settlement", hour: 23, light: { source: "torch", minutes: 42 } });

    expect(isBeacon(state)).toBe(false);
    expect(lightStatus(state)).toMatchObject({ locationSource: "street-lamps", source: "torch", minutes: 42 });
    expect(lightStatus(state).text).toBe("street-lamp light; carrying a lit torch (~42m left)");
    expect(visibilityStatus(state)).toMatchObject({
      obscurity: "clear",
      detail: "Street lamps · Torch 42m",
      canExtinguish: true,
    });
  });

  it("uses the same night and gloomy-terrain boundaries for map sight and obscurity", () => {
    const openDusk = stateAt({ terrain: "plains", hour: 19 });
    expect(locationLightStatus(openDusk).dark).toBe(false);
    expect(sightRadius(openDusk)).toBe(SIGHT_RADIUS);

    const openNight = stateAt({ terrain: "plains", hour: 20 });
    expect(locationLightStatus(openNight).dark).toBe(true);
    expect(sightRadius(openNight)).toBe(1);

    const forestGloom = stateAt({ terrain: "forest", hour: 18 });
    expect(locationLightStatus(forestGloom).dark).toBe(true);
    expect(visibilityStatus(forestGloom).obscurity).toBe("heavy");
  });
});
