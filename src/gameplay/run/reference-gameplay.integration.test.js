import { describe, expect, it } from "vitest";
import { makeInitialState, migrateCodex } from "../../data/initial-state.js";
import {
  readReferenceGameplay,
  startReferenceGatekeeperTrial,
  transitionReferenceGameplay,
} from "./campaign-boundary.js";
import { resolveRunCommand } from "./state.js";

describe("reference gameplay campaign integration", () => {
  it("survives the real campaign serialization and migration boundary", () => {
    const started = startReferenceGatekeeperTrial(makeInitialState(), {
      campaignId: "integration-campaign",
      previewEnabled: true,
    });
    const advanced = transitionReferenceGameplay(
      started.state,
      (run) => resolveRunCommand(run, {
        expectedRunSequence: run.sequence,
        type: "use-action",
        actorId: run.encounter.playerId,
        actionId: "basic-attack",
        targetId: run.encounter.enemyIds[0],
      }),
      { campaignId: "integration-campaign", previewEnabled: true },
    );

    const serialized = JSON.parse(JSON.stringify(advanced.state));
    const migrated = migrateCodex(serialized);
    const restored = readReferenceGameplay(migrated, { campaignId: "integration-campaign" });

    expect(started.ok).toBe(true);
    expect(advanced.ok).toBe(true);
    expect(restored.ok).toBe(true);
    expect(restored.run.sequence).toBe(1);
    expect(restored.run.history).toHaveLength(1);
    expect(restored.run.encounter.round).toBe(2);
    expect(restored.run.runId).toBe("integration-campaign:tower-winter:1");
  });
});
