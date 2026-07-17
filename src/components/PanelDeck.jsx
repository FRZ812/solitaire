import React, { useCallback, useEffect, useState, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { glass, shadow } from "./tokens.js";
import { PartyView } from "./PartyView.jsx";
import { MenuSheet } from "./MenuSheet.jsx";
import { InventoryView } from "./InventoryView.jsx";
import { ArsenalView } from "./ArsenalView.jsx";
import { CodexView } from "./CodexView.jsx";
import { useParallaxMotion } from "../hooks/useParallaxMotion.js";
import dossierPortrait from "../assets/generated/character-dossier-wanderer-v1.webp";
import { resolveCharacterPortrait } from "./character-portrait-assets.js";
import { ProfessionIcon } from "./ProfessionIcon.jsx";
import { normalizePortraitFile, PORTRAIT_ACCEPT } from "../engine/portrait.js";
import { PLAYER_PORTRAIT_ID, portraitOverrideFor } from "../engine/portrait-overrides.js";
import { characterSubclass } from "../data/character-subclasses.js";

// The unified character deck: Company · Character · Skills · Inventory ·
// Codex as five pages of one
// portrait-led bottom sheet, opened from a single header button (defaults to
// Character). Sections change only through the visible tabs so a horizontal
// gesture never steals an ordinary scroll inside a page.
const PAGES = ["party", "character", "abilities", "inventory", "codex"];
const LABELS = { party: "Company", character: "Character", abilities: "Skills", inventory: "Inventory", codex: "Codex" };
const PAGE_ICONS = { party: "company", character: "character", abilities: "abilities", inventory: "inventory", codex: "codex" };

export function shouldDismissPanel(pulled, velocity) {
  return pulled > 88 || (pulled > 18 && velocity > 0.55);
}

export function PanelDeck({ state, user, initialPage = "character", onClose, handlers }) {
  const requestedPage = PAGES.indexOf(initialPage);
  const [page, setPage] = useState(requestedPage === -1 ? PAGES.indexOf("character") : requestedPage);
  const [inventoryTarget, setInventoryTarget] = useState("wanderer");
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const grab = useRef(null);
  const scroll = useRef(null);
  const sheet = useRef(null);
  const dragY = useRef(0);
  const closeTimer = useRef(null);
  const suppressHandleClick = useRef(false);
  const grabListeners = useRef(null);

  const selectPage = (next) => {
    if (next === page) return;
    setPage(next);
  };

  const requestClose = useCallback(() => {
    if (closing) return;
    setDragging(false);
    setClosing(true);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(onClose, 420);
  }, [closing, onClose]);

  const writeDragY = useCallback((value) => {
    dragY.current = value;
    sheet.current?.style.setProperty("--panel-drag-y", `${value}px`);
  }, []);

  const detachGrabListeners = useCallback(() => {
    const listeners = grabListeners.current;
    if (!listeners) return;
    window.removeEventListener("pointermove", listeners.move);
    window.removeEventListener("pointerup", listeners.end);
    window.removeEventListener("pointercancel", listeners.cancel);
    grabListeners.current = null;
  }, []);

  useEffect(() => () => {
    window.clearTimeout(closeTimer.current);
    detachGrabListeners();
  }, [detachGrabListeners]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [page]);

  const openInventory = (characterId) => {
    setInventoryTarget(characterId || "wanderer");
    setPage(PAGES.indexOf("inventory"));
  };

  // Pointer capture keeps the sheet attached to the finger even when it leaves
  // the narrow handle. Distance plus release velocity decide close vs snap-back.
  function onGrabStart(event) {
    if (!event.isPrimary) return;
    detachGrabListeners();
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* window listeners remain the fallback */ }
    grab.current = {
      pointerId: event.pointerId,
      target: event.currentTarget,
      startY: event.clientY,
      lastY: event.clientY,
      lastAt: event.timeStamp,
      velocity: 0,
      moved: false,
    };
    suppressHandleClick.current = false;
    setDragging(true);
    writeDragY(0);

    const listeners = {
      move: (nativeEvent) => onGrabMove(nativeEvent),
      end: (nativeEvent) => onGrabEnd(nativeEvent),
      cancel: (nativeEvent) => onGrabCancel(nativeEvent),
    };
    grabListeners.current = listeners;
    window.addEventListener("pointermove", listeners.move, { passive: false });
    window.addEventListener("pointerup", listeners.end);
    window.addEventListener("pointercancel", listeners.cancel);
  }
  function onGrabMove(event) {
    const gesture = grab.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (event.cancelable) event.preventDefault();
    const nextY = Math.max(0, event.clientY - gesture.startY);
    const elapsed = Math.max(1, event.timeStamp - gesture.lastAt);
    gesture.velocity = (event.clientY - gesture.lastY) / elapsed;
    gesture.lastY = event.clientY;
    gesture.lastAt = event.timeStamp;
    gesture.moved ||= nextY > 6;
    suppressHandleClick.current ||= gesture.moved;
    writeDragY(nextY);
  }
  function onGrabEnd(event) {
    const gesture = grab.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const pulled = Math.max(0, gesture.lastY - gesture.startY);
    const shouldClose = shouldDismissPanel(pulled, gesture.velocity);
    detachGrabListeners();
    try { gesture.target?.releasePointerCapture?.(event.pointerId); } catch { /* pointer may already be released */ }
    grab.current = null;
    setDragging(false);
    if (shouldClose) requestClose();
    else writeDragY(0);
    window.setTimeout(() => { suppressHandleClick.current = false; }, 0);
  }
  function onGrabCancel(event) {
    if (event && grab.current && grab.current.pointerId !== event.pointerId) return;
    detachGrabListeners();
    grab.current = null;
    setDragging(false);
    writeDragY(0);
  }

  const activePage = PAGES[page];

  return (
    <div
      className={`panel-deck-backdrop${closing ? " is-closing" : ""}`}
      onClick={requestClose}
      role="presentation"
    >
      <div
        ref={sheet}
        className={`panel-deck${dragging ? " is-dragging" : ""}${closing ? " is-closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={(event) => {
          if (closing && event.target === event.currentTarget && event.propertyName === "transform") onClose();
        }}
        data-page={activePage}
        role="dialog"
        aria-modal="true"
        aria-label={`${LABELS[activePage]} menu`}
        style={{
          "--panel-drag-y": "0px",
          ...glass, boxShadow: shadow.sheet,
        }}
      >
        {/* The handle is the only sheet chrome and the only dismiss control. */}
        <div className="panel-deck__chrome">
          <button
            type="button"
            className="panel-deck__grab"
            aria-label="Drag down or tap to close menu"
            onClick={() => { if (!suppressHandleClick.current) requestClose(); }}
            onPointerDown={onGrabStart}
          ><span /></button>
        </div>

        <div
          ref={scroll}
          className="panel-deck__scroll no-scrollbar"
        >
          <DossierHero
            state={state}
            page={page}
            onSelectPage={selectPage}
            onPortraitChange={handlers?.onPortraitChange}
          />
          <div
            key={activePage}
            id={`deck-page-${activePage}`}
            className="panel-deck__active-page"
            role="tabpanel"
            aria-labelledby={`deck-tab-${activePage}`}
          >
            {activePage === "party" && (
              <PartyView state={state} onDismiss={handlers.onDismiss} onMount={handlers.onMount} onDismount={handlers.onDismount} onOpenInventory={openInventory} />
            )}
            {activePage === "character" && (
              <MenuSheet
                state={state} user={user}
                onReset={handlers.onReset}
                onBackToCampaigns={handlers.onBackToCampaigns} onSignOut={handlers.onSignOut}
                onLinkEmail={handlers.onLinkEmail}
              />
            )}
            {activePage === "abilities" && (
              <ArsenalView state={state} onCastBuff={handlers.onCastBuff} />
            )}
            {activePage === "inventory" && (
              <InventoryView
                state={state}
                onEquip={handlers.onEquip} onUnequip={handlers.onUnequip} onUse={handlers.onUse}
                onLightTorch={handlers.onLightTorch} onLightLantern={handlers.onLightLantern}
                onRest={handlers.onRest} onBindRune={handlers.onBindRune}
                onTransfer={handlers.onTransfer}
                initialSelectedId={inventoryTarget}
              />
            )}
            {activePage === "codex" && (
              <CodexView
                embedded
                state={state}
                onScry={handlers.onScry}
                onTrackCharacter={handlers.onTrackCharacter}
                onRenameMount={handlers.onRenameMount}
                onPortraitChange={handlers.onPortraitChange}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function labelize(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function DossierHero({ state, page, onSelectPage, onPortraitChange }) {
  const motionRef = useParallaxMotion({ strength: 1.1 });
  const fileInput = useRef(null);
  const [portraitBusy, setPortraitBusy] = useState(false);
  const [portraitError, setPortraitError] = useState("");
  const character = state.character;
  const wanderer = state.world?.codex?.characters?.wanderer || {};
  const identityRecord = { ...character, ...wanderer };
  const raceLabel = labelize(identityRecord.race);
  const professionLabel = labelize(identityRecord.profession);
  const subclass = characterSubclass(identityRecord);
  const portraitOverride = portraitOverrideFor(state, PLAYER_PORTRAIT_ID);
  const portrait = resolveCharacterPortrait(identityRecord, dossierPortrait, portraitOverride);
  const customPortrait = !!portraitOverride;

  async function onChoosePortrait(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onPortraitChange) return;
    setPortraitError("");
    setPortraitBusy(true);
    try {
      const prepared = await normalizePortraitFile(file);
      await onPortraitChange(PLAYER_PORTRAIT_ID, prepared);
    } catch (error) {
      setPortraitError(error?.message || "That portrait could not be prepared.");
    } finally {
      setPortraitBusy(false);
    }
  }

  async function resetPortrait() {
    if (!onPortraitChange) return;
    setPortraitError("");
    setPortraitBusy(true);
    try {
      await onPortraitChange(PLAYER_PORTRAIT_ID, null);
    } catch (error) {
      setPortraitError(error?.message || "That portrait could not be reset.");
    } finally {
      setPortraitBusy(false);
    }
  }

  function onTabKeyDown(event, index) {
    const last = PAGES.length - 1;
    let next = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (next == null) return;
    event.preventDefault();
    onSelectPage(next);
    requestAnimationFrame(() => document.getElementById(`deck-tab-${PAGES[next]}`)?.focus());
  }

  return (
    <section ref={motionRef} className="dossier-hero">
      <img className="dossier-hero__art" src={portrait} alt="" draggable="false" decoding="async" />
      <div className="dossier-hero__wash" aria-hidden="true" />
      <div className="dossier-hero__portrait-tools">
        <ProfessionIcon templateId={identityRecord.templateId} profession={identityRecord.profession} size="small" decorative />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={portraitBusy || !onPortraitChange}
          aria-label="Upload a new character portrait"
        >{portraitBusy ? "Preparing…" : customPortrait ? "Change portrait" : "Upload portrait"}</button>
        {customPortrait && (
          <button type="button" className="is-reset" onClick={resetPortrait} disabled={portraitBusy}>
            Use original
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={PORTRAIT_ACCEPT}
          onChange={onChoosePortrait}
          tabIndex={-1}
          aria-hidden="true"
        />
        {portraitError && <span role="alert">{portraitError}</span>}
      </div>
      <div className="dossier-hero__identity">
        <small>Player character</small>
        <h2>{identityRecord.name || character.name}</h2>
        <div className="dossier-hero__classline">
          {(raceLabel || professionLabel) ? (
            <>
              {raceLabel && <span>{raceLabel}</span>}
              {professionLabel && <strong className="is-class"><em>Class</em>{professionLabel}</strong>}
            </>
          ) : <span>Wanderer</span>}
          {subclass && <strong className="is-subclass"><em>Subclass</em>{subclass.label}</strong>}
        </div>
        {(identityRecord.bond || character.bond) && <p>{identityRecord.bond || character.bond}</p>}
      </div>
      <div className="dossier-hero__tabs" role="tablist" aria-label="Dossier sections">
        {PAGES.map((key, index) => (
          <button
            key={key}
            id={`deck-tab-${key}`}
            type="button"
            className={index === page ? "is-active" : ""}
            onClick={() => onSelectPage(index)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            role="tab"
            aria-selected={index === page}
            aria-controls={`deck-page-${key}`}
            tabIndex={index === page ? 0 : -1}
          >
            <Icon name={PAGE_ICONS[key]} size={18} />
            <span>{LABELS[key]}</span>
          </button>
        ))}
      </div>
      <div className="dossier-hero__gesture">choose a section · drag handle to close</div>
    </section>
  );
}
