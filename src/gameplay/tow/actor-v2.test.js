import { describe, expect, it } from "vitest";
import {
  TOW_ACTOR_SCALAR_MAX_V2,
  createTowActorV2,
  defineTowActorV2,
  isTowActorV2,
  validateTowActorV2,
} from "./actor-v2.js";

function input(overrides = {}) {
  return {
    id: "party:knight-01",
    name: "Alden Vale",
    side: "player",
    controller: "human",
    aiProfile: null,
    preferredRow: 0,
    hp: 180,
    maxHp: 180,
    shield: 0,
    stats: {
      attack: 24,
      defense: 30,
      speed: 12,
      critChanceBps: 750,
      dodgeChanceBps: 300,
    },
    loadout: [
      { id: "arctic-threatening-cry", rank: 2 },
      { id: "arctic-strike", rank: 3 },
      { id: "arctic-block", rank: 1 },
    ],
    ...overrides,
  };
}

describe("v2 actor creation", () => {
  it("creates one detached, deeply frozen, canonically ordered snapshot", () => {
    const source = input();
    const created = createTowActorV2(source);

    expect(created.ok).toBe(true);
    expect(created.actor).toMatchObject({
      version: 2,
      rulesetId: "solitaire-tow-v2",
      id: "party:knight-01",
      side: "player",
      controller: "human",
      aiProfile: null,
    });
    expect(created.actor.loadout.map(({ id }) => id)).toEqual([
      "arctic-block",
      "arctic-strike",
      "arctic-threatening-cry",
    ]);
    expect(Object.isFrozen(created)).toBe(true);
    expect(Object.isFrozen(created.actor)).toBe(true);
    expect(Object.isFrozen(created.actor.stats)).toBe(true);
    expect(Object.isFrozen(created.actor.loadout[0])).toBe(true);

    source.stats.attack = 999;
    source.loadout[0].rank = 5;
    expect(created.actor.stats.attack).toBe(24);
    expect(created.actor.loadout.find(({ id }) => id === "arctic-threatening-cry").rank)
      .toBe(2);
  });

  it("requires a versioned AI profile for AI-controlled participants", () => {
    const created = createTowActorV2(input({
      id: "enemy:sentinel",
      name: "Tower Sentinel",
      side: "enemy",
      controller: "ai",
      aiProfile: { id: "enemy-vanguard", version: 1 },
    }));

    expect(created.ok).toBe(true);
    expect(created.actor.aiProfile).toEqual({ id: "enemy-vanguard", version: 1 });
    expect(Object.isFrozen(created.actor.aiProfile)).toBe(true);
  });

  it("defines and freezes a decoded full snapshot without retaining foreign objects", () => {
    const actor = createTowActorV2(input()).actor;
    const decoded = structuredClone(actor);
    const defined = defineTowActorV2(decoded);

    expect(defined).toEqual(actor);
    expect(defined).not.toBe(decoded);
    expect(defined.stats).not.toBe(decoded.stats);
    expect(Object.isFrozen(defined)).toBe(true);
    decoded.hp = 1;
    expect(defined.hp).toBe(180);
  });
});

describe("v2 actor validation", () => {
  it.each([
    ["missing explicit loadout", () => {
      const value = input();
      delete value.loadout;
      return value;
    }, "invalid-actor-v2-create-input"],
    ["legacy build inference", () => ({ ...input(), build: { skills: ["strike"] } }),
      "invalid-actor-v2-create-input"],
    ["human with AI profile", () => input({ aiProfile: { id: "balanced", version: 1 } }),
      "invalid-actor-v2-ai-profile"],
    ["AI without profile", () => input({ controller: "ai", aiProfile: null }),
      "invalid-actor-v2-ai-profile"],
    ["unknown ability", () => input({ loadout: [{ id: "legacy-strike", rank: 1 }] }),
      "invalid-actor-v2-ability-rank"],
    ["rank above catalogue", () => input({ loadout: [{ id: "arctic-strike", rank: 7 }] }),
      "invalid-actor-v2-ability-rank"],
    ["duplicate ability", () => input({ loadout: [
      { id: "arctic-strike", rank: 1 },
      { id: "arctic-strike", rank: 2 },
    ] }), "duplicate-actor-v2-ability"],
    ["HP above maximum", () => input({ hp: 181 }), "invalid-actor-v2-vitals"],
    ["negative shield", () => input({ shield: -1 }), "invalid-actor-v2-vitals"],
    ["shield above the shared damage-safe cap", () => input({
      shield: TOW_ACTOR_SCALAR_MAX_V2 + 1,
    }), "invalid-actor-v2-vitals"],
    ["vitals above the shared damage-safe cap", () => input({
      hp: TOW_ACTOR_SCALAR_MAX_V2 + 1,
      maxHp: TOW_ACTOR_SCALAR_MAX_V2 + 1,
    }), "invalid-actor-v2-vitals"],
    ["non-integer attack", () => input({
      stats: {
        attack: 2.5,
        defense: 30,
        speed: 12,
        critChanceBps: 750,
        dodgeChanceBps: 300,
      },
    }), "invalid-actor-v2-stats"],
    ["zero scheduler speed", () => input({
      stats: {
        attack: 24,
        defense: 30,
        speed: 0,
        critChanceBps: 750,
        dodgeChanceBps: 300,
      },
    }), "invalid-actor-v2-stats"],
    ["attack above the shared damage-safe cap", () => input({
      stats: {
        attack: TOW_ACTOR_SCALAR_MAX_V2 + 1,
        defense: 30,
        speed: 12,
        critChanceBps: 750,
        dodgeChanceBps: 300,
      },
    }), "invalid-actor-v2-stats"],
    ["defense above the shared damage-safe cap", () => input({
      stats: {
        attack: 24,
        defense: TOW_ACTOR_SCALAR_MAX_V2 + 1,
        speed: 12,
        critChanceBps: 750,
        dodgeChanceBps: 300,
      },
    }), "invalid-actor-v2-stats"],
    ["chance above 100 percent", () => input({
      stats: {
        attack: 24,
        defense: 30,
        speed: 12,
        critChanceBps: 10_001,
        dodgeChanceBps: 300,
      },
    }), "invalid-actor-v2-stats"],
    ["invalid preferred row", () => input({ preferredRow: 3 }), "invalid-actor-v2-role"],
    ["uncanonical name", () => input({ name: " Alden " }), "invalid-actor-v2-identity"],
  ])("rejects %s", (_label, make, reason) => {
    expect(createTowActorV2(make())).toEqual({ ok: false, reason, actor: null });
  });

  it("pins exact full-snapshot keys, ruleset identity, and loadout order", () => {
    const actor = createTowActorV2(input()).actor;
    expect(validateTowActorV2(actor)).toEqual({ ok: true, reason: null });
    expect(isTowActorV2(actor)).toBe(true);

    expect(validateTowActorV2({ ...actor, version: 1 }))
      .toEqual({ ok: false, reason: "invalid-actor-v2-ruleset" });
    expect(validateTowActorV2({ ...actor, rulesetId: "solitaire-tow-v1" }))
      .toEqual({ ok: false, reason: "invalid-actor-v2-ruleset" });
    expect(validateTowActorV2({ ...actor, profession: "knight" }))
      .toEqual({ ok: false, reason: "invalid-actor-v2-shape" });
    expect(validateTowActorV2({ ...actor, loadout: [...actor.loadout].reverse() }))
      .toEqual({ ok: false, reason: "noncanonical-actor-v2-loadout" });
    expect(() => defineTowActorV2({ ...actor, hp: -1 }))
      .toThrow("invalid-actor-v2-vitals");
  });
});
