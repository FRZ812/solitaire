import { describe, expect, it } from "vitest";
import {
  getActionProgressionOffer,
  getActionReplacementFamily,
  getReferenceAction,
  SHIELD_BASH,
  SLAUGHTER,
} from "../reference/actions.js";
import {
  MAX_ACTION_UPGRADE_LEVEL,
  chooseActionProgressionOffer,
  createActionProgressionState,
  filterActionProgressionOffers,
} from "./action-progression.js";

describe("action replacement progression", () => {
  it("defines the Shield Bash and Slaughter replacement families with source confidence", () => {
    for (const [familyId, action] of [
      ["shield-bash", SHIELD_BASH],
      ["slaughter", SLAUGHTER],
    ]) {
      expect(getReferenceAction(action.id)).toBe(action);
      expect(getActionReplacementFamily(familyId)).toMatchObject({
        id: familyId,
        slot: "attack",
        replacesActionId: "basic-attack",
        replacementActionId: action.id,
        evidence: {
          confidence: "secondary",
          date: "2023-09-12",
          url: "https://gall.dcinside.com/mgallery/board/view/?id=tow&no=5666",
        },
      });
    }
  });

  it("allows basic Attack to receive upgrades from both replacement families", () => {
    const initial = createActionProgressionState();
    const shieldUpgrade = chooseActionProgressionOffer(initial, "shield-bash-upgrade");
    const slaughterUpgrade = chooseActionProgressionOffer(
      shieldUpgrade.state,
      "slaughter-upgrade",
    );

    expect(shieldUpgrade.ok).toBe(true);
    expect(slaughterUpgrade.ok).toBe(true);
    expect(slaughterUpgrade.state.actions.attack).toEqual({
      actionId: "basic-attack",
      upgrades: [
        { offerId: "shield-bash-upgrade", familyId: "shield-bash", level: 1 },
        { offerId: "slaughter-upgrade", familyId: "slaughter", level: 1 },
      ],
    });
    expect(slaughterUpgrade.state.actionFamilyLocks).toEqual({ attack: null });
  });

  it("durably locks replacement state and filters future offers to compatible upgrades", () => {
    const replaced = chooseActionProgressionOffer(
      createActionProgressionState(),
      "shield-bash-replacement",
    );

    expect(replaced.ok).toBe(true);
    expect(replaced.state.actions.attack).toEqual({
      actionId: "shield-bash",
      upgrades: [],
    });
    expect(replaced.state.actionFamilyLocks).toEqual({ attack: "shield-bash" });

    const restored = JSON.parse(JSON.stringify(replaced.state));
    const candidates = [
      "slaughter-upgrade",
      "shield-bash-replacement",
      "slaughter-replacement",
      "shield-bash-upgrade",
    ];
    expect(filterActionProgressionOffers(restored, candidates)).toEqual([
      "shield-bash-upgrade",
    ]);
    expect(filterActionProgressionOffers(restored, candidates)).toEqual(
      filterActionProgressionOffers(restored, candidates),
    );
  });

  it.each(["slaughter-upgrade", "slaughter-replacement"])(
    "rejects locked cross-family choice %s atomically",
    (offerId) => {
      const locked = chooseActionProgressionOffer(
        createActionProgressionState(),
        "shield-bash-replacement",
      ).state;
      const snapshot = JSON.stringify(locked);

      const rejected = chooseActionProgressionOffer(locked, offerId);

      expect(rejected).toEqual({
        ok: false,
        reason: "action-family-locked",
        state: locked,
        events: [],
      });
      expect(JSON.stringify(locked)).toBe(snapshot);
    },
  );

  it("does not allow a locked slot to choose another replacement", () => {
    const locked = chooseActionProgressionOffer(
      createActionProgressionState(),
      "shield-bash-replacement",
    ).state;

    expect(chooseActionProgressionOffer(locked, "shield-bash-replacement")).toEqual({
      ok: false,
      reason: "action-already-replaced",
      state: locked,
      events: [],
    });
  });

  it("rejects non-string registry and choice IDs without coercion", () => {
    let coercions = 0;
    const malicious = {
      [Symbol.toPrimitive]: () => { coercions += 1; return "shield-bash-upgrade"; },
    };

    expect(getReferenceAction(malicious)).toBeNull();
    expect(getActionReplacementFamily(malicious)).toBeNull();
    expect(getActionProgressionOffer(malicious)).toBeNull();
    expect(chooseActionProgressionOffer(createActionProgressionState(), malicious)).toMatchObject({
      ok: false,
      reason: "unknown-action-offer",
    });
    expect(coercions).toBe(0);
  });

  it("fails closed for malformed persisted state", () => {
    expect(chooseActionProgressionOffer({}, "shield-bash-upgrade")).toEqual({
      ok: false,
      reason: "invalid-action-progression-state",
      state: null,
      events: [],
    });
    expect(filterActionProgressionOffers({}, ["shield-bash-upgrade"])).toEqual([]);
  });

  it("rejects an upgrade at its operational cap without reporting non-monotonic success", () => {
    const saturated = JSON.parse(JSON.stringify(createActionProgressionState()));
    saturated.actions.attack.upgrades.push({
      offerId: "shield-bash-upgrade",
      familyId: "shield-bash",
      level: MAX_ACTION_UPGRADE_LEVEL,
    });

    expect(chooseActionProgressionOffer(saturated, "shield-bash-upgrade")).toMatchObject({
      ok: false,
      reason: "action-upgrade-limit-reached",
      state: saturated,
      events: [],
    });
  });

  it("returns a stable rejection receipt that cannot alias hydrated input", () => {
    const locked = chooseActionProgressionOffer(
      createActionProgressionState(),
      "shield-bash-replacement",
    ).state;
    const restored = JSON.parse(JSON.stringify(locked));

    const rejected = chooseActionProgressionOffer(restored, "slaughter-upgrade");
    restored.actions.attack.actionId = "mutated-after-return";

    expect(rejected.state.actions.attack.actionId).toBe("shield-bash");
    expect(Object.isFrozen(rejected.state)).toBe(true);
  });
});
