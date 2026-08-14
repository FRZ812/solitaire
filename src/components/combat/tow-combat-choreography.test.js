import { describe, expect, it } from "vitest";
import { getSkill } from "../../gameplay/tow/skills.js";
import { combatChoreographyForAction } from "./tow-combat-choreography.js";

describe("combat action choreography", () => {
  it("makes heavy and rapid actions feel materially different", () => {
    const heavy = combatChoreographyForAction(getSkill("arctic-deliberate-blow"));
    const rapid = combatChoreographyForAction(getSkill("demon-kick"));
    expect(heavy.visual.motion).toBe("heavy");
    expect(heavy.windupMs).toBeGreaterThan(rapid.windupMs);
    expect(heavy.recoveryMs).toBeGreaterThan(rapid.recoveryMs);
    expect(heavy.paceLabel).toBe("Committed");
    expect(rapid.paceLabel).toBe("Quick");
  });

  it("uses the equipped Strike form and keeps Swift actions brisk", () => {
    const strike = combatChoreographyForAction(getSkill("strike"), { activeFormId: "threefold-cut" });
    const swift = combatChoreographyForAction(getSkill("clocktower-missile-support"));
    expect(strike.visual).toMatchObject({ variant: "threefold-cut", motion: "flurry" });
    expect(swift.paceLabel).toBe("Swift");
    expect(swift.windupMs).toBeLessThanOrEqual(210);
  });

  it("keeps a short semantic beat when reduced motion is requested", () => {
    const reduced = combatChoreographyForAction(
      getSkill("north-king-earthquake"),
      null,
      { reducedMotion: true },
    );
    expect(reduced.windupMs).toBe(70);
    expect(reduced.recoveryMs).toBe(180);
  });
});
