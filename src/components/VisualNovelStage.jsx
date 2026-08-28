import React, { useEffect, useMemo, useRef, useState } from "react";
import { portraitOverrideFor, PLAYER_PORTRAIT_ID } from "../engine/portrait-overrides.js";
import { BeatRender } from "./beats/BeatRender.jsx";
import { resolveCharacterPortrait } from "./character-portrait-assets.js";
import { resolveCodexPortrait } from "./codex-portrait-assets.js";
import { LiveNarratorStream } from "./LiveNarratorStream.jsx";

const NON_PAGE_BEAT_TYPES = new Set(["timestamp"]);

export function visualNovelBeats(beats) {
  return (Array.isArray(beats) ? beats : []).filter((beat) => (
    beat && typeof beat === "object" && !NON_PAGE_BEAT_TYPES.has(beat.type)
  ));
}

function initials(name) {
  return String(name || "World")
    .replace(/^the\s+/i, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

function playerRecord(state) {
  const playerId = state?.character?.id || PLAYER_PORTRAIT_ID;
  const codexPlayer = state?.world?.codex?.characters?.[playerId]
    || state?.world?.codex?.characters?.[PLAYER_PORTRAIT_ID]
    || {};
  return {
    ...codexPlayer,
    ...(state?.character || {}),
    id: playerId,
    kind: "player",
    name: state?.character?.name || codexPlayer.name || "Wanderer",
  };
}

export function visualNovelCharacter(state, beat) {
  if (!beat) return null;
  const player = playerRecord(state);
  const playerId = player.id;
  const actorId = beat.type === "player"
    ? playerId
    : (beat.type === "dialogue" ? beat.speakerId : beat.actorId);
  if (!actorId) return null;

  const record = actorId === playerId || actorId === PLAYER_PORTRAIT_ID
    ? player
    : state?.world?.codex?.characters?.[actorId];
  if (!record) return null;

  const overrideId = actorId === playerId ? PLAYER_PORTRAIT_ID : actorId;
  const override = portraitOverrideFor(state, overrideId);
  const atlasPortrait = resolveCodexPortrait(record);
  const portrait = resolveCharacterPortrait(record, atlasPortrait?.detailSrc || null, override);
  return {
    id: actorId,
    kind: actorId === playerId ? "player" : "character",
    name: record.name || beat.name || actorId,
    portrait,
  };
}

function CharacterStage({ character }) {
  if (!character) return null;
  return (
    <figure
      className={`visual-novel-character is-${character.kind}`}
      data-character-id={character.id}
      data-portrait-source={character.portrait ? "canonical" : "missing"}
    >
      {character.portrait ? (
        <img
          src={character.portrait}
          alt={`${character.name} portrait`}
          draggable="false"
          decoding="async"
        />
      ) : (
        <div role="img" aria-label={`${character.name} portrait unavailable`}>
          <span>{initials(character.name)}</span>
        </div>
      )}
      <figcaption>{character.name}</figcaption>
    </figure>
  );
}

export function VisualNovelStage({
  state,
  beats,
  loading = false,
  disabled = false,
  queuedCount = 0,

  onContinue,
  onBeatMenu,
}) {
  const pages = useMemo(() => visualNovelBeats(beats), [beats]);
  const [pageIndex, setPageIndex] = useState(() => Math.max(0, pages.length - 1));
  const previousCountRef = useRef(pages.length);
  const pageIdentity = pages.map((beat, index) => beat.id || `${beat.type}:${index}`).join("|");

  useEffect(() => {
    const previousCount = previousCountRef.current;
    const nextCount = pages.length;
    setPageIndex((current) => {
      if (nextCount === 0) return 0;
      if (nextCount < previousCount) return Math.min(current, nextCount - 1);
      if (nextCount > previousCount) {
        if (disabled) return nextCount - 1;
        const wasAtLiveEdge = previousCount === 0 || current >= previousCount - 1;
        return wasAtLiveEdge ? nextCount - 1 : current;
      }
      return Math.min(current, nextCount - 1);
    });
    previousCountRef.current = nextCount;
  }, [disabled, pageIdentity, pages.length]);

  const page = pages[pageIndex] || null;
  const atFirst = pageIndex <= 0;
  const atLiveEdge = pages.length === 0 || pageIndex >= pages.length - 1;
  const character = visualNovelCharacter(state, page);
  const nextLabel = atLiveEdge ? (queuedCount > 0 ? "Answer" : "Continue") : "Next";

  function showPrevious() {
    setPageIndex((current) => Math.max(0, current - 1));
  }

  function showNext() {
    if (!atLiveEdge) {
      setPageIndex((current) => Math.min(pages.length - 1, current + 1));
      return;
    }
    if (!loading && !disabled) onContinue?.();
  }

  return (
    <section className="visual-novel-stage" aria-label="Story scene">
      <header className="visual-novel-stage__meta">
        <span>{character?.name || (page?.type === "player" ? "You" : "Narrator")}</span>
        <output className="visual-novel-stage__counter" aria-label="Story position">
          {pages.length ? pageIndex + 1 : 0} / {pages.length}
        </output>
      </header>

      <div className="visual-novel-stage__scene">
        <CharacterStage character={character} />
        <div
          className="visual-novel-stage__page"
          data-beat-id={page?.id || undefined}
          aria-live="polite"
        >
          {page ? (
            <BeatRender
              beat={page}
              onMenu={onBeatMenu ? () => onBeatMenu(page, beats.indexOf(page)) : undefined}
            />
          ) : (
            <article className="beat beat--narration">
              <div className="beat__prose">The scene waits for your next move.</div>
            </article>
          )}
          {loading && atLiveEdge ? <LiveNarratorStream /> : null}
        </div>
      </div>

      <nav className="visual-novel-stage__controls" aria-label="Story navigation">
        <button
          type="button"
          onClick={showPrevious}
          disabled={disabled || atFirst}
          aria-label="Previous story beat"
        >
          <span aria-hidden="true">←</span>
          Back
        </button>
        <span aria-hidden="true" className="visual-novel-stage__progress">
          <i style={{ "--story-progress": pages.length ? (pageIndex + 1) / pages.length : 1 }} />
        </span>
        <button
          type="button"
          className="visual-novel-stage__next"
          onClick={showNext}
          disabled={disabled || (atLiveEdge && loading)}
          aria-label={atLiveEdge ? "Continue story" : "Next story beat"}
        >
          {loading && atLiveEdge ? "Narrator…" : nextLabel}
          <span aria-hidden="true">→</span>
        </button>
      </nav>
    </section>
  );
}

export default VisualNovelStage;
