import React, { useEffect, useMemo, useRef, useState } from "react";
import { ATTR_KEYS, ATTR_LABELS } from "../config.js";
import { PROFESSIONS } from "../data/professions.js";
import { RACES } from "../data/races.js";
import * as progressionPaths from "../data/progression-paths.js";
import { getAbilityDef } from "../data/abilities.js";
import { METAMAGIC_FEATURES, PROGRESSION_FEATURES } from "../data/progression-features.js";
import * as progressionEngine from "../engine/progression.js";
import {
  PROFESSION_TREE_NODE_COUNT,
  availableProfessionTreeNodeIds,
  professionTreeGraph,
  professionTreeStartNodeId,
} from "../data/profession-tree.js";
import { ProfessionIcon } from "./ProfessionIcon.jsx";
import { Icon } from "./Icon.jsx";
import { DeckPage, DeckPageHeader } from "./DeckPage.jsx";

const PROFESSION_CAP = 70;
const RACIAL_CAP = 30;
const compileProfessionTrack = progressionPaths.compileProfessionTrack || ((professionId, options) => {
  const legacy = progressionPaths.compileProfessionBuild?.(professionId, {
    archetypeId: options?.specializationId,
    sidePath: "utility",
  });
  return legacy ? { ...legacy, totalLevels: PROFESSION_CAP, levels: legacy.levels.slice(0, PROFESSION_CAP), pendingChoices: [] } : null;
});
const compileRacialTrack = progressionPaths.compileRacialTrack || (() => ({ totalLevels: RACIAL_CAP, levels: [] }));
const professionBranchChoices = progressionPaths.professionBranchChoices || (() => []);
const professionProgressionLevel = progressionEngine.professionProgressionLevel || ((character) => {
  const tracks = character?.progression?.professions;
  if (Array.isArray(tracks)) return tracks.reduce((sum, track) => sum + Object.values(track.paths || {}).reduce((n, rank) => n + (Number(rank) || 0), 0), 0);
  return progressionEngine.progressionLevel(character);
});
const racialProgressionLevel = progressionEngine.racialProgressionLevel || ((character) => Object.values(character?.progression?.racial?.paths || {}).reduce((sum, rank) => sum + (Number(rank) || 0), 0));
const pendingLevelAllocations = progressionEngine.pendingLevelAllocations || (() => null);
const pendingProgressionChoices = progressionEngine.pendingProgressionChoices || (() => []);
const resolvedProfessionTreeState = progressionEngine.professionTreeState || (() => ({ startProfessionId: "wanderer", allocations: {} }));

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function grantDetails(grant) {
  if (!grant) return { name: "Unknown feature", description: "" };
  if (grant.type === "ability-choice") {
    const names = (grant.options || []).map((id) => getAbilityDef(id)?.name || titleCase(id));
    return {
      name: grant.name || `Choose ${grant.count || 1} ${grant.count === 1 ? "ability" : "abilities"}`,
      description: [grant.description, names.length ? `Options: ${names.join(" · ")}` : null].filter(Boolean).join(" "),
    };
  }
  if (grant.type === "metamagic-choice") {
    const names = (grant.options || []).map((id) => METAMAGIC_FEATURES[id]?.name || titleCase(id));
    return {
      name: grant.name || `Choose ${grant.count || 1} metamagic`,
      description: [grant.description, names.length ? `Options: ${names.join(" · ")}` : null].filter(Boolean).join(" "),
    };
  }
  if (grant.name || grant.label) return { name: grant.name || grant.label, description: grant.description || "" };
  if (grant.type === "ability") {
    const ability = getAbilityDef(grant.id);
    return { name: ability?.name || titleCase(grant.id), description: grant.description || ability?.desc || "" };
  }
  if (grant.type === "metamagic") {
    const feature = METAMAGIC_FEATURES[grant.id];
    return { name: feature?.name || titleCase(grant.id), description: grant.description || feature?.description || "" };
  }
  const feature = PROGRESSION_FEATURES[grant.id];
  return { name: feature?.name || titleCase(grant.id || grant.type), description: grant.description || feature?.description || "" };
}

function GrantList({ grants, empty = null, compact = false }) {
  if (!grants?.length) return empty;
  return (
    <ul className={`profession-progress__grant-list${compact ? " is-compact" : ""}`}>
      {grants.map((grant, index) => {
        const details = grantDetails(grant);
        return (
          <li key={`${grant.type || "feature"}-${grant.id || index}`} data-grant-type={grant.type || "feature"}>
            <small>{titleCase(grant.type || "feature")}</small>
            <strong>{details.name}</strong>
            {details.description && <span>{details.description}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function treeLayout(rows) {
  const perRing = 10;
  const rings = Math.max(1, Math.ceil(rows.length / perRing));
  const size = rows.length > 30 ? 900 : 540;
  const center = size / 2;
  const ringGap = rows.length > 30 ? 53 : 58;
  const firstRadius = rows.length > 30 ? 68 : 72;
  const nodes = rows.map((row, index) => {
    const ring = Math.floor(index / perRing);
    const ringStart = ring * perRing;
    const count = Math.min(perRing, rows.length - ringStart);
    const slot = index - ringStart;
    const radius = firstRadius + ring * ringGap;
    const angle = (-Math.PI / 2) + ((slot / count) * Math.PI * 2) + ring * 0.16;
    return { row, x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
  });
  return { size, center, nodes };
}

function NodeSkillTree({
  rows, cap, ownedLevel = 0, kind, trackName, allocationChoice,
  allocationOptionId, unresolvedChoices = [], onSpendPoint,
}) {
  const viewportRef = useRef(null);
  const [selectedLevel, setSelectedLevel] = useState(() => Math.min(cap, Math.max(1, ownedLevel + 1)));
  const layout = useMemo(() => treeLayout(rows), [rows]);
  const selected = rows[Math.max(0, selectedLevel - 1)] || rows[0] || null;
  const option = allocationChoice?.options?.find((entry) => entry.optionId === allocationOptionId) || null;
  const blockingChoice = unresolvedChoices.find((choice) => choice.kind !== "level-allocation") || null;
  const points = allocationChoice?.unspentLevels || 0;
  const nextLevel = ownedLevel + 1;
  const canSpend = !!option && points > 0 && !blockingChoice && nextLevel <= cap;

  useEffect(() => {
    setSelectedLevel(Math.min(cap, Math.max(1, ownedLevel + 1)));
  }, [cap, ownedLevel, trackName]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
  }, [layout.size, trackName]);

  return (
    <section className="progression-tree" aria-label={`${kind} node skill tree`}>
      <div className="profession-progress__section-heading progression-tree__heading">
        <div><small>Center-out node tree</small><h3>Levels 1–{cap}</h3></div>
        <span>{ownedLevel} allocated · {points} available</span>
      </div>
      <p className="progression-tree__guide">Begin at the core and move outward. Select any node to inspect it; only the next connected node can consume a point.</p>
      <div className="progression-tree__viewport" ref={viewportRef} tabIndex={0} aria-label={`Scrollable ${trackName} tree`}>
        <div className="progression-tree__canvas" style={{ width: layout.size, height: layout.size }}>
          <svg className="progression-tree__connections" viewBox={`0 0 ${layout.size} ${layout.size}`} aria-hidden="true">
            {layout.nodes.length > 0 && (
              <line
                x1={layout.center} y1={layout.center}
                x2={layout.nodes[0].x} y2={layout.nodes[0].y}
                className={ownedLevel >= 1 ? "is-owned" : canSpend ? "is-available" : ""}
              />
            )}
            {layout.nodes.slice(1).map((node, index) => {
              const previous = layout.nodes[index];
              const targetLevel = index + 2;
              return (
                <line
                  key={`edge-${targetLevel}`}
                  x1={previous.x} y1={previous.y} x2={node.x} y2={node.y}
                  className={targetLevel <= ownedLevel ? "is-owned" : targetLevel === nextLevel && canSpend ? "is-available" : ""}
                />
              );
            })}
          </svg>
          <button type="button" className="progression-tree__core" onClick={() => setSelectedLevel(Math.max(1, Math.min(cap, ownedLevel || 1)))}>
            <strong>CORE</strong><span>{trackName}</span>
          </button>
          {layout.nodes.map(({ row, x, y }, index) => {
            const level = row?.trackLevel || row?.level || index + 1;
            const owned = level <= ownedLevel;
            const available = level === nextLevel && canSpend;
            const milestone = level % 5 === 0 || (row?.grants || row?.generalGrants || []).length > 1;
            return (
              <button
                key={`${row?.pathId || kind}-${level}`}
                type="button"
                className={`progression-tree__node${owned ? " is-owned" : available ? " is-available" : " is-locked"}${milestone ? " is-milestone" : ""}${selectedLevel === level ? " is-selected" : ""}`}
                style={{ left: x, top: y }}
                aria-label={`Level ${level} — ${row?.feature || `${titleCase(kind)} level ${level}`} — ${owned ? "allocated" : available ? "available" : "locked"}`}
                aria-pressed={selectedLevel === level}
                onClick={() => setSelectedLevel(level)}
              >
                <span>{level}</span>
                <i className="sr-only">{row?.feature || `${titleCase(kind)} level ${level}`}</i>
              </button>
            );
          })}
        </div>
      </div>
      {selected && (
        <article className="progression-tree__inspector" aria-live="polite">
          <header>
            <span>Level {selected.trackLevel || selected.level} · {selected.pathName || titleCase(selected.pathId || kind)}</span>
            <strong>{selected.feature || `${titleCase(kind)} level ${selected.trackLevel || selected.level}`}</strong>
            {selected.featureDescription && <p>{selected.featureDescription}</p>}
          </header>
          <GrantList grants={selected.generalGrants || selected.grants || []} empty={<p className="progression-tree__empty">This node advances the path without a separate grant.</p>} />
          {(selected.trackLevel || selected.level) === nextLevel && (
            <div className="progression-tree__investment">
              {blockingChoice ? (
                <span>Resolve <strong>{blockingChoice.name || titleCase(blockingChoice.id)}</strong> before moving farther.</span>
              ) : canSpend ? (
                <button type="button" onClick={() => onSpendPoint?.(allocationChoice.choiceId, allocationOptionId)}>
                  Invest 1 point in {trackName}
                </button>
              ) : (
                <span>Earn another character level to unlock this connected node.</span>
              )}
            </div>
          )}
        </article>
      )}
    </section>
  );
}

function choiceOptionDetails(choice, option) {
  const id = typeof option === "string" ? option : (option.id || option.optionId);
  if (typeof option !== "string") return { id, name: option.name || option.label || titleCase(id), description: option.description || "", grants: option.grants || option.rewards || [] };
  if (choice.type === "metamagic-choice") {
    const feature = METAMAGIC_FEATURES[id];
    return { id, name: feature?.name || titleCase(id), description: feature?.description || "", grants: [] };
  }
  const ability = getAbilityDef(id);
  return { id, name: ability?.name || PROGRESSION_FEATURES[id]?.name || titleCase(id), description: ability?.desc || PROGRESSION_FEATURES[id]?.description || "", grants: [] };
}

function PendingGrantChoices({ choices, onSelect }) {
  if (!choices.length) return null;
  return (
    <section className="progression-tree__pending" aria-label="Required node choices">
      <div className="profession-progress__section-heading"><div><small>Node decisions</small><h3>Choose before advancing</h3></div><span>{choices.length} pending</span></div>
      {choices.map((choice) => {
        const selected = new Set(choice.selectedOptions || []);
        return (
          <article key={choice.id} data-choice-id={choice.id}>
            <header><small>Level {choice.level}</small><strong>{choice.name || titleCase(choice.id)}</strong>{choice.description && <p>{choice.description}</p>}</header>
            <div>
              {(choice.options || []).map((option) => {
                const details = choiceOptionDetails(choice, option);
                return (
                  <button key={details.id} type="button" disabled={selected.has(details.id)} aria-pressed={selected.has(details.id)} onClick={() => onSelect(choice, details.id)}>
                    <strong>{details.name}</strong>{details.description && <span>{details.description}</span>}<GrantList grants={details.grants} compact />
                  </button>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function BranchTree({ profession, definitions, choices, pendingIds, onSelect, trackKind = "Profession" }) {
  if (!definitions.length) return null;
  const depths = new Map();
  const depthOf = (definition) => {
    if (!definition?.parentChoiceId) return 0;
    if (depths.has(definition.id)) return depths.get(definition.id);
    const depth = 1 + depthOf(definitions.find((entry) => entry.id === definition.parentChoiceId));
    depths.set(definition.id, depth);
    return depth;
  };
  return (
    <section className="profession-progress__branches" aria-labelledby={`profession-branches-${profession.id}`}>
      <div className="profession-progress__section-heading">
        <div><small>{trackKind === "Racial" ? "Evolution branches" : "Specialization branches"}</small><h3 id={`profession-branches-${profession.id}`}>Specialized paths</h3></div>
        <span>Explicit node choices</span>
      </div>
      <p className="profession-progress__branch-intro">The shared core remains intact while these threshold nodes branch into increasingly specialized paths.</p>
      <ol className="profession-progress__branch-tree">
        {definitions.map((choice) => {
          const selected = choices[choice.id] || null;
          const pending = pendingIds.has(choice.id);
          const parentSatisfied = !choice.parentChoiceId || choices[choice.parentChoiceId] === choice.parentOptionId;
          return (
            <li
              key={choice.id}
              data-choice-id={choice.id}
              data-parent-choice={choice.parentChoiceId || undefined}
              className={`${pending ? "is-pending" : ""}${!parentSatisfied ? " is-locked" : ""}`}
              style={{ "--branch-depth": depthOf(choice) }}
            >
              <header>
                <span>{trackKind} level {choice.threshold}</span>
                <strong>{choice.name}</strong>
                {choice.description && <p>{choice.description}</p>}
                {pending && <em>Choice required</em>}
                {!parentSatisfied && <em>Requires {titleCase(choice.parentOptionId)}</em>}
              </header>
              <div>
                {(choice.options || []).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected === option.id}
                    disabled={!parentSatisfied || (!!selected && !pending)}
                    onClick={() => onSelect(choice, option)}
                  >
                    <strong>{option.name || titleCase(option.id)}</strong>
                    {option.description && <span>{option.description}</span>}
                    <GrantList grants={option.grants || []} compact />
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const UNIFIED_PROFESSION_GRAPH = professionTreeGraph();
const MIN_PROFESSION_ZOOM = 0.085;
const MAX_PROFESSION_ZOOM = 1.35;

function clampProfessionZoom(value) {
  return Math.max(MIN_PROFESSION_ZOOM, Math.min(MAX_PROFESSION_ZOOM, value));
}

function professionNodeDomId(nodeId) {
  return `profession-tree-${String(nodeId).replace(/[^a-z0-9_-]+/gi, "-")}`;
}

function ProfessionTreeSearch({ searchIndex, selectedNodeId, onSelect }) {
  const [query, setQuery] = useState("");
  const searchOpen = query.trim().length >= 2;
  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];
    return searchIndex.filter((entry) => entry.haystack.includes(needle)).slice(0, 8);
  }, [query, searchIndex]);
  return (
    <>
      <label className="unified-profession-tree__search">
        <span>Find any profession or skill</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={searchOpen}
          aria-controls="profession-tree-search-results"
          placeholder="Wizard, medicine, Perfect Hunt…"
        />
      </label>
      <ul id="profession-tree-search-results" className="unified-profession-tree__search-results" role="listbox" hidden={!searchOpen}>
        {searchResults.length > 0
          ? searchResults.map(({ node, row }) => (
            <li key={node.id}><button type="button" role="option" aria-selected={selectedNodeId === node.id} onClick={() => onSelect(node.id)}><strong>{PROFESSIONS[node.professionId]?.name}</strong><span>{row?.feature || `Route node ${node.trackLevel || node.localIndex + 1}`}</span></button></li>
          ))
          : <li className="is-empty" role="option" aria-disabled="true">No matching skills</li>}
      </ul>
    </>
  );
}

export function UnifiedProfessionTree({ character, onChooseProgression }) {
  const graph = UNIFIED_PROFESSION_GRAPH;
  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const dragRef = useRef(null);
  const suppressNodeClickRef = useRef(false);
  const viewRef = useRef({ zoom: 0.12, x: 0, y: 0 });
  const wheelCommitRef = useRef(null);
  const initialProfessionId = character?.progression?.professionTree?.startProfessionId
    || progressionPaths.canonicalProfessionId?.(character?.profession)
    || "wanderer";
  const treeState = resolvedProfessionTreeState(character);
  const allocations = treeState.allocations || {};
  const allocatedIds = useMemo(() => new Set(Object.keys(allocations)), [allocations]);
  const frontierIds = useMemo(() => availableProfessionTreeNodeIds(treeState), [treeState]);
  const tracks = Array.isArray(character?.progression?.professions) ? character.progression.professions : [];
  const trackByProfession = useMemo(() => new Map(tracks.map((track) => [track.professionId, track])), [tracks]);
  const compiledByProfession = useMemo(() => new Map(Object.keys(PROFESSIONS).map((professionId) => {
    const track = trackByProfession.get(professionId);
    return [professionId, compileProfessionTrack(professionId, {
      specializationId: track?.specializationId,
      choices: track?.choices,
      branchChoices: track?.branchChoices,
    })];
  })), [trackByProfession]);
  const branchDefinitionsByProfession = useMemo(() => new Map(Object.keys(PROFESSIONS).map((professionId) => [professionId, professionBranchChoices(professionId) || []])), []);
  const allocationChoice = pendingLevelAllocations(character);
  const blockingChoices = pendingProgressionChoices(character).filter((choice) => choice.kind !== "level-allocation");
  const points = allocationChoice?.unspentLevels || 0;
  const invested = professionProgressionLevel(character);
  const startNodeId = professionTreeStartNodeId(treeState.startProfessionId || initialProfessionId);
  const [selectedNodeId, setSelectedNodeId] = useState(() => (
    points > 0 && !blockingChoices.length
      ? frontierIds.values().next().value || startNodeId
      : startNodeId
  ));
  const [view, setView] = useState({ zoom: 0.12, x: 0, y: 0 });

  const searchIndex = useMemo(() => graph.nodes.map((node) => {
    const profession = PROFESSIONS[node.professionId];
    const row = compiledByProfession.get(node.professionId)?.levels?.[node.localIndex] || null;
    const grantText = (row?.grants || row?.generalGrants || []).map((grant) => {
      const details = grantDetails(grant);
      return `${details.name} ${details.description}`;
    }).join(" ");
    const specializationText = (profession?.specializations || []).map((entry) => `${entry.name} ${entry.description || ""}`).join(" ");
    const branchText = (branchDefinitionsByProfession.get(node.professionId) || []).filter((choice) => choice.threshold === node.localIndex + 1)
      .flatMap((choice) => [choice.name, choice.description, ...(choice.options || []).flatMap((option) => [option.name, option.description])]).filter(Boolean).join(" ");
    return {
      node,
      row,
      haystack: `${profession?.name || node.professionId} ${profession?.role || ""} ${profession?.description || ""} ${specializationText} ${branchText} ${row?.feature || ""} ${row?.featureDescription || ""} ${grantText}`.toLowerCase(),
    };
  }), [branchDefinitionsByProfession, compiledByProfession, graph.nodes]);
  const selectedNode = graph.nodeById.get(selectedNodeId) || graph.nodeById.get(startNodeId) || graph.nodes[0];
  const selectedAllocation = allocations[selectedNode.id] || null;
  const selectedTrackLevel = selectedNode.trackLevel || selectedNode.localIndex + 1;
  const selectedRow = compiledByProfession.get(selectedNode.professionId)?.levels?.[Math.max(0, selectedTrackLevel - 1)] || null;
  const selectedProfession = PROFESSIONS[selectedNode.professionId];
  const selectedGateDefinitions = (branchDefinitionsByProfession.get(selectedNode.professionId) || []).filter((choice) => choice.threshold === selectedTrackLevel);
  const selectedOption = allocationChoice?.options?.find((option) => option.professionId === selectedNode.professionId) || null;
  const selectedState = selectedAllocation ? "owned" : frontierIds.has(selectedNode.id) ? (points > 0 && !blockingChoices.length ? "available" : "frontier") : "locked";
  const canSpendSelected = selectedState === "available" && selectedOption?.availableNodeIds?.includes(selectedNode.id);

  function applyView(nextView, commit = true) {
    viewRef.current = nextView;
    if (worldRef.current) worldRef.current.style.transform = `translate(${nextView.x}px, ${nextView.y}px) scale(${nextView.zoom})`;
    if (commit) setView(nextView);
  }

  function fitTree() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const zoom = clampProfessionZoom(Math.min(
      (viewport.clientWidth - 28) / graph.size,
      (viewport.clientHeight - 28) / graph.size,
    ));
    applyView({
      zoom,
      x: (viewport.clientWidth - (graph.size * zoom)) / 2,
      y: (viewport.clientHeight - (graph.size * zoom)) / 2,
    });
  }

  function centerOnNode(nodeId, preferredZoom = 1) {
    const viewport = viewportRef.current;
    const node = graph.nodeById.get(nodeId);
    if (!viewport || !node) return;
    const zoom = clampProfessionZoom(preferredZoom);
    applyView({
      zoom,
      x: (viewport.clientWidth / 2) - (node.x * zoom),
      y: (viewport.clientHeight / 2) - (node.y * zoom),
    });
  }

  function focusNode(nodeId, preferredZoom = Math.max(0.9, view.zoom)) {
    setSelectedNodeId(nodeId);
    centerOnNode(nodeId, preferredZoom);
    requestAnimationFrame(() => document.getElementById(professionNodeDomId(nodeId))?.focus());
  }

  function zoomAtCenter(multiplier) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const currentView = viewRef.current;
    const nextZoom = clampProfessionZoom(currentView.zoom * multiplier);
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    const ratio = nextZoom / currentView.zoom;
    applyView({ zoom: nextZoom, x: centerX - ((centerX - currentView.x) * ratio), y: centerY - ((centerY - currentView.y) * ratio) });
  }

  useEffect(() => {
    fitTree();
  }, []);

  useEffect(() => {
    if (!graph.nodeById.has(selectedNodeId)) setSelectedNodeId(startNodeId);
  }, [graph.nodeById, selectedNodeId, startNodeId]);

  useEffect(() => {
    viewRef.current = view;
    return () => {
      if (wheelCommitRef.current) clearTimeout(wheelCommitRef.current);
    };
  }, [view]);

  function onPointerDown(event) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      view: viewRef.current,
      captureTarget: event.currentTarget,
      moved: false,
    };
    viewportRef.current?.classList.add("is-dragging");
  }

  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) drag.moved = true;
    applyView({ ...drag.view, x: drag.view.x + event.clientX - drag.x, y: drag.view.y + event.clientY - drag.y }, false);
  }

  function finishPointer(event) {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    drag.captureTarget?.releasePointerCapture?.(event.pointerId);
    if (drag.moved) {
      suppressNodeClickRef.current = true;
      setTimeout(() => { suppressNodeClickRef.current = false; }, 0);
    }
    dragRef.current = null;
    viewportRef.current?.classList.remove("is-dragging");
    setView(viewRef.current);
  }

  function onWheel(event) {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const currentView = viewRef.current;
    const nextZoom = clampProfessionZoom(currentView.zoom * (event.deltaY > 0 ? 0.86 : 1.16));
    const ratio = nextZoom / currentView.zoom;
    applyView({ zoom: nextZoom, x: pointerX - ((pointerX - currentView.x) * ratio), y: pointerY - ((pointerY - currentView.y) * ratio) }, false);
    if (wheelCommitRef.current) clearTimeout(wheelCommitRef.current);
    wheelCommitRef.current = setTimeout(() => setView(viewRef.current), 100);
  }

  function onNodeKeyDown(event, node) {
    if (event.key === "Home") {
      event.preventDefault();
      focusNode(startNodeId, 1);
      return;
    }
    const direction = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    const candidates = (graph.neighborIds.get(node.id) || []).map((nodeId) => graph.nodeById.get(nodeId)).filter(Boolean);
    const matching = candidates.filter((candidate) => ((candidate.x - node.x) * direction[0]) + ((candidate.y - node.y) * direction[1]) > 0);
    const next = (matching.length ? matching : candidates).sort((a, b) => {
      const scoreA = ((a.x - node.x) * direction[0]) + ((a.y - node.y) * direction[1]);
      const scoreB = ((b.x - node.x) * direction[0]) + ((b.y - node.y) * direction[1]);
      return scoreB - scoreA;
    })[0];
    if (next) focusNode(next.id, viewRef.current.zoom);
  }

  return (
    <section className="unified-profession-tree" aria-labelledby="unified-profession-tree-title">
      <header className="unified-profession-tree__intro">
        <div><small>All professions · one connected constellation</small><h2 id="unified-profession-tree-title">Unified profession skill tree</h2></div>
        <div className="unified-profession-tree__budget"><strong>{points}</strong><span>Unspent</span><b>{invested} / {PROFESSION_CAP}</b></div>
      </header>
      <p className="unified-profession-tree__explanation">Your creation profession is your first owned crest. Follow any connected line, split into several directions, or cross interwoven profession boundaries to build a true multiclass route.</p>

      <div className="unified-profession-tree__toolbar" aria-label="Profession tree controls">
        <ProfessionTreeSearch searchIndex={searchIndex} selectedNodeId={selectedNodeId} onSelect={focusNode} />
        <div className="unified-profession-tree__zoom-controls">
          <button type="button" onClick={() => zoomAtCenter(0.82)} aria-label="Zoom out profession tree"><Icon name="zoomOut" size={15} /></button>
          <output aria-label="Profession tree zoom">{Math.round(view.zoom * 100)}%</output>
          <button type="button" onClick={() => zoomAtCenter(1.22)} aria-label="Zoom in profession tree"><Icon name="zoomIn" size={15} /></button>
          <button type="button" onClick={fitTree}>Fit tree</button>
          <button type="button" onClick={() => centerOnNode(startNodeId, 1)}>My start</button>
        </div>
      </div>

      <div className="unified-profession-tree__legend" aria-hidden="true"><span className="is-owned">Owned route</span><span className="is-available">Spendable frontier</span><span className="is-locked">Unreached</span></div>
      <p id="profession-tree-instructions" className="sr-only">Drag to pan and use the mouse wheel or zoom controls to zoom. Select a node to inspect it. Arrow keys move between connected nodes and Home returns to your starting profession.</p>
      <div
        ref={viewportRef}
        className="unified-profession-tree__viewport"
        role="region"
        aria-label="Pan and zoom unified profession skill tree"
        aria-describedby="profession-tree-instructions"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onWheel={onWheel}
      >
        <div ref={worldRef} className="unified-profession-tree__world" style={{ width: graph.size, height: graph.size, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
          <svg viewBox={`0 0 ${graph.size} ${graph.size}`} className="unified-profession-tree__edges" aria-hidden="true">
            {graph.edges.map((edge) => {
              const from = graph.nodeById.get(edge.from);
              const to = graph.nodeById.get(edge.to);
              const fromOwned = allocatedIds.has(edge.from);
              const toOwned = allocatedIds.has(edge.to);
              const available = (fromOwned && frontierIds.has(edge.to)) || (toOwned && frontierIds.has(edge.from));
              return <line key={edge.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} data-edge-kind={edge.kind} className={fromOwned && toOwned ? "is-owned" : available ? "is-available" : "is-locked"} />;
            })}
          </svg>
          <div className="unified-profession-tree__nodes">
            {graph.nodes.map((node) => {
              const allocation = allocations[node.id] || null;
              const structurallyAvailable = frontierIds.has(node.id);
              const spendable = structurallyAvailable && points > 0 && !blockingChoices.length;
              const stateName = allocation ? "owned" : spendable ? "available" : structurallyAvailable ? "frontier" : "locked";
              const previewLevel = node.trackLevel || node.localIndex + 1;
              const row = compiledByProfession.get(node.professionId)?.levels?.[Math.max(0, previewLevel - 1)] || null;
              const gateDefinitions = (branchDefinitionsByProfession.get(node.professionId) || []).filter((choice) => choice.threshold === previewLevel);
              const milestone = previewLevel % 10 === 0 || (row?.grants || []).length > 1;
              const profession = PROFESSIONS[node.professionId];
              return (
                <button
                  id={professionNodeDomId(node.id)}
                  key={node.id}
                  type="button"
                  className={`unified-profession-tree__node is-${stateName}${node.isStart ? " is-start" : ""}${milestone ? " is-milestone" : ""}${gateDefinitions.length ? " is-choice-gate" : ""}${selectedNode.id === node.id ? " is-selected" : ""}`}
                  style={{ left: node.x, top: node.y, "--profession-hue": node.hue }}
                  data-node-id={node.id}
                  data-profession={node.professionId}
                  data-node-state={stateName}
                  data-start={node.isStart ? "true" : undefined}
                  aria-label={`${profession?.name || node.professionId} — ${row?.feature || `route node ${previewLevel}`} — ${stateName}`}
                  aria-pressed={selectedNode.id === node.id}
                  tabIndex={selectedNode.id === node.id ? 0 : -1}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onPointerDown(event);
                  }}
                  onClick={(event) => {
                    if (suppressNodeClickRef.current) {
                      event.preventDefault();
                      return;
                    }
                    setSelectedNodeId(node.id);
                  }}
                  onKeyDown={(event) => onNodeKeyDown(event, node)}
                >
                  {node.isStart ? <><ProfessionIcon profession={node.professionId} size="tiny" decorative /><strong>{profession?.name || titleCase(node.professionId)}</strong></> : <span>{previewLevel}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <article className="unified-profession-tree__inspector" aria-live="polite" data-node-state={selectedState}>
        <header>
          <ProfessionIcon profession={selectedNode.professionId} size="small" decorative />
          <div><small>{selectedProfession?.name || titleCase(selectedNode.professionId)} · {selectedNode.isStart ? "starting crest" : `route node ${selectedNode.localIndex + 1}`}</small><h3>{selectedRow?.feature || "Uncharted profession route"}</h3></div>
          <span className={`is-${selectedState}`}>{titleCase(selectedState)}</span>
        </header>
        {selectedRow?.featureDescription && <p>{selectedRow.featureDescription}</p>}
        <GrantList grants={selectedRow?.grants || selectedRow?.generalGrants || []} empty={<p className="progression-tree__empty">This node extends the route without a separate typed grant.</p>} />
        {selectedGateDefinitions.length > 0 && <div className="unified-profession-tree__gate"><small>Specialization keystone</small><strong>{selectedGateDefinitions.map((choice) => choice.name).join(" · ")}</strong><span>{selectedGateDefinitions.flatMap((choice) => choice.options || []).map((option) => option.name || titleCase(option.id)).join(" · ")}</span></div>}
        <div className="unified-profession-tree__specializations"><small>Specialization gates in this region</small><span>{(selectedProfession?.specializations || []).map((entry) => entry.name).join(" · ") || "General profession routes"}</span></div>
        <footer>
          {selectedAllocation ? <span>Point {selectedAllocation.order} · {selectedProfession?.name} node {selectedTrackLevel}</span>
            : blockingChoices.length ? <span>Resolve <strong>{blockingChoices[0].name || titleCase(blockingChoices[0].id)}</strong> before spending another point.</span>
              : !frontierIds.has(selectedNode.id) ? <span>Connect this node to your owned route before investing here.</span>
                : points <= 0 ? <span>Earn another character level to spend on this frontier.</span>
                  : null}
          {canSpendSelected && <button type="button" onClick={() => onChooseProgression?.(selectedNode.professionId, allocationChoice.choiceId, selectedOption.optionId, selectedNode.id)}>Spend 1 point · {selectedProfession?.name} node {selectedTrackLevel}</button>}
        </footer>
      </article>
      <PendingGrantChoices choices={blockingChoices} onSelect={(choice, optionId) => onChooseProgression?.(choice.professionId || null, choice.id || choice.choiceId, optionId)} />
    </section>
  );
}

function ProfessionCard({ profession, currentLevel = 0, currentSpecializations = [], onOpen }) {
  const names = (profession.specializations || []).map((entry) => entry.name);
  return (
    <li className="profession-catalog__item">
      <button id={`profession-card-${profession.id}`} type="button" className="profession-card" onClick={onOpen}>
        <ProfessionIcon profession={profession.id} size="medium" decorative />
        <span className="profession-card__body">
          <span className="profession-card__eyebrow"><span>{profession.role || profession.domain || "Profession"}</span><span>{currentLevel > 0 ? `Your investment · ${currentLevel} / ${PROFESSION_CAP}` : `0–${PROFESSION_CAP} levels`}</span></span>
          <strong className="profession-card__name">{profession.name}</strong>
          <span className="profession-card__description">{profession.description}</span>
          <span className="profession-card__archetype"><small>Specialization branches</small><strong>{currentSpecializations.length ? currentSpecializations.join(" · ") : names.slice(0, 3).join(" · ") || "Authored focus paths"}</strong></span>
          <span className="profession-card__open">View profession and branches <span aria-hidden="true">→</span></span>
        </span>
      </button>
    </li>
  );
}

export function ProfessionProgression({ profession, character = null, currentTrack = null, currentLevel = 0, onBack, onChooseProgression }) {
  const [previewSpecialization, setPreviewSpecialization] = useState(currentTrack?.specializationId || null);
  const [previewChoices, setPreviewChoices] = useState(() => ({ ...(currentTrack?.branchChoices || currentTrack?.choices || {}) }));
  const headingRef = useRef(null);
  useEffect(() => headingRef.current?.focus(), [profession.id]);
  useEffect(() => {
    setPreviewSpecialization(currentTrack?.specializationId || null);
    setPreviewChoices({ ...(currentTrack?.branchChoices || currentTrack?.choices || {}) });
  }, [currentTrack, profession.id]);

  const compiled = useMemo(() => compileProfessionTrack(profession.id, {
    specializationId: previewSpecialization,
    choices: previewChoices,
    branchChoices: previewChoices,
  }), [previewChoices, previewSpecialization, profession.id]);
  const definitions = professionBranchChoices(profession.id) || [];
  const pendingChoices = currentTrack && progressionPaths.pendingProfessionChoices
    ? progressionPaths.pendingProfessionChoices(currentTrack)
    : [];
  const pendingIds = new Set(pendingChoices.map((choice) => choice.id || choice.choiceId));
  const finalAttributes = compiled?.finalAttributes || {};
  const allocationChoice = character ? pendingLevelAllocations(character) : null;
  const unresolvedChoices = character ? pendingProgressionChoices(character).filter((choice) => choice.kind !== "level-allocation") : [];
  const trackChoices = unresolvedChoices.filter((choice) => choice.professionId === profession.id);
  const grantChoices = trackChoices.filter((choice) => choice.kind === "grant");

  const chooseBranch = (choice, option) => {
    if (!pendingIds.has(choice.id) || !currentTrack) {
      setPreviewChoices((current) => ({ ...current, [choice.id]: option.id }));
      return;
    }
    onChooseProgression?.(profession.id, choice.id, option.id);
  };

  return (
    <section className="profession-progress" aria-labelledby={`profession-progress-title-${profession.id}`}>
      {onBack && <button type="button" className="profession-progress__back" onClick={onBack}>← All professions</button>}
      <header className="profession-progress__hero">
        <ProfessionIcon profession={profession.id} size="hero" decorative />
        <div className="profession-progress__identity">
          <small>Profession tree · 0–{PROFESSION_CAP}</small>
          <h2 id={`profession-progress-title-${profession.id}`} ref={headingRef} tabIndex={-1}>{profession.name}</h2>
          <p>{profession.description}</p>
        </div>
        <div className="profession-progress__total"><strong>{currentLevel}</strong><span>Invested / {PROFESSION_CAP}</span></div>
      </header>

      <section className="profession-progress__focus" aria-label="Specialization preview">
        <div><small>Branch preview</small><strong>{previewSpecialization ? (profession.specializations || []).find((entry) => entry.id === previewSpecialization)?.name || titleCase(previewSpecialization) : "General core"}</strong></div>
        <p>Preview a path, then commit to its authored specialization node when its threshold is reached.</p>
        <div className="profession-progress__specialization-options">
          <button type="button" aria-pressed={!previewSpecialization} onClick={() => setPreviewSpecialization(null)}>General core</button>
          {(profession.specializations || []).map((specialization) => (
            <button key={specialization.id} type="button" aria-pressed={previewSpecialization === specialization.id} onClick={() => setPreviewSpecialization(specialization.id)}>
              <strong>{specialization.name}</strong><span>{specialization.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="profession-progress__attributes" aria-label="Profession level 70 attributes">
        <div className="profession-progress__section-heading"><div><small>General track projection</small><h3>Level 70 attributes</h3></div><span>Before racial evolution</span></div>
        <ul>{ATTR_KEYS.map((key) => <li key={key}><span><small>{ATTR_LABELS[key]}</small><strong>{finalAttributes[key] || 0}</strong></span></li>)}</ul>
      </section>

      <NodeSkillTree
        rows={compiled?.levels || []}
        cap={PROFESSION_CAP}
        ownedLevel={currentLevel}
        kind="profession"
        trackName={profession.name}
        allocationChoice={allocationChoice}
        allocationOptionId={`profession:${profession.id}`}
        unresolvedChoices={unresolvedChoices}
        onSpendPoint={(choiceId, optionId) => onChooseProgression?.(profession.id, choiceId, optionId)}
      />
      <BranchTree profession={profession} definitions={definitions} choices={previewChoices} pendingIds={pendingIds} onSelect={chooseBranch} />
      <PendingGrantChoices choices={grantChoices} onSelect={(choice, optionId) => onChooseProgression?.(profession.id, choice.id, optionId)} />
    </section>
  );
}

export function RacialProgression({ character, raceId: raceIdOverride = null, onBack, onChooseProgression }) {
  const ownedRaceId = character?.progression?.racial?.raceId || character?.race;
  const raceId = raceIdOverride || ownedRaceId;
  const ownsRace = !!raceId && raceId === ownedRaceId;
  const racial = ownsRace ? character?.progression?.racial || null : null;
  const level = ownsRace ? racialProgressionLevel(character) : 0;
  const [previewChoices, setPreviewChoices] = useState(() => ({ ...(racial?.branchChoices || racial?.choices || {}) }));
  useEffect(() => setPreviewChoices({ ...(racial?.branchChoices || racial?.choices || {}) }), [raceId, racial?.branchChoices, racial?.choices]);
  const compiled = useMemo(() => compileRacialTrack(raceId, {
    evolutionId: racial?.evolutionId || character?.subrace || null,
    choices: previewChoices,
    branchChoices: previewChoices,
  }), [character?.subrace, previewChoices, raceId, racial?.evolutionId]);
  const definitions = progressionPaths.racialBranchChoices?.(raceId) || [];
  const pendingChoices = progressionPaths.pendingRacialBranchChoices?.(raceId, level, racial?.branchChoices || {}) || [];
  const pendingIds = new Set(pendingChoices.map((choice) => choice.id || choice.choiceId));
  const finalAttributes = compiled?.finalAttributes || {};
  const allocationChoice = character ? pendingLevelAllocations(character) : null;
  const unresolvedChoices = character ? pendingProgressionChoices(character).filter((choice) => choice.kind !== "level-allocation") : [];
  const chooseBranch = (choice, option) => {
    if (!pendingIds.has(choice.id)) {
      setPreviewChoices((current) => ({ ...current, [choice.id]: option.id }));
      return;
    }
    if (ownsRace) onChooseProgression?.(null, choice.id, option.id);
    else setPreviewChoices((current) => ({ ...current, [choice.id]: option.id }));
  };
  const race = RACES[raceId];
  return (
    <section className="profession-progress profession-progress--racial">
      {onBack && <button type="button" className="profession-progress__back" onClick={onBack}>← Race tree</button>}
      <header className="profession-progress__hero">
        <div className="profession-progress__identity"><small>Race tree · 0–{RACIAL_CAP}</small><h2>{race?.name || titleCase(raceId)}</h2><p>Lineage awakening and racial powers share the character point bank while advancing on their own dedicated tree.</p></div>
        <div className="profession-progress__total"><strong>{level}</strong><span>Invested / {RACIAL_CAP}</span></div>
      </header>
      <section className="profession-progress__attributes" aria-label="Racial level 30 attributes">
        <div className="profession-progress__section-heading"><div><small>Racial track projection</small><h3>Level 30 attributes</h3></div><span>Before profession levels</span></div>
        <ul>{ATTR_KEYS.map((key) => <li key={key}><span><small>{ATTR_LABELS[key]}</small><strong>{finalAttributes[key] || 0}</strong></span></li>)}</ul>
      </section>
      <NodeSkillTree
        rows={compiled?.levels || []}
        cap={RACIAL_CAP}
        ownedLevel={level}
        kind="racial evolution"
        trackName={`${race?.name || titleCase(raceId)} lineage`}
        allocationChoice={allocationChoice}
        allocationOptionId="racial:evolution"
        unresolvedChoices={unresolvedChoices}
        onSpendPoint={(choiceId, optionId) => onChooseProgression?.(null, choiceId, optionId)}
      />
      <BranchTree profession={{ id: raceId }} definitions={definitions} choices={previewChoices} pendingIds={pendingIds} onSelect={chooseBranch} trackKind="Racial" />
    </section>
  );
}

export function ProfessionCatalog({ character, onChooseProgression, initialProfessionId = null }) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [selectedId, setSelectedId] = useState(initialProfessionId);
  const tracks = Array.isArray(character?.progression?.professions) ? character.progression.professions : [];
  const professionLevel = professionProgressionLevel(character);
  const professions = useMemo(() => Object.values(PROFESSIONS).sort((a, b) => a.name.localeCompare(b.name)), []);
  const domains = useMemo(() => [...new Set(professions.map((entry) => entry.role || entry.domain || "general"))].sort(), [professions]);
  const visible = professions.filter((profession) => {
    const group = profession.role || profession.domain || "general";
    if (domain !== "all" && group !== domain) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [profession.name, profession.description, group, ...(profession.specializations || []).flatMap((entry) => [entry.name, entry.description])]
      .filter(Boolean).join(" ").toLowerCase().includes(needle);
  });

  if (selectedId && PROFESSIONS[selectedId]) {
    const track = tracks.find((entry) => entry.professionId === selectedId) || null;
    const currentLevel = track ? Object.values(track.paths || {}).reduce((sum, rank) => sum + (Number(rank) || 0), 0) : 0;
    return <ProfessionProgression profession={PROFESSIONS[selectedId]} character={character} currentTrack={track} currentLevel={currentLevel} onBack={() => setSelectedId(null)} onChooseProgression={onChooseProgression} />;
  }

  return (
    <section className="profession-catalog fade-in" aria-labelledby="profession-catalog-title">
      <header className="profession-catalog__intro"><small>Profession constellation</small><h2 id="profession-catalog-title">Choose a profession tree</h2><p>Spend up to 70 profession points across broad callings. Every calling begins at its own core and branches into authored specializations at levels 10, 30, and 50.</p></header>
      <div className="profession-catalog__tools">
        <label className="profession-catalog__search"><span>Search professions</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Profession, specialization, branch, or focus" /></label>
        <label className="profession-catalog__filter"><span>Discipline</span><select value={domain} onChange={(event) => setDomain(event.target.value)}><option value="all">All disciplines</option>{domains.map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}</select></label>
      </div>
      <div className="profession-catalog__result-count" aria-live="polite">{visible.length} of {professions.length} broad professions · {professionLevel} / {PROFESSION_CAP} levels invested</div>
      <ul className="profession-catalog__list">
        {visible.map((profession) => {
          const owned = tracks.filter((entry) => entry.professionId === profession.id);
          const ownedLevel = owned.reduce((sum, track) => sum + Object.values(track.paths || {}).reduce((trackSum, rank) => trackSum + (Number(rank) || 0), 0), 0);
          const specializations = owned.map((track) => (profession.specializations || []).find((entry) => entry.id === track.specializationId)?.name || titleCase(track.specializationId)).filter(Boolean);
          return <ProfessionCard key={profession.id} profession={profession} currentLevel={ownedLevel} currentSpecializations={specializations} onOpen={() => setSelectedId(profession.id)} />;
        })}
      </ul>
    </section>
  );
}

export function ProfessionTreePage({ state, onChooseProgression }) {
  const character = state?.character;
  const points = pendingLevelAllocations(character)?.unspentLevels || 0;
  const invested = professionProgressionLevel(character);
  return (
    <DeckPage className="progression-tree-page progression-tree-page--profession">
      <DeckPageHeader icon="progress" title="Profession" subtitle={`${points} unspent ${points === 1 ? "point" : "points"} · ${invested} / ${PROFESSION_CAP} invested · unified skill tree`} />
      <UnifiedProfessionTree character={character} onChooseProgression={onChooseProgression} />
    </DeckPage>
  );
}

export function RaceTreePage({ state, onChooseProgression }) {
  const character = state?.character;
  const points = pendingLevelAllocations(character)?.unspentLevels || 0;
  return (
    <DeckPage className="progression-tree-page progression-tree-page--race">
      <DeckPageHeader icon="world" title="Race" subtitle={`${points} unspent ${points === 1 ? "point" : "points"} · lineage · evolution`} />
      <RacialProgression character={character} onChooseProgression={onChooseProgression} />
    </DeckPage>
  );
}
