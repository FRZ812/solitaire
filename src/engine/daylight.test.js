import { describe, expect, it } from "vitest";
import { isNight } from "./light.js";
import {
  DAWN_MINUTE,
  DAY_MINUTES,
  DUSK_MINUTE,
  marchClockMinutes,
  marchSweepMinutes,
  minuteOfDay,
  skyAt,
  skyGrade,
  sunAltitude,
} from "./daylight.js";

const at = (hour, minute = 0) => hour * 60 + minute;

describe("sun altitude", () => {
  it("crosses zero where the survival layer says night begins and ends", () => {
    // A sky that reads as dusk while the rules say the party is blind would be a
    // lie about a mechanic, so the two share their boundaries.
    expect(sunAltitude(DAWN_MINUTE)).toBeCloseTo(0, 10);
    expect(sunAltitude(DUSK_MINUTE)).toBeCloseTo(0, 10);
    for (let hour = 0; hour < 24; hour += 1) {
      const altitude = sunAltitude(at(hour));
      if (hour === 6 || hour === 20) continue; // the crossings themselves
      expect(altitude > 0).toBe(!isNight({ hour }));
    }
  });

  it("peaks at the middle of the day and bottoms out at the middle of the night", () => {
    expect(sunAltitude(at(13))).toBeCloseTo(1, 10);
    expect(sunAltitude(at(1))).toBeCloseTo(-1, 10);
    expect(sunAltitude(at(9))).toBeLessThan(sunAltitude(at(11)));
    expect(sunAltitude(at(22))).toBeGreaterThan(sunAltitude(at(1)));
  });

  it("reads any minute of any day, wrapping rather than running off the clock", () => {
    expect(sunAltitude(at(13) + DAY_MINUTES * 3)).toBeCloseTo(sunAltitude(at(13)), 10);
    expect(sunAltitude(-60)).toBeCloseTo(sunAltitude(at(23)), 10);
    expect(minuteOfDay({ hour: 7, minute: 30 })).toBe(450);
    expect(minuteOfDay(undefined)).toBe(0);
  });
});

describe("sky grade", () => {
  it("draws nothing at all while the sun is properly up", () => {
    // Mid-afternoon still reads as plain daylight; the grade costs nothing for
    // most of the day, which is the point of the FULL_DAY cutoff.
    for (const hour of [12, 15, 18]) {
      expect(skyAt(at(hour)).shade).toBe(0);
      expect(skyAt(at(hour)).lamps).toBe(0);
    }
  });

  it("deepens steadily from the last of the light into the small hours", () => {
    const shades = [19, 20, 21, 22, 1].map((hour) => skyAt(at(hour)).shade);
    for (let i = 1; i < shades.length; i += 1) expect(shades[i]).toBeGreaterThan(shades[i - 1]);
    expect(skyAt(at(1)).shade).toBeLessThan(1);
  });

  it("puts its warmest light and its horizon band at sunrise and sunset", () => {
    const dusk = skyAt(DUSK_MINUTE);
    expect(dusk.warmth).toBeCloseTo(1, 5);
    expect(dusk.horizon).toBeCloseTo(1, 5);
    for (const hour of [12, 1]) {
      expect(skyAt(at(hour)).warmth).toBeLessThan(dusk.warmth);
      expect(skyAt(at(hour)).horizon).toBeLessThan(dusk.horizon);
    }
    // Dawn is the same instant of the curve seen from the other side.
    expect(skyAt(DAWN_MINUTE).warmth).toBeCloseTo(dusk.warmth, 5);
  });

  it("brings the lamps up as the light goes", () => {
    expect(skyAt(at(12)).lamps).toBe(0);
    expect(skyAt(at(19)).lamps).toBeGreaterThan(0);
    expect(skyAt(at(23)).lamps).toBeGreaterThan(skyAt(at(19)).lamps);
    expect(skyAt(at(1)).lamps).toBeCloseTo(1, 5);
  });

  it("hands the renderer finished colours so no palette choice is left to it", () => {
    const dusk = skyAt(DUSK_MINUTE);
    for (const colour of [dusk.shadeColor, dusk.warmColor, dusk.horizonColor]) {
      expect(colour).toMatch(/^rgba\(\d+, \d+, \d+, [\d.]+\)$/);
    }
    expect(skyGrade(2).shade).toBe(0);
    expect(skyGrade(-9).shade).toBe(skyAt(at(1)).shade);
    // The sun comes up in the east and goes down in the west, so the two ends of
    // the same altitude are told apart by this and nothing else.
    expect(skyAt(DAWN_MINUTE).rising).toBe(true);
    expect(dusk.rising).toBe(false);
  });
});

describe("the clock a march is lit by", () => {
  it("shows the real elapsed time for anything inside a day", () => {
    expect(marchSweepMinutes(0)).toBe(0);
    expect(marchSweepMinutes(430)).toBe(430);
    expect(marchSweepMinutes(DAY_MINUTES)).toBe(DAY_MINUTES);
  });

  it("sweeps a longer march once instead of strobing a sunrise per day", () => {
    // A fortnight interpolated straight across a four-second animation is
    // fourteen sunrises, so past a day it is one cycle plus the remainder.
    expect(marchSweepMinutes(DAY_MINUTES * 14)).toBe(DAY_MINUTES);
    expect(marchSweepMinutes(DAY_MINUTES * 3 + 120)).toBe(DAY_MINUTES + 120);
    expect(marchSweepMinutes(DAY_MINUTES * 40)).toBeLessThan(DAY_MINUTES * 2);
  });

  it("still lands on the hour the party actually arrives at", () => {
    const depart = { hour: 8, minute: 0 };
    for (const elapsed of [90, 430, DAY_MINUTES * 2 + 200, DAY_MINUTES * 11 + 45]) {
      expect(marchClockMinutes(depart, elapsed, 1)).toBe((at(8) + elapsed) % DAY_MINUTES);
    }
  });

  it("starts where the party stands and moves only as the march does", () => {
    const depart = { hour: 8, minute: 0 };
    expect(marchClockMinutes(depart, 600, 0)).toBe(at(8));
    expect(marchClockMinutes(depart, 600, 0.5)).toBe(at(13));
    // A march that has not begun leaves the sky exactly where it was.
    expect(marchClockMinutes(depart, 0, 0.5)).toBe(at(8));
  });

  it("takes a departure at dusk into real darkness partway through", () => {
    const depart = { hour: 18, minute: 0 };
    expect(sunAltitude(marchClockMinutes(depart, 480, 0))).toBeGreaterThan(0);
    expect(sunAltitude(marchClockMinutes(depart, 480, 0.75))).toBeLessThan(0);
    expect(skyAt(marchClockMinutes(depart, 480, 1)).lamps).toBeGreaterThan(0.5);
  });
});
