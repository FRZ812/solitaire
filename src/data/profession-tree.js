import { PROFESSION_PROFILES, canonicalProfessionId, professionBranchChoices } from "./progression-paths.js";

export const PROFESSION_TREE_VERSION = 1;
export const PROFESSION_TREE_SIZE = 4200;
export const PROFESSION_TREE_NODE_COUNT = 70;

// The order is intentionally thematic. Adjacent regions share several outer
// boundary routes, so multiclass travel emerges from branches rather than
// crest-to-crest shortcuts.
export const PROFESSION_TREE_RING = Object.freeze([
  "fighter", "barbarian", "commander", "paladin", "monk", "ranger", "rogue",
  "mariner", "labourer", "artisan", "artificer", "wizard", "sorcerer", "warlock",
  "scholar", "druid", "cleric", "healer", "farmer", "merchant", "innkeeper",
  "attendant", "performer", "bard", "diplomat", "courtier", "steward", "ruler",
]);

const LOCAL_RING_COUNTS = Object.freeze([6, 8, 10, 11, 12, 12, 10]);
const LOCAL_RING_RADII = Object.freeze([34, 54, 76, 98, 120, 142, 164]);
const OUTER_START_RADIUS = 1630;
const CENTER = PROFESSION_TREE_SIZE / 2;

export function professionTreeNodeId(professionId, localIndex) {
  return `profession:${canonicalProfessionId(professionId) || professionId}:node:${localIndex}`;
}

export function professionTreeStartNodeId(professionId) {
  return professionTreeNodeId(professionId, 0);
}

function edgeId(from, to) {
  return [from, to].sort().join("~");
}

function addEdge(edges, seenEdges, from, to, kind = "path") {
  const id = edgeId(from, to);
  if (from === to || seenEdges.has(id)) return;
  seenEdges.add(id);
  edges.push(Object.freeze({ id, from, to, kind }));
}

function buildCluster(professionId, centerX, centerY, orientation, hue, edges, seenEdges) {
  const nodes = [];
  const branchDefinitions = professionBranchChoices(professionId);
  const choiceMetadata = (trackLevel) => {
    const definitions = branchDefinitions.filter((choice) => choice.threshold === trackLevel);
    return {
      isChoiceGate: definitions.length > 0,
      choiceIds: Object.freeze(definitions.map((choice) => choice.id)),
      choiceOptionCount: definitions.reduce((sum, choice) => sum + (choice.options || []).length, 0),
    };
  };
  const startId = professionTreeStartNodeId(professionId);
  nodes.push(Object.freeze({
    id: startId,
    professionId,
    localIndex: 0,
    x: centerX,
    y: centerY,
    hue,
    isStart: true,
    ring: 0,
    trackLevel: 1,
    ...choiceMetadata(1),
  }));

  let localIndex = 1;
  let previousRing = [nodes[0]];
  LOCAL_RING_COUNTS.forEach((count, ringIndex) => {
    const radius = LOCAL_RING_RADII[ringIndex];
    const ring = Array.from({ length: count }, (_, slot) => {
      const angle = orientation + ((slot / count) * Math.PI * 2) + (ringIndex * 0.17);
      const node = Object.freeze({
        id: professionTreeNodeId(professionId, localIndex),
        professionId,
        localIndex,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        hue,
        isStart: false,
        ring: ringIndex + 1,
        trackLevel: localIndex + 1,
        ...choiceMetadata(localIndex + 1),
      });
      localIndex += 1;
      return node;
    });

    ring.forEach((node, slot) => {
      const parentIndex = Math.min(previousRing.length - 1, Math.floor((slot * previousRing.length) / count));
      addEdge(edges, seenEdges, previousRing[parentIndex].id, node.id, "path");
      if (slot % 3 === 0 && count > 6) addEdge(edges, seenEdges, node.id, ring[(slot + 1) % count].id, "orbit");
    });
    nodes.push(...ring);
    previousRing = ring;
  });
  return nodes;
}

function connectClosestBoundaryNodes(edges, seenEdges, fromNodes, toNodes, count, kind, bridgeNodeIds) {
  const candidates = fromNodes.flatMap((from) => toNodes.map((to) => ({
    from,
    to,
    distance: Math.hypot(from.x - to.x, from.y - to.y),
  }))).sort((left, right) => left.distance - right.distance
    || left.from.localIndex - right.from.localIndex
    || left.to.localIndex - right.to.localIndex);
  const usedFrom = new Set();
  const usedTo = new Set();
  let connected = 0;
  for (const candidate of candidates) {
    if (usedFrom.has(candidate.from.id) || usedTo.has(candidate.to.id)) continue;
    addEdge(edges, seenEdges, candidate.from.id, candidate.to.id, kind);
    usedFrom.add(candidate.from.id);
    usedTo.add(candidate.to.id);
    bridgeNodeIds.add(candidate.from.id);
    bridgeNodeIds.add(candidate.to.id);
    connected += 1;
    if (connected >= count) break;
  }
}

let cachedGraph = null;

export function professionTreeGraph() {
  if (cachedGraph) return cachedGraph;
  const profileIds = Object.keys(PROFESSION_PROFILES);
  const expected = new Set(["wanderer", ...PROFESSION_TREE_RING]);
  if (profileIds.some((id) => !expected.has(id)) || expected.size !== profileIds.length) {
    throw new Error("Profession tree order must include every canonical profession exactly once");
  }

  const nodes = [];
  const edges = [];
  const seenEdges = new Set();
  const bridgeNodeIds = new Set();
  const ringCount = PROFESSION_TREE_RING.length;

  nodes.push(...buildCluster("wanderer", CENTER, CENTER, -Math.PI / 2, 44, edges, seenEdges));
  PROFESSION_TREE_RING.forEach((professionId, index) => {
    const angle = (-Math.PI / 2) + ((index / ringCount) * Math.PI * 2);
    const centerX = CENTER + Math.cos(angle) * OUTER_START_RADIUS;
    const centerY = CENTER + Math.sin(angle) * OUTER_START_RADIUS;
    nodes.push(...buildCluster(professionId, centerX, centerY, angle, Math.round((index / ringCount) * 330), edges, seenEdges));
  });

  const outerRing = (professionId) => nodes.filter((node) => (
    node.professionId === professionId && node.ring === LOCAL_RING_COUNTS.length
  ));
  PROFESSION_TREE_RING.forEach((professionId, index) => {
    const nextId = PROFESSION_TREE_RING[(index + 1) % ringCount];
    connectClosestBoundaryNodes(
      edges,
      seenEdges,
      outerRing(professionId),
      outerRing(nextId),
      3,
      "profession-route",
      bridgeNodeIds,
    );
  });
  for (let index = 0; index < ringCount; index += 4) {
    connectClosestBoundaryNodes(
      edges,
      seenEdges,
      outerRing("wanderer"),
      outerRing(PROFESSION_TREE_RING[index]),
      2,
      "wanderer-route",
      bridgeNodeIds,
    );
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const neighborIds = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    neighborIds.get(edge.from).push(edge.to);
    neighborIds.get(edge.to).push(edge.from);
  }
  const professionNodes = new Map(profileIds.map((professionId) => [
    professionId,
    nodes.filter((node) => node.professionId === professionId).sort((a, b) => a.localIndex - b.localIndex),
  ]));
  const startNodes = new Map(profileIds.map((professionId) => [professionId, nodeById.get(professionTreeStartNodeId(professionId))]));

  cachedGraph = Object.freeze({
    size: PROFESSION_TREE_SIZE,
    center: CENTER,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    nodeById,
    neighborIds,
    professionNodes,
    startNodes,
    bridgeNodeIds,
  });
  return cachedGraph;
}

export function normalizeProfessionTreeState({
  professionLevels = {},
  startProfessionId = "wanderer",
  state = null,
  allowLegacyIslands = false,
} = {}) {
  const graph = professionTreeGraph();
  const canonicalStart = canonicalProfessionId(state?.startProfessionId || startProfessionId) || "wanderer";
  const allocations = {};
  const allocatedIds = new Set();
  const allocationCounts = new Map();
  const normalizedLevels = new Map();
  for (const [rawProfessionId, rawLevel] of Object.entries(professionLevels || {})) {
    const professionId = canonicalProfessionId(rawProfessionId);
    if (!professionId) continue;
    normalizedLevels.set(professionId, Math.max(
      normalizedLevels.get(professionId) || 0,
      Math.max(0, Math.min(PROFESSION_TREE_NODE_COUNT, Math.floor(Number(rawLevel) || 0))),
    ));
  }

  const canonicalRootId = professionTreeStartNodeId(canonicalStart);
  const legacyRootNodeIds = new Set((state?.legacyRootNodeIds || []).filter((nodeId) => {
    const node = graph.nodeById.get(nodeId);
    return node?.isStart
      && nodeId !== canonicalRootId
      && (normalizedLevels.get(node.professionId) || 0) > 0;
  }));
  if (allowLegacyIslands) {
    for (const [professionId, level] of normalizedLevels) {
      if (professionId !== canonicalStart && level > 0) legacyRootNodeIds.add(professionTreeStartNodeId(professionId));
    }
  }
  const rootNodeIds = new Set([canonicalRootId, ...legacyRootNodeIds]);
  const usedOrders = new Set();
  const rawAllocations = Object.entries(state?.allocations || {}).map(([nodeId, raw], index) => ({
    nodeId,
    raw,
    index,
    order: Math.floor(Number(raw?.order) || 0),
  })).filter((entry) => entry.order > 0).sort((left, right) => (
    left.order - right.order || left.index - right.index || left.nodeId.localeCompare(right.nodeId)
  ));

  for (const { nodeId, raw, order } of rawAllocations) {
    const node = graph.nodeById.get(nodeId);
    if (!node || usedOrders.has(order)) continue;
    const professionId = canonicalProfessionId(raw?.professionId || node.professionId);
    const cap = normalizedLevels.get(professionId) || 0;
    if (node.professionId !== professionId || (allocationCounts.get(professionId) || 0) >= cap) continue;
    const isConnected = rootNodeIds.has(nodeId)
      || (graph.neighborIds.get(nodeId) || []).some((neighborId) => allocatedIds.has(neighborId));
    if (!isConnected) continue;
    allocations[nodeId] = Object.freeze({ professionId, trackLevel: node.trackLevel, order });
    allocatedIds.add(nodeId);
    allocationCounts.set(professionId, (allocationCounts.get(professionId) || 0) + 1);
    usedOrders.add(order);
  }

  let nextOrder = Math.max(0, ...Object.values(allocations).map((allocation) => allocation.order)) + 1;
  let madeProgress = true;
  while (madeProgress) {
    madeProgress = false;
    for (const [professionId, cap] of normalizedLevels) {
      if ((allocationCounts.get(professionId) || 0) >= cap) continue;
      const nodes = graph.professionNodes.get(professionId) || [];
      const candidate = nodes.find((node) => !allocatedIds.has(node.id) && (
        rootNodeIds.has(node.id)
        || (graph.neighborIds.get(node.id) || []).some((neighborId) => allocatedIds.has(neighborId))
      ));
      if (!candidate) continue;
      allocations[candidate.id] = Object.freeze({
        professionId,
        trackLevel: candidate.trackLevel,
        order: nextOrder,
      });
      allocatedIds.add(candidate.id);
      allocationCounts.set(professionId, (allocationCounts.get(professionId) || 0) + 1);
      nextOrder += 1;
      madeProgress = true;
    }
  }

  return {
    version: PROFESSION_TREE_VERSION,
    startProfessionId: canonicalStart,
    allocations,
    legacyRootNodeIds: [...legacyRootNodeIds].filter((nodeId) => allocatedIds.has(nodeId)).sort(),
  };
}

export function availableProfessionTreeNodeIds(state) {
  const graph = professionTreeGraph();
  const allocated = new Set(Object.keys(state?.allocations || {}));
  if (allocated.size === 0) return new Set([professionTreeStartNodeId(state?.startProfessionId || "wanderer")]);
  const available = new Set();
  for (const nodeId of allocated) {
    for (const neighborId of graph.neighborIds.get(nodeId) || []) {
      if (!allocated.has(neighborId)) available.add(neighborId);
    }
  }
  return available;
}

export function professionTreeAllocationLevels(professions = []) {
  return Object.fromEntries((professions || []).map((track) => [
    canonicalProfessionId(track.professionId),
    Math.max(0, Math.min(PROFESSION_TREE_NODE_COUNT, Object.values(track.paths || {}).reduce((sum, rank) => sum + Math.max(0, Math.floor(Number(rank) || 0)), 0))),
  ]));
}
