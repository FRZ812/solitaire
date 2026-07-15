import React, { useCallback, useEffect, useState, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { glass, shadow } from "./tokens.js";
import { PartyView } from "./PartyView.jsx";
import { MenuSheet } from "./MenuSheet.jsx";
import { InventoryView } from "./InventoryView.jsx";
import { ArsenalView } from "./ArsenalView.jsx";
import { useParallaxMotion } from "../hooks/useParallaxMotion.js";
import dossierPortrait from "../assets/generated/character-dossier-wanderer-v1.webp";

// The unified character deck: Company · Character · Abilities · Inventory as
// four pages of one
// portrait-led bottom sheet, opened from a single header button (defaults to
// Character). Swipe LEFT/RIGHT to move between sections, or use the tabs.
const PAGES = ["party", "character", "abilities", "inventory"];
const LABELS = { party: "Company", character: "Character", abilities: "Abilities", inventory: "Inventory" };
const PAGE_ICONS = { party: "users", character: "user", abilities: "sparkle", inventory: "bag" };

export function shouldDismissPanel(pulled, velocity) {
  return pulled > 88 || (pulled > 18 && velocity > 0.55);
}

export function PanelDeck({ state, user, initialPage = "character", onClose, handlers }) {
  const requestedPage = PAGES.indexOf(initialPage);
  const [page, setPage] = useState(requestedPage === -1 ? PAGES.indexOf("character") : requestedPage);
  const [inventoryTarget, setInventoryTarget] = useState("wanderer");
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  const [direction, setDirection] = useState(1);
  const swipe = useRef(null);
  const grab = useRef(null);
  const scroll = useRef(null);
  const sheet = useRef(null);
  const dragY = useRef(0);
  const closeTimer = useRef(null);
  const suppressHandleClick = useRef(false);
  const grabListeners = useRef(null);

  const go = useCallback((dir) => {
    setDirection(dir);
    setPage((p) => (p + dir + PAGES.length) % PAGES.length);
  }, []); // wraps around

  const selectPage = (next) => {
    if (next === page) return;
    setDirection(next > page ? 1 : -1);
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
      if (event.key === "ArrowLeft" && event.altKey) go(-1);
      if (event.key === "ArrowRight" && event.altKey) go(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [go, requestClose]);

  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [page]);

  const openInventory = (characterId) => {
    setInventoryTarget(characterId || "wanderer");
    setDirection(1);
    setPage(PAGES.indexOf("inventory"));
  };

  // The content area only owns horizontal page swipes. Vertical gestures remain
  // native scrolling; dismissal is deliberately reserved for the top handle.
  function onTouchStart(e) {
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY, mode: null };
  }
  function onTouchMove(e) {
    const s = swipe.current; if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (!s.mode) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) s.mode = "swipe";
      else if (Math.abs(dy) > 8) s.mode = "scroll";
    }
  }
  function onTouchEnd(e) {
    const s = swipe.current; swipe.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx > 0 ? -1 : 1);
  }

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
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <DossierHero state={state} page={page} onSelectPage={selectPage} />
          <div
            key={activePage}
            id={`deck-page-${activePage}`}
            className="panel-deck__active-page"
            role="tabpanel"
            aria-labelledby={`deck-tab-${activePage}`}
            style={{ "--page-enter": `${direction * 18}px` }}
          >
            {activePage === "party" && (
              <PartyView state={state} onDismiss={handlers.onDismiss} onMount={handlers.onMount} onDismount={handlers.onDismount} onOpenInventory={openInventory} />
            )}
            {activePage === "character" && (
              <MenuSheet
                state={state} user={user}
                onReset={handlers.onReset} onOpenCodex={handlers.onOpenCodex}
                onBackToCampaigns={handlers.onBackToCampaigns} onSignOut={handlers.onSignOut}
                onLinkEmail={handlers.onLinkEmail} onExtinguish={handlers.onExtinguish}
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

function DossierHero({ state, page, onSelectPage }) {
  const motionRef = useParallaxMotion({ strength: 1.1 });
  const character = state.character;
  const identity = [labelize(character.race), labelize(character.profession)].filter(Boolean).join(" · ") || "Wanderer";

  return (
    <section ref={motionRef} className="dossier-hero">
      <img className="dossier-hero__art" src={dossierPortrait} alt="" draggable="false" />
      <div className="dossier-hero__wash" aria-hidden="true" />
      <div className="dossier-hero__identity">
        <small>Player character</small>
        <h2>{character.name}</h2>
        <div>{identity}</div>
        {character.bond && <p>{character.bond}</p>}
      </div>
      <div className="dossier-hero__tabs" role="tablist" aria-label="Dossier sections">
        {PAGES.map((key, index) => (
          <button
            key={key}
            id={`deck-tab-${key}`}
            type="button"
            className={index === page ? "is-active" : ""}
            onClick={() => onSelectPage(index)}
            role="tab"
            aria-selected={index === page}
            aria-controls={`deck-page-${key}`}
            tabIndex={index === page ? 0 : -1}
          >
            <Icon name={PAGE_ICONS[key]} size={15} strokeWidth={1.55} />
            <span>{LABELS[key]}</span>
          </button>
        ))}
      </div>
      <div className="dossier-hero__gesture">swipe sections · drag handle to close</div>
    </section>
  );
}
