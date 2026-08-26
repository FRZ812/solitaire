import { describe, expect, it } from "vitest";
import { createTowActorV2 } from "./actor-v2.js";
import { TOW_AI_POLICY_REGISTRY_V2_CHECKSUM } from "./ai-v2.js";
import {
  PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
  TOW_ENCOUNTER_POLICY_V2_ID,
} from "./encounter-state-v2.js";
import {
  TOW_SESSION_POLICY_V2_CHECKSUM,
  calculateTowSessionPolicyV2Checksum,
  createTowSessionV2,
  towEncounterStateChecksumV2,
  towGenesisChecksumV2,
  towSessionChecksumV2,
  validateTowSessionV2,
} from "./session-v2.js";

function actor(id, side, preferredRow = 0) {
  const created = createTowActorV2({
    id,
    name: id,
    side,
    controller: side === "player" ? "human" : "ai",
    aiProfile: side === "player" ? null : { id: "knight", version: 1 },
    preferredRow,
    hp: 500,
    maxHp: 500,
    shield: 0,
    stats: {
      attack: 100,
      defense: 0,
      speed: 10,
      critChanceBps: 0,
      dodgeChanceBps: 0,
    },
    loadout: [{ id: "arctic-strike", rank: 1 }],
  });
  if (!created.ok) throw new TypeError(created.reason);
  return created.actor;
}

function genesis3v3() {
  const players = [actor("p:0", "player", 0), actor("p:1", "player", 1), actor("p:2", "player", 2)];
  const enemies = [actor("e:0", "enemy", 0), actor("e:1", "enemy", 1), actor("e:2", "enemy", 2)];
  const actors = [...players, ...enemies];
  return {
    aiPolicyChecksum: TOW_AI_POLICY_REGISTRY_V2_CHECKSUM,
    catalogChecksum: PINNED_TOW_ABILITY_CATALOG_V2_CHECKSUM,
    policyId: TOW_ENCOUNTER_POLICY_V2_ID,
    rosters: { player: players.map(({ id }) => id), enemy: enemies.map(({ id }) => id) },
    actors,
    resolveSeeds: actors.map(({ id }) => ({ id, resolve: 8, maxResolve: 10 })),
  };
}

describe("v2 durable session authority", () => {
  it("pins every upstream identity and opens an immutable mixed 3v3 genesis", () => {
    expect(calculateTowSessionPolicyV2Checksum()).toBe(TOW_SESSION_POLICY_V2_CHECKSUM);
    const genesis = genesis3v3();
    const created = createTowSessionV2({ sessionId: "session:mixed-3v3", genesis });

    expect(created).toMatchObject({ ok: true, reason: null });
    expect(created.session.revision).toBe(0);
    expect(created.session.commands).toEqual([]);
    expect(created.session.events).toEqual([]);
    expect(created.session.genesisChecksum).toBe(towGenesisChecksumV2(genesis));
    expect(created.session.checksum).toBe(towSessionChecksumV2(created.session));
    expect(created.session.policy).toMatchObject({
      catalogChecksum: "fnv1a32:8a8adfc6",
      statusPolicyChecksum: "fnv1a32:bcab7c74",
      damagePolicyChecksum: "fnv1a32:f41dd5bb",
      aiPolicyChecksum: "fnv1a32:9bcc646d",
      encounterPolicyChecksum: "fnv1a64:439053b5ed42608d",
      reducerVersion: 1,
      supportedCommands: expect.arrayContaining(["reaction-arm", "ai-step"]),
      unsupported: ["ai", "ai-turn", "ai-ability"],
    });
    expect(towEncounterStateChecksumV2(created.session.encounter)).toMatch(/^state-v2:[0-9a-f]{16}$/);
    expect(validateTowSessionV2(created.session)).toEqual({ ok: true, reason: null });
    expect(Object.isFrozen(created.session.encounter.actors["p:0"])).toBe(true);
  });

  it("fails closed on non-exact creation and mismatched catalog or policy identity", () => {
    const genesis = genesis3v3();
    expect(createTowSessionV2({ sessionId: "s", genesis, inferred: true })).toMatchObject({
      ok: false,
      reason: "invalid-tow-session-v2-create-input",
    });
    expect(createTowSessionV2({
      sessionId: "s",
      genesis: { ...genesis, catalogChecksum: "fnv1a32:00000000" },
    })).toMatchObject({ ok: false, reason: "invalid-encounter-genesis-v2-catalog-checksum" });
    expect(createTowSessionV2({
      sessionId: "s",
      genesis: { ...genesis, aiPolicyChecksum: "fnv1a32:00000000" },
    })).toMatchObject({ ok: false, reason: "invalid-encounter-genesis-v2-ai-policy-checksum" });
    expect(createTowSessionV2({
      sessionId: "s",
      genesis: { ...genesis, policyId: "legacy" },
    })).toMatchObject({ ok: false, reason: "invalid-encounter-genesis-v2-policy" });
  });
});
