import { describe, expect, it } from "vitest";
import { PROFESSION_PROFILES } from "./progression-paths.js";
import { professionBranchChoices } from "./progression-paths.js";
import {
  PROFESSION_TREE_NODE_COUNT,
  PROFESSION_TREE_RING,
  availableProfessionTreeNodeIds,
  normalizeProfessionTreeState,
  professionTreeGraph,
  professionTreeStartNodeId,
} from "./profession-tree.js";

describe("unified profession tree graph", () => {
  it("places every profession in one deterministic 2,030-node graph", () => {
    const graph = professionTreeGraph();
    const professionIds = Object.keys(PROFESSION_PROFILES);

    expect(PROFESSION_TREE_RING).toHaveLength(professionIds.length - 1);
    expect(graph.nodes).toHaveLength(professionIds.length * PROFESSION_TREE_NODE_COUNT);
    expect(graph.startNodes.size).toBe(professionIds.length);
    for (const professionId of professionIds) {
      expect(graph.professionNodes.get(professionId), professionId).toHaveLength(PROFESSION_TREE_NODE_COUNT);
      expect(graph.nodeById.get(professionTreeStartNodeId(professionId))).toMatchObject({ professionId, isStart: true });
      expect(graph.professionNodes.get(professionId).map((node) => node.trackLevel)).toEqual(
        Array.from({ length: PROFESSION_TREE_NODE_COUNT }, (_, index) => index + 1),
      );
    }
    expect(graph.nodes.reduce((sum, node) => sum + node.choiceIds.length, 0)).toBe(
      professionIds.reduce((sum, professionId) => sum + professionBranchChoices(professionId).length, 0),
    );
    expect(graph.nodes.reduce((sum, node) => sum + node.choiceOptionCount, 0)).toBe(562);
  });

  it("joins clusters through multiple outer-boundary routes instead of start-node shortcuts", () => {
    const graph = professionTreeGraph();
    const professionRoutes = graph.edges.filter((edge) => edge.kind === "profession-route");
    const wandererRoutes = graph.edges.filter((edge) => edge.kind === "wanderer-route");

    expect(professionRoutes).toHaveLength(PROFESSION_TREE_RING.length * 3);
    expect(wandererRoutes).toHaveLength(Math.ceil(PROFESSION_TREE_RING.length / 4) * 2);
    for (const edge of [...professionRoutes, ...wandererRoutes]) {
      expect(graph.nodeById.get(edge.from).ring).toBe(7);
      expect(graph.nodeById.get(edge.to).ring).toBe(7);
      expect(graph.nodeById.get(edge.from).isStart).toBe(false);
      expect(graph.nodeById.get(edge.to).isStart).toBe(false);
      expect(graph.bridgeNodeIds.has(edge.from)).toBe(true);
      expect(graph.bridgeNodeIds.has(edge.to)).toBe(true);
    }
  });

  it("opens several local directions without exposing another profession at its starting point", () => {
    const state = normalizeProfessionTreeState({ professionLevels: { fighter: 1 }, startProfessionId: "fighter" });
    const available = availableProfessionTreeNodeIds(state);

    expect(state.allocations[professionTreeStartNodeId("fighter")]).toMatchObject({ professionId: "fighter", trackLevel: 1 });
    expect([...available].filter((nodeId) => nodeId.startsWith("profession:fighter:"))).toHaveLength(6);
    expect(available.has(professionTreeStartNodeId("barbarian"))).toBe(false);
    expect(available.has(professionTreeStartNodeId("ruler"))).toBe(false);
    expect(available.has(professionTreeStartNodeId("wizard"))).toBe(false);
  });

  it("derives immutable node ranks, preserves a connected route, and fills only missing allocations", () => {
    const graph = professionTreeGraph();
    const fighterNodes = graph.professionNodes.get("fighter");
    const chosenNode = fighterNodes[6];
    const state = normalizeProfessionTreeState({
      professionLevels: { fighter: 3 },
      startProfessionId: "fighter",
      state: {
        startProfessionId: "fighter",
        allocations: {
          [professionTreeStartNodeId("fighter")]: { professionId: "fighter", trackLevel: 1, order: 1 },
          [chosenNode.id]: { professionId: "fighter", trackLevel: 2, order: 2 },
        },
      },
    });

    expect(state.allocations[chosenNode.id]).toMatchObject({ trackLevel: chosenNode.localIndex + 1, order: 2 });
    expect(Object.values(state.allocations)).toHaveLength(3);
    expect(state.allocations[professionTreeStartNodeId("fighter")]).toMatchObject({ trackLevel: 1, order: 1 });
  });

  it("validates historical allocation connectivity in point-spend order", () => {
    const graph = professionTreeGraph();
    const fighterNodes = graph.professionNodes.get("fighter");
    const outOfOrderNode = fighterNodes[6];
    const state = normalizeProfessionTreeState({
      professionLevels: { fighter: 2 },
      startProfessionId: "fighter",
      state: {
        allocations: {
          [outOfOrderNode.id]: { professionId: "fighter", trackLevel: 2, order: 1 },
          [professionTreeStartNodeId("fighter")]: { professionId: "fighter", trackLevel: 99, order: 2 },
        },
      },
    });

    expect(state.allocations[outOfOrderNode.id]).toBeUndefined();
    expect(state.allocations[professionTreeStartNodeId("fighter")]).toMatchObject({ trackLevel: 1, order: 2 });
    expect(Object.keys(state.allocations)).toHaveLength(2);
    expect(Object.values(state.allocations).every((allocation) => allocation.trackLevel !== 99)).toBe(true);
  });

  it("creates and persists explicit roots only for requested legacy profession islands", () => {
    const wizardStartId = professionTreeStartNodeId("wizard");
    const disconnected = normalizeProfessionTreeState({
      professionLevels: { fighter: 1, wizard: 2 },
      startProfessionId: "fighter",
    });
    expect(disconnected.legacyRootNodeIds).toEqual([]);
    expect(Object.values(disconnected.allocations).filter((row) => row.professionId === "wizard")).toHaveLength(0);

    const migrated = normalizeProfessionTreeState({
      professionLevels: { fighter: 1, wizard: 2 },
      startProfessionId: "fighter",
      allowLegacyIslands: true,
    });
    expect(migrated.legacyRootNodeIds).toEqual([wizardStartId]);
    expect(Object.values(migrated.allocations).filter((row) => row.professionId === "wizard")).toHaveLength(2);

    const restored = normalizeProfessionTreeState({
      professionLevels: { fighter: 1, wizard: 2 },
      startProfessionId: "fighter",
      state: migrated,
    });
    expect(restored.legacyRootNodeIds).toEqual([wizardStartId]);
    expect(Object.values(restored.allocations).filter((row) => row.professionId === "wizard")).toHaveLength(2);
  });

  it("fills generated allocations as a connected walk from each permitted root", () => {
    const graph = professionTreeGraph();
    const state = normalizeProfessionTreeState({
      professionLevels: { fighter: 24, wizard: 12 },
      startProfessionId: "fighter",
      allowLegacyIslands: true,
    });
    const roots = new Set([professionTreeStartNodeId("fighter"), ...state.legacyRootNodeIds]);
    const earlier = new Set();
    for (const [nodeId] of Object.entries(state.allocations).sort((left, right) => left[1].order - right[1].order)) {
      expect(roots.has(nodeId) || (graph.neighborIds.get(nodeId) || []).some((neighborId) => earlier.has(neighborId))).toBe(true);
      earlier.add(nodeId);
    }
  });
});
